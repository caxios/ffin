"use client";

import { useState, useEffect } from "react";
import useSWR from "swr";
import { fetcher, API_BASE } from "@/lib/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, Loader2, TrendingUp, TrendingDown, Calendar } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface FinancialDataProps {
  ticker?: string;
}

interface FilingPeriod {
  fy: number;
  fp: string;
  form: string;
  filed: string;
  fact_count: number;
}

interface Fact {
  concept: string;
  label: string;
  val: number;
  unit: string;
  fy: number;
  fp: string;
  form: string;
  period_end: string;
  filed: string;
}

// Encode a period into a unique string key for the Select component
function periodKey(p: FilingPeriod): string {
  return `${p.fy}|${p.fp}|${p.form}|${p.filed}`;
}

function parsePeriodKey(key: string) {
  const [fy, fp, form, filed] = key.split("|");
  return { fy, fp, form, filed };
}

export function FinancialData({ ticker }: FinancialDataProps) {
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  // 1. Fetch available filing periods
  const { data: listData, error: listError, isLoading: listLoading } = useSWR<{ periods: FilingPeriod[] }>(
    ticker ? `${API_BASE}/api/financials/${ticker}/list` : null,
    fetcher
  );

  // Auto-select the most recent period
  useEffect(() => {
    if (listData?.periods?.length && !selectedKey) {
      setSelectedKey(periodKey(listData.periods[0]));
    }
  }, [listData, selectedKey]);

  // Reset when ticker changes
  useEffect(() => {
    setSelectedKey(null);
  }, [ticker]);

  // 2. Fetch all facts for the selected period
  const parsed = selectedKey ? parsePeriodKey(selectedKey) : null;
  const { data: detailData, error: detailError, isLoading: detailLoading } = useSWR<{ facts: Fact[] }>(
    ticker && parsed
      ? `${API_BASE}/api/financials/${ticker}/detail?fy=${parsed.fy}&fp=${parsed.fp}&form=${parsed.form}&filed=${parsed.filed}`
      : null,
    fetcher
  );

  if (!ticker) {
    return (
      <Card>
        <CardContent className="flex h-64 items-center justify-center text-muted-foreground">
          Please select or type a ticker in the Filter Bar to view its financial data.
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
        <AlertDescription>Could not load financial data for {ticker}.</AlertDescription>
      </Alert>
    );
  }

  if (listData.periods.length === 0) {
    return (
      <Card>
        <CardContent className="flex h-64 items-center justify-center text-muted-foreground">
          No financial data found for {ticker} in the database.
        </CardContent>
      </Card>
    );
  }

  const currentPeriod = listData.periods.find(p => periodKey(p) === selectedKey);

  const formatValue = (val: number, unit: string) => {
    if (unit === "USD") {
      if (Math.abs(val) >= 1e9) return `$${(val / 1e9).toFixed(2)}B`;
      if (Math.abs(val) >= 1e6) return `$${(val / 1e6).toFixed(2)}M`;
      return `$${val.toLocaleString()}`;
    }
    if (unit === "USD/shares") {
      return `$${val.toFixed(2)}`;
    }
    return val.toLocaleString();
  };

  return (
    <div className="space-y-6">
      {/* Header with period selector */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Financial Statements — {ticker}</h2>
          <p className="text-muted-foreground">Select a filing period to view all reported line items.</p>
        </div>

        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <Select value={selectedKey || ""} onValueChange={setSelectedKey}>
            <SelectTrigger className="w-[280px]">
              <SelectValue placeholder="Select period" />
            </SelectTrigger>
            <SelectContent>
              {listData.periods.map((p) => (
                <SelectItem key={periodKey(p)} value={periodKey(p)}>
                  FY{p.fy} {p.fp} — {p.form} ({p.filed})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Data table */}
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
          <AlertDescription>Failed to load financial data for the selected period.</AlertDescription>
        </Alert>
      ) : (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-7">
            <div>
              <CardTitle>{currentPeriod?.form} — FY{currentPeriod?.fy} {currentPeriod?.fp}</CardTitle>
              <CardDescription>
                Filed on {currentPeriod?.filed}
              </CardDescription>
            </div>
            <Badge variant="outline" className="text-sm">
              {detailData.facts.length} items
            </Badge>
          </CardHeader>
          <CardContent>
            <div className="max-h-[600px] overflow-y-auto rounded-md border shadow-sm">
              <Table>
                <TableHeader className="sticky top-0 bg-background z-10 shadow-sm">
                  <TableRow>
                    <TableHead>Concept / Metric</TableHead>
                    <TableHead>Value</TableHead>
                    <TableHead>Period End</TableHead>
                    <TableHead className="text-right">Unit</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {detailData.facts.map((fact, i) => (
                    <TableRow key={`${fact.concept}-${fact.period_end}-${fact.val}-${i}`} className="hover:bg-muted/50 transition-colors">
                      <TableCell className="font-medium">
                        <div className="flex flex-col">
                          <span className="text-sm font-semibold">{fact.label || fact.concept}</span>
                          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{fact.concept}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="text-base font-bold tabular-nums">{formatValue(fact.val, fact.unit)}</span>
                          {fact.val > 0 ? (
                            <TrendingUp className="h-4 w-4 text-emerald-500 opacity-80" />
                          ) : fact.val < 0 ? (
                            <TrendingDown className="h-4 w-4 text-rose-500 opacity-80" />
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {fact.period_end}
                      </TableCell>
                      <TableCell className="text-right text-xs font-mono text-muted-foreground">{fact.unit}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
