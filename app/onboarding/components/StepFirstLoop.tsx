"use client";

import { useState, useCallback } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { useOnboarding } from "@/app/onboarding/hooks/useOnboarding";
import {
  subStepVariants,
  subStepTransition,
} from "@/app/onboarding/utils/animations";
import MiniSummary from "./MiniSummary";
import MiniScenario from "./MiniScenario";
import MiniQuiz from "./MiniQuiz";
import UnlockCelebration from "./UnlockCelebration";

interface StepFirstLoopProps {
  onFinish: () => void;
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
              fontFamily: "var(--font-dm-sans, sans-serif)",
              fontSize: 13,
              fontWeight: isActive ? 600 : 400,
              padding: "5px 12px",
              borderRadius: 999,
              background: isActive
                ? "rgba(79,139,255,0.15)"
                : "var(--cf-surface)",
              border: isActive
                ? "1px solid rgba(79,139,255,0.3)"
                : "1px solid var(--cf-border)",
              color: isActive
                ? "#5B8DEF"
                : isCompleted
                  ? "var(--accent-teal)"
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
  const { setFirstQuizScore, completeFirstChapter } = useOnboarding();

  const [subStep, setSubStep] = useState<SubStep>("summary");

  /** Called by parent's back button — navigates within sub-steps or exits to Step 5 */
  const handleBack = useCallback(() => {
    if (subStep === "scenario") setSubStep("summary");
    else if (subStep === "quiz") setSubStep("scenario");
    else if (subStep === "summary") onBack();
    // celebration: don't allow back
  }, [subStep, onBack]);

  // Register back handler with parent so the header back button can call it
  backRef.current = handleBack;
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

  const handleCelebrationFinish = useCallback(() => {
    completeFirstChapter();
    onFinish();
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
              fontFamily: "var(--font-dm-sans, sans-serif)",
              fontSize: 14,
              color: "var(--cf-text-soft)",
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              margin: "0 0 8px",
            }}
          >
            Chapter 1 · Atomic Habits
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
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
