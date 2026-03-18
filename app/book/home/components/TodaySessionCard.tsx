"use client";

import { CheckCircle2, Circle, Clock3, PlayCircle, Zap } from "lucide-react";
import type { SessionTask } from "@/app/book/data/mockProgress";

type TodaySessionCardProps = {
  tasks: SessionTask[];
  onToggleTask: (taskId: string) => void;
  onStartSession: () => void;
};

export function TodaySessionCard({
  tasks,
  onToggleTask,
  onStartSession,
}: TodaySessionCardProps) {
  const totalMinutes = tasks.reduce((sum, item) => sum + item.minutes, 0);
  const completedCount = tasks.filter((t) => t.complete).length;
  const allDone = completedCount === tasks.length && tasks.length > 0;

  return (
    <article className="cf-panel flex flex-col rounded-[30px] p-5 sm:p-6">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-lg font-semibold text-(--cf-text-1)">Today&apos;s Session</h3>
          <p className="mt-0.5 text-sm text-(--cf-text-3)">
            {completedCount}/{tasks.length} tasks done
          </p>
        </div>
        <span className="inline-flex items-center gap-1 rounded-full border border-(--cf-warning-border) bg-(--cf-warning-soft) px-2.5 py-1 text-xs font-semibold text-(--cf-warning-text)">
          <Zap className="h-3 w-3" />
          ~{totalMinutes} min
        </span>
      </div>

      {/* Session progress bar */}
      <div className="mt-3 h-1 w-full overflow-hidden rounded-full bg-(--cf-surface-muted)">
        <div
          className="h-full rounded-full bg-(--cf-warning-text) transition-[width] duration-500"
          style={{ width: tasks.length ? `${(completedCount / tasks.length) * 100}%` : "0%" }}
        />
      </div>

      <ul className="mt-4 flex-1 space-y-2">
        {tasks.map((task) => (
          <li key={task.id}>
            <button
              type="button"
              onClick={() => onToggleTask(task.id)}
              className={[
                "flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition duration-150",
                task.complete
                  ? "border-(--cf-success-border) bg-(--cf-success-soft) opacity-75"
                  : "border-(--cf-border) bg-(--cf-surface-muted) hover:border-(--cf-border-strong) hover:bg-(--cf-input-bg-hover)",
              ].join(" ")}
            >
              {task.complete ? (
                <CheckCircle2 className="h-4 w-4 shrink-0 text-(--cf-success-text)" />
              ) : (
                <Circle className="h-4 w-4 shrink-0 text-(--cf-text-3)" />
              )}
              <span
                className={[
                  "min-w-0 flex-1 text-sm",
                  task.complete ? "text-(--cf-text-3) line-through" : "text-(--cf-text-2)",
                ].join(" ")}
              >
                {task.label}
              </span>
              <span className="inline-flex shrink-0 items-center gap-1 text-xs text-(--cf-text-3)">
                <Clock3 className="h-3 w-3" />
                {task.minutes}m
              </span>
            </button>
          </li>
        ))}
      </ul>

      <button
        type="button"
        onClick={onStartSession}
        className={[
          "mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold transition",
          allDone
            ? "cf-btn cf-btn-success"
            : "cf-btn border-(--cf-warning-border) bg-amber-500 text-white shadow-[0_12px_24px_rgba(245,158,11,0.22)] hover:bg-amber-400",
        ].join(" ")}
      >
        <PlayCircle className="h-4 w-4" />
        {allDone ? "Session complete" : "Start Session"}
      </button>
    </article>
  );
}
