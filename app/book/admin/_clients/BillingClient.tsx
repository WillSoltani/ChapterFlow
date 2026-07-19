"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, CreditCard, Globe, type LucideIcon } from "lucide-react";
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
import { EmptyState } from "@/components/ui/EmptyState";
import { KPITileSkeleton, TableSkeleton } from "@/app/book/admin/_components/Skeleton";
import { DarkTooltip } from "@/app/book/admin/_components/DarkTooltip";

type CountryRow = { country: string; mrrCents: number; mrr: number };

type BillingEventRow = {
  userId: string | null;
  amountCents: number;
  amount: number;
  currency: string;
  reason: string | null;
  status: string | null;
  createdAt: string;
};

type BillingResponse = {
  generatedAt: string;
  currency: string;
  realMrr: number;
  realArr: number;
  stripeProCount: number;
  revenueByCountry: CountryRow[];
  currencyMix: Array<{ currency: string; count: number }>;
  cardBrandMix: Array<{ brand: string; count: number }>;
  paymentFailed30d: number;
  pastDue30d: number;
  canceled30d: number;
  topPayingUsers: Array<{
    userId: string;
    country: string | null;
    currency: string | null;
    amountCents: number;
    cardBrand: string | null;
    lastInvoicePaidAt: string | null;
  }>;
  recentRefunds: BillingEventRow[];
  recentDisputes: BillingEventRow[];
  coverage: { country: number; cardBrand: number };
  warnings?: string[];
};

const BRAND_COLORS: Record<string, string> = {
  visa: "var(--cf-accent)",
  mastercard: "var(--cf-warning-text)",
  amex: "var(--cf-success-text)",
  discover: "var(--cf-danger-text)",
  unknown: "var(--cf-text-soft)",
};

