"use client";

import { useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { adminGet } from "@/app/book/admin/_components/admin-api";
import { AdminCard, PageHeader } from "@/app/book/admin/_components/AdminCard";
import { ErrorAlert } from "@/app/book/admin/_components/ErrorAlert";
import { EmptyState } from "@/components/ui/EmptyState";
import { KPITileSkeleton, TableSkeleton } from "@/app/book/admin/_components/Skeleton";
import { KPITile } from "@/app/book/admin/_components/KPITile";

type Agg = {
  type: string;
  channel: string;
  sent: number;
  read: number;
  readRate: number;
};

type NotifResponse = {
  generatedAt: string;
  aggregates: Agg[];
  preferences: {
    total: number;
    inAppEnabled: number;
    emailEnabled: number;
    pushEnabled: number;
  };
  warnings?: string[];
};

export function NotificationsClient() {
  const [data, setData] = useState<NotifResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = () => {
    setLoading(true);
    setError(null);
    adminGet<NotifResponse>("/metrics/notifications")
      .then(setData)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Failed"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    reload();
  }, []);

  const totalSent = data?.aggregates.reduce((s, a) => s + a.sent, 0) ?? 0;
  const totalRead = data?.aggregates.reduce((s, a) => s + a.read, 0) ?? 0;
  const overallReadRate = totalSent > 0 ? Math.round((totalRead / totalSent) * 100) : 0;

  const prefs = data?.preferences;
  const emailPct = prefs && prefs.total > 0 ? Math.round((prefs.emailEnabled / prefs.total) * 100) : 0;
  const pushPct = prefs && prefs.total > 0 ? Math.round((prefs.pushEnabled / prefs.total) * 100) : 0;

  return (
    <div>
      <PageHeader title="Notifications" description="Send & engagement by type and channel" />

      {error && <ErrorAlert error={error} onRetry={reload} />}
      {data?.warnings?.length ? (
        <div className="mb-4 rounded-xl border border-(--cf-border) bg-(--cf-surface-muted) p-3 text-[13px] text-(--cf-text-2)">
          {data.warnings.join(" · ")}
        </div>
      ) : null}

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {loading && !data ? (
          Array.from({ length: 4 }).map((_, i) => <KPITileSkeleton key={i} />)
        ) : (
          <>
            <KPITile label="Total sent" value={totalSent} hint="last ~5k" />
            <KPITile label="Read rate" value={overallReadRate} format="percent" hint="in-app" />
            <KPITile label="Email opt-in" value={emailPct} format="percent" hint={`${prefs?.emailEnabled ?? 0}/${prefs?.total ?? 0}`} />
            <KPITile label="Push opt-in" value={pushPct} format="percent" hint={`${prefs?.pushEnabled ?? 0}/${prefs?.total ?? 0}`} />
          </>
        )}
      </div>

      <AdminCard
        title={`Engagement by type & channel (${data?.aggregates.length ?? 0})`}
        description="Most-sent first"
      >
        {loading && !data ? (
          <TableSkeleton rows={8} cols={5} />
        ) : (data?.aggregates.length ?? 0) === 0 ? (
          <EmptyState icon={Bell} title="No notifications sent yet" compact />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="border-b border-(--cf-border) text-left text-[11px] uppercase tracking-[0.08em] text-(--cf-text-soft)">
                  <th className="py-2 pr-3">Type</th>
                  <th className="py-2 pr-3">Channel</th>
                  <th className="py-2 pr-3 text-right">Sent</th>
                  <th className="py-2 pr-3 text-right">Read</th>
                  <th className="py-2 pr-3 text-right">Read rate</th>
                </tr>
              </thead>
              <tbody>
                {data?.aggregates.map((a) => (
                  <tr
                    key={`${a.type}-${a.channel}`}
                    className="border-b border-(--cf-border)/50 transition hover:bg-(--cf-surface-muted)/40"
                  >
                    <td className="py-2 pr-3 text-(--cf-text-1)">{a.type}</td>
                    <td className="py-2 pr-3">
                      <span className="rounded-md border border-(--cf-border) bg-(--cf-surface-muted) px-1.5 py-0.5 text-[11px] text-(--cf-text-soft)">
                        {a.channel}
                      </span>
                    </td>
                    <td className="py-2 pr-3 text-right tabular-nums text-(--cf-text-2)">{a.sent.toLocaleString()}</td>
                    <td className="py-2 pr-3 text-right tabular-nums text-(--cf-text-2)">{a.read.toLocaleString()}</td>
                    <td className="py-2 pr-3 text-right">
                      <span
                        className={[
                          "rounded-md px-1.5 py-0.5 text-[11px] font-medium",
                          a.channel !== "in_app"
                            ? "text-(--cf-text-soft)"
                            : a.readRate >= 50
                            ? "bg-(--cf-success-soft) text-(--cf-success-text)"
                            : a.readRate >= 20
                            ? "bg-(--cf-warning-soft) text-(--cf-warning-text)"
                            : "bg-(--cf-danger-soft) text-(--cf-danger-text)",
                        ].join(" ")}
                      >
                        {a.channel === "in_app" ? `${a.readRate}%` : "—"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </AdminCard>

      <p className="mt-4 text-[11px] text-(--cf-text-soft)">
        Email/push read rates require SES bounce/open tracking and push receipt webhooks (Phase 6).
      </p>
    </div>
  );
}
