"use client";

import useSWR from "swr";
import { fetcher, API_BASE } from "@/lib/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, Loader2, TrendingUp, TrendingDown } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

interface FinancialDataProps {
  ticker?: string;
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

export function FinancialData({ ticker }: FinancialDataProps) {
  const { data, error, isLoading } = useSWR<{ facts: Fact[] }>(
    ticker ? `${API_BASE}/api/financials/${ticker}` : null,
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

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex h-64 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (error || !data) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Error</AlertTitle>
        <AlertDescription>
          Could not load financial data for {ticker}.
        </AlertDescription>
      </Alert>
    );
  }

  if (data.facts.length === 0) {
    return (
      <Card>
        <CardContent className="flex h-64 items-center justify-center text-muted-foreground">
          No financial facts found in database for {ticker}.
        </CardContent>
      </Card>
    );
  }

  const formatValue = (val: number, unit: string) => {
    if (unit === "USD") {
      if (Math.abs(val) >= 1e9) return `$${(val / 1e9).toFixed(2)}B`;
      if (Math.abs(val) >= 1e6) return `$${(val / 1e6).toFixed(2)}M`;
      return `$${val.toLocaleString()}`;
    }
    return val.toLocaleString();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Historical Financial Data — {ticker}</CardTitle>
        <CardDescription>
          Raw XBRL concepts pulled from SEC 10-K/Q filings.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Concept</TableHead>
                <TableHead>Period End</TableHead>
                <TableHead>Value</TableHead>
                <TableHead>Form</TableHead>
                <TableHead className="text-right">Filed</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.facts.map((fact, i) => (
                <TableRow key={i}>
                  <TableCell className="font-medium">
                    <div className="flex flex-col">
                      <span>{fact.label || fact.concept}</span>
                      <span className="text-xs text-muted-foreground">{fact.concept}</span>
                    </div>
                  </TableCell>
                  <TableCell>{fact.period_end}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{formatValue(fact.val, fact.unit)}</span>
                      {fact.val > 0 ? (
                        <TrendingUp className="h-3 w-3 text-emerald-500" />
                      ) : fact.val < 0 ? (
                        <TrendingDown className="h-3 w-3 text-rose-500" />
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{fact.form}</Badge>
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground">{fact.filed}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
