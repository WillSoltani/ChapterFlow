"use client";

import { BookOpenText, Orbit } from "lucide-react";
import { CHAPTERFLOW_NAME } from "@/app/_lib/chapterflow-brand";

type ChapterFlowMarkProps = {
  compact?: boolean;
};

export function ChapterFlowMark({ compact = false }: ChapterFlowMarkProps) {
  return (
    <div className="flex items-center gap-3">
      <span className="relative inline-flex h-11 w-11 items-center justify-center overflow-hidden rounded-2xl border border-(--cf-accent-border) bg-[radial-gradient(circle_at_30%_25%,var(--cf-accent-soft),transparent_52%),linear-gradient(135deg,var(--cf-surface-strong),var(--cf-surface))] shadow-[0_14px_34px_var(--cf-accent-shadow)]">
        <Orbit className="absolute h-8 w-8 text-(--cf-accent)/25" />
        <BookOpenText className="relative h-5 w-5 text-(--cf-text-1)" />
      </span>
      <div className="min-w-0">
        <p className="text-[11px] uppercase tracking-[0.34em] text-(--cf-text-3)">
          Guided Reading
        </p>
        <p className={compact ? "text-base font-semibold text-(--cf-text-1)" : "text-xl font-semibold text-(--cf-text-1)"}>
          {CHAPTERFLOW_NAME}
        </p>
      </div>
    </div>
  );
}
