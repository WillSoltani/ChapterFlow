"use client";

import { useCallback } from "react";
import type { ExtendedSettings } from "../types/settings";
import type { useBookPreferences } from "@/app/book/hooks/useBookPreferences";

type BookPreferences = ReturnType<typeof useBookPreferences>;

// ACCT-01: takes the page's single preferences instance. Mounting a second
// useBookPreferences here gave the page two stores that each wrote their whole
// copy, so one control's change was reverted by the other's next save.
export function useSettingsPage({
  hydrated,
  state: prefs,
  patchSection,
}: Pick<BookPreferences, "hydrated" | "state" | "patchSection">) {

  const patch = useCallback(
    (updates: Partial<ExtendedSettings>) => {
      patchSection("extended", updates);
    },
    [patchSection]
  );

  const toggleSection = useCallback(
    (sectionId: string) => {
      patchSection("extended", {
        sectionStates: {
          ...prefs.extended.sectionStates,
          [sectionId]: !prefs.extended.sectionStates[sectionId],
        },
      } as Partial<ExtendedSettings>);
    },
    [patchSection, prefs.extended.sectionStates]
  );

  const isSectionExpanded = useCallback(
    (sectionId: string) => {
      // Finding C (progressive disclosure): default only the first section
      // ("reading") open; every other section a user has never explicitly
      // toggled stays collapsed. An explicit stored boolean (from a prior
      // toggle) always wins, so this never clobbers an existing preference.
      const stored = prefs.extended.sectionStates[sectionId];
      return stored ?? sectionId === "reading";
    },
    [prefs.extended.sectionStates]
  );

  return {
    hydrated,
    state: prefs.extended,
    patch,
    toggleSection,
    isSectionExpanded,
  };
}
