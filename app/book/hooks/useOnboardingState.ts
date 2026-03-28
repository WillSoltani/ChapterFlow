"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  type ChapterStartMode,
  type PreferredExampleContext,
  isChapterStartMode,
  isPreferredExampleContext,
} from "@/app/book/_lib/onboarding-personalization";
import { BOOKS_CATALOG } from "@/app/book/data/booksCatalog";

export type LearningStyle = "concise" | "balanced" | "deep";
export type QuizIntensity = "easy" | "standard" | "challenging";
export type MotivationStyle = "gentle" | "direct" | "competitive";
export type PronounOption =
  | "Prefer not to say"
  | "She / Her"
  | "He / Him"
  | "They / Them";
export type OccupationOption =
  | "Student"
  | "Professional"
  | "Entrepreneur"
  | "Creative"
  | "Other";
export type ReadingGoalOption =
  | "career"
  | "decisions"
  | "skills"
  | "personal"
  | "curiosity";
export type ReferralSourceOption =
  | "Social media"
  | "Word of mouth"
  | "Search engine"
  | "Newsletter"
  | "Other";

export type BookOnboardingState = {
  currentStep: number;
  setupComplete: boolean;
  completedAt: string | null;
  // Step 1 — optional personalization
  pronoun: PronounOption;
  occupation: OccupationOption | null;
  // Step 2 — what brings you here
  readingGoal: ReadingGoalOption | null;
  referralSource: ReferralSourceOption | null;
  referralSourceOtherText: string;
  // Step 3 — category interests
  selectedCategories: string[];
  // Step 4 — book selection
  selectedBookIds: string[];
  // Step 5 — daily goal
  dailyGoalMinutes: number;
  // Step 6 — preferences
  reminderTime: string;
  learningStyle: LearningStyle;
  chapterStartMode: ChapterStartMode;
  preferredExampleContext: PreferredExampleContext;
  quizIntensity: QuizIntensity;
  streakMode: boolean;
  motivationStyle: MotivationStyle;
};

const MAX_STEPS = 5;
const MAX_BOOK_SELECTION = 3;
const MAX_CATEGORY_SELECTION = 3;
const STORAGE_KEY = "book-accelerator:onboarding:v5";
const LEGACY_STORAGE_KEYS = [
  "book-accelerator:onboarding:v4",
  "book-accelerator:onboarding:v3",
  "book-accelerator:onboarding:v2",
] as const;
const STORAGE_KEYS = [STORAGE_KEY, ...LEGACY_STORAGE_KEYS] as const;
const AVAILABLE_BOOK_IDS = new Set(BOOKS_CATALOG.map((book) => book.id));
const PRONOUN_OPTIONS: readonly PronounOption[] = [
  "Prefer not to say",
  "She / Her",
  "He / Him",
  "They / Them",
];
const OCCUPATION_OPTIONS: readonly OccupationOption[] = [
  "Student",
  "Professional",
  "Entrepreneur",
  "Creative",
  "Other",
];
const READING_GOALS: readonly ReadingGoalOption[] = [
  "career",
  "decisions",
  "skills",
  "personal",
  "curiosity",
];
const REFERRAL_SOURCES: readonly ReferralSourceOption[] = [
  "Social media",
  "Word of mouth",
  "Search engine",
  "Newsletter",
  "Other",
];
const LEARNING_STYLES: readonly LearningStyle[] = ["concise", "balanced", "deep"];
const QUIZ_INTENSITIES: readonly QuizIntensity[] = ["easy", "standard", "challenging"];
const MOTIVATION_STYLES: readonly MotivationStyle[] = [
  "gentle",
  "direct",
  "competitive",
];

const defaultState: BookOnboardingState = {
  currentStep: 0,
  setupComplete: false,
  completedAt: null,
  pronoun: "Prefer not to say",
  occupation: null,
  readingGoal: null,
  referralSource: null,
  referralSourceOtherText: "",
  selectedCategories: [],
  selectedBookIds: [],
  dailyGoalMinutes: 20,
  reminderTime: "",
  learningStyle: "balanced",
  chapterStartMode: "balanced",
  preferredExampleContext: "all",
  quizIntensity: "standard",
  streakMode: true,
  motivationStyle: "gentle",
};

function clampStep(step: number) {
  return Math.min(Math.max(step, 0), MAX_STEPS - 1);
}

function clampGoal(goal: number) {
  return Math.min(Math.max(goal, 10), 240);
}

