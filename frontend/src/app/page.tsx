"use client";

import { useState } from "react";
import { Navbar } from "@/components/navbar";
import { SummaryCards } from "@/components/summary-cards";
import { FilterBar } from "@/components/filter-bar";
import { TradesTable } from "@/components/trades-table";
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
        <FilterBar filters={filters} onChange={patch} />
        <TradesTable
          filters={filters}
          onPage={(offset) => patch({ offset })}
        />
      </main>
    </div>
  );
}
