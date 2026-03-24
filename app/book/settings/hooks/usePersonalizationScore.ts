"use client";

import { useMemo } from "react";
import type { BookPreferencesState } from "@/app/book/hooks/useBookPreferences";
import { defaultBookPreferencesState } from "@/app/book/hooks/useBookPreferences";
import type { ExtendedSettings } from "../types/settings";
import { defaultExtendedSettings } from "../constants/defaults";

/**
 * Calculates how many settings the user has actively customized vs. defaults.
 * Returns a percentage (0-100).
 */
export function usePersonalizationScore(
  preferences: BookPreferencesState,
  extended: ExtendedSettings,
  dailyGoalMinutes: number,
  reminderTime: string
): number {
  return useMemo(() => {
    let total = 0;
    let customized = 0;

    // Check key preference fields against defaults
    const checks: [unknown, unknown][] = [
      [preferences.reading.defaultChapterTab, defaultBookPreferencesState.reading.defaultChapterTab],
      [preferences.reading.fontSize, defaultBookPreferencesState.reading.fontSize],
      [preferences.reading.focusModeDefault, defaultBookPreferencesState.reading.focusModeDefault],
      [preferences.reading.showProgressBar, defaultBookPreferencesState.reading.showProgressBar],
      [preferences.appearance.theme, defaultBookPreferencesState.appearance.theme],
      [preferences.appearance.reducedMotion, defaultBookPreferencesState.appearance.reducedMotion],
      [preferences.notifications.readingReminderEnabled, defaultBookPreferencesState.notifications.readingReminderEnabled],
      [preferences.notifications.streakReminder, defaultBookPreferencesState.notifications.streakReminder],
      [preferences.accessibility.highContrastMode, defaultBookPreferencesState.accessibility.highContrastMode],
      [preferences.accessibility.dyslexiaFriendlyFont, defaultBookPreferencesState.accessibility.dyslexiaFriendlyFont],
      [preferences.goals.weeklyChapterGoal, defaultBookPreferencesState.goals.weeklyChapterGoal],
    ];

    // Check extended settings against defaults
    const extChecks: [unknown, unknown][] = [
      [extended.readingProfile, defaultExtendedSettings.readingProfile],
      [extended.fontFamily, defaultExtendedSettings.fontFamily],
      [extended.lineSpacing, defaultExtendedSettings.lineSpacing],
      [extended.letterSpacing, defaultExtendedSettings.letterSpacing],
      [extended.streakMode, defaultExtendedSettings.streakMode],
      [extended.motivationPersona, defaultExtendedSettings.motivationPersona],
      [extended.quizStyle, defaultExtendedSettings.quizStyle],
      [extended.dailyGoalPreset, defaultExtendedSettings.dailyGoalPreset],
      [extended.colorBlindMode, defaultExtendedSettings.colorBlindMode],
    ];

    // Onboarding fields
    const onboardingChecks: [unknown, unknown][] = [
      [dailyGoalMinutes, 20], // default from onboarding
      [reminderTime, "20:00"],
    ];

    const allChecks = [...checks, ...extChecks, ...onboardingChecks];

    for (const [current, defaultVal] of allChecks) {
      total++;
      if (current !== defaultVal) customized++;
    }

    return total > 0 ? Math.round((customized / total) * 100) : 0;
  }, [preferences, extended, dailyGoalMinutes, reminderTime]);
}
