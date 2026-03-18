"use client";

import type {
  LibrarySortOption,
} from "@/app/book/data/mockUserLibraryState";

type SortDropdownProps = {
  value: LibrarySortOption;
  onChange: (value: LibrarySortOption) => void;
  options: Array<{ value: LibrarySortOption; label: string }>;
};

export function SortDropdown({ value, onChange, options }: SortDropdownProps) {
  return (
    <label className="inline-flex items-center gap-2 text-sm text-(--cf-text-2)">
      <span className="hidden sm:inline">Sort</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value as LibrarySortOption)}
        className="cf-input rounded-xl px-3 py-2 text-sm"
        aria-label="Sort books"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
