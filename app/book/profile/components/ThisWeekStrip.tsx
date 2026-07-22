"use client";

import { cn } from "@/lib/utils";
import { HeatmapCell, todayKey } from "./profile-heatmap";

const SHORT_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function ThisWeekStrip({ cells }: { cells: HeatmapCell[] }) {
  const todayStr = todayKey();
  const todayDate = new Date(`${todayStr}T12:00:00`);
  const todayDow = (todayDate.getDay() + 6) % 7; // 0=Mon

  // Build Mon-Sun for current week
  const weekCells: (HeatmapCell | null)[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(todayDate);
    d.setDate(d.getDate() - todayDow + i);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const cell = cells.find((c) => c.key === key) ?? null;
    weekCells.push(cell);
  }

  return (
    <div className="border-t border-(--cf-divider) pt-3">
      <p className="mb-2 text-cf-caption uppercase tracking-[0.22em] text-(--cf-text-3)">This week</p>
      <div className="flex items-center justify-between gap-1">
        {weekCells.map((cell, i) => {
          const isToday = i === todayDow;
          const isFuture = i > todayDow;
          const hasActivity = cell ? cell.minutes > 0 : false;
          return (
            <div key={i} className="flex flex-col items-center gap-1">
              <span className="text-[10px] text-(--cf-text-3)">{SHORT_DAYS[i]}</span>
              <div
                className={cn(
                  "flex h-7 w-7 items-center justify-center rounded-full text-xs font-medium transition-all",
                  isFuture && "text-(--cf-text-soft)",
                  !isFuture && hasActivity && "bg-accent-emerald/20 text-accent-emerald",
                  !isFuture && !hasActivity && !isToday && "text-(--cf-text-soft)",
                  isToday && !hasActivity && "border border-dashed border-(--cf-accent)/40 text-(--cf-accent)",
                  isToday && hasActivity && "bg-accent-emerald/20 text-accent-emerald ring-1 ring-(--cf-accent)/30"
                )}
              >
                {isFuture ? "○" : hasActivity ? "✓" : isToday ? "●" : "○"}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
