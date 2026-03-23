"use client";

import { useState, useMemo, useCallback } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { BookCard } from "./BookCard";
import {
  SORT_OPTIONS,
  type SortOption,
  type LibraryBook,
  type Category,
  type Difficulty,
} from "./libraryData";

interface BrowseAllProps {
  books: LibraryBook[];
  onBookClick: (bookId: string) => void;
  showProLock?: boolean;
  /** Pre-applied category filter from external source */
  initialCategory?: Category | null;
  /** Text search query from navbar search */
  searchQuery?: string;
}

type StatusFilter = "all" | "in_progress" | "not_started" | "completed";

const CATEGORIES: Category[] = [
  "Psychology",
  "Productivity",
  "Strategy",
  "Leadership",
  "Communication",
  "Philosophy",
];

const DIFFICULTIES: Difficulty[] = ["easy", "medium", "hard"];

const DIFFICULTY_COLORS: Record<string, string> = {
  easy: "var(--accent-teal)",
  medium: "var(--accent-blue)",
  hard: "var(--accent-flame)",
};

const INITIAL_COUNT = 10;

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="cursor-pointer whitespace-nowrap rounded-full px-3.5 py-1.5 text-[12px] font-medium transition-all duration-200"
      style={
        active
          ? {
              background: "var(--accent-teal)",
              color: "var(--bg-base)",
              border: "1px solid var(--accent-teal)",
            }
          : {
              background: "transparent",
              color: "var(--text-secondary)",
              border: "1px solid var(--border-subtle)",
            }
      }
    >
      {children}
    </button>
  );
}

