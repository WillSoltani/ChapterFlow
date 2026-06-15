"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { CheckCircle, CheckCircle2, Clock, SkipForward, X } from "lucide-react";
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
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { TopNav } from "@/app/book/home/components/TopNav";
import { PartnerProgressCard } from "@/app/book/home/components/PartnerProgressCard";
import { fetchBookJson, BookClientError } from "@/app/book/_lib/book-api";
import type { BookUserCommitmentItem } from "@/app/app/api/book/_lib/types";
import { useBookAnalytics, type AnalyticsState } from "@/app/book/hooks/useBookAnalytics";
import { useBookViewer } from "@/app/book/hooks/useBookViewer";
import { BOOKS_CATALOG, getBookMetadata } from "@/app/book/data/booksCatalog";
import { getBookRating } from "@/app/book/data/bookRatings";
import { getBookCoverPath } from "@/lib/book-covers";
import { ErrorBanner } from "@/app/book/components/ui/ErrorBanner";
import { evaluateBadges } from "@/app/book/badges/lib/badge-ui-definitions";
import { INSIGHT_POINTS_REWARDS } from "@/app/book/_lib/flow-points-economy";
import { CATALOG_BOOK_COUNT_DISPLAY } from "@/lib/catalog-stats";

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
    reason?: string;
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
    reason?: string;
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

const ALL_BOOK_IDS = BOOKS_CATALOG.map((cat) => cat.id);

/** Title-case category / interest -> onboarding-style slug ("Decision Making" -> "decision-making", "Health & Wellness" -> "health-wellness"). */
function toSlug(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** "behavior-change" -> "Behavior Change" for the "Based on …" recommendation reason. */
function titleizeSlug(slug: string): string {
  return slug
    .split("-")
    .map((word) => (word ? word[0].toUpperCase() + word.slice(1) : word))
    .join(" ");
}

type RecCandidate = AnalyticsState["bookSnapshots"][number];

/**
 * Rank not-started books by how well they match the reader's tastes:
 * onboarding interests + the categories of books they've read/are reading.
 * Categories are the strong signal; book tags are a softer signal (they let
 * interests like "habits"/"self-awareness"/"technology" — which aren't catalog
 * categories — still personalize). Ties (and cold-start users with no signal)
 * fall back to real popularity (ratings count) so a row is never empty.
 */
function rankRecommendations(
  snapshots: RecCandidate[],
  preferredSlugs: Set<string>,
  savedIds: Set<string>,
): Array<{ snap: RecCandidate; reason: string | null }> {
  const notStarted = snapshots.filter((s) => s.status === "not_started");

  const scored = notStarted.map((snap) => {
    const cats = [snap.book.category, ...(snap.book.categories ?? [])].filter(
      (c): c is string => typeof c === "string" && c.length > 0,
    );
    const tags = getBookMetadata(snap.book.id)?.tags ?? [];
    let score = 0;
    let reason: string | null = null;
    // A book the user saved but hasn't started is the strongest signal — they
    // explicitly chose to read it next. Surface those first.
    if (savedIds.has(snap.book.id)) {
      score += 5;
      reason = "your saved list";
    }
    for (const cat of cats) {
      if (preferredSlugs.has(toSlug(cat))) {
        score += 3;
        if (!reason) reason = cat;
      }
    }
    for (const tag of tags) {
      if (preferredSlugs.has(toSlug(tag))) {
        score += 1;
        if (!reason) reason = titleizeSlug(toSlug(tag));
      }
    }
    const ratingsCount = getBookRating(snap.book.id)?.ratingsCount ?? 0;
    return { snap, reason, score, ratingsCount };
  });

  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return b.ratingsCount - a.ratingsCount;
  });

  return scored.map(({ snap, reason }) => ({ snap, reason }));
}

function toRecommendationCard(
  snap: RecCandidate,
  reason: string | null,
): WorkspaceData["recommendedProBooks"][number] {
  const rating = getBookRating(snap.book.id);
  return {
    id: snap.book.id,
    title: snap.book.title,
    author: snap.book.author ?? "",
    coverUrl: getBookCoverPath(snap.book.id),
    rating: rating?.rating ?? 0,
    readerCount: rating?.ratingsCount ?? 0,
    category: snap.book.category ?? "General",
    reason: reason ?? undefined,
  };
}

