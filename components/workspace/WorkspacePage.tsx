"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Sparkles, X } from "lucide-react";
import { JetBrains_Mono } from "next/font/google";
import { motion, useReducedMotion } from "framer-motion";
import { AnimatedBackground } from "./AnimatedBackground";
import { CompactHeader } from "./CompactHeader";
import { HeroSessionCard } from "./HeroSessionCard";
import { WeeklyMomentumStrip } from "./WeeklyMomentumStrip";
import { BookRow } from "./BookRow";
import { RewardsCard } from "./RewardsCard";
import { NextAchievementCard } from "./NextAchievementCard";
import { DiscoveryRow } from "./DiscoveryRow";
import { useEffect, useRef, useState } from "react";
import { TopNav } from "@/app/book/home/components/TopNav";
import { useBookAnalytics, type AnalyticsState } from "@/app/book/hooks/useBookAnalytics";
import { useBookViewer } from "@/app/book/hooks/useBookViewer";
import { BOOK_PACKAGES, getBookPackagePresentation } from "@/app/book/data/bookPackages";
import { getBookCoverPath } from "@/lib/book-covers";
import {
  BADGE_DEFINITIONS,
  evaluateBadges,
  type BadgeProgressStats,
} from "@/app/book/data/mockBadges";
import { FLOW_POINTS_REWARDS } from "@/app/book/_lib/flow-points-economy";

const jetBrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains",
  display: "swap",
});

/* ────────────────────────────────────────────
   Type Definitions
   ──────────────────────────────────────────── */

type UserState =
  | "new_user"
  | "active_reader"
  | "quiz_pending"
  | "between_books"
  | "returning"
  | "free_limit_reached";

interface WorkspaceData {
  user: {
    firstName: string;
    isPro: boolean;
    streakCount: number;
    streakActive: boolean;
    insightPoints: number;
    dailyGoalMinutes: number;
    dailyProgressMinutes: number;
  };
  currentBook: {
    id: string;
    title: string;
    author: string;
    coverUrl: string;
    currentChapter: number;
    totalChapters: number;
    progressPercent: number;
    currentLoopStep: "summary" | "scenarios" | "quiz" | "unlock" | null;
    estimatedMinutes: number;
    gradient?: string;
    glowColor?: string;
  } | null;
  starterShelfBooks: Array<{
    id: string;
    title: string;
    author: string;
    coverUrl: string;
  }>;
  weeklyActivity: boolean[];
  weeklyStats: {
    chaptersCompleted: number;
    quizAverage: number | null;
  };
  userBooks: Array<{
    id: string;
    title: string;
    author: string;
    coverUrl: string;
    progressPercent: number;
    status: "not_started" | "in_progress" | "completed";
    gradient?: string;
  }>;
  recommendedProBooks: Array<{
    id: string;
    title: string;
    author: string;
    coverUrl: string;
    rating: number;
    readerCount: number;
    category: string;
    gradient?: string;
  }>;
  discoveryBooks: Array<{
    id: string;
    title: string;
    author: string;
    coverUrl: string;
    rating: number;
    readerCount: number;
    category: string;
    gradient?: string;
  }>;
  nextReward: {
    name: string;
    pointsRequired: number;
    currentPoints: number;
  };
  nextAchievement: {
    name: string;
    description: string;
    iconUrl: string;
    progressCurrent: number;
    progressTotal: number;
  } | null;
}

/* ────────────────────────────────────────────
   Analytics → WorkspaceData Mapper
   ──────────────────────────────────────────── */

const ALL_BOOK_IDS = BOOK_PACKAGES.map((pkg) => pkg.book.bookId);

