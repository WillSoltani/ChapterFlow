"use client";

import { BookOpenText, Orbit } from "lucide-react";
import { CHAPTERFLOW_NAME } from "@/app/_lib/chapterflow-brand";

type ChapterFlowMarkProps = {
  compact?: boolean;
};

export function ChapterFlowMark({ compact = false }: ChapterFlowMarkProps) {
  return (
    <div className="flex items-center gap-3">
      <span className="relative inline-flex h-11 w-11 items-center justify-center overflow-hidden rounded-2xl border border-cyan-300/30 bg-[radial-gradient(circle_at_30%_25%,rgba(125,211,252,0.32),transparent_52%),linear-gradient(135deg,rgba(8,15,30,0.96),rgba(18,34,54,0.92))] shadow-[0_14px_34px_rgba(14,165,233,0.22)]">
        <Orbit className="absolute h-8 w-8 text-cyan-200/25" />
        <BookOpenText className="relative h-5 w-5 text-cyan-100" />
      </span>
      <div className="min-w-0">
        <p className="text-[11px] uppercase tracking-[0.34em] text-cyan-200/65">
          Guided Reading
        </p>
        <p className={compact ? "text-base font-semibold text-slate-50" : "text-xl font-semibold text-slate-50"}>
          {CHAPTERFLOW_NAME}
        </p>
      </div>
    </div>
  );
}
