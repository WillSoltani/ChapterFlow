"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, AlertCircle, Coins } from "lucide-react";
import { adminGet } from "@/app/book/admin/_components/admin-api";
import { AdminCard, PageHeader } from "@/app/book/admin/_components/AdminCard";
import { KPITile } from "@/app/book/admin/_components/KPITile";
import { ErrorAlert } from "@/app/book/admin/_components/ErrorAlert";
import { EmptyState } from "@/components/ui/EmptyState";
import { ChartSkeleton, KPITileSkeleton, StatBoxSkeleton } from "@/app/book/admin/_components/Skeleton";
import { StatBox } from "@/app/book/admin/_components/StatBox";
import { RangeSelector } from "@/app/book/admin/_components/RangeSelector";

const DailyFlowChart = dynamic(
  () =>
    import("@/app/book/admin/_components/charts/EconomyCharts").then(
      (module) => module.DailyFlowChart,
    ),
  { ssr: false },
);

const EarnedBySourceChart = dynamic(
  () =>
    import("@/app/book/admin/_components/charts/EconomyCharts").then(
      (module) => module.EarnedBySourceChart,
    ),
  { ssr: false },
);

const SpentByRewardChart = dynamic(
  () =>
    import("@/app/book/admin/_components/charts/EconomyCharts").then(
      (module) => module.SpentByRewardChart,
    ),
  { ssr: false },
);

type Metrics = {
  computedAt: string;
  averageBalance: number;
  medianBalance: number;
  spendRate: number;
  balanceGini: number;
  grossFaucet: number;
  grossSink: number;
  totalUsers: number;
  activeUsers: number;
};

type Alert = {
  metric: string;
  value: number;
  threshold: number;
  severity: "warning" | "alert";
  message: string;
};

type EconomyResponse = {
  generatedAt: string;
  range: number;
  metrics: Metrics;
  alerts: Alert[];
  warnings?: string[];
  dailyFlow: { date: string; earned: number; spent: number }[];
  earnedBySource: { source: string; amount: number }[];
  spentByReward: { rewardId: string; amount: number }[];
};

export function EconomyClient() {
  const [range, setRange] = useState(30);
  const [data, setData] = useState<EconomyResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(() => {
    setLoading(true);
    setError(null);
    adminGet<EconomyResponse>(`/metrics/economy?range=${range}`)
      .then(setData)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Failed to load"))
      .finally(() => setLoading(false));
  }, [range]);

  useEffect(() => {
    reload();
  }, [reload]);

  return (
    <div>
      <PageHeader
        title="Economy"
        description={
          data
            ? `Last ${data.range} days · ${data.metrics.totalUsers} users with balances`
            : "Insight Points health"
        }
        action={<RangeSelector value={range} onChange={setRange} />}
      />

      {error && <ErrorAlert error={error} onRetry={reload} />}

      {data?.warnings?.length ? (
        <div className="mb-4 space-y-2">
          {data.warnings.map((w, i) => (
            <div
              key={`w-${i}`}
              role="status"
              className="flex items-start gap-2 rounded-xl border border-(--cf-border) bg-(--cf-surface-muted) p-3 text-cf-label text-(--cf-text-2)"
            >
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-(--cf-text-soft)" />
              <span>{w}</span>
            </div>
          ))}
        </div>
      ) : null}

      {data?.alerts.length ? (
        <div className="mb-4 space-y-2">
          {data.alerts.map((a, i) => (
            <div
              key={i}
              role="alert"
              className={[
                "flex items-start gap-2 rounded-xl border p-3 text-cf-label",
                a.severity === "alert"
                  ? "border-(--cf-danger-border) bg-(--cf-danger-soft) text-(--cf-danger-text)"
                  : "border-(--cf-warning-border) bg-(--cf-warning-soft) text-(--cf-warning-text)",
              ].join(" ")}
            >
              {a.severity === "alert" ? (
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              ) : (
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              )}
              <span>{a.message}</span>
            </div>
          ))}
        </div>
      ) : null}

      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {loading && !data ? (
          Array.from({ length: 6 }).map((_, i) => <KPITileSkeleton key={i} />)
        ) : (
          <>
            <KPITile label="Avg balance" value={data?.metrics.averageBalance ?? 0} hint="IP" />
            <KPITile label="Median balance" value={data?.metrics.medianBalance ?? 0} hint="IP" />
            <KPITile
              label="Spend rate"
              value={data?.metrics.spendRate ?? 0}
              format="percent"
              hint="sink/faucet"
            />
            <KPITile
              label="Gini"
              value={data ? Math.round(data.metrics.balanceGini * 100) : 0}
              hint="0=equal, 100=unequal"
            />
            <KPITile label="Gross faucet" value={data?.metrics.grossFaucet ?? 0} hint="IP earned" />
            <KPITile label="Gross sink" value={data?.metrics.grossSink ?? 0} hint="IP spent" />
          </>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <AdminCard
          title="Daily IP flow"
          description="Earned vs spent"
          className="lg:col-span-2"
        >
          {loading && !data ? (
            <ChartSkeleton />
          ) : (
            <div className="h-56">
              <DailyFlowChart data={data?.dailyFlow ?? []} />
            </div>
          )}
        </AdminCard>

        <AdminCard title="Active users" description="Earned or spent in range">
          {loading && !data ? (
            <StatBoxSkeleton />
          ) : (
            <div className="space-y-3">
              <StatBox
                large
                label="Active"
                value={data?.metrics.activeUsers.toLocaleString() ?? "—"}
                hint={`of ${data?.metrics.totalUsers.toLocaleString() ?? "—"} total (${pct(data?.metrics.activeUsers, data?.metrics.totalUsers)})`}
              />
            </div>
          )}
        </AdminCard>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <AdminCard title="IP earned by source" description="Period total">
          {(data?.earnedBySource.length ?? 0) === 0 ? (
            <EmptyState
              icon={Coins}
              title="No earnings in range"
              description="Once users earn IP, the breakdown will appear here."
              compact
            />
          ) : (
            <div className="h-56">
              <EarnedBySourceChart data={data?.earnedBySource ?? []} />
            </div>
          )}
        </AdminCard>

        <AdminCard title="IP spent by reward" description="Period total">
          {(data?.spentByReward.length ?? 0) > 0 ? (
            <div className="h-56">
              <SpentByRewardChart data={data?.spentByReward ?? []} />
            </div>
          ) : (
            <EmptyState
              icon={Coins}
              title="No redemptions in range"
              description="Reward redemptions will show up here."
              compact
            />
          )}
        </AdminCard>
      </div>
    </div>
  );
}

function pct(part?: number, total?: number): string {
  if (!total) return "0%";
  return `${(((part ?? 0) / total) * 100).toFixed(0)}%`;
}
