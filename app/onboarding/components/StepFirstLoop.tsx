"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { useOnboarding } from "@/app/onboarding/hooks/useOnboarding";
import { getBookById } from "@/app/onboarding/data/books";
import {
  subStepVariants,
  subStepTransition,
} from "@/app/onboarding/utils/animations";
import MiniSummary from "./MiniSummary";
import MiniScenario from "./MiniScenario";
import MiniQuiz from "./MiniQuiz";
import UnlockCelebration from "./UnlockCelebration";

interface StepFirstLoopProps {
  onFinish: () => void | Promise<void>;
  onBack: () => void;
  backRef: React.MutableRefObject<(() => void) | null>;
}

type SubStep = "summary" | "scenario" | "quiz" | "celebration";

const SUB_STEP_LABELS: { key: SubStep; label: string }[] = [
  { key: "summary", label: "Summary" },
  { key: "scenario", label: "Scenarios" },
  { key: "quiz", label: "Quiz" },
  { key: "celebration", label: "Unlock" },
];

function SubStepIndicator({ current }: { current: SubStep }) {
  const currentIdx = SUB_STEP_LABELS.findIndex((s) => s.key === current);

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
        marginBottom: 24,
      }}
    >
      {SUB_STEP_LABELS.map((step, i) => {
        const isActive = step.key === current;
        const isCompleted = i < currentIdx;

        return (
          <span
            key={step.key}
            style={{
              fontFamily: "var(--font-body, sans-serif)",
              fontSize: 13,
              fontWeight: isActive ? 600 : 400,
              padding: "5px 12px",
              borderRadius: 999,
              background: isActive
                ? "color-mix(in srgb, var(--accent-cyan) 15%, transparent)"
                : "var(--cf-surface)",
              border: isActive
                ? "1px solid color-mix(in srgb, var(--accent-cyan) 30%, transparent)"
                : "1px solid var(--cf-border)",
              color: isActive
                ? "var(--accent-cyan)"
                : isCompleted
                  ? "var(--accent-cyan)"
                  : "var(--cf-text-soft)",
              transition: "all 200ms ease",
            }}
          >
            {step.label}
          </span>
        );
      })}
    </div>
  );
}

export default function StepFirstLoop({ onFinish, onBack, backRef }: StepFirstLoopProps) {
  const prefersReducedMotion = useReducedMotion();
  const { setFirstQuizScore, completeFirstChapter, starterShelf } = useOnboarding();

  // Resolve the user's chosen starter books to cover paths for the first-win
  // covers fan-in. Tolerates both StarterShelfItem shapes (string | {id}).
  const starterCovers = useMemo(
    () =>
      (Array.isArray(starterShelf) ? starterShelf : [])
        .map((item) => (typeof item === "string" ? item : item?.id))
        .filter((id): id is string => typeof id === "string" && id.length > 0)
        .map((id) => getBookById(id)?.cover)
        .filter((cover): cover is string => typeof cover === "string" && cover.length > 0),
    [starterShelf],
  );

  const [subStep, setSubStep] = useState<SubStep>("summary");

  /** Called by parent's back button — navigates within sub-steps or exits to Step 5 */
  const handleBack = useCallback(() => {
    if (subStep === "scenario") setSubStep("summary");
    else if (subStep === "quiz") setSubStep("scenario");
    else if (subStep === "summary") onBack();
    // celebration: don't allow back
  }, [subStep, onBack]);

  // Register back handler with parent so the header back button can call it
  useEffect(() => {
    backRef.current = handleBack;
  }, [backRef, handleBack]);
  const [quizScore, setQuizScore] = useState(0);

  const handleSummaryContinue = useCallback(() => {
    setSubStep("scenario");
  }, []);

  const handleScenarioContinue = useCallback(() => {
    setSubStep("quiz");
  }, []);

  const handleQuizComplete = useCallback(
    (score: number) => {
      setQuizScore(score);
      setFirstQuizScore(score);
      setSubStep("celebration");
    },
    [setFirstQuizScore]
  );

  const handleCelebrationFinish = useCallback(async () => {
    completeFirstChapter();
    // Propagate the save promise so the celebration CTA can show loading and,
    // on failure, an inline retry instead of silently dropping the user.
    await onFinish();
  }, [completeFirstChapter, onFinish]);

  const isCelebration = subStep === "celebration";

  return (
    <div
      style={{
        width: "100%",
        maxWidth: 640,
        margin: "0 auto",
        padding: "0 20px",
      }}
    >
      {/* Chapter header */}
      {!isCelebration && (
        <div style={{ textAlign: "center", marginBottom: 8 }}>
          <p
            style={{
              fontFamily: "var(--font-body, sans-serif)",
              fontSize: 14,
              color: "var(--cf-text-soft)",
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              margin: "0 0 8px",
            }}
          >
            Chapter 1 · Sample Lesson
          </p>
        </div>
      )}

      {/* Sub-step indicator */}
      {!isCelebration && <SubStepIndicator current={subStep} />}

      {/* Glass-elevated container */}
      <div
        style={{
          background: isCelebration ? "transparent" : "var(--cf-surface-muted)",
          border: isCelebration ? "none" : "1px solid var(--cf-border)",
          borderRadius: "var(--radius-xl-val, 24px)",
          padding: isCelebration ? "0" : "28px 24px",
          boxShadow: isCelebration ? "none" : "var(--cf-shadow-md)",
        }}
      >

        {/* Sub-step content */}
        <AnimatePresence mode="wait">
          {subStep === "summary" && (
            <motion.div
              key="summary"
              variants={subStepVariants}
              initial={prefersReducedMotion ? false : "enter"}
              animate="center"
              exit="exit"
              transition={
                prefersReducedMotion ? { duration: 0.01 } : subStepTransition
              }
            >
              <MiniSummary onContinue={handleSummaryContinue} />
            </motion.div>
          )}

          {subStep === "scenario" && (
            <motion.div
              key="scenario"
              variants={subStepVariants}
              initial={prefersReducedMotion ? false : "enter"}
              animate="center"
              exit="exit"
              transition={
                prefersReducedMotion ? { duration: 0.01 } : subStepTransition
              }
            >
              <MiniScenario onContinue={handleScenarioContinue} />
            </motion.div>
          )}

          {subStep === "quiz" && (
            <motion.div
              key="quiz"
              variants={subStepVariants}
              initial={prefersReducedMotion ? false : "enter"}
              animate="center"
              exit="exit"
              transition={
                prefersReducedMotion ? { duration: 0.01 } : subStepTransition
              }
            >
              <MiniQuiz onComplete={handleQuizComplete} />
            </motion.div>
          )}

          {subStep === "celebration" && (
            <motion.div
              key="celebration"
              variants={subStepVariants}
              initial={prefersReducedMotion ? false : "enter"}
              animate="center"
              exit="exit"
              transition={
                prefersReducedMotion ? { duration: 0.01 } : subStepTransition
              }
            >
              <UnlockCelebration
                quizScore={quizScore}
                onFinish={handleCelebrationFinish}
                // A brand-new onboarding user's first active day IS day 1. The
                // completion route counts today as that day (currentStreak → 1)
                // and the dashboard reflects it after the POST — but the
                // celebration paints BEFORE that POST fires, so the response
                // can't be known here. We pass the deterministic, honest 1
                // explicitly (rather than leaving the prop silently unused) so
                // the displayed streak stays server-truthful for a new user.
                currentStreak={1}
                starterCovers={starterCovers}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
