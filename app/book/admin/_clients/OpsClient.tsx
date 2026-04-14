"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, AlertCircle, Loader2, Gauge } from "lucide-react";
import { adminGet } from "@/app/book/admin/_components/admin-api";
import { AdminCard, PageHeader } from "@/app/book/admin/_components/AdminCard";
import { KPITile } from "@/app/book/admin/_components/KPITile";
import { ErrorAlert } from "@/app/book/admin/_components/ErrorAlert";
import { EmptyState } from "@/app/book/admin/_components/EmptyState";
import { KPITileSkeleton, TableSkeleton } from "@/app/book/admin/_components/Skeleton";

type IngestionJob = {
  jobId: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  bookId: string | null;
  errorReportKey: string | null;
};

type OpsResponse = {
  generatedAt: string;
  eventsToday: number;
  eventsYesterday: number;
  ingestionJobs: IngestionJob[];
  accountChanges: { deactivated: number; deleted: number; reactivated: number };
  beaconErrors: { date: string; value: number }[];
};

export function OpsClient() {
  const [data, setData] = useState<OpsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = () => {
    setLoading(true);
    setError(null);
    adminGet<OpsResponse>("/metrics/ops")
      .then(setData)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Failed"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    reload();
  }, []);

  return (
    <div>
      <PageHeader
        title="Ops & health"
        description="System status, ingestion, and account changes"
      />

      {error && <ErrorAlert error={error} onRetry={reload} />}

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
                        <span className="text-(--cf-danger-text)">view</span>
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
