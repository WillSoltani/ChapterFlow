"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";
import { DUR, EASE } from "@/lib/motion";
import { TopNav } from "@/components/navigation/TopNav";
import { useOnboardingRedirect, useOnboardingState } from "@/hooks/book/useOnboardingState";
import { useBookAnalytics } from "@/hooks/book/useBookAnalytics";
import { useBookViewer } from "@/hooks/book/useBookViewer";
import { useInsightPoints } from "@/hooks/book/useInsightPoints";
import { isJustEarned, useBadgeSystem } from "@/hooks/book/useBadgeSystem";
import { useServerTier } from "@/hooks/book/useServerTier";
import { useKeyboardShortcut } from "@/hooks/useKeyboardShortcut";
import type {
  ProgressPageData,
  ActiveBook,
  CompletedBook,
  ReviewData,
  StepNumber,
  LearningStep,
  TierPill,
} from "./progressTypes";
import { tierPill } from "./progressTypes";
import { getBookCoverPath } from "@/lib/book-covers";
import { fetchBookJson } from "@/lib/client/book-api";
import {
  fetchBookJsonCached,
  invalidateBookCache,
  useBookQuery,
} from "@/lib/client/book-api-cache";
import { aggregateHourlyForDay } from "@/lib/client/reading-activity-storage";
import { ReviewSessionFSRS } from "@/components/review/ReviewSessionFSRS";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { HeroSection } from "./HeroSection";
import { DailyQuests } from "./DailyQuests";
import { WeeklySummary } from "./WeeklySummary";
import { ReadingActivity } from "./ReadingActivity";
import { KnowledgeReview } from "./KnowledgeReview";
import { YourBooks } from "./YourBooks";
import { NextAchievements } from "./NextAchievements";
import { ProInsightsPreview } from "./ProInsightsPreview";
import { buildDailyQuests, stepsCompletedToday } from "./daily-quests-core";
import {
  buildReviewDataFromCards,
  localDateKey,
  type FSRSCardLite,
} from "./review-data-core";

// ──────────────────────────────────────────────────
// Data transformation: hooks → ProgressPageData
// ──────────────────────────────────────────────────

const LOOP_STEP_MAP: Record<string, { step: LearningStep; stepNumber: StepNumber }> = {
  summary: { step: "summary", stepNumber: 1 },
  scenarios: { step: "scenarios", stepNumber: 2 },
  quiz: { step: "quiz", stepNumber: 3 },
  unlock: { step: "unlock", stepNumber: 4 },
};

// ──────────────────────────────────────────────────
// Server FSRS deck → KnowledgeReview data
// ──────────────────────────────────────────────────
// The reviews block reads the server FSRS store (GET /me/reviews) — the same
// source the home ReviewDueWidget uses — instead of the former per-device
// localStorage SRS, so the two surfaces no longer contradict each other.

// Cache keys for this page's independent server reads (WS3-022).
const REVIEWS_ALL_KEY = "/app/api/book/me/reviews?mode=all";
const STREAK_KEY = "/app/api/book/me/streak";

const EMPTY_REVIEW_DATA: ReviewData = {
  overdueCount: 0,
  dueTodayCount: 0,
  laterTodayCount: 0,
  upcomingThisWeekCount: 0,
  totalConceptsLearned: 0,
  forecast: [],
};

/** Distinct cards actually reviewed today (drives the "Review 5 concepts" quest).
 *  Guards on reps > 0 because createNewCard seeds lastReviewAt on unreviewed cards. */
function countReviewedToday(cards: FSRSCardLite[]): number {
  const todayKey = localDateKey(new Date());
  return cards.filter(
    (c) => c.reps > 0 && localDateKey(new Date(c.lastReviewAt)) === todayKey
  ).length;
}

