"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ChapterTab } from "@/app/book/library/[bookId]/chapter/[chapterId]/hooks/useChapterState";
import type { LearningMode } from "@/app/book/settings/types/settings";

export type PhaseCompletionState = {
  /** Which phases the user has completed at least once */
  completedPhases: Set<ChapterTab>;
  /** Whether the user has completed all 4 phases at least once (free nav unlocked) */
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
    practice: { scrollThreshold: 0.80, timeThreshold: 30 },
  },
  standard: {
    summary: { scrollThreshold: 0.90, timeThreshold: 60 },
    examples: { scrollThreshold: 0.90, timeThreshold: 30 },
    quiz: { scrollThreshold: 0, timeThreshold: 0 },
    practice: { scrollThreshold: 0.80, timeThreshold: 30 },
  },
  challenge: {
    summary: { scrollThreshold: 0.90, timeThreshold: 60 },
    examples: { scrollThreshold: 0.90, timeThreshold: 30 },
    quiz: { scrollThreshold: 0, timeThreshold: 0 },
    practice: { scrollThreshold: 0.80, timeThreshold: 30 },
  },
};

export function getPhaseThresholds(
  learningMode: LearningMode,
  activePhase: ChapterTab
): { minTime: number; minScroll: number } {
  const cfg = MODE_CONFIG[learningMode][activePhase];
  return { minTime: cfg.timeThreshold, minScroll: cfg.scrollThreshold };
}

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
              v === "summary" || v === "examples" || v === "quiz" || v === "practice"
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
  /** Whether the quiz has been passed (required to unlock Practice) */
  quizPassed: boolean;
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
    quizPassed,
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
  // Per-phase progress, kept across tab switches within a session
  const phaseProgressRef = useRef<Record<ChapterTab, { scroll: number; time: number }>>({
    summary: { scroll: 0, time: 0 },
    examples: { scroll: 0, time: 0 },
    quiz: { scroll: 0, time: 0 },
    practice: { scroll: 0, time: 0 },
  });
  const prevPhaseRef = useRef<ChapterTab | null>(null);

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

  // Restore per-phase progress when switching phases. Save the previous
  // phase's progress before swapping so the user sees their actual position
  // when they come back to it.
  //
  // Important: only react to actual phase changes here. Mode / completedPhases
  // changes must NOT clobber `currentPhaseReady` — the completion-check effect
  // below owns that flag and will recompute it against the new thresholds.
  useEffect(() => {
    const prev = prevPhaseRef.current;
    if (prev === activePhase) return;

    if (prev) {
      phaseProgressRef.current[prev] = {
        scroll: maxScrollRef.current,
        time: timeRef.current,
      };
    }
    prevPhaseRef.current = activePhase;

    // If the phase the user just landed on is already completed, snap to
    // 100%/ready immediately.
    if (completedPhases.has(activePhase) || allPhasesCompletedOnce) {
      maxScrollRef.current = 1;
      timeRef.current = Math.max(timeRef.current, 1);
      setScrollPercent(100);
      setTimeOnPhase(timeRef.current);
      setCurrentPhaseReady(true);
      return;
    }

    const stored = phaseProgressRef.current[activePhase] ?? { scroll: 0, time: 0 };
    maxScrollRef.current = stored.scroll;
    timeRef.current = stored.time;
    setScrollPercent(Math.round(stored.scroll * 100));
    setTimeOnPhase(stored.time);
    setCurrentPhaseReady(false);
  }, [activePhase, completedPhases, allPhasesCompletedOnce]);

  // Timer for time tracking
  useEffect(() => {
    if (!enabled) return;

    timerRef.current = setInterval(() => {
      timeRef.current += 1;
      phaseProgressRef.current[activePhase] = {
        scroll: maxScrollRef.current,
        time: timeRef.current,
      };
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
      const rect = el.getBoundingClientRect();
      const contentTop = rect.top + window.scrollY;
      const contentHeight = el.scrollHeight;
      const viewportHeight = window.innerHeight;

      // Content fits in viewport: the user can see it all without scrolling.
      // Mark fully "scrolled" immediately so the time gate becomes the only requirement.
      if (contentHeight <= viewportHeight) {
        maxScrollRef.current = 1;
        setScrollPercent(100);
        return;
      }

      const scrollBottom = window.scrollY + viewportHeight;
      const contentBottom = contentTop + contentHeight;
      const percent = Math.min(
        1,
        Math.max(0, (scrollBottom - contentTop) / (contentBottom - contentTop))
      );
      maxScrollRef.current = Math.max(maxScrollRef.current, percent);
      setScrollPercent(Math.round(maxScrollRef.current * 100));
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("resize", handleScroll, { passive: true });
    // Initial check
    handleScroll();

    return () => {
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", handleScroll);
    };
  }, [enabled, contentRef, activePhase]);

  // Check completion criteria
  useEffect(() => {
    if (!enabled || currentPhaseReady) return;
    if (completedPhases.has(activePhase) || allPhasesCompletedOnce) {
      setCurrentPhaseReady(true);
      return;
    }

    // Quiz phase readiness is driven by whether the quiz has been passed
    if (activePhase === "quiz") {
      if (quizPassed) setCurrentPhaseReady(true);
      return;
    }

    const config = MODE_CONFIG[learningMode][activePhase];
    const scrollMet = maxScrollRef.current >= config.scrollThreshold;
    const timeMet = timeRef.current >= config.timeThreshold;

    if (scrollMet || timeMet) {
      // Examples phase: only Challenge mode requires interacting with every
      // scenario. Guided + Standard unlock as soon as the read gate is met —
      // chapter-level enforcement still happens at the quiz.
      if (activePhase === "examples" && learningMode === "challenge") {
        if (scenarioInteractions >= totalScenarios) {
          setCurrentPhaseReady(true);
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
    quizPassed,
  ]);

  const markPhaseCompleted = useCallback(
    (phase: ChapterTab) => {
      setCompletedPhases((prev) => {
        const next = new Set(prev);
        next.add(phase);
        // Check if all phases are now completed
        if (next.has("summary") && next.has("examples") && next.has("quiz") && next.has("practice")) {
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

      const phaseOrder: ChapterTab[] = ["summary", "examples", "quiz", "practice"];
      const phaseIndex = phaseOrder.indexOf(phase);

      if (phaseIndex === 0) return true; // Summary is always accessible

      // Practice requires quiz to be PASSED, not just completed
      if (phase === "practice") {
        return completedPhases.has("quiz") && quizPassed;
      }

      // Each phase requires the previous one to be completed
      const previousPhase = phaseOrder[phaseIndex - 1];
      return completedPhases.has(previousPhase);
    },
    [completedPhases, allPhasesCompletedOnce, quizPassed]
  );

  /** Get the tooltip message for a locked phase */
  const getLockMessage = useCallback(
    (phase: ChapterTab): string | null => {
      if (isPhaseAccessible(phase)) return null;
      if (phase === "examples") return "Complete the Summary first to unlock Examples";
      if (phase === "quiz") return "Engage with Examples to unlock the Quiz";
      if (phase === "practice") return "Pass the Quiz to unlock Practice";
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
