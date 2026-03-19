"use client";

import { useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { TopNav } from "@/app/book/home/components/TopNav";
import { useOnboardingState } from "@/app/book/hooks/useOnboardingState";
import { useBookAnalytics } from "@/app/book/hooks/useBookAnalytics";
import { useKeyboardShortcut } from "@/app/book/hooks/useKeyboardShortcut";
import { useSavedBooks } from "@/app/book/hooks/useSavedBooks";
import { useBookViewer } from "@/app/book/hooks/useBookViewer";
import { buildLibraryCatalog, type LibraryBookEntry } from "@/app/book/data/mockUserLibraryState";
import { BookCardLarge } from "@/app/book/library/components/BookCardLarge";

export function SavedBooksClient() {
  const router = useRouter();
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const { state: onboarding, hydrated: onboardingHydrated } = useOnboardingState();
  const { identity: viewerIdentity } = useBookViewer();
  const { analytics, hydrated: analyticsHydrated } = useBookAnalytics(
    onboarding.selectedBookIds,
    onboarding.dailyGoalMinutes
  );
  const { saved, hydrated: savedHydrated, loading, toggleSaved } = useSavedBooks(
    onboarding.setupComplete
  );

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
    if (!onboarding.setupComplete) router.replace("/book");
  }, [onboarding.setupComplete, onboardingHydrated, router]);

  const entries = useMemo<LibraryBookEntry[]>(() => {
    const base = analytics
      ? analytics.bookSnapshots.map((snapshot) => ({
          ...snapshot.book,
          status: snapshot.status,
          progressPercent: snapshot.progressPercent,
          chaptersTotal: snapshot.totalChapters,
          chaptersCompleted: snapshot.completedChapters,
          isNew: snapshot.status === "not_started",
          lastActivityAt: snapshot.lastActivityAt,
        }))
      : buildLibraryCatalog();

    const byId = new Map(base.map((entry) => [entry.id, entry]));
    return saved
      .map((item) => byId.get(item.bookId))
      .filter((entry): entry is LibraryBookEntry => Boolean(entry));
  }, [analytics, saved]);
  const viewerName = viewerIdentity.displayName || "Reader";

  if (!onboardingHydrated || !analyticsHydrated || !savedHydrated || !onboarding.setupComplete) {
    return (
      <main className="cf-app-shell">
        <div className="mx-auto flex min-h-screen items-center justify-center px-4 text-(--cf-text-2)">
          Loading your saved books...
        </div>
      </main>
    );
  }

  return (
    <main className="cf-app-shell">
      <TopNav
        name={viewerName}
        activeTab="saved"
        searchQuery=""
        onSearchChange={() => {}}
        searchInputRef={searchInputRef}
        showSearch={false}
      />

      <section className="mx-auto w-full max-w-7xl px-4 pb-28 pt-7 sm:px-6 sm:pt-8">
        <div className="mb-5 flex items-end justify-between gap-3">
          <div>
            <h1 className="text-5xl font-semibold tracking-tight text-(--cf-text-1)">Read Next</h1>
            <p className="mt-2 text-sm text-(--cf-text-3)">
              Books you intentionally saved for your next stretch of reading.
            </p>
          </div>
          <p className="text-sm text-(--cf-text-soft)">
            {entries.length} {entries.length === 1 ? "book" : "books"} saved
          </p>
        </div>

        {loading ? (
          <div className="rounded-3xl border border-(--cf-border) bg-(--cf-surface-muted) px-6 py-12 text-(--cf-text-2)">
            Loading saved books...
          </div>
        ) : entries.length === 0 ? (
          <div className="rounded-3xl border border-(--cf-border) bg-(--cf-surface-muted) px-6 py-12 text-center">
            <h2 className="text-2xl font-semibold text-(--cf-text-1)">No saved books yet</h2>
            <p className="mt-2 text-(--cf-text-2)">
              Save books from the library and they will appear here as your reading queue.
            </p>
            <button
              type="button"
              onClick={() => router.push("/book/library")}
              className="mt-5 rounded-2xl border border-(--cf-accent-border) bg-(--cf-accent-soft) px-4 py-2.5 text-sm font-medium text-(--cf-accent) transition hover:bg-(--cf-accent-muted)"
            >
              Browse library
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {entries.map((entry) => (
              <BookCardLarge
                key={entry.id}
                entry={entry}
                saved
                onToggleSaved={() => void toggleSaved(entry.id, { source: "saved-page" })}
                onOpen={() => router.push(`/book/library/${encodeURIComponent(entry.id)}`)}
              />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
