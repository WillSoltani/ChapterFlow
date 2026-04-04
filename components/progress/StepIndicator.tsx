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
                  ? "#34D399"
                  : isCurrent
                    ? "#22D3EE"
                    : "rgba(255,255,255,0.15)",
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
                      background: "#22D3EE",
                      boxShadow: "0 0 12px rgba(34,211,238,0.5)",
                    }}
                    animate={{ scale: [1, 1.25, 1] }}
                    transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
                    aria-label={`Step ${stepNum} of ${totalSteps}: ${STEP_LABELS[i]} (current)`}
                  />
                ) : (
                  <div
                    className="rounded-full"
                    style={{
                      width: 10,
                      height: 10,
                      background: isCompleted
                        ? "#34D399"
                        : "transparent",
                      border: isCompleted
                        ? "none"
                        : "2px solid rgba(255,255,255,0.2)",
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
                      ? "#34D399"
                      : "rgba(255,255,255,0.15)",
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
                  ? "#34D399"
                  : isCurrent
                    ? "#22D3EE"
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
