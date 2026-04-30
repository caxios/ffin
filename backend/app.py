"""
FastAPI backend for the Insider Trading Tracker.

Serves insider trade data from two SQLite databases:
  - insider_watchlist.db  (per-ticker watchlist scraping)
  - insider_all.db        (latest Form 4 filings from SEC RSS)

Run:
    uvicorn app:app --reload --port 8000
"""

import os
import sqlite3
from typing import Optional

from fastapi import FastAPI, Query, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from form4.sec_form4_watchlist import parse_all_from_watchlist, WATCHLIST
from form4.form4_parser import parse_all_from_rss
from form4.form4_db import save_to_db
from earnings.tavily_transcripts import fetch_transcript


# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

DB_PATHS = {
    "watchlist": os.path.join(BASE_DIR, "db", "insider_watchlist.db"),
    "all":       os.path.join(BASE_DIR, "db", "insider_all.db"),
}

TRANSCRIPTS_DB = os.path.join(BASE_DIR, "db", "earnings_transcripts.db")

# ---------------------------------------------------------------------------
# App
# ---------------------------------------------------------------------------

app = FastAPI(title="Insider Trading Tracker API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _db_path(source: str) -> str:
    """Resolve source name to a database file path."""
    path = DB_PATHS.get(source)
    if not path:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid source '{source}'. Use 'watchlist' or 'all'.",
        )
    return path


def _connect(source: str) -> sqlite3.Connection:
    """Open a connection with Row factory for dict-like access."""
    conn = sqlite3.connect(_db_path(source))
    conn.row_factory = sqlite3.Row
    return conn


# ---------------------------------------------------------------------------
# GET /api/trades — filtered + paginated trade list
# ---------------------------------------------------------------------------

@app.get("/api/trades")
def get_trades(
    source: str = Query("watchlist", description="DB source: 'watchlist' or 'all'"),
    ticker: Optional[str] = None,
    owner:  Optional[str] = None,
    code:   Optional[str] = None,
    acquired_or_disposed: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to:   Optional[str] = None,
    min_value: Optional[float] = None,
    limit:  int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
):
    """Return insider trades with optional filters and pagination."""
    conn = _connect(source)

    clauses = []
    params  = []

    if ticker:
        clauses.append("ticker = ?")
        params.append(ticker.upper())
    if owner:
        clauses.append("owner_name LIKE ?")
        params.append(f"%{owner}%")
    if code:
        clauses.append("transaction_code = ?")
        params.append(code.upper())
    if acquired_or_disposed:
        clauses.append("acquired_or_disposed = ?")
        params.append(acquired_or_disposed.upper())
    if date_from:
        clauses.append("transaction_date >= ?")
        params.append(date_from)
    if date_to:
        clauses.append("transaction_date <= ?")
        params.append(date_to)
    if min_value is not None:
        clauses.append("transaction_value >= ?")
        params.append(min_value)

    where_sql = " AND ".join(clauses) if clauses else "1=1"

    # Total count (for pagination metadata)
    total = conn.execute(
        f"SELECT COUNT(*) FROM insider_trades WHERE {where_sql}", params
    ).fetchone()[0]

    # Page of data
    rows = conn.execute(
        f"""
        SELECT * FROM insider_trades
        WHERE  {where_sql}
        ORDER BY transaction_date DESC, id DESC
        LIMIT ? OFFSET ?
        """,
        params + [limit, offset],
    ).fetchall()

    conn.close()

    return {
        "total":  total,
        "limit":  limit,
        "offset": offset,
        "trades": [dict(r) for r in rows],
    }


# ---------------------------------------------------------------------------
# GET /api/trades/{id} — single trade detail
# ---------------------------------------------------------------------------

@app.get("/api/trades/{trade_id}")
def get_trade(trade_id: int, source: str = Query("watchlist")):
    """Return the full detail of a single trade by its row ID."""
    conn = _connect(source)
    row = conn.execute(
        "SELECT * FROM insider_trades WHERE id = ?", (trade_id,)
    ).fetchone()
    conn.close()

    if not row:
        raise HTTPException(status_code=404, detail="Trade not found")
    return dict(row)


# ---------------------------------------------------------------------------
# GET /api/summary — per-ticker aggregated stats
# ---------------------------------------------------------------------------

@app.get("/api/summary")
def get_summary(source: str = Query("watchlist")):
    """Aggregated overview per ticker (trade counts, values, insiders)."""
    conn = _connect(source)

    rows = conn.execute("""
        SELECT
            ticker,
            COUNT(*)
                AS total_trades,
            SUM(CASE WHEN acquired_or_disposed = 'A' THEN 1 ELSE 0 END)
                AS total_buys,
            SUM(CASE WHEN acquired_or_disposed = 'D' THEN 1 ELSE 0 END)
                AS total_sells,
            SUM(CASE WHEN acquired_or_disposed = 'A'
                      THEN COALESCE(transaction_value, 0) ELSE 0 END)
                AS total_buy_value,
            SUM(CASE WHEN acquired_or_disposed = 'D'
                      THEN COALESCE(transaction_value, 0) ELSE 0 END)
                AS total_sell_value,
            MAX(transaction_date)
                AS latest_trade_date,
            COUNT(DISTINCT owner_name)
                AS unique_insiders
        FROM insider_trades
        GROUP BY ticker
        ORDER BY ticker
    """).fetchall()

    conn.close()
    return {"summary": [dict(r) for r in rows]}


# ---------------------------------------------------------------------------
# GET /api/watchlist — current tracked tickers
# ---------------------------------------------------------------------------

@app.get("/api/watchlist")
def get_watchlist():
    """Return the list of tickers from the watchlist config."""
    return {"watchlist": WATCHLIST}


# ---------------------------------------------------------------------------
# POST /api/refresh — manual scrape trigger
# ---------------------------------------------------------------------------

@app.post("/api/refresh")
def refresh(
    source: str = Query("watchlist"),
    count:  int = Query(5, ge=1, le=40, description="Filings per company (watchlist only)"),
):
    """
    Manually trigger a scrape cycle.

    - source=watchlist → scrape per-ticker from WATCHLIST (count configurable)
    - source=all       → scrape latest 100 Form 4s from SEC RSS feed
    """
    db_path = _db_path(source)

    if source == "watchlist":
        results = parse_all_from_watchlist(count=count)
        all_filings = []
        for ticker_filings in results.values():
            all_filings.extend(ticker_filings)
    else:
        all_filings = parse_all_from_rss()

    inserted, skipped = save_to_db(all_filings, db_path)

    return {
        "status":   "ok",
        "source":   source,
        "inserted": inserted,
        "skipped":  skipped,
    }


# ---------------------------------------------------------------------------
# GET /api/transcript — on-demand earnings call transcript
# ---------------------------------------------------------------------------

@app.get("/api/transcript")
def get_transcript(
    ticker: str,
    year:   int = Query(..., description="Fiscal year, e.g. 2024"),
    quarter: int = Query(..., ge=1, le=4, description="Fiscal quarter 1-4"),
    force_refresh: bool = Query(False, description="Bypass cache and re-fetch"),
):
    """
    Return the earnings call transcript for ticker/year/quarter.

    On first call, searches via Tavily and caches the result. Subsequent calls
    return the cached row unless force_refresh=true.
    """
    try:
        row = fetch_transcript(
            ticker=ticker,
            fiscal_year=year,
            fiscal_quarter=quarter,
            db_path=TRANSCRIPTS_DB,
            force_refresh=force_refresh,
        )
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e))

    if not row:
        raise HTTPException(status_code=404, detail="No transcript found")
    return row


