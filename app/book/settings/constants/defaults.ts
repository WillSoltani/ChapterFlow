import type { ExtendedSettings, DailyGoalPreset } from "../types/settings";

export const EXTENDED_SETTINGS_STORAGE_KEY = "book-accelerator:settings-ext:v1";

export const defaultExtendedSettings: ExtendedSettings = {
  // Reading Experience
  readingProfile: "balanced",
  // NS-1: a literary serif is the reader's default prose voice (the report's #1
  // change). Safe because (a) batch 01 scoped .cf-app-shell chrome to
  // var(--font-body) so this never makes chrome serif, and (b) batch 04
  // repointed fontMap.serif -> var(--font-reading) (Newsreader), so "serif"
  // resolves to the crafted webface, not Georgia. (useBookPreferences.ts fontMap.)
  fontFamily: "serif",
  lineSpacing: "comfortable",
  letterSpacing: "normal",

  // Text-to-Speech (Pro). Only ttsSpeed remains (wired into the reader
  // AudioPlayer); ttsVoice / ttsAutoAdvance were removed (no backend). See SET-2.
  ttsSpeed: 1.0,

  // Learning Mode
  learningMode: "standard",

  // Goals & Motivation
  streakMode: "standard",
  streakSkipDays: 1,
  motivationPersona: "coach",
  contentTone: "gentle",
  quizStyle: "challenge",
  dailyGoalPreset: 10,
  spacedRepetitionTarget: 85,

  // Appearance
  scheduledDarkMode: false,
  darkModeFrom: "20:00",
  darkModeTo: "07:00",

  // Accessibility
  colorBlindMode: "off",

  // Notifications
  breakReminders: false,
  breakReminderMinutes: 30,

  // UI State
  personalizationDismissed: false,
  // Finding C (progressive disclosure): collapse all sections except the first
  // by default. A new/unset user lands on a short, scannable page instead of a
  // ~2900px wall; useSettingsPage.isSectionExpanded falls back to "reading only"
  // for any section the user has never explicitly toggled.
  sectionStates: {
    reading: true,
    goals: false,
    appearance: false,
    accessibility: false,
    notifications: false,
    account: false,
  },
  profileCustomized: false,
};

/**
 * Canonical daily-goal tiers — single source of truth for the Settings daily
 * goal cards and (serialized after this batch) the onboarding pace step
 * (StepPace, batch 13). Reconciles the two pre-existing label systems:
 * onboarding's "Light / Steady / Focused" (10/20/30) and Settings' "Casual /
 * Regular / Committed / Intense" (5/10/20/30). We keep the 4 wired buckets
 * (DailyGoalPreset = 5|10|20|30, dailyGoalPreset default = 10) and adopt the
 * calmer onboarding adjectives, with one "Most popular" default on 10 min.
 */
export type DailyGoalTier = {
  value: DailyGoalPreset;
  minutesLabel: string; // "10 min"
  name: string; // calm, shared sub-label
  subtext: string; // one-line helper
  recommended?: boolean; // the single "Most popular" default
};

export const DAILY_GOAL_TIERS: DailyGoalTier[] = [
  { value: 5, minutesLabel: "5 min", name: "Light", subtext: "A quick chapter over coffee" },
  { value: 10, minutesLabel: "10 min", name: "Steady", subtext: "Build a daily habit", recommended: true },
  { value: 20, minutesLabel: "20 min", name: "Focused", subtext: "Real progress, every day" },
  { value: 30, minutesLabel: "30 min", name: "Deep", subtext: "For the truly dedicated" },
];

/** Map quiz style values to the existing onboarding quizIntensity values */
export const QUIZ_STYLE_TO_INTENSITY = {
  comfortable: "easy",
  challenge: "standard",
  surprise: "challenging",
} as const;

export const INTENSITY_TO_QUIZ_STYLE = {
  easy: "comfortable",
  standard: "challenge",
  challenging: "surprise",
} as const;

/** Map motivation persona to existing onboarding motivationStyle values */
export const PERSONA_TO_MOTIVATION = {
  coach: "gentle",
  partner: "direct",
  rival: "competitive",
} as const;

export const MOTIVATION_TO_PERSONA = {
  gentle: "coach",
  direct: "partner",
  competitive: "rival",
} as const;
