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

type CountryRow = { country: string; mrrCents: number; mrr: number };
type CardBrandRow = { brand: string; count: number };

const BRAND_COLORS: Record<string, string> = {
  visa: "var(--cf-accent)",
  mastercard: "var(--cf-warning-text)",
  amex: "var(--cf-success-text)",
  discover: "var(--cf-danger-text)",
  unknown: "var(--cf-text-soft)",
};

export function RevenueByCountryChart({ data }: { data: CountryRow[] }) {
  return (
    <ResponsiveContainer>
      <BarChart data={data} layout="vertical" margin={{ top: 10, right: 10, bottom: 0, left: 60 }}>
        <CartesianGrid stroke="var(--cf-border)" horizontal={false} />
        <XAxis
          type="number"
          tick={{ fill: "var(--cf-text-3)", fontSize: 11 }}
          tickFormatter={(value) => `$${value}`}
        />
        <YAxis
          dataKey="country"
          type="category"
          tick={{ fill: "var(--cf-text-3)", fontSize: 11 }}
          width={80}
        />
        <Tooltip content={<DarkTooltip />} />
        <Bar dataKey="mrr" fill="var(--cf-accent)" radius={[0, 4, 4, 0]} isAnimationActive={false} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function CardBrandMixChart({ data }: { data: CardBrandRow[] }) {
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
          dataKey="count"
          nameKey="brand"
          isAnimationActive={false}
        >
          {data.map((entry) => (
            <Cell
              key={entry.brand}
              fill={BRAND_COLORS[entry.brand] ?? "var(--cf-text-soft)"}
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
