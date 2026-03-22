"use client";

import { useReducedMotion } from "framer-motion";
import { FlameIcon } from "@/components/ui/FlameIcon";

interface StreakBadgeProps {
  count: number;
  isNewUser?: boolean;
}

export function StreakBadge({ count, isNewUser = false }: StreakBadgeProps) {
  const prefersReducedMotion = useReducedMotion();

  if (isNewUser || count === 0) {
    return (
      <div className="flex items-center gap-1.5">
        <span
          className="text-sm"
          style={{ color: "#A0A0B8" }}
        >
          Start your streak today
        </span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1" aria-label={`${count} day streak`}>
      <span aria-hidden="true">
        <FlameIcon size={18} className={prefersReducedMotion ? "" : "flame-pulse"} />
      </span>
      <span
        className="text-sm font-semibold tabular-nums"
        style={{ color: "#F59E0B" }}
      >
        {count}
      </span>
    </div>
  );
}
