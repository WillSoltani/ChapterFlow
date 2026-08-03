// This module was split out of repo.ts (WS3-004). Code moved verbatim.

import {
  GetCommand,
  PutCommand,
  TransactWriteCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import { ddbDoc } from "@/app/app/api/_lib/aws";
import {
  BookApiError,
  isTransactionConditionFailedAt,
} from "./errors";
import {
  type AppleStorageLane,
  bookUserPk,
  entitlementSk,
  nowIso,
} from "./keys";
import type { BookUserEntitlement } from "./types";
import {
  buildAppleTransactionClaimRead,
  buildAppleTransactionClaimWrite,
} from "./apple-transaction-claim-core";
import { isStoredProGrantExpired } from "./entitlement-expiry-core";
import {
  type AppleStoreEnvironment,
  isAppleTestFlightSandboxUserAllowedFromEnv,
} from "./apple-purchase-policy-core";
import { selectAppleTestFlightEntitlement } from "./apple-testflight-entitlement-core";
import {
  type AppleEntitlementWriteParams,
  buildAppleEntitlementTransactWrite,
} from "./apple-entitlement-write-core";
import {
  isConditionalCheckFailed,
  parseStringArray,
  readNum,
  readStr,
} from "./repo-shared";

function decodeUserEntitlementItem(
  userId: string,
  item: Record<string, unknown> | undefined,
): BookUserEntitlement | null {
  if (!item) return null;

  const proSource =
    item.proSource === "stripe"
      ? "stripe"
      : item.proSource === "apple"
        ? "apple"
        : item.proSource === "license"
          ? "license"
          : item.proSource === "flow_points"
            ? "flow_points"
            : item.proSource === "gift_code"
              ? "gift_code"
              : item.proSource === "admin"
                ? "admin"
                : undefined;
  const licenseKey = readStr(item.licenseKey);
  const licenseExpiresAt = readStr(item.licenseExpiresAt);
  const currentPeriodEnd = readStr(item.currentPeriodEnd);

  // Compute effective plan for time-limited grants. Apple also fails closed at
  // currentPeriodEnd so a delayed/lost terminal notification cannot leave Pro
  // active forever; a signed grace event advances that date before this read.
  const storedPlan = item.plan === "PRO" ? "PRO" : "FREE";
  const grantExpired = isStoredProGrantExpired({
    storedPlan,
    proSource,
    licenseExpiresAt,
    currentPeriodEnd,
    nowMs: Date.now(),
  });
  const plan: "FREE" | "PRO" = grantExpired ? "FREE" : storedPlan;
  const proStatus =
    grantExpired
      ? "inactive"
      : item.proStatus === "active" ||
          item.proStatus === "past_due" ||
          item.proStatus === "canceled" ||
          item.proStatus === "inactive"
        ? item.proStatus
        : undefined;

  return {
    userId,
    plan,
    proStatus,
    proSource,
    freeBookSlots: readNum(item.freeBookSlots) ?? 2,
    unlockedBookIds: parseStringArray(item.unlockedBookIds),
    stripeCustomerId: readStr(item.stripeCustomerId),
    stripeSubscriptionId: readStr(item.stripeSubscriptionId),
    stripePriceId: readStr(item.stripePriceId),
    subscriptionInterval: readStr(item.subscriptionInterval),
    currentPeriodEnd,
    cancelAtPeriodEnd: item.cancelAtPeriodEnd === true,
    licenseKey,
    licenseExpiresAt,
    discountCouponId: readStr(item.discountCouponId),
    lastStripeEventAt: readNum(item.lastStripeEventAt),
    appleOriginalTransactionId: readStr(item.appleOriginalTransactionId),
    appleProductId: readStr(item.appleProductId),
    lastAppleSignedDate: readNum(item.lastAppleSignedDate),
    disputeOpen: item.disputeOpen === true ? true : undefined,
    updatedAt: readStr(item.updatedAt) || "",
  };
}

async function getUserEntitlementForStorageLane(
  tableName: string,
  userId: string,
  storageLane: AppleStorageLane,
  consistentRead: boolean,
): Promise<BookUserEntitlement | null> {
  const res = await ddbDoc.send(
    new GetCommand({
      TableName: tableName,
      Key: {
        PK: bookUserPk(userId),
        SK: entitlementSk(storageLane),
      },
      ConsistentRead: consistentRead,
    })
  );
  return decodeUserEntitlementItem(
    userId,
    res.Item as Record<string, unknown> | undefined,
  );
}

export async function getUserEntitlement(
  tableName: string,
  userId: string,
  options?: {
    consistentRead?: boolean;
    appleStorageLane?: AppleStorageLane;
  },
): Promise<BookUserEntitlement | null> {
  const consistentRead = options?.consistentRead === true;
  if (options?.appleStorageLane) {
    return getUserEntitlementForStorageLane(
      tableName,
      userId,
      options.appleStorageLane,
      consistentRead,
    );
  }

  const primary = await getUserEntitlementForStorageLane(
    tableName,
    userId,
    "Primary",
    consistentRead,
  );
  const sandboxAllowed = isAppleTestFlightSandboxUserAllowedFromEnv(
    {
      CHAPTERFLOW_ENV: process.env.CHAPTERFLOW_ENV,
      APPLE_IAP_TESTFLIGHT_SANDBOX_ENABLED:
        process.env.APPLE_IAP_TESTFLIGHT_SANDBOX_ENABLED,
      APPLE_IAP_TESTFLIGHT_QA_USER_HASHES:
        process.env.APPLE_IAP_TESTFLIGHT_QA_USER_HASHES,
    },
    userId,
  );
  if (!sandboxAllowed) return primary;

  const sandbox = await getUserEntitlementForStorageLane(
    tableName,
    userId,
    "TestFlightSandbox",
    consistentRead,
  );
  return selectAppleTestFlightEntitlement({
    production: primary,
    sandbox,
    sandboxAllowed,
  });
}

function isNullSetValidationError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  return (error as { name?: unknown }).name === "ValidationException";
}

