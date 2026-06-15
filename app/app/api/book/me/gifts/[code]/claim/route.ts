import "server-only";

import { requireActiveBookUser } from "@/app/app/api/book/_lib/account-guard";
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
import { GIFT_PRO_DAYS } from "../../_constants";

export const runtime = "nodejs";

const PRO_DAYS = GIFT_PRO_DAYS;

export async function POST(
  req: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  return withBookApiErrors(req, async () => {
    const user = await requireActiveBookUser();
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
                // unlockedBookIds is created lazily by reserveBookEntitlement's ADD;
                // do not initialize it here (an empty Set can no longer be marshalled
                // now that convertEmptyValues is off, and initializing it to NULL is
                // what broke the later `ADD unlockedBookIds :bookSet`).
                UpdateExpression:
                  "SET #plan = :proPlan, proStatus = :active, proSource = :giftSource, currentPeriodEnd = :expires, updatedAt = :now, freeBookSlots = if_not_exists(freeBookSlots, :defaultSlots)",
                // Apply the gift only when it does not shorten or destroy a
                // longer-lived Pro grant. Either the user has no active PRO grant
                // (so the gift simply starts/refreshes access), OR every existing
                // grant's effective expiry is strictly shorter than the gift's:
                //  - stripe: never overwrite an active paid sub — that flips
                //    proSource off "stripe" while Stripe keeps billing, leaving
                //    the account unreconcilable (proSource is only ever "stripe"
                //    while a sub is active/retrying, cleared to null on cancel).
                //  - admin: open-ended grant that never time-expires; a 7-day
                //    gift would always shorten it, so never overwrite it.
                //  - license: expiry lives in licenseExpiresAt — apply only if
                //    the gift outlasts it (a stale licenseExpiresAt in the past
                //    is < :expires, so an expired license is refreshable).
                //  - flow_points / gift_code: expiry lives in currentPeriodEnd —
                //    apply only if the gift outlasts it.
                // Because the guard requires the gift to outlast any existing
                // expiry, the unconditional `currentPeriodEnd = :expires` above is
                // always the max of (existing, new).
                // NOTE: licenseExpiresAt / currentPeriodEnd may be stored as a
                // DynamoDB NULL (e.g. redeemFlowPointsReward writes
                // licenseExpiresAt = null), where attribute_not_exists is false but
                // the value carries no expiry. Treat NULL as "no constraint from
                // this field" via attribute_type(..., :nullType) so a flow_points/
                // license user can still apply a gift that extends a shorter or
                // already-expired grant.
                // Spec + truth-table tests: _lib/pro-grant-guard-core.ts (keep in sync).
                ConditionExpression:
                  "(attribute_not_exists(#plan) OR #plan <> :proPlan) OR ((attribute_not_exists(proSource) OR proSource <> :stripeSource) AND (attribute_not_exists(proSource) OR proSource <> :adminSource) AND (attribute_not_exists(licenseExpiresAt) OR attribute_type(licenseExpiresAt, :nullType) OR licenseExpiresAt < :expires) AND (attribute_not_exists(currentPeriodEnd) OR attribute_type(currentPeriodEnd, :nullType) OR currentPeriodEnd < :expires))",
                ExpressionAttributeNames: { "#plan": "plan" },
                ExpressionAttributeValues: {
                  ":proPlan": "PRO",
                  ":active": "active",
                  ":giftSource": "gift_code",
                  ":stripeSource": "stripe",
                  ":adminSource": "admin",
                  ":expires": proExpires,
                  ":now": now,
                  ":defaultSlots": 2,
                  ":nullType": "NULL",
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
        // Index 1 = entitlement guard: the claim would clobber/shorten an
        // existing Pro grant. The guard fires for an active paid Stripe sub OR
        // for any longer-lived non-stripe grant (admin/license/flow_points/
        // gift_code). Re-read the entitlement to report the accurate reason.
        if (reasons[1]?.Code === "ConditionalCheckFailed") {
          const entRes = await ddbDoc.send(
            new GetCommand({
              TableName: tableName,
              Key: { PK: bookUserPk(user.sub), SK: entitlementSk() },
            })
          );
          if (entRes.Item?.proSource === "stripe") {
            throw new BookApiError(
              409,
              "active_subscription",
              "You already have an active paid subscription. Gift codes are for free-pass access only — manage your subscription from billing settings."
            );
          }
          throw new BookApiError(
            409,
            "longer_grant_active",
            "You already have Pro access that lasts longer than this gift, so the gift was not applied. Save it for when your current access ends or share it with a friend."
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
