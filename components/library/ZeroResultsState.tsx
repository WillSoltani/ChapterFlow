"use client";

import { DiscoverBookCard } from "./DiscoverBookCard";
import type { LibraryBook } from "./libraryData";

interface ZeroResultsStateProps {
  type: "search" | "filter";
  searchQuery?: string;
  onClearFilters: () => void;
  onBrowsePopular: () => void;
  popularBooks: LibraryBook[];
  onBookClick: (bookId: string) => void;
  onBookmark: (bookId: string) => void;
}

export function ZeroResultsState({
  type,
  searchQuery,
  onClearFilters,
  onBrowsePopular,
  popularBooks,
  onBookClick,
  onBookmark,
}: ZeroResultsStateProps) {
  return (
    <div className="flex flex-col items-center px-5 py-16" style={{ maxWidth: 400, margin: "0 auto" }}>
      {/* Empty bookshelf illustration */}
      <svg
        width="120"
        height="80"
        viewBox="0 0 120 80"
        fill="none"
        stroke="var(--text-muted)"
        strokeWidth="1.5"
        strokeLinecap="round"
      >
        {/* Shelf lines */}
        <line x1="10" y1="25" x2="110" y2="25" />
        <line x1="10" y1="50" x2="110" y2="50" />
        <line x1="10" y1="75" x2="110" y2="75" />
        {/* One book lying flat on middle shelf */}
        <rect x="35" y="44" width="30" height="5" rx="1" fill="var(--bg-elevated)" stroke="var(--text-muted)" />
        {/* Shelf supports */}
        <line x1="10" y1="20" x2="10" y2="78" />
        <line x1="110" y1="20" x2="110" y2="78" />
      </svg>

      <h3
        className="mt-6 text-center font-(family-name:--font-display) text-[18px] font-semibold"
        style={{ color: "var(--text-heading)" }}
      >
        {type === "search" ? (
          <>
            No results for{" "}
            <span style={{ color: "var(--accent-blue)" }}>
              &ldquo;{searchQuery}&rdquo;
            </span>
          </>
        ) : (
          "No books match your filters"
        )}
      </h3>

      <p
        className="mt-2 text-center text-[14px]"
        style={{ color: "var(--text-secondary)" }}
      >
        {type === "search"
          ? "Try a different search term or browse all books."
          : "Try adjusting your filters or browse popular books."}
      </p>

      <div className="mt-5 flex items-center gap-3">
        <button
          type="button"
          onClick={onClearFilters}
          className="cursor-pointer rounded-lg px-4 py-2 text-[13px] font-medium transition-colors"
          style={{
            background: "var(--bg-elevated)",
            border: "1px solid var(--border-subtle)",
            color: "var(--text-primary)",
          }}
        >
          {type === "search" ? "Clear search" : "Clear all filters"}
        </button>
        <button
          type="button"
          onClick={onBrowsePopular}
          className="cursor-pointer text-[13px] font-medium transition-colors"
          style={{ color: "var(--accent-blue)" }}
        >
          Browse popular books
        </button>
      </div>

      {/* You might like */}
      {popularBooks.length > 0 && (
        <div className="mt-10 w-full">
          <p
            className="mb-3 text-center text-[13px] font-medium"
            style={{ color: "var(--text-secondary)" }}
          >
            You might like
          </p>
          <div className="flex justify-center gap-3.5">
            {popularBooks.map((book) => (
              <DiscoverBookCard
                key={book.id}
                book={book}
                onClick={() => onBookClick(book.id)}
                onBookmark={onBookmark}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
