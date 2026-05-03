"""
FastAPI backend for the Insider Trading Tracker.

Serves insider trade data from two SQLite databases:
  - insider_watchlist.db  (per-ticker watchlist scraping)
  - insider_all.db        (latest Form 4 filings from SEC RSS)

Run:
    uvicorn app:app --reload --port 8000
"""
import sys
import asyncio
import os
import sqlite3
import uuid
from typing import Optional

from fastapi import FastAPI, Query, HTTPException, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from form4.sec_form4_watchlist import parse_all_from_watchlist, WATCHLIST
from form4.form4_parser import parse_all_from_rss
from form4.form4_db import save_to_db
from earnings.tavily_transcripts import fetch_transcript
from agents.conversational_cio import chat as cio_chat, reset_session as cio_reset
from agents.data_loader import _lookup_cik, SEC_10KQ_DB
from company_data import (
    SECRateLimit,
    TickerNotFound,
    get_company_data,
)
from company_facts.company_specific_fin import fetch_and_save as fetch_and_save_company_facts
# from playwright.async_api import async_playwright
from playwright.sync_api import sync_playwright

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

DB_PATHS = {
    "watchlist": os.path.join(BASE_DIR, "db", "insider_watchlist.db"),
    "all":       os.path.join(BASE_DIR, "db", "insider_all.db"),
}

TRANSCRIPTS_DB = os.path.join(BASE_DIR, "db", "earnings_transcripts.db")
COMPANY_FACTS_DB = os.path.join(BASE_DIR, "db", "company_facts.db")

# ---------------------------------------------------------------------------
# App
# ---------------------------------------------------------------------------

# [에러 해결 핵심 코드] 윈도우 환경일 경우 Proactor 이벤트 루프 정책을 강제로 설정합니다.
if sys.platform == "win32" or "win64":
    asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())

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
# GET /api/documents/{ticker} — fetch SEC 10-K/10-Q text sections
# ---------------------------------------------------------------------------

@app.get("/api/documents/{ticker}/list")
def list_documents(ticker: str):
    """Return a list of available 10-K/10-Q filings for a ticker."""
    cik, _ = _lookup_cik(ticker)
    if not cik:
        raise HTTPException(status_code=404, detail=f"CIK not found for {ticker}")
        
    if not os.path.exists(SEC_10KQ_DB):
        return {"filings": []}
        
    conn = sqlite3.connect(SEC_10KQ_DB)
    conn.row_factory = sqlite3.Row
    cik_padded = cik.lstrip("0")
    
    rows = conn.execute(
        """
        SELECT accession_number, form_type, filing_date, company_name
        FROM filing_sections
        WHERE cik IN (?, ?)
        ORDER BY filing_date DESC
        """,
        (cik, cik_padded)
    ).fetchall()
    conn.close()
    
    return {"filings": [dict(r) for r in rows]}


@app.get("/api/documents/{ticker}/{accession_number}")
def get_document_detail(ticker: str, accession_number: str):
    """Return MD&A and Risk Factors for a specific filing."""
    if not os.path.exists(SEC_10KQ_DB):
        raise HTTPException(status_code=404, detail="sec_10kq.db not found")
        
    conn = sqlite3.connect(SEC_10KQ_DB)
    conn.row_factory = sqlite3.Row
    
    row = conn.execute(
        """
        SELECT company_name, form_type, filing_date, business, risk_factors, mda 
        FROM filing_sections
        WHERE accession_number = ?
        """,
        (accession_number,)
    ).fetchone()
    conn.close()
    
    if not row:
        raise HTTPException(status_code=404, detail="Filing not found")
        
    return dict(row)


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


