"use client";

import { useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { TopNav } from "@/app/book/home/components/TopNav";
import { useOnboardingState } from "@/app/book/hooks/useOnboardingState";
import { useBookAnalytics } from "@/app/book/hooks/useBookAnalytics";
import { useKeyboardShortcut } from "@/app/book/hooks/useKeyboardShortcut";
import { useSavedBooks } from "@/app/book/hooks/useSavedBooks";
import { useBookViewer } from "@/app/book/hooks/useBookViewer";
import {
  LIBRARY_CATEGORY_OPTIONS,
  LIBRARY_DIFFICULTY_OPTIONS,
  LIBRARY_SORT_OPTIONS,
  LIBRARY_STATUS_OPTIONS,
  type LibraryBookEntry,
  buildLibraryCatalog,
} from "@/app/book/data/mockUserLibraryState";
import { useLibraryFilters } from "@/app/book/library/hooks/useLibraryFilters";
import { useLibraryPagination } from "@/app/book/library/hooks/useLibraryPagination";
import { LibrarySearchBar } from "@/app/book/library/components/LibrarySearchBar";
import { LibraryFilters } from "@/app/book/library/components/LibraryFilters";
import { LibraryPaginationControls } from "@/app/book/library/components/LibraryPaginationControls";
import { BookCardLarge } from "@/app/book/library/components/BookCardLarge";

const LIBRARY_PAGE_SIZE_OPTIONS = [10, 20, 30, 50];

function SkeletonCard() {
  return (
    <div className="animate-pulse rounded-3xl border border-(--cf-border) bg-(--cf-surface-muted) p-4 sm:p-5">
      <div className="h-72 rounded-2xl bg-(--cf-border) sm:h-80" />
      <div className="mt-4 h-7 w-2/3 rounded bg-(--cf-border)" />
      <div className="mt-2 h-5 w-1/2 rounded bg-(--cf-border)" />
      <div className="mt-3 h-8 w-full rounded bg-(--cf-border)" />
      <div className="mt-4 h-2.5 w-full rounded bg-(--cf-border)" />
    </div>
  );
}

export function BookLibraryClient() {
  const router = useRouter();
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  const { state: onboarding, hydrated: onboardingHydrated } = useOnboardingState();
  const { identity: viewerIdentity } = useBookViewer();
  const { analytics, hydrated: analyticsHydrated } = useBookAnalytics(
    onboarding.selectedBookIds,
    onboarding.dailyGoalMinutes
  );
  const { savedSet, toggleSaved, hydrated: savedHydrated } = useSavedBooks(
    onboarding.setupComplete
  );

  const libraryEntries = useMemo<LibraryBookEntry[]>(() => {
    if (!analytics) return buildLibraryCatalog();

    const selectedSet = new Set(onboarding.selectedBookIds);
    const selectedOrder = new Map(
      onboarding.selectedBookIds.map((bookId, index) => [bookId, index])
    );

    const ranked = [...analytics.bookSnapshots].sort((left, right) => {
      const leftSelected = selectedSet.has(left.book.id);
      const rightSelected = selectedSet.has(right.book.id);
      if (leftSelected !== rightSelected) return leftSelected ? -1 : 1;
      if (leftSelected && rightSelected) {
        return (
          (selectedOrder.get(left.book.id) ?? Number.MAX_SAFE_INTEGER) -
          (selectedOrder.get(right.book.id) ?? Number.MAX_SAFE_INTEGER)
        );
      }
      if (left.progressPercent !== right.progressPercent) {
        return right.progressPercent - left.progressPercent;
      }
      return left.book.title.localeCompare(right.book.title);
    });

    return ranked.map((snapshot) => ({
      ...snapshot.book,
      status: snapshot.status,
      progressPercent: snapshot.progressPercent,
      chaptersTotal: snapshot.totalChapters,
      chaptersCompleted: snapshot.completedChapters,
      isNew: snapshot.status === "not_started",
      lastActivityAt: snapshot.lastActivityAt,
    }));
  }, [analytics, onboarding.selectedBookIds]);
  const {
    hydrated,
    loading,
    filters,
    displayedEntries,
    totalCount,
    setSearchQuery,
    setCategory,
    setDifficulty,
    setStatus,
    setSort,
    clearChipFilters,
    hasActiveChipFilters,
  } = useLibraryFilters(libraryEntries);
  const pagination = useLibraryPagination({
    entries: displayedEntries,
    defaultPageSize: 10,
    pageSizeOptions: LIBRARY_PAGE_SIZE_OPTIONS,
  });
  const viewerName = viewerIdentity.displayName || "Reader";

  useKeyboardShortcut(
    "/",
    (event) => {
      event.preventDefault();
      searchInputRef.current?.focus();
    },
    { ignoreWhenTyping: true }
  );

  useEffect(() => {
    if (!onboardingHydrated) return;
    if (!onboarding.setupComplete) {
      router.replace("/book");
    }
  }, [onboarding.setupComplete, onboardingHydrated, router]);

  if (!onboardingHydrated || !analyticsHydrated || !hydrated || !savedHydrated || !onboarding.setupComplete) {
    return (
      <main className="cf-app-shell">
        <div className="mx-auto flex min-h-screen items-center justify-center px-4 text-(--cf-text-2)">
          Loading library...
        </div>
      </main>
    );
  }

  return (
    <main className="cf-app-shell">
      <TopNav
        name={viewerName}
        activeTab="library"
        searchQuery={filters.searchQuery}
        onSearchChange={setSearchQuery}
        searchInputRef={searchInputRef}
        showSearch={false}
      />

      <section className="mx-auto w-full max-w-7xl px-4 pb-28 pt-7 sm:px-6 sm:pt-8">
        <div className="mb-5 flex items-end justify-between gap-3">
          <h1 className="text-5xl font-semibold tracking-tight text-(--cf-text-1)">Library</h1>
          <p className="text-sm text-(--cf-text-3)">
            {totalCount} {totalCount === 1 ? "book" : "books"} found
          </p>
        </div>

        <LibrarySearchBar
          value={filters.searchQuery}
          onChange={setSearchQuery}
          inputRef={searchInputRef}
          sortValue={filters.sort}
          onSortChange={setSort}
          sortOptions={LIBRARY_SORT_OPTIONS}
        />

        <div className="mt-4">
          <LibraryFilters
            category={filters.category}
            difficulty={filters.difficulty}
            status={filters.status}
            categoryOptions={LIBRARY_CATEGORY_OPTIONS}
            difficultyOptions={LIBRARY_DIFFICULTY_OPTIONS}
            statusOptions={LIBRARY_STATUS_OPTIONS}
            onCategoryChange={setCategory}
            onDifficultyChange={setDifficulty}
            onStatusChange={setStatus}
            showClearFilters={hasActiveChipFilters}
            onClearFilters={clearChipFilters}
          />
        </div>

        <div className="mt-6 border-t border-(--cf-divider) pt-6">
          {onboarding.selectedBookIds.length === 0 ? (
            <div className="rounded-3xl border border-(--cf-border) bg-(--cf-surface-muted) px-6 py-14 text-center">
              <h2 className="text-2xl font-semibold text-(--cf-text-1)">
                Your library is empty.
              </h2>
              <p className="mt-2 text-(--cf-text-2)">
                Finish setup to choose your first book and start your reading path.
              </p>
              <button
                type="button"
                onClick={() => router.push("/book")}
                className="mt-5 rounded-2xl border border-(--cf-accent-border) bg-(--cf-accent-soft) px-4 py-2.5 text-sm font-medium text-(--cf-info-text) transition hover:bg-(--cf-accent-muted)"
              >
                Finish setup
              </button>
            </div>
          ) : loading ? (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 6 }).map((_, index) => (
                <SkeletonCard key={index} />
              ))}
            </div>
          ) : displayedEntries.length === 0 ? (
            <div className="rounded-3xl border border-(--cf-border) bg-(--cf-surface-muted) px-6 py-14 text-center">
              <h2 className="text-2xl font-semibold text-(--cf-text-1)">
                No books match your filters.
              </h2>
              <p className="mt-2 text-(--cf-text-2)">
                Try clearing your filters or searching for a different title.
              </p>
              <button
                type="button"
                onClick={clearChipFilters}
                className="mt-5 rounded-2xl border border-(--cf-accent-border) bg-(--cf-accent-soft) px-4 py-2.5 text-sm font-medium text-(--cf-info-text) transition hover:bg-(--cf-accent-muted)"
              >
                Clear filters
              </button>
            </div>
          ) : (
            <div className="space-y-5">
              <LibraryPaginationControls
                currentPage={pagination.currentPage}
                totalPages={pagination.totalPages}
                totalCount={pagination.totalCount}
                rangeStart={pagination.rangeStart}
                rangeEnd={pagination.rangeEnd}
                pageSize={pagination.pageSize}
                pageSizeOptions={pagination.pageSizeOptions}
                pageNumbers={pagination.pageNumbers}
                canGoPrevious={pagination.canGoPrevious}
                canGoNext={pagination.canGoNext}
                onPageChange={pagination.setPage}
                onPageSizeChange={pagination.setPageSize}
                onPrevious={pagination.goToPreviousPage}
                onNext={pagination.goToNextPage}
              />

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                {pagination.pageEntries.map((entry) => (
                  <BookCardLarge
                    key={entry.id}
                    entry={entry}
                    saved={savedSet.has(entry.id)}
                    onToggleSaved={() => void toggleSaved(entry.id, { source: "library-card" })}
                    onOpen={() => router.push(`/book/library/${encodeURIComponent(entry.id)}`)}
                  />
                ))}
              </div>

              {pagination.totalPages > 1 ? (
                <LibraryPaginationControls
                  currentPage={pagination.currentPage}
                  totalPages={pagination.totalPages}
                  totalCount={pagination.totalCount}
                  rangeStart={pagination.rangeStart}
                  rangeEnd={pagination.rangeEnd}
                  pageSize={pagination.pageSize}
                  pageSizeOptions={pagination.pageSizeOptions}
                  pageNumbers={pagination.pageNumbers}
                  canGoPrevious={pagination.canGoPrevious}
                  canGoNext={pagination.canGoNext}
                  onPageChange={pagination.setPage}
                  onPageSizeChange={pagination.setPageSize}
                  onPrevious={pagination.goToPreviousPage}
                  onNext={pagination.goToNextPage}
                  showPageSize={false}
                />
              ) : null}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
