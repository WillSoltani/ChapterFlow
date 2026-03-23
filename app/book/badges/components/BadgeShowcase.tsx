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
    <div className="rounded-2xl border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.03)] p-5 backdrop-blur-xl">
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
                  className="absolute -right-1 -top-1 z-10 flex h-5 w-5 items-center justify-center rounded-full border border-[rgba(255,255,255,0.1)] bg-neutral-800 text-neutral-400 opacity-0 transition-opacity hover:bg-neutral-700 hover:text-white group-hover:opacity-100"
                  aria-label={`Unpin ${badge.name}`}
                >
                  <X className="h-3 w-3" />
                </button>

                <button
                  type="button"
                  onClick={() => onBadgeClick(badge)}
                  className="flex h-[72px] w-[72px] items-center justify-center rounded-2xl border border-amber-500/20 bg-amber-500/5 transition hover:border-amber-500/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/50"
                  tabIndex={0}
                >
                  <span className="text-4xl">{badge.icon}</span>
                </button>
                <div className="max-w-[80px]">
                  <p className="truncate text-xs font-medium text-amber-500">{badge.name}</p>
                  {badge.earnedDate && (
                    <p className="mt-0.5 text-[10px] text-(--cf-text-soft)">
                      {new Date(badge.earnedDate).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                    </p>
                  )}
                  <p className="text-[10px] text-(--cf-text-soft)">
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
              <div className="flex h-[72px] w-[72px] items-center justify-center rounded-2xl border border-dashed border-[rgba(255,255,255,0.1)] bg-[rgba(255,255,255,0.02)]">
                <span className="text-lg text-(--cf-text-soft)">+</span>
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
