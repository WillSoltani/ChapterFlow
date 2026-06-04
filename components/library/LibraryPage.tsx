"use client";

import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { TopNav } from "@/app/book/home/components/TopNav";
import { HeroRecommendation } from "./HeroRecommendation";
import { ActiveReads } from "./ActiveReads";
import { WeeklyChallenge } from "./WeeklyChallenge";
import { CuratedSection } from "./CuratedSection";
import { BrowseAll } from "./BrowseAll";
import { CompletedShelf } from "./CompletedShelf";
import { useLibraryDashboard } from "@/app/book/hooks/useLibraryDashboard";
import { useBookViewer } from "@/app/book/hooks/useBookViewer";
import { toLibraryBooks, toUserStats, WEEKLY_CHALLENGE } from "./dashboardToLibraryUi";
import { CURATED_SECTIONS, type LibraryBook } from "./libraryData";

/** Completion celebration toast (Change 11) */
function CelebrationToast({
  bookTitle,
  xp,
  level,
  visible,
  onDismiss,
}: {
  bookTitle: string;
  xp: number;
  level: number;
  visible: boolean;
  onDismiss: () => void;
}) {
  useEffect(() => {
    if (!visible) return;
    const t = setTimeout(onDismiss, 5000);
    return () => clearTimeout(t);
  }, [visible, onDismiss]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, x: 100 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 100 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
          className="fixed right-5 top-20 z-50 max-w-sm overflow-hidden rounded-xl"
          style={{
            background: "var(--bg-glass)",
            backdropFilter: "blur(12px)",
            border: "1px solid rgba(245,158,11,0.2)",
            borderTop: "1px solid var(--border-emphasis)",
            borderLeft: "4px solid var(--accent-amber)",
            boxShadow: "0 12px 40px rgba(0,0,0,0.5)",
          }}
        >
          <div className="px-5 py-4">
            <p className="text-[15px] font-semibold" style={{ color: "var(--text-heading)" }}>
              You&apos;ve mastered {bookTitle}!
            </p>
            <p className="mt-1 text-[13px]" style={{ color: "var(--accent-amber)" }}>
              +{xp} IP earned · Level {level} Reader
            </p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

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
  const router = useRouter();
  const searchParams = useSearchParams();
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const { hydrated, error, catalog, entries, entitlement, insightPointsBalance } =
    useLibraryDashboard();
  const { identity } = useBookViewer();

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

  const booksById = useMemo(() => new Map(books.map((b) => [b.id, b])), [books]);

  // "Active read" = any started, not-yet-completed book. Don't require
  // percentComplete > 0: starting a book seeds a 0%-progress row, and the
  // not-started pool keys off `!userProgress`, so without this a just-opened
  // book would fall into limbo (excluded from both Active Reads and Discover).
  const inProgressBooks = useMemo(
    () => books.filter((b) => b.userProgress && !b.userProgress.isCompleted),
    [books],
  );
  const completedBooks = useMemo(() => books.filter((b) => b.userProgress?.isCompleted), [books]);

  // Hero book = most recently read in-progress, or first popular not-started,
  // or simply the first book. `undefined` only when the catalog is empty.
  const heroBook = useMemo<LibraryBook | undefined>(() => {
    if (inProgressBooks.length > 0) {
      return [...inProgressBooks].sort(
        (a, b) =>
          (b.userProgress?.lastReadAt.getTime() ?? 0) - (a.userProgress?.lastReadAt.getTime() ?? 0),
      )[0];
    }
    const notStarted = books
      .filter((b) => !b.userProgress)
      .sort((a, b) => b.readerCount - a.readerCount);
    return notStarted[0] ?? books[0];
  }, [inProgressBooks, books]);

  // Hero alternatives: up to 3 books from DIFFERENT categories (diversified)
  const heroAlternatives = useMemo(() => {
    if (!heroBook) return [];
    const candidates = books
      .filter(
        (b) =>
          b.id !== heroBook.id && b.category !== heroBook.category && !b.userProgress?.isCompleted,
      )
      .sort((a, b) => b.readerCount - a.readerCount);
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

  // Other in-progress books (excluding hero)
  const otherInProgress = useMemo(
    () => inProgressBooks.filter((b) => b.id !== heroBook?.id),
    [inProgressBooks, heroBook],
  );

  // Resolve curated section books
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

  const handleBookClick = useCallback(
    (bookId: string) => {
      router.push(`/book/library/${encodeURIComponent(bookId)}`);
    },
    [router],
  );

  const handleBrowseCategory = useCallback(() => {
    document.getElementById("browse-all")?.scrollIntoView({ behavior: "smooth" });
  }, []);

  const isFreeUser = !userStats.isPro;
  const freeExhausted = isFreeUser && userStats.freeBooksUsed >= userStats.freeBooksLimit;
  const [bannerDismissed, setBannerDismissed] = useState(false);

  // Completion celebration (Change 11) — fires once per newly completed book
  const completedParam = searchParams.get("completed");
  const [celebrationBook, setCelebrationBook] = useState<string | null>(null);
  const [showCelebrationToast, setShowCelebrationToast] = useState(false);

  useEffect(() => {
    if (!completedParam) return;
    const key = `celebrated_${completedParam}`;
    if (typeof window !== "undefined" && !localStorage.getItem(key)) {
      localStorage.setItem(key, "true");
      // One-shot celebration keyed off the ?completed= URL param + a localStorage
      // guard. setState-in-effect is the correct pattern here (runs once per
      // param, post-hydration) — a lazy useState initializer would read
      // localStorage during render and cause an SSR hydration mismatch.
      /* eslint-disable react-hooks/set-state-in-effect */
      setCelebrationBook(completedParam);
      setShowCelebrationToast(true);
      /* eslint-enable react-hooks/set-state-in-effect */
    }
  }, [completedParam]);

  const celebratedBookData = celebrationBook ? booksById.get(celebrationBook) ?? null : null;

  // Search query from navbar → auto-scroll to Browse All and pass as filter
  const navSearchQuery = searchParams.get("q") ?? "";
  useEffect(() => {
    if (navSearchQuery) {
      const t = setTimeout(() => {
        document.getElementById("browse-all")?.scrollIntoView({ behavior: "smooth" });
      }, 300);
      return () => clearTimeout(t);
    }
  }, [navSearchQuery]);

  // Top 3 most popular Pro books for the exhaustion banner
  const topProBooks = useMemo(
    () =>
      books
        .filter((b) => b.isPro && !b.userProgress)
        .sort((a, b) => b.readerCount - a.readerCount)
        .slice(0, 3),
    [books],
  );

  return (
    <main
      className="min-h-screen"
      style={{ background: "var(--bg-base)", color: "var(--text-primary)" }}
    >
      {/* Navbar */}
      <TopNav
        name={userStats.firstName}
        activeTab="library"
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        searchInputRef={searchInputRef}
        logoVariant="dashboard"
      />

      {!hydrated ? (
        <LibraryStateMessage title="Loading your library…" body="Fetching your books and progress." />
      ) : !heroBook ? (
        error ? (
          <LibraryStateMessage
            title="We couldn't load your library"
            body="Please refresh the page. If this keeps happening, your library may not be published yet."
          />
        ) : (
          <LibraryStateMessage
            title="No books available yet"
            body="Your library is empty right now. New books will appear here once they're published."
          />
        )
      ) : (
        <>
          {/* Section 1: Hero Recommendation */}
          <HeroRecommendation
            heroBook={heroBook}
            alternatives={heroAlternatives}
            userName={userStats.firstName}
            onBookClick={handleBookClick}
          />

          <div className="px-5 pb-24 md:px-7">
            {/* Section 2: Active Reads (only if 2+ in-progress, since hero shows 1) */}
            {otherInProgress.length >= 1 && (
              <ActiveReads books={otherInProgress} onBookClick={handleBookClick} />
            )}

            {/* Free-tier exhaustion banner — Endowment Effect + Scarcity (Cialdini) */}
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
                    background:
                      "linear-gradient(135deg, rgba(34,211,238,0.05) 0%, rgba(245,158,11,0.04) 100%)",
                    border: "1px solid rgba(34,211,238,0.15)",
                  }}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p
                        className="text-[15px] font-semibold"
                        style={{ color: "var(--text-heading)" }}
                      >
                        You&apos;ve explored your free books — unlock all 25 with Pro
                      </p>
                      <p className="mt-1 text-[13px]" style={{ color: "var(--text-secondary)" }}>
                        Your reading progress is saved — upgrade to continue your journey.
                      </p>
                      <div className="mt-3 flex items-center gap-3">
                        {topProBooks.map((book) => (
                          <div
                            key={book.id}
                            className="shrink-0 overflow-hidden"
                            style={{
                              width: 36,
                              height: 50,
                              borderRadius: 4,
                              boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
                            }}
                          >
                            <img
                              src={book.coverImage}
                              alt={book.title}
                              className="h-full w-full object-cover"
                            />
                          </div>
                        ))}
                        <a
                          href="/pricing"
                          className="ml-2 rounded-lg px-4 py-2 text-[13px] font-semibold transition-colors"
                          style={{ background: "var(--accent-cyan)", color: "var(--bg-base)" }}
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
                    >
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Section 3: Weekly Challenge */}
            <WeeklyChallenge challenge={weeklyChallenge} onBrowseCategory={handleBrowseCategory} />

            {/* Sections 4-7: Curated Discovery */}
            {curatedSections.map((section) => (
              <CuratedSection
                key={section.narrativeTitle}
                narrativeTitle={section.narrativeTitle}
                narrativeSubtitle={section.narrativeSubtitle}
                books={section.books}
                onBookClick={handleBookClick}
                showProLock={isFreeUser}
              />
            ))}

            {/* Section 8: Browse All */}
            <BrowseAll
              books={books}
              onBookClick={handleBookClick}
              showProLock={isFreeUser}
              searchQuery={navSearchQuery}
            />

            {/* Section 9: Completed Shelf */}
            <CompletedShelf books={completedBooks} onBookClick={handleBookClick} />
          </div>
        </>
      )}

      {/* Completion celebration toast (Change 11) */}
      {celebratedBookData && (
        <CelebrationToast
          bookTitle={celebratedBookData.title}
          xp={celebratedBookData.userProgress?.xpEarned ?? 0}
          level={userStats.level}
          visible={showCelebrationToast}
          onDismiss={() => setShowCelebrationToast(false)}
        />
      )}
    </main>
  );
}
