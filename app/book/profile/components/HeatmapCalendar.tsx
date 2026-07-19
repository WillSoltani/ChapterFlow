"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { HeatmapCell, HEATMAP_COLORS, todayKey } from "./profile-heatmap";

export function HeatmapCalendar({ cells }: { cells: HeatmapCell[] }) {
  const last30 = cells.slice(-30);
  const today = todayKey();
  const [tooltip, setTooltip] = useState<{ key: string; text: string } | null>(null);

  // Build a 7-row grid (Mon-Sun rows × ~5 week columns)
  const DOW_LABELS = ["Mon", "", "Wed", "", "Fri", "", "Sun"];
  // Organize cells into rows by day of week
  const rows: (HeatmapCell | null)[][] = Array.from({ length: 7 }, () => []);
  for (const cell of last30) {
    const d = new Date(`${cell.key}T12:00:00`);
    const dow = (d.getDay() + 6) % 7; // 0=Mon, 6=Sun
    rows[dow].push(cell);
  }
  // Pad rows to equal length
  const maxCols = Math.max(...rows.map((r) => r.length), 1);
  for (const row of rows) {
    while (row.length < maxCols) row.unshift(null);
  }

  return (
    <div>
      <div className="flex gap-1">
        {/* Day-of-week labels */}
        <div className="flex flex-col gap-1.5 pr-1.5 pt-0">
          {DOW_LABELS.map((label, i) => (
            <div key={i} className="flex h-5 items-center sm:h-6">
              <span className="w-6 text-right font-mono text-[10px] text-(--cf-text-3)">{label}</span>
            </div>
          ))}
        </div>
        {/* Grid */}
        <div className="flex flex-1 flex-col gap-1.5">
          {rows.map((row, rowIdx) => (
            <div key={rowIdx} className="flex gap-1.5">
              {row.map((cell, colIdx) => {
                if (!cell) return <div key={`empty-${rowIdx}-${colIdx}`} className="h-5 w-5 sm:h-6 sm:w-6" />;
                const isToday = cell.key === today;
                const tipText = cell.minutes > 0
                  ? `${cell.dateLabel} — ${cell.chapters} chapter${cell.chapters !== 1 ? "s" : ""} read`
                  : `${cell.dateLabel} — No activity`;
                return (
                  <div
                    key={cell.key}
                    className={cn(
                      "group relative h-5 w-5 cursor-default rounded-[5px] border transition-colors sm:h-6 sm:w-6",
                      HEATMAP_COLORS[cell.level] ?? HEATMAP_COLORS[0],
                      isToday ? "border-(--cf-border-strong) ring-1 ring-(--cf-border)" : "border-(--cf-border)",
                      isToday && cell.level === 0 && "border-dashed border-(--cf-border-strong)"
                    )}
                    role="img"
                    aria-label={`${cell.dateLabel}: ${cell.minutes} ${cell.minutes === 1 ? "minute" : "minutes"}, ${cell.chapters} ${cell.chapters === 1 ? "chapter" : "chapters"}${isToday ? " — today" : ""}`}
                    onMouseEnter={() => setTooltip({ key: cell.key, text: tipText })}
                    onMouseLeave={() => setTooltip(null)}
                    onClick={() => setTooltip((prev) => prev?.key === cell.key ? null : { key: cell.key, text: tipText })}
                  >
                    {isToday ? (
                      <span className="absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full bg-(--cf-text-1)" />
                    ) : null}
                    {tooltip?.key === cell.key ? (
                      <span className="pointer-events-none absolute -top-8 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-md border border-(--cf-border) bg-(--cf-surface-strong) px-2 py-1 text-cf-caption text-(--cf-text-2) shadow-shadow-elevated">
                        {tooltip.text}
                        <span className="absolute -bottom-1 left-1/2 h-2 w-2 -translate-x-1/2 rotate-45 border-b border-r border-(--cf-border) bg-(--cf-surface-strong)" />
                      </span>
                    ) : null}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between">
        <div className="flex items-center gap-2 text-cf-caption text-(--cf-text-3)">
          <span>Less</span>
          {HEATMAP_COLORS.map((color, i) => (
            <div key={i} className={cn("h-3.5 w-3.5 rounded-[3px] border border-(--cf-border)", color)} />
          ))}
          <span>More</span>
        </div>
        <span className="text-cf-caption text-(--cf-text-3)">● = today</span>
      </div>
    </div>
  );
}
