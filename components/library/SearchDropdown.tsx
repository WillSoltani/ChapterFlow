"use client";

import { motion } from "framer-motion";
import { BookCover } from "./BookCover";
import type { LibraryBook } from "./libraryData";

interface SearchDropdownProps {
  query: string;
  books: LibraryBook[];
  recentSearches: string[];
  onSelect: (bookId: string) => void;
  onSearchSubmit: (query: string) => void;
  onCategoryClick: (category: string) => void;
}

const QUICK_CATEGORIES = [
  "Psychology",
  "Productivity",
  "Strategy",
  "Leadership",
  "Communication",
];

export function SearchDropdown({
  query,
  books,
  recentSearches,
  onSelect,
  onSearchSubmit,
  onCategoryClick,
}: SearchDropdownProps) {
  const normalizedQuery = query.toLowerCase().trim();

  // Fuzzy match on title + author
  const suggestions = normalizedQuery
    ? books
        .filter(
          (b) =>
            b.title.toLowerCase().includes(normalizedQuery) ||
            b.author.toLowerCase().includes(normalizedQuery)
        )
        .slice(0, 5)
    : books
        .sort((a, b) => b.readersCount - a.readersCount)
        .slice(0, 4);

  return (
    <motion.div
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      transition={{ duration: 0.2 }}
      className="absolute left-0 right-0 top-[calc(100%+6px)] z-40 overflow-hidden"
      style={{
        background: "var(--bg-raised)",
        border: "1px solid var(--border-medium)",
        borderRadius: "var(--radius-lg-val)",
        boxShadow: "0 16px 48px rgba(0,0,0,0.5)",
        maxHeight: 320,
        overflowY: "auto",
      }}
    >
      {/* Recent searches */}
      {!normalizedQuery && recentSearches.length > 0 && (
        <div className="px-4 pb-2 pt-3">
          <span
            className="text-[10px] font-semibold uppercase tracking-[0.12em]"
            style={{ color: "var(--text-muted)" }}
          >
            Recent searches
          </span>
          <div className="mt-2 flex flex-col gap-0.5">
            {recentSearches.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => onSearchSubmit(s)}
                className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] transition-colors"
                style={{ color: "var(--text-secondary)" }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.background = "var(--bg-glass-hover)")
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.background = "transparent")
                }
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="1 4 1 10 7 10" />
                  <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
                </svg>
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Book suggestions */}
      <div className="px-4 pb-2 pt-3">
        <span
          className="text-[10px] font-semibold uppercase tracking-[0.12em]"
          style={{ color: "var(--text-muted)" }}
        >
          {normalizedQuery ? "Results" : "Popular books"}
        </span>
        <div className="mt-2 flex flex-col gap-0.5">
          {suggestions.length === 0 ? (
            <p className="py-3 text-center text-[13px]" style={{ color: "var(--text-muted)" }}>
              No matches found
            </p>
          ) : (
            suggestions.map((book) => (
              <button
                key={book.id}
                type="button"
                onClick={() => onSelect(book.id)}
                className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-2 text-left transition-colors"
                onMouseEnter={(e) =>
                  (e.currentTarget.style.background = "var(--bg-glass-hover)")
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.background = "transparent")
                }
              >
                {/* Mini cover */}
                <div
                  className="shrink-0 overflow-hidden"
                  style={{
                    width: 32,
                    height: 45,
                    borderRadius: 4,
                  }}
                >
                  <BookCover
                    title={book.title}
                    coverGradient={book.coverGradient}
                    coverImage={book.coverImage}
                    width={32}
                    height={45}
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <p
                    className="truncate text-[13px] font-medium"
                    style={{ color: "var(--text-heading)" }}
                  >
                    {book.title}
                  </p>
                  <p
                    className="truncate text-[11px]"
                    style={{ color: "var(--text-muted)" }}
                  >
                    {book.author}
                  </p>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Quick category chips */}
      {!normalizedQuery && (
        <div className="border-t px-4 pb-3 pt-3" style={{ borderColor: "var(--border-subtle)" }}>
          <span
            className="text-[10px] font-semibold uppercase tracking-[0.12em]"
            style={{ color: "var(--text-muted)" }}
          >
            Categories
          </span>
          <div className="mt-2 flex flex-wrap gap-2">
            {QUICK_CATEGORIES.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => onCategoryClick(cat)}
                className="cursor-pointer rounded-full px-3 py-1 text-[11px] font-medium transition-colors"
                style={{
                  background: "var(--bg-elevated)",
                  border: "1px solid var(--border-subtle)",
                  color: "var(--text-secondary)",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = "var(--border-medium)";
                  e.currentTarget.style.color = "var(--text-heading)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = "var(--border-subtle)";
                  e.currentTarget.style.color = "var(--text-secondary)";
                }}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
}
