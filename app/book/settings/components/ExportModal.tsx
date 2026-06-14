"use client";

import { useEffect, useRef, useState } from "react";
import { X, Download, Loader2, AlertCircle } from "lucide-react";
import type { ExportFormat } from "../types/settings";
import { cn } from "@/app/book/components/ui/cn";
import { Dialog } from "@/components/ui/Dialog";

type ExportModalProps = {
  open: boolean;
  onClose: () => void;
  /** Retained for call-site compatibility; no longer gates any control. */
  isPro?: boolean;
  /** Retained for call-site compatibility; Dialog owns motion now. */
  reducedMotion?: boolean;
};

const EXPORT_OPTIONS: {
  format: ExportFormat;
  icon: string;
  label: string;
  description: string;
}[] = [
  { format: "csv", icon: "📄", label: "CSV", description: "For spreadsheets" },
  { format: "markdown", icon: "📝", label: "Markdown", description: "For Obsidian, Notion, etc." },
  { format: "json", icon: "📦", label: "JSON", description: "For developers" },
];

const FORMAT_EXTENSIONS: Record<string, string> = {
  csv: ".csv",
  markdown: ".md",
  json: ".json",
};

export function ExportModal({ open, onClose }: ExportModalProps) {
  const [exporting, setExporting] = useState<string | null>(null);
  const [completed, setCompleted] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const firstFormatRef = useRef<HTMLButtonElement>(null);

  // Reset state when modal closes
  useEffect(() => {
    if (!open) {
      setExporting(null);
      setCompleted(null);
      setError(null);
    }
  }, [open]);

  async function handleExport(format: string) {
    setExporting(format);
    setCompleted(null);
    setError(null);

    try {
      const response = await fetch(
        `/app/api/book/me/export?format=${encodeURIComponent(format)}`,
        { cache: "no-store" }
      );

      if (!response.ok) {
        throw new Error(`Export failed (${response.status})`);
      }

      // Get the filename from Content-Disposition or construct one
      const disposition = response.headers.get("Content-Disposition");
      const filenameMatch = disposition?.match(/filename="?([^"]+)"?/);
      const filename =
        filenameMatch?.[1] ||
        `chapterflow-export-${new Date().toISOString().slice(0, 10)}${FORMAT_EXTENSIONS[format] || ".json"}`;

      // Create blob and trigger download
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setExporting(null);
      setCompleted(format);
    } catch {
      setExporting(null);
      setError("Export failed. Please try again.");
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      labelledBy="export-title"
      initialFocusRef={firstFormatRef}
    >
      <div className="relative p-6">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute top-4 right-4 flex h-8 w-8 items-center justify-center rounded-full hover:bg-(--cf-surface-muted) text-(--cf-text-soft)"
        >
          <X className="h-4 w-4" />
        </button>

        <h2 id="export-title" className="text-lg font-bold text-(--cf-text-1)">
          Export my data
        </h2>
        <p className="mt-1 text-sm text-(--cf-text-3)">
          Download your reading history, notes, bookmarks, and quiz results. Use
          Markdown to import into Obsidian, Notion, and similar tools.
        </p>

        {error && (
          <div className="mt-3 flex items-center gap-2 rounded-lg bg-(--cf-danger-muted) px-3 py-2 text-xs text-(--cf-danger-text)">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="mt-5 space-y-2">
          {EXPORT_OPTIONS.map((opt, idx) => (
            <button
              key={opt.format}
              ref={idx === 0 ? firstFormatRef : undefined}
              type="button"
              onClick={() => handleExport(opt.format)}
              disabled={exporting !== null}
              className={cn(
                "flex w-full items-center gap-3 rounded-xl border border-(--cf-border) px-4 py-3 text-left transition-colors",
                "hover:bg-(--cf-surface-muted) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--cf-accent-border)",
                "disabled:opacity-50"
              )}
            >
              <span className="text-base">{opt.icon}</span>
              <div className="flex-1">
                <span className="text-sm font-medium text-(--cf-text-1)">
                  {opt.label}
                </span>
                <span className="ml-2 text-xs text-(--cf-text-3)">
                  {opt.description}
                </span>
              </div>
              {exporting === opt.format && (
                <Loader2 className="h-4 w-4 animate-spin text-(--cf-text-soft)" />
              )}
              {completed === opt.format && (
                <span className="text-xs font-medium text-(--cf-success-text)">
                  &#10003; Downloaded
                </span>
              )}
              {exporting !== opt.format && completed !== opt.format && (
                <Download className="h-4 w-4 text-(--cf-text-soft)" />
              )}
            </button>
          ))}
        </div>
      </div>
    </Dialog>
  );
}
