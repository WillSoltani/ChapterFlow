"use client";

import Link from "next/link";
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
import { DashboardNavbar } from "@/components/dashboard/DashboardNavbar";

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
    flowPoints: number;
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
   Mock Data
   ──────────────────────────────────────────── */

const mockData: WorkspaceData = {
  user: {
    firstName: "Will",
    isPro: true,
    streakCount: 12,
    streakActive: true,
    flowPoints: 340,
    dailyGoalMinutes: 20,
    dailyProgressMinutes: 8,
  },
  currentBook: {
    id: "atomic-habits",
    title: "Atomic Habits",
    author: "James Clear",
    coverUrl: "",
    currentChapter: 5,
    totalChapters: 20,
    progressPercent: 25,
    currentLoopStep: "scenarios",
    estimatedMinutes: 13,
    glowColor: "rgba(217,119,6,0.35)",
  },
  weeklyActivity: [true, true, true, false, false, false, false],
  weeklyStats: {
    chaptersCompleted: 3,
    quizAverage: 87,
  },
  userBooks: [
    {
      id: "atomic-habits",
      title: "Atomic Habits",
      author: "James Clear",
      coverUrl: "",
      progressPercent: 25,
      status: "in_progress",
    },
    {
      id: "never-split-the-difference",
      title: "Never Split the Difference",
      author: "Chris Voss",
      coverUrl: "",
      progressPercent: 10,
      status: "in_progress",
    },
    {
      id: "the-prince",
      title: "The Prince",
      author: "Niccolò Machiavelli",
      coverUrl: "",
      progressPercent: 0,
      status: "not_started",
    },
    {
      id: "deep-work",
      title: "Deep Work",
      author: "Cal Newport",
      coverUrl: "",
      progressPercent: 0,
      status: "not_started",
    },
    {
      id: "the-psychology-of-money",
      title: "The Psychology of Money",
      author: "Morgan Housel",
      coverUrl: "",
      progressPercent: 0,
      status: "not_started",
    },
  ],
  recommendedProBooks: [],
  discoveryBooks: [
    {
      id: "thinking-fast-and-slow",
      title: "Thinking, Fast and Slow",
      author: "Daniel Kahneman",
      coverUrl: "",
      rating: 4.7,
      readerCount: 4200,
      category: "Psychology",
    },
    {
      id: "the-48-laws-of-power",
      title: "The 48 Laws of Power",
      author: "Robert Greene",
      coverUrl: "",
      rating: 4.6,
      readerCount: 5100,
      category: "Strategy",
    },
    {
      id: "start-with-why",
      title: "Start with Why",
      author: "Simon Sinek",
      coverUrl: "",
      rating: 4.5,
      readerCount: 2800,
      category: "Leadership",
    },
    {
      id: "mans-search-for-meaning",
      title: "Man's Search for Meaning",
      author: "Viktor Frankl",
      coverUrl: "",
      rating: 4.9,
      readerCount: 6400,
      category: "Philosophy",
    },
  ],
  nextReward: {
    name: "Bonus Book Unlock",
    pointsRequired: 900,
    currentPoints: 340,
  },
  nextAchievement: {
    name: "Path Builder",
    description: "Build a five book reading list",
    iconUrl: "",
    progressCurrent: 3,
    progressTotal: 5,
  },
};

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
        background: "rgba(10,10,18,0.92)",
        backdropFilter: "blur(14px)",
        WebkitBackdropFilter: "blur(14px)",
        borderTop: "1px solid rgba(255,255,255,0.08)",
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
              color: tab.active ? "#F0F0F0" : "#6B6B80",
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
      stroke={active ? "#7C3AED" : "#6B6B80"} strokeWidth={2}
      strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
    </svg>
  );
}

function LibraryIcon({ active }: { active: boolean }) {
  return (
    <svg width={20} height={20} viewBox="0 0 24 24" fill="none"
      stroke={active ? "#7C3AED" : "#6B6B80"} strokeWidth={2}
      strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 19.5A2.5 2.5 0 016.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" />
    </svg>
  );
}

function ProgressIcon({ active }: { active: boolean }) {
  return (
    <svg width={20} height={20} viewBox="0 0 24 24" fill="none"
      stroke={active ? "#7C3AED" : "#6B6B80"} strokeWidth={2}
      strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 20V10M12 20V4M6 20v-6" />
    </svg>
  );
}

function ProfileIcon({ active }: { active: boolean }) {
  return (
    <svg width={20} height={20} viewBox="0 0 24 24" fill="none"
      stroke={active ? "#7C3AED" : "#6B6B80"} strokeWidth={2}
      strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
      <circle cx={12} cy={7} r={4} />
    </svg>
  );
}

/* ────────────────────────────────────────────
   WorkspacePage
   ──────────────────────────────────────────── */

export function WorkspacePage() {
  const prefersReducedMotion = useReducedMotion();
  const data = mockData;
  const userState = deriveUserState(data);
  const subtitle = getSubtitle(userState, data);
  const dailyProgress = Math.min(
    (data.user.dailyProgressMinutes / data.user.dailyGoalMinutes) * 100,
    100
  );
  const isNewUser = userState === "new_user";
  const hasActivity = data.weeklyActivity.some(Boolean);
  const showDiscovery = data.weeklyStats.chaptersCompleted > 0;

  const ContentWrapper = prefersReducedMotion ? "div" : motion.div;
  const SectionWrapper = prefersReducedMotion ? "div" : motion.div;

  return (
    <div
      className={`relative min-h-screen ${jetBrainsMono.variable}`}
      style={{ background: "#0a0a12" }}
    >
      {/* Animated background orbs */}
      <AnimatedBackground />

      {/* Noise texture overlay */}
      <div className="noise-overlay pointer-events-none fixed inset-0 z-0" />

      {/* Content */}
      <div className="relative z-10">
        <DashboardNavbar />

        <main
          className="mx-auto w-full px-4 py-5 md:px-8 md:py-7"
          style={{ maxWidth: 1200 }}
        >
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
                flowPoints={data.user.flowPoints}
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
                  flowPoints={data.user.flowPoints}
                  nextRewardName={data.nextReward.name}
                  pointsRequired={data.nextReward.pointsRequired}
                  isPro={data.user.isPro}
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

          {/* Bottom spacer for mobile nav */}
          <div className="h-20 md:hidden" />
        </main>

        <MobileBottomNav />
      </div>
    </div>
  );
}
