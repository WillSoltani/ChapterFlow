import "server-only";

import { requireUser } from "@/app/app/api/_lib/auth";
import {
  bookOk,
  requireBodyObject,
  requireString,
  withBookApiErrors,
} from "@/app/app/api/book/_lib/http";
import { getBookTableName, getBookAnalyticsTableName } from "@/app/app/api/book/_lib/env";
import { BookApiError } from "@/app/app/api/book/_lib/errors";
import { listBadgeAwards, putBadgeAward } from "@/app/app/api/book/_lib/repo";
import {
  analyticsTrackBadge,
  analyticsTrackFlowPointsTransaction,
} from "@/app/app/api/book/_lib/analytics-repo";
import { awardFlowPoints } from "@/app/app/api/book/_lib/flow-points-repo";
import {
  getBadgeFlowPoints,
  getBadgeName,
} from "@/app/book/_lib/flow-points-economy";

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
    const badgeName = getBadgeName(badgeId);
    if (!badgeName) {
      throw new BookApiError(400, "invalid_badge", "This badge cannot award Flow Points.");
    }

    const created = await putBadgeAward(tableName, {
      userId: user.sub,
      badgeId,
      earnedAt,
      tier,
    });

    if (created) {
      const badgePoints = getBadgeFlowPoints(badgeId);
      const awarded = await awardFlowPoints(tableName, {
        userId: user.sub,
        amount: badgePoints,
        sourceType: "badge_earned",
        sourceId: badgeId,
        metadata: {
          badgeId,
          badgeName,
        },
        createdAt: earnedAt,
      });

      // Analytics — fire-and-forget
      getBookAnalyticsTableName()
        .then((analyticsTable) => {
          if (!analyticsTable) return;
          return Promise.allSettled([
            analyticsTrackBadge(analyticsTable, {
              userId: user.sub,
              badgeId,
              tier,
              earnedAt,
              pointsAwarded: badgePoints,
            }),
            awarded.awarded
              ? analyticsTrackFlowPointsTransaction(analyticsTable, {
                  userId: user.sub,
                  deltaPoints: badgePoints,
                  direction: "earn",
                  sourceType: "badge_earned",
                  sourceId: badgeId,
                  metadata: {
                    badgeId,
                    badgeName,
                  },
                })
              : Promise.resolve(),
          ]);
        })
        .catch(() => {});
    }

    return bookOk({ ok: true, created });
  });
}
