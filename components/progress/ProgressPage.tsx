"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";
import { TopNav } from "@/app/book/home/components/TopNav";
import { useOnboardingState } from "@/app/book/hooks/useOnboardingState";
import { useBookAnalytics } from "@/app/book/hooks/useBookAnalytics";
import { useBookViewer } from "@/app/book/hooks/useBookViewer";
import { useFlowPoints } from "@/app/book/hooks/useFlowPoints";
import { useBadgeSystem } from "@/app/book/hooks/useBadgeSystem";
import { useKeyboardShortcut } from "@/app/book/hooks/useKeyboardShortcut";
import type {
  ProgressPageData,
  ActiveBook,
  CompletedBook,
  ReaderLevel,
  StepNumber,
  LearningStep,
} from "./progressTypes";
import { mockProgressData } from "./progressMockData";
import { getBookCoverPath } from "@/lib/book-covers";
import { fetchBookJson } from "@/app/book/_lib/book-api";
import { aggregateHourlyForDay } from "@/app/book/library/hooks/readingActivityStorage";
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

function deriveReaderLevel(totalChapters: number): ReaderLevel {
  if (totalChapters >= 100) return "Thought Leader";
  if (totalChapters >= 25) return "Knowledge Builder";
  if (totalChapters >= 5) return "Active Learner";
  return "Curious Reader";
}

function deriveReaderLevelProgress(totalChapters: number): number {
  if (totalChapters >= 100) return 100;
  if (totalChapters >= 25) return Math.round(((totalChapters - 25) / 75) * 100);
  if (totalChapters >= 5) return Math.round(((totalChapters - 5) / 20) * 100);
  return Math.round((totalChapters / 5) * 100);
}

/** Determine the current learning step from reader/book state.
 * The analytics hook doesn't expose per-chapter step info,
 * so we default to 'summary' for step 1. This can be refined
 * when the backend provides step-level progress.
 */
function inferCurrentStep(
  completedChapters: number,
  _status: string
): { step: LearningStep; stepNumber: StepNumber } {
  // Default to summary (step 1) since the analytics
  // hook doesn't track sub-chapter learning steps
  return { step: "summary", stepNumber: 1 };
}