function isTimeValue(value: unknown): value is string {
  return typeof value === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

function pickEnumValue<T extends string>(
  value: unknown,
  options: readonly T[],
  fallback: T
): T {
  return typeof value === "string" && options.includes(value as T) ? (value as T) : fallback;
}

function pickNullableEnumValue<T extends string>(
  value: unknown,
  options: readonly T[]
): T | null {
  return typeof value === "string" && options.includes(value as T) ? (value as T) : null;
}

function parseStoredState(
  storageKey: (typeof STORAGE_KEYS)[number],
  value: string | null
): BookOnboardingState | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as Partial<BookOnboardingState>;
    const isLegacyKey = storageKey !== STORAGE_KEY;
    const reminderTime =
      isTimeValue(parsed.reminderTime) &&
      !(isLegacyKey && parsed.setupComplete !== true && parsed.reminderTime === "20:00")
        ? parsed.reminderTime
        : defaultState.reminderTime;

    return {
      ...defaultState,
      ...parsed,
      currentStep: clampStep(Number(parsed.currentStep ?? defaultState.currentStep)),
      setupComplete: parsed.setupComplete === true,
      completedAt:
        typeof parsed.completedAt === "string" ? parsed.completedAt : defaultState.completedAt,
      pronoun: pickEnumValue(parsed.pronoun, PRONOUN_OPTIONS, defaultState.pronoun),
      occupation: pickNullableEnumValue(parsed.occupation, OCCUPATION_OPTIONS),
      readingGoal: pickNullableEnumValue(parsed.readingGoal, READING_GOALS),
      referralSource: pickNullableEnumValue(parsed.referralSource, REFERRAL_SOURCES),
      referralSourceOtherText:
        typeof parsed.referralSourceOtherText === "string"
          ? parsed.referralSourceOtherText
          : defaultState.referralSourceOtherText,
      dailyGoalMinutes: clampGoal(
        Number(parsed.dailyGoalMinutes ?? defaultState.dailyGoalMinutes)
      ),
      reminderTime,
      learningStyle: pickEnumValue(
        parsed.learningStyle,
        LEARNING_STYLES,
        defaultState.learningStyle
      ),
      chapterStartMode: isChapterStartMode(parsed.chapterStartMode)
        ? parsed.chapterStartMode
        : defaultState.chapterStartMode,
      preferredExampleContext: isPreferredExampleContext(parsed.preferredExampleContext)
        ? parsed.preferredExampleContext
        : defaultState.preferredExampleContext,
      quizIntensity: pickEnumValue(
        parsed.quizIntensity,
        QUIZ_INTENSITIES,
        defaultState.quizIntensity
      ),
      streakMode:
        typeof parsed.streakMode === "boolean" ? parsed.streakMode : defaultState.streakMode,
      motivationStyle: pickEnumValue(
        parsed.motivationStyle,
        MOTIVATION_STYLES,
        defaultState.motivationStyle
      ),
      selectedCategories: Array.isArray(parsed.selectedCategories)
        ? parsed.selectedCategories
            .filter((c): c is string => typeof c === "string")
            .slice(0, MAX_CATEGORY_SELECTION)
        : [],
      selectedBookIds: Array.isArray(parsed.selectedBookIds)
        ? parsed.selectedBookIds
            .filter(
              (bookId): bookId is string =>
                typeof bookId === "string" && AVAILABLE_BOOK_IDS.has(bookId)
            )
            .slice(0, MAX_BOOK_SELECTION)
        : [],
    };
  } catch {
    return null;
  }
}

