"use client";

import { LEARNING_LOOP_STEPS as STEP_LABELS } from "@/lib/learning-loop";

type StepIndicatorsProps = {
  stepsCompleted: number;
  isInProgress?: boolean;
  lockedDots?: boolean;
};

export function StepIndicators({
  stepsCompleted,
  isInProgress = false,
  lockedDots = false,
}: StepIndicatorsProps) {
  return (
    <div
      className="mt-1.5 flex items-center gap-2"
      role="list"
      aria-label="Chapter learning steps"
    >
      {STEP_LABELS.map((label, index) => {
        const isComplete = index < stepsCompleted;
        const isCurrent = isInProgress && index === stepsCompleted;

        // Completed: filled circle
        // Current: larger bullseye with an optional pulse
        // Future: hollow circle in tertiary
        let dotStyle: React.CSSProperties = {};
        let dotClass =
          "flex items-center justify-center rounded-full transition-colors duration-200";

        if (isComplete) {
          dotStyle = { background: "var(--accent-emerald)", width: 10, height: 10 };
        } else if (isCurrent) {
          dotStyle = {
            background: "transparent",
            border: "2px solid var(--accent-cyan)",
            width: 12,
            height: 12,
          };
          dotClass += " bd-dot-pulse";
        } else if (lockedDots) {
          dotStyle = { background: "var(--cf-border)", width: 6, height: 6 };
        } else {
          dotStyle = {
            width: 10,
            height: 10,
            background: "transparent",
            border: "1.5px solid var(--text-tertiary)",
          };
        }

        return (
          <span
            key={label}
            className="tooltip-trigger"
            data-tooltip={label}
            role="listitem"
          >
            <span
              className={dotClass}
              style={dotStyle}
              role="img"
              aria-current={isCurrent ? "step" : undefined}
              aria-label={
                isComplete
                  ? `${label}: complete`
                  : isCurrent
                    ? `${label}: in progress`
                    : `${label}: not started`
              }
            >
              {isCurrent ? (
                <span
                  data-current-marker
                  aria-hidden="true"
                  className="block h-1 w-1 rounded-full"
                  style={{ background: "var(--accent-cyan)" }}
                />
              ) : null}
            </span>
          </span>
        );
      })}
    </div>
  );
}
