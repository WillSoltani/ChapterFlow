"use client";

import { useEffect, useState } from "react";
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
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-(--cf-overlay) px-4 sm:px-6">
      <div className="w-full max-w-sm">
        <div className="rounded-[28px] border border-(--cf-accent-border) bg-(--cf-surface-strong) p-6 shadow-shadow-book">
          <div className="text-center">
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-(--cf-accent)">
              Session Mode
            </p>
            <p className="mt-1 text-base font-semibold text-(--cf-text-1)">
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
                      ? "scale-[1.02] border-(--cf-accent-border) bg-(--cf-accent-soft) shadow-[0_0_0_3px_var(--cf-accent-muted)]"
                      : isPast
                        ? "border-(--cf-success-border) bg-(--cf-success-soft) opacity-70"
                        : "border-(--cf-border) bg-(--cf-surface-muted) opacity-30",
                  ].join(" ")}
                >
                  <span
                    className={[
                      "flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl transition-all duration-500",
                      isActive
                        ? "bg-(--cf-accent) text-white shadow-[0_2px_8px_var(--cf-accent-shadow)]"
                        : isPast
                          ? "bg-(--cf-success-soft) text-(--cf-success-text)"
                          : "bg-(--cf-surface) text-(--cf-text-3)",
                    ].join(" ")}
                  >
                    <Icon className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p
                      className={[
                        "text-sm font-semibold transition-colors duration-300",
                        isActive
                          ? "text-(--cf-info-text)"
                          : isPast
                            ? "text-(--cf-success-text)"
                            : "text-(--cf-text-3)",
                      ].join(" ")}
                    >
                      {label}
                    </p>
                    <p
                      className={[
                        "mt-0.5 text-xs transition-colors duration-300",
                        isActive
                          ? "text-(--cf-info-text) opacity-80"
                          : isPast
                            ? "text-(--cf-success-text) opacity-70"
                            : "text-(--cf-text-3)",
                      ].join(" ")}
                    >
                      {desc}
                    </p>
                  </div>
                  {isActive && (
                    <span className="ml-auto h-2 w-2 flex-shrink-0 animate-pulse rounded-full bg-(--cf-accent)" />
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
                className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-(--cf-accent) px-4 py-3 text-sm font-semibold text-white shadow-[0_4px_16px_var(--cf-accent-shadow)] transition-opacity hover:opacity-90"
              >
                Start Reading
                <ArrowRight className="h-4 w-4" />
              </button>
            ) : (
              <div className="flex justify-center">
                <button
                  type="button"
                  onClick={onDone}
                  className="text-xs text-(--cf-text-3) transition hover:text-(--cf-text-2)"
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
