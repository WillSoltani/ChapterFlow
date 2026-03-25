"use client";

const STEP_LABELS = ["Summary", "Scenarios", "Quiz", "Unlock"] as const;

type StepIndicatorsProps = {
  stepsCompleted: number;
  isInProgress?: boolean;
  accentColor?: "green" | "indigo";
  /** Use extra-dim dots for locked/next-unlockable cards */
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
            accentColor === "green" ? "bg-emerald-400" : "bg-indigo-400";
        } else if (isCurrent) {
          dotClass =
            accentColor === "green"
              ? "bg-emerald-400 bd-dot-pulse"
              : "bg-indigo-400 bd-dot-pulse";
        } else {
          dotClass = lockedDots ? "bg-white/[0.06]" : "bg-white/[0.10]";
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
