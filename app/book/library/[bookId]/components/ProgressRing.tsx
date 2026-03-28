"use client";

import { motion, useReducedMotion } from "framer-motion";

type ProgressRingProps = {
  percent: number;
  size?: number;
  strokeWidth?: number;
  className?: string;
};

export function ProgressRing({
  percent,
  size = 56,
  strokeWidth = 4,
  className = "",
}: ProgressRingProps) {
  const prefersReducedMotion = useReducedMotion();
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(100, percent));
  const offset = circumference - (clamped / 100) * circumference;

  return (
    <div
      className={`relative inline-flex items-center justify-center ${className}`}
      style={{ width: size, height: size }}
      role="progressbar"
      aria-valuenow={Math.round(clamped)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={`Book progress ${Math.round(clamped)}% complete`}
    >
      <svg
        width={size}
        height={size}
        style={{ transform: "rotate(-90deg)", filter: "drop-shadow(0 0 6px color-mix(in srgb, var(--accent-cyan) 30%, transparent))" }}
        className="overflow-visible"
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--cf-ring-track)"
          strokeWidth={strokeWidth}
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--accent-cyan)"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={
            prefersReducedMotion
              ? { duration: 0 }
              : { duration: 0.8, ease: "easeOut" as const, delay: 0.5 }
          }
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-sm font-semibold" style={{ color: "var(--accent-cyan)" }}>
        {Math.round(clamped)}%
      </span>
    </div>
  );
}
