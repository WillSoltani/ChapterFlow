"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Download, Loader2 } from "lucide-react";
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

export function ExportModal({ open, onClose, isPro, reducedMotion }: ExportModalProps) {
  const [exporting, setExporting] = useState<string | null>(null);
  const [completed, setCompleted] = useState<string | null>(null);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  function handleExport(format: string) {
    setExporting(format);
    setCompleted(null);
    // Simulate export
    setTimeout(() => {
      setExporting(null);
      setCompleted(format);
    }, 1500);
  }

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center px-4">
          <motion.div
            initial={reducedMotion ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={reducedMotion ? undefined : { opacity: 0 }}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            initial={reducedMotion ? false : { y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={reducedMotion ? undefined : { y: 20, opacity: 0 }}
            className="relative w-full max-w-md rounded-t-3xl sm:rounded-3xl bg-(--cf-surface-strong) border border-(--cf-border) p-6 shadow-xl"
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
              Download your reading history, highlights, notes, and quiz results.
            </p>

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
                      &#10003; Ready
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
