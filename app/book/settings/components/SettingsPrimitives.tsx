"use client";

import type { HTMLAttributes, ReactNode } from "react";
import {
  Check,
  ChevronDown,
  ChevronRight,
  Search,
  Sparkles,
} from "lucide-react";
import { Card } from "@/app/book/components/ui/Card";
import { Button } from "@/app/book/components/ui/Button";
import { cn } from "@/app/book/components/ui/cn";

export type SectionNavItem = {
  id: string;
  title: string;
  description: string;
  icon: ReactNode;
  results: number;
};

type SettingsSectionCardProps = HTMLAttributes<HTMLDivElement> & {
  id: string;
  title: string;
  description: string;
  icon: ReactNode;
  helper?: string;
  status?: string;
  accent?: "sky" | "amber" | "emerald" | "rose";
  right?: ReactNode;
  mobileCollapsed?: boolean;
  onToggleMobile?: () => void;
  children: ReactNode;
};

const accentClass = {
  sky: "from-sky-400/22 via-cyan-300/12 to-transparent border-sky-300/18",
  amber: "from-amber-300/18 via-orange-300/10 to-transparent border-amber-300/18",
  emerald: "from-emerald-300/18 via-teal-300/10 to-transparent border-emerald-300/18",
  rose: "from-rose-300/18 via-pink-300/10 to-transparent border-rose-300/18",
} as const;

export function SettingsSectionCard({
  id,
  title,
  description,
  icon,
  helper,
  status,
  accent = "sky",
  right,
  mobileCollapsed = false,
  onToggleMobile,
  children,
  className,
  ...props
}: SettingsSectionCardProps) {
  return (
    <Card
      id={id}
      className={cn(
        "scroll-mt-24 overflow-hidden border-white/12 bg-[linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0.04))] p-0",
        className
      )}
      {...props}
    >
      <div
        className={cn(
          "border-b bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.08),transparent_45%)] px-5 py-5 sm:px-6",
          accentClass[accent]
        )}
      >
        <div className="hidden items-start justify-between gap-4 md:flex">
          <div className="flex items-start gap-4">
            <div className="mt-0.5 inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-white/12 bg-white/8 text-slate-100 shadow-[0_12px_28px_rgba(2,6,23,0.28)]">
              {icon}
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-xl font-semibold tracking-tight text-slate-50">{title}</h2>
                {status ? <SectionPill>{status}</SectionPill> : null}
              </div>
              <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-300">{description}</p>
              {helper ? <p className="mt-3 text-xs uppercase tracking-[0.24em] text-slate-500">{helper}</p> : null}
            </div>
          </div>
          {right ? <div className="shrink-0">{right}</div> : null}
        </div>

        <button
          type="button"
          onClick={onToggleMobile}
          className="flex w-full items-start justify-between gap-3 text-left md:hidden"
          aria-expanded={!mobileCollapsed}
        >
          <div className="flex min-w-0 items-start gap-3">
            <div className="mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-white/12 bg-white/8 text-slate-100">
              {icon}
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-semibold tracking-tight text-slate-50">{title}</h2>
                {status ? <SectionPill>{status}</SectionPill> : null}
              </div>
              <p className="mt-1 text-sm leading-6 text-slate-300">{description}</p>
            </div>
          </div>
          <span className="mt-1 inline-flex h-8 w-8 items-center justify-center rounded-xl border border-white/12 bg-white/7 text-slate-300">
            {mobileCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </span>
        </button>
      </div>

      <div className={cn("px-5 py-5 sm:px-6 sm:py-6", mobileCollapsed && "hidden md:block")}>
        {children}
      </div>
    </Card>
  );
}

export function SectionPill({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-white/12 bg-white/8 px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.22em] text-slate-300">
      {children}
    </span>
  );
}

