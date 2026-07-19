"use client";

import {
  Area,
  AreaChart,
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

type DailyFlowPoint = { date: string; earned: number; spent: number };
type EarnedPoint = { source: string; amount: number };
type SpentPoint = { rewardId: string; amount: number };

export function DailyFlowChart({ data }: { data: DailyFlowPoint[] }) {
  return (
    <ResponsiveContainer>
      <AreaChart data={data} margin={{ top: 10, right: 10, bottom: 0, left: -10 }}>
        <CartesianGrid stroke="var(--cf-border)" vertical={false} />
        <XAxis
          dataKey="date"
          tick={{ fill: "var(--cf-text-3)", fontSize: 11 }}
          tickFormatter={formatDate}
        />
        <YAxis tick={{ fill: "var(--cf-text-3)", fontSize: 11 }} width={32} />
        <Tooltip content={<DarkTooltip />} />
        <Legend wrapperStyle={{ fontSize: 11, color: "var(--cf-text-3)" }} />
        <Area
          type="monotone"
          dataKey="earned"
          name="Earned"
          stroke="var(--cf-success-text)"
          strokeWidth={1.5}
          fill="var(--cf-success-text)"
          fillOpacity={0.25}
          isAnimationActive={false}
        />
        <Area
          type="monotone"
          dataKey="spent"
          name="Spent"
          stroke="var(--cf-amber-text, var(--cf-accent))"
          strokeWidth={1.5}
          fill="var(--cf-amber-text, var(--cf-accent))"
          fillOpacity={0.25}
          isAnimationActive={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function EarnedBySourceChart({ data }: { data: EarnedPoint[] }) {
  return <HorizontalEconomyChart data={data} dataKey="source" color="var(--cf-success-text)" />;
}

export function SpentByRewardChart({ data }: { data: SpentPoint[] }) {
  return (
    <HorizontalEconomyChart
      data={data}
      dataKey="rewardId"
      color="var(--cf-amber-text, var(--cf-accent))"
    />
  );
}

function HorizontalEconomyChart({
  data,
  dataKey,
  color,
}: {
  data: Array<{ source?: string; rewardId?: string; amount: number }>;
  dataKey: "source" | "rewardId";
  color: string;
}) {
  return (
    <ResponsiveContainer>
      <BarChart data={data} layout="vertical" margin={{ top: 10, right: 10, bottom: 0, left: 80 }}>
        <CartesianGrid stroke="var(--cf-border)" horizontal={false} />
        <XAxis type="number" tick={{ fill: "var(--cf-text-3)", fontSize: 11 }} />
        <YAxis
          dataKey={dataKey}
          type="category"
          tick={{ fill: "var(--cf-text-3)", fontSize: 11 }}
          width={130}
        />
        <Tooltip content={<DarkTooltip />} />
        <Bar dataKey="amount" fill={color} isAnimationActive={false} radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
