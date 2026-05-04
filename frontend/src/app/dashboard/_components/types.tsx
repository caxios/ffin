export interface FilingNote {
    note_key: string;
    note_text: string;
}

export interface FilingDetail {
    company_name?: string;
    form_type?: string;
    filing_date?: string;
    business?: string | null;
    risk_factors?: string | null;
    mda?: string | null;
    financial_notes?: FilingNote[] | null;
}

export const formatNoteTitle = (key: string) =>
    key
        .replace(/_/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .replace(/\b\w/g, (c) => c.toUpperCase());