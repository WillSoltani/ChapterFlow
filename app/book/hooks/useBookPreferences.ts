"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { fetchBookJson } from "@/app/book/_lib/book-api";
import { applyDocumentTheme } from "@/app/_lib/document-theme";

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
    weeklyQuizGoal: number;
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
    streakReminder: boolean;
    badgeEarnedNotification: boolean;
    weeklyLearningSummaryEmail: boolean;
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
    saveQuizHistory: boolean;
    saveNotes: boolean;
  };
  whatsNewSeenAt: string | null;
};

const STORAGE_KEY = "book-accelerator:preferences:v2";
const LEGACY_STORAGE_KEY = "book-accelerator:preferences:v1";
const WEEKDAY_OPTIONS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

export const defaultBookPreferencesState: BookPreferencesState = {
  reading: {
    defaultChapterTab: "summary",
    fontSize: 16,
    lineSpacing: 155,
    contentWidth: 760,
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
    weeklyQuizGoal: 5,
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
    streakReminder: true,
    badgeEarnedNotification: true,
    weeklyLearningSummaryEmail: true,
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
    analyticsParticipation: true,
    personalizedRecommendations: true,
    saveReadingHistory: true,
    saveQuizHistory: true,
    saveNotes: true,
  },
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
        streakReminder: parseBoolean(
          parsed.streakReminderEnabled,
          defaultBookPreferencesState.notifications.streakReminder
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

    return {
      reading: {
        defaultChapterTab: parseString(
          reading.defaultChapterTab,
          ["summary", "examples", "quiz"] as const,
          defaultBookPreferencesState.reading.defaultChapterTab
        ),
        fontSize: parseNumber(reading.fontSize, defaultBookPreferencesState.reading.fontSize, 14, 20),
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
        weeklyQuizGoal: parseNumber(
          goals.weeklyQuizGoal,
          defaultBookPreferencesState.goals.weeklyQuizGoal,
          0,
          21
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
        streakReminder: parseBoolean(
          notifications.streakReminder,
          defaultBookPreferencesState.notifications.streakReminder
        ),
        badgeEarnedNotification: parseBoolean(
          notifications.badgeEarnedNotification,
          defaultBookPreferencesState.notifications.badgeEarnedNotification
        ),
        weeklyLearningSummaryEmail: parseBoolean(
          notifications.weeklyLearningSummaryEmail,
          defaultBookPreferencesState.notifications.weeklyLearningSummaryEmail
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
        saveQuizHistory: parseBoolean(
          privacy.saveQuizHistory,
          defaultBookPreferencesState.privacy.saveQuizHistory
        ),
        saveNotes: parseBoolean(
          privacy.saveNotes,
          defaultBookPreferencesState.privacy.saveNotes
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

export function useBookPreferences() {
  const [hydrated, setHydrated] = useState(false);
  const [state, setState] = useState<BookPreferencesState>(defaultBookPreferencesState);
  const [serverReady, setServerReady] = useState(false);
  // Prevents write-back on the state change caused by loading server settings.
  const skipNextServerSave = useRef(false);

  useEffect(() => {
    const nextState =
      parseStored(window.localStorage.getItem(STORAGE_KEY)) ??
      parseLegacyState(window.localStorage.getItem(LEGACY_STORAGE_KEY)) ??
      defaultBookPreferencesState;
    setState(nextState);
    setHydrated(true);
  }, []);

  useEffect(() => {
    let mounted = true;
    fetchBookJson<{ settings: Partial<BookPreferencesState> | null }>("/app/api/book/me/settings")
      .then((payload) => {
        if (!mounted) return;
        if (payload.settings) {
          skipNextServerSave.current = true;
          setState(parseStored(JSON.stringify(payload.settings)) ?? defaultBookPreferencesState);
        }
        setServerReady(true);
      })
      .catch(() => {
        if (!mounted) return;
        setServerReady(true);
      });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [hydrated, state]);

  useEffect(() => {
    if (!hydrated) return;

    applyDocumentTheme({
      theme: state.appearance.theme,
      accentColor: state.appearance.accentColor,
      interfaceDensity: state.appearance.interfaceDensity,
      reducedMotion: state.appearance.reducedMotion,
      highContrastMode: state.accessibility.highContrastMode,
      focusRingStrength: state.accessibility.focusRingStrength,
    });
    window.dispatchEvent(new Event("book-theme-change"));
  }, [
    hydrated,
    state.appearance.theme,
    state.appearance.accentColor,
    state.appearance.interfaceDensity,
    state.appearance.reducedMotion,
    state.accessibility.highContrastMode,
    state.accessibility.focusRingStrength,
  ]);

  useEffect(() => {
    if (!hydrated || !serverReady) return;
    if (skipNextServerSave.current) {
      skipNextServerSave.current = false;
      return;
    }
    const timeout = window.setTimeout(() => {
      fetchBookJson("/app/api/book/me/settings", {
        method: "PATCH",
        body: JSON.stringify({ settings: state }),
      }).catch(() => {});
    }, 250);
    return () => window.clearTimeout(timeout);
  }, [hydrated, serverReady, state]);

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
