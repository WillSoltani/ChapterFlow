"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { ChevronRight, Search, Sparkles } from "lucide-react";
import { TopNav } from "@/app/book/home/components/TopNav";
import { PageTransition } from "@/components/ui/PageTransition";
import { useOnboardingState } from "@/app/book/hooks/useOnboardingState";
import { useKeyboardShortcut } from "@/app/book/hooks/useKeyboardShortcut";
import { useSavedBooks } from "@/app/book/hooks/useSavedBooks";
import { useBookViewer } from "@/app/book/hooks/useBookViewer";
import { useBookEntitlements } from "@/app/book/hooks/useBookEntitlements";
import type {
  LibraryBookDetail,
  LibraryBookEntry,
  LibraryChapterSummary,
} from "@/app/book/_lib/library-data";
import { useBookProgress } from "@/app/book/library/hooks/useBookProgress";
import { BookHero } from "./components/BookHero";
import { ChapterCard, type ChapterCardStatus } from "./components/ChapterCard";
import { BackgroundOrbs } from "./components/BackgroundOrbs";
import { BookDetails } from "./components/BookDetails";
import { BookDetailLoading } from "./components/BookDetailSkeleton";
import { ResetProgressModal } from "./components/ResetProgressModal";

/* ── Types ── */
type ChapterFilter = "all" | "in-progress" | "completed" | "locked";

const chapterFilterOptions: Array<{ id: ChapterFilter; label: string }> = [
  { id: "all", label: "All" },
  { id: "in-progress", label: "In Progress" },
  { id: "completed", label: "Completed" },
  { id: "locked", label: "Locked" },
];

