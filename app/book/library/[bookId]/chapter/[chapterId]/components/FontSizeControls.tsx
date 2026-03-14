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
    <div className="inline-flex rounded-xl border border-white/40 bg-white/3 p-0.5">
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
                ? "bg-white/15 text-slate-100"
                : "text-slate-400 hover:bg-white/8 hover:text-slate-200",
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
