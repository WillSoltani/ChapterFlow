"use client";

import { motion } from "framer-motion";
import { Check, FileText, HelpCircle, Lightbulb, Target } from "lucide-react";
import type { ChapterTab } from "@/app/book/library/[bookId]/chapter/[chapterId]/hooks/useChapterState";
import type { ComponentType } from "react";

type PhaseStep = {
  id: ChapterTab;
  label: string;
  icon: ComponentType<{ className?: string }>;
};

const PHASES: PhaseStep[] = [
  { id: "summary", label: "Sum", icon: FileText },
  { id: "examples", label: "Ex", icon: Lightbulb },
  { id: "quiz", label: "Quiz", icon: HelpCircle },
  { id: "practice", label: "Prac", icon: Target },
];

interface PhonePhaseStepperProps {
  currentPhase: ChapterTab;
  completedPhases: Set<ChapterTab>;
  onChange?: (phase: ChapterTab) => void;
  progressPercent: number;
}

/**
 * Compact mobile mirror of the in-app PhaseStepper.
 * Same circle states, same cr-stepper-pulse animation, same dashed
 * connector pattern with scaleX fill — just sized for a 250-290px phone.
 */
export function PhonePhaseStepper({
  currentPhase,
  completedPhases,
  onChange,
  progressPercent,
}: PhonePhaseStepperProps) {
  return (
    <div className="w-full" style={{ padding: "0 12px" }}>
      <nav
        className="flex items-center justify-center"
        role="navigation"
        aria-label="Reading phases"
      >
        {PHASES.map((phase, index) => {
          const isCompleted = completedPhases.has(phase.id);
          const isCurrent = currentPhase === phase.id;
          const Icon = phase.icon;
          const isLast = index === PHASES.length - 1;

          return (
            <div key={phase.id} className="flex items-center">
              {/* Step circle */}
              <button
                type="button"
                onClick={() => onChange?.(phase.id)}
                className="flex flex-col items-center"
                aria-current={isCurrent ? "step" : undefined}
              >
                <div
                  className="flex items-center justify-center rounded-full transition-all duration-300"
                  style={{
                    width: 24,
                    height: 24,
                    background: isCompleted || isCurrent
                      ? "var(--cr-accent)"
                      : "transparent",
                    color: isCompleted || isCurrent
                      ? "var(--cr-text-inverse)"
                      : "var(--cr-text-secondary)",
                    border: !isCompleted && !isCurrent
                      ? "1.5px solid var(--cr-text-secondary)"
                      : "none",
                    boxShadow: isCurrent
                      ? "0 0 0 3px var(--cr-accent-glow)"
                      : "none",
                    animation: isCurrent
                      ? "cr-stepper-pulse 2s ease-in-out infinite"
                      : undefined,
                  }}
                >
                  {isCompleted ? (
                    <Check className="h-3 w-3" strokeWidth={2.5} />
                  ) : (
                    <Icon className="h-3 w-3" />
                  )}
                </div>
              </button>

              {/* Connector line */}
              {!isLast && (
                <div
                  className="relative mx-1 overflow-hidden rounded-full"
                  style={{ width: 22, height: 2 }}
                >
                  {/* Dashed locked underlay */}
                  <div
                    className="absolute inset-0 rounded-full"
                    style={{
                      backgroundImage:
                        "repeating-linear-gradient(to right, var(--cr-track) 0 3px, transparent 3px 6px)",
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
                    transition={{ duration: 0.4, ease: "easeOut" }}
                  />
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* Continuous progress bar below */}
      <div
        className="mt-2 overflow-hidden rounded-full"
        style={{
          height: 2,
          background: "var(--cr-track)",
        }}
      >
        <div
          className="h-full rounded-full transition-[width] duration-500 ease-out"
          style={{
            width: `${Math.min(100, Math.max(0, progressPercent))}%`,
            background: "var(--cr-accent)",
          }}
        />
      </div>
    </div>
  );
}
