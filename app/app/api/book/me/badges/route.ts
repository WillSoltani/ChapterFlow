import "server-only";

import { requireUser } from "@/app/app/api/_lib/auth";
import {
  bookOk,
  requireBodyObject,
  requireString,
  withBookApiErrors,
} from "@/app/app/api/book/_lib/http";
import { getBookTableName, getBookAnalyticsTableName } from "@/app/app/api/book/_lib/env";
import { listBadgeAwards, putBadgeAward } from "@/app/app/api/book/_lib/repo";
import { analyticsTrackBadge } from "@/app/app/api/book/_lib/analytics-repo";

export const runtime = "nodejs";

export async function GET(req: Request) {
  return withBookApiErrors(req, async () => {
    const user = await requireUser();
    const tableName = await getBookTableName();
    const awards = await listBadgeAwards(tableName, user.sub);
    return bookOk({ awards });
  });
}

export async function PUT(req: Request) {
  return withBookApiErrors(req, async () => {
    const user = await requireUser();
    const tableName = await getBookTableName();

    let bodyRaw: unknown;
    try {
      bodyRaw = await req.json();
    } catch {
      bodyRaw = {};
    }
    const body = requireBodyObject(bodyRaw);
    const badgeId = requireString(body.badgeId, "badgeId", { maxLength: 120 });
    const earnedAt = requireString(body.earnedAt, "earnedAt", { maxLength: 120 });
    const tier =
      typeof body.tier === "string" && body.tier.trim()
        ? requireString(body.tier, "tier", { maxLength: 40 })
        : undefined;

    await putBadgeAward(tableName, {
      userId: user.sub,
      badgeId,
      earnedAt,
      tier,
    });

    // Analytics — fire-and-forget
    getBookAnalyticsTableName().then((analyticsTable) => {
      if (!analyticsTable) return;
      analyticsTrackBadge(analyticsTable, {
        userId: user.sub,
        badgeId,
        tier,
        earnedAt,
      }).catch(() => {});
    }).catch(() => {});

    return bookOk({ ok: true });
  });
}
