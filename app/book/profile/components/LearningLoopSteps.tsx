"use client";

import { LEARNING_LOOP_STEPS as STEP_LABELS } from "@/lib/learning-loop";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export function LearningLoopSteps({ completedSteps }: { completedSteps: boolean[] }) {
  const currentStep = completedSteps.findIndex((s) => !s);
  return (
    <div className="flex items-center gap-0">
      {STEP_LABELS.map((label, i) => {
        const done = completedSteps[i];
        const isCurrent = i === currentStep;
        return (
          <div key={label} className="flex items-center">
            {i > 0 ? (
              <div className={cn("h-[2px] w-5 sm:w-7", done ? "bg-(--accent-cyan)" : "bg-(--cf-border)")} />
            ) : null}
            <div className="flex flex-col items-center gap-1">
              <div
                className={cn(
                  "flex items-center justify-center rounded-full border-2 text-xs font-semibold transition-colors",
                  done
                    ? "h-7 w-7 border-(--accent-cyan) bg-(--accent-cyan) text-(--cf-accent-contrast)"
                    : isCurrent
                      ? "h-8 w-8 border-(--accent-cyan) bg-transparent text-(--accent-cyan) cf-step-pulse"
                      : "h-7 w-7 border-(--cf-border) bg-transparent text-(--cf-text-soft)"
                )}
              >
                {done ? <Check className="h-3.5 w-3.5" /> : i + 1}
              </div>
              <span className={cn(
                "text-[10px] leading-none",
                done ? "text-(--cf-text-2)" : isCurrent ? "font-medium text-(--cf-text-1)" : "text-(--cf-text-soft)"
              )}>
                {label}
              </span>
            </div>
          </div>
        );
      })}
      <style>{`
        @keyframes cf-step-pulse {
          0%, 100% { box-shadow: 0 0 0 0 color-mix(in srgb, var(--accent-cyan) 40%, transparent); }
          50% { box-shadow: 0 0 0 6px color-mix(in srgb, var(--accent-cyan) 0%, transparent); }
        }
        .cf-step-pulse { animation: cf-step-pulse 2s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) { .cf-step-pulse { animation: none; } }
      `}</style>
    </div>
  );
}
