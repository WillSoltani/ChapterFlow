"use client";

// Canonical shared segmented control (WS3-001).

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

type SegmentedControlOption<T extends string> = {
  value: T;
  label: string;
};

type SegmentedControlProps<T extends string> = {
  groupId: string;
  options: SegmentedControlOption<T>[];
  value: T;
  onChange: (value: T) => void;
  label?: string;
  reducedMotion?: boolean;
};

export function SegmentedControl<T extends string>({
  groupId,
  options,
  value,
  onChange,
  label,
  reducedMotion,
}: SegmentedControlProps<T>) {

  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="relative flex gap-0.5 rounded-xl bg-(--cf-surface-muted) p-[3px] backdrop-blur-sm border border-(--cf-border)"
    >
      {options.map((opt) => {
        const isSelected = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={isSelected}
            onClick={() => onChange(opt.value)}
            className={cn(
              "cf-pressable cf-focus relative z-10 rounded-md px-3 py-1.5 text-sm font-medium transition-colors duration-150",
              "min-h-[44px] min-w-[44px]",
              isSelected
                ? "text-(--cf-text-1) font-semibold"
                : "text-(--cf-text-3) hover:text-(--cf-text-2)"
            )}
          >
            {isSelected && (
              reducedMotion ? (
                <div className="absolute inset-0 rounded-md bg-(--cf-surface-strong) shadow-(--cf-shadow-sm) border border-transparent forced-colors:border-[Highlight]" />
              ) : (
                <motion.div
                  layoutId={groupId}
                  className="absolute inset-0 rounded-md bg-(--cf-surface-strong) shadow-(--cf-shadow-sm) border border-transparent forced-colors:border-[Highlight]"
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                />
              )
            )}
            <span className="relative z-10">{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
}
