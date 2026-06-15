"use client";

import { ProgressRing as SharedProgressRing } from "@/components/ui/ProgressRing";

type ProgressRingProps = {
  size?: number;
  strokeWidth?: number;
  progress: number;
  trackColor?: string;
  fillColor?: string;
  className?: string;
};

/**
 * Badges "earned" ring. Thin wrapper over the shared
 * components/ui/ProgressRing so it inherits progressbar ARIA and
 * reduced-motion handling (OS media query + in-app toggle) instead of the
 * previous aria-hidden, off-token, always-animating reimplementation.
 * Defaults to the amber accent token (was the hardcoded #f59e0b).
 * New code should import @/components/ui/ProgressRing directly.
 */
export function ProgressRing({
  size = 36,
  strokeWidth = 3,
  progress,
  trackColor = "var(--cf-ring-track)",
  fillColor = "var(--accent-amber)",
  className,
}: ProgressRingProps) {
  return (
    <SharedProgressRing
      percent={progress}
      size={size}
      strokeWidth={strokeWidth}
      className={className}
      color={fillColor}
      trackColor={trackColor}
      showLabel={false}
      ariaLabel={`Badges earned: ${Math.round(Math.max(0, Math.min(100, progress)))}% complete`}
    />
  );
}
