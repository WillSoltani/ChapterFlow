"use client";

import { ProgressRing } from "../ui/ProgressRing";

interface DailyGoalRingProps {
  size?: number;
  strokeWidth?: number;
  progress: number;
}

/**
 * Compact single-ring daily-goal indicator (22px header dot).
 * Thin wrapper over the shared ProgressRing primitive — preserves the original
 * cyan-fill / track-stroke look, no center label, no completion glow, and the
 * 300ms-delayed draw-in. (Ease standardizes from "easeOut" to ProgressRing's
 * cubic-bezier(0.4,0,0.2,1); imperceptible at this size.)
 */
export function DailyGoalRing({
  size = 22,
  strokeWidth = 2.5,
  progress,
}: DailyGoalRingProps) {
  return (
    <ProgressRing
      percent={progress}
      size={size}
      strokeWidth={strokeWidth}
      color="var(--cf-accent)"
      trackColor="var(--cf-ring-track)"
      showLabel={false}
      showCompletionGlow={false}
      delay={300}
      ariaLabel={`Daily goal ${Math.round(progress)}% complete`}
    />
  );
}
