import "server-only";

import { ScanCommand } from "@aws-sdk/lib-dynamodb";
import { ddbDoc } from "@/app/app/api/_lib/aws";
import { requireAdminUser } from "@/app/app/api/book/_lib/admin-auth";
import { bookOk, bookErr, withBookApiErrors } from "@/app/app/api/book/_lib/http";
import { getBookAnalyticsTableName, getBookTableName } from "@/app/app/api/book/_lib/env";
import { ADMIN_SCAN_MAX_ITEMS } from "@/app/app/api/book/_lib/admin-metrics";

export const runtime = "nodejs";

const REFERRAL_SOURCE_KEYS = [
  "Social media",
  "Word of mouth",
  "Search engine",
  "Newsletter",
  "Other",
];

export async function GET(req: Request) {
  return withBookApiErrors(req, async () => {
    await requireAdminUser();
    const tableName = await getBookTableName();
    const analyticsTable = await getBookAnalyticsTableName();
    if (!analyticsTable) {
      return bookErr(req, 503, "analytics_unavailable", "Analytics table not configured.");
    }

    const warnings: string[] = [];

    // Aggregate referralSource from user profiles (free-form survey at onboarding)
    const referralCounts = new Map<string, number>();
    let lastKey: Record<string, unknown> | undefined;
    let totalProfiles = 0;
    try {
      do {
        const res = await ddbDoc.send(
          new ScanCommand({
            TableName: tableName,
            FilterExpression: "entity = :e",
            ExpressionAttributeValues: { ":e": "BOOK_USER_PROFILE" },
            ProjectionExpression: "profile",
            ExclusiveStartKey: lastKey,
            Limit: 1000,
          }),
        );
        for (const item of res.Items ?? []) {
          totalProfiles += 1;
          const profile = item.profile as Record<string, unknown> | undefined;
          const src = typeof profile?.referralSource === "string" ? profile.referralSource : null;
          if (src) referralCounts.set(src, (referralCounts.get(src) ?? 0) + 1);
        }
        lastKey = res.LastEvaluatedKey;
      } while (lastKey && totalProfiles < ADMIN_SCAN_MAX_ITEMS);
      if (lastKey) {
        warnings.push(
          `Profile data sampled (scan capped at ${ADMIN_SCAN_MAX_ITEMS} profiles).`,
        );
      }
    } catch (err) {
      console.warn("[admin-acquisition] profile scan failed:", err);
      warnings.push("Profile data unavailable (database scan failed).");
    }

    const referralSources = REFERRAL_SOURCE_KEYS.map((label) => ({
      label,
      count: referralCounts.get(label) ?? 0,
    })).sort((a, b) => b.count - a.count);

    const totalSurveyed = referralSources.reduce((s, r) => s + r.count, 0);

    return bookOk({
      generatedAt: new Date().toISOString(),
      totalProfiles,
      totalSurveyed,
      referralSources,
      warnings,
      // UTM/referer breakdowns will populate as users sign up under
      // the new tracking (Phase 3 instrumentation just shipped).
      utmCampaigns: [],
      topReferrers: [],
    });
  });
}
