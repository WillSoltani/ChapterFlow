"use client";

import { useEffect, useState } from "react";
import { Globe, Download } from "lucide-react";
import { adminGet } from "@/app/book/admin/_components/admin-api";
import { AdminCard, PageHeader } from "@/app/book/admin/_components/AdminCard";
import { KPITile } from "@/app/book/admin/_components/KPITile";
import { ErrorAlert } from "@/app/book/admin/_components/ErrorAlert";
import { EmptyState } from "@/app/book/admin/_components/EmptyState";
import { KPITileSkeleton, TableSkeleton } from "@/app/book/admin/_components/Skeleton";
import { downloadCSV } from "@/app/book/admin/_components/csv";

type Country = {
  code: string;
  name: string;
  count: number;
  pro: number;
  freeUsers: number;
  activeRecent: number;
};
type City = { city: string; country: string; count: number };
type TZ = { tz: string; count: number };

type GeoResponse = {
  generatedAt: string;
  total: number;
  totalWithLocation: number;
  countries: Country[];
  topCities: City[];
  topTimezones: TZ[];
  warnings?: string[];
};

export function GeographyClient() {
  const [data, setData] = useState<GeoResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = () => {
    setLoading(true);
    setError(null);
    adminGet<GeoResponse>("/metrics/geography")
      .then(setData)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Failed"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    reload();
  }, []);

  const coverage =
    data && data.total > 0
      ? Math.round((data.totalWithLocation / data.total) * 100)
      : 0;

  return (
    <div>
      <PageHeader
        title="Geography"
        description={
          data
            ? `${data.totalWithLocation.toLocaleString()} of ${data.total.toLocaleString()} users located (${coverage}% coverage)`
            : "Where your users are"
        }
      />

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
            <KPITile label="Countries" value={data?.countries.length ?? 0} hint="distinct" />
            <KPITile label="Cities" value={data?.topCities.length ?? 0} hint="top 30" />
            <KPITile label="Timezones" value={data?.topTimezones.length ?? 0} hint="top 20" />
            <KPITile label="Geo coverage" value={coverage} format="percent" hint="of all users" />
          </>
        )}
      </div>

      {data && data.totalWithLocation === 0 && !loading && (
        <AdminCard>
          <EmptyState
            icon={Globe}
            title="No geo data captured yet"
            description="CloudFront viewer headers must be enabled. After CDK deploy, location data populates as users browse."
          />
        </AdminCard>
      )}

      {data && data.totalWithLocation > 0 && (
        <>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <AdminCard
              title={`Countries (${data.countries.length})`}
              description="Sorted by user count"
              className="lg:col-span-2"
              action={
                <button
                  type="button"
                  onClick={() =>
                    downloadCSV(
                      data.countries as unknown as Record<string, unknown>[],
                      `geography-countries-${new Date().toISOString().slice(0, 10)}.csv`,
                    )
                  }
                  className="inline-flex items-center gap-1.5 rounded-lg border border-(--cf-border) bg-(--cf-surface) px-2.5 py-1 text-[11px] text-(--cf-text-2) hover:bg-(--cf-surface-muted)"
                >
                  <Download className="h-3 w-3" />
                  CSV
                </button>
              }
            >
              {loading ? (
                <TableSkeleton rows={8} cols={5} />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-[12px]">
                    <thead>
                      <tr className="border-b border-(--cf-border) text-left text-[11px] uppercase tracking-[0.08em] text-(--cf-text-soft)">
                        <th className="py-2 pr-3">Country</th>
                        <th className="py-2 pr-3 text-right">Users</th>
                        <th className="py-2 pr-3 text-right">PRO</th>
                        <th className="py-2 pr-3 text-right">Active 7d</th>
                        <th className="py-2 pr-3">Distribution</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.countries.map((c) => {
                        const max = data.countries[0].count;
                        const pct = (c.count / max) * 100;
                        return (
                          <tr
                            key={c.code}
                            className="border-b border-(--cf-border)/50 transition hover:bg-(--cf-surface-muted)/40"
                          >
                            <td className="py-2 pr-3 text-(--cf-text-1)">
                              <span className="mr-1.5 font-mono text-[10px] text-(--cf-text-soft)">
                                {c.code}
                              </span>
                              {c.name}
                            </td>
                            <td className="py-2 pr-3 text-right tabular-nums text-(--cf-text-2)">
                              {c.count.toLocaleString()}
                            </td>
                            <td className="py-2 pr-3 text-right tabular-nums text-(--cf-accent)">
                              {c.pro}
                            </td>
                            <td className="py-2 pr-3 text-right tabular-nums text-(--cf-text-3)">
                              {c.activeRecent}
                            </td>
                            <td className="w-32 py-2 pr-3">
                              <div className="h-1.5 overflow-hidden rounded-full bg-(--cf-surface-muted)">
                                <div
                                  className="h-full rounded-full bg-(--cf-accent)"
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </AdminCard>

            <AdminCard title="Top timezones" description="Last 20">
              <ul className="space-y-1.5">
                {data.topTimezones.map((t) => (
                  <li key={t.tz} className="flex items-center justify-between text-[12px]">
                    <span className="truncate font-mono text-[11px] text-(--cf-text-2)">
                      {t.tz}
                    </span>
                    <span className="tabular-nums text-(--cf-text-3)">{t.count}</span>
                  </li>
                ))}
              </ul>
            </AdminCard>
          </div>

          <div className="mt-6">
            <AdminCard title={`Top cities (${data.topCities.length})`}>
              <div className="overflow-x-auto">
                <table className="w-full text-[12px]">
                  <thead>
                    <tr className="border-b border-(--cf-border) text-left text-[11px] uppercase tracking-[0.08em] text-(--cf-text-soft)">
                      <th className="py-2 pr-3">City</th>
                      <th className="py-2 pr-3">Country</th>
                      <th className="py-2 pr-3 text-right">Users</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.topCities.map((c, i) => (
                      <tr
                        key={`${c.country}-${c.city}-${i}`}
                        className="border-b border-(--cf-border)/50"
                      >
                        <td className="py-2 pr-3 text-(--cf-text-1)">{c.city}</td>
                        <td className="py-2 pr-3 font-mono text-[11px] text-(--cf-text-3)">
                          {c.country}
                        </td>
                        <td className="py-2 pr-3 text-right tabular-nums text-(--cf-text-2)">
                          {c.count.toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </AdminCard>
          </div>
        </>
      )}
    </div>
  );
}
