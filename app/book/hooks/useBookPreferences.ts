"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { fetchBookJson } from "@/app/book/_lib/book-api";
import { fetchBookJsonCached, invalidateBookCache } from "@/lib/client/book-api-cache";
import { SETTINGS_KEY } from "./book-read-keys";
import { applyDocumentTheme } from "@/app/_lib/document-theme";
import type { ExtendedSettings } from "@/app/book/settings/types/settings";
import { defaultExtendedSettings, INTENSITY_TO_QUIZ_STYLE } from "@/app/book/settings/constants/defaults";

export type ReaderFontDefault = "sm" | "md" | "lg";

export type ReadingChapterTab = "summary" | "examples" | "quiz";
export type QuestionPresentationStyle = "all-at-once" | "one-by-one";
export type ReviewStylePreference = "summary-only" | "summary-plus-examples" | "full-review";
export type ExampleContextPreference = "all" | "personal" | "school" | "work";
export type ReminderSchedule = "daily" | "weekdays" | "custom";
export type ReminderToneStyle = "subtle" | "motivating" | "direct";
export type RecommendationPreference =
  | "easiest-first"
  | "balanced"
  | "challenging-first"
  | "most-popular";
export type DefaultLibrarySorting =
  | "recommended"
  | "recently-opened"
  | "shortest-read"
  | "longest-read"
  | "alphabetical";
export type ThemePreference = "dark" | "light" | "system";
export type AccentColor = "sky" | "emerald" | "amber" | "rose";
export type InterfaceDensity = "compact" | "comfortable" | "spacious";
export type CardStylePreference = "soft-glass" | "flat-minimal" | "elevated";
export type DateFormatPreference = "month-day-year" | "day-month-year" | "year-month-day";
export type TimeFormatPreference = "12h" | "24h";
export type LanguagePreference = "English" | "English (Canada)" | "English (United States)";
export type FocusRingStrength = "standard" | "strong" | "maximum";
export type ButtonSizePreference = "standard" | "large";
export type TooltipTimingPreference = "fast" | "balanced" | "extended";
export type ParagraphDensity = "airy" | "balanced" | "dense";

export type BookPreferencesState = {
  reading: {
    defaultChapterTab: ReadingChapterTab;
    fontSize: number;
    lineSpacing: number;
    contentWidth: number;
    paragraphDensity: ParagraphDensity;
    focusModeDefault: boolean;
    showProgressBar: boolean;
    showKeyTakeawaysByDefault: boolean;
    resumeWhereLeftOff: boolean;
    openNextUnlockedChapterAutomatically: boolean;
    showReadingSessionTimer: boolean;
    showEstimatedReadingTime: boolean;
  };
  learning: {
    questionPresentationStyle: QuestionPresentationStyle;
    shuffleQuestionOrder: boolean;
    shuffleAnswerOrder: boolean;
    showExplanationAfterEachAnswer: boolean;
    showExplanationsOnlyAfterSubmit: boolean;
    retryIncorrectOnly: boolean;
    confidenceCheckBeforeAnswer: boolean;
    requirePassingQuizToUnlockNextChapter: boolean;
    reviewStylePreference: ReviewStylePreference;
    postChapterReviewCards: boolean;
    preferredExamplesCategoryDefault: ExampleContextPreference;
  };
  goals: {
    weeklyChapterGoal: number;
    // NOTE (SET-5): weeklyQuizGoal removed — it had no Settings control and no consumer
    // anywhere (pure dead schema). Stored values are dropped on next load.
    streakTrackingEnabled: boolean;
    showStreakOnHomeScreen: boolean;
    milestoneCelebration: boolean;
    badgeAnimation: boolean;
    remindIfUsualReadingTimeMissed: boolean;
    preferredReadingDays: string[];
  };
  notifications: {
    notificationsEnabled: boolean;
    readingReminderEnabled: boolean;
    reminderSchedule: ReminderSchedule;
    customReminderDays: string[];
    quietHoursStart: string;
    quietHoursEnd: string;
    chapterUnlockedNotification: boolean;
    streakReminderEnabled: boolean;
    badgeCelebrationEnabled: boolean;
    weeklyDigestEnabled: boolean;
    welcomeBackEnabled: boolean;
    productUpdates: boolean;
    promotionalEmail: boolean;
    reminderToneStyle: ReminderToneStyle;
  };
  library: {
    preferredCategories: string[];
    hiddenCategories: string[];
    recommendationPreference: RecommendationPreference;
    defaultLibrarySorting: DefaultLibrarySorting;
    showCompletedBooks: boolean;
    hideArchivedBooks: boolean;
    showReadingTimeEstimates: boolean;
    showDifficultyLabels: boolean;
    showBadgesAndPopularityMarkers: boolean;
    defaultExamplesFilter: ExampleContextPreference;
  };
  appearance: {
    theme: ThemePreference;
    accentColor: AccentColor;
    interfaceDensity: InterfaceDensity;
    reducedMotion: boolean;
    subtleAnimations: boolean;
    hoverEffects: boolean;
    cardStylePreference: CardStylePreference;
    stickyActionBars: boolean;
    keyboardShortcutHints: boolean;
    dateFormat: DateFormatPreference;
    timeFormat: TimeFormatPreference;
    language: LanguagePreference;
  };
  accessibility: {
    largerTextMode: boolean;
    highContrastMode: boolean;
    focusRingStrength: FocusRingStrength;
    screenReaderFriendlyMode: boolean;
    keyboardNavigationHelper: boolean;
    dyslexiaFriendlyFont: boolean;
    buttonSizePreference: ButtonSizePreference;
    tooltipTimingPreference: TooltipTimingPreference;
    readingRulerMode: boolean;
  };
  privacy: {
    analyticsParticipation: boolean;
    personalizedRecommendations: boolean;
    saveReadingHistory: boolean;
    // NOTE: saveQuizHistory / saveNotes were declared here but had no UI control
    // and no server-side gating anywhere (unlike saveReadingHistory, which IS
    // honored in the reading-sessions/dashboard/export routes). They were dead
    // schema surface implying privacy consents that did not exist, so they were
    // removed until the behavior is actually implemented. See P17.
  };
  extended: ExtendedSettings;
  whatsNewSeenAt: string | null;
};

