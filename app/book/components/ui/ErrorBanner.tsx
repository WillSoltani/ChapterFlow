"use client";

import { AlertTriangle } from "lucide-react";
import { cn } from "@/app/book/components/ui/cn";

type ErrorBannerProps = {
  title?: string;
  message: string;
  onRetry?: () => void;
  className?: string;
};

export function ErrorBanner({
  title = "Something went wrong",
  message,
  onRetry,
  className,
}: ErrorBannerProps) {
  return (
    <div
      role="alert"
      className={cn("rounded-2xl border px-4 py-3", className)}
      style={{
        borderColor: "rgba(245, 158, 11, 0.24)",
        background: "rgba(245, 158, 11, 0.08)",
      }}
    >
      <p
        className="flex items-center gap-2 text-sm font-semibold"
        style={{ color: "var(--accent-amber)" }}
      >
        <AlertTriangle className="h-4 w-4" style={{ color: "var(--accent-amber)" }} />
        {title}
      </p>
      <p
        className="mt-1 text-sm"
        style={{ color: "var(--text-secondary)" }}
      >
        {message}
      </p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-3 cursor-pointer rounded-lg px-4 py-1.5 text-sm font-medium transition-colors hover:brightness-110"
          style={{
            background: "var(--accent-amber)",
            color: "var(--bg-base)",
          }}
        >
          Try again
        </button>
      )}
    </div>
  );
}
