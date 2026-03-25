"use client";

import { useState, type ReactNode } from "react";
import { ArrowUpRight, ChevronDown, Lock, Sparkles, Trophy, Zap } from "lucide-react";
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
  const isLocked = !badge.earned;

  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        "group relative overflow-hidden rounded-[28px] p-5 text-left transition",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--cf-accent-border)",
        "hover:-translate-y-0.5 hover:shadow-[0_24px_44px_rgba(0,0,0,0.12)]",
        isLocked
          ? "border border-dashed border-(--cf-border) bg-(--cf-surface-muted)"
          : cn("border bg-(--cf-surface)", accentClass[badge.accent])
      )}
    >
      {!isLocked ? (
        <>
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,var(--cf-border),transparent_52%)]" />
          <div className="pointer-events-none absolute -right-10 top-0 h-32 w-32 rounded-full bg-(--cf-surface-muted) blur-3xl" />
        </>
      ) : null}
      <div className="relative flex items-start justify-between gap-4">
        <div>
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl border border-(--cf-border) bg-(--cf-surface-muted) text-3xl shadow-sm">
            <span className={cn(isLocked && "opacity-30 grayscale")}>{badge.icon}</span>
          </div>
          <p className="mt-4 text-[11px] uppercase tracking-[0.22em] text-(--cf-text-soft)">{subtitle}</p>
          <h3 className={cn("mt-2 text-xl font-semibold tracking-tight", isLocked ? "text-(--cf-text-2)" : "text-(--cf-text-1)")}>{badge.name}</h3>
          <p className="mt-2 text-sm leading-6 text-(--cf-text-2)">{badge.description}</p>
          {/* Progress bar for locked badges */}
          {isLocked && badge.progressValue != null && badge.targetValue ? (
            <div className="mt-3 h-1 w-full overflow-hidden rounded-full bg-(--cf-border)">
              <div className="h-full rounded-full bg-(--cf-accent)/40" style={{ width: `${Math.min(100, Math.round((badge.progressValue / badge.targetValue) * 100))}%` }} />
            </div>
          ) : null}
        </div>
        <div className="flex flex-col items-end gap-2">
          {isLocked ? (
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-(--cf-surface-strong) px-2 py-0.5 text-[10px] text-(--cf-text-soft)">
              🔒 Locked
            </span>
          ) : (
            <Chip tone="amber" className="shrink-0">Earned</Chip>
          )}
          <span className="inline-flex items-center gap-1 text-xs text-(--cf-text-soft)">
            <Zap className="h-3 w-3" />
            {badge.flowPoints} FP
          </span>
        </div>
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
        <div className="flex items-center gap-2.5">
          <span className={cn("inline-flex items-center gap-0.5", badge.earned ? "text-(--cf-warning-text)" : "text-(--cf-text-soft)")}>
            <Zap className="h-3 w-3" />
            {badge.flowPoints}
          </span>
          <span className={cn("font-medium", badge.earned ? "text-(--cf-warning-text)" : "text-(--cf-text-soft)")}>
            {badge.earned ? "Earned" : badge.progressLabel}
          </span>
        </div>
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
  defaultOpen = false,
}: {
  title: string;
  description: string;
  badges: BadgeState[];
  onOpen: (badge: BadgeState) => void;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  const earnedCount = badges.filter((b) => b.earned).length;
  const totalFP = badges.reduce((sum, b) => sum + b.flowPoints, 0);
  const earnedFP = badges.filter((b) => b.earned).reduce((sum, b) => sum + b.flowPoints, 0);

  return (
    <div className="overflow-hidden rounded-[28px] border border-(--cf-border) bg-(--cf-surface)">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        className="flex w-full items-center gap-4 px-5 py-4 text-left transition hover:bg-(--cf-surface-muted) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-(--cf-accent-border) sm:px-6 sm:py-5"
      >
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2.5">
            <h2 className="text-base font-semibold tracking-tight text-(--cf-text-1)">{title}</h2>
            <Chip tone={earnedCount > 0 ? "amber" : "neutral"}>
              {earnedCount} of {badges.length}
            </Chip>
          </div>
          <p className="mt-1 line-clamp-1 text-sm text-(--cf-text-3)">{description}</p>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <span className="hidden items-center gap-1 text-xs text-(--cf-text-soft) sm:inline-flex">
            <Zap className="h-3 w-3" />
            {earnedFP > 0 ? `${earnedFP} / ${totalFP}` : totalFP} FP
          </span>
          <ChevronDown
            className={cn(
              "h-4 w-4 text-(--cf-text-soft) transition-transform duration-200 motion-reduce:transition-none",
              open && "rotate-180"
            )}
          />
        </div>
      </button>

      <div
        className="grid transition-[grid-template-rows] duration-200 ease-in-out motion-reduce:transition-none"
        style={{ gridTemplateRows: open ? "1fr" : "0fr" }}
      >
        <div className="overflow-hidden">
          <div className="border-t border-(--cf-border) px-5 pb-5 pt-4 sm:px-6 sm:pb-6">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
              {badges.map((badge) => (
                <BadgeCard key={badge.id} badge={badge} onOpen={() => onOpen(badge)} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function ProgressToNextBadgeCard({
  milestone,
  onOpen,
  secondary,
}: {
  milestone: NextMilestone | null;
  onOpen?: () => void;
  secondary?: ReactNode;
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
        <div className="flex flex-col items-end gap-2">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl border border-(--cf-warning-border) bg-(--cf-surface) text-3xl">
            <span className="opacity-85">{milestone.badge.icon}</span>
          </div>
          <span className="inline-flex items-center gap-1 text-xs text-(--cf-warning-text)">
            <Zap className="h-3 w-3" />
            {milestone.badge.flowPoints} FP
          </span>
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
        {/* Sub-step breakdown */}
        {milestone.badge.targetValue > 0 ? (
          <div className="mt-3 space-y-1.5">
            {Array.from({ length: Math.min(milestone.badge.targetValue, 10) }).map((_, i) => {
              const done = i < milestone.badge.progressValue;
              const isNext = i === milestone.badge.progressValue;
              return (
                <div key={i} className="flex items-center gap-2 text-xs">
                  {done ? (
                    <span className="text-emerald-400">✓</span>
                  ) : (
                    <span className={cn("text-(--cf-text-soft)", isNext && "animate-pulse")}>○</span>
                  )}
                  <span className={done ? "text-(--cf-text-2)" : isNext ? "text-(--cf-text-1)" : "text-(--cf-text-soft)"}>
                    Step {i + 1}
                  </span>
                  {isNext ? (
                    <span className="ml-auto text-(--cf-accent)">Next up!</span>
                  ) : null}
                </div>
              );
            })}
            {milestone.badge.targetValue > 10 ? (
              <p className="text-[11px] text-(--cf-text-soft)">
                {milestone.badge.progressValue} done · {milestone.remaining} more to unlock
              </p>
            ) : null}
          </div>
        ) : null}
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

      <div className="inline-flex items-center gap-2 rounded-2xl border border-(--cf-border) bg-(--cf-surface-muted) px-3 py-2 text-sm">
        <Zap className="h-3.5 w-3.5 text-(--cf-text-soft)" />
        <span className="font-semibold text-(--cf-text-1)">{badge.flowPoints}</span>
        <span className="text-(--cf-text-3)">Flow Points on earn</span>
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
