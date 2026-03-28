"use client";

import { motion } from "framer-motion";
import type { StepNumber } from "./progressTypes";

const STEP_LABELS = ["Summary", "Scenarios", "Quiz", "Unlock"] as const;
const STEP_LABELS_SHORT = ["Sum", "Scen", "Quiz", "Unlk"] as const;

interface StepIndicatorProps {
  currentStep: StepNumber;
  totalSteps?: number;
  size?: "sm" | "md";
}

export function StepIndicator({
  currentStep,
  totalSteps = 4,
  size = "md",
}: StepIndicatorProps) {
  const dotSize = size === "sm" ? 10 : 12;
  const currentDotSize = size === "sm" ? 14 : 16;
  const lineHeight = 2;

  return (
    <div className="flex flex-col items-start gap-1.5">
      {/* Dots + connecting lines row */}
      <div className="flex w-full items-center">
        {Array.from({ length: totalSteps }, (_, i) => {
          const stepNum = (i + 1) as StepNumber;
          const isCompleted = stepNum < currentStep;
          const isCurrent = stepNum === currentStep;
          const effectiveDot = isCurrent ? currentDotSize : dotSize;

          return (
            <div key={stepNum} className="flex flex-1 items-center last:flex-none">
              {/* Dot */}
              <div className="relative flex items-center justify-center">
                {isCurrent ? (
                  <motion.div
                    className="rounded-full"
                    style={{
                      width: effectiveDot,
                      height: effectiveDot,
                      background: "var(--accent-cyan)",
                      boxShadow: "0 0 12px rgba(34,211,238,0.5)",
                    }}
                    animate={{ scale: [1, 1.25, 1] }}
                    transition={{ repeat: Infinity, duration: 1.5, ease: "easeInOut" }}
                    aria-label={`Step ${stepNum} of ${totalSteps}: ${STEP_LABELS[i]} (current)`}
                  />
                ) : (
                  <div
                    className="rounded-full"
                    style={{
                      width: effectiveDot,
                      height: effectiveDot,
                      background: isCompleted
                        ? "var(--accent-cyan)"
                        : "transparent",
                      border: isCompleted
                        ? "none"
                        : "2px solid var(--text-tertiary)",
                    }}
                    aria-label={`Step ${stepNum} of ${totalSteps}: ${STEP_LABELS[i]} (${isCompleted ? "completed" : "upcoming"})`}
                  />
                )}
              </div>

              {/* Connecting line */}
              {i < totalSteps - 1 && (
                <div
                  className="mx-0.5 flex-1"
                  style={{
                    height: lineHeight,
                    minWidth: size === "sm" ? 8 : 12,
                    background: isCompleted
                      ? "var(--accent-cyan)"
                      : "transparent",
                    borderTop: isCompleted
                      ? "none"
                      : `${lineHeight}px dashed var(--text-tertiary)`,
                  }}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Labels row — only for md size */}
      {size === "md" && (
        <div className="flex w-full items-center">
          {STEP_LABELS.map((label, i) => {
            const stepNum = (i + 1) as StepNumber;
            const isCurrent = stepNum === currentStep;
            const isCompleted = stepNum < currentStep;

            return (
              <span
                key={label}
                className="flex-1 whitespace-nowrap text-center last:flex-none"
                style={{
                  fontSize: 11,
                  color: isCompleted
                    ? "var(--accent-cyan)"
                    : isCurrent
                      ? "var(--accent-cyan)"
                      : "var(--text-tertiary)",
                  fontWeight: isCurrent ? 600 : 400,
                }}
              >
                {/* Full label on lg+, abbreviated below */}
                <span className="hidden lg:inline">{label}</span>
                <span className="lg:hidden">{STEP_LABELS_SHORT[i]}</span>
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}
