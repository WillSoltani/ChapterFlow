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
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--cf-accent-soft)",
        current
          ? "border-(--cf-accent-border) bg-(--cf-accent-muted) shadow-[0_0_0_1px_var(--cf-accent-soft)]"
          : completed
            ? "border-(--cf-success-border) bg-(--cf-success-bg) hover:border-(--cf-success-border)"
            : "border-(--cf-border) bg-(--cf-surface)",
        locked
          ? "cursor-not-allowed opacity-40"
          : "hover:-translate-y-0.5 hover:border-(--cf-border-strong)",
      ].join(" ")}
      aria-disabled={locked}
    >
      <div className="flex items-center gap-3">
        <span
          className={[
            "inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border",
            completed
              ? "border-(--cf-success-border) bg-(--cf-success-bg) text-(--cf-success-text)"
              : current
                ? "border-(--cf-accent-border) bg-(--cf-accent-soft) text-(--cf-accent)"
                : "border-(--cf-border) bg-(--cf-surface-muted) text-(--cf-text-3)",
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
            <span className="text-sm font-medium tracking-wide text-(--cf-text-3)">{chapter.code}</span>
            <span className="truncate text-2xl font-semibold text-(--cf-text-1)">{chapter.title}</span>
          </div>
        </div>

        <div className="ml-2 flex items-center gap-3">
          {typeof score === "number" ? (
            <span className="cf-pill cf-pill-success rounded-xl px-2.5 py-1 text-sm font-semibold">
              {Math.round(score)}%
            </span>
          ) : null}
          <span className="whitespace-nowrap text-lg text-(--cf-text-3)">{chapter.minutes} min</span>
        </div>
      </div>
    </button>
  );
}
