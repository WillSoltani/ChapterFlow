"use client";

import type { ButtonHTMLAttributes, HTMLAttributes } from "react";
import { cn } from "@/app/book/components/ui/cn";

type ChipTone = "neutral" | "sky" | "emerald" | "amber" | "rose";

const toneClass: Record<ChipTone, string> = {
  neutral: "border-(--cf-border) bg-(--cf-surface-muted) text-(--cf-text-2)",
  sky: "border-(--cf-accent-border) bg-(--cf-accent-soft) text-(--cf-accent)",
  emerald: "border-(--cf-success-border) bg-(--cf-success-soft) text-(--cf-success-text)",
  amber: "border-(--cf-warning-border) bg-(--cf-warning-soft) text-(--cf-warning-text)",
  rose: "border-(--cf-danger-border) bg-(--cf-danger-soft) text-(--cf-danger-text)",
};

type BaseProps = {
  tone?: ChipTone;
  active?: boolean;
  className?: string;
};

export function Chip({ tone = "neutral", className, ...props }: HTMLAttributes<HTMLSpanElement> & BaseProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium",
        toneClass[tone],
        className
      )}
      {...props}
    />
  );
}

export function ChipButton({
  tone = "neutral",
  active,
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & BaseProps) {
  return (
    <button
      className={cn(
        "inline-flex items-center rounded-full border px-3 py-1.5 text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--cf-accent-border)",
        toneClass[tone],
        active && "shadow-(--cf-focus-ring)",
        !active && "opacity-85 hover:opacity-100",
        className
      )}
      {...props}
    />
  );
}
