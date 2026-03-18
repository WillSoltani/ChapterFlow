"use client";

import type { ReadingDepth } from "@/app/book/data/mockChapters";

const options: Array<{ id: ReadingDepth; label: string }> = [
  { id: "simple", label: "Simple" },
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
      <p className="text-2xl text-(--cf-text-3)">Reading depth:</p>
      {options.map((option) => {
        const active = option.id === value;
        return (
          <button
            key={option.id}
            type="button"
            onClick={() => onChange(option.id)}
            className={[
              "rounded-xl border px-4 py-1.5 text-xl font-medium transition",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--cf-accent-border)",
              active
                ? "border-(--cf-accent-border) bg-(--cf-accent-soft) text-(--cf-info-text)"
                : "border-(--cf-border) bg-(--cf-surface-muted) text-(--cf-text-2) hover:border-(--cf-border-strong)",
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
