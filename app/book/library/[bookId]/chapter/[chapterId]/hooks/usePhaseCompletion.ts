"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ChapterTab } from "@/app/book/library/[bookId]/chapter/[chapterId]/hooks/useChapterState";
import type { LearningMode } from "@/app/book/settings/types/settings";

export type PhaseCompletionState = {
  /** Which phases the user has completed at least once */
  completedPhases: Set<ChapterTab>;
  /** Whether the user has completed all 3 phases at least once (free nav unlocked) */
  allPhasesCompletedOnce: boolean;
  /** Whether the current phase's completion criteria have been met */
  currentPhaseReady: boolean;
  /** Scroll percentage of the current phase content (0-100) */
  scrollPercent: number;
  /** Time spent in seconds on the current phase */
  timeOnPhase: number;
};

type PhaseCompletionConfig = {
  scrollThreshold: number; // 0-1
  timeThreshold: number; // seconds
};

const MODE_CONFIG: Record<LearningMode, Record<ChapterTab, PhaseCompletionConfig>> = {
  guided: {
    summary: { scrollThreshold: 0.80, timeThreshold: 45 },
    examples: { scrollThreshold: 0.80, timeThreshold: 30 },
    quiz: { scrollThreshold: 0, timeThreshold: 0 },
  },
  standard: {
    summary: { scrollThreshold: 0.90, timeThreshold: 60 },
    examples: { scrollThreshold: 0.90, timeThreshold: 30 },
    quiz: { scrollThreshold: 0, timeThreshold: 0 },
  },
  challenge: {
    summary: { scrollThreshold: 0.90, timeThreshold: 60 },
    examples: { scrollThreshold: 0.90, timeThreshold: 30 },
    quiz: { scrollThreshold: 0, timeThreshold: 0 },
  },
};

const STORAGE_KEY_PREFIX = "book-accelerator:phase-completion:v1";

function getStorageKey(bookId: string, chapterId: string): string {
  return `${STORAGE_KEY_PREFIX}:${bookId}:${chapterId}`;
}

type PersistedPhaseCompletion = {
  completedPhases: ChapterTab[];
  allPhasesCompletedOnce: boolean;
  scenarioInteractions: number;
};

