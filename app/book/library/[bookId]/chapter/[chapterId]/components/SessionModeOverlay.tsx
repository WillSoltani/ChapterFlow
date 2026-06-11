"use client";

import { useEffect, useState } from "react";
import { useReducedMotion } from "framer-motion";
import { ArrowRight, BookOpen, Brain, Lightbulb } from "lucide-react";

const STEPS = [
  {
    key: "summary",
    Icon: BookOpen,
    label: "Summary",
    desc: "Read the key highlights at your chosen depth",
  },
  {
    key: "examples",
    Icon: Lightbulb,
    label: "Examples",
    desc: "Explore scenarios and connect ideas to your context",
  },
  {
    key: "quiz",
    Icon: Brain,
    label: "Quiz",
    desc: "Pass with 80% to unlock the next chapter",
  },
] as const;

type Props = {
  onDone: () => void;
};

export function SessionModeOverlay({ onDone }: Props) {
  const prefersReducedMotion = useReducedMotion();
  const [activeStep, setActiveStep] = useState(0);
  const [tourComplete, setTourComplete] = useState(false);

  useEffect(() => {
    const t1 = setTimeout(() => setActiveStep(1), 1300);
    const t2 = setTimeout(() => setActiveStep(2), 2600);
    const t3 = setTimeout(() => setTourComplete(true), 3600);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, []);

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-(--cf-overlay) px-4 sm:px-6"
      role="dialog"
      aria-modal="true"
      aria-label="Session mode introduction"
    >
      <div className="w-full max-w-sm">
        <div className="rounded-[28px] border border-(--cr-glass-border-teal) bg-(--cr-bg-surface-2) p-6 shadow-[0_24px_60px_rgba(0,0,0,0.28)]">
          <div className="text-center">
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-(--cr-accent)">
              Session Mode
            </p>
            <p className="mt-1 text-base font-semibold text-(--cr-text-heading)">
              Here&apos;s how it works
            </p>
          </div>

          <div className="mt-5 space-y-2.5">
            {STEPS.map(({ key, Icon, label, desc }, index) => {
              const isActive = index === activeStep;
              const isPast = index < activeStep;
              return (
                <div
                  key={key}
                  className={[
                    "flex items-center gap-3 rounded-2xl border px-3.5 py-3 transition-all duration-500",
                    isActive
                      ? "scale-[1.02] border-(--cr-glass-border-teal) bg-(--cr-accent-muted) shadow-[0_0_0_3px_var(--cr-accent-glow)]"
                      : isPast
                        ? "border-(--cr-success)/30 bg-(--cr-success-bg) opacity-70"
                        : "border-(--cr-glass-border) bg-(--cr-bg-surface-3) opacity-30",
                  ].join(" ")}
                >
                  <span
                    className={[
                      "flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl transition-all duration-500",
                      isActive
                        ? "bg-(--cr-accent) text-(--cr-text-inverse) shadow-[0_2px_8px_color-mix(in_srgb,var(--cr-accent)_35%,transparent)]"
                        : isPast
                          ? "bg-(--cr-success-bg) text-(--cr-success)"
                          : "bg-(--cr-bg-surface-1) text-(--cr-text-disabled)",
                    ].join(" ")}
                  >
                    <Icon className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p
                      className={[
                        "text-sm font-semibold transition-colors duration-300",
                        isActive
                          ? "text-(--cr-accent)"
                          : isPast
                            ? "text-(--cr-success)"
                            : "text-(--cr-text-disabled)",
                      ].join(" ")}
                    >
                      {label}
                    </p>
                    <p
                      className={[
                        "mt-0.5 text-xs transition-colors duration-300",
                        isActive
                          ? "text-(--cr-text-secondary)"
                          : isPast
                            ? "text-(--cr-success) opacity-70"
                            : "text-(--cr-text-disabled)",
                      ].join(" ")}
                    >
                      {desc}
                    </p>
                  </div>
                  {isActive && (
                    <span
                      className={[
                        "ml-auto h-2 w-2 flex-shrink-0 rounded-full bg-(--cr-accent)",
                        prefersReducedMotion ? "" : "animate-pulse",
                      ].join(" ")}
                    />
                  )}
                </div>
              );
            })}
          </div>

          <div className="mt-5">
            {tourComplete ? (
              <button
                type="button"
                onClick={onDone}
                className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-(--cr-accent) px-4 py-3 text-sm font-semibold text-(--cr-text-inverse) shadow-[0_4px_16px_color-mix(in_srgb,var(--cr-accent)_35%,transparent)] transition-opacity hover:opacity-90"
              >
                Start Reading
                <ArrowRight className="h-4 w-4" />
              </button>
            ) : (
              <div className="flex justify-center">
                <button
                  type="button"
                  onClick={onDone}
                  className="text-xs text-(--cr-text-disabled) transition hover:text-(--cr-text-secondary)"
                >
                  Skip intro
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
