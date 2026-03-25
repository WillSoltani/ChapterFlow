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
        style={{ transform: "rotate(-90deg)" }}
        className="overflow-visible"
      >
        {/* Track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth={strokeWidth}
        />
        {/* Fill — emerald */}
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#34D399"
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
      {/* Center label */}
      <span className="absolute inset-0 flex items-center justify-center text-sm font-semibold text-emerald-400">
        {Math.round(clamped)}%
      </span>
    </div>
  );
}
