"use client";

import { useState } from "react";
import { ArrowRight, ChevronDown, ChevronUp } from "lucide-react";
import { BookSaveButton } from "@/app/book/components/BookSaveButton";
import { StatTile } from "@/app/book/library/[bookId]/components/StatTile";
import { BookCover } from "@/app/book/components/BookCover";
import type { LibraryBookEntry } from "@/app/book/_lib/library-data";

type BookOverviewPanelProps = {
  entry: LibraryBookEntry;
  pages: number;
  synopsis: string;
  estimatedDaysToFinish: number;
  progressPercent: number;
  avgScore: number;
  unlockedCount: number;
  completedCount: number;
  totalCount: number;
  currentChapterOrder: number;
  currentChapterMinutes: number;
  onContinue: () => void;
  isSaved: boolean;
  onToggleSaved: () => void;
  onResetProgress: () => void;
  onRemoveFromLibrary: () => void;
};

function difficultyChipClass(value: LibraryBookEntry["difficulty"]): string {
  if (value === "Easy") return "cf-pill cf-pill-success";
  if (value === "Medium") return "cf-pill cf-pill-warning";
  return "cf-pill cf-pill-danger";
}

export function BookOverviewPanel({
  entry,
  pages,
  synopsis,
  estimatedDaysToFinish,
  progressPercent,
  avgScore,
  unlockedCount,
  completedCount,
  totalCount,
  currentChapterOrder,
  currentChapterMinutes,
  onContinue,
  isSaved,
  onToggleSaved,
  onResetProgress,
  onRemoveFromLibrary,
}: BookOverviewPanelProps) {
  const [settingsOpen, setSettingsOpen] = useState(false);

  const difficultyExplanation =
    entry.difficulty === "Easy"
      ? "Accessible concepts with light implementation effort."
      : entry.difficulty === "Medium"
        ? "Balanced depth with practical strategy and execution."
        : "Dense concepts requiring slower, deliberate study sessions.";

  return (
    <aside className="cf-panel rounded-[30px] p-5 sm:p-6 lg:sticky lg:top-24">
      <div className="relative overflow-hidden rounded-3xl border border-(--cf-accent-border) bg-[linear-gradient(160deg,var(--cf-accent-soft),var(--cf-surface-strong))] p-4">
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_95%_at_100%_0%,rgba(255,255,255,0.14),transparent_60%)]"
        />
        <BookCover
          bookId={entry.id}
          title={entry.title}
          icon={entry.icon}
          coverImage={entry.coverImage}
          className="h-56 rounded-2xl border border-(--cf-border) bg-black/5 sm:h-72"
          fallbackClassName="text-7xl"
          sizes="320px"
        />
        <span className="cf-pill absolute bottom-4 left-1/2 -translate-x-1/2 border-white/20 bg-black/30 px-3 py-1 text-xs text-white">
          App Preview
        </span>
      </div>

      <h1 className="mt-5 text-2xl font-semibold tracking-tight text-(--cf-text-1) sm:text-3xl">{entry.title}</h1>
      <p className="mt-1 text-sm text-(--cf-text-3)">by {entry.author}</p>

      <div className="mt-4 flex flex-wrap gap-2 text-sm">
        <span className="cf-pill rounded-xl px-3 py-1">
          {entry.category}
        </span>
        <span className={["rounded-xl px-3 py-1", difficultyChipClass(entry.difficulty)].join(" ")}>
          {entry.difficulty}
        </span>
        <span className="cf-pill rounded-xl px-3 py-1">
          {pages} pages
        </span>
      </div>

      <div className="cf-panel-muted mt-4 space-y-2 rounded-2xl p-3">
        <p className="text-sm text-(--cf-text-2)">{synopsis}</p>
        <p className="text-xs text-(--cf-text-3)">
          Estimated finish pace: about {estimatedDaysToFinish} day{estimatedDaysToFinish === 1 ? "" : "s"} at your daily goal.
        </p>
        <p className="text-xs text-(--cf-text-3)">{difficultyExplanation}</p>
      </div>

      <div className="mt-5 grid grid-cols-3 gap-2.5">
        <StatTile label="Progress" value={`${progressPercent}%`} accent="sky" />
        <StatTile label="Avg Score" value={`${avgScore}%`} accent="emerald" />
        <StatTile label="Unlocked" value={`${unlockedCount}`} accent="amber" />
      </div>

      <div className="mt-5">
        <div className="flex items-center justify-between text-sm text-(--cf-text-2)">
          <span>
            {completedCount} of {totalCount} chapters
          </span>
          <span>{progressPercent}%</span>
        </div>
        <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-(--cf-border)">
          <div
            className="h-full rounded-full bg-linear-to-r from-(--cf-accent) to-(--cf-accent-strong) transition-[width] duration-300"
            style={{ width: `${Math.max(progressPercent, 0)}%` }}
          />
        </div>
      </div>

      <div className="mt-5 flex items-center gap-3">
        <button
          type="button"
          onClick={onContinue}
          className="cf-btn cf-btn-primary flex-1 rounded-2xl px-4 py-3 text-lg"
        >
          <span>
            {progressPercent > 0
              ? `Continue Chapter ${currentChapterOrder}`
              : `Start Chapter ${currentChapterOrder}`}
          </span>
          <ArrowRight className="h-4.5 w-4.5" />
        </button>
        <BookSaveButton saved={isSaved} onToggle={onToggleSaved} className="h-12 w-12 rounded-2xl" />
      </div>
      <p className="mt-2 text-sm text-(--cf-text-3)">Next session: ~{currentChapterMinutes} min</p>

      <div className="mt-6 border-t border-(--cf-divider) pt-4">
        <button
          type="button"
          onClick={() => setSettingsOpen((prev) => !prev)}
          className="inline-flex items-center gap-1.5 text-sm text-(--cf-text-2) transition hover:text-(--cf-text-1)"
        >
          {settingsOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          Settings
        </button>

        {settingsOpen ? (
          <div className="cf-banner cf-banner-danger mt-3 rounded-2xl p-3">
            <p className="text-sm font-medium">Danger zone</p>
            <div className="mt-2 space-y-2">
              <button
                type="button"
                onClick={onResetProgress}
                className="cf-btn cf-btn-danger w-full rounded-xl px-3 py-2 text-sm font-medium"
              >
                Reset progress
              </button>
              <button
                type="button"
                onClick={onRemoveFromLibrary}
                className="cf-btn cf-btn-secondary w-full rounded-xl px-3 py-2 text-sm"
              >
                Remove from library
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </aside>
  );
}
