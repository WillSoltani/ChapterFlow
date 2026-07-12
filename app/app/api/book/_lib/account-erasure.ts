import "server-only";

import {
  QueryCommand,
  PutCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import {
  ListUsersCommand,
  AdminDeleteUserCommand,
} from "@aws-sdk/client-cognito-identity-provider";
import { ddbDoc } from "@/app/app/api/_lib/aws";
import { getServerEnv } from "@/app/app/api/_lib/server-env";
import { getCognitoClient } from "./cognito-admin";
import {
  bookUserPk,
  quizAttemptPkFromQuizStateSk,
  stripeCustomerPk,
  stripeCustomerSk,
  pairInvitePk,
  pairInviteSk,
  erasureLogPk,
  erasureLogSk,
  accountStatusSk,
  nowIso,
} from "./keys";
import {
  targetKeysFromUserItems,
  isErasurePointerEntity,
  mainPartitionKeysAfterPointerCleanup,
} from "./erasure-pointers-core";
import { hashErasureSubject } from "./erasure-audit-core";
import { batchDeleteKeys, type DdbKey } from "./ddb-batch-delete";
import { getStripeClient } from "./stripe-service";
import { getUserEntitlement, setAccountStatus } from "./repo";
import { recordOpsFailure } from "./ops-failure-repo";
import { putOpsMetric } from "./cloudwatch-metrics";

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
  /** Externally-keyed items (risk/referral/pair/Apple) deleted via pointers. */
  pointerTargetItemsDeleted: number;
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
        ConsistentRead: true,
        ExclusiveStartKey,
      })
    );
    for (const it of res.Items ?? []) items.push(it);
    ExclusiveStartKey = res.LastEvaluatedKey as Record<string, unknown> | undefined;
  } while (ExclusiveStartKey);
  return items;
}

function asKeys(items: Record<string, unknown>[]): DdbKey[] {
  return items
    .filter((it) => typeof it.PK === "string" && typeof it.SK === "string")
    .map((it) => ({ PK: it.PK as string, SK: it.SK as string }));
}

/**
 * Derive the quiz-attempt partitions for a user from their QUIZSTATE# items.
 * Reconstruction (greedy bookId capture, exact `quizAttemptPk` rebuild) lives in
 * the shared `quizAttemptPkFromQuizStateSk` helper (keys.ts) — the SAME parse the
 * per-book reset uses — so the two can never drift.
 */
function quizAttemptPksFromUserItems(userId: string, items: Record<string, unknown>[]): string[] {
  const pks = new Set<string>();
  for (const it of items) {
    const sk = typeof it.SK === "string" ? it.SK : "";
    const attemptPk = quizAttemptPkFromQuizStateSk(userId, sk);
    if (attemptPk) pks.add(attemptPk);
  }
  return [...pks];
}

