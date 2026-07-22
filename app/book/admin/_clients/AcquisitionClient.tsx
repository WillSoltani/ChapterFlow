"use client";

import { useEffect, useState } from "react";
import { Filter } from "lucide-react";
import { adminGet } from "@/app/book/admin/_components/admin-api";
import { AdminCard, PageHeader } from "@/app/book/admin/_components/AdminCard";
import { KPITile } from "@/app/book/admin/_components/KPITile";
import { ErrorAlert } from "@/app/book/admin/_components/ErrorAlert";
import { EmptyState } from "@/components/ui/EmptyState";
import { KPITileSkeleton } from "@/app/book/admin/_components/Skeleton";

type Source = { label: string; count: number };

type AcqResponse = {
  generatedAt: string;
  totalProfiles: number;
  totalSurveyed: number;
  referralSources: Source[];
  utmCampaigns: Array<{ source: string; medium: string; campaign: string; count: number }>;
  topReferrers: Array<{ host: string; count: number }>;
  warnings?: string[];
};

export function AcquisitionClient() {
  const [data, setData] = useState<AcqResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = () => {
    setLoading(true);
    setError(null);
    adminGet<AcqResponse>("/metrics/acquisition")
      .then(setData)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Failed"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    reload();
  }, []);

  const surveyCoverage =
    data && data.totalProfiles > 0
      ? Math.round((data.totalSurveyed / data.totalProfiles) * 100)
      : 0;

  return (
    <div>
      <PageHeader
        title="Acquisition"
        description={
          data
            ? `${data.totalSurveyed} of ${data.totalProfiles} users answered the source survey (${surveyCoverage}%)`
            : "Where users come from"
        }
      />

      {error && <ErrorAlert error={error} onRetry={reload} />}
      {data?.warnings?.length ? (
        <div className="mb-4 rounded-xl border border-(--cf-border) bg-(--cf-surface-muted) p-3 text-cf-label text-(--cf-text-2)">
          {data.warnings.join(" · ")}
        </div>
      ) : null}

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {loading && !data ? (
          Array.from({ length: 4 }).map((_, i) => <KPITileSkeleton key={i} />)
        ) : (
          <>
            <KPITile label="Surveyed users" value={data?.totalSurveyed ?? 0} hint="answered referralSource" />
            <KPITile label="Survey coverage" value={surveyCoverage} format="percent" />
            <KPITile label="UTM campaigns" value={data?.utmCampaigns.length ?? 0} hint="captured at signup" />
            <KPITile label="Top referrers" value={data?.topReferrers.length ?? 0} hint="distinct domains" />
          </>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <AdminCard
          title="Self-reported source"
          description="From the onboarding 'How did you hear about us?' survey"
        >
          {(data?.referralSources.every((r) => r.count === 0) ?? true) ? (
            <EmptyState
              icon={Filter}
              title="No survey responses yet"
              description="Onboarding asks users where they heard about ChapterFlow."
              compact
            />
          ) : (
            <div className="space-y-2">
              {data?.referralSources.map((r) => {
                const max = data.referralSources[0].count;
                const pct = max > 0 ? (r.count / max) * 100 : 0;
                const totalPct =
                  data.totalSurveyed > 0 ? Math.round((r.count / data.totalSurveyed) * 100) : 0;
                return (
                  <div key={r.label}>
                    <div className="mb-1 flex items-center justify-between text-cf-label-sm">
                      <span className="font-medium text-(--cf-text-2)">{r.label}</span>
                      <span className="tabular-nums text-(--cf-text-3)">
                        {r.count.toLocaleString()}{" "}
                        <span className="text-(--cf-text-soft)">({totalPct}%)</span>
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-(--cf-surface-muted)">
                      <div className="h-full rounded-full bg-(--cf-accent) transition-all" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </AdminCard>

        <AdminCard title="UTM campaigns" description="From URL parameters at signup">
          {(data?.utmCampaigns.length ?? 0) === 0 ? (
            <EmptyState
              icon={Filter}
              title="No UTM data yet"
              description="UTM tracking just shipped — campaigns will populate as users sign up via tagged links (e.g. ?utm_source=twitter)."
              compact
            />
          ) : (
            <ul className="space-y-1.5 text-cf-label-sm">
              {data?.utmCampaigns.map((c, i) => (
                <li key={i} className="flex items-center justify-between">
                  <span className="text-(--cf-text-2)">
                    <span className="font-mono text-(--cf-text-3)">{c.source}</span>
                    {" · "}
                    {c.campaign}
                  </span>
                  <span className="tabular-nums text-(--cf-text-3)">{c.count}</span>
                </li>
              ))}
            </ul>
          )}
        </AdminCard>
      </div>

      <p className="mt-4 text-cf-caption text-(--cf-text-soft)">
        Referer and UTM (utm_source, utm_medium, utm_campaign) are captured at signup; these
        breakdowns populate as users arrive through tagged links.
      </p>
    </div>
  );
}
