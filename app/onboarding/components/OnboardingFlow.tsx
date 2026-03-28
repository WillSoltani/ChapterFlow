"use client";

import { useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { ChevronLeft } from "lucide-react";
import { useOnboarding } from "../hooks/useOnboarding";
import { stepVariants, stepTransition } from "../utils/animations";
import OnboardingProgress from "./OnboardingProgress";
import StepMotivation from "./StepMotivation";
import StepInterests from "./StepInterests";
import StepTone from "./StepTone";
import StepPace from "./StepPace";
import StepStarterShelf from "./StepStarterShelf";
import StepFirstLoop from "./StepFirstLoop";

export function OnboardingFlow() {
  const router = useRouter();
  const onboarding = useOnboarding();
  const { currentStep, direction, nextStep, prevStep, skipStep, clearOnboarding } = onboarding;
  const prefersReducedMotion = useReducedMotion();

  // Ref for Step 6 sub-step back navigation
  const loopBackRef = useRef<(() => void) | null>(null);

  const handleBack = useCallback(() => {
    if (currentStep === 6 && loopBackRef.current) {
      loopBackRef.current();
    } else {
      prevStep();
    }
  }, [currentStep, prevStep]);

  const handleSkip = useCallback(() => {
    skipStep();
  }, [skipStep]);

  const handleFinish = useCallback(() => {
    // Save onboarding data to backend (non-blocking — don't trap user on failure)
    const saveData = {
      motivation: onboarding.motivation,
      interests: onboarding.interests,
      tone: onboarding.tone,
      dailyGoal: onboarding.dailyGoal,
      chapterOrder: onboarding.chapterOrder,
      starterShelf: Array.isArray(onboarding.starterShelf)
        ? onboarding.starterShelf.map((b: { id?: string }) => b?.id ?? b)
        : [],
      firstQuizScore: onboarding.firstQuizScore,
    };

    fetch("/api/book/me/onboarding/complete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(saveData),
    }).catch((err) => {
      console.error("Onboarding save failed:", err);
      // Store as fallback for retry on next page load
      try {
        localStorage.setItem("chapterflow_onboarding_pending", JSON.stringify(saveData));
      } catch {}
    });

    // Clear the new onboarding localStorage state
    clearOnboarding();

    // Also mark the legacy onboarding state as complete so BookHomeClient
    // doesn't redirect back to /book
    try {
      const legacyKey = "book-accelerator:onboarding:v5";
      const legacyRaw = localStorage.getItem(legacyKey);
      const legacy = legacyRaw ? JSON.parse(legacyRaw) : {};
      localStorage.setItem(
        legacyKey,
        JSON.stringify({
          ...legacy,
          setupComplete: true,
          completedAt: new Date().toISOString(),
        })
      );
    } catch {}

    const root = document.getElementById("onboarding-root");
    if (root) {
      root.style.transition = "opacity 0.4s ease";
      root.style.opacity = "0";
    }
    setTimeout(() => router.push("/dashboard"), 400);
  }, [router, clearOnboarding, onboarding]);

  return (
    <div
      id="onboarding-root"
      className="relative min-h-screen overflow-hidden"
      style={{ background: "var(--bg-base)" }}
    >
      {/* Background gradient orbs */}
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
        {/* Purple orb — top left */}
        <div
          className="absolute"
          style={{
            width: 500,
            height: 500,
            top: -200,
            left: -150,
            borderRadius: "50%",
            background: "radial-gradient(circle, color-mix(in srgb, var(--accent-violet) 12%, transparent) 0%, transparent 70%)",
          }}
        />

        {/* Teal orb — bottom right */}
        <div
          className="absolute"
          style={{
            width: 450,
            height: 450,
            bottom: -150,
            right: -100,
            borderRadius: "50%",
            background: "radial-gradient(circle, color-mix(in srgb, var(--accent-cyan) 8%, transparent) 0%, transparent 70%)",
          }}
        />

        {/* Blue orb — center right, slow drift */}
        <motion.div
          className="absolute"
          animate={
            prefersReducedMotion
              ? {}
              : {
                  y: [0, -20, 0],
                  x: [0, 10, 0],
                }
          }
          transition={
            prefersReducedMotion
              ? { duration: 0 }
              : {
                  duration: 8,
                  repeat: Infinity,
                  ease: "easeInOut",
                }
          }
          style={{
            width: 400,
            height: 400,
            top: "30%",
            right: -50,
            borderRadius: "50%",
            background: "radial-gradient(circle, color-mix(in srgb, var(--accent-cyan) 10%, transparent) 0%, transparent 70%)",
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
        {/* Left side: back button + logo */}
        <div className="flex items-center gap-3">
          {/* Back arrow — visible on steps 2+ (hidden on celebration) */}
          {currentStep > 1 && (
            <button
              onClick={handleBack}
              aria-label="Go back"
              className="cursor-pointer transition-colors duration-200"
              style={{
                background: "none",
                border: "none",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: 36,
                height: 36,
                borderRadius: "50%",
                color: "var(--text-secondary)",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = "var(--text-heading)";
                e.currentTarget.style.backgroundColor = "var(--cf-surface-muted)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = "var(--text-secondary)";
                e.currentTarget.style.backgroundColor = "transparent";
              }}
            >
              <ChevronLeft size={20} strokeWidth={2} />
            </button>
          )}

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
        </div>

        {/* Skip — visible on steps 1-5 (not step 6) */}
        {currentStep < 6 && (
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
            Skip
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
              <StepTone onNext={nextStep} />
            )}
            {currentStep === 4 && (
              <StepPace onNext={nextStep} />
            )}
            {currentStep === 5 && (
              <StepStarterShelf onNext={nextStep} />
            )}
            {currentStep === 6 && (
              <StepFirstLoop onFinish={handleFinish} onBack={prevStep} backRef={loopBackRef} />
            )}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}
