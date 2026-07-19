"use client";

import dynamic from "next/dynamic";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";

const KPISparklineChart = dynamic(
  () =>
    import("@/app/book/admin/_components/charts/KPISparklineChart").then(
      (module) => module.KPISparklineChart,
    ),
  { ssr: false },
);

export type Spark = { date: string; value: number }[];

export function KPITile({
  label,
  value,
  delta,
  spark,
  hint,
  format = "number",
  currency,
}: {
  label: string;
  value: number | string;
  delta?: number; // percent vs prior period
  spark?: Spark;
  hint?: string;
  format?: "number" | "currency" | "minutes" | "percent";
  currency?: string;
}) {
  const display = formatValue(value, format, currency);
  const deltaInfo = formatDelta(delta);

  return (
    <div className="cf-panel rounded-2xl p-4">
      <div className="flex items-start justify-between gap-2">
        <p className="text-cf-caption font-semibold uppercase tracking-[0.1em] text-(--cf-text-soft)">
          {label}
        </p>
        {deltaInfo && (
          <span
            className={[
              "inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-cf-caption font-medium",
              deltaInfo.tone === "up"
                ? "bg-(--cf-success-soft) text-(--cf-success-text)"
                : deltaInfo.tone === "down"
                ? "bg-(--cf-danger-soft) text-(--cf-danger-text)"
                : "bg-(--cf-surface-muted) text-(--cf-text-soft)",
            ].join(" ")}
            title={`vs prior period`}
          >
            {deltaInfo.icon}
            {deltaInfo.text}
          </span>
        )}
      </div>
      <p className="mt-2 text-2xl font-semibold tabular-nums tracking-tight text-(--cf-text-1)">
        {display}
      </p>
      {hint && <p className="mt-0.5 text-cf-caption text-(--cf-text-3)">{hint}</p>}
      {spark && spark.length > 1 && (
        <div className="-mx-1 mt-3 h-10">
          <KPISparklineChart label={label} spark={spark} format={format} currency={currency} />
        </div>
      )}
    </div>
  );
}

function formatValue(value: number | string, format: KPITileFormat, currency?: string): string {
  if (typeof value === "string") return value;
  if (format === "currency") {
    return `$${value.toLocaleString()}${currency ? ` ${currency}` : ""}`;
  }
  if (format === "minutes") return `${Math.round(value).toLocaleString()}m`;
  if (format === "percent") return `${value.toFixed(1)}%`;
  return value.toLocaleString();
}

type KPITileFormat = "number" | "currency" | "minutes" | "percent";

function formatDelta(delta?: number): {
  text: string;
  icon: React.ReactNode;
  tone: "up" | "down" | "flat";
} | null {
  if (delta === undefined || Number.isNaN(delta)) return null;
  if (Math.abs(delta) < 0.5) {
    return { text: "0%", icon: <Minus className="h-3 w-3" />, tone: "flat" };
  }
  const sign = delta > 0 ? "+" : "";
  return {
    text: `${sign}${delta.toFixed(0)}%`,
    icon:
      delta > 0 ? (
        <ArrowUpRight className="h-3 w-3" />
      ) : (
        <ArrowDownRight className="h-3 w-3" />
      ),
    tone: delta > 0 ? "up" : "down",
  };
}
