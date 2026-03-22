"use client";

import { useState, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FilterChipBar, type StatusFilter, type DifficultyFilter } from "./FilterChipBar";
import { CategoryModal } from "./CategoryModal";
import { BrowseBookCard } from "./BrowseBookCard";
import { BookListItem } from "./BookListItem";
import { ZeroResultsState } from "./ZeroResultsState";
import { SkeletonCard } from "./SkeletonCard";
import { SORT_OPTIONS, type SortOption, type LibraryBook } from "./libraryData";

interface BrowseSectionProps {
  books: LibraryBook[];
  viewMode: "grid" | "list";
  onBookClick: (bookId: string) => void;
  onBookmark: (bookId: string) => void;
  /** Externally applied category filter (e.g. from search dropdown) */
  externalCategoryFilter?: string | null;
  onClearExternalCategory?: () => void;
}

const INITIAL_COUNT = 24;

export function BrowseSection({
  books,
  viewMode,
  onBookClick,
  onBookmark,
  externalCategoryFilter,
  onClearExternalCategory,
}: BrowseSectionProps) {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [categoryFilters, setCategoryFilters] = useState<string[]>([]);
  const [difficultyFilters, setDifficultyFilters] = useState<DifficultyFilter[]>([]);
  const [sortOption, setSortOption] = useState<SortOption>("popular");
  const [showAll, setShowAll] = useState(false);
  const [categoryModalOpen, setCategoryModalOpen] = useState(false);
  const [loading] = useState(false);

  // Merge external category filter
  const activeCategoryFilters = useMemo(() => {
    if (externalCategoryFilter && !categoryFilters.includes(externalCategoryFilter)) {
      return [...categoryFilters, externalCategoryFilter];
    }
    return categoryFilters;
  }, [categoryFilters, externalCategoryFilter]);

  // Status counts
  const statusCounts = useMemo(() => {
    return {
      all: books.length,
      in_progress: books.filter((b) => b.status === "in_progress").length,
      not_started: books.filter((b) => b.status === "not_started").length,
      completed: books.filter((b) => b.status === "completed").length,
    };
  }, [books]);

  // Apply filters
  const filteredBooks = useMemo(() => {
    let result = [...books];

    // Status filter
    if (statusFilter !== "all") {
      result = result.filter((b) => b.status === statusFilter);
    }

    // Category filter (OR within group)
    if (activeCategoryFilters.length > 0) {
      result = result.filter((b) => activeCategoryFilters.includes(b.category));
    }

    // Difficulty filter (OR within group)
    if (difficultyFilters.length > 0) {
      result = result.filter((b) => difficultyFilters.includes(b.difficulty));
    }

    // Sort
    switch (sortOption) {
      case "popular":
        result.sort((a, b) => b.readersCount - a.readersCount);
        break;
      case "recent":
        // Mock: reverse order
        result.reverse();
        break;
      case "title_az":
        result.sort((a, b) => a.title.localeCompare(b.title));
        break;
      case "title_za":
        result.sort((a, b) => b.title.localeCompare(a.title));
        break;
      case "shortest":
        result.sort((a, b) => a.chapters - b.chapters);
        break;
      case "longest":
        result.sort((a, b) => b.chapters - a.chapters);
        break;
    }

    return result;
  }, [books, statusFilter, activeCategoryFilters, difficultyFilters, sortOption]);

  const displayedBooks = showAll
    ? filteredBooks
    : filteredBooks.slice(0, INITIAL_COUNT);

  const handleCategoryToggle = useCallback(
    (cat: string) => {
      // If it's the external filter, clear it
      if (cat === externalCategoryFilter) {
        onClearExternalCategory?.();
        return;
      }
      setCategoryFilters((prev) =>
        prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
      );
    },
    [externalCategoryFilter, onClearExternalCategory]
  );

  const handleDifficultyToggle = useCallback((d: DifficultyFilter) => {
    setDifficultyFilters((prev) =>
      prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]
    );
  }, []);

  const handleClearAll = useCallback(() => {
    setStatusFilter("all");
    setCategoryFilters([]);
    setDifficultyFilters([]);
    onClearExternalCategory?.();
  }, [onClearExternalCategory]);

  const handleCategoryModalApply = useCallback(
    (cats: string[]) => {
      setCategoryFilters(cats);
      onClearExternalCategory?.();
    },
    [onClearExternalCategory]
  );

  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.3 }}
      id="browse"
      className="mt-14"
      style={{ maxWidth: 1080, margin: "56px auto 0" }}
    >
      {/* Header */}
      <div className="flex items-end justify-between">
        <div>
          <h2
            className="font-(family-name:--font-display) text-[22px] font-bold"
            style={{ color: "var(--text-heading)" }}
          >
            Browse All
          </h2>
          <p className="mt-0.5 text-[13px]" style={{ color: "var(--text-muted)" }}>
            {books.length} books available
          </p>
        </div>

        {/* Sort dropdown */}
        <div className="relative">
          <select
            value={sortOption}
            onChange={(e) => setSortOption(e.target.value as SortOption)}
            className="cursor-pointer appearance-none rounded-lg py-2 pr-8 pl-3.5 text-[13px] outline-none transition-colors"
            style={{
              background: "var(--bg-raised)",
              border: "1px solid var(--border-subtle)",
              color: "var(--text-primary)",
            }}
          >
            {SORT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          {/* Custom chevron */}
          <svg
            className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2"
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--text-muted)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </div>
      </div>

      {/* Filter chips */}
      <FilterChipBar
        statusFilter={statusFilter}
        categoryFilters={activeCategoryFilters}
        difficultyFilters={difficultyFilters}
        statusCounts={statusCounts}
        onStatusChange={setStatusFilter}
        onCategoryToggle={handleCategoryToggle}
        onDifficultyToggle={handleDifficultyToggle}
        onClearAll={handleClearAll}
        onOpenCategoryModal={() => setCategoryModalOpen(true)}
      />

      {/* Results counter */}
      <AnimatePresence mode="wait">
        <motion.p
          key={filteredBooks.length}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="mt-4 text-[13px]"
          style={{ color: "var(--text-muted)" }}
        >
          Showing {displayedBooks.length} of {filteredBooks.length} books
        </motion.p>
      </AnimatePresence>

      {/* Content */}
      {loading ? (
        <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-5 md:grid-cols-3 lg:grid-cols-5">
          {Array.from({ length: 12 }).map((_, i) => (
            <SkeletonCard key={i} variant="browse" />
          ))}
        </div>
      ) : filteredBooks.length === 0 ? (
        <ZeroResultsState
          type="filter"
          onClearFilters={handleClearAll}
          onBrowsePopular={() => {
            handleClearAll();
            setSortOption("popular");
          }}
          popularBooks={books.sort((a, b) => b.readersCount - a.readersCount).slice(0, 3)}
          onBookClick={onBookClick}
          onBookmark={onBookmark}
        />
      ) : viewMode === "grid" ? (
        <>
          <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-5 md:grid-cols-3 lg:grid-cols-5" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(170px, 1fr))" }}>
            {displayedBooks.map((book, i) => (
              <BrowseBookCard
                key={book.id}
                book={book}
                onClick={() => onBookClick(book.id)}
                onBookmark={onBookmark}
                index={i}
              />
            ))}
          </div>

          {/* Show All button */}
          {!showAll && filteredBooks.length > INITIAL_COUNT && (
            <div className="mt-8 flex justify-center">
              <button
                type="button"
                onClick={() => setShowAll(true)}
                className="cursor-pointer rounded-lg px-6 py-2.5 text-[13px] font-semibold transition-colors"
                style={{
                  background: "var(--bg-raised)",
                  border: "1px solid var(--border-subtle)",
                  color: "var(--text-primary)",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = "var(--border-medium)";
                  e.currentTarget.style.background = "var(--bg-elevated)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = "var(--border-subtle)";
                  e.currentTarget.style.background = "var(--bg-raised)";
                }}
              >
                Show all {filteredBooks.length} books
              </button>
            </div>
          )}
        </>
      ) : (
        /* List view */
        <div className="mt-4 flex flex-col gap-0.5">
          {displayedBooks.map((book, i) => (
            <BookListItem
              key={book.id}
              book={book}
              onClick={() => onBookClick(book.id)}
              onBookmark={onBookmark}
              index={i}
            />
          ))}
          {!showAll && filteredBooks.length > INITIAL_COUNT && (
            <div className="mt-6 flex justify-center">
              <button
                type="button"
                onClick={() => setShowAll(true)}
                className="cursor-pointer rounded-lg px-6 py-2.5 text-[13px] font-semibold transition-colors"
                style={{
                  background: "var(--bg-raised)",
                  border: "1px solid var(--border-subtle)",
                  color: "var(--text-primary)",
                }}
              >
                Show all {filteredBooks.length} books
              </button>
            </div>
          )}
        </div>
      )}

      {/* Category modal */}
      <CategoryModal
        open={categoryModalOpen}
        onClose={() => setCategoryModalOpen(false)}
        selectedCategories={activeCategoryFilters}
        onApply={handleCategoryModalApply}
        books={books}
      />
    </motion.section>
  );
}
