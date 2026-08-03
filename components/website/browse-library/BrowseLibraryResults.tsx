"use client";

import { useMemo } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { getCategoriesWithCounts, type LibraryBook } from "./browse-library-core";
import { SearchIcon } from "./BrowseLibraryIcons";
import { BrowseLibraryBookCard } from "./BrowseLibraryBookCard";
import { BrowseLibraryShelfRow } from "./BrowseLibraryShelfRow";

const MIN_ROW_SIZE = 4;
const MIN_CURATED_ROW = 3;

function CategoryRows({
  books,
  onSelectCategory,
}: {
  books: LibraryBook[];
  onSelectCategory: (cat: string) => void;
}) {
  const popularBooks = useMemo(() => books.filter((b) => b.popular), [books]);
  const newBooks = useMemo(() => books.filter((b) => b.isNew), [books]);
  const categories = getCategoriesWithCounts(books);

  const largeCategories = useMemo(
    () => categories.filter((c) => c.count >= MIN_ROW_SIZE),
    [categories],
  );
  const exploreMoreBooks = useMemo(() => {
    const smallCatNames = new Set(categories.filter((c) => c.count < MIN_ROW_SIZE).map((c) => c.name));
    return books.filter((b) => smallCatNames.has(b.category));
  }, [books, categories]);

  return (
    <div className="space-y-12 py-8">
      {/* Staff Picks — curated, not telemetry-driven */}
      {popularBooks.length >= MIN_CURATED_ROW && (
        <BrowseLibraryShelfRow title="Staff Picks" icon="⭐" books={popularBooks} showCategoryTag />
      )}

      {/* Recently Added — curated "new" set */}
      {newBooks.length >= MIN_CURATED_ROW && (
        <BrowseLibraryShelfRow title="Recently Added" icon="✨" books={newBooks} showCategoryTag />
      )}

      {/* Fallback when neither curated row meets the threshold */}
      {popularBooks.length < MIN_CURATED_ROW && newBooks.length < MIN_CURATED_ROW && (
        <BrowseLibraryShelfRow title="Start Here" icon="✨" books={books.slice(0, 8)} showCategoryTag />
      )}

      {/* Large category rows (4+ books each) */}
      {largeCategories.map((cat) => {
        const catBooks = books.filter((b) => b.category === cat.name);
        return (
          <BrowseLibraryShelfRow
            key={cat.name}
            title={cat.name}
            books={catBooks}
            onSeeAll={() => onSelectCategory(cat.name)}
            seeAllLabel={`See all ${cat.count} →`}
          />
        );
      })}

      {/* Explore More Topics — consolidated small categories */}
      {exploreMoreBooks.length > 0 && (
        <BrowseLibraryShelfRow title="Explore More Topics" icon="🔍" books={exploreMoreBooks} showCategoryTag />
      )}
    </div>
  );
}

function CategoryGrid({
  books,
  categoryName,
}: {
  books: LibraryBook[];
  categoryName: string;
}) {
  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <h3
        className="text-[22px] font-bold mb-6"
        style={{ color: "var(--text-heading)", fontFamily: "var(--font-display)" }}
      >
        {categoryName}
      </h3>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-6">
        {books.map((book) => (
          <BrowseLibraryBookCard key={book.id} book={book} />
        ))}
      </div>
    </div>
  );
}

function ZeroResults({
  query,
  onClear,
  onRequestBook,
}: {
  query: string;
  onClear: () => void;
  onRequestBook: (title: string) => void;
}) {
  return (
    <div className="max-w-md mx-auto px-4 py-20 text-center">
      <div
        className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-5"
        style={{ background: "color-mix(in srgb, var(--accent-cyan) 6%, transparent)", border: "1px solid color-mix(in srgb, var(--accent-cyan) 10%, transparent)" }}
      >
        <SearchIcon />
      </div>
      <h3 className="text-xl font-bold" style={{ color: "var(--text-heading)", fontFamily: "var(--font-display)" }}>
        No books found
      </h3>
      {query.trim() && (
        <p className="text-cf-body-sm mt-2" style={{ color: "var(--text-secondary)" }}>
          Nothing matched &ldquo;{query}&rdquo;. Try a different search or browse by category.
        </p>
      )}
      <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
        <button
          onClick={onClear}
          className="inline-flex items-center justify-center min-h-[44px] text-cf-label font-semibold px-5 py-2.5 rounded-lg transition-all duration-200 hover:scale-[1.02] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--accent-cyan)/60 focus-visible:ring-offset-2"
          style={{ background: "var(--bg-raised)", border: "1px solid var(--border-medium)", color: "var(--text-heading)" }}
        >
          Clear search
        </button>
        {query.trim() && (
          <button
            onClick={() => onRequestBook(query)}
            className="inline-flex items-center justify-center min-h-[44px] text-cf-label font-semibold px-5 py-2.5 rounded-lg transition-transform duration-200 hover:scale-[1.02] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--accent-cyan)/60 focus-visible:ring-offset-2"
            style={{ background: "var(--accent-cyan)", color: "var(--primary-foreground)" }}
          >
            Request &ldquo;{query.trim()}&rdquo;
          </button>
        )}
      </div>
    </div>
  );
}

export function BrowseLibraryResults({
  books,
  activeCategory,
  query,
  isAllView,
  onClear,
  onRequestBook,
  onSelectCategory,
}: {
  books: LibraryBook[];
  activeCategory: string;
  query: string;
  isAllView: boolean;
  onClear: () => void;
  onRequestBook: (title: string) => void;
  onSelectCategory: (category: string) => void;
}) {
  return (
    <AnimatePresence mode="wait">
      {books.length === 0 ? (
        <motion.div
          key="zero"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          <ZeroResults query={query} onClear={onClear} onRequestBook={onRequestBook} />
        </motion.div>
      ) : isAllView ? (
        <motion.div
          key="rows"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          <CategoryRows books={books} onSelectCategory={onSelectCategory} />
        </motion.div>
      ) : (
        <motion.div
          key={`grid-${activeCategory}-${query}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          <CategoryGrid
            books={books}
            categoryName={activeCategory !== "All" ? activeCategory : `Results for "${query}"`}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
