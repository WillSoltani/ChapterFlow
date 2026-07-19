"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { DarkTooltip } from "@/app/book/admin/_components/DarkTooltip";

type RevenuePoint = { date: string; value: number };
type SourcePoint = { name: string; value: number };

const SOURCE_COLORS: Record<string, string> = {
  stripe: "var(--cf-accent)",
  license: "var(--cf-success-text)",
  flow_points: "var(--cf-warm-text, var(--cf-accent))",
  unknown: "var(--cf-text-soft)",
};

export function SubscriptionEventsChart({ data }: { data: RevenuePoint[] }) {
  return <RevenueBarChart data={data} color="var(--cf-accent)" />;
}

export function LicenseRedemptionsChart({ data }: { data: RevenuePoint[] }) {
  return <RevenueBarChart data={data} color="var(--cf-amber-text, var(--cf-accent))" />;
}

export function ProSourceMixChart({ data }: { data: SourcePoint[] }) {
  return (
    <ResponsiveContainer>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius={36}
          outerRadius={72}
          paddingAngle={2}
          dataKey="value"
          isAnimationActive={false}
        >
          {data.map((entry) => (
            <Cell
              key={entry.name}
              fill={SOURCE_COLORS[entry.name] ?? "var(--cf-text-soft)"}
              stroke="var(--cf-surface)"
            />
          ))}
        </Pie>
        <Tooltip content={<DarkTooltip />} />
        <Legend wrapperStyle={{ fontSize: 11, color: "var(--cf-text-3)" }} iconSize={8} />
      </PieChart>
    </ResponsiveContainer>
  );
}

function RevenueBarChart({ data, color }: { data: RevenuePoint[]; color: string }) {
  return (
    <ResponsiveContainer>
      <BarChart data={data} margin={{ top: 10, right: 10, bottom: 0, left: 0 }}>
        <CartesianGrid stroke="var(--cf-border)" vertical={false} />
        <XAxis
          dataKey="date"
          tick={{ fill: "var(--cf-text-3)", fontSize: 11 }}
          tickFormatter={formatDate}
        />
        <YAxis
          tick={{ fill: "var(--cf-text-3)", fontSize: 11 }}
          width={40}
          allowDecimals={false}
        />
        <Tooltip content={<DarkTooltip />} />
        <Bar dataKey="value" fill={color} isAnimationActive={false} radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
