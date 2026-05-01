"use client";

import useSWR from "swr";
import Link from "next/link";
import { AlertCircle, ArrowLeft, FileText, Loader2 } from "lucide-react";
import {
  API_BASE,
  fetcher,
  FetchError,
  type CompanyDataFiling,
  type CompanyDataResponse,
  type CompanyDataTrade,
} from "@/lib/api";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CioChat } from "@/components/cio-chat";
import { FinancialData } from "@/components/financial-data";
import { EarningsTranscript } from "@/components/earnings-transcript";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

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

function CacheBadge({ status }: { status: CompanyDataResponse["cache_status"] }) {
  const map = {
    hit: { label: "cached", cls: "border-accent-green/40 bg-accent-green/10 text-accent-green" },
    partial: { label: "partial · re-fetched", cls: "border-amber-500/40 bg-amber-500/10 text-amber-300" },
    miss: { label: "fresh from SEC", cls: "border-amber-500/40 bg-amber-500/10 text-amber-300" },
  };
  const { label, cls } = map[status];
  return (
    <Badge variant="outline" className={`font-mono text-[10px] uppercase ${cls}`}>
      {label}
    </Badge>
  );
}

function LoadingSkeleton({ ticker }: { ticker: string }) {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        <span className="text-sm text-muted-foreground">
          Loading {ticker} — checking cache, may need to scrape SEC EDGAR…
        </span>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="h-48 animate-pulse border-glass-border bg-glass" />
        <Card className="h-48 animate-pulse border-glass-border bg-glass" />
      </div>
      <Card className="h-72 animate-pulse border-glass-border bg-glass" />
    </div>
  );
}

function ErrorState({ ticker, error }: { ticker: string; error: unknown }) {
  let title = "Something went wrong";
  let body: React.ReactNode = "Please try again in a moment.";

  if (error instanceof FetchError) {
    if (error.status === 404) {
      title = "Ticker not found";
      body = (
        <>
          We couldn&apos;t find SEC filings for{" "}
          <span className="font-mono font-semibold">{ticker}</span>. Double-check
          the symbol and try again.
        </>
      );
    } else if (error.status === 503) {
      title = "SEC rate limit";
      body =
        "SEC is rate-limiting requests right now. Wait about a minute and try again.";
    } else if (error.status === 502) {
      title = "Upstream error";
      body =
        error.detail ??
        "We hit an error while fetching this ticker from SEC. Try again later.";
    }
  }

  return (
    <Alert variant="destructive">
      <AlertCircle className="h-4 w-4" />
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription>{body}</AlertDescription>
    </Alert>
  );
}

function FilingsCard({ filings }: { filings: CompanyDataFiling[] }) {
  return (
    <Card className="border-glass-border bg-glass backdrop-blur-sm">
      <CardHeader>
        <CardTitle className="text-base">10-K / 10-Q Filings</CardTitle>
        <CardDescription>
          {filings.length === 0
            ? "No annual or quarterly filings on record."
            : `${filings.length} most-recent filing${filings.length === 1 ? "" : "s"}.`}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {filings.length === 0 ? null : (
          <div className="overflow-x-auto rounded-md border border-glass-border/50">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-24">Form</TableHead>
                  <TableHead>Filed</TableHead>
                  <TableHead>Sections</TableHead>
                  <TableHead className="text-right">Source</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filings.map((f) => (
                  <TableRow key={f.accession_number}>
                    <TableCell className="font-mono text-xs">
                      <Badge variant="outline">{f.form_type}</Badge>
                    </TableCell>
                    <TableCell className="font-mono text-xs">{f.filing_date}</TableCell>
                    <TableCell className="space-x-1 text-xs text-muted-foreground">
                      {f.has_business && <Badge variant="secondary">Business</Badge>}
                      {f.has_risk_factors && <Badge variant="secondary">Risk</Badge>}
                      {f.has_mda && <Badge variant="secondary">MD&amp;A</Badge>}
                      {!f.has_business && !f.has_risk_factors && !f.has_mda && "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      {f.document_url ? (
                        <a
                          href={f.document_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-accent-green hover:underline"
                        >
                          <FileText className="h-3 w-3" /> SEC
                        </a>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function TradesCard({ trades }: { trades: CompanyDataTrade[] }) {
  return (
    <Card className="border-glass-border bg-glass backdrop-blur-sm">
      <CardHeader>
        <CardTitle className="text-base">Recent Insider Trades</CardTitle>
        <CardDescription>
          {trades.length === 0
            ? "No Form 4 transactions on record."
            : `${trades.length} most-recent transaction${trades.length === 1 ? "" : "s"}.`}
        </CardDescription>
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
                  <TableHead className="text-right">Value</TableHead>
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
                        className={`text-right font-mono text-xs ${
                          isBuy ? "text-accent-green" : "text-accent-red"
                        }`}
                      >
                        {fmtUsd(t.transaction_value)}
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

export function CompanyDashboard({ ticker }: { ticker: string }) {
  const { data, error, isLoading } = useSWR<CompanyDataResponse>(
    `${API_BASE}/api/company-data/${encodeURIComponent(ticker)}`,
    fetcher,
    { revalidateOnFocus: false, shouldRetryOnError: false },
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Button asChild variant="ghost" size="sm" className="gap-1 text-muted-foreground">
          <Link href="/">
            <ArrowLeft className="h-3 w-3" /> Back to watchlist
          </Link>
        </Button>
        {data && <CacheBadge status={data.cache_status} />}
      </div>

      <div>
        <h1 className="font-mono text-3xl font-bold tracking-wider">{ticker}</h1>
        {data?.company_name && (
          <p className="text-muted-foreground">
            {data.company_name} <span className="font-mono text-xs">· CIK {data.cik}</span>
          </p>
        )}
      </div>

      {isLoading && <LoadingSkeleton ticker={ticker} />}
      {error && !isLoading && <ErrorState ticker={ticker} error={error} />}
      {data && !error && (
        <Tabs defaultValue="overview" className="w-full">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="financials">Financial Data</TabsTrigger>
            <TabsTrigger value="earnings">Earnings Call</TabsTrigger>
            <TabsTrigger value="chat">CIO Chat</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-6">
            <div className="grid gap-6 lg:grid-cols-2">
              <FilingsCard filings={data.filings_10kq} />
              <TradesCard trades={data.form4_trades} />
            </div>
          </TabsContent>

          <TabsContent value="financials" className="mt-6">
            <FinancialData ticker={ticker} />
          </TabsContent>

          <TabsContent value="earnings" className="mt-6">
            <EarningsTranscript ticker={ticker} />
          </TabsContent>

          <TabsContent value="chat" className="mt-6">
            <CioChat ticker={ticker} />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
