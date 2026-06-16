"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, AlertCircle, AlertTriangle, Loader2, Gauge, Database, Zap, DollarSign, RefreshCw, ShieldCheck } from "lucide-react";
import { adminGet, adminPost } from "@/app/book/admin/_components/admin-api";
import { AdminCard, PageHeader } from "@/app/book/admin/_components/AdminCard";
import { KPITile } from "@/app/book/admin/_components/KPITile";
import { ErrorAlert } from "@/app/book/admin/_components/ErrorAlert";
import { EmptyState } from "@/components/ui/EmptyState";
import { KPITileSkeleton, TableSkeleton } from "@/app/book/admin/_components/Skeleton";
import { StatBox } from "@/app/book/admin/_components/StatBox";

type IngestionJob = {
  jobId: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  bookId: string | null;
  errorReportKey: string | null;
};

type LambdaHealth = {
  functionName: string;
  invocations: number;
  errors: number;
  throttles: number;
  durationP50Ms: number;
  durationP95Ms: number;
  durationP99Ms: number;
  coldStarts: number;
};

type DdbHealth = {
  tableName: string;
  itemCount: number;
  tableSizeBytes: number;
  throttlesLast24h: number;
};

type CostEstimate = {
  dynamoDBMonthlyUsd: number;
  lambdaMonthlyUsd: number;
  s3MonthlyUsd: number;
  totalMonthlyUsd: number;
};

type OpsFailure = {
  ref: string;
  id: string;
  kind: string;
  context: string;
  userId: string;
  subscriptionId?: string;
  errorCode?: string;
  errorMessage?: string;
  createdAt: string;
  resolvedAt?: string;
};

type OpsResponse = {
  generatedAt: string;
  eventsToday: number;
  eventsYesterday: number;
  ingestionJobs: IngestionJob[];
  accountChanges: { deactivated: number; deleted: number; reactivated: number };
  beaconErrors: { date: string; value: number }[];
  lambdaHealth: LambdaHealth[];
  ddbHealth: DdbHealth[];
  costEstimate: CostEstimate;
  opsFailures?: OpsFailure[];
  warnings?: string[];
};

