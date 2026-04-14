"use client";

import { useEffect, useState } from "react";
import { RefreshCw, BarChart3 } from "lucide-react";
import { adminGet } from "@/app/book/admin/_components/admin-api";
import { AdminCard, PageHeader } from "@/app/book/admin/_components/AdminCard";
import { KPITile, type Spark } from "@/app/book/admin/_components/KPITile";
import { ErrorAlert } from "@/app/book/admin/_components/ErrorAlert";
import { EmptyState } from "@/app/book/admin/_components/EmptyState";
import { KPITileSkeleton } from "@/app/book/admin/_components/Skeleton";
import { StatBox } from "@/app/book/admin/_components/StatBox";

type KPI = { value: number; prior?: number };

type OverviewResponse = {
  generatedAt: string;
  kpis: {
    dau: KPI;
    newSignups: KPI;
    quizAttempts: KPI;
    quizPasses: KPI;
    readingMinutes: KPI;
    pendingScenarios: KPI;
    proTotal: KPI;
    freeTotal: KPI;
    proActive30d: KPI;
    proActive7d: KPI;
  };
  sparks: {
    dau: Spark;
    signups: Spark;
    reading: Spark;
    quizPasses: Spark;
  };
};

function pctDelta(value: number, prior?: number): number | undefined {
  if (prior === undefined || prior === 0) return undefined;
  return ((value - prior) / prior) * 100;
}

export function OverviewClient() {
  const [data, setData] = useState<OverviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = () => {
    setLoading(true);
    setError(null);
    adminGet<OverviewResponse>("/metrics/overview")
      .then((d) => setData(d))
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : "Failed to load metrics"),
      )
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    reload();
  }, []);

  const k = data?.kpis;
  const s = data?.sparks;
  const totalUsers = (k?.freeTotal.value ?? 0) + (k?.proTotal.value ?? 0);

  return (
    <div>
      <PageHeader
        title="Overview"
        description={
          data
            ? `Snapshot generated ${formatRelative(data.generatedAt)}`
            : "Today at a glance"
        }
        action={
          <button
            type="button"
            onClick={reload}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-lg border border-(--cf-border) bg-(--cf-surface) px-3 py-1.5 text-[12px] font-medium text-(--cf-text-2) shadow-(--cf-input-inset-shadow) transition hover:bg-(--cf-surface-muted) hover:text-(--cf-text-1) disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshCw className={`h-3.5 w-3.5 transition ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        }
      />

      {error && <ErrorAlert error={error} onRetry={reload} />}

      {/* Top KPI grid */}
      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {loading && !data ? (
          Array.from({ length: 6 }).map((_, i) => <KPITileSkeleton key={i} />)
        ) : (
          <>
            <KPITile
              label="DAU"
              value={k?.dau.value ?? 0}
              delta={k && pctDelta(k.dau.value, k.dau.prior)}
              spark={s?.dau}
              hint="vs yesterday"
            />
            <KPITile
              label="New signups"
              value={k?.newSignups.value ?? 0}
              delta={k && pctDelta(k.newSignups.value, k.newSignups.prior)}
              spark={s?.signups}
              hint="today"
            />
            <KPITile
              label="Reading"
              value={k?.readingMinutes.value ?? 0}
              format="minutes"
              delta={k && pctDelta(k.readingMinutes.value, k.readingMinutes.prior)}
              spark={s?.reading}
              hint="today"
            />
            <KPITile
              label="Quiz passes"
              value={k?.quizPasses.value ?? 0}
              spark={s?.quizPasses}
              hint="today"
            />
            <KPITile
              label="Pending scenarios"
              value={k?.pendingScenarios.value ?? 0}
              hint="awaiting review"
            />
            <KPITile
              label="PRO active (7d)"
              value={k?.proActive7d.value ?? 0}
              hint={`of ${k?.proTotal.value ?? 0} total PRO`}
            />
          </>
        )}
      </div>

      {/* Secondary cards */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <AdminCard title="User base" description="Plan distribution and recent activity">
          {loading && !data ? (
            <div className="space-y-3">
              <div className="h-2 animate-pulse rounded-full bg-(--cf-surface-muted)" />
              <div className="h-2 animate-pulse rounded-full bg-(--cf-surface-muted)" />
            </div>
          ) : totalUsers === 0 ? (
            <EmptyState
              icon={BarChart3}
              title="No users yet"
              description="Once people sign up, you'll see plan splits here."
              compact
            />
          ) : (
            <div className="space-y-3">
              <Bar
                label="FREE"
                value={k?.freeTotal.value ?? 0}
                total={totalUsers}
                color="var(--cf-text-soft)"
              />
              <Bar
                label="PRO"
                value={k?.proTotal.value ?? 0}
                total={totalUsers}
                color="var(--cf-accent)"
              />
              <div className="grid grid-cols-2 gap-3 pt-2">
                <StatBox label="PRO active 30d" value={k?.proActive30d.value ?? 0} />
                <StatBox label="PRO active 7d" value={k?.proActive7d.value ?? 0} />
              </div>
            </div>
          )}
        </AdminCard>

        <AdminCard title="Today's funnel" description="Engagement events captured today">
          {loading && !data ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className="h-9 animate-pulse rounded-lg bg-(--cf-surface-muted)"
                />
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              <FunnelStep label="DAU" value={k?.dau.value ?? 0} />
              <FunnelStep label="Quiz attempts" value={k?.quizAttempts.value ?? 0} />
              <FunnelStep label="Quiz passes" value={k?.quizPasses.value ?? 0} />
              <FunnelStep label="New signups" value={k?.newSignups.value ?? 0} />
            </div>
          )}
        </AdminCard>
      </div>
    </div>
  );
}

function Bar({
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
      <div className="mb-1 flex items-center justify-between text-[12px]">
        <span className="font-medium text-(--cf-text-2)">{label}</span>
        <span className="tabular-nums text-(--cf-text-3)">
          {value.toLocaleString()}{" "}
          <span className="text-(--cf-text-soft)">({pct.toFixed(1)}%)</span>
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-(--cf-surface-muted)">
        <div
          className="h-full rounded-full transition-all duration-500 ease-out"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}

function FunnelStep({ label, value }: { label: string; value: number }) {
  return (
    <div className="cf-panel-muted flex items-center justify-between rounded-lg px-3 py-2.5">
      <span className="text-[13px] text-(--cf-text-2)">{label}</span>
      <span className="tabular-nums text-[15px] font-semibold text-(--cf-text-1)">
        {value.toLocaleString()}
      </span>
    </div>
  );
}

function formatRelative(iso: string): string {
  const date = new Date(iso);
  const diffMs = Date.now() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return "just now";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH}h ago`;
  return date.toLocaleString();
}
