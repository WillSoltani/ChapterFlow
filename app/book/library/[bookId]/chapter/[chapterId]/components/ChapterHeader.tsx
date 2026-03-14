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
      <div className="flex flex-col gap-3 border-b border-white/8 pb-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-1.5 text-sm">
          <Link
            href={`/book/library/${encodeURIComponent(bookId)}`}
            className="inline-flex items-center gap-1 rounded-lg border border-white/12 bg-white/4 px-2.5 py-1 text-slate-300 transition hover:bg-white/8 hover:text-slate-100"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back
          </Link>
          <span className="text-slate-600">/</span>
          <span className="hidden truncate text-slate-500 sm:inline">{bookTitle}</span>
          <span className="hidden text-slate-600 sm:inline">/</span>
          <span className="truncate text-slate-300">{chapterLabel}</span>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
          {/* Chapter progress */}
          <div className="flex items-center gap-2">
            <div className="hidden h-1 w-20 overflow-hidden rounded-full bg-slate-800 sm:block">
              <div
                className="h-full rounded-full bg-sky-500/60 transition-[width] duration-300"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <span className="text-xs text-slate-500">{chapterOrder}/{totalChapters}</span>
          </div>

          <button
            type="button"
            onClick={onToggleFocus}
            className={[
              "inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-medium transition",
              focusMode
                ? "border-sky-300/40 bg-sky-500/16 text-sky-100"
                : "border-white/15 bg-white/5 text-slate-300 hover:bg-white/8 hover:text-slate-100",
            ].join(" ")}
          >
            <Focus className="h-3.5 w-3.5" />
            Focus
          </button>
          <button
            type="button"
            onClick={onOpenNotes}
            className="inline-flex items-center gap-1.5 rounded-xl border border-amber-300/30 bg-amber-500/10 px-3 py-1.5 text-xs font-medium text-amber-200 transition hover:bg-amber-500/16"
          >
            <NotebookPen className="h-3.5 w-3.5" />
            Notes
          </button>
          <FontSizeControls value={fontScale} onChange={onChangeFontScale} />
        </div>
      </div>

      {/* Title block */}
      <div>
        <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-sky-400/80">
          <BookOpen className="h-3.5 w-3.5" />
          {bookTitle} · {author}
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-50 sm:text-4xl">
          {chapterLabel}: {chapterTitle}
        </h1>
        <p className="mt-1.5 text-sm text-slate-500">
          Est. {minutes} min read
          {trackedMinutesToday > 0 ? ` · ${trackedMinutesToday} min tracked today` : ""}
        </p>
      </div>
    </header>
  );
}
