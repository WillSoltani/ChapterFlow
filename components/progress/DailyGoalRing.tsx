"use client";

import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";

interface DailyGoalRingProps {
  completedMinutes: number;
  targetMinutes: number;
  stepsCompleted: number;
  totalSteps: number;
  /** Whether user browsed a book today but hasn't started reading */
  hasEndowedProgress?: boolean;
}

// Color constants
const CYAN = "#38BDF8";
const CYAN_TRACK = "rgba(56,189,248,0.15)";
const PURPLE = "#A78BFA";
const PURPLE_TRACK = "rgba(167,139,250,0.15)";

export function DailyGoalRing({
  completedMinutes,
  targetMinutes,
  stepsCompleted,
  totalSteps,
  hasEndowedProgress = false,
}: DailyGoalRingProps) {
  const prefersReduced = useReducedMotion();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const outerPercent = targetMinutes > 0
    ? Math.min(100, (completedMinutes / targetMinutes) * 100)
    : 0;
  const innerPercent = totalSteps > 0
    ? Math.min(100, (stepsCompleted / totalSteps) * 100)
    : 0;

  // Endowed progress: show 5% if user browsed but hasn't read
  const effectiveOuterPercent =
    outerPercent === 0 && hasEndowedProgress ? 5 : outerPercent;

  const isGoalComplete = effectiveOuterPercent >= 100;
  const remaining = Math.max(0, targetMinutes - completedMinutes);

  // SVG dimensions — responsive
  const desktopSize = 220;
  const mobileSize = 180;
  const outerStroke = 12;
  const innerStroke = 10;
  const gap = 16;

  function renderRing(
    size: number,
    containerClass: string
  ) {
    const outerRadius = (size - outerStroke) / 2;
    const outerCircumference = 2 * Math.PI * outerRadius;
    const outerOffset =
      outerCircumference * (1 - effectiveOuterPercent / 100);

    const innerRadius = outerRadius - gap;
    const innerCircumference = 2 * Math.PI * innerRadius;
    const innerOffset =
      innerCircumference * (1 - innerPercent / 100);

    const center = size / 2;

    return (
      <div
        className={`relative inline-flex items-center justify-center ${containerClass}`}
        style={{ width: size, height: size }}
        role="progressbar"
        aria-valuenow={Math.round(effectiveOuterPercent)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`Daily goal: ${completedMinutes} of ${targetMinutes} minutes completed. ${stepsCompleted} of ${totalSteps} learning steps done today.`}
      >
        <svg width={size} height={size} className="-rotate-90">
          {/* Outer track */}
          <circle
            cx={center}
            cy={center}
            r={outerRadius}
            fill="none"
            stroke={CYAN_TRACK}
            strokeWidth={outerStroke}
          />
          {/* Outer progress */}
          <motion.circle
            cx={center}
            cy={center}
            r={outerRadius}
            fill="none"
            stroke={CYAN}
            strokeWidth={outerStroke}
            strokeLinecap="round"
            strokeDasharray={outerCircumference}
            initial={{
              strokeDashoffset: prefersReduced
                ? outerOffset
                : outerCircumference,
            }}
            animate={{
              strokeDashoffset: mounted ? outerOffset : outerCircumference,
            }}
            transition={{
              duration: prefersReduced ? 0 : 1,
              ease: [0.4, 0, 0.2, 1],
              delay: prefersReduced ? 0 : 0.15,
            }}
            style={{
              filter: isGoalComplete
                ? `drop-shadow(0 0 8px ${CYAN})`
                : undefined,
            }}
          />

          {/* Inner track */}
          <circle
            cx={center}
            cy={center}
            r={innerRadius}
            fill="none"
            stroke={PURPLE_TRACK}
            strokeWidth={innerStroke}
          />
          {/* Inner progress */}
          <motion.circle
            cx={center}
            cy={center}
            r={innerRadius}
            fill="none"
            stroke={PURPLE}
            strokeWidth={innerStroke}
            strokeLinecap="round"
            strokeDasharray={innerCircumference}
            initial={{
              strokeDashoffset: prefersReduced
                ? innerOffset
                : innerCircumference,
            }}
            animate={{
              strokeDashoffset: mounted ? innerOffset : innerCircumference,
            }}
            transition={{
              duration: prefersReduced ? 0 : 1,
              ease: [0.4, 0, 0.2, 1],
              delay: prefersReduced ? 0 : 0.35,
            }}
          />
        </svg>

        {/* Center text */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          {isGoalComplete ? (
            <motion.span
              className="font-(family-name:--font-display) text-2xl font-bold"
              style={{ color: CYAN }}
              initial={{ scale: prefersReduced ? 1 : 0.8 }}
              animate={{ scale: 1 }}
              transition={{ delay: 1.2, type: "spring", stiffness: 300 }}
            >
              Done!
            </motion.span>
          ) : (
            <span
              className="font-(family-name:--font-display) text-2xl font-bold"
              style={{ color: "var(--text-heading)" }}
            >
              {remaining}m
            </span>
          )}
          <span
            className="mt-0.5 text-xs"
            style={{ color: "var(--text-muted)" }}
          >
            {isGoalComplete ? "Goal complete" : `of ${targetMinutes} min goal`}
          </span>
          {effectiveOuterPercent > 0 &&
            effectiveOuterPercent < 100 &&
            hasEndowedProgress &&
            completedMinutes === 0 && (
              <span
                className="mt-1 text-[10px]"
                style={{ color: "var(--text-secondary)" }}
              >
                You&apos;re already on your way
              </span>
            )}
        </div>

        {/* Completion glow animation */}
        {isGoalComplete && (
          <motion.div
            className="pointer-events-none absolute inset-0 rounded-full"
            initial={{ opacity: 0, scale: 1 }}
            animate={{
              opacity: [0, 0.4, 0],
              scale: [1, 1.05, 1],
            }}
            transition={{
              duration: 1.5,
              delay: 1.2,
              ease: "easeOut",
            }}
            style={{
              boxShadow: `0 0 40px ${CYAN}`,
            }}
          />
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-3">
      {/* Desktop ring */}
      {renderRing(desktopSize, "hidden lg:inline-flex")}
      {/* Mobile ring */}
      {renderRing(mobileSize, "inline-flex lg:hidden")}

      {/* Ring legend */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1.5">
          <span
            className="inline-block h-2 w-2 rounded-full"
            style={{ background: CYAN }}
          />
          <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
            Reading time
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span
            className="inline-block h-2 w-2 rounded-full"
            style={{ background: PURPLE }}
          />
          <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
            Steps today
          </span>
        </div>
      </div>
    </div>
  );
}
