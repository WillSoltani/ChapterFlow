"use client";

import { motion, useReducedMotion } from "framer-motion";
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

export function ProgressRing({
  percent,
  size = 64,
  strokeWidth = 5,
  showLabel = true,
  delay = 0,
  className = "",
}: ProgressRingProps) {
  const prefersReduced = useReducedMotion();
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - Math.min(percent, 100) / 100);
  const color = getProgressColor(percent);
  const isComplete = percent >= 100;

  return (
    <div
      className={`relative inline-flex items-center justify-center ${className}`}
      style={{ width: size, height: size }}
      role="progressbar"
      aria-valuenow={percent}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={`Reading progress: ${percent}% complete`}
    >
      <svg width={size} height={size} className="-rotate-90">
        {/* Background ring */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth={strokeWidth}
        />
        {/* Progress ring */}
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
            filter: isComplete
              ? "drop-shadow(0 0 6px var(--accent-gold))"
              : undefined,
          }}
        />
      </svg>

      {/* Label */}
      {showLabel && (
        <span
          className="absolute font-(family-name:--font-mono) font-semibold"
          style={{
            fontSize: size < 48 ? 10 : size < 72 ? 13 : 16,
            color: isComplete ? "var(--accent-gold)" : "var(--text-heading)",
          }}
        >
          {percent}%
        </span>
      )}
    </div>
  );
}
