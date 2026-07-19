"use client";

import { useCallback, useMemo, useRef } from "react";
import Link from "next/link";
import { TriangleAlert } from "lucide-react";
import { TopNav } from "@/app/book/home/components/TopNav";
import { Toast } from "@/components/ui/Toast";
import { useToast } from "@/app/book/hooks/useToast";
import { useBookViewer } from "@/app/book/hooks/useBookViewer";
import { useLibraryDashboard } from "@/app/book/hooks/useLibraryDashboard";
import { useSavedBooks } from "@/app/book/hooks/useSavedBooks";
import { BookCard } from "@/components/library/BookCard";
import { LibraryGridSkeleton } from "@/components/library/LibrarySkeleton";
import {
  LibraryProvider,
  type LibraryContextValue,
} from "@/components/library/LibraryContext";
import { toLibraryBooks } from "@/components/library/dashboardToLibraryUi";

/**
 * Read Next — rebuilt on the same `components/library` system as the library
 * (glass surface, BookCard, live dashboard data + real save state) so the two
 * screens no longer look like different products one click apart.
 */
export function SavedBooksClient() {
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const { identity } = useBookViewer();
  const { hydrated, catalog, entries, entitlement, error, partial, refetch } =
    useLibraryDashboard();
  const { savedSet, toggleSaved, hydrated: savedHydrated } = useSavedBooks(true);

  const books = useMemo(() => toLibraryBooks(catalog, entries), [catalog, entries]);
  const booksById = useMemo(() => new Map(books.map((b) => [b.id, b])), [books]);
  const isFreeUser = entitlement?.plan !== "PRO";
  const unlockedBookIds = useMemo(
    () => new Set(entitlement?.unlockedBookIds ?? []),
    [entitlement],
  );

  const savedBooks = useMemo(
    () => books.filter((b) => savedSet.has(b.id)),
    [books, savedSet],
  );

  const { toast, showToast } = useToast(3000);
  const onToggleSave = useCallback(
    async (bookId: string, title: string) => {
      const result = await toggleSaved(bookId, { source: "saved-page" });
      if (result.error) {
        showToast("Couldn't update Read Next. Please try again.", "error");
        return;
      }
      showToast(
        result.saved
          ? `Saved “${title}” to Read Next`
          : `Removed “${title}” from Read Next`,
        "success",
      );
    },
    [showToast, toggleSaved],
  );

  const libraryContext = useMemo<LibraryContextValue>(
    () => ({ booksById, isFreeUser, unlockedBookIds, savedSet, onToggleSave }),
    [booksById, isFreeUser, unlockedBookIds, savedSet, onToggleSave],
  );

  const viewerName = identity.displayName || "Reader";
  const loading = !hydrated || !savedHydrated;

  return (
    <main
      className="min-h-screen"
      style={{ background: "var(--cf-page-bg)", color: "var(--cf-text-2)" }}
    >
      <TopNav
        name={viewerName}
        avatarUrl={identity.avatarDataUrl}
        activeTab="saved"
        searchQuery=""
        onSearchChange={() => {}}
        searchInputRef={searchInputRef}
        showSearch={false}
        logoVariant="dashboard"
      />

      <section
        className="mx-auto w-full px-5 pb-24 pt-7 md:px-7"
        style={{ maxWidth: 1080 }}
      >
        <div className="mb-6 flex items-end justify-between gap-3">
          <div>
            <h1
              className="font-(family-name:--font-display) text-[28px] font-bold leading-tight"
              style={{ color: "var(--cf-text-1)" }}
            >
              Read Next
            </h1>
            <p className="mt-1.5 text-cf-body-sm" style={{ color: "var(--cf-text-3)" }}>
              Books you intentionally saved for your next stretch of reading.
            </p>
          </div>
          {!loading && savedBooks.length > 0 && (
            <p className="shrink-0 text-cf-label" style={{ color: "var(--cf-text-soft)" }}>
              {savedBooks.length} {savedBooks.length === 1 ? "book" : "books"} saved
            </p>
          )}
        </div>

        {/* Partial-load notice (#2): critical data is present (the route 503s
            otherwise), but some optional data couldn't be fetched. Non-blocking. */}
        {!loading && !error && partial && (
          <div
            role="status"
            className="cf-banner cf-banner-warning mb-5 flex items-start gap-2 rounded-xl px-4 py-3 text-sm"
          >
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span>We couldn’t load everything — some details may be out of date.</span>
          </div>
        )}

        {loading ? (
          <LibraryGridSkeleton count={8} />
        ) : error ? (
          // A dashboard outage (incl. 503 dashboard_unavailable) must surface a
          // RETRYABLE error — NOT the "No saved books" empty state, which would
          // falsely imply the user has nothing saved, and NOT a FREE-collapsed
          // locked grid. We never read entitlement as FREE on failure.
          <div
            role="alert"
            className="mx-auto max-w-md rounded-2xl px-8 py-12 text-center"
            style={{ background: "var(--bg-glass)", border: "1px solid var(--border-subtle)" }}
          >
            <TriangleAlert
              className="mx-auto h-8 w-8 text-(--cf-warning-text)"
              aria-hidden="true"
            />
            <p className="mt-3 text-cf-body-lg font-semibold" style={{ color: "var(--cf-text-1)" }}>
              We couldn’t load your saved books
            </p>
            <p className="mt-2 text-cf-label" style={{ color: "var(--cf-text-3)" }}>
              Something went wrong loading this page. Please try again.
            </p>
            <button
              type="button"
              onClick={refetch}
              className="mt-5 inline-block rounded-lg px-5 py-2.5 text-cf-label font-semibold transition-colors"
              style={{ background: "var(--cf-accent)", color: "var(--cf-page-bg)" }}
            >
              Try again
            </button>
          </div>
        ) : savedBooks.length === 0 ? (
          <div
            className="mx-auto max-w-md rounded-2xl px-8 py-12 text-center"
            style={{ background: "var(--bg-glass)", border: "1px solid var(--border-subtle)" }}
          >
            <p className="text-cf-body-lg font-semibold" style={{ color: "var(--cf-text-1)" }}>
              No saved books yet
            </p>
            <p className="mt-2 text-cf-label" style={{ color: "var(--cf-text-3)" }}>
              Tap the bookmark on any book in the library to add it to your Read Next queue.
            </p>
            <Link
              href="/book/library"
              className="mt-5 inline-block rounded-lg px-5 py-2.5 text-cf-label font-semibold transition-colors"
              style={{ background: "var(--cf-accent)", color: "var(--cf-page-bg)" }}
            >
              Browse library
            </Link>
          </div>
        ) : (
          <LibraryProvider value={libraryContext}>
            <div className="grid grid-cols-2 gap-x-5 gap-y-6 md:grid-cols-4 lg:grid-cols-5">
              {savedBooks.map((book, i) => (
                <BookCard key={book.id} book={book} index={i} showProLock={isFreeUser} />
              ))}
            </div>
          </LibraryProvider>
        )}
      </section>

      <Toast
        open={toast.open}
        message={toast.message}
        tone={toast.tone}
        detail={toast.detail}
        presentation={toast.presentation}
      />
    </main>
  );
}
