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
        "group relative overflow-hidden rounded-[28px] border bg-[linear-gradient(150deg,rgba(9,14,28,0.96),rgba(14,20,37,0.88))] p-5 text-left transition",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300/45",
        "hover:-translate-y-0.5 hover:shadow-[0_24px_44px_rgba(2,6,23,0.42)]",
        accentClass[badge.accent]
      )}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.08),transparent_52%)]" />
      <div className="pointer-events-none absolute -right-10 top-0 h-32 w-32 rounded-full bg-white/[0.04] blur-3xl" />
      <div className="relative flex items-start justify-between gap-4">
        <div>
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl border border-white/12 bg-white/8 text-3xl shadow-[0_12px_24px_rgba(2,6,23,0.32)]">
            <span className={cn(!badge.earned && "opacity-45 grayscale")}>{badge.icon}</span>
          </div>
          <p className="mt-4 text-[11px] uppercase tracking-[0.22em] text-slate-400">{subtitle}</p>
          <h3 className="mt-2 text-xl font-semibold tracking-tight text-slate-50">{badge.name}</h3>
          <p className="mt-2 text-sm leading-6 text-slate-300">{badge.description}</p>
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
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300/45",
        badge.earned
          ? "border-white/12 bg-[linear-gradient(145deg,rgba(251,191,36,0.12),rgba(255,255,255,0.03))] hover:-translate-y-0.5 hover:shadow-[0_18px_34px_rgba(251,191,36,0.16)]"
          : "border-white/10 bg-white/[0.03] hover:border-white/18 hover:bg-white/[0.05]"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <span className={cn("text-3xl transition", !badge.earned && "opacity-40 grayscale")}>
          {badge.icon}
        </span>
        <div className="flex items-center gap-2">
          {badge.tier ? <Chip tone="neutral">{badge.tier}</Chip> : null}
          {!badge.earned ? <Lock className="h-4 w-4 text-slate-600" /> : null}
        </div>
      </div>
      <h3 className={cn("mt-4 font-semibold tracking-tight", compact ? "text-sm" : "text-base", badge.earned ? "text-slate-50" : "text-slate-200")}>
        {badge.name}
      </h3>
      <p className={cn("mt-2 text-sm leading-6", compact ? "line-clamp-2" : "", badge.earned ? "text-slate-300" : "text-slate-400")}>
        {badge.description}
      </p>
      <div className="mt-4 flex items-center justify-between gap-3 text-xs">
        <span className="uppercase tracking-[0.18em] text-slate-500">{badge.category}</span>
        <span className={cn("font-medium", badge.earned ? "text-amber-200" : "text-slate-500")}>
          {badge.earned ? "Earned" : badge.progressLabel}
        </span>
      </div>
      {!badge.earned ? (
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/8">
          <div
            className="h-full rounded-full bg-linear-to-r from-sky-400 to-cyan-300"
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
    <Card className="border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.03))]">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Category</p>
          <h2 className="mt-2 text-xl font-semibold tracking-tight text-slate-50">{title}</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">{description}</p>
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
      <Card className="border-white/10 bg-white/[0.03]">
        <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Next milestone</p>
        <h3 className="mt-2 text-xl font-semibold tracking-tight text-slate-50">Current visible track is complete</h3>
        <p className="mt-2 text-sm leading-6 text-slate-300">
          You have cleared the current visible badge queue. More milestones can appear as your reading profile expands.
        </p>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden border-amber-300/20 bg-[linear-gradient(145deg,rgba(251,191,36,0.12),rgba(9,14,28,0.96))]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] uppercase tracking-[0.22em] text-amber-200/70">Next milestone</p>
          <h3 className="mt-2 text-2xl font-semibold tracking-tight text-slate-50">{milestone.badge.name}</h3>
          <p className="mt-2 text-sm leading-6 text-slate-200">{milestone.badge.description}</p>
        </div>
        <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl border border-white/12 bg-white/8 text-3xl">
          <span className="opacity-85">{milestone.badge.icon}</span>
        </div>
      </div>
      <div className="mt-5 rounded-2xl border border-white/10 bg-black/16 p-4">
        <div className="flex items-center justify-between gap-3 text-sm text-slate-200">
          <span>{milestone.badge.progressLabel}</span>
          <span>{milestone.progressPercent}%</span>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/8">
          <div
            className="h-full rounded-full bg-linear-to-r from-amber-300 via-orange-300 to-rose-300"
            style={{ width: `${Math.max(6, milestone.progressPercent)}%` }}
          />
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-sm text-slate-300">
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
    <div className="flex gap-4 rounded-[22px] border border-white/8 bg-black/12 px-4 py-3.5">
      <div className="flex flex-col items-center">
        <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/8 text-2xl">
          {entry.icon}
        </span>
        <span className="mt-2 h-full w-px bg-white/8" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-slate-100">{entry.name}</p>
            <p className="mt-1 text-sm leading-6 text-slate-400">{entry.description}</p>
          </div>
          <Chip tone={entry.notificationStyle === "celebration" ? "amber" : entry.notificationStyle === "toast" ? "sky" : "neutral"}>
            {entry.category}
          </Chip>
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs uppercase tracking-[0.18em] text-slate-500">{entry.dateLabel}</p>
          {onOpen ? (
            <button type="button" onClick={onOpen} className="inline-flex items-center gap-1 text-sm text-sky-200 transition hover:text-sky-100">
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
        <div className="inline-flex h-16 w-16 items-center justify-center rounded-[22px] border border-white/12 bg-white/8 text-4xl">
          <span className={cn(!badge.earned && "opacity-45 grayscale")}>{badge.icon}</span>
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          <Chip tone={badge.earned ? "amber" : "neutral"}>{badge.earned ? "Earned" : "Locked"}</Chip>
          <Chip tone="neutral">{badge.category}</Chip>
          {badge.tier ? <Chip tone="neutral">{badge.tier}</Chip> : null}
        </div>
      </div>

      <div>
        <h3 className="text-2xl font-semibold tracking-tight text-slate-50">{badge.name}</h3>
        <p className="mt-2 text-sm leading-6 text-slate-300">{badge.description}</p>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Why it matters</p>
          <p className="mt-2 text-sm leading-6 text-slate-300">{badge.whyItMatters}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">How it is earned</p>
          <p className="mt-2 text-sm leading-6 text-slate-300">{badge.howToEarn}</p>
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-black/14 p-4">
        <div className="flex items-center justify-between gap-3 text-sm text-slate-200">
          <span>{badge.progressLabel}</span>
          <span>{progressPercent}%</span>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/8">
          <div
            className="h-full rounded-full bg-linear-to-r from-sky-400 to-cyan-300"
            style={{ width: `${Math.max(6, progressPercent)}%` }}
          />
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-sm text-slate-400">
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
    <Card className="overflow-hidden border-white/10 bg-[linear-gradient(145deg,rgba(9,14,28,0.96),rgba(14,20,37,0.88))]">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Achievements</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-50">Quiet momentum, visible progress</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
            Badges stay subtle, but the next milestone is always visible so progress feels tangible.
          </p>
        </div>
        <Chip tone="neutral">
          {earnedCount} of {visibleCount} earned
        </Chip>
      </div>
      <div className="mt-5 grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="rounded-[24px] border border-white/10 bg-white/[0.03] p-4">
          <div className="flex items-center gap-2 text-sm text-slate-400">
            <Trophy className="h-4 w-4 text-amber-300" />
            Recent achievement
          </div>
          {recentBadge ? (
            <button type="button" onClick={() => onOpenBadge(recentBadge)} className="mt-4 block w-full rounded-[20px] border border-amber-300/18 bg-amber-500/8 p-4 text-left transition hover:border-amber-300/28">
              <div className="flex items-start justify-between gap-3">
                <span className="text-3xl">{recentBadge.icon}</span>
                <Chip tone="amber">Earned</Chip>
              </div>
              <p className="mt-3 text-base font-semibold text-slate-50">{recentBadge.name}</p>
              <p className="mt-2 text-sm leading-6 text-slate-300">{recentBadge.description}</p>
            </button>
          ) : (
            <p className="mt-4 text-sm leading-6 text-slate-400">
              Earned badges will surface here as your reading history grows.
            </p>
          )}
        </div>
        <div className="rounded-[24px] border border-white/10 bg-white/[0.03] p-4">
          <div className="flex items-center gap-2 text-sm text-slate-400">
            <Sparkles className="h-4 w-4 text-sky-300" />
            Next badge
          </div>
          {nextMilestone ? (
            <button type="button" onClick={() => onOpenBadge(nextMilestone.badge)} className="mt-4 block w-full rounded-[20px] border border-sky-300/18 bg-sky-500/8 p-4 text-left transition hover:border-sky-300/28">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-base font-semibold text-slate-50">{nextMilestone.badge.name}</p>
                  <p className="mt-2 text-sm leading-6 text-slate-300">{nextMilestone.badge.description}</p>
                </div>
                <span className="text-3xl opacity-80">{nextMilestone.badge.icon}</span>
              </div>
              <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/8">
                <div className="h-full rounded-full bg-linear-to-r from-sky-400 to-cyan-300" style={{ width: `${Math.max(6, nextMilestone.progressPercent)}%` }} />
              </div>
              <div className="mt-3 flex items-center justify-between gap-3 text-sm text-slate-300">
                <span>{nextMilestone.badge.progressLabel}</span>
                <span>{nextMilestone.nextStepLabel}</span>
              </div>
            </button>
          ) : (
            <p className="mt-4 text-sm leading-6 text-slate-400">
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
