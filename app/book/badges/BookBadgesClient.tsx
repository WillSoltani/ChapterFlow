"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { TopNav } from "@/app/book/home/components/TopNav";
import { useOnboardingState } from "@/app/book/hooks/useOnboardingState";
import { useBadgeSystem } from "@/app/book/hooks/useBadgeSystem";
import { useBookViewer } from "@/app/book/hooks/useBookViewer";
import type { BadgeFilter, BadgeWithProgress, SeasonalChallenge as SeasonalChallengeType } from "./lib/badge-types";
import {
  evaluateBadges,
  computeProfile,
  groupByCategory,
  filterBadges,
  getRecommendations,
  getDefaultOpenCategory,
  getShowcaseBadgeIds,
  toggleShowcaseBadge,
  getEarnedHistory,
  persistEarnedBadge,
  getLastSeenTimestamp,
  setLastSeenTimestamp,
} from "./lib/badge-utils";
import { BadgePageHeader } from "./components/BadgePageHeader";
import { BadgeFilters } from "./components/BadgeFilters";
import { BadgeShowcase } from "./components/BadgeShowcase";
import { BadgeRecommendations } from "./components/BadgeRecommendations";
import { SeasonalChallenge } from "./components/SeasonalChallenge";
import { BadgeGrid } from "./components/BadgeGrid";
import { BadgeDetailModal } from "./components/BadgeDetailModal";
import { BadgeTimeline } from "./components/BadgeTimeline";
import { BadgeCelebration } from "./components/BadgeCelebration";

// Compute the active seasonal challenge (if any)
function getActiveSeasonalChallenge(
  completedChaptersThisMonth: number
): SeasonalChallengeType | null {
  const now = new Date();
  const monthName = now.toLocaleString(undefined, { month: "long" });
  const year = now.getFullYear();
  const startDate = new Date(year, now.getMonth(), 1).toISOString();
  const endDate = new Date(year, now.getMonth() + 1, 0, 23, 59, 59).toISOString();
  const end = new Date(endDate);
  if (now > end) return null;

  return {
    id: `${monthName.toLowerCase()}-${year}`,
    title: `${monthName} ${year} Reading Challenge`,
    description: "Complete 5 chapters this month",
    badgeIcon: "📅",
    startDate,
    endDate,
    criteria: { description: "chapters", target: 5 },
    progress: Math.min(completedChaptersThisMonth, 5),
  };
}

