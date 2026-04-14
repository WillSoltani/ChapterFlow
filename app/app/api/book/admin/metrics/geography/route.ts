import "server-only";

import { requireAdminUser } from "@/app/app/api/book/_lib/admin-auth";
import { bookOk, bookErr, withBookApiErrors } from "@/app/app/api/book/_lib/http";
import { getBookAnalyticsTableName } from "@/app/app/api/book/_lib/env";
import { scanAllUserSnapshots } from "@/app/app/api/book/_lib/admin-metrics";

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
        "userId, countryCode, countryName, regionCode, regionName, city, viewerTimezone, plan, lastActiveAt",
      );
    } catch (err) {
      console.warn("[admin-geography] scan failed:", err);
      warnings.push("Geography data unavailable (database scan failed).");
    }

    const total = snapshots.length;
    const totalWithLoc = snapshots.filter(
      (s) => typeof s.countryCode === "string" && (s.countryCode as string).length > 0,
    ).length;

    // Country aggregates
    const countryMap = new Map<
      string,
      { code: string; name: string; count: number; pro: number; freeUsers: number; activeRecent: number }
    >();
    const cityMap = new Map<string, { city: string; country: string; count: number }>();
    const tzMap = new Map<string, number>();

    const sevenDaysAgo = Date.now() - 7 * 86_400_000;

    for (const s of snapshots) {
      const code = typeof s.countryCode === "string" ? s.countryCode : null;
      const name = typeof s.countryName === "string" ? s.countryName : null;
      const city = typeof s.city === "string" ? s.city : null;
      const tz = typeof s.viewerTimezone === "string" ? s.viewerTimezone : null;
      const plan = typeof s.plan === "string" ? s.plan : "FREE";
      const lastActive =
        typeof s.lastActiveAt === "string" ? new Date(s.lastActiveAt).getTime() : 0;

      if (code) {
        const entry =
          countryMap.get(code) ??
          { code, name: name ?? code, count: 0, pro: 0, freeUsers: 0, activeRecent: 0 };
        entry.count += 1;
        if (plan === "PRO") entry.pro += 1;
        else entry.freeUsers += 1;
        if (lastActive >= sevenDaysAgo) entry.activeRecent += 1;
        countryMap.set(code, entry);
      }

      if (city && code) {
        const key = `${code}::${city}`;
        const cityEntry =
          cityMap.get(key) ?? { city, country: code, count: 0 };
        cityEntry.count += 1;
        cityMap.set(key, cityEntry);
      }

      if (tz) {
        tzMap.set(tz, (tzMap.get(tz) ?? 0) + 1);
      }
    }

    const countries = Array.from(countryMap.values()).sort((a, b) => b.count - a.count);
    const topCities = Array.from(cityMap.values()).sort((a, b) => b.count - a.count).slice(0, 30);
    const topTimezones = Array.from(tzMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([tz, count]) => ({ tz, count }));

    return bookOk({
      generatedAt: new Date().toISOString(),
      total,
      totalWithLocation: totalWithLoc,
      countries,
      topCities,
      topTimezones,
      warnings,
    });
  });
}
