"use client";

import useSWR from "swr";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { API_BASE, fetcher, type SummaryRow } from "@/lib/api";

const fmtUsd = (v: number) =>
  v >= 1_000_000
    ? `$${(v / 1_000_000).toFixed(1)}M`
    : v >= 1_000
      ? `$${(v / 1_000).toFixed(1)}K`
      : `$${v.toFixed(0)}`;

export function SummaryCards({ source }: { source: "watchlist" | "all" }) {
  const { data, isLoading } = useSWR<{ summary: SummaryRow[] }>(
    `${API_BASE}/api/summary?source=${source}`,
    fetcher,
  );

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="h-32 animate-pulse bg-glass border-glass-border" />
        ))}
      </div>
    );
  }

  const rows = data?.summary ?? [];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {rows.map((r) => (
        <Card
          key={r.ticker}
          className="bg-glass border-glass-border backdrop-blur-sm transition hover:-translate-y-0.5 hover:border-foreground/20"
        >
          <CardHeader className="pb-2">
            <CardTitle className="flex items-baseline justify-between text-base">
              <span className="font-mono tracking-wider">{r.ticker}</span>
              <span className="text-xs text-muted-foreground font-normal">
                {r.total_trades} trades
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Buys</span>
              <span className="font-mono text-accent-green">
                {r.total_buys} · {fmtUsd(r.total_buy_value ?? 0)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Sells</span>
              <span className="font-mono text-accent-red">
                {r.total_sells} · {fmtUsd(r.total_sell_value ?? 0)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Insiders</span>
              <span className="font-mono">{r.unique_insiders}</span>
            </div>
            {r.latest_trade_date && (
              <div className="flex justify-between text-xs text-muted-foreground pt-1">
                <span>Latest</span>
                <span className="font-mono">{r.latest_trade_date}</span>
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
