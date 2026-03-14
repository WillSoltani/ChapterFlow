"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { BookSaveButton } from "@/app/book/components/BookSaveButton";
import type { LibraryBookEntry } from "@/app/book/data/mockUserLibraryState";
import { StatTile } from "@/app/book/library/[bookId]/components/StatTile";
import { BookCover } from "@/app/book/components/BookCover";

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
  if (value === "Easy") return "border-emerald-300/28 bg-emerald-400/12 text-emerald-200";
  if (value === "Medium") return "border-amber-300/28 bg-amber-400/12 text-amber-200";
  return "border-rose-300/28 bg-rose-400/12 text-rose-200";
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
    <aside className="rounded-[30px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.07),rgba(255,255,255,0.03))] p-5 shadow-[0_18px_45px_rgba(2,6,23,0.52)] sm:p-6 lg:sticky lg:top-24">
      <div className="relative overflow-hidden rounded-3xl border border-sky-300/25 bg-[linear-gradient(160deg,rgba(56,189,248,0.34),rgba(30,64,175,0.55))] p-4">
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_95%_at_100%_0%,rgba(255,255,255,0.14),transparent_60%)]"
        />
        <BookCover
          bookId={entry.id}
          title={entry.title}
          icon={entry.icon}
          coverImage={entry.coverImage}
          className="h-56 rounded-2xl border border-white/15 bg-black/10 sm:h-72"
          fallbackClassName="text-7xl"
          sizes="320px"
        />
        <span className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full border border-white/20 bg-black/30 px-3 py-1 text-xs text-slate-100">
          App Preview
        </span>
      </div>

      <h1 className="mt-5 text-2xl font-semibold tracking-tight text-slate-50 sm:text-3xl">{entry.title}</h1>
      <p className="mt-1 text-sm text-slate-400">by {entry.author}</p>

      <div className="mt-4 flex flex-wrap gap-2 text-sm">
        <span className="rounded-xl border border-white/25 bg-white/8 px-3 py-1 text-slate-200">
          {entry.category}
        </span>
        <span className={["rounded-xl border px-3 py-1", difficultyChipClass(entry.difficulty)].join(" ")}>
          {entry.difficulty}
        </span>
        <span className="rounded-xl border border-white/25 bg-white/8 px-3 py-1 text-slate-200">
          {pages} pages
        </span>
      </div>

      <div className="mt-4 space-y-2 rounded-2xl border border-white/10 bg-white/3 p-3">
        <p className="text-sm text-slate-200">{synopsis}</p>
        <p className="text-xs text-slate-400">
          Estimated finish pace: about {estimatedDaysToFinish} day{estimatedDaysToFinish === 1 ? "" : "s"} at your daily goal.
        </p>
        <p className="text-xs text-slate-400">{difficultyExplanation}</p>
      </div>

      <div className="mt-5 grid grid-cols-3 gap-2.5">
        <StatTile label="Progress" value={`${progressPercent}%`} accent="sky" />
        <StatTile label="Avg Score" value={`${avgScore}%`} accent="emerald" />
        <StatTile label="Unlocked" value={`${unlockedCount}`} accent="amber" />
      </div>

      <div className="mt-5">
        <div className="flex items-center justify-between text-sm text-slate-300">
          <span>
            {completedCount} of {totalCount} chapters
          </span>
          <span>{progressPercent}%</span>
        </div>
        <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-slate-900/55">
          <div
            className="h-full rounded-full bg-linear-to-r from-sky-300 to-cyan-200 transition-[width] duration-300"
            style={{ width: `${Math.max(progressPercent, 0)}%` }}
          />
        </div>
      </div>

      <div className="mt-5 flex items-center gap-3">
        <button
          type="button"
          onClick={onContinue}
          className="inline-flex flex-1 items-center justify-center rounded-2xl bg-linear-to-r from-sky-500 to-cyan-400 px-4 py-3 text-lg font-semibold text-white shadow-[0_14px_30px_rgba(14,165,233,0.34)] transition hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300/60"
        >
          {progressPercent > 0
            ? `Continue Chapter ${currentChapterOrder} ->`
            : `Start Chapter ${currentChapterOrder} ->`}
        </button>
        <BookSaveButton saved={isSaved} onToggle={onToggleSaved} className="h-12 w-12 rounded-2xl" />
      </div>
      <p className="mt-2 text-sm text-slate-400">Next session: ~{currentChapterMinutes} min</p>

      <div className="mt-6 border-t border-white/10 pt-4">
        <button
          type="button"
          onClick={() => setSettingsOpen((prev) => !prev)}
          className="inline-flex items-center gap-1.5 text-sm text-slate-300 transition hover:text-slate-100"
        >
          {settingsOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          Settings
        </button>

        {settingsOpen ? (
          <div className="mt-3 rounded-2xl border border-rose-400/30 bg-rose-500/8 p-3">
            <p className="text-sm font-medium text-rose-200">Danger zone</p>
            <div className="mt-2 space-y-2">
              <button
                type="button"
                onClick={onResetProgress}
                className="w-full rounded-xl border border-rose-400/40 bg-rose-500/15 px-3 py-2 text-sm font-medium text-rose-100 transition hover:bg-rose-500/22"
              >
                Reset progress
              </button>
              <button
                type="button"
                onClick={onRemoveFromLibrary}
                className="w-full rounded-xl border border-white/20 bg-white/8 px-3 py-2 text-sm text-slate-200 transition hover:bg-white/12"
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
