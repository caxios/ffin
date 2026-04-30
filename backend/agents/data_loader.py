"""
Pre-fetch data for a single ticker from the existing SQLite stores and
shape it into the inputs each agent needs.

Reads from:
  • backend/db/company_facts.db  → ticker→CIK mapping + XBRL facts
  • backend/db/sec_10kq.db       → 10-K narrative sections + financial notes
  • backend/db/earnings_transcripts.db → most recent earnings call transcript
"""

from __future__ import annotations

import os
import sqlite3
from typing import Any

# ── Paths ─────────────────────────────────────────────────────────────
_HERE = os.path.dirname(os.path.abspath(__file__))
_BACKEND_DIR = os.path.dirname(_HERE)
_DB_DIR = os.path.join(_BACKEND_DIR, "db")

COMPANY_FACTS_DB = os.path.join(_DB_DIR, "company_facts.db")
SEC_10KQ_DB = os.path.join(_DB_DIR, "sec_10kq.db")
EARNINGS_DB = os.path.join(_DB_DIR, "earnings_transcripts.db")


# ── Curated XBRL concepts for assembling the three statements ─────────
INCOME_STATEMENT_CONCEPTS = [
    "Revenues",
    "RevenueFromContractWithCustomerExcludingAssessedTax",
    "SalesRevenueNet",
    "CostOfRevenue",
    "CostOfGoodsAndServicesSold",
    "GrossProfit",
    "ResearchAndDevelopmentExpense",
    "SellingGeneralAndAdministrativeExpense",
    "OperatingExpenses",
    "OperatingIncomeLoss",
    "InterestExpense",
    "IncomeTaxExpenseBenefit",
    "NetIncomeLoss",
    "EarningsPerShareBasic",
    "EarningsPerShareDiluted",
]

BALANCE_SHEET_CONCEPTS = [
    "Assets",
    "AssetsCurrent",
    "CashAndCashEquivalentsAtCarryingValue",
    "ShortTermInvestments",
    "AccountsReceivableNetCurrent",
    "InventoryNet",
    "PropertyPlantAndEquipmentNet",
    "Goodwill",
    "IntangibleAssetsNetExcludingGoodwill",
    "Liabilities",
    "LiabilitiesCurrent",
    "AccountsPayableCurrent",
    "LongTermDebt",
    "LongTermDebtNoncurrent",
    "StockholdersEquity",
]

CASH_FLOW_CONCEPTS = [
    "NetCashProvidedByUsedInOperatingActivities",
    "NetCashProvidedByUsedInInvestingActivities",
    "NetCashProvidedByUsedInFinancingActivities",
    "PaymentsToAcquirePropertyPlantAndEquipment",
    "PaymentsForRepurchaseOfCommonStock",
    "PaymentsOfDividendsCommonStock",
    "DepreciationDepletionAndAmortization",
]


# ── Ticker → CIK lookup ───────────────────────────────────────────────
def _lookup_cik(ticker: str) -> tuple[str | None, str | None]:
    """Return (cik, entity_name) for a ticker, or (None, None) if unknown."""
    if not os.path.exists(COMPANY_FACTS_DB):
        return None, None

    conn = sqlite3.connect(COMPANY_FACTS_DB)
    row = conn.execute(
        "SELECT cik, entity_name FROM companies WHERE UPPER(ticker) = ? LIMIT 1",
        (ticker.upper(),),
    ).fetchone()
    conn.close()
    if row:
        return row[0], row[1]
    return None, None


# ── Financial inputs ──────────────────────────────────────────────────
def _query_facts(
    cik: str,
    concepts: list[str],
    forms: tuple[str, ...] = ("10-K", "10-Q"),
    limit_per_concept: int = 8,
) -> dict[str, list[dict[str, Any]]]:
    """
    For each concept, return its most-recent observations as
    [{period_end, val, unit, fp, fy, form, accn}, ...].
    """
    if not os.path.exists(COMPANY_FACTS_DB):
        return {}

    conn = sqlite3.connect(COMPANY_FACTS_DB)
    conn.row_factory = sqlite3.Row
    out: dict[str, list[dict[str, Any]]] = {}
    placeholders = ",".join("?" * len(forms))

    for concept in concepts:
        rows = conn.execute(
            f"""
            SELECT period_start, period_end, val, unit, fy, fp, form, accn, label
              FROM company_facts
             WHERE cik = ?
               AND concept = ?
               AND form IN ({placeholders})
             ORDER BY period_end DESC
             LIMIT ?
            """,
            (cik, concept, *forms, limit_per_concept),
        ).fetchall()
        if rows:
            out[concept] = [dict(r) for r in rows]

    conn.close()
    return out


def _latest_filing_row(cik: str) -> dict[str, Any] | None:
    """Most recent 10-K row from sec_10kq.db (falls back to most recent 10-Q)."""
    if not os.path.exists(SEC_10KQ_DB):
        return None
    conn = sqlite3.connect(SEC_10KQ_DB)
    conn.row_factory = sqlite3.Row
    cik_padded = cik.lstrip("0")
    # Some pipelines store CIK without leading zeros, others with — try both.
    row = conn.execute(
        """
        SELECT * FROM filing_sections
         WHERE cik IN (?, ?)
         ORDER BY
            CASE form_type WHEN '10-K' THEN 0 ELSE 1 END,
            filing_date DESC
         LIMIT 1
        """,
        (cik, cik_padded),
    ).fetchone()
    conn.close()
    return dict(row) if row else None


