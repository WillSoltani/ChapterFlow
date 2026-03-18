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
        "rounded-2xl border border-(--cf-danger-border) bg-(--cf-danger-soft) px-4 py-3",
        className
      )}
    >
      <p className="flex items-center gap-2 text-sm font-semibold text-(--cf-danger-text)">
        <AlertTriangle className="h-4 w-4 text-(--cf-danger-text)" />
        {title}
      </p>
      <p className="mt-1 text-sm text-(--cf-danger-text)/90">{message}</p>
    </div>
  );
}