const STORAGE_KEY = "book-accelerator:preferences:v2";
// Tracks the server `updatedAt` (ISO string) of the last settings snapshot this
// device successfully reconciled with. Used to decide, on load, whether the
// server copy is newer than what this device last saw — so settings changed on
// another device are no longer silently discarded just because this device has
// existing localStorage. See H27.
const LAST_SYNCED_KEY = "book-accelerator:preferences:last-synced-at:v2";
const LEGACY_STORAGE_KEY = "book-accelerator:preferences:v1";
const LEGACY_EXT_STORAGE_KEY = "book-accelerator:settings-ext:v1";
const LEGACY_ONBOARDING_KEY = "book-accelerator:onboarding:v5";
const WEEKDAY_OPTIONS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

export const defaultBookPreferencesState: BookPreferencesState = {
  reading: {
    defaultChapterTab: "summary",
    // Long-form comfort default (finding #13). Range 12-24 + per-user control
    // unchanged; Apple Books/Kindle effective long-form defaults run higher.
    fontSize: 18,
    lineSpacing: 155,
    // Equals the "Narrow" preset (WIDTH_OPTIONS in ReaderSettingsMenu, ~68ch at
    // 18px) so the lit Width segment matches the rendered width (finding #9).
    // 680 matched no preset and lit "Narrow" while actually rendering wider.
    contentWidth: 640,
    paragraphDensity: "balanced",
    focusModeDefault: false,
    showProgressBar: true,
    showKeyTakeawaysByDefault: true,
    resumeWhereLeftOff: true,
    openNextUnlockedChapterAutomatically: true,
    showReadingSessionTimer: true,
    showEstimatedReadingTime: true,
  },
  learning: {
    questionPresentationStyle: "one-by-one",
    shuffleQuestionOrder: false,
    shuffleAnswerOrder: false,
    showExplanationAfterEachAnswer: true,
    showExplanationsOnlyAfterSubmit: false,
    retryIncorrectOnly: true,
    confidenceCheckBeforeAnswer: false,
    requirePassingQuizToUnlockNextChapter: false,
    reviewStylePreference: "summary-plus-examples",
    postChapterReviewCards: true,
    preferredExamplesCategoryDefault: "all",
  },
  goals: {
    weeklyChapterGoal: 3,
    streakTrackingEnabled: true,
    showStreakOnHomeScreen: true,
    milestoneCelebration: true,
    badgeAnimation: true,
    remindIfUsualReadingTimeMissed: true,
    preferredReadingDays: ["Mon", "Tue", "Wed", "Thu", "Fri"],
  },
  notifications: {
    notificationsEnabled: true,
    readingReminderEnabled: true,
    reminderSchedule: "weekdays",
    customReminderDays: ["Mon", "Tue", "Wed", "Thu", "Fri"],
    quietHoursStart: "22:00",
    quietHoursEnd: "07:00",
    chapterUnlockedNotification: true,
    streakReminderEnabled: true,
    badgeCelebrationEnabled: true,
    weeklyDigestEnabled: true,
    welcomeBackEnabled: true,
    productUpdates: true,
    promotionalEmail: false,
    reminderToneStyle: "subtle",
  },
  library: {
    preferredCategories: [],
    hiddenCategories: [],
    recommendationPreference: "balanced",
    defaultLibrarySorting: "recommended",
    showCompletedBooks: true,
    hideArchivedBooks: true,
    showReadingTimeEstimates: true,
    showDifficultyLabels: true,
    showBadgesAndPopularityMarkers: true,
    defaultExamplesFilter: "all",
  },
  appearance: {
    theme: "light",
    accentColor: "sky",
    interfaceDensity: "comfortable",
    reducedMotion: false,
    subtleAnimations: true,
    hoverEffects: true,
    cardStylePreference: "soft-glass",
    stickyActionBars: true,
    keyboardShortcutHints: true,
    dateFormat: "month-day-year",
    timeFormat: "12h",
    language: "English",
  },
  accessibility: {
    largerTextMode: false,
    highContrastMode: false,
    focusRingStrength: "strong",
    screenReaderFriendlyMode: false,
    keyboardNavigationHelper: true,
    dyslexiaFriendlyFont: false,
    buttonSizePreference: "standard",
    tooltipTimingPreference: "balanced",
    readingRulerMode: false,
  },
  privacy: {
    // Usage analytics is opt-in (off by default) for CASL/GDPR alignment.
    analyticsParticipation: false,
    personalizedRecommendations: true,
    saveReadingHistory: true,
  },
  extended: defaultExtendedSettings,
  whatsNewSeenAt: null,
};

function parseNumber(value: unknown, fallback: number, min: number, max: number) {
  if (typeof value !== "number" || Number.isNaN(value)) return fallback;
  return Math.min(Math.max(value, min), max);
}

function parseBoolean(value: unknown, fallback: boolean) {
  return typeof value === "boolean" ? value : fallback;
}

function parseString<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === "string" && allowed.includes(value as T) ? (value as T) : fallback;
}

function parseStringArray(value: unknown, allowed?: readonly string[]) {
  if (!Array.isArray(value)) return [];
  const set = new Set(allowed ?? value.filter((item): item is string => typeof item === "string"));
  return value.filter((item): item is string => typeof item === "string" && set.has(item));
}

function fontDefaultToSize(fontDefault: ReaderFontDefault | undefined): number {
  if (fontDefault === "sm") return 15;
  if (fontDefault === "lg") return 18;
  return 16;
}