@app.get("/api/transcripts/{ticker}/list")
def list_transcripts(ticker: str):
    """Return a list of available earnings call transcripts for a ticker."""
    if not os.path.exists(TRANSCRIPTS_DB):
        return {"transcripts": []}
        
    conn = sqlite3.connect(TRANSCRIPTS_DB)
    conn.row_factory = sqlite3.Row
    
    rows = conn.execute(
        """
        SELECT fiscal_year, fiscal_quarter, call_date, title
        FROM earnings_transcripts
        WHERE ticker = ?
        ORDER BY fiscal_year DESC, fiscal_quarter DESC
        """,
        (ticker.upper(),)
    ).fetchall()
    conn.close()
    
    return {"transcripts": [dict(r) for r in rows]}


def _query_financial_periods(cik: str) -> list[dict]:
    if not os.path.exists(COMPANY_FACTS_DB):
        return []
    conn = sqlite3.connect(COMPANY_FACTS_DB)
    conn.row_factory = sqlite3.Row
    rows = conn.execute(
        """
        SELECT fy, fp, form, filed, COUNT(*) as fact_count
        FROM company_facts
        WHERE cik = ?
        GROUP BY fy, fp, form, filed
        ORDER BY filed DESC
        """,
        (cik,),
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


@app.get("/api/financials/{ticker}/list")
def list_financial_periods(ticker: str):
    """
    Return unique filing periods for a ticker.

    DB-first: query company_facts.db. On miss, fetch from SEC EDGAR
    (companyfacts API), persist, then re-query.
    """
    cik, _ = _lookup_cik(ticker)
    if not cik:
        raise HTTPException(status_code=404, detail=f"CIK not found for {ticker}")

    periods = _query_financial_periods(cik)
    if not periods:
        try:
            fetch_and_save_company_facts(ticker, COMPANY_FACTS_DB)
        except Exception as e:
            raise HTTPException(
                status_code=502,
                detail=f"Failed to fetch financial facts from SEC: {e!r}",
            )
        periods = _query_financial_periods(cik)

    return {"periods": periods}


def _query_financial_facts(cik: str, fy: int, fp: str, form: str, filed: str) -> list[dict]:
    if not os.path.exists(COMPANY_FACTS_DB):
        return []
    conn = sqlite3.connect(COMPANY_FACTS_DB)
    conn.row_factory = sqlite3.Row
    rows = conn.execute(
        """
        SELECT concept, label, val, unit, fy, fp, form, period_end, filed
        FROM company_facts
        WHERE cik = ? AND fy = ? AND fp = ? AND form = ? AND filed = ?
        ORDER BY concept ASC, period_end DESC
        """,
        (cik, fy, fp, form, filed),
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


@app.get("/api/financials/{ticker}/detail")
def get_financial_detail(
    ticker: str,
    fy:   int = Query(...),
    fp:   str = Query(...),
    form: str = Query(...),
    filed: str = Query(...)
):
    """
    Return ALL XBRL facts for a specific filing period.

    DB-first: if no rows match, fetch the entire companyfacts payload from
    SEC EDGAR and re-query.
    """
    cik, _ = _lookup_cik(ticker)
    if not cik:
        raise HTTPException(status_code=404, detail=f"CIK not found for {ticker}")

    facts = _query_financial_facts(cik, fy, fp, form, filed)
    if not facts:
        try:
            fetch_and_save_company_facts(ticker, COMPANY_FACTS_DB)
        except Exception as e:
            raise HTTPException(
                status_code=502,
                detail=f"Failed to fetch financial facts from SEC: {e!r}",
            )
        facts = _query_financial_facts(cik, fy, fp, form, filed)

    return {"facts": facts}


# ---------------------------------------------------------------------------
# GET /api/company-data/{ticker} — search-driven, DB-first cached lookup
# ---------------------------------------------------------------------------

@app.get("/api/company-data/{ticker}")
def get_company_data_endpoint(
    ticker: str,
    limit: int = Query(
        4,
        ge=1,
        le=1000,
        description="How many 10-K/10-Q filings to return. If the DB has fewer than this, missing filings are scraped from SEC.",
    ),
    limit_form4: int = Query(
        30,
        ge=1,
        le=1000,
        description="How many Form 4 insider trades to return.",
    ),
):
    """
    Return Form 4 + 10-K/10-Q data for `ticker`.

    Strategy:
      1. Resolve ticker → CIK (404 if unknown).
      2. Check sec_10kq.db / insider_*.db for fresh rows (per-form TTL +
         "DB has at least `limit` 10-K/Q rows").
      3. On miss, fetch from SEC EDGAR, persist, and return.

    Errors:
      404 — unknown ticker
      503 — SEC rate-limited the scrape (Retry-After header set)
      502 — other upstream/parse failure
    """
    try:
        return get_company_data(ticker, limit_10kq=limit, limit_form4=limit_form4)
    except TickerNotFound as e:
        raise HTTPException(status_code=404, detail=str(e))
    except SECRateLimit as e:
        return JSONResponse(
            status_code=503,
            content={"detail": str(e), "retry_after": e.retry_after},
            headers={"Retry-After": str(e.retry_after)},
        )
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=502, detail=f"Upstream error: {e!r}")


# ---------------------------------------------------------------------------
# POST /chat — conversational CIO ReAct agent
# ---------------------------------------------------------------------------

class ChatRequest(BaseModel):
    user_message: str = Field(..., min_length=1, description="The user's chat message.")
    session_id: Optional[str] = Field(
        None,
        description="Conversation thread id. If omitted, a new one is generated and returned.",
    )


class ChatResponse(BaseModel):
    session_id: str
    reply: str


@app.post("/chat", response_model=ChatResponse)
def chat_with_cio(req: ChatRequest):
    """
    Talk to the conversational Chief Investment Officer agent.

    The CIO has tools to query the insider-trades SQLite DB and to consult the
    Financial / Risk / Sentiment subordinate analysts. Conversation memory is
    keyed by `session_id`; reuse the same id across turns to continue a thread.
    """
    session_id = req.session_id or uuid.uuid4().hex
    try:
        reply = cio_chat(req.user_message, session_id=session_id)
    except RuntimeError as e:
        # Surfaces missing GOOGLE_API_KEY etc. as 500.
        raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"CIO agent error: {e!r}")
    return ChatResponse(session_id=session_id, reply=reply)


