"use client";

import { useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { ChevronLeft } from "lucide-react";
import { useOnboarding } from "../hooks/useOnboarding";
import type { StarterShelfItem } from "../hooks/useOnboarding";
import { stepVariants, stepTransition } from "../utils/animations";
import OnboardingProgress from "./OnboardingProgress";
import StepMotivation from "./StepMotivation";
import StepInterests from "./StepInterests";
import StepPace from "./StepPace";
import StepStarterShelf from "./StepStarterShelf";
import StepFirstLoop from "./StepFirstLoop";

export function OnboardingFlow() {
  const router = useRouter();
  const onboarding = useOnboarding();
  const { currentStep, direction, nextStep, prevStep, skipStep, clearOnboarding } = onboarding;
  const prefersReducedMotion = useReducedMotion();

  // Ref for the First Loop step (final step) sub-step back navigation
  const loopBackRef = useRef<(() => void) | null>(null);

  const normalizeStarterShelfItem = (item: StarterShelfItem): string =>
    typeof item === "string" ? item : item.id ?? "";

  const handleBack = useCallback(() => {
    if (currentStep === 5 && loopBackRef.current) {
      loopBackRef.current();
    } else {
      prevStep();
    }
  }, [currentStep, prevStep]);

  const handleSkip = useCallback(() => {
    skipStep();
  }, [skipStep]);

  // Awaited by the celebration's CTA so it can show a loading state and, on
  // failure, an inline retry. Throws on a failed save — the server route is
  // lenient (it coerces invalid fields rather than rejecting), so a non-OK
  // response or a network error is a real failure worth surfacing, not
  // something to silently drop into an unread localStorage key.
  const handleFinish = useCallback(async () => {
    const saveData = {
      motivation: onboarding.motivation,
      interests: onboarding.interests,
      tone: onboarding.tone,
      dailyGoal: onboarding.dailyGoal,
      chapterOrder: onboarding.chapterOrder,
      starterShelf: Array.isArray(onboarding.starterShelf)
        ? onboarding.starterShelf.map(normalizeStarterShelfItem).filter(Boolean)
        : [],
      firstQuizScore: onboarding.firstQuizScore,
      // Lets the server count today as the user's first active day in their
      // local timezone (drives the "1 Day streak" the celebration shows).
      timezone:
        typeof Intl !== "undefined"
          ? Intl.DateTimeFormat().resolvedOptions().timeZone
          : undefined,
    };

    const resp = await fetch("/app/api/book/me/onboarding/complete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(saveData),
    });
    if (!resp.ok) {
      throw new Error(`Failed to save onboarding (${resp.status})`);
    }

    // Consume the response body so the real grant totals the route reports
    // (points balance + the day streak it counted for today) are read rather
    // than silently discarded. The celebration already renders the deterministic
    // grant amounts before this POST fires, then navigates to /dashboard — which
    // reads the now-persisted server state — so the user lands on totals that
    // match what was actually granted. Parsing is best-effort: a malformed body
    // must not turn an already-persisted save into a failure.
    try {
      await resp.json();
    } catch {
      /* non-fatal — save already succeeded */
    }

    // Saved — clear the local onboarding state and mark the legacy state
    // complete so the old /book home doesn't bounce the user back.
    clearOnboarding();
    try {
      const legacyKey = "book-accelerator:onboarding:v5";
      const legacyRaw = localStorage.getItem(legacyKey);
      const legacy = legacyRaw ? JSON.parse(legacyRaw) : {};
      // Mirror the reader-relevant picks under the field names the reader's seed
      // (useBookPreferences) and useOnboardingState read, so tone and chapter-start
      // order take effect on THIS device immediately. Fresh devices are covered
      // separately by server-settings hydration in useBookPreferences. See H21.
      const chapterStartMode =
        onboarding.chapterOrder === "scenarios_first" ? "practical-first" : "summary-first";
      localStorage.setItem(
        legacyKey,
        JSON.stringify({
          ...legacy,
          setupComplete: true,
          completedAt: new Date().toISOString(),
          motivationStyle: onboarding.tone,
          chapterStartMode,
          dailyGoalMinutes: onboarding.dailyGoal,
        })
      );
    } catch {}

    const root = document.getElementById("onboarding-root");
    if (root) {
      root.style.transition = "opacity var(--duration-page, 400ms) var(--ease-out)";
      root.style.opacity = "0";
    }
    setTimeout(() => router.push("/dashboard"), 400);
  }, [router, clearOnboarding, onboarding]);

  return (
    <div
      id="onboarding-root"
      className="relative min-h-dvh overflow-hidden"
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
        className="fixed top-7 left-0 right-0 z-40 flex items-center justify-between px-5 py-3"
      >
        {/* Left side: back button + logo */}
        <div className="flex items-center gap-3">
          {/* Back arrow — visible on steps 2+ (hidden on celebration) */}
          {currentStep > 1 && (
            <button
              onClick={handleBack}
              aria-label="Go back"
              className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-full border-none bg-transparent text-(--text-secondary) transition-colors duration-200 hover:bg-(--cf-surface-muted) hover:text-(--text-heading)"
            >
              <ChevronLeft size={20} strokeWidth={2} />
            </button>
          )}

          {/* Logo — decorative, not interactive */}
          <div className="flex cursor-default items-center gap-2">
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <rect
                x="3" y="2" width="14" height="20" rx="2"
                stroke="var(--accent-cyan)" strokeWidth="1.5"
              />
              <path
                d="M7 7h6M7 11h6M7 15h4"
                stroke="var(--accent-cyan)" strokeWidth="1.5" strokeLinecap="round"
              />
              <rect
                x="7" y="4" width="14" height="20" rx="2"
                fill="var(--bg-base)" stroke="var(--accent-cyan)" strokeWidth="1.5"
              />
              <path
                d="M11 9h6M11 13h6M11 17h4"
                stroke="var(--accent-cyan)" strokeWidth="1.5" strokeLinecap="round"
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

        {/* Skip — visible on steps 1-4 (not the final First Loop step) */}
        {currentStep < 5 && (
          <button
            onClick={handleSkip}
            className="flex min-h-12 cursor-pointer items-center border-none bg-transparent font-(family-name:--font-dm-sans) text-[13px] text-(--text-muted) transition-colors duration-200 hover:text-(--text-secondary)"
          >
            Skip
          </button>
        )}
      </header>

      {/* Main content */}
      <main className="flex-1 flex items-center justify-center md:justify-start min-h-dvh px-5 md:px-8 pt-20 md:pt-24 pb-8">
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
              <StepFirstLoop onFinish={handleFinish} onBack={prevStep} backRef={loopBackRef} />
            )}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}
