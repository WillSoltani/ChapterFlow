"use client";

import { type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { AnimatedNumber } from "./AnimatedNumber";

export function StatCard({
  icon,
  label,
  value,
  helper,
  trend,
  animate: shouldAnimate,
  numericValue,
  formatFn,
  performanceLevel,
  accentColor,
  valueColorClass,
}: {
  icon: ReactNode;
  label: string;
  value: ReactNode;
  helper?: string | undefined;
  trend?: ReactNode | undefined;
  animate?: boolean | undefined;
  numericValue?: number | undefined;
  formatFn?: ((v: number) => string) | undefined;
  performanceLevel?: "strong" | "active" | "zero" | undefined;
  accentColor?: string | undefined;
  valueColorClass?: string | undefined;
}) {
  const isHighlight = performanceLevel === "strong";
  const bgTint = isHighlight
    ? "bg-(--bg-surface-2)"
    : performanceLevel === "zero"
      ? "bg-linear-to-br from-blue-500/[0.02] to-transparent"
      : "";

  return (
    <div
      className={cn("rounded-3xl border border-(--cf-border) bg-(--cf-surface) p-4 shadow-shadow-card", bgTint)}
      style={isHighlight && accentColor ? { borderLeft: `3px solid ${accentColor}` } : undefined}
    >
      <div className="flex items-center justify-between gap-3">
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-(--cf-border) bg-(--cf-surface-muted) text-(--cf-text-2)">
          {icon}
        </span>
        {trend ? <span className="text-xs text-(--cf-text-3)">{trend}</span> : null}
      </div>
      <p className="mt-4 text-cf-caption uppercase tracking-[0.22em] text-(--cf-text-3)">{label}</p>
      <p className={cn("mt-2 text-3xl font-semibold tracking-tight", valueColorClass || "text-(--cf-text-1)")}>
        {shouldAnimate && numericValue != null ? (
          <AnimatedNumber value={numericValue} formatFn={formatFn} />
        ) : (
          value
        )}
      </p>
      {helper ? <p className="mt-2 text-sm text-(--cf-text-3)">{helper}</p> : null}
    </div>
  );
}
