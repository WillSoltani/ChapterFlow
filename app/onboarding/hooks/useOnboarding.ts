"use client";

import { useCallback, useSyncExternalStore } from "react";

/* ── Types ── */

export type Motivation = "career" | "academic" | "personal" | "curiosity";
export type ChapterOrder = "summary_first" | "scenarios_first";
export type DailyGoal = 10 | 20 | 30;
export type Tone = "gentle" | "direct" | "competitive";

export interface OnboardingState {
  currentStep: number;
  motivation: Motivation | null;
  interests: string[];
  tone: Tone;
  dailyGoal: DailyGoal;
  chapterOrder: ChapterOrder;
  starterShelf: any[];
  firstQuizScore: number;
  firstChapterCompleted: boolean;
  direction: 1 | -1;
}

const DEFAULT_STATE: OnboardingState = {
  currentStep: 1,
  motivation: null,
  interests: [],
  tone: "direct",
  dailyGoal: 20,
  chapterOrder: "summary_first",
  starterShelf: [],
  firstQuizScore: 0,
  firstChapterCompleted: false,
  direction: 1,
};

const STORAGE_KEY = "chapterflow_onboarding";

/* ── Store ── */

let state: OnboardingState = DEFAULT_STATE;
let listeners: Set<() => void> = new Set();

function emitChange() {
  for (const listener of listeners) listener();
}

function persist(s: OnboardingState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch {}
}

function loadFromStorage(): OnboardingState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return { ...DEFAULT_STATE, ...parsed };
    }
  } catch {}
  return DEFAULT_STATE;
}

/* Initialize from localStorage on first load */
let initialized = false;
function ensureInit() {
  if (initialized) return;
  initialized = true;
  if (typeof window !== "undefined") {
    state = loadFromStorage();
  }
}

function getSnapshot(): OnboardingState {
  ensureInit();
  return state;
}

function getServerSnapshot(): OnboardingState {
  return DEFAULT_STATE;
}

function subscribe(listener: () => void): () => void {
  ensureInit();
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function setState(partial: Partial<OnboardingState>) {
  state = { ...state, ...partial };
  persist(state);
  emitChange();
}

/* ── Hook ── */

export function useOnboarding() {
  const snap = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const setMotivation = useCallback((m: Motivation) => {
    setState({ motivation: m });
  }, []);

  const setInterests = useCallback((interests: string[]) => {
    setState({ interests });
  }, []);

  const toggleInterest = useCallback((interest: string) => {
    const current = state.interests;
    const next = current.includes(interest)
      ? current.filter((i) => i !== interest)
      : [...current, interest];
    setState({ interests: next });
  }, []);

  const setTone = useCallback((tone: Tone) => {
    setState({ tone });
  }, []);

  const setDailyGoal = useCallback((goal: DailyGoal) => {
    setState({ dailyGoal: goal });
  }, []);

  const setChapterOrder = useCallback((order: ChapterOrder) => {
    setState({ chapterOrder: order });
  }, []);

  const setStarterShelf = useCallback((shelf: any[]) => {
    setState({ starterShelf: shelf });
  }, []);

  const setFirstQuizScore = useCallback((score: number) => {
    setState({ firstQuizScore: score });
  }, []);

  const completeFirstChapter = useCallback(() => {
    setState({ firstChapterCompleted: true });
  }, []);

  const goToStep = useCallback((step: number) => {
    const dir = step > state.currentStep ? 1 : -1;
    setState({ currentStep: step, direction: dir as 1 | -1 });
  }, []);

  const nextStep = useCallback(() => {
    setState({ currentStep: state.currentStep + 1, direction: 1 });
  }, []);

  const prevStep = useCallback(() => {
    if (state.currentStep > 1) {
      setState({ currentStep: state.currentStep - 1, direction: -1 });
    }
  }, []);

  const skipStep = useCallback(() => {
    const step = state.currentStep;
    const defaults: Partial<OnboardingState> = {};
    switch (step) {
      case 1:
        defaults.motivation = "personal";
        break;
      case 2:
        defaults.interests = ["psychology", "productivity", "habits", "communication", "leadership"];
        break;
      case 3:
        defaults.tone = "direct";
        break;
      case 4:
        defaults.dailyGoal = 20;
        defaults.chapterOrder = "summary_first";
        break;
      case 5:
        // Shelf skip is handled by the shelf component itself
        break;
    }
    setState({ ...defaults, currentStep: step + 1, direction: 1 as 1 | -1 });
  }, []);

  const clearOnboarding = useCallback(() => {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {}
  }, []);

  const resetOnboarding = useCallback(() => {
    state = DEFAULT_STATE;
    persist(state);
    emitChange();
  }, []);

  return {
    ...snap,
    setMotivation,
    setInterests,
    toggleInterest,
    setTone,
    setDailyGoal,
    setChapterOrder,
    setStarterShelf,
    setFirstQuizScore,
    completeFirstChapter,
    goToStep,
    nextStep,
    prevStep,
    skipStep,
    clearOnboarding,
    resetOnboarding,
  };
}
