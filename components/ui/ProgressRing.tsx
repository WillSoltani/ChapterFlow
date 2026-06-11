"use client";

import { motion, useReducedMotion } from "framer-motion";
import type { ReactNode } from "react";

export interface ProgressRingProps {
  /** 0–100 */
  percent: number;
  /** Diameter in px */
  size?: number;
  /** Stroke width in px */
  strokeWidth?: number;
  /** Show the percentage label in the center (ignored when `children` is set) */
  showLabel?: boolean;
  /** Delay before the fill animation starts (ms) */
  delay?: number;
  className?: string;
  /** Progress stroke color (any CSS color / token var). Default brand cyan. */
  color?: string;
  /** Track (unfilled) stroke color. */
  trackColor?: string;
  /** Center label color. */
  labelColor?: string;
  /** Glow color applied at 100%. Defaults to `color`. */
  glowColor?: string;
  /** Apply a drop-shadow glow when complete (default true). */
  showCompletionGlow?: boolean;
  /** Render decoratively (aria-hidden) instead of role="progressbar". */
  decorative?: boolean;
  /** Accessible label for the progressbar. */
  ariaLabel?: string;
  /** Custom center content (overrides the percentage label). */
  children?: ReactNode;
}

/**
 * Shared circular progress ring — promoted from components/library/ProgressRing.
 * role="progressbar" + ARIA, reduced-motion-aware spring fill, completion glow,
 * fully parameterized (size / stroke / color tokens / decorative / center slot).
 *
 * Honors reduced motion via framer's useReducedMotion(), which MotionProvider
 * wires to BOTH the OS prefers-reduced-motion media query AND the in-app
 * reduce-motion toggle.
 */
export function ProgressRing({
  percent,
  size = 64,
  strokeWidth = 5,
  showLabel = true,
  delay = 0,
  className = "",
  color = "var(--accent-cyan)",
  trackColor = "var(--cf-ring-track)",
  labelColor = "var(--text-heading)",
  glowColor,
  showCompletionGlow = true,
  decorative = false,
  ariaLabel,
  children,
}: ProgressRingProps) {
  const prefersReduced = useReducedMotion();
  const clamped = Math.max(0, Math.min(percent, 100));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - clamped / 100);
  const isComplete = clamped >= 100;

  const a11y = decorative
    ? ({ "aria-hidden": true } as const)
    : ({
        role: "progressbar",
        "aria-valuenow": Math.round(clamped),
        "aria-valuemin": 0,
        "aria-valuemax": 100,
        "aria-label": ariaLabel ?? `Progress: ${Math.round(clamped)}%`,
      } as const);

  return (
    <div
      className={`relative inline-flex items-center justify-center ${className}`}
      style={{ width: size, height: size }}
      {...a11y}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={trackColor}
          strokeWidth={strokeWidth}
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: prefersReduced ? offset : circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{
            duration: prefersReduced ? 0 : 0.8,
            ease: [0.4, 0, 0.2, 1],
            delay: prefersReduced ? 0 : delay / 1000,
          }}
          style={{
            filter:
              isComplete && showCompletionGlow
                ? `drop-shadow(0 0 6px ${glowColor ?? color})`
                : undefined,
          }}
        />
      </svg>

      {children ?? (
        showLabel && (
          <span
            className="absolute font-(family-name:--font-mono) font-semibold"
            style={{
              fontSize: size < 48 ? 10 : size < 72 ? 13 : 16,
              color: labelColor,
            }}
          >
            {Math.round(clamped)}%
          </span>
        )
      )}
    </div>
  );
}
