"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";
import { TopNav } from "@/app/book/home/components/TopNav";
import { useOnboardingState } from "@/app/book/hooks/useOnboardingState";
import { useBookAnalytics } from "@/app/book/hooks/useBookAnalytics";
import { useBookViewer } from "@/app/book/hooks/useBookViewer";
import { useInsightPoints } from "@/app/book/hooks/useInsightPoints";
import { useBadgeSystem } from "@/app/book/hooks/useBadgeSystem";
import { useKeyboardShortcut } from "@/app/book/hooks/useKeyboardShortcut";
import type {
  ProgressPageData,
  ActiveBook,
  CompletedBook,
  DailyQuest,
  ReviewData,
  StepNumber,
  LearningStep,
} from "./progressTypes";
import { getBookCoverPath } from "@/lib/book-covers";
import { deriveReaderLevel, deriveReaderLevelProgress } from "@/lib/reader-levels";
import { fetchBookJson } from "@/app/book/_lib/book-api";
import { aggregateHourlyForDay } from "@/app/book/library/hooks/readingActivityStorage";
import { ReviewSessionFSRS } from "@/app/book/components/ReviewSessionFSRS";
import { ErrorBanner } from "@/app/book/components/ui/ErrorBanner";
import { HeroSection } from "./HeroSection";
import { DailyQuests } from "./DailyQuests";
import { WeeklySummary } from "./WeeklySummary";
import { ReadingActivity } from "./ReadingActivity";
import { KnowledgeReview } from "./KnowledgeReview";
import { YourBooks } from "./YourBooks";
import { NextAchievements } from "./NextAchievements";
import { ProInsightsPreview } from "./ProInsightsPreview";

// ──────────────────────────────────────────────────
// Data transformation: hooks → ProgressPageData
// ──────────────────────────────────────────────────

// Structural shells for the daily quests. `current`/`completed` are placeholders
// only — every value is recomputed from real analytics in `buildProgressData`.
const DAILY_QUEST_TEMPLATES: ReadonlyArray<DailyQuest> = [
  {
    id: "q1",
    title: "Read for 10 minutes",
    icon: "\u{1F4D6}",
    current: 0,
    target: 10,
    type: "progress",
    completed: false,
  },
  {
    id: "q2",
    title: "Complete a quiz",
    icon: "\u{1F9E0}",
    current: 0,
    target: 1,
    type: "boolean",
    completed: false,
  },
  {
    id: "q3",
    title: "Review 5 concepts",
    icon: "\u{1F504}",
    current: 0,
    target: 5,
    type: "progress",
    completed: false,
  },
];

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

const DAY_MS = 86_400_000;

/** Lite shape of an FSRS card row as returned by GET /me/reviews?mode=all. */
type FSRSCardLite = { dueAt: string; lastReviewAt: string; reps: number };

const EMPTY_REVIEW_DATA: ReviewData = {
  overdueCount: 0,
  dueTodayCount: 0,
  upcomingThisWeekCount: 0,
  totalConceptsLearned: 0,
  forecast: [],
};

function localDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Whole-day offset of a due date from the start of today (negative = overdue). */
function dayOffsetFromToday(dueAt: string, todayMs: number): number {
  const dueDayStart = new Date(dueAt);
  dueDayStart.setHours(0, 0, 0, 0);
  return Math.round((dueDayStart.getTime() - todayMs) / DAY_MS);
}

