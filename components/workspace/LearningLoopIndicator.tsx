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
    <div className={`flex items-center gap-1 ${className}`} aria-label="Learning progress">
      {steps.map((step, i) => {
        const state = getStepState(step.key, currentStep);
        return (
          <div key={step.key} className="flex items-center">
            <div className="flex flex-col items-center gap-1">
              <motion.div
                className="rounded-full"
                style={{
                  width: 10,
                  height: 10,
                  background:
                    state === "completed"
                      ? "#7C3AED"
                      : state === "current"
                        ? "#7C3AED"
                        : "rgba(255,255,255,0.1)",
                  boxShadow:
                    state === "current"
                      ? "0 0 8px rgba(124,58,237,0.4)"
                      : "none",
                }}
                animate={
                  state === "current" && !prefersReducedMotion
                    ? { scale: [1, 1.2, 1] }
                    : undefined
                }
                transition={
                  state === "current" && !prefersReducedMotion
                    ? { duration: 1.5, repeat: Infinity }
                    : undefined
                }
                role="progressbar"
                aria-valuenow={state === "completed" ? 100 : state === "current" ? 50 : 0}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`${step.label}: ${state}`}
              />
              <span
                className="text-[9px]"
                style={{
                  color:
                    state === "future" ? "#6B6B80" : "#A0A0B8",
                }}
              >
                {step.label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div
                className="mx-1.5 mb-4"
                style={{
                  width: 16,
                  height: 1,
                  background:
                    state === "completed"
                      ? "rgba(124,58,237,0.4)"
                      : "rgba(255,255,255,0.08)",
                }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
