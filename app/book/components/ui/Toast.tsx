"use client";

import { CheckCircle2, Info, XCircle } from "lucide-react";
import { cn } from "@/app/book/components/ui/cn";

export type ToastTone = "info" | "success" | "error";

type ToastProps = {
  open: boolean;
  message: string;
  tone?: ToastTone;
};

function iconForTone(tone: ToastTone) {
  if (tone === "success") return <CheckCircle2 className="h-4 w-4" />;
  if (tone === "error") return <XCircle className="h-4 w-4" />;
  return <Info className="h-4 w-4" />;
}

export function Toast({ open, message, tone = "info" }: ToastProps) {
  if (!open) return null;

  return (
    <div className="fixed bottom-5 left-1/2 z-[70] -translate-x-1/2 px-4">
      <div
        className={cn(
          "inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm shadow-(--cf-shadow-md) backdrop-blur-xl",
          tone === "success" &&
            "border-(--cf-success-border) bg-(--cf-success-soft) text-(--cf-success-text)",
          tone === "error" &&
            "border-(--cf-danger-border) bg-(--cf-danger-soft) text-(--cf-danger-text)",
          tone === "info" &&
            "border-(--cf-info-border) bg-(--cf-info-soft) text-(--cf-info-text)"
        )}
      >
        {iconForTone(tone)}
        {message}
      </div>
    </div>
  );
}
