"use client";

// Canonical shared toast (WS3-001).

import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, CheckCircle2, Info, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { DUR, EASE } from "@/lib/motion";

export type ToastTone = "info" | "success" | "error";
export type ToastPresentation = "default" | "saved" | "celebration";

type ToastProps = {
  open: boolean;
  message: string;
  tone?: ToastTone;
  detail?: string;
  presentation?: ToastPresentation;
  /** Auto-dismiss after this many ms (0 = no auto-dismiss). Default 3000. */
  autoDismissMs?: number;
  /** Called when the toast should close (auto-dismiss or user action). */
  onClose?: () => void;
};

function iconForTone(tone: ToastTone) {
  if (tone === "success") return <CheckCircle2 className="h-4 w-4" />;
  if (tone === "error") return <XCircle className="h-4 w-4" />;
  return <Info className="h-4 w-4" />;
}

export function Toast({
  open,
  message,
  tone = "info",
  detail,
  presentation = "default",
  autoDismissMs = 3000,
  onClose,
}: ToastProps) {
  useEffect(() => {
    if (!open || autoDismissMs <= 0 || !onClose) return;
    const id = setTimeout(onClose, autoDismissMs);
    return () => clearTimeout(id);
  }, [open, autoDismissMs, onClose]);

  if (presentation === "saved") {
    return (
      <AnimatePresence>
        {open ? (
          <motion.div
            role="status"
            aria-live="polite"
            aria-atomic="true"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            transition={{ duration: DUR.fast }}
            className="fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-full border border-(--cf-border-strong) bg-(--cf-surface-muted) px-4 py-2 shadow-shadow-elevated backdrop-blur-md"
          >
            <Check className="h-3.5 w-3.5 text-accent-emerald" />
            <span className="text-sm text-(--cf-text-2)">{message}</span>
          </motion.div>
        ) : null}
      </AnimatePresence>
    );
  }

  if (presentation === "celebration") {
    return (
      <AnimatePresence>
        {open ? (
          <motion.div
            role="status"
            aria-live="polite"
            aria-atomic="true"
            initial={{ opacity: 0, x: 100 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 100 }}
            transition={{ duration: DUR.normal, ease: EASE.standard }}
            className="fixed right-4 top-20 z-50 max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl sm:right-5 sm:max-w-sm"
            style={{
              background: "var(--bg-glass)",
              backdropFilter: "blur(12px)",
              border: "1px solid var(--border-emphasis)",
              borderLeft: "4px solid var(--accent-amber)",
              boxShadow: "var(--shadow-modal)",
            }}
          >
            <div className="px-5 py-4">
              <p className="text-cf-body font-semibold" style={{ color: "var(--text-heading)" }}>
                {message}
              </p>
              {detail ? (
                <p className="mt-1 text-cf-label" style={{ color: "var(--accent-amber)" }}>
                  {detail}
                </p>
              ) : null}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    );
  }

  return (
    <AnimatePresence>
      {open ? (
        <div className="fixed bottom-5 right-5 z-[70] px-4">
          <motion.div
            role="status"
            aria-live="polite"
            aria-atomic="true"
            initial={{ x: 100, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 100, opacity: 0 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
            className={cn(
              "inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm shadow-(--cf-shadow-md) backdrop-blur-xl",
              tone === "success" &&
                "border-(--cf-success-border) bg-(--cf-success-soft)/80 text-(--cf-success-text)",
              tone === "error" &&
                "border-(--cf-danger-border) bg-(--cf-danger-soft)/80 text-(--cf-danger-text)",
              tone === "info" &&
                "border-(--cf-info-border) bg-(--cf-info-soft)/80 text-(--cf-info-text)"
            )}
          >
            {iconForTone(tone)}
            {message}
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>
  );
}
