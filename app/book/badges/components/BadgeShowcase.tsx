"use client";

import { X } from "lucide-react";
import { cn } from "@/app/book/components/ui/cn";
import type { BadgeWithProgress } from "../lib/badge-types";
import { getBadgeRarity } from "../lib/badge-utils";

type BadgeShowcaseProps = {
  badges: BadgeWithProgress[];
  showcaseBadgeIds: string[];
  onBadgeClick: (badge: BadgeWithProgress) => void;
  onUnpin: (badgeId: string) => void;
};

export function BadgeShowcase({ badges, showcaseBadgeIds, onBadgeClick, onUnpin }: BadgeShowcaseProps) {
  const pinnedBadges = showcaseBadgeIds
    .map((id) => badges.find((b) => b.id === id))
    .filter(Boolean) as BadgeWithProgress[];

  const desktopSlots = 5;
  const mobileSlots = 3;

  return (
    <div
      className="rounded-2xl border border-(--cf-border) p-5 backdrop-blur-xl"
      style={{ background: "linear-gradient(135deg, rgba(245,158,11,0.05), var(--cf-surface-muted))" }}
    >
      <div>
        <h2 className="text-base font-semibold tracking-tight text-(--cf-text-1)">Your Showcase</h2>
        <p className="mt-0.5 text-xs text-(--cf-text-soft)">Pin your proudest badges</p>
      </div>

      <div className="mt-4 flex gap-4 overflow-x-auto pb-1">
        {Array.from({ length: desktopSlots }).map((_, i) => {
          const badge = pinnedBadges[i];

          if (badge) {
            const rarity = getBadgeRarity(badge);
            return (
              <div
                key={badge.id}
                className={cn(
                  "group relative flex shrink-0 flex-col items-center gap-2 text-center",
                  i >= mobileSlots && "hidden md:flex"
                )}
              >
                {/* Unpin button on hover */}
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onUnpin(badge.id); }}
                  className="absolute -right-1 -top-1 z-10 flex h-5 w-5 items-center justify-center rounded-full border border-(--cf-border-strong) bg-(--cf-surface-strong) text-(--cf-text-3) opacity-0 transition-opacity hover:bg-(--cf-surface-muted) hover:text-(--cf-text-1) group-hover:opacity-100"
                  aria-label={`Unpin ${badge.name}`}
                >
                  <X className="h-3 w-3" />
                </button>

                <button
                  type="button"
                  onClick={() => onBadgeClick(badge)}
                  className="flex h-18 w-18 items-center justify-center rounded-2xl border border-accent-amber/20 bg-accent-amber/5 transition hover:border-accent-amber/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-amber/50"
                  tabIndex={0}
                >
                  <span className="text-[48px] leading-none">{badge.icon}</span>
                </button>
                <div className="max-w-20">
                  <p className="truncate text-xs font-medium text-(--accent-amber)">{badge.name}</p>
                  {badge.earnedDate && (
                    <p className="mt-0.5 text-[10px]" style={{ color: "var(--text-tertiary, var(--cf-text-soft))" }}>
                      {new Date(badge.earnedDate).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                    </p>
                  )}
                  <p className="text-[10px]" style={{ color: "var(--text-tertiary, var(--cf-text-soft))" }}>
                    Earned by {rarity}%
                  </p>
                </div>
              </div>
            );
          }

          return (
            <div
              key={`empty-${i}`}
              className={cn(
                "flex shrink-0 flex-col items-center gap-2",
                i >= mobileSlots && "hidden md:flex"
              )}
            >
              <div
                className="flex h-18 w-18 items-center justify-center rounded-2xl"
                style={{ border: "2px dashed rgba(255,255,255,0.15)", background: "transparent" }}
              >
                <span className="text-lg" style={{ color: "var(--text-tertiary, var(--cf-text-soft))" }}>+</span>
              </div>
              <p className="text-[10px] text-(--cf-text-soft)">Pin a badge</p>
            </div>
          );
        })}
      </div>

      {pinnedBadges.length === 0 && (
        <p className="mt-2 text-xs text-(--cf-text-soft)">
          Pin your favorite badges to build your reading identity
        </p>
      )}
    </div>
  );
}
