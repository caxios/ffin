"use client";

import { useState, useEffect } from "react";
import useSWR from "swr";
import { fetcher, API_BASE } from "@/lib/api";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, Loader2, MessageSquare, Calendar } from "lucide-react";
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
  call_date: string;
  title: string;
}

export function EarningsTranscript({ ticker }: EarningsTranscriptProps) {
  const [selectedPeriod, setSelectedPeriod] = useState<string | null>(null); // format: "year-quarter"

  // 1. Fetch available transcripts list
  const { data: listData, error: listError, isLoading: listLoading } = useSWR<{ transcripts: TranscriptMetadata[] }>(
    ticker ? `${API_BASE}/api/transcripts/${ticker}/list` : null,
    fetcher
  );

  // Auto-select most recent
  useEffect(() => {
    if (listData?.transcripts?.length && !selectedPeriod) {
      const first = listData.transcripts[0];
      setSelectedPeriod(`${first.fiscal_year}-${first.fiscal_quarter}`);
    }
  }, [listData, selectedPeriod]);

  useEffect(() => {
    setSelectedPeriod(null);
  }, [ticker]);

  // 2. Fetch transcript detail
  const [year, quarter] = selectedPeriod?.split("-") || [];
  const { data: detailData, error: detailError, isLoading: detailLoading } = useSWR(
    ticker && selectedPeriod ? `${API_BASE}/api/transcript?ticker=${ticker}&year=${year}&quarter=${quarter}` : null,
    fetcher
  );

  if (!ticker) {
    return (
      <Card>
        <CardContent className="flex h-64 items-center justify-center text-muted-foreground">
          Please select or type a ticker in the Filter Bar to view earnings transcripts.
        </CardContent>
      </Card>
    );
  }

  if (listLoading) {
    return (
      <Card>
        <CardContent className="flex h-64 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (listError || !listData) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Error</AlertTitle>
        <AlertDescription>Could not load transcripts for {ticker}.</AlertDescription>
      </Alert>
    );
  }

  if (listData.transcripts.length === 0) {
    return (
      <Card>
        <CardContent className="flex h-64 items-center justify-center text-muted-foreground">
          No earnings transcripts found for {ticker} in the database.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Earnings Call Transcripts — {ticker}</h2>
          <p className="text-muted-foreground">Historical management calls and Q&A sessions.</p>
        </div>

        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <Select value={selectedPeriod || ""} onValueChange={setSelectedPeriod}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Select period" />
            </SelectTrigger>
            <SelectContent>
              {listData.transcripts.map((t) => (
                <SelectItem key={`${t.fiscal_year}-${t.fiscal_quarter}`} value={`${t.fiscal_year}-${t.fiscal_quarter}`}>
                  FY{t.fiscal_year} Q{t.fiscal_quarter}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {detailLoading ? (
        <Card>
          <CardContent className="flex h-96 items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </CardContent>
        </Card>
      ) : detailError || !detailData ? (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>Failed to load the selected transcript content.</AlertDescription>
        </Alert>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-primary" />
              {detailData.title || `Q${quarter} FY${year} Earnings Call`}
            </CardTitle>
            <CardDescription>
              Call Date: {detailData.call_date || "Unknown"} | Source: {detailData.source_domain || "Web Search"}
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
