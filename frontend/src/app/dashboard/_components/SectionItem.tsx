import { AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export function SectionItem({
    value,
    label,
    content,
    onExport,
}: {
    value: string;
    label: string;
    content: string | null | undefined;
    onExport: () => void;
}) {
    const has = !!(content && content.trim().length > 0);
    return (
        <AccordionItem value={value}>
            <AccordionTrigger className="text-sm font-semibold">{label}</AccordionTrigger>
            <AccordionContent>
                <div className="space-y-2">
                    <div className="flex justify-end">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={onExport}
                            disabled={!has}
                            className="h-7 text-xs"
                        >
                            <Download className="h-3 w-3" />
                            TXT
                        </Button>
                    </div>
                    <div className="max-h-[480px] overflow-y-auto rounded-md bg-muted/40 p-4">
                        {has ? (
                            <div className="prose prose-sm dark:prose-invert max-w-none">
                                <ReactMarkdown remarkPlugins={[remarkGfm]}>{content!}</ReactMarkdown>
                            </div>
                        ) : (
                            <p className="text-sm italic text-muted-foreground">
                                No {label} extracted for this filing.
                            </p>
                        )}
                    </div>
                </div>
            </AccordionContent>
        </AccordionItem>
    );
}