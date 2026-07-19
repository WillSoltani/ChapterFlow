"use client";

import { renderInlineMarkdown } from "./profile-markdown";

export function PinnedTakeawayCard({ text, source }: { text: string; source: string }) {
  return (
    <div className="rounded-xl border-l-[3px] border-l-accent-amber/60 bg-(--cf-surface)/60 px-4 py-3">
      <p className="text-sm italic leading-6 text-(--cf-text-1)">&ldquo;{renderInlineMarkdown(text)}&rdquo;</p>
      <p className="mt-2 text-xs text-(--cf-text-soft)">📌 {source}</p>
    </div>
  );
}
