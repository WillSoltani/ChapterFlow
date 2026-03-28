"use client";

import type { BadgeCategoryGroup, BadgeWithProgress } from "../lib/badge-types";
import { BadgeCategorySection } from "./BadgeCategorySection";

type BadgeGridProps = {
  groups: BadgeCategoryGroup[];
  defaultOpenCategory: string | null;
  onBadgeClick: (badge: BadgeWithProgress) => void;
};

export function BadgeGrid({ groups, defaultOpenCategory, onBadgeClick }: BadgeGridProps) {
  if (groups.length === 0) {
    return (
      <div
        className="rounded-2xl border border-(--cf-border) bg-(--cf-surface-muted) px-5 py-12 text-center backdrop-blur-xl"
        style={{ borderTopWidth: 2, borderTopColor: "var(--cf-border)" }}
      >
        <p className="text-lg font-semibold text-(--cf-text-1)">No badges match this view</p>
        <p className="mt-2 text-sm text-(--cf-text-3)">
          Try a broader filter to see more achievements.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {groups.map((group) => (
        <BadgeCategorySection
          key={group.id}
          group={group}
          defaultOpen={group.id === defaultOpenCategory}
          onBadgeClick={onBadgeClick}
        />
      ))}
    </div>
  );
}
