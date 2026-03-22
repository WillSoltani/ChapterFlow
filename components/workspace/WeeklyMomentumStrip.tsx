"use client";

import { motion, useReducedMotion } from "framer-motion";

interface WeeklyMomentumStripProps {
  weeklyActivity: boolean[];
  chaptersCompleted: number;
  quizAverage: number | null;
  streakCount: number;
}

const dayLabels = ["M", "T", "W", "T", "F", "S", "S"];

export function WeeklyMomentumStrip({
  weeklyActivity,
  chaptersCompleted,
  quizAverage,
  streakCount,
}: WeeklyMomentumStripProps) {
  const prefersReducedMotion = useReducedMotion();
  const today = (new Date().getDay() + 6) % 7; // Mon=0, Sun=6

  // Build dynamic stats — only show non-zero
  const stats: string[] = [];
  if (chaptersCompleted > 0)
    stats.push(`${chaptersCompleted} chapter${chaptersCompleted !== 1 ? "s" : ""} this week`);
  if (quizAverage !== null) stats.push(`${quizAverage}% quiz avg`);
  if (streakCount > 0) stats.push(`${streakCount} day streak`);

  return (
    <motion.div
      className="mt-5 rounded-xl px-5 py-4"
      style={{
        background: "rgba(255,255,255,0.03)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        border: "1px solid rgba(255,255,255,0.06)",
      }}
      initial={prefersReducedMotion ? undefined : { opacity: 0, y: 16 }}
      animate={prefersReducedMotion ? undefined : { opacity: 1, y: 0 }}
      transition={
        prefersReducedMotion
          ? undefined
          : { duration: 0.5, delay: 0.25, ease: [0.22, 1, 0.36, 1] }
      }
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {/* 7-day heatmap */}
        <div className="flex items-center gap-3">
          {dayLabels.map((label, i) => {
            const isActive = weeklyActivity[i];
            const isToday = i === today;
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
                    : { duration: 0.3, delay: 0.3 + i * 0.05 }
                }
              >
                <span
                  className="text-[10px]"
                  style={{ color: "#6B6B80" }}
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
                        ? "#7C3AED"
                        : "rgba(255,255,255,0.08)",
                      boxShadow: isActive
                        ? "0 0 6px rgba(124,58,237,0.3)"
                        : "none",
                    }}
                  />
                  {isToday && !isActive && !prefersReducedMotion && (
                    <motion.div
                      className="absolute inset-0 rounded-full"
                      style={{ border: "1px solid rgba(124,58,237,0.4)" }}
                      animate={{ scale: [1, 1.6, 1], opacity: [0.5, 0, 0.5] }}
                      transition={{ duration: 2, repeat: Infinity }}
                    />
                  )}
                  {isToday && isActive && (
                    <div
                      className="absolute -bottom-1 left-1/2 h-[2px] w-[2px] -translate-x-1/2 rounded-full"
                      style={{ background: "#7C3AED" }}
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
              <span key={i} className="text-xs" style={{ color: "#A0A0B8" }}>
                {stat}
                {i < stats.length - 1 && (
                  <span className="ml-3" style={{ color: "#6B6B80" }}>
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