export async function reserveBookEntitlement(
  tableName: string,
  params: {
    userId: string;
    bookId: string;
    freeSlotsDefault: number;
  }
): Promise<BookUserEntitlement> {
  try {
    return await reserveBookEntitlementOnce(tableName, params);
  } catch (error: unknown) {
    // C1 / H12 self-heal: while convertEmptyValues:true was deployed, an
    // entitlement initialized before the user's first unlock (e.g. by
    // attachStripeCustomerIfAbsent at checkout) persisted unlockedBookIds as a
    // NULL attribute — the SDK marshalled an empty `new Set()` to {NULL:true}.
    // The `ADD unlockedBookIds` below then fails with a ValidationException (ADD
    // onto a NULL-typed attribute) instead of unlocking — the exact first-unlock
    // outage H12 targeted, still latent for the already-corrupted cohort. Heal it
    // once: drop the NULL attribute (conditionally, so a genuine set is never
    // touched) and retry. A NULL unlockedBookIds is semantically an empty set (no
    // real unlocks), so removing it loses no data.
    if (!isNullSetValidationError(error)) throw error;
    await ddbDoc
      .send(
        new UpdateCommand({
          TableName: tableName,
          Key: { PK: bookUserPk(params.userId), SK: entitlementSk() },
          UpdateExpression: "REMOVE unlockedBookIds",
          ConditionExpression: "attribute_type(unlockedBookIds, :nullType)",
          ExpressionAttributeValues: { ":nullType": "NULL" },
        })
      )
      .catch((healErr: unknown) => {
        // Not actually NULL (a concurrent writer healed it, or the error was
        // unrelated) — let the retry below surface the real failure.
        if (!isConditionalCheckFailed(healErr)) throw healErr;
      });
    return await reserveBookEntitlementOnce(tableName, params);
  }
}

