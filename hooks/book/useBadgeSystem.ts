"use client";

// Canonical shared badge-system hook (WS3-001).

import { useEffect, useMemo, useState } from "react";
import { fetchBookJson } from "@/lib/client/book-api";
import { useBookQuery, invalidateBookCache } from "@/lib/client/book-api-cache";
import {
  BADGE_DEFINITIONS,
  evaluateBadges,
  type BadgeCategory,
  type BadgeProgressStats,
  type BadgeState,
} from "@/lib/badges/badge-ui-definitions";
import { useBookAnalytics } from "@/hooks/book/useBookAnalytics";
import { buildSpecialBadges, type SpecialBadge } from "@/app/book/badges/lib/special-badges";

const BADGES_KEY = "/app/api/book/me/badges";

type PlanState = "FREE" | "PRO";

export type NextMilestone = {
  badge: BadgeState;
  progressPercent: number;
  remaining: number;
  nextStepLabel: string;
  nextTier: BadgeState | null;
};

type BadgeTimelineEntry = {
  id: string;
  badgeId: string;
  icon: string;
  name: string;
  category: BadgeCategory;
  description: string;
  earnedAt: string;
  dateLabel: string;
  notificationStyle: BadgeState["notificationStyle"];
};

type BadgeGroup = {
  category: BadgeCategory;
  title: string;
  description: string;
  badges: BadgeState[];
};

type UseBadgeSystemArgs = {
  selectedBookIds: string[];
  dailyGoalMinutes: number;
  /** Kept for callers; badge progress now comes only from the account's stats. */
  plan?: PlanState;
};

type UseBadgeSystemResult = {
  hydrated: boolean;
  analytics: ReturnType<typeof useBookAnalytics>["analytics"];
  error: ReturnType<typeof useBookAnalytics>["error"];
  refetch: ReturnType<typeof useBookAnalytics>["refetch"];
  badgeStats: BadgeProgressStats | null;
  badges: BadgeState[];
  visibleBadges: BadgeState[];
  earnedBadges: BadgeState[];
  lockedBadges: BadgeState[];
  featuredBadges: BadgeState[];
  recentlyEarned: BadgeState[];
  highestPrestigeBadges: BadgeState[];
  nextMilestones: NextMilestone[];
  badgeTimeline: BadgeTimelineEntry[];
  categoryGroups: BadgeGroup[];
  earnedCount: number;
  visibleCount: number;
  /** Journey and event badges from /me/badges (PROG-11). */
  specialBadges: SpecialBadge[];
};

const BADGE_EARNED_KEY = "book-accelerator:badge-earned:v1";

const CATEGORY_DESCRIPTIONS: Record<BadgeCategory, string> = {
  "Getting Started": "Early wins that turn setup into real reading momentum.",
  Consistency: "Meaningful cadence markers that reinforce return behavior without constant interruption.",
  "Reading Depth": "Badges for moving beyond quick skims into stronger engagement and retention.",
  Mastery: "Performance and review milestones that reflect understanding rather than surface completion.",
  Books: "Major completion markers that represent sustained progress through substantial material.",
  Examples: "Application focused milestones tied to personal, school, and work context usage.",
  Notes: "Quiet reflection markers that reward writing, synthesis, and knowledge capture.",
  Exploration: "Broader library and category discovery that expands the range of your reading practice.",
  Elite: "Subtle premium markers that reward advanced usage without punishing free readers.",
};

const CATEGORY_ORDER: BadgeCategory[] = [
  "Getting Started",
  "Consistency",
  "Reading Depth",
  "Mastery",
  "Books",
  "Examples",
  "Notes",
  "Exploration",
  "Elite",
];

const NEXT_TIER_MAP: Record<string, string> = {
  "streak-3": "streak-7",
  "streak-7": "streak-14",
  "streak-14": "streak-30",
  "goal-5": "goal-10",
  "perfect-one": "perfect-three",
  "quiz-pass-10": "quiz-pass-25",
  "first-chapter": "ten-chapters",
  "ten-chapters": "first-book",
  "first-book": "three-books",
  "three-books": "five-books",
  "focus-finish": "deep-focus-five",
};

