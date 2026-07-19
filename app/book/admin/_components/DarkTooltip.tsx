"use client";

type TooltipPayload = {
  active?: boolean;
  payload?: Array<{ name?: string; value?: number; color?: string; dataKey?: string }>;
  label?: string;
};

export function DarkTooltip({ active, payload, label }: TooltipPayload) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-(--cf-border) bg-(--cf-surface-strong) px-2.5 py-1.5 text-cf-caption shadow-lg backdrop-blur-sm">
      {label && <p className="text-(--cf-text-3)">{label}</p>}
      {payload.map((p, i) => (
        <p key={i} className="mt-0.5" style={{ color: p.color ?? "var(--cf-text-1)" }}>
          {p.name && <span className="text-(--cf-text-3) mr-1">{p.name}:</span>}
          <span className="tabular-nums font-medium">
            {typeof p.value === "number" ? p.value.toLocaleString() : p.value}
          </span>
        </p>
      ))}
    </div>
  );
}
