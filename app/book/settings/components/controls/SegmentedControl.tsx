"use client";

import { useId } from "react";
import { motion } from "framer-motion";
import { cn } from "@/app/book/components/ui/cn";

type SegmentedControlOption<T extends string> = {
  value: T;
  label: string;
};

type SegmentedControlProps<T extends string> = {
  options: SegmentedControlOption<T>[];
  value: T;
  onChange: (value: T) => void;
  label?: string;
};

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  label,
}: SegmentedControlProps<T>) {
  const groupId = useId();

  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="relative flex gap-0.5 rounded-xl bg-white/[0.04] p-[3px] backdrop-blur-sm border border-white/[0.06]"
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
                ? "text-white font-semibold"
                : "text-(--cf-text-3) hover:text-(--cf-text-2)"
            )}
          >
            {isSelected && (
              <motion.div
                layoutId={`seg-${groupId}`}
                className="absolute inset-0 rounded-[9px] bg-white/[0.1] shadow-[0_1px_3px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.06)]"
                transition={{ type: "spring", stiffness: 400, damping: 30 }}
              />
            )}
            <span className="relative z-10">{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
}
