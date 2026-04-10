"use client";

import type { ReadingDepth } from "@/app/book/data/mockChapters";

const options: Array<{ id: ReadingDepth; label: string }> = [
  { id: "simple", label: "Lite" },
  { id: "standard", label: "Standard" },
  { id: "deeper", label: "Deeper" },
];

type ReadingDepthSelectorProps = {
  value: ReadingDepth;
  onChange: (value: ReadingDepth) => void;
};

export function ReadingDepthSelector({ value, onChange }: ReadingDepthSelectorProps) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <p className="text-sm font-semibold uppercase tracking-[0.12em] text-(--cr-text-secondary)">
        Difficulty
      </p>
      {options.map((option) => {
        const active = option.id === value;
        return (
          <button
            key={option.id}
            type="button"
            onClick={() => onChange(option.id)}
            className={[
              "rounded-xl border px-4 py-1.5 text-sm font-semibold transition",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--cr-accent-glow)",
              active
                ? "border-(--cr-glass-border-teal) bg-(--cr-accent-muted) text-(--cr-accent)"
                : "border-(--cr-glass-border) bg-(--cr-bg-surface-3) text-(--cr-text-secondary) hover:border-(--cr-glass-border-teal)",
            ].join(" ")}
            aria-pressed={active}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
