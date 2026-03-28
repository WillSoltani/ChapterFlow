"use client";

const STEP_LABELS = ["Summary", "Scenarios", "Quiz", "Unlock"] as const;

type StepIndicatorsProps = {
  stepsCompleted: number;
  isInProgress?: boolean;
  accentColor?: "green" | "indigo";
  lockedDots?: boolean;
};

export function StepIndicators({
  stepsCompleted,
  isInProgress = false,
  accentColor = "green",
  lockedDots = false,
}: StepIndicatorsProps) {
  return (
    <div className="mt-1.5 flex items-center gap-2">
      {STEP_LABELS.map((label, index) => {
        const isComplete = index < stepsCompleted;
        const isCurrent = isInProgress && index === stepsCompleted;

        // Completed: filled emerald
        // Current: cyan with pulse
        // Future: hollow circle in tertiary
        let dotStyle: React.CSSProperties = {};
        let dotClass = "block rounded-full transition-colors duration-200";

        if (isComplete) {
          dotStyle = { background: "var(--accent-emerald)", width: 10, height: 10 };
        } else if (isCurrent) {
          dotStyle = { background: "var(--accent-cyan)", width: 10, height: 10 };
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
          <span key={label} className="tooltip-trigger" data-tooltip={label}>
            <span
              className={dotClass}
              style={dotStyle}
              aria-label={
                isComplete
                  ? `${label}: complete`
                  : isCurrent
                    ? `${label}: in progress`
                    : `${label}: not started`
              }
            />
          </span>
        );
      })}
    </div>
  );
}