function buildProgressData(
  viewerName: string,
  analytics: NonNullable<ReturnType<typeof useBookAnalytics>["analytics"]>,
  flowPointsBalance: number,
  nextMilestonesFromBadges: ReturnType<typeof useBadgeSystem>["nextMilestones"],
  isPro: boolean
): ProgressPageData {
  const totalCompletedChapters = analytics.totalCompletedChapters;
  const readerLevel = deriveReaderLevel(totalCompletedChapters);
  const readerLevelProgress = deriveReaderLevelProgress(totalCompletedChapters);

  // Map active books from analytics
  const activeBooks: ActiveBook[] = analytics.recentlyOpenedSnapshots.map(
    (snapshot) => {
      const { step, stepNumber } = inferCurrentStep(
        snapshot.completedChapters,
        snapshot.status
      );
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

  // Use mock milestones if badge system returned none
  const effectiveMilestones =
    nextMilestones.length > 0 ? nextMilestones : mockProgressData.nextMilestones;

  return {
    user: {
      name: viewerName,
      readerLevel,
      readerLevelProgress,
      flowPoints: flowPointsBalance,
      isPro,
    },
    todayGoal: {
      targetMinutes: analytics.dailyGoalMinutes,
      completedMinutes: analytics.minutesReadToday,
      stepsCompletedToday: 0,
      totalStepsToday: 4,
    },
    streak: {
      currentDays: analytics.streakDays,
      bestDays: analytics.longestStreak,
      lastActiveDate: analytics.lastActiveLabel,
      freezesEquipped: 0,
      freezesAvailable: 0,
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
    dailyQuests: mockProgressData.dailyQuests
      .filter((q) => {
        // Hide review quest if no completed chapters (nothing to review)
        if (q.id === "q3" && totalCompletedChapters === 0) return false;
        return true;
      })
      .map((q) => {
        // Wire up the read quest with real data
        if (q.id === "q1") {
          return {
            ...q,
            current: Math.min(analytics.minutesReadToday, q.target),
            completed: analytics.minutesReadToday >= q.target,
          };
        }
        // Wire up the quiz quest with today's chapter completions
        if (q.id === "q2") {
          const todayCell = thisWeekCells.find((c) => {
            const cellDate = new Date(`${c.key}T12:00:00`);
            return (
              cellDate.getFullYear() === today.getFullYear() &&
              cellDate.getMonth() === today.getMonth() &&
              cellDate.getDate() === today.getDate()
            );
          });
          const todayChapters = todayCell?.chapters ?? 0;
          return {
            ...q,
            current: Math.min(todayChapters, q.target),
            completed: todayChapters >= q.target,
          };
        }
        return q;
      }),
    questBonusFP: mockProgressData.dailyQuests.filter((q) => {
      if (q.id === "q1") return analytics.minutesReadToday < q.target;
      if (q.id === "q3" && totalCompletedChapters === 0) return false;
      return !q.completed;
    }).length * 25,
    reviews: {
      overdueCount: 0,
      dueTodayCount: analytics.upcomingReviews.length,
      upcomingThisWeekCount: analytics.upcomingReviews.length,
      totalConceptsLearned: totalCompletedChapters,
      forecast: [],
    },
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

  // ── Hooks ──
  const { state: onboarding, hydrated: onboardingHydrated } =
    useOnboardingState();
  const { identity: viewerIdentity } = useBookViewer();
  const { hydrated, analytics } = useBookAnalytics(
    onboarding.selectedBookIds,
    onboarding.dailyGoalMinutes
  );
  const { payload: flowPointsPayload } = useFlowPoints(
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

  useKeyboardShortcut(
    "/",
    (event) => {
      event.preventDefault();
      searchRef.current?.focus();
    },
    { ignoreWhenTyping: true }
  );

  // Redirect if not onboarded
  useEffect(() => {
    if (!onboardingHydrated) return;
    if (!onboarding.setupComplete) {
      router.replace("/book");
    }
  }, [onboarding.setupComplete, onboardingHydrated, router]);

  // ── Build page data ──
  const data = useMemo<ProgressPageData | null>(() => {
    if (!analytics) return null;
    return buildProgressData(
      viewerName,
      analytics,
      flowPointsPayload?.summary.balance ?? 0,
      badgeMilestones,
      isPro
    );
  }, [analytics, viewerName, flowPointsPayload, badgeMilestones, isPro]);

  // Allow switching primary book via ContinueLearningCard
  const displayData = useMemo<ProgressPageData | null>(() => {
    if (!data) return null;
    if (!primaryBookId) return data;

    const idx = data.activeBooks.findIndex((b) => b.id === primaryBookId);
    if (idx <= 0) return data;

    const reordered = [...data.activeBooks];
    const [selected] = reordered.splice(idx, 1);
    reordered.unshift(selected);
    return { ...data, activeBooks: reordered };
  }, [data, primaryBookId]);

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
      <main className="cf-app-shell">
        <TopNav
          name={viewerName}
          activeTab="progress"
          searchQuery={query}
          onSearchChange={setQuery}
          searchInputRef={searchRef}
          showSearch
          showGlobalSearchPanel
          logoVariant="dashboard"
        />
        <section className="mx-auto w-full max-w-7xl px-4 pb-28 pt-7 sm:px-6 sm:pt-8 md:pb-24">
          <ProgressSkeleton />
        </section>
      </main>
    );
  }

  // ── Error state ──
  if (!displayData) {
    return (
      <main className="cf-app-shell">
        <TopNav
          name={viewerName}
          activeTab="progress"
          searchQuery={query}
          onSearchChange={setQuery}
          searchInputRef={searchRef}
          showSearch
          showGlobalSearchPanel
          logoVariant="dashboard"
        />
        <section className="mx-auto flex min-h-[60vh] w-full max-w-7xl flex-col items-center justify-center gap-4 px-4 py-10 sm:px-6">
          <span className="text-4xl">{"\u{1F635}"}</span>
          <h2
            className="text-xl font-semibold"
            style={{ color: "var(--text-heading)" }}
          >
            Something went wrong
          </h2>
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
            We couldn&apos;t load your progress data.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="cursor-pointer rounded-xl px-6 py-2.5 text-sm font-medium transition-colors"
            style={{
              background: "var(--cf-border-strong)",
              border: "1px solid var(--cf-border-strong)",
              color: "var(--text-heading)",
            }}
          >
            Try again {"\u2192"}
          </button>
        </section>
      </main>
    );
  }

  return (
    <main className="cf-app-shell">
      <TopNav
        name={viewerName}
        activeTab="progress"
        searchQuery={query}
        onSearchChange={setQuery}
        searchInputRef={searchRef}
        showSearch
        showGlobalSearchPanel
        logoVariant="dashboard"
      />

      <motion.section
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
            bonusFP={displayData.questBonusFP}
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
      </motion.section>
    </main>
  );
}
