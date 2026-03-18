"use client";

type StatTileProps = {
  label: string;
  value: string;
  accent?: "sky" | "emerald" | "amber";
};

const accentClass: Record<NonNullable<StatTileProps["accent"]>, string> = {
  sky: "text-(--cf-accent)",
  emerald: "text-(--cf-success-text)",
  amber: "text-(--cf-warning-text)",
};

export function StatTile({ label, value, accent = "sky" }: StatTileProps) {
  return (
    <div className="cf-panel-muted rounded-2xl px-3 py-4 text-center">
      <p className={["text-4xl font-semibold tracking-tight", accentClass[accent]].join(" ")}>
        {value}
      </p>
      <p className="mt-1 text-sm text-(--cf-text-3)">{label}</p>
    </div>
  );
}
