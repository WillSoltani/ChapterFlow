"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Flame, Sparkles, X } from "lucide-react";
import { getBookById } from "@/app/book/data/booksCatalog";
import { getBookChaptersBundle } from "@/app/book/data/mockChapters";
import {
  QUICK_REVIEW_PROMPTS,
  type RecentBookProgress,
  buildDailyInsight,
} from "@/app/book/data/mockProgress";
import type { BadgeState } from "@/app/book/data/mockBadges";
import { useOnboardingState } from "@/app/book/hooks/useOnboardingState";
import { useBadgeSystem } from "@/app/book/hooks/useBadgeSystem";
import { useBookState } from "@/app/book/hooks/useBookState";
import { type BookProgressSnapshot } from "@/app/book/hooks/useBookAnalytics";
import { useKeyboardShortcut } from "@/app/book/hooks/useKeyboardShortcut";
import { useSavedBooks } from "@/app/book/hooks/useSavedBooks";
import {
  BadgeDetailPanel,
  DashboardAchievementWidget,
} from "@/app/book/badges/components/BadgeSystemCards";
import { TopNav } from "@/app/book/home/components/TopNav";
import { CurrentlyReadingCard } from "@/app/book/home/components/CurrentlyReadingCard";
import { TodaySessionCard } from "@/app/book/home/components/TodaySessionCard";
import { GoalMeter } from "@/app/book/home/components/GoalMeter";
import { BookMiniCard } from "@/app/book/home/components/BookMiniCard";
import { InfoModal } from "@/app/book/home/components/InfoModal";

function chapterFromResume(snapshot: BookProgressSnapshot): number {
  const chapter = getBookChaptersBundle(snapshot.book.id).chapters.find(
    (entry) => entry.id === snapshot.resumeChapterId
  );
  return chapter?.order ?? 1;
}

function mapSnapshotToRecentProgress(
  snapshot: BookProgressSnapshot
): RecentBookProgress {
  return {
    bookId: snapshot.book.id,
    status: snapshot.status,
    progressPercent: snapshot.progressPercent,
    chapter:
      snapshot.status === "completed"
        ? snapshot.totalChapters
        : chapterFromResume(snapshot),
    resumeChapterId: snapshot.resumeChapterId,
    totalChapters: snapshot.totalChapters,
    lastOpenedAt: snapshot.lastOpenedLabel,
  };
}

