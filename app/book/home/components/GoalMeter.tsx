"use client";

import { Target } from "lucide-react";
import { formatMinutesLabel } from "@/app/book/components/GoalPicker";

type GoalMeterProps = {
  goalMinutes: number;
  minutesReadToday: number;
};

export function GoalMeter({
  goalMinutes,
  minutesReadToday,
}: GoalMeterProps) {
  const progress = Math.min(100, Math.round((minutesReadToday / goalMinutes) * 100));
  const safeProgress = Number.isFinite(progress) ? progress : 0;
  const isComplete = safeProgress >= 100;
  const minsLeft = Math.max(goalMinutes - minutesReadToday, 0);

  const ringColor = isComplete ? "var(--cf-success-text)" : "var(--cf-accent)";

  return (
    <article className="cf-panel flex flex-col rounded-3xl p-5">
      <div className="flex items-center gap-2">
        <Target className="h-4 w-4 text-(--cf-accent)" />
        <h3 className="text-sm font-semibold uppercase tracking-[0.12em] text-(--cf-text-2)">
          Daily Goal
        </h3>
      </div>

      <div className="mt-4 flex flex-1 items-center gap-4">
        {/* Ring */}
        <div
          className="relative h-18 w-18 shrink-0 rounded-full"
          style={{
            background: `conic-gradient(${ringColor} ${safeProgress * 3.6}deg, var(--cf-border) 0deg)`,
            boxShadow: isComplete ? "0 0 18px rgba(52,211,153,0.28)" : undefined,
          }}
        >
          {/* Inner circle */}
          <div className="absolute inset-1.5 flex flex-col items-center justify-center rounded-full bg-(--cf-surface-strong)">
            <span className="text-[13px] font-bold leading-none text-(--cf-text-1)">
              {safeProgress}%
            </span>
          </div>
        </div>

        <div className="min-w-0">
          <p className="text-xl font-semibold tabular-nums text-(--cf-text-1)">
            {formatMinutesLabel(minutesReadToday)}
            <span className="ml-1 text-sm font-normal text-(--cf-text-3)">
              / {formatMinutesLabel(goalMinutes)}
            </span>
          </p>
          {isComplete ? (
            <p className="mt-1 text-xs font-medium text-(--cf-success-text)">Goal reached today ✓</p>
          ) : (
            <p className="mt-1 text-xs text-(--cf-text-3)">{minsLeft} min left today</p>
          )}
        </div>
      </div>

      {/* Progress bar */}
      <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-(--cf-surface-muted)">
        <div
          className="h-full rounded-full transition-[width] duration-500"
          style={{ width: `${safeProgress}%`, backgroundColor: isComplete ? "var(--cf-success-text)" : "var(--cf-accent)" }}
        />
      </div>

      <p className="mt-4 rounded-xl border border-(--cf-border) bg-(--cf-surface-muted) px-3 py-2 text-xs leading-5 text-(--cf-text-3)">
        Goal progress uses tracked active reading time while the chapter is visible and you are actively engaged.
      </p>
    </article>
  );
}
