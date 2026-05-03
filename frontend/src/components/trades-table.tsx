"use client";

import useSWR from "swr";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  buildTradesUrl,
  fetcher,
  type Filters,
  type Trade,
  type TradesResponse,
} from "@/lib/api";

const usd = (v: number | null | undefined) =>
  v == null
    ? "—"
    : v.toLocaleString("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

const usdCompact = (v: number | null | undefined) =>
  v == null
    ? "—"
    : v.toLocaleString("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    });

const num = (v: number | null | undefined) =>
  v == null ? "—" : Math.round(v).toLocaleString("en-US");

const pct = (v: number | null | undefined) =>
  v == null ? "—" : `${v.toFixed(1)}%`;

type Props = {
  filters: Filters;
  onPage: (offset: number) => void;
};

const HEAD_CLASS =
  "sticky top-0 z-10 bg-card/90 backdrop-blur-sm px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground border-b border-glass-border whitespace-nowrap";

const CELL_CLASS =
  "px-3 py-2 whitespace-nowrap border-b border-glass-border/50";

const toFilingIndexUrl = (sourceUrl: string | null): string | null =>
  sourceUrl && sourceUrl.endsWith(".txt")
    ? `${sourceUrl.slice(0, -".txt".length)}-index.htm`
    : sourceUrl;

export function TradesTable({ filters, onPage }: Props) {
  const { data, isLoading, error } = useSWR<TradesResponse>(
    buildTradesUrl(filters),
    fetcher,
    { keepPreviousData: true },
  );

  const rows: Trade[] = data?.trades ?? [];
  const total = data?.total ?? 0;
  const end = Math.min(filters.offset + filters.limit, total);

  return (
    <div className="rounded-lg border border-glass-border bg-glass backdrop-blur-sm">
      <div className="flex items-center justify-between border-b border-glass-border px-4 py-2 text-sm text-muted-foreground">
        <span className="font-mono text-xs">
          {isLoading
            ? "Loading…"
            : error
              ? "Failed to load"
              : `${filters.offset + (total ? 1 : 0)}–${end} of ${total.toLocaleString("en-US")}`}
        </span>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={filters.offset === 0}
            onClick={() => onPage(Math.max(0, filters.offset - filters.limit))}
          >
            Prev
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={end >= total}
            onClick={() => onPage(filters.offset + filters.limit)}
          >
            Next
          </Button>
        </div>
      </div>

      <div className="relative max-h-[70vh] overflow-auto">
        <table className="w-full caption-bottom text-sm">
          <thead>
            <tr>
              <th className={HEAD_CLASS}>Date</th>
              <th className={HEAD_CLASS}>Ticker</th>
              <th className={HEAD_CLASS}>Owner</th>
              <th className={HEAD_CLASS}>Officer Title</th>
              <th className={HEAD_CLASS}>Security</th>
              <th className={HEAD_CLASS}>Code</th>
              <th className={`${HEAD_CLASS} text-right`}>Amount</th>
              <th className={HEAD_CLASS}>Dir</th>
              <th className={`${HEAD_CLASS} text-right`}>Price</th>
              <th className={`${HEAD_CLASS} text-right`}>Transaction Val</th>
              <th className={`${HEAD_CLASS} text-right`}>Shares After</th>
              <th className={`${HEAD_CLASS} text-right`}>Ratio</th>
              <th className={`${HEAD_CLASS} text-right`}>Market Val After</th>
              <th className={`${HEAD_CLASS} text-right`}>Market Cap</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((t) => {
              const isBuy = t.acquired_or_disposed === "A";
              const filingUrl = toFilingIndexUrl(t.source_url);
              return (
                <tr
                  key={`${t.id}-${t.ticker}`}
                  onClick={
                    filingUrl
                      ? () => window.open(filingUrl, "_blank", "noopener,noreferrer")
                      : undefined
                  }
                  className={`transition-colors hover:bg-foreground/5 ${filingUrl ? "cursor-pointer" : ""
                    }`}
                >
                  <td className={`${CELL_CLASS} font-mono text-xs`}>
                    {t.transaction_date ?? "—"}
                  </td>
                  <td className={`${CELL_CLASS} font-mono font-semibold`}>
                    {t.ticker}
                  </td>
                  <td className={`${CELL_CLASS} max-w-[14rem] truncate`} title={t.owner_name}>
                    {t.owner_name}
                  </td>
                  <td
                    className={`${CELL_CLASS} max-w-[12rem] truncate text-muted-foreground`}
                    title={t.officer_title ?? ""}
                  >
                    {t.officer_title ?? "—"}
                  </td>
                  <td
                    className={`${CELL_CLASS} max-w-[14rem] truncate text-muted-foreground`}
                    title={t.security_title ?? ""}
                  >
                    {t.security_title ?? "—"}
                  </td>
                  <td className={`${CELL_CLASS} font-mono`}>
                    {t.transaction_code}
                  </td>
                  <td className={`${CELL_CLASS} text-right font-mono`}>
                    {num(t.amount)}
                  </td>
                  <td className={CELL_CLASS}>
                    <Badge
                      variant="outline"
                      className={
                        isBuy
                          ? "border-accent-green/40 bg-accent-green/10 text-accent-green"
                          : "border-accent-red/40 bg-accent-red/10 text-accent-red"
                      }
                    >
                      {isBuy ? "A · Buy" : "D · Sell"}
                    </Badge>
                  </td>
                  <td className={`${CELL_CLASS} text-right font-mono`}>
                    {usd(t.price_per_share)}
                  </td>
                  <td className={`${CELL_CLASS} text-right font-mono`}>
                    {usd(t.transaction_value)}
                  </td>
                  <td className={`${CELL_CLASS} text-right font-mono`}>
                    {num(t.shares_owned_after)}
                  </td>
                  <td className={`${CELL_CLASS} text-right font-mono`}>
                    {pct(t.trade_ratio_pct)}
                  </td>
                  <td
                    className={`${CELL_CLASS} text-right font-mono ${isBuy ? "text-accent-green" : "text-accent-red"
                      }`}
                  >
                    {usdCompact(t.market_value_after)}
                  </td>
                  <td className={`${CELL_CLASS} text-right font-mono text-muted-foreground`}>
                    {usdCompact(t.market_cap)}
                  </td>
                </tr>
              );
            })}
            {!isLoading && rows.length === 0 && (
              <tr>
                <td
                  colSpan={13}
                  className="py-12 text-center text-muted-foreground"
                >
                  No trades match these filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
