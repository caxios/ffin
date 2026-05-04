import { Badge } from "@/components/ui/badge";
import { CompanyDataResponse } from "@/lib/api";

export function CacheBadge({ status }: { status: CompanyDataResponse["cache_status"] }) {
    const map = {
        hit: { label: "cached", cls: "border-accent-green/40 bg-accent-green/10 text-accent-green" },
        partial: { label: "partial · re-fetched", cls: "border-amber-500/40 bg-amber-500/10 text-amber-300" },
        miss: { label: "fresh from SEC", cls: "border-amber-500/40 bg-amber-500/10 text-amber-300" },
    };
    const { label, cls } = map[status];
    return (
        <Badge variant="outline" className={`font-mono text-[10px] uppercase ${cls}`}>
            {label}
        </Badge>
    );
}