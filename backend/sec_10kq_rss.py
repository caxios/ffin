"""
sec_10kq_rss.py
───────────────
Stage 1 of the 10-K / 10-Q pipeline.

Fetch the SEC RSS (Atom) feed for a given CIK and extract filing metadata,
then resolve each filing's primary HTML document URL from the index page.
"""

import re
import time
import requests
from bs4 import BeautifulSoup
from const import HEADERS

# SEC rate-limit safe delay (max 10 req/s)
REQUEST_DELAY = 0.15


# ============================================================
# RSS Feed Parsing
# ============================================================

def fetch_filing_list(cik: str, form_types: str = "10-K,10-Q", count: int = 10) -> list[dict]:
    """
    Fetch the SEC Atom RSS feed for a single company and return
    a list of filing metadata dicts.

    Args:
        cik:        Zero-padded CIK string (e.g. "0000789019").
        form_types: Comma-separated form types for the RSS filter.
        count:      Maximum number of entries to request from the feed.

    Returns:
        List of dicts with keys:
            cik, form_type, filing_date, title, index_url, accession_number
    """
    url = (
        f"https://data.sec.gov/rss?cik={cik}"
        f"&type={form_types}"
        f"&count={count}"
    )

    try:
        resp = requests.get(url, headers=HEADERS, timeout=30)
        resp.raise_for_status()
    except requests.RequestException as e:
        print(f"  [WARN] RSS fetch failed for CIK {cik}: {e}")
        return []
    time.sleep(REQUEST_DELAY)

    soup = BeautifulSoup(resp.content, "xml")
    entries = soup.find_all("entry")

    filings = []
    for entry in entries:
        # --- Form type from <category term="10-K" /> ---
        category = entry.find("category")
        form_type = category.get("term", "") if category else ""

        # Only keep actual 10-K and 10-Q (ignore amendments, NTs, etc. for now)
        if form_type not in ("10-K", "10-Q"):
            continue

        # --- Filing date ---
        updated = entry.find("updated")
        filing_date = updated.text[:10] if updated and updated.text else ""

        # --- Title ---
        title = entry.title.text.strip() if entry.title and entry.title.text else ""

        # --- Index URL from <link href="..." /> ---
        link_tag = entry.find("link")
        index_url = link_tag.get("href", "") if link_tag else ""

        # --- Extract accession number from the URL path ---
        acc_match = re.search(r"(\d{10}-\d{2}-\d{6})", index_url)
        accession_number = acc_match.group(1) if acc_match else ""

        filings.append({
            "cik": cik,
            "form_type": form_type,
            "filing_date": filing_date,
            "title": title,
            "index_url": index_url,
            "accession_number": accession_number,
        })

    return filings


# ============================================================
# Index Page → Primary Document URL Resolver
# ============================================================

def _resolve_href(href: str) -> str | None:
    """
    Resolve a document href from the SEC index page to an absolute URL.
    
    SEC wraps iXBRL documents with /ix?doc=/Archives/...  which returns
    only the viewer shell, not the actual filing HTML.  Strip that prefix
    to get the raw document.
    """
    if not href:
        return None

    # Strip iXBRL viewer wrapper: /ix?doc=/Archives/... → /Archives/...
    if "/ix?doc=" in href:
        href = href.split("/ix?doc=", 1)[1]

    # Only accept .htm/.html documents
    if not href.endswith((".htm", ".html")):
        return None

    if href.startswith("/"):
        return f"https://www.sec.gov{href}"
    elif href.startswith("http"):
        return href

    return None


def resolve_primary_document_url(index_url: str) -> str | None:
    """
    Given a filing index page URL (e.g. .../<acc>-index.htm),
    scrape the index page and return the URL of the primary
    HTML document (the actual 10-K / 10-Q filing).

    Strategy:
        1. Fetch the index page HTML.
        2. Look for the filing-documents table.
        3. Find the first row whose Type is "10-K" or "10-Q"
           and whose document ends with .htm/.html.

    Returns:
        Absolute URL to the primary document, or None if not found.
    """
    try:
        resp = requests.get(index_url, headers=HEADERS, timeout=30)
        resp.raise_for_status()
        time.sleep(REQUEST_DELAY)
    except Exception as e:
        print(f"  [WARN] Failed to fetch index page {index_url}: {e}")
        return None

    soup = BeautifulSoup(resp.text, "html.parser")

    # The filing documents table has class "tableFile" on the SEC index pages
    table = soup.find("table", class_="tableFile")
    if not table:
        # Fallback: try any table with "Document" header
        tables = soup.find_all("table")
        for t in tables:
            header = t.find("th")
            if header and "document" in header.text.lower():
                table = t
                break

    if not table:
        print(f"  [WARN] No document table found on {index_url}")
        return None

    rows = table.find_all("tr")[1:]  # skip header row
    for row in rows:
        cells = row.find_all("td")
        if len(cells) < 4:
            continue

        doc_type = cells[3].text.strip() if len(cells) > 3 else ""
        doc_link = cells[2].find("a") if len(cells) > 2 else None

        # The primary document type matches 10-K or 10-Q
        if doc_type.upper() in ("10-K", "10-Q") and doc_link:
            href = doc_link.get("href", "")
            resolved = _resolve_href(href)
            if resolved:
                return resolved

    # Fallback: find first .htm link whose description mentions the filing
    for row in rows:
        cells = row.find_all("td")
        if len(cells) < 3:
            continue
        link = cells[2].find("a") if len(cells) > 2 else None
        if link:
            href = link.get("href", "")
            if not href.endswith("-index.htm"):
                resolved = _resolve_href(href)
                if resolved:
                    return resolved

    print(f"  [WARN] No primary document found on {index_url}")
    return None


# ============================================================
# Convenience: Fetch + Resolve in one call
# ============================================================

def fetch_and_resolve(cik: str, count: int = 10) -> list[dict]:
    """
    Fetch the RSS feed and resolve primary document URLs for each filing.

    Returns the same list as fetch_filing_list(), but with an added
    'document_url' key on each dict.
    """
    filings = fetch_filing_list(cik, count=count)
    print(f"  RSS: found {len(filings)} filing(s) for CIK {cik}")

    for filing in filings:
        idx_url = filing.get("index_url", "")
        if idx_url:
            filing["document_url"] = resolve_primary_document_url(idx_url)
        else:
            filing["document_url"] = None

    resolved = [f for f in filings if f.get("document_url")]
    print(f"  Resolved {len(resolved)} primary document URL(s)")
    return filings


# ============================================================
# Quick test
# ============================================================

if __name__ == "__main__":
    # Microsoft CIK
    results = fetch_and_resolve("0000789019", count=5)
    for r in results:
        print(f"  {r['form_type']} | {r['filing_date']} | {r.get('document_url', 'N/A')}")
