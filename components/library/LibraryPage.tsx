"use client";

import { useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { DashboardNavbar } from "@/components/dashboard/DashboardNavbar";
import { LibraryHeader } from "./LibraryHeader";
import { ContinueReadingSection } from "./ContinueReadingSection";
import { DiscoverSection } from "./DiscoverSection";
import { BrowseSection } from "./BrowseSection";
import { ToastNotification } from "./ToastNotification";
import { MOCK_BOOKS, type LibraryBook } from "./libraryData";

export function LibraryPage() {
  const router = useRouter();
  const [books, setBooks] = useState<LibraryBook[]>(MOCK_BOOKS);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchSubmitted, setSearchSubmitted] = useState(false);
  const [externalCategoryFilter, setExternalCategoryFilter] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState("");
  const [toastVisible, setToastVisible] = useState(false);

  // Books in progress for Continue Reading
  const inProgressBooks = useMemo(
    () => books.filter((b) => b.status === "in_progress"),
    [books]
  );

  // Search-filtered books for Browse All
  const searchFilteredBooks = useMemo(() => {
    if (!searchSubmitted || !searchQuery.trim()) return books;
    const q = searchQuery.toLowerCase().trim();
    return books.filter(
      (b) =>
        b.title.toLowerCase().includes(q) ||
        b.author.toLowerCase().includes(q) ||
        b.category.toLowerCase().includes(q)
    );
  }, [books, searchQuery, searchSubmitted]);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setToastVisible(true);
  }, []);

  const handleBookClick = useCallback(
    (bookId: string) => {
      router.push(`/book/library/${encodeURIComponent(bookId)}`);
    },
    [router]
  );

  const handleBookmark = useCallback(
    (bookId: string) => {
      setBooks((prev) =>
        prev.map((b) =>
          b.id === bookId ? { ...b, bookmarked: !b.bookmarked } : b
        )
      );
      const book = books.find((b) => b.id === bookId);
      if (book) {
        showToast(
          book.bookmarked ? "Removed from reading list" : "Saved to reading list"
        );
      }
    },
    [books, showToast]
  );

  const handleSearchSubmit = useCallback((query: string) => {
    setSearchQuery(query);
    setSearchSubmitted(true);
  }, []);

  const handleClearSearch = useCallback(() => {
    setSearchQuery("");
    setSearchSubmitted(false);
  }, []);

  const handleSearchChange = useCallback((query: string) => {
    setSearchQuery(query);
    if (!query.trim()) {
      setSearchSubmitted(false);
    }
  }, []);

  const handleCategoryClick = useCallback((category: string) => {
    setExternalCategoryFilter(category);
    setSearchSubmitted(false);
    setSearchQuery("");
    // Scroll to browse section
    document.getElementById("browse")?.scrollIntoView({ behavior: "smooth" });
  }, []);

  return (
    <main
      className="min-h-screen"
      style={{
        background: "var(--bg-base)",
        color: "var(--text-primary)",
      }}
    >
      <DashboardNavbar />

      <div className="px-5 pb-24 md:px-7">
        {/* ZONE 1: Header */}
        <LibraryHeader
          totalBooks={books.length}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          searchQuery={searchQuery}
          onSearchChange={handleSearchChange}
          onSearchSubmit={handleSearchSubmit}
          onClearSearch={handleClearSearch}
          onBookSelect={handleBookClick}
          onCategoryClick={handleCategoryClick}
          books={books}
        />

        {/* When search is submitted, hide Zone 2 and 3 */}
        {!searchSubmitted && (
          <>
            {/* ZONE 2: Continue Reading */}
            <ContinueReadingSection
              books={inProgressBooks}
              onBookClick={handleBookClick}
            />

            {/* ZONE 3: Discover */}
            <DiscoverSection
              books={books}
              onBookClick={handleBookClick}
              onBookmark={handleBookmark}
            />
          </>
        )}

        {/* Search results indicator */}
        {searchSubmitted && searchQuery.trim() && (
          <div
            className="mt-6 text-[14px]"
            style={{ maxWidth: 1080, margin: "24px auto 0" }}
          >
            <span style={{ color: "var(--text-secondary)" }}>
              Showing {searchFilteredBooks.length} results for{" "}
            </span>
            <span style={{ color: "var(--accent-blue)" }}>
              &ldquo;{searchQuery}&rdquo;
            </span>
          </div>
        )}

        {/* ZONE 4: Browse All */}
        <BrowseSection
          books={searchFilteredBooks}
          viewMode={viewMode}
          onBookClick={handleBookClick}
          onBookmark={handleBookmark}
          externalCategoryFilter={externalCategoryFilter}
          onClearExternalCategory={() => setExternalCategoryFilter(null)}
        />
      </div>

      {/* Toast */}
      <ToastNotification
        message={toastMessage}
        visible={toastVisible}
        onDismiss={() => setToastVisible(false)}
      />
    </main>
  );
}
