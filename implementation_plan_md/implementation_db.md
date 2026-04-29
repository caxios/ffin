# Add SQLite Persistence to Form 4 Pipeline

Save all parsed Form 4 insider trading data into local SQLite databases using the built-in `sqlite3` library. No filtering/classification in Python — raw dump only, with SQL queries used later for analysis.

## User Review Required

> [!IMPORTANT]
> **Two separate DB files** — one per pipeline:
> - `insider_all.db` ← from `sec_form4_rss.py` (all latest filings)
> - `insider_watchlist.db` ← from `sec_form4_watchlist.py` (watchlist companies only)

> [!IMPORTANT]
> **Deduplication** — `INSERT OR IGNORE` with a unique constraint on `(source_url, owner_name, transaction_date, security_title, amount)` to prevent duplicates when re-running scripts.

## Proposed Changes

### Shared DB Layer in form4_parser.py

#### [MODIFY] form4_parser.py

Add two functions at the bottom of the file (before `if __name__`):

**`init_db(db_path: str)`** — Creates the `insider_trades` table if it doesn't exist:

```sql
CREATE TABLE IF NOT EXISTS insider_trades (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,

    -- Filing-level
    source_url          TEXT,
    document_type       TEXT,
    period_of_report    TEXT,
    ticker              TEXT,
    rss_updated         TEXT,

    -- Issuer
    issuer_name         TEXT,
    issuer_cik          TEXT,
    issuer_symbol       TEXT,

    -- Owner (flattened from reporting_owners[])
    owner_name          TEXT,
    is_director         TEXT,
    is_officer          TEXT,
    is_ten_pct_owner    TEXT,
    is_other            TEXT,
    officer_title       TEXT,

    -- Transaction (flattened from transactions[])
    row_type            TEXT,
    security_category   TEXT,
    security_title      TEXT,
    transaction_date    TEXT,
    transaction_code    TEXT,
    amount              REAL,
    acquired_or_disposed TEXT,
    price_per_share     REAL,
    shares_owned_after  REAL,
    ownership_form      TEXT,
    nature_of_ownership TEXT,
    trade_ratio_pct     REAL,
    transaction_value   REAL,
    market_value_after  REAL,

    -- Dedup constraint
    UNIQUE(source_url, owner_name, transaction_date, security_title, amount)
);
```

**`save_to_db(parsed_list, db_path: str)`** — Flattens and inserts:

```
for each filing in parsed_list:
    for each owner in filing["reporting_owners"]:
        for each txn in filing["transactions"]:
            → INSERT OR IGNORE one row
```

- Numeric fields (`amount`, `price_per_share`, `shares_owned_after`, `trade_ratio_pct`, `transaction_value`, `market_value_after`) converted to `float` before insert, defaulting to `None` if empty string.
- `rss_updated` pulled from `filing.get("rss_meta", {}).get("updated", "")`.

---

### RSS Pipeline Integration

#### [MODIFY] form4_parser.py `__main__` block

```python
if __name__ == "__main__":
    import json

    parsed_list = parse_all_from_rss()
    save_to_db(parsed_list, "insider_all.db")
    print(f"\nParsed {len(parsed_list)} filings → insider_all.db")
```

---

### Watchlist Pipeline Integration

#### [MODIFY] sec_form4_watchlist.py `__main__` block

`parse_all_from_watchlist()` returns a `dict[str, list]`, so flatten it before saving:

```python
if __name__ == "__main__":
    from form4_parser import save_to_db

    results = parse_all_from_watchlist()

    # Flatten dict → list for save_to_db
    all_parsed = [filing for filings in results.values() for filing in filings]

    save_to_db(all_parsed, "insider_watchlist.db")

    total = sum(len(v) for v in results.values())
    print(f"\nParsed {total} filings → insider_watchlist.db")
```

## Files Summary

| File | Change | Purpose |
|---|---|---|
| form4_parser.py | Add `init_db()`, `save_to_db()`, update `__main__` | Shared DB layer + RSS pipeline saves to `insider_all.db` |
| sec_form4_watchlist.py | Update `__main__` | Watchlist pipeline saves to `insider_watchlist.db` |
| sec_form4_rss.py | No changes | — |

## Verification Plan

1. Run `python form4_parser.py` → confirm `insider_all.db` is created in `c:\ffin\`
2. Run `python sec_form4_watchlist.py` → confirm `insider_watchlist.db` is created
3. Verify with: `sqlite3 insider_all.db "SELECT COUNT(*) FROM insider_trades;"` → should return > 0
4. Verify dedup: run the same script again → count should stay the same
