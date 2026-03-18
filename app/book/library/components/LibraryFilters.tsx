"use client";

import { useEffect, useMemo, useState } from "react";
import type {
  LibraryCategoryFilter,
  LibraryDifficultyFilter,
  LibraryStatusFilter,
} from "@/app/book/data/mockUserLibraryState";

type FilterChipProps = {
  label: string;
  selected: boolean;
  onClick: () => void;
};

function FilterChip({ label, selected, onClick }: FilterChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "rounded-full px-3.5 py-1.5 text-sm transition",
        selected
          ? "cf-chip cf-chip-active"
          : "cf-chip hover:border-(--cf-border-strong) hover:text-(--cf-text-1)",
      ].join(" ")}
      aria-pressed={selected}
    >
      {label}
    </button>
  );
}

type FilterGroupProps<T extends string> = {
  label: string;
  options: readonly T[];
  selected: T;
  onSelect: (value: T) => void;
};

function FilterGroup<T extends string>({
  label,
  options,
  selected,
  onSelect,
}: FilterGroupProps<T>) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <p className="min-w-24 text-sm font-medium text-(--cf-text-2)">{label}</p>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => (
          <FilterChip
            key={option}
            label={option}
            selected={selected === option}
            onClick={() => onSelect(option)}
          />
        ))}
      </div>
    </div>
  );
}

function CategoryGroup({
  options,
  selected,
  onSelect,
}: {
  options: readonly LibraryCategoryFilter[];
  selected: LibraryCategoryFilter;
  onSelect: (value: LibraryCategoryFilter) => void;
}) {
  const [visibleCategoryCount, setVisibleCategoryCount] = useState(5);

  const allOption = options[0] ?? "All";
  const actualCategories = options.filter((option) => option !== "All");
  const selectedCategoryIndex = actualCategories.indexOf(selected);
  const requiredVisibleCount =
    selectedCategoryIndex >= 0 ? selectedCategoryIndex + 1 : visibleCategoryCount;
  const effectiveVisibleCount = Math.min(
    actualCategories.length,
    Math.max(visibleCategoryCount, requiredVisibleCount)
  );
  const visibleCategories = useMemo(
    () => actualCategories.slice(0, effectiveVisibleCount),
    [actualCategories, effectiveVisibleCount]
  );
  const hasMoreCategories = effectiveVisibleCount < actualCategories.length;
  const canCollapse = actualCategories.length > 5 && effectiveVisibleCount >= actualCategories.length;

  useEffect(() => {
    if (selectedCategoryIndex >= 0 && selectedCategoryIndex + 1 > visibleCategoryCount) {
      setVisibleCategoryCount(selectedCategoryIndex + 1);
    }
  }, [selectedCategoryIndex, visibleCategoryCount]);

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="sm:max-w-xs">
          <p className="text-sm font-medium text-(--cf-text-2)">Category</p>
          <p className="mt-1 text-xs leading-5 text-(--cf-text-3)">
            Most relevant categories appear first. Reveal more in curated groups of five.
          </p>
        </div>
        <p className="text-xs uppercase tracking-[0.18em] text-(--cf-text-3)">
          {effectiveVisibleCount >= actualCategories.length
            ? `All ${actualCategories.length} categories visible`
            : `${effectiveVisibleCount} of ${actualCategories.length} categories visible`}
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <FilterChip
          label={allOption}
          selected={selected === allOption}
          onClick={() => onSelect(allOption)}
        />
        {visibleCategories.map((option) => (
          <FilterChip
            key={option}
            label={option}
            selected={selected === option}
            onClick={() => onSelect(option)}
          />
        ))}
      </div>

      {hasMoreCategories || canCollapse ? (
        <button
          type="button"
          onClick={() =>
            setVisibleCategoryCount((current) => {
              if (hasMoreCategories) {
                return Math.min(actualCategories.length, current + 5);
              }
              return 5;
            })
          }
          className="cf-btn cf-btn-secondary rounded-full px-3.5 py-1.5 text-sm"
        >
          {hasMoreCategories ? "Show more categories" : "Show fewer categories"}
        </button>
      ) : null}
    </div>
  );
}

type LibraryFiltersProps = {
  category: LibraryCategoryFilter;
  difficulty: LibraryDifficultyFilter;
  status: LibraryStatusFilter;
  categoryOptions: readonly LibraryCategoryFilter[];
  difficultyOptions: readonly LibraryDifficultyFilter[];
  statusOptions: readonly LibraryStatusFilter[];
  onCategoryChange: (value: LibraryCategoryFilter) => void;
  onDifficultyChange: (value: LibraryDifficultyFilter) => void;
  onStatusChange: (value: LibraryStatusFilter) => void;
  showClearFilters: boolean;
  onClearFilters: () => void;
};

export function LibraryFilters({
  category,
  difficulty,
  status,
  categoryOptions,
  difficultyOptions,
  statusOptions,
  onCategoryChange,
  onDifficultyChange,
  onStatusChange,
  showClearFilters,
  onClearFilters,
}: LibraryFiltersProps) {
  return (
    <div className="cf-panel rounded-3xl p-4 sm:p-5">
      <div className="space-y-4">
        <CategoryGroup options={categoryOptions} selected={category} onSelect={onCategoryChange} />

        <FilterGroup
          label="Difficulty"
          options={difficultyOptions}
          selected={difficulty}
          onSelect={onDifficultyChange}
        />

        <FilterGroup
          label="Status"
          options={statusOptions}
          selected={status}
          onSelect={onStatusChange}
        />
      </div>

      {showClearFilters ? (
        <button
          type="button"
          onClick={onClearFilters}
          className="cf-link mt-4 text-sm"
        >
          Clear filters
        </button>
      ) : null}
    </div>
  );
}