function loadPersisted(bookId: string, chapterId: string): PersistedPhaseCompletion | null {
  try {
    const raw = window.localStorage.getItem(getStorageKey(bookId, chapterId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PersistedPhaseCompletion>;
    return {
      completedPhases: Array.isArray(parsed.completedPhases)
        ? parsed.completedPhases.filter(
            (v): v is ChapterTab =>
              v === "summary" || v === "examples" || v === "quiz"
          )
        : [],
      allPhasesCompletedOnce: Boolean(parsed.allPhasesCompletedOnce),
      scenarioInteractions:
        typeof parsed.scenarioInteractions === "number" ? parsed.scenarioInteractions : 0,
    };
  } catch {
    return null;
  }
}

export function usePhaseCompletion(params: {
  bookId: string;
  chapterId: string;
  activePhase: ChapterTab;
  learningMode: LearningMode;
  /** Reference to the scrollable content container */
  contentRef: React.RefObject<HTMLDivElement | null>;
  /** Number of scenario decision prompts the user has interacted with */
  scenarioInteractions: number;
  /** Total number of scenarios in the examples phase */
  totalScenarios: number;
  enabled: boolean;
}) {
  const {
    bookId,
    chapterId,
    activePhase,
    learningMode,
    contentRef,
    scenarioInteractions,
    totalScenarios,
    enabled,
  } = params;

  const [completedPhases, setCompletedPhases] = useState<Set<ChapterTab>>(new Set());
  const [allPhasesCompletedOnce, setAllPhasesCompletedOnce] = useState(false);
  const [currentPhaseReady, setCurrentPhaseReady] = useState(false);
  const [scrollPercent, setScrollPercent] = useState(0);
  const [timeOnPhase, setTimeOnPhase] = useState(0);
  const [hydrated, setHydrated] = useState(false);

  const timeRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const maxScrollRef = useRef(0);

  // Hydrate from localStorage
  useEffect(() => {
    const persisted = loadPersisted(bookId, chapterId);
    if (persisted) {
      setCompletedPhases(new Set(persisted.completedPhases));
      setAllPhasesCompletedOnce(persisted.allPhasesCompletedOnce);
    }
    setHydrated(true);
  }, [bookId, chapterId]);

  // Persist to localStorage when completedPhases changes
  useEffect(() => {
    if (!hydrated) return;
    const data: PersistedPhaseCompletion = {
      completedPhases: [...completedPhases],
      allPhasesCompletedOnce,
      scenarioInteractions,
    };
    window.localStorage.setItem(
      getStorageKey(bookId, chapterId),
      JSON.stringify(data)
    );
  }, [bookId, chapterId, completedPhases, allPhasesCompletedOnce, scenarioInteractions, hydrated]);

  // Reset time and scroll when phase changes
  useEffect(() => {
    timeRef.current = 0;
    maxScrollRef.current = 0;
    setTimeOnPhase(0);
    setScrollPercent(0);
    setCurrentPhaseReady(false);
  }, [activePhase]);

  // Timer for time tracking
  useEffect(() => {
    if (!enabled) return;

    timerRef.current = setInterval(() => {
      timeRef.current += 1;
      setTimeOnPhase(timeRef.current);
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [enabled, activePhase]);

  // Scroll tracking
  useEffect(() => {
    if (!enabled || !contentRef.current) return;

    const handleScroll = () => {
      const el = contentRef.current;
      if (!el) return;
      const scrollPosition = window.scrollY + window.innerHeight;
      const contentBottom = el.offsetTop + el.scrollHeight;
      const percent = Math.min(1, scrollPosition / contentBottom);
      maxScrollRef.current = Math.max(maxScrollRef.current, percent);
      setScrollPercent(Math.round(maxScrollRef.current * 100));
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    // Initial check
    handleScroll();

    return () => window.removeEventListener("scroll", handleScroll);
  }, [enabled, contentRef, activePhase]);

  // Check completion criteria
  useEffect(() => {
    if (!enabled || currentPhaseReady) return;
    if (completedPhases.has(activePhase) || allPhasesCompletedOnce) {
      setCurrentPhaseReady(true);
      return;
    }

    // Quiz phase doesn't have scroll/time completion criteria
    if (activePhase === "quiz") {
      setCurrentPhaseReady(true);
      return;
    }

    const config = MODE_CONFIG[learningMode][activePhase];
    const scrollMet = maxScrollRef.current >= config.scrollThreshold;
    const timeMet = timeRef.current >= config.timeThreshold;

    if (scrollMet || timeMet) {
      // Additional check for examples phase: interaction requirement
      if (activePhase === "examples") {
        if (learningMode === "guided") {
          // Guided: scrolling is enough
          setCurrentPhaseReady(true);
        } else if (learningMode === "standard") {
          // Standard: need at least 1 interaction
          if (scenarioInteractions >= 1) {
            setCurrentPhaseReady(true);
          }
        } else {
          // Challenge: need ALL interactions
          if (scenarioInteractions >= totalScenarios) {
            setCurrentPhaseReady(true);
          }
        }
      } else {
        setCurrentPhaseReady(true);
      }
    }
  }, [
    enabled,
    activePhase,
    learningMode,
    currentPhaseReady,
    scrollPercent,
    timeOnPhase,
    completedPhases,
    allPhasesCompletedOnce,
    scenarioInteractions,
    totalScenarios,
  ]);

  const markPhaseCompleted = useCallback(
    (phase: ChapterTab) => {
      setCompletedPhases((prev) => {
        const next = new Set(prev);
        next.add(phase);
        // Check if all phases are now completed
        if (next.has("summary") && next.has("examples") && next.has("quiz")) {
          setAllPhasesCompletedOnce(true);
        }
        return next;
      });
    },
    []
  );

  /** Check if a phase is accessible (for stepper gating) */
  const isPhaseAccessible = useCallback(
    (phase: ChapterTab): boolean => {
      if (allPhasesCompletedOnce) return true;
      if (completedPhases.has(phase)) return true;

      const phaseOrder: ChapterTab[] = ["summary", "examples", "quiz"];
      const phaseIndex = phaseOrder.indexOf(phase);

      if (phaseIndex === 0) return true; // Summary is always accessible

      // Each phase requires the previous one to be completed
      const previousPhase = phaseOrder[phaseIndex - 1];
      return completedPhases.has(previousPhase);
    },
    [completedPhases, allPhasesCompletedOnce]
  );

  /** Get the tooltip message for a locked phase */
  const getLockMessage = useCallback(
    (phase: ChapterTab): string | null => {
      if (isPhaseAccessible(phase)) return null;
      if (phase === "examples") return "Complete the Summary first to unlock Examples";
      if (phase === "quiz") return "Engage with Examples to unlock the Quiz";
      return null;
    },
    [isPhaseAccessible]
  );

  return {
    hydrated,
    completedPhases,
    allPhasesCompletedOnce,
    currentPhaseReady,
    scrollPercent,
    timeOnPhase,
    markPhaseCompleted,
    isPhaseAccessible,
    getLockMessage,
  };
}
