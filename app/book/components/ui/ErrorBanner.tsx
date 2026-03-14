"use client";

import { AlertTriangle } from "lucide-react";
import { cn } from "@/app/book/components/ui/cn";

type ErrorBannerProps = {
  title?: string;
  message: string;
  className?: string;
};

export function ErrorBanner({
  title = "Something went wrong",
  message,
  className,
}: ErrorBannerProps) {
  return (
    <div
      role="alert"
      className={cn(
        "rounded-2xl border border-rose-400/35 bg-rose-500/10 px-4 py-3 text-rose-100",
        className
      )}
    >
      <p className="flex items-center gap-2 text-sm font-semibold">
        <AlertTriangle className="h-4 w-4" />
        {title}
      </p>
      <p className="mt-1 text-sm text-rose-100/90">{message}</p>
    </div>
  );
}