export function OpsClient() {
  const [data, setData] = useState<OpsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [actioningRef, setActioningRef] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const reload = () => {
    setLoading(true);
    setError(null);
    adminGet<OpsResponse>("/metrics/ops")
      .then(setData)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Failed"))
      .finally(() => setLoading(false));
  };

  const runFailureAction = async (ref: string, action: "retry" | "resolve") => {
    setActioningRef(ref);
    setActionError(null);
    try {
      await adminPost("/ops-failures", { ref, action });
      reload();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Action failed");
    } finally {
      setActioningRef(null);
    }
  };

  useEffect(() => {
    reload();
  }, []);

  return (
    <div>
      <PageHeader
        title="Ops & health"
        description="System status, Lambda metrics, DynamoDB health, and cost projections"
      />

      {error && <ErrorAlert error={error} onRetry={reload} />}

      {data?.warnings?.length ? (
        <div className="mb-4 space-y-2">
          {data.warnings.map((w, i) => (
            <div
              key={i}
              role="status"
              className="flex items-start gap-2 rounded-xl border border-(--cf-border) bg-(--cf-surface-muted) p-3 text-[13px] text-(--cf-text-2)"
            >
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-(--cf-text-soft)" />
              <span>{w}</span>
            </div>
          ))}
        </div>
      ) : null}

      {data?.opsFailures?.length ? (
        <div className="mb-6">
          <AdminCard
            title={`Operational failures (${data.opsFailures.length})`}
            description="Unresolved failures needing follow-up — e.g. Stripe cancellations that failed during account delete/deactivate"
          >
            {actionError && (
              <div className="mb-3 rounded-lg border border-(--cf-danger-border) bg-(--cf-danger-soft) p-2 text-[12px] text-(--cf-danger-text)">
                {actionError}
              </div>
            )}
            <div className="space-y-2">
              {data.opsFailures.map((f) => (
                <div key={f.ref} className="cf-panel-muted rounded-xl p-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="rounded-md border border-(--cf-danger-border) bg-(--cf-danger-soft) px-1.5 py-0.5 text-[11px] font-medium text-(--cf-danger-text)">
                          {f.kind}
                        </span>
                        <span className="text-[11px] uppercase tracking-[0.08em] text-(--cf-text-soft)">
                          {f.context}
                        </span>
                        <span className="text-[11px] text-(--cf-text-3)">{fmt(f.createdAt)}</span>
                      </div>
                      <p className="mt-1 font-mono text-[11px] text-(--cf-text-2)" title={f.userId}>
                        user {f.userId.slice(0, 12)}…
                        {f.subscriptionId ? ` · sub ${f.subscriptionId}` : ""}
                      </p>
                      {(f.errorCode || f.errorMessage) && (
                        <p className="mt-1 text-[12px] text-(--cf-danger-text)">
                          {f.errorCode ? `[${f.errorCode}] ` : ""}
                          {f.errorMessage}
                        </p>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <button
                        type="button"
                        disabled={actioningRef === f.ref || !f.subscriptionId}
                        onClick={() => runFailureAction(f.ref, "retry")}
                        className="inline-flex items-center gap-1 rounded-lg border border-(--cf-border) bg-(--cf-surface) px-2.5 py-1 text-[12px] font-medium text-(--cf-text-1) transition hover:bg-(--cf-surface-muted) disabled:opacity-50"
                        title={f.subscriptionId ? "Re-attempt the Stripe cancellation" : "No subscription id to retry"}
                      >
                        {actioningRef === f.ref ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <RefreshCw className="h-3.5 w-3.5" />
                        )}
                        Retry
                      </button>
                      <button
                        type="button"
                        disabled={actioningRef === f.ref}
                        onClick={() => runFailureAction(f.ref, "resolve")}
                        className="inline-flex items-center gap-1 rounded-lg border border-(--cf-border) bg-(--cf-surface) px-2.5 py-1 text-[12px] font-medium text-(--cf-text-2) transition hover:bg-(--cf-surface-muted) disabled:opacity-50"
                        title="Mark as handled without retrying"
                      >
                        <ShieldCheck className="h-3.5 w-3.5" />
                        Resolve
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </AdminCard>
        </div>
      ) : null}

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {loading && !data ? (
          Array.from({ length: 4 }).map((_, i) => <KPITileSkeleton key={i} />)
        ) : (
          <>
            <KPITile
              label="Events today"
              value={data?.eventsToday ?? 0}
              delta={
                data && data.eventsYesterday > 0
                  ? ((data.eventsToday - data.eventsYesterday) / data.eventsYesterday) * 100
                  : undefined
              }
              hint="vs yesterday"
            />
            <KPITile label="Ingestion jobs" value={data?.ingestionJobs.length ?? 0} hint="recent" />
            <KPITile
              label="Cancellations"
              value={data?.accountChanges.deactivated ?? 0}
              hint="last 7d"
            />
            <KPITile
              label="Beacon events"
              value={data?.beaconErrors.reduce((s, d) => s + d.value, 0) ?? 0}
              hint="last 7d"
            />
          </>
        )}
      </div>

      {/* Lambda health cards */}
      <div className="mb-6">
        <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-(--cf-text-soft)">
          Lambda functions (last 24h)
        </h2>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
          {loading && !data ? (
            Array.from({ length: 4 }).map((_, i) => <KPITileSkeleton key={i} />)
          ) : (
            data?.lambdaHealth.map((fn) => <LambdaCard key={fn.functionName} fn={fn} />)
          )}
        </div>
      </div>

      {/* DDB health + cost */}
      <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <AdminCard title="DynamoDB tables" description="Item count, size, throttles" className="lg:col-span-2">
          {loading && !data ? (
            <div className="space-y-2">
              <div className="h-10 animate-pulse rounded-lg bg-(--cf-surface-muted)" />
              <div className="h-10 animate-pulse rounded-lg bg-(--cf-surface-muted)" />
            </div>
          ) : (data?.ddbHealth.length ?? 0) === 0 ? (
            <EmptyState icon={Database} title="No table data" compact />
          ) : (
            <div className="space-y-2">
              {data?.ddbHealth.map((t) => (
                <div
                  key={t.tableName}
                  className="cf-panel-muted rounded-xl p-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[12px] text-(--cf-text-1)">{t.tableName}</span>
                    {t.throttlesLast24h > 0 && (
                      <span className="rounded-md border border-(--cf-danger-border) bg-(--cf-danger-soft) px-1.5 py-0.5 text-[11px] text-(--cf-danger-text)">
                        {t.throttlesLast24h} throttles
                      </span>
                    )}
                  </div>
                  <div className="mt-2 grid grid-cols-3 gap-2 text-[12px]">
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.08em] text-(--cf-text-soft)">Items</p>
                      <p className="mt-0.5 tabular-nums font-semibold text-(--cf-text-1)">
                        {t.itemCount.toLocaleString()}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.08em] text-(--cf-text-soft)">Size</p>
                      <p className="mt-0.5 tabular-nums font-semibold text-(--cf-text-1)">
                        {fmtBytes(t.tableSizeBytes)}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.08em] text-(--cf-text-soft)">Throttles 24h</p>
                      <p className="mt-0.5 tabular-nums font-semibold text-(--cf-text-1)">
                        {t.throttlesLast24h}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </AdminCard>

        <AdminCard title="Cost projection" description="Monthly estimate at current rates">
          {loading && !data ? (
            <div className="space-y-2">
              <div className="h-12 animate-pulse rounded-lg bg-(--cf-surface-muted)" />
              <div className="h-8 animate-pulse rounded-lg bg-(--cf-surface-muted)" />
            </div>
          ) : (
            <div className="space-y-2">
              <StatBox
                large
                label="Est. monthly total"
                value={`$${data?.costEstimate.totalMonthlyUsd.toFixed(2) ?? "0.00"}`}
                hint="USD at on-demand rates"
              />
              <div className="mt-2 space-y-1.5 text-[12px]">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-(--cf-text-3)">
                    <Database className="h-3 w-3" /> DynamoDB
                  </span>
                  <span className="tabular-nums text-(--cf-text-2)">
                    ${data?.costEstimate.dynamoDBMonthlyUsd.toFixed(2) ?? "0.00"}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-(--cf-text-3)">
                    <Zap className="h-3 w-3" /> Lambda
                  </span>
                  <span className="tabular-nums text-(--cf-text-2)">
                    ${data?.costEstimate.lambdaMonthlyUsd.toFixed(2) ?? "0.00"}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-(--cf-text-3)">
                    <DollarSign className="h-3 w-3" /> S3
                  </span>
                  <span className="tabular-nums text-(--cf-text-2)">
                    ${data?.costEstimate.s3MonthlyUsd.toFixed(2) ?? "0.00"}
                  </span>
                </div>
              </div>
              <p className="mt-2 text-[10px] text-(--cf-text-soft) leading-snug">
                Rough estimate based on last-24h usage × 30 days. Doesn&apos;t include CloudFront, SES, Cognito.
              </p>
            </div>
          )}
        </AdminCard>
      </div>

      <AdminCard
        title={`Recent ingestion jobs${data ? ` (${data.ingestionJobs.length})` : ""}`}
        description="Book package uploads"
      >
        {loading && !data ? (
          <TableSkeleton rows={6} cols={6} />
        ) : (data?.ingestionJobs.length ?? 0) === 0 ? (
          <EmptyState
            icon={Gauge}
            title="No ingestion jobs"
            description="When you upload book packages, jobs will track here."
            compact
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="border-b border-(--cf-border) text-left text-[11px] uppercase tracking-[0.08em] text-(--cf-text-soft)">
                  <th className="py-2 pr-3">Job</th>
                  <th className="py-2 pr-3">Book</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2 pr-3">Created</th>
                  <th className="py-2 pr-3">Updated</th>
                  <th className="py-2 pr-3">Error</th>
                </tr>
              </thead>
              <tbody>
                {data?.ingestionJobs.map((j) => (
                  <tr
                    key={j.jobId}
                    className="border-b border-(--cf-border)/50 transition hover:bg-(--cf-surface-muted)/40"
                  >
                    <td
                      className="py-2 pr-3 font-mono text-[11px] text-(--cf-text-2)"
                      title={j.jobId}
                    >
                      {j.jobId.slice(0, 12)}…
                    </td>
                    <td className="py-2 pr-3 text-(--cf-text-2)">{j.bookId ?? "—"}</td>
                    <td className="py-2 pr-3">
                      <StatusBadge status={j.status} />
                    </td>
                    <td className="py-2 pr-3 text-(--cf-text-3)">{fmt(j.createdAt)}</td>
                    <td className="py-2 pr-3 text-(--cf-text-3)">{fmt(j.updatedAt)}</td>
                    <td className="py-2 pr-3 text-(--cf-text-3)">
                      {j.errorReportKey ? (
                        <span
                          className="font-mono text-[11px] text-(--cf-danger-text)"
                          title={j.errorReportKey}
                        >
                          error
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </AdminCard>
    </div>
  );
}

function LambdaCard({ fn }: { fn: LambdaHealth }) {
  const errorRate =
    fn.invocations > 0 ? (fn.errors / fn.invocations) * 100 : 0;
  const hasErrors = fn.errors > 0;
  return (
    <div className="cf-panel rounded-2xl p-4">
      <div className="flex items-start justify-between gap-2">
        <p className="truncate text-[11px] font-semibold uppercase tracking-[0.08em] text-(--cf-text-soft)">
          {fn.functionName}
        </p>
        {hasErrors && (
          <span className="rounded-md border border-(--cf-danger-border) bg-(--cf-danger-soft) px-1.5 py-0.5 text-[10px] font-medium text-(--cf-danger-text)">
            {errorRate.toFixed(1)}% err
          </span>
        )}
      </div>
      <p className="mt-2 text-2xl font-semibold tabular-nums text-(--cf-text-1)">
        {fn.invocations.toLocaleString()}
      </p>
      <p className="text-[11px] text-(--cf-text-3)">invocations / 24h</p>
      <div className="mt-2 grid grid-cols-2 gap-1 text-[11px]">
        <div>
          <span className="text-(--cf-text-soft)">p50 </span>
          <span className="tabular-nums text-(--cf-text-2)">{fn.durationP50Ms}ms</span>
        </div>
        <div>
          <span className="text-(--cf-text-soft)">p95 </span>
          <span className="tabular-nums text-(--cf-text-2)">{fn.durationP95Ms}ms</span>
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const lower = status.toLowerCase();
  const ok = lower === "completed" || lower === "succeeded" || lower === "published";
  const fail = lower === "failed" || lower === "error";
  const inProgress = lower === "running" || lower === "processing" || lower === "ingesting";

  return (
    <span
      className={[
        "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium",
        ok
          ? "border border-(--cf-success-border) bg-(--cf-success-soft) text-(--cf-success-text)"
          : fail
          ? "border border-(--cf-danger-border) bg-(--cf-danger-soft) text-(--cf-danger-text)"
          : inProgress
          ? "border border-(--cf-warning-border) bg-(--cf-warning-soft) text-(--cf-warning-text)"
          : "border border-(--cf-border) bg-(--cf-surface-muted) text-(--cf-text-soft)",
      ].join(" ")}
    >
      {ok ? (
        <CheckCircle2 className="h-3 w-3" />
      ) : fail ? (
        <AlertCircle className="h-3 w-3" />
      ) : inProgress ? (
        <Loader2 className="h-3 w-3 animate-spin" />
      ) : null}
      {status}
    </span>
  );
}

function fmt(iso: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function fmtBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}
