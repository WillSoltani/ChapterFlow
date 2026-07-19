"use client";

import Link from "next/link";
import { BookCover } from "@/components/ui/BookCover";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { SectionReveal } from "@/components/ui/SectionReveal";
import { CATALOG_BOOK_COUNT_DISPLAY } from "@/lib/catalog-stats";
import { track } from "@/lib/analytics";
import {
  ALL_BOOKS,
  FEATURED_BOOK,
  FEATURED_REASON,
  avgMinPerChapter,
  bookHref,
  coverPath,
  type LibraryBook,
} from "./browse-library-core";
import { BrowseLibrarySearchBar } from "./BrowseLibrarySearchBar";

function FeaturedBookSpotlight({ book, reason }: { book: LibraryBook; reason: string }) {
  return (
    <div className="flex gap-5 items-center overflow-hidden">
      <div className="shrink-0 w-[100px] sm:w-[130px] md:w-[150px] aspect-[2/3] transform -rotate-2 transition-transform hover:rotate-0 duration-300">
        <BookCover
          bookId={book.coverId || book.id}
          title={book.title}
          icon="📚"
          coverImage={coverPath(book)}
          className="w-full h-full rounded-xl shadow-shadow-elevated"
          interactive={false}
        />
      </div>
      <div className="flex flex-col min-w-0 flex-1">
        <span
          className="text-[10px] px-2.5 py-1 rounded-full font-semibold uppercase tracking-wider w-fit"
          style={{ background: "color-mix(in srgb, var(--accent-cyan) 10%, transparent)", color: "var(--accent-cyan)" }}
        >
          {reason}
        </span>
        <h3
          className="text-lg md:text-xl font-bold mt-2 leading-snug"
          style={{ color: "var(--text-heading)", fontFamily: "var(--font-display)" }}
        >
          {book.title}
        </h3>
        <p className="text-cf-body-sm mt-0.5" style={{ color: "var(--text-secondary)" }}>
          {book.author}
        </p>
        <p className="text-cf-label mt-2 leading-relaxed hidden md:block" style={{ color: "var(--text-muted)" }}>
          {book.description}
        </p>
        <p className="text-cf-label-sm mt-2" style={{ color: "var(--text-muted)" }}>
          {book.chapters} chapters · ~{avgMinPerChapter(book)}m each
        </p>
        <Link
          href={bookHref(book.id)}
          onClick={() => track("book_card_click", { source: "browse_library_featured", bookId: book.id })}
          className="-mb-3 inline-flex min-h-11 w-fit items-center rounded text-cf-label font-semibold hover:underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--accent-cyan)/60 focus-visible:ring-offset-2"
          style={{ color: "var(--accent-cyan)" }}
        >
          Start reading →
        </Link>
      </div>
    </div>
  );
}

export function BrowseLibraryHero({
  searchQuery,
  onSearchChange,
  onRequestBook,
}: {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onRequestBook: (title: string) => void;
}) {
  return (
    <section className="pt-28 lg:pt-32 pb-10 lg:pb-14">
      <div className="max-w-7xl mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-[55%_45%] gap-10 lg:gap-8 items-center">
          {/* Left column */}
          <SectionReveal>
            <div>
              <SectionLabel>THE LIBRARY</SectionLabel>
              <h1
                className="mt-3 text-[28px] md:text-4xl lg:text-[42px] font-bold leading-[1.1] tracking-tight"
                style={{ color: "var(--text-heading)", fontFamily: "var(--font-display)" }}
              >
                Handpicked books, structured for retention.
              </h1>
              <p
                className="mt-3 text-cf-body md:text-cf-body-lg leading-[1.7] max-w-[520px]"
                style={{ color: "var(--text-secondary)", fontFamily: "var(--font-body)" }}
              >
                {CATALOG_BOOK_COUNT_DISPLAY} non-fiction titles across psychology, productivity, leadership, and more.
                Each one broken into chapter summaries, real-world examples, and retention quizzes.
              </p>
              <div className="mt-5">
                <BrowseLibrarySearchBar query={searchQuery} onChange={onSearchChange} books={ALL_BOOKS} onRequestBook={onRequestBook} />
              </div>
            </div>
          </SectionReveal>

          {/* Right column — Featured book */}
          <SectionReveal delay={0.15}>
            <div
              className="rounded-2xl p-5 md:p-6"
              style={{
                background: "var(--bg-glass)",
                border: "1px solid var(--border-subtle)",
              }}
            >
              <FeaturedBookSpotlight book={FEATURED_BOOK} reason={FEATURED_REASON} />
            </div>
          </SectionReveal>
        </div>
      </div>
    </section>
  );
}
