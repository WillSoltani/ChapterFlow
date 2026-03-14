"use client";

import { ArrowRight, BookOpenText, Clock, Layers } from "lucide-react";
import type { BookCatalogItem } from "@/app/book/data/booksCatalog";
import type { RecentBookProgress } from "@/app/book/data/mockProgress";
import { BookCover } from "@/app/book/components/BookCover";

function estimateMinutesRemaining(
  book: BookCatalogItem,
  progress: RecentBookProgress,
  dailyGoalMinutes: number
) {
  const chapterBudget = Math.max(10, Math.round(book.estimatedMinutes / progress.totalChapters));
  const chapterCompletion = progress.progressPercent / 100;
  const remainingChapterMinutes = Math.max(4, Math.round(chapterBudget * (1 - chapterCompletion)));
  return Math.min(remainingChapterMinutes, Math.max(6, dailyGoalMinutes));
}

type CurrentlyReadingCardProps = {
  book: BookCatalogItem;
  progress: RecentBookProgress;
  dailyGoalMinutes: number;
  onContinue: () => void;
};

export function CurrentlyReadingCard({
  book,
  progress,
  dailyGoalMinutes,
  onContinue,
}: CurrentlyReadingCardProps) {
  const remainingMinutes = estimateMinutesRemaining(book, progress, dailyGoalMinutes);
  const chaptersLeft =
    progress.status === "not_started"
      ? progress.totalChapters
      : Math.max(progress.totalChapters - progress.chapter, 0);
  const ctaLabel =
    progress.status === "not_started"
      ? `Start Chapter ${progress.chapter}`
      : `Continue Chapter ${progress.chapter}`;
  const sectionLabel =
    progress.status === "not_started" ? "Ready to Start" : "Currently Reading";

  return (
    <article className="group relative overflow-hidden rounded-[30px] border border-sky-300/25 bg-[linear-gradient(135deg,rgba(14,116,144,0.32),rgba(15,23,42,0.88))] p-5 shadow-[0_20px_60px_rgba(2,132,199,0.28)] sm:p-7">
      {/* Ambient glow */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -right-16 -top-24 h-72 w-72 rounded-full bg-sky-400/10 blur-3xl transition duration-700 group-hover:bg-sky-400/16"
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-12 -left-12 h-56 w-56 rounded-full bg-cyan-500/8 blur-3xl"
      />

      <div className="relative flex flex-col gap-6 sm:flex-row sm:items-start">
        {/* Cover */}
        <div className="shrink-0">
          <BookCover
            bookId={book.id}
            title={book.title}
            icon={book.icon}
            coverImage={book.coverImage}
            className="h-32 w-24 rounded-2xl border border-white/20 bg-white/8 shadow-[0_12px_30px_rgba(2,6,23,0.45)] transition duration-300 group-hover:shadow-[0_16px_36px_rgba(14,165,233,0.30)]"
            fallbackClassName="text-4xl"
            sizes="96px"
          />
        </div>

        {/* Content */}
        <div className="min-w-0 flex-1">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-sky-300/40 bg-sky-300/14 px-2.5 py-0.5 text-xs font-semibold uppercase tracking-[0.14em] text-sky-100">
            <BookOpenText className="h-3 w-3" />
            {sectionLabel}
          </span>

          <h2 className="mt-2.5 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
            {book.title}
          </h2>
          <p className="mt-0.5 text-sm text-sky-200/80">by {book.author}</p>

          {/* Progress bar */}
          <div className="mt-4">
            <div className="flex items-center justify-between text-xs text-slate-300">
              <span>Chapter {progress.chapter} of {progress.totalChapters}</span>
              <span className="font-semibold text-sky-200">{progress.progressPercent}%</span>
            </div>
            <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-slate-900/50">
              <div
                className="h-full rounded-full bg-linear-to-r from-sky-400 to-cyan-300 shadow-[0_0_8px_rgba(56,189,248,0.5)] transition-[width] duration-500"
                style={{ width: `${Math.max(progress.progressPercent, 0)}%` }}
              />
            </div>
          </div>

          {/* Meta pills */}
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-300">
            <span className="inline-flex items-center gap-1 rounded-lg border border-white/12 bg-white/5 px-2.5 py-1">
              <Clock className="h-3 w-3 text-slate-400" />
              ~{remainingMinutes} min left
            </span>
            <span className="inline-flex items-center gap-1 rounded-lg border border-white/12 bg-white/5 px-2.5 py-1">
              <Layers className="h-3 w-3 text-slate-400" />
              {chaptersLeft} chapter{chaptersLeft !== 1 ? "s" : ""} remaining
            </span>
          </div>

          {/* CTA */}
          <div className="mt-5">
            <button
              type="button"
              onClick={onContinue}
              className="inline-flex items-center gap-2 rounded-2xl bg-linear-to-r from-sky-500 to-cyan-400 px-5 py-2.5 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(14,165,233,0.42)] transition hover:brightness-105 hover:shadow-[0_14px_28px_rgba(14,165,233,0.50)] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300/60"
            >
              {ctaLabel}
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}
