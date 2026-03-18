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
    <article className="cf-panel group relative overflow-hidden rounded-[30px] border-(--cf-accent-border) bg-[linear-gradient(135deg,var(--cf-accent-soft),var(--cf-surface-strong))] p-5 sm:p-7">
      {/* Ambient glow */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -right-16 -top-24 h-72 w-72 rounded-full bg-(--cf-accent-soft) blur-3xl transition duration-700"
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-12 -left-12 h-56 w-56 rounded-full bg-(--cf-accent-muted) blur-3xl"
      />

      <div className="relative flex flex-col gap-6 sm:flex-row sm:items-start">
        {/* Cover */}
        <div className="shrink-0">
          <BookCover
            bookId={book.id}
            title={book.title}
            icon={book.icon}
            coverImage={book.coverImage}
            className="h-32 w-24 rounded-2xl border border-(--cf-border) bg-(--cf-surface-strong) shadow-(--cf-shadow-sm) transition duration-300 group-hover:shadow-(--cf-shadow-md)"
            fallbackClassName="text-4xl"
            sizes="96px"
          />
        </div>

        {/* Content */}
        <div className="min-w-0 flex-1">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-(--cf-accent-border) bg-(--cf-accent-soft) px-2.5 py-0.5 text-xs font-semibold uppercase tracking-[0.14em] text-(--cf-accent)">
            <BookOpenText className="h-3 w-3" />
            {sectionLabel}
          </span>

          <h2 className="mt-2.5 text-2xl font-semibold tracking-tight text-(--cf-text-1) sm:text-3xl">
            {book.title}
          </h2>
          <p className="mt-0.5 text-sm text-(--cf-accent)/85">by {book.author}</p>

          {/* Progress bar */}
          <div className="mt-4">
            <div className="flex items-center justify-between text-xs text-(--cf-text-2)">
              <span>Chapter {progress.chapter} of {progress.totalChapters}</span>
              <span className="font-semibold text-(--cf-accent)">{progress.progressPercent}%</span>
            </div>
            <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-(--cf-surface-muted)">
              <div
                className="h-full rounded-full bg-linear-to-r from-(--cf-accent) to-(--cf-accent-strong) shadow-[0_0_8px_var(--cf-accent-shadow)] transition-[width] duration-500"
                style={{ width: `${Math.max(progress.progressPercent, 0)}%` }}
              />
            </div>
          </div>

          {/* Meta pills */}
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-(--cf-text-2)">
            <span className="inline-flex items-center gap-1 rounded-lg border border-(--cf-border) bg-(--cf-surface-muted) px-2.5 py-1">
              <Clock className="h-3 w-3 text-(--cf-text-3)" />
              ~{remainingMinutes} min left
            </span>
            <span className="inline-flex items-center gap-1 rounded-lg border border-(--cf-border) bg-(--cf-surface-muted) px-2.5 py-1">
              <Layers className="h-3 w-3 text-(--cf-text-3)" />
              {chaptersLeft} chapter{chaptersLeft !== 1 ? "s" : ""} remaining
            </span>
          </div>

          {/* CTA */}
          <div className="mt-5">
            <button
              type="button"
              onClick={onContinue}
              className="cf-btn cf-btn-primary rounded-2xl px-5 py-2.5 text-sm"
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
