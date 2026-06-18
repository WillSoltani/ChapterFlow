"use client";

import type { ReactNode } from "react";

type SettingRowProps = {
  label: ReactNode;
  description?: string;
  children: ReactNode;
  id?: string;
  highlighted?: boolean;
};

export function SettingRow({
  label,
  description,
  children,
  id,
  highlighted,
}: SettingRowProps) {
  return (
    <div
      id={id}
      className={`flex flex-col items-start gap-2 rounded-lg px-3 py-3 transition-colors hover:bg-(--cf-surface-muted) sm:flex-row sm:items-center sm:justify-between sm:gap-4 ${
        highlighted ? "ring-1 ring-(--cf-accent-border) bg-(--cf-accent-muted)" : ""
      }`}
    >
      <div className="min-w-0 w-full sm:flex-1">
        <p className="text-sm font-medium text-(--cf-text-1)">{label}</p>
        {description && (
          <p className="mt-0.5 text-xs leading-relaxed text-(--cf-text-3)">
            {description}
          </p>
        )}
      </div>
      <div className="w-full sm:w-auto sm:shrink-0">{children}</div>
    </div>
  );
}

export function Divider() {
  return <div className="mx-3 h-px bg-(--cf-divider)" />;
}

export function SubsectionLabel({ children }: { children: ReactNode }) {
  return (
    <div className="px-3 pb-1 pt-3">
      <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-(--cf-text-soft)">
        {children}
      </p>
    </div>
  );
}
