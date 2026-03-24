"use client";

import { Minus, Plus } from "lucide-react";
import { cn } from "@/app/book/components/ui/cn";

type StepperProps = {
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step?: number;
  suffix?: string;
  label?: string;
};

export function Stepper({
  value,
  onChange,
  min,
  max,
  step = 1,
  suffix,
  label,
}: StepperProps) {
  const canDecrement = value > min;
  const canIncrement = value < max;

  return (
    <div className="flex items-center gap-1.5" role="group" aria-label={label}>
      <button
        type="button"
        aria-label="Decrease"
        disabled={!canDecrement}
        onClick={() => onChange(Math.max(min, value - step))}
        className={cn(
          "flex h-8 w-8 items-center justify-center rounded-lg border border-(--cf-border) transition-colors",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--cf-accent-border)",
          "min-h-[44px] min-w-[44px]",
          canDecrement
            ? "text-(--cf-text-2) hover:bg-(--cf-surface-muted)"
            : "cursor-not-allowed opacity-30 text-(--cf-text-soft)"
        )}
      >
        <Minus className="h-3.5 w-3.5" />
      </button>
      <span
        className="w-12 text-center text-sm font-semibold tabular-nums text-(--cf-text-1)"
        aria-live="polite"
      >
        {value}
        {suffix ? ` ${suffix}` : ""}
      </span>
      <button
        type="button"
        aria-label="Increase"
        disabled={!canIncrement}
        onClick={() => onChange(Math.min(max, value + step))}
        className={cn(
          "flex h-8 w-8 items-center justify-center rounded-lg border border-(--cf-border) transition-colors",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--cf-accent-border)",
          "min-h-[44px] min-w-[44px]",
          canIncrement
            ? "text-(--cf-text-2) hover:bg-(--cf-surface-muted)"
            : "cursor-not-allowed opacity-30 text-(--cf-text-soft)"
        )}
      >
        <Plus className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
