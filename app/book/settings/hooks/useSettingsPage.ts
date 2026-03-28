"use client";

import { useCallback } from "react";
import type { ExtendedSettings } from "../types/settings";
import { useBookPreferences } from "@/app/book/hooks/useBookPreferences";

export function useSettingsPage() {
  const { hydrated, state: prefs, patchSection } = useBookPreferences();

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
      return prefs.extended.sectionStates[sectionId] ?? true;
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
