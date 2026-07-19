"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { TrendingUp } from "lucide-react";
import { adminGet } from "@/app/book/admin/_components/admin-api";
import { AdminCard, PageHeader } from "@/app/book/admin/_components/AdminCard";
import { ErrorAlert } from "@/app/book/admin/_components/ErrorAlert";
import { EmptyState } from "@/components/ui/EmptyState";
import { ChartSkeleton } from "@/app/book/admin/_components/Skeleton";
import { RangeSelector } from "@/app/book/admin/_components/RangeSelector";

const SignupGrowthChart = dynamic(
  () =>
    import("@/app/book/admin/_components/charts/GrowthCharts").then(
      (module) => module.SignupGrowthChart,
    ),
  { ssr: false },
);

const ReferralActivationsChart = dynamic(
  () =>
    import("@/app/book/admin/_components/charts/GrowthCharts").then(
      (module) => module.ReferralActivationsChart,
    ),
  { ssr: false },
);

type GrowthResponse = {
  generatedAt: string;
  range: number;
  signups: { date: string; value: number }[];
  funnel: {
    onboarded: number;
    firstReading: number;
    firstQuiz: number;
    firstQuizPass: number;
  };
  topDomains: { domain: string; count: number }[];
  referrals: { date: string; value: number }[];
};

export function GrowthClient() {
  const [range, setRange] = useState(30);
  const [data, setData] = useState<GrowthResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = () => {
    setLoading(true);
    setError(null);
    adminGet<GrowthResponse>(`/metrics/growth?range=${range}`)
      .then(setData)
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : "Failed to load growth"),
      )
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    reload();
  }, [range]);

  const totalSignups = data?.signups.reduce((s, d) => s + d.value, 0) ?? 0;

  return (
    <div>
      <PageHeader
        title="Growth"
        description={data ? `Last ${data.range} days · ${totalSignups} new signups` : "Signups, funnel, referrals"}
        action={<RangeSelector value={range} onChange={setRange} />}
      />

      {error && <ErrorAlert error={error} onRetry={reload} />}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <AdminCard title="Signups per day" className="lg:col-span-2">
          {loading && !data ? (
            <ChartSkeleton />
          ) : totalSignups === 0 ? (
            <EmptyState
              icon={TrendingUp}
              title="No signups in range"
              description="Once people complete onboarding, they'll appear here."
              compact
            />
          ) : (
            <div className="h-56">
              <SignupGrowthChart data={data?.signups ?? []} />
            </div>
          )}
        </AdminCard>

        <AdminCard title="Onboarding funnel" description="Period totals">
          <FunnelView funnel={data?.funnel} />
        </AdminCard>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <AdminCard title="Top email domains" description="Where signups come from">
          {data?.topDomains.length ? (
            <ul className="space-y-1.5">
              {data.topDomains.map((d) => {
                const max = data.topDomains[0].count;
                const pct = (d.count / max) * 100;
                return (
                  <li key={d.domain}>
                    <div className="flex items-center justify-between text-cf-label-sm">
                      <span className="font-mono text-(--cf-text-2)">{d.domain}</span>
                      <span className="tabular-nums text-(--cf-text-3)">{d.count}</span>
                    </div>
                    <div className="mt-1 h-1 overflow-hidden rounded-full bg-(--cf-surface-muted)">
                      <div
                        className="h-full rounded-full bg-(--cf-accent)/60 transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-cf-label-sm text-(--cf-text-soft)">No signups in range.</p>
          )}
        </AdminCard>

        <AdminCard title="Referral activations" description="Activated invitees per day">
          {loading && !data ? (
            <ChartSkeleton height="h-48" />
          ) : (
            <div className="h-48">
              <ReferralActivationsChart data={data?.referrals ?? []} />
            </div>
          )}
        </AdminCard>
      </div>
    </div>
  );
}

function FunnelView({ funnel }: { funnel?: GrowthResponse["funnel"] }) {
  if (!funnel) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-9 animate-pulse rounded-lg bg-(--cf-surface-muted)" />
        ))}
      </div>
    );
  }
  const steps = [
    { label: "Onboarded", value: funnel.onboarded },
    { label: "First reading session", value: funnel.firstReading },
    { label: "First quiz attempt", value: funnel.firstQuiz },
    { label: "First quiz pass", value: funnel.firstQuizPass },
  ];
  const max = Math.max(1, steps[0]?.value ?? 0);

  return (
    <div className="space-y-2.5">
      {steps.map((s, i) => {
        const pct = (s.value / max) * 100;
        // Guard against impossible (>100%) "conversions": these four steps are
        // sourced from independent proxy event series (see growth/route.ts), not a
        // real monotonic cohort, so a later step can exceed its predecessor. Render
        // no percent rather than a misleading 5-digit figure (e.g. "20200% from prev").
        const conv =
          i > 0 && steps[i - 1].value > 0 && s.value <= steps[i - 1].value
            ? `${((s.value / steps[i - 1].value) * 100).toFixed(0)}% from prev`
            : "";
        return (
          <div key={s.label}>
            <div className="mb-1 flex items-center justify-between gap-x-3 text-cf-label-sm">
              <span className="min-w-0 font-medium text-(--cf-text-2)">{s.label}</span>
              <span className="shrink-0 whitespace-nowrap text-right tabular-nums text-(--cf-text-3)">
                {s.value.toLocaleString()}
                {conv && <span className="ml-2 text-(--cf-text-soft)">{conv}</span>}
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-(--cf-surface-muted)">
              <div
                className="h-full rounded-full bg-(--cf-accent) transition-all duration-500 ease-out"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
