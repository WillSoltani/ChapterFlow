"use client";

import { useId } from "react";
import type { V21ExperiencePlan } from "@/lib/book-package-types";

type TransferPromptCardProps = {
  transferPrompt?: V21ExperiencePlan["transferPrompt"];
};

/**
 * Renders a v21 chapter's `experiencePlan.transferPrompt` at chapter end: a
 * far-transfer prompt ("where else does this apply?") plus a few concrete
 * contexts from other domains. Reflective, not an input.
 *
 * Returns null when absent so the Practice phase can render it unconditionally.
 */
export function TransferPromptCard({ transferPrompt }: TransferPromptCardProps) {
  const labelId = useId();
  if (!transferPrompt) return null;
  const { prompt, contexts } = transferPrompt;

  return (
    <section
      role="note"
      aria-labelledby={labelId}
      className="cr-transfer-prompt rounded-2xl border border-(--cr-glass-border) bg-(--cr-bg-surface-2) px-5 py-4"
    >
      <h3 id={labelId} className="text-xs font-semibold uppercase tracking-[0.14em] text-(--cr-text-secondary)">
        Where else this applies
      </h3>
      <p className="mt-2 text-base leading-relaxed text-(--cr-text-primary)">{prompt}</p>
      {contexts.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-2">
          {contexts.map((context, index) => (
            <li
              key={`${index}-${context.slice(0, 24)}`}
              className="rounded-full border border-(--cr-glass-border) bg-(--cr-bg-surface-3) px-3 py-1.5 text-sm leading-snug text-(--cr-text-primary)"
            >
              {context}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
