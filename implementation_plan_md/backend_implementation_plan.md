# Backend Implementation Plan — Insider Trading Tracker

## Goal

Add a FastAPI backend to the existing SEC Form 4 scraper pipeline so the data in `insider_watchlist.db` can be served as a JSON API. The frontend (built separately) will consume these endpoints.

## Current State

| File | Role |
|------|------|
| `sec_form4_rss.py` | Fetch latest Form 4 filings from SEC Atom feed |
| `sec_form4_watchlist.py` | Fetch filings per-ticker from WATCHLIST |
| `form4_parser.py` | Parse filing XML → structured dict |
| `form4_db.py` | Flatten & persist to SQLite |
| `insider_watchlist.db` | SQLite DB, 327 rows, 6 tickers (AAPL, MSFT, NVDA, TSLA, GOOGL, GOOG) |

All existing modules remain **unchanged**. The backend is purely additive.

---

## Proposed Changes

### Dependencies

```
pip install fastapi uvicorn apscheduler
```

> **Note:** No other new dependencies needed. SQLite is in the stdlib, and the scraper modules are already installed.

---

### [NEW] `app.py` — FastAPI Server (main entry point)

The single new file. Responsibilities:

1. **Create the FastAPI app** with CORS middleware (so the frontend can call it)
2. **Define API endpoints** (see below)
3. **Run the background scheduler** that periodically calls the existing scraper pipeline
4. **Serve static files** (for the frontend later)

#### API Endpoints

##### `GET /api/trades`

Main endpoint. Returns insider trades from the DB with optional filters.

| Query Param | Type | Default | Description |
|-------------|------|---------|-------------|
| `ticker` | str (optional) | — | Filter by ticker symbol (e.g. `AAPL`) |
| `owner` | str (optional) | — | Partial match on owner name |
| `code` | str (optional) | — | Transaction code filter (`S`=sell, `P`/`A`=buy, `M`=exercise, etc.) |
| `acquired_or_disposed` | str (optional) | — | `A` or `D` |
| `date_from` | str (optional) | — | Start date `YYYY-MM-DD` |
| `date_to` | str (optional) | — | End date `YYYY-MM-DD` |
| `min_value` | float (optional) | — | Minimum `transaction_value` |
| `limit` | int | 100 | Max rows returned |
| `offset` | int | 0 | Pagination offset |

**Response shape:**
```json
{
  "total": 327,
  "limit": 100,
  "offset": 0,
  "trades": [
    {
      "id": 1,
      "ticker": "AAPL",
      "owner_name": "Borders Ben",
      "officer_title": "SVP, Gen Counsel & Secretary",
      "is_director": "0",
      "is_officer": "1",
      "transaction_date": "2026-04-15",
      "transaction_code": "M",
      "amount": 1717.0,
      "acquired_or_disposed": "A",
      "price_per_share": null,
      "shares_owned_after": 39200.0,
      "trade_ratio_pct": 4.38,
      "transaction_value": 0.0,
      "market_value_after": 10439280.0,
      "security_title": "Common Stock",
      "source_url": "https://..."
    }
  ]
}
```

##### `GET /api/summary`

Aggregated overview per ticker. Used for the dashboard cards/header.

**Response shape:**
```json
{
  "summary": [
    {
      "ticker": "AAPL",
      "total_trades": 65,
      "total_buys": 30,
      "total_sells": 12,
      "total_buy_value": 5230000.0,
      "total_sell_value": 1200000.0,
      "latest_trade_date": "2026-04-15",
      "unique_insiders": 8
    }
  ]
}
```

Built from a single SQL query with `GROUP BY ticker` and conditional aggregation.

##### `GET /api/watchlist`

Returns the current watchlist tickers from `sec_form4_watchlist.WATCHLIST`.

```json
{
  "watchlist": ["AAPL", "MSFT", "NVDA", "TSLA", "GOOGL"]
}
```

