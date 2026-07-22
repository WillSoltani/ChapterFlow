"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { DarkTooltip } from "@/app/book/admin/_components/DarkTooltip";

type StreakBucket = { bucket: string; count: number };

export function StreakDistributionChart({ data }: { data: StreakBucket[] }) {
  return (
    <ResponsiveContainer>
      <BarChart data={data} margin={{ top: 10, right: 10, bottom: 0, left: -10 }}>
        <CartesianGrid stroke="var(--cf-border)" vertical={false} />
        <XAxis dataKey="bucket" tick={{ fill: "var(--cf-text-3)", fontSize: 11 }} />
        <YAxis tick={{ fill: "var(--cf-text-3)", fontSize: 11 }} width={32} />
        <Tooltip content={<DarkTooltip />} />
        <Bar dataKey="count" fill="var(--cf-accent)" radius={[4, 4, 0, 0]} isAnimationActive={false} />
      </BarChart>
    </ResponsiveContainer>
  );
}
