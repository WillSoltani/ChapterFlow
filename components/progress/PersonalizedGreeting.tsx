"use client";

import { motion, useReducedMotion } from "framer-motion";
import { DUR, EASE } from "@/lib/motion";
import type { StreakData, Milestone, TierPill } from "./progressTypes";

interface PersonalizedGreetingProps {
  name: string;
  /** Server tier; null hides the pill (tier read pending or failed). */
  tier: TierPill | null;
  streak: StreakData;
  goalCompletedToday: boolean;
  nextMilestones: Milestone[];
  completedMinutesToday: number;
}

const TIER_COLOR = "var(--accent-cyan)";

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function getMotivationLine(
  streak: StreakData,
  goalCompletedToday: boolean,
  nextMilestones: Milestone[],
  completedMinutesToday: number
): string {
  const readToday = completedMinutesToday > 0;

  // Streak at risk: alive through yesterday, nothing read yet today.
  if (streak.atRisk) {
    return `Read today to keep your ${streak.currentDays}-day streak.`;
  }

  // A badge the reader has started and is one step from. The step is not
  // always a chapter (some badges count books or days), so it is not named.
  const closesMilestone = nextMilestones.find(
    (m) => m.current > 0 && m.target - m.current === 1
  );
  if (closesMilestone) {
    return `One more to go for the ${closesMilestone.name} badge.`;
  }

  // Streak active and read today
  if (streak.currentDays > 0 && readToday) {
    return `Day ${streak.currentDays} of your streak. You're on a roll.`;
  }

  // Goal already complete
  if (goalCompletedToday) {
    return "Goal crushed! You're free to explore.";
  }

  return "Ready to learn something new?";
}

export function PersonalizedGreeting({
  name,
  tier,
  streak,
  goalCompletedToday,
  nextMilestones,
  completedMinutesToday,
}: PersonalizedGreetingProps) {
  const prefersReduced = useReducedMotion();
  const greeting = getGreeting();
  const motivation = getMotivationLine(
    streak,
    goalCompletedToday,
    nextMilestones,
    completedMinutesToday
  );

  return (
    <div className="flex flex-col gap-2">
      {/* Visually-hidden page heading for accessibility */}
      <span className="sr-only">Your Reading Progress</span>

      {/* Greeting */}
      <motion.h1
        className="font-(family-name:--font-display) text-2xl font-semibold leading-tight lg:text-3xl"
        style={{ color: "var(--text-heading)" }}
        initial={{ opacity: prefersReduced ? 1 : 0, y: prefersReduced ? 0 : 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: DUR.page, ease: EASE.standard }}
      >
        {greeting}, {name}
      </motion.h1>

      {/* Motivation line */}
      <motion.p
        className="text-base"
        style={{ color: "var(--text-secondary)" }}
        initial={{ opacity: prefersReduced ? 1 : 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: DUR.normal, delay: 0.1 }}
      >
        {motivation}
      </motion.p>

      {/* Server tier pill (the same ladder as the chapter-complete window) */}
      {tier && (
        <motion.div
          className="mt-1 flex items-center gap-2"
          initial={{ opacity: prefersReduced ? 1 : 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: DUR.normal, delay: 0.2 }}
        >
          <div
            className="flex items-center gap-2 rounded-lg px-2.5 py-1"
            style={{
              background: "var(--cf-surface-muted)",
              borderLeft: `3px solid ${TIER_COLOR}`,
            }}
          >
            <span className="text-xs" style={{ color: "var(--text-heading)" }}>
              {tier.label}
            </span>
            {/* Mini progress bar to next tier */}
            <div
              className="overflow-hidden rounded-full"
              role="progressbar"
              aria-label={tier.nextLabel ? `Progress to ${tier.nextLabel}` : `${tier.label} tier`}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={tier.percent}
              style={{
                width: 48,
                height: 4,
                background: "var(--cf-progress-track)",
              }}
            >
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${tier.percent}%`,
                  background: TIER_COLOR,
                }}
              />
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}
