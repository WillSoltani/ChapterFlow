"use client";

import { motion, useReducedMotion } from "framer-motion";

interface StreakBadgeProps {
  count: number;
  isNewUser?: boolean;
}

export function StreakBadge({ count, isNewUser = false }: StreakBadgeProps) {
  const prefersReducedMotion = useReducedMotion();

  if (isNewUser || count === 0) {
    return (
      <div className="flex items-center gap-1.5">
        <span className="text-sm" style={{ color: "var(--cf-text-soft)" }}>
          Start your streak today
        </span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5" aria-label={`${count} day streak`}>
      <span className="relative inline-flex" aria-hidden="true">
        <motion.span
          className="text-lg leading-none"
          animate={
            prefersReducedMotion
              ? undefined
              : { scale: [1, 1.1, 1], opacity: [1, 0.85, 1] }
          }
          transition={
            prefersReducedMotion
              ? undefined
              : { duration: 2, repeat: Infinity, ease: "easeInOut" }
          }
          style={{ color: "var(--accent-gold)" }}
        >
          🔥
        </motion.span>
        {/* Glow behind flame */}
        <span
          className="absolute inset-0 rounded-full blur-[6px]"
          style={{ background: "rgba(245,158,11,0.2)" }}
        />
      </span>
      <span
        className="text-sm font-semibold tabular-nums"
        style={{ color: "var(--cf-text-1)" }}
      >
        {count}
      </span>
    </div>
  );
}
