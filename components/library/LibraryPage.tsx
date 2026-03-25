"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { DashboardNavbar } from "@/components/dashboard/DashboardNavbar";
import { ReaderStatusBar } from "./ReaderStatusBar";
import { HeroRecommendation } from "./HeroRecommendation";
import { ActiveReads } from "./ActiveReads";
import { WeeklyChallenge } from "./WeeklyChallenge";
import { CuratedSection } from "./CuratedSection";
import { BrowseAll } from "./BrowseAll";
import { CompletedShelf } from "./CompletedShelf";
import {
  MOCK_BOOKS,
  MOCK_USER_STATS,
  MOCK_WEEKLY_CHALLENGE,
  CURATED_SECTIONS,
  getInProgressBooks,
  getCompletedBooks,
  getBooksById,
} from "./libraryData";

/** Completion celebration toast (Change 11) */
function CelebrationToast({
  bookTitle,
  xp,
  visible,
  onDismiss,
}: {
  bookTitle: string;
  xp: number;
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
            background: "var(--bg-raised)",
            border: "1px solid rgba(255,215,0,0.2)",
            borderLeft: "4px solid var(--accent-gold)",
            boxShadow: "0 12px 40px rgba(0,0,0,0.5)",
          }}
        >
          <div className="px-5 py-4">
            <p className="text-[15px] font-semibold" style={{ color: "var(--text-heading)" }}>
              You&apos;ve mastered {bookTitle}!
            </p>
            <p className="mt-1 text-[13px]" style={{ color: "var(--cf-amber-text)" }}>
              +{xp} XP earned · Level {MOCK_USER_STATS.level} Reader
            </p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function LibraryPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const prefersReduced = useReducedMotion();

  const inProgressBooks = useMemo(() => getInProgressBooks(), []);
  const completedBooks = useMemo(() => getCompletedBooks(), []);

  // Hero book = most recently read in-progress, or first popular not-started
  const heroBook = useMemo(() => {
    if (inProgressBooks.length > 0) {
      return [...inProgressBooks].sort(
        (a, b) =>
          (b.userProgress?.lastReadAt.getTime() ?? 0) -
          (a.userProgress?.lastReadAt.getTime() ?? 0)
      )[0];
    }
    return MOCK_BOOKS.filter((b) => !b.userProgress).sort(
      (a, b) => b.readerCount - a.readerCount
    )[0];
  }, [inProgressBooks]);

  // Hero alternatives: 3 books from DIFFERENT categories (diversified)
  const heroAlternatives = useMemo(() => {
    const candidates = MOCK_BOOKS.filter(
      (b) =>
        b.id !== heroBook.id &&
        b.category !== heroBook.category &&
        !b.userProgress?.isCompleted
    ).sort((a, b) => b.readerCount - a.readerCount);
    // Pick one per category for max diversity
    const picked: typeof candidates = [];
    const usedCategories = new Set<string>();
    for (const b of candidates) {
      if (!usedCategories.has(b.category)) {
        picked.push(b);
        usedCategories.add(b.category);
      }
      if (picked.length >= 3) break;
    }
    return picked;
  }, [heroBook]);

  // Other in-progress books (excluding hero)
  const otherInProgress = useMemo(
    () => inProgressBooks.filter((b) => b.id !== heroBook.id),
    [inProgressBooks, heroBook]
  );

  // Resolve curated section books
  const curatedSections = useMemo(
    () =>
      CURATED_SECTIONS.map((section) => ({
        ...section,
        books: getBooksById(section.bookIds),
      })),
    []
  );

  const handleBookClick = useCallback(
    (bookId: string) => {
      router.push(`/book/library/${encodeURIComponent(bookId)}`);
    },
    [router]
  );

  const handleBrowseCategory = useCallback((cat: string) => {
    document.getElementById("browse-all")?.scrollIntoView({ behavior: "smooth" });
  }, []);

  const isFreeUser = !MOCK_USER_STATS.isPro;
  const freeExhausted =
    isFreeUser &&
    MOCK_USER_STATS.freeBooksUsed >= MOCK_USER_STATS.freeBooksLimit;
  const [bannerDismissed, setBannerDismissed] = useState(false);

  // Completion celebration (Change 11) — fires once per newly completed book
  const completedParam = searchParams.get("completed");
  const [celebrationBook, setCelebrationBook] = useState<string | null>(null);
  const [showCelebrationToast, setShowCelebrationToast] = useState(false);

  useEffect(() => {
    if (!completedParam) return;
    // Check localStorage to avoid replaying
    const key = `celebrated_${completedParam}`;
    if (typeof window !== "undefined" && !localStorage.getItem(key)) {
      localStorage.setItem(key, "true");
      setCelebrationBook(completedParam);
      setShowCelebrationToast(true);
    }
  }, [completedParam]);

  const celebratedBookData = celebrationBook
    ? MOCK_BOOKS.find((b) => b.id === celebrationBook)
    : null;

  // Search query from navbar → auto-scroll to Browse All and pass as filter
  const navSearchQuery = searchParams.get("q") ?? "";
  useEffect(() => {
    if (navSearchQuery) {
      // Slight delay so the page renders first
      const t = setTimeout(() => {
        document.getElementById("browse-all")?.scrollIntoView({ behavior: "smooth" });
      }, 300);
      return () => clearTimeout(t);
    }
  }, [navSearchQuery]);

  // Top 3 most popular Pro books for the exhaustion banner
  const topProBooks = useMemo(
    () =>
      MOCK_BOOKS.filter((b) => b.isPro && !b.userProgress)
        .sort((a, b) => b.readerCount - a.readerCount)
        .slice(0, 3),
    []
  );

  return (
    <main
      className="min-h-screen"
      style={{ background: "var(--bg-base)", color: "var(--text-primary)" }}
    >
      {/* Navbar */}
      <DashboardNavbar />

      {/* Section 0: Reader Status Bar */}
      <ReaderStatusBar stats={MOCK_USER_STATS} />

      {/* Section 1: Hero Recommendation */}
      <HeroRecommendation
        heroBook={heroBook}
        alternatives={heroAlternatives}
        userName={MOCK_USER_STATS.firstName}
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
                background: "linear-gradient(135deg, rgba(45,212,191,0.05) 0%, rgba(232,185,49,0.04) 100%)",
                border: "1px solid rgba(45,212,191,0.15)",
              }}
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[15px] font-semibold" style={{ color: "var(--text-heading)" }}>
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
                        style={{ width: 36, height: 50, borderRadius: 4, boxShadow: "0 2px 8px rgba(0,0,0,0.3)" }}
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
                      style={{
                        background: "var(--accent-teal)",
                        color: "var(--bg-base)",
                      }}
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
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Section 3: Weekly Challenge */}
        <WeeklyChallenge
          challenge={MOCK_WEEKLY_CHALLENGE}
          onBrowseCategory={handleBrowseCategory}
        />

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
          books={MOCK_BOOKS}
          onBookClick={handleBookClick}
          showProLock={isFreeUser}
          searchQuery={navSearchQuery}
        />

        {/* Section 9: Completed Shelf */}
        <CompletedShelf
          books={completedBooks}
          onBookClick={handleBookClick}
        />
      </div>

      {/* Completion celebration toast (Change 11) */}
      {celebratedBookData && (
        <CelebrationToast
          bookTitle={celebratedBookData.title}
          xp={celebratedBookData.userProgress?.xpEarned ?? 0}
          visible={showCelebrationToast}
          onDismiss={() => setShowCelebrationToast(false)}
        />
      )}
    </main>
  );
}
