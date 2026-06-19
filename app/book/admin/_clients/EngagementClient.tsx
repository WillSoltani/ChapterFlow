"use client";

import { useEffect, useMemo, useState } from "react";
import { Activity } from "lucide-react";
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
import { adminGet } from "@/app/book/admin/_components/admin-api";
import { AdminCard, PageHeader } from "@/app/book/admin/_components/AdminCard";
import { ErrorAlert } from "@/app/book/admin/_components/ErrorAlert";
import { EmptyState } from "@/components/ui/EmptyState";
import { ChartSkeleton, StatBoxSkeleton } from "@/app/book/admin/_components/Skeleton";
import { StatBox } from "@/app/book/admin/_components/StatBox";
import { RangeSelector } from "@/app/book/admin/_components/RangeSelector";
import { DarkTooltip } from "@/app/book/admin/_components/DarkTooltip";

type DailyPoint = { date: string; dau: number; sessions: number; minutes: number };

type EngagementResponse = {
  generatedAt: string;
  range: number;
  daily: DailyPoint[];
  quizAttempts: { date: string; value: number }[];
  quizPasses: { date: string; value: number }[];
  heatmap: number[][];
};

const DOW_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function EngagementClient() {
  const [range, setRange] = useState(30);
  const [data, setData] = useState<EngagementResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = () => {
    setLoading(true);
    setError(null);
    adminGet<EngagementResponse>(`/metrics/engagement?range=${range}`)
      .then(setData)
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : "Failed to load engagement"),
      )
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    reload();
  }, [range]);

  const daily = data?.daily ?? [];
  const wauMau = useMemo(() => computeWauMau(daily), [daily]);
  const heatmapMax = useMemo(() => {
    if (!data) return 0;
    return Math.max(0, ...data.heatmap.flat());
  }, [data]);

  const quizCombined = useMemo(() => {
    if (!data) return [];
    const map: Record<string, { date: string; attempts: number; passes: number }> = {};
    for (const a of data.quizAttempts) map[a.date] = { date: a.date, attempts: a.value, passes: 0 };
    for (const p of data.quizPasses) {
      if (!map[p.date]) map[p.date] = { date: p.date, attempts: 0, passes: 0 };
      map[p.date].passes = p.value;
    }
    return Object.values(map).sort((a, b) => a.date.localeCompare(b.date));
  }, [data]);

  const totalActivity = daily.reduce((s, d) => s + d.dau, 0);

  return (
    <div>
      <PageHeader
        title="Engagement"
        description={data ? `Last ${data.range} days` : "Reading and quiz activity"}
        action={<RangeSelector value={range} onChange={setRange} />}
      />

      {error && <ErrorAlert error={error} onRetry={reload} />}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <AdminCard
          title="Daily active users (DAU)"
          description="Distinct users with at least one event"
          className="lg:col-span-2"
        >
          {loading && !data ? (
            <ChartSkeleton height="h-64" />
          ) : totalActivity === 0 ? (
            <EmptyState
              icon={Activity}
              title="No activity in this range"
              description="Once users start engaging, you'll see their daily presence here."
              compact
            />
          ) : (
            <div className="h-64">
              <ResponsiveContainer>
                <AreaChart data={daily} margin={{ top: 10, right: 10, bottom: 0, left: -10 }}>
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
                    tickFormatter={fmtDate}
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
            </div>
          )}
        </AdminCard>

        <AdminCard title="Stickiness" description="DAU / WAU / MAU and ratios">
          {loading && !data ? (
            <div className="space-y-2.5">
              {Array.from({ length: 5 }).map((_, i) => (
                <StatBoxSkeleton key={i} />
              ))}
            </div>
          ) : (
            <div className="space-y-2.5">
              <StatBox large label="DAU (today)" value={wauMau.dauToday.toLocaleString()} />
              <StatBox large label="WAU (7d unique)" value={wauMau.wau.toLocaleString()} />
              <StatBox large label="MAU (30d unique)" value={wauMau.mau.toLocaleString()} />
              <div className="grid grid-cols-2 gap-2">
                <StatBox label="DAU/WAU" value={`${(wauMau.dauWau * 100).toFixed(0)}%`} />
                <StatBox label="DAU/MAU" value={`${(wauMau.dauMau * 100).toFixed(0)}%`} />
              </div>
            </div>
          )}
        </AdminCard>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <AdminCard title="Reading minutes" description="Total per day">
          {loading && !data ? (
            <ChartSkeleton />
          ) : (
            <div className="h-56">
              <ResponsiveContainer>
                <BarChart data={daily} margin={{ top: 10, right: 10, bottom: 0, left: -10 }}>
                  <CartesianGrid stroke="var(--cf-border)" vertical={false} />
                  <XAxis
                    dataKey="date"
                    tick={{ fill: "var(--cf-text-3)", fontSize: 11 }}
                    tickFormatter={fmtDate}
                  />
                  <YAxis tick={{ fill: "var(--cf-text-3)", fontSize: 11 }} width={32} />
                  <Tooltip content={<DarkTooltip />} />
                  <Bar dataKey="minutes" fill="var(--cf-accent)" isAnimationActive={false} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </AdminCard>

        <AdminCard title="Quiz attempts vs passes" description="Pass rate trend">
          {loading && !data ? (
            <ChartSkeleton />
          ) : (
            <div className="h-56">
              <ResponsiveContainer>
                <BarChart data={quizCombined} margin={{ top: 10, right: 10, bottom: 0, left: -10 }}>
                  <CartesianGrid stroke="var(--cf-border)" vertical={false} />
                  <XAxis
                    dataKey="date"
                    tick={{ fill: "var(--cf-text-3)", fontSize: 11 }}
                    tickFormatter={fmtDate}
                  />
                  <YAxis tick={{ fill: "var(--cf-text-3)", fontSize: 11 }} width={32} />
                  <Tooltip content={<DarkTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 11, color: "var(--cf-text-3)" }} />
                  <Bar dataKey="attempts" name="Attempts" fill="var(--cf-text-soft)" isAnimationActive={false} radius={[4, 4, 0, 0]} />
                  <Bar dataKey="passes" name="Passes" fill="var(--cf-success-text)" isAnimationActive={false} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </AdminCard>
      </div>

      <div className="mt-6">
        <AdminCard
          title="Reading sessions heatmap"
          description="Last 14 days · UTC hour × weekday"
        >
          <div className="overflow-x-auto">
            <div className="inline-block min-w-full">
              <div className="flex items-center gap-1 pl-12 text-[10px] text-(--cf-text-soft)">
                {Array.from({ length: 24 }, (_, h) => (
                  <div key={h} className="w-6 text-center">
                    {h}
                  </div>
                ))}
              </div>
              {data?.heatmap.map((row, dow) => (
                <div key={dow} className="mt-1 flex items-center gap-1">
                  <div className="w-12 text-[10px] text-(--cf-text-soft)">{DOW_LABELS[dow]}</div>
                  {row.map((cell, h) => (
                    <div
                      key={h}
                      className="h-6 w-6 rounded transition"
                      style={{
                        backgroundColor:
                          cell === 0
                            ? "var(--cf-surface-muted)"
                            : `color-mix(in srgb, var(--cf-accent) ${
                                Math.min(95, 12 + (cell / Math.max(1, heatmapMax)) * 75)
                              }%, transparent)`,
                      }}
                      title={`${DOW_LABELS[dow]} ${h}:00 — ${cell} sessions`}
                    />
                  ))}
                </div>
              ))}
            </div>
          </div>
        </AdminCard>
      </div>
    </div>
  );
}

function fmtDate(d: string): string {
  const date = new Date(d);
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function computeWauMau(daily: DailyPoint[]): {
  dauToday: number;
  wau: number;
  mau: number;
  dauWau: number;
  dauMau: number;
} {
  if (!daily.length) return { dauToday: 0, wau: 0, mau: 0, dauWau: 0, dauMau: 0 };
  const dauToday = daily[daily.length - 1]?.dau ?? 0;
  const wau = daily.slice(-7).reduce((acc, d) => acc + d.dau, 0);
  const mau = daily.slice(-30).reduce((acc, d) => acc + d.dau, 0);
  return {
    dauToday,
    wau,
    mau,
    dauWau: wau ? dauToday / wau : 0,
    dauMau: mau ? dauToday / mau : 0,
  };
}
