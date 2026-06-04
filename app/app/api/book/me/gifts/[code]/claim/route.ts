import "server-only";

import { requireUser } from "@/app/app/api/_lib/auth";
import { getBookTableName } from "@/app/app/api/book/_lib/env";
import { BookApiError, transactionCancellationReasons } from "@/app/app/api/book/_lib/errors";
import { bookOk, withBookApiErrors } from "@/app/app/api/book/_lib/http";
import {
  bookUserPk,
  entitlementSk,
  giftCodePk,
  giftCodeSk,
  nowIso,
} from "@/app/app/api/book/_lib/keys";
import { GetCommand, TransactWriteCommand } from "@aws-sdk/lib-dynamodb";
import { ddbDoc } from "@/app/app/api/_lib/aws";

export const runtime = "nodejs";

const PRO_DAYS = 7;

export async function POST(
  req: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  return withBookApiErrors(req, async () => {
    const user = await requireUser();
    const { code } = await params;
    const normalizedCode = code.toUpperCase();

    const tableName = await getBookTableName();

    // Look up the gift code.
    const codeRes = await ddbDoc.send(
      new GetCommand({
        TableName: tableName,
        Key: { PK: giftCodePk(), SK: giftCodeSk(normalizedCode) },
      })
    );
    const gift = codeRes.Item;
    if (!gift) {
      throw new BookApiError(404, "gift_not_found", "Gift code not found.");
    }
    if (gift.status === "redeemed") {
      throw new BookApiError(400, "already_redeemed", "This gift code has already been redeemed.");
    }
    if (gift.status === "expired") {
      throw new BookApiError(400, "gift_expired", "This gift code has expired.");
    }
    if (gift.giverUserId === user.sub) {
      throw new BookApiError(400, "self_redeem", "You cannot redeem your own gift code.");
    }

    const now = nowIso();
    const proExpires = new Date(Date.now() + PRO_DAYS * 24 * 60 * 60 * 1000).toISOString();

    // Atomically: mark code as redeemed + grant Pro to the claimant.
    try {
      await ddbDoc.send(
        new TransactWriteCommand({
          TransactItems: [
            {
              Update: {
                TableName: tableName,
                Key: { PK: giftCodePk(), SK: giftCodeSk(normalizedCode) },
                UpdateExpression:
                  "SET #status = :redeemed, redeemedBy = :userId, redeemedAt = :now",
                ConditionExpression: "#status = :available",
                ExpressionAttributeNames: { "#status": "status" },
                ExpressionAttributeValues: {
                  ":redeemed": "redeemed",
                  ":available": "available",
                  ":userId": user.sub,
                  ":now": now,
                },
              },
            },
            {
              Update: {
                TableName: tableName,
                Key: {
                  PK: bookUserPk(user.sub),
                  SK: entitlementSk(),
                },
                UpdateExpression:
                  "SET #plan = :proPlan, proStatus = :active, proSource = :giftSource, currentPeriodEnd = :expires, updatedAt = :now, freeBookSlots = if_not_exists(freeBookSlots, :defaultSlots), unlockedBookIds = if_not_exists(unlockedBookIds, :emptySet)",
                // Never overwrite an active paid Stripe subscription with a gift
                // grant — that would flip proSource off "stripe" while Stripe keeps
                // billing, leaving the account unreconcilable. proSource is only
                // ever "stripe" while a sub is active/retrying (cleared to null on
                // cancellation), so this allows free/license/flow_points/gift users.
                ConditionExpression: "attribute_not_exists(proSource) OR proSource <> :stripeSource",
                ExpressionAttributeNames: { "#plan": "plan" },
                ExpressionAttributeValues: {
                  ":proPlan": "PRO",
                  ":active": "active",
                  ":giftSource": "gift_code",
                  ":stripeSource": "stripe",
                  ":expires": proExpires,
                  ":now": now,
                  ":defaultSlots": 2,
                  ":emptySet": new Set<string>(),
                },
              },
            },
          ],
        })
      );
    } catch (error: unknown) {
      const reasons = transactionCancellationReasons(error);
      if (reasons) {
        // Index 0 = the gift code itself. The code being gone takes priority over
        // the claimant's plan state, so report it first even if both items failed.
        if (reasons[0]?.Code === "ConditionalCheckFailed") {
          throw new BookApiError(
            400,
            "already_redeemed",
            "This gift code has already been redeemed."
          );
        }
        // Index 1 = entitlement guard: claimant has an active paid Stripe sub.
        if (reasons[1]?.Code === "ConditionalCheckFailed") {
          throw new BookApiError(
            409,
            "active_subscription",
            "You already have an active paid subscription. Gift codes are for free-pass access only — manage your subscription from billing settings."
          );
        }
        // Cancellation with no item-specific reason — preserve historical default.
        throw new BookApiError(
          400,
          "already_redeemed",
          "This gift code has already been redeemed."
        );
      }
      throw error;
    }

    return bookOk({
      redeemed: true,
      giftType: gift.giftType ?? "pro_week",
      proDays: PRO_DAYS,
      proExpiresAt: proExpires,
      message: `You've been gifted ${PRO_DAYS} days of Pro access!`,
    });
  });
}