export function SettingGroup({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <div className="space-y-4 rounded-[28px] border border-white/10 bg-white/[0.03] p-4 sm:p-5">
      <div>
        <h3 className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-200">{title}</h3>
        {description ? <p className="mt-1 text-sm leading-6 text-slate-400">{description}</p> : null}
      </div>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

export function ToggleRow({
  label,
  description,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div className={cn("flex items-start justify-between gap-4 rounded-2xl border border-white/8 bg-black/10 px-4 py-3.5", disabled && "opacity-55")}>
      <div className="min-w-0">
        <p className="text-sm font-medium text-slate-100">{label}</p>
        {description ? <p className="mt-1 text-sm leading-6 text-slate-400">{description}</p> : null}
      </div>
      <button
        type="button"
        disabled={disabled}
        aria-pressed={checked}
        onClick={() => onChange(!checked)}
        className={cn(
          "relative mt-0.5 inline-flex h-7 w-12 shrink-0 items-center rounded-full border transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300/45",
          checked
            ? "border-sky-300/35 bg-linear-to-r from-sky-500 to-cyan-400"
            : "border-white/12 bg-white/10"
        )}
      >
        <span
          className={cn(
            "inline-flex h-5 w-5 items-center justify-center rounded-full bg-white text-slate-900 shadow-[0_8px_18px_rgba(15,23,42,0.4)] transition",
            checked ? "translate-x-6" : "translate-x-1"
          )}
        >
          {checked ? <Check className="h-3 w-3" /> : null}
        </span>
      </button>
    </div>
  );
}

export function SegmentedControl<T extends string>({
  value,
  onChange,
  options,
  className,
}: {
  value: T;
  onChange: (value: T) => void;
  options: Array<{ value: T; label: string; description?: string; icon?: ReactNode }>;
  className?: string;
}) {
  return (
    <div className={cn("grid gap-2 sm:grid-cols-2 xl:grid-cols-3", className)}>
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={cn(
              "group rounded-2xl border px-4 py-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300/45",
              active
                ? "border-sky-300/35 bg-sky-500/12 shadow-[0_16px_32px_rgba(14,165,233,0.12)]"
                : "border-white/8 bg-black/10 hover:border-white/14 hover:bg-white/5"
            )}
          >
            <div className="flex items-center gap-2">
              {option.icon ? (
                <span className={cn("inline-flex h-8 w-8 items-center justify-center rounded-xl border", active ? "border-sky-300/28 bg-sky-500/14 text-sky-100" : "border-white/10 bg-white/6 text-slate-300")}>
                  {option.icon}
                </span>
              ) : null}
              <span className={cn("text-sm font-semibold", active ? "text-slate-50" : "text-slate-200")}>{option.label}</span>
            </div>
            {option.description ? (
              <p className={cn("mt-2 text-sm leading-6", active ? "text-slate-200" : "text-slate-400")}>{option.description}</p>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

export function SliderRow({
  label,
  description,
  value,
  min,
  max,
  step,
  onChange,
  renderValue,
}: {
  label: string;
  description?: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
  renderValue?: (value: number) => string;
}) {
  return (
    <div className="rounded-2xl border border-white/8 bg-black/10 px-4 py-3.5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-slate-100">{label}</p>
          {description ? <p className="mt-1 text-sm leading-6 text-slate-400">{description}</p> : null}
        </div>
        <div className="rounded-full border border-white/10 bg-white/7 px-3 py-1 text-sm font-medium text-slate-100">
          {renderValue ? renderValue(value) : value}
        </div>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="mt-4 h-2 w-full cursor-pointer appearance-none rounded-full bg-white/12 accent-sky-400"
      />
    </div>
  );
}

export function SelectRow<T extends string>({
  label,
  description,
  value,
  onChange,
  options,
}: {
  label: string;
  description?: string;
  value: T;
  onChange: (value: T) => void;
  options: Array<{ value: T; label: string }>;
}) {
  return (
    <label className="block rounded-2xl border border-white/8 bg-black/10 px-4 py-3.5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-slate-100">{label}</p>
          {description ? <p className="mt-1 text-sm leading-6 text-slate-400">{description}</p> : null}
        </div>
        <select
          value={value}
          onChange={(event) => onChange(event.target.value as T)}
          className="min-w-[190px] rounded-xl border border-white/10 bg-[#0e1527] px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-sky-300/35"
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
    </label>
  );
}

export function ChipsRow({
  label,
  description,
  options,
  selected,
  onToggle,
}: {
  label: string;
  description?: string;
  options: string[];
  selected: string[];
  onToggle: (value: string) => void;
}) {
  return (
    <div className="rounded-2xl border border-white/8 bg-black/10 px-4 py-3.5">
      <p className="text-sm font-medium text-slate-100">{label}</p>
      {description ? <p className="mt-1 text-sm leading-6 text-slate-400">{description}</p> : null}
      <div className="mt-3 flex flex-wrap gap-2">
        {options.map((option) => {
          const active = selected.includes(option);
          return (
            <button
              key={option}
              type="button"
              onClick={() => onToggle(option)}
              className={cn(
                "rounded-full border px-3 py-1.5 text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300/45",
                active
                  ? "border-sky-300/35 bg-sky-500/12 text-sky-100"
                  : "border-white/10 bg-white/5 text-slate-300 hover:border-white/18 hover:bg-white/7"
              )}
            >
              {option}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function PreviewCard({ title, eyebrow, children, footer }: { title: string; eyebrow?: string; children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="overflow-hidden rounded-[28px] border border-white/12 bg-[linear-gradient(180deg,rgba(11,16,32,0.94),rgba(7,11,23,0.98))] shadow-[0_20px_44px_rgba(2,6,23,0.42)]">
      <div className="border-b border-white/8 px-5 py-4">
        {eyebrow ? <p className="text-[11px] uppercase tracking-[0.26em] text-slate-500">{eyebrow}</p> : null}
        <h3 className="mt-1 text-base font-semibold text-slate-50">{title}</h3>
      </div>
      <div className="px-5 py-5">{children}</div>
      {footer ? <div className="border-t border-white/8 px-5 py-4 text-sm text-slate-400">{footer}</div> : null}
    </div>
  );
}

export function DangerActionCard({
  title,
  description,
  actionLabel,
  onAction,
}: {
  title: string;
  description: string;
  actionLabel: string;
  onAction: () => void;
}) {
  return (
    <div className="rounded-[24px] border border-rose-300/18 bg-rose-500/[0.06] p-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h4 className="text-sm font-semibold uppercase tracking-[0.22em] text-rose-100">{title}</h4>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-rose-100/80">{description}</p>
        </div>
        <Button variant="danger" onClick={onAction} className="sm:shrink-0">
          {actionLabel}
        </Button>
      </div>
    </div>
  );
}

export function SettingsSearchBar({
  value,
  onChange,
  resultCount,
  onClear,
}: {
  value: string;
  onChange: (value: string) => void;
  resultCount: number;
  onClear: () => void;
}) {
  return (
    <div className="rounded-[30px] border border-white/12 bg-[linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0.04))] p-4 shadow-[0_18px_40px_rgba(2,6,23,0.36)] sm:p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-[11px] uppercase tracking-[0.28em] text-slate-500">Control center</p>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight text-slate-50">Search settings</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
            Find controls by label, intent, or helper text. Press / to focus from anywhere on this page.
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-full border border-emerald-300/15 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-100">
          <Sparkles className="h-4 w-4" />
          {resultCount} matches
        </div>
      </div>
      <div className="mt-4 flex flex-col gap-3 sm:flex-row">
        <label className="relative block flex-1">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={value}
            onChange={(event) => onChange(event.target.value)}
            placeholder="Search settings"
            className="w-full rounded-2xl border border-white/10 bg-[#0c1426] px-11 py-3 text-sm text-slate-100 placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300/45"
            aria-label="Search settings"
          />
        </label>
        <Button variant="secondary" onClick={onClear} className="sm:px-5">
          Clear search
        </Button>
      </div>
    </div>
  );
}

export function SectionNav({
  items,
  activeId,
  onNavigate,
}: {
  items: SectionNavItem[];
  activeId: string;
  onNavigate: (id: string) => void;
}) {
  return (
    <div className="rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.07),rgba(255,255,255,0.03))] p-3 shadow-[0_18px_34px_rgba(2,6,23,0.28)]">
      <div className="border-b border-white/8 px-3 pb-3 pt-2">
        <p className="text-[11px] uppercase tracking-[0.28em] text-slate-500">Sections</p>
        <h2 className="mt-2 text-sm font-semibold text-slate-100">Jump directly to what matters</h2>
      </div>
      <div className="mt-2 space-y-1">
        {items.map((item) => {
          const active = item.id === activeId;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onNavigate(item.id)}
              className={cn(
                "flex w-full items-start gap-3 rounded-2xl px-3 py-3 text-left transition",
                active ? "bg-sky-500/12 text-slate-50" : "text-slate-300 hover:bg-white/6"
              )}
            >
              <span className={cn("mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border", active ? "border-sky-300/28 bg-sky-500/14 text-sky-100" : "border-white/10 bg-white/6 text-slate-300")}>
                {item.icon}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center justify-between gap-3">
                  <span className="text-sm font-medium">{item.title}</span>
                  <span className="rounded-full border border-white/10 bg-white/6 px-2 py-0.5 text-[11px] text-slate-400">{item.results}</span>
                </span>
                <span className="mt-1 block text-xs leading-5 text-slate-500">{item.description}</span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function InlineSummaryStat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-2xl border border-white/8 bg-black/10 px-4 py-3">
      <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">{label}</p>
      <p className="mt-2 text-lg font-semibold text-slate-50">{value}</p>
    </div>
  );
}
