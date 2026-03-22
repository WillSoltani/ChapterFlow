"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { OnboardingProgress } from "./OnboardingProgress";
import { OnboardingHeader } from "./OnboardingHeader";
import { OnboardingFooter } from "./OnboardingFooter";
import { Step1Personalize } from "./Step1Personalize";
import { Step2FirstChapter } from "./Step2FirstChapter";
import { Step3StarterShelf } from "./Step3StarterShelf";
import type { PersonalizationChoice } from "./chapterData";
import type { ChapterSubStep, ScenarioAnswer, QuizAnswer } from "./Step2FirstChapter";

type OnboardingStep = 1 | 2 | 3;

const STEP_TRANSITION = {
  duration: 0.4,
  ease: [0.22, 1, 0.36, 1] as const,
};

export function OnboardingFlow() {
  const router = useRouter();
  const userName = "Will";

  /* ── All state lives here ── */
  const [currentStep, setCurrentStep] = useState<OnboardingStep>(1);
  const [personalizationChoice, setPersonalizationChoice] = useState<PersonalizationChoice | null>(null);
  const [chapterSubStep, setChapterSubStep] = useState<ChapterSubStep>("summary");
  const [scenarioAnswer, setScenarioAnswer] = useState<ScenarioAnswer>(null);
  const [quizAnswer, setQuizAnswer] = useState<QuizAnswer>(null);
  const [quizCompleted, setQuizCompleted] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);

  /* ── Step 1 → 2 (brief pulse delay) ── */
  const handleStep1Continue = useCallback(() => {
    setTimeout(() => setCurrentStep(2), 300);
  }, []);

  /* ── Step 3 → Dashboard (fade-out transition) ── */
  const handleLaunch = useCallback(() => {
    // Let progress bar hit 100% first, then fade out page
    setTimeout(() => {
      const root = document.getElementById("onboarding-root");
      if (root) {
        root.style.transition = "opacity 0.4s ease";
        root.style.opacity = "0";
      }
      setTimeout(() => router.push("/dashboard"), 400);
    }, 500);
  }, [router]);

  /* ── Footer config per step ── */
  const footer = (() => {
    switch (currentStep) {
      case 1:
        return {
          visible: true,
          buttonText: "Start my first chapter →",
          buttonDisabled: personalizationChoice === null,
          onButtonClick: handleStep1Continue,
        };
      case 2:
        return {
          visible: quizCompleted,
          buttonText: "See my starter shelf →",
          buttonDisabled: false,
          onButtonClick: () => setCurrentStep(3),
        };
      case 3:
        return {
          visible: true,
          buttonText: "Start reading →",
          buttonDisabled: false,
          onButtonClick: handleLaunch,
        };
    }
  })();

  return (
    <div
      id="onboarding-root"
      className="relative min-h-screen overflow-hidden"
      style={{ background: "var(--bg-base)" }}
    >
      {/* Background atmosphere */}
      <div
        className="absolute inset-0 z-0 pointer-events-none"
        style={{ background: "radial-gradient(500px circle at 50% 30%, rgba(26,26,46,0.2), transparent)" }}
      />

      <OnboardingProgress currentStep={currentStep} />
      <OnboardingHeader currentStep={currentStep} />

      {/* Centered content */}
      <main className="flex-1 flex items-center justify-center min-h-screen px-5 md:px-8">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentStep}
            className="w-full flex justify-center"
            initial={{ opacity: 0, x: 60 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -60 }}
            transition={STEP_TRANSITION}
          >
            {currentStep === 1 && (
              <Step1Personalize
                userName={userName}
                personalizationChoice={personalizationChoice}
                onSelect={setPersonalizationChoice}
              />
            )}

            {currentStep === 2 && personalizationChoice && (
              <Step2FirstChapter
                personalizationChoice={personalizationChoice}
                chapterSubStep={chapterSubStep}
                scenarioAnswer={scenarioAnswer}
                quizAnswer={quizAnswer}
                showConfetti={showConfetti}
                onChapterSubStepChange={setChapterSubStep}
                onScenarioAnswer={setScenarioAnswer}
                onQuizAnswer={setQuizAnswer}
                onShowConfetti={setShowConfetti}
                onQuizCompleted={() => setQuizCompleted(true)}
              />
            )}

            {currentStep === 3 && personalizationChoice && (
              <Step3StarterShelf personalizationChoice={personalizationChoice} />
            )}
          </motion.div>
        </AnimatePresence>
      </main>

      <OnboardingFooter
        currentStep={currentStep}
        buttonText={footer.buttonText}
        buttonDisabled={footer.buttonDisabled}
        onButtonClick={footer.onButtonClick}
        visible={footer.visible}
      />
    </div>
  );
}