function buildProgressData(
  viewerName: string,
  analytics: NonNullable<ReturnType<typeof useBookAnalytics>["analytics"]>,
  insightPointsBalance: number,
  nextMilestonesFromBadges: ReturnType<typeof useBadgeSystem>["nextMilestones"],
  isPro: boolean,
  reviewData: ReviewData,
  reviewedTodayCount: number,
  shieldsHeld: number,
  tier: TierPill | null
): ProgressPageData {
  // Map active books from analytics
  const activeBooks: ActiveBook[] = analytics.recentlyOpenedSnapshots.map(
    (snapshot) => {
      const loopStep = snapshot.currentLoopStep ?? "summary";
      // "summary" is a statically-defined key of LOOP_STEP_MAP, so the fallback is always present.
      const { step, stepNumber } = LOOP_STEP_MAP[loopStep] ?? LOOP_STEP_MAP.summary!;
      return {
        id: snapshot.book.id,
        title: snapshot.book.title,
        author: snapshot.book.author ?? "",
        coverUrl: getBookCoverPath(snapshot.book.id),
        totalChapters: snapshot.totalChapters,
        completedChapters: snapshot.completedChapters,
        currentChapterNumber: snapshot.resumeChapterNumber,
        currentChapterTitle: snapshot.resumeChapterLabel,
        currentStep: step,
        currentStepNumber: stepNumber,
        lastActivity: snapshot.lastOpenedLabel,
        lastActivityDate: snapshot.lastActivityAt,
        readersCount: 0,
        resumeChapterId: snapshot.resumeChapterId,
      };
    }
  );

  // Map completed books
  const completedBooks: CompletedBook[] = analytics.completedBookSnapshots.map(
    (snapshot) => ({
      id: snapshot.book.id,
      title: snapshot.book.title,
      author: snapshot.book.author ?? "",
      coverUrl: getBookCoverPath(snapshot.book.id),
      totalChapters: snapshot.totalChapters,
      completedDate: snapshot.lastActivityAt,
      avgQuizScore: snapshot.avgScore,
    })
  );

  // Derive week summary from heatmap cells
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dayOfWeek = today.getDay();
  const monday = new Date(today);
  monday.setDate(today.getDate() - ((dayOfWeek + 6) % 7));
  const weekStartDate = `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, "0")}-${String(monday.getDate()).padStart(2, "0")}`;

  // This week's minutes from heatmap cells
  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  const thisWeekCells = analytics.heatmapCells.filter((cell) => {
    return cell.key >= weekStartDate && cell.key <= todayKey;
  });
  const thisWeekMinutes = thisWeekCells.reduce((sum, c) => sum + c.minutes, 0);
  const thisWeekChapters = thisWeekCells.reduce(
    (sum, c) => sum + c.chapters,
    0
  );

  // Last week's data
  const lastMonday = new Date(monday);
  lastMonday.setDate(lastMonday.getDate() - 7);
  const lastSunday = new Date(monday);
  lastSunday.setDate(lastSunday.getDate() - 1);
  const lastMondayKey = `${lastMonday.getFullYear()}-${String(lastMonday.getMonth() + 1).padStart(2, "0")}-${String(lastMonday.getDate()).padStart(2, "0")}`;
  const lastSundayKey = `${lastSunday.getFullYear()}-${String(lastSunday.getMonth() + 1).padStart(2, "0")}-${String(lastSunday.getDate()).padStart(2, "0")}`;
  const lastWeekCells = analytics.heatmapCells.filter((cell) => {
    return cell.key >= lastMondayKey && cell.key <= lastSundayKey;
  });
  const lastWeekMinutes = lastWeekCells.reduce((sum, c) => sum + c.minutes, 0);
  const lastWeekChapters = lastWeekCells.reduce(
    (sum, c) => sum + c.chapters,
    0
  );

  // Days active last 7
  const sevenDaysAgo = new Date(today);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
  const sevenDaysAgoKey = `${sevenDaysAgo.getFullYear()}-${String(sevenDaysAgo.getMonth() + 1).padStart(2, "0")}-${String(sevenDaysAgo.getDate()).padStart(2, "0")}`;
  const last7Cells = analytics.heatmapCells.filter((cell) => {
    return cell.key >= sevenDaysAgoKey && cell.key <= todayKey;
  });
  const daysActiveLast7 = last7Cells.filter((c) => c.minutes > 0).length;

  // Reading activity data from heatmap
  const readingDays = analytics.heatmapCells
    .filter((cell) => cell.minutes > 0 || cell.chapters > 0)
    .map((cell) => ({
      date: cell.key,
      minutes: cell.minutes,
      chapters: cell.chapters,
    }));

  // Hourly breakdown for today from this device's localStorage
  const todayHourly = aggregateHourlyForDay(todayKey);

  // Map badge milestones
  const nextMilestones = nextMilestonesFromBadges.slice(0, 3).map((m) => ({
    id: m.badge.id,
    name: m.badge.name,
    icon: m.badge.icon,
    description: m.badge.description,
    current: m.badge.progressValue,
    target: m.badge.targetValue,
  }));

  // Drive achievements purely from the real badge system — never render mock
  // milestones over a user with no real progress. NextAchievements and
  // PersonalizedGreeting both handle an empty array gracefully.
  const effectiveMilestones = nextMilestones;

  // Today's quests: goal-based reading, a finished chapter, and reviews due now.
  const dueNow = reviewData.overdueCount + reviewData.dueTodayCount;
  const dailyQuests = buildDailyQuests(analytics, dueNow, todayKey, reviewedTodayCount);

  return {
    user: {
      name: viewerName,
      tier,
      insightPoints: insightPointsBalance,
      isPro,
    },
    todayGoal: {
      targetMinutes: analytics.dailyGoalMinutes,
      completedMinutes: analytics.minutesReadToday,
      stepsCompletedToday: stepsCompletedToday(analytics, todayKey),
      totalStepsToday: 4,
    },
    streak: {
      currentDays: analytics.streakDays,
      bestDays: analytics.longestStreak,
      lastActiveDate: analytics.lastActiveLabel,
      // Streak Shields come from the server streak store (GET /me/streak). The
      // server model holds shields that auto-protect, so "equipped" == "held".
      // (currentDays/bestDays/consistency still come from useBookAnalytics — a
      // separate streak-source divergence left for a follow-up reconciliation.)
      freezesEquipped: shieldsHeld,
      freezesAvailable: shieldsHeld,
      consistencyLast30Days: analytics.heatmapCells.filter(
        (c) => c.minutes > 0
      ).length,
      daysActiveLast7,
      atRisk: analytics.streakAtRisk,
    },
    weekSummary: {
      timeReadMinutes: thisWeekMinutes,
      previousWeekMinutes: lastWeekMinutes,
      chaptersCompleted: thisWeekChapters,
      previousWeekChapters: lastWeekChapters,
      quizAccuracy: analytics.avgQuizScore > 0 ? analytics.avgQuizScore : null,
      previousWeekQuizAccuracy: null,
      weekStartDate,
    },
    activeBooks,
    completedBooks,
    dailyQuests,
    reviews: reviewData,
    readingActivity: {
      days: readingDays,
      totalDaysWithData: readingDays.length,
      todayHourly,
      todayMinutes: analytics.minutesReadToday,
    },
    nextMilestones: effectiveMilestones,
    readingHistoryOff: analytics.readingHistoryOff,
  };
}

