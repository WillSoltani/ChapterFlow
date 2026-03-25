"use client";

import { Check, FileText, HelpCircle, Lightbulb } from "lucide-react";
import type { ComponentType } from "react";
import type { ChapterTab } from "@/app/book/library/[bookId]/chapter/[chapterId]/hooks/useChapterState";

type PhaseStep = {
  id: ChapterTab;
  label: string;
  shortLabel: string;
  icon: ComponentType<{ className?: string }>;
};

const PHASES: PhaseStep[] = [
  { id: "summary", label: "Summary", shortLabel: "Sum", icon: FileText },
  { id: "examples", label: "Examples", shortLabel: "Ex", icon: Lightbulb },
  { id: "quiz", label: "Quiz", shortLabel: "Quiz", icon: HelpCircle },
];

type StepState = "completed" | "current" | "upcoming-unlocked" | "upcoming-locked";

type PhaseStepperProps = {
  currentPhase: ChapterTab;
  completedPhases: Set<ChapterTab>;
  onChange: (phase: ChapterTab) => void;
  /** Overall chapter progress 0-100 */
  progressPercent: number;
};

function getStepState(
  step: ChapterTab,
  currentPhase: ChapterTab,
  completedPhases: Set<ChapterTab>
): StepState {
  if (step === currentPhase) return "current";
  if (completedPhases.has(step)) return "completed";
  // Upcoming phases are unlocked if they were completed before (allow back-navigation)
  const phaseOrder: ChapterTab[] = ["summary", "examples", "quiz"];
  const stepIndex = phaseOrder.indexOf(step);
  const currentIndex = phaseOrder.indexOf(currentPhase);
  if (stepIndex < currentIndex) return "completed";
  return "upcoming-locked";
}

export function PhaseStepper({
  currentPhase,
  completedPhases,
  onChange,
  progressPercent,
}: PhaseStepperProps) {
  return (
    <div className="w-full space-y-3">
      {/* Stepper steps */}
      <div className="flex items-center justify-center gap-0">
        {PHASES.map((phase, index) => {
          const state = getStepState(phase.id, currentPhase, completedPhases);
          const Icon = phase.icon;
          const isClickable = state === "completed" || state === "current";
          const isLast = index === PHASES.length - 1;

          return (
            <div key={phase.id} className="flex items-center">
              {/* Step circle + label */}
              <button
                type="button"
                disabled={!isClickable}
                onClick={() => {
                  if (isClickable && state !== "current") onChange(phase.id);
                }}
                className="group flex flex-col items-center gap-1.5"
                aria-current={state === "current" ? "step" : undefined}
              >
                {/* Circle */}
                <div
                  className={[
                    "flex h-10 w-10 items-center justify-center rounded-full transition-all duration-300",
                    state === "completed"
                      ? "bg-[var(--cr-accent)] text-[var(--cr-text-inverse)]"
                      : state === "current"
                        ? "bg-[var(--cr-accent)] text-[var(--cr-text-inverse)] shadow-[0_0_0_4px_var(--cr-accent-glow)]"
                        : state === "upcoming-unlocked"
                          ? "border-2 border-[var(--cr-text-secondary)] bg-transparent text-[var(--cr-text-secondary)]"
                          : "border-2 border-[var(--cr-text-disabled)] bg-transparent text-[var(--cr-text-disabled)]",
                    isClickable && state !== "current"
                      ? "cursor-pointer hover:opacity-80"
                      : state === "current"
                        ? "cursor-default"
                        : "cursor-not-allowed",
                  ].join(" ")}
                  style={state === "current" ? { animation: "cr-stepper-pulse 2s ease-in-out infinite" } : undefined}
                >
                  {state === "completed" ? (
                    <Check className="h-5 w-5" strokeWidth={2.5} />
                  ) : (
                    <Icon className="h-5 w-5" />
                  )}
                </div>

                {/* Label */}
                <span
                  className={[
                    "text-xs font-semibold transition-colors duration-200",
                    state === "completed"
                      ? "text-[var(--cr-accent)]"
                      : state === "current"
                        ? "text-[var(--cr-accent)] font-bold"
                        : state === "upcoming-unlocked"
                          ? "text-[var(--cr-text-secondary)]"
                          : "text-[var(--cr-text-disabled)]",
                  ].join(" ")}
                >
                  {/* Full label on md+, short on mobile */}
                  <span className="hidden sm:inline">{phase.label}</span>
                  <span className="sm:hidden">{phase.shortLabel}</span>
                </span>
              </button>

              {/* Connector line */}
              {!isLast && (
                <div className="mx-2 h-0.5 w-12 sm:mx-3 sm:w-20 md:w-28">
                  <div className="relative h-full w-full overflow-hidden rounded-full bg-[rgba(255,255,255,0.1)]">
                    <div
                      className="absolute inset-y-0 left-0 rounded-full bg-[var(--cr-accent)] transition-all duration-500"
                      style={{
                        width:
                          getStepState(PHASES[index + 1].id, currentPhase, completedPhases) === "completed" ||
                          getStepState(PHASES[index + 1].id, currentPhase, completedPhases) === "current"
                            ? "100%"
                            : "0%",
                      }}
                    />
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Continuous progress bar */}
      <div className="h-[3px] w-full overflow-hidden rounded-full bg-[rgba(255,255,255,0.1)]">
        <div
          className="h-full rounded-full bg-[var(--cr-accent)] transition-[width] duration-300 ease-out"
          style={{ width: `${Math.min(100, Math.max(0, progressPercent))}%` }}
        />
      </div>
    </div>
  );
}
