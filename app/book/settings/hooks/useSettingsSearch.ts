"use client";

import { useMemo, useState } from "react";
import { SETTINGS_SEARCH_INDEX } from "../constants/searchKeywords";
import type { SectionId } from "../types/settings";

export function useSettingsSearch() {
  const [query, setQuery] = useState("");

  const results = useMemo(() => {
    const trimmed = query.trim().toLowerCase();
    if (!trimmed) return null;

    const matchedIds = new Set<string>();
    const matchedSections = new Set<SectionId>();

    for (const item of SETTINGS_SEARCH_INDEX) {
      const searchable = [
        item.label,
        item.description,
        item.section,
        ...item.keywords,
      ]
        .join(" ")
        .toLowerCase();

      const words = trimmed.split(/\s+/).filter(Boolean);
      const matches = words.every((word) => searchable.includes(word));
      if (matches) {
        matchedIds.add(item.id);
        matchedSections.add(item.section as SectionId);
      }
    }

    return { matchedIds, matchedSections, hasResults: matchedIds.size > 0 };
  }, [query]);

  return {
    query,
    setQuery,
    results,
    isSearching: query.trim().length > 0,
  };
}