/* ── Main Component ── */
export function BookDetailClient({
  bookId,
  book,
}: {
  bookId: string;
  book: LibraryBookDetail;
}) {
  const router = useRouter();
  const prefersReducedMotion = useReducedMotion();
  const chapterSearchRef = useRef<HTMLInputElement | null>(null);
  const currentChapterRef = useRef<HTMLDivElement | null>(null);

  const [chapterQuery, setChapterQuery] = useState("");
  const [chapterFilter, setChapterFilter] = useState<ChapterFilter>("all");
  const [lockedToast, setLockedToast] = useState<string | null>(null);
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetting, setResetting] = useState(false);

  // Track whether the initial page-load animation has completed
  const [hasLoaded, setHasLoaded] = useState(false);

  const { state: onboarding, hydrated: onboardingHydrated } =
    useOnboardingState();
  const { identity: viewerIdentity } = useBookViewer();
  const { savedSet, toggleSaved, hydrated: savedHydrated } = useSavedBooks(
    onboarding.setupComplete,
  );

  // Read-only entitlement check (no slot claim) so we can proactively gate the
  // start affordances when the free-book limit is already reached for a book
  // this user hasn't unlocked. The actual slot claim happens downstream when a
  // chapter is opened (the chapter content route runs ensureUserBookStarted).
  const { billingState } = useBookEntitlements(
    onboardingHydrated && onboarding.setupComplete,
  );
  const entitlement = billingState.payload?.entitlement ?? null;
  const accessBlocked = useMemo(() => {
    if (!entitlement) return false;
    const alreadyUnlocked = entitlement.unlockedBookIds.includes(bookId);
    const isPro = entitlement.plan === "PRO";
    return !alreadyUnlocked && !isPro && entitlement.remainingFreeStarts <= 0;
  }, [entitlement, bookId]);

  const entry = useMemo<LibraryBookEntry>(
    () => ({
      ...book,
      status: "not_started",
      progressPercent: 0,
      chaptersTotal: book.chapterCount,
      chaptersCompleted: 0,
      isNew: false,
      lastActivityAt: new Date(0).toISOString(),
    }),
    [book],
  );

  const chapters = book.chapters;
  const {
    hydrated,
    progress,
    currentChapter,
    completedCount,
    totalCount,
    unlockedCount,
    progressPercent,
    avgScore,
    getChapterState,
    setLastReadChapter,
    resetProgress,
  } = useBookProgress(bookId, chapters);

  // Real page count from the book package, when present. Never synthesise one —
  // a fabricated "560 pages" rendered as an exact attribute misleads readers
  // (the hero already shows real estimatedMinutes + chapter count).
  const pages = book.pages;
  // Internal length proxy for the "days to finish" projection only; never shown
  // to the reader as an exact page count.
  const estimatedLength =
    book.pages ?? Math.max(120, Math.round(book.estimatedMinutes * 2.8));

  useKeyboardShortcut(
    "/",
    (event) => {
      event.preventDefault();
      chapterSearchRef.current?.focus();
    },
    { ignoreWhenTyping: true },
  );

  useEffect(() => {
    if (!onboardingHydrated) return;
    if (!onboarding.setupComplete) {
      router.replace("/book");
    }
  }, [onboarding.setupComplete, onboardingHydrated, router]);

  useEffect(() => {
    if (!lockedToast) return;
    const timeout = window.setTimeout(() => setLockedToast(null), 3000);
    return () => window.clearTimeout(timeout);
  }, [lockedToast]);

  // Mark initial animation as complete after page load
  useEffect(() => {
    const timer = window.setTimeout(() => setHasLoaded(true), 1500);
    return () => window.clearTimeout(timer);
  }, []);

  // Auto-scroll to current chapter after mount
  useEffect(() => {
    if (!hydrated || !currentChapterRef.current) return;
    const timer = window.setTimeout(() => {
      currentChapterRef.current?.scrollIntoView({
        behavior: prefersReducedMotion ? "auto" : "smooth",
        block: "center",
      });
    }, 900);
    return () => window.clearTimeout(timer);
  }, [hydrated, prefersReducedMotion]);

  // When the free-book limit gates this book, no chapter can be opened without
  // claiming a slot — so every card renders locked, consistent with the gated
  // hero/sticky CTAs and the paywall banner.
  const lockedMessage = accessBlocked
    ? "Upgrade to Pro to start this book"
    : `Complete Chapter ${currentChapter?.number ?? ""} to unlock this chapter`;

  /* ── Derive chapter card status (4-state) ── */
  const getCardStatus = useCallback(
    (chapter: LibraryChapterSummary): ChapterCardStatus => {
      if (accessBlocked) return "locked";
      const base = getChapterState(chapter.id);
      if (base === "completed") return "completed";
      if (base === "current") return "in-progress";
      if (currentChapter) {
        const currentIdx = chapters.findIndex(
          (c) => c.id === currentChapter.id,
        );
        const thisIdx = chapters.findIndex((c) => c.id === chapter.id);
        if (thisIdx === currentIdx + 1) return "next-unlockable";
      }
      return "locked";
    },
    [getChapterState, currentChapter, chapters, accessBlocked],
  );

  /**
   * Steps completed for a chapter (0-4). We only persist chapter-level
   * completion, not which of the four in-chapter steps a reader finished — so
   * a completed chapter shows all four dots, and every other chapter shows
   * zero (the in-progress chapter's first dot pulses via StepIndicators). No
   * inventing "Summary complete" for a chapter the reader just opened.
   */
  const getStepsCompleted = useCallback(
    (chapterId: string): number =>
      getChapterState(chapterId) === "completed" ? 4 : 0,
    [getChapterState],
  );

  /** Check if a chapter matches the current filter + search query */
  const matchesFilter = useCallback(
    (chapter: LibraryChapterSummary): boolean => {
      const status = getCardStatus(chapter);
      if (chapterFilter === "in-progress" && status !== "in-progress")
        return false;
      if (chapterFilter === "completed" && status !== "completed") return false;
      if (
        chapterFilter === "locked" &&
        status !== "locked" &&
        status !== "next-unlockable"
      )
        return false;
      const query = chapterQuery.trim().toLowerCase();
      if (!query) return true;
      const searchable = `${chapter.title} ${chapter.code}`.toLowerCase();
      return searchable.includes(query);
    },
    [chapterFilter, chapterQuery, getCardStatus],
  );

  /* ── Navigation ── */
  const openChapter = useCallback(
    (
      chapter: LibraryChapterSummary,
      options?: { sessionMode?: boolean },
    ) => {
      if (accessBlocked) {
        setLockedToast("Upgrade to Pro to start this book");
        return;
      }
      const state = getChapterState(chapter.id);
      if (state === "locked") {
        setLockedToast(
          `Complete Chapter ${currentChapter?.number ?? ""} to unlock this chapter`,
        );
        return;
      }
      setLastReadChapter(chapter.id);
      const route = `/book/library/${encodeURIComponent(bookId)}/chapter/${encodeURIComponent(chapter.id)}`;
      router.push(options?.sessionMode ? `${route}?session=1` : route);
    },
    [bookId, currentChapter?.number, getChapterState, router, setLastReadChapter, accessBlocked],
  );

  const viewerName = viewerIdentity.displayName || "Reader";

  const firstChapterMinutes = chapters[0]?.minutes ?? 8;

  const showSearch = chapters.length >= 20;

  /* ── Loading state — same skeleton as the route-level loading.tsx ── */
  if (
    !onboardingHydrated ||
    !hydrated ||
    !savedHydrated ||
    !onboarding.setupComplete
  ) {
    return <BookDetailLoading />;
  }

  return (
    <main className="cf-app-shell relative">
      <BackgroundOrbs />

      <TopNav
        name={viewerName}
        avatarUrl={viewerIdentity.avatarDataUrl}
        activeTab="library"
        searchQuery=""
        onSearchChange={() => {}}
        searchInputRef={chapterSearchRef}
        showSearch={false}
        logoVariant="dashboard"
      />

      {/* All content in relative z-10 to sit above gradient orbs */}
      <PageTransition>
      <section className="relative z-10 mx-auto w-full max-w-450 px-4 pb-28 pt-6 sm:px-6 md:pb-24 lg:px-10 xl:px-16">
        {/* Breadcrumb */}
        <nav className="mb-6 flex items-center gap-2 text-sm">
          <Link
            href="/book/library"
            className="text-(--cf-text-3) transition-colors hover:text-(--cf-text-1)"
          >
            Library
          </Link>
          <ChevronRight className="h-3.5 w-3.5 text-(--cf-text-soft)" />
          <span className="truncate font-medium text-(--cf-text-1)">
            {book.title}
          </span>
        </nav>

        {/* ═══════ ZONE 1 — Hero ═══════ */}
        <BookHero
          entry={entry}
          pages={pages}
          progressPercent={progressPercent}
          avgScore={avgScore}
          unlockedCount={unlockedCount}
          totalCount={totalCount}
          completedCount={completedCount}
          currentChapterOrder={currentChapter?.number ?? 1}
          firstChapterMinutes={firstChapterMinutes}
          accessBlocked={accessBlocked}
          onContinue={() =>
            currentChapter &&
            openChapter(currentChapter, {
              sessionMode: progressPercent === 0,
            })
          }
          isSaved={savedSet.has(entry.id)}
          onToggleSaved={() =>
            void toggleSaved(entry.id, { source: "book-detail" })
          }
        />

        {/* ═══════ Paywall Banner — shown only when this book is actually gated ═══════ */}
        {accessBlocked && (
          <motion.div
            className="mt-6 rounded-xl border border-(--cf-border-strong) bg-(--cf-surface-muted) p-5 text-center"
            initial={prefersReducedMotion ? undefined : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <p className="text-sm font-medium text-(--cf-text-1)">
              You&rsquo;ve reached your free book limit. Upgrade to Pro to start
              this book and unlock unlimited reading.
            </p>
            <Link
              href="/pricing"
              className="cf-btn cf-btn-primary mt-3 inline-flex rounded-xl px-5 py-3 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--cf-accent) focus-visible:ring-offset-2 focus-visible:ring-offset-(--cf-page-bg)"
            >
              <Sparkles className="h-4 w-4" />
              Upgrade to Pro
            </Link>
          </motion.div>
        )}

        {/* ═══════ ZONE 2 — Chapter Journey ═══════ */}
        <motion.section
          className="mt-10 isolate"
          initial={prefersReducedMotion ? undefined : { opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={
            prefersReducedMotion
              ? { duration: 0 }
              : { duration: 0.4, ease: "easeOut" as const, delay: 0.6 }
          }
        >
          {/* Section header */}
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2
              className="text-lg font-semibold uppercase tracking-widest text-(--cf-text-1)"
              style={{ fontFamily: "var(--font-satoshi)" }}
            >
              Your Journey
            </h2>
            <span className="text-sm text-(--cf-text-3)">
              {completedCount}/{totalCount} completed
            </span>
          </div>

          {/* Filter tabs + search */}
          <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            {showSearch && (
              <label className="relative block flex-1 sm:max-w-sm">
                <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-(--cf-text-3)" />
                <input
                  ref={chapterSearchRef}
                  type="search"
                  value={chapterQuery}
                  onChange={(e) => setChapterQuery(e.target.value)}
                  placeholder="Search chapters..."
                  aria-label="Search chapters by title or code"
                  className="cf-input w-full rounded-xl py-2.5 pl-10 pr-4 text-sm"
                />
              </label>
            )}
            {/* Filter tab pill container */}
            <div
              className="flex items-center gap-0.5 rounded-xl bg-(--cf-surface-muted) p-1"
              role="tablist"
              aria-label="Filter chapters"
            >
              {chapterFilterOptions.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  role="tab"
                  aria-selected={chapterFilter === option.id}
                  onClick={() => setChapterFilter(option.id)}
                  className={[
                    "whitespace-nowrap rounded-lg px-4 py-2 text-sm font-medium transition-all duration-200",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--cf-accent)",
                    chapterFilter === option.id
                      ? "cf-chip cf-chip-active"
                      : "text-(--cf-text-2) hover:bg-(--cf-surface-strong) hover:text-(--cf-text-1)",
                  ].join(" ")}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {/* ── Chapter card list ──
              Uses CSS transitions for filter show/hide instead of Framer Motion
              to avoid the disappearing-cards bug. All cards stay in the DOM;
              visibility is controlled purely by inline styles. */}
          <div
            className="flex flex-col"
            role="tabpanel"
            aria-label="Chapter list"
          >
            {chapters.map((chapter, index) => {
              const status = getCardStatus(chapter);
              const isCurrent = status === "in-progress";
              const isVisible = matchesFilter(chapter);

              return (
                <div
                  key={chapter.id}
                  ref={isCurrent ? currentChapterRef : undefined}
                  className="transition-all duration-300 ease-in-out"
                  style={{
                    maxHeight: isVisible ? "200px" : "0px",
                    opacity: isVisible ? 1 : 0,
                    marginBottom: "0px",
                    overflow: "hidden",
                    pointerEvents: isVisible ? "auto" : "none",
                    transform: isVisible ? "scale(1)" : "scale(0.98)",
                    borderTop: index > 0 && isVisible ? "1px solid var(--cf-border)" : "none",
                    paddingTop: index > 0 && isVisible ? "12px" : "0px",
                    paddingBottom: isVisible ? "12px" : "0px",
                    // Stagger entrance animation on initial page load
                    ...(hasLoaded
                      ? {}
                      : {
                          animationDelay: `${0.6 + index * 0.06}s`,
                          animationDuration: "0.4s",
                          animationTimingFunction: "ease-out",
                          animationFillMode: "both",
                          animationName: "bd-card-enter",
                        }),
                  }}
                >
                  <ChapterCard
                    chapter={chapter}
                    status={status}
                    score={progress.chapterScores[chapter.id]}
                    stepsCompleted={getStepsCompleted(chapter.id)}
                    isCurrent={isCurrent}
                    onClick={() => openChapter(chapter)}
                    onMouseEnter={() => {
                      if (status !== "locked") {
                        router.prefetch(
                          `/book/library/${encodeURIComponent(bookId)}/chapter/${encodeURIComponent(chapter.id)}`,
                        );
                      }
                    }}
                    onLockedClick={() => setLockedToast(lockedMessage)}
                  />
                </div>
              );
            })}

            {/* Empty state: book published without chapters yet */}
            {chapters.length === 0 && (
              <p className="py-8 text-center text-sm text-(--cf-text-3)">
                Chapters are coming soon for this book.
              </p>
            )}

            {/* Empty state when no chapters match filter */}
            {chapters.length > 0 && chapters.every((ch) => !matchesFilter(ch)) && (
              <p className="py-8 text-center text-sm text-(--cf-text-3)">
                No chapters match this filter.
              </p>
            )}
          </div>
        </motion.section>

        {/* ═══════ ZONE 3 — Book Details ═══════ */}
        <motion.div
          className="mt-12"
          initial={prefersReducedMotion ? undefined : { opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={
            prefersReducedMotion
              ? { duration: 0 }
              : { duration: 0.4, ease: "easeOut" as const, delay: 0.8 }
          }
        >
          <BookDetails
            entry={entry}
            synopsis={book.synopsis}
            estimatedDaysToFinish={Math.max(
              1,
              Math.ceil(
                Math.max(estimatedLength / 2.8, 120) /
                  Math.max(onboarding.dailyGoalMinutes, 10),
              ),
            )}
            onResetProgress={() => setShowResetModal(true)}
          />
        </motion.div>
      </section>
      </PageTransition>

      {/* Mobile sticky CTA — Continue/Start for an unblocked book. When the free
          limit blocks this book, the hero "Upgrade to start" + the paywall banner
          already provide the upgrade path, so we render no sticky bar here: a third
          (and label-duplicate) "Upgrade to start" would be a redundant primary CTA. */}
      {!accessBlocked && currentChapter && (
        <div className="fixed bottom-20 left-4 right-4 z-50 lg:hidden">
          <button
            type="button"
            onClick={() =>
              openChapter(currentChapter, {
                sessionMode: progressPercent === 0,
              })
            }
            className="cf-btn cf-btn-primary w-full rounded-2xl px-4 py-3 text-base"
          >
            {completedCount > 0
              ? `Continue Chapter ${currentChapter.number}`
              : `Start Chapter ${currentChapter.number}`}
          </button>
        </div>
      )}

      {/* Modals */}
      <ResetProgressModal
        open={showResetModal}
        // Block dismissal (backdrop / Escape) while the reset POST is in flight so
        // the modal can't vanish mid-request and leave the user without feedback.
        onClose={() => {
          if (!resetting) setShowResetModal(false);
        }}
        onConfirm={async () => {
          // Guard against double-submit, then await the server-side reset before
          // closing. On failure keep the modal open and surface a toast — never
          // report a destructive action as done when the server still holds the
          // old progress.
          if (resetting) return;
          setResetting(true);
          try {
            await resetProgress();
            setShowResetModal(false);
          } catch {
            setLockedToast("Couldn't reset progress. Please try again.");
          } finally {
            setResetting(false);
          }
        }}
      />

      {/* Locked toast */}
      <AnimatePresence>
        {lockedToast && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.2 }}
            className="cf-panel-strong fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-xl px-5 py-3 text-sm text-(--cf-text-1) shadow-shadow-book"
          >
            {lockedToast}
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}
