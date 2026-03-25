import type { ExtendedSettings } from "../types/settings";

export const EXTENDED_SETTINGS_STORAGE_KEY = "book-accelerator:settings-ext:v1";

export const defaultExtendedSettings: ExtendedSettings = {
  // Reading Experience
  readingProfile: "balanced",
  fontFamily: "sans-serif",
  lineSpacing: "comfortable",
  letterSpacing: "normal",

  // Text-to-Speech (Pro)
  ttsVoice: "clara",
  ttsSpeed: 1.0,
  ttsAutoAdvance: true,

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
  sectionStates: {
    reading: true,
    goals: true,
    appearance: true,
    accessibility: true,
    notifications: true,
    account: true,
  },
  profileCustomized: false,
};

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
