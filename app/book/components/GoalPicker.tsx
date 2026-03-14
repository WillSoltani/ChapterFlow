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
    <div className="rounded-[30px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.07),rgba(255,255,255,0.04))] px-4 py-5 sm:px-6 sm:py-6">
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
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300/50",
                selected
                  ? "border-amber-300/60 bg-amber-300/20 text-amber-100 shadow-[0_0_0_1px_rgba(251,191,36,0.3)]"
                  : "border-white/25 bg-white/5 text-slate-200 hover:border-white/45",
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
        <div className="flex items-center justify-between text-sm text-slate-300">
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
            className="w-28 rounded-xl border border-white/20 bg-white/5 px-3 py-2 text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300/45"
          />
          <span className="text-sm text-slate-400">minutes per day</span>
        </div>
      </div>
    </div>
  );
}

