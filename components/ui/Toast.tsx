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
  tone?: ToastTone | undefined;
  detail?: string | undefined;
  presentation?: ToastPresentation | undefined;
  /** Auto-dismiss after this many ms (0 = no auto-dismiss). Default 3000. */
  autoDismissMs?: number | undefined;
  /** Called when the toast should close (auto-dismiss or user action). */
  onClose?: (() => void) | undefined;
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

  // Below md the fixed tab bar owns the bottom edge, so toasts sit above it.
  const aboveTabBar = "bottom-[calc(5.5rem+env(safe-area-inset-bottom))]";

  // The live region stays mounted (outside AnimatePresence) so the text change is
  // announced; the animated node is purely visual.
  const liveRegion = (
    <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
      {open ? [message, detail].filter(Boolean).join(". ") : ""}
    </div>
  );

  if (presentation === "saved") {
    return (
      <>
        {liveRegion}
        <AnimatePresence>
          {open ? (
            <motion.div
              aria-hidden="true"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              transition={{ duration: DUR.fast }}
              className={cn(
                "fixed left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-full border border-(--cf-border-strong) bg-(--cf-surface-muted) px-4 py-2 shadow-shadow-elevated backdrop-blur-md md:bottom-6",
                aboveTabBar
              )}
            >
              <Check className="h-3.5 w-3.5 text-accent-emerald" />
              <span className="text-sm text-(--cf-text-2)">{message}</span>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </>
    );
  }

  if (presentation === "celebration") {
    return (
      <>
        {liveRegion}
        <AnimatePresence>
          {open ? (
            <motion.div
              aria-hidden="true"
              initial={{ opacity: 0, x: 100 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 100 }}
              transition={{ duration: DUR.normal, ease: EASE.standard }}
              className="fixed right-4 top-20 z-50 max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-(--cf-border-strong) border-l-4 border-l-(--cf-warning-text) bg-(--cf-surface) shadow-(--cf-shadow-lg) backdrop-blur-md sm:right-5 sm:max-w-sm"
            >
              <div className="px-5 py-4">
                <p className="text-cf-body font-semibold text-(--cf-text-1)">{message}</p>
                {detail ? (
                  <p className="mt-1 text-cf-label text-(--cf-warning-text)">{detail}</p>
                ) : null}
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </>
    );
  }

  return (
    <>
      {liveRegion}
      <AnimatePresence>
        {open ? (
          <div className={cn("fixed right-5 z-[70] px-4 md:bottom-5", aboveTabBar)} aria-hidden="true">
            <motion.div
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
    </>
  );
}
