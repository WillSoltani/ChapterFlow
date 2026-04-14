"use client";

import { useEffect, useMemo, useState } from "react";
import { Wallet } from "lucide-react";
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
import { adminGet } from "@/app/book/admin/_components/admin-api";
import { AdminCard, PageHeader } from "@/app/book/admin/_components/AdminCard";
import { KPITile } from "@/app/book/admin/_components/KPITile";
import { ErrorAlert } from "@/app/book/admin/_components/ErrorAlert";
import { EmptyState } from "@/app/book/admin/_components/EmptyState";
import { ChartSkeleton, KPITileSkeleton, TableSkeleton } from "@/app/book/admin/_components/Skeleton";
import { RangeSelector } from "@/app/book/admin/_components/RangeSelector";
import { DarkTooltip } from "@/app/book/admin/_components/DarkTooltip";

type RevenueResponse = {
  generatedAt: string;
  range: number;
  mrr: { value: number; currency: string; priceAssumption: number };
  arr: { value: number; currency: string };
  proTotal: number;
  freeTotal: number;
  proActive7d: number;
  proActive30d: number;
  newPros: number;
  churnedPros: number;
  proSourceBreakdown: Record<string, number>;
  subscriptionEvents: { date: string; value: number }[];
  licenseRedemptions: { date: string; value: number }[];
  recentProList: Array<{
    userId: string;
    email: string | null;
    proStatus: string | null;
    proSource: string | null;
    subscriptionStartedAt: string | null;
    currentPeriodEnd: string | null;
    lastActiveAt: string | null;
  }>;
};

const SOURCE_COLORS: Record<string, string> = {
  stripe: "var(--cf-accent)",
  license: "var(--cf-success-text)",
  flow_points: "var(--cf-warm-text, var(--cf-accent))",
  unknown: "var(--cf-text-soft)",
};

