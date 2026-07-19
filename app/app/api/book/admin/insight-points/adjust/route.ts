import "server-only";

// Implements §9.4 — Admin adjustment mechanism.
// POST /api/book/admin/insight-points/adjust
// Capped at ±10,000 IP. Requires admin auth. All adjustments logged.

import { requireAdminUser } from "@/app/app/api/book/_lib/admin-auth";
import { getBookTableName } from "@/app/app/api/book/_lib/env";
import { BookApiError } from "@/app/app/api/book/_lib/errors";
import {
  bookOk,
  requireBodyObject,
  requireInteger,
  requireString,
  withBookApiErrors,
} from "@/app/app/api/book/_lib/http";
import {
  adjustEngagementPointsAdmin,
  getUserFlowPointsState,
} from "@/app/app/api/book/_lib/flow-points-repo";

export const runtime = "nodejs";

const MAX_ADJUSTMENT = 10_000; // §9.4 — capped at ±10,000

export async function POST(req: Request) {
  return withBookApiErrors(req, async () => {
    // Centralized admin authz (also enforces account lifecycle status). Using
    // the shared helper ensures any future hardening (MFA, a second admin group,
    // step-up auth) automatically covers this money-adjacent endpoint.
    const admin = await requireAdminUser();

    const bodyRaw = await req.json();
    const body = requireBodyObject(bodyRaw);
    const userId = requireString(body.userId, "userId", { maxLength: 200 });
    const amount = requireInteger(body.amount, "amount", {
      min: -MAX_ADJUSTMENT,
      max: MAX_ADJUSTMENT,
    });
    const reason = requireString(body.reason, "reason", { minLength: 10, maxLength: 1000 });

    if (amount === 0) {
      throw new BookApiError(400, "invalid_amount", "Adjustment amount must be non-zero.");
    }

    const tableName = await getBookTableName();

    // Atomic: update engagement + create ledger entry. Extracted verbatim into
    // flow-points-repo.ts (WS3-002) — the TransactWriteCommand shape and the
    // TransactionCanceledException → insufficient_balance mapping are unchanged.
    const { transactionId } = await adjustEngagementPointsAdmin(tableName, {
      userId,
      amount,
      reason,
      adminUserId: admin.sub,
      adminEmail: admin.email,
    });

    // Intentionally do NOT mirror admin adjustments into the analytics snapshot.
    // analyticsTrackFlowPointsTransaction unconditionally stamps the target user's
    // lastActiveAt/updatedAt and emits a flow_points_earned/spent activity event,
    // which would make a dormant/comped/refunded user look active and inflate
    // engagement KPIs (DAU, activeUsersByPlan, retention cohorts, event counts).
    // The authoritative balance + audit trail are the engagement item and ledger
    // entry written above in the main table; back-office grants must not pollute
    // user-engagement metrics. (M16)

    const state = await getUserFlowPointsState(tableName, userId);

    return bookOk({
      ok: true,
      userId,
      amount,
      reason,
      newBalance: state.points,
      transactionId,
      adminUserId: admin.sub,
    });
  });
}
