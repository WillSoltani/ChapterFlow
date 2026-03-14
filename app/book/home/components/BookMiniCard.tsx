"use client";

import type { BookCatalogItem } from "@/app/book/data/booksCatalog";
import type { BookStatus, RecentBookProgress } from "@/app/book/data/mockProgress";
import { BookCover } from "@/app/book/components/BookCover";

const statusStyles: Record<BookStatus, string> = {
  completed: "border-emerald-300/30 bg-emerald-400/12 text-emerald-200",
  in_progress: "border-sky-300/30 bg-sky-400/12 text-sky-200",
  not_started: "border-white/20 bg-white/8 text-slate-300",
};

const statusLabel: Record<BookStatus, string> = {
  completed: "Completed",
  in_progress: "In Progress",
  not_started: "Not Started",
};

type BookMiniCardProps = {
  book: BookCatalogItem;
  progress: RecentBookProgress;
  onOpen: () => void;
};

export function BookMiniCard({ book, progress, onOpen }: BookMiniCardProps) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group w-full rounded-3xl border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.07),rgba(255,255,255,0.03))] p-4 text-left transition duration-200 hover:-translate-y-0.5 hover:border-white/20 hover:shadow-[0_14px_35px_rgba(2,6,23,0.5)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300/45"
    >
      <div className="flex items-start justify-between gap-3">
        <BookCover
          bookId={book.id}
          title={book.title}
          icon={book.icon}
          coverImage={book.coverImage}
          className="h-12 w-11 rounded-xl border border-white/15 bg-white/8"
          fallbackClassName="text-2xl"
          sizes="44px"
        />
        <span
          className={[
            "inline-flex rounded-full border px-2.5 py-1 text-[11px] font-medium",
            statusStyles[progress.status],
          ].join(" ")}
        >
          {statusLabel[progress.status]}
        </span>
      </div>

      <h4 className="mt-4 text-lg font-semibold text-slate-100">{book.title}</h4>
      <p className="text-sm text-slate-300">{book.author}</p>
      <p className="mt-2 text-xs text-slate-400">
        {progress.chapter > 0
          ? `Chapter ${progress.chapter} of ${progress.totalChapters}`
          : `${progress.totalChapters} chapters`}
      </p>

      <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-900/45">
        <div
          className="h-full rounded-full bg-linear-to-r from-sky-300 to-cyan-200"
          style={{ width: `${Math.max(progress.progressPercent, 0)}%` }}
        />
      </div>
      <p className="mt-2 text-xs text-slate-400">{progress.progressPercent}% progress</p>
    </button>
  );
}
