"use client";

import { useId } from "react";
import type { V21ExperiencePlan } from "@/lib/book-package-types";

type FailureRecoveryCardProps = {
  failureRecovery?: V21ExperiencePlan["failureRecovery"];
};

/**
 * Renders a v21 chapter's `experiencePlan.failureRecovery` at chapter end:
 * a calm "what to do when you slip" surface (normalizing reframe → cue →
 * repair moves → get-back-on-track line). Not an input; nothing to save.
 *
 * Returns null when absent so the Practice phase can render it unconditionally.
 */
export function FailureRecoveryCard({ failureRecovery }: FailureRecoveryCardProps) {
  const labelId = useId();
  if (!failureRecovery) return null;
  const { normalizingLine, cueQuestion, options, repairLine } = failureRecovery;

  return (
    <section
      role="note"
      aria-labelledby={labelId}
      className="cr-failure-recovery rounded-2xl border border-(--cr-glass-border-teal) bg-(--cr-accent-muted) px-5 py-4"
    >
      <h3 id={labelId} className="text-[11px] font-bold uppercase tracking-[0.16em] text-(--cr-accent)">
        If you slip
      </h3>
      <p className="mt-2 text-base leading-relaxed text-(--cr-text-primary)">{normalizingLine}</p>
      <p className="mt-3 text-sm font-medium leading-relaxed text-(--cr-text-heading)">{cueQuestion}</p>
      {options.length > 0 && (
        <ul className="mt-2 space-y-2">
          {options.map((option, index) => (
            <li
              key={`${index}-${option.slice(0, 24)}`}
              className="flex gap-3 rounded-xl border border-(--cr-glass-border) bg-(--cr-bg-surface-2) px-3 py-2 text-sm leading-relaxed text-(--cr-text-primary)"
            >
              <span
                className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-(--cr-accent)/15 text-[0.65rem] font-bold text-(--cr-accent)"
                aria-hidden
              >
                {index + 1}
              </span>
              <span>{option}</span>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-3 text-sm italic leading-relaxed text-(--cr-text-secondary)">{repairLine}</p>
    </section>
  );
}
