"use client";

import type { ReadingDepth } from "@/app/book/data/bookChapters";

const options: Array<{ id: ReadingDepth; label: string; sub: string }> = [
  { id: "simple", label: "Fast", sub: "2 min" },
  { id: "standard", label: "Deep", sub: "5 min" },
  { id: "deeper", label: "Full", sub: "10 min" },
];

type ReadingDepthSwitchProps = {
  value: ReadingDepth;
  onChange: (value: ReadingDepth) => void;
  /** Layout direction. "horizontal" (default) renders an inline pill row,
   *  best inside the prose column on mobile / narrow viewports. "vertical"
   *  stacks the pills with the label above, designed for a sticky gutter
   *  rail on desktop. */
  variant?: "horizontal" | "vertical";
};

/**
 * v21 reading-depth switch — three-button segmented control mapping the v21
 * `breakdown.fastRead / deepRead / fullRead` tiers onto the reader's internal
 * `simple / standard / deeper` depth keys. Replaces the legacy tone toggle for
 * v21 chapters, which carry a single canonical voice.
 */
export function ReadingDepthSwitch({ value, onChange, variant = "horizontal" }: ReadingDepthSwitchProps) {
  const isVertical = variant === "vertical";

  return (
    <div
      role="group"
      aria-label="Reading depth"
      className={
        isVertical
          ? "cr-reading-depth-switch flex flex-col items-stretch gap-2"
          : "cr-reading-depth-switch inline-flex flex-wrap items-center gap-2"
      }
    >
      <p
        className={
          isVertical
            ? "text-[11px] font-semibold uppercase tracking-[0.18em] text-(--cr-text-secondary)"
            : "mr-1 text-sm font-semibold uppercase tracking-[0.12em] text-(--cr-text-secondary)"
        }
      >
        Read
      </p>
      {options.map((option) => {
        const active = option.id === value;
        return (
          <button
            key={option.id}
            type="button"
            onClick={() => onChange(option.id)}
            aria-pressed={active}
            className={[
              "rounded-xl border px-3 py-1.5 text-sm font-semibold transition",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--cr-accent-glow)",
              isVertical ? "w-full text-left flex items-baseline gap-2" : "",
              active
                ? "border-(--cr-glass-border-teal) bg-(--cr-accent-muted) text-(--cr-accent)"
                : "border-(--cr-glass-border) bg-(--cr-bg-surface-3) text-(--cr-text-secondary) hover:border-(--cr-glass-border-teal)",
            ].join(" ")}
          >
            <span>{option.label}</span>
            <span className={isVertical ? "ml-auto text-xs font-normal opacity-75" : "ml-1 text-xs font-normal opacity-75"}>
              {option.sub}
            </span>
          </button>
        );
      })}
    </div>
  );
}