function mapAnalyticsToWorkspaceData(
  analytics: AnalyticsState,
  firstName: string,
): WorkspaceData {
  const lead = analytics.inProgressBookSnapshots[0] ?? null;

  let currentBook: WorkspaceData["currentBook"] = null;
  if (lead) {
    const nextChapter = lead.completedChapters + 1;
    const chapterMinutes =
      BOOK_PACKAGES.find((p) => p.book.bookId === lead.book.id)
        ?.chapters.find((ch) => ch.number === nextChapter)?.readingTimeMinutes ??
      13;

    currentBook = {
      id: lead.book.id,
      title: lead.book.title,
      author: lead.book.author ?? "",
      coverUrl: getBookCoverPath(lead.book.id),
      currentChapter: Math.min(nextChapter, lead.totalChapters),
      totalChapters: lead.totalChapters,
      progressPercent: lead.progressPercent,
      currentLoopStep: lead.currentLoopStep ?? "summary",
      estimatedMinutes: chapterMinutes,
      glowColor:
        getBookPackagePresentation(lead.book.id).coverImage
          ? undefined
          : "rgba(139,92,246,0.35)",
    };
  }

  const starterShelfBooks = analytics.starterShelf
    .map((bookId) => {
      const snap = analytics.bookSnapshots.find((s) => s.book.id === bookId);
      if (!snap) return null;
      return {
        id: snap.book.id,
        title: snap.book.title,
        author: snap.book.author ?? "",
        coverUrl: getBookCoverPath(snap.book.id),
      };
    })
    .filter((b): b is NonNullable<typeof b> => b !== null);

  const last7 = analytics.heatmapCells.slice(-7);
  const weeklyActivity =
    last7.length >= 7
      ? last7.map((cell) => cell.minutes > 0)
      : [
          ...last7.map((cell) => cell.minutes > 0),
          ...Array(7 - last7.length).fill(false) as boolean[],
        ];

  const weeklyChapters = last7.reduce((sum, cell) => sum + cell.chapters, 0);

  return {
    user: {
      firstName,
      isPro: analytics.isPro,
      streakCount: analytics.streakDays,
      streakActive: analytics.streakDays > 0,
      insightPoints: analytics.insightPoints,
      dailyGoalMinutes: analytics.dailyGoalMinutes,
      dailyProgressMinutes: analytics.minutesReadToday,
    },
    currentBook,
    starterShelfBooks,
    weeklyActivity,
    weeklyStats: {
      chaptersCompleted: weeklyChapters,
      quizAverage: analytics.avgQuizScore || null,
    },
    userBooks: analytics.engagedBookSnapshots.map((snap) => ({
      id: snap.book.id,
      title: snap.book.title,
      author: snap.book.author ?? "",
      coverUrl: getBookCoverPath(snap.book.id),
      progressPercent: snap.progressPercent,
      status: snap.status === "completed"
        ? ("completed" as const)
        : snap.status === "in_progress"
          ? ("in_progress" as const)
          : ("not_started" as const),
    })),
    recommendedProBooks: analytics.isPro
      ? []
      : analytics.bookSnapshots
          .filter((s) => s.status === "not_started")
          .slice(0, 3)
          .map((snap) => ({
            id: snap.book.id,
            title: snap.book.title,
            author: snap.book.author ?? "",
            coverUrl: getBookCoverPath(snap.book.id),
            rating: 0,
            readerCount: 0,
            category: snap.book.category ?? "General",
          })),
    discoveryBooks: analytics.bookSnapshots
      .filter((s) => s.status === "not_started")
      .slice(0, 4)
      .map((snap) => ({
        id: snap.book.id,
        title: snap.book.title,
        author: snap.book.author ?? "",
        coverUrl: getBookCoverPath(snap.book.id),
        rating: 0,
        readerCount: 0,
        category: snap.book.category ?? "General",
      })),
    nextReward: {
      name: FLOW_POINTS_REWARDS[0]?.name ?? "Bonus Book Unlock",
      pointsRequired: FLOW_POINTS_REWARDS[0]?.costPoints ?? 900,
      currentPoints: analytics.insightPoints,
    },
    nextAchievement: deriveNextAchievement(analytics),
  };
}

