"use client";

type SliderControlProps = {
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step: number;
  suffix?: string;
  label?: string;
  showEndLabels?: boolean;
  tickMarks?: string[];
};

export function SliderControl({
  value,
  onChange,
  min,
  max,
  step,
  suffix,
  label,
  showEndLabels,
  tickMarks,
}: SliderControlProps) {
  const percentage = ((value - min) / (max - min)) * 100;

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-3">
        <span className="min-w-12 rounded-lg bg-white/[0.06] border border-white/[0.06] px-2.5 py-1 text-center text-xs font-semibold tabular-nums text-(--cf-text-1)">
          {value}
          {suffix}
        </span>
        <div className="relative flex-1">
          <input
            type="range"
            role="slider"
            aria-label={label}
            aria-valuemin={min}
            aria-valuemax={max}
            aria-valuenow={value}
            aria-valuetext={`${value}${suffix ?? ""}`}
            min={min}
            max={max}
            step={step}
            value={value}
            onChange={(e) => onChange(Number(e.target.value))}
            className="slider-accent h-1.5 w-28 cursor-pointer appearance-none rounded-full sm:w-32"
            style={{
              background: `linear-gradient(to right, var(--cf-accent) 0%, var(--cf-accent-strong) ${percentage}%, rgba(255,255,255,0.06) ${percentage}%, rgba(255,255,255,0.06) 100%)`,
            }}
          />
        </div>
      </div>
      {/* End labels */}
      {showEndLabels && (
        <div className="flex justify-between pl-16 pr-0">
          <span className="text-[10px] text-(--cf-text-soft)">{min}{suffix}</span>
          <span className="text-[10px] text-(--cf-text-soft)">{max}{suffix}</span>
        </div>
      )}
      {/* Tick marks */}
      {tickMarks && tickMarks.length > 0 && (
        <div className="flex justify-between pl-16 pr-0">
          {tickMarks.map((tick, i) => (
            <span key={i} className="text-[10px] text-(--cf-text-soft)">{tick}</span>
          ))}
        </div>
      )}
    </div>
  );
}
