"use client";

import { motion, useReducedMotion } from "framer-motion";

type LoopStep = "summary" | "scenarios" | "quiz" | "unlock";

interface LearningLoopIndicatorProps {
  currentStep: LoopStep | null;
  className?: string;
}

const steps: { key: LoopStep; label: string }[] = [
  { key: "summary", label: "Summary" },
  { key: "scenarios", label: "Scenarios" },
  { key: "quiz", label: "Quiz" },
  { key: "unlock", label: "Unlock" },
];

function getStepState(
  stepKey: LoopStep,
  currentStep: LoopStep | null
): "completed" | "current" | "future" {
  if (!currentStep) return "future";
  const currentIdx = steps.findIndex((s) => s.key === currentStep);
  const stepIdx = steps.findIndex((s) => s.key === stepKey);
  if (stepIdx < currentIdx) return "completed";
  if (stepIdx === currentIdx) return "current";
  return "future";
}

export function LearningLoopIndicator({
  currentStep,
  className = "",
}: LearningLoopIndicatorProps) {
  const prefersReducedMotion = useReducedMotion();

  return (
    <div
      className={`flex items-center gap-0 ${className}`}
      aria-label="Learning progress"
    >
      {steps.map((step, i) => {
        const state = getStepState(step.key, currentStep);
        return (
          <div key={step.key} className="flex items-center">
            <div className="flex flex-col items-center gap-1.5">
              {/* Dot */}
              <div className="relative">
                <div
                  className="rounded-full transition-all duration-300"
                  style={{
                    width: 12,
                    height: 12,
                    background:
                      state === "completed"
                        ? "var(--cf-accent)"
                        : state === "current"
                          ? "var(--cf-accent)"
                          : "var(--cf-border-strong)",
                    boxShadow:
                      state === "current"
                        ? "0 0 0 4px rgba(167,139,250,0.2)"
                        : "none",
                  }}
                />
                {state === "current" && !prefersReducedMotion && (
                  <motion.div
                    className="absolute inset-0 rounded-full"
                    style={{ background: "var(--cf-accent)" }}
                    animate={{ scale: [1, 1.15, 1], opacity: [1, 0.7, 1] }}
                    transition={{
                      duration: 2,
                      repeat: Infinity,
                      ease: "easeInOut",
                    }}
                  />
                )}
              </div>
              {/* Label */}
              <span
                className="text-[11px] tracking-wide"
                style={{
                  color:
                    state === "current"
                      ? "var(--cf-text-2)"
                      : state === "completed"
                        ? "var(--cf-text-3)"
                        : "var(--cf-text-soft)",
                  fontWeight: state === "current" ? 500 : 400,
                }}
              >
                {step.label}
              </span>
            </div>
            {/* Connector line */}
            {i < steps.length - 1 && (
              <div
                className="mx-2 mb-5"
                style={{
                  width: 24,
                  height: 2,
                  background:
                    state === "completed"
                      ? "var(--cf-accent)"
                      : "var(--cf-surface-strong)",
                  borderRadius: 1,
                }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
