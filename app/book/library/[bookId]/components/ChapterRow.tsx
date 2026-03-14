"use client";

import { Check, Lock, Play } from "lucide-react";
import type { BookChapter } from "@/app/book/data/mockChapters";

export type ChapterRowState = "completed" | "current" | "locked";

type ChapterRowProps = {
  chapter: BookChapter;
  state: ChapterRowState;
  score?: number;
  onClick: () => void;
  hint?: string;
};

export function ChapterRow({ chapter, state, score, onClick, hint }: ChapterRowProps) {
  const locked = state === "locked";
  const completed = state === "completed";
  const current = state === "current";

  return (
    <button
      type="button"
      onClick={onClick}
      title={locked ? hint : undefined}
      className={[
        "group w-full rounded-2xl border px-4 py-3 text-left transition duration-200",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300/45",
        current
          ? "border-sky-300/40 bg-sky-500/10 shadow-[0_0_0_1px_rgba(56,189,248,0.25)]"
          : completed
            ? "border-emerald-300/20 bg-emerald-500/6 hover:border-emerald-300/30"
            : "border-white/8 bg-white/2",
        locked
          ? "cursor-not-allowed opacity-40"
          : "hover:-translate-y-0.5 hover:border-white/20",
      ].join(" ")}
      aria-disabled={locked}
    >
      <div className="flex items-center gap-3">
        <span
          className={[
            "inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border",
            completed
              ? "border-emerald-300/30 bg-emerald-400/12 text-emerald-200"
              : current
                ? "border-sky-300/30 bg-sky-400/12 text-sky-200"
                : "border-white/12 bg-white/5 text-slate-400",
          ].join(" ")}
        >
          {completed ? (
            <Check className="h-5 w-5" />
          ) : current ? (
            <Play className="h-5 w-5" />
          ) : (
            <Lock className="h-5 w-5" />
          )}
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium tracking-wide text-slate-400">{chapter.code}</span>
            <span className="truncate text-2xl font-semibold text-slate-100">{chapter.title}</span>
          </div>
        </div>

        <div className="ml-2 flex items-center gap-3">
          {typeof score === "number" ? (
            <span className="rounded-xl border border-emerald-300/25 bg-emerald-400/12 px-2.5 py-1 text-sm font-semibold text-emerald-200">
              {Math.round(score)}%
            </span>
          ) : null}
          <span className="whitespace-nowrap text-lg text-slate-400">{chapter.minutes} min</span>
        </div>
      </div>
    </button>
  );
}