export function BookBadgesClient() {
  const router = useRouter();
  const searchRef = useRef<HTMLInputElement | null>(null);

  const { state: onboarding, hydrated: onboardingHydrated } = useOnboardingState();
  const { identity: viewerIdentity } = useBookViewer();
  const viewerName = viewerIdentity.displayName || "Reader";

  const badgeSystem = useBadgeSystem({
    selectedBookIds: onboarding.selectedBookIds,
    dailyGoalMinutes: onboarding.dailyGoalMinutes,
  });

  // Local state
  const [filter, setFilter] = useState<BadgeFilter>("all");
  const [selectedBadge, setSelectedBadge] = useState<BadgeWithProgress | null>(null);
  const [showcaseIds, setShowcaseIds] = useState<string[]>([]);
  const [earnedHistory, setEarnedHistory] = useState<Record<string, string>>({});
  const [newlyEarned, setNewlyEarned] = useState<BadgeWithProgress[]>([]);
  const celebrationFiredRef = useRef(false);

  // Hydrate localStorage values on mount
  useEffect(() => {
    setShowcaseIds(getShowcaseBadgeIds());
    setEarnedHistory(getEarnedHistory());
  }, []);

  // Redirect if onboarding not complete
  useEffect(() => {
    if (!onboardingHydrated) return;
    if (!onboarding.setupComplete) {
      router.replace("/book");
    }
  }, [onboarding.setupComplete, onboardingHydrated, router]);

  // Evaluate new badge system against existing stats
  const badges = useMemo(() => {
    if (!badgeSystem.badgeStats) return [] as BadgeWithProgress[];
    return evaluateBadges(badgeSystem.badgeStats, earnedHistory);
  }, [badgeSystem.badgeStats, earnedHistory]);

  // Track newly earned badges & persist them — but only celebrate TRULY new ones
  useEffect(() => {
    if (!badges.length || celebrationFiredRef.current) return;

    const newOnes = badges.filter((b) => b.isEarned && !earnedHistory[b.id]);
    if (newOnes.length === 0) {
      // No new badges to persist — still mark celebration as fired
      // and update lastSeen on first load
      if (!celebrationFiredRef.current) {
        celebrationFiredRef.current = true;
        const lastSeen = getLastSeenTimestamp();
        if (!lastSeen) {
          // First ever visit — don't celebrate, just set timestamp
          setLastSeenTimestamp();
        }
      }
      return;
    }

    celebrationFiredRef.current = true;
    const now = Date.now();
    const updatedHistory = { ...earnedHistory };
    newOnes.forEach((b, i) => {
      const earnedAt = new Date(now + i * 1000).toISOString();
      updatedHistory[b.id] = earnedAt;
      persistEarnedBadge(b.id, earnedAt);
    });
    setEarnedHistory(updatedHistory);

    // Only celebrate badges earned SINCE last page visit
    const lastSeen = getLastSeenTimestamp();
    if (!lastSeen) {
      // First ever visit — don't celebrate any, just set timestamp
      setLastSeenTimestamp();
      return;
    }
    const lastSeenTime = new Date(lastSeen).getTime();
    const truelyNew = newOnes.filter((b) => {
      const earnedAt = updatedHistory[b.id];
      return earnedAt && new Date(earnedAt).getTime() > lastSeenTime;
    });
    if (truelyNew.length > 0) {
      setNewlyEarned(truelyNew);
    }
    setLastSeenTimestamp();
  }, [badges, earnedHistory]);

  // Filtered badges
  const filteredBadges = useMemo(() => {
    return filterBadges(badges, filter);
  }, [badges, filter]);

  // Groups for the grid
  const groups = useMemo(() => groupByCategory(filteredBadges), [filteredBadges]);
  const defaultOpenCategory = useMemo(() => getDefaultOpenCategory(groups), [groups]);

  // Profile stats
  const profile = useMemo(
    () => computeProfile(badges, showcaseIds),
    [badges, showcaseIds]
  );

  // Recommendations
  const recommendations = useMemo(() => getRecommendations(badges), [badges]);
  const allEarned = badges.length > 0 && badges.filter((b) => !b.isSecret).every((b) => b.isEarned);

  // Earned badges for timeline
  const earnedBadges = useMemo(() => badges.filter((b) => b.isEarned), [badges]);

  // Seasonal challenge
  const seasonalChallenge = useMemo<SeasonalChallengeType | null>(() => {
    const chaptersThisMonth = badgeSystem.badgeStats?.totalCompletedChapters ?? 0;
    return getActiveSeasonalChallenge(chaptersThisMonth);
  }, [badgeSystem.badgeStats?.totalCompletedChapters]);

  // Handlers
  const handleToggleShowcase = useCallback((badgeId: string) => {
    const next = toggleShowcaseBadge(badgeId);
    setShowcaseIds(next);
  }, []);

  const handleBadgeClick = useCallback((badge: BadgeWithProgress) => {
    setSelectedBadge(badge);
  }, []);

  const handleDismissCelebration = useCallback(() => {
    setNewlyEarned([]);
  }, []);

  // Loading state with skeleton
  if (!onboardingHydrated || !badgeSystem.hydrated || !onboarding.setupComplete) {
    return (
      <main className="cf-app-shell">
        <TopNav
          name={viewerName}
          activeTab="badges"
          searchQuery=""
          onSearchChange={() => {}}
          searchInputRef={searchRef}
          showSearch={false}
          logoVariant="dashboard"
        />
        <section className="mx-auto w-full max-w-450 px-4 pb-28 pt-7 sm:px-6 sm:pt-8 md:pb-24 lg:px-10 xl:px-16">
          <LoadingSkeleton />
        </section>
      </main>
    );
  }

  return (
    <main className="cf-app-shell">
      <TopNav
        name={viewerName}
        activeTab="badges"
        searchQuery=""
        onSearchChange={() => {}}
        searchInputRef={searchRef}
        showSearch={false}
        logoVariant="dashboard"
      />

      <section className="mx-auto w-full max-w-450 px-4 pb-28 pt-7 sm:px-6 sm:pt-8 md:pb-24 lg:px-10 xl:px-16">
        <BadgePageHeader profile={profile} />

        <div className="mt-6">
          <BadgeFilters activeFilter={filter} onChange={setFilter} badges={badges} />
        </div>

        <div className="mt-6">
          <BadgeShowcase
            badges={badges}
            showcaseBadgeIds={showcaseIds}
            onBadgeClick={handleBadgeClick}
            onUnpin={handleToggleShowcase}
          />
        </div>

        <div className="mt-6">
          <BadgeRecommendations
            recommendations={recommendations}
            onBadgeClick={handleBadgeClick}
            allEarned={allEarned}
          />
        </div>

        {seasonalChallenge && (
          <div className="mt-6">
            <SeasonalChallenge challenge={seasonalChallenge} />
          </div>
        )}

        <div className="mt-6">
          <BadgeGrid
            groups={groups}
            defaultOpenCategory={defaultOpenCategory}
            onBadgeClick={handleBadgeClick}
          />
        </div>

        <div className="mt-8">
          <BadgeTimeline earnedBadges={earnedBadges} onBadgeClick={handleBadgeClick} />
        </div>
      </section>

      <BadgeDetailModal
        badge={selectedBadge}
        onClose={() => setSelectedBadge(null)}
        showcaseBadgeIds={showcaseIds}
        onToggleShowcase={handleToggleShowcase}
      />

      <BadgeCelebration
        newlyEarned={newlyEarned}
        onDismiss={handleDismissCelebration}
        onPinToShowcase={handleToggleShowcase}
      />
    </main>
  );
}

