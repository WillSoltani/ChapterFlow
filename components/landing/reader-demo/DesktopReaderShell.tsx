"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";

import { PhaseStepper } from "@/app/book/library/[bookId]/chapter/[chapterId]/components/PhaseStepper";
import { SummaryCard } from "@/app/book/library/[bookId]/chapter/[chapterId]/components/SummaryCard";
import { ExamplesList } from "@/app/book/library/[bookId]/chapter/[chapterId]/components/ExamplesList";
import { PracticePhase } from "@/app/book/library/[bookId]/chapter/[chapterId]/components/PracticePhase";
import { ContinueButton } from "@/app/book/library/[bookId]/chapter/[chapterId]/components/ContinueButton";
import type { ChapterTab } from "@/app/book/library/[bookId]/chapter/[chapterId]/hooks/useChapterState";
import type { ExampleFilter } from "@/app/book/library/[bookId]/chapter/[chapterId]/hooks/useChapterState";
import type { ReadingDepth } from "@/app/book/data/bookChapters";

import { AppWindowChrome } from "./AppWindowChrome";
import { DesktopQuizPanel } from "./DesktopQuizPanel";
import {
  DEMO_ACTIVATION_PROMPT_BY_DEPTH,
  DEMO_CHAPTER_ID,
  DEMO_EXAMPLES,
  DEMO_IMPLEMENTATION_PLAN,
  DEMO_KEY_TAKEAWAY_CARD,
  DEMO_PREDICTION_PROMPT_BY_DEPTH,
  DEMO_QUIZ_BY_DEPTH,
  DEMO_RECAP_BY_DEPTH,
  DEMO_SELF_CHECK_PROMPTS_BY_DEPTH,
  DEMO_SUMMARY_BY_DEPTH,
  DEMO_TAKEAWAYS_BY_DEPTH,
} from "./demoChapter";

const PHASE_ORDER: ChapterTab[] = ["summary", "examples", "quiz", "practice"];

const PHASE_DURATIONS_MS: Record<ChapterTab, number> = {
  summary: 12000,
  examples: 12000,
  quiz: 14000,
  practice: 12000,
};

/**
 * The desktop interactive demo shell.
 *
 * Imports the REAL in-app reader components (PhaseStepper, SummaryCard,
 * ExamplesList, PracticePhase, ContinueButton) and feeds them mocked
 * props derived from demoChapter.ts. The only piece that's a custom
 * clone is DesktopQuizPanel — the real QuizPanel depends on the heavy
 * useQuizSession hook which is too complex to mock for a marketing demo.
 *
 * Auto-advances through the 4 phases until the user interacts (clicks
 * a phase, depth selector, accordion, etc.) at which point control
 * transfers to the user.
 *
 * Respects `useReducedMotion` (WCAG 2.2.2): when the user prefers
 * reduced motion the auto-advance timer is skipped entirely (the demo
 * is driven manually via the PhaseStepper / ContinueButton) and the
 * phase-transition animation is disabled.
 */
