"use client";

import { CHAPTERFLOW_NAME } from "@/app/_lib/chapterflow-brand";

type ChapterFlowMarkProps = {
  compact?: boolean;
};

function ChapterFlowGlyph({ compact }: { compact: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={[
        "relative inline-flex shrink-0 items-center justify-center overflow-hidden border bg-[linear-gradient(180deg,var(--cf-surface),var(--cf-surface-muted))] shadow-[var(--cf-shadow-sm)]",
        compact ? "h-10 w-10 rounded-[14px]" : "h-11 w-11 rounded-[16px]",
        "border-(--cf-border)",
      ].join(" ")}
    >
      <svg
        viewBox="0 0 24 24"
        className={compact ? "h-[20px] w-[20px]" : "h-[22px] w-[22px]"}
        fill="none"
      >
        <path
          d="M4.4 7.3c1.75-.94 3.74-1.42 5.96-1.44v12.2c-2.03.04-4.02.5-5.96 1.38V7.3Z"
          fill="var(--cf-accent-soft)"
        />
        <path
          d="M19.6 7.3c-1.75-.94-3.74-1.42-5.96-1.44v12.2c2.03.04 4.02.5 5.96 1.38V7.3Z"
          fill="var(--cf-accent-soft)"
          opacity="0.72"
        />
        <path
          d="M7.45 15.55c1.04-2.55 2.82-3.83 5.32-3.83 1.42 0 2.77.38 4.06 1.14"
          stroke="var(--cf-accent-strong)"
          strokeWidth="1.9"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="16.95" cy="12.82" r="1.1" fill="var(--cf-accent-strong)" />
      </svg>
    </span>
  );
}

export function ChapterFlowMark({ compact = false }: ChapterFlowMarkProps) {
  return (
    <div className={["flex items-center", compact ? "gap-2.5" : "gap-3"].join(" ")}>
      <ChapterFlowGlyph compact={compact} />
      <div className="min-w-0 space-y-0.5 leading-none">
        <p
          className={[
            "font-medium text-(--cf-text-3)",
            compact ? "text-[10px] tracking-[0.08em]" : "text-[11px] tracking-[0.1em]",
          ].join(" ")}
        >
          Guided reading
        </p>
        <p
          className={[
            "font-semibold tracking-[-0.03em] text-(--cf-text-1)",
            compact ? "text-[15px]" : "text-[1.15rem]",
          ].join(" ")}
        >
          {CHAPTERFLOW_NAME}
        </p>
      </div>
    </div>
  );
}
