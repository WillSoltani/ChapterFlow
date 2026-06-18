import "server-only";

import { requireAdminUser } from "@/app/app/api/book/_lib/admin-auth";
import { bookOk, bookErr, withBookApiErrors } from "@/app/app/api/book/_lib/http";
import { getBookAnalyticsTableName } from "@/app/app/api/book/_lib/env";
import {
  getUserEvents,
  scanAllUserSnapshots,
} from "@/app/app/api/book/_lib/admin-metrics";
import { countFunnelTail, scaleFunnelCount } from "@/app/app/api/book/_lib/funnels-tail-core";

export const runtime = "nodejs";

type FunnelStep = {
  key: string;
  label: string;
  count: number;
  pct: number;
};

export async function GET(req: Request) {
  return withBookApiErrors(req, async () => {
    await requireAdminUser();
    const analyticsTable = await getBookAnalyticsTableName();
    if (!analyticsTable) {
      return bookErr(req, 503, "analytics_unavailable", "Analytics table not configured.");
    }

    const warnings: string[] = [];

    let snapshots: Record<string, unknown>[] = [];
    try {
      snapshots = await scanAllUserSnapshots(
        analyticsTable,
        "userId, firstSeenAt, onboardingCompletedAt, totalSessionCount, totalQuizAttempts, totalQuizPasses",
      );
    } catch (err) {
      console.warn("[admin-funnels] snapshot scan failed:", err);
      warnings.push("Funnel data unavailable (database scan failed).");
    }

    const total = snapshots.length;

    // Snapshot-derived steps (cheap)
    const onboarded = snapshots.filter(
      (s) => typeof s.onboardingCompletedAt === "string",
    ).length;
    const firstReading = snapshots.filter(
      (s) => typeof s.totalSessionCount === "number" && (s.totalSessionCount as number) > 0,
    ).length;
    const firstQuizAttempt = snapshots.filter(
      (s) => typeof s.totalQuizAttempts === "number" && (s.totalQuizAttempts as number) > 0,
    ).length;
    const firstQuizPass = snapshots.filter(
      (s) => typeof s.totalQuizPasses === "number" && (s.totalQuizPasses as number) > 0,
    ).length;

    // Deeper steps (commitment, AI feedback) require event log lookup.
    // For solo-founder scale, sample top-100 most recent users.
    const recentUserIds = snapshots
      .filter((s) => typeof s.userId === "string")
      .map((s) => ({
        userId: s.userId as string,
        firstSeenAt: typeof s.firstSeenAt === "string" ? s.firstSeenAt : "",
      }))
      .sort((a, b) => b.firstSeenAt.localeCompare(a.firstSeenAt))
      .slice(0, 100)
      .map((s) => s.userId);

    let firstCommitment = 0;
    let firstAiFeedback = 0;
    // Behavior-loop TAIL (feedback #8): what happens AFTER first commitment.
    // Per-user PRESENCE (breadth) counts — a user with multiple followup_completed
    // counts once. `returned` = any followup_completed (regardless of `helped`);
    // `reportedHelped` = helped==="helped" ONLY (absent/partly/didnt are returned-
    // but-not-helped); `applied` = application_complete (0 if the type is absent).
    let returned = 0;
    let reportedHelped = 0;
    let applied = 0;
    const sampleSize = recentUserIds.length;
    if (sampleSize > 0) {
      const eventChecks = await Promise.all(
        recentUserIds.map((id) =>
          getUserEvents(analyticsTable, id, 200).catch(() => [] as Record<string, unknown>[]),
        ),
      );
      for (const events of eventChecks) {
        // crude: scan event types
        const types = new Set(events.map((e) => String(e.eventType ?? "")));
        // Canonical commitment-funnel event names (analyticsTrackCommitment):
        // commitment_created | followup_completed | followup_skipped. "first
        // commitment" = the user saved a plan, so commitment_created is the
        // sufficient signal. (The old "commitment_followup" clause referenced a
        // notification type that is never emitted as an analytics event.)
        if (types.has("commitment_created")) firstCommitment += 1;
        if (types.has("ai_feedback_requested") || types.has("reflection_feedback")) firstAiFeedback += 1;
      }
      // Tail counts (per-user dedup + the helped/application_complete rules) live in
      // the pure funnels-tail-core so they stay unit-testable.
      const tail = countFunnelTail(eventChecks);
      // Apply the SAME single scale factor (total / sampleSize) the head-of-funnel
      // commitment step uses, so head and tail share one estimate basis.
      firstCommitment = scaleFunnelCount(firstCommitment, sampleSize, total);
      firstAiFeedback = scaleFunnelCount(firstAiFeedback, sampleSize, total);
      returned = scaleFunnelCount(tail.returned, sampleSize, total);
      reportedHelped = scaleFunnelCount(tail.reportedHelped, sampleSize, total);
      applied = scaleFunnelCount(tail.applied, sampleSize, total);
    }

    const steps: FunnelStep[] = [
      { key: "signup", label: "Signed up", count: total, pct: 100 },
      { key: "onboarded", label: "Completed onboarding", count: onboarded, pct: pct(onboarded, total) },
      { key: "first_reading", label: "First reading session", count: firstReading, pct: pct(firstReading, total) },
      { key: "first_quiz", label: "First quiz attempt", count: firstQuizAttempt, pct: pct(firstQuizAttempt, total) },
      { key: "first_pass", label: "First quiz pass", count: firstQuizPass, pct: pct(firstQuizPass, total) },
      { key: "first_commitment", label: "First commitment (est.)", count: firstCommitment, pct: pct(firstCommitment, total) },
      // Behavior-loop tail (feedback #8). Per-USER (breadth), same scale factor as above.
      { key: "returned", label: "Returned & reported (est.)", count: returned, pct: pct(returned, total) },
      { key: "reported_helped", label: "Reported it helped (est.)", count: reportedHelped, pct: pct(reportedHelped, total) },
      { key: "applied", label: "Applied a chapter (est.)", count: applied, pct: pct(applied, total) },
      { key: "first_ai_fb", label: "First AI feedback (est.)", count: firstAiFeedback, pct: pct(firstAiFeedback, total) },
    ];

    return bookOk({
      generatedAt: new Date().toISOString(),
      total,
      steps,
      warnings,
    });
  });
}

function pct(n: number, total: number): number {
  return total > 0 ? Math.round((n / total) * 100) : 0;
}
