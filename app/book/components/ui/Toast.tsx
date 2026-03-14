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
          "inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm shadow-[0_16px_34px_rgba(2,6,23,0.5)]",
          tone === "success" && "border-emerald-300/35 bg-emerald-500/16 text-emerald-100",
          tone === "error" && "border-rose-300/35 bg-rose-500/16 text-rose-100",
          tone === "info" && "border-sky-300/35 bg-sky-500/16 text-sky-100"
        )}
      >
        {iconForTone(tone)}
        {message}
      </div>
    </div>
  );
}
