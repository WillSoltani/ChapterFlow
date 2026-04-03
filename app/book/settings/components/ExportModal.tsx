"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Download, Loader2, AlertCircle } from "lucide-react";
import type { ExportFormat } from "../types/settings";
import { cn } from "@/app/book/components/ui/cn";
import { ProBadge } from "./ProBadge";

type ExportModalProps = {
  open: boolean;
  onClose: () => void;
  isPro: boolean;
  reducedMotion?: boolean;
};

const EXPORT_OPTIONS: {
  format: ExportFormat;
  icon: string;
  label: string;
  description: string;
}[] = [
  { format: "csv", icon: "\uD83D\uDCC4", label: "CSV", description: "For spreadsheets" },
  { format: "markdown", icon: "\uD83D\uDCDD", label: "Markdown", description: "For Obsidian, Notion, etc." },
  { format: "json", icon: "\uD83D\uDCE6", label: "JSON", description: "For developers" },
];

const SYNC_OPTIONS = [
  { id: "notion", icon: "\uD83D\uDD17", label: "Sync to Notion" },
  { id: "obsidian", icon: "\uD83D\uDD17", label: "Sync to Obsidian" },
];

const FORMAT_EXTENSIONS: Record<string, string> = {
  csv: ".csv",
  markdown: ".md",
  json: ".json",
};

export function ExportModal({ open, onClose, isPro, reducedMotion }: ExportModalProps) {
  const [exporting, setExporting] = useState<string | null>(null);
  const [completed, setCompleted] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

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
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center px-4">
          <motion.div
            initial={reducedMotion ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={reducedMotion ? undefined : { opacity: 0 }}
            className="absolute inset-0 bg-(--cf-overlay) backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            initial={reducedMotion ? false : { y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={reducedMotion ? undefined : { y: 20, opacity: 0 }}
            className="relative w-full max-w-md rounded-t-3xl sm:rounded-3xl bg-(--cf-surface-strong) border border-(--cf-border) p-6 shadow-shadow-elevated"
          >
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="absolute top-4 right-4 flex h-8 w-8 items-center justify-center rounded-full hover:bg-(--cf-surface-muted) text-(--cf-text-soft)"
            >
              <X className="h-4 w-4" />
            </button>

            <h3 className="text-lg font-bold text-(--cf-text-1)">Export my data</h3>
            <p className="mt-1 text-sm text-(--cf-text-3)">
              Download your reading history, notes, bookmarks, and quiz results.
            </p>

            {error && (
              <div className="mt-3 flex items-center gap-2 rounded-lg bg-(--cf-danger-muted) px-3 py-2 text-xs text-(--cf-danger-text)">
                <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="mt-5 space-y-2">
              {EXPORT_OPTIONS.map((opt) => (
                <button
                  key={opt.format}
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

            {/* Pro sync integrations */}
            <div className="mt-4 space-y-2">
              {SYNC_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  disabled={!isPro}
                  onClick={() => handleExport(opt.id)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-xl border border-(--cf-border) px-4 py-3 text-left transition-colors",
                    "hover:bg-(--cf-surface-muted) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--cf-accent-border)",
                    !isPro && "opacity-50"
                  )}
                >
                  <span className="text-base">{opt.icon}</span>
                  <span className="flex-1 text-sm font-medium text-(--cf-text-1)">
                    {opt.label}
                  </span>
                  {!isPro && <ProBadge />}
                </button>
              ))}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
