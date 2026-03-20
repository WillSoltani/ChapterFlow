"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Award, Lock, Search, Zap } from "lucide-react";
import { TopNav } from "@/app/book/home/components/TopNav";
import { InfoModal } from "@/app/book/home/components/InfoModal";
import { useOnboardingState } from "@/app/book/hooks/useOnboardingState";
import { useKeyboardShortcut } from "@/app/book/hooks/useKeyboardShortcut";
import { useBadgeSystem } from "@/app/book/hooks/useBadgeSystem";
import { useBookViewer } from "@/app/book/hooks/useBookViewer";
import { BADGE_FILTERS, filterBadges, type BadgeFilter, type BadgeState } from "@/app/book/data/mockBadges";
import {
  BadgeCategorySection,
  BadgeDetailPanel,
  BadgeFilterBar,
  BadgeTimelineItem,
  ProgressToNextBadgeCard,
} from "@/app/book/badges/components/BadgeSystemCards";
import { Card } from "@/app/book/components/ui/Card";

export function BookBadgesClient() {
  const router = useRouter();
  const searchRef = useRef<HTMLInputElement | null>(null);

  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<BadgeFilter>("All");
  const [selectedBadge, setSelectedBadge] = useState<BadgeState | null>(null);

  const { state: onboarding, hydrated: onboardingHydrated } = useOnboardingState();
  const { identity: viewerIdentity } = useBookViewer();
  const badgeSystem = useBadgeSystem({
    selectedBookIds: onboarding.selectedBookIds,
    dailyGoalMinutes: onboarding.dailyGoalMinutes,
  });
  const viewerName = viewerIdentity.displayName || "Reader";

  useKeyboardShortcut(
    "/",
    (event) => {
      event.preventDefault();
      searchRef.current?.focus();
    },
    { ignoreWhenTyping: true }
  );

  useEffect(() => {
    if (!onboardingHydrated) return;
    if (!onboarding.setupComplete) {
      router.replace("/book");
    }
  }, [onboarding.setupComplete, onboardingHydrated, router]);

  const visibleBadges = useMemo(() => {
    const filtered = filterBadges(badgeSystem.visibleBadges, filter);
    const search = query.trim().toLowerCase();
    if (!search) return filtered;
    return filtered.filter((badge) => {
      const searchable = [
        badge.name,
        badge.description,
        badge.category,
        badge.howToEarn,
        badge.whyItMatters,
      ]
        .join(" ")
        .toLowerCase();
      return searchable.includes(search);
    });
  }, [badgeSystem.visibleBadges, filter, query]);

  const visibleById = useMemo(() => new Set(visibleBadges.map((badge) => badge.id)), [visibleBadges]);

  const groupedBadges = useMemo(
    () =>
      badgeSystem.categoryGroups
        .map((group) => ({
          ...group,
          badges: group.badges.filter((badge) => visibleById.has(badge.id)),
        }))
        .filter((group) => group.badges.length > 0),
    [badgeSystem.categoryGroups, visibleById]
  );

  // First category that has earned badges opens by default; fallback to first visible category.
  const defaultOpenCategory = useMemo(() => {
    const firstEarned = groupedBadges.find((g) => g.badges.some((b) => b.earned));
    return firstEarned?.category ?? groupedBadges[0]?.category ?? null;
  }, [groupedBadges]);

  const nextMilestone = useMemo(
    () => badgeSystem.nextMilestones.find((m) => visibleById.has(m.badge.id)) ?? badgeSystem.nextMilestones[0] ?? null,
    [badgeSystem.nextMilestones, visibleById]
  );

  const timelineEntries = useMemo(
    () => badgeSystem.badgeTimeline.filter((entry) => visibleById.has(entry.badgeId)).slice(0, 8),
    [badgeSystem.badgeTimeline, visibleById]
  );

  const selectedNextTier = useMemo(
    () => badgeSystem.badges.find((badge) => badge.id === selectedBadge?.nextTierId) ?? null,
    [badgeSystem.badges, selectedBadge?.nextTierId]
  );

  const totalFlowPointsEarned = useMemo(
    () => badgeSystem.earnedBadges.reduce((sum, b) => sum + b.flowPoints, 0),
    [badgeSystem.earnedBadges]
  );

  if (!onboardingHydrated || !badgeSystem.hydrated || !onboarding.setupComplete) {
    return (
      <main className="cf-app-shell">
        <div className="mx-auto flex min-h-screen items-center justify-center px-4 text-(--cf-text-2)">
          Loading achievements...
        </div>
      </main>
    );
  }

  return (
    <main className="cf-app-shell">
      <TopNav
        name={viewerName}
        activeTab="badges"
        searchQuery={query}
        onSearchChange={setQuery}
        searchInputRef={searchRef}
        searchPlaceholder="Search badges"
      />

      <section className="mx-auto w-full max-w-7xl px-4 pb-28 pt-7 sm:px-6 sm:pt-8 md:pb-24">
        {/* Page header */}
        <Card className="overflow-hidden">
          <div className="flex flex-wrap items-start justify-between gap-5">
            <div>
              <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-(--cf-border) bg-(--cf-surface-muted) text-(--cf-text-2)">
                <Award className="h-5 w-5" />
              </div>
              <h1 className="mt-3 text-2xl font-semibold tracking-tight text-(--cf-text-1) sm:text-3xl">
                Badges and Milestones
              </h1>
              <p className="mt-2 max-w-xl text-sm leading-6 text-(--cf-text-2)">
                Achievements reward depth, consistency, and completion — each one worth Flow Points.
              </p>
              <div className="mt-3 inline-flex items-center gap-1.5 text-xs text-(--cf-text-soft)">
                <Zap className="h-3.5 w-3.5" />
                Badge points feed into your overall Flow Points balance and show up on the home rewards panel
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              <StatPill label="Earned" value={badgeSystem.earnedCount} tone="amber" />
              <StatPill label="Badge FP" value={totalFlowPointsEarned} tone="zap" />
              <StatPill label="Categories" value={groupedBadges.length} tone="neutral" />
            </div>
          </div>
        </Card>

        {/* Filter bar */}
        <div className="mt-5">
          <BadgeFilterBar filters={BADGE_FILTERS} activeFilter={filter} onChange={setFilter} />
        </div>

        {/* Search hint when there's a query */}
        {query.trim() ? (
          <p className="mt-3 text-sm text-(--cf-text-3)">
            <span className="font-medium text-(--cf-text-2)">{visibleBadges.length}</span>{" "}
            {visibleBadges.length === 1 ? "badge" : "badges"} match &ldquo;{query}&rdquo;
          </p>
        ) : null}

        {/* Main content */}
        <div className="mt-5 grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
          {/* Category accordion list */}
          <div className="space-y-3">
            {groupedBadges.length ? (
              groupedBadges.map((group) => (
                <BadgeCategorySection
                  key={group.category}
                  title={group.title}
                  description={group.description}
                  badges={group.badges}
                  onOpen={setSelectedBadge}
                  defaultOpen={group.category === defaultOpenCategory}
                />
              ))
            ) : (
              <Card>
                <div className="py-8 text-center">
                  <p className="text-lg font-semibold text-(--cf-text-1)">No badges match this view</p>
                  <p className="mt-2 text-sm text-(--cf-text-3)">
                    Try a broader filter or search term to see more achievements.
                  </p>
                </div>
              </Card>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-5">
            <ProgressToNextBadgeCard
              milestone={nextMilestone}
              onOpen={nextMilestone ? () => setSelectedBadge(nextMilestone.badge) : undefined}
            />

            <Card>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.22em] text-(--cf-text-soft)">Recent unlocks</p>
                  <h2 className="mt-2 text-xl font-semibold tracking-tight text-(--cf-text-1)">Badge timeline</h2>
                </div>
              </div>
              <div className="mt-5 space-y-3">
                {timelineEntries.length ? (
                  timelineEntries.map((entry) => (
                    <BadgeTimelineItem
                      key={entry.id}
                      entry={entry}
                      onOpen={() => {
                        const badge = badgeSystem.badges.find((item) => item.id === entry.badgeId);
                        if (badge) setSelectedBadge(badge);
                      }}
                    />
                  ))
                ) : (
                  <div className="rounded-[22px] border border-(--cf-border) bg-(--cf-surface-muted) px-4 py-4 text-sm leading-6 text-(--cf-text-3)">
                    Earned badges will appear here as your reading history grows.
                  </div>
                )}
              </div>
            </Card>

            {/* Locked preview */}
            {badgeSystem.lockedBadges.length > 0 ? (
              <Card>
                <p className="text-[11px] uppercase tracking-[0.22em] text-(--cf-text-soft)">Still locked</p>
                <h2 className="mt-2 text-xl font-semibold tracking-tight text-(--cf-text-1)">Next to unlock</h2>
                <div className="mt-4 space-y-2">
                  {badgeSystem.lockedBadges.slice(0, 3).map((badge) => (
                    <button
                      key={badge.id}
                      type="button"
                      onClick={() => setSelectedBadge(badge)}
                      className="flex w-full items-center justify-between gap-3 rounded-[22px] border border-(--cf-border) bg-(--cf-surface-muted) px-4 py-3 text-left transition hover:border-(--cf-border-strong)"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <span className="text-2xl opacity-40 grayscale">{badge.icon}</span>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-(--cf-text-1)">{badge.name}</p>
                          <p className="mt-0.5 truncate text-xs text-(--cf-text-soft)">{badge.progressLabel}</p>
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <span className="inline-flex items-center gap-0.5 text-xs text-(--cf-text-soft)">
                          <Zap className="h-3 w-3" />
                          {badge.flowPoints}
                        </span>
                        <Lock className="h-4 w-4 text-(--cf-text-soft)" />
                      </div>
                    </button>
                  ))}
                </div>
              </Card>
            ) : null}
          </div>
        </div>
      </section>

      <InfoModal
        open={Boolean(selectedBadge)}
        title={selectedBadge?.name || "Badge"}
        onClose={() => setSelectedBadge(null)}
      >
        {selectedBadge ? (
          <BadgeDetailPanel badge={selectedBadge} nextTier={selectedNextTier} />
        ) : null}
      </InfoModal>
    </main>
  );
}

function StatPill({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "amber" | "sky" | "zap" | "neutral";
}) {
  const valueClass =
    tone === "amber"
      ? "text-(--cf-warning-text)"
      : tone === "sky"
        ? "text-(--cf-info-text)"
        : tone === "zap"
          ? "text-(--cf-accent)"
          : "text-(--cf-text-1)";

  return (
    <div className="rounded-[22px] border border-(--cf-border) bg-(--cf-surface-muted) px-4 py-3">
      <p className="text-[11px] uppercase tracking-[0.22em] text-(--cf-text-soft)">{label}</p>
      <p className={`mt-2 text-2xl font-semibold ${valueClass}`}>{value}</p>
    </div>
  );
}
