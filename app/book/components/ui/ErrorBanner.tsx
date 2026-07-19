"use client";

import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

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
        borderColor: "var(--cf-danger-border)",
        background: "var(--cf-danger-bg)",
      }}
    >
      <p
        className="flex items-center gap-2 text-sm font-semibold"
        style={{ color: "var(--cf-danger-text)" }}
      >
        <AlertTriangle className="h-4 w-4" style={{ color: "var(--cf-danger-text)" }} />
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
            background: "var(--cf-danger-text)",
            color: "var(--cf-accent-contrast)",
          }}
        >
          Try again
        </button>
      )}
    </div>
  );
}
