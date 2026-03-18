"use client";

import type { ReactNode } from "react";
import { ArrowUpRight, Lock, Sparkles, Trophy } from "lucide-react";
import { Button } from "@/app/book/components/ui/Button";
import { Card } from "@/app/book/components/ui/Card";
import { Chip, ChipButton } from "@/app/book/components/ui/Chip";
import { cn } from "@/app/book/components/ui/cn";
import type { BadgeFilter, BadgeState } from "@/app/book/data/mockBadges";

type NextMilestone = {
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
  category: string;
  description: string;
  earnedAt: string;
  dateLabel: string;
  notificationStyle: BadgeState["notificationStyle"];
};

const accentClass = {
  sky: "from-sky-400/28 via-cyan-300/12 to-transparent border-sky-300/18",
  emerald: "from-emerald-400/26 via-teal-300/10 to-transparent border-emerald-300/18",
  amber: "from-amber-300/26 via-orange-300/10 to-transparent border-amber-300/18",
  violet: "from-violet-400/24 via-fuchsia-300/10 to-transparent border-violet-300/18",
  rose: "from-rose-400/22 via-pink-300/10 to-transparent border-rose-300/18",
} as const;

export function BadgeFilterBar({
  filters,
  activeFilter,
  onChange,
}: {
  filters: readonly BadgeFilter[];
  activeFilter: BadgeFilter;
  onChange: (filter: BadgeFilter) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {filters.map((filter) => (
        <ChipButton
          key={filter}
          tone={activeFilter === filter ? "sky" : "neutral"}
          active={activeFilter === filter}
          onClick={() => onChange(filter)}
        >
          {filter}
        </ChipButton>
      ))}
    </div>
  );
}

export function FeaturedBadgeCard({
  badge,
  subtitle,
  onOpen,
}: {
  badge: BadgeState;
  subtitle: string;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        "group relative overflow-hidden rounded-[28px] border bg-(--cf-surface) p-5 text-left transition",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--cf-accent-border)",
        "hover:-translate-y-0.5 hover:shadow-[0_24px_44px_rgba(0,0,0,0.12)]",
        accentClass[badge.accent]
      )}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.08),transparent_52%)]" />
      <div className="pointer-events-none absolute -right-10 top-0 h-32 w-32 rounded-full bg-white/[0.04] blur-3xl" />
      <div className="relative flex items-start justify-between gap-4">
        <div>
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl border border-(--cf-border) bg-(--cf-surface-muted) text-3xl shadow-sm">
            <span className={cn(!badge.earned && "opacity-45 grayscale")}>{badge.icon}</span>
          </div>
          <p className="mt-4 text-[11px] uppercase tracking-[0.22em] text-(--cf-text-soft)">{subtitle}</p>
          <h3 className="mt-2 text-xl font-semibold tracking-tight text-(--cf-text-1)">{badge.name}</h3>
          <p className="mt-2 text-sm leading-6 text-(--cf-text-2)">{badge.description}</p>
        </div>
        <Chip tone={badge.earned ? "amber" : "neutral"} className="shrink-0">
          {badge.earned ? "Earned" : badge.tier ?? badge.category}
        </Chip>
      </div>
    </button>
  );
}

