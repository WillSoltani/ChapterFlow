"use client";

import { cn } from "@/app/book/components/ui/cn";
import type { BadgeFilter, BadgeWithProgress } from "../lib/badge-types";
import { FILTER_OPTIONS } from "../lib/badge-data";

type BadgeFiltersProps = {
  activeFilter: BadgeFilter;
  onChange: (filter: BadgeFilter) => void;
  badges: BadgeWithProgress[];
};

export function BadgeFilters({ activeFilter, onChange, badges }: BadgeFiltersProps) {
  function getCount(value: string): number | null {
    if (value === "all" || value === "earned" || value === "locked") return null;
    return badges.filter((b) => b.category === value && b.isEarned).length;
  }

  return (
    <div className="hide-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0">
      {FILTER_OPTIONS.map((opt) => {
        const isActive = activeFilter === opt.value;
        const count = getCount(opt.value);

        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value as BadgeFilter)}
            className={cn(
              "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-medium transition snap-start",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--cf-accent-border)",
              isActive
                ? "border-transparent"
                : count === 0
                  ? "border-(--cf-border-strong) bg-transparent text-(--cf-text-2) opacity-50 hover:border-(--cf-border-strong) hover:bg-(--cf-surface-muted)"
                  : "border-(--cf-border-strong) bg-transparent text-(--cf-text-2) hover:border-(--cf-border-strong) hover:bg-(--cf-surface-muted)"
            )}
            style={
              isActive
                ? { background: "rgba(34,211,238,0.12)", color: "var(--accent-cyan)" }
                : undefined
            }
          >
            {opt.label}
            {count !== null && (
              <span
                className={cn(
                  "text-xs",
                  isActive ? "opacity-70" : "text-(--cf-text-soft)"
                )}
              >
                ({count})
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
