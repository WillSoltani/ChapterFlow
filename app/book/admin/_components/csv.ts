"use client";

/**
 * Convert an array of objects to CSV and trigger a download.
 * Headers are derived from the keys of the first row (or passed explicitly).
 */
export function downloadCSV<T extends Record<string, unknown>>(
  rows: T[],
  filename: string,
  headers?: Array<keyof T | { key: keyof T; label: string }>,
): void {
  if (rows.length === 0) {
    alert("Nothing to export");
    return;
  }

  const cols =
    headers ??
    (Object.keys(rows[0]) as Array<keyof T>).map((k) => ({ key: k, label: String(k) }));

  const normalized = cols.map((c) =>
    typeof c === "object" && c !== null && "key" in c
      ? c
      : { key: c, label: String(c) },
  );

  const escape = (val: unknown): string => {
    if (val === null || val === undefined) return "";
    let str = typeof val === "object" ? JSON.stringify(val) : String(val);
    // Neutralize spreadsheet formula triggers (OWASP CSV-injection mitigation):
    // prefix a leading '=', '+', '-', '@', tab, or CR with a single quote so the
    // value is treated as text when opened in Excel/Sheets.
    if (/^[=+\-@\t\r]/.test(str)) {
      str = `'${str}`;
    }
    if (/[",\n\r]/.test(str)) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const lines = [
    normalized.map((c) => escape(c.label)).join(","),
    ...rows.map((row) => normalized.map((c) => escape(row[c.key])).join(",")),
  ];

  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
