// Data-access seam for gift codes (WS3-002). Moved verbatim out of
// me/gifts/[code]/route.ts (GET preview) and me/gifts/[code]/claim/route.ts
// (POST redeem): the DynamoDB command construction+send, the redeem
// transaction, and its TransactionCanceledException → typed BookApiError
// mapping are unchanged.

import "server-only";

import { GetCommand, TransactWriteCommand } from "@aws-sdk/lib-dynamodb";
import { ddbDoc } from "@/app/app/api/_lib/aws";
import { bookUserPk, entitlementSk, giftCodePk, giftCodeSk } from "@/app/app/api/book/_lib/keys";
import { BookApiError, transactionCancellationReasons } from "@/app/app/api/book/_lib/errors";
import {
  grantUpgradeConditionExpression,
  GRANT_UPGRADE_CONDITION_NAMES,
  GRANT_UPGRADE_CONDITION_VALUES,
} from "@/app/app/api/book/_lib/pro-grant-guard-core";

/** Raw gift-code item lookup, shared by the GET preview and the claim route. */
export async function getGiftCode(
  tableName: string,
  normalizedCode: string
): Promise<Record<string, unknown> | null> {
  const res = await ddbDoc.send(
    new GetCommand({
      TableName: tableName,
      Key: { PK: giftCodePk(), SK: giftCodeSk(normalizedCode) },
    })
  );
  return (res.Item as Record<string, unknown> | undefined) ?? null;
}

/**
 * Atomically mark a gift code as redeemed and grant Pro to the claimant.
 * Moved verbatim from me/gifts/[code]/claim/route.ts, including the
 * TransactionCanceledException → typed BookApiError mapping (already-redeemed,
 * dispute-hold, active-subscription, longer-grant-active) and the follow-up
 * entitlement re-read used to pick the accurate reason.
 */
export async function redeemGiftCode(
  tableName: string,
  params: {
    normalizedCode: string;
    userId: string;
    now: string;
    proExpires: string;
  }
): Promise<void> {
  try {
    await ddbDoc.send(
      new TransactWriteCommand({
        TransactItems: [
          {
            Update: {
              TableName: tableName,
              Key: { PK: giftCodePk(), SK: giftCodeSk(params.normalizedCode) },
              UpdateExpression:
                "SET #status = :redeemed, redeemedBy = :userId, redeemedAt = :now",
              ConditionExpression: "#status = :available",
              ExpressionAttributeNames: { "#status": "status" },
              ExpressionAttributeValues: {
                ":redeemed": "redeemed",
                ":available": "available",
                ":userId": params.userId,
                ":now": params.now,
              },
            },
          },
          {
            Update: {
              TableName: tableName,
              Key: {
                PK: bookUserPk(params.userId),
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
              ConditionExpression: grantUpgradeConditionExpression(":expires"),
              ExpressionAttributeNames: { ...GRANT_UPGRADE_CONDITION_NAMES },
              ExpressionAttributeValues: {
                ...GRANT_UPGRADE_CONDITION_VALUES,
                ":active": "active",
                ":giftSource": "gift_code",
                ":expires": params.proExpires,
                ":now": params.now,
                ":defaultSlots": 2,
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
            Key: { PK: bookUserPk(params.userId), SK: entitlementSk() },
          })
        );
        // Sticky chargeback hold (C3): an unresolved dispute blocks every PRO
        // (re)grant, including this gift, until dispute.closed(won) clears the
        // marker. Reported first — it takes priority over plan/expiry state.
        if (entRes.Item?.disputeOpen) {
          throw new BookApiError(
            409,
            "dispute_hold",
            "Your account is on hold pending resolution of a payment dispute, so the gift could not be applied. Once the dispute is resolved you can redeem it."
          );
        }
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
}
