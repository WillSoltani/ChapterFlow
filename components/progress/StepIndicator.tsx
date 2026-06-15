"use client";

import { motion, useReducedMotion } from "framer-motion";
import {
  LEARNING_LOOP_STEPS as STEP_LABELS,
  LEARNING_LOOP_STEPS_SHORT as STEP_LABELS_SHORT,
} from "@/lib/learning-loop";
import type { StepNumber } from "./progressTypes";

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
  const prefersReduced = useReducedMotion();
  const lineHeight = 2;

  // Compact mode for "sm" — just dots + "Step X/4" text, no lines
  if (size === "sm") {
    return (
      <div className="flex items-center gap-1.5">
        {Array.from({ length: totalSteps }, (_, i) => {
          const stepNum = (i + 1) as StepNumber;
          const isCompleted = stepNum < currentStep;
          const isCurrent = stepNum === currentStep;
          return (
            <div
              key={stepNum}
              className="rounded-full"
              style={{
                width: 6,
                height: 6,
                background: isCompleted
                  ? "var(--accent-emerald)"
                  : isCurrent
                    ? "var(--cf-accent)"
                    : "var(--cf-progress-track)",
              }}
            />
          );
        })}
        <span className="ml-1 text-[10px]" style={{ color: "var(--text-muted)" }}>
          Step {currentStep}/4
        </span>
      </div>
    );
  }

  // Full mode for "md"
  return (
    <div className="flex flex-col items-start gap-1.5">
      {/* Dots + solid connecting lines */}
      <div className="flex w-full items-center">
        {Array.from({ length: totalSteps }, (_, i) => {
          const stepNum = (i + 1) as StepNumber;
          const isCompleted = stepNum < currentStep;
          const isCurrent = stepNum === currentStep;

          return (
            <div key={stepNum} className="flex flex-1 items-center last:flex-none">
              {/* Dot */}
              <div className="relative flex items-center justify-center">
                {isCurrent ? (
                  <motion.div
                    className="rounded-full"
                    style={{
                      width: 12,
                      height: 12,
                      background: "var(--cf-accent)",
                      boxShadow: "0 0 12px var(--cf-accent-shadow)",
                    }}
                    animate={prefersReduced ? { scale: 1 } : { scale: [1, 1.25, 1] }}
                    transition={
                      prefersReduced
                        ? { duration: 0 }
                        : { repeat: Infinity, duration: 2, ease: "easeInOut" }
                    }
                    aria-label={`Step ${stepNum} of ${totalSteps}: ${STEP_LABELS[i]} (current)`}
                  />
                ) : (
                  <div
                    className="rounded-full"
                    style={{
                      width: 10,
                      height: 10,
                      background: isCompleted
                        ? "var(--accent-emerald)"
                        : "transparent",
                      border: isCompleted
                        ? "none"
                        : "2px solid var(--cf-border-strong)",
                    }}
                    aria-label={`Step ${stepNum} of ${totalSteps}: ${STEP_LABELS[i]} (${isCompleted ? "completed" : "upcoming"})`}
                  />
                )}
              </div>

              {/* Solid connecting line */}
              {i < totalSteps - 1 && (
                <div
                  className="mx-0.5 flex-1"
                  style={{
                    height: lineHeight,
                    minWidth: 12,
                    background: isCompleted
                      ? "var(--accent-emerald)"
                      : "var(--cf-progress-track)",
                  }}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Labels row */}
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
                  ? "var(--accent-emerald)"
                  : isCurrent
                    ? "var(--cf-accent)"
                    : "var(--text-tertiary)",
                fontWeight: isCurrent ? 600 : 400,
              }}
            >
              <span className="hidden lg:inline">{label}</span>
              <span className="lg:hidden">{STEP_LABELS_SHORT[i]}</span>
            </span>
          );
        })}
      </div>
    </div>
  );
}
