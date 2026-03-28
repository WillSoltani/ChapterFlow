"use client";

import { CheckCircle2, Clock3 } from "lucide-react";
import type { BookCatalogItem } from "@/app/book/data/booksCatalog";
import { BookCover } from "@/app/book/components/BookCover";

const difficultyStyles: Record<BookCatalogItem["difficulty"], string> = {
  Easy: "border-(--cf-success-border) bg-(--cf-success-soft) text-(--cf-success-text)",
  Medium: "border-(--cf-warning-border) bg-(--cf-warning-soft) text-(--cf-warning-text)",
  Hard: "border-(--cf-danger-border) bg-(--cf-danger-soft) text-(--cf-danger-text)",
};

function estimatedTimeLabel(minutes: number): string {
  const hours = minutes / 60;
  if (hours >= 1) {
    const rounded = Math.round(hours * 10) / 10;
    return `~${rounded} hours`;
  }
  return `~${minutes} min`;
}

type BookCardProps = {
  book: BookCatalogItem;
  selected: boolean;
  disabled?: boolean;
  onSelect: () => void;
};

export function BookCard({
  book,
  selected,
  disabled = false,
  onSelect,
}: BookCardProps) {
  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={disabled}
      aria-pressed={selected}
      aria-label={`Select ${book.title} by ${book.author}`}
      className={[
        "group relative w-full overflow-hidden rounded-3xl border p-5 text-left transition duration-200 sm:p-6",
        "bg-(--cf-surface)",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--cf-accent-border)",
        selected
          ? "border-(--cf-accent-border) bg-(--cf-accent-soft) shadow-[0_0_0_2px_var(--cf-accent-border),0_8px_28px_var(--cf-accent-shadow)]"
          : "border-(--cf-border) hover:-translate-y-0.5 hover:border-(--cf-border-strong) hover:shadow-shadow-card",
        disabled && !selected ? "cursor-not-allowed opacity-45" : "",
      ].join(" ")}
    >
      <BookCover
        bookId={book.id}
        title={book.title}
        icon={book.icon}
        coverImage={book.coverImage}
        className="h-14 w-12 rounded-xl border border-(--cf-border) bg-(--cf-surface-muted)"
        fallbackClassName="text-3xl"
        sizes="48px"
      />

      {selected ? (
        <span className="absolute right-4 top-4 text-(--cf-accent)" aria-hidden="true">
          <CheckCircle2 className="h-6 w-6" />
        </span>
      ) : null}

      <h3 className="mt-6 text-2xl font-semibold tracking-tight text-(--cf-text-1)">
        {book.title}
      </h3>
      <p className="mt-1 text-lg text-(--cf-text-2)">{book.author}</p>

      <div className="mt-5 flex flex-wrap items-center gap-2.5 text-sm">
        <span className="rounded-xl border border-(--cf-border) bg-(--cf-surface-muted) px-3 py-1 text-(--cf-text-2)">
          {book.category}
        </span>
        <span
          className={[
            "rounded-xl border px-3 py-1 font-medium",
            difficultyStyles[book.difficulty],
          ].join(" ")}
        >
          {book.difficulty}
        </span>
        <span className="inline-flex items-center gap-1.5 text-(--cf-text-3)">
          <Clock3 className="h-3.5 w-3.5" />
          {estimatedTimeLabel(book.estimatedMinutes)}
        </span>
      </div>
    </button>
  );
}
