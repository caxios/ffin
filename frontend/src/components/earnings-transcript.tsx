"use client";

import { useEffect, useMemo, useState } from "react";
import useSWR from "swr";
import { fetcher, API_BASE } from "@/lib/api";
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
  AlertCircle,
  Calendar,
  Loader2,
  MessageSquare,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface EarningsTranscriptProps {
  ticker?: string;
}

interface TranscriptMetadata {
  fiscal_year: number;
  fiscal_quarter: number;
  call_date: string | null;
  title: string | null;
}

const QUARTERS = [1, 2, 3, 4] as const;

function defaultYear(): number {
  // Default to last calendar year — fiscal calendars vary, this is a sensible
  // starting point that the user can change with the Year dropdown.
  return new Date().getFullYear() - 1;
}

function yearChoices(): number[] {
  const current = new Date().getFullYear();
  // 6 years back through current year, newest first.
  return Array.from({ length: 7 }, (_, i) => current - i);
}

export function EarningsTranscript({ ticker }: EarningsTranscriptProps) {
  const [year, setYear] = useState<number>(defaultYear);
  const [quarter, setQuarter] = useState<number>(1);

  // Reset selection when ticker changes so the UI doesn't keep showing the
  // previous company's choice.
  useEffect(() => {
    setYear(defaultYear());
    setQuarter(1);
  }, [ticker]);

  // List of already-cached transcripts (for the "previously fetched" picker).
  const { data: listData } = useSWR<{ transcripts: TranscriptMetadata[] }>(
    ticker ? `${API_BASE}/api/transcripts/${ticker}/list` : null,
    fetcher,
  );

  // The actual transcript content. Backend handles DB-first lookup with
  // Tavily fallback on miss.
  const detailUrl = useMemo(() => {
    if (!ticker) return null;
    return `${API_BASE}/api/transcript?ticker=${encodeURIComponent(
      ticker,
    )}&year=${year}&quarter=${quarter}`;
  }, [ticker, year, quarter]);

  const {
    data: detailData,
    error: detailError,
    isLoading: detailLoading,
  } = useSWR(detailUrl, fetcher, {
    revalidateOnFocus: false,
    shouldRetryOnError: false,
  });

  if (!ticker) {
    return (
      <Card>
        <CardContent className="flex h-64 items-center justify-center text-muted-foreground">
          Please select or type a ticker to view earnings transcripts.
        </CardContent>
      </Card>
    );
  }

  const onPickCached = (key: string) => {
    const t = listData?.transcripts.find(
      (x) => `${x.fiscal_year}-${x.fiscal_quarter}` === key,
    );
    if (t) {
      setYear(t.fiscal_year);
      setQuarter(t.fiscal_quarter);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">
            Earnings Call Transcripts — {ticker}
          </h2>
          <p className="text-muted-foreground">
            Pick a fiscal year and quarter. Cached transcripts return
            instantly; new periods are fetched live from the web.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Calendar className="h-4 w-4 text-muted-foreground" />

          <Select
            value={String(year)}
            onValueChange={(v) => setYear(Number(v))}
          >
            <SelectTrigger className="w-[110px]">
              <SelectValue placeholder="Year" />
            </SelectTrigger>
            <SelectContent>
              {yearChoices().map((y) => (
                <SelectItem key={y} value={String(y)}>
                  FY{y}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={String(quarter)}
            onValueChange={(v) => setQuarter(Number(v))}
          >
            <SelectTrigger className="w-[100px]">
              <SelectValue placeholder="Quarter" />
            </SelectTrigger>
            <SelectContent>
              {QUARTERS.map((q) => (
                <SelectItem key={q} value={String(q)}>
                  Q{q}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {listData && listData.transcripts.length > 0 && (
            <Select value="" onValueChange={onPickCached}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Previously fetched" />
              </SelectTrigger>
              <SelectContent>
                {listData.transcripts.map((t) => (
                  <SelectItem
                    key={`${t.fiscal_year}-${t.fiscal_quarter}`}
                    value={`${t.fiscal_year}-${t.fiscal_quarter}`}
                  >
                    FY{t.fiscal_year} Q{t.fiscal_quarter}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </div>

      {detailLoading ? (
        <Card>
          <CardContent className="flex h-96 flex-col items-center justify-center gap-3 text-muted-foreground">
            <Loader2 className="h-8 w-8 animate-spin" />
            <span className="text-sm">
              Loading FY{year} Q{quarter} — checking cache, may search the web…
            </span>
          </CardContent>
        </Card>
      ) : detailError ? (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>
            {(detailError as { status?: number }).status === 404
              ? "Transcript not found"
              : "Could not load transcript"}
          </AlertTitle>
          <AlertDescription>
            {(detailError as { status?: number }).status === 404
              ? `No transcript was found for ${ticker} FY${year} Q${quarter}. Try a different period.`
              : `Failed to load transcript for ${ticker} FY${year} Q${quarter}. Please try again.`}
          </AlertDescription>
        </Alert>
      ) : !detailData ? null : (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-primary" />
              {detailData.title || `Q${quarter} FY${year} Earnings Call`}
            </CardTitle>
            <CardDescription>
              Call Date: {detailData.call_date || "Unknown"} | Source:{" "}
              {detailData.source_domain || "Web Search"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="max-h-[600px] overflow-y-auto rounded-md bg-muted/30 p-6 shadow-inner">
              <div className="prose prose-sm dark:prose-invert max-w-none">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {detailData.transcript_text}
                </ReactMarkdown>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
