"use client";

import { motion } from "framer-motion";
import { cn } from "@/app/book/components/ui/cn";

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
              "relative z-10 rounded-[9px] px-3 py-1.5 text-sm font-medium transition-colors duration-150",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--cf-accent-border) focus-visible:ring-offset-1 focus-visible:ring-offset-(--cf-page-bg)",
              "min-h-[44px] min-w-[44px]",
              isSelected
                ? "text-(--cf-text-1) font-semibold"
                : "text-(--cf-text-3) hover:text-(--cf-text-2)"
            )}
          >
            {isSelected && (
              reducedMotion ? (
                <div className="absolute inset-0 rounded-[9px] bg-(--cf-surface) shadow-(--cf-shadow-sm)" />
              ) : (
                <motion.div
                  layoutId={groupId}
                  className="absolute inset-0 rounded-[9px] bg-(--cf-surface) shadow-(--cf-shadow-sm)"
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
