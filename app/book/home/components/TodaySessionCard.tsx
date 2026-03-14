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
    <article className="flex flex-col rounded-[30px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0.03))] p-5 shadow-[0_16px_42px_rgba(2,6,23,0.48)] sm:p-6">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-lg font-semibold text-slate-100">Today&apos;s Session</h3>
          <p className="mt-0.5 text-sm text-slate-400">
            {completedCount}/{tasks.length} tasks done
          </p>
        </div>
        <span className="inline-flex items-center gap-1 rounded-full border border-amber-300/30 bg-amber-400/10 px-2.5 py-1 text-xs font-semibold text-amber-200">
          <Zap className="h-3 w-3" />
          ~{totalMinutes} min
        </span>
      </div>

      {/* Session progress bar */}
      <div className="mt-3 h-1 w-full overflow-hidden rounded-full bg-slate-800/60">
        <div
          className="h-full rounded-full bg-amber-400 transition-[width] duration-500"
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
                  ? "border-emerald-300/20 bg-emerald-500/8 opacity-70"
                  : "border-white/8 bg-white/3 hover:border-white/15 hover:bg-white/6",
              ].join(" ")}
            >
              {task.complete ? (
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
              ) : (
                <Circle className="h-4 w-4 shrink-0 text-slate-500" />
              )}
              <span
                className={[
                  "min-w-0 flex-1 text-sm",
                  task.complete ? "text-slate-500 line-through" : "text-slate-200",
                ].join(" ")}
              >
                {task.label}
              </span>
              <span className="inline-flex shrink-0 items-center gap-1 text-xs text-slate-500">
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
          "mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2",
          allDone
            ? "border border-emerald-300/35 bg-emerald-500/16 text-emerald-100 focus-visible:ring-emerald-300/50"
            : "bg-linear-to-r from-amber-400 to-yellow-300 text-slate-900 shadow-[0_12px_24px_rgba(250,204,21,0.32)] hover:brightness-105 focus-visible:ring-amber-300/60",
        ].join(" ")}
      >
        <PlayCircle className="h-4 w-4" />
        {allDone ? "Session complete" : "Start Session"}
      </button>
    </article>
  );
}