export function BadgeCard({
  badge,
  compact = false,
  onOpen,
}: {
  badge: BadgeState;
  compact?: boolean;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        "group relative overflow-hidden rounded-[24px] border p-4 text-left transition",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--cf-accent-border)",
        badge.earned
          ? "border-(--cf-warning-border) bg-(--cf-warning-soft) hover:-translate-y-0.5 hover:shadow-[0_18px_34px_rgba(251,191,36,0.12)]"
          : "border-(--cf-border) bg-(--cf-surface-muted) hover:border-(--cf-border-strong) hover:bg-(--cf-surface)"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <span className={cn("text-3xl transition", !badge.earned && "opacity-40 grayscale")}>
          {badge.icon}
        </span>
        <div className="flex items-center gap-2">
          {badge.tier ? <Chip tone="neutral">{badge.tier}</Chip> : null}
          {!badge.earned ? <Lock className="h-4 w-4 text-(--cf-text-soft)" /> : null}
        </div>
      </div>
      <h3 className={cn("mt-4 font-semibold tracking-tight", compact ? "text-sm" : "text-base", badge.earned ? "text-(--cf-warning-text)" : "text-(--cf-text-1)")}>
        {badge.name}
      </h3>
      <p className={cn("mt-2 text-sm leading-6", compact ? "line-clamp-2" : "", badge.earned ? "text-(--cf-text-2)" : "text-(--cf-text-3)")}>
        {badge.description}
      </p>
      <div className="mt-4 flex items-center justify-between gap-3 text-xs">
        <span className="uppercase tracking-[0.18em] text-(--cf-text-soft)">{badge.category}</span>
        <span className={cn("font-medium", badge.earned ? "text-(--cf-warning-text)" : "text-(--cf-text-soft)")}>
          {badge.earned ? "Earned" : badge.progressLabel}
        </span>
      </div>
      {!badge.earned ? (
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-(--cf-border)">
          <div
            className="h-full rounded-full bg-linear-to-r from-(--cf-accent) to-(--cf-accent-strong)"
            style={{
              width: `${Math.max(4, Math.min(100, Math.round((badge.progressValue / Math.max(badge.targetValue, 1)) * 100)))}%`,
            }}
          />
        </div>
      ) : null}
    </button>
  );
}

export function BadgeCategorySection({
  title,
  description,
  badges,
  onOpen,
}: {
  title: string;
  description: string;
  badges: BadgeState[];
  onOpen: (badge: BadgeState) => void;
}) {
  return (
    <Card>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.22em] text-(--cf-text-soft)">Category</p>
          <h2 className="mt-2 text-xl font-semibold tracking-tight text-(--cf-text-1)">{title}</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-(--cf-text-2)">{description}</p>
        </div>
        <Chip tone="neutral">{badges.filter((badge) => badge.earned).length} earned</Chip>
      </div>
      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {badges.map((badge) => (
          <BadgeCard key={badge.id} badge={badge} onOpen={() => onOpen(badge)} />
        ))}
      </div>
    </Card>
  );
}

