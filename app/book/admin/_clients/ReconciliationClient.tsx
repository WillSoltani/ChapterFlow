"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, RefreshCw } from "lucide-react";
import { adminGet } from "@/app/book/admin/_components/admin-api";
import { AdminCard, PageHeader } from "@/app/book/admin/_components/AdminCard";
import { KPITile } from "@/app/book/admin/_components/KPITile";
import { ErrorAlert } from "@/app/book/admin/_components/ErrorAlert";
import { EmptyState } from "@/components/ui/EmptyState";
import { KPITileSkeleton, TableSkeleton } from "@/app/book/admin/_components/Skeleton";

type Discrepancy = {
  type: string;
  userId: string | null;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  detail: string;
  dbPlan?: string;
  dbProSource?: string;
  stripeStatus?: string;
};

type ReconResponse = {
  generatedAt: string;
  liveStripeSubs: number;
  entitlementsScanned: number;
  discrepancies: Discrepancy[];
  truncated: boolean;
};

const TYPE_LABEL: Record<string, string> = {
  orphan_stripe_sub: "Orphan Stripe sub",
  stripe_live_but_db_not_pro: "Missed upgrade",
  db_pro_but_stripe_inactive: "Missed cancellation",
  prosource_mismatch: "proSource mismatch",
  price_mismatch: "Price mismatch",
  amount_mismatch: "Amount mismatch",
  customer_collision: "Customer collision",
};

export function ReconciliationClient() {
  const [data, setData] = useState<ReconResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = () => {
    setLoading(true);
    setError(null);
    adminGet<ReconResponse>("/reconciliation")
      .then(setData)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Failed"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    reload();
  }, []);

  const count = data?.discrepancies.length ?? 0;

  return (
    <div>
      <PageHeader
        title="Reconciliation"
        description="Compare live Stripe subscriptions against DynamoDB entitlements. Read-only — flags missed webhooks and drift."
      />

      {error && <ErrorAlert error={error} onRetry={reload} />}

      <div className="mb-6 flex items-center justify-between">
        <p className="text-[12px] text-(--cf-text-soft)">
          {data ? `Checked ${new Date(data.generatedAt).toLocaleString()}` : "—"}
          {data?.truncated ? " · Stripe list truncated (more subscriptions exist)" : ""}
        </p>
        <button
          type="button"
          onClick={reload}
          disabled={loading}
          className="inline-flex items-center gap-1.5 rounded-lg border border-(--cf-border) px-3 py-1.5 text-[12px] font-medium text-(--cf-text-2) hover:border-(--cf-text-soft) disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          Re-run
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        {loading && !data ? (
          Array.from({ length: 3 }).map((_, i) => <KPITileSkeleton key={i} />)
        ) : (
          <>
            <KPITile label="Live Stripe subs" value={data?.liveStripeSubs ?? 0} />
            <KPITile label="Entitlements scanned" value={data?.entitlementsScanned ?? 0} />
            <KPITile label="Discrepancies" value={count} hint={count === 0 ? "all reconciled" : "needs review"} />
          </>
        )}
      </div>

      <div className="mt-6">
        <AdminCard title={`Discrepancies (${count})`}>
          {loading && !data ? (
            <TableSkeleton rows={5} cols={4} />
          ) : count === 0 ? (
            <EmptyState
              icon={CheckCircle2}
              title="Stripe and DynamoDB agree"
              description="No discrepancies found. MRR and entitlement state are trustworthy."
              compact
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-[12px]">
                <thead>
                  <tr className="border-b border-(--cf-border) text-left text-[11px] uppercase tracking-[0.08em] text-(--cf-text-soft)">
                    <th className="py-2 pr-3">Type</th>
                    <th className="py-2 pr-3">User</th>
                    <th className="py-2 pr-3">Detail</th>
                    <th className="py-2 pr-3">Stripe status</th>
                  </tr>
                </thead>
                <tbody>
                  {data?.discrepancies.map((d, i) => (
                    <tr
                      key={`${d.type}-${d.stripeSubscriptionId ?? d.userId ?? i}`}
                      className="border-b border-(--cf-border)/50"
                    >
                      <td className="py-2 pr-3 font-medium text-(--cf-text-1)">
                        {TYPE_LABEL[d.type] ?? d.type}
                      </td>
                      <td className="py-2 pr-3 font-mono text-[11px] text-(--cf-text-2)" title={d.userId ?? undefined}>
                        {d.userId ? `${d.userId.slice(0, 14)}…` : "—"}
                      </td>
                      <td className="py-2 pr-3 text-(--cf-text-3)">{d.detail}</td>
                      <td className="py-2 pr-3 text-(--cf-text-3)">{d.stripeStatus ?? "—"}</td>
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
