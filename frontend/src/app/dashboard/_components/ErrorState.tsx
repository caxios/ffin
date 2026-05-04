import { FetchError } from "@/lib/api";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";

export function ErrorState({ ticker, error }: { ticker: string; error: unknown }) {
    let title = "Something went wrong";
    let body: React.ReactNode = "Please try again in a moment.";

    if (error instanceof FetchError) {
        if (error.status === 404) {
            title = "Ticker not found";
            body = (
                <>
                    We couldn&apos;t find SEC filings for{" "}
                    <span className="font-mono font-semibold">{ticker}</span>. Double-check
                    the symbol and try again.
                </>
            );
        } else if (error.status === 503) {
            title = "SEC rate limit";
            body =
                "SEC is rate-limiting requests right now. Wait about a minute and try again.";
        } else if (error.status === 502) {
            title = "Upstream error";
            body =
                error.detail ??
                "We hit an error while fetching this ticker from SEC. Try again later.";
        }
    }

    return (
        <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>{title}</AlertTitle>
            <AlertDescription>{body}</AlertDescription>
        </Alert>
    );
}