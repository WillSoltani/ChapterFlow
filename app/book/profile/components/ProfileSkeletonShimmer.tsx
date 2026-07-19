"use client";

import { cn } from "@/lib/utils";

export function ProfileSkeletonShimmer({ className }: { className?: string }) {
  return (
    <div className={cn("animate-pulse rounded-2xl bg-(--cf-surface-muted)", className)}>
      <div className="h-full w-full rounded-2xl bg-linear-to-r from-transparent via-(--cf-border) to-transparent" style={{ animation: "shimmer 1.5s infinite", backgroundSize: "200% 100%" }} />
      <style>{`@keyframes shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }`}</style>
    </div>
  );
}
