import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { fetcher, API_BASE, CompanyDataFiling } from "@/lib/api";
import { useState } from "react";
import useSWR from "swr";
import { Accordion } from "@/components/ui/accordion";
import { SectionItem } from "./SectionItem";
import { NotesSectionItem } from "./NotesSectionItem";
import { downloadText } from "@/lib/export";
import { formatNoteTitle, FilingDetail } from "./types";
import { Loader2 } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";
import { FetchError } from "@/lib/api";

export function FilingTextPanel({
    ticker,
    filings,
}: {
    ticker: string;
    filings: CompanyDataFiling[];
}) {
    const [selectedAccn, setSelectedAccn] = useState<string | null>(
        filings[0]?.accession_number ?? null,
    );

    const {
        data: detail,
        error,
        isLoading,
    } = useSWR<FilingDetail>(
        ticker && selectedAccn
            ? `${API_BASE}/api/documents/${ticker}/${selectedAccn}`
            : null,
        fetcher,
        { revalidateOnFocus: false, shouldRetryOnError: false },
    );

    const current = filings.find((f) => f.accession_number === selectedAccn);

    if (filings.length === 0) {
        return (
            <Card>
                <CardContent className="flex h-48 items-center justify-center text-sm text-muted-foreground">
                    No 10-K / 10-Q filings to display text for.
                </CardContent>
            </Card>
        );
    }

    const exportTxt = (label: string, content: string | null | undefined) => {
        if (!content || !current) return;
        downloadText(
            content,
            `${ticker}_${current.form_type}_${current.filing_date}_${label}.txt`,
        );
    };

    return (
        <div className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h3 className="text-lg font-semibold">Filing Text Sections</h3>
                    <p className="text-sm text-muted-foreground">
                        Pick a filing to read MD&amp;A, Risk Factors, and Business overview.
                    </p>
                </div>
                <Select value={selectedAccn ?? ""} onValueChange={setSelectedAccn}>
                    <SelectTrigger className="h-8 w-[280px] text-xs">
                        <SelectValue placeholder="Select filing period" />
                    </SelectTrigger>
                    <SelectContent>
                        {filings.map((f) => (
                            <SelectItem key={f.accession_number} value={f.accession_number}>
                                {f.filing_date} — {f.form_type}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            {isLoading ? (
                <Card>
                    <CardContent className="flex h-48 items-center justify-center">
                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </CardContent>
                </Card>
            ) : error ? (
                <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Could not load filing text</AlertTitle>
                    <AlertDescription>
                        {(error as FetchError)?.detail ??
                            "Failed to load text sections for the selected filing."}
                    </AlertDescription>
                </Alert>
            ) : !detail ? null : (
                <Card className="border-glass-border bg-glass backdrop-blur-sm">
                    <CardHeader>
                        <CardTitle className="text-base">
                            {detail.form_type} — {detail.filing_date}
                        </CardTitle>
                        <CardDescription>
                            {detail.company_name ?? ticker} · Accession {selectedAccn}
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Accordion type="single" collapsible className="w-full">
                            <SectionItem
                                value="mda"
                                label="Management's Discussion and Analysis (MD&A)"
                                content={detail.mda}
                                onExport={() => exportTxt("mda", detail.mda)}
                            />
                            <SectionItem
                                value="risk"
                                label="Risk Factors"
                                content={detail.risk_factors}
                                onExport={() => exportTxt("risk_factors", detail.risk_factors)}
                            />
                            <SectionItem
                                value="business"
                                label="Business Overview"
                                content={detail.business}
                                onExport={() => exportTxt("business", detail.business)}
                            />
                            <NotesSectionItem
                                value="notes"
                                notes={detail.financial_notes ?? []}
                                onExport={() =>
                                    exportTxt(
                                        "financial_notes",
                                        (detail.financial_notes ?? [])
                                            .map((n) => `## ${formatNoteTitle(n.note_key)}\n\n${n.note_text}`)
                                            .join("\n\n---\n\n"),
                                    )
                                }
                            />
                        </Accordion>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}