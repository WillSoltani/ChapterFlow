"use client";

import { useCallback, useState } from "react";
import { Check, FileText, HelpCircle, Lightbulb, Lock, Target } from "lucide-react";
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
  { id: "practice", label: "Practice", shortLabel: "Prac", icon: Target },
];

type StepState = "completed" | "current" | "upcoming-unlocked" | "locked";

type PhaseStepperProps = {
  currentPhase: ChapterTab;
  completedPhases: Set<ChapterTab>;
  onChange: (phase: ChapterTab) => void;
  /** Overall chapter progress 0-100 */
  progressPercent: number;
  /** Check if a phase is accessible (from gating logic) */
  isPhaseAccessible: (phase: ChapterTab) => boolean;
  /** Get lock tooltip message */
  getLockMessage: (phase: ChapterTab) => string | null;
  /** Whether to show the continuous progress bar */
  showProgressBar?: boolean;
};

function getStepState(
  step: ChapterTab,
  currentPhase: ChapterTab,
  completedPhases: Set<ChapterTab>,
  isAccessible: boolean
): StepState {
  if (step === currentPhase) return "current";
  if (completedPhases.has(step)) return "completed";
  if (!isAccessible) return "locked";
  return "upcoming-unlocked";
}

export function PhaseStepper({
  currentPhase,
  completedPhases,
  onChange,
  progressPercent,
  isPhaseAccessible,
  getLockMessage,
  showProgressBar = true,
}: PhaseStepperProps) {
  const [tooltip, setTooltip] = useState<{ text: string; x: number; y: number } | null>(null);
  const [mobileToast, setMobileToast] = useState<string | null>(null);

  const handleLockedClick = useCallback(
    (phase: ChapterTab, event: React.MouseEvent) => {
      const message = getLockMessage(phase);
      if (!message) return;

      // Desktop: show tooltip near the click
      const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
      setTooltip({
        text: message,
        x: rect.left + rect.width / 2,
        y: rect.top - 8,
      });
      setTimeout(() => setTooltip(null), 2500);

      // Mobile: show toast
      setMobileToast(message);
      setTimeout(() => setMobileToast(null), 2000);
    },
    [getLockMessage]
  );

  return (
    <div className="w-full space-y-3">
      {/* Stepper steps */}
      <nav
        className="flex items-center justify-center gap-0"
        role="navigation"
        aria-label="Learning phases"
      >
        {PHASES.map((phase, index) => {
          const accessible = isPhaseAccessible(phase.id);
          const state = getStepState(phase.id, currentPhase, completedPhases, accessible);
          const Icon = phase.icon;
          const isClickable = state === "completed" || state === "upcoming-unlocked";
          const isLast = index === PHASES.length - 1;

          return (
            <div key={phase.id} className="flex items-center">
              {/* Step circle + label */}
              <button
                type="button"
                disabled={state === "locked"}
                onClick={(e) => {
                  if (state === "locked") {
                    handleLockedClick(phase.id, e);
                    return;
                  }
                  if (isClickable) onChange(phase.id);
                }}
                className="group flex flex-col items-center gap-1.5"
                aria-current={state === "current" ? "step" : undefined}
                aria-disabled={state === "locked"}
                tabIndex={state === "locked" ? -1 : 0}
              >
                {/* Circle */}
                <div
                  className={[
                    "flex h-10 w-10 items-center justify-center rounded-full transition-all duration-300",
                    state === "completed"
                      ? "bg-(--cr-accent) text-(--cr-text-inverse)"
                      : state === "current"
                        ? "bg-(--cr-accent) text-(--cr-text-inverse) shadow-[0_0_0_4px_var(--cr-accent-glow)]"
                        : state === "upcoming-unlocked"
                          ? "border-2 border-(--cr-text-secondary) bg-transparent text-(--cr-text-secondary)"
                          : "border-2 border-(--cr-text-disabled) bg-transparent text-(--cr-text-disabled) opacity-50 cursor-not-allowed",
                    isClickable
                      ? "cursor-pointer hover:opacity-80"
                      : state === "current"
                        ? "cursor-default"
                        : "",
                  ].join(" ")}
                  style={state === "current" ? { animation: "cr-stepper-pulse 2s ease-in-out infinite" } : undefined}
                >
                  {state === "completed" ? (
                    <Check className="h-5 w-5" strokeWidth={2.5} />
                  ) : state === "locked" ? (
                    <Lock className="h-4 w-4" />
                  ) : (
                    <Icon className="h-5 w-5" />
                  )}
                </div>

                {/* Label */}
                <span
                  className={[
                    "text-xs font-semibold transition-colors duration-200",
                    state === "completed"
                      ? "text-(--cr-accent)"
                      : state === "current"
                        ? "text-(--cr-accent) font-bold"
                        : state === "upcoming-unlocked"
                          ? "text-(--cr-text-secondary)"
                          : "text-(--cr-text-disabled)",
                  ].join(" ")}
                >
                  <span className="hidden sm:inline">{phase.label}</span>
                  <span className="sm:hidden">{phase.shortLabel}</span>
                </span>
              </button>

              {/* Connector line */}
              {!isLast && (
                <div className="mx-1.5 h-0.5 w-8 sm:mx-2 sm:w-14 md:w-20">
                  <div className="relative h-full w-full overflow-hidden rounded-full bg-(--cr-track)">
                    <div
                      className="absolute inset-y-0 left-0 rounded-full bg-(--cr-accent) transition-all duration-500"
                      style={{
                        width:
                          (() => {
                            const leftState = getStepState(
                              phase.id,
                              currentPhase,
                              completedPhases,
                              isPhaseAccessible(phase.id)
                            );
                            return leftState === "completed"
                              ? "100%"
                              : "0%";
                          })(),
                      }}
                    />
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* Mobile: current phase name (icons only on mobile) */}
      <p className="text-center text-sm font-semibold text-(--cr-accent) sm:hidden">
        {PHASES.find((p) => p.id === currentPhase)?.label}
      </p>

      {/* Continuous progress bar */}
      {showProgressBar && (
        <div className="h-[3px] w-full overflow-hidden rounded-full bg-(--cr-track)">
          <div
            className="h-full rounded-full bg-(--cr-accent) transition-[width] duration-300 ease-out"
            style={{ width: `${Math.min(100, Math.max(0, progressPercent))}%` }}
          />
        </div>
      )}

      {/* Desktop tooltip */}
      {tooltip && (
        <div
          className="pointer-events-none fixed z-50 hidden -translate-x-1/2 -translate-y-full rounded-lg border border-(--cr-glass-border) bg-(--cr-bg-surface-2) px-3 py-2 text-xs text-(--cr-text-secondary) shadow-shadow-elevated sm:block"
          style={{ left: tooltip.x, top: tooltip.y }}
        >
          {tooltip.text}
        </div>
      )}

      {/* Mobile toast */}
      {mobileToast && (
        <div className="fixed bottom-24 left-4 right-4 z-50 rounded-xl border border-(--cr-glass-border) bg-(--cr-bg-surface-2) px-4 py-3 text-center text-sm text-(--cr-text-secondary) shadow-shadow-elevated sm:hidden">
          {mobileToast}
        </div>
      )}
    </div>
  );
}
