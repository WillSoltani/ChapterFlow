"use client";

import { motion, useReducedMotion } from "framer-motion";
import type { ReaderLevel, StreakData, Milestone } from "./progressTypes";

interface PersonalizedGreetingProps {
  name: string;
  readerLevel: ReaderLevel;
  readerLevelProgress: number;
  streak: StreakData;
  goalCompletedToday: boolean;
  nextMilestones: Milestone[];
  completedMinutesToday: number;
  targetMinutes: number;
}

const LEVEL_THRESHOLDS: Record<ReaderLevel, number> = {
  "Curious Reader": 0,
  "Active Learner": 5,
  "Knowledge Builder": 25,
  "Thought Leader": 100,
};

const LEVEL_COLORS: Record<ReaderLevel, string> = {
  "Curious Reader": "var(--cf-accent)",
  "Active Learner": "var(--cf-success-text)",
  "Knowledge Builder": "var(--cf-accent)",
  "Thought Leader": "var(--accent-gold)",
};

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
  completedMinutesToday: number,
  targetMinutes: number
): string {
  const remaining = Math.max(0, targetMinutes - completedMinutesToday);
  const readToday = completedMinutesToday > 0;

  // Streak at risk: last active yesterday, hasn't read today
  if (streak.currentDays > 0 && !readToday) {
    return `Your ${streak.currentDays}-day streak needs you \u2014 just ${remaining}m to keep it alive`;
  }

  // Milestone 1 action away
  const closesMilestone = nextMilestones.find(
    (m) => m.target - m.current === 1
  );
  if (closesMilestone) {
    return `One more chapter to earn the ${closesMilestone.name} badge!`;
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
  readerLevel,
  readerLevelProgress,
  streak,
  goalCompletedToday,
  nextMilestones,
  completedMinutesToday,
  targetMinutes,
}: PersonalizedGreetingProps) {
  const prefersReduced = useReducedMotion();
  const greeting = getGreeting();
  const motivation = getMotivationLine(
    streak,
    goalCompletedToday,
    nextMilestones,
    completedMinutesToday,
    targetMinutes
  );
  const levelColor = LEVEL_COLORS[readerLevel];

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
        transition={{ duration: 0.4, ease: "easeOut" }}
      >
        {greeting}, {name}
      </motion.h1>

      {/* Motivation line */}
      <motion.p
        className="text-base"
        style={{ color: "var(--text-secondary)" }}
        initial={{ opacity: prefersReduced ? 1 : 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3, delay: 0.1 }}
      >
        {motivation}
      </motion.p>

      {/* Reader identity tier pill */}
      <motion.div
        className="mt-1 flex items-center gap-2"
        initial={{ opacity: prefersReduced ? 1 : 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3, delay: 0.2 }}
      >
        <div
          className="flex items-center gap-2 rounded-lg px-2.5 py-1"
          style={{
            background: "var(--cf-surface-muted)",
            borderLeft: `3px solid ${levelColor}`,
          }}
        >
          <span className="text-xs" style={{ color: "var(--text-heading)" }}>
            {readerLevel}
          </span>
          {/* Mini progress bar to next tier */}
          <div
            className="overflow-hidden rounded-full"
            style={{
              width: 48,
              height: 4,
              background: "var(--cf-surface-strong)",
            }}
          >
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${Math.min(100, readerLevelProgress)}%`,
                background: levelColor,
              }}
            />
          </div>
        </div>
      </motion.div>
    </div>
  );
}
