"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { DarkTooltip } from "@/app/book/admin/_components/DarkTooltip";

type Row = { key: string; count: number };
type DeviceRow = Row & { name: string };

const DEVICE_COLORS: Record<string, string> = {
  mobile: "var(--cf-accent)",
  desktop: "var(--cf-success-text)",
  tablet: "var(--cf-amber-text, var(--cf-warning-text))",
  unknown: "var(--cf-text-soft)",
};

export function DeviceTypeChart({ data }: { data: DeviceRow[] }) {
  return (
    <ResponsiveContainer>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius={50}
          outerRadius={90}
          paddingAngle={2}
          dataKey="count"
          isAnimationActive={false}
        >
          {data.map((entry) => (
            <Cell
              key={entry.key}
              fill={DEVICE_COLORS[entry.key] ?? "var(--cf-text-soft)"}
              stroke="var(--cf-surface)"
            />
          ))}
        </Pie>
        <Tooltip content={<DarkTooltip />} />
      </PieChart>
    </ResponsiveContainer>
  );
}

export function DeviceBreakdownChart({ rows, color }: { rows: Row[]; color: string }) {
  return (
    <ResponsiveContainer>
      <BarChart data={rows} layout="vertical" margin={{ top: 4, right: 8, bottom: 0, left: 80 }}>
        <CartesianGrid stroke="var(--cf-border)" horizontal={false} />
        <XAxis type="number" tick={{ fill: "var(--cf-text-3)", fontSize: 11 }} />
        <YAxis
          dataKey="key"
          type="category"
          tick={{ fill: "var(--cf-text-3)", fontSize: 11 }}
          width={120}
        />
        <Tooltip content={<DarkTooltip />} />
        <Bar dataKey="count" fill={color} radius={[0, 4, 4, 0]} isAnimationActive={false} />
      </BarChart>
    </ResponsiveContainer>
  );
}
