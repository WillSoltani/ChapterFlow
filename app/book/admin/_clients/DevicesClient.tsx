"use client";

import { useEffect, useState } from "react";
import { Monitor } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
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
import { EmptyState } from "@/components/ui/EmptyState";
import { ChartSkeleton, KPITileSkeleton } from "@/app/book/admin/_components/Skeleton";
import { DarkTooltip } from "@/app/book/admin/_components/DarkTooltip";

type Row = { key: string; count: number };
type DevicesResponse = {
  generatedAt: string;
  total: number;
  mobilePct: number;
  buckets: { deviceType: Row[]; browser: Row[]; os: Row[] };
  warnings?: string[];
};

const DEVICE_COLORS: Record<string, string> = {
  mobile: "var(--cf-accent)",
  desktop: "var(--cf-success-text)",
  tablet: "var(--cf-amber-text, var(--cf-warning-text))",
  unknown: "var(--cf-text-soft)",
};

export function DevicesClient() {
  const [data, setData] = useState<DevicesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = () => {
    setLoading(true);
    setError(null);
    adminGet<DevicesResponse>("/metrics/devices")
      .then(setData)
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : "Failed to load devices"),
      )
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    reload();
  }, []);

  const deviceData = data?.buckets.deviceType.map((d) => ({ ...d, name: d.key })) ?? [];

  return (
    <div>
      <PageHeader
        title="Devices"
        description={
          data ? `${data.total.toLocaleString()} users analyzed` : "Device & environment intelligence"
        }
      />

      {error && <ErrorAlert error={error} onRetry={reload} />}
      {data?.warnings?.length ? (
        <div className="mb-4 rounded-xl border border-(--cf-border) bg-(--cf-surface-muted) p-3 text-cf-label text-(--cf-text-2)">
          {data.warnings.join(" · ")}
        </div>
      ) : null}

      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {loading && !data ? (
          Array.from({ length: 4 }).map((_, i) => <KPITileSkeleton key={i} />)
        ) : (
          <>
            <KPITile label="Total tracked" value={data?.total ?? 0} />
            <KPITile label="Mobile" value={data?.mobilePct ?? 0} format="percent" hint="of known devices" />
            <KPITile label="Browsers" value={data?.buckets.browser.length ?? 0} hint="distinct" />
            <KPITile label="Platforms" value={data?.buckets.os.length ?? 0} hint="distinct OSes" />
          </>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <AdminCard title="Device type" description="Mobile · Desktop · Tablet" className="lg:col-span-1">
          {loading && !data ? (
            <ChartSkeleton height="h-64" />
          ) : deviceData.length === 0 ? (
            <EmptyState icon={Monitor} title="No device data yet" compact />
          ) : (
            <div className="h-64">
              <ResponsiveContainer>
                <PieChart>
                  <Pie
                    data={deviceData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={90}
                    paddingAngle={2}
                    dataKey="count"
                    isAnimationActive={false}
                  >
                    {deviceData.map((entry) => (
                      <Cell
                        key={entry.key}
                        fill={DEVICE_COLORS[entry.key] ?? "var(--cf-text-soft)"}
                        stroke="var(--cf-surface)"
                      />
                    ))}
                  </Pie>
                  <Tooltip content={<DarkTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
          <ul className="mt-2 space-y-1 text-cf-label-sm">
            {deviceData.map((d) => (
              <li key={d.key} className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-(--cf-text-2)">
                  <span
                    className="h-2 w-2 rounded-sm"
                    style={{ backgroundColor: DEVICE_COLORS[d.key] ?? "var(--cf-text-soft)" }}
                  />
                  {d.key}
                </span>
                <span className="tabular-nums text-(--cf-text-3)">{d.count.toLocaleString()}</span>
              </li>
            ))}
          </ul>
        </AdminCard>

        <AdminCard title="Browsers" description="Top 12" className="lg:col-span-1">
          <BarList rows={data?.buckets.browser ?? []} loading={loading && !data} color="var(--cf-accent)" />
        </AdminCard>

        <AdminCard title="Operating systems" description="Top 8" className="lg:col-span-1">
          <BarList rows={data?.buckets.os ?? []} loading={loading && !data} color="var(--cf-success-text)" />
        </AdminCard>
      </div>
    </div>
  );
}

function BarList({
  rows,
  loading,
  color,
}: {
  rows: Row[];
  loading: boolean;
  color: string;
}) {
  if (loading) return <ChartSkeleton height="h-56" />;
  if (rows.length === 0) {
    return <EmptyState icon={Monitor} title="No data yet" compact />;
  }
  return (
    <div className="h-56">
      <ResponsiveContainer>
        <BarChart data={rows} layout="vertical" margin={{ top: 4, right: 8, bottom: 0, left: 80 }}>
          <CartesianGrid stroke="var(--cf-border)" horizontal={false} />
          <XAxis type="number" tick={{ fill: "var(--cf-text-3)", fontSize: 11 }} />
          <YAxis
            dataKey="key"
            type="category"
            tick={{ fill: "var(--cf-text-3)", fontSize: 11 }}
            width={120}
          />
          <Tooltip content={<DarkTooltip />} />
          <Bar dataKey="count" fill={color} radius={[0, 4, 4, 0]} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
