"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { DUR, EASE } from "@/lib/motion";
import { StreakBadge } from "./StreakBadge";
import { DailyGoalRing } from "./DailyGoalRing";

interface CompactHeaderProps {
  firstName: string;
  streakCount: number;
  dailyProgress: number;
  insightPoints: number;
  subtitle: string;
}

function getTimeOfDay() {
  const h = new Date().getHours();
  return h < 12 ? "morning" : h < 17 ? "afternoon" : "evening";
}

export function CompactHeader({
  firstName,
  streakCount,
  dailyProgress,
  insightPoints,
  subtitle,
}: CompactHeaderProps) {
  const prefersReducedMotion = useReducedMotion();
  // Show the rewards cluster whenever the user actually HAS rewards — not gated
  // on "new user". A just-onboarded reader has a day-1 streak + welcome IP, so
  // the header should confirm the celebration, not contradict it.
  const hasRewards = insightPoints > 0 || streakCount > 0;

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
          {...(prefersReducedMotion ? {} : { initial: { opacity: 0, y: 12 } })}
          {...(prefersReducedMotion ? {} : { animate: { opacity: 1, y: 0 } })}
          {...(prefersReducedMotion ? {} : { transition: { duration: DUR.slow, ease: EASE.standard } })}
        >
          Good {getTimeOfDay()}, {firstName}
        </motion.h1>
        <motion.p
          className="mt-1 text-sm"
          style={{ color: "var(--cf-text-3)" }}
          {...(prefersReducedMotion ? {} : { initial: { opacity: 0 } })}
          {...(prefersReducedMotion ? {} : { animate: { opacity: 1 } })}
          {...(prefersReducedMotion ? {} : { transition: { duration: DUR.page, delay: 0.15, ease: EASE.standard } })}
        >
          {subtitle}
        </motion.p>
      </div>

      {/* Right: Inline metrics */}
      <motion.div
        className="flex items-center gap-4"
        {...(prefersReducedMotion ? {} : { initial: { opacity: 0 } })}
        {...(prefersReducedMotion ? {} : { animate: { opacity: 1 } })}
        {...(prefersReducedMotion ? {} : { transition: { duration: DUR.slow, delay: 0.2, ease: EASE.standard } })}
      >
        <Link href="/book/progress" className="inline-flex">
          <StreakBadge count={streakCount} />
        </Link>

        {hasRewards && (
          <>
            <Link href="/book/progress" className="inline-flex">
              <DailyGoalRing
                size={22}
                progress={dailyProgress}
              />
            </Link>

            <Link
              href="/rewards"
              className="inline-flex items-center gap-1"
            >
              <span aria-hidden="true" style={{ color: "var(--accent-amber)", fontSize: 14, filter: "drop-shadow(0 0 6px color-mix(in srgb, var(--accent-amber) 30%, transparent))" }}>
                ◆
              </span>
              <span
                className="text-sm tabular-nums"
                style={{ color: "var(--cf-text-3)" }}
              >
                {(insightPoints ?? 0).toLocaleString()}
              </span>
            </Link>
          </>
        )}
      </motion.div>
    </div>
  );
}
