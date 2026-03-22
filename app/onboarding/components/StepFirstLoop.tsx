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
}

type SubStep = "summary" | "scenario" | "quiz" | "celebration";

export default function StepFirstLoop({ onFinish }: StepFirstLoopProps) {
  const prefersReducedMotion = useReducedMotion();
  const { setFirstQuizScore, completeFirstChapter } = useOnboarding();

  const [subStep, setSubStep] = useState<SubStep>("summary");
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

  const showHeading = subStep === "summary" || subStep === "scenario";

  return (
    <div
      style={{
        width: "100%",
        maxWidth: 640,
        margin: "0 auto",
        padding: "0 20px",
      }}
    >
      {/* Glass-elevated container */}
      <div
        style={{
          background: "rgba(255,255,255,0.05)",
          border: "1px solid var(--border-subtle, rgba(255,255,255,0.06))",
          borderRadius: "var(--radius-xl-val, 24px)",
          padding: "28px 24px",
          boxShadow: "var(--shadow-card, 0 4px 24px rgba(0,0,0,0.3))",
        }}
      >
        {/* Heading — fades as sub-steps progress */}
        <AnimatePresence>
          {showHeading && (
            <motion.h2
              initial={prefersReducedMotion ? false : { opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.3 }}
              style={{
                fontFamily: "var(--font-sora, sans-serif)",
                fontSize: 24,
                fontWeight: 600,
                color: "var(--text-heading, #FAFAFA)",
                marginBottom: 24,
              }}
            >
              Your first chapter
            </motion.h2>
          )}
        </AnimatePresence>

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
