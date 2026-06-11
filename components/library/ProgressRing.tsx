"use client";

import { ProgressRing as SharedProgressRing } from "@/components/ui/ProgressRing";
import { getProgressColor } from "./libraryData";

interface ProgressRingProps {
  /** 0–100 */
  percent: number;
  /** Diameter in px */
  size?: number;
  /** Stroke width in px */
  strokeWidth?: number;
  /** Show percentage text inside */
  showLabel?: boolean;
  /** Delay before the fill animation starts (ms) */
  delay?: number;
  className?: string;
}

/**
 * Library reading-progress ring. Thin wrapper over the shared
 * components/ui/ProgressRing that injects the dynamic per-percent color
 * (getProgressColor) and the gold completion treatment. Kept in place so
 * existing `./ProgressRing` imports keep working; new code should import the
 * shared primitive from @/components/ui/ProgressRing directly.
 */
export function ProgressRing(props: ProgressRingProps) {
  const isComplete = props.percent >= 100;
  return (
    <SharedProgressRing
      {...props}
      color={getProgressColor(props.percent)}
      glowColor="var(--accent-gold)"
      labelColor={isComplete ? "var(--cf-amber-text)" : "var(--text-heading)"}
      ariaLabel={`Reading progress: ${props.percent}% complete`}
    />
  );
}