function parseLegacyState(raw: string | null): BookPreferencesState | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as {
      dailyReminderEnabled?: boolean;
      streakReminderEnabled?: boolean;
      reducedMotion?: boolean;
      fontDefault?: ReaderFontDefault;
      whatsNewSeenAt?: string | null;
    };

    return {
      ...defaultBookPreferencesState,
      reading: {
        ...defaultBookPreferencesState.reading,
        fontSize: fontDefaultToSize(parsed.fontDefault),
      },
      notifications: {
        ...defaultBookPreferencesState.notifications,
        readingReminderEnabled: parseBoolean(
          parsed.dailyReminderEnabled,
          defaultBookPreferencesState.notifications.readingReminderEnabled
        ),
        streakReminderEnabled: parseBoolean(
          parsed.streakReminderEnabled,
          defaultBookPreferencesState.notifications.streakReminderEnabled
        ),
      },
      appearance: {
        ...defaultBookPreferencesState.appearance,
        reducedMotion: parseBoolean(
          parsed.reducedMotion,
          defaultBookPreferencesState.appearance.reducedMotion
        ),
        subtleAnimations: !parseBoolean(
          parsed.reducedMotion,
          defaultBookPreferencesState.appearance.reducedMotion
        ),
      },
      whatsNewSeenAt:
        typeof parsed.whatsNewSeenAt === "string" || parsed.whatsNewSeenAt === null
          ? parsed.whatsNewSeenAt
          : defaultBookPreferencesState.whatsNewSeenAt,
    };
  } catch {
    return null;
  }
}

function parseSectionStates(
  value: unknown,
  fallback: Record<string, boolean>
): Record<string, boolean> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return fallback;
  const result: Record<string, boolean> = { ...fallback };
  for (const [k, v] of Object.entries(value)) {
    if (typeof v === "boolean") result[k] = v;
  }
  return result;
}

function parseExtendedSettings(ext: Partial<ExtendedSettings>): ExtendedSettings {
  const d = defaultExtendedSettings;
  return {
    readingProfile: parseString(ext.readingProfile, ["quick", "balanced", "deep"] as const, d.readingProfile),
    fontFamily: parseString(ext.fontFamily, ["serif", "sans-serif", "opendyslexic"] as const, d.fontFamily),
    lineSpacing: parseString(ext.lineSpacing, ["compact", "comfortable", "relaxed"] as const, d.lineSpacing),
    letterSpacing: parseString(ext.letterSpacing, ["tight", "normal", "wide"] as const, d.letterSpacing),
    // NOTE: ttsVoice / ttsAutoAdvance were stored + synced here but had no
    // backend (one hardcoded narration voice, no voice param) and no reader
    // consumer, so they were removed (SET-2). ttsSpeed stays — it is now wired
    // into the reader's AudioPlayer (seeds + persists the listener's speed).
    ttsSpeed: parseNumber(ext.ttsSpeed, d.ttsSpeed, 0.5, 2.0),
    learningMode: parseString(ext.learningMode, ["guided", "standard", "challenge"] as const, d.learningMode),
    streakMode: parseString(ext.streakMode, ["off", "standard", "flexible"] as const, d.streakMode),
    streakSkipDays: parseNumber(ext.streakSkipDays, d.streakSkipDays, 0, 3),
    motivationPersona: parseString(ext.motivationPersona, ["coach", "partner", "rival"] as const, d.motivationPersona),
    contentTone: parseString(ext.contentTone, ["gentle", "direct", "competitive"] as const, d.contentTone),
    quizStyle: parseString(ext.quizStyle, ["comfortable", "challenge", "surprise"] as const, d.quizStyle),
    dailyGoalPreset: parseNumber(ext.dailyGoalPreset, d.dailyGoalPreset, 5, 30) as ExtendedSettings["dailyGoalPreset"],
    spacedRepetitionTarget: parseNumber(ext.spacedRepetitionTarget, d.spacedRepetitionTarget, 70, 95),
    scheduledDarkMode: parseBoolean(ext.scheduledDarkMode, d.scheduledDarkMode),
    darkModeFrom: typeof ext.darkModeFrom === "string" ? ext.darkModeFrom : d.darkModeFrom,
    darkModeTo: typeof ext.darkModeTo === "string" ? ext.darkModeTo : d.darkModeTo,
    colorBlindMode: parseString(ext.colorBlindMode, ["off", "protanopia", "deuteranopia", "tritanopia"] as const, d.colorBlindMode),
    breakReminders: parseBoolean(ext.breakReminders, d.breakReminders),
    breakReminderMinutes: parseNumber(ext.breakReminderMinutes, d.breakReminderMinutes, 5, 120),
    personalizationDismissed: parseBoolean(ext.personalizationDismissed, d.personalizationDismissed),
    sectionStates: parseSectionStates(ext.sectionStates, d.sectionStates),
    profileCustomized: parseBoolean(ext.profileCustomized, d.profileCustomized),
  };
}

