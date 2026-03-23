"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import type { StreakData } from "./progressTypes";

interface StreakDisplayProps {
  streak: StreakData;
}

function getFlameSize(days: number): { fontSize: number; className: string } {
  if (days >= 30) return { fontSize: 28, className: "flame-golden" };
  if (days >= 7) return { fontSize: 24, className: "flame-medium" };
  return { fontSize: 20, className: "flame-small" };
}

function getNextStreakMilestone(current: number): number | null {
  const milestones = [3, 7, 14, 21, 30, 60, 90, 180, 365];
  return milestones.find((m) => m > current) ?? null;
}

export function StreakDisplay({ streak }: StreakDisplayProps) {
  const prefersReduced = useReducedMotion();
  const hasStreak = streak.currentDays > 0;
  const flame = getFlameSize(streak.currentDays);
  const nextMilestone = getNextStreakMilestone(streak.currentDays);
  const daysToMilestone = nextMilestone
    ? nextMilestone - streak.currentDays
    : null;

  return (
    <motion.div
      className="flex flex-col gap-1.5"
      initial={{ opacity: prefersReduced ? 1 : 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3, delay: 0.3 }}
    >
      {hasStreak ? (
        <>
          {/* Streak counter */}
          <div className="flex items-center gap-2">
            <span
              className="flame-pulse"
              style={{ fontSize: flame.fontSize }}
              role="img"
              aria-label="Fire"
            >
              {streak.currentDays >= 30 ? "\u{1F31F}" : "\u{1F525}"}
            </span>
            <span
              className="text-lg font-bold tabular-nums"
              style={{ color: "#F59E0B" }}
            >
              {streak.currentDays}-day streak
            </span>
            <span
              className="text-sm"
              style={{ color: "var(--text-muted)" }}
            >
              Best: {streak.bestDays}
            </span>
          </div>

          {/* Flow Freeze status */}
          <div className="text-xs" style={{ color: "var(--text-secondary)" }}>
            {streak.freezesEquipped > 0 ? (
              <span>
                {"\u2744\uFE0F"} {streak.freezesEquipped} Flow Freeze ready
              </span>
            ) : (
              <Link
                href="/rewards"
                className="cursor-pointer transition-colors hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/50 rounded"
                style={{ color: "var(--text-secondary)" }}
              >
                Get a Flow Freeze {"\u2192"}
              </Link>
            )}
          </div>

          {/* Next milestone */}
          {nextMilestone && daysToMilestone !== null && (
            <span
              className="text-xs"
              style={{ color: "var(--text-muted)" }}
            >
              {"\u{1F3AF}"} {nextMilestone}-day milestone in {daysToMilestone}{" "}
              {daysToMilestone === 1 ? "day" : "days"}
            </span>
          )}
        </>
      ) : (
        <div className="flex flex-col gap-1">
          <span
            className="text-sm"
            style={{ color: "var(--text-secondary)" }}
          >
            Best: {streak.bestDays} days {"\u00B7"} Read{" "}
            {streak.daysActiveLast7} of last 7 days
          </span>
          <span className="text-sm font-medium" style={{ color: "#F59E0B" }}>
            Start a new streak today
          </span>
        </div>
      )}
    </motion.div>
  );
}