export function RevenueClient() {
  const [range, setRange] = useState(30);
  const [data, setData] = useState<RevenueResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = () => {
    setLoading(true);
    setError(null);
    adminGet<RevenueResponse>(`/metrics/revenue?range=${range}`)
      .then(setData)
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : "Failed to load revenue"),
      )
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    reload();
  }, [range]);

  const sourceData = useMemo(() => {
    if (!data) return [];
    return Object.entries(data.proSourceBreakdown).map(([name, value]) => ({ name, value }));
  }, [data]);

  return (
    <div>
      <PageHeader
        title="Revenue"
        description={
          data
            ? `Last ${data.range} days · MRR estimate at $${data.mrr.priceAssumption}/mo`
            : "Subscription health"
        }
        action={<RangeSelector value={range} onChange={setRange} />}
      />

      {error && <ErrorAlert error={error} onRetry={reload} />}

      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {loading && !data ? (
          Array.from({ length: 6 }).map((_, i) => <KPITileSkeleton key={i} />)
        ) : (
          <>
            <KPITile
              label="MRR (est.)"
              value={data ? Math.round(data.mrr.value) : 0}
              format="currency"
              hint="based on PRO total"
            />
            <KPITile
              label="ARR (est.)"
              value={data ? Math.round(data.arr.value) : 0}
              format="currency"
            />
            <KPITile label="PRO total" value={data?.proTotal ?? 0} hint="all-time" />
            <KPITile label="PRO active 7d" value={data?.proActive7d ?? 0} />
            <KPITile label="New PROs" value={data?.newPros ?? 0} hint="in range" />
            <KPITile label="Churned" value={data?.churnedPros ?? 0} hint="in range" />
          </>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <AdminCard
          title="Subscription events"
          description="Plan changes per day"
          className="lg:col-span-2"
        >
          {loading && !data ? (
            <ChartSkeleton />
          ) : (
            <div className="h-56">
              <ResponsiveContainer>
                <BarChart
                  data={data?.subscriptionEvents ?? []}
                  margin={{ top: 10, right: 10, bottom: 0, left: -10 }}
                >
                  <CartesianGrid stroke="var(--cf-border)" vertical={false} />
                  <XAxis
                    dataKey="date"
                    tick={{ fill: "var(--cf-text-3)", fontSize: 11 }}
                    tickFormatter={fmtDate}
                  />
                  <YAxis tick={{ fill: "var(--cf-text-3)", fontSize: 11 }} width={32} />
                  <Tooltip content={<DarkTooltip />} />
                  <Bar
                    dataKey="value"
                    fill="var(--cf-accent)"
                    isAnimationActive={false}
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </AdminCard>

        <AdminCard title="PRO source mix" description="New PROs by acquisition channel">
          {sourceData.length > 0 ? (
            <div className="h-48">
              <ResponsiveContainer>
                <PieChart>
                  <Pie
                    data={sourceData}
                    cx="50%"
                    cy="50%"
                    innerRadius={36}
                    outerRadius={72}
                    paddingAngle={2}
                    dataKey="value"
                    isAnimationActive={false}
                  >
                    {sourceData.map((entry) => (
                      <Cell
                        key={entry.name}
                        fill={SOURCE_COLORS[entry.name] ?? "var(--cf-text-soft)"}
                        stroke="var(--cf-surface)"
                      />
                    ))}
                  </Pie>
                  <Tooltip content={<DarkTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 11, color: "var(--cf-text-3)" }} iconSize={8} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <EmptyState
              icon={Wallet}
              title="No new PROs in range"
              description="Adjust the range or wait for new subscribers."
              compact
            />
          )}
        </AdminCard>
      </div>

      <div className="mt-6">
        <AdminCard title="License redemptions" description="Daily attempts">
          {loading && !data ? (
            <ChartSkeleton height="h-48" />
          ) : (
            <div className="h-48">
              <ResponsiveContainer>
                <BarChart
                  data={data?.licenseRedemptions ?? []}
                  margin={{ top: 10, right: 10, bottom: 0, left: -10 }}
                >
                  <CartesianGrid stroke="var(--cf-border)" vertical={false} />
                  <XAxis
                    dataKey="date"
                    tick={{ fill: "var(--cf-text-3)", fontSize: 11 }}
                    tickFormatter={fmtDate}
                  />
                  <YAxis tick={{ fill: "var(--cf-text-3)", fontSize: 11 }} width={32} />
                  <Tooltip content={<DarkTooltip />} />
                  <Bar
                    dataKey="value"
                    fill="var(--cf-amber-text, var(--cf-accent))"
                    isAnimationActive={false}
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </AdminCard>
      </div>

      <div className="mt-6">
        <AdminCard
          title={`Recent PRO subscribers${data ? ` (${data.recentProList.length})` : ""}`}
        >
          {loading && !data ? (
            <TableSkeleton rows={6} cols={6} />
          ) : (data?.recentProList.length ?? 0) === 0 ? (
            <EmptyState
              icon={Wallet}
              title="No PRO subscribers yet"
              description="Once people upgrade, they'll appear here."
              compact
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-[12px]">
                <thead>
                  <tr className="border-b border-(--cf-border) text-left text-[11px] uppercase tracking-[0.08em] text-(--cf-text-soft)">
                    <th className="py-2 pr-3">Email / User</th>
                    <th className="py-2 pr-3">Status</th>
                    <th className="py-2 pr-3">Source</th>
                    <th className="py-2 pr-3">Started</th>
                    <th className="py-2 pr-3">Renews</th>
                    <th className="py-2 pr-3">Last active</th>
                  </tr>
                </thead>
                <tbody>
                  {data?.recentProList.map((u) => (
                    <tr
                      key={u.userId}
                      className="border-b border-(--cf-border)/50 transition hover:bg-(--cf-surface-muted)/40"
                    >
                      <td className="py-2 pr-3 text-(--cf-text-1)" title={u.userId}>
                        {u.email ?? (
                          <span className="font-mono text-[11px] text-(--cf-text-3)">
                            {u.userId.slice(0, 12)}…
                          </span>
                        )}
                      </td>
                      <td className="py-2 pr-3 text-(--cf-text-2)">{u.proStatus ?? "—"}</td>
                      <td className="py-2 pr-3 text-(--cf-text-2)">{u.proSource ?? "—"}</td>
                      <td className="py-2 pr-3 text-(--cf-text-3)">{fmtFull(u.subscriptionStartedAt)}</td>
                      <td className="py-2 pr-3 text-(--cf-text-3)">{fmtFull(u.currentPeriodEnd)}</td>
                      <td className="py-2 pr-3 text-(--cf-text-3)">{fmtRel(u.lastActiveAt)}</td>
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

function fmtFull(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString();
}

function fmtRel(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const diffMin = Math.floor((Date.now() - d.getTime()) / 60000);
  if (diffMin < 60) return `${diffMin}m`;
  if (diffMin < 1440) return `${Math.floor(diffMin / 60)}h`;
  return `${Math.floor(diffMin / 1440)}d`;
}