function deriveNextAchievement(
  analytics: AnalyticsState
): WorkspaceData["nextAchievement"] {
  const partialStats: BadgeProgressStats = {
    totalCompletedChapters: analytics.totalCompletedChapters,
    completedBooks: analytics.booksCompleted,
    startedBooks: analytics.inProgressBookSnapshots.length + analytics.booksCompleted,
    streakDays: analytics.streakDays,
    longestStreak: analytics.longestStreak,
    avgQuizScore: analytics.avgQuizScore,
    maxQuizScore: analytics.maxQuizScore,
    quizzesPassed: 0,
    perfectQuizCount: 0,
    distinctQuizBooks: 0,
    quizzesPassedInDeeperMode: 0,
    quizCount: 0,
    totalQuizQuestionsAnswered: 0,
    completedGoalDays: 0,
    activeWeeks: 0,
    totalActiveDays: analytics.heatmapCells.filter((c) => c.minutes > 0).length,
    weekendActiveDays: 0,
    weekdayActiveDays: 0,
    recoveredAfterMiss: 0,
    chaptersSimpleCompleted: 0,
    chaptersStandardCompleted: 0,
    chaptersDeeperCompleted: 0,
    usedAllReadingModes: false,
    chaptersCompletedWithFocusMode: 0,
    completedChaptersWithNotes: 0,
    completedBooksInDeeperMode: 0,
    examplesViewedChapters: 0,
    viewedExampleContexts: [],
    personalExamplesChapters: 0,
    schoolExamplesChapters: 0,
    workExamplesChapters: 0,
    notesCount: 0,
    noteBooksCount: 0,
    completedChaptersWithReflection: 0,
    exploredCategories: 0,
    challengingBooksStarted: 0,
    returnedAfterLongGap: 0,
    readingListCount: 0,
    challengingBooksCompleted: 0,
    strategyBooksCompleted: 0,
    psychologyBooksCompleted: 0,
    completedCategoriesCount: 0,
    booksCompletedWithAllQuizzesPassed: 0,
    proActivated: false,
    proMultiTrack: false,
    recapCompletions: 0,
  };

  const earnedHistory = Object.fromEntries(
    Array.from(analytics.earnedBadgeIds).map((id) => [id, new Date().toISOString()])
  );
  const badges = evaluateBadges(partialStats, earnedHistory);

  const next = badges
    .filter((b) => !b.earned && b.isVisible && b.targetValue > 0)
    .sort((a, b) => {
      const ratioA = a.progressValue / a.targetValue;
      const ratioB = b.progressValue / b.targetValue;
      return ratioB - ratioA;
    })[0];

  if (!next) return null;

  return {
    name: next.name,
    description: next.description,
    iconUrl: next.icon,
    progressCurrent: next.progressValue,
    progressTotal: next.targetValue,
  };
}

/* ────────────────────────────────────────────
   Loading Skeleton
   ──────────────────────────────────────────── */

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
        background: "var(--cf-surface-muted)",
      }}
    />
  );
}

function DashboardSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      {/* Header skeleton */}
      <div className="flex flex-col gap-2">
        <SkeletonBlock height={28} width="40%" />
        <SkeletonBlock height={16} width="55%" />
      </div>

      {/* Hero card skeleton */}
      <div
        className="rounded-2xl p-6 md:p-8"
        style={{
          background: "var(--cf-surface-muted)",
          border: "1px solid var(--cf-border-strong)",
        }}
      >
        <SkeletonBlock height={14} width={120} />
        <div className="mt-4">
          <SkeletonBlock height={36} width="50%" />
        </div>
        <div className="mt-2">
          <SkeletonBlock height={16} width="30%" />
        </div>
        <div className="mt-6">
          <SkeletonBlock height={48} width={220} className="rounded-xl" />
        </div>
      </div>

      {/* Weekly strip skeleton */}
      <div className="flex gap-3">
        {Array.from({ length: 7 }).map((_, i) => (
          <SkeletonBlock key={i} height={32} width={32} className="rounded-lg" />
        ))}
      </div>

      {/* Book row skeleton */}
      <div>
        <SkeletonBlock height={24} width="20%" className="mb-4" />
        <div className="flex gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <SkeletonBlock key={i} height={200} width={160} className="shrink-0 rounded-xl" />
          ))}
        </div>
      </div>

      {/* Rewards skeleton */}
      <div className="flex flex-col gap-4 md:flex-row">
        <SkeletonBlock height={140} className="flex-1 rounded-2xl" />
        <SkeletonBlock height={140} className="flex-1 rounded-2xl" />
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────
   State Derivation
   ──────────────────────────────────────────── */

function deriveUserState(data: WorkspaceData): UserState {
  const { currentBook, userBooks, user } = data;

  if (
    userBooks.length === 0 ||
    userBooks.every(
      (b) => b.progressPercent === 0 && b.status === "not_started"
    )
  ) {
    return "new_user";
  }

  if (
    user.streakCount === 0 &&
    userBooks.some((b) => b.progressPercent > 0)
  ) {
    return "returning";
  }

  if (
    !user.isPro &&
    userBooks.filter((b) => b.status !== "not_started").length >= 2 &&
    !currentBook
  ) {
    return "free_limit_reached";
  }

  if (!currentBook) {
    return "between_books";
  }

  if (currentBook.currentLoopStep === "quiz") {
    return "quiz_pending";
  }

  return "active_reader";
}

function getSubtitle(state: UserState, data: WorkspaceData): string {
  switch (state) {
    case "new_user":
      return "Pick your first book to start growing";
    case "active_reader":
      return data.currentBook
        ? `Chapter ${data.currentBook.currentChapter} of ${data.currentBook.title} awaits`
        : "Continue where you left off";
    case "quiz_pending":
      return data.currentBook
        ? `Quiz ready for ${data.currentBook.title}`
        : "Take your quiz to unlock the next chapter";
    case "between_books":
      return "Pick your next book to continue growing";
    case "returning":
      return "Welcome back — your books are waiting";
    case "free_limit_reached":
      return "Unlock 93 more books with Pro";
    default:
      return "";
  }
}

