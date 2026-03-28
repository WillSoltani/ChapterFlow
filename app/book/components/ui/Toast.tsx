"use client";

import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, Info, XCircle } from "lucide-react";
import { cn } from "@/app/book/components/ui/cn";

export type ToastTone = "info" | "success" | "error";

type ToastProps = {
  open: boolean;
  message: string;
  tone?: ToastTone;
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
  autoDismissMs = 3000,
  onClose,
}: ToastProps) {
  useEffect(() => {
    if (!open || autoDismissMs <= 0 || !onClose) return;
    const id = setTimeout(onClose, autoDismissMs);
    return () => clearTimeout(id);
  }, [open, autoDismissMs, onClose]);

  return (
    <AnimatePresence>
      {open ? (
        <div className="fixed bottom-5 right-5 z-[70] px-4">
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
  );
}
