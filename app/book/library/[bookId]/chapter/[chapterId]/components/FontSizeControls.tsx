"use client";

import type { FontScale } from "@/app/book/library/[bookId]/chapter/[chapterId]/hooks/useChapterState";

type FontSizeControlsProps = {
  value: FontScale;
  onChange: (value: FontScale) => void;
};

const controls: Array<{ id: FontScale; label: string; short: string }> = [
  { id: "sm", label: "Smaller text", short: "A-" },
  { id: "md", label: "Default text", short: "A" },
  { id: "lg", label: "Larger text", short: "A+" },
];

export function FontSizeControls({ value, onChange }: FontSizeControlsProps) {
  return (
    <div className="inline-flex rounded-xl border border-(--cf-border) bg-(--cf-surface-muted) p-0.5">
      {controls.map((control) => {
        const active = control.id === value;
        return (
          <button
            key={control.id}
            type="button"
            onClick={() => onChange(control.id)}
            className={[
              "rounded-lg px-2.5 py-1 text-sm transition",
              active
                ? "bg-(--cf-surface-strong) text-(--cf-text-1) shadow-sm"
                : "text-(--cf-text-3) hover:bg-(--cf-surface) hover:text-(--cf-text-2)",
            ].join(" ")}
            aria-label={control.label}
            aria-pressed={active}
          >
            {control.short}
          </button>
        );
      })}
    </div>
  );
}
