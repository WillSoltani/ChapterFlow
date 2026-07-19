"use client";

import { Users } from "lucide-react";
import type { V21ReaderPattern } from "@/app/book/lib/v21-adapter";

type PatternSelectorProps = {
  patterns: V21ReaderPattern[];
  selectedId: string | null;
  onSelect: (pattern: V21ReaderPattern) => void;
  fontScaleClass: string;
};

/**
 * "Which sounds like you?" — the optional reader-personalization tag list (RDRP).
 * Picking a pattern routes the recommended example + pre-fills the matching
 * commitment plan in the parent. Purely additive: if no pattern is picked, the
 * short path is unchanged (first example + all plans). Mirrors the CommitmentPrompt
 * card + pill a11y (aria-pressed, cr-* tokens).
 */
export function PatternSelector({
  patterns,
  selectedId,
  onSelect,
  fontScaleClass,
}: PatternSelectorProps) {
  if (patterns.length === 0) return null;

  return (
    <section className="cr-glass-card border-(--cr-accent)/20 px-6 py-5" aria-label="Which pattern fits you">
      <div className="mb-3 flex items-center gap-2">
        <Users className="h-4 w-4 text-(--cr-accent)" aria-hidden="true" />
        <p className="text-xs font-bold uppercase tracking-[0.1em] text-(--cr-accent)">
          Which sounds like you?
        </p>
      </div>
      <p className={`mb-4 text-(--cr-text-secondary) leading-relaxed ${fontScaleClass}`}>
        Pick the situation closest to yours, and we&rsquo;ll point you to the example and the action that fit best.
      </p>
      <ul className="flex flex-wrap gap-2">
        {patterns.map((p) => {
          const isSelected = selectedId === p.id;
          return (
            <li key={p.id}>
              <button
                type="button"
                aria-pressed={isSelected}
                onClick={() => onSelect(p)}
                className={`cf-pressable rounded-full border px-4 py-2 text-cf-body-sm font-medium transition ${
                  isSelected
                    ? "border-(--cr-accent)/50 bg-(--cr-accent)/10 text-(--cr-text-heading)"
                    : "border-(--cr-glass-border) bg-(--cr-bg-surface-3) text-(--cr-text-secondary) hover:border-(--cr-accent)/30"
                }`}
              >
                {p.label}
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
