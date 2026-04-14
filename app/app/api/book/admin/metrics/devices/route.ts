import "server-only";

import { requireAdminUser } from "@/app/app/api/book/_lib/admin-auth";
import { bookOk, bookErr, withBookApiErrors } from "@/app/app/api/book/_lib/http";
import { getBookAnalyticsTableName } from "@/app/app/api/book/_lib/env";
import {
  bucketDeviceFields,
  scanAllUserSnapshots,
} from "@/app/app/api/book/_lib/admin-metrics";

export const runtime = "nodejs";

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
        "deviceType, browserName, osName, totalSessionCount, lastActiveAt",
      );
    } catch (err) {
      console.warn("[admin-devices] snapshot scan failed:", err);
      warnings.push("Device data unavailable (database scan failed).");
    }

    const buckets = bucketDeviceFields(
      snapshots.map((s) => ({
        deviceType: typeof s.deviceType === "string" ? s.deviceType : undefined,
        browserName: typeof s.browserName === "string" ? s.browserName : undefined,
        osName: typeof s.osName === "string" ? s.osName : undefined,
      })),
    );

    // Mobile vs desktop ratio for KPI tile
    const mobile = buckets.deviceType.find((d) => d.key === "mobile")?.count ?? 0;
    const desktop = buckets.deviceType.find((d) => d.key === "desktop")?.count ?? 0;
    const tablet = buckets.deviceType.find((d) => d.key === "tablet")?.count ?? 0;
    const totalKnown = mobile + desktop + tablet;
    const mobilePct = totalKnown > 0 ? Math.round((mobile / totalKnown) * 100) : 0;

    return bookOk({
      generatedAt: new Date().toISOString(),
      total: snapshots.length,
      mobilePct,
      buckets,
      warnings,
    });
  });
}
