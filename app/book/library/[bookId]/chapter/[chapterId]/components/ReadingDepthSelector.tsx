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
      <p className="text-2xl text-slate-400">Reading depth:</p>
      {options.map((option) => {
        const active = option.id === value;
        return (
          <button
            key={option.id}
            type="button"
            onClick={() => onChange(option.id)}
            className={[
              "rounded-xl border px-4 py-1.5 text-xl font-medium transition",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300/45",
              active
                ? "border-sky-300/45 bg-sky-500/14 text-sky-100"
                : "border-white/25 bg-white/5 text-slate-300 hover:border-white/40",
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
