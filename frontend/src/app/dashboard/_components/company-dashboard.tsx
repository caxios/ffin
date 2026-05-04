"use client";

import { useState } from "react";
import useSWR from "swr";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { API_BASE, fetcher, CompanyDataResponse } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CioChat } from "@/components/cio-chat";
import { FinancialData } from "@/components/financial-data";
import { LoadingSkeleton } from "@/app/dashboard/_components/LoadingSkeleton";
import { ErrorState } from "@/app/dashboard/_components/ErrorState";
import { CacheBadge } from "@/app/dashboard/_components/CacheBadge";
import { FilingsCard } from "./FilingsCard";
import { TradesCard } from "./TradesCard";
import { FilingTextPanel } from "./FilingTextPanel";
import { EarningsTranscript } from "@/components/earnings-transcript";




export function CompanyDashboard({ ticker }: { ticker: string }) {
  const [limit, setLimit] = useState<string>("4");
  const [tradesLimit, setTradesLimit] = useState<string>("30");

  const { data, error, isLoading, isValidating } = useSWR<CompanyDataResponse>(
    `${API_BASE}/api/company-data/${encodeURIComponent(ticker)}?limit=${limit}&limit_form4=${tradesLimit || 30}`,
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
              <TradesCard
                ticker={ticker}
                trades={data.form4_trades}
                limit={tradesLimit}
                onLimitChange={setTradesLimit}
                isFetching={isValidating}
              />
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