##### `POST /api/refresh`

Manually trigger a scrape cycle (calls the existing `parse_all_from_watchlist()` → `save_to_db()` pipeline). Returns the count of new rows inserted.

```json
{
  "status": "ok",
  "inserted": 12,
  "skipped": 53
}
```

> **Important:** This endpoint should be rate-limited or protected in production to avoid hammering SEC servers.

##### `GET /api/trades/{id}`

Return a single trade's full detail by its `id` (for a detail view / modal).

---

### Database Query Layer (inside `app.py`)

A small helper function that builds a parameterized SQL query from the filter params:

```python
def query_trades(db_path, *, ticker=None, owner=None, code=None, ...):
    sql = "SELECT * FROM insider_trades WHERE 1=1"
    params = []
    if ticker:
        sql += " AND ticker = ?"
        params.append(ticker.upper())
    if owner:
        sql += " AND owner_name LIKE ?"
        params.append(f"%{owner}%")
    # ... etc
    sql += " ORDER BY transaction_date DESC LIMIT ? OFFSET ?"
    params.extend([limit, offset])
    # Also run a COUNT(*) query for total
```

All queries use **parameterized `?` placeholders** — no SQL injection risk.

---

### Background Scheduler

Using `apscheduler` to run the scraper on a timer:

```python
from apscheduler.schedulers.background import BackgroundScheduler

def scheduled_scrape():
    """Runs the existing pipeline: fetch → parse → DB."""
    results = parse_all_from_watchlist()
    all_filings = []
    for ticker, filings in results.items():
        all_filings.extend(filings)
    save_to_db(all_filings, DB_PATH)

scheduler = BackgroundScheduler()
scheduler.add_job(scheduled_scrape, "interval", minutes=30)
scheduler.start()
```

This reuses `sec_form4_watchlist.parse_all_from_watchlist()` and `form4_db.save_to_db()` directly — no duplication.

---

### CORS Configuration

```python
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],   # tighten in production
    allow_methods=["*"],
    allow_headers=["*"],
)
```

---

### Static File Serving (prep for frontend)

```python
from fastapi.staticfiles import StaticFiles

app.mount("/", StaticFiles(directory="static", html=True), name="static")
```

The frontend files (`index.html`, `style.css`, `app.js`) will live in a `static/` folder and be served directly by FastAPI. No separate web server needed.

---

## File Structure After Implementation

```
c:\ffin\
├── app.py                      ← NEW (FastAPI server + scheduler)
├── form4_parser.py             ← unchanged
├── form4_db.py                 ← unchanged
├── sec_form4_watchlist.py      ← unchanged
├── sec_form4_rss.py            ← unchanged
├── insider_watchlist.db        ← unchanged (read by API, written by scheduler)
└── static/                     ← NEW (empty for now, frontend goes here later)
```

---

## Questions for Review

1. **Scheduler interval**: Defaulting to every 30 minutes. SEC allows max 10 req/s; each scrape cycle makes ~50 requests (5 tickers × 10 filings). Is 30 minutes a good interval, or do you want something else?

2. **Auth on `/api/refresh`**: For now there's no authentication—anyone can trigger a scrape. Fine for local use, but flag if you plan to deploy publicly.

---

## Verification Plan

### Automated Tests
After building `app.py`:

```powershell
# 1. Start the server
python -m uvicorn app:app --reload --port 8000

# 2. Test endpoints (in another terminal)
curl http://localhost:8000/api/trades
curl http://localhost:8000/api/trades?ticker=AAPL&limit=5
curl http://localhost:8000/api/summary
curl http://localhost:8000/api/watchlist
curl -X POST http://localhost:8000/api/refresh
```

### Manual Verification
- Confirm JSON response shapes match the spec above
- Confirm filters work (ticker, owner name search, date range)
- Confirm pagination (`limit` + `offset`) works
- Confirm scheduler runs without blocking the API
