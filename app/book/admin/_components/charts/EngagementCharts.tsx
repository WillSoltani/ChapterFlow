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

type DailyPoint = { date: string; dau: number; sessions: number; minutes: number };
type QuizPoint = { date: string; attempts: number; passes: number };

export function DailyActiveUsersChart({ data }: { data: DailyPoint[] }) {
  return (
    <ResponsiveContainer>
      <AreaChart data={data} margin={{ top: 10, right: 10, bottom: 0, left: -10 }}>
        <defs>
          <linearGradient id="dau-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--cf-accent)" stopOpacity={0.4} />
            <stop offset="100%" stopColor="var(--cf-accent)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke="var(--cf-border)" vertical={false} />
        <XAxis
          dataKey="date"
          tick={{ fill: "var(--cf-text-3)", fontSize: 11 }}
          tickFormatter={formatDate}
        />
        <YAxis tick={{ fill: "var(--cf-text-3)", fontSize: 11 }} width={32} />
        <Tooltip content={<DarkTooltip />} />
        <Area
          type="monotone"
          dataKey="dau"
          stroke="var(--cf-accent)"
          strokeWidth={1.75}
          fill="url(#dau-fill)"
          isAnimationActive={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function ReadingMinutesChart({ data }: { data: DailyPoint[] }) {
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
        <Bar
          dataKey="minutes"
          fill="var(--cf-accent)"
          isAnimationActive={false}
          radius={[4, 4, 0, 0]}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function QuizAttemptsChart({ data }: { data: QuizPoint[] }) {
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
          dataKey="attempts"
          name="Attempts"
          fill="var(--cf-text-soft)"
          isAnimationActive={false}
          radius={[4, 4, 0, 0]}
        />
        <Bar
          dataKey="passes"
          name="Passes"
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
