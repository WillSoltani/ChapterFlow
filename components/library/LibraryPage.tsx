"use client";

import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { TriangleAlert } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { TopNav } from "@/components/navigation/TopNav";
import { Toast } from "@/components/ui/Toast";
import { useToast } from "@/hooks/book/useToast";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { useLibraryDashboard } from "@/hooks/book/useLibraryDashboard";
import { emitBookStorageChanged } from "@/lib/client/book-storage-events";
import { useBookViewer } from "@/hooks/book/useBookViewer";
import { useSavedBooks } from "@/hooks/book/useSavedBooks";
import { BookCover } from "@/components/ui/BookCover";
import { deriveReaderLevel } from "@/lib/reader-levels";
import { HeroRecommendation } from "./HeroRecommendation";
import { ActiveReads } from "./ActiveReads";
import { WeeklyChallenge } from "./WeeklyChallenge";
import { CuratedSection } from "./CuratedSection";
import { BrowseAll } from "./BrowseAll";
import { CompletedShelf } from "./CompletedShelf";
import { LibrarySkeleton } from "./LibrarySkeleton";
import { LibraryProvider, type LibraryContextValue } from "./LibraryContext";
import { toLibraryBooks, toUserStats, WEEKLY_CHALLENGE } from "./dashboardToLibraryUi";
import { CURATED_SECTIONS, type LibraryBook } from "./libraryData";

function LibraryStateMessage({ title, body }: { title: string; body: string }) {
  return (
    <div className="px-5 pb-24 pt-16 md:px-7">
      <div
        className="mx-auto max-w-md rounded-2xl px-8 py-12 text-center"
        style={{ background: "var(--bg-glass)", border: "1px solid var(--border-subtle)" }}
      >
        <p className="text-[16px] font-semibold" style={{ color: "var(--text-heading)" }}>
          {title}
        </p>
        <p className="mt-2 text-[13px]" style={{ color: "var(--text-secondary)" }}>
          {body}
        </p>
      </div>
    </div>
  );
}

