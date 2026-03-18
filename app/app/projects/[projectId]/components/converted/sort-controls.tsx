"use client";

import { ChevronDown, ChevronUp } from "lucide-react";

export type SortField = "name" | "size" | "date";
export type SortDir = "asc" | "desc";
export type SortBy = { field: SortField; dir: SortDir };

export function SortButton({
  field, label, current, onChange,
}: {
  field: SortField;
  label: string;
  current: SortBy;
  onChange: (s: SortBy) => void;
}) {
  const active = current.field === field;
  return (
    <button
      type="button"
      onClick={() => onChange({ field, dir: active && current.dir === "asc" ? "desc" : "asc" })}
      className={[
        "inline-flex items-center gap-1 rounded-xl px-2.5 py-1.5 text-xs font-semibold transition",
        active
          ? "cf-pill cf-pill-info"
          : "cf-pill hover:border-[var(--cf-border-strong)] hover:text-[var(--cf-text-1)]",
      ].join(" ")}
    >
      {label}
      {active
        ? current.dir === "asc"
          ? <ChevronUp className="h-3 w-3" />
          : <ChevronDown className="h-3 w-3" />
        : null}
    </button>
  );
}

export function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch {
    return iso;
  }
}
