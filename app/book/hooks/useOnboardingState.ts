"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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
  // Step 1 — who you are
  name: string;
  email: string;
  city: string;
  pronoun: PronounOption;
  occupation: OccupationOption | null;
  // Step 2 — what brings you here
  readingGoal: ReadingGoalOption | null;
  referralSource: ReferralSourceOption | null;
  // Step 3 — book selection
  selectedBookIds: string[];
  // Step 4 — daily goal
  dailyGoalMinutes: number;
  // Step 5 — preferences
  reminderTime: string;
  learningStyle: LearningStyle;
  quizIntensity: QuizIntensity;
  streakMode: boolean;
  motivationStyle: MotivationStyle;
};

const MAX_STEPS = 6;
const MAX_BOOK_SELECTION = Math.max(1, BOOKS_CATALOG.length);
const STORAGE_KEY = "book-accelerator:onboarding:v2";
const AVAILABLE_BOOK_IDS = new Set(BOOKS_CATALOG.map((book) => book.id));

const defaultState: BookOnboardingState = {
  currentStep: 0,
  setupComplete: false,
  completedAt: null,
  name: "",
  email: "",
  city: "",
  pronoun: "Prefer not to say",
  occupation: null,
  readingGoal: null,
  referralSource: null,
  selectedBookIds: [],
  dailyGoalMinutes: 20,
  reminderTime: "20:00",
  learningStyle: "balanced",
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

function parseStoredState(value: string | null): BookOnboardingState | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as Partial<BookOnboardingState>;
    return {
      ...defaultState,
      ...parsed,
      currentStep: clampStep(Number(parsed.currentStep ?? defaultState.currentStep)),
      dailyGoalMinutes: clampGoal(
        Number(parsed.dailyGoalMinutes ?? defaultState.dailyGoalMinutes)
      ),
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
    const stored = parseStoredState(window.localStorage.getItem(STORAGE_KEY));
    if (stored) setState(stored);
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [hydrated, state]);

  const setCurrentStep = useCallback((step: number) => {
    setState((prev) => ({ ...prev, currentStep: clampStep(step) }));
  }, []);

  const goNextStep = useCallback(() => {
    setState((prev) => ({ ...prev, currentStep: clampStep(prev.currentStep + 1) }));
  }, []);

  const goPreviousStep = useCallback(() => {
    setState((prev) => ({ ...prev, currentStep: clampStep(prev.currentStep - 1) }));
  }, []);

  const setName = useCallback((name: string) => {
    setState((prev) => ({ ...prev, name }));
  }, []);

  const setEmail = useCallback((email: string) => {
    setState((prev) => ({ ...prev, email }));
  }, []);

  const setCity = useCallback((city: string) => {
    setState((prev) => ({ ...prev, city }));
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

  const setReferralSource = useCallback((referralSource: ReferralSourceOption) => {
    setState((prev) => ({ ...prev, referralSource }));
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
    window.localStorage.removeItem(STORAGE_KEY);
  }, []);

  const selectionsRemaining = useMemo(
    () => Math.max(0, MAX_BOOK_SELECTION - state.selectedBookIds.length),
    [state.selectedBookIds.length]
  );

  return {
    state,
    hydrated,
    selectionsRemaining,
    setCurrentStep,
    goNextStep,
    goPreviousStep,
    setName,
    setEmail,
    setCity,
    setPronoun,
    setOccupation,
    setReadingGoal,
    setReferralSource,
    toggleBookSelection,
    setDailyGoalMinutes,
    setReminderTime,
    setLearningStyle,
    setQuizIntensity,
    setStreakMode,
    setMotivationStyle,
    completeSetup,
    resetSetup,
  };
}
