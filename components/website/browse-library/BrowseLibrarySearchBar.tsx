"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { BookCover } from "@/components/ui/BookCover";
import { track } from "@/lib/analytics";
import {
  bookHref,
  coverPath,
  type LibraryBook,
} from "./browse-library-core";
import { SearchIcon } from "./BrowseLibraryIcons";

export function BrowseLibrarySearchBar({
  query,
  onChange,
  books,
  onRequestBook,
}: {
  query: string;
  onChange: (q: string) => void;
  books: LibraryBook[];
  onRequestBook: (title: string) => void;
}) {
  const [focused, setFocused] = useState(false);

  const results = useMemo(() => {
    if (query.length < 2) return [];
    const q = query.toLowerCase();
    return books
      .filter(
        (b) =>
          b.title.toLowerCase().includes(q) ||
          b.author.toLowerCase().includes(q) ||
          b.category.toLowerCase().includes(q),
      )
      .slice(0, 5);
  }, [query, books]);

  const showDropdown = focused && query.length >= 2;

  return (
    <div className="relative">
      <div
        className="flex items-center gap-3 rounded-xl px-4 py-3 transition-all duration-200"
        style={{
          background: "var(--bg-glass)",
          border: `1px solid ${focused ? "color-mix(in srgb, var(--accent-cyan) 30%, transparent)" : "var(--border-subtle)"}`,
        }}
      >
        <SearchIcon />
        <input
          type="text"
          value={query}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => {
            if (query.length >= 2) track("library_search", { query, resultCount: results.length });
            setTimeout(() => setFocused(false), 200);
          }}
          placeholder="Search by title, author, or topic..."
          className="flex-1 bg-transparent outline-none text-cf-body-sm placeholder:text-(--text-muted)"
          style={{ color: "var(--text-heading)", fontFamily: "var(--font-body)" }}
          aria-label="Search books"
        />
        {query && (
          <button
            type="button"
            onClick={() => onChange("")}
            aria-label="Clear search"
            className="text-(--text-muted) hover:text-(--text-heading) transition-colors text-sm"
          >
            ✕
          </button>
        )}
      </div>

      {showDropdown && (
        <div
          className="absolute top-full left-0 right-0 mt-2 rounded-xl overflow-hidden z-50"
          style={{
            background: "var(--bg-elevated)",
            border: "1px solid var(--border-subtle)",
            boxShadow: "0 16px 48px color-mix(in srgb, var(--cf-palette-black) 50%, transparent)",
          }}
        >
          {results.length > 0 ? (
            results.map((book) => (
              <Link
                key={book.id}
                href={bookHref(book.id)}
                className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-(--bg-glass)"
              >
                <div className="w-8 h-12 shrink-0 rounded overflow-hidden">
                  <BookCover
                    bookId={book.coverId || book.id}
                    title={book.title}
                    icon="📚"
                    coverImage={coverPath(book)}
                    className="w-full h-full"
                    interactive={false}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-cf-body-sm font-medium truncate" style={{ color: "var(--text-heading)" }}>
                    {book.title}
                  </p>
                  <p className="text-cf-label-sm" style={{ color: "var(--text-muted)" }}>
                    {book.author}
                  </p>
                </div>
                <span
                  className="text-[10px] px-2 py-0.5 rounded-full shrink-0"
                  style={{ background: "color-mix(in srgb, var(--accent-cyan) 12%, transparent)", color: "var(--text-muted)" }}
                >
                  {book.category}
                </span>
              </Link>
            ))
          ) : (
            <div className="px-4 py-5 text-center">
              <p className="text-cf-body-sm" style={{ color: "var(--text-muted)" }}>
                No books found for &ldquo;{query}&rdquo;
              </p>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => onRequestBook(query)}
                className="inline-flex items-center justify-center min-h-[44px] px-2 text-cf-label-sm mt-1 font-medium hover:underline underline-offset-2 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--accent-cyan)/60"
                style={{ color: "var(--accent-cyan)" }}
              >
                Request &ldquo;{query}&rdquo; &rarr;
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
