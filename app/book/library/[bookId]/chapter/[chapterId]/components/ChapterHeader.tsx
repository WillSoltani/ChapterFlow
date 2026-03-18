"use client";

import Link from "next/link";
import { ArrowLeft, BookOpen, Focus, NotebookPen } from "lucide-react";
import { FontSizeControls } from "@/app/book/library/[bookId]/chapter/[chapterId]/components/FontSizeControls";
import type { FontScale } from "@/app/book/library/[bookId]/chapter/[chapterId]/hooks/useChapterState";

type ChapterHeaderProps = {
  bookId: string;
  bookTitle: string;
  chapterLabel: string;
  chapterTitle: string;
  author: string;
  minutes: number;
  chapterOrder: number;
  totalChapters: number;
  focusMode: boolean;
  onToggleFocus: () => void;
  onOpenNotes: () => void;
  fontScale: FontScale;
  onChangeFontScale: (value: FontScale) => void;
  trackedMinutesToday?: number;
};

export function ChapterHeader({
  bookId,
  bookTitle,
  chapterLabel,
  chapterTitle,
  author,
  minutes,
  chapterOrder,
  totalChapters,
  focusMode,
  onToggleFocus,
  onOpenNotes,
  fontScale,
  onChangeFontScale,
  trackedMinutesToday = 0,
}: ChapterHeaderProps) {
  const progressPercent = Math.round((chapterOrder / totalChapters) * 100);

  return (
    <header className="space-y-4">
      {/* Nav bar */}
      <div className="flex flex-col gap-3 border-b border-(--cf-divider) pb-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-1.5 text-sm">
          <Link
            href={`/book/library/${encodeURIComponent(bookId)}`}
            className="inline-flex items-center gap-1 rounded-lg border border-(--cf-border) bg-(--cf-surface-muted) px-2.5 py-1 text-(--cf-text-2) transition hover:bg-(--cf-accent-muted) hover:text-(--cf-text-1)"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back
          </Link>
          <span className="text-(--cf-border-strong)">/</span>
          <span className="hidden truncate text-(--cf-text-3) sm:inline">{bookTitle}</span>
          <span className="hidden text-(--cf-border-strong) sm:inline">/</span>
          <span className="truncate text-(--cf-text-2)">{chapterLabel}</span>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
          {/* Chapter progress */}
          <div className="flex items-center gap-2">
            <div className="hidden h-1 w-20 overflow-hidden rounded-full bg-(--cf-border) sm:block">
              <div
                className="h-full rounded-full bg-(--cf-accent) opacity-60 transition-[width] duration-300"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <span className="text-xs text-(--cf-text-3)">{chapterOrder}/{totalChapters}</span>
          </div>

          <button
            type="button"
            onClick={onToggleFocus}
            className={[
              "inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-medium transition",
              focusMode
                ? "border-(--cf-accent-border) bg-(--cf-accent-soft) text-(--cf-info-text)"
                : "border-(--cf-border) bg-(--cf-surface-muted) text-(--cf-text-2) hover:bg-(--cf-surface) hover:text-(--cf-text-1)",
            ].join(" ")}
          >
            <Focus className="h-3.5 w-3.5" />
            Focus
          </button>
          <button
            type="button"
            onClick={onOpenNotes}
            className="inline-flex items-center gap-1.5 rounded-xl border border-(--cf-warning-border) bg-(--cf-warning-soft) px-3 py-1.5 text-xs font-medium text-(--cf-warning-text) transition hover:bg-(--cf-warning-bg)"
          >
            <NotebookPen className="h-3.5 w-3.5" />
            Notes
          </button>
          <FontSizeControls value={fontScale} onChange={onChangeFontScale} />
        </div>
      </div>

      {/* Title block */}
      <div>
        <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-(--cf-accent)">
          <BookOpen className="h-3.5 w-3.5" />
          {bookTitle} · {author}
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-(--cf-text-1) sm:text-4xl">
          {chapterLabel}: {chapterTitle}
        </h1>
        <p className="mt-1.5 text-sm text-(--cf-text-3)">
          Est. {minutes} min read
          {trackedMinutesToday > 0 ? ` · ${trackedMinutesToday} min tracked today` : ""}
        </p>
      </div>
    </header>
  );
}
