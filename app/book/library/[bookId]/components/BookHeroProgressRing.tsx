"use client";

import { ProgressRing as SharedProgressRing } from "@/components/ui/ProgressRing";

type BookHeroProgressRingProps = {
  percent: number;
  size?: number;
  strokeWidth?: number;
  className?: string;
};

/**
 * Book-hero reading-progress ring. Thin wrapper over the shared
 * components/ui/ProgressRing that preserves this route's cyan treatment
 * (cyan stroke + cyan center label + completion glow, 500ms fill delay).
 * Reduced-motion (OS + in-app toggle) and progressbar ARIA come from the
 * shared primitive. New code should import @/components/ui/ProgressRing.
 */
export function BookHeroProgressRing({
  percent,
  size = 56,
  strokeWidth = 4,
  className = "",
}: BookHeroProgressRingProps) {
  return (
    <SharedProgressRing
      percent={percent}
      size={size}
      strokeWidth={strokeWidth}
      className={className}
      delay={500}
      color="var(--accent-cyan)"
      labelColor="var(--accent-cyan)"
      ariaLabel={`Book progress ${Math.round(Math.max(0, Math.min(100, percent)))}% complete`}
    />
  );
}
