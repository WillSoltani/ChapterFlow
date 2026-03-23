"use client";

import { useMemo, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import type { ReadingActivityData } from "./progressTypes";
import { EmptyState } from "./EmptyState";

type ViewMode = "minutes" | "chapters";

interface ReadingActivityProps {
  activity: ReadingActivityData;
  onStartReading?: () => void;
}

function getDayAbbr(dateStr: string): string {
  const date = new Date(`${dateStr}T12:00:00`);
  return date.toLocaleDateString(undefined, { weekday: "short" }).slice(0, 3);
}

function getWeekdayName(dateStr: string): string {
  const date = new Date(`${dateStr}T12:00:00`);
  return date.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function getHeatmapLevel(minutes: number): number {
  if (minutes <= 0) return 0;
  if (minutes < 15) return 1;
  if (minutes < 30) return 2;
  if (minutes < 50) return 3;
  return 4;
}

const HEATMAP_COLORS = [
  "rgba(255,255,255,0.05)",
  "rgba(56,189,248,0.2)",
  "rgba(56,189,248,0.4)",
  "rgba(56,189,248,0.6)",
  "#38BDF8",
];

function isToday(dateStr: string): boolean {
  const today = new Date();
  const date = new Date(`${dateStr}T12:00:00`);
  return (
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate()
  );
}

export function ReadingActivity({
  activity,
  onStartReading,
}: ReadingActivityProps) {
  const prefersReduced = useReducedMotion();
  const [mode, setMode] = useState<ViewMode>("minutes");
  const [hoveredDay, setHoveredDay] = useState<string | null>(null);

  const showBarChart = activity.totalDaysWithData < 14;
  const hasData = activity.totalDaysWithData > 0;

  // Build current week data for bar chart
  const weekData = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dayOfWeek = today.getDay();
    const monday = new Date(today);
    monday.setDate(today.getDate() - ((dayOfWeek + 6) % 7));

    const dayMap = new Map(activity.days.map((d) => [d.date, d]));
    const week: Array<{
      date: string;
      dayAbbr: string;
      minutes: number;
      chapters: number;
      isToday: boolean;
    }> = [];

    for (let i = 0; i < 7; i++) {
      const date = new Date(monday);
      date.setDate(monday.getDate() + i);
      const dateStr = date.toISOString().split("T")[0];
      const data = dayMap.get(dateStr);
      week.push({
        date: dateStr,
        dayAbbr: date.toLocaleDateString(undefined, { weekday: "short" }).slice(0, 3),
        minutes: data?.minutes ?? 0,
        chapters: data?.chapters ?? 0,
        isToday: isToday(dateStr),
      });
    }

    return week;
  }, [activity.days]);

  // Build heatmap data (84 days = 12 weeks)
  const heatmapData = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dayMap = new Map(activity.days.map((d) => [d.date, d]));
    const cells: Array<{
      date: string;
      minutes: number;
      chapters: number;
      level: number;
      dateLabel: string;
      isToday: boolean;
    }> = [];

    for (let offset = 83; offset >= 0; offset--) {
      const date = new Date(today);
      date.setDate(today.getDate() - offset);
      const dateStr = date.toISOString().split("T")[0];
      const data = dayMap.get(dateStr);
      const minutes = data?.minutes ?? 0;
      const chapters = data?.chapters ?? 0;

      cells.push({
        date: dateStr,
        minutes,
        chapters,
        level: mode === "minutes" ? getHeatmapLevel(minutes) : Math.min(chapters, 4),
        dateLabel: getWeekdayName(dateStr),
        isToday: isToday(dateStr),
      });
    }

    return cells;
  }, [activity.days, mode]);

  const hoveredData = useMemo(() => {
    if (!hoveredDay) return null;
    return heatmapData.find((c) => c.date === hoveredDay) ?? null;
  }, [hoveredDay, heatmapData]);

  const maxBarValue = useMemo(() => {
    const values = weekData.map((d) =>
      mode === "minutes" ? d.minutes : d.chapters
    );
    return Math.max(...values, 1);
  }, [weekData, mode]);

  return (
    <motion.section
      className="rounded-2xl p-5"
      style={{
        background: "rgba(255,255,255,0.04)",
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
        border: "1px solid rgba(255,255,255,0.08)",
        boxShadow: "0 4px 16px rgba(0,0,0,0.2)",
        backgroundColor: "rgba(15,15,26,0.95)",
      }}
      initial={{ opacity: prefersReduced ? 1 : 0 }}
      whileInView={{ opacity: 1 }}
      viewport={{ once: true }}
      transition={{ duration: 0.3 }}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2
          className="text-base font-semibold"
          style={{ color: "var(--text-heading)" }}
        >
          Reading Activity
        </h2>
        <div className="flex gap-1">
          {(["minutes", "chapters"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className="cursor-pointer rounded-lg px-2.5 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/50"
              style={{
                background:
                  mode === m
                    ? "rgba(56,189,248,0.15)"
                    : "transparent",
                color:
                  mode === m ? "#38BDF8" : "var(--text-muted)",
              }}
            >
              {m === "minutes" ? "Minutes" : "Chapters"}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      {!hasData ? (
        <EmptyState
          title="Your reading pattern will appear here after your first week"
          description=""
          ctaLabel="Start Reading \u2192"
          onCtaClick={onStartReading}
          className="py-6"
        />
      ) : showBarChart ? (
        /* 7-day bar chart */
        <div className="mt-4">
          <div className="flex items-end justify-between gap-2" style={{ height: 120 }}>
            {weekData.map((day, idx) => {
              const value =
                mode === "minutes" ? day.minutes : day.chapters;
              const heightPct =
                maxBarValue > 0 ? (value / maxBarValue) * 100 : 0;

              return (
                <div
                  key={day.date}
                  className="group relative flex flex-1 flex-col items-center gap-1"
                >
                  {/* Hover tooltip */}
                  <span
                    className="pointer-events-none absolute -top-5 z-10 rounded px-1.5 py-0.5 text-[10px] tabular-nums opacity-0 transition-opacity group-hover:opacity-100"
                    style={{
                      background: "rgba(0,0,0,0.8)",
                      color: "var(--text-heading)",
                    }}
                  >
                    {value}{mode === "minutes" ? "m" : ""}
                  </span>
                  {/* Bar */}
                  <motion.div
                    className="w-full rounded-t-md transition-[filter] group-hover:brightness-125"
                    style={{
                      background:
                        value > 0 ? "#38BDF8" : "rgba(255,255,255,0.04)",
                      boxShadow: day.isToday && value > 0
                        ? "0 0 12px rgba(56,189,248,0.4)"
                        : "none",
                      minHeight: value > 0 ? undefined : 4,
                      originY: 1,
                    }}
                    initial={{
                      scaleY: prefersReduced ? 1 : 0,
                      height: `${Math.max(heightPct, 3)}%`,
                    }}
                    whileInView={{ scaleY: 1 }}
                    viewport={{ once: true }}
                    transition={{
                      duration: 0.5,
                      ease: "easeOut",
                      delay: prefersReduced ? 0 : idx * 0.05,
                    }}
                  />
                  {/* Day label */}
                  <span
                    className="text-[10px]"
                    style={{
                      color: day.isToday
                        ? "#38BDF8"
                        : "var(--text-muted)",
                      fontWeight: day.isToday ? 600 : 400,
                    }}
                  >
                    {day.dayAbbr}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* Heatmap grid */
        <div className="mt-4">
          <div className="overflow-x-auto pb-2">
            <div className="flex gap-2">
              {/* Day labels */}
              <div
                className="grid select-none grid-rows-7 gap-1.5"
                style={{ gridAutoRows: "1rem" }}
              >
                {["", "Mon", "", "Wed", "", "Fri", ""].map((label, i) => (
                  <span
                    key={i}
                    className="flex h-4 w-6 items-center justify-end pr-1 text-[9px] leading-none"
                    style={{ color: "var(--text-muted)" }}
                  >
                    {label}
                  </span>
                ))}
              </div>

              {/* Grid cells */}
              <div className="inline-grid grid-flow-col grid-rows-7 gap-1.5">
                {heatmapData.map((cell) => (
                  <button
                    key={cell.date}
                    type="button"
                    onMouseEnter={() => setHoveredDay(cell.date)}
                    onFocus={() => setHoveredDay(cell.date)}
                    onMouseLeave={() => setHoveredDay(null)}
                    className="h-4 w-4 transition"
                    style={{
                      borderRadius: 3,
                      background: HEATMAP_COLORS[cell.level],
                      boxShadow: cell.isToday
                        ? "0 0 0 1.5px rgba(56,189,248,0.5)"
                        : "none",
                    }}
                    aria-label={`${cell.dateLabel}: ${cell.minutes} min, ${cell.chapters} chapters`}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="mt-3 flex items-center justify-between gap-3">
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              {hoveredData
                ? `${hoveredData.dateLabel} \u00B7 ${hoveredData.minutes} min \u00B7 ${hoveredData.chapters} ${hoveredData.chapters === 1 ? "chapter" : "chapters"}`
                : "Hover a day to inspect activity details."}
            </p>
            {/* Color scale legend */}
            <div className="flex shrink-0 items-center gap-1 text-[9px]" style={{ color: "var(--text-muted)" }}>
              <span>Less</span>
              {HEATMAP_COLORS.map((color, i) => (
                <span
                  key={i}
                  className="h-3 w-3"
                  style={{
                    borderRadius: 2,
                    background: color,
                  }}
                />
              ))}
              <span>More</span>
            </div>
          </div>
        </div>
      )}
    </motion.section>
  );
}