def _notes_for_filing(accession_number: str) -> list[dict[str, Any]]:
    if not os.path.exists(SEC_10KQ_DB):
        return []
    conn = sqlite3.connect(SEC_10KQ_DB)
    conn.row_factory = sqlite3.Row
    rows = conn.execute(
        "SELECT note_key, note_text FROM filing_notes WHERE accession_number = ?",
        (accession_number,),
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def _latest_transcript(ticker: str) -> dict[str, Any] | None:
    if not os.path.exists(EARNINGS_DB):
        return None
    conn = sqlite3.connect(EARNINGS_DB)
    conn.row_factory = sqlite3.Row
    row = conn.execute(
        """
        SELECT ticker, fiscal_year, fiscal_quarter, call_date, source_url,
               source_domain, title, transcript_text, fetched_at
          FROM earnings_transcripts
         WHERE UPPER(ticker) = ?
         ORDER BY fiscal_year DESC, fiscal_quarter DESC, fetched_at DESC
         LIMIT 1
        """,
        (ticker.upper(),),
    ).fetchone()
    conn.close()
    return dict(row) if row else None


def _truncate(text: str | None, max_chars: int) -> str:
    if not text:
        return ""
    if len(text) <= max_chars:
        return text
    return text[:max_chars] + f"\n\n[...TRUNCATED — original length {len(text)} chars...]"


# ── Public entry ──────────────────────────────────────────────────────
def load_company_data(ticker: str, max_chars: int = 80_000) -> dict[str, Any]:
    """
    Fetch all inputs needed by the 3 analyst agents for a single ticker.

    Args:
      ticker: Stock symbol (e.g., "AAPL").
      max_chars: Per-section truncation budget for long text.

    Returns:
      A dict with keys: ticker, cik, company_name,
                        financial_inputs, business_inputs, sentiment_inputs.
      Missing data is reported in each block's `_missing` list rather than raising.
    """
    cik, company_name = _lookup_cik(ticker)
    missing_top: list[str] = []
    if cik is None:
        missing_top.append(f"no CIK found for ticker={ticker} in companies table")

    # ── financial_inputs ──
    if cik:
        annual = _query_facts(cik, INCOME_STATEMENT_CONCEPTS + BALANCE_SHEET_CONCEPTS + CASH_FLOW_CONCEPTS, forms=("10-K",), limit_per_concept=5)
        quarterly = _query_facts(cik, INCOME_STATEMENT_CONCEPTS + CASH_FLOW_CONCEPTS, forms=("10-Q",), limit_per_concept=4)
    else:
        annual, quarterly = {}, {}

    filing_row = _latest_filing_row(cik) if cik else None
    notes = _notes_for_filing(filing_row["accession_number"]) if filing_row else []

    financial_inputs: dict[str, Any] = {
        "ticker": ticker,
        "company_name": company_name,
        "annual_facts": annual,
        "quarterly_facts": quarterly,
        "notes_to_financial_statements": [
            {"note_key": n["note_key"], "note_text": _truncate(n["note_text"], max_chars // max(1, len(notes)) if notes else max_chars)}
            for n in notes
        ],
        "_missing": [] if (annual or quarterly) else ["no XBRL facts found for this CIK"],
    }
    if not notes:
        financial_inputs["_missing"].append("no Notes to Financial Statements found for the latest filing")

    # ── business_inputs ──
    if filing_row:
        business_inputs: dict[str, Any] = {
            "ticker": ticker,
            "company_name": filing_row.get("company_name") or company_name,
            "form_type": filing_row.get("form_type"),
            "filing_date": filing_row.get("filing_date"),
            "accession_number": filing_row.get("accession_number"),
            "business": _truncate(filing_row.get("business"), max_chars),
            "risk_factors": _truncate(filing_row.get("risk_factors"), max_chars),
            "mda": _truncate(filing_row.get("mda"), max_chars),
            "_missing": [],
        }
        for k in ("business", "risk_factors", "mda"):
            if not filing_row.get(k):
                business_inputs["_missing"].append(f"no {k} text in latest filing")
    else:
        business_inputs = {
            "ticker": ticker,
            "_missing": ["no 10-K/10-Q filing found in sec_10kq.db for this CIK"],
        }

    # ── sentiment_inputs ──
    transcript = _latest_transcript(ticker)
    if transcript:
        sentiment_inputs: dict[str, Any] = {
            "ticker": ticker,
            "fiscal_year": transcript.get("fiscal_year"),
            "fiscal_quarter": transcript.get("fiscal_quarter"),
            "call_date": transcript.get("call_date"),
            "title": transcript.get("title"),
            "source_url": transcript.get("source_url"),
            "transcript_text": _truncate(transcript.get("transcript_text"), max_chars),
            "_missing": [],
        }
    else:
        sentiment_inputs = {
            "ticker": ticker,
            "_missing": ["no earnings call transcript found in earnings_transcripts.db"],
        }

    return {
        "ticker": ticker,
        "cik": cik,
        "company_name": company_name,
        "financial_inputs": financial_inputs,
        "business_inputs": business_inputs,
        "sentiment_inputs": sentiment_inputs,
        "_missing": missing_top,
    }