async function reserveBookEntitlementOnce(
  tableName: string,
  params: {
    userId: string;
    bookId: string;
    freeSlotsDefault: number;
  }
): Promise<BookUserEntitlement> {
  const ts = nowIso();
  try {
    const res = await ddbDoc.send(
      new UpdateCommand({
        TableName: tableName,
        Key: {
          PK: bookUserPk(params.userId),
          SK: entitlementSk(),
        },
        UpdateExpression:
          "SET #plan = if_not_exists(#plan, :freePlan), freeBookSlots = if_not_exists(freeBookSlots, :freeSlots), updatedAt = :updatedAt ADD unlockedBookIds :bookSet",
        // A user may bypass the slot limit only when they are PRO with a non-expired entitlement.
        ConditionExpression: [
          "(#plan = :proPlan AND (attribute_not_exists(proSource) OR proSource = :stripeSource OR proSource = :appleSource OR proSource = :adminSource OR (proSource = :licenseSource AND licenseExpiresAt >= :now) OR (proSource = :flowPointsSource AND currentPeriodEnd >= :now) OR (proSource = :giftSource AND currentPeriodEnd >= :now)))",
          "OR contains(unlockedBookIds, :bookId)",
          "OR attribute_not_exists(unlockedBookIds)",
          "OR attribute_not_exists(freeBookSlots)",
          "OR size(unlockedBookIds) < freeBookSlots",
        ].join(" "),
        ExpressionAttributeNames: {
          "#plan": "plan",
        },
        ExpressionAttributeValues: {
          ":freePlan": "FREE",
          ":proPlan": "PRO",
          ":stripeSource": "stripe",
          ":appleSource": "apple",
          ":adminSource": "admin",
          ":licenseSource": "license",
          ":flowPointsSource": "flow_points",
          ":giftSource": "gift_code",
          ":now": ts,
          ":freeSlots": params.freeSlotsDefault,
          ":updatedAt": ts,
          ":bookId": params.bookId,
          ":bookSet": new Set([params.bookId]),
        },
        ReturnValues: "ALL_NEW",
      })
    );
    const item = res.Attributes ?? {};
    const proSource =
      item.proSource === "stripe"
        ? "stripe"
        : item.proSource === "apple"
          ? "apple"
          : item.proSource === "license"
            ? "license"
            : item.proSource === "flow_points"
              ? "flow_points"
              : item.proSource === "gift_code"
                ? "gift_code"
                : item.proSource === "admin"
                  ? "admin"
                  : undefined;
    return {
      userId: params.userId,
      plan: item.plan === "PRO" ? "PRO" : "FREE",
      proStatus:
        item.proStatus === "active" ||
        item.proStatus === "past_due" ||
        item.proStatus === "canceled" ||
        item.proStatus === "inactive"
          ? item.proStatus
          : undefined,
      proSource,
      freeBookSlots: readNum(item.freeBookSlots) ?? params.freeSlotsDefault,
      unlockedBookIds: parseStringArray(item.unlockedBookIds),
      stripeCustomerId: readStr(item.stripeCustomerId),
      stripeSubscriptionId: readStr(item.stripeSubscriptionId),
      currentPeriodEnd: readStr(item.currentPeriodEnd),
      licenseKey: readStr(item.licenseKey),
      licenseExpiresAt: readStr(item.licenseExpiresAt),
      updatedAt: readStr(item.updatedAt) || ts,
    };
  } catch (error: unknown) {
    if (isConditionalCheckFailed(error)) {
      throw new BookApiError(402, "book_limit_reached", "Book limit reached. Upgrade required.");
    }
    throw error;
  }
}

