"use client";

import { cn } from "@/lib/utils";

export function ProfileSkeletonShimmer({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "animate-shimmer rounded-2xl bg-(--cf-surface-muted)",
        className,
      )}
      aria-hidden="true"
    />
  );
}