function parseStored(raw: string | null): BookPreferencesState | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<BookPreferencesState>;
    const reading: Partial<BookPreferencesState["reading"]> = parsed.reading ?? {};
    const learning: Partial<BookPreferencesState["learning"]> = parsed.learning ?? {};
    const goals: Partial<BookPreferencesState["goals"]> = parsed.goals ?? {};
    const notifications: Partial<BookPreferencesState["notifications"]> = parsed.notifications ?? {};
    const library: Partial<BookPreferencesState["library"]> = parsed.library ?? {};
    const appearance: Partial<BookPreferencesState["appearance"]> = parsed.appearance ?? {};
    const accessibility: Partial<BookPreferencesState["accessibility"]> = parsed.accessibility ?? {};
    const privacy: Partial<BookPreferencesState["privacy"]> = parsed.privacy ?? {};
    const ext: Partial<ExtendedSettings> = parsed.extended ?? {};

    return {
      reading: {
        defaultChapterTab: parseString(
          reading.defaultChapterTab,
          ["summary", "examples", "quiz"] as const,
          defaultBookPreferencesState.reading.defaultChapterTab
        ),
        fontSize: parseNumber(reading.fontSize, defaultBookPreferencesState.reading.fontSize, 12, 24),
        lineSpacing: parseNumber(
          reading.lineSpacing,
          defaultBookPreferencesState.reading.lineSpacing,
          130,
          190
        ),
        contentWidth: parseNumber(
          reading.contentWidth,
          defaultBookPreferencesState.reading.contentWidth,
          640,
          960
        ),
        paragraphDensity: parseString(
          reading.paragraphDensity,
          ["airy", "balanced", "dense"] as const,
          defaultBookPreferencesState.reading.paragraphDensity
        ),
        focusModeDefault: parseBoolean(
          reading.focusModeDefault,
          defaultBookPreferencesState.reading.focusModeDefault
        ),
        showProgressBar: parseBoolean(
          reading.showProgressBar,
          defaultBookPreferencesState.reading.showProgressBar
        ),
        showKeyTakeawaysByDefault: parseBoolean(
          reading.showKeyTakeawaysByDefault,
          defaultBookPreferencesState.reading.showKeyTakeawaysByDefault
        ),
        resumeWhereLeftOff: parseBoolean(
          reading.resumeWhereLeftOff,
          defaultBookPreferencesState.reading.resumeWhereLeftOff
        ),
        openNextUnlockedChapterAutomatically: parseBoolean(
          reading.openNextUnlockedChapterAutomatically,
          defaultBookPreferencesState.reading.openNextUnlockedChapterAutomatically
        ),
        showReadingSessionTimer: parseBoolean(
          reading.showReadingSessionTimer,
          defaultBookPreferencesState.reading.showReadingSessionTimer
        ),
        showEstimatedReadingTime: parseBoolean(
          reading.showEstimatedReadingTime,
          defaultBookPreferencesState.reading.showEstimatedReadingTime
        ),
      },
      learning: {
        questionPresentationStyle: parseString(
          learning.questionPresentationStyle,
          ["all-at-once", "one-by-one"] as const,
          defaultBookPreferencesState.learning.questionPresentationStyle
        ),
        shuffleQuestionOrder: parseBoolean(
          learning.shuffleQuestionOrder,
          defaultBookPreferencesState.learning.shuffleQuestionOrder
        ),
        shuffleAnswerOrder: parseBoolean(
          learning.shuffleAnswerOrder,
          defaultBookPreferencesState.learning.shuffleAnswerOrder
        ),
        showExplanationAfterEachAnswer: parseBoolean(
          learning.showExplanationAfterEachAnswer,
          defaultBookPreferencesState.learning.showExplanationAfterEachAnswer
        ),
        showExplanationsOnlyAfterSubmit: parseBoolean(
          learning.showExplanationsOnlyAfterSubmit,
          defaultBookPreferencesState.learning.showExplanationsOnlyAfterSubmit
        ),
        retryIncorrectOnly: parseBoolean(
          learning.retryIncorrectOnly,
          defaultBookPreferencesState.learning.retryIncorrectOnly
        ),
        confidenceCheckBeforeAnswer: parseBoolean(
          learning.confidenceCheckBeforeAnswer,
          defaultBookPreferencesState.learning.confidenceCheckBeforeAnswer
        ),
        requirePassingQuizToUnlockNextChapter: parseBoolean(
          learning.requirePassingQuizToUnlockNextChapter,
          defaultBookPreferencesState.learning.requirePassingQuizToUnlockNextChapter
        ),
        reviewStylePreference: parseString(
          learning.reviewStylePreference,
          ["summary-only", "summary-plus-examples", "full-review"] as const,
          defaultBookPreferencesState.learning.reviewStylePreference
        ),
        postChapterReviewCards: parseBoolean(
          learning.postChapterReviewCards,
          defaultBookPreferencesState.learning.postChapterReviewCards
        ),
        preferredExamplesCategoryDefault: parseString(
          learning.preferredExamplesCategoryDefault,
          ["all", "personal", "school", "work"] as const,
          defaultBookPreferencesState.learning.preferredExamplesCategoryDefault
        ),
      },
      goals: {
        weeklyChapterGoal: parseNumber(
          goals.weeklyChapterGoal,
          defaultBookPreferencesState.goals.weeklyChapterGoal,
          0,
          14
        ),
        streakTrackingEnabled: parseBoolean(
          goals.streakTrackingEnabled,
          defaultBookPreferencesState.goals.streakTrackingEnabled
        ),
        showStreakOnHomeScreen: parseBoolean(
          goals.showStreakOnHomeScreen,
          defaultBookPreferencesState.goals.showStreakOnHomeScreen
        ),
        milestoneCelebration: parseBoolean(
          goals.milestoneCelebration,
          defaultBookPreferencesState.goals.milestoneCelebration
        ),
        badgeAnimation: parseBoolean(
          goals.badgeAnimation,
          defaultBookPreferencesState.goals.badgeAnimation
        ),
        remindIfUsualReadingTimeMissed: parseBoolean(
          goals.remindIfUsualReadingTimeMissed,
          defaultBookPreferencesState.goals.remindIfUsualReadingTimeMissed
        ),
        preferredReadingDays:
          parseStringArray(goals.preferredReadingDays, WEEKDAY_OPTIONS).length > 0
            ? parseStringArray(goals.preferredReadingDays, WEEKDAY_OPTIONS)
            : defaultBookPreferencesState.goals.preferredReadingDays,
      },
      notifications: {
        notificationsEnabled: parseBoolean(
          notifications.notificationsEnabled,
          defaultBookPreferencesState.notifications.notificationsEnabled
        ),
        readingReminderEnabled: parseBoolean(
          notifications.readingReminderEnabled,
          defaultBookPreferencesState.notifications.readingReminderEnabled
        ),
        reminderSchedule: parseString(
          notifications.reminderSchedule,
          ["daily", "weekdays", "custom"] as const,
          defaultBookPreferencesState.notifications.reminderSchedule
        ),
        customReminderDays:
          parseStringArray(notifications.customReminderDays, WEEKDAY_OPTIONS).length > 0
            ? parseStringArray(notifications.customReminderDays, WEEKDAY_OPTIONS)
            : defaultBookPreferencesState.notifications.customReminderDays,
        quietHoursStart:
          typeof notifications.quietHoursStart === "string"
            ? notifications.quietHoursStart
            : defaultBookPreferencesState.notifications.quietHoursStart,
        quietHoursEnd:
          typeof notifications.quietHoursEnd === "string"
            ? notifications.quietHoursEnd
            : defaultBookPreferencesState.notifications.quietHoursEnd,
        chapterUnlockedNotification: parseBoolean(
          notifications.chapterUnlockedNotification,
          defaultBookPreferencesState.notifications.chapterUnlockedNotification
        ),
        streakReminderEnabled: parseBoolean(
          notifications.streakReminderEnabled ?? (notifications as Record<string, unknown>).streakReminder,
          defaultBookPreferencesState.notifications.streakReminderEnabled
        ),
        badgeCelebrationEnabled: parseBoolean(
          notifications.badgeCelebrationEnabled ?? (notifications as Record<string, unknown>).badgeEarnedNotification,
          defaultBookPreferencesState.notifications.badgeCelebrationEnabled
        ),
        weeklyDigestEnabled: parseBoolean(
          notifications.weeklyDigestEnabled ?? (notifications as Record<string, unknown>).weeklyLearningSummaryEmail,
          defaultBookPreferencesState.notifications.weeklyDigestEnabled
        ),
        welcomeBackEnabled: parseBoolean(
          notifications.welcomeBackEnabled,
          defaultBookPreferencesState.notifications.welcomeBackEnabled
        ),
        productUpdates: parseBoolean(
          notifications.productUpdates,
          defaultBookPreferencesState.notifications.productUpdates
        ),
        promotionalEmail: parseBoolean(
          notifications.promotionalEmail,
          defaultBookPreferencesState.notifications.promotionalEmail
        ),
        reminderToneStyle: parseString(
          notifications.reminderToneStyle,
          ["subtle", "motivating", "direct"] as const,
          defaultBookPreferencesState.notifications.reminderToneStyle
        ),
      },
      library: {
        preferredCategories: parseStringArray(library.preferredCategories),
        hiddenCategories: parseStringArray(library.hiddenCategories),
        recommendationPreference: parseString(
          library.recommendationPreference,
          ["easiest-first", "balanced", "challenging-first", "most-popular"] as const,
          defaultBookPreferencesState.library.recommendationPreference
        ),
        defaultLibrarySorting: parseString(
          library.defaultLibrarySorting,
          [
            "recommended",
            "recently-opened",
            "shortest-read",
            "longest-read",
            "alphabetical",
          ] as const,
          defaultBookPreferencesState.library.defaultLibrarySorting
        ),
        showCompletedBooks: parseBoolean(
          library.showCompletedBooks,
          defaultBookPreferencesState.library.showCompletedBooks
        ),
        hideArchivedBooks: parseBoolean(
          library.hideArchivedBooks,
          defaultBookPreferencesState.library.hideArchivedBooks
        ),
        showReadingTimeEstimates: parseBoolean(
          library.showReadingTimeEstimates,
          defaultBookPreferencesState.library.showReadingTimeEstimates
        ),
        showDifficultyLabels: parseBoolean(
          library.showDifficultyLabels,
          defaultBookPreferencesState.library.showDifficultyLabels
        ),
        showBadgesAndPopularityMarkers: parseBoolean(
          library.showBadgesAndPopularityMarkers,
          defaultBookPreferencesState.library.showBadgesAndPopularityMarkers
        ),
        defaultExamplesFilter: parseString(
          library.defaultExamplesFilter,
          ["all", "personal", "school", "work"] as const,
          defaultBookPreferencesState.library.defaultExamplesFilter
        ),
      },
      appearance: {
        theme: parseString(
          appearance.theme,
          ["dark", "light", "system"] as const,
          defaultBookPreferencesState.appearance.theme
        ),
        accentColor: parseString(
          appearance.accentColor,
          ["sky", "emerald", "amber", "rose"] as const,
          defaultBookPreferencesState.appearance.accentColor
        ),
        interfaceDensity: parseString(
          appearance.interfaceDensity,
          ["compact", "comfortable", "spacious"] as const,
          defaultBookPreferencesState.appearance.interfaceDensity
        ),
        reducedMotion: parseBoolean(
          appearance.reducedMotion,
          defaultBookPreferencesState.appearance.reducedMotion
        ),
        subtleAnimations: parseBoolean(
          appearance.subtleAnimations,
          defaultBookPreferencesState.appearance.subtleAnimations
        ),
        hoverEffects: parseBoolean(
          appearance.hoverEffects,
          defaultBookPreferencesState.appearance.hoverEffects
        ),
        cardStylePreference: parseString(
          appearance.cardStylePreference,
          ["soft-glass", "flat-minimal", "elevated"] as const,
          defaultBookPreferencesState.appearance.cardStylePreference
        ),
        stickyActionBars: parseBoolean(
          appearance.stickyActionBars,
          defaultBookPreferencesState.appearance.stickyActionBars
        ),
        keyboardShortcutHints: parseBoolean(
          appearance.keyboardShortcutHints,
          defaultBookPreferencesState.appearance.keyboardShortcutHints
        ),
        dateFormat: parseString(
          appearance.dateFormat,
          ["month-day-year", "day-month-year", "year-month-day"] as const,
          defaultBookPreferencesState.appearance.dateFormat
        ),
        timeFormat: parseString(
          appearance.timeFormat,
          ["12h", "24h"] as const,
          defaultBookPreferencesState.appearance.timeFormat
        ),
        language: parseString(
          appearance.language,
          ["English", "English (Canada)", "English (United States)"] as const,
          defaultBookPreferencesState.appearance.language
        ),
      },
      accessibility: {
        largerTextMode: parseBoolean(
          accessibility.largerTextMode,
          defaultBookPreferencesState.accessibility.largerTextMode
        ),
        highContrastMode: parseBoolean(
          accessibility.highContrastMode,
          defaultBookPreferencesState.accessibility.highContrastMode
        ),
        focusRingStrength: parseString(
          accessibility.focusRingStrength,
          ["standard", "strong", "maximum"] as const,
          defaultBookPreferencesState.accessibility.focusRingStrength
        ),
        screenReaderFriendlyMode: parseBoolean(
          accessibility.screenReaderFriendlyMode,
          defaultBookPreferencesState.accessibility.screenReaderFriendlyMode
        ),
        keyboardNavigationHelper: parseBoolean(
          accessibility.keyboardNavigationHelper,
          defaultBookPreferencesState.accessibility.keyboardNavigationHelper
        ),
        dyslexiaFriendlyFont: parseBoolean(
          accessibility.dyslexiaFriendlyFont,
          defaultBookPreferencesState.accessibility.dyslexiaFriendlyFont
        ),
        buttonSizePreference: parseString(
          accessibility.buttonSizePreference,
          ["standard", "large"] as const,
          defaultBookPreferencesState.accessibility.buttonSizePreference
        ),
        tooltipTimingPreference: parseString(
          accessibility.tooltipTimingPreference,
          ["fast", "balanced", "extended"] as const,
          defaultBookPreferencesState.accessibility.tooltipTimingPreference
        ),
        readingRulerMode: parseBoolean(
          accessibility.readingRulerMode,
          defaultBookPreferencesState.accessibility.readingRulerMode
        ),
      },
      privacy: {
        analyticsParticipation: parseBoolean(
          privacy.analyticsParticipation,
          defaultBookPreferencesState.privacy.analyticsParticipation
        ),
        personalizedRecommendations: parseBoolean(
          privacy.personalizedRecommendations,
          defaultBookPreferencesState.privacy.personalizedRecommendations
        ),
        saveReadingHistory: parseBoolean(
          privacy.saveReadingHistory,
          defaultBookPreferencesState.privacy.saveReadingHistory
        ),
      },
      extended: parseExtendedSettings(ext),
      whatsNewSeenAt:
        typeof parsed.whatsNewSeenAt === "string" || parsed.whatsNewSeenAt === null
          ? parsed.whatsNewSeenAt
          : defaultBookPreferencesState.whatsNewSeenAt,
    };
  } catch {
    return null;
  }
}

