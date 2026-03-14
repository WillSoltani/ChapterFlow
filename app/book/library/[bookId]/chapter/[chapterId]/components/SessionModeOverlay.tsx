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
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-[#020617]/72 px-4 backdrop-blur-[2px] sm:px-6">
      <div className="w-full max-w-3xl">
        <div className="rounded-[32px] border border-sky-300/25 bg-[#081226]/96 p-5 shadow-[0_28px_80px_rgba(2,6,23,0.62)] sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-sky-200">Session Mode</p>
              <p className="mt-1 text-sm text-slate-300">A guided chapter tour: summary → examples → quiz</p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="secondary" size="sm" onClick={onPause}>
                <Pause className="h-4 w-4" />
                Pause session
              </Button>
              <button
                type="button"
                onClick={onClose}
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/15 bg-white/5 text-slate-300 transition hover:border-white/25 hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300/45"
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
                      ? "border-sky-300/45 bg-sky-500/16 text-sky-100"
                      : completed
                        ? "border-emerald-300/35 bg-emerald-500/12 text-emerald-100"
                        : "border-white/14 bg-white/3 text-slate-300 hover:border-white/25",
                  ].join(" ")}
                >
                  <p className="text-sm font-semibold">{step.label}</p>
                  <p className="mt-0.5 text-xs opacity-90">{step.subtitle}</p>
                </button>
              );
            })}
          </div>

          <div className="mt-5 rounded-2xl border border-white/10 bg-white/4 px-4 py-3 text-sm">
            <p className="text-slate-200">
              Use this flow like a tour: read the summary carefully, explore the examples that match your context, then pass the quiz to unlock the next chapter.
            </p>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-sm">
            <p className="text-slate-300">
              {quizPassed
                ? "Session complete. Great retention run."
                : `Current step: ${steps[currentIndex]?.label ?? "Summary"}`}
            </p>
            {quizPassed ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-300/35 bg-emerald-500/12 px-2.5 py-1 text-xs text-emerald-100">
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