export function BookHomeClient() {
  const router = useRouter();
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const [selectedBadge, setSelectedBadge] = useState<BadgeState | null>(null);
  const [showQuickReviewModal, setShowQuickReviewModal] = useState(false);

  const { state: onboarding, hydrated: onboardingHydrated } = useOnboardingState();
  const dashboard = useBookState({
    selectedBookIds: onboarding.selectedBookIds,
    dailyGoalMinutes: onboarding.dailyGoalMinutes,
  });
  const { saved, hydrated: savedHydrated } = useSavedBooks(onboarding.setupComplete);
  const badgeSystem = useBadgeSystem({
    selectedBookIds: onboarding.selectedBookIds,
    dailyGoalMinutes: onboarding.dailyGoalMinutes,
  });
  const { analytics } = badgeSystem;

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

  const recentBooks = useMemo(() => {
    if (!analytics) {
      return dashboard.state.recentBooks
        .map((progress) => {
          const book = getBookById(progress.bookId);
          return book ? { book, progress } : null;
        })
        .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));
    }

    const selectedSet = new Set(onboarding.selectedBookIds);
    const selectedOrder = new Map(
      onboarding.selectedBookIds.map((bookId, index) => [bookId, index])
    );

    const ordered = [...analytics.bookSnapshots].sort((left, right) => {
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

    return ordered.map((snapshot) => ({
      book: snapshot.book,
      progress: mapSnapshotToRecentProgress(snapshot),
    }));
  }, [analytics, dashboard.state.recentBooks, onboarding.selectedBookIds]);

  const currentEntry = useMemo(() => {
    const byId = recentBooks.find(
      (entry) => entry.progress.bookId === dashboard.state.currentBookId
    );
    return byId || recentBooks[0] || null;
  }, [dashboard.state.currentBookId, recentBooks]);

  const currentBook = currentEntry?.book || null;
  const currentProgress = currentEntry?.progress || null;

  const searchQuery = dashboard.state.searchQuery.trim().toLowerCase();
  const filteredRecentBooks = useMemo(() => {
    if (!searchQuery) return recentBooks;
    return recentBooks.filter(({ book }) => {
      const searchable = `${book.title} ${book.author} ${book.category}`.toLowerCase();
      return searchable.includes(searchQuery);
    });
  }, [recentBooks, searchQuery]);

  const savedBooksPreview = useMemo(() => {
    return saved
      .map((item) => {
        const book = getBookById(item.bookId);
        if (!book) return null;
        const progress =
          recentBooks.find((entry) => entry.book.id === item.bookId)?.progress ??
          {
            bookId: item.bookId,
            status: "not_started" as const,
            progressPercent: 0,
            chapter: 1,
            resumeChapterId: "",
            totalChapters: getBookChaptersBundle(item.bookId).chapters.length || 1,
            lastOpenedAt: "Saved for later",
          };
        return { book, progress, savedAt: item.savedAt };
      })
      .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry))
      .slice(0, 3);
  }, [recentBooks, saved]);

  const dailyInsight = useMemo(
    () => buildDailyInsight(currentBook?.title || "your current book"),
    [currentBook?.title]
  );

  const showStickyContinue =
    Boolean(currentProgress) &&
    currentProgress?.status !== "completed" &&
    !dashboard.state.dismissMobileCta;

  const sessionRoute = useMemo(() => {
    if (!currentBook || !currentProgress) return "";
    const chapterId = currentProgress.resumeChapterId;
    if (!chapterId) return "";
    return `/book/library/${encodeURIComponent(currentBook.id)}/chapter/${encodeURIComponent(chapterId)}?session=1`;
  }, [currentBook, currentProgress]);

  if (!onboardingHydrated || !dashboard.hydrated || !badgeSystem.hydrated || !savedHydrated || !onboarding.setupComplete) {
    return (
      <main className="relative min-h-screen text-slate-100">
        <div className="pointer-events-none absolute inset-0 -z-20 bg-[#050813]" />
        <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(920px_circle_at_10%_-6%,rgba(56,189,248,0.12),transparent_58%),radial-gradient(860px_circle_at_100%_0%,rgba(251,191,36,0.08),transparent_52%)]" />
        <div className="mx-auto w-full max-w-7xl animate-pulse px-4 pb-16 pt-10 sm:px-6">
          <div className="h-11 w-72 rounded-xl bg-slate-800/60" />
          <div className="mt-3 h-6 w-56 rounded-xl bg-slate-800/40" />
          <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-[1.55fr_1fr]">
            <div className="h-72 rounded-3xl bg-slate-800/50" />
            <div className="h-72 rounded-3xl bg-slate-800/40" />
          </div>
          <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
            <div className="h-28 rounded-3xl bg-slate-800/40 lg:col-span-2" />
            <div className="h-28 rounded-3xl bg-slate-800/40" />
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="relative min-h-screen overflow-x-hidden text-slate-100">
      <div className="pointer-events-none absolute inset-0 -z-20 bg-[#050813]" />
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(980px_circle_at_8%_-8%,rgba(56,189,248,0.12),transparent_58%),radial-gradient(820px_circle_at_100%_0%,rgba(251,191,36,0.08),transparent_52%)]" />

      <TopNav
        name={onboarding.name || "Reader"}
        activeTab="home"
        searchQuery={dashboard.state.searchQuery}
        onSearchChange={dashboard.setSearchQuery}
        searchInputRef={searchInputRef}
      />

      <section className="mx-auto w-full max-w-7xl px-4 pb-28 pt-7 sm:px-6 sm:pt-8 md:pb-24">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-4xl font-semibold tracking-tight text-slate-50 sm:text-5xl">
              Good morning, {onboarding.name || "Reader"} 👋
            </h1>
            <p className="mt-2 text-lg text-slate-300">
              {analytics && analytics.streakDays > 0
                ? `You're on a ${analytics.streakDays}-day streak. Keep it up.`
                : "Start your first chapter and your reading streak will begin here."}
            </p>
          </div>
          <span className="inline-flex items-center gap-2 rounded-full border border-amber-300/35 bg-amber-300/14 px-3.5 py-1.5 text-sm font-medium text-amber-100">
            <Flame className="h-4 w-4" />
            {(analytics?.streakDays ?? 0) > 0
              ? `${analytics?.streakDays ?? 0} day streak`
              : "No streak yet"}
          </span>
        </div>

        <div className="mt-7 grid grid-cols-1 gap-4 lg:grid-cols-[1.55fr_1fr]">
          {currentBook && currentProgress ? (
            <CurrentlyReadingCard
              book={currentBook}
              progress={currentProgress}
              dailyGoalMinutes={onboarding.dailyGoalMinutes}
              onContinue={() => {
                if (!sessionRoute) return;
                router.push(sessionRoute);
              }}
            />
          ) : (
            <div className="rounded-[30px] border border-white/10 bg-white/3 p-6 text-slate-300">
              Finish onboarding to unlock your first book and start reading.
            </div>
          )}

          <TodaySessionCard
            tasks={dashboard.state.todaySession}
            onToggleTask={dashboard.toggleSessionTask}
            onStartSession={() => {
              if (!sessionRoute) return;
              router.push(sessionRoute);
            }}
          />
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
          <article className="rounded-3xl border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0.03))] p-5 lg:col-span-2">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-amber-400/70" />
              <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Daily Insight</h3>
            </div>
            <p className="mt-3 border-l-2 border-amber-400/40 pl-3 text-base leading-relaxed text-slate-200">{dailyInsight.takeaway}</p>
            <p className="mt-3 text-sm text-slate-400">
              <span className="font-medium text-slate-300">Try this: </span>{dailyInsight.action}
            </p>
          </article>
          <GoalMeter
            goalMinutes={onboarding.dailyGoalMinutes}
            minutesReadToday={analytics?.minutesReadToday ?? 0}
          />
        </div>

        <div className="mt-4 rounded-3xl border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.07),rgba(255,255,255,0.03))] p-5">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-lg font-semibold text-slate-100">Quick Review</h3>
            <button
              type="button"
              onClick={() => setShowQuickReviewModal(true)}
              className="inline-flex items-center gap-1.5 rounded-full border border-sky-300/25 bg-sky-500/10 px-2.5 py-1 text-xs text-sky-300 transition hover:bg-sky-500/18"
            >
              <Sparkles className="h-3 w-3" />
              Review
            </button>
          </div>
          <div className="mt-3 grid grid-cols-1 gap-2.5 md:grid-cols-3">
            {QUICK_REVIEW_PROMPTS.map((prompt) => (
              <button
                key={prompt}
                type="button"
                onClick={() => setShowQuickReviewModal(true)}
                className="group rounded-2xl border border-white/10 bg-white/3 px-4 py-3.5 text-left text-sm text-slate-300 transition hover:border-sky-300/25 hover:bg-sky-500/8 hover:text-slate-100"
              >
                <span className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.12em] text-sky-400/55 group-hover:text-sky-400/80">Reflect</span>
                {prompt}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-7">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-2xl font-semibold text-slate-100">Read Next</h2>
              <p className="mt-1 text-sm text-slate-400">
                {saved.length > 0
                  ? `${saved.length} saved book${saved.length === 1 ? "" : "s"} ready when you are.`
                  : "Save books from the library and they will appear here."}
              </p>
            </div>
            <Link href="/book/saved" className="text-sm text-sky-200 hover:text-sky-100">
              View all →
            </Link>
          </div>

          {savedBooksPreview.length > 0 ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {savedBooksPreview.map(({ book, progress }) => (
                <BookMiniCard
                  key={book.id}
                  book={book}
                  progress={progress}
                  onOpen={() => router.push(`/book/library/${encodeURIComponent(book.id)}`)}
                />
              ))}
            </div>
          ) : (
            <div className="rounded-3xl border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.07),rgba(255,255,255,0.03))] p-5 text-slate-300">
              <p className="text-base text-slate-200">No saved books yet.</p>
              <p className="mt-2 text-sm text-slate-400">
                Use the bookmark control in the library to build a reading queue you can return to quickly.
              </p>
              <Link
                href="/book/library"
                className="mt-4 inline-flex rounded-xl border border-sky-300/35 bg-sky-500/14 px-3 py-2 text-sm text-sky-100 transition hover:bg-sky-500/22"
              >
                Browse library
              </Link>
            </div>
          )}
        </div>

        <div className="mt-7">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-2xl font-semibold text-slate-100">Recent Books</h2>
            <Link href="/book/library" className="text-sm text-sky-200 hover:text-sky-100">
              View Library →
            </Link>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {filteredRecentBooks.slice(0, 5).map(({ book, progress }) => (
                <BookMiniCard
                  key={book.id}
                  book={book}
                  progress={progress}
                  onOpen={() => {
                    dashboard.setCurrentBookId(book.id);
                    router.push(`/book/library/${encodeURIComponent(book.id)}`);
                  }}
                />
              ))}
          </div>
        </div>

        <div className="mt-7">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-2xl font-semibold text-slate-100">Achievements</h2>
          </div>
          <DashboardAchievementWidget
            recentBadge={badgeSystem.recentlyEarned[0] ?? null}
            nextMilestone={badgeSystem.nextMilestones[0] ?? null}
            earnedCount={badgeSystem.earnedCount}
            visibleCount={badgeSystem.visibleCount}
            onOpenBadge={setSelectedBadge}
            onViewAll={() => router.push("/book/badges")}
          />
        </div>
      </section>

      {showStickyContinue && currentProgress ? (
        <div className="fixed bottom-20 left-4 right-4 z-50 md:hidden">
          <div className="flex items-center gap-2 rounded-2xl border border-sky-300/35 bg-[#0b1324]/95 p-2 shadow-[0_16px_32px_rgba(2,6,23,0.5)] backdrop-blur">
            <button
              type="button"
              onClick={() => {
                if (!sessionRoute) return;
                router.push(sessionRoute);
              }}
              className="flex-1 rounded-xl bg-linear-to-r from-sky-500 to-cyan-400 px-3 py-2.5 text-sm font-semibold text-white"
            >
              {currentProgress.status === "not_started"
                ? `Start Chapter ${currentProgress.chapter} →`
                : `Continue Chapter ${currentProgress.chapter} →`}
            </button>
            <button
              type="button"
              onClick={dashboard.dismissMobileCta}
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-white/20 bg-white/5 text-slate-200"
              aria-label="Dismiss continue banner"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      ) : null}

      <InfoModal
        open={Boolean(selectedBadge)}
        title={selectedBadge?.name || "Badge"}
        onClose={() => setSelectedBadge(null)}
      >
        {selectedBadge ? (
          <BadgeDetailPanel
            badge={selectedBadge}
            nextTier={badgeSystem.badges.find((badge) => badge.id === selectedBadge.nextTierId) ?? null}
          />
        ) : null}
      </InfoModal>

      <InfoModal
        open={showQuickReviewModal}
        title="Quick Review"
        onClose={() => setShowQuickReviewModal(false)}
      >
        <p>
          We&apos;ll add interactive flashcards and spaced repetition prompts so your
          key ideas stick over time.
        </p>
        <button
          type="button"
          onClick={() => setShowQuickReviewModal(false)}
          className="mt-4 inline-flex items-center gap-2 rounded-xl border border-sky-300/35 bg-sky-500/14 px-3 py-2 text-sm text-sky-100 transition hover:bg-sky-500/22"
        >
          <Sparkles className="h-4 w-4" />
          Got it
        </button>
      </InfoModal>
    </main>
  );
}
