"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ExternalLink, ShieldCheck, FileCheck2 } from "lucide-react";
import { adminGet } from "@/app/book/admin/_components/admin-api";
import { AdminCard, PageHeader } from "@/app/book/admin/_components/AdminCard";
import { KPITile } from "@/app/book/admin/_components/KPITile";
import { ErrorAlert } from "@/app/book/admin/_components/ErrorAlert";
import { EmptyState } from "@/components/ui/EmptyState";
import { KPITileSkeleton } from "@/app/book/admin/_components/Skeleton";

type ModerationResponse = {
  generatedAt: string;
  range: number;
  pendingScenarioCount: number;
  pendingScenariosPreview: Array<{
    submissionId: string;
    title: string;
    scope: string;
    userEmail: string | null;
    bookId: string;
    chapterNumber: number;
    queuedAt: string;
    aiReason: string | null;
  }>;
  scenarioSubmissions: { date: string; value: number }[];
  scenarioApprovals: { date: string; value: number }[];
  aiDecisions: { auto_approve: number; auto_reject: number; queue_for_review: number };
  referralActivity: { date: string; value: number }[];
};

export function ModerationClient() {
  const [data, setData] = useState<ModerationResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = () => {
    setLoading(true);
    setError(null);
    adminGet<ModerationResponse>("/metrics/moderation?range=30")
      .then(setData)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Failed"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    reload();
  }, []);

  const totalSubmissions = data?.scenarioSubmissions.reduce((s, d) => s + d.value, 0) ?? 0;
  const totalApprovals = data?.scenarioApprovals.reduce((s, d) => s + d.value, 0) ?? 0;
  const approvalRate = totalSubmissions > 0 ? (totalApprovals / totalSubmissions) * 100 : 0;

  return (
    <div>
      <PageHeader
        title="Moderation"
        description="AI validation + human review queue · last 30 days"
        action={
          <Link
            href="/book/admin/scenarios"
            className="inline-flex items-center gap-1.5 rounded-lg border border-(--cf-accent-border) bg-(--cf-accent-soft) px-3 py-1.5 text-cf-label-sm font-semibold text-(--cf-accent) transition hover:brightness-110"
          >
            Open queue
            <ExternalLink className="h-3 w-3" />
          </Link>
        }
      />

      {error && <ErrorAlert error={error} onRetry={reload} />}

      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {loading && !data ? (
          Array.from({ length: 6 }).map((_, i) => <KPITileSkeleton key={i} />)
        ) : (
          <>
            <KPITile label="Pending review" value={data?.pendingScenarioCount ?? 0} hint="needs admin" />
            <KPITile label="Total submissions" value={totalSubmissions} hint="last 30d" />
            <KPITile label="Approval rate" value={approvalRate} format="percent" hint="last 30d" />
            <KPITile label="AI auto-approve" value={data?.aiDecisions.auto_approve ?? 0} />
            <KPITile label="AI auto-reject" value={data?.aiDecisions.auto_reject ?? 0} />
            <KPITile label="AI queued" value={data?.aiDecisions.queue_for_review ?? 0} />
          </>
        )}
      </div>

      <AdminCard
        title={`Pending scenarios (${data?.pendingScenarioCount ?? 0})`}
        description="First 10 awaiting your review"
      >
        {loading && !data ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-20 animate-pulse rounded-xl bg-(--cf-surface-muted)" />
            ))}
          </div>
        ) : (data?.pendingScenariosPreview.length ?? 0) === 0 ? (
          <EmptyState
            icon={ShieldCheck}
            title="Queue is empty"
            description="Nothing waiting for your review. Nice."
            compact
          />
        ) : (
          <div className="space-y-2">
            {data?.pendingScenariosPreview.map((s) => (
              <div
                key={s.submissionId}
                className="cf-panel-muted rounded-xl p-3 transition hover:border-(--cf-accent-border)/50"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-cf-label font-medium text-(--cf-text-1)">{s.title}</p>
                    <p className="mt-0.5 text-cf-caption text-(--cf-text-3)">
                      {s.userEmail ?? "(no email)"} · {s.scope} · book {s.bookId.slice(0, 12)}… · ch{s.chapterNumber}
                    </p>
                    {s.aiReason && (
                      <p className="mt-1.5 rounded-md bg-(--cf-surface-strong) px-2 py-1 text-cf-caption text-(--cf-text-2)">
                        <span className="font-semibold text-(--cf-accent)">AI:</span> {s.aiReason}
                      </p>
                    )}
                  </div>
                  <Link
                    href="/book/admin/scenarios"
                    className="shrink-0 rounded-md border border-(--cf-border) bg-(--cf-surface) px-2 py-1 text-cf-caption font-medium text-(--cf-text-2) transition hover:bg-(--cf-surface-strong) hover:text-(--cf-text-1)"
                  >
                    Review →
                  </Link>
                </div>
              </div>
            ))}
            {(data?.pendingScenarioCount ?? 0) > (data?.pendingScenariosPreview.length ?? 0) && (
              <Link
                href="/book/admin/scenarios"
                className="block pt-2 text-center text-cf-caption text-(--cf-accent) hover:underline"
              >
                <FileCheck2 className="mr-1 inline h-3 w-3" />
                + {(data?.pendingScenarioCount ?? 0) - (data?.pendingScenariosPreview.length ?? 0)} more in queue
              </Link>
            )}
          </div>
        )}
      </AdminCard>
    </div>
  );
}
