"use client";

type TimePickerProps = {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  label?: string;
};

export function TimePicker({ value, onChange, disabled, label }: TimePickerProps) {
  return (
    <input
      type="time"
      aria-label={label}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      className="cf-input min-h-[44px] rounded-xl px-3 py-1.5 text-sm focus:ring-2 focus:ring-(--cf-accent-border) disabled:cursor-not-allowed disabled:opacity-40"
    />
  );
}