/* ────────────────────────────────────────────
   Staggered Page Load Wrapper
   ──────────────────────────────────────────── */

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.1,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  show: {
    opacity: 1,
    y: 0,
    transition: {
      type: "spring" as const,
      stiffness: 300,
      damping: 24,
    },
  },
};

/* ────────────────────────────────────────────
   Mobile Bottom Nav
   ──────────────────────────────────────────── */

function MobileBottomNav() {
  const tabs = [
    { label: "Home", icon: HomeIcon, active: true, href: "/dashboard" },
    { label: "Library", icon: LibraryIcon, active: false, href: "/book/library" },
    { label: "Progress", icon: ProgressIcon, active: false, href: "/book/progress" },
    { label: "Profile", icon: ProfileIcon, active: false, href: "/book/profile" },
  ];

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 flex h-14 items-center justify-around md:hidden"
      style={{
        background: "var(--cf-topbar-bg)",
        backdropFilter: "blur(20px) saturate(1.4)",
        WebkitBackdropFilter: "blur(20px) saturate(1.4)",
        borderTop: "1px solid var(--cf-border)",
      }}
    >
      {tabs.map((tab) => (
        <Link
          key={tab.label}
          href={tab.href}
          className="flex min-h-11 min-w-11 flex-col items-center gap-1"
        >
          <tab.icon active={tab.active} />
          <span
            className="text-[10px]"
            style={{
              color: tab.active ? "var(--cf-text-1)" : "var(--cf-text-soft)",
            }}
          >
            {tab.label}
          </span>
        </Link>
      ))}
    </nav>
  );
}

function HomeIcon({ active }: { active: boolean }) {
  return (
    <svg width={20} height={20} viewBox="0 0 24 24" fill="none"
      stroke={active ? "var(--cf-accent)" : "var(--cf-text-soft)"} strokeWidth={2}
      strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
    </svg>
  );
}

function LibraryIcon({ active }: { active: boolean }) {
  return (
    <svg width={20} height={20} viewBox="0 0 24 24" fill="none"
      stroke={active ? "var(--cf-accent)" : "var(--cf-text-soft)"} strokeWidth={2}
      strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 19.5A2.5 2.5 0 016.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" />
    </svg>
  );
}

function ProgressIcon({ active }: { active: boolean }) {
  return (
    <svg width={20} height={20} viewBox="0 0 24 24" fill="none"
      stroke={active ? "var(--cf-accent)" : "var(--cf-text-soft)"} strokeWidth={2}
      strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 20V10M12 20V4M6 20v-6" />
    </svg>
  );
}

function ProfileIcon({ active }: { active: boolean }) {
  return (
    <svg width={20} height={20} viewBox="0 0 24 24" fill="none"
      stroke={active ? "var(--cf-accent)" : "var(--cf-text-soft)"} strokeWidth={2}
      strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
      <circle cx={12} cy={7} r={4} />
    </svg>
  );
}

/* ────────────────────────────────────────────
   Dashboard Content (rendered after data loads)
   ──────────────────────────────────────────── */

