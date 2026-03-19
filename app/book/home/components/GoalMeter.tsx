"use client";

import type { ComponentType } from "react";
import { BookCheck, Brain, Flame, Target, Trophy } from "lucide-react";
import { formatMinutesLabel } from "@/app/book/components/GoalPicker";

type GoalMeterProps = {
  goalMinutes: number;
  minutesReadToday: number;
  streakDays?: number;
  totalChapters?: number;
  booksCompleted?: number;
  avgQuizScore?: number;
};

function Divider() {
  return (
    <div className="hidden h-10 w-px shrink-0 bg-(--cf-divider) sm:block" aria-hidden="true" />
  );
}

function StatItem({
  icon: Icon,
  label,
  value,
  subtext,
  iconWrapClass,
  iconClass,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
  subtext: string;
  iconWrapClass: string;
  iconClass: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className={["inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border", iconWrapClass].join(" ")}>
        <Icon className={["h-5 w-5", iconClass].join(" ")} />
      </span>
      <div className="min-w-0">
        <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-(--cf-text-2)">{label}</h3>
        <p className="mt-1 text-xl font-semibold tabular-nums text-(--cf-text-1)">{value}</p>
        <p className="mt-0.5 text-xs text-(--cf-text-3)">{subtext}</p>
      </div>
    </div>
  );
}

export function GoalMeter({
  goalMinutes,
  minutesReadToday,
  streakDays,
  totalChapters,
  booksCompleted,
  avgQuizScore,
}: GoalMeterProps) {
  const progress = Math.min(100, Math.round((minutesReadToday / goalMinutes) * 100));
  const safeProgress = Number.isFinite(progress) ? progress : 0;
  const isComplete = safeProgress >= 100;
  const minsLeft = Math.max(goalMinutes - minutesReadToday, 0);
  const ringColor = isComplete ? "var(--cf-success-text)" : "var(--cf-accent)";

  return (
    <article className="cf-panel rounded-3xl p-5">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-5">

        {/* Daily Goal — visual anchor */}
        <div className="flex items-center gap-4">
          <div
            className="relative h-18 w-18 shrink-0 rounded-full"
            style={{
              background: `conic-gradient(${ringColor} ${safeProgress * 3.6}deg, var(--cf-border) 0deg)`,
              boxShadow: isComplete ? "0 0 18px var(--cf-success-border)" : undefined,
            }}
          >
            <div className="absolute inset-1.5 flex flex-col items-center justify-center rounded-full bg-(--cf-surface-strong)">
              <span className="text-[13px] font-bold leading-none text-(--cf-text-1)">
                {safeProgress}%
              </span>
            </div>
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <Target className="h-3.5 w-3.5 text-(--cf-accent)" />
              <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-(--cf-text-2)">
                Daily Goal
              </h3>
            </div>
            <p className="mt-1 text-xl font-semibold tabular-nums text-(--cf-text-1)">
              {formatMinutesLabel(minutesReadToday)}
              <span className="ml-1 text-sm font-normal text-(--cf-text-3)">
                / {formatMinutesLabel(goalMinutes)}
              </span>
            </p>
            {isComplete ? (
              <p className="mt-0.5 text-xs font-medium text-(--cf-success-text)">Goal reached today ✓</p>
            ) : (
              <p className="mt-0.5 text-xs text-(--cf-text-3)">{minsLeft} min left today</p>
            )}
          </div>
        </div>

        {/* Streak */}
        {typeof streakDays === "number" && (
          <>
            <Divider />
            <StatItem
              icon={Flame}
              label="Streak"
              value={streakDays}
              subtext={streakDays > 0 ? "Keep reading daily" : "Start your streak today"}
              iconWrapClass={streakDays > 0 ? "border-(--cf-warning-border) bg-(--cf-warning-soft)" : "border-(--cf-border) bg-(--cf-surface-muted)"}
              iconClass={streakDays > 0 ? "text-(--cf-warning-text)" : "text-(--cf-text-3)"}
            />
          </>
        )}

        {/* Chapters completed */}
        {typeof totalChapters === "number" && (
          <>
            <Divider />
            <StatItem
              icon={BookCheck}
              label="Chapters"
              value={totalChapters}
              subtext={totalChapters === 1 ? "chapter read" : "chapters read"}
              iconWrapClass={totalChapters > 0 ? "border-(--cf-accent-border) bg-(--cf-accent-soft)" : "border-(--cf-border) bg-(--cf-surface-muted)"}
              iconClass={totalChapters > 0 ? "text-(--cf-accent)" : "text-(--cf-text-3)"}
            />
          </>
        )}

        {/* Books finished */}
        {typeof booksCompleted === "number" && (
          <>
            <Divider />
            <StatItem
              icon={Trophy}
              label="Books"
              value={booksCompleted}
              subtext={booksCompleted === 1 ? "book finished" : "books finished"}
              iconWrapClass={booksCompleted > 0 ? "border-(--cf-warning-border) bg-(--cf-warning-soft)" : "border-(--cf-border) bg-(--cf-surface-muted)"}
              iconClass={booksCompleted > 0 ? "text-(--cf-warning-text)" : "text-(--cf-text-3)"}
            />
          </>
        )}

        {/* Quiz average */}
        {typeof avgQuizScore === "number" && (
          <>
            <Divider />
            <StatItem
              icon={Brain}
              label="Quiz Avg"
              value={avgQuizScore > 0 ? `${Math.round(avgQuizScore)}%` : "—"}
              subtext={avgQuizScore > 0 ? "average score" : "No quizzes yet"}
              iconWrapClass={avgQuizScore >= 80 ? "border-(--cf-success-border) bg-(--cf-success-soft)" : avgQuizScore > 0 ? "border-(--cf-accent-border) bg-(--cf-accent-soft)" : "border-(--cf-border) bg-(--cf-surface-muted)"}
              iconClass={avgQuizScore >= 80 ? "text-(--cf-success-text)" : avgQuizScore > 0 ? "text-(--cf-accent)" : "text-(--cf-text-3)"}
            />
          </>
        )}

      </div>

      {/* Goal progress bar */}
      <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-(--cf-surface-muted)">
        <div
          className="h-full rounded-full transition-[width] duration-500"
          style={{
            width: `${safeProgress}%`,
            backgroundColor: isComplete ? "var(--cf-success-text)" : "var(--cf-accent)",
          }}
        />
      </div>
    </article>
  );
}
