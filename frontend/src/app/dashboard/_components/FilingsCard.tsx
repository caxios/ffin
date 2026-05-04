import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Download, FileText, Loader2 } from "lucide-react";
import { API_BASE } from "@/lib/api";
import { useState } from "react";

import { CompanyDataFiling } from "@/lib/api";

const LIMIT_OPTIONS = [
    { value: "4", label: "Last 4" },
    { value: "8", label: "Last 8" },
    { value: "12", label: "Last 12" },
    { value: "1000", label: "All available" },
] as const;

export function FilingsCard({
    ticker,
    filings,
    limit,
    onLimitChange,
    isFetching,
}: {
    ticker: string;
    filings: CompanyDataFiling[];
    limit: string;
    onLimitChange: (v: string) => void;
    isFetching: boolean;
}) {
    // const exportCsv = () => {
    //   downloadCsv(
    //     filings.map((f) => ({
    //       accession_number: f.accession_number,
    //       form_type: f.form_type,
    //       filing_date: f.filing_date,
    //       company_name: f.company_name ?? "",
    //       document_url: f.document_url ?? "",
    //       has_business: f.has_business,
    //       has_risk_factors: f.has_risk_factors,
    //       has_mda: f.has_mda,
    //     })),
    //     `${ticker}_filings_10kq.csv`,
    //   );
    // };
    const [downloadingAccn, setDownloadingAccn] = useState<string | null>(null);

    // 개별 공시의 PDF를 다운받는 함수
    const downloadPdf = async (
        accessionNumber: string,
        formType: string,
        documentUrl: string | null,
    ) => {
        if (!documentUrl) {
            alert("다운로드할 원본 링크가 없습니다.");
            return;
        }

        setDownloadingAccn(accessionNumber);
        try {
            const response = await fetch(
                `${API_BASE}/api/download-pdf?url=${encodeURIComponent(documentUrl)}`,
            );
            if (!response.ok) throw new Error(`PDF 생성 실패 (${response.status})`);

            const blob = await response.blob();
            const downloadUrl = window.URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = downloadUrl;
            link.download = `${ticker}_${formType}.pdf`;
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(downloadUrl);
        } catch (error) {
            console.error("PDF 다운로드 중 에러 발생:", error);
            alert("PDF 다운로드에 실패했습니다.");
        } finally {
            setDownloadingAccn(null);
        }
    };
    return (
        <Card className="border-glass-border bg-glass backdrop-blur-sm">
            <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                    <CardTitle className="text-base">10-K / 10-Q Filings</CardTitle>
                    <CardDescription>
                        {filings.length === 0
                            ? "No annual or quarterly filings on record."
                            : `${filings.length} most-recent filing${filings.length === 1 ? "" : "s"}.`}
                    </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                    <Select value={limit} onValueChange={onLimitChange} disabled={isFetching}>
                        <SelectTrigger className="h-8 w-[140px] text-xs">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {LIMIT_OPTIONS.map((o) => (
                                <SelectItem key={o.value} value={o.value}>
                                    {o.label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </CardHeader>
            <CardContent>
                {filings.length === 0 ? null : (
                    <div className="overflow-x-auto rounded-md border border-glass-border/50">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-24">Form</TableHead>
                                    <TableHead>Filed</TableHead>
                                    <TableHead>Sections</TableHead>
                                    <TableHead className="text-right">Source</TableHead>
                                    <TableHead className="text-right">Download</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filings.map((f) => (
                                    <TableRow key={f.accession_number}>
                                        <TableCell className="font-mono text-xs">
                                            <Badge variant="outline">{f.form_type}</Badge>
                                        </TableCell>
                                        <TableCell className="font-mono text-xs">{f.filing_date}</TableCell>
                                        <TableCell className="space-x-1 text-xs text-muted-foreground">
                                            {f.has_business && <Badge variant="secondary">Business</Badge>}
                                            {f.has_risk_factors && <Badge variant="secondary">Risk</Badge>}
                                            {f.has_mda && <Badge variant="secondary">MD&amp;A</Badge>}
                                            {!f.has_business && !f.has_risk_factors && !f.has_mda && "—"}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            {f.document_url ? (
                                                <a
                                                    href={f.document_url}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="inline-flex items-center gap-1 text-xs text-accent-green hover:underline"
                                                >
                                                    <FileText className="h-3 w-3" /> SEC
                                                </a>
                                            ) : (
                                                "—"
                                            )}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            {f.document_url ? (
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => downloadPdf(f.accession_number, f.form_type, f.document_url)}
                                                    disabled={downloadingAccn !== null}
                                                    className="h-8 text-xs"
                                                >
                                                    {downloadingAccn === f.accession_number ? (
                                                        <Loader2 className="h-3 w-3 animate-spin" />
                                                    ) : (
                                                        <Download className="h-3 w-3" />
                                                    )}
                                                    PDF
                                                </Button>
                                            ) : (
                                                "—"
                                            )}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}