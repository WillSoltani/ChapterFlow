"use client";

import { useState } from "react";
import { chapterStartModeToInitialTab } from "@/app/book/_lib/onboarding-personalization";
import { useBookPreferences } from "@/app/book/hooks/useBookPreferences";
import { useOnboardingState } from "@/app/book/hooks/useOnboardingState";
import type { FontScale } from "@/lib/reader-state-types";

export function useReaderSettings() {
  const preferences = useBookPreferences();
  const onboardingState = useOnboardingState();
  const [settingsOpen, setSettingsOpen] = useState(false);

  const { state: bookPrefs, hydrated: bookPrefsHydrated } = preferences;
  const { state: onboarding, hydrated: onboardingHydrated } = onboardingState;
  const preferredFontScale: FontScale =
    bookPrefs.reading.fontSize <= 14
      ? "sm"
      : bookPrefs.reading.fontSize >= 18
        ? "lg"
        : "md";

  return {
    bookPrefs,
    patchBookPrefs: preferences.patchSection,
    bookPrefsHydrated,
    onboarding,
    onboardingHydrated,
    learningMode: bookPrefs.extended.learningMode,
    contentTone: bookPrefs.extended.contentTone,
    defaultToFastPath: bookPrefsHydrated && !bookPrefs.extended.profileCustomized,
    preferredActiveTab:
      bookPrefs.reading.defaultChapterTab ||
      chapterStartModeToInitialTab(onboarding.chapterStartMode),
    preferredExampleFilter: onboarding.preferredExampleContext,
    preferredFocusMode: bookPrefs.reading.focusModeDefault,
    preferredFontScale,
    dailyGoalMinutes: bookPrefs.extended.dailyGoalPreset || 10,
    settingsOpen,
    setSettingsOpen,
  };
}