export function BillingClient() {
  const [data, setData] = useState<BillingResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = () => {
    setLoading(true);
    setError(null);
    adminGet<BillingResponse>("/metrics/billing")
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
        title="Billing"
        description="Real-money view from Stripe — MRR, revenue by country, card mix, payment failures"
      />

      {error && <ErrorAlert error={error} onRetry={reload} />}
      {data?.warnings?.length ? (
        <div className="mb-4 rounded-xl border border-(--cf-border) bg-(--cf-surface-muted) p-3 text-cf-label text-(--cf-text-2)">
          {data.warnings.join(" · ")}
        </div>
      ) : null}

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        {loading && !data ? (
          Array.from({ length: 6 }).map((_, i) => <KPITileSkeleton key={i} />)
        ) : (
          <>
            <KPITile
              label="Real MRR"
              value={Math.round(data?.realMrr ?? 0)}
              format="currency"
              currency={data?.currency}
              hint="actual Stripe revenue"
            />
            <KPITile
              label="Real ARR"
              value={Math.round(data?.realArr ?? 0)}
              format="currency"
              currency={data?.currency}
            />
            <KPITile label="Paying PROs" value={data?.stripeProCount ?? 0} hint="stripe source" />
            <KPITile label="Past due" value={data?.pastDue30d ?? 0} hint="last 30d" />
            <KPITile label="Canceled" value={data?.canceled30d ?? 0} hint="last 30d" />
            <KPITile
              label="Data coverage"
              value={data?.coverage.country ?? 0}
              format="percent"
              hint="with country"
            />
          </>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <AdminCard title="Revenue by country" description="Real MRR per country" className="lg:col-span-2">
          {(data?.revenueByCountry.length ?? 0) === 0 ? (
            <EmptyState
              icon={Globe}
              title="No billing country data yet"
              description="Waits for new Stripe subscriptions. Billing country is fetched from customer details."
              compact
            />
          ) : (
            <div className="h-56">
              <ResponsiveContainer>
                <BarChart
                  data={data?.revenueByCountry ?? []}
                  layout="vertical"
                  margin={{ top: 10, right: 10, bottom: 0, left: 60 }}
                >
                  <CartesianGrid stroke="var(--cf-border)" horizontal={false} />
                  <XAxis
                    type="number"
                    tick={{ fill: "var(--cf-text-3)", fontSize: 11 }}
                    tickFormatter={(v) => `$${v}`}
                  />
                  <YAxis
                    dataKey="country"
                    type="category"
                    tick={{ fill: "var(--cf-text-3)", fontSize: 11 }}
                    width={80}
                  />
                  <Tooltip content={<DarkTooltip />} />
                  <Bar dataKey="mrr" fill="var(--cf-accent)" radius={[0, 4, 4, 0]} isAnimationActive={false} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </AdminCard>

        <AdminCard title="Card brand mix" description="Payment methods">
          {(data?.cardBrandMix.length ?? 0) === 0 ? (
            <EmptyState
              icon={CreditCard}
              title="No card data yet"
              description="Will populate after first Stripe payment."
              compact
            />
          ) : (
            <div className="h-48">
              <ResponsiveContainer>
                <PieChart>
                  <Pie
                    data={data?.cardBrandMix ?? []}
                    cx="50%"
                    cy="50%"
                    innerRadius={36}
                    outerRadius={72}
                    paddingAngle={2}
                    dataKey="count"
                    nameKey="brand"
                    isAnimationActive={false}
                  >
                    {(data?.cardBrandMix ?? []).map((entry) => (
                      <Cell
                        key={entry.brand}
                        fill={BRAND_COLORS[entry.brand] ?? "var(--cf-text-soft)"}
                        stroke="var(--cf-surface)"
                      />
                    ))}
                  </Pie>
                  <Tooltip content={<DarkTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 11, color: "var(--cf-text-3)" }} iconSize={8} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </AdminCard>
      </div>

      <div className="mt-6">
        <AdminCard
          title={`Top paying subscribers (${data?.topPayingUsers.length ?? 0})`}
          description="Sorted by subscription amount"
        >
          {loading && !data ? (
            <TableSkeleton rows={6} cols={5} />
          ) : (data?.topPayingUsers.length ?? 0) === 0 ? (
            <EmptyState
              icon={CreditCard}
              title="No paying subscribers yet"
              description="Stripe purchases will populate this list."
              compact
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-cf-label-sm">
                <thead>
                  <tr className="border-b border-(--cf-border) text-left text-cf-caption uppercase tracking-[0.08em] text-(--cf-text-soft)">
                    <th className="py-2 pr-3">User</th>
                    <th className="py-2 pr-3 text-right">Amount</th>
                    <th className="py-2 pr-3">Currency</th>
                    <th className="py-2 pr-3">Country</th>
                    <th className="py-2 pr-3">Card</th>
                    <th className="py-2 pr-3">Last paid</th>
                  </tr>
                </thead>
                <tbody>
                  {data?.topPayingUsers.map((u) => (
                    <tr key={u.userId} className="border-b border-(--cf-border)/50">
                      <td className="py-2 pr-3 font-mono text-cf-caption text-(--cf-text-2)" title={u.userId}>
                        {u.userId.slice(0, 14)}…
                      </td>
                      <td className="py-2 pr-3 text-right tabular-nums text-(--cf-text-1)">
                        ${(u.amountCents / 100).toFixed(2)}
                      </td>
                      <td className="py-2 pr-3 text-(--cf-text-3)">{u.currency ?? "—"}</td>
                      <td className="py-2 pr-3 text-(--cf-text-3)">{u.country ?? "—"}</td>
                      <td className="py-2 pr-3 text-(--cf-text-3)">{u.cardBrand ?? "—"}</td>
                      <td className="py-2 pr-3 text-(--cf-text-3)">
                        {u.lastInvoicePaidAt
                          ? new Date(u.lastInvoicePaidAt).toLocaleDateString()
                          : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </AdminCard>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <BillingEventsCard
          title="Recent refunds"
          icon={CreditCard}
          emptyTitle="No refunds recorded"
          emptyDescription="Stripe refunds will appear here."
          rows={data?.recentRefunds}
          loading={loading && !data}
        />
        <BillingEventsCard
          title="Recent disputes"
          icon={AlertTriangle}
          emptyTitle="No disputes recorded"
          emptyDescription="Chargebacks revoke Pro access and appear here."
          rows={data?.recentDisputes}
          loading={loading && !data}
        />
      </div>

      <p className="mt-4 text-cf-caption text-(--cf-text-soft)">
        Real MRR = sum of actual Stripe subscription amounts for active
        stripe-source PROs. License and flow_points PROs are excluded
        (they&apos;re free). Coverage grows over time as Stripe webhooks
        populate billing fields for existing subscribers.
      </p>
    </div>
  );
}

function BillingEventsCard({
  title,
  icon,
  emptyTitle,
  emptyDescription,
  rows,
  loading,
}: {
  title: string;
  icon: LucideIcon;
  emptyTitle: string;
  emptyDescription: string;
  rows: BillingEventRow[] | undefined;
  loading: boolean;
}) {
  return (
    <AdminCard title={`${title} (${rows?.length ?? 0})`}>
      {loading ? (
        <TableSkeleton rows={4} cols={4} />
      ) : (rows?.length ?? 0) === 0 ? (
        <EmptyState icon={icon} title={emptyTitle} description={emptyDescription} compact />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] text-cf-label-sm">
            <thead>
              <tr className="border-b border-(--cf-border) text-left text-cf-caption uppercase tracking-[0.08em] text-(--cf-text-soft)">
                <th className="py-2 pr-3">User</th>
                <th className="py-2 pr-3 text-right">Amount</th>
                <th className="py-2 pr-3">Reason</th>
                <th className="py-2 pr-3">Date</th>
              </tr>
            </thead>
            <tbody>
              {rows?.map((r) => (
                <tr key={`${r.createdAt}-${r.userId ?? "?"}`} className="border-b border-(--cf-border)/50">
                  <td className="py-2 pr-3 font-mono text-cf-caption text-(--cf-text-2)" title={r.userId ?? undefined}>
                    {r.userId ? `${r.userId.slice(0, 14)}…` : "—"}
                  </td>
                  <td className="py-2 pr-3 text-right tabular-nums text-(--cf-text-1)">
                    ${r.amount.toFixed(2)} {r.currency}
                  </td>
                  <td className="py-2 pr-3 text-(--cf-text-3)">{r.reason ?? r.status ?? "—"}</td>
                  <td className="py-2 pr-3 text-(--cf-text-3)">
                    {r.createdAt ? new Date(r.createdAt).toLocaleDateString() : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AdminCard>
  );
}
