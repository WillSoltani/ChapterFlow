"use client";

import { Pause, Play, Sparkles, X } from "lucide-react";
import { Button } from "@/app/book/components/ui/Button";
import type { ChapterTab } from "@/app/book/library/[bookId]/chapter/[chapterId]/hooks/useChapterState";

const steps: Array<{ tab: ChapterTab; label: string; subtitle: string }> = [
  { tab: "summary", label: "Step 1 · Summary", subtitle: "Read the chapter highlights" },
  { tab: "examples", label: "Step 2 · Examples", subtitle: "Connect ideas to scenarios" },
  { tab: "quiz", label: "Step 3 · Quiz", subtitle: "Pass with 80% to unlock next" },
];

type SessionModeOverlayProps = {
  activeTab: ChapterTab;
  quizPassed: boolean;
  onSelectStep: (tab: ChapterTab) => void;
  onPause: () => void;
  onClose: () => void;
};

export function SessionModeOverlay({
  activeTab,
  quizPassed,
  onSelectStep,
  onPause,
  onClose,
}: SessionModeOverlayProps) {
  const currentIndex = Math.max(
    0,
    steps.findIndex((step) => step.tab === activeTab)
  );

  const nextStep = steps[currentIndex + 1];

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-(--cf-overlay) px-4 backdrop-blur-[2px] sm:px-6">
      <div className="w-full max-w-3xl">
        <div className="rounded-[32px] border border-(--cf-accent-border) bg-(--cf-surface-strong) p-5 shadow-xl sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-(--cf-accent)">Session Mode</p>
              <p className="mt-1 text-sm text-(--cf-text-2)">A guided chapter tour: summary → examples → quiz</p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="secondary" size="sm" onClick={onPause}>
                <Pause className="h-4 w-4" />
                Pause session
              </Button>
              <button
                type="button"
                onClick={onClose}
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-(--cf-border) bg-(--cf-surface-muted) text-(--cf-text-2) transition hover:bg-(--cf-accent-muted) hover:text-(--cf-text-1) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--cf-accent-border)"
                aria-label="Exit session mode"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-3">
            {steps.map((step, index) => {
              const active = step.tab === activeTab;
              const completed = index < currentIndex || (step.tab === "quiz" && quizPassed);

              return (
                <button
                  key={step.tab}
                  type="button"
                  onClick={() => onSelectStep(step.tab)}
                  className={[
                    "rounded-xl border px-3 py-2 text-left transition",
                    active
                      ? "border-(--cf-accent-border) bg-(--cf-accent-soft) text-(--cf-info-text)"
                      : completed
                        ? "border-(--cf-success-border) bg-(--cf-success-soft) text-(--cf-success-text)"
                        : "border-(--cf-border) bg-(--cf-surface-muted) text-(--cf-text-2) hover:border-(--cf-border-strong)",
                  ].join(" ")}
                >
                  <p className="text-sm font-semibold">{step.label}</p>
                  <p className="mt-0.5 text-xs opacity-90">{step.subtitle}</p>
                </button>
              );
            })}
          </div>

          <div className="mt-5 rounded-2xl border border-(--cf-border) bg-(--cf-surface-muted) px-4 py-3 text-sm">
            <p className="text-(--cf-text-2)">
              Use this flow like a tour: read the summary carefully, explore the examples that match your context, then pass the quiz to unlock the next chapter.
            </p>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-sm">
            <p className="text-(--cf-text-2)">
              {quizPassed
                ? "Session complete. Great retention run."
                : `Current step: ${steps[currentIndex]?.label ?? "Summary"}`}
            </p>
            {quizPassed ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-(--cf-success-border) bg-(--cf-success-soft) px-2.5 py-1 text-xs text-(--cf-success-text)">
                <Sparkles className="h-3.5 w-3.5" />
                Session complete
              </span>
            ) : nextStep ? (
              <Button variant="primary" size="sm" onClick={() => onSelectStep(nextStep.tab)}>
                <Play className="h-4 w-4" />
                Next: {nextStep.label}
              </Button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
