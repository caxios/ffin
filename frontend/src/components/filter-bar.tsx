"use client";

import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Filters } from "@/lib/api";

type Props = {
  filters: Filters;
  onChange: (patch: Partial<Filters>) => void;
};

export function FilterBar({ filters, onChange }: Props) {
  return (
    <div className="grid grid-cols-2 gap-3 rounded-lg border border-glass-border bg-glass p-4 backdrop-blur-sm md:grid-cols-6">
      <Select
        value={filters.source}
        onValueChange={(v) =>
          onChange({ source: v as Filters["source"], offset: 0 })
        }
      >
        <SelectTrigger>
          <SelectValue placeholder="Source" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="watchlist">Watchlist</SelectItem>
          <SelectItem value="all">All filings</SelectItem>
        </SelectContent>
      </Select>

      <Input
        placeholder="Ticker"
        value={filters.ticker ?? ""}
        onChange={(e) =>
          onChange({ ticker: e.target.value.toUpperCase(), offset: 0 })
        }
      />

      <Input
        placeholder="Owner"
        value={filters.owner ?? ""}
        onChange={(e) => onChange({ owner: e.target.value, offset: 0 })}
      />

      <Select
        value={filters.acquired_or_disposed || "any"}
        onValueChange={(v) =>
          onChange({
            acquired_or_disposed: v === "any" ? "" : (v as "A" | "D"),
            offset: 0,
          })
        }
      >
        <SelectTrigger>
          <SelectValue placeholder="Direction" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="any">Any direction</SelectItem>
          <SelectItem value="A">Buy (A)</SelectItem>
          <SelectItem value="D">Sell (D)</SelectItem>
        </SelectContent>
      </Select>

      <Input
        type="date"
        value={filters.date_from ?? ""}
        onChange={(e) => onChange({ date_from: e.target.value, offset: 0 })}
      />

      <Input
        type="date"
        value={filters.date_to ?? ""}
        onChange={(e) => onChange({ date_to: e.target.value, offset: 0 })}
      />
    </div>
  );
}