export function DesktopReaderShell() {
  const [activeTab, setActiveTab] = useState<ChapterTab>("summary");
  const [readingDepth, setReadingDepth] = useState<ReadingDepth>("standard");
  const [bookmarkedTakeaways, setBookmarkedTakeaways] = useState<Set<number>>(
    new Set()
  );
  const [exampleFilter, setExampleFilter] = useState<ExampleFilter>("all");

  const prefersReducedMotion = useReducedMotion();

  const hasInteracted = useRef(false);
  const advanceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const stopAutoAdvance = useCallback(() => {
    if (advanceRef.current) {
      clearTimeout(advanceRef.current);
      advanceRef.current = null;
    }
  }, []);

  const markInteracted = useCallback(() => {
    hasInteracted.current = true;
    stopAutoAdvance();
  }, [stopAutoAdvance]);

  // Auto-advance until user interaction. Skipped entirely when the user
  // prefers reduced motion — they step through via the PhaseStepper /
  // ContinueButton instead (WCAG 2.2.2: no auto-updating moving content).
  useEffect(() => {
    if (prefersReducedMotion) return;
    if (hasInteracted.current) return;
    const dwell = PHASE_DURATIONS_MS[activeTab];
    advanceRef.current = setTimeout(() => {
      const idx = PHASE_ORDER.indexOf(activeTab);
      const next = PHASE_ORDER[(idx + 1) % PHASE_ORDER.length];
      setActiveTab(next);
    }, dwell);
    return () => stopAutoAdvance();
  }, [activeTab, stopAutoAdvance, prefersReducedMotion]);

  const handleTabChange = useCallback(
    (tab: ChapterTab) => {
      markInteracted();
      setActiveTab(tab);
    },
    [markInteracted]
  );

  const goToNext = useCallback(() => {
    markInteracted();
    const idx = PHASE_ORDER.indexOf(activeTab);
    if (idx >= 0 && idx < PHASE_ORDER.length - 1) {
      setActiveTab(PHASE_ORDER[idx + 1]);
    }
  }, [activeTab, markInteracted]);

  const handleToggleBookmark = useCallback(
    (index: number) => {
      markInteracted();
      setBookmarkedTakeaways((prev) => {
        const next = new Set(prev);
        if (next.has(index)) next.delete(index);
        else next.add(index);
        return next;
      });
    },
    [markInteracted]
  );

  const handleSaveTakeaways = useCallback(() => {
    markInteracted();
  }, [markInteracted]);

  const handleChangeReadingDepth = useCallback(
    (value: ReadingDepth) => {
      markInteracted();
      setReadingDepth(value);
    },
    [markInteracted]
  );

  // Derived: which phases are "completed" for stepper visual
  const completedPhases = new Set<ChapterTab>(
    PHASE_ORDER.slice(0, PHASE_ORDER.indexOf(activeTab))
  );
  const progressPercent =
    ((PHASE_ORDER.indexOf(activeTab) + 1) / PHASE_ORDER.length) * 100;

  // Pull depth-aware content
  const summaryBlocks = DEMO_SUMMARY_BY_DEPTH[readingDepth];
  const takeaways = DEMO_TAKEAWAYS_BY_DEPTH[readingDepth];
  const recap = DEMO_RECAP_BY_DEPTH[readingDepth];
  const activationPrompt = DEMO_ACTIVATION_PROMPT_BY_DEPTH[readingDepth];
  const selfCheckPrompts = DEMO_SELF_CHECK_PROMPTS_BY_DEPTH[readingDepth];
  const quizQuestions = DEMO_QUIZ_BY_DEPTH[readingDepth];
  const predictionPrompt = DEMO_PREDICTION_PROMPT_BY_DEPTH[readingDepth];

  // Bookmark text payload for Practice phase
  const bookmarkedTakeawayTexts = Array.from(bookmarkedTakeaways)
    .filter((i) => i < takeaways.length)
    .map((i) => takeaways[i]);

  return (
    <div
      className="overflow-hidden rounded-2xl border"
      style={{
        background: "var(--cr-bg-root)",
        borderColor: "var(--cr-glass-border)",
        boxShadow: "0 24px 64px rgba(0,0,0,0.5), 0 8px 24px rgba(0,0,0,0.3)",
      }}
    >
      <AppWindowChrome />

      {/* Phase stepper bar */}
      <div
        className="px-6 py-5 border-b"
        style={{
          background: "var(--cr-bg-surface-1)",
          borderColor: "var(--cr-glass-border)",
        }}
      >
        <PhaseStepper
          currentPhase={activeTab}
          completedPhases={completedPhases}
          onChange={handleTabChange}
          progressPercent={progressPercent}
          isPhaseAccessible={() => true}
          getLockMessage={() => null}
          showProgressBar
        />
      </div>

      {/* Content area */}
      <div
        className="px-6 py-8 md:px-10 md:py-10 max-h-[720px] overflow-y-auto"
        onClick={markInteracted}
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={`${activeTab}-${readingDepth}`}
            initial={prefersReducedMotion ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: -8 }}
            transition={
              prefersReducedMotion
                ? { duration: 0 }
                : { duration: 0.25, ease: [0.22, 1, 0.36, 1] }
            }
          >
            {activeTab === "summary" && (
              <>
                <SummaryCard
                  blocks={summaryBlocks}
                  takeaways={takeaways}
                  recap={recap}
                  onSaveTakeaways={handleSaveTakeaways}
                  bookmarkedTakeaways={bookmarkedTakeaways}
                  onToggleBookmarkTakeaway={handleToggleBookmark}
                  fontScaleClass="text-base"
                  learningMode="standard"
                  activationPrompt={activationPrompt}
                  selfCheckPrompts={selfCheckPrompts}
                />
                <ContinueButton
                  ready
                  onClick={goToNext}
                  readyText="Continue to Examples"
                />
              </>
            )}

            {activeTab === "examples" && (
              <>
                <ExamplesList
                  examples={DEMO_EXAMPLES}
                  filter={exampleFilter}
                  onFilterChange={(value) => {
                    markInteracted();
                    setExampleFilter(value);
                  }}
                  submissionPoints={0}
                  mySubmissions={[]}
                  onSubmitScenario={async () => {
                    markInteracted();
                  }}
                  fontScaleClass="text-base"
                  readingDepth={readingDepth}
                  onScenarioInteraction={markInteracted}
                  bookId="demo"
                  chapterNumber={1}
                  chapterTitle="Demo chapter"
                />
                <ContinueButton
                  ready
                  onClick={goToNext}
                  readyText="Start the Quiz"
                />
              </>
            )}

            {activeTab === "quiz" && (
              <DesktopQuizPanel
                questions={quizQuestions}
                onContinue={goToNext}
              />
            )}

            {activeTab === "practice" && (
              <PracticePhase
                keyTakeawayCard={DEMO_KEY_TAKEAWAY_CARD}
                implementationPlan={DEMO_IMPLEMENTATION_PLAN}
                predictionPrompt={predictionPrompt}
                fontScaleClass="text-base"
                onContinueToNextChapter={() => {
                  markInteracted();
                  setActiveTab("summary");
                }}
                nextChapterLabel="Continue to Chapter 2 →"
                bookmarkedTakeaways={
                  bookmarkedTakeawayTexts.length > 0
                    ? bookmarkedTakeawayTexts
                    : takeaways.slice(0, 2)
                }
                chapterId={DEMO_CHAPTER_ID}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
