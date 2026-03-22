"use client";

import { motion } from "framer-motion";
import { FlameIcon } from "@/components/ui/FlameIcon";
import { CircularProgress } from "@/components/ui/CircularProgress";

const ease = [0.22, 1, 0.36, 1] as const;

function getTimeOfDay() {
  const h = new Date().getHours();
  return h < 12 ? "morning" : h < 17 ? "afternoon" : "evening";
}

interface GreetingRowProps {
  userName?: string;
  streakDays?: number;
  dailyMinutes?: number;
  dailyGoal?: number;
  contextLine?: string;
  isNewUser?: boolean;
}

export function GreetingRow({
  userName = "Will",
  streakDays = 7,
  dailyMinutes = 8,
  dailyGoal = 20,
  contextLine = "Chapter 4 of Deep Work is waiting.",
  isNewUser = false,
}: GreetingRowProps) {
  const dailyProgress = Math.min((dailyMinutes / dailyGoal) * 100, 100);

  return (
    <div
      className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between"
    >
      {/* Left: Greeting */}
      <div>
        <motion.h1
          className="font-(family-name:--font-display) text-[26px] font-bold md:text-[34px]"
          style={{ color: "var(--text-heading)" }}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease }}
        >
          Good {getTimeOfDay()}, {userName}.
        </motion.h1>
        <motion.p
          className="mt-1 text-[14px]"
          style={{ color: "var(--text-secondary)" }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.15, ease }}
        >
          {contextLine}
        </motion.p>
      </div>

      {/* Right: Streak + Daily Goal */}
      <motion.div
        className="flex items-center gap-5"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.2, ease }}
      >
        {/* Streak */}
        <div className="flex items-center gap-1.5">
          <FlameIcon size={22} />
          <div className="flex flex-col">
            <span
              className="font-(family-name:--font-jetbrains) text-[24px] font-bold leading-none"
              style={{ color: "var(--accent-flame)" }}
            >
              {isNewUser ? (
                <span className="text-[13px] font-semibold" style={{ color: "var(--text-muted)" }}>
                  Start today
                </span>
              ) : (
                streakDays
              )}
            </span>
            {!isNewUser && (
              <span
                className="text-[10px]"
                style={{ color: "var(--text-muted)" }}
              >
                day streak
              </span>
            )}
          </div>
        </div>

        {/* Divider */}
        <div
          style={{
            width: 1,
            height: 28,
            background: "var(--border-subtle)",
          }}
        />

        {/* Daily goal */}
        <div className="flex items-center gap-2.5">
          <CircularProgress
            size={44}
            strokeWidth={3}
            progress={isNewUser ? 0 : dailyProgress}
            color="var(--accent-teal)"
            trackColor="var(--border-subtle)"
          >
            <span
              className="font-(family-name:--font-jetbrains) text-[11px]"
              style={{ color: "var(--text-primary)" }}
            >
              {isNewUser ? "0m" : `${dailyMinutes}m`}
            </span>
          </CircularProgress>
          <div className="flex flex-col">
            <span
              className="text-[13px] font-semibold"
              style={{ color: "var(--text-primary)" }}
            >
              {isNewUser ? "0" : dailyMinutes} / {dailyGoal} min
            </span>
            <span
              className="text-[10px]"
              style={{ color: "var(--text-muted)" }}
            >
              daily goal
            </span>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
