"use client";

import { motion, useReducedMotion } from "framer-motion";
import { getFreePlanColor, type UserStats } from "./libraryData";

interface ReaderStatusBarProps {
  stats: UserStats;
}

function BookIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent-teal)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
    </svg>
  );
}

function FlameIcon({ active }: { active: boolean }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill={active ? "var(--accent-flame)" : "none"}
      stroke="var(--accent-flame)"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={active ? "flame-pulse" : ""}
    >
      <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" />
    </svg>
  );
}

export function ReaderStatusBar({ stats }: ReaderStatusBarProps) {
  const prefersReduced = useReducedMotion();
  const badgeProgress = Math.max(0, 5 - stats.nextBadge.booksAway);
  const freePlanColor = getFreePlanColor(stats.freeBooksUsed, stats.freeBooksLimit);

  return (
    <motion.div
      initial={{ opacity: prefersReduced ? 1 : 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2, delay: 0.1 }}
      className="flex items-center justify-between px-5 py-2.5 md:px-7"
      style={{
        background: "rgba(255,255,255,0.02)",
        backdropFilter: "blur(10px)",
        WebkitBackdropFilter: "blur(10px)",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
      }}
    >
      {/* Left cluster */}
      <div className="flex items-center gap-5 text-[13px]">
        {/* Level + XP */}
        <span className="flex items-center gap-1.5" style={{ color: "var(--text-secondary)" }}>
          <BookIcon />
          <span style={{ color: "var(--text-heading)" }}>Level {stats.level}</span>
          <span className="font-(family-name:--font-mono)" style={{ color: "var(--accent-teal)" }}>
            {stats.xp.toLocaleString()} XP
          </span>
        </span>

        {/* Streak — urgency when not active today */}
        <span className="flex items-center gap-1.5">
          <FlameIcon active={stats.streakIsActiveToday} />
          {stats.streakIsActiveToday ? (
            <span style={{ color: "var(--cf-amber-text)" }}>
              {stats.currentStreak}-day streak
            </span>
          ) : (
            <span style={{ color: "var(--cf-amber-text)" }}>
              {stats.currentStreak}-day streak — read today to keep it!
            </span>
          )}
        </span>

        {/* Books completed */}
        <span className="hidden items-center gap-1 md:flex" style={{ color: "var(--text-secondary)" }}>
          {stats.booksCompleted} book{stats.booksCompleted !== 1 ? "s" : ""} completed
        </span>

        {/* Next badge — Goal Gradient */}
        <span className="hidden items-center gap-2 lg:flex" style={{ color: "var(--text-muted)" }}>
          Next:{" "}
          <span style={{ color: "var(--cf-amber-text)" }}>{stats.nextBadge.name}</span>
          <span style={{ color: "var(--text-secondary)" }}>
            — {stats.nextBadge.booksAway} book{stats.nextBadge.booksAway !== 1 ? "s" : ""} away
          </span>
          {/* Tiny progress bar (40px) */}
          <div
            className="h-1.5 w-10 overflow-hidden rounded-full"
            style={{ background: "var(--bg-elevated)" }}
          >
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${(badgeProgress / 5) * 100}%`,
                background: "var(--accent-gold)",
              }}
            />
          </div>
        </span>
      </div>

      {/* Right side */}
      <div className="flex items-center gap-3 text-[13px]">
        {stats.isPro ? (
          <span className="hidden items-center gap-2 md:flex" style={{ color: "var(--text-muted)" }}>
            <span style={{ color: "var(--accent-teal)" }}>Pro</span>
          </span>
        ) : (
          /* Loss-framed free plan indicator */
          <span className="flex items-center gap-2" style={{ color: "var(--text-muted)" }}>
            <span style={{ color: "var(--text-secondary)" }}>
              {stats.freeBooksUsed} of {stats.freeBooksLimit} free books used
            </span>
            {/* Larger progress bar (6px) with urgency color */}
            <div
              className="h-1.5 w-12 overflow-hidden rounded-full"
              style={{ background: "var(--bg-elevated)" }}
            >
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${(stats.freeBooksUsed / stats.freeBooksLimit) * 100}%`,
                  background: freePlanColor,
                }}
              />
            </div>
            <a
              href="/pricing"
              className="font-semibold transition-colors"
              style={{ color: "var(--accent-teal)" }}
            >
              Upgrade →
            </a>
          </span>
        )}
      </div>
    </motion.div>
  );
}