// ── Loading skeleton ────────────────────────────────────────────────────────

function SkeletonPulse({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded-xl bg-(--cf-surface-strong) ${className ?? ""}`} />;
}

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      {/* Header skeleton */}
      <div>
        <SkeletonPulse className="h-10 w-48" />
        <SkeletonPulse className="mt-2 h-5 w-80" />
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <SkeletonPulse className="h-20 rounded-2xl" />
          <SkeletonPulse className="h-20 rounded-2xl" />
          <SkeletonPulse className="h-20 rounded-2xl" />
        </div>
      </div>

      {/* Filter skeleton */}
      <div className="flex gap-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <SkeletonPulse key={i} className="h-8 w-20 rounded-full" />
        ))}
      </div>

      {/* Showcase skeleton */}
      <SkeletonPulse className="h-32 rounded-2xl" />

      {/* Recommendations skeleton */}
      <div>
        <SkeletonPulse className="h-5 w-32" />
        <div className="mt-4 flex gap-3">
          <SkeletonPulse className="h-48 w-[260px] shrink-0 rounded-2xl" />
          <SkeletonPulse className="h-48 w-[260px] shrink-0 rounded-2xl" />
          <SkeletonPulse className="h-48 w-[260px] shrink-0 rounded-2xl" />
        </div>
      </div>

      {/* Grid skeleton */}
      <div className="space-y-3">
        <SkeletonPulse className="h-16 rounded-2xl" />
        <SkeletonPulse className="h-16 rounded-2xl" />
      </div>
    </div>
  );
}
