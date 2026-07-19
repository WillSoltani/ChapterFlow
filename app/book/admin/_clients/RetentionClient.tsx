"use client";

import { useEffect, useState } from "react";
import { Repeat } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { adminGet } from "@/app/book/admin/_components/admin-api";
import { AdminCard, PageHeader } from "@/app/book/admin/_components/AdminCard";
import { ErrorAlert } from "@/app/book/admin/_components/ErrorAlert";
import { EmptyState } from "@/components/ui/EmptyState";
import { ChartSkeleton, KPITileSkeleton } from "@/app/book/admin/_components/Skeleton";
import { KPITile } from "@/app/book/admin/_components/KPITile";
import { DarkTooltip } from "@/app/book/admin/_components/DarkTooltip";

type Cohort = { cohort: string; size: number; weeks: number[] };

type RetentionResponse = {
  generatedAt: string;
  total: number;
  cohorts: Cohort[];
  frequency: { daily: number; weekly: number; monthly: number; dormant: number };
  dayN: Array<{ day: number; rate: number; sample: number }>;
  streakBuckets: Array<{ bucket: string; count: number }>;
  warnings?: string[];
};

export function RetentionClient() {
  const [data, setData] = useState<RetentionResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = () => {
    setLoading(true);
    setError(null);
    adminGet<RetentionResponse>("/metrics/retention")
      .then(setData)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Failed"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    reload();
  }, []);

  const d1 = data?.dayN.find((d) => d.day === 1)?.rate ?? 0;
  const d7 = data?.dayN.find((d) => d.day === 7)?.rate ?? 0;
  const d30 = data?.dayN.find((d) => d.day === 30)?.rate ?? 0;
  const total = data?.total ?? 0;

  return (
    <div>
      <PageHeader
        title="Retention"
        description={data ? `${total.toLocaleString()} users · weekly cohorts` : "Cohort retention & frequency"}
      />

      {error && <ErrorAlert error={error} onRetry={reload} />}
      {data?.warnings?.length ? (
        <div className="mb-4 rounded-xl border border-(--cf-border) bg-(--cf-surface-muted) p-3 text-cf-label text-(--cf-text-2)">
          {data.warnings.join(" · ")}
        </div>
      ) : null}

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {loading && !data ? (
          Array.from({ length: 4 }).map((_, i) => <KPITileSkeleton key={i} />)
        ) : (
          <>
            <KPITile label="D1 return" value={d1} format="percent" hint={sampleHint(data?.dayN.find((d) => d.day === 1)?.sample)} />
            <KPITile label="D7 return" value={d7} format="percent" hint={sampleHint(data?.dayN.find((d) => d.day === 7)?.sample)} />
            <KPITile label="D30 return" value={d30} format="percent" hint={sampleHint(data?.dayN.find((d) => d.day === 30)?.sample)} />
            <KPITile label="Active in 30d" value={(data?.frequency.daily ?? 0) + (data?.frequency.weekly ?? 0) + (data?.frequency.monthly ?? 0)} hint={`of ${total}`} />
          </>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <AdminCard
          title="Weekly cohort retention"
          description="% of cohort active in week N after signup"
          className="lg:col-span-2"
        >
          {loading && !data ? (
            <ChartSkeleton />
          ) : (data?.cohorts.length ?? 0) === 0 ? (
            <EmptyState icon={Repeat} title="Not enough data yet" description="Cohorts need a few weeks of users." compact />
          ) : (
            <CohortHeatmap cohorts={data?.cohorts ?? []} />
          )}
        </AdminCard>

        <AdminCard title="Reading frequency" description="Last 30 days">
          {loading && !data ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-8 animate-pulse rounded bg-(--cf-surface-muted)" />
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              <FreqRow label="Daily readers (16-30d)" value={data?.frequency.daily ?? 0} total={total} color="var(--cf-success-text)" />
              <FreqRow label="Weekly readers (3-15d)" value={data?.frequency.weekly ?? 0} total={total} color="var(--cf-accent)" />
              <FreqRow label="Monthly readers (1-2d)" value={data?.frequency.monthly ?? 0} total={total} color="var(--cf-amber-text, var(--cf-warning-text))" />
              <FreqRow label="Dormant (0d)" value={data?.frequency.dormant ?? 0} total={total} color="var(--cf-text-soft)" />
            </div>
          )}
        </AdminCard>
      </div>

      <div className="mt-6">
        <AdminCard title="Current streak distribution" description="Active consecutive days">
          {loading && !data ? (
            <ChartSkeleton />
          ) : (
            <div className="h-56">
              <ResponsiveContainer>
                <BarChart data={data?.streakBuckets ?? []} margin={{ top: 10, right: 10, bottom: 0, left: -10 }}>
                  <CartesianGrid stroke="var(--cf-border)" vertical={false} />
                  <XAxis dataKey="bucket" tick={{ fill: "var(--cf-text-3)", fontSize: 11 }} />
                  <YAxis tick={{ fill: "var(--cf-text-3)", fontSize: 11 }} width={32} />
                  <Tooltip content={<DarkTooltip />} />
                  <Bar dataKey="count" fill="var(--cf-accent)" radius={[4, 4, 0, 0]} isAnimationActive={false} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </AdminCard>
      </div>
    </div>
  );
}

function CohortHeatmap({ cohorts }: { cohorts: Cohort[] }) {
  const weeksToShow = cohorts[0]?.weeks.length ?? 0;
  return (
    <div className="overflow-x-auto">
      <table className="text-cf-caption">
        <thead>
          <tr className="text-(--cf-text-soft)">
            <th className="px-2 py-1 text-left">Cohort</th>
            <th className="px-2 py-1 text-right">Size</th>
            {Array.from({ length: weeksToShow }, (_, i) => (
              <th key={i} className="w-10 px-1 py-1 text-center">
                W{i}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {cohorts.map((c) => (
            <tr key={c.cohort} className="border-t border-(--cf-border)/40">
              <td className="px-2 py-1 font-mono text-(--cf-text-2)">{c.cohort}</td>
              <td className="px-2 py-1 text-right tabular-nums text-(--cf-text-3)">{c.size}</td>
              {c.weeks.map((pct, i) => (
                <td
                  key={i}
                  className="w-10 px-0.5 py-0.5 text-center"
                  title={`${c.cohort} W${i}: ${pct}%`}
                >
                  <div
                    className="rounded text-[10px] tabular-nums text-(--cf-text-1)"
                    style={{
                      padding: "2px 0",
                      backgroundColor:
                        pct === 0
                          ? "var(--cf-surface-muted)"
                          : `color-mix(in srgb, var(--cf-accent) ${Math.min(95, 12 + pct)}%, transparent)`,
                    }}
                  >
                    {pct > 0 ? `${pct}%` : ""}
                  </div>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function FreqRow({
  label,
  value,
  total,
  color,
}: {
  label: string;
  value: number;
  total: number;
  color: string;
}) {
  const pct = total > 0 ? (value / total) * 100 : 0;
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-cf-label-sm">
        <span className="font-medium text-(--cf-text-2)">{label}</span>
        <span className="tabular-nums text-(--cf-text-3)">
          {value.toLocaleString()} <span className="text-(--cf-text-soft)">({pct.toFixed(0)}%)</span>
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-(--cf-surface-muted)">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
    </div>
  );
}

function sampleHint(sample?: number): string | undefined {
  return sample !== undefined ? `n=${sample.toLocaleString()}` : undefined;
}