@app.post("/chat/reset")
def chat_reset(session_id: str = Query(..., description="Session id to clear")):
    """Drop the memory buffer for a single conversation thread."""
    cio_reset(session_id)
    return {"status": "ok", "session_id": session_id}

@app.get("/api/download-pdf")
def generate_pdf(url: str):
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=False)
        # [핵심 해결책] SEC가 요구하는 규격의 명찰(User-Agent)을 달고 새 창을 엽니다.
        # [수정 포인트 1] 괄호와 기호를 모두 뺀 가장 안전하고 단순한 포맷
        sec_user_agent = "DK mrsimple@gmail.com"
        
        context = browser.new_context(
            user_agent=sec_user_agent,
            extra_http_headers={
                "User-Agent": sec_user_agent,
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
                "Accept-Language": "en-US,en;q=0.9,ko;q=0.8",
                "Accept-Encoding": "gzip, deflate, br",
                "Connection": "keep-alive",
                "Upgrade-Insecure-Requests": "1"
            }
        )
        # browser가 아닌 context에서 페이지를 생성해야 명찰이 적용됩니다.
        page = context.new_page()
        # 1. SEC 페이지 접속
        page.goto(url)
        # [수정 포인트 3] SEC 방화벽이 페이지를 렌더링하고 차단을 풀 시간을 주기 위한 1.5초 대기
        page.wait_for_timeout(1500)
        # 2. 물리적 저장이 아닌, 메모리 상의 바이트(Bytes)로 PDF 구워내기
        pdf_bytes = page.pdf(format="A4") 
        browser.close()
        # 3. DB에 저장하지 않고 생성된 바이트를 유저에게 그대로 전송!
        return Response(content=pdf_bytes, media_type="application/pdf")



