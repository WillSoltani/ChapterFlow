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
  const currentDotSize = size === "sm" ? 12 : 14;
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
                      background: "var(--cf-accent)",
                      boxShadow: "0 0 10px rgba(56,189,248,0.5)",
                    }}
                    animate={{ scale: [1, 1.2, 1] }}
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
                        ? "var(--cf-success-text)"
                        : "transparent",
                      border: isCompleted
                        ? "none"
                        : "2px solid var(--cf-border-strong)",
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
                      ? "var(--cf-success-text)"
                      : "var(--cf-surface-strong)",
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
                    ? "var(--cf-success-text)"
                    : isCurrent
                      ? "var(--cf-accent)"
                      : "var(--text-muted)",
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