/**
 * The onboarding-complete route (app/app/api/book/me/onboarding/complete) saves
 * the user's tone / chapter-order / daily-goal picks under `settings.onboarding`
 * (and hoists tone/chapterOrder/dailyGoal to the top level) but never writes them
 * into the `extended` / `reading` shapes the reader actually reads from. Map those
 * picks onto the fields the reader consumes — but only when the user has not
 * already chosen an explicit value — so a fresh device (which only has the server
 * copy, not the localStorage seed below) still honors the onboarding tone and
 * chapter-start order instead of silently falling back to defaults. See H21.
 */
function applyOnboardingDefaults(settings: Record<string, unknown>): Record<string, unknown> {
  const isObject = (v: unknown): v is Record<string, unknown> =>
    typeof v === "object" && v !== null && !Array.isArray(v);

  const onboarding = isObject(settings.onboarding) ? settings.onboarding : {};
  // Prefer the nested onboarding profile, fall back to the hoisted top-level copy.
  const fromOnboarding = (key: string): unknown =>
    onboarding[key] !== undefined ? onboarding[key] : settings[key];

  const ext: Record<string, unknown> = { ...(isObject(settings.extended) ? settings.extended : {}) };
  const reading: Record<string, unknown> = { ...(isObject(settings.reading) ? settings.reading : {}) };

  // Tone → reader content tone (identical value space: gentle | direct | competitive).
  const tone = fromOnboarding("tone");
  if (ext.contentTone === undefined && (tone === "gentle" || tone === "direct" || tone === "competitive")) {
    ext.contentTone = tone;
  }

  // Daily goal → the daily-goal preset the reader reads (10/20/30 are valid presets).
  const dailyGoal = fromOnboarding("dailyGoal");
  if (ext.dailyGoalPreset === undefined && (dailyGoal === 10 || dailyGoal === 20 || dailyGoal === 30)) {
    ext.dailyGoalPreset = dailyGoal;
  }

  // Chapter order → which tab a chapter opens on. Only "scenarios_first" diverges
  // from the existing default tab ("summary"), so that's the only case to map.
  const chapterOrder = fromOnboarding("chapterOrder");
  if (reading.defaultChapterTab === undefined && chapterOrder === "scenarios_first") {
    reading.defaultChapterTab = "examples";
  }

  return { ...settings, extended: ext, reading };
}

