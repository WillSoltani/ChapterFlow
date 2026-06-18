"use client";

import type { ReadingDepth } from "@/app/book/data/bookChapters";

// The `Fast / Deep / Full` labels carry the depth cue on their own. We deliberately
// omit a per-chip duration: the old hardcoded "2 / 5 / 10 min" subs were the same
// constants for every book and chapter, so they contradicted (and were dwarfed by)
// the header's per-chapter "N min read" estimate. `sub` stays optional so a real,
// per-depth estimate can be plumbed in later without reintroducing fabricated numbers.
const options: Array<{ id: ReadingDepth; label: string; sub?: string }> = [
  { id: "simple", label: "Fast" },
  { id: "standard", label: "Deep" },
  { id: "deeper", label: "Full" },
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
              // Weight lives in the active/inactive branches (NOT the base) so the
              // active `font-bold` is not cancelled by a base `font-semibold` —
              // two conflicting Tailwind weight utilities otherwise resolve to the
              // wrong one by source order.
              "rounded-xl border px-3 py-1.5 text-sm transition",
              // ≥3:1 focus ring (house rule): the old --cr-accent-glow ring was a
              // 12–15%-alpha wash that barely read. Matches the reader's other
              // controls (PhaseStepper, shortcuts dialog) which use the 55% mix.
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--cr-accent)_55%,transparent)]",
              isVertical ? "w-full text-left flex items-baseline gap-2" : "",
              active
                // Decisively FILLED active chip: solid --cr-accent border + the
                // 16% --cr-accent-active fill (replaces the faint 15%-alpha
                // --cr-accent-muted wash that made the selected depth read no
                // stronger than its siblings) + bold weight as a second,
                // colour-independent cue for forced-colors / colourblind users.
                ? "border-(--cr-accent) bg-(--cr-accent-active) text-(--cr-accent) font-bold"
                : "border-(--cr-glass-border) bg-(--cr-bg-surface-3) text-(--cr-text-secondary) font-semibold hover:border-(--cr-glass-border-teal)",
            ].join(" ")}
          >
            <span>{option.label}</span>
            {option.sub ? (
              <span className={isVertical ? "ml-auto text-xs font-normal opacity-75" : "ml-1 text-xs font-normal opacity-75"}>
                {option.sub}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
