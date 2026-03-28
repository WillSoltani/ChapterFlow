"use client";

import type { BookCatalogItem } from "@/app/book/data/booksCatalog";
import type { BookStatus, RecentBookProgress } from "@/app/book/data/mockProgress";
import { BookCover } from "@/app/book/components/BookCover";

const statusStyles: Record<BookStatus, string> = {
  completed: "border-(--cf-success-border) bg-(--cf-success-soft) text-(--cf-success-text)",
  in_progress: "border-(--cf-accent-border) bg-(--cf-accent-soft) text-(--cf-info-text)",
  not_started: "border-(--cf-border) bg-(--cf-surface-muted) text-(--cf-text-2)",
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
      className="group w-full rounded-3xl border border-(--cf-border) bg-(--cf-surface) p-4 text-left shadow-shadow-card transition duration-200 hover:-translate-y-0.5 hover:border-(--cf-border-strong) hover:shadow-shadow-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--cf-accent-border)"
    >
      <div className="flex items-start justify-between gap-3">
        <BookCover
          bookId={book.id}
          title={book.title}
          icon={book.icon}
          coverImage={book.coverImage}
          className="h-12 w-11 rounded-xl border border-(--cf-border) bg-(--cf-surface-muted)"
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

      <h4 className="mt-4 text-lg font-semibold text-(--cf-text-1)">{book.title}</h4>
      <p className="text-sm text-(--cf-text-2)">{book.author}</p>
      <p className="mt-2 text-xs text-(--cf-text-3)">
        {progress.chapter > 0
          ? `Chapter ${progress.chapter} of ${progress.totalChapters}`
          : `${progress.totalChapters} chapters`}
      </p>

      <div className="mt-3 h-2 overflow-hidden rounded-full bg-(--cf-border)">
        <div
          className="h-full rounded-full bg-linear-to-r from-(--cf-accent) to-(--cf-accent-strong)"
          style={{ width: `${Math.max(progress.progressPercent, 0)}%` }}
        />
      </div>
      <p className="mt-2 text-xs text-(--cf-text-3)">{progress.progressPercent}% progress</p>
    </button>
  );
}
