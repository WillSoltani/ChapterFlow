import "server-only";

// Implements §9.4 — Admin adjustment mechanism.
// POST /api/book/admin/insight-points/adjust
// Capped at ±10,000 IP. Requires admin auth. All adjustments logged.

import { requireAdminUser } from "@/app/app/api/book/_lib/admin-auth";
import { TransactWriteCommand } from "@aws-sdk/lib-dynamodb";
import { ddbDoc } from "@/app/app/api/_lib/aws";
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
  bookUserPk,
  engagementSk,
  flowPointsLedgerSk,
  nowIso,
} from "@/app/app/api/book/_lib/keys";
import { getUserFlowPointsState } from "@/app/app/api/book/_lib/flow-points-repo";

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
    const now = nowIso();
    const transactionId = crypto.randomUUID();

    const isPositive = amount > 0;
    const absAmount = Math.abs(amount);

    // Atomic: update engagement + create ledger entry
    try {
      await ddbDoc.send(
        new TransactWriteCommand({
          TransactItems: [
            {
              Update: {
                TableName: tableName,
                Key: { PK: bookUserPk(userId), SK: engagementSk() },
                UpdateExpression: isPositive
                  ? "SET entity = :entity, userId = :userId, createdAt = if_not_exists(createdAt, :now), updatedAt = :now ADD points :delta, lifetimeEarned :posDelta, totalEarnEvents :one"
                  : "SET entity = :entity, userId = :userId, createdAt = if_not_exists(createdAt, :now), updatedAt = :now ADD points :delta, lifetimeSpent :absDelta, totalSpendEvents :one",
                ...(isPositive
                  ? {}
                  : { ConditionExpression: "attribute_exists(points) AND points >= :absDelta" }),
                ExpressionAttributeValues: {
                  ":entity": "BOOK_USER_ENGAGEMENT",
                  ":userId": userId,
                  ":now": now,
                  ":delta": amount,
                  ...(isPositive
                    ? { ":posDelta": absAmount, ":one": 1 }
                    : { ":absDelta": absAmount, ":one": 1 }),
                },
              },
            },
            {
              Put: {
                TableName: tableName,
                Item: {
                  PK: bookUserPk(userId),
                  SK: flowPointsLedgerSk(now, transactionId),
                  entity: "BOOK_USER_FLOW_POINTS_LEDGER",
                  userId,
                  transactionId,
                  direction: "adjustment",
                  amount: absAmount,
                  sourceType: "admin_adjustment",
                  sourceId: `admin:${admin.sub}:${transactionId}`,
                  metadata: {
                    reason,
                    adminUserId: admin.sub,
                    adminEmail: admin.email,
                    originalAmount: amount,
                  },
                  createdAt: now,
                  updatedAt: now,
                },
                ConditionExpression: "attribute_not_exists(PK) AND attribute_not_exists(SK)",
              },
            },
          ],
        })
      );
    } catch (error: unknown) {
      if (
        error &&
        typeof error === "object" &&
        (error as Record<string, unknown>).name === "TransactionCanceledException"
      ) {
        throw new BookApiError(
          400,
          "insufficient_balance",
          "User does not have enough points for this deduction."
        );
      }
      throw error;
    }

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