function formatEarnedDate(value: string): string {
  return new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function sortBadges(badges: BadgeState[]): BadgeState[] {
  return [...badges].sort((left, right) => {
    if (left.earned !== right.earned) return left.earned ? -1 : 1;
    if (left.prestige !== right.prestige) return right.prestige - left.prestige;
    if (left.progressValue !== right.progressValue) return right.progressValue - left.progressValue;
    return left.name.localeCompare(right.name);
  });
}

function uniqueBadges(badges: BadgeState[]): BadgeState[] {
  const seen = new Set<string>();
  return badges.filter((badge) => {
    if (seen.has(badge.id)) return false;
    seen.add(badge.id);
    return true;
  });
}

/** Badge states from the account's stats; a badge in `earnedHistory` (from
 *  /me/badges) stays earned with its server date even if stats are lower. */
export function evaluateBadgeStates(
  stats: BadgeProgressStats,
  earnedHistory: Record<string, string>
): BadgeState[] {
  return sortBadges(
    evaluateBadges(stats, earnedHistory).map((badge) => ({
      ...badge,
      nextTierId: NEXT_TIER_MAP[badge.id],
    }))
  );
}

const JUST_EARNED_WINDOW_MS = 48 * 60 * 60 * 1000;

/** PROG-18: a badge is "just earned" for 48 hours after its earn date. */
export function isJustEarned(earnedAt: string | null | undefined, now: number = Date.now()): boolean {
  if (!earnedAt) return false;
  const t = new Date(earnedAt).getTime();
  return Number.isFinite(t) && now - t >= 0 && now - t <= JUST_EARNED_WINDOW_MS;
}

/** The closest unearned badges (at most four), one rule for every page. */
export function selectNextMilestones(badges: BadgeState[]): NextMilestone[] {
  return badges
    .filter((badge) => !badge.earned && badge.isVisible)
    .map((badge) => {
      const progressPercent =
        badge.targetValue > 0
          ? Math.max(0, Math.min(100, Math.round((badge.progressValue / badge.targetValue) * 100)))
          : 0;
      const nextTier = badges.find((entry) => entry.id === NEXT_TIER_MAP[badge.id]) ?? null;
      return {
        badge,
        progressPercent,
        remaining: Math.max(badge.targetValue - badge.progressValue, 0),
        nextStepLabel: `${Math.max(badge.targetValue - badge.progressValue, 0)} to go`,
        nextTier,
      };
    })
    .sort((left, right) => {
      if (left.progressPercent !== right.progressPercent) return right.progressPercent - left.progressPercent;
      if (left.remaining !== right.remaining) return left.remaining - right.remaining;
      if (left.badge.prestige !== right.badge.prestige) return right.badge.prestige - left.badge.prestige;
      return left.badge.id.localeCompare(right.badge.id);
    })
    .slice(0, 4);
}

export function useBadgeSystem({
  selectedBookIds,
  dailyGoalMinutes,
}: UseBadgeSystemArgs): UseBadgeSystemResult {
  const { analytics, hydrated, error, refetch } = useBookAnalytics(selectedBookIds, dailyGoalMinutes);
  const [earnedHistory, setEarnedHistory] = useState<Record<string, string>>({});

  // No hand-rolled focus/storage listener here: `badgeStats` is derived from
  // `analytics`, which the shared cache revalidates on focus/storage/book-storage
  // (via useBookAnalytics -> useDashboardQuery), so a refresh recomputes badges
  // automatically. See WS3-022/WS3-023.

  const badgesQuery = useBookQuery<{ awards: Array<{ badgeId: string; earnedAt: string }> }>(
    BADGES_KEY
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    const localFallback = (() => {
      try {
        const raw = window.localStorage.getItem(BADGE_EARNED_KEY);
        return raw ? (JSON.parse(raw) as Record<string, string>) : {};
      } catch {
        return {};
      }
    })();

    setEarnedHistory(localFallback);
  }, []);

  useEffect(() => {
    if (!badgesQuery.data) return;
    const next = Object.fromEntries(
      badgesQuery.data.awards.map((award) => [award.badgeId, award.earnedAt])
    );
    window.localStorage.setItem(BADGE_EARNED_KEY, JSON.stringify(next));
    setEarnedHistory(next);
  }, [badgesQuery.data]);

  // PROG-21: progress comes only from the account's stats (the dashboard
  // payload), so it is the same on every device. Earned badges keep their
  // /me/badges date and never un-earn (evaluateBadges: earned = achieved || earnedAt).
  const badgeStats = useMemo(() => {
    if (!hydrated || !analytics) return null;
    return analytics.badgeStats;
  }, [analytics, hydrated]);

  const badges = useMemo(() => {
    if (!badgeStats) return [] as BadgeState[];
    return evaluateBadgeStates(badgeStats, earnedHistory);
  }, [badgeStats, earnedHistory]);

  useEffect(() => {
    if (!badges.length || typeof window === "undefined") return;
    const now = Date.now();
    const newEntries = badges.filter((badge) => badge.earned && !earnedHistory[badge.id]);
    if (!newEntries.length) return;

    const next = { ...earnedHistory };
    newEntries.forEach((badge, index) => {
      next[badge.id] = new Date(now + index * 1000).toISOString();
    });
    setEarnedHistory(next);
    window.localStorage.setItem(BADGE_EARNED_KEY, JSON.stringify(next));
    newEntries.forEach((badge) => {
      fetchBookJson(BADGES_KEY, {
        method: "PUT",
        body: JSON.stringify({
          badgeId: badge.id,
          earnedAt: next[badge.id],
          tier: badge.tier,
        }),
      }).catch(() => {});
    });
    // New awards were written — drop the cached /me/badges read so a later mount
    // reflects them.
    invalidateBookCache(BADGES_KEY);
  }, [badges, earnedHistory]);

  const specialBadges = useMemo(
    () => buildSpecialBadges(badgesQuery.data?.awards ?? []),
    [badgesQuery.data]
  );

  const visibleBadges = useMemo(() => badges.filter((badge) => badge.isVisible), [badges]);
  const earnedBadges = useMemo(
    () =>
      visibleBadges
        .filter((badge) => badge.earned)
        .sort((left, right) => {
          const leftTime = left.earnedAt ? new Date(left.earnedAt).getTime() : 0;
          const rightTime = right.earnedAt ? new Date(right.earnedAt).getTime() : 0;
          if (leftTime !== rightTime) return rightTime - leftTime;
          return right.prestige - left.prestige;
        }),
    [visibleBadges]
  );
  const lockedBadges = useMemo(() => visibleBadges.filter((badge) => !badge.earned), [visibleBadges]);

  const recentlyEarned = useMemo(() => earnedBadges.slice(0, 6), [earnedBadges]);
  const highestPrestigeBadges = useMemo(
    () =>
      [...earnedBadges]
        .sort((left, right) => {
          if (left.prestige !== right.prestige) return right.prestige - left.prestige;
          return left.name.localeCompare(right.name);
        })
        .slice(0, 6),
    [earnedBadges]
  );

  const featuredBadges = useMemo(
    () => uniqueBadges([...recentlyEarned.slice(0, 3), ...highestPrestigeBadges.slice(0, 3)]).slice(0, 6),
    [highestPrestigeBadges, recentlyEarned]
  );

  const nextMilestones = useMemo(() => selectNextMilestones(visibleBadges), [visibleBadges]);

  const badgeTimeline = useMemo<BadgeTimelineEntry[]>(
    () =>
      earnedBadges
        .filter((badge): badge is BadgeState & { earnedAt: string } => Boolean(badge.earnedAt))
        .slice(0, 10)
        .map((badge) => ({
          id: `timeline-${badge.id}`,
          badgeId: badge.id,
          icon: badge.icon,
          name: badge.name,
          category: badge.category,
          description: badge.description,
          earnedAt: badge.earnedAt,
          dateLabel: formatEarnedDate(badge.earnedAt),
          notificationStyle: badge.notificationStyle,
        })),
    [earnedBadges]
  );

  const categoryGroups = useMemo<BadgeGroup[]>(
    () =>
      CATEGORY_ORDER.map((category) => ({
        category,
        title: category,
        description: CATEGORY_DESCRIPTIONS[category],
        badges: visibleBadges.filter((badge) => badge.category === category),
      })).filter((group) => group.badges.length > 0),
    [visibleBadges]
  );

  return {
    hydrated,
    analytics,
    error,
    refetch,
    badgeStats,
    badges,
    visibleBadges,
    earnedBadges,
    lockedBadges,
    featuredBadges,
    recentlyEarned,
    highestPrestigeBadges,
    nextMilestones,
    badgeTimeline,
    categoryGroups,
    earnedCount: earnedBadges.length,
    visibleCount: visibleBadges.length,
    specialBadges,
  };
}

export const BADGE_CATEGORY_COPY = CATEGORY_DESCRIPTIONS;
export const BADGE_CATEGORY_ORDER = CATEGORY_ORDER;
export const BADGE_TIER_SUCCESSION = NEXT_TIER_MAP;
export const BADGE_ALL_IDS = BADGE_DEFINITIONS.map((badge) => badge.id);
