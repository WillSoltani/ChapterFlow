"use client";

// Implements §8.1 — Streak display for dashboard, header, and profile contexts.
// Shows flame icon + day count + shield inventory + next milestone progress.

import { motion, useReducedMotion } from "framer-motion";
import { Shield } from "lucide-react";

export type StreakDisplayData = {
  currentStreak: number;
  longestStreak: number;
  shieldsHeld: number;
  consistencyScore: number;
  nextMilestone: {
    days: number;
    ip: number;
    daysRemaining: number;
  } | null;
};

type StreakDisplayProps = {
  data: StreakDisplayData | null;
  variant: "header" | "dashboard" | "profile";
  loading?: boolean;
};

export function StreakDisplay({ data, variant, loading }: StreakDisplayProps) {
  const reduced = useReducedMotion();

  if (loading || !data) {
    return (
      <div className="flex items-center gap-1.5 text-sm text-(--cf-text-soft)">
        <span className="text-base">🔥</span>
        <span className="tabular-nums">—</span>
      </div>
    );
  }

  // ── Header: compact "🔥 14" ──────────────────────────────────────────
  if (variant === "header") {
    return (
      <motion.div
        className="flex items-center gap-1"
        initial={{ opacity: reduced ? 1 : 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3, delay: 0.2 }}
      >
        <span className="text-base">🔥</span>
        <span
          className="text-sm font-semibold tabular-nums"
          style={{ color: data.currentStreak > 0 ? "var(--accent-amber)" : "var(--cf-text-soft)" }}
        >
          {data.currentStreak}
        </span>
      </motion.div>
    );
  }

  // ── Dashboard: streak card ───────────────────────────────────────────
  if (variant === "dashboard") {
    return (
      <div
        className="rounded-2xl border border-(--cf-border-strong) p-4"
        style={{
          background: "var(--cf-surface-muted)",
          backdropFilter: "blur(24px)",
          WebkitBackdropFilter: "blur(24px)",
        }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🔥</span>
            <div>
              <p
                className="text-2xl font-bold tabular-nums"
                style={{ color: data.currentStreak > 0 ? "var(--accent-amber)" : "var(--cf-text-soft)" }}
              >
                {data.currentStreak}
              </p>
              <p className="text-xs text-(--cf-text-3)">day streak</p>
            </div>
          </div>

          {/* Shield inventory */}
          <div className="flex items-center gap-1" title={`${data.shieldsHeld} Streak Shield${data.shieldsHeld !== 1 ? "s" : ""}`}>
            {Array.from({ length: 3 }).map((_, i) => (
              <Shield
                key={i}
                className="h-4 w-4"
                style={{
                  color: i < data.shieldsHeld ? "var(--accent-cyan)" : "var(--cf-text-soft)",
                  opacity: i < data.shieldsHeld ? 1 : 0.3,
                }}
                fill={i < data.shieldsHeld ? "var(--accent-cyan)" : "none"}
              />
            ))}
          </div>
        </div>

        {/* Next milestone progress */}
        {data.nextMilestone && (
          <div className="mt-3">
            <div className="flex items-center justify-between text-xs text-(--cf-text-3)">
              <span>Next: {data.nextMilestone.days}-day milestone</span>
              <span className="tabular-nums">{data.nextMilestone.daysRemaining} days left</span>
            </div>
            <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full" style={{ background: "var(--cf-surface-strong)" }}>
              <motion.div
                className="h-full rounded-full"
                style={{ background: "var(--accent-amber)" }}
                initial={{ width: 0 }}
                animate={{
                  width: `${Math.min(100, Math.round(((data.currentStreak) / data.nextMilestone.days) * 100))}%`,
                }}
                transition={{ duration: 0.5, ease: "easeOut" }}
              />
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── Profile: streak + longest streak + consistency ring ──────────────
  return (
    <div className="flex items-center gap-6">
      {/* Current streak */}
      <div className="flex flex-col items-center">
        <span className="text-2xl">🔥</span>
        <p
          className="mt-1 text-xl font-bold tabular-nums"
          style={{ color: data.currentStreak > 0 ? "var(--accent-amber)" : "var(--cf-text-soft)" }}
        >
          {data.currentStreak}
        </p>
        <p className="text-xs text-(--cf-text-3)">Current</p>
      </div>

      {/* Longest streak */}
      <div className="flex flex-col items-center">
        <span className="text-2xl">⭐</span>
        <p className="mt-1 text-xl font-bold tabular-nums text-(--cf-text-2)">
          {data.longestStreak}
        </p>
        <p className="text-xs text-(--cf-text-3)">Best</p>
      </div>

      {/* Consistency score ring (§2.3) */}
      <ConsistencyRing score={data.consistencyScore} />
    </div>
  );
}

// ── Consistency Score Ring (§2.3 visual representation) ──────────────────────

function ConsistencyRing({ score }: { score: number }) {
  const radius = 20;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference - (score / 100) * circumference;

  // Color by range per §2.3
  const color =
    score >= 85
      ? "var(--accent-emerald)"
      : score >= 60
        ? "var(--accent-cyan)"
        : score >= 30
          ? "var(--accent-amber)"
          : "var(--cf-text-soft)";

  return (
    <div className="flex flex-col items-center">
      <div className="relative h-12 w-12">
        <svg className="h-12 w-12 -rotate-90" viewBox="0 0 48 48">
          {/* Background ring */}
          <circle
            cx="24"
            cy="24"
            r={radius}
            fill="none"
            stroke="var(--cf-surface-strong)"
            strokeWidth={3}
          />
          {/* Progress ring */}
          <circle
            cx="24"
            cy="24"
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={3}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            style={{ transition: "stroke-dashoffset 0.5s ease" }}
          />
        </svg>
        <span
          className="absolute inset-0 flex items-center justify-center text-xs font-semibold tabular-nums"
          style={{ color }}
        >
          {score}%
        </span>
      </div>
      <p className="mt-1 text-xs text-(--cf-text-3)">Consistency</p>
    </div>
  );
}

export { ConsistencyRing };
