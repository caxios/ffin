export const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8000";

export class FetchError extends Error {
  status: number;
  detail?: string;
  constructor(status: number, message: string, detail?: string) {
    super(message);
    this.status = status;
    this.detail = detail;
  }
}

export const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) {
    let detail: string | undefined;
    try {
      const body = await res.json();
      detail = typeof body?.detail === "string" ? body.detail : undefined;
    } catch {
      /* non-JSON body */
    }
    throw new FetchError(res.status, `${res.status} ${res.statusText}`, detail);
  }
  return res.json();
};

export type Trade = {
  id: number;
  ticker: string;
  issuer_name: string | null;
  owner_name: string;
  officer_title: string | null;
  security_title: string | null;
  transaction_date: string;
  transaction_code: string;
  amount: number | null;
  acquired_or_disposed: "A" | "D" | string;
  price_per_share: number | null;
  shares_owned_after: number | null;
  trade_ratio_pct: number | null;
  transaction_value: number | null;
  market_value_after: number | null;
  market_cap: number | null;
  source_url: string | null;
};

export type TradesResponse = {
  total: number;
  limit: number;
  offset: number;
  trades: Trade[];
};

export type SummaryRow = {
  ticker: string;
  total_trades: number;
  total_buys: number;
  total_sells: number;
  total_buy_value: number;
  total_sell_value: number;
  latest_trade_date: string | null;
  unique_insiders: number;
};

export type Filters = {
  source: "watchlist" | "all";
  ticker?: string;
  owner?: string;
  code?: string;
  acquired_or_disposed?: "A" | "D" | "";
  date_from?: string;
  date_to?: string;
  min_value?: string;
  limit: number;
  offset: number;
};

export type ChatRequest = { user_message: string; session_id?: string };
export type ChatResponse = { session_id: string; reply?: string; response?: string };

export const sendChat = async (
  body: ChatRequest,
  signal?: AbortSignal,
): Promise<ChatResponse> => {
  const res = await fetch(`${API_BASE}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => res.statusText);
    throw new Error(`Chat request failed: ${res.status} ${detail}`);
  }
  return res.json();
};

export type CompanyDataFiling = {
  accession_number: string;
  form_type: string;
  filing_date: string;
  company_name: string | null;
  index_url: string | null;
  document_url: string | null;
  has_business: boolean;
  has_risk_factors: boolean;
  has_mda: boolean;
};

export type CompanyDataTrade = {
  owner_name: string;
  officer_title: string | null;
  is_director: string | null;
  is_officer: string | null;
  is_ten_pct_owner: string | null;
  transaction_date: string;
  transaction_code: string;
  security_title: string | null;
  security_category: string | null;
  amount: number | null;
  acquired_or_disposed: "A" | "D" | string;
  price_per_share: number | null;
  shares_owned_after: number | null;
  trade_ratio_pct: number | null;
  transaction_value: number | null;
  market_value_after: number | null;
  source_url: string | null;
};

export type CompanyDataResponse = {
  ticker: string;
  cik: string;
  company_name: string | null;
  cache_status: "hit" | "partial" | "miss";
  filings_10kq: CompanyDataFiling[];
  form4_trades: CompanyDataTrade[];
  fetched_at: string;
};

export const buildTradesUrl = (f: Filters) => {
  const qs = new URLSearchParams();
  qs.set("source", f.source);
  qs.set("limit", String(f.limit));
  qs.set("offset", String(f.offset));
  if (f.ticker) qs.set("ticker", f.ticker);
  if (f.owner) qs.set("owner", f.owner);
  if (f.code) qs.set("code", f.code);
  if (f.acquired_or_disposed) qs.set("acquired_or_disposed", f.acquired_or_disposed);
  if (f.date_from) qs.set("date_from", f.date_from);
  if (f.date_to) qs.set("date_to", f.date_to);
  if (f.min_value) qs.set("min_value", f.min_value);
  return `${API_BASE}/api/trades?${qs.toString()}`;
};
