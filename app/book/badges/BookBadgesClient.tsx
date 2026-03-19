"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Award, Compass, Lock, Search, Sparkles, Trophy } from "lucide-react";
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
  FeaturedBadgeCard,
  ProgressToNextBadgeCard,
} from "@/app/book/badges/components/BadgeSystemCards";
import { Card } from "@/app/book/components/ui/Card";
import { Chip } from "@/app/book/components/ui/Chip";

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

  const featuredBadges = useMemo(
    () => badgeSystem.featuredBadges.filter((badge) => visibleById.has(badge.id)).slice(0, 4),
    [badgeSystem.featuredBadges, visibleById]
  );

  const nextMilestone = useMemo(
    () => badgeSystem.nextMilestones.find((milestone) => visibleById.has(milestone.badge.id)) ?? badgeSystem.nextMilestones[0] ?? null,
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
        <div className="grid gap-4 xl:grid-cols-[1.12fr_0.88fr]">
          <Card className="overflow-hidden p-6 sm:p-7">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-(--cf-border) bg-(--cf-surface-muted) text-(--cf-text-2)">
                  <Award className="h-6 w-6" />
                </div>
                <h1 className="mt-4 text-4xl font-semibold tracking-tight text-(--cf-text-1) sm:text-5xl">Badges and milestones</h1>
                <p className="mt-3 max-w-3xl text-base leading-7 text-(--cf-text-2)">
                  Achievements reward depth, consistency, and completion. The system stays quiet most of the time, but the next meaningful milestone is always visible.
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <StatPill label="Earned" value={badgeSystem.earnedCount} tone="amber" />
                <StatPill label="Visible" value={badgeSystem.visibleCount} tone="sky" />
              </div>
            </div>
            <div className="mt-6 flex flex-wrap items-center gap-3 rounded-[24px] border border-(--cf-border) bg-(--cf-surface-muted) px-4 py-3">
              <Search className="h-4 w-4 text-(--cf-text-soft)" />
              <p className="text-sm text-(--cf-text-2)">
                Search matches badge names, descriptions, and unlock guidance so it stays fast even as the system grows.
              </p>
            </div>
          </Card>

          <ProgressToNextBadgeCard
            milestone={nextMilestone}
            onOpen={nextMilestone ? () => setSelectedBadge(nextMilestone.badge) : undefined}
            secondary={
              <div className="grid gap-3 sm:grid-cols-2">
                <MiniNote
                  icon={<Sparkles className="h-4 w-4 text-(--cf-accent)" />}
                  label="Unlock cadence"
                  value="Small wins stay subtle. Major milestones earn richer reveal treatment."
                />
                <MiniNote
                  icon={<Compass className="h-4 w-4 text-(--cf-warning-text)" />}
                  label="Design principle"
                  value="Progress matters more than noise, so visible tracks focus on meaningful movement."
                />
              </div>
            }
          />
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
          <BadgeFilterBar filters={BADGE_FILTERS} activeFilter={filter} onChange={setFilter} />
          <div className="flex flex-wrap gap-2">
            <Chip tone="neutral">{badgeSystem.lockedBadges.length} locked</Chip>
            <Chip tone="neutral">{badgeSystem.badgeTimeline.length} timeline items</Chip>
          </div>
        </div>

        {featuredBadges.length ? (
          <div className="mt-6">
            <div className="mb-3 flex items-center gap-2 text-sm text-(--cf-text-3)">
              <Trophy className="h-4 w-4 text-(--cf-warning-text)" />
              Featured badges
            </div>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {featuredBadges.map((badge, index) => (
                <FeaturedBadgeCard
                  key={badge.id}
                  badge={badge}
                  subtitle={index < 2 ? "Recently earned" : "Prestige"}
                  onOpen={() => setSelectedBadge(badge)}
                />
              ))}
            </div>
          </div>
        ) : null}

        <div className="mt-6 grid gap-5 xl:grid-cols-[1.16fr_0.84fr]">
          <div className="space-y-5">
            {groupedBadges.length ? (
              groupedBadges.map((group) => (
                <BadgeCategorySection
                  key={group.category}
                  title={group.title}
                  description={group.description}
                  badges={group.badges}
                  onOpen={setSelectedBadge}
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

          <div className="space-y-5">
            <Card>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.22em] text-(--cf-text-soft)">Recent unlocks</p>
                  <h2 className="mt-2 text-xl font-semibold tracking-tight text-(--cf-text-1)">Badge timeline</h2>
                </div>
                <Chip tone="neutral">{timelineEntries.length} shown</Chip>
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
                    Earned badges will land here over time so progress feels reflective instead of noisy.
                  </div>
                )}
              </div>
            </Card>

            <Card>
              <p className="text-[11px] uppercase tracking-[0.22em] text-(--cf-text-soft)">Locked design</p>
              <h2 className="mt-2 text-xl font-semibold tracking-tight text-(--cf-text-1)">Progressive reveal</h2>
              <p className="mt-2 text-sm leading-6 text-(--cf-text-2)">
                Hidden milestones stay out of the way until progress begins. Locked badges hint at what matters without flooding the page with empty goals.
              </p>
              <div className="mt-5 space-y-3">
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
                        <p className="mt-1 truncate text-xs uppercase tracking-[0.18em] text-(--cf-text-soft)">{badge.progressLabel}</p>
                      </div>
                    </div>
                    <Lock className="h-4 w-4 shrink-0 text-(--cf-text-soft)" />
                  </button>
                ))}
              </div>
            </Card>
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
  tone: "amber" | "sky";
}) {
  return (
    <div className="rounded-[22px] border border-(--cf-border) bg-(--cf-surface-muted) px-4 py-3">
      <p className="text-[11px] uppercase tracking-[0.22em] text-(--cf-text-soft)">{label}</p>
      <p className={tone === "amber" ? "mt-2 text-2xl font-semibold text-(--cf-warning-text)" : "mt-2 text-2xl font-semibold text-(--cf-info-text)"}>
        {value}
      </p>
    </div>
  );
}

function MiniNote({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-(--cf-border) bg-(--cf-surface-muted) p-4">
      <div className="flex items-center gap-2 text-sm text-(--cf-text-3)">
        {icon}
        <span>{label}</span>
      </div>
      <p className="mt-2 text-sm leading-6 text-(--cf-text-2)">{value}</p>
    </div>
  );
}
