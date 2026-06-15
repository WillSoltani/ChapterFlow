"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { TopNav } from "@/app/book/home/components/TopNav";
import { Toast, type ToastTone } from "@/app/book/components/ui/Toast";
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
  const { hydrated, catalog, entries, entitlement } = useLibraryDashboard();
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

  const [toast, setToast] = useState<{ message: string; tone: ToastTone } | null>(null);
  const onToggleSave = useCallback(
    async (bookId: string, title: string) => {
      const result = await toggleSaved(bookId, { source: "saved-page" });
      if (result.error) {
        setToast({ message: "Couldn't update Read Next. Please try again.", tone: "error" });
        return;
      }
      setToast({
        message: result.saved
          ? `Saved “${title}” to Read Next`
          : `Removed “${title}” from Read Next`,
        tone: "success",
      });
    },
    [toggleSaved],
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
            <p className="mt-1.5 text-[14px]" style={{ color: "var(--cf-text-3)" }}>
              Books you intentionally saved for your next stretch of reading.
            </p>
          </div>
          {!loading && savedBooks.length > 0 && (
            <p className="shrink-0 text-[13px]" style={{ color: "var(--cf-text-soft)" }}>
              {savedBooks.length} {savedBooks.length === 1 ? "book" : "books"} saved
            </p>
          )}
        </div>

        {loading ? (
          <LibraryGridSkeleton count={8} />
        ) : savedBooks.length === 0 ? (
          <div
            className="mx-auto max-w-md rounded-2xl px-8 py-12 text-center"
            style={{ background: "var(--bg-glass)", border: "1px solid var(--border-subtle)" }}
          >
            <p className="text-[16px] font-semibold" style={{ color: "var(--cf-text-1)" }}>
              No saved books yet
            </p>
            <p className="mt-2 text-[13px]" style={{ color: "var(--cf-text-3)" }}>
              Tap the bookmark on any book in the library to add it to your Read Next queue.
            </p>
            <Link
              href="/book/library"
              className="mt-5 inline-block rounded-lg px-5 py-2.5 text-[13px] font-semibold transition-colors"
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
        open={Boolean(toast)}
        message={toast?.message ?? ""}
        tone={toast?.tone ?? "info"}
        onClose={() => setToast(null)}
      />
    </main>
  );
}
