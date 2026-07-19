"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { DarkTooltip } from "@/app/book/admin/_components/DarkTooltip";

type ScenarioPoint = { date: string; submitted: number; approved: number };

export function ScenarioUsageChart({ data }: { data: ScenarioPoint[] }) {
  return (
    <ResponsiveContainer>
      <BarChart data={data} margin={{ top: 10, right: 10, bottom: 0, left: -10 }}>
        <CartesianGrid stroke="var(--cf-border)" vertical={false} />
        <XAxis
          dataKey="date"
          tick={{ fill: "var(--cf-text-3)", fontSize: 11 }}
          tickFormatter={formatDate}
        />
        <YAxis tick={{ fill: "var(--cf-text-3)", fontSize: 11 }} width={32} />
        <Tooltip content={<DarkTooltip />} />
        <Legend wrapperStyle={{ fontSize: 11, color: "var(--cf-text-3)" }} />
        <Bar
          dataKey="submitted"
          name="Submitted"
          fill="var(--cf-text-soft)"
          isAnimationActive={false}
          radius={[4, 4, 0, 0]}
        />
        <Bar
          dataKey="approved"
          name="Approved"
          fill="var(--cf-success-text)"
          isAnimationActive={false}
          radius={[4, 4, 0, 0]}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
