"use client";

import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { cn } from "@/app/book/components/ui/cn";

type PersonalizationMeterProps = {
  percentage: number;
  onDismiss: () => void;
  onComplete: () => void;
  reducedMotion?: boolean;
};

export function PersonalizationMeter({
  percentage,
  onDismiss,
  onComplete,
  reducedMotion,
}: PersonalizationMeterProps) {
  const clamped = Math.min(100, Math.max(0, Math.round(percentage)));
  const isComplete = clamped >= 100;

  return (
    <motion.div
      initial={reducedMotion ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={reducedMotion ? undefined : { opacity: 0, height: 0, marginBottom: 0 }}
      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
      className="relative overflow-hidden rounded-2xl border border-(--cf-border-strong) bg-(--cf-surface-muted) p-5 backdrop-blur-lg"
    >
      <button
        type="button"
        aria-label="Dismiss personalization meter"
        onClick={onDismiss}
        className="absolute top-3 right-3 flex h-6 w-6 items-center justify-center rounded-full hover:bg-(--cf-surface-strong) text-(--cf-text-soft) transition-colors"
      >
        <X className="h-3.5 w-3.5" />
      </button>

      <div className="flex items-center gap-2">
        <span className={cn("text-sm", !reducedMotion && "animate-pulse")}>&#10024;</span>
        <span className="text-sm font-semibold text-(--cf-text-1)">
          {isComplete
            ? "Fully personalized!"
            : `Your reading experience: ${clamped}% personalized`}
        </span>
      </div>

      {/* Gradient progress bar */}
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-(--cf-surface-muted)">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${clamped}%` }}
          transition={reducedMotion ? { duration: 0 } : { duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          className={cn(
            "relative h-full rounded-full",
            isComplete
              ? "bg-gradient-to-r from-emerald-400 to-emerald-500"
              : "bg-gradient-to-r from-cyan-400 to-emerald-400"
          )}
        >
          {/* Shimmer overlay on the filled bar */}
          {!reducedMotion && !isComplete && (
            <span className="absolute inset-0 -translate-x-full animate-[shimmer_3s_ease-in-out_infinite] bg-gradient-to-r from-transparent via-white/20 to-transparent" />
          )}
          {/* Glow at the tip */}
          <span
            className="absolute right-0 top-0 h-full w-4 rounded-full"
            style={{
              background: isComplete
                ? "radial-gradient(circle at right, rgba(16,185,129,0.5), transparent)"
                : "radial-gradient(circle at right, rgba(34,211,238,0.5), transparent)",
            }}
          />
        </motion.div>
      </div>

      {!isComplete && (
        <button
          type="button"
          onClick={onComplete}
          className="group mt-2.5 inline-flex items-center gap-1 text-xs font-medium text-(--cf-accent) hover:underline transition-colors"
        >
          Complete your profile
          <span className="inline-block transition-transform group-hover:translate-x-1">
            &rarr;
          </span>
        </button>
      )}

      {/* Halfway milestone text */}
      <AnimatePresence>
        {clamped >= 50 && clamped < 100 && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mt-1 text-[11px] text-(--cf-text-soft)"
          >
            Halfway there!
          </motion.p>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
