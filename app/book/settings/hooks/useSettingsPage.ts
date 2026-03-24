"use client";

import { useCallback, useEffect, useState } from "react";
import type { ExtendedSettings } from "../types/settings";
import {
  EXTENDED_SETTINGS_STORAGE_KEY,
  defaultExtendedSettings,
} from "../constants/defaults";

function parseStored(raw: string | null): ExtendedSettings | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    // Merge with defaults so new fields get their default values
    return { ...defaultExtendedSettings, ...parsed };
  } catch {
    return null;
  }
}

export function useSettingsPage() {
  const [hydrated, setHydrated] = useState(false);
  const [state, setState] = useState<ExtendedSettings>(defaultExtendedSettings);

  // Hydrate from localStorage
  useEffect(() => {
    const stored = parseStored(
      window.localStorage.getItem(EXTENDED_SETTINGS_STORAGE_KEY)
    );
    if (stored) setState(stored);
    setHydrated(true);
  }, []);

  // Persist to localStorage on every change
  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(
      EXTENDED_SETTINGS_STORAGE_KEY,
      JSON.stringify(state)
    );
  }, [hydrated, state]);

  const patch = useCallback(
    (updates: Partial<ExtendedSettings>) => {
      setState((prev) => ({ ...prev, ...updates }));
    },
    []
  );

  const toggleSection = useCallback((sectionId: string) => {
    setState((prev) => ({
      ...prev,
      sectionStates: {
        ...prev.sectionStates,
        [sectionId]: !prev.sectionStates[sectionId],
      },
    }));
  }, []);

  const isSectionExpanded = useCallback(
    (sectionId: string) => {
      return state.sectionStates[sectionId] ?? true;
    },
    [state.sectionStates]
  );

  return {
    hydrated,
    state,
    patch,
    toggleSection,
    isSectionExpanded,
  };
}
