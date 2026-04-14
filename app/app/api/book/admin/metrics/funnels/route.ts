import "server-only";

import { requireAdminUser } from "@/app/app/api/book/_lib/admin-auth";
import { bookOk, bookErr, withBookApiErrors } from "@/app/app/api/book/_lib/http";
import { getBookAnalyticsTableName } from "@/app/app/api/book/_lib/env";
import {
  getUserEvents,
  scanAllUserSnapshots,
} from "@/app/app/api/book/_lib/admin-metrics";

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
    if (recentUserIds.length > 0) {
      const eventChecks = await Promise.all(
        recentUserIds.map((id) =>
          getUserEvents(analyticsTable, id, 200).catch(() => [] as Record<string, unknown>[]),
        ),
      );
      for (const events of eventChecks) {
        // crude: scan event types
        const types = new Set(events.map((e) => String(e.eventType ?? "")));
        if (types.has("commitment_created") || types.has("commitment_followup")) firstCommitment += 1;
        if (types.has("ai_feedback_requested") || types.has("reflection_feedback")) firstAiFeedback += 1;
      }
      // Scale up to estimate full population
      if (recentUserIds.length < total) {
        const factor = total / recentUserIds.length;
        firstCommitment = Math.round(firstCommitment * factor);
        firstAiFeedback = Math.round(firstAiFeedback * factor);
      }
    }

    const steps: FunnelStep[] = [
      { key: "signup", label: "Signed up", count: total, pct: 100 },
      { key: "onboarded", label: "Completed onboarding", count: onboarded, pct: pct(onboarded, total) },
      { key: "first_reading", label: "First reading session", count: firstReading, pct: pct(firstReading, total) },
      { key: "first_quiz", label: "First quiz attempt", count: firstQuizAttempt, pct: pct(firstQuizAttempt, total) },
      { key: "first_pass", label: "First quiz pass", count: firstQuizPass, pct: pct(firstQuizPass, total) },
      { key: "first_commitment", label: "First commitment (est.)", count: firstCommitment, pct: pct(firstCommitment, total) },
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
