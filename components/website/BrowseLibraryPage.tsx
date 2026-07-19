"use client";

import { BookRequestSection } from "@/components/website/BookRequestSection";
import { BrowseLibraryBottomCta } from "./browse-library/BrowseLibraryBottomCta";
import { BrowseLibraryFilterBar } from "./browse-library/BrowseLibraryFilterBar";
import { BrowseLibraryHero } from "./browse-library/BrowseLibraryHero";
import { BrowseLibraryResults } from "./browse-library/BrowseLibraryResults";
import { ALL_BOOKS } from "./browse-library/browse-library-core";
import { useBrowseLibraryState } from "./browse-library/useBrowseLibraryState";

export function BrowseLibraryPage() {
  const {
    activeCategory,
    categories,
    debouncedQuery,
    filteredBooks,
    handleCategoryChange,
    handleClearSearch,
    handleRequestBook,
    handleSortChange,
    isAllView,
    requestSectionRef,
    requestTitle,
    searchQuery,
    setSearchQuery,
    sortBy,
  } = useBrowseLibraryState();

  return (
    <div className="relative min-h-screen" style={{ color: "var(--text-primary)" }}>
      {/* Noise overlay */}
      <div className="noise-overlay pointer-events-none fixed inset-0 z-0" aria-hidden />

      {/* Background gradient */}
      <div
        className="pointer-events-none fixed inset-0 -z-10"
        aria-hidden
        style={{
          background: [
            "radial-gradient(ellipse 60vw 50vw at 30% 0%, color-mix(in srgb, var(--accent-cyan) 4%, transparent), transparent)",
            "var(--bg-base)",
          ].join(", "),
        }}
      />

      <BrowseLibraryHero
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onRequestBook={handleRequestBook}
      />
      <div
        data-public-hero-end
        aria-hidden="true"
        className="pointer-events-none h-px w-full"
      />

      {/* A calm paper shelf keeps the varied cover art dominant while sharing
          the Recall shell's type, periwinkle accent, rules, and focus language. */}
      <section
        aria-label="Browse the ChapterFlow catalog"
        className="cf-paper-folio relative z-10 mx-auto w-[calc(100%-1rem)] max-w-[90rem] rounded-[2rem] py-2 sm:w-[calc(100%-2rem)] sm:py-4"
      >
        <BrowseLibraryFilterBar
          categories={categories}
          activeCategory={activeCategory}
          onCategoryChange={handleCategoryChange}
          sortBy={sortBy}
          onSortChange={handleSortChange}
          resultCount={filteredBooks.length}
          totalCount={ALL_BOOKS.length}
        />

        {/* Browse area */}
        <BrowseLibraryResults
          books={filteredBooks}
          activeCategory={activeCategory}
          query={debouncedQuery}
          isAllView={isAllView}
          onClear={handleClearSearch}
          onRequestBook={handleRequestBook}
          onSelectCategory={handleCategoryChange}
        />

        <div data-public-sticky-cta-suppress className="pb-4" ref={requestSectionRef}>
          <BookRequestSection initialTitle={requestTitle} />
        </div>
      </section>

      <div className="relative z-10 mt-10" data-public-sticky-cta-suppress>
        <BrowseLibraryBottomCta />
      </div>
    </div>
  );
}
