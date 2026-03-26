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
    <div className="mt-1.5 flex items-center gap-1.5">
      {STEP_LABELS.map((label, index) => {
        const isComplete = index < stepsCompleted;
        const isCurrent = isInProgress && index === stepsCompleted;

        let dotClass: string;
        if (isComplete) {
          dotClass =
            accentColor === "green"
              ? "bg-(--cf-success-text)"
              : "bg-(--cf-accent)";
        } else if (isCurrent) {
          dotClass =
            accentColor === "green"
              ? "bg-(--cf-success-text) bd-dot-pulse"
              : "bg-(--cf-accent) bd-dot-pulse";
        } else {
          dotClass = lockedDots
            ? "bg-(--cf-border)"
            : "bg-(--cf-border-strong)";
        }

        return (
          <span key={label} className="tooltip-trigger" data-tooltip={label}>
            <span
              className={`block rounded-full transition-colors duration-200 ${isInProgress || isComplete ? "h-2 w-2" : "h-1.5 w-1.5"} ${dotClass}`}
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