export function useBookPreferences() {
  const [hydrated, setHydrated] = useState(false);
  const [state, setState] = useState<BookPreferencesState>(defaultBookPreferencesState);
  // Prevents write-back on the state change caused by loading server settings.
  const skipNextServerSave = useRef(false);
  // Tracks whether localStorage had saved preferences on mount.
  // If true, server data is applied only when it is strictly newer than the
  // snapshot this device last reconciled with (see lastSyncedAt / H27).
  const localStorageHadData = useRef(false);
  // The server `updatedAt` this device last saw, read from LAST_SYNCED_KEY on
  // mount. Lets the load effect tell "server has changes from another device"
  // (apply) apart from "server is just echoing our own last save" (ignore).
  const lastSyncedAt = useRef<string | null>(null);

  useEffect(() => {
    const storedRaw = window.localStorage.getItem(STORAGE_KEY);
    const legacyRaw = window.localStorage.getItem(LEGACY_STORAGE_KEY);
    const hadSaved = storedRaw !== null || legacyRaw !== null;
    localStorageHadData.current = hadSaved;
    lastSyncedAt.current = window.localStorage.getItem(LAST_SYNCED_KEY);

    let nextState =
      parseStored(storedRaw) ??
      parseLegacyState(legacyRaw) ??
      defaultBookPreferencesState;

    // Migrate orphaned extended settings from old localStorage key
    const legacyExt = window.localStorage.getItem(LEGACY_EXT_STORAGE_KEY);
    if (legacyExt) {
      try {
        const parsed = JSON.parse(legacyExt) as Partial<ExtendedSettings>;
        nextState = {
          ...nextState,
          extended: parseExtendedSettings({ ...nextState.extended, ...parsed }),
        };
      } catch {}
      window.localStorage.removeItem(LEGACY_EXT_STORAGE_KEY);
    }

    // Seed extended settings from onboarding ONLY on first-ever mount
    // (no stored preferences). Once preferences have been saved, never re-seed.
    if (!nextState.extended.profileCustomized && !hadSaved) {
      try {
        const onboardingRaw = window.localStorage.getItem(LEGACY_ONBOARDING_KEY);
        if (onboardingRaw) {
          const ob = JSON.parse(onboardingRaw) as Record<string, unknown>;
          const seeds: Partial<ExtendedSettings> = {};
          if (ob.motivationStyle === "gentle" || ob.motivationStyle === "direct" || ob.motivationStyle === "competitive") {
            seeds.contentTone = ob.motivationStyle;
          }
          if (typeof ob.quizIntensity === "string" && ob.quizIntensity in INTENSITY_TO_QUIZ_STYLE) {
            seeds.quizStyle = INTENSITY_TO_QUIZ_STYLE[ob.quizIntensity as keyof typeof INTENSITY_TO_QUIZ_STYLE];
          }
          const learningMap: Record<string, ExtendedSettings["learningMode"]> = {
            concise: "guided", balanced: "standard", deep: "challenge",
          };
          if (typeof ob.learningStyle === "string" && ob.learningStyle in learningMap) {
            seeds.learningMode = learningMap[ob.learningStyle];
          }
          if (ob.dailyGoalMinutes === 10 || ob.dailyGoalMinutes === 20 || ob.dailyGoalMinutes === 30) {
            seeds.dailyGoalPreset = ob.dailyGoalMinutes;
          }
          // The new /onboarding flow records its chapter-order pick here as
          // chapterStartMode; only "practical-first" diverges from the default
          // ("summary") tab, so that's the only value worth seeding.
          const seededChapterTab =
            ob.chapterStartMode === "practical-first" ? "examples" : undefined;
          if (Object.keys(seeds).length > 0 || seededChapterTab) {
            nextState = {
              ...nextState,
              reading: seededChapterTab
                ? { ...nextState.reading, defaultChapterTab: seededChapterTab }
                : nextState.reading,
              extended: parseExtendedSettings({ ...nextState.extended, ...seeds }),
            };
          }
        }
      } catch {}
    }

    setState(nextState);
    setHydrated(true);
  }, []);

  useEffect(() => {
    fetchBookJsonCached<{ settings: Record<string, unknown> | null; updatedAt: string | null }>(
      SETTINGS_KEY
    )
      .then((payload) => {
        if (!payload.settings) return;

        // Decide whether the server copy should overwrite local state. Two cases
        // apply it (see H27):
        //   1. This device has no saved preferences (fresh device / first login).
        //   2. The server item is strictly newer than the snapshot this device
        //      last reconciled with — i.e. it carries changes made on another
        //      device that this stale device must not clobber on its next save.
        // Comparing payload.updatedAt against the locally-remembered last-synced
        // timestamp distinguishes "another device wrote newer values" from the
        // server merely echoing this device's own last save.
        const serverUpdatedAt = payload.updatedAt;
        const serverIsNewer =
          typeof serverUpdatedAt === "string" &&
          (lastSyncedAt.current === null || serverUpdatedAt > lastSyncedAt.current);
        const shouldApplyServer = !localStorageHadData.current || serverIsNewer;

        // Always record what we have now seen from the server so the save effect
        // and subsequent loads can reconcile correctly, regardless of whether we
        // apply the server copy this time.
        if (typeof serverUpdatedAt === "string") {
          lastSyncedAt.current = serverUpdatedAt;
          window.localStorage.setItem(LAST_SYNCED_KEY, serverUpdatedAt);
        }

        if (shouldApplyServer) {
          skipNextServerSave.current = true;
          // Hydrate the reader's tone / chapter-start order / daily goal from the
          // onboarding picks the server persisted (settings.onboarding + hoisted
          // copies) so a fresh device honors them instead of falling back to
          // defaults — the localStorage seed above only covers the same device.
          setState(
            parseStored(JSON.stringify(applyOnboardingDefaults(payload.settings))) ??
              defaultBookPreferencesState
          );
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [hydrated, state]);

  // Single source of truth for the document theme. The scheduled-dark-mode
  // evaluation is folded INTO this effect (instead of a second, independent
  // classList toggle) so the two no longer race: every appearance change and
  // every schedule tick re-applies the base theme first, then lets the schedule
  // override `.dark` only when the user is not already in permanent dark mode.
  // This also reverts to the base (light) theme at the window's end. See M44.
  //
  // NOTE: this effect only runs where useBookPreferences is mounted (Settings +
  // Chapter Reader). Applying the schedule on every route would require a global
  // theme client (and folding the schedule into app/_lib/document-theme.ts /
  // its bootstrap script) — both outside this task's editable file set, so the
  // app-wide coverage gap is flagged in the report rather than fixed here.
  useEffect(() => {
    if (!hydrated) return;

    const applyBaseTheme = () => {
      applyDocumentTheme({
        theme: state.appearance.theme,
        accentColor: state.appearance.accentColor,
        interfaceDensity: state.appearance.interfaceDensity,
        reducedMotion: state.appearance.reducedMotion,
        highContrastMode: state.accessibility.highContrastMode,
        focusRingStrength: state.accessibility.focusRingStrength,
      });
    };

    const scheduleActive =
      state.extended.scheduledDarkMode && state.appearance.theme !== "dark";

    const applySchedule = () => {
      const now = new Date();
      const mins = now.getHours() * 60 + now.getMinutes();
      const [startH, startM] = state.extended.darkModeFrom.split(":").map(Number);
      const [endH, endM] = state.extended.darkModeTo.split(":").map(Number);
      const start = (startH ?? NaN) * 60 + (startM ?? NaN);
      const end = (endH ?? NaN) * 60 + (endM ?? NaN);
      const isDark = start > end ? mins >= start || mins < end : mins >= start && mins < end;
      const root = document.documentElement;
      root.classList.toggle("dark", isDark);
      root.style.colorScheme = isDark ? "dark" : "light";
    };

    const evaluate = () => {
      // Re-apply the base theme every tick so the schedule reverts cleanly to
      // the user's chosen theme at the window boundary instead of getting stuck
      // dark once the window ends.
      applyBaseTheme();
      if (scheduleActive) applySchedule();
    };

    evaluate();
    window.dispatchEvent(new Event("book-theme-change"));

    if (!scheduleActive) return;
    const interval = window.setInterval(evaluate, 60000);
    return () => window.clearInterval(interval);
  }, [
    hydrated,
    state.appearance.theme,
    state.appearance.accentColor,
    state.appearance.interfaceDensity,
    state.appearance.reducedMotion,
    state.accessibility.highContrastMode,
    state.accessibility.focusRingStrength,
    state.extended.scheduledDarkMode,
    state.extended.darkModeFrom,
    state.extended.darkModeTo,
  ]);

  // Apply CSS variables for extended reading settings
  useEffect(() => {
    if (!hydrated) return;
    const root = document.documentElement;

    const fontMap: Record<string, string> = {
      // NS-1: the literary serif reading voice. Repointed Georgia -> the crafted
      // Newsreader stack (--font-reading, defined in globals.css, self-hosted via
      // next/font in app/layout.tsx). This var only ever reaches reading prose
      // (.cr-reading-content); chrome is pinned to --font-body, so flipping the
      // stored default to "serif" (defaults.ts, batch 10) cannot leak into chrome.
      "serif": "var(--font-reading)",
      // Map the Sans-Serif option (and the default fallback below) to the
      // already-loaded brand body font so the reading surface matches the rest
      // of the app. Inter was never loaded, so it always fell back to system-ui.
      // See L85.
      "sans-serif": "var(--font-jakarta), system-ui, sans-serif",
      "opendyslexic": '"OpenDyslexic", sans-serif',
    };
    root.style.setProperty(
      "--reading-font-family",
      fontMap[state.extended.fontFamily] || fontMap["sans-serif"] || "",
    );
    root.style.setProperty("--reading-font-size", `${state.reading.fontSize}px`);

    const lineMap: Record<string, string> = { compact: "1.4", comfortable: "1.6", relaxed: "1.8" };
    root.style.setProperty("--reading-line-height", lineMap[state.extended.lineSpacing] || "1.6");

    const letterMap: Record<string, string> = { tight: "-0.01em", normal: "0", wide: "0.03em" };
    root.style.setProperty(
      "--reading-letter-spacing",
      letterMap[state.extended.letterSpacing] || "0",
    );

    root.dataset.colorBlindMode = state.extended.colorBlindMode;
  }, [
    hydrated,
    state.reading.fontSize,
    state.extended.fontFamily,
    state.extended.lineSpacing,
    state.extended.letterSpacing,
    state.extended.colorBlindMode,
  ]);

  // Scheduled dark mode is now evaluated inside the consolidated theme effect
  // above (folded into the same source that owns `.dark`) so the two no longer
  // race. See M44.

  useEffect(() => {
    if (!hydrated) return;
    if (skipNextServerSave.current) {
      skipNextServerSave.current = false;
      return;
    }
    const timeout = window.setTimeout(() => {
      fetchBookJson<{ settings: Record<string, unknown>; updatedAt: string | null }>(
        "/app/api/book/me/settings",
        {
          method: "PATCH",
          body: JSON.stringify({ settings: state }),
        }
      )
        .then((payload) => {
          // Remember the server timestamp this save produced so the next load
          // recognizes the server echoing our own write (and does not re-apply
          // it as if it were a remote change). See H27.
          if (typeof payload.updatedAt === "string") {
            lastSyncedAt.current = payload.updatedAt;
            window.localStorage.setItem(LAST_SYNCED_KEY, payload.updatedAt);
          }
          // Refetch subscribed settings readers from the server echo of our own
          // write. Ordered AFTER recording lastSyncedAt so the refetch is
          // recognized as our own save (H27) and not re-applied as remote.
          invalidateBookCache(SETTINGS_KEY);
        })
        .catch((err) => console.error("[settings] server save failed:", err));
    }, 500);
    return () => window.clearTimeout(timeout);
  }, [hydrated, state]);

  const patchSection = useCallback(
    <K extends keyof BookPreferencesState>(section: K, values: Partial<BookPreferencesState[K]>) => {
      setState((prev) => {
        const currentSection = prev[section];
        if (typeof currentSection !== "object" || currentSection === null || Array.isArray(currentSection)) {
          return prev;
        }
        const nextSection = { ...currentSection, ...values };

        if (section === "learning") {
          const learningSection = nextSection as BookPreferencesState["learning"];
          if ("showExplanationAfterEachAnswer" in values && learningSection.showExplanationAfterEachAnswer) {
            learningSection.showExplanationsOnlyAfterSubmit = false;
          }
          if (
            "showExplanationsOnlyAfterSubmit" in values &&
            learningSection.showExplanationsOnlyAfterSubmit
          ) {
            learningSection.showExplanationAfterEachAnswer = false;
          }
        }

        if (section === "appearance") {
          const appearanceSection = nextSection as BookPreferencesState["appearance"];
          if (appearanceSection.reducedMotion) {
            appearanceSection.subtleAnimations = false;
          }
        }

        return { ...prev, [section]: nextSection };
      });
    },
    []
  );

  const patch = useCallback((values: Partial<BookPreferencesState>) => {
    setState((prev) => ({ ...prev, ...values }));
  }, []);

  const reset = useCallback(() => setState(defaultBookPreferencesState), []);

  return {
    hydrated,
    state,
    patch,
    patchSection,
    reset,
  };
}