function DashboardContent({
  data,
  prefersReducedMotion,
}: {
  data: WorkspaceData;
  prefersReducedMotion: boolean | null;
}) {
  const userState = deriveUserState(data);
  const subtitle = getSubtitle(userState, data);
  const dailyProgress = Math.min(
    (data.user.dailyProgressMinutes / (data.user.dailyGoalMinutes || 20)) * 100,
    100
  );
  const isNewUser = userState === "new_user";
  const hasActivity = data.weeklyActivity.some(Boolean);
  const showDiscovery = !isNewUser;

  const ContentWrapper = prefersReducedMotion ? "div" : motion.div;
  const SectionWrapper = prefersReducedMotion ? "div" : motion.div;

  return (
    <ContentWrapper
      {...(prefersReducedMotion
        ? {}
        : {
            variants: containerVariants,
            initial: "hidden",
            animate: "show",
          })}
    >
      {/* Section 1: Compact Header */}
      <SectionWrapper
        {...(prefersReducedMotion ? {} : { variants: itemVariants })}
      >
        <CompactHeader
          firstName={data.user.firstName}
          streakCount={data.user.streakCount}
          dailyProgress={dailyProgress}
          insightPoints={data.user.insightPoints}
          subtitle={subtitle}
          isNewUser={isNewUser}
        />
      </SectionWrapper>

      {/* Section 2: Hero Session Card */}
      <SectionWrapper
        {...(prefersReducedMotion ? {} : { variants: itemVariants })}
      >
        <HeroSessionCard
          userState={userState}
          currentBook={data.currentBook}
          firstName={data.user.firstName}
          starterShelfBooks={data.starterShelfBooks}
        />
      </SectionWrapper>

      {/* Section 3: Weekly Momentum Strip */}
      {!isNewUser && hasActivity && (
        <SectionWrapper
          {...(prefersReducedMotion ? {} : { variants: itemVariants })}
        >
          <WeeklyMomentumStrip
            weeklyActivity={data.weeklyActivity}
            chaptersCompleted={data.weeklyStats.chaptersCompleted}
            quizAverage={data.weeklyStats.quizAverage}
            streakCount={data.user.streakCount}
          />
        </SectionWrapper>
      )}

      {/* Section 4: Your Books */}
      <SectionWrapper
        {...(prefersReducedMotion ? {} : { variants: itemVariants })}
      >
        <BookRow
          userBooks={data.userBooks}
          recommendedProBooks={data.recommendedProBooks}
          isNewUser={isNewUser}
          isPro={data.user.isPro}
        />
      </SectionWrapper>

      {/* Section 5: Rewards & Progress */}
      <SectionWrapper
        {...(prefersReducedMotion ? {} : { variants: itemVariants })}
      >
        <div className="mt-9 flex flex-col gap-4 md:flex-row">
          <RewardsCard
            insightPoints={data.user.insightPoints}
            nextRewardName={data.nextReward.name}
            pointsRequired={data.nextReward.pointsRequired}
          />
          {data.nextAchievement && (
            <NextAchievementCard
              name={data.nextAchievement.name}
              description={data.nextAchievement.description}
              progressCurrent={data.nextAchievement.progressCurrent}
              progressTotal={data.nextAchievement.progressTotal}
            />
          )}
        </div>
      </SectionWrapper>

      {/* Section 6: Personalized Discovery */}
      {showDiscovery && (
        <SectionWrapper
          {...(prefersReducedMotion ? {} : { variants: itemVariants })}
        >
          <DiscoveryRow
            books={data.discoveryBooks}
            isPro={data.user.isPro}
          />
        </SectionWrapper>
      )}
    </ContentWrapper>
  );
}

/* ────────────────────────────────────────────
   WorkspacePage
   ──────────────────────────────────────────── */

export function WorkspacePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const prefersReducedMotion = useReducedMotion();
  const { analytics } = useBookAnalytics(ALL_BOOK_IDS, 20);
  const { identity } = useBookViewer();
  const firstName = (identity.displayName || "").split(" ")[0] || "Reader";
  const isLoading = !analytics;
  const data = analytics
    ? mapAnalyticsToWorkspaceData(analytics, firstName)
    : null;

  const searchRef = useRef<HTMLInputElement | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [showProBanner, setShowProBanner] = useState(false);

  // Show a success banner when Stripe redirects back after payment, then
  // clean the URL so a refresh doesn't re-show it.
  useEffect(() => {
    if (searchParams.get("billing") === "success") {
      setShowProBanner(true);
      sessionStorage.setItem("cf:billing-upgraded", "1");
      router.replace("/dashboard");
    }
  }, [searchParams, router]);

  return (
    <div
      className={`relative min-h-screen ${jetBrainsMono.variable}`}
      style={{ background: "var(--cf-page-bg)" }}
    >
      {/* Animated background orbs */}
      <AnimatedBackground />

      {/* Noise texture overlay */}
      <div className="noise-overlay pointer-events-none fixed inset-0 z-0" />

      {/* Pro upgrade banner */}
      {showProBanner && (
        <div className="relative z-20 flex items-center justify-between gap-3 bg-linear-to-r from-(--cf-accent) to-(--cf-accent-strong) px-4 py-3 text-white sm:px-6">
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
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full hover:bg-white/20"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Content */}
      <div className="relative z-10">
        <TopNav
          name={firstName}
          avatarUrl={identity.avatarDataUrl}
          activeTab="home"
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          searchInputRef={searchRef}
          logoVariant="dashboard"
        />

        <main
          className="mx-auto w-full px-4 py-5 md:px-8 md:py-7 lg:px-10 xl:px-16"
          style={{ maxWidth: 1800 }}
        >
          {isLoading || !data ? (
            <DashboardSkeleton />
          ) : (
            <DashboardContent data={data} prefersReducedMotion={prefersReducedMotion} />
          )}

          {/* Bottom spacer for mobile nav */}
          <div className="h-20 md:hidden" />
        </main>

        <MobileBottomNav />
      </div>
    </div>
  );
}
