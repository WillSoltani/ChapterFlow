"use client";

import { useCallback, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { DUR, EASE } from "@/lib/motion";
import { Check, FileText, HelpCircle, Lightbulb, Lock } from "lucide-react";
import type { ComponentType } from "react";
import type { ChapterTab } from "@/lib/reader-state-types";

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

const PHASE_TIME_ESTIMATES: Record<ChapterTab, string> = {
  summary: "~5m",
  examples: "~8m",
  quiz: "~3m",
  practice: "~2m",
};

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
  const clampedProgress = Math.min(100, Math.max(0, progressPercent));
  // North-Star motion rule: "nothing loops or pulses ambiently while prose is on
  // screen … always useReducedMotion-guarded." The current-node halo pulse below
  // is gated on this so reduced-motion users get a static (still decisively
  // filled) current node.
  const reduced = useReducedMotion();

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

          const stepTitle =
            state === "locked"
              ? `${phase.label} \u2014 locked. ${getLockMessage(phase.id) ?? "Complete the previous phase to unlock."}`
              : `${phase.label} \u2014 about ${PHASE_TIME_ESTIMATES[phase.id]}`;

          return (
            <div key={phase.id} className="flex items-center">
              {/* Step circle + label */}
              <button
                type="button"
                title={stepTitle}
                // stepTitle carries the lock reason for locked steps, so exposing
                // it as the accessible name lets SR users learn WHY a step is
                // locked (the title attribute alone is not reliably announced).
                aria-label={stepTitle}
                // aria-disabled (not the native `disabled` attribute) so a locked
                // step still receives the click and can explain WHY it's locked.
                // A native disabled button swallows the event, making the lock
                // tooltip/toast below unreachable — dead on mobile especially.
                onClick={(e) => {
                  if (state === "locked") {
                    handleLockedClick(phase.id, e);
                    return;
                  }
                  if (isClickable) onChange(phase.id);
                }}
                className="group flex flex-col items-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--cr-accent)_55%,transparent)] rounded-lg p-0.5"
                aria-current={state === "current" ? "step" : undefined}
                aria-disabled={state === "locked"}
                tabIndex={state === "locked" ? -1 : 0}
              >
                {/* Circle */}
                <div
                  className={[
                    "flex h-9 w-9 items-center justify-center rounded-full transition-all duration-300",
                    state === "completed"
                      ? "bg-(--cr-accent) text-(--cr-text-inverse)"
                      : state === "current"
                        ? "bg-(--cr-accent) text-(--cr-text-inverse) shadow-[0_0_0_4px_var(--cr-accent-active)]"
                        : state === "upcoming-unlocked"
                          ? "border-2 border-(--cr-text-secondary) bg-transparent text-(--cr-text-secondary)"
                          : "border-2 border-(--cr-text-disabled) bg-transparent text-(--cr-text-disabled) opacity-50 cursor-not-allowed",
                    isClickable
                      ? "cursor-pointer hover:opacity-80"
                      : state === "current"
                        ? "cursor-default"
                        : "",
                  ].join(" ")}
                  style={state === "current" && !reduced ? { animation: "cr-stepper-pulse 2s ease-in-out infinite" } : undefined}
                >
                  {state === "completed" ? (
                    <Check className="h-4 w-4" strokeWidth={2.5} />
                  ) : state === "locked" ? (
                    <Lock className="h-3.5 w-3.5" />
                  ) : (
                    <Icon className="h-4 w-4" />
                  )}
                </div>

                {/* Label */}
                <span
                  className={[
                    "text-[11px] font-semibold transition-colors duration-200",
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
                <div className="mx-3 h-0.5 w-12 sm:mx-4 sm:w-20 md:w-28">
                  <div className="relative h-full w-full overflow-hidden rounded-full">
                    {/* Dashed locked/incomplete underlay. This dash is the sole
                     * cue distinguishing a locked/incomplete connector from the
                     * solid accent completed one, so it uses a ≥3:1 text-level
                     * token (not the sub-3:1 decorative glass-border at 50%). */}
                    <div
                      className="absolute inset-0 rounded-full"
                      style={{
                        backgroundImage:
                          "repeating-linear-gradient(to right, var(--cr-text-secondary) 0 4px, transparent 4px 8px)",
                      }}
                    />
                    <motion.div
                      className="absolute inset-y-0 left-0 rounded-full"
                      initial={{ scaleX: 0 }}
                      animate={{
                        scaleX: completedPhases.has(phase.id) ? 1 : 0,
                      }}
                      style={{
                        originX: 0,
                        width: "100%",
                        background: "var(--cr-accent)",
                      }}
                      transition={{ duration: DUR.page, ease: EASE.standard }}
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
        <div
          className="h-[3px] w-full overflow-hidden rounded-full"
          style={{ background: "var(--cr-glass-border)" }}
          role="progressbar"
          aria-label="Chapter progress"
          aria-valuenow={Math.round(clampedProgress)}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div
            className="h-full rounded-full bg-(--cr-accent) transition-[width] duration-300 ease-out"
            style={{ width: `${clampedProgress}%` }}
          />
        </div>
      )}

      {/* Desktop tooltip — announced to SR users as a polite status update */}
      {tooltip && (
        <div
          className="pointer-events-none fixed z-50 hidden -translate-x-1/2 -translate-y-full rounded-lg border border-(--cr-glass-border) bg-(--cr-bg-surface-2) px-3 py-2 text-xs text-(--cr-text-secondary) shadow-shadow-elevated sm:block"
          style={{ left: tooltip.x, top: tooltip.y }}
          role="status"
          aria-live="polite"
        >
          {tooltip.text}
        </div>
      )}

      {/* Mobile toast — announced to SR users as a polite status update */}
      {mobileToast && (
        <div
          className="fixed bottom-24 left-4 right-4 z-50 rounded-xl border border-(--cr-glass-border) bg-(--cr-bg-surface-2) px-4 py-3 text-center text-sm text-(--cr-text-secondary) shadow-shadow-elevated sm:hidden"
          role="status"
          aria-live="polite"
        >
          {mobileToast}
        </div>
      )}
    </div>
  );
}
