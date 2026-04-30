"use client";

import { useState, useEffect } from "react";
import useSWR from "swr";
import { fetcher, API_BASE } from "@/lib/api";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, Loader2, Calendar } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface SecFilingsProps {
  ticker?: string;
}

interface FilingMetadata {
  accession_number: string;
  form_type: string;
  filing_date: string;
  company_name: string;
}

export function SecFilings({ ticker }: SecFilingsProps) {
  const [selectedAccn, setSelectedAccn] = useState<string | null>(null);

  // 1. Fetch the list of available filings for this ticker
  const { data: listData, error: listError, isLoading: listLoading } = useSWR<{ filings: FilingMetadata[] }>(
    ticker ? `${API_BASE}/api/documents/${ticker}/list` : null,
    fetcher
  );

  // Auto-select the first (most recent) filing if none is currently selected
  useEffect(() => {
    if (listData?.filings?.length && !selectedAccn) {
      setSelectedAccn(listData.filings[0].accession_number);
    }
  }, [listData, selectedAccn]);

  // Reset selection when ticker changes to ensure we don't try to fetch old accn for new ticker
  useEffect(() => {
    setSelectedAccn(null);
  }, [ticker]);

  // 2. Fetch the detailed text sections for the selected accession number
  const { data: detailData, error: detailError, isLoading: detailLoading } = useSWR(
    ticker && selectedAccn ? `${API_BASE}/api/documents/${ticker}/${selectedAccn}` : null,
    fetcher
  );

  if (!ticker) {
    return (
      <Card>
        <CardContent className="flex h-64 items-center justify-center text-muted-foreground">
          Please select or type a ticker in the Filter Bar to view its SEC filings.
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
        <AlertDescription>
          Could not load filing list for {ticker}. The data may not have been scraped yet.
        </AlertDescription>
      </Alert>
    );
  }

  if (listData.filings.length === 0) {
    return (
      <Card>
        <CardContent className="flex h-64 items-center justify-center text-muted-foreground">
          No SEC filings found in database for {ticker}.
        </CardContent>
      </Card>
    );
  }

  const currentFiling = listData.filings.find(f => f.accession_number === selectedAccn);

  return (
    <div className="space-y-6">
      {/* Selection Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">{currentFiling?.company_name || ticker}</h2>
          <p className="text-muted-foreground">Select a filing period to view text sections.</p>
        </div>

        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <Select value={selectedAccn || ""} onValueChange={setSelectedAccn}>
            <SelectTrigger className="w-[280px]">
              <SelectValue placeholder="Select filing period" />
            </SelectTrigger>
            <SelectContent>
              {listData.filings.map((f) => (
                <SelectItem key={f.accession_number} value={f.accession_number}>
                  {f.filing_date} — {f.form_type}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Content Area */}
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
          <AlertDescription>Failed to load the selected filing content.</AlertDescription>
        </Alert>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>{detailData.form_type} Sections</CardTitle>
            <CardDescription>
              Filing Date: {detailData.filing_date} | Accession: {selectedAccn}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="mda">
                <AccordionTrigger className="text-lg font-semibold">
                  Management&apos;s Discussion and Analysis (MD&amp;A)
                </AccordionTrigger>
                <AccordionContent>
                  <div className="max-h-96 overflow-y-auto rounded-md bg-muted/50 p-4">
                    {detailData.mda ? (
                      <div className="prose prose-sm dark:prose-invert max-w-none">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {detailData.mda}
                        </ReactMarkdown>
                      </div>
                    ) : (
                      <p className="text-muted-foreground italic">No MD&amp;A section found for this period.</p>
                    )}
                  </div>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="risk">
                <AccordionTrigger className="text-lg font-semibold">
                  Risk Factors
                </AccordionTrigger>
                <AccordionContent>
                  <div className="max-h-96 overflow-y-auto rounded-md bg-muted/50 p-4">
                    {detailData.risk_factors ? (
                      <div className="prose prose-sm dark:prose-invert max-w-none">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {detailData.risk_factors}
                        </ReactMarkdown>
                      </div>
                    ) : (
                      <p className="text-muted-foreground italic">No Risk Factors section found for this period.</p>
                    )}
                  </div>
                </AccordionContent>
              </AccordionItem>

              {detailData.business && (
                <AccordionItem value="business">
                  <AccordionTrigger className="text-lg font-semibold">
                    Business Overview
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="max-h-96 overflow-y-auto rounded-md bg-muted/50 p-4">
                      <div className="prose prose-sm dark:prose-invert max-w-none">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {detailData.business}
                        </ReactMarkdown>
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              )}
            </Accordion>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
