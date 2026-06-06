import "server-only";

import { requireActiveBookUser } from "@/app/app/api/book/_lib/account-guard";
import {
  bookOk,
  requireBodyObject,
  requireString,
  withBookApiErrors,
} from "@/app/app/api/book/_lib/http";
import { getBookTableName, getBookAnalyticsTableName } from "@/app/app/api/book/_lib/env";
import { BookApiError } from "@/app/app/api/book/_lib/errors";
import { listBadgeAwards, putBadgeAward } from "@/app/app/api/book/_lib/repo";
import { analyticsTrackBadge } from "@/app/app/api/book/_lib/analytics-repo";
import { getBadgeName } from "@/app/book/_lib/flow-points-economy";

export const runtime = "nodejs";

// NOTE: Badges are cosmetic-only. IP for achievements is awarded server-side
// in the loop pipeline via checkAchievementsAfterLoopComplete (achievement-repo.ts).
// This endpoint records the cosmetic badge display state but never grants IP —
// the client cannot be trusted to claim arbitrary badge IDs.

export async function GET(req: Request) {
  return withBookApiErrors(req, async () => {
    const user = await requireActiveBookUser();
    const tableName = await getBookTableName();
    const awards = await listBadgeAwards(tableName, user.sub);
    return bookOk({ awards });
  });
}

export async function PUT(req: Request) {
  return withBookApiErrors(req, async () => {
    const user = await requireActiveBookUser();
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
    const badgeName = getBadgeName(badgeId);
    if (!badgeName) {
      throw new BookApiError(400, "invalid_badge", "Unknown badge.");
    }

    const created = await putBadgeAward(tableName, {
      userId: user.sub,
      badgeId,
      earnedAt,
      tier,
    });

    if (created) {
      // Cosmetic-only analytics — no IP transaction is logged here.
      getBookAnalyticsTableName()
        .then((analyticsTable) => {
          if (!analyticsTable) return;
          return analyticsTrackBadge(analyticsTable, {
            userId: user.sub,
            badgeId,
            tier,
            earnedAt,
            pointsAwarded: 0,
          });
        })
        .catch(() => {});
    }

    return bookOk({ ok: true, created });
  });
}
