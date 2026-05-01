"use client";

import { useState } from "react";
import useSWR from "swr";
import Link from "next/link";
import {
  AlertCircle,
  ArrowLeft,
  Download,
  FileText,
  Loader2,
} from "lucide-react";
import {
  API_BASE,
  fetcher,
  FetchError,
  type CompanyDataFiling,
  type CompanyDataResponse,
  type CompanyDataTrade,
} from "@/lib/api";
import { downloadCsv, downloadText } from "@/lib/export";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { CioChat } from "@/components/cio-chat";
import { FinancialData } from "@/components/financial-data";
import { EarningsTranscript } from "@/components/earnings-transcript";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
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

const LIMIT_OPTIONS = [
  { value: "4", label: "Last 4" },
  { value: "8", label: "Last 8" },
  { value: "12", label: "Last 12" },
  { value: "1000", label: "All available" },
] as const;

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

function FilingsCard({
  ticker,
  filings,
  limit,
  onLimitChange,
  isFetching,
}: {
  ticker: string;
  filings: CompanyDataFiling[];
  limit: string;
  onLimitChange: (v: string) => void;
  isFetching: boolean;
}) {
  const exportCsv = () => {
    downloadCsv(
      filings.map((f) => ({
        accession_number: f.accession_number,
        form_type: f.form_type,
        filing_date: f.filing_date,
        company_name: f.company_name ?? "",
        document_url: f.document_url ?? "",
        has_business: f.has_business,
        has_risk_factors: f.has_risk_factors,
        has_mda: f.has_mda,
      })),
      `${ticker}_filings_10kq.csv`,
    );
  };

  return (
    <Card className="border-glass-border bg-glass backdrop-blur-sm">
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <CardTitle className="text-base">10-K / 10-Q Filings</CardTitle>
          <CardDescription>
            {filings.length === 0
              ? "No annual or quarterly filings on record."
              : `${filings.length} most-recent filing${filings.length === 1 ? "" : "s"}.`}
          </CardDescription>
        </div>
        <div className="flex items-center gap-2">
          <Select value={limit} onValueChange={onLimitChange} disabled={isFetching}>
            <SelectTrigger className="h-8 w-[140px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LIMIT_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="sm"
            onClick={exportCsv}
            disabled={filings.length === 0}
            className="h-8 text-xs"
          >
            <Download className="h-3 w-3" />
            CSV
          </Button>
        </div>
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

function TradesCard({
  ticker,
  trades,
}: {
  ticker: string;
  trades: CompanyDataTrade[];
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

interface FilingDetail {
  company_name?: string;
  form_type?: string;
  filing_date?: string;
  business?: string | null;
  risk_factors?: string | null;
  mda?: string | null;
}

function FilingTextPanel({
  ticker,
  filings,
}: {
  ticker: string;
  filings: CompanyDataFiling[];
}) {
  const [selectedAccn, setSelectedAccn] = useState<string | null>(
    filings[0]?.accession_number ?? null,
  );

  const {
    data: detail,
    error,
    isLoading,
  } = useSWR<FilingDetail>(
    ticker && selectedAccn
      ? `${API_BASE}/api/documents/${ticker}/${selectedAccn}`
      : null,
    fetcher,
    { revalidateOnFocus: false, shouldRetryOnError: false },
  );

  const current = filings.find((f) => f.accession_number === selectedAccn);

  if (filings.length === 0) {
    return (
      <Card>
        <CardContent className="flex h-48 items-center justify-center text-sm text-muted-foreground">
          No 10-K / 10-Q filings to display text for.
        </CardContent>
      </Card>
    );
  }

  const exportTxt = (label: string, content: string | null | undefined) => {
    if (!content || !current) return;
    downloadText(
      content,
      `${ticker}_${current.form_type}_${current.filing_date}_${label}.txt`,
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-lg font-semibold">Filing Text Sections</h3>
          <p className="text-sm text-muted-foreground">
            Pick a filing to read MD&amp;A, Risk Factors, and Business overview.
          </p>
        </div>
        <Select value={selectedAccn ?? ""} onValueChange={setSelectedAccn}>
          <SelectTrigger className="h-8 w-[280px] text-xs">
            <SelectValue placeholder="Select filing period" />
          </SelectTrigger>
          <SelectContent>
            {filings.map((f) => (
              <SelectItem key={f.accession_number} value={f.accession_number}>
                {f.filing_date} — {f.form_type}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <Card>
          <CardContent className="flex h-48 items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </CardContent>
        </Card>
      ) : error ? (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Could not load filing text</AlertTitle>
          <AlertDescription>
            {(error as FetchError)?.detail ??
              "Failed to load text sections for the selected filing."}
          </AlertDescription>
        </Alert>
      ) : !detail ? null : (
        <Card className="border-glass-border bg-glass backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="text-base">
              {detail.form_type} — {detail.filing_date}
            </CardTitle>
            <CardDescription>
              {detail.company_name ?? ticker} · Accession {selectedAccn}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Accordion type="single" collapsible className="w-full">
              <SectionItem
                value="mda"
                label="Management's Discussion and Analysis (MD&A)"
                content={detail.mda}
                onExport={() => exportTxt("mda", detail.mda)}
              />
              <SectionItem
                value="risk"
                label="Risk Factors"
                content={detail.risk_factors}
                onExport={() => exportTxt("risk_factors", detail.risk_factors)}
              />
              <SectionItem
                value="business"
                label="Business Overview"
                content={detail.business}
                onExport={() => exportTxt("business", detail.business)}
              />
            </Accordion>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function SectionItem({
  value,
  label,
  content,
  onExport,
}: {
  value: string;
  label: string;
  content: string | null | undefined;
  onExport: () => void;
}) {
  const has = !!(content && content.trim().length > 0);
  return (
    <AccordionItem value={value}>
      <AccordionTrigger className="text-sm font-semibold">{label}</AccordionTrigger>
      <AccordionContent>
        <div className="space-y-2">
          <div className="flex justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={onExport}
              disabled={!has}
              className="h-7 text-xs"
            >
              <Download className="h-3 w-3" />
              TXT
            </Button>
          </div>
          <div className="max-h-[480px] overflow-y-auto rounded-md bg-muted/40 p-4">
            {has ? (
              <div className="prose prose-sm dark:prose-invert max-w-none">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{content!}</ReactMarkdown>
              </div>
            ) : (
              <p className="text-sm italic text-muted-foreground">
                No {label} extracted for this filing.
              </p>
            )}
          </div>
        </div>
      </AccordionContent>
    </AccordionItem>
  );
}

export function CompanyDashboard({ ticker }: { ticker: string }) {
  const [limit, setLimit] = useState<string>("4");

  const { data, error, isLoading, isValidating } = useSWR<CompanyDataResponse>(
    `${API_BASE}/api/company-data/${encodeURIComponent(ticker)}?limit=${limit}`,
    fetcher,
    { revalidateOnFocus: false, shouldRetryOnError: false, keepPreviousData: true },
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

      {isLoading && !data && <LoadingSkeleton ticker={ticker} />}
      {error && !data && <ErrorState ticker={ticker} error={error} />}
      {data && !error && (
        <Tabs defaultValue="overview" className="w-full">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="filing-text">Filing Text</TabsTrigger>
            <TabsTrigger value="financials">Financial Data</TabsTrigger>
            <TabsTrigger value="earnings">Earnings Call</TabsTrigger>
            <TabsTrigger value="chat">CIO Chat</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-6">
            <div className="grid gap-6 lg:grid-cols-2">
              <FilingsCard
                ticker={ticker}
                filings={data.filings_10kq}
                limit={limit}
                onLimitChange={setLimit}
                isFetching={isValidating}
              />
              <TradesCard ticker={ticker} trades={data.form4_trades} />
            </div>
          </TabsContent>

          <TabsContent value="filing-text" className="mt-6">
            <FilingTextPanel ticker={ticker} filings={data.filings_10kq} />
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