// ──────────────────────────────────────────────────
// Loading skeleton
// ──────────────────────────────────────────────────

function SkeletonBlock({
  width,
  height,
  className = "",
}: {
  width?: string | number;
  height?: string | number;
  className?: string;
}) {
  return (
    <div
      className={`animate-shimmer rounded-xl ${className}`}
      style={{
        width: width ?? "100%",
        height: height ?? 20,
      }}
    />
  );
}

function ProgressSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      {/* Hero skeleton */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_1.2fr]">
        <div className="flex flex-col gap-4">
          <SkeletonBlock height={32} width="60%" />
          <SkeletonBlock height={16} width="80%" />
          <div className="flex justify-center py-4">
            <SkeletonBlock
              width={180}
              height={180}
              className="rounded-full"
            />
          </div>
          <SkeletonBlock height={20} width="50%" />
        </div>
        <SkeletonBlock height={400} className="rounded-2xl" />
      </div>
      {/* Section skeletons */}
      <SkeletonBlock height={150} className="rounded-2xl" />
      <SkeletonBlock height={120} className="rounded-2xl" />
      <SkeletonBlock height={200} className="rounded-2xl" />
    </div>
  );
}

// ──────────────────────────────────────────────────
// Animation variants
// ──────────────────────────────────────────────────

const sectionVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: DUR.slow, ease: EASE.standard },
  },
};

// ──────────────────────────────────────────────────
// Main page component
// ──────────────────────────────────────────────────

