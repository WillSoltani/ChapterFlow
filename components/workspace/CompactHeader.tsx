"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { StreakBadge } from "./StreakBadge";
import { DailyGoalRing } from "./DailyGoalRing";

interface CompactHeaderProps {
  firstName: string;
  streakCount: number;
  dailyProgress: number;
  flowPoints: number;
  subtitle: string;
  isNewUser?: boolean;
}

function getTimeOfDay() {
  const h = new Date().getHours();
  return h < 12 ? "morning" : h < 17 ? "afternoon" : "evening";
}

const ease = [0.22, 1, 0.36, 1] as const;

export function CompactHeader({
  firstName,
  streakCount,
  dailyProgress,
  flowPoints,
  subtitle,
  isNewUser = false,
}: CompactHeaderProps) {
  const prefersReducedMotion = useReducedMotion();

  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      {/* Left: Greeting + Subtitle */}
      <div>
        <motion.h1
          className="font-(family-name:--font-display) text-2xl font-semibold md:text-3xl"
          style={{
            backgroundImage:
              "linear-gradient(to right, var(--cf-text-1), var(--cf-text-2), var(--cf-text-3))",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
          }}
          initial={prefersReducedMotion ? undefined : { opacity: 0, y: 12 }}
          animate={prefersReducedMotion ? undefined : { opacity: 1, y: 0 }}
          transition={
            prefersReducedMotion ? undefined : { duration: 0.5, ease }
          }
        >
          Good {getTimeOfDay()}, {firstName}
        </motion.h1>
        <motion.p
          className="mt-1 text-sm"
          style={{ color: "var(--cf-text-3)" }}
          initial={prefersReducedMotion ? undefined : { opacity: 0 }}
          animate={prefersReducedMotion ? undefined : { opacity: 1 }}
          transition={
            prefersReducedMotion
              ? undefined
              : { duration: 0.4, delay: 0.15, ease }
          }
        >
          {subtitle}
        </motion.p>
      </div>

      {/* Right: Inline metrics */}
      <motion.div
        className="flex items-center gap-4"
        initial={prefersReducedMotion ? undefined : { opacity: 0 }}
        animate={prefersReducedMotion ? undefined : { opacity: 1 }}
        transition={
          prefersReducedMotion
            ? undefined
            : { duration: 0.5, delay: 0.2, ease }
        }
      >
        <Link href="/book/progress" className="inline-flex">
          <StreakBadge count={streakCount} isNewUser={isNewUser} />
        </Link>

        {!isNewUser && (
          <>
            <Link href="/book/progress" className="inline-flex">
              <DailyGoalRing
                size={22}
                progress={dailyProgress}
                todayPulse={dailyProgress < 100}
              />
            </Link>

            <Link
              href="/rewards"
              className="inline-flex items-center gap-1"
            >
              <span aria-hidden="true" style={{ color: "var(--accent-amber)", fontSize: 14, filter: "drop-shadow(0 0 6px rgba(245,158,11,0.3))" }}>
                ◆
              </span>
              <span
                className="text-sm tabular-nums"
                style={{ color: "var(--cf-text-3)" }}
              >
                {flowPoints.toLocaleString()}
              </span>
            </Link>
          </>
        )}
      </motion.div>
    </div>
  );
}
