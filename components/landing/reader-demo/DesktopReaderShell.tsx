"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  m,
  AnimatePresence,
  useReducedMotion,
  useInView,
} from "framer-motion";

import { PhaseStepper } from "@/components/reader/PhaseStepper";
import { SummaryCard } from "@/components/reader/SummaryCard";
import { ExamplesList } from "@/components/reader/ExamplesList";
import { PracticePhase } from "@/components/reader/PracticePhase";
import { ContinueButton } from "@/components/reader/ContinueButton";
import type { ChapterTab, ExampleFilter } from "@/lib/reader-state-types";
import type { ReadingDepth } from "@/lib/reader-content-types";

import { AppWindowChrome } from "./AppWindowChrome";
import { MobileAppChrome } from "./MobileAppChrome";
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
export function DesktopReaderShell({
  controlledPhase,
  autoPlay = true,
}: {
  /** When set, SCROLL (or any external driver) owns the phase: this value wins
   *  and the internal autoplay timer never schedules. Used by the pinned
   *  signature section. */
  controlledPhase?: ChapterTab;
  /** Default true. false disables internal auto-advance (driver owns it). */
  autoPlay?: boolean;
} = {}) {
  const [internalTab, setInternalTab] = useState<ChapterTab>("summary");
  // Effective phase: the external driver wins when controlled (the §01 signature
  // scrubs it); otherwise the internal autoplay/interaction state drives it (the
  // hero console auto-running the loop).
  const isControlled = controlledPhase != null;
  const activeTab = controlledPhase ?? internalTab;
  const [readingDepth, _setReadingDepth] = useState<ReadingDepth>("standard");
  const [bookmarkedTakeaways, setBookmarkedTakeaways] = useState<Set<number>>(
    new Set()
  );
  const [exampleFilter, setExampleFilter] = useState<ExampleFilter>("all");

  const prefersReducedMotion = useReducedMotion();

  // Only run the auto-advance loop while the demo is actually on-screen.
  // Off-screen the interval would otherwise keep cycling + AnimatePresence-
  // swapping the heavy reader subtree, burning main-thread time for no benefit.
  const rootRef = useRef<HTMLDivElement>(null);
  // `once` latches true the first time the demo scrolls into view: the loop never
  // auto-starts at page load while below the fold, and — unlike a toggling gate —
  // re-entering the viewport mid-phase does NOT restart the dwell from zero (which
  // could otherwise indefinitely defer/freeze the advance on repeated partial scroll).
  const isInView = useInView(rootRef, { amount: 0.3, once: true });

  const hasInteracted = useRef(false);
  const advanceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // WCAG 2.2.2 (pause/stop/hide): auto-updating content must not move
  // indefinitely. We count phase advances and STOP after one full loop (4 phases,
  // back to Summary) so a non-interacting, non-reduced-motion visitor sees the
  // loop run once, then it rests — no perpetual motion they can't halt.
  const advancesRef = useRef(0);
  const [loopComplete, setLoopComplete] = useState(false);
  // Keyboard focus is a transient pause, not a permanent interaction. While a
  // visitor is reading or operating anything in the demo, keep the keyed phase
  // subtree mounted so its focused control cannot disappear. Once focus leaves
  // the demo, autoplay may resume with a fresh dwell period.
  const [isFocusWithin, setIsFocusWithin] = useState(false);

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
  // Also gated on `isInView` so the loop never cycles while off-screen.
  useEffect(() => {
    // Scroll-driven (controlled) mode owns the phase — never schedule the timer.
    if (!autoPlay || isControlled) return;
    if (prefersReducedMotion) return;
    if (!isInView) return;
    if (isFocusWithin) return;
    if (hasInteracted.current) return;
    if (loopComplete) return; // one full loop done — rest (WCAG 2.2.2)
    const dwell = PHASE_DURATIONS_MS[activeTab];
    advanceRef.current = setTimeout(() => {
      const idx = PHASE_ORDER.indexOf(activeTab);
      const next = PHASE_ORDER[(idx + 1) % PHASE_ORDER.length]!; // PHASE_ORDER non-empty ⇒ in-bounds
      advancesRef.current += 1;
      // Completed the loop (cycled through all 4 phases, back to Summary): stop.
      if (advancesRef.current >= PHASE_ORDER.length) {
        setLoopComplete(true);
      }
      setInternalTab(next);
    }, dwell);
    return () => stopAutoAdvance();
  }, [
    activeTab,
    stopAutoAdvance,
    prefersReducedMotion,
    isInView,
    isFocusWithin,
    autoPlay,
    isControlled,
    loopComplete,
  ]);

  const handleTabChange = useCallback(
    (tab: ChapterTab) => {
      markInteracted();
      setInternalTab(tab);
    },
    [markInteracted]
  );

  const goToNext = useCallback(() => {
    markInteracted();
    const idx = PHASE_ORDER.indexOf(activeTab);
    if (idx >= 0 && idx < PHASE_ORDER.length - 1) {
      setInternalTab(PHASE_ORDER[idx + 1]!); // guarded idx+1 < length
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
    .filter((i) => i >= 0 && i < takeaways.length)
    .map((i) => takeaways[i]!); // filtered to valid indices

  return (
    <div
      ref={rootRef}
      onFocusCapture={() => {
        stopAutoAdvance();
        setIsFocusWithin(true);
      }}
      onBlurCapture={(event) => {
        const nextTarget = event.relatedTarget;
        if (
          nextTarget instanceof Node &&
          event.currentTarget.contains(nextTarget)
        ) {
          return;
        }
        setIsFocusWithin(false);
      }}
      className="overflow-hidden rounded-[1.75rem] border md:rounded-2xl"
      style={{
        background: "var(--cr-bg-root)",
        borderColor: "var(--cr-glass-border)",
        boxShadow: "var(--cf-anchor-shadow)",
      }}
    >
      {/* Phone-style chrome on small screens; desktop browser chrome from md up. */}
      <div className="md:hidden">
        <MobileAppChrome />
      </div>
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
        className={
          isControlled
            ? // Scroll-driven: neutralize the inner scroll so the PAGE scroll
              // owns the scrub (the inner overflow-y-auto would otherwise trap it).
              "px-6 py-8 md:px-10 md:py-10 overflow-hidden"
            : "px-6 py-8 md:px-10 md:py-10 max-h-[720px] overflow-y-auto"
        }
        onClick={isControlled ? undefined : markInteracted}
      >
        <AnimatePresence mode="wait">
          <m.div
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
                  setInternalTab("summary");
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
          </m.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