/**
 * Claim the reverse map from an Apple `originalTransactionId` to the owning
 * userId. Written by the /apple/verify route (where the authenticated user
 * proves ownership of the StoreKit transaction) so the App Store Server
 * Notifications webhook — which carries no userId — can later resolve the
 * account. The Apple analogue of {@link mapStripeCustomerToUser}, but
 * CONDITIONAL: the map is created only if unowned, and re-claiming by the same
 * user is idempotent. A transaction already owned by a DIFFERENT user is
 * refused (returns false) so a replayed transaction JWS cannot hijack another
 * account's purchase.
 */
export async function claimAppleTransactionForUser(
  tableName: string,
  originalTransactionId: string,
  userId: string,
  accountBindingVersion?: string,
  storageLane: AppleStorageLane = "Primary",
  storeEnvironment?: AppleStoreEnvironment,
): Promise<boolean> {
  try {
    await ddbDoc.send(
      new TransactWriteCommand(
        buildAppleTransactionClaimWrite({
          tableName,
          originalTransactionId,
          userId,
          updatedAt: nowIso(),
          accountBindingVersion,
          storageLane,
          storeEnvironment,
        }),
      ),
    );
    return true;
  } catch (error: unknown) {
    if (isTransactionConditionFailedAt(error, 0)) return false;
    if (isTransactionConditionFailedAt(error, 2)) {
      throw new BookApiError(
        403,
        "account_deleted",
        "This account has been deleted and is no longer accessible.",
      );
    }
    throw error;
  }
}

export type AppleTransactionClaim = {
  userId: string;
  accountBindingVersion?: string | undefined;
  environment: "Production" | "Sandbox";
};

export async function getAppleTransactionClaim(
  tableName: string,
  originalTransactionId: string,
  storageLane: AppleStorageLane = "Primary",
): Promise<AppleTransactionClaim | null> {
  const res = await ddbDoc.send(
    new GetCommand(
      buildAppleTransactionClaimRead({
        tableName,
        originalTransactionId,
        storageLane,
      }),
    ),
  );
  const userId = readStr(res.Item?.userId);
  if (!userId) return null;
  return {
    userId,
    accountBindingVersion: readStr(res.Item?.accountBindingVersion),
    environment: res.Item?.environment === "Sandbox" ? "Sandbox" : "Production",
  };
}

/**
 * Apply an Apple StoreKit / App Store Server Notification entitlement mutation.
 * The Apple mirror of {@link updateUserEntitlementFromStripe}: all
 * UpdateExpression / ConditionExpression building lives in the pure
 * apple-entitlement-write-core module (unit-tested without the AWS SDK),
 * including the `lastAppleSignedDate` ordering guard and the cross-source
 * arbitration guard. A refused conditional write (stale event, wrong source, or
 * downgrade of a non-apple entitlement) is swallowed — there is nothing to
 * retry. Returns whether the write applied.
 */
export async function updateUserEntitlementFromApple(
  tableName: string,
  params: AppleEntitlementWriteParams & { userId: string },
  storageLane: AppleStorageLane = "Primary",
): Promise<boolean> {
  const transaction = buildAppleEntitlementTransactWrite({
    tableName,
    userId: params.userId,
    params,
    updatedAtIso: nowIso(),
    storageLane,
  });
  try {
    await ddbDoc.send(
      new TransactWriteCommand(transaction),
    );
    return true;
  } catch (error: unknown) {
    if (
      isTransactionConditionFailedAt(error, 0) ||
      isTransactionConditionFailedAt(error, 1)
    ) {
      return false;
    }
    throw error;
  }
}