function buildReviewDataFromCards(cards: FSRSCardLite[]): ReviewData {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const todayMs = startOfToday.getTime();

  // forecast[0] = today (also absorbs overdue, which is actionable now);
  // forecast[1..6] = each of the next six days.
  const forecast = Array.from({ length: 7 }, (_, offset) => ({
    date: localDateKey(new Date(todayMs + offset * DAY_MS)),
    count: 0,
  }));

  let overdueCount = 0;
  let dueTodayCount = 0;
  let upcomingThisWeekCount = 0;

  for (const card of cards) {
    const offset = dayOffsetFromToday(card.dueAt, todayMs);
    if (offset < 0) {
      overdueCount += 1;
      forecast[0].count += 1;
    } else if (offset === 0) {
      dueTodayCount += 1;
      forecast[0].count += 1;
    } else if (offset <= 7) {
      upcomingThisWeekCount += 1;
      if (offset <= 6) forecast[offset].count += 1;
    }
  }

  return {
    overdueCount,
    dueTodayCount,
    upcomingThisWeekCount,
    totalConceptsLearned: cards.length,
    forecast,
  };
}

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
  shieldsHeld: number
): ProgressPageData {
  const totalCompletedChapters = analytics.totalCompletedChapters;
  const readerLevel = deriveReaderLevel(totalCompletedChapters);
  const readerLevelProgress = deriveReaderLevelProgress(totalCompletedChapters);

  // Map active books from analytics
  const activeBooks: ActiveBook[] = analytics.recentlyOpenedSnapshots.map(
    (snapshot) => {
      const loopStep = snapshot.currentLoopStep ?? "summary";
      const { step, stepNumber } = LOOP_STEP_MAP[loopStep] ?? LOOP_STEP_MAP.summary;
      return {
        id: snapshot.book.id,
        title: snapshot.book.title,
        author: snapshot.book.author ?? "",
        coverUrl: getBookCoverPath(snapshot.book.id),
        totalChapters: snapshot.totalChapters,
        completedChapters: snapshot.completedChapters,
        currentChapterNumber: Math.max(snapshot.completedChapters + 1, 1),
        currentChapterTitle: snapshot.lastOpenedLabel || "Chapter 1",
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

  // Hourly breakdown for today from localStorage
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

  // Build daily quests with real completion data
  const wiredQuests = DAILY_QUEST_TEMPLATES
    .filter((q) => {
      if (q.id === "q3" && totalCompletedChapters === 0) return false;
      return true;
    })
    .map((q) => {
      if (q.id === "q1") {
        return {
          ...q,
          current: Math.min(analytics.minutesReadToday, q.target),
          completed: analytics.minutesReadToday >= q.target,
        };
      }
      if (q.id === "q2") {
        const todayCell = thisWeekCells.find((c) => c.key === todayKey);
        const todayChapters = todayCell?.chapters ?? 0;
        return {
          ...q,
          current: Math.min(todayChapters, q.target),
          completed: todayChapters >= q.target,
        };
      }
      if (q.id === "q3") {
        return {
          ...q,
          current: Math.min(reviewedTodayCount, q.target),
          completed: reviewedTodayCount >= q.target,
        };
      }
      return q;
    });

  return {
    user: {
      name: viewerName,
      readerLevel,
      readerLevelProgress,
      insightPoints: insightPointsBalance,
      isPro,
    },
    todayGoal: (() => {
      // Count today's chapters from heatmap (each = 4 steps through the learning loop)
      const todayCellForSteps = analytics.heatmapCells.find((c) => c.key === todayKey);
      const todayChaptersCompleted = todayCellForSteps?.chapters ?? 0;
      // Partial step progress from the most recently active book
      const leadBook = analytics.recentlyOpenedSnapshots[0];
      const partialSteps = leadBook?.currentLoopStep
        ? (LOOP_STEP_MAP[leadBook.currentLoopStep]?.stepNumber ?? 1) - 1
        : 0;
      const stepsToday = todayChaptersCompleted * 4 + partialSteps;
      return {
        targetMinutes: analytics.dailyGoalMinutes,
        completedMinutes: analytics.minutesReadToday,
        stepsCompletedToday: stepsToday,
        totalStepsToday: 4,
      };
    })(),
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
    dailyQuests: wiredQuests,
    // Kept for type compatibility (ProgressPageData.questBonusFP) but no longer
    // surfaced as a currency promise — quests are habit nudges, not an IP award.
    // Stable full-pool value so it never reads as "+0" if anything consumes it.
    questBonusFP: wiredQuests.length * 25,
    reviews: reviewData,
    readingActivity: {
      days: readingDays,
      totalDaysWithData: readingDays.length,
      todayHourly,
    },
    nextMilestones: effectiveMilestones,
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
      className={`cf-skeleton-shimmer rounded-xl ${className}`}
      style={{
        width: width ?? "100%",
        height: height ?? 20,
        background:
          "linear-gradient(90deg, var(--cf-surface-muted) 0%, var(--cf-surface-strong) 50%, var(--cf-surface-muted) 100%)",
        backgroundSize: "200% 100%",
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
    transition: { duration: 0.5, ease: "easeOut" as const },
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
    statusResolved: onboardingStatusResolved,
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

  const viewerName = viewerIdentity.displayName || "Reader";

  // Fetch real entitlement status
  const [isPro, setIsPro] = useState(false);
  useEffect(() => {
    fetchBookJson<{ plan?: string }>("/app/api/book/me/entitlements")
      .then((e) => setIsPro(e.plan === "PRO"))
      .catch(() => {});
  }, []);

  // Source the KnowledgeReview counts, the "Review 5 concepts" quest, and the
  // Streak Shield count from the server (FSRS deck + streak store) so this page
  // agrees with the home ReviewDueWidget instead of a per-device localStorage
  // SRS. Re-runs when a review session closes (refreshKey bumps).
  const [reviewData, setReviewData] = useState<ReviewData | null>(null);
  const [reviewedTodayCount, setReviewedTodayCount] = useState(0);
  const [shieldsHeld, setShieldsHeld] = useState(0);
  useEffect(() => {
    fetchBookJson<{ cards: FSRSCardLite[] }>("/app/api/book/me/reviews?mode=all")
      .then(({ cards }) => {
        setReviewData(buildReviewDataFromCards(cards));
        setReviewedTodayCount(countReviewedToday(cards));
      })
      .catch(() => {});
    fetchBookJson<{ shieldsHeld?: number }>("/app/api/book/me/streak")
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

  // Redirect if not onboarded — but only after the server onboarding check has
  // settled (onboardingStatusResolved). A returning user on a fresh browser
  // starts with the optimistic localStorage default setupComplete=false; without
  // this gate they'd be bounced to /book (then /dashboard) before the server
  // confirmation could flip the flag. See finding M36.
  useEffect(() => {
    if (!onboardingHydrated || !onboardingStatusResolved) return;
    if (!onboarding.setupComplete) {
      router.replace("/book");
    }
  }, [onboarding.setupComplete, onboardingHydrated, onboardingStatusResolved, router]);

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
      shieldsHeld
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [analytics, viewerName, insightPointsPayload, badgeMilestones, isPro, reviewData, reviewedTodayCount, shieldsHeld, refreshKey]);

  // Fetch daily reader metrics for active books.
  const [readerMetrics, setReaderMetrics] = useState<Record<string, number>>({});
  useEffect(() => {
    if (!data?.activeBooks.length) return;
    const ids = data.activeBooks.map((b) => b.id);
    Promise.allSettled(
      ids.map((bookId) =>
        fetchBookJson<{ readersToday?: number }>(
          `/app/api/book/books/${encodeURIComponent(bookId)}/metrics`
        ).then((res) => [bookId, res.readersToday ?? 0] as const)
      )
    ).then((results) => {
      const map: Record<string, number> = {};
      for (const r of results) {
        if (r.status === "fulfilled") map[r.value[0]] = r.value[1];
      }
      setReaderMetrics(map);
    });
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
    reordered.unshift(selected);
    return { ...merged, activeBooks: reordered };
  }, [data, primaryBookId, readerMetrics]);

  // ── Determine which sections to show (progressive disclosure) ──
  const totalDaysWithData = displayData?.readingActivity.totalDaysWithData ?? 0;
  const hasQuizData = (displayData?.weekSummary.quizAccuracy ?? null) !== null;
  const hasCompletedChapters =
    (displayData?.activeBooks.reduce((s, b) => s + b.completedChapters, 0) ??
      0) > 0;
  const isNewUser = totalDaysWithData < 2;

  // Recent badge for celebration banner
  const recentBadgeName =
    recentlyEarned.length > 0 ? recentlyEarned[0].name : null;
  const recentBadgeId =
    recentlyEarned.length > 0 ? recentlyEarned[0].id : null;

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
        <main className="mx-auto w-full max-w-7xl px-4 pb-28 pt-7 sm:px-6 sm:pt-8 md:pb-24">
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
        <main className="mx-auto grid min-h-[60vh] w-full max-w-md place-content-center px-4 py-10 sm:px-6">
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
        className="mx-auto w-full max-w-7xl space-y-6 px-4 pb-28 pt-7 sm:px-6 sm:pt-8 md:pb-24"
        initial={{ opacity: prefersReduced ? 1 : 0, y: prefersReduced ? 0 : 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
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
          transition={{ duration: 0.5, ease: "easeOut" }}
        >
          <WeeklySummary
            week={displayData.weekSummary}
            streak={displayData.streak}
            isFirstWeek={totalDaysWithData < 14}
          />
        </motion.div>

        {/* SECTION 4: Reading Activity — hide if truly no data */}
        {totalDaysWithData > 0 && (
          <motion.div
            initial={{ opacity: prefersReduced ? 1 : 0, y: prefersReduced ? 0 : 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-50px" }}
            transition={{ duration: 0.5, ease: "easeOut" }}
          >
            <ReadingActivity
              activity={displayData.readingActivity}
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
          transition={{ duration: 0.5, ease: "easeOut" }}
        >
          <KnowledgeReview
            reviews={displayData.reviews}
            firstActiveBook={displayData.activeBooks[0] ?? null}
            onStartReview={() => setShowReviewSession(true)}
          />
        </motion.div>

        {/* SECTION 6: Your Books */}
        <motion.div
          initial={{ opacity: prefersReduced ? 1 : 0, y: prefersReduced ? 0 : 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-50px" }}
          transition={{ duration: 0.5, ease: "easeOut" }}
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
          transition={{ duration: 0.5, ease: "easeOut" }}
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
          transition={{ duration: 0.5, ease: "easeOut" }}
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
            setRefreshKey((k) => k + 1);
          }}
        />
      )}
    </div>
  );
}
