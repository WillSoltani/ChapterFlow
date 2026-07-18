"use client";

import { cn } from "@/lib/utils";
import type { BadgeFilter, BadgeWithProgress } from "../lib/badge-types";
import { FILTER_OPTIONS } from "../lib/badge-utils";

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
              "cf-chip cf-pressable shrink-0 px-3.5 py-1.5 text-sm font-medium transition snap-start cf-focus",
              isActive && "cf-chip-active",
              !isActive && count === 0 && "opacity-50"
            )}
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
