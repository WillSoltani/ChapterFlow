"use client";

import { useEffect, useState } from "react";
import { Zap } from "lucide-react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { adminGet } from "@/app/book/admin/_components/admin-api";
import { AdminCard, PageHeader } from "@/app/book/admin/_components/AdminCard";
import { KPITile } from "@/app/book/admin/_components/KPITile";
import { ErrorAlert } from "@/app/book/admin/_components/ErrorAlert";
import { EmptyState } from "@/components/ui/EmptyState";
import { ChartSkeleton, KPITileSkeleton, TableSkeleton } from "@/app/book/admin/_components/Skeleton";
import { RangeSelector } from "@/app/book/admin/_components/RangeSelector";
import { DarkTooltip } from "@/app/book/admin/_components/DarkTooltip";

type Stat = { p50: number; p95: number; p99: number; count: number };

type PerfResponse = {
  generatedAt: string;
  range: number;
  stats: {
    ttfbMs: Stat;
    domContentLoadedMs: Stat;
    firstContentfulPaintMs: Stat;
    pageLoadMs: Stat;
    lcpMs: Stat;
    inpMs: Stat;
    clsScore: Stat;
  };
  routes: Array<{ path: string; samples: number; p50: number; p95: number }>;
  trend: Array<{ date: string; p50: number; p95: number; samples: number }>;
};

export function PerformanceClient() {
  const [range, setRange] = useState(7);
  const [data, setData] = useState<PerfResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = () => {
    setLoading(true);
    setError(null);
    adminGet<PerfResponse>(`/metrics/performance?range=${range}`)
      .then(setData)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Failed"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    reload();
  }, [range]);

  const totalSamples = data?.stats.pageLoadMs.count ?? 0;

  return (
    <div>
      <PageHeader
        title="Performance"
        description={
          data
            ? `Last ${data.range} days · ${totalSamples.toLocaleString()} samples`
            : "Web performance & Core Web Vitals"
        }
        action={<RangeSelector value={range} onChange={setRange} options={[1, 7, 30]} />}
      />

      {error && <ErrorAlert error={error} onRetry={reload} />}

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        {loading && !data ? (
          Array.from({ length: 6 }).map((_, i) => <KPITileSkeleton key={i} />)
        ) : (
          <>
            <KPITile label="TTFB p50" value={data?.stats.ttfbMs.p50 ?? 0} format="number" hint="ms" />
            <KPITile label="FCP p50" value={data?.stats.firstContentfulPaintMs.p50 ?? 0} hint="ms" />
            <KPITile label="LCP p50" value={data?.stats.lcpMs.p50 ?? 0} hint="ms · web-vitals" />
            <KPITile label="INP p50" value={data?.stats.inpMs.p50 ?? 0} hint="ms · interaction" />
            <KPITile label="CLS p50" value={data?.stats.clsScore.p50 ?? 0} hint="score" />
            <KPITile label="Page load p95" value={data?.stats.pageLoadMs.p95 ?? 0} hint="ms" />
          </>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4">
        <AdminCard title="Page load p50 / p95" description={`Last ${data?.range ?? "—"} days`}>
          {loading && !data ? (
            <ChartSkeleton />
          ) : data?.trend.every((d) => d.samples === 0) ? (
            <EmptyState
              icon={Zap}
              title="No performance samples yet"
              description="Beacon events will populate this once users browse the app."
              compact
            />
          ) : (
            <div className="h-64">
              <ResponsiveContainer>
                <LineChart data={data?.trend ?? []} margin={{ top: 10, right: 10, bottom: 0, left: 0 }}>
                  <CartesianGrid stroke="var(--cf-border)" vertical={false} />
                  <XAxis
                    dataKey="date"
                    tick={{ fill: "var(--cf-text-3)", fontSize: 11 }}
                    tickFormatter={fmtDate}
                  />
                  <YAxis tick={{ fill: "var(--cf-text-3)", fontSize: 11 }} width={48} allowDecimals={false} />
                  <Tooltip content={<DarkTooltip />} />
                  <Line
                    type="monotone"
                    dataKey="p50"
                    name="p50"
                    stroke="var(--cf-accent)"
                    strokeWidth={1.75}
                    isAnimationActive={false}
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="p95"
                    name="p95"
                    stroke="var(--cf-warning-text, var(--cf-accent))"
                    strokeWidth={1.5}
                    strokeDasharray="3 3"
                    isAnimationActive={false}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </AdminCard>
      </div>

      <div className="mt-6">
        <AdminCard title={`Slowest routes (${data?.routes.length ?? 0})`} description="By page load p95">
          {loading && !data ? (
            <TableSkeleton rows={6} cols={4} />
          ) : (data?.routes.length ?? 0) === 0 ? (
            <EmptyState icon={Zap} title="No route data" compact />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-[12px]">
                <thead>
                  <tr className="border-b border-(--cf-border) text-left text-[11px] uppercase tracking-[0.08em] text-(--cf-text-soft)">
                    <th className="py-2 pr-3">Route</th>
                    <th className="py-2 pr-3 text-right">Samples</th>
                    <th className="py-2 pr-3 text-right">p50</th>
                    <th className="py-2 pr-3 text-right">p95</th>
                  </tr>
                </thead>
                <tbody>
                  {[...(data?.routes ?? [])]
                    .sort((a, b) => b.p95 - a.p95)
                    .map((r) => (
                      <tr
                        key={r.path}
                        className="border-b border-(--cf-border)/50 transition hover:bg-(--cf-surface-muted)/40"
                      >
                        <td className="py-2 pr-3 font-mono text-[11px] text-(--cf-text-1)">{r.path}</td>
                        <td className="py-2 pr-3 text-right tabular-nums text-(--cf-text-3)">{r.samples}</td>
                        <td className="py-2 pr-3 text-right tabular-nums text-(--cf-text-2)">{r.p50}ms</td>
                        <td
                          className={[
                            "py-2 pr-3 text-right tabular-nums",
                            r.p95 > 3000
                              ? "text-(--cf-danger-text) font-medium"
                              : r.p95 > 1500
                              ? "text-(--cf-warning-text)"
                              : "text-(--cf-text-2)",
                          ].join(" ")}
                        >
                          {r.p95}ms
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}
        </AdminCard>
      </div>
    </div>
  );
}

function fmtDate(d: string): string {
  const date = new Date(d);
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
