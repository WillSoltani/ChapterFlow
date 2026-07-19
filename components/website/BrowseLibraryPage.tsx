"use client";

import { Footer } from "@/components/sections/Footer";
import { Navbar } from "@/components/sections/Navbar";
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
    <div className="min-h-screen" style={{ background: "var(--bg-base)", color: "var(--text-primary)" }}>
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

      <Navbar />

      <BrowseLibraryHero
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onRequestBook={handleRequestBook}
      />

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

      <div className="-mb-10" ref={requestSectionRef}>
        <BookRequestSection initialTitle={requestTitle} />
      </div>
      <BrowseLibraryBottomCta />
      <Footer />
    </div>
  );
}
