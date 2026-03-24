"use client";

type DropdownOption<T extends string> = {
  value: T;
  label: string;
};

type DropdownSelectProps<T extends string> = {
  options: DropdownOption<T>[];
  value: T;
  onChange: (value: T) => void;
  label?: string;
};

export function DropdownSelect<T extends string>({
  options,
  value,
  onChange,
  label,
}: DropdownSelectProps<T>) {
  return (
    <select
      aria-label={label}
      value={value}
      onChange={(e) => onChange(e.target.value as T)}
      className="cf-input min-h-[44px] rounded-xl px-3 py-1.5 text-sm focus:ring-2 focus:ring-(--cf-accent-border)"
    >
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}
