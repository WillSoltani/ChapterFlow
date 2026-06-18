"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";
import { TopNav } from "@/app/book/home/components/TopNav";
import { ErrorBanner } from "@/app/book/components/ui/ErrorBanner";
import { useOnboardingState } from "@/app/book/hooks/useOnboardingState";
import { useBadgeSystem } from "@/app/book/hooks/useBadgeSystem";
import { useBookViewer } from "@/app/book/hooks/useBookViewer";
import { fetchBookJson } from "@/app/book/_lib/book-api";
import type { EventDefinition, EventParticipationItem } from "@/app/app/api/book/_lib/types";
import type { BadgeFilter, BadgeWithProgress, SeasonalChallenge as SeasonalChallengeType } from "./lib/badge-types";
import {
  badgeStateToBadgeWithProgress,
  computeProfile,
  groupByCategory,
  filterBadges,
  getRecommendations,
  getDefaultOpenCategory,
  getShowcaseBadgeIds,
  toggleShowcaseBadge,
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

type ActiveEventWithParticipation = EventDefinition & {
  participation?: EventParticipationItem;
};

function eventToSeasonalChallenge(
  event: ActiveEventWithParticipation,
): SeasonalChallengeType {
  return {
    id: event.eventId,
    title: event.title,
    description: event.description,
    badgeIcon: event.badge.icon.length <= 2 ? event.badge.icon : "🏆",
    startDate: event.startDate,
    endDate: event.endDate,
    criteria: { description: "chapters", target: event.targetChapters },
    progress: event.participation?.totalChaptersCompleted ?? 0,
  };
}

export function BookBadgesClient() {
  const router = useRouter();
  const searchRef = useRef<HTMLInputElement | null>(null);
  const reduced = useReducedMotion();

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
  const [newlyEarned, setNewlyEarned] = useState<BadgeWithProgress[]>([]);
  const celebratedRef = useRef<Set<string>>(new Set());

  // Hydrate showcase pins (cosmetic, local) on mount.
  useEffect(() => {
    setShowcaseIds(getShowcaseBadgeIds());
  }, []);

  // Redirect if onboarding not complete
  useEffect(() => {
    if (!onboardingHydrated) return;
    if (!onboarding.setupComplete) {
      router.replace("/book");
    }
  }, [onboarding.setupComplete, onboardingHydrated, router]);

  // One canonical catalog (badge-ui-definitions) with server-truth earned state:
  // useBadgeSystem fetches /me/badges and stamps earnedAt, so we just adapt its
  // materialized badges into the BadgeWithProgress contract this page renders.
  const badges = useMemo(
    () => badgeSystem.badges.map(badgeStateToBadgeWithProgress),
    [badgeSystem.badges],
  );

  // Celebrate badges earned since the last visit. earnedAt is server-truth, so
  // old badges never re-celebrate.
  useEffect(() => {
    if (!badgeSystem.hydrated || !badges.length) return;
    const lastSeen = getLastSeenTimestamp();
    if (!lastSeen) {
      // First visit on this device: adopt the entire earned back-catalog
      // silently. We baseline the already-earned ids (not just the timestamp) so
      // that useBadgeSystem's brief client-side earnedAt stamp — which can read
      // as "today" for a few frames before the /me/badges GET resolves on a fresh
      // device — can never replay the back-catalog as a burst of celebrations.
      badges.forEach((b) => {
        if (b.isEarned) celebratedRef.current.add(b.id);
      });
      setLastSeenTimestamp();
      return;
    }
    const lastSeenTime = new Date(lastSeen).getTime();
    const fresh = badges.filter(
      (b) =>
        b.isEarned &&
        b.earnedDate &&
        new Date(b.earnedDate).getTime() > lastSeenTime &&
        !celebratedRef.current.has(b.id),
    );
    if (fresh.length > 0) {
      fresh.forEach((b) => celebratedRef.current.add(b.id));
      setNewlyEarned((prev) => [...prev, ...fresh]);
    }
  }, [badgeSystem.hydrated, badges]);

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

  // Timed challenge — a single real event from /events/active (the one timed
  // mechanic, shared with /book/events). No fabricated "5 chapters this month"
  // fallback that auto-completes from lifetime stats: if there's no active
  // event, the card simply doesn't render.
  const [seasonalChallenge, setSeasonalChallenge] =
    useState<{ challenge: SeasonalChallengeType; href: string } | null>(null);
  useEffect(() => {
    fetchBookJson<{ events: ActiveEventWithParticipation[] }>(
      "/app/api/book/events/active",
    )
      .then((data) => {
        // Prefer a joined-but-incomplete event, otherwise the first active one.
        const joinedEvent = data.events.find((e) => e.participation && !e.participation.completed);
        const activeEvent = joinedEvent ?? data.events[0] ?? null;
        setSeasonalChallenge(
          activeEvent
            ? {
                challenge: eventToSeasonalChallenge(activeEvent),
                href: `/book/events/${activeEvent.eventId}`,
              }
            : null,
        );
      })
      .catch(() => setSeasonalChallenge(null));
  }, []);

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
    setLastSeenTimestamp();
  }, []);

  // Loading state with skeleton
  if (!onboardingHydrated || !badgeSystem.hydrated || !onboarding.setupComplete) {
    return (
      <main className="cf-app-shell">
        <TopNav
          name={viewerName}
          avatarUrl={viewerIdentity.avatarDataUrl}
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

  // Error state: the dashboard fetch failed and we have no last-good analytics,
  // so the page would render an empty catalog with a 0/0 header — misrepresenting
  // the account as having no badges. Surface a retry instead of a blank page.
  if (badgeSystem.error && !badgeSystem.analytics) {
    return (
      <main className="cf-app-shell">
        <TopNav
          name={viewerName}
          avatarUrl={viewerIdentity.avatarDataUrl}
          activeTab="badges"
          searchQuery=""
          onSearchChange={() => {}}
          searchInputRef={searchRef}
          showSearch={false}
          logoVariant="dashboard"
        />
        <section className="mx-auto w-full max-w-450 px-4 pb-28 pt-7 sm:px-6 sm:pt-8 md:pb-24 lg:px-10 xl:px-16">
          <ErrorBanner
            title="We couldn’t load your badges"
            message={badgeSystem.error}
            onRetry={badgeSystem.refetch}
          />
        </section>
      </main>
    );
  }

  return (
    <main className="cf-app-shell">
      <TopNav
        name={viewerName}
        avatarUrl={viewerIdentity.avatarDataUrl}
        activeTab="badges"
        searchQuery=""
        onSearchChange={() => {}}
        searchInputRef={searchRef}
        showSearch={false}
        logoVariant="dashboard"
      />

      <motion.section
        className="mx-auto w-full max-w-450 px-4 pb-28 pt-7 sm:px-6 sm:pt-8 md:pb-24 lg:px-10 xl:px-16"
        initial={reduced ? false : { opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      >
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
            <SeasonalChallenge
              challenge={seasonalChallenge.challenge}
              href={seasonalChallenge.href}
            />
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
      </motion.section>

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

// Single app-wide skeleton primitive: the `.animate-shimmer` sweep (globals.css)
// used by Library/Workspace. It paints its own theme-aware gradient and
// self-disables under prefers-reduced-motion, so no extra bg/guard is needed.
function SkeletonBlock({ className }: { className?: string }) {
  return <div className={`animate-shimmer rounded-xl ${className ?? ""}`} />;
}

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      {/* Header skeleton */}
      <div>
        <SkeletonBlock className="h-10 w-48" />
        <SkeletonBlock className="mt-2 h-5 w-80" />
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <SkeletonBlock className="h-20 rounded-2xl" />
          <SkeletonBlock className="h-20 rounded-2xl" />
          <SkeletonBlock className="h-20 rounded-2xl" />
        </div>
      </div>

      {/* Filter skeleton */}
      <div className="flex gap-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <SkeletonBlock key={i} className="h-8 w-20 rounded-full" />
        ))}
      </div>

      {/* Showcase skeleton */}
      <SkeletonBlock className="h-32 rounded-2xl" />

      {/* Recommendations skeleton */}
      <div>
        <SkeletonBlock className="h-5 w-32" />
        <div className="mt-4 flex gap-3">
          <SkeletonBlock className="h-48 w-[260px] shrink-0 rounded-2xl" />
          <SkeletonBlock className="h-48 w-[260px] shrink-0 rounded-2xl" />
          <SkeletonBlock className="h-48 w-[260px] shrink-0 rounded-2xl" />
        </div>
      </div>

      {/* Grid skeleton */}
      <div className="space-y-3">
        <SkeletonBlock className="h-16 rounded-2xl" />
        <SkeletonBlock className="h-16 rounded-2xl" />
      </div>
    </div>
  );
}
