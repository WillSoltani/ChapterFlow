"use client";

const DEFAULT_OPTIONS = [7, 30, 90];

export function RangeSelector({
  value,
  onChange,
  options = DEFAULT_OPTIONS,
}: {
  value: number;
  onChange: (v: number) => void;
  options?: number[];
}) {
  return (
    <div
      role="tablist"
      aria-label="Time range"
      className="inline-flex items-center gap-1 rounded-lg border border-(--cf-border) bg-(--cf-surface) p-0.5 text-cf-label-sm shadow-(--cf-input-inset-shadow)"
    >
      {options.map((d) => {
        const active = value === d;
        return (
          <button
            key={d}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(d)}
            className={[
              "rounded-md px-3 py-1 transition",
              active
                ? "bg-(--cf-accent)/15 text-(--cf-accent) font-semibold"
                : "text-(--cf-text-3) hover:text-(--cf-text-1) hover:bg-(--cf-surface-muted)",
            ].join(" ")}
          >
            {d}d
          </button>
        );
      })}
    </div>
  );
}
