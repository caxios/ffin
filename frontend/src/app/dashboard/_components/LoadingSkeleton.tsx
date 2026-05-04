import { Card } from "@/components/ui/card";
import { Loader2 } from "lucide-react";

export function LoadingSkeleton({ ticker }: { ticker: string }) {
    return (
        <div className="space-y-6">
            <div className="flex items-center gap-3">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                <span className="text-sm text-muted-foreground">
                    Loading {ticker} — checking cache, may need to scrape SEC EDGAR…
                </span>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
                <Card className="h-48 animate-pulse border-glass-border bg-glass" />
                <Card className="h-48 animate-pulse border-glass-border bg-glass" />
            </div>
            <Card className="h-72 animate-pulse border-glass-border bg-glass" />
        </div>
    );
}