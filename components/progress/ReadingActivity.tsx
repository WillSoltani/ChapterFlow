"use client";

import { useMemo, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import type { ReadingActivityData } from "./progressTypes";
import { EmptyState } from "./EmptyState";

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
  "var(--cf-surface-muted)",
  "rgba(34,211,238,0.2)",
  "rgba(34,211,238,0.4)",
  "rgba(34,211,238,0.6)",
  "var(--accent-cyan)",
];

function toLocalDateStr(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

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
  const [hoveredDay, setHoveredDay] = useState<string | null>(null);

  const showBarChart = activity.totalDaysWithData < 14;
  const hasData = activity.totalDaysWithData > 0;

  // Current hour for highlighting
  const currentHour = new Date().getHours();

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
      const dateStr = toLocalDateStr(date);
      const data = dayMap.get(dateStr);
      const minutes = data?.minutes ?? 0;
      const chapters = data?.chapters ?? 0;

      cells.push({
        date: dateStr,
        minutes,
        chapters,
        level: getHeatmapLevel(minutes),
        dateLabel: getWeekdayName(dateStr),
        isToday: isToday(dateStr),
      });
    }

    return cells;
  }, [activity.days]);

  const hoveredData = useMemo(() => {
    if (!hoveredDay) return null;
    return heatmapData.find((c) => c.date === hoveredDay) ?? null;
  }, [hoveredDay, heatmapData]);

  const maxHourlyMinutes = useMemo(() => {
    return Math.max(...activity.todayHourly.map((h) => h.minutes), 1);
  }, [activity.todayHourly]);

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
        <span className="text-xs" style={{ color: "var(--text-muted)" }}>
          Today &middot; Hourly
        </span>
      </div>

      {/* Content */}
      {!hasData ? (
        <EmptyState
          title="Your reading pattern will appear here after your first session"
          description=""
          ctaLabel="Start Reading \u2192"
          onCtaClick={onStartReading}
          className="py-6"
        />
      ) : showBarChart ? (
        /* 24-hour bar chart for today */
        <div className="mt-4">
          <div className="flex items-end gap-px" style={{ height: 100 }}>
            {activity.todayHourly.map((slot, idx) => {
              const barHeight =
                maxHourlyMinutes > 0
                  ? Math.max(Math.round((slot.minutes / maxHourlyMinutes) * 90), slot.minutes > 0 ? 6 : 2)
                  : 2;
              const isCurrent = slot.hour === currentHour;
              const isFuture = slot.hour > currentHour;

              return (
                <div
                  key={slot.hour}
                  className="group relative flex flex-1 flex-col items-center"
                  style={{ minWidth: 0 }}
                >
                  {/* Hover tooltip */}
                  {slot.minutes > 0 && (
                    <span
                      className="pointer-events-none absolute -top-5 z-10 rounded px-1 py-0.5 text-[9px] tabular-nums opacity-0 transition-opacity group-hover:opacity-100"
                      style={{
                        background: "var(--cf-overlay)",
                        color: "var(--text-heading)",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {slot.minutes}m
                    </span>
                  )}
                  {/* Bar */}
                  <motion.div
                    className="w-full rounded-t-sm transition-[filter] group-hover:brightness-125"
                    style={{
                      background: isFuture
                        ? "transparent"
                        : slot.minutes > 0
                          ? "var(--accent-cyan)"
                          : "var(--cf-surface-strong)",
                      boxShadow: isCurrent && slot.minutes > 0
                        ? "0 0 8px rgba(34,211,238,0.4)"
                        : "none",
                      opacity: isFuture ? 0.3 : 1,
                      borderBottom: isFuture ? "1px dashed var(--cf-border)" : "none",
                      originY: 1,
                      height: isFuture ? 2 : barHeight,
                    }}
                    initial={prefersReduced ? false : { scaleY: 0 }}
                    animate={{ scaleY: 1 }}
                    transition={{
                      duration: 0.4,
                      ease: "easeOut",
                      delay: prefersReduced ? 0 : idx * 0.015,
                    }}
                  />
                </div>
              );
            })}
          </div>
          {/* Hour labels — show every 3 hours */}
          <div className="mt-1 flex">
            {activity.todayHourly.map((slot) => (
              <div key={slot.hour} className="flex-1 text-center" style={{ minWidth: 0 }}>
                {slot.hour % 3 === 0 ? (
                  <span
                    className="text-[9px] tabular-nums"
                    style={{
                      color: slot.hour === currentHour
                        ? "var(--accent-cyan)"
                        : "var(--text-muted)",
                      fontWeight: slot.hour === currentHour ? 600 : 400,
                    }}
                  >
                    {slot.hour === 0 ? "12a" : slot.hour < 12 ? `${slot.hour}a` : slot.hour === 12 ? "12p" : `${slot.hour - 12}p`}
                  </span>
                ) : null}
              </div>
            ))}
          </div>
          {/* Summary line */}
          <div className="mt-2 flex items-center gap-3">
            <span className="text-xs tabular-nums" style={{ color: "var(--text-secondary)" }}>
              {activity.todayHourly.reduce((sum, h) => sum + h.minutes, 0)}m total today
            </span>
            <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>
              {activity.todayHourly.filter((h) => h.minutes > 0).length} active {activity.todayHourly.filter((h) => h.minutes > 0).length === 1 ? "hour" : "hours"}
            </span>
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
                        ? "0 0 0 1.5px rgba(34,211,238,0.5)"
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