export function ProgressPage() {
  const router = useRouter();
  const prefersReduced = useReducedMotion();
  const searchRef = useRef<HTMLInputElement | null>(null);
  const [query, setQuery] = useState("");
  const [primaryBookId, setPrimaryBookId] = useState<string | null>(null);
  const [showReviewSession, setShowReviewSession] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  // ── Hooks ──
  const {
    state: onboarding,
    hydrated: onboardingHydrated,
  } = useOnboardingState();
  const { identity: viewerIdentity } = useBookViewer();
  const { hydrated, analytics } = useBookAnalytics(
    onboarding.selectedBookIds,
    onboarding.dailyGoalMinutes
  );
  const { payload: insightPointsPayload } = useInsightPoints(
    onboarding.setupComplete
  );
  const { nextMilestones: badgeMilestones, recentlyEarned } = useBadgeSystem({
    selectedBookIds: onboarding.selectedBookIds,
    dailyGoalMinutes: onboarding.dailyGoalMinutes,
  });

  const { data: serverTier } = useServerTier();
  const tier = useMemo(() => tierPill(serverTier), [serverTier]);

  const viewerName = viewerIdentity.displayName || "Reader";

  // isPro derives from the dashboard aggregate's `entitlement.plan` (already
  // loaded by useBookAnalytics) — no separate /me/entitlements round trip
  // (WS3-023). The entitlement is CRITICAL dashboard data, so an outage surfaces
  // as a dashboard error and NEVER silently collapses PRO to FREE.
  const isPro = analytics?.isPro ?? false;

  // Source the KnowledgeReview counts, the "Review 5 concepts" quest, and the
  // Streak Shield count from the server (FSRS deck + streak store) so this page
  // agrees with the home ReviewDueWidget instead of a per-device localStorage
  // SRS. Re-runs when a review session closes (refreshKey bumps).
  const reviewsQuery = useBookQuery<{ cards: FSRSCardLite[] }>(REVIEWS_ALL_KEY);
  const reviewCards = reviewsQuery.data?.cards;
  const reviewData = useMemo<ReviewData | null>(
    () => (reviewCards ? buildReviewDataFromCards(reviewCards) : null),
    [reviewCards]
  );
  const reviewedTodayCount = useMemo(
    () => (reviewCards ? countReviewedToday(reviewCards) : 0),
    [reviewCards]
  );
  // PROG-19: no deck yet is "loading" or "error", never the new-reader empty state.
  const reviewStatus: "ready" | "loading" | "error" = reviewData
    ? "ready"
    : reviewsQuery.error
      ? "error"
      : "loading";
  const refetchReviews = reviewsQuery.refetch;
  const [shieldsHeld, setShieldsHeld] = useState(0);
  useEffect(() => {
    fetchBookJsonCached<{ shieldsHeld?: number }>(STREAK_KEY)
      .then((s) => setShieldsHeld(s.shieldsHeld ?? 0))
      .catch(() => {});
  }, [refreshKey]);

  useKeyboardShortcut(
    "/",
    (event) => {
      event.preventDefault();
      searchRef.current?.focus();
    },
    { ignoreWhenTyping: true }
  );

  // Redirect if not onboarded — only once the server has positively said so,
  // never on the fresh-browser default or a failed check (M36, SHELL-02).
  useOnboardingRedirect({ hydrated: onboardingHydrated, setupComplete: onboarding.setupComplete });

  // ── Build page data ──
  const data = useMemo<ProgressPageData | null>(() => {
    if (!analytics) return null;
    return buildProgressData(
      viewerName,
      analytics,
      insightPointsPayload?.summary.balance ?? 0,
      badgeMilestones,
      isPro,
      reviewData ?? EMPTY_REVIEW_DATA,
      reviewedTodayCount,
      shieldsHeld,
      tier
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [analytics, viewerName, insightPointsPayload, badgeMilestones, isPro, reviewData, reviewedTodayCount, shieldsHeld, tier, refreshKey]);

  // Fetch daily reader metrics for the active books in ONE batched request
  // (WS3-023) instead of an HTTP fan-out of one /books/[id]/metrics call per book.
  const [readerMetrics, setReaderMetrics] = useState<Record<string, number>>({});
  useEffect(() => {
    if (!data?.activeBooks.length) return;
    const ids = data.activeBooks.map((b) => b.id);
    let cancelled = false;
    fetchBookJson<{ metrics?: Record<string, { readersToday?: number }> }>(
      "/app/api/book/books/reader-metrics",
      { method: "POST", body: JSON.stringify({ bookIds: ids }) }
    )
      .then((res) => {
        if (cancelled) return;
        const map: Record<string, number> = {};
        for (const id of ids) {
          const readersToday = res.metrics?.[id]?.readersToday;
          if (typeof readersToday === "number") map[id] = readersToday;
        }
        setReaderMetrics(map);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [data?.activeBooks.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // Allow switching primary book via ContinueLearningCard
  const displayData = useMemo<ProgressPageData | null>(() => {
    if (!data) return null;

    // Merge reader metrics into active books.
    const enriched = data.activeBooks.map((b) => ({
      ...b,
      readersCount: readerMetrics[b.id] ?? b.readersCount,
    }));

    const merged = { ...data, activeBooks: enriched };

    if (!primaryBookId) return merged;

    const idx = merged.activeBooks.findIndex((b) => b.id === primaryBookId);
    if (idx < 0) return merged;

    const reordered = [...merged.activeBooks];
    const [selected] = reordered.splice(idx, 1);
    if (selected !== undefined) reordered.unshift(selected); // idx guarded ≥ 0 and < length
    return { ...merged, activeBooks: reordered };
  }, [data, primaryBookId, readerMetrics]);

  // ── Determine which sections to show (progressive disclosure) ──
  const totalDaysWithData = displayData?.readingActivity.totalDaysWithData ?? 0;

  // "Just earned" banner: only a badge earned in the last 48 hours (PROG-18).
  const recentBadge = recentlyEarned[0] && isJustEarned(recentlyEarned[0].earnedAt) ? recentlyEarned[0] : null;
  const recentBadgeName = recentBadge?.name ?? null;
  const recentBadgeId = recentBadge?.id ?? null;

  // ── Loading state ──
  if (!onboardingHydrated || !hydrated || !onboarding.setupComplete) {
    return (
      <div className="cf-app-shell">
        <TopNav
          name={viewerName}
          avatarUrl={viewerIdentity.avatarDataUrl}
          activeTab="progress"
          searchQuery={query}
          onSearchChange={setQuery}
          searchInputRef={searchRef}
          showSearch
          showGlobalSearchPanel
          logoVariant="dashboard"
        />
        <main
          id="main"
          tabIndex={-1}
          className="mx-auto w-full max-w-7xl px-4 pb-28 pt-7 focus:outline-none sm:px-6 sm:pt-8 md:pb-24"
        >
          <ProgressSkeleton />
        </main>
      </div>
    );
  }

  // ── Error state ──
  if (!displayData) {
    return (
      <div className="cf-app-shell">
        <TopNav
          name={viewerName}
          avatarUrl={viewerIdentity.avatarDataUrl}
          activeTab="progress"
          searchQuery={query}
          onSearchChange={setQuery}
          searchInputRef={searchRef}
          showSearch
          showGlobalSearchPanel
          logoVariant="dashboard"
        />
        <main
          id="main"
          tabIndex={-1}
          className="mx-auto grid min-h-[60vh] w-full max-w-md place-content-center px-4 py-10 focus:outline-none sm:px-6"
        >
          <ErrorBanner
            title="We couldn't load your progress"
            message="Something went wrong loading your progress data. Please try again."
            onRetry={() => window.location.reload()}
          />
        </main>
      </div>
    );
  }

  return (
    <div className="cf-app-shell">
      <TopNav
        name={viewerName}
        avatarUrl={viewerIdentity.avatarDataUrl}
        activeTab="progress"
        searchQuery={query}
        onSearchChange={setQuery}
        searchInputRef={searchRef}
        showSearch
        showGlobalSearchPanel
        logoVariant="dashboard"
      />

      <motion.main
        id="main"
        tabIndex={-1}
        className="mx-auto w-full max-w-7xl space-y-6 px-4 pb-28 pt-7 focus:outline-none sm:px-6 sm:pt-8 md:pb-24"
        initial={{ opacity: prefersReduced ? 1 : 0, y: prefersReduced ? 0 : 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: DUR.normal }}
      >
      <motion.div
        initial="hidden"
        animate="visible"
        variants={{
          hidden: { opacity: 0 },
          visible: {
            opacity: 1,
            transition: { staggerChildren: 0.15, delayChildren: 0.05 },
          },
        }}
        className="space-y-6"
      >
        {/* SECTION 1: Hero */}
        <motion.div variants={sectionVariants}>
          <HeroSection
            data={displayData}
            onSwitchBook={(bookId) => setPrimaryBookId(bookId)}
          />
        </motion.div>

        {/* SECTION 2: Daily Quests */}
        <motion.div variants={sectionVariants}>
          <DailyQuests
            quests={displayData.dailyQuests}
            onQuestClick={(questId) => {
              if (questId === "q3") setShowReviewSession(true);
            }}
          />
        </motion.div>

        {/* SECTION 3: This Week Summary (scroll-triggered) */}
        <motion.div
          initial={{ opacity: prefersReduced ? 1 : 0, y: prefersReduced ? 0 : 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-50px" }}
          transition={{ duration: DUR.slow, ease: EASE.standard }}
        >
          <WeeklySummary
            week={displayData.weekSummary}
            streak={displayData.streak}
            isFirstWeek={totalDaysWithData < 14}
          />
        </motion.div>

        {/* SECTION 4: Reading Activity — hide if truly no data (or say history is off) */}
        {(totalDaysWithData > 0 || displayData.readingHistoryOff) && (
          <motion.div
            initial={{ opacity: prefersReduced ? 1 : 0, y: prefersReduced ? 0 : 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-50px" }}
            transition={{ duration: DUR.slow, ease: EASE.standard }}
          >
            <ReadingActivity
              activity={displayData.readingActivity}
              historyOff={displayData.readingHistoryOff}
              onStartReading={() => {
                if (displayData.activeBooks[0]) {
                  router.push(
                    `/book/library/${encodeURIComponent(displayData.activeBooks[0].id)}`
                  );
                } else {
                  router.push("/book/library");
                }
              }}
            />
          </motion.div>
        )}

        {/* SECTION 5: Knowledge Review */}
        <motion.div
          initial={{ opacity: prefersReduced ? 1 : 0, y: prefersReduced ? 0 : 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-50px" }}
          transition={{ duration: DUR.slow, ease: EASE.standard }}
        >
          <KnowledgeReview
            reviews={displayData.reviews}
            status={reviewStatus}
            onRetry={refetchReviews}
            firstActiveBook={displayData.activeBooks[0] ?? null}
            onStartReview={() => setShowReviewSession(true)}
          />
        </motion.div>

        {/* SECTION 6: Your Books */}
        <motion.div
          initial={{ opacity: prefersReduced ? 1 : 0, y: prefersReduced ? 0 : 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-50px" }}
          transition={{ duration: DUR.slow, ease: EASE.standard }}
        >
          <YourBooks
            activeBooks={displayData.activeBooks}
            completedBooks={displayData.completedBooks}
          />
        </motion.div>

        {/* SECTION 7: Next Achievements */}
        <motion.div
          initial={{ opacity: prefersReduced ? 1 : 0, y: prefersReduced ? 0 : 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-50px" }}
          transition={{ duration: DUR.slow, ease: EASE.standard }}
        >
          <NextAchievements
            milestones={displayData.nextMilestones}
            recentlyEarnedBadge={recentBadgeName}
            recentlyEarnedBadgeId={recentBadgeId}
          />
        </motion.div>

        {/* SECTION 8: Pro Insights Preview (free users only) */}
        <motion.div
          initial={{ opacity: prefersReduced ? 1 : 0, y: prefersReduced ? 0 : 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-50px" }}
          transition={{ duration: DUR.slow, ease: EASE.standard }}
        >
          <ProInsightsPreview isPro={displayData.user.isPro} />
        </motion.div>
      </motion.div>
      </motion.main>

      {showReviewSession && (
        <ReviewSessionFSRS
          key={refreshKey}
          onClose={() => {
            setShowReviewSession(false);
            // The session mutated the FSRS deck + streak store. Invalidation does
            // not refetch mounted readers (C14), so refetch the deck explicitly;
            // the refreshKey bump re-reads the streak store.
            invalidateBookCache(STREAK_KEY);
            refetchReviews();
            setRefreshKey((k) => k + 1);
          }}
        />
      )}
    </div>
  );
}
