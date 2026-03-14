"use client";

import { CheckCircle2, Clock3 } from "lucide-react";
import type { BookCatalogItem } from "@/app/book/data/booksCatalog";
import { BookCover } from "@/app/book/components/BookCover";

const difficultyStyles: Record<BookCatalogItem["difficulty"], string> = {
  Easy: "border-emerald-400/30 bg-emerald-400/10 text-emerald-300",
  Medium: "border-amber-400/30 bg-amber-400/10 text-amber-300",
  Hard: "border-rose-400/30 bg-rose-400/10 text-rose-300",
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
        "bg-[linear-gradient(180deg,rgba(255,255,255,0.07),rgba(255,255,255,0.04))]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300/50",
        selected
          ? "border-sky-400/55 bg-[linear-gradient(180deg,rgba(14,116,144,0.22),rgba(8,47,73,0.22))] shadow-[0_0_0_1px_rgba(56,189,248,0.4),0_18px_45px_rgba(2,132,199,0.22)]"
          : "border-white/10 hover:-translate-y-0.5 hover:border-white/20 hover:shadow-[0_20px_45px_rgba(2,6,23,0.45)]",
        disabled && !selected ? "cursor-not-allowed opacity-45" : "",
      ].join(" ")}
    >
      <BookCover
        bookId={book.id}
        title={book.title}
        icon={book.icon}
        coverImage={book.coverImage}
        className="h-14 w-12 rounded-xl border border-white/15 bg-white/6"
        fallbackClassName="text-3xl"
        sizes="48px"
      />

      {selected ? (
        <span className="absolute right-4 top-4 text-sky-300" aria-hidden="true">
          <CheckCircle2 className="h-6 w-6" />
        </span>
      ) : null}

      <h3 className="mt-6 text-2xl font-semibold tracking-tight text-slate-100">
        {book.title}
      </h3>
      <p className="mt-1 text-lg text-slate-300">{book.author}</p>

      <div className="mt-5 flex flex-wrap items-center gap-2.5 text-sm">
        <span className="rounded-xl border border-white/35 bg-white/5 px-3 py-1 text-slate-200">
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
        <span className="inline-flex items-center gap-1.5 text-slate-400">
          <Clock3 className="h-3.5 w-3.5" />
          {estimatedTimeLabel(book.estimatedMinutes)}
        </span>
      </div>
    </button>
  );
}
