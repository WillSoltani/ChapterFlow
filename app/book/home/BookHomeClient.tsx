"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Sparkles, X } from "lucide-react";
import {
  buildPersonalizationRecommendation,
  formatReminderTimeLabel,
  getChapterStartModeShortLabel,
  getMotivationStyleLabel,
  getPreferredExampleContextShortLabel,
} from "@/app/book/_lib/onboarding-personalization";
import { getBookById } from "@/app/book/data/booksCatalog";
import { getBookChaptersBundle } from "@/app/book/data/mockChapters";
import type { RecentBookProgress } from "@/app/book/data/mockProgress";
import type { BadgeState } from "@/app/book/data/mockBadges";
import { useOnboardingState } from "@/app/book/hooks/useOnboardingState";
import { useBadgeSystem } from "@/app/book/hooks/useBadgeSystem";
import { useBookState } from "@/app/book/hooks/useBookState";
import { type BookProgressSnapshot } from "@/app/book/hooks/useBookAnalytics";
import { useKeyboardShortcut } from "@/app/book/hooks/useKeyboardShortcut";
import { useSavedBooks } from "@/app/book/hooks/useSavedBooks";
import { useBookViewer } from "@/app/book/hooks/useBookViewer";
import { useFlowPoints } from "@/app/book/hooks/useFlowPoints";
import {
  BadgeDetailPanel,
  DashboardAchievementWidget,
} from "@/app/book/badges/components/BadgeSystemCards";
import { TopNav } from "@/app/book/home/components/TopNav";
import { CurrentlyReadingCard } from "@/app/book/home/components/CurrentlyReadingCard";
import { TodaySessionCard } from "@/app/book/home/components/TodaySessionCard";
import { GoalMeter } from "@/app/book/home/components/GoalMeter";
import { BookMiniCard } from "@/app/book/home/components/BookMiniCard";
import { FlowPointsSection } from "@/app/book/home/components/FlowPointsSection";
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

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export function BookHomeClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const [selectedBadge, setSelectedBadge] = useState<BadgeState | null>(null);
  const [showProBanner, setShowProBanner] = useState(false);

  // Show a success banner when Stripe redirects back after payment, then
  // clean the URL so a refresh doesn't re-show it.
  useEffect(() => {
    if (searchParams.get("billing") === "success") {
      setShowProBanner(true);
      router.replace("/dashboard");
    }
  }, [searchParams, router]);

  const { state: onboarding, hydrated: onboardingHydrated } = useOnboardingState();
  const { identity: viewerIdentity } = useBookViewer();
  const dashboard = useBookState({
    selectedBookIds: onboarding.selectedBookIds,
    dailyGoalMinutes: onboarding.dailyGoalMinutes,
    chapterStartMode: onboarding.chapterStartMode,
    preferredExampleContext: onboarding.preferredExampleContext,
  });
  const { saved, hydrated: savedHydrated } = useSavedBooks(onboarding.setupComplete);
  const flowPoints = useFlowPoints(onboarding.setupComplete);
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

  // Unified books list: recent (sorted by relevance) + saved (deduped), capped at 6
  const yourBooks = useMemo(() => {
    const result = [...filteredRecentBooks];
    const existingIds = new Set(result.map((e) => e.book.id));
    for (const { book, progress } of savedBooksPreview) {
      if (!existingIds.has(book.id)) {
        result.push({ book, progress });
      }
    }
    return result.slice(0, 6);
  }, [filteredRecentBooks, savedBooksPreview]);

  const showStickyContinue =
    Boolean(currentProgress) &&
    currentProgress?.status !== "completed" &&
    !dashboard.state.dismissMobileCta;
  const viewerName = viewerIdentity.displayName || "Reader";
  const primarySelectedBookTitle = getBookById(onboarding.selectedBookIds[0] || "")?.title ?? null;
  const workspaceRecommendation = useMemo(
    () =>
      buildPersonalizationRecommendation({
        readingGoalLabel: onboarding.readingGoal
          ? ({
              career: "Career Growth",
              decisions: "Better Decisions",
              skills: "Learn New Skills",
              personal: "Personal Growth",
              curiosity: "Pure Curiosity",
            }[onboarding.readingGoal] ?? null)
          : null,
        chapterStartMode: onboarding.chapterStartMode,
        preferredExampleContext: onboarding.preferredExampleContext,
        learningStyle: onboarding.learningStyle,
        motivationStyle: onboarding.motivationStyle,
        dailyGoalMinutes: onboarding.dailyGoalMinutes,
        selectedBookTitle: primarySelectedBookTitle,
      }),
    [
      onboarding.chapterStartMode,
      onboarding.dailyGoalMinutes,
      onboarding.learningStyle,
      onboarding.motivationStyle,
      onboarding.preferredExampleContext,
      onboarding.readingGoal,
      primarySelectedBookTitle,
    ]
  );

  const sessionRoute = useMemo(() => {
    if (!currentBook || !currentProgress) return "";
    const chapterId = currentProgress.resumeChapterId;
    if (!chapterId) return "";
    return `/book/library/${encodeURIComponent(currentBook.id)}/chapter/${encodeURIComponent(chapterId)}?session=1`;
  }, [currentBook, currentProgress]);

  if (!onboardingHydrated || !dashboard.hydrated || !badgeSystem.hydrated || !savedHydrated || !onboarding.setupComplete) {
    return (
      <main className="cf-app-shell">
        <div className="mx-auto w-full max-w-450 animate-pulse px-4 pb-16 pt-10 sm:px-6 lg:px-10 xl:px-16">
          <div className="h-9 w-64 rounded-xl bg-(--cf-surface-muted)" />
          <div className="mt-2 h-5 w-48 rounded-xl bg-(--cf-surface)" />
          <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-[1.55fr_1fr]">
            <div className="h-72 rounded-3xl bg-(--cf-surface)" />
            <div className="h-72 rounded-3xl bg-(--cf-surface-muted)" />
          </div>
          <div className="mt-4 h-28 rounded-3xl bg-(--cf-surface-muted)" />
        </div>
      </main>
    );
  }

  return (
    <main className="cf-app-shell">
      {showProBanner && (
        <div className="relative flex items-center justify-between gap-3 bg-linear-to-r from-(--cf-accent) to-(--cf-accent-strong) px-4 py-3 text-white sm:px-6">
          <div className="flex items-center gap-2.5">
            <Sparkles className="h-4 w-4 shrink-0" />
            <p className="text-sm font-medium">
              You&apos;re now on Pro — enjoy unlimited access to the full library.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowProBanner(false)}
            aria-label="Dismiss"
            className="shrink-0 rounded-lg p-1 transition hover:bg-(--cf-surface-strong)"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <TopNav
        name={viewerName}
        activeTab="home"
        searchQuery={dashboard.state.searchQuery}
        onSearchChange={dashboard.setSearchQuery}
        searchInputRef={searchInputRef}
      />

      <section className="mx-auto w-full max-w-450 px-4 pb-28 pt-7 sm:px-6 sm:pt-8 md:pb-24 lg:px-10 xl:px-16">

        {/* ── Greeting ── */}
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-(--cf-text-1) sm:text-4xl">
            {getGreeting()}, {viewerName}
          </h1>
          <p className="mt-1.5 text-base text-(--cf-text-2)">
            {currentBook
              ? `Continuing ${currentBook.title}`
              : "Pick up where you left off."}
          </p>

          <div className="mt-4 rounded-[26px] border border-(--cf-accent-border) bg-[linear-gradient(135deg,var(--cf-accent-soft),var(--cf-surface))] p-4 sm:p-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-(--cf-text-3)">
              Personalized Setup
            </p>
            <p className="mt-2 text-lg font-semibold text-(--cf-text-1)">
              {workspaceRecommendation.headline}
            </p>
            <p className="mt-2 text-sm leading-relaxed text-(--cf-text-2)">
              {workspaceRecommendation.body}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <span className="inline-flex rounded-full border border-(--cf-accent-border) bg-(--cf-surface) px-3 py-1 text-xs font-semibold text-(--cf-info-text)">
                {getChapterStartModeShortLabel(onboarding.chapterStartMode)}
              </span>
              <span className="inline-flex rounded-full border border-(--cf-border) bg-(--cf-surface) px-3 py-1 text-xs font-semibold text-(--cf-text-2)">
                {getPreferredExampleContextShortLabel(onboarding.preferredExampleContext)}
              </span>
              <span className="inline-flex rounded-full border border-(--cf-border) bg-(--cf-surface) px-3 py-1 text-xs font-semibold text-(--cf-text-2)">
                {getMotivationStyleLabel(onboarding.motivationStyle)}
              </span>
              {onboarding.reminderTime ? (
                <span className="inline-flex rounded-full border border-(--cf-border) bg-(--cf-surface) px-3 py-1 text-xs font-semibold text-(--cf-text-2)">
                  {formatReminderTimeLabel(onboarding.reminderTime)}
                </span>
              ) : null}
            </div>
          </div>
        </div>

        {/* ── Main action area ── */}
        <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-[1.55fr_1fr]">
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
            <div className="cf-panel rounded-[30px] p-6 text-(--cf-text-2)">
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

        {/* ── Daily progress: goal + streak ── */}
        <div className="mt-4">
          <GoalMeter
            goalMinutes={onboarding.dailyGoalMinutes}
            minutesReadToday={analytics?.minutesReadToday ?? 0}
            streakDays={analytics?.streakDays ?? 0}
            totalChapters={analytics?.totalCompletedChapters ?? 0}
            booksCompleted={analytics?.booksCompleted ?? 0}
            avgQuizScore={analytics?.avgQuizScore ?? 0}
          />
        </div>

        <div className="mt-7">
          <FlowPointsSection
            loading={flowPoints.loading}
            payload={flowPoints.payload}
            error={flowPoints.error}
            redeemingRewardId={flowPoints.redeemingRewardId}
            message={flowPoints.redeemMessage}
            onRedeem={flowPoints.redeemReward}
          />
        </div>

        {/* ── Your Books ── */}
        <div className="mt-7">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-2xl font-semibold text-(--cf-text-1)">Your Books</h2>
              <p className="mt-1 text-sm text-(--cf-text-3)">
                {yourBooks.length > 0
                  ? `${yourBooks.length} book${yourBooks.length !== 1 ? "s" : ""} in your library`
                  : "Browse the library to add books to your reading list."}
              </p>
            </div>
            <Link href="/book/library" className="text-sm text-(--cf-accent) hover:text-(--cf-accent-strong)">
              Browse Library →
            </Link>
          </div>

          {yourBooks.length > 0 ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
              {yourBooks.map(({ book, progress }) => (
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
          ) : (
            <div className="cf-panel rounded-3xl p-5">
              <p className="text-base text-(--cf-text-1)">No books yet.</p>
              <p className="mt-2 text-sm text-(--cf-text-3)">
                Browse the library to start your reading journey.
              </p>
              <Link
                href="/book/library"
                className="mt-4 inline-flex rounded-xl border border-(--cf-accent-border) bg-(--cf-accent-soft) px-3 py-2 text-sm text-(--cf-info-text) transition hover:bg-(--cf-accent-muted)"
              >
                Browse Library
              </Link>
            </div>
          )}
        </div>

        {/* ── Achievements ── */}
        <div className="mt-7">
          <div className="mb-3">
            <h2 className="text-2xl font-semibold text-(--cf-text-1)">Achievements</h2>
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

      {/* ── Mobile sticky continue ── */}
      {showStickyContinue && currentProgress ? (
        <div className="fixed bottom-20 left-4 right-4 z-50 md:hidden">
          <div className="flex items-center gap-2 rounded-2xl border border-(--cf-accent-border) bg-(--cf-surface-strong) p-2 shadow-[0_16px_32px_rgba(0,0,0,0.1)] backdrop-blur">
            <button
              type="button"
              onClick={() => {
                if (!sessionRoute) return;
                router.push(sessionRoute);
              }}
              className="flex-1 rounded-xl bg-linear-to-r from-(--cf-accent) to-(--cf-accent-strong) px-3 py-2.5 text-sm font-semibold text-white shadow-[0_4px_14px_var(--cf-accent-shadow)]"
            >
              {currentProgress.status === "not_started"
                ? `Start Chapter ${currentProgress.chapter} →`
                : `Continue Chapter ${currentProgress.chapter} →`}
            </button>
            <button
              type="button"
              onClick={dashboard.dismissMobileCta}
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-(--cf-border) bg-(--cf-surface-muted) text-(--cf-text-2)"
              aria-label="Dismiss continue banner"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      ) : null}

      {/* ── Badge detail modal ── */}
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
    </main>
  );
}
