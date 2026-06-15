import "server-only";

import { requireActiveBookUser } from "@/app/app/api/book/_lib/account-guard";
import {
  bookOk,
  requireBodyObject,
  requireString,
  withBookApiErrors,
} from "@/app/app/api/book/_lib/http";
import { getBookTableName, getBookAnalyticsTableName } from "@/app/app/api/book/_lib/env";
import { nowIso } from "@/app/app/api/book/_lib/keys";
import { BookApiError } from "@/app/app/api/book/_lib/errors";
import { listBadgeAwards, putBadgeAward } from "@/app/app/api/book/_lib/repo";
import { analyticsTrackBadge } from "@/app/app/api/book/_lib/analytics-repo";
import { BADGE_DEFINITIONS } from "@/app/book/badges/lib/badge-ui-definitions";

export const runtime = "nodejs";

// NOTE: Badges are cosmetic-only. IP for achievements is awarded server-side
// in the loop pipeline via checkAchievementsAfterLoopComplete (achievement-repo.ts).
// This endpoint records the cosmetic badge display state but never grants IP —
// the client cannot be trusted to claim arbitrary badge IDs.
//
// Hardening (L27): the only client-trusted field is badgeId, and it must match a
// badge in the canonical catalog. earnedAt and tier are derived server-side
// (current time + the badge definition's tier) so a client cannot backdate an
// award or claim a tier it did not earn the right to display.

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

    // The badge must exist in the canonical catalog. We deliberately ignore any
    // client-supplied earnedAt/tier: the client cannot be trusted to backdate an
    // award or claim an arbitrary tier. The display timestamp is the moment the
    // server records the award, and the tier is taken from the badge definition.
    const badgeDefinition = BADGE_DEFINITIONS.find((badge) => badge.id === badgeId);
    if (!badgeDefinition) {
      throw new BookApiError(400, "invalid_badge", "Unknown badge.");
    }

    const earnedAt = nowIso();
    const tier = badgeDefinition.tier;

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
