/**
 * Tiny client-side download helpers for exporting page data.
 *
 * `downloadCsv(rows, filename)` — array-of-objects to RFC-4180-ish CSV.
 *   First row's keys become headers; values are stringified, with
 *   double-quotes / commas / newlines escaped via wrapping in quotes.
 *
 * `downloadText(text, filename)` — raw string to a .txt file.
 */

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function csvCell(v: unknown): string {
  if (v == null) return "";
  const s = typeof v === "string" ? v : String(v);
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function downloadCsv<T extends Record<string, unknown>>(
  rows: T[],
  filename: string,
  columns?: (keyof T)[],
) {
  if (rows.length === 0) {
    triggerDownload(new Blob([""], { type: "text/csv;charset=utf-8" }), filename);
    return;
  }
  const headers = (columns ?? (Object.keys(rows[0]) as (keyof T)[])) as string[];
  const lines = [
    headers.map(csvCell).join(","),
    ...rows.map((row) => headers.map((h) => csvCell(row[h as keyof T])).join(",")),
  ];
  // BOM helps Excel detect UTF-8 with non-ASCII names.
  const blob = new Blob(["﻿" + lines.join("\n")], {
    type: "text/csv;charset=utf-8",
  });
  triggerDownload(blob, filename);
}

export function downloadText(text: string, filename: string) {
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  triggerDownload(blob, filename);
}
