"use client";

const quickPickOptions = [10, 15, 20, 30, 45, 60, 90, 120, 180, 240];

function clampGoal(goal: number) {
  return Math.min(240, Math.max(10, goal));
}

export function formatMinutesLabel(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  if (minutes % 60 === 0) return `${minutes / 60}h`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours}h ${mins}m`;
}

type GoalPickerProps = {
  value: number;
  onChange: (minutes: number) => void;
};

export function GoalPicker({ value, onChange }: GoalPickerProps) {
  return (
    <div className="rounded-[30px] border border-(--cf-border) bg-(--cf-surface) px-4 py-5 sm:px-6 sm:py-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {quickPickOptions.map((option) => {
          const selected = option === value;
          return (
            <button
              key={option}
              type="button"
              onClick={() => onChange(option)}
              className={[
                "rounded-2xl border px-3 py-4 text-center transition duration-200",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--cf-warning-border)",
                selected
                  ? "border-(--cf-warning-border) bg-(--cf-warning-soft) text-(--cf-warning-text) shadow-[0_0_0_1px_rgba(251,191,36,0.3)]"
                  : "border-(--cf-border) bg-(--cf-surface-muted) text-(--cf-text-2) hover:border-(--cf-border-strong)",
              ].join(" ")}
              aria-pressed={selected}
            >
              <span className="block text-2xl font-semibold leading-none">
                {formatMinutesLabel(option)}
              </span>
            </button>
          );
        })}
      </div>

      <div className="mt-6 space-y-3">
        <div className="flex items-center justify-between text-sm text-(--cf-text-2)">
          <span>Custom goal</span>
          <span>{formatMinutesLabel(value)} / day</span>
        </div>

        <input
          type="range"
          min={10}
          max={240}
          step={5}
          value={value}
          onChange={(event) => onChange(clampGoal(Number(event.target.value)))}
          className="w-full accent-amber-400"
        />

        <div className="flex items-center gap-2">
          <input
            type="number"
            min={10}
            max={240}
            step={5}
            value={value}
            onChange={(event) => onChange(clampGoal(Number(event.target.value || 0)))}
            className="cf-input w-28 rounded-xl px-3 py-2 text-sm"
          />
          <span className="text-sm text-(--cf-text-3)">minutes per day</span>
        </div>
      </div>
    </div>
  );
}
