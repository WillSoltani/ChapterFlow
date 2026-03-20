"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type {
  LibraryCategoryFilter,
  LibraryDifficultyFilter,
  LibraryStatusFilter,
} from "@/app/book/_lib/library-data";

const CHIP_GAP_PX = 8;

type FilterChipProps = {
  label: string;
  selected: boolean;
  onClick: () => void;
};

function estimateChipWidth(label: string): number {
  return Math.max(92, label.length * 8 + 36);
}

function FilterChip({ label, selected, onClick }: FilterChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "shrink-0 rounded-full px-3.5 py-1.5 text-sm transition",
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

function MeasureChip({
  label,
  measureId,
}: {
  label: string;
  measureId: string;
}) {
  return (
    <span
      data-chip-measure={measureId}
      className="inline-flex shrink-0 rounded-full border px-3.5 py-1.5 text-sm font-medium"
    >
      {label}
    </span>
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
  const rowRef = useRef<HTMLDivElement | null>(null);
  const measureRef = useRef<HTMLDivElement | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [containerWidth, setContainerWidth] = useState(0);
  const [chipWidths, setChipWidths] = useState<Record<string, number>>({});

  const allOption = options[0] ?? "All";
  const categories = useMemo(
    () => options.filter((option) => option !== allOption),
    [allOption, options]
  );

  useEffect(() => {
    const node = rowRef.current;
    if (!node) return;

    const measureWidth = () => {
      setContainerWidth(node.getBoundingClientRect().width);
    };

    measureWidth();

    const observer = new ResizeObserver(() => {
      measureWidth();
    });
    observer.observe(node);

    return () => {
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    const node = measureRef.current;
    if (!node) return;

    const nextWidths: Record<string, number> = {};
    node.querySelectorAll<HTMLElement>("[data-chip-measure]").forEach((element) => {
      const key = element.dataset.chipMeasure;
      if (!key) return;
      nextWidths[key] = Math.ceil(element.getBoundingClientRect().width);
    });

    setChipWidths((current) => {
      const currentKeys = Object.keys(current);
      const nextKeys = Object.keys(nextWidths);
      if (
        currentKeys.length === nextKeys.length &&
        nextKeys.every((key) => current[key] === nextWidths[key])
      ) {
        return current;
      }
      return nextWidths;
    });
  }, [allOption, categories, expanded]);

  const visibleCategories = useMemo(() => {
    if (expanded || categories.length <= 1) return categories;

    const availableWidth = Math.max(containerWidth, 0);
    if (availableWidth <= 0) {
      const fallback = categories.slice(0, 4);
      if (selected !== allOption && !fallback.includes(selected) && categories.includes(selected)) {
        return Array.from(new Set([...fallback.slice(0, Math.max(0, fallback.length - 1)), selected]));
      }
      return fallback;
    }
    const allWidth = chipWidths[allOption] ?? estimateChipWidth(allOption);
    const toggleWidth =
      chipWidths.__toggle_more__ ?? estimateChipWidth("Show more categories");
    const fitted: string[] = [];
    let consumedWidth = allWidth;

    for (const category of categories) {
      const width = chipWidths[category] ?? estimateChipWidth(category);
      const nextWidth = consumedWidth + CHIP_GAP_PX + width;
      const hasRoom = nextWidth + CHIP_GAP_PX + toggleWidth <= availableWidth;

      if (!hasRoom && fitted.length > 0) break;

      fitted.push(category);
      consumedWidth = nextWidth;

      if (!hasRoom) break;
    }

    const collapsed = fitted.length ? fitted : categories.slice(0, 1);
    if (selected !== allOption && !collapsed.includes(selected) && categories.includes(selected)) {
      const withSelected = [...collapsed.slice(0, Math.max(0, collapsed.length - 1)), selected];
      return Array.from(new Set(withSelected));
    }

    return collapsed;
  }, [allOption, categories, chipWidths, containerWidth, expanded, selected]);

  const hasHiddenCategories = visibleCategories.length < categories.length;
  const showToggle = hasHiddenCategories || expanded;
  const toggleLabel = expanded ? "Show fewer" : "Show more categories";

  return (
    <div className="relative space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="sm:max-w-xs">
          <p className="text-sm font-medium text-(--cf-text-2)">Category</p>
          <p className="mt-1 text-xs leading-5 text-(--cf-text-3)">
            Browse the main shelves first, then reveal the full catalog when you want a wider pass.
          </p>
        </div>
        <p className="text-xs uppercase tracking-[0.18em] text-(--cf-text-3)">
          {expanded || !hasHiddenCategories
            ? `${categories.length} categories visible`
            : `${visibleCategories.length} of ${categories.length} visible`}
        </p>
      </div>

      <div
        ref={rowRef}
        className={[
          "flex gap-2",
          expanded ? "flex-wrap" : "flex-nowrap overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
        ].join(" ")}
      >
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
        {showToggle ? (
          <button
            type="button"
            onClick={() => setExpanded((current) => !current)}
            className="cf-btn cf-btn-secondary shrink-0 rounded-full px-3.5 py-1.5 text-sm"
          >
            {toggleLabel}
          </button>
        ) : null}
      </div>

      <div
        ref={measureRef}
        className="pointer-events-none absolute left-0 top-0 -z-10 h-0 overflow-hidden opacity-0"
        aria-hidden="true"
      >
        <div className="inline-flex gap-2">
          <MeasureChip label={allOption} measureId={allOption} />
          {categories.map((option) => (
            <MeasureChip key={option} label={option} measureId={option} />
          ))}
          <MeasureChip label="Show more categories" measureId="__toggle_more__" />
        </div>
      </div>
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
