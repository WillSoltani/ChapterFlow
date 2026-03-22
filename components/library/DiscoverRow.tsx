"use client";

import { useRef } from "react";
import { DiscoverBookCard } from "./DiscoverBookCard";
import type { LibraryBook } from "./libraryData";

interface DiscoverRowProps {
  title: string;
  books: LibraryBook[];
  onBookClick: (bookId: string) => void;
  onBookmark: (bookId: string) => void;
}

export function DiscoverRow({
  title,
  books,
  onBookClick,
  onBookmark,
}: DiscoverRowProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  return (
    <div className="mt-8 first:mt-4">
      {/* Row header */}
      <div className="flex items-center justify-between">
        <h3
          className="font-(family-name:--font-display) text-[18px] font-semibold"
          style={{ color: "var(--text-heading)" }}
        >
          {title}
        </h3>
        <button
          type="button"
          className="cursor-pointer text-[12px] transition-colors"
          style={{ color: "var(--text-secondary)" }}
          onMouseEnter={(e) => (e.currentTarget.style.color = "var(--accent-blue)")}
          onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-secondary)")}
        >
          See all →
        </button>
      </div>

      {/* Horizontal scroll container */}
      <div
        ref={scrollRef}
        className="scrollbar-hide mt-3.5 flex gap-3.5 overflow-x-auto"
        style={{
          scrollSnapType: "x mandatory",
          WebkitOverflowScrolling: "touch",
          paddingRight: 60,
        }}
      >
        {books.map((book) => (
          <DiscoverBookCard
            key={book.id}
            book={book}
            onClick={() => onBookClick(book.id)}
            onBookmark={onBookmark}
          />
        ))}
      </div>
    </div>
  );
}
