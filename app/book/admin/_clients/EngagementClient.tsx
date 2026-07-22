"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Activity } from "lucide-react";
import { adminGet } from "@/app/book/admin/_components/admin-api";
import { AdminCard, PageHeader } from "@/app/book/admin/_components/AdminCard";
import { ErrorAlert } from "@/app/book/admin/_components/ErrorAlert";
import { EmptyState } from "@/components/ui/EmptyState";
import { ChartSkeleton, StatBoxSkeleton } from "@/app/book/admin/_components/Skeleton";
import { StatBox } from "@/app/book/admin/_components/StatBox";
import { RangeSelector } from "@/app/book/admin/_components/RangeSelector";

const DailyActiveUsersChart = dynamic(
  () =>
    import("@/app/book/admin/_components/charts/EngagementCharts").then(
      (module) => module.DailyActiveUsersChart,
    ),
  { ssr: false },
);

const ReadingMinutesChart = dynamic(
  () =>
    import("@/app/book/admin/_components/charts/EngagementCharts").then(
      (module) => module.ReadingMinutesChart,
    ),
  { ssr: false },
);

const QuizAttemptsChart = dynamic(
  () =>
    import("@/app/book/admin/_components/charts/EngagementCharts").then(
      (module) => module.QuizAttemptsChart,
    ),
  { ssr: false },
);

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

  const reload = useCallback(() => {
    setLoading(true);
    setError(null);
    adminGet<EngagementResponse>(`/metrics/engagement?range=${range}`)
      .then(setData)
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : "Failed to load engagement"),
      )
      .finally(() => setLoading(false));
  }, [range]);

  useEffect(() => {
    reload();
  }, [reload]);

  const daily = useMemo(() => data?.daily ?? [], [data]);
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
              <DailyActiveUsersChart data={daily} />
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
              <ReadingMinutesChart data={daily} />
            </div>
          )}
        </AdminCard>

        <AdminCard title="Quiz attempts vs passes" description="Pass rate trend">
          {loading && !data ? (
            <ChartSkeleton />
          ) : (
            <div className="h-56">
              <QuizAttemptsChart data={quizCombined} />
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
