"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useOnboarding } from "../hooks/useOnboarding";
import { stepVariants, stepTransition } from "../utils/animations";
import OnboardingProgress from "./OnboardingProgress";
import StepMotivation from "./StepMotivation";
import StepInterests from "./StepInterests";
import StepPace from "./StepPace";
import StepStarterShelf from "./StepStarterShelf";
import StepFirstLoop from "./StepFirstLoop";

export function OnboardingFlow() {
  const router = useRouter();
  const { currentStep, direction, nextStep, goToStep } = useOnboarding();

  const handleSkip = useCallback(() => {
    router.push("/dashboard");
  }, [router]);

  const handleFinish = useCallback(() => {
    const root = document.getElementById("onboarding-root");
    if (root) {
      root.style.transition = "opacity 0.4s ease";
      root.style.opacity = "0";
    }
    setTimeout(() => router.push("/dashboard"), 400);
  }, [router]);

  return (
    <div
      id="onboarding-root"
      className="relative min-h-screen overflow-hidden"
      style={{ background: "var(--bg-base)" }}
    >
      {/* Background gradient orbs */}
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
        <div
          className="absolute"
          style={{
            width: 600,
            height: 600,
            top: "-10%",
            left: "-5%",
            background: "radial-gradient(circle, rgba(124,107,240,0.08), transparent 70%)",
          }}
        />
        <div
          className="absolute"
          style={{
            width: 500,
            height: 500,
            bottom: "-10%",
            right: "-5%",
            background: "radial-gradient(circle, rgba(62,207,178,0.06), transparent 70%)",
          }}
        />
      </div>

      {/* Progress bar */}
      <OnboardingProgress currentStep={currentStep} />

      {/* Header */}
      <header
        className="fixed top-[28px] left-0 right-0 z-40 flex items-center justify-between"
        style={{ padding: "12px 20px" }}
      >
        {/* Logo */}
        <div className="flex items-center gap-2">
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <rect
              x="3" y="2" width="14" height="20" rx="2"
              stroke="var(--accent-blue)" strokeWidth="1.5"
            />
            <path
              d="M7 7h6M7 11h6M7 15h4"
              stroke="var(--accent-blue)" strokeWidth="1.5" strokeLinecap="round"
            />
            <rect
              x="7" y="4" width="14" height="20" rx="2"
              fill="var(--bg-base)" stroke="var(--accent-blue)" strokeWidth="1.5"
            />
            <path
              d="M11 9h6M11 13h6M11 17h4"
              stroke="var(--accent-blue)" strokeWidth="1.5" strokeLinecap="round"
            />
          </svg>
          <span
            style={{
              fontFamily: "var(--font-sora)",
              fontSize: 16,
              fontWeight: 600,
              color: "var(--text-heading)",
            }}
          >
            ChapterFlow
          </span>
        </div>

        {/* Skip — visible on steps 1-4 (not step 5) */}
        {currentStep < 5 && (
          <button
            onClick={handleSkip}
            className="cursor-pointer transition-colors duration-200"
            style={{
              fontFamily: "var(--font-dm-sans)",
              fontSize: 13,
              color: "var(--text-muted)",
              background: "none",
              border: "none",
              minHeight: 48,
              display: "flex",
              alignItems: "center",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "var(--text-secondary)")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-muted)")}
          >
            Skip setup
          </button>
        )}
      </header>

      {/* Main content */}
      <main className="flex-1 flex items-center justify-center min-h-screen px-5 md:px-8 pt-20 pb-8">
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={currentStep}
            className="w-full flex justify-center"
            custom={direction}
            variants={stepVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={stepTransition}
          >
            {currentStep === 1 && (
              <StepMotivation onNext={nextStep} />
            )}
            {currentStep === 2 && (
              <StepInterests onNext={nextStep} onSkip={nextStep} />
            )}
            {currentStep === 3 && (
              <StepPace onNext={nextStep} />
            )}
            {currentStep === 4 && (
              <StepStarterShelf onNext={nextStep} />
            )}
            {currentStep === 5 && (
              <StepFirstLoop onFinish={handleFinish} />
            )}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}
