"use client";

import { useEffect, useState } from "react";
import { motion, useReducedMotion, useSpring, useTransform } from "framer-motion";
import type { WeekSummaryData, StreakData } from "./progressTypes";

interface WeeklySummaryProps {
  week: WeekSummaryData;
  streak: StreakData;
  isFirstWeek: boolean;
}

function formatWeekRange(startDate: string): string {
  const start = new Date(`${startDate}T12:00:00`);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);

  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  return `${start.toLocaleDateString(undefined, opts)} \u2013 ${end.toLocaleDateString(undefined, opts)}`;
}

function getTrendPercent(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return Math.round(((current - previous) / previous) * 100);
}

function getTrendColor(value: number | null): string {
  if (value === null) return "var(--text-muted)";
  if (value > 0) return "var(--cf-success-text)";
  if (value < 0) return "var(--cf-danger-text)";
  return "var(--text-muted)";
}

function getTrendArrow(value: number | null): string {
  if (value === null) return "\u2014";
  if (value > 0) return `\u2191 ${Math.abs(value)}%`;
  if (value < 0) return `\u2193 ${Math.abs(value)}%`;
  return "\u2014";
}

function getConsistencyColor(daysActive: number): string {
  const pct = (daysActive / 7) * 100;
  if (pct > 70) return "var(--cf-success-text)";
  if (pct >= 40) return "var(--accent-gold)";
  return "var(--cf-danger-text)";
}

function AnimatedNumber({ value }: { value: number }) {
  const prefersReduced = useReducedMotion();
  const spring = useSpring(0, {
    stiffness: 100,
    damping: 30,
    mass: 1,
  });
  const display = useTransform(spring, (v) => Math.round(v));
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    if (prefersReduced) {
      setDisplayValue(value);
      return;
    }
    spring.set(value);
    const unsubscribe = display.on("change", (v) => setDisplayValue(v));
    return unsubscribe;
  }, [value, spring, display, prefersReduced]);

  return <>{displayValue}</>;
}

export function WeeklySummary({
  week,
  streak,
  isFirstWeek,
}: WeeklySummaryProps) {
  const prefersReduced = useReducedMotion();
  const timeTrend = isFirstWeek
    ? null
    : getTrendPercent(week.timeReadMinutes, week.previousWeekMinutes);
  const chapterTrend = isFirstWeek
    ? null
    : getTrendPercent(week.chaptersCompleted, week.previousWeekChapters);
  const consistencyPct = Math.round((streak.daysActiveLast7 / 7) * 100);

  const stats = [
    {
      label: "Time read",
      value: week.timeReadMinutes,
      suffix: "m",
      trend: timeTrend,
      trendLabel: isFirstWeek ? "First week!" : "vs last week",
      zeroMessage: null,
    },
    {
      label: "Chapters",
      value: week.chaptersCompleted === 0 ? null : week.chaptersCompleted,
      suffix: "",
      trend: chapterTrend,
      trendLabel: isFirstWeek ? "First week!" : "vs last week",
      zeroMessage: "Complete your first chapter!",
    },
    {
      label: "Quiz accuracy",
      value: week.quizAccuracy,
      suffix: "%",
      trend: null,
      trendLabel: week.quizAccuracy === null ? "No quizzes yet" : "this week",
      zeroMessage: null,
    },
    {
      label: "Streak consistency",
      value: streak.daysActiveLast7,
      suffix: `/7 (${consistencyPct}%)`,
      trend: null,
      trendLabel: "",
      customColor: getConsistencyColor(streak.daysActiveLast7),
      zeroMessage: null,
    },
  ];

  return (
    <motion.section
      className="rounded-2xl p-5"
      style={{
        background: "var(--cf-surface-muted)",
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
        border: "1px solid var(--cf-border)",
        boxShadow: "var(--cf-shadow-md)",
      }}
      initial={{ opacity: prefersReduced ? 1 : 0, y: prefersReduced ? 0 : 15 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.3 }}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2
          className="text-base font-semibold"
          style={{ color: "var(--text-heading)" }}
        >
          This Week
        </h2>
        <span className="text-xs" style={{ color: "var(--text-muted)" }}>
          {formatWeekRange(week.weekStartDate)}
        </span>
      </div>

      {/* Stats grid */}
      <div className="mt-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map((stat) => (
          <div key={stat.label} className="flex flex-col gap-1">
            {/* Value */}
            <span
              className="font-(family-name:--font-display) text-2xl font-bold tabular-nums"
              style={{
                color:
                  stat.value === null
                    ? "var(--text-muted)"
                    : "customColor" in stat && stat.customColor
                      ? stat.customColor
                      : "var(--text-heading)",
              }}
            >
              {stat.value === null ? (
                "\u2014"
              ) : (
                <>
                  <AnimatedNumber value={stat.value} />
                  {stat.suffix}
                </>
              )}
            </span>

            {/* Trend or zero-state message */}
            {stat.value === null && stat.zeroMessage ? (
              <span className="text-xs" style={{ color: "var(--cf-success-text)" }}>
                {stat.zeroMessage}
              </span>
            ) : stat.trend !== null && stat.trend !== undefined ? (
              <span
                className="text-sm"
                style={{ color: getTrendColor(stat.trend) }}
              >
                {getTrendArrow(stat.trend)}
              </span>
            ) : isFirstWeek && stat.label !== "Quiz accuracy" && stat.label !== "Streak consistency" ? (
              <span
                className="rounded px-1.5 py-0.5 text-xs font-medium"
                style={{
                  background: "rgba(56,189,248,0.1)",
                  color: "var(--cf-accent)",
                  width: "fit-content",
                }}
              >
                First week!
              </span>
            ) : (
              <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                {stat.trendLabel}
              </span>
            )}

            {/* Label */}
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>
              {stat.label}
            </span>
          </div>
        ))}
      </div>
    </motion.section>
  );
}