export function useOnboardingState() {
  const [state, setState] = useState<BookOnboardingState>(defaultState);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const storedEntry = STORAGE_KEYS.map((key) => ({
      key,
      state: parseStoredState(key, window.localStorage.getItem(key)),
    })).find(
      (
        value
      ): value is {
        key: (typeof STORAGE_KEYS)[number];
        state: BookOnboardingState;
      } => value.state !== null
    );
    if (storedEntry) {
      setState(storedEntry.state);
      LEGACY_STORAGE_KEYS.forEach((key) => window.localStorage.removeItem(key));
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [hydrated, state]);

  // If localStorage says setupComplete is false, check the server.
  // This handles existing users on new browsers or after cache clear.
  useEffect(() => {
    if (!hydrated || state.setupComplete) return;
    fetch("/app/api/book/me/onboarding/progress")
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { onboardingCompleted?: boolean } | null) => {
        if (data?.onboardingCompleted) {
          setState((prev) => ({
            ...prev,
            setupComplete: true,
            completedAt: prev.completedAt || new Date().toISOString(),
          }));
        }
      })
      .catch(() => {});
  }, [hydrated, state.setupComplete]);

  const setCurrentStep = useCallback((step: number) => {
    setState((prev) => ({ ...prev, currentStep: clampStep(step) }));
  }, []);

  const patchState = useCallback((patch: Partial<BookOnboardingState>) => {
    setState((prev) => ({
      ...prev,
      ...patch,
      currentStep:
        patch.currentStep === undefined ? prev.currentStep : clampStep(patch.currentStep),
      dailyGoalMinutes:
        patch.dailyGoalMinutes === undefined
          ? prev.dailyGoalMinutes
          : clampGoal(patch.dailyGoalMinutes),
      selectedCategories:
        patch.selectedCategories === undefined
          ? prev.selectedCategories
          : patch.selectedCategories.slice(0, MAX_CATEGORY_SELECTION),
      selectedBookIds:
        patch.selectedBookIds === undefined
          ? prev.selectedBookIds
          : patch.selectedBookIds
              .filter((bookId) => AVAILABLE_BOOK_IDS.has(bookId))
              .slice(0, MAX_BOOK_SELECTION),
    }));
  }, []);

  const goNextStep = useCallback(() => {
    setState((prev) => ({ ...prev, currentStep: clampStep(prev.currentStep + 1) }));
  }, []);

  const goPreviousStep = useCallback(() => {
    setState((prev) => ({ ...prev, currentStep: clampStep(prev.currentStep - 1) }));
  }, []);

  const setPronoun = useCallback((pronoun: PronounOption) => {
    setState((prev) => ({ ...prev, pronoun }));
  }, []);

  const setOccupation = useCallback((occupation: OccupationOption) => {
    setState((prev) => ({ ...prev, occupation }));
  }, []);

  const setReadingGoal = useCallback((readingGoal: ReadingGoalOption) => {
    setState((prev) => ({ ...prev, readingGoal }));
  }, []);

  const setReferralSource = useCallback((referralSource: ReferralSourceOption | null) => {
    setState((prev) => ({ ...prev, referralSource }));
  }, []);

  const setReferralSourceOtherText = useCallback((referralSourceOtherText: string) => {
    setState((prev) => ({ ...prev, referralSourceOtherText }));
  }, []);

  const toggleCategorySelection = useCallback((categoryKey: string) => {
    setState((prev) => {
      const selected = prev.selectedCategories;
      if (selected.includes(categoryKey)) {
        return { ...prev, selectedCategories: selected.filter((k) => k !== categoryKey) };
      }
      if (selected.length >= MAX_CATEGORY_SELECTION) return prev;
      return { ...prev, selectedCategories: [...selected, categoryKey] };
    });
  }, []);

  const clearBookSelections = useCallback(() => {
    setState((prev) => ({ ...prev, selectedBookIds: [] }));
  }, []);

  const replaceBookSelections = useCallback((bookIds: string[]) => {
    setState((prev) => ({
      ...prev,
      selectedBookIds: bookIds
        .filter((bookId) => AVAILABLE_BOOK_IDS.has(bookId))
        .slice(0, MAX_BOOK_SELECTION),
    }));
  }, []);

  const toggleBookSelection = useCallback((bookId: string) => {
    setState((prev) => {
      const selected = prev.selectedBookIds;
      if (selected.includes(bookId)) {
        return { ...prev, selectedBookIds: selected.filter((id) => id !== bookId) };
      }
      if (selected.length >= MAX_BOOK_SELECTION) return prev;
      return { ...prev, selectedBookIds: [...selected, bookId] };
    });
  }, []);

  const setDailyGoalMinutes = useCallback((minutes: number) => {
    setState((prev) => ({ ...prev, dailyGoalMinutes: clampGoal(minutes) }));
  }, []);

  const setReminderTime = useCallback((time: string) => {
    setState((prev) => ({ ...prev, reminderTime: time }));
  }, []);

  const setLearningStyle = useCallback((learningStyle: LearningStyle) => {
    setState((prev) => ({ ...prev, learningStyle }));
  }, []);

  const setChapterStartMode = useCallback((chapterStartMode: ChapterStartMode) => {
    setState((prev) => ({ ...prev, chapterStartMode }));
  }, []);

  const setPreferredExampleContext = useCallback(
    (preferredExampleContext: PreferredExampleContext) => {
      setState((prev) => ({ ...prev, preferredExampleContext }));
    },
    []
  );

  const setQuizIntensity = useCallback((quizIntensity: QuizIntensity) => {
    setState((prev) => ({ ...prev, quizIntensity }));
  }, []);

  const setStreakMode = useCallback((streakMode: boolean) => {
    setState((prev) => ({ ...prev, streakMode }));
  }, []);

  const setMotivationStyle = useCallback((motivationStyle: MotivationStyle) => {
    setState((prev) => ({ ...prev, motivationStyle }));
  }, []);

  const completeSetup = useCallback(() => {
    setState((prev) => ({
      ...prev,
      setupComplete: true,
      completedAt: new Date().toISOString(),
    }));
  }, []);

  const resetSetup = useCallback(() => {
    setState(defaultState);
    STORAGE_KEYS.forEach((key) => window.localStorage.removeItem(key));
  }, []);

  const selectionsRemaining = useMemo(
    () => Math.max(0, MAX_BOOK_SELECTION - state.selectedBookIds.length),
    [state.selectedBookIds.length]
  );

  const categorySelectionsRemaining = useMemo(
    () => Math.max(0, MAX_CATEGORY_SELECTION - state.selectedCategories.length),
    [state.selectedCategories.length]
  );

  return {
    state,
    hydrated,
    selectionsRemaining,
    categorySelectionsRemaining,
    patchState,
    setCurrentStep,
    goNextStep,
    goPreviousStep,
    setPronoun,
    setOccupation,
    setReadingGoal,
    setReferralSource,
    setReferralSourceOtherText,
    toggleCategorySelection,
    clearBookSelections,
    replaceBookSelections,
    toggleBookSelection,
    setDailyGoalMinutes,
    setReminderTime,
    setLearningStyle,
    setChapterStartMode,
    setPreferredExampleContext,
    setQuizIntensity,
    setStreakMode,
    setMotivationStyle,
    completeSetup,
    resetSetup,
  };
}
