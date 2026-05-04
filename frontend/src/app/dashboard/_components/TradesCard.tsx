import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { type CompanyDataTrade } from "@/lib/api";
import { downloadCsv } from "@/lib/export";
import { Download } from "lucide-react";

const fmtUsd = (v: number | null | undefined) =>
  v == null
    ? "—"
    : v.toLocaleString("en-US", {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 0,
      });

const fmtNum = (v: number | null | undefined) =>
  v == null ? "—" : Math.round(v).toLocaleString("en-US");

const fmtPrice = (v: number | null | undefined) =>
  v == null
    ? "—"
    : v.toLocaleString("en-US", {
        style: "currency",
        currency: "USD",
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });

export function TradesCard({
    ticker,
    trades,
    limit,
    onLimitChange,
    isFetching,
}: {
    ticker: string;
    trades: CompanyDataTrade[];
    limit: string;
    onLimitChange: (v: string) => void;
    isFetching: boolean;
}) {
    const exportCsv = () => {
        downloadCsv(
            trades.map((t) => ({
                transaction_date: t.transaction_date,
                owner_name: t.owner_name,
                officer_title: t.officer_title ?? "",
                is_director: t.is_director ?? "",
                is_officer: t.is_officer ?? "",
                is_ten_pct_owner: t.is_ten_pct_owner ?? "",
                transaction_code: t.transaction_code,
                acquired_or_disposed: t.acquired_or_disposed,
                security_title: t.security_title ?? "",
                amount: t.amount ?? "",
                price_per_share: t.price_per_share ?? "",
                transaction_value: t.transaction_value ?? "",
                shares_owned_after: t.shares_owned_after ?? "",
                ratio: t.trade_ratio_pct ?? "",
                market_value_after: t.market_value_after ?? "",
                // market_cap: t.market_cap ?? "",
                source_url: t.source_url ?? "",
            })),
            `${ticker}_form4_trades.csv`,
        );
    };

    return (
        <Card className="border-glass-border bg-glass backdrop-blur-sm">
            <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                    <CardTitle className="text-base">Recent Insider Trades</CardTitle>
                    <CardDescription>
                        {trades.length === 0
                            ? "No Form 4 transactions on record."
                            : `${trades.length} most-recent transaction${trades.length === 1 ? "" : "s"}.`}
                    </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                    <Input
                        type="number"
                        min={1}
                        value={limit}
                        onChange={(e) => onLimitChange(e.target.value)}
                        disabled={isFetching}
                        className="h-8 w-[100px] text-xs"
                        placeholder="Count"
                    />
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={exportCsv}
                        disabled={trades.length === 0}
                        className="h-8 text-xs"
                    >
                        <Download className="h-3 w-3" />
                        CSV
                    </Button>
                </div>
            </CardHeader>
            <CardContent>
                {trades.length === 0 ? null : (
                    <div className="overflow-x-auto rounded-md border border-glass-border/50">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Date</TableHead>
                                    <TableHead>Owner</TableHead>
                                    <TableHead>Code</TableHead>
                                    <TableHead className="text-right">Amount</TableHead>
                                    <TableHead className="text-right">Price</TableHead>
                                    <TableHead className="text-right">Transaction Val</TableHead>
                                    <TableHead className="text-right">Market Val After</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {trades.map((t, i) => {
                                    const isBuy = t.acquired_or_disposed === "A";
                                    return (
                                        <TableRow key={`${t.source_url}-${t.owner_name}-${t.transaction_date}-${i}`}>
                                            <TableCell className="font-mono text-xs">
                                                {t.transaction_date || "—"}
                                            </TableCell>
                                            <TableCell className="max-w-[14rem] truncate text-sm" title={t.owner_name}>
                                                {t.owner_name}
                                                {t.officer_title && (
                                                    <div className="text-[11px] text-muted-foreground">
                                                        {t.officer_title}
                                                    </div>
                                                )}
                                            </TableCell>
                                            <TableCell>
                                                <Badge
                                                    variant="outline"
                                                    className={
                                                        isBuy
                                                            ? "border-accent-green/40 bg-accent-green/10 text-accent-green"
                                                            : "border-accent-red/40 bg-accent-red/10 text-accent-red"
                                                    }
                                                >
                                                    {t.transaction_code} · {isBuy ? "A" : "D"}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-right font-mono text-xs">
                                                {fmtNum(t.amount)}
                                            </TableCell>
                                            <TableCell className="text-right font-mono text-xs">
                                                {fmtPrice(t.price_per_share)}
                                            </TableCell>
                                            <TableCell
                                                className={`text-right font-mono text-xs ${isBuy ? "text-accent-green" : "text-accent-red"
                                                    }`}
                                            >
                                                {fmtUsd(t.transaction_value)}
                                            </TableCell>
                                            <TableCell className="text-right font-mono text-xs">
                                                {fmtPrice(t.market_value_after)}
                                            </TableCell>

                                        </TableRow>
                                    );
                                })}
                            </TableBody>
                        </Table>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}