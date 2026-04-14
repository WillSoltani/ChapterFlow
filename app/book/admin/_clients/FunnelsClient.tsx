"use client";

import { useEffect, useState } from "react";
import { TrendingUp } from "lucide-react";
import { adminGet } from "@/app/book/admin/_components/admin-api";
import { AdminCard, PageHeader } from "@/app/book/admin/_components/AdminCard";
import { ErrorAlert } from "@/app/book/admin/_components/ErrorAlert";
import { EmptyState } from "@/app/book/admin/_components/EmptyState";

type Step = { key: string; label: string; count: number; pct: number };
type FunnelsResponse = {
  generatedAt: string;
  total: number;
  steps: Step[];
  warnings?: string[];
};

export function FunnelsClient() {
  const [data, setData] = useState<FunnelsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = () => {
    setLoading(true);
    setError(null);
    adminGet<FunnelsResponse>("/metrics/funnels")
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
        title="Funnels"
        description={data ? `${data.total.toLocaleString()} users · activation funnel` : "User activation funnel"}
      />

      {error && <ErrorAlert error={error} onRetry={reload} />}
      {data?.warnings?.length ? (
        <div className="mb-4 rounded-xl border border-(--cf-border) bg-(--cf-surface-muted) p-3 text-[13px] text-(--cf-text-2)">
          {data.warnings.join(" · ")}
        </div>
      ) : null}

      <AdminCard title="Activation funnel" description="Of all users who ever signed up">
        {loading && !data ? (
          <div className="space-y-2">
            {Array.from({ length: 7 }).map((_, i) => (
              <div key={i} className="h-12 animate-pulse rounded-lg bg-(--cf-surface-muted)" />
            ))}
          </div>
        ) : (data?.steps.length ?? 0) === 0 ? (
          <EmptyState icon={TrendingUp} title="Not enough data" compact />
        ) : (
          <div className="space-y-2.5">
            {data?.steps.map((s, i) => {
              const prev = i > 0 ? data.steps[i - 1] : null;
              const conversionFromPrev =
                prev && prev.count > 0 ? Math.round((s.count / prev.count) * 100) : 100;
              return (
                <div key={s.key}>
                  <div className="mb-1 flex items-center justify-between text-[12px]">
                    <span className="font-medium text-(--cf-text-2)">
                      {i + 1}. {s.label}
                    </span>
                    <span className="tabular-nums text-(--cf-text-3)">
                      {s.count.toLocaleString()}{" "}
                      <span className="text-(--cf-text-soft)">
                        ({s.pct}% of total · {conversionFromPrev}% from prev)
                      </span>
                    </span>
                  </div>
                  <div className="h-3 overflow-hidden rounded-full bg-(--cf-surface-muted)">
                    <div
                      className="h-full rounded-full bg-(--cf-accent) transition-all duration-700 ease-out"
                      style={{ width: `${s.pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </AdminCard>

      <p className="mt-4 text-[11px] text-(--cf-text-soft)">
        Note: "First commitment" and "First AI feedback" are estimated from a sample of the 100 most
        recent users due to event-log scan cost. Full coverage requires a precomputed snapshot
        (Phase 5+).
      </p>
    </div>
  );
}