export function BrowseAll({
  books,
  onBookClick,
  showProLock = false,
  initialCategory,
  searchQuery = "",
}: BrowseAllProps) {
  const prefersReduced = useReducedMotion();
  const [status, setStatus] = useState<StatusFilter>("all");
  const [category, setCategory] = useState<Category | null>(initialCategory ?? null);
  const [difficulty, setDifficulty] = useState<Difficulty | null>(null);
  const [sort, setSort] = useState<SortOption>("popular");
  const [showAll, setShowAll] = useState(false);
  const [moodFilter, setMoodFilter] = useState<string | null>(null);

  // Status counts
  const counts = useMemo(() => ({
    in_progress: books.filter((b) => b.userProgress && !b.userProgress.isCompleted && b.userProgress.percentComplete > 0).length,
    not_started: books.filter((b) => !b.userProgress).length,
    completed: books.filter((b) => b.userProgress?.isCompleted).length,
  }), [books]);

  // Filter + sort
  const filtered = useMemo(() => {
    let result = [...books];

    // Text search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter((b) => {
        const searchable = `${b.title} ${b.author} ${b.category} ${b.hook}`.toLowerCase();
        return searchable.includes(q);
      });
    }

    // Mood filter
    if (moodFilter === "quick") {
      result = result.filter((b) => b.estimatedReadingTimeMinutes <= 120);
    } else if (moodFilter === "deep") {
      result = result.filter(
        (b) => b.estimatedReadingTimeMinutes > 180 || b.difficulty === "hard"
      );
    } else if (moodFilter === "best") {
      result.sort((a, b) => b.completionRate - a.completionRate);
    } else if (moodFilter === "decide") {
      // Show top 3 personalized picks by completion rate, not yet started
      result = result
        .filter((b) => !b.userProgress)
        .sort((a, b) => b.completionRate - a.completionRate)
        .slice(0, 3);
    }

    // Status
    if (status === "in_progress") {
      result = result.filter(
        (b) => b.userProgress && !b.userProgress.isCompleted && b.userProgress.percentComplete > 0
      );
    } else if (status === "not_started") {
      result = result.filter((b) => !b.userProgress);
    } else if (status === "completed") {
      result = result.filter((b) => b.userProgress?.isCompleted);
    }

    // Category
    if (category) {
      result = result.filter((b) => b.category === category);
    }

    // Difficulty
    if (difficulty) {
      result = result.filter((b) => b.difficulty === difficulty);
    }

    // Sort
    switch (sort) {
      case "popular":
        result.sort((a, b) => b.readerCount - a.readerCount);
        break;
      case "shortest":
        result.sort((a, b) => a.estimatedReadingTimeMinutes - b.estimatedReadingTimeMinutes);
        break;
      case "completion":
        result.sort((a, b) => b.completionRate - a.completionRate);
        break;
      case "beginner":
        result.sort((a, b) => {
          const d = { easy: 0, medium: 1, hard: 2 };
          return d[a.difficulty] - d[b.difficulty];
        });
        break;
      case "alphabetical":
        result.sort((a, b) => a.title.localeCompare(b.title));
        break;
      case "recent":
        result.reverse();
        break;
    }

    return result;
  }, [books, status, category, difficulty, sort, moodFilter]);

  const displayed = showAll ? filtered : filtered.slice(0, INITIAL_COUNT);

  const hasFilters = status !== "all" || category || difficulty || moodFilter;

  const clearAll = useCallback(() => {
    setStatus("all");
    setCategory(null);
    setDifficulty(null);
    setMoodFilter(null);
  }, []);

  // Active filter summary — System Status Visibility (Nielsen)
  const summaryText = useMemo(() => {
    const parts: string[] = [];
    if (difficulty) parts.push(difficulty.charAt(0).toUpperCase() + difficulty.slice(1));
    if (status !== "all") {
      const statusLabels: Record<string, string> = {
        in_progress: "in-progress",
        not_started: "not-started",
        completed: "completed",
      };
      parts.push(statusLabels[status] ?? "");
    }
    parts.push(category ? `books in ${category}` : "books");
    if (moodFilter) {
      const moodLabels: Record<string, string> = {
        quick: "under 2 hours",
        deep: "deep dives",
        best: "by completion rate",
        decide: "top picks for you",
      };
      parts.push(moodLabels[moodFilter] ?? "");
    }
    if (sort !== "popular") {
      const sortLabel = SORT_OPTIONS.find((o) => o.value === sort)?.label ?? "";
      parts.push(`sorted by ${sortLabel.toLowerCase()}`);
    }
    return parts.join(" · ");
  }, [difficulty, status, category, moodFilter, sort]);

  return (
    <motion.section
      initial={{ opacity: prefersReduced ? 1 : 0 }}
      whileInView={{ opacity: 1 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.4 }}
      id="browse-all"
      className="mt-16"
      style={{ maxWidth: 1080, margin: "64px auto 0" }}
    >
      {/* Header */}
      <h2
        className="font-(family-name:--font-display) text-[22px] font-bold"
        style={{ color: "var(--text-heading)" }}
      >
        Browse all
      </h2>
      <p className="mt-0.5 text-[14px]" style={{ color: "var(--text-secondary)" }}>
        Find your next read · {books.length} books available
      </p>

      {/* Guided entry — "What are you in the mood for?" */}
      <div
        className="mt-5 rounded-xl px-5 py-4"
        style={{
          background: "var(--bg-glass)",
          border: "1px solid var(--border-subtle)",
        }}
      >
        <p className="text-[14px] font-medium" style={{ color: "var(--text-heading)" }}>
          What are you in the mood for?
        </p>
        <div className="mt-2.5 flex flex-wrap gap-2">
          {[
            { key: "quick", label: "Something quick" },
            { key: "deep", label: "A deep dive" },
            { key: "best", label: "The best-rated" },
            { key: "decide", label: "Help me decide" },
          ].map((opt) => (
            <button
              key={opt.key}
              type="button"
              onClick={() => {
                setMoodFilter(moodFilter === opt.key ? null : opt.key);
                setShowAll(false);
              }}
              className="cursor-pointer rounded-full px-4 py-2 text-[13px] font-medium transition-all"
              style={
                moodFilter === opt.key
                  ? {
                      background: "var(--accent-teal)",
                      color: "var(--bg-base)",
                      border: "1px solid var(--accent-teal)",
                    }
                  : {
                      background: "var(--bg-elevated)",
                      border: "1px solid var(--border-subtle)",
                      color: "var(--text-secondary)",
                    }
              }
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Filter bar */}
      <div className="scrollbar-hide mt-5 flex items-center gap-2 overflow-x-auto pb-1">
        {/* Status */}
        <Chip active={status === "all"} onClick={() => setStatus("all")}>All</Chip>
        <Chip
          active={status === "in_progress"}
          onClick={() => setStatus(status === "in_progress" ? "all" : "in_progress")}
        >
          In Progress ({counts.in_progress})
        </Chip>
        <Chip
          active={status === "not_started"}
          onClick={() => setStatus(status === "not_started" ? "all" : "not_started")}
        >
          Not Started ({counts.not_started})
        </Chip>
        <Chip
          active={status === "completed"}
          onClick={() => setStatus(status === "completed" ? "all" : "completed")}
        >
          Completed ({counts.completed})
        </Chip>

        <div className="h-4 w-px shrink-0" style={{ background: "var(--border-subtle)" }} />

        {/* Categories */}
        {CATEGORIES.map((cat) => (
          <Chip
            key={cat}
            active={category === cat}
            onClick={() => setCategory(category === cat ? null : cat)}
          >
            {cat}
          </Chip>
        ))}

        <div className="h-4 w-px shrink-0" style={{ background: "var(--border-subtle)" }} />

        {/* Difficulty */}
        {DIFFICULTIES.map((d) => (
          <Chip
            key={d}
            active={difficulty === d}
            onClick={() => setDifficulty(difficulty === d ? null : d)}
          >
            <span
              className="mr-1 inline-block h-1.5 w-1.5 rounded-full"
              style={{ background: DIFFICULTY_COLORS[d] }}
            />
            {d.charAt(0).toUpperCase() + d.slice(1)}
          </Chip>
        ))}

        {hasFilters && (
          <button
            type="button"
            onClick={clearAll}
            className="cursor-pointer whitespace-nowrap text-[12px] transition-colors"
            style={{ color: "var(--text-muted)" }}
          >
            Clear all
          </button>
        )}
      </div>

      {/* Sort + summary */}
      <div className="mt-3 flex items-center justify-between">
        <AnimatePresence mode="wait">
          <motion.p
            key={filtered.length + sort}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="text-[13px]"
            style={{ color: "var(--text-muted)" }}
          >
            Showing {displayed.length} of {filtered.length}{" "}
            {summaryText || "books"}
          </motion.p>
        </AnimatePresence>

        <div className="relative">
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortOption)}
            className="cursor-pointer appearance-none rounded-lg py-2 pr-8 pl-3.5 text-[13px] outline-none"
            style={{
              background: "var(--bg-raised)",
              border: "1px solid var(--border-subtle)",
              color: "var(--text-primary)",
            }}
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <svg
            className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2"
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--text-muted)"
            strokeWidth="2"
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </div>
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center py-16 text-center">
          <p className="text-[16px] font-semibold" style={{ color: "var(--text-heading)" }}>
            No books match these filters
          </p>
          <p className="mt-1 text-[14px]" style={{ color: "var(--text-secondary)" }}>
            Try adjusting your selection.
          </p>
          <button
            type="button"
            onClick={clearAll}
            className="mt-4 cursor-pointer rounded-lg px-5 py-2 text-[13px] font-medium"
            style={{
              background: "var(--bg-elevated)",
              border: "1px solid var(--border-subtle)",
              color: "var(--text-primary)",
            }}
          >
            Clear filters
          </button>
        </div>
      ) : (
        <>
          {/* Grid with AnimatePresence for smooth filter transitions (Change 12) */}
          <div className="mt-5 grid grid-cols-2 gap-x-5 gap-y-6 md:grid-cols-3 lg:grid-cols-5">
            <AnimatePresence mode="popLayout">
              {displayed.map((book, i) => (
                <motion.div
                  key={book.id}
                  layout={!prefersReduced}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.2, ease: "easeOut", delay: i * 0.03 }}
                >
                  <BookCard
                    book={book}
                    index={0}
                    onBookClick={onBookClick}
                    showProLock={showProLock}
                  />
                </motion.div>
              ))}
            </AnimatePresence>
          </div>

          {!showAll && filtered.length > INITIAL_COUNT && (
            <div className="mt-8 flex justify-center">
              <button
                type="button"
                onClick={() => setShowAll(true)}
                className="cursor-pointer rounded-xl px-6 py-3 text-[14px] font-semibold transition-colors"
                style={{
                  background: "var(--bg-raised)",
                  border: "1px solid var(--border-subtle)",
                  color: "var(--text-primary)",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = "var(--border-medium)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = "var(--border-subtle)";
                }}
              >
                Show all {filtered.length}{hasFilters ? ` ${category ?? ""} ` : " "}books
              </button>
            </div>
          )}
        </>
      )}
    </motion.section>
  );
}