function mapAnalyticsToWorkspaceData(
  analytics: AnalyticsState,
  firstName: string,
): WorkspaceData {
  const savedIds = new Set(analytics.savedBookIds);
  // Build the reader's taste profile from onboarding interests + the categories
  // of books they've completed, are reading, OR have saved (read-next intent).
  const preferredSlugs = new Set<string>();
  for (const interest of analytics.interests) preferredSlugs.add(toSlug(interest));
  for (const snap of analytics.bookSnapshots) {
    const isPreference =
      snap.status === "in_progress" ||
      snap.status === "completed" ||
      savedIds.has(snap.book.id);
    if (isPreference) {
      for (const cat of [snap.book.category, ...(snap.book.categories ?? [])]) {
        if (typeof cat === "string" && cat.length > 0) preferredSlugs.add(toSlug(cat));
      }
    }
  }
  const rankedRecommendations = rankRecommendations(
    analytics.bookSnapshots,
    preferredSlugs,
    savedIds,
  );
  const lead = analytics.inProgressBookSnapshots[0] ?? null;

  let currentBook: WorkspaceData["currentBook"] = null;
  if (lead) {
    const nextChapter = lead.completedChapters + 1;
    // estimatedMinutes comes from the server catalog entry (lead.book), not the
    // local static catalog.
    const estimatedMinutes = lead.book.estimatedMinutes;
    const avgChapterMinutes = estimatedMinutes
      ? Math.max(1, Math.round(estimatedMinutes / Math.max(lead.totalChapters, 1)))
      : 13;

    currentBook = {
      id: lead.book.id,
      title: lead.book.title,
      author: lead.book.author ?? "",
      coverUrl: getBookCoverPath(lead.book.id),
      currentChapter: Math.min(nextChapter, lead.totalChapters),
      totalChapters: lead.totalChapters,
      progressPercent: lead.progressPercent,
      currentLoopStep: lead.currentLoopStep ?? "summary",
      estimatedMinutes: avgChapterMinutes,
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

  const recommendedProBooks = analytics.isPro
    ? []
    : rankedRecommendations
        .slice(0, 3)
        .map(({ snap, reason }) => toRecommendationCard(snap, reason));
  const recommendedProBookIds = new Set(recommendedProBooks.map((b) => b.id));

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
    recommendedProBooks,
    discoveryBooks: rankedRecommendations
      .filter(({ snap }) => !recommendedProBookIds.has(snap.book.id))
      .slice(0, 4)
      .map(({ snap, reason }) => toRecommendationCard(snap, reason)),
    nextReward: {
      name: INSIGHT_POINTS_REWARDS[0]?.name ?? "Bonus Book Unlock",
      pointsRequired: INSIGHT_POINTS_REWARDS[0]?.costPoints ?? 900,
      currentPoints: analytics.insightPoints,
    },
    nextAchievement: deriveNextAchievement(analytics),
  };
}

function deriveNextAchievement(
  analytics: AnalyticsState
): WorkspaceData["nextAchievement"] {
  // Evaluate against the full server-derived badge stats (device-independent),
  // not a partial object with most fields zeroed out.
  const earnedHistory = Object.fromEntries(
    Array.from(analytics.earnedBadgeIds).map((id) => [id, new Date().toISOString()])
  );
  const badges = evaluateBadges(analytics.badgeStats, earnedHistory);

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
      return `Go Pro to unlock all ${CATALOG_BOOK_COUNT_DISPLAY} books`;
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
   Commitment Follow-Up (re-introduces the proactive
   "how did your if-then plan go?" prompt on the live
   dashboard). Commitments have no standalone page —
   the API lives at /me/commitments — so this is the
   only place a reader is reminded to follow through.
   Self-contained (fetches its own data) and renders
   nothing until there's an active commitment that has
   reached its follow-up date, so it never adds noise.
   ──────────────────────────────────────────── */

function CommitmentFollowUpSection() {
  // Holds only the follow-up reminders that are actually DUE — active commitments
  // whose follow-up date has passed. The server is the source of truth for
  // status; the date gate ("is it time yet?") is applied once at fetch time
  // (inside the effect, where reading the clock is allowed) rather than during
  // render, so this list never reshuffles on an unrelated re-render.
  const [due, setDue] = useState<BookUserCommitmentItem[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [reflections, setReflections] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [skippingId, setSkippingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchBookJson<{ commitments: BookUserCommitmentItem[] }>(
      "/app/api/book/me/commitments?status=active",
    )
      .then((data) => {
        if (cancelled) return;
        const now = Date.now();
        setDue(
          (data.commitments ?? []).filter(
            (c) => c.status === "active" && Date.parse(c.followUpDate) <= now,
          ),
        );
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const activeReflection = activeId ? (reflections[activeId] ?? "") : "";

  const removeCommitment = useCallback((commitmentId: string) => {
    setDue((prev) => prev.filter((c) => c.commitmentId !== commitmentId));
  }, []);

  const handleComplete = useCallback(async () => {
    if (!activeId || activeReflection.trim().length < 10 || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      await fetchBookJson(`/app/api/book/me/commitments/${activeId}`, {
        method: "PATCH",
        body: JSON.stringify({
          action: "complete",
          followThroughReflection: activeReflection.trim(),
        }),
      });
      setReflections((prev) => {
        const next = { ...prev };
        delete next[activeId];
        return next;
      });
      removeCommitment(activeId);
      setActiveId(null);
    } catch (e) {
      const message =
        e instanceof BookClientError && e.status === 409
          ? "This commitment was already updated."
          : "Failed to submit reflection. Please try again.";
      setError(message);
    }
    setSubmitting(false);
  }, [activeId, activeReflection, submitting, removeCommitment]);

  const handleSkip = useCallback(
    async (id: string) => {
      if (skippingId) return;
      setSkippingId(id);
      setError(null);
      try {
        await fetchBookJson(`/app/api/book/me/commitments/${id}`, {
          method: "PATCH",
          body: JSON.stringify({ action: "skip" }),
        });
        removeCommitment(id);
        if (activeId === id) setActiveId(null);
      } catch (e) {
        const message =
          e instanceof BookClientError && e.status === 409
            ? "This commitment was already updated."
            : "Failed to skip. Please try again.";
        setError(message);
      }
      setSkippingId(null);
    },
    [skippingId, activeId, removeCommitment],
  );

  if (due.length === 0) return null;

  return (
    <section className="cf-panel rounded-[26px] border border-(--cf-warning-border) bg-(--cf-surface) p-5 sm:p-6">
      <div className="mb-3 flex items-center gap-2">
        <Clock className="h-4 w-4 text-(--cf-warning-text)" />
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-(--cf-warning-text)">
          Time to Check In
        </p>
      </div>

      {error && <p className="mb-2 text-xs text-(--cf-error)">{error}</p>}

      <div className="space-y-3">
        {due.map((c) => (
          <div
            key={c.commitmentId}
            className="rounded-xl border border-(--cf-border) bg-(--cf-surface-muted) p-4"
          >
            <p className="text-sm font-medium leading-relaxed text-(--cf-text-1)">
              {c.ifThenPlan}
            </p>
            <p className="mt-1 text-xs text-(--cf-text-3)">
              Committed {new Date(c.commitDate).toLocaleDateString()}
            </p>

            {activeId === c.commitmentId ? (
              <div className="mt-3">
                <textarea
                  value={reflections[c.commitmentId] ?? ""}
                  onChange={(e) =>
                    setReflections((prev) => ({
                      ...prev,
                      [c.commitmentId]: e.target.value,
                    }))
                  }
                  placeholder="How did it go? What happened when you tried it?"
                  rows={3}
                  className="w-full rounded-lg border border-(--cf-border) bg-(--cf-surface) px-3 py-2 text-sm text-(--cf-text-1) placeholder:text-(--cf-text-3) focus:border-(--cf-accent) focus:outline-none"
                />
                <div className="mt-2 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleComplete}
                    disabled={activeReflection.trim().length < 10 || submitting}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-(--cf-accent) px-3 py-1.5 text-xs font-semibold text-white transition hover:brightness-110 disabled:opacity-50"
                  >
                    <CheckCircle className="h-3.5 w-3.5" />
                    {submitting ? "Saving..." : "Submit (+25 IP)"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveId(null)}
                    className="text-xs text-(--cf-text-3) hover:text-(--cf-text-2)"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="mt-3 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setActiveId(c.commitmentId)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-(--cf-accent-border) bg-(--cf-accent-soft) px-3 py-1.5 text-xs font-semibold text-(--cf-info-text) transition hover:bg-(--cf-accent-muted)"
                >
                  How did it go?
                </button>
                <button
                  type="button"
                  onClick={() => handleSkip(c.commitmentId)}
                  disabled={skippingId === c.commitmentId}
                  className="inline-flex items-center gap-1 text-xs text-(--cf-text-3) hover:text-(--cf-text-2) disabled:opacity-50"
                >
                  <SkipForward className="h-3 w-3" />
                  {skippingId === c.commitmentId ? "Skipping..." : "Skip"}
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
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

      {/* Section 1b: Commitment Follow-Up — proactively reminds the reader to
          report back on an if-then plan whose follow-up date has arrived. Renders
          nothing when nothing is due, and is hidden for brand-new users so a
          first-time dashboard stays clean. Commitments have no standalone page,
          so this is the only surface that prompts follow-through. */}
      {!isNewUser && (
        <SectionWrapper
          {...(prefersReducedMotion ? {} : { variants: itemVariants })}
        >
          <div className="mt-9">
            <CommitmentFollowUpSection />
          </div>
        </SectionWrapper>
      )}

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

      {/* Section 5b: Reading Partner (accountability) — only once the reader is
          past brand-new, so a first-time empty dashboard isn't cluttered. */}
      {!isNewUser && (
        <SectionWrapper
          {...(prefersReducedMotion ? {} : { variants: itemVariants })}
        >
          <div className="mt-9">
            <PartnerProgressCard enabled />
          </div>
        </SectionWrapper>
      )}

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
  const { analytics, error, refetch } = useBookAnalytics(ALL_BOOK_IDS, 20);
  const { identity } = useBookViewer();
  const firstName = (identity.displayName || "").split(" ")[0] || "Reader";
  const isLoading = !analytics && !error;
  // Memoize so the heavy mapper (ranking + badge evaluation over the whole
  // catalog) doesn't re-run on every render — notably on each search keystroke.
  const data = useMemo(
    () => (analytics ? mapAnalyticsToWorkspaceData(analytics, firstName) : null),
    [analytics, firstName],
  );

  const searchRef = useRef<HTMLInputElement | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [showProBanner, setShowProBanner] = useState(
    () => searchParams.get("billing") === "success",
  );

  // Single owner of the post-Stripe ?billing redirect (BillingStatusBanner used
  // to double up here). On success we flag the upgrade and show the in-page Pro
  // banner; for any billing value we strip just that param (preserving others)
  // so a refresh doesn't re-trigger.
  useEffect(() => {
    const billing = searchParams.get("billing");
    if (!billing) return;
    if (billing === "success") {
      sessionStorage.setItem("cf:billing-upgraded", "1");
    }
    const url = new URL(window.location.href);
    url.searchParams.delete("billing");
    router.replace(url.pathname + url.search);
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

      {/* Pro upgrade success banner (the single billing-success surface) */}
      {showProBanner && (
        <div
          role="status"
          className="relative z-20 flex items-center justify-between gap-3 border-b border-(--cf-success-border) bg-(--cf-success-bg) px-4 py-3 text-(--cf-success-text) sm:px-6"
        >
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <p className="text-sm font-medium">
              You&apos;re now on Pro — enjoy unlimited access to the full library.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowProBanner(false)}
            aria-label="Dismiss"
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full transition hover:bg-(--cf-success-soft)"
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
          {error && !data ? (
            <ErrorBanner
              title="We couldn’t load your dashboard"
              message={error}
              onRetry={refetch}
            />
          ) : isLoading || !data ? (
            <DashboardSkeleton />
          ) : (
            <DashboardContent
              data={data}
              prefersReducedMotion={prefersReducedMotion}
            />
          )}

          {/* Spacer so content clears TopNav's fixed mobile bottom bar (~4.5rem + safe-area) */}
          <div
            aria-hidden="true"
            className="md:hidden"
            style={{ height: "calc(4.5rem + env(safe-area-inset-bottom, 0px))" }}
          />
        </main>
      </div>
    </div>
  );
}
