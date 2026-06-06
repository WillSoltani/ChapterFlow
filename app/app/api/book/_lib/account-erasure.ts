import "server-only";

import { QueryCommand, BatchWriteCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import {
  CognitoIdentityProviderClient,
  ListUsersCommand,
  AdminDeleteUserCommand,
} from "@aws-sdk/client-cognito-identity-provider";
import { ddbDoc, REGION } from "@/app/app/api/_lib/aws";
import { getServerEnv } from "@/app/app/api/_lib/server-env";
import {
  bookUserPk,
  quizAttemptPk,
  stripeCustomerPk,
  stripeCustomerSk,
  pairInvitePk,
  pairInviteSk,
  erasureLogPk,
  erasureLogSk,
  nowIso,
} from "./keys";
import { getStripeClient } from "./stripe-service";
import { getUserEntitlement } from "./repo";
import { recordOpsFailure } from "./ops-failure-repo";
import { putOpsMetric } from "./cloudwatch-metrics";

type DdbKey = { PK: string; SK: string };

/** Outcome of a per-store erasure step. */
type StepOutcome = "deleted" | "skipped" | "failed";

export type ErasureResult = {
  userId: string;
  erasedAt: string;
  erasedBy: string;
  mainItemsDeleted: number;
  quizAttemptPartitions: number;
  quizAttemptItemsDeleted: number;
  analyticsItemsDeleted: number;
  pairInviteItemsDeleted: number;
  stripeCustomer: StepOutcome;
  cognitoUser: StepOutcome;
  /** Items that survived all BatchWrite retries — they were NOT deleted. */
  unprocessedItems: number;
  /** True if any step failed or left undeleted items. The erasure was incomplete. */
  partial: boolean;
  /** Things a full erasure could not reach automatically — for the operator. */
  residualWarnings: string[];
};

/** Query EVERY item under a single partition key (handles pagination). */
async function queryAllItems(
  tableName: string,
  pk: string
): Promise<Record<string, unknown>[]> {
  const items: Record<string, unknown>[] = [];
  let ExclusiveStartKey: Record<string, unknown> | undefined;
  do {
    const res = await ddbDoc.send(
      new QueryCommand({
        TableName: tableName,
        KeyConditionExpression: "PK = :pk",
        ExpressionAttributeValues: { ":pk": pk },
        ExclusiveStartKey,
      })
    );
    for (const it of res.Items ?? []) items.push(it);
    ExclusiveStartKey = res.LastEvaluatedKey as Record<string, unknown> | undefined;
  } while (ExclusiveStartKey);
  return items;
}

/**
 * Delete keys in chunks of 25, retrying UnprocessedItems a few times.
 * Returns BOTH the count actually deleted and the count that survived all
 * retries (still in the table). A non-zero `unprocessed` means the erasure is
 * incomplete — callers MUST surface it, never report it as deleted.
 */
async function batchDeleteKeys(
  tableName: string,
  keys: DdbKey[]
): Promise<{ deleted: number; unprocessed: number }> {
  let deleted = 0;
  let unprocessed = 0;
  for (let i = 0; i < keys.length; i += 25) {
    const chunk = keys.slice(i, i + 25);
    let requestItems: Record<string, { DeleteRequest: { Key: DdbKey } }[]> = {
      [tableName]: chunk.map((Key) => ({ DeleteRequest: { Key } })),
    };
    let remaining = chunk.length;
    for (let attempt = 0; attempt < 4; attempt++) {
      const pending = requestItems[tableName]?.length ?? 0;
      if (pending === 0) {
        remaining = 0;
        break;
      }
      const res = await ddbDoc.send(new BatchWriteCommand({ RequestItems: requestItems }));
      const leftover = (res.UnprocessedItems ?? {}) as typeof requestItems;
      remaining = leftover[tableName]?.length ?? 0;
      deleted += pending - remaining;
      requestItems = remaining ? leftover : { [tableName]: [] };
    }
    // Whatever is still pending after the final retry was NOT deleted.
    unprocessed += remaining;
  }
  return { deleted, unprocessed };
}

function asKeys(items: Record<string, unknown>[]): DdbKey[] {
  return items
    .filter((it) => typeof it.PK === "string" && typeof it.SK === "string")
    .map((it) => ({ PK: it.PK as string, SK: it.SK as string }));
}

/**
 * Derive the quiz-attempt partitions for a user from their QUIZSTATE# items.
 * The SK shape is `QUIZSTATE#<bookId>#<paddedChapter>` (see `quizStateSk`). We
 * match the trailing digit group as the chapter and treat everything between as
 * the bookId — a greedy capture so a bookId that itself contains "#" still
 * reconstructs the exact same `quizAttemptPk` the attempts were written under.
 */
function quizAttemptPksFromUserItems(userId: string, items: Record<string, unknown>[]): string[] {
  const pks = new Set<string>();
  for (const it of items) {
    const sk = typeof it.SK === "string" ? it.SK : "";
    const match = /^QUIZSTATE#(.+)#(\d+)$/.exec(sk);
    if (!match) continue;
    const bookId = match[1];
    const chapter = Number(match[2]);
    if (bookId && Number.isFinite(chapter)) {
      pks.add(quizAttemptPk(userId, bookId, chapter));
    }
  }
  return [...pks];
}

/** Pair-invite reverse-index items (keyed by code) referenced from the user partition. */
function pairInviteKeysFromUserItems(items: Record<string, unknown>[]): DdbKey[] {
  const codes = new Set<string>();
  for (const it of items) {
    if (typeof it.inviteCode === "string" && it.inviteCode.trim()) codes.add(it.inviteCode.trim());
  }
  return [...codes].map((code) => ({ PK: pairInvitePk(code), SK: pairInviteSk() }));
}

let cognitoClient: CognitoIdentityProviderClient | null = null;
function getCognito(): CognitoIdentityProviderClient {
  if (!cognitoClient) cognitoClient = new CognitoIdentityProviderClient({ region: REGION });
  return cognitoClient;
}

/**
 * Permanently erase ALL of a user's data we can reach: the user's main-table
 * partition, their derived quiz-attempt partitions, their analytics partition,
 * the Stripe customer (and reverse map), and the Cognito user. Irreversible.
 *
 * Best-effort on external systems (Stripe/Cognito): a failure there is recorded
 * as an ops-failure (and a CloudWatch metric) and reported in the result rather
 * than aborting — partial completion is surfaced via `residualWarnings`, never
 * hidden. Returns a summary suitable for an admin audit display.
 */
export async function eraseUserData(
  tableName: string,
  analyticsTable: string | undefined,
  userId: string,
  erasedBy: string
): Promise<ErasureResult> {
  const residualWarnings: string[] = [];
  let partial = false;
  let unprocessedItems = 0;
  const errMsg = (e: unknown) => (e instanceof Error ? e.message : String(e));
  // Mark the erasure incomplete and record why. Used for any step failure.
  const fail = (msg: string) => {
    partial = true;
    residualWarnings.push(msg);
  };

  // Capture external identifiers BEFORE we delete the partition that holds them.
  const entitlement = await getUserEntitlement(tableName, userId).catch(() => null);
  const stripeCustomerId = entitlement?.stripeCustomerId;

  // 1. Main user partition (the bulk of personal data). Each step is isolated so
  //    one failure cannot abort the cascade or skip the audit record below.
  let mainItemsDeleted = 0;
  let quizPks: string[] = [];
  let pairInviteKeys: DdbKey[] = [];
  try {
    const mainItems = await queryAllItems(tableName, bookUserPk(userId));
    quizPks = quizAttemptPksFromUserItems(userId, mainItems);
    pairInviteKeys = pairInviteKeysFromUserItems(mainItems);
    const r = await batchDeleteKeys(tableName, asKeys(mainItems));
    mainItemsDeleted = r.deleted;
    unprocessedItems += r.unprocessed;
    if (r.unprocessed) fail(`${r.unprocessed} main-table item(s) survived retries and were NOT deleted.`);
  } catch (e) {
    fail(`Main partition erase failed: ${errMsg(e)}`);
  }

  // 2. Quiz-attempt partitions (each keyed by QUIZATTEMPT#<userId>#<bookId>#<ch>).
  let quizAttemptItemsDeleted = 0;
  for (const pk of quizPks) {
    try {
      const attempts = await queryAllItems(tableName, pk);
      const r = await batchDeleteKeys(tableName, asKeys(attempts));
      quizAttemptItemsDeleted += r.deleted;
      unprocessedItems += r.unprocessed;
      if (r.unprocessed) fail(`${r.unprocessed} quiz-attempt item(s) in ${pk} were NOT deleted.`);
    } catch (e) {
      fail(`Quiz-attempt erase failed for ${pk}: ${errMsg(e)}`);
    }
  }

  // 3. Pair-invite reverse-index items (best-effort).
  let pairInviteItemsDeleted = 0;
  if (pairInviteKeys.length) {
    try {
      const r = await batchDeleteKeys(tableName, pairInviteKeys);
      pairInviteItemsDeleted = r.deleted;
      unprocessedItems += r.unprocessed;
    } catch (e) {
      fail(`Pair-invite erase failed: ${errMsg(e)}`);
    }
  }

  // 4. Stripe-customer reverse map.
  if (stripeCustomerId) {
    try {
      await batchDeleteKeys(tableName, [
        { PK: stripeCustomerPk(stripeCustomerId), SK: stripeCustomerSk() },
      ]);
    } catch (e) {
      fail(`Stripe-customer map erase failed: ${errMsg(e)}`);
    }
  }

  // 5. Analytics partition (snapshot + all events).
  let analyticsItemsDeleted = 0;
  if (analyticsTable) {
    try {
      const analyticsItems = await queryAllItems(analyticsTable, `USER#${userId}`);
      const r = await batchDeleteKeys(analyticsTable, asKeys(analyticsItems));
      analyticsItemsDeleted = r.deleted;
      unprocessedItems += r.unprocessed;
      if (r.unprocessed) fail(`${r.unprocessed} analytics item(s) survived retries and were NOT deleted.`);
    } catch (e) {
      fail(`Analytics erase failed: ${errMsg(e)}`);
    }
  } else {
    fail("Analytics table not configured — analytics data was NOT erased.");
  }

  // 6. Stripe customer object (best-effort).
  let stripeCustomer: StepOutcome = "skipped";
  if (stripeCustomerId) {
    try {
      const stripe = await getStripeClient();
      await stripe.customers.del(stripeCustomerId);
      stripeCustomer = "deleted";
    } catch (error) {
      stripeCustomer = "failed";
      fail(`Stripe customer ${stripeCustomerId} could not be deleted — see ops failures.`);
      await recordOpsFailure(tableName, {
        kind: "stripe_customer_delete",
        context: "account_erase",
        userId,
        stripeCustomerId,
        errorCode: (error as { code?: string })?.code,
        errorMessage: errMsg(error),
      });
    }
  }

  // 7. Cognito user (best-effort). userId is the Cognito `sub`; resolve the
  //    Username via a sub filter, then AdminDeleteUser. The sub is interpolated
  //    into a SCIM filter, so strip anything that isn't valid in a sub
  //    (UUID chars) to prevent filter injection.
  let cognitoUser: StepOutcome = "skipped";
  const userPoolId = await getServerEnv("COGNITO_USER_POOL_ID");
  if (userPoolId) {
    try {
      const cognito = getCognito();
      const safeSub = userId.replace(/[^\w:.@-]/g, "");
      const listed = await cognito.send(
        new ListUsersCommand({
          UserPoolId: userPoolId,
          Filter: `sub = "${safeSub}"`,
          Limit: 1,
        })
      );
      const username = listed.Users?.[0]?.Username;
      if (username) {
        await cognito.send(
          new AdminDeleteUserCommand({ UserPoolId: userPoolId, Username: username })
        );
        cognitoUser = "deleted";
      } else {
        cognitoUser = "skipped";
        residualWarnings.push("No matching Cognito user found for this sub (already deleted?).");
      }
    } catch (error) {
      cognitoUser = "failed";
      fail("Cognito user could not be deleted — see ops failures.");
      await recordOpsFailure(tableName, {
        kind: "cognito_delete",
        context: "account_erase",
        userId,
        errorCode: (error as { code?: string })?.code,
        errorMessage: errMsg(error),
      });
    }
  } else {
    fail("COGNITO_USER_POOL_ID not configured — Cognito user was NOT deleted.");
  }

  // Known residuals the single-table design can't reach without a userId GSI
  // (informational — not a failure):
  residualWarnings.push(
    "Risk/fraud events keyed by device fingerprint and any referral-code reverse-index are not auto-erased (no userId GSI)."
  );

  const erasedAt = nowIso();
  const result: ErasureResult = {
    userId,
    erasedAt,
    erasedBy,
    mainItemsDeleted,
    quizAttemptPartitions: quizPks.length,
    quizAttemptItemsDeleted,
    analyticsItemsDeleted,
    pairInviteItemsDeleted,
    stripeCustomer,
    cognitoUser,
    unprocessedItems,
    partial,
    residualWarnings,
  };

  // Permanent erasure audit, written OUTSIDE the (now-deleted) user partition.
  // Reached even when a step above failed, so a partial erasure is still logged.
  try {
    await ddbDoc.send(
      new PutCommand({
        TableName: tableName,
        Item: {
          PK: erasureLogPk(),
          SK: erasureLogSk(erasedAt, userId),
          entity: "BOOK_ERASURE_LOG",
          ...result,
        },
      })
    );
  } catch (error) {
    console.error("erasure_audit_write_failed", { userId, message: errMsg(error) });
  }

  // A partial erasure is an operational condition that needs follow-up — page it.
  if (partial) await putOpsMetric("OpsFailure", 1, { context: "account_erase_partial" });

  return result;
}
