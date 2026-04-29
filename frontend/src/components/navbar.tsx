"use client";

import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { API_BASE } from "@/lib/api";
import { useSWRConfig } from "swr";

export function Navbar({ lastUpdated }: { lastUpdated?: string | null }) {
  const { mutate } = useSWRConfig();
  const [loading, setLoading] = useState(false);

  const refresh = async () => {
    setLoading(true);
    try {
      await fetch(`${API_BASE}/api/refresh?source=watchlist`, { method: "POST" });
      await mutate(
        (key) => typeof key === "string" && key.startsWith(API_BASE),
        undefined,
        { revalidate: true },
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <header className="sticky top-0 z-10 border-b border-glass-border bg-glass backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">
            Insider Trading Tracker
          </h1>
          {lastUpdated && (
            <p className="text-xs text-muted-foreground font-mono">
              Updated {lastUpdated}
            </p>
          )}
        </div>
        <Button onClick={refresh} disabled={loading} size="sm">
          <RefreshCw className={loading ? "animate-spin" : ""} />
          Refresh
        </Button>
      </div>
    </header>
  );
}
