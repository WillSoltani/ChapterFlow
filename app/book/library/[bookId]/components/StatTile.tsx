"use client";

type StatTileProps = {
  label: string;
  value: string;
  accent?: "sky" | "emerald" | "amber";
};

const accentClass: Record<NonNullable<StatTileProps["accent"]>, string> = {
  sky: "text-sky-300",
  emerald: "text-emerald-300",
  amber: "text-amber-300",
};

export function StatTile({ label, value, accent = "sky" }: StatTileProps) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/4 px-3 py-4 text-center">
      <p className={["text-4xl font-semibold tracking-tight", accentClass[accent]].join(" ")}>
        {value}
      </p>
      <p className="mt-1 text-sm text-slate-400">{label}</p>
    </div>
  );
}

