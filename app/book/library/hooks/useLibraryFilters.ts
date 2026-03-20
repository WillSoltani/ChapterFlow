"use client";

import { useEffect, useMemo, useState } from "react";
import {
  difficultyRank,
  type LibraryBookEntry,
  type LibraryCategoryFilter,
  type LibraryDifficultyFilter,
  type LibrarySortOption,
  type LibraryStatusFilter,
} from "@/app/book/_lib/library-data";

type LibraryFilterState = {
  searchQuery: string;
  category: LibraryCategoryFilter;
  difficulty: LibraryDifficultyFilter;
  status: LibraryStatusFilter;
  sort: LibrarySortOption;
};

const STORAGE_KEY = "book-accelerator:library-filters:v2";

const defaultFilters: LibraryFilterState = {
  searchQuery: "",
  category: "All",
  difficulty: "All",
  status: "All",
  sort: "most_recent",
};

function parseStoredFilters(raw: string | null): LibraryFilterState | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<LibraryFilterState>;
    return {
      ...defaultFilters,
      ...parsed,
    };
  } catch {
    return null;
  }
}

function matchesStatus(entry: LibraryBookEntry, status: LibraryStatusFilter): boolean {
  if (status === "All") return true;
  if (status === "In Progress") return entry.status === "in_progress";
  if (status === "Completed") return entry.status === "completed";
  return entry.status === "not_started";
}

function applyFilters(
  entries: LibraryBookEntry[],
  filters: LibraryFilterState
): LibraryBookEntry[] {
  const query = filters.searchQuery.trim().toLowerCase();
  const filtered = entries.filter((entry) => {
    if (filters.category !== "All" && entry.category !== filters.category) return false;
    if (filters.difficulty !== "All" && entry.difficulty !== filters.difficulty) return false;
    if (!matchesStatus(entry, filters.status)) return false;
    if (query) {
      const searchable = `${entry.title} ${entry.author}`.toLowerCase();
      if (!searchable.includes(query)) return false;
    }
    return true;
  });

  const sorted = [...filtered];
  if (filters.sort === "progress_desc") {
    sorted.sort((a, b) => b.progressPercent - a.progressPercent);
  } else if (filters.sort === "title_asc") {
    sorted.sort((a, b) => a.title.localeCompare(b.title));
  } else if (filters.sort === "difficulty") {
    sorted.sort((a, b) => difficultyRank(a.difficulty) - difficultyRank(b.difficulty));
  } else {
    sorted.sort(
      (a, b) => Date.parse(b.lastActivityAt) - Date.parse(a.lastActivityAt)
    );
  }

  return sorted;
}

export function useLibraryFilters(entries: LibraryBookEntry[]) {
  const [hydrated, setHydrated] = useState(false);
  const [filters, setFilters] = useState<LibraryFilterState>(defaultFilters);
  const [displayedEntries, setDisplayedEntries] = useState<LibraryBookEntry[]>(entries);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const stored = parseStoredFilters(window.localStorage.getItem(STORAGE_KEY));
    if (stored) {
      setFilters(stored);
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(filters));
  }, [filters, hydrated]);

  const computedEntries = useMemo(
    () => applyFilters(entries, filters),
    [entries, filters]
  );

  useEffect(() => {
    setLoading(true);
    const timeout = window.setTimeout(() => {
      setDisplayedEntries(computedEntries);
      setLoading(false);
    }, 300);
    return () => {
      window.clearTimeout(timeout);
    };
  }, [computedEntries]);

  const hasActiveChipFilters =
    filters.category !== "All" ||
    filters.difficulty !== "All" ||
    filters.status !== "All";

  return {
    hydrated,
    loading,
    filters,
    displayedEntries,
    totalCount: displayedEntries.length,
    setSearchQuery: (searchQuery: string) =>
      setFilters((prev) => ({ ...prev, searchQuery })),
    setCategory: (category: LibraryCategoryFilter) =>
      setFilters((prev) => ({ ...prev, category })),
    setDifficulty: (difficulty: LibraryDifficultyFilter) =>
      setFilters((prev) => ({ ...prev, difficulty })),
    setStatus: (status: LibraryStatusFilter) =>
      setFilters((prev) => ({ ...prev, status })),
    setSort: (sort: LibrarySortOption) =>
      setFilters((prev) => ({ ...prev, sort })),
    clearChipFilters: () =>
      setFilters((prev) => ({
        ...prev,
        category: "All",
        difficulty: "All",
        status: "All",
      })),
    hasActiveChipFilters,
  };
}