export function LibraryPage() {
  const searchParams = useSearchParams();
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const { hydrated, error, catalog, entries, entitlement, insightPointsBalance, partial } =
    useLibraryDashboard();
  const { identity } = useBookViewer();
  const { savedSet, toggleSaved } = useSavedBooks(true);

  const firstName = useMemo(
    () => (identity.givenName || identity.displayName || "Reader").split(" ")[0],
    [identity.givenName, identity.displayName],
  );

  const books = useMemo(() => toLibraryBooks(catalog, entries), [catalog, entries]);
  const userStats = useMemo(
    () => toUserStats({ entitlement, entries, insightPointsBalance, firstName }),
    [entitlement, entries, insightPointsBalance, firstName],
  );
  const weeklyChallenge = WEEKLY_CHALLENGE;

  // Named reader tier (NAMED TIERS, not numeric "Level N") — shared derivation
  // with the Progress page via deriveReaderLevel, keyed on the same basis
  // (total completed chapters across the reader's library).
  const readerLevel = useMemo(
    () =>
      deriveReaderLevel(
        entries.reduce((sum, entry) => sum + (entry.chaptersCompleted ?? 0), 0),
      ),
    [entries],
  );

  const booksById = useMemo(() => new Map(books.map((b) => [b.id, b])), [books]);
  const isFreeUser = !userStats.isPro;
  const unlockedBookIds = useMemo(
    () => new Set(entitlement?.unlockedBookIds ?? []),
    [entitlement],
  );

  // ── Save (Read Next) + toast ──
  const { toast, showToast } = useToast(3000);
  const onToggleSave = useCallback(
    async (bookId: string, title: string) => {
      const result = await toggleSaved(bookId, { source: "library" });
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

  // "Active read" = any started, not-yet-completed book.
  const inProgressBooks = useMemo(
    () => books.filter((b) => b.userProgress && !b.userProgress.isCompleted),
    [books],
  );
  const completedBooks = useMemo(() => books.filter((b) => b.userProgress?.isCompleted), [books]);

  // Hero book = most recently read in-progress, or a featured (staff-picked)
  // not-started book, or simply the first book. No fabricated popularity sort.
  const heroBook = useMemo<LibraryBook | undefined>(() => {
    if (inProgressBooks.length > 0) {
      return [...inProgressBooks].sort(
        (a, b) =>
          (b.userProgress?.lastReadAt.getTime() ?? 0) - (a.userProgress?.lastReadAt.getTime() ?? 0),
      )[0];
    }
    const notStarted = books.filter((b) => !b.userProgress);
    return notStarted.find((b) => b.staffPickReason) ?? notStarted[0] ?? books[0];
  }, [inProgressBooks, books]);

  // Hero alternatives: up to 3 books from DIFFERENT categories (diversified,
  // in catalog order — no fabricated reader-count ranking).
  const heroAlternatives = useMemo(() => {
    if (!heroBook) return [];
    const candidates = books.filter(
      (b) =>
        b.id !== heroBook.id && b.category !== heroBook.category && !b.userProgress?.isCompleted,
    );
    const picked: LibraryBook[] = [];
    const usedCategories = new Set<string>();
    for (const b of candidates) {
      if (!usedCategories.has(b.category)) {
        picked.push(b);
        usedCategories.add(b.category);
      }
      if (picked.length >= 3) break;
    }
    return picked;
  }, [heroBook, books]);

  const otherInProgress = useMemo(
    () => inProgressBooks.filter((b) => b.id !== heroBook?.id),
    [inProgressBooks, heroBook],
  );

  const curatedSections = useMemo(
    () =>
      CURATED_SECTIONS.map((section) => ({
        ...section,
        books: section.bookIds
          .map((id) => booksById.get(id))
          .filter((b): b is LibraryBook => Boolean(b)),
      })),
    [booksById],
  );

  const handleBrowseCategory = useCallback(() => {
    document.getElementById("browse-all")?.scrollIntoView({ behavior: "smooth" });
  }, []);

  const freeExhausted = isFreeUser && userStats.freeBooksUsed >= userStats.freeBooksLimit;
  const [bannerDismissed, setBannerDismissed] = useState(false);

  // Completion celebration (Change 11) — fires once per newly completed book
  const completedParam = searchParams.get("completed");
  const [celebrationBook, setCelebrationBook] = useState<string | null>(null);
  const celebrationToastKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (!completedParam) return;
    const key = `celebrated_${completedParam}`;
    if (typeof window !== "undefined" && !localStorage.getItem(key)) {
      localStorage.setItem(key, "true");
      /* eslint-disable react-hooks/set-state-in-effect */
      setCelebrationBook(completedParam);
      /* eslint-enable react-hooks/set-state-in-effect */
    }
  }, [completedParam]);

  const celebratedBookData = celebrationBook ? booksById.get(celebrationBook) ?? null : null;
  useEffect(() => {
    if (!celebrationBook || !celebratedBookData) return;
    if (celebrationToastKeyRef.current === celebrationBook) return;
    celebrationToastKeyRef.current = celebrationBook;
    const xp = celebratedBookData.userProgress?.xpEarned ?? 0;
    showToast(`You've mastered ${celebratedBookData.title}!`, "success", {
      autoDismissMs: 5000,
      detail: `${xp > 0 ? `+${xp} IP earned · ` : ""}${readerLevel}`,
      presentation: "celebration",
    });
  }, [celebratedBookData, celebrationBook, readerLevel, showToast]);

  // Search query from navbar / URL → auto-scroll to Browse All
  const navSearchQuery = searchParams.get("q") ?? "";
  useEffect(() => {
    if (navSearchQuery) {
      const t = setTimeout(() => {
        document.getElementById("browse-all")?.scrollIntoView({ behavior: "smooth" });
      }, 300);
      return () => clearTimeout(t);
    }
  }, [navSearchQuery]);

  // Up to 3 Pro books (catalog order) for the exhaustion banner — no fake ranking.
  const topProBooks = useMemo(
    () => books.filter((b) => b.isPro && !b.userProgress).slice(0, 3),
    [books],
  );

  return (
    <div
      className="min-h-screen"
      style={{ background: "var(--bg-base)", color: "var(--text-primary)" }}
    >
      <TopNav
        name={userStats.firstName}
        activeTab="library"
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        searchInputRef={searchInputRef}
        logoVariant="dashboard"
      />

      <main>
        <h1 className="sr-only">Your library</h1>

        {!hydrated ? (
          <LibrarySkeleton />
      ) : !heroBook ? (
        error ? (
          <div className="grid min-h-[60vh] place-content-center px-5 py-16 md:px-7">
            <ErrorBanner
              className="mx-auto max-w-md"
              title="We couldn't load your library"
              message="Something went wrong loading your library. If this keeps happening, your library may not be published yet."
              onRetry={() => emitBookStorageChanged("library-retry")}
            />
          </div>
        ) : (
          <LibraryStateMessage
            title="No books available yet"
            body="Your library is empty right now. New books will appear here once they're published."
          />
        )
      ) : (
        <LibraryProvider value={libraryContext}>
          {/* Section 1: Hero Recommendation */}
          <HeroRecommendation
            heroBook={heroBook}
            alternatives={heroAlternatives}
            userName={userStats.firstName}
          />

          <div className="px-5 pb-24 md:px-7">
            {/* Partial-load notice (#2): critical data is present (the dashboard
                route 503s → `error` above otherwise), but some optional source
                (saved / insightPoints / readingDays / settings / profile /
                badgeAwards) couldn't be fetched. Non-blocking — mirrors the same
                banner the sibling surfaces (SavedBooksClient / WorkspacePage)
                render so an optional-source failure doesn't degrade silently. */}
            {!error && partial && (
              <div
                role="status"
                className="cf-banner cf-banner-warning mb-5 flex items-start gap-2 rounded-xl px-4 py-3 text-sm"
              >
                <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                <span>We couldn’t load everything — some details may be out of date.</span>
              </div>
            )}

            {/* Section 2: Active Reads (any in-progress book beyond the hero) */}
            {otherInProgress.length >= 1 && <ActiveReads books={otherInProgress} />}

            {/* Free-tier exhaustion banner */}
            <AnimatePresence>
              {freeExhausted && !bannerDismissed && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mt-10 overflow-hidden rounded-xl px-6 py-5"
                  style={{
                    maxWidth: 1080,
                    margin: "40px auto 0",
                    background: "var(--bg-glass)",
                    border: "1px solid var(--border-subtle)",
                  }}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-[15px] font-semibold" style={{ color: "var(--text-heading)" }}>
                        You&apos;ve explored your free books — unlock the full library with Pro
                      </p>
                      <p className="mt-1 text-[13px]" style={{ color: "var(--text-secondary)" }}>
                        Your reading progress is saved — upgrade to continue your journey.
                      </p>
                      <div className="mt-3 flex items-center gap-3">
                        {topProBooks.map((book) => (
                          <div
                            key={book.id}
                            className="relative shrink-0 overflow-hidden"
                            style={{ width: 36, height: 50, borderRadius: 4, boxShadow: "var(--shadow-book)" }}
                          >
                            <BookCover
                              bookId={book.id}
                              title={book.title}
                              coverGradient={book.coverGradient}
                              coverImage={book.coverImage}
                              fill
                            />
                          </div>
                        ))}
                        <a
                          href="/pricing"
                          className="ml-2 rounded-lg px-4 py-2 text-[13px] font-semibold text-black transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--accent-amber) focus-visible:ring-offset-2 focus-visible:ring-offset-(--cf-page-bg)"
                          style={{ background: "var(--cf-upgrade-accent)" }}
                        >
                          Upgrade to Pro →
                        </a>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setBannerDismissed(true)}
                      className="shrink-0 cursor-pointer p-1"
                      style={{ color: "var(--text-muted)", opacity: 0.5 }}
                      aria-label="Dismiss"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Section 3: Weekly focus */}
            <WeeklyChallenge challenge={weeklyChallenge} onBrowseCategory={handleBrowseCategory} />

            {/* Sections 4-7: Curated Discovery (skip sections with no resolvable books) */}
            {curatedSections
              .filter((section) => section.books.length > 0)
              .map((section) => (
              <CuratedSection
                key={section.narrativeTitle}
                narrativeTitle={section.narrativeTitle}
                narrativeSubtitle={section.narrativeSubtitle}
                books={section.books}
                showProLock={isFreeUser}
              />
            ))}

            {/* Section 8: Browse All */}
            <BrowseAll books={books} showProLock={isFreeUser} searchQuery={navSearchQuery} />

            {/* Section 9: Completed Shelf */}
            <CompletedShelf books={completedBooks} />
          </div>
        </LibraryProvider>
      )}
      </main>

      {/* Completion and Save (Read Next) feedback */}
      <Toast
        open={toast.open}
        message={toast.message}
        tone={toast.tone}
        detail={toast.detail}
        presentation={toast.presentation}
      />
    </div>
  );
}
