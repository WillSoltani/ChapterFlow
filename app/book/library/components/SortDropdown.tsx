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
    <label className="inline-flex items-center gap-2 text-sm text-slate-300">
      <span className="hidden sm:inline">Sort</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value as LibrarySortOption)}
        className="rounded-xl border border-white/15 bg-white/6 px-3 py-2 text-sm text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300/45"
        aria-label="Sort books"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value} className="bg-[#111827]">
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