export function ProgressToNextBadgeCard({
  milestone,
  secondary,
  onOpen,
}: {
  milestone: NextMilestone | null;
  secondary?: ReactNode;
  onOpen?: () => void;
}) {
  if (!milestone) {
    return (
      <Card>
        <p className="text-[11px] uppercase tracking-[0.22em] text-(--cf-text-soft)">Next milestone</p>
        <h3 className="mt-2 text-xl font-semibold tracking-tight text-(--cf-text-1)">Current visible track is complete</h3>
        <p className="mt-2 text-sm leading-6 text-(--cf-text-2)">
          You have cleared the current visible badge queue. More milestones can appear as your reading profile expands.
        </p>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden border-(--cf-warning-border) bg-(--cf-warning-soft)">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] uppercase tracking-[0.22em] text-(--cf-warning-text)">Next milestone</p>
          <h3 className="mt-2 text-2xl font-semibold tracking-tight text-(--cf-text-1)">{milestone.badge.name}</h3>
          <p className="mt-2 text-sm leading-6 text-(--cf-text-2)">{milestone.badge.description}</p>
        </div>
        <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl border border-(--cf-warning-border) bg-(--cf-surface) text-3xl">
          <span className="opacity-85">{milestone.badge.icon}</span>
        </div>
      </div>
      <div className="mt-5 rounded-2xl border border-(--cf-warning-border) bg-(--cf-surface) p-4">
        <div className="flex items-center justify-between gap-3 text-sm text-(--cf-text-2)">
          <span>{milestone.badge.progressLabel}</span>
          <span>{milestone.progressPercent}%</span>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-(--cf-border)">
          <div
            className="h-full rounded-full bg-linear-to-r from-amber-300 via-orange-300 to-rose-300"
            style={{ width: `${Math.max(6, milestone.progressPercent)}%` }}
          />
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-sm text-(--cf-text-2)">
          <span>{milestone.nextStepLabel}</span>
          {milestone.nextTier ? <span>Then {milestone.nextTier.name}</span> : null}
        </div>
      </div>
      {secondary ? <div className="mt-4">{secondary}</div> : null}
      {onOpen ? (
        <div className="mt-5">
          <Button variant="secondary" onClick={onOpen}>
            Open badge details
          </Button>
        </div>
      ) : null}
    </Card>
  );
}

export function BadgeTimelineItem({ entry, onOpen }: { entry: BadgeTimelineEntry; onOpen?: () => void }) {
  return (
    <div className="flex gap-4 rounded-[22px] border border-(--cf-border) bg-(--cf-surface-muted) px-4 py-3.5">
      <div className="flex flex-col items-center">
        <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-(--cf-border) bg-(--cf-surface-muted) text-2xl">
          {entry.icon}
        </span>
        <span className="mt-2 h-full w-px bg-(--cf-border)" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-(--cf-text-1)">{entry.name}</p>
            <p className="mt-1 text-sm leading-6 text-(--cf-text-3)">{entry.description}</p>
          </div>
          <Chip tone={entry.notificationStyle === "celebration" ? "amber" : entry.notificationStyle === "toast" ? "sky" : "neutral"}>
            {entry.category}
          </Chip>
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs uppercase tracking-[0.18em] text-(--cf-text-soft)">{entry.dateLabel}</p>
          {onOpen ? (
            <button type="button" onClick={onOpen} className="inline-flex items-center gap-1 text-sm text-(--cf-accent) transition hover:text-(--cf-accent-strong)">
              Open
              <ArrowUpRight className="h-4 w-4" />
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function BadgeDetailPanel({
  badge,
  nextTier,
}: {
  badge: BadgeState;
  nextTier: BadgeState | null;
}) {
  const progressPercent =
    badge.targetValue > 0
      ? Math.max(0, Math.min(100, Math.round((badge.progressValue / badge.targetValue) * 100)))
      : 0;

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div className="inline-flex h-16 w-16 items-center justify-center rounded-[22px] border border-(--cf-border) bg-(--cf-surface-muted) text-4xl">
          <span className={cn(!badge.earned && "opacity-45 grayscale")}>{badge.icon}</span>
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          <Chip tone={badge.earned ? "amber" : "neutral"}>{badge.earned ? "Earned" : "Locked"}</Chip>
          <Chip tone="neutral">{badge.category}</Chip>
          {badge.tier ? <Chip tone="neutral">{badge.tier}</Chip> : null}
        </div>
      </div>

      <div>
        <h3 className="text-2xl font-semibold tracking-tight text-(--cf-text-1)">{badge.name}</h3>
        <p className="mt-2 text-sm leading-6 text-(--cf-text-2)">{badge.description}</p>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div className="rounded-2xl border border-(--cf-border) bg-(--cf-surface-muted) p-4">
          <p className="text-[11px] uppercase tracking-[0.2em] text-(--cf-text-soft)">Why it matters</p>
          <p className="mt-2 text-sm leading-6 text-(--cf-text-2)">{badge.whyItMatters}</p>
        </div>
        <div className="rounded-2xl border border-(--cf-border) bg-(--cf-surface-muted) p-4">
          <p className="text-[11px] uppercase tracking-[0.2em] text-(--cf-text-soft)">How it is earned</p>
          <p className="mt-2 text-sm leading-6 text-(--cf-text-2)">{badge.howToEarn}</p>
        </div>
      </div>

      <div className="rounded-2xl border border-(--cf-border) bg-(--cf-surface-muted) p-4">
        <div className="flex items-center justify-between gap-3 text-sm text-(--cf-text-2)">
          <span>{badge.progressLabel}</span>
          <span>{progressPercent}%</span>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-(--cf-border)">
          <div
            className="h-full rounded-full bg-linear-to-r from-(--cf-accent) to-(--cf-accent-strong)"
            style={{ width: `${Math.max(6, progressPercent)}%` }}
          />
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-sm text-(--cf-text-3)">
          <span>
            {badge.earned
              ? badge.earnedAt
                ? `Earned on ${new Date(badge.earnedAt).toLocaleDateString()}`
                : "Earned"
              : `${Math.max(badge.targetValue - badge.progressValue, 0)} remaining`}
          </span>
          {nextTier ? <span>Next tier: {nextTier.name}</span> : null}
        </div>
      </div>
    </div>
  );
}

export function DashboardAchievementWidget({
  recentBadge,
  nextMilestone,
  earnedCount,
  visibleCount,
  onOpenBadge,
  onViewAll,
}: {
  recentBadge: BadgeState | null;
  nextMilestone: NextMilestone | null;
  earnedCount: number;
  visibleCount: number;
  onOpenBadge: (badge: BadgeState) => void;
  onViewAll: () => void;
}) {
  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[11px] uppercase tracking-[0.22em] text-(--cf-text-soft)">Achievements</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-(--cf-text-1)">Quiet momentum, visible progress</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-(--cf-text-2)">
            Badges stay subtle, but the next milestone is always visible so progress feels tangible.
          </p>
        </div>
        <Chip tone="neutral">
          {earnedCount} of {visibleCount} earned
        </Chip>
      </div>
      <div className="mt-5 grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="rounded-[24px] border border-(--cf-border) bg-(--cf-surface-muted) p-4">
          <div className="flex items-center gap-2 text-sm text-(--cf-text-3)">
            <Trophy className="h-4 w-4 text-(--cf-warning-text)" />
            Recent achievement
          </div>
          {recentBadge ? (
            <button type="button" onClick={() => onOpenBadge(recentBadge)} className="mt-4 block w-full rounded-[20px] border border-(--cf-warning-border) bg-(--cf-warning-soft) p-4 text-left transition hover:border-(--cf-warning-border)">
              <div className="flex items-start justify-between gap-3">
                <span className="text-3xl">{recentBadge.icon}</span>
                <Chip tone="amber">Earned</Chip>
              </div>
              <p className="mt-3 text-base font-semibold text-(--cf-text-1)">{recentBadge.name}</p>
              <p className="mt-2 text-sm leading-6 text-(--cf-text-2)">{recentBadge.description}</p>
            </button>
          ) : (
            <p className="mt-4 text-sm leading-6 text-(--cf-text-3)">
              Earned badges will surface here as your reading history grows.
            </p>
          )}
        </div>
        <div className="rounded-[24px] border border-(--cf-border) bg-(--cf-surface-muted) p-4">
          <div className="flex items-center gap-2 text-sm text-(--cf-text-3)">
            <Sparkles className="h-4 w-4 text-(--cf-accent)" />
            Next badge
          </div>
          {nextMilestone ? (
            <button type="button" onClick={() => onOpenBadge(nextMilestone.badge)} className="mt-4 block w-full rounded-[20px] border border-(--cf-accent-border) bg-(--cf-accent-soft) p-4 text-left transition hover:border-(--cf-accent-border)">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-base font-semibold text-(--cf-text-1)">{nextMilestone.badge.name}</p>
                  <p className="mt-2 text-sm leading-6 text-(--cf-text-2)">{nextMilestone.badge.description}</p>
                </div>
                <span className="text-3xl opacity-80">{nextMilestone.badge.icon}</span>
              </div>
              <div className="mt-4 h-2 overflow-hidden rounded-full bg-(--cf-border)">
                <div className="h-full rounded-full bg-linear-to-r from-(--cf-accent) to-(--cf-accent-strong)" style={{ width: `${Math.max(6, nextMilestone.progressPercent)}%` }} />
              </div>
              <div className="mt-3 flex items-center justify-between gap-3 text-sm text-(--cf-text-2)">
                <span>{nextMilestone.badge.progressLabel}</span>
                <span>{nextMilestone.nextStepLabel}</span>
              </div>
            </button>
          ) : (
            <p className="mt-4 text-sm leading-6 text-(--cf-text-3)">
              The current visible milestone track is complete. Additional long term badges can surface here later.
            </p>
          )}
        </div>
      </div>
      <div className="mt-5">
        <Button variant="secondary" onClick={onViewAll}>
          View all achievements
        </Button>
      </div>
    </Card>
  );
}
