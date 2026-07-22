"use client";

import Link from "next/link";
import { BookCover } from "@/components/ui/BookCover";
import { track } from "@/lib/analytics";
import {
  DIFFICULTY_LABEL,
  avgMinPerChapter,
  bookHref,
  coverPath,
  getBookBadge,
  type LibraryBook,
} from "./browse-library-core";

export function BrowseLibraryBookCard({ book, showCategoryTag = false }: { book: LibraryBook; showCategoryTag?: boolean }) {
  const badge = getBookBadge(book);

  return (
    <Link
      href={bookHref(book.id)}
      className="group block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--accent-cyan)/60 focus-visible:ring-offset-2 rounded-lg"
      aria-label={`${book.title} by ${book.author} — ${DIFFICULTY_LABEL[book.difficulty]}, ${book.chapters} chapters`}
      onClick={() => track("book_card_click", { source: "browse_library", bookId: book.id })}
    >
      {/* Cover */}
      <div className="relative overflow-hidden rounded-lg aspect-[2/3] transition-all duration-200 group-hover:scale-[1.04] group-hover:shadow-shadow-elevated">
        <BookCover
          bookId={book.coverId || book.id}
          title={book.title}
          icon="📚"
          coverImage={coverPath(book)}
          className="w-full h-full"
          interactive={false}
        />

        {/* Badge */}
        {badge && (
          <span
            className="absolute top-2 left-2 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full z-10"
            style={{ background: badge.color, color: "var(--primary-foreground)" }}
          >
            {badge.label}
          </span>
        )}

        {/* Hover overlay */}
        <div className="absolute inset-x-0 bottom-0 h-[50%] opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex flex-col justify-end p-3 pointer-events-none"
          style={{ background: "linear-gradient(to top, color-mix(in srgb, var(--cf-palette-black) 88%, transparent) 0%, color-mix(in srgb, var(--cf-palette-black) 40%, transparent) 60%, transparent 100%)" }}
        >
          <p className="text-cf-label-sm text-white/80 line-clamp-2 leading-relaxed">
            {book.description}
          </p>
          <div className="flex items-center gap-2 mt-1.5">
            <span
              className="text-[10px] px-2 py-0.5 rounded-full"
              style={{ background: "color-mix(in srgb, var(--cf-palette-white) 12%, transparent)", color: "color-mix(in srgb, var(--cf-palette-white) 70%, transparent)" }}
            >
              {DIFFICULTY_LABEL[book.difficulty]}
            </span>
            <span className="text-cf-caption font-medium ml-auto" style={{ color: "var(--accent-cyan)" }}>
              Start reading →
            </span>
          </div>
        </div>
      </div>

      {/* Info */}
      <div className="mt-2.5">
        <h4
          className="text-cf-body-sm font-semibold line-clamp-2 leading-snug"
          style={{ color: "var(--text-heading)", fontFamily: "var(--font-display)" }}
        >
          {book.title}
        </h4>
        <p className="text-cf-label-sm mt-0.5" style={{ color: "var(--text-secondary)" }}>
          {book.author}
        </p>
        <p
          className="sm:hidden text-cf-caption mt-1.5 leading-relaxed line-clamp-2"
          style={{ color: "var(--text-muted)", fontFamily: "var(--font-body)" }}
        >
          {book.description}
        </p>
        <span
          className="sm:hidden inline-block mt-1 text-[10px] px-2 py-0.5 rounded-full"
          style={{ background: "var(--bg-elevated)", color: "var(--text-muted)" }}
        >
          {DIFFICULTY_LABEL[book.difficulty]}
        </span>
        {showCategoryTag && (
          <span
            className="inline-block mt-1 text-[10px] px-2 py-0.5 rounded-full"
            style={{ background: "color-mix(in srgb, var(--accent-cyan) 12%, transparent)", color: "var(--text-muted)", border: "1px solid var(--border-subtle)" }}
          >
            {book.category}
          </span>
        )}
        <p className="text-cf-caption mt-1" style={{ color: "var(--text-muted)" }}>
          {book.chapters} ch · ~{avgMinPerChapter(book)}m
        </p>
      </div>
    </Link>
  );
}
