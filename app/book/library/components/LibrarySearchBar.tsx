"use client";

import { Search } from "lucide-react";
import type { RefObject } from "react";
import type { LibrarySortOption } from "@/app/book/data/mockUserLibraryState";
import { SortDropdown } from "@/app/book/library/components/SortDropdown";

type LibrarySearchBarProps = {
  value: string;
  onChange: (value: string) => void;
  inputRef: RefObject<HTMLInputElement | null>;
  sortValue: LibrarySortOption;
  onSortChange: (value: LibrarySortOption) => void;
  sortOptions: Array<{ value: LibrarySortOption; label: string }>;
};

export function LibrarySearchBar({
  value,
  onChange,
  inputRef,
  sortValue,
  onSortChange,
  sortOptions,
}: LibrarySearchBarProps) {
  return (
    <div className="rounded-3xl border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.07),rgba(255,255,255,0.03))] p-3 sm:p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <label className="relative block flex-1">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
          <input
            ref={inputRef}
            type="search"
            value={value}
            onChange={(event) => onChange(event.target.value)}
            placeholder="Search by title or author..."
            className="w-full rounded-2xl border border-white/12 bg-white/6 px-12 py-3 text-base text-slate-100 placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300/45"
            aria-label="Search by title or author"
          />
        </label>

        <SortDropdown
          value={sortValue}
          onChange={onSortChange}
          options={sortOptions}
        />
      </div>
      <p className="mt-2 px-1 text-xs text-slate-400">Press / to search</p>
    </div>
  );
}

