"use client";

import { motion, useReducedMotion } from "framer-motion";

interface DailyGoalRingProps {
  size?: number;
  strokeWidth?: number;
  progress: number;
  todayPulse?: boolean;
}

export function DailyGoalRing({
  size = 22,
  strokeWidth = 2.5,
  progress,
  todayPulse = false,
}: DailyGoalRingProps) {
  const prefersReducedMotion = useReducedMotion();
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (Math.min(progress, 100) / 100) * circumference;

  return (
    <div
      className="relative inline-flex items-center justify-center"
      style={{ width: size, height: size }}
      role="progressbar"
      aria-valuenow={Math.round(progress)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={`Daily goal ${Math.round(progress)}% complete`}
    >
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth={strokeWidth}
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#7C3AED"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={
            prefersReducedMotion
              ? { duration: 0 }
              : { duration: 0.8, ease: "easeOut", delay: 0.3 }
          }
        />
      </svg>
      {todayPulse && !prefersReducedMotion && progress < 100 && (
        <motion.div
          className="absolute inset-0 rounded-full"
          style={{ border: "1px solid rgba(124, 58, 237, 0.3)" }}
          animate={{ scale: [1, 1.3, 1], opacity: [0.6, 0, 0.6] }}
          transition={{ duration: 2, repeat: Infinity }}
        />
      )}
    </div>
  );
}
