"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { DarkTooltip } from "@/app/book/admin/_components/DarkTooltip";

type GrowthPoint = { date: string; value: number };

export function SignupGrowthChart({ data }: { data: GrowthPoint[] }) {
  return <GrowthBarChart data={data} color="var(--cf-accent)" />;
}

export function ReferralActivationsChart({ data }: { data: GrowthPoint[] }) {
  return <GrowthBarChart data={data} color="var(--cf-success-text)" />;
}

function GrowthBarChart({ data, color }: { data: GrowthPoint[]; color: string }) {
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
