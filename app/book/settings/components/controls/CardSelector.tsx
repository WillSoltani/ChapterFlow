"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Check } from "lucide-react";
import { cn } from "@/app/book/components/ui/cn";

type CardOption<T extends string> = {
  value: T;
  emoji: string;
  label: string;
  description: string;
  tint?: string;
  selectedTint?: string;
  badge?: string;
  prominentValue?: string;
};

type CardSelectorProps<T extends string> = {
  options: CardOption<T>[];
  value: T;
  onChange: (value: T) => void;
  label?: string;
  columns?: 2 | 3 | 4;
};

export function CardSelector<T extends string>({
  options,
  value,
  onChange,
  label,
  columns = 3,
}: CardSelectorProps<T>) {
  const gridClass =
    columns === 4
      ? "grid-cols-2 sm:grid-cols-4"
      : columns === 2
        ? "grid-cols-1 sm:grid-cols-2"
        : "grid-cols-1 sm:grid-cols-3";

  return (
    <div role="radiogroup" aria-label={label} className={cn("grid gap-3", gridClass)}>
      {options.map((opt) => {
        const isSelected = value === opt.value;
        return (
          <motion.button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={isSelected}
            onClick={() => onChange(opt.value)}
            whileTap={{ scale: 0.97 }}
            whileHover={!isSelected ? { scale: 1.01, borderColor: "rgba(255,255,255,0.12)" } : undefined}
            animate={isSelected ? { scale: 1.02 } : { scale: 1 }}
            transition={{ type: "spring", stiffness: 400, damping: 25 }}
            className={cn(
              "relative flex flex-col items-start gap-1 rounded-2xl border p-4 text-left transition-shadow duration-200",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--cf-accent-border) focus-visible:ring-offset-2 focus-visible:ring-offset-(--cf-page-bg)",
              "min-h-[44px]",
              opt.tint && `bg-gradient-to-br ${opt.tint}`,
              isSelected
                ? cn(
                    "border-white/20",
                    opt.selectedTint ?? "shadow-[0_0_20px_rgba(79,139,255,0.15)]"
                  )
                : "border-(--cf-border) hover:border-(--cf-border-strong)"
            )}
          >
            {/* Checkmark badge */}
            <AnimatePresence>
              {isSelected && !opt.badge && (
                <motion.div
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0, opacity: 0 }}
                  transition={{ type: "spring", stiffness: 500, damping: 25 }}
                  className="absolute top-2.5 right-2.5 flex h-5 w-5 items-center justify-center rounded-full bg-(--cf-accent) text-white shadow-[0_0_8px_rgba(79,139,255,0.4)]"
                >
                  <Check className="h-3 w-3" strokeWidth={3} />
                </motion.div>
              )}
            </AnimatePresence>

            {/* Recommended / badge */}
            {opt.badge && (
              <span className={cn(
                "absolute top-2.5 right-2.5 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                isSelected
                  ? "bg-(--cf-accent) text-white"
                  : "bg-(--cf-accent-soft) text-(--cf-accent) animate-pulse"
              )}>
                {isSelected ? "✓" : opt.badge}
              </span>
            )}

            <span className="text-lg">{opt.emoji}</span>

            {/* Prominent value (e.g., "5 min") */}
            {opt.prominentValue && (
              <span className="text-xl font-bold tabular-nums text-(--cf-text-1)">
                {opt.prominentValue}
              </span>
            )}

            <span className="text-sm font-semibold text-(--cf-text-1)">
              {opt.label}
            </span>
            <span className="text-xs leading-relaxed text-(--cf-text-3)">
              {opt.description}
            </span>
          </motion.button>
        );
      })}
    </div>
  );
}