/** Pair-invite reverse-index items (keyed by code) referenced from the user partition. */
function pairInviteKeysFromUserItems(items: Record<string, unknown>[]): DdbKey[] {
  const codes = new Set<string>();
  for (const it of items) {
    // Harvest ONLY genuine pair-invite codes. Two classes of user-partition items
    // also carry an `inviteCode` and must be skipped, or they synthesize a
    // spurious no-op pairInvitePk(<wrong code>) delete:
    //   - #4a reverse-pointers (handled by the pointer path, targetKeysFromUserItems), and
    //   - the referral PROFILE/CLAIM items, whose `inviteCode` is a REFERRAL code.
    // (In practice no non-pointer item carries a pair code today — createPairInvite
    // writes the keyed BOOK_PAIR_INVITE record + a pointer, never a partition item
    // with the code — so this harvest is effectively empty; the explicit skips
    // keep it correct and drift-proof if a pair code ever lands here.)
    if (isErasurePointerEntity(it.entity)) continue;
    if (it.entity === "BOOK_USER_REFERRAL_PROFILE" || it.entity === "BOOK_USER_REFERRAL_CLAIM") continue;
    if (typeof it.inviteCode === "string" && it.inviteCode.trim()) codes.add(it.inviteCode.trim());
  }
  return [...codes].map((code) => ({ PK: pairInvitePk(code), SK: pairInviteSk() }));
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

  // A minimal deleted-status tombstone closes the race between an in-flight
  // authenticated purchase claim and hard erasure. The atomic Apple claim
  // condition-checks this item; account guards also block already-issued ID
  // tokens after Cognito deletion. It is the only raw-sub item deliberately
  // retained; a 24-hour TTL is armed only after Cognito deletion is confirmed.
  await setAccountStatus(tableName, userId, "deleted", {
    statusReason: "hard_erasure_in_progress",
    changedBy: erasedBy,
  });

  // Capture external identifiers BEFORE we delete the partition that holds them.
  const entitlement = await getUserEntitlement(tableName, userId).catch(() => null);
  const stripeCustomerId = entitlement?.stripeCustomerId;

  // 1. Inventory the main partition. Do NOT delete pointer rows yet: their
  //    external targets must be confirmed deleted first so a retry never loses
  //    its only reachability path.
  let mainItemsDeleted = 0;
  let mainItems: Record<string, unknown>[] = [];
  let mainInventoryComplete = false;
  let quizPks: string[] = [];
  let pairInviteKeys: DdbKey[] = [];
  // External targets (risk/referral/pair records and Apple transaction maps) reconstructed
  // byte-exactly from reverse-pointer items in the user partition (#4a).
  let pointerTargetKeys: DdbKey[] = [];
  try {
    mainItems = await queryAllItems(tableName, bookUserPk(userId));
    mainInventoryComplete = true;
    quizPks = quizAttemptPksFromUserItems(userId, mainItems);
    pairInviteKeys = pairInviteKeysFromUserItems(mainItems);
    pointerTargetKeys = targetKeysFromUserItems(mainItems);
  } catch (e) {
    fail(`Main partition inventory failed: ${errMsg(e)}`);
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

  // 3b. Externally-keyed targets reached via reverse-pointers (#4a): risk/fraud
  //     events (device/network fingerprint keys), referral-code reverse-index,
  //     and pair-invite/Apple reverse-index. Delete targets BEFORE pointers.
  let pointerTargetItemsDeleted = 0;
  let pointerTargetsComplete = mainInventoryComplete;
  if (pointerTargetKeys.length) {
    try {
      const r = await batchDeleteKeys(tableName, pointerTargetKeys);
      pointerTargetItemsDeleted = r.deleted;
      unprocessedItems += r.unprocessed;
      if (r.unprocessed) {
        pointerTargetsComplete = false;
        fail(`${r.unprocessed} pointer-referenced external item(s) were NOT deleted.`);
      }
    } catch (e) {
      pointerTargetsComplete = false;
      fail(`Pointer-referenced (risk/referral/pair) erase failed: ${errMsg(e)}`);
    }
  }

  // 3c. Only after every pointer target is gone may we delete the user-owned
  // pointer rows and remaining personal data. Preserve the short-lived deleted
  // status tombstone so stale tokens and racing atomic claims stay blocked.
  if (pointerTargetsComplete) {
    try {
      const mainKeys = mainPartitionKeysAfterPointerCleanup(mainItems, true);
      const r = await batchDeleteKeys(tableName, mainKeys);
      mainItemsDeleted = r.deleted;
      unprocessedItems += r.unprocessed;
      if (r.unprocessed) {
        fail(
          `${r.unprocessed} main-table item(s) survived retries and were NOT deleted.`,
        );
      }
    } catch (e) {
      fail(`Main partition erase failed: ${errMsg(e)}`);
    }
  } else {
    fail(
      "Main partition retained for retry because pointer-target erasure was incomplete.",
    );
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
  let cognitoDeletionConfirmed = false;
  const userPoolId = await getServerEnv("COGNITO_USER_POOL_ID");
  if (userPoolId) {
    try {
      const cognito = getCognitoClient();
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
        cognitoDeletionConfirmed = true;
      } else {
        cognitoUser = "skipped";
        cognitoDeletionConfirmed = true;
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

  // Keep the tombstone indefinitely if Cognito deletion failed or could not be
  // attempted: a surviving refresh token must never recreate erased data after
  // a TTL reaps the gate. Once Cognito is confirmed absent, 24 hours safely
  // covers already-issued token lifetime and minimizes raw-sub retention.
  if (cognitoDeletionConfirmed) {
    try {
      await ddbDoc.send(
        new UpdateCommand({
          TableName: tableName,
          Key: { PK: bookUserPk(userId), SK: accountStatusSk() },
          ConditionExpression: "#status = :deleted",
          UpdateExpression:
            "SET #ttl = :ttl, statusReason = :statusReason, updatedAt = :updatedAt",
          ExpressionAttributeNames: {
            "#status": "status",
            "#ttl": "ttl",
          },
          ExpressionAttributeValues: {
            ":deleted": "deleted",
            ":ttl": Math.floor(Date.now() / 1000) + 24 * 60 * 60,
            ":statusReason": "hard_erasure_completed",
            ":updatedAt": nowIso(),
          },
        }),
      );
    } catch (error) {
      // Failure is safe (the no-TTL tombstone remains), but operator follow-up
      // is required to minimize retained identity data.
      fail(`Erasure tombstone TTL could not be armed: ${errMsg(error)}`);
    }
  } else {
    residualWarnings.push(
      "Deleted-account security tombstone retained without TTL until Cognito deletion is reconciled.",
    );
  }

  // Forward-only residual (#4a): externally-keyed records
  // reverse-indexes are now auto-erased via reverse-pointers written at WRITE
  // time — but only for records created AFTER that change deployed. Pre-deploy
  // records have no pointer and remain unreachable without a userId GSI.
  residualWarnings.push(
    "Externally-keyed risk, referral, pair-invite, and Apple transaction-map records are auto-erased only when a reverse pointer exists; PRE-EXISTING records without one require operator reconciliation."
  );

  const erasedAt = nowIso();

  // #4b — store an HMAC of the sub (not the raw sub) in the audit SK and item, so
  // the permanent audit proves an erasure occurred WITHOUT retaining a durable
  // plaintext identifier for the erased user. Prefer the keyed HMAC
  // (EMAIL_UNSUBSCRIBE_SECRET, reused — no new SSM param); fall back to unkeyed
  // SHA-256 + a residual warning if the secret is absent (never lose the audit).
  const unsubscribeSecret = await getServerEnv("EMAIL_UNSUBSCRIBE_SECRET").catch(() => null);
  const subjectHash = hashErasureSubject(userId, unsubscribeSecret);
  if (!subjectHash.keyed) {
    // Audit-key DOWNGRADE only — the erasure itself fully succeeded. Record a
    // residual warning (surfaced to the admin) but do NOT mark the erasure
    // `partial` or fire the OpsFailure alarm: a missing optional secret must not
    // page the operator on every otherwise-clean erasure (`fail()` would).
    residualWarnings.push(
      "Erasure-audit subject stored as UNKEYED SHA-256 (EMAIL_UNSUBSCRIBE_SECRET absent) — configure the secret for a keyed HMAC."
    );
  }

  const result: ErasureResult = {
    userId,
    erasedAt,
    erasedBy,
    mainItemsDeleted,
    quizAttemptPartitions: quizPks.length,
    quizAttemptItemsDeleted,
    analyticsItemsDeleted,
    pairInviteItemsDeleted,
    pointerTargetItemsDeleted,
    stripeCustomer,
    cognitoUser,
    unprocessedItems,
    partial,
    residualWarnings,
  };

  // Permanent erasure audit, written OUTSIDE the (now-deleted) user partition.
  // Reached even when a step above failed, so a partial erasure is still logged.
  // The raw `userId` is deliberately OMITTED from the persisted item; only the
  // hash identifies the subject (the SK uses the hash too). `erasedBy` (the
  // ADMIN/actor sub or "self") is retained — that is the accountable operator,
  // not the erased subject.
  try {
    const { userId: _erasedSubjectSub, ...auditRest } = result;
    void _erasedSubjectSub;
    await ddbDoc.send(
      new PutCommand({
        TableName: tableName,
        Item: {
          // no TTL — retained for legal/fraud/compliance (permanent GDPR erasure audit)
          PK: erasureLogPk(),
          SK: erasureLogSk(erasedAt, subjectHash.hash),
          entity: "BOOK_ERASURE_LOG",
          subjectHash: subjectHash.hash,
          subjectHashAlgorithm: subjectHash.algorithm,
          ...auditRest,
        },
      })
    );
  } catch (error) {
    console.error("erasure_audit_write_failed", { subjectHash: subjectHash.hash, message: errMsg(error) });
  }

  // A partial erasure is an operational condition that needs follow-up — page it.
  if (partial) await putOpsMetric("OpsFailure", 1, { context: "account_erase_partial" });

  return result;
}
