"use client";

import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { DarkTooltip } from "@/app/book/admin/_components/DarkTooltip";

type PerformancePoint = { date: string; p50: number; p95: number; samples: number };

export function PageLoadChart({ data }: { data: PerformancePoint[] }) {
  return (
    <ResponsiveContainer>
      <LineChart data={data} margin={{ top: 10, right: 10, bottom: 0, left: 0 }}>
        <CartesianGrid stroke="var(--cf-border)" vertical={false} />
        <XAxis
          dataKey="date"
          tick={{ fill: "var(--cf-text-3)", fontSize: 11 }}
          tickFormatter={formatDate}
        />
        <YAxis
          tick={{ fill: "var(--cf-text-3)", fontSize: 11 }}
          width={48}
          allowDecimals={false}
        />
        <Tooltip content={<DarkTooltip />} />
        <Line
          type="monotone"
          dataKey="p50"
          name="p50"
          stroke="var(--cf-accent)"
          strokeWidth={1.75}
          isAnimationActive={false}
          dot={false}
        />
        <Line
          type="monotone"
          dataKey="p95"
          name="p95"
          stroke="var(--cf-warning-text, var(--cf-accent))"
          strokeWidth={1.5}
          strokeDasharray="3 3"
          isAnimationActive={false}
          dot={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
