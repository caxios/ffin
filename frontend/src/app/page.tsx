"use client";

import { useState } from "react";
import { Navbar } from "@/components/navbar";
import { SummaryCards } from "@/components/summary-cards";
import { FilterBar } from "@/components/filter-bar";
import { TradesTable } from "@/components/trades-table";
import { CioChat } from "@/components/cio-chat";
import { SecFilings } from "@/components/sec-filings";
import { FinancialData } from "@/components/financial-data";
import { EarningsTranscript } from "@/components/earnings-transcript";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Filters } from "@/lib/api";

const initialFilters: Filters = {
  source: "watchlist",
  limit: 50,
  offset: 0,
};

export default function DashboardPage() {
  const [filters, setFilters] = useState<Filters>(initialFilters);

  const patch = (p: Partial<Filters>) =>
    setFilters((prev) => ({ ...prev, ...p }));

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="mx-auto w-full max-w-7xl flex-1 space-y-6 px-6 py-8">
        <SummaryCards source={filters.source} />
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <FilterBar filters={filters} onChange={patch} />
            
            <Tabs defaultValue="insider" className="w-full">
              <TabsList className="mb-4 grid grid-cols-4 w-full">
                <TabsTrigger value="insider">Insider Trades</TabsTrigger>
                <TabsTrigger value="sec">SEC Filings</TabsTrigger>
                <TabsTrigger value="financials">Financials</TabsTrigger>
                <TabsTrigger value="transcripts">Transcripts</TabsTrigger>
              </TabsList>
              
              <TabsContent value="insider">
                <TradesTable
                  filters={filters}
                  onPage={(offset) => patch({ offset })}
                />
              </TabsContent>
              
              <TabsContent value="sec">
                <SecFilings ticker={filters.ticker} />
              </TabsContent>

              <TabsContent value="financials">
                <FinancialData ticker={filters.ticker} />
              </TabsContent>

              <TabsContent value="transcripts">
                <EarningsTranscript ticker={filters.ticker} />
              </TabsContent>
            </Tabs>
          </div>
          <CioChat className="lg:sticky lg:top-24" />
        </div>
      </main>
    </div>
  );
}
