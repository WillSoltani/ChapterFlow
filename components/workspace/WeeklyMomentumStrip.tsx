"use client";

import { motion, useReducedMotion } from "framer-motion";
import { DUR, EASE } from "@/lib/motion";

interface WeeklyMomentumStripProps {
  weeklyActivity: boolean[];
  chaptersCompleted: number;
  quizAverage: number | null;
  streakCount: number;
}

// Monday-based weekday letters (Mon=0 … Sun=6).
const MON_LETTERS = ["M", "T", "W", "T", "F", "S", "S"];

/** Monday-based weekday letter for the day `daysAgo` before today (todayWeekday is Mon=0…Sun=6). */
function weekdayLabel(todayWeekday: number, daysAgo: number): string {
  return MON_LETTERS[((todayWeekday - daysAgo) % 7 + 7) % 7];
}

export function WeeklyMomentumStrip({
  weeklyActivity,
  chaptersCompleted,
  quizAverage,
  streakCount,
}: WeeklyMomentumStripProps) {
  const prefersReducedMotion = useReducedMotion();
  // weeklyActivity is a rolling 7-day window: index 0 = 6 days ago … last = today.
  // Each dot is labeled with its TRUE weekday and today is the rightmost dot, so
  // today's activity always sits under today's label. (The old fixed M–S strip
  // mislabeled the dots six days out of seven.)
  const todayWeekday = (new Date().getDay() + 6) % 7; // Mon=0 … Sun=6

  // Build dynamic stats — only show non-zero
  const stats: { text: string; highlight?: string }[] = [];
  if (chaptersCompleted > 0)
    stats.push({ text: `${chaptersCompleted} chapter${chaptersCompleted !== 1 ? "s" : ""} this week` });
  if (quizAverage !== null) stats.push({ text: `${quizAverage}% quiz avg`, highlight: "var(--accent-emerald)" });
  if (streakCount > 0) stats.push({ text: `${streakCount} day streak`, highlight: "var(--accent-amber)" });

  return (
    <motion.div
      className="mt-5 rounded-2xl px-5 py-4"
      style={{
        // Momentum band under the greeting: rounded-2xl + border-strong reads as
        // a defined band (the day's reason-to-return). Stays on --cf-surface-muted
        // so it sits a tier BELOW the raised --cf-surface-strong hero.
        background: "var(--cf-surface-muted)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        border: "1px solid var(--cf-border-strong)",
      }}
      initial={prefersReducedMotion ? undefined : { opacity: 0, y: 16 }}
      animate={prefersReducedMotion ? undefined : { opacity: 1, y: 0 }}
      transition={
        prefersReducedMotion
          ? undefined
          : { duration: DUR.slow, delay: 0.25, ease: EASE.standard }
      }
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {/* 7-day heatmap */}
        <div className="flex items-center gap-3">
          {weeklyActivity.map((isActive, i) => {
            const daysAgo = weeklyActivity.length - 1 - i;
            const isToday = daysAgo === 0;
            const label = weekdayLabel(todayWeekday, daysAgo);
            return (
              <motion.div
                key={i}
                className="flex flex-col items-center gap-1.5"
                initial={
                  prefersReducedMotion ? undefined : { opacity: 0, scale: 0.5 }
                }
                animate={
                  prefersReducedMotion ? undefined : { opacity: 1, scale: 1 }
                }
                transition={
                  prefersReducedMotion
                    ? undefined
                    : { duration: DUR.normal, delay: 0.3 + i * 0.05 }
                }
              >
                <span
                  className="text-[10px] font-medium"
                  style={{ color: "var(--cf-text-soft)" }}
                >
                  {label}
                </span>
                <div className="relative">
                  <div
                    className="rounded-full"
                    style={{
                      width: 10,
                      height: 10,
                      background: isActive
                        ? "var(--accent-emerald)"
                        : isToday
                          ? "transparent"
                          : "var(--text-tertiary)",
                      border: isToday && !isActive
                        ? "2px solid var(--accent-cyan)"
                        : "none",
                      boxShadow: isActive
                        ? "0 0 8px 2px color-mix(in srgb, var(--accent-emerald) 40%, transparent)"
                        : "none",
                    }}
                  />
                  {isToday && isActive && (
                    <div
                      className="absolute -bottom-1 left-1/2 h-[2px] w-[2px] -translate-x-1/2 rounded-full"
                      style={{ background: "var(--accent-cyan)" }}
                    />
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Dynamic stats */}
        {stats.length > 0 && (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            {stats.map((stat, i) => (
              <span key={i} className="text-xs" style={{ color: stat.highlight || "var(--cf-text-3)", fontVariantNumeric: "tabular-nums" }}>
                {stat.text}
                {i < stats.length - 1 && (
                  <span className="ml-3" style={{ color: "var(--cf-text-soft)" }}>
                    ·
                  </span>
                )}
              </span>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}
