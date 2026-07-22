"use client";

import { Area, AreaChart, ResponsiveContainer, Tooltip } from "recharts";

type Spark = { date: string; value: number }[];
type Format = "number" | "currency" | "minutes" | "percent";

export function KPISparklineChart({
  label,
  spark,
  format,
  currency,
}: {
  label: string;
  spark: Spark;
  format: Format;
  currency?: string | undefined;
}) {
  const gradientId = `spark-${label.replace(/\s+/g, "")}`;

  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={spark} margin={{ top: 2, right: 2, bottom: 0, left: 2 }}>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--cf-accent)" stopOpacity={0.35} />
            <stop offset="100%" stopColor="var(--cf-accent)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <Tooltip
          cursor={false}
          contentStyle={{
            background: "var(--cf-surface-strong)",
            border: "1px solid var(--cf-border)",
            borderRadius: 8,
            fontSize: 11,
            padding: "4px 8px",
          }}
          labelStyle={{ color: "var(--cf-text-3)" }}
          itemStyle={{ color: "var(--cf-text-1)" }}
          formatter={((value: number) => [formatValue(value, format, currency), label]) as never}
        />
        <Area
          type="monotone"
          dataKey="value"
          stroke="var(--cf-accent)"
          strokeWidth={1.5}
          fill={`url(#${gradientId})`}
          isAnimationActive={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

function formatValue(value: number, format: Format, currency?: string): string {
  if (format === "currency") {
    return `$${value.toLocaleString()}${currency ? ` ${currency}` : ""}`;
  }
  if (format === "minutes") return `${Math.round(value).toLocaleString()}m`;
  if (format === "percent") return `${value.toFixed(1)}%`;
  return value.toLocaleString();
}
