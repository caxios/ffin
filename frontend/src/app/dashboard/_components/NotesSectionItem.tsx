import { AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { FilingNote } from "./types";
import { formatNoteTitle } from "./types";
import { Accordion } from "@/components/ui/accordion";

export function NotesSectionItem({
    value,
    notes,
    onExport,
}: {
    value: string;
    notes: FilingNote[];
    onExport: () => void;
}) {
    const has = notes.length > 0;
    return (
        <AccordionItem value={value}>
            <AccordionTrigger className="text-sm font-semibold">
                Notes to Financial Statements
                {has && (
                    <Badge variant="secondary" className="ml-2 font-mono text-[10px]">
                        {notes.length}
                    </Badge>
                )}
            </AccordionTrigger>
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
                    <div className="max-h-[480px] space-y-2 overflow-y-auto rounded-md bg-muted/40 p-4">
                        {has ? (
                            <Accordion type="multiple" className="w-full">
                                {notes.map((n) => (
                                    <AccordionItem key={n.note_key} value={n.note_key}>
                                        <AccordionTrigger className="text-xs font-medium">
                                            {formatNoteTitle(n.note_key)}
                                        </AccordionTrigger>
                                        <AccordionContent>
                                            <div className="prose prose-sm dark:prose-invert max-w-none">
                                                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                                    {n.note_text}
                                                </ReactMarkdown>
                                            </div>
                                        </AccordionContent>
                                    </AccordionItem>
                                ))}
                            </Accordion>
                        ) : (
                            <p className="text-sm italic text-muted-foreground">
                                No financial notes extracted for this filing.
                            </p>
                        )}
                    </div>
                </div>
            </AccordionContent>
        </AccordionItem>
    );
}