"use client";

import { motion, useReducedMotion } from "framer-motion";

interface OnboardingProgressProps {
  currentStep: number;
  totalSteps?: number;
}

export default function OnboardingProgress({
  currentStep,
  totalSteps = 5,
}: OnboardingProgressProps) {
  const prefersReducedMotion = useReducedMotion();

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 50,
        padding: "0 16px",
      }}
    >
      {/* Step label */}
      <div
        style={{
          display: "flex",
          justifyContent: "flex-end",
          padding: "8px 0 4px",
        }}
      >
        <span
          style={{
            fontFamily: "var(--font-dm-sans)",
            fontSize: 12,
            color: "var(--text-muted)",
            userSelect: "none",
          }}
        >
          Step {currentStep} of {totalSteps}
        </span>
      </div>

      {/* Segmented bar */}
      <div
        style={{
          display: "flex",
          gap: 2,
          width: "100%",
        }}
        role="progressbar"
        aria-valuenow={currentStep}
        aria-valuemin={1}
        aria-valuemax={totalSteps}
        aria-label={`Onboarding progress: step ${currentStep} of ${totalSteps}`}
      >
        {Array.from({ length: totalSteps }, (_, i) => {
          const stepIndex = i + 1;
          const isActive = stepIndex <= currentStep;

          return (
            <div
              key={stepIndex}
              style={{
                flex: 1,
                height: 3,
                borderRadius: 2,
                position: "relative",
                overflow: "hidden",
                backgroundColor: "rgba(255,255,255,0.06)",
              }}
            >
              <motion.div
                initial={{ width: 0 }}
                animate={{
                  width: isActive ? "100%" : "0%",
                }}
                transition={
                  prefersReducedMotion
                    ? { duration: 0 }
                    : {
                        type: "spring",
                        stiffness: 300,
                        damping: 30,
                        mass: 0.8,
                      }
                }
                style={{
                  height: "100%",
                  borderRadius: 2,
                  background:
                    "linear-gradient(90deg, var(--accent-blue), var(--accent-teal))",
                }}
              />

              {/* Glow pulse when segment fills */}
              {isActive && (
                <motion.div
                  initial={{ opacity: 0.7 }}
                  animate={{ opacity: 0 }}
                  transition={
                    prefersReducedMotion
                      ? { duration: 0 }
                      : { duration: 0.6, ease: "easeOut" }
                  }
                  style={{
                    position: "absolute",
                    inset: -2,
                    borderRadius: 4,
                    background:
                      "linear-gradient(90deg, var(--glow-blue), var(--glow-green))",
                    pointerEvents: "none",
                  }}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