export async function adminUpdateUserEntitlement(
  tableName: string,
  params: {
    userId: string;
    freeBookSlots?: number | undefined;
    plan?: "FREE" | "PRO" | undefined;
    proStatus?: "inactive" | "active" | "past_due" | "canceled" | undefined;
  }
): Promise<BookUserEntitlement> {
  const updatedAt = nowIso();
  const segments: string[] = ["updatedAt = :updatedAt"];
  const values: Record<string, unknown> = {
    ":updatedAt": updatedAt,
    ":defaultSlots": 2,
    ":defaultPlan": "FREE",
  };
  if (typeof params.freeBookSlots === "number") {
    segments.push("freeBookSlots = :freeBookSlots");
    values[":freeBookSlots"] = Math.max(0, Math.floor(params.freeBookSlots));
  } else {
    segments.push("freeBookSlots = if_not_exists(freeBookSlots, :defaultSlots)");
  }
  if (params.plan) {
    segments.push("#plan = :plan");
    values[":plan"] = params.plan;
  } else {
    segments.push("#plan = if_not_exists(#plan, :defaultPlan)");
  }
  if (params.proStatus) {
    segments.push("proStatus = :proStatus");
    values[":proStatus"] = params.proStatus;
  }
  // A manual PRO grant is a comp, not a Stripe-billed subscription. Stamp
  // proSource="admin" so revenue/reconciliation routes (scanAllEntitlements →
  // revenue MRR filter, reconciliation prosource_mismatch) exclude it from
  // Stripe MRR while still surfacing it in the proSourceBreakdown. When an admin
  // sets the plan back to FREE, clear proSource so a previously comped row no
  // longer claims a PRO source. A pure freeBookSlots/proStatus tweak (no plan
  // change) leaves proSource untouched so we never clobber a real Stripe source.
  if (params.plan === "PRO") {
    segments.push("proSource = :proSource");
    values[":proSource"] = "admin";
  } else if (params.plan === "FREE") {
    segments.push("proSource = :proSource");
    values[":proSource"] = null;
  }
  // unlockedBookIds is created lazily by reserveBookEntitlement's ADD; do not
  // initialize it here (an empty Set can no longer be marshalled).

  const res = await ddbDoc.send(
    new UpdateCommand({
      TableName: tableName,
      Key: {
        PK: bookUserPk(params.userId),
        SK: entitlementSk(),
      },
      UpdateExpression: `SET ${segments.join(", ")}`,
      ExpressionAttributeNames: {
        "#plan": "plan",
      },
      ExpressionAttributeValues: values,
      ReturnValues: "ALL_NEW",
    })
  );
  const item = res.Attributes ?? {};
  return {
    userId: params.userId,
    plan: item.plan === "PRO" ? "PRO" : "FREE",
    proStatus:
      item.proStatus === "active" ||
      item.proStatus === "past_due" ||
      item.proStatus === "canceled" ||
      item.proStatus === "inactive"
        ? item.proStatus
        : undefined,
    freeBookSlots: readNum(item.freeBookSlots) ?? 2,
    unlockedBookIds: parseStringArray(item.unlockedBookIds),
    stripeCustomerId: readStr(item.stripeCustomerId),
    stripeSubscriptionId: readStr(item.stripeSubscriptionId),
    currentPeriodEnd: readStr(item.currentPeriodEnd),
    updatedAt: readStr(item.updatedAt) || updatedAt,
  };
}

/**
 * Write a back-office admin audit record. Generalizes the segment-shaped
 * writeAuditEntry in admin-segments-repo.ts to any admin action that mutates a
 * single target user (entitlement overrides, etc.) so comped/granted state is
 * traceable for fraud investigation and accountability.
 *
 * Shape matches the existing ADMIN_AUDIT rows: PK groups every action by the
 * acting admin (BOOKAUDIT#<adminUserId>), SK orders them by time#action.
 */
export async function writeAdminAudit(
  tableName: string,
  entry: {
    adminUserId: string;
    action: string;
    targetUserId: string;
    params?: Record<string, unknown>;
  }
): Promise<void> {
  const now = nowIso();
  await ddbDoc.send(
    new PutCommand({
      TableName: tableName,
      Item: {
        PK: `BOOKAUDIT#${entry.adminUserId}`,
        SK: `${now}#${entry.action}`,
        entity: "ADMIN_AUDIT",
        adminUserId: entry.adminUserId,
        action: entry.action,
        targetUserId: entry.targetUserId,
        params: entry.params ?? {},
        createdAt: now,
      },
    })
  );
}
