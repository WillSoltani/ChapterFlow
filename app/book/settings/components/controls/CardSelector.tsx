"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Check } from "lucide-react";
import { cn } from "@/app/book/components/ui/cn";

/** Personality gradient lookup by card label keyword */
const PERSONALITY_GRADIENTS: Record<string, string> = {
  "Quick Learner": "linear-gradient(90deg, var(--accent-cyan), #38BDF8)",
  "Balanced Reader": "linear-gradient(90deg, var(--accent-emerald), #14B8A6)",
  "Deep Diver": "linear-gradient(90deg, var(--accent-amber), #F97316)",
};

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
        const personalityGradient = PERSONALITY_GRADIENTS[opt.label];
        return (
          <motion.button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={isSelected}
            onClick={() => onChange(opt.value)}
            whileTap={{ scale: 0.97 }}
            whileHover={!isSelected ? { scale: 1.01, borderColor: "var(--cf-border-strong)" } : undefined}
            animate={isSelected ? { scale: 1.02 } : { scale: 1 }}
            transition={{ type: "spring", stiffness: 400, damping: 25 }}
            className={cn(
              "relative flex flex-col items-start gap-1 rounded-2xl border p-4 text-left transition-all duration-200 overflow-hidden",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--cf-accent-border) focus-visible:ring-offset-2 focus-visible:ring-offset-(--cf-page-bg)",
              "min-h-[44px] bg-(--cf-surface)",
              isSelected
                ? cn(
                    "border-2",
                    opt.selectedTint ?? "border-(--cf-accent-border) shadow-[0_0_20px_var(--cf-accent-shadow)]"
                  )
                : "border-(--cf-border) hover:border-(--cf-border-strong) hover:bg-(--cf-surface-muted)"
            )}
          >
            {/* Personality gradient strip at the top */}
            {personalityGradient && (
              <span
                className={cn(
                  "absolute inset-x-0 top-0 rounded-t-2xl",
                  isSelected ? "h-1.5" : "h-1"
                )}
                style={{ background: personalityGradient }}
              />
            )}

            {/* Checkmark badge */}
            <AnimatePresence>
              {isSelected && !opt.badge && (
                <motion.div
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0, opacity: 0 }}
                  transition={{ type: "spring", stiffness: 500, damping: 25 }}
                  className="absolute top-2.5 right-2.5 flex h-5 w-5 items-center justify-center rounded-full bg-(--cf-accent) text-(--cf-accent-contrast) shadow-[0_0_8px_var(--cf-accent-shadow)]"
                >
                  <Check className="h-3 w-3" strokeWidth={3} />
                </motion.div>
              )}
            </AnimatePresence>

            {/* Recommended / badge */}
            {opt.badge && (
              <span className={cn(
                "absolute top-2 right-2 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
                isSelected
                  ? "bg-(--cf-accent) text-(--cf-accent-contrast)"
                  : "bg-(--cf-accent-soft) text-(--cf-accent) animate-pulse"
              )}>
                {isSelected ? "\u2713" : opt.badge}
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
