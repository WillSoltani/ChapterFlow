// This module was split out of repo.ts (WS3-004). Code moved verbatim.

import {
  DeleteCommand,
  GetCommand,
  PutCommand,
  QueryCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import { ddbDoc } from "@/app/app/api/_lib/aws";
import {
  billingEventPk,
  billingEventSk,
  bookUserPk,
  entitlementSk,
  nowIso,
  stripeCustomerPk,
  stripeCustomerSk,
  webhookPk,
  webhookSk,
} from "./keys";
import {
  type ExistingWebhookMarker,
  classifyWebhookClaim,
  leaseExpiryMs,
  leaseTtlEpochSeconds,
} from "./webhook-claim-core";
import {
  buildDisputeMarkerUpdate,
  buildEntitlementUpdateFromStripe,
} from "./stripe-entitlement-write-core";
import {
  isConditionalCheckFailed,
  readNum,
  readStr,
} from "./repo-shared";

/**
 * Outcome of a claim attempt on a Stripe-webhook event lease (#10):
 *  - "claim"     → no prior marker existed; this worker owns it and must process.
 *  - "reclaim"   → a prior PROCESSING lease had expired (crash/timeout); this
 *                  worker took over and must process.
 *  - "duplicate" → the event is DONE, or a non-expired PROCESSING lease is held
 *                  by another in-flight worker; this worker must NOT process.
 */
export type StripeWebhookClaim = "claimed" | "done" | "in_progress";

/**
 * Claim the exclusive right to process a Stripe-webhook event BEFORE running any
 * side effects (#10). Conditionally writes a PROCESSING marker that only one of
 * N parallel redeliveries can win:
 *
 *   - succeeds (claim) iff no marker exists, OR
 *   - succeeds (reclaim) iff the existing marker is PROCESSING with an EXPIRED
 *     lease (a prior attempt crashed/timed out before completing), OR
 *   - fails (duplicate) iff the marker is DONE or a live PROCESSING lease is held.
 *
 * The condition is expressed atomically so the DynamoDB write itself is the
 * race arbiter — exactly one concurrent claimer wins. On a ConditionalCheck
 * failure we re-read the marker once to distinguish DONE (true idempotent
 * duplicate) from a live PROCESSING lease (another worker) — both map to
 * "duplicate" for the caller, but the read keeps the decision auditable.
 *
 * CRASH SAFETY: on a processing failure we deliberately do NOT call
 * completeStripeWebhookEvent, so the marker stays PROCESSING with a finite TTL.
 * Once the lease expires a Stripe retry reclaims and reprocesses — a crash can
 * never permanently mark an event processed.
 *
 * LEASE >> RUNTIME INVARIANT: the default 900s lease is far longer than the
 * server Lambda's 45s timeout, so a lease can only expire AFTER its worker is
 * dead. A reclaim therefore never races a still-running original worker, and a
 * "zombie" completing another worker's lease is structurally impossible. The
 * webhook side effects are independently idempotent anyway (guarded entitlement
 * upserts, deterministic billing-event SKs), so even a pathological overlap
 * corrupts nothing.
 */
export async function claimStripeWebhookEvent(
  tableName: string,
  eventId: string,
  eventType: string,
  leaseSeconds = 900
): Promise<StripeWebhookClaim> {
  const nowMs = Date.now();
  const leaseExpiresAt = leaseExpiryMs(nowMs, leaseSeconds);
  const ttl = leaseTtlEpochSeconds(nowMs, leaseSeconds);
  try {
    await ddbDoc.send(
      new PutCommand({
        TableName: tableName,
        Item: {
          PK: webhookPk(),
          SK: webhookSk(eventId),
          entity: "BOOK_STRIPE_WEBHOOK_EVENT",
          eventId,
          eventType,
          status: "PROCESSING",
          leaseExpiresAt,
          claimedAt: nowIso(),
          ttl,
        },
        // Win the claim iff there is no marker, OR the existing one is a
        // PROCESSING lease that has already expired (strict `<`, so
        // exactly-at-expiry still belongs to the holder). A DONE marker (no
        // `leaseExpiresAt`) or a live PROCESSING lease fails the condition.
        ConditionExpression:
          "attribute_not_exists(PK) OR (#status = :processing AND leaseExpiresAt < :now)",
        ExpressionAttributeNames: { "#status": "status" },
        ExpressionAttributeValues: { ":processing": "PROCESSING", ":now": nowMs },
      })
    );
    // The conditional Put won (a fresh claim or a reclaim of an expired lease) —
    // we own the lease and must run the side effects.
    return "claimed";
  } catch (error: unknown) {
    if (!isConditionalCheckFailed(error)) throw error;
    // The conditional Put failed: the marker is DONE or a live PROCESSING lease.
    // Re-read once and classify so we acknowledge (2xx) ONLY a genuinely-DONE
    // event. A live (or just-released) PROCESSING lease → "in_progress": the
    // route must return non-2xx so Stripe RETRIES — acking here would permanently
    // drop an event whose first delivery failed mid-processing.
    const existing = await ddbDoc.send(
      new GetCommand({
        TableName: tableName,
        Key: { PK: webhookPk(), SK: webhookSk(eventId) },
        ProjectionExpression: "#status, leaseExpiresAt",
        ExpressionAttributeNames: { "#status": "status" },
      })
    );
    return classifyWebhookClaim(
      existing.Item as ExistingWebhookMarker | undefined,
      Date.now(),
      leaseSeconds * 1000
    ) === "done"
      ? "done"
      : "in_progress";
  }
}

/**
 * Mark a successfully-processed webhook event DONE and REMOVE its TTL so the
 * idempotency marker is retained forever (#10). Called only after ALL side
 * effects succeed. Uses an UpdateCommand (not a Put) so the existing PROCESSING
 * item — which this worker claimed — is flipped in place.
 */
export async function completeStripeWebhookEvent(
  tableName: string,
  eventId: string
): Promise<void> {
  try {
    await ddbDoc.send(
      new UpdateCommand({
        TableName: tableName,
        Key: { PK: webhookPk(), SK: webhookSk(eventId) },
        // SET status=DONE + completedAt, and REMOVE ttl + leaseExpiresAt so the
        // DONE marker is permanent (no TTL sweep) and unambiguously terminal.
        UpdateExpression: "SET #status = :done, completedAt = :now REMOVE #ttl, leaseExpiresAt",
        ExpressionAttributeNames: { "#status": "status", "#ttl": "ttl" },
        ExpressionAttributeValues: { ":done": "DONE", ":now": nowIso(), ":processing": "PROCESSING" },
        // Defense-in-depth: only flip a marker that is STILL PROCESSING, so an
        // already-DONE or swept marker is a no-op rather than a clobber. The
        // PRIMARY guarantee that this worker still holds the lease is the
        // lease(900s) >> ServerFn timeout(45s) invariant (a reclaim can't race a
        // live worker) — this condition does not arbitrate concurrent holders.
        ConditionExpression: "attribute_exists(PK) AND #status = :processing",
      })
    );
  } catch (error: unknown) {
    // Lost a benign race (already DONE or swept) — nothing to complete.
    if (!isConditionalCheckFailed(error)) throw error;
  }
}

/**
 * Best-effort: drop OUR PROCESSING marker after a webhook side-effect failure so
 * a Stripe retry can re-claim and reprocess IMMEDIATELY rather than waiting out
 * the full lease. Conditional on PROCESSING, so a DONE marker (which must persist
 * forever for idempotency) is never deleted; a benign conditional miss (already
 * DONE, swept, or never written) is swallowed.
 */
export async function releaseStripeWebhookClaim(
  tableName: string,
  eventId: string
): Promise<void> {
  try {
    await ddbDoc.send(
      new DeleteCommand({
        TableName: tableName,
        Key: { PK: webhookPk(), SK: webhookSk(eventId) },
        ConditionExpression: "#status = :processing",
        ExpressionAttributeNames: { "#status": "status" },
        ExpressionAttributeValues: { ":processing": "PROCESSING" },
      })
    );
  } catch (error: unknown) {
    if (!isConditionalCheckFailed(error)) throw error;
  }
}

export type BillingEventKind = "refund" | "dispute";

export type BillingEventRecord = {
  kind: BillingEventKind;
  /** Stripe object id (refund id or dispute id) — also the idempotency key. */
  eventId: string;
  userId: string | null;
  stripeCustomerId: string | null;
  chargeId: string | null;
  amountCents: number;
  currency: string;
  reason: string | null;
  /** Refund/dispute status (e.g. "refunded", "needs_response", "won", "lost"). */
  status: string | null;
  /** ISO timestamp from the Stripe object's `created`. */
  createdAt: string;
};

/**
 * Persist a refund or dispute (chargeback) as a durable, append-only billing
 * event for the admin finance reports. Idempotent: the SK embeds the Stripe
 * object id + its created timestamp, so webhook redelivery overwrites the same
 * item rather than duplicating. The ConditionExpression hardens this against a
 * redelivery that computes a different fallback timestamp (e.g. a dispute with a
 * missing `created`): a second Put for an already-recorded SK is a benign no-op
 * instead of a duplicate finance row. Callers should pass a deterministic
 * createdAt (the Stripe object's `created`) so the SK is stable across retries.
 */
export async function recordBillingEvent(
  tableName: string,
  e: BillingEventRecord
): Promise<void> {
  const skKind = e.kind === "refund" ? "REFUND" : "DISPUTE";
  try {
    await ddbDoc.send(
      new PutCommand({
        TableName: tableName,
        Item: {
          // no TTL — retained for legal/fraud/compliance (finance audit: refunds & disputes)
          PK: billingEventPk(),
          SK: billingEventSk(skKind, e.createdAt, e.eventId),
          entity: "BOOK_BILLING_EVENT",
          kind: e.kind,
          eventId: e.eventId,
          userId: e.userId,
          stripeCustomerId: e.stripeCustomerId,
          chargeId: e.chargeId,
          amountCents: e.amountCents,
          currency: e.currency,
          reason: e.reason,
          status: e.status,
          createdAt: e.createdAt,
        },
        // Preserve chronological-Query ordering (the SK still embeds createdAt)
        // while guaranteeing a webhook redelivery can never create a second row
        // for an already-recorded event.
        ConditionExpression: "attribute_not_exists(SK)",
      })
    );
  } catch (error: unknown) {
    // Already recorded (idempotent redelivery) — not an error.
    if (isConditionalCheckFailed(error)) return;
    throw error;
  }
}

/** List the most recent refund or dispute events (newest first) for admin reports. */
export async function listRecentBillingEvents(
  tableName: string,
  kind: BillingEventKind,
  limit: number
): Promise<BillingEventRecord[]> {
  const skKind = kind === "refund" ? "REFUND" : "DISPUTE";
  const res = await ddbDoc.send(
    new QueryCommand({
      TableName: tableName,
      KeyConditionExpression: "PK = :pk AND begins_with(SK, :prefix)",
      ExpressionAttributeValues: {
        ":pk": billingEventPk(),
        ":prefix": `${skKind}#`,
      },
      ScanIndexForward: false, // newest first
      Limit: limit,
    })
  );
  return (res.Items ?? []).map((item) => ({
    kind,
    eventId: readStr(item.eventId) ?? "",
    userId: readStr(item.userId) ?? null,
    stripeCustomerId: readStr(item.stripeCustomerId) ?? null,
    chargeId: readStr(item.chargeId) ?? null,
    amountCents: readNum(item.amountCents) ?? 0,
    currency: readStr(item.currency) ?? "",
    reason: readStr(item.reason) ?? null,
    status: readStr(item.status) ?? null,
    createdAt: readStr(item.createdAt) ?? "",
  }));
}

export async function mapStripeCustomerToUser(
  tableName: string,
  customerId: string,
  userId: string
): Promise<void> {
  await ddbDoc.send(
    new PutCommand({
      TableName: tableName,
      Item: {
        PK: stripeCustomerPk(customerId),
        SK: stripeCustomerSk(),
        entity: "BOOK_STRIPE_CUSTOMER_MAP",
        customerId,
        userId,
        updatedAt: nowIso(),
      },
    })
  );
}

export async function getUserIdByStripeCustomer(
  tableName: string,
  customerId: string
): Promise<string | null> {
  const res = await ddbDoc.send(
    new GetCommand({
      TableName: tableName,
      Key: {
        PK: stripeCustomerPk(customerId),
        SK: stripeCustomerSk(),
      },
    })
  );
  const userId = readStr(res.Item?.userId);
  return userId || null;
}

export async function updateUserEntitlementFromStripe(
  tableName: string,
  params: {
    userId: string;
    plan: "FREE" | "PRO";
    proStatus: "inactive" | "active" | "past_due" | "canceled";
    proSource?: "stripe";
    stripeCustomerId?: string;
    stripeSubscriptionId?: string;
    stripePriceId?: string;
    subscriptionInterval?: string;
    currentPeriodEnd?: string;
    cancelAtPeriodEnd?: boolean;
    // Billing intelligence (optional)
    billingCountry?: string;
    billingCurrency?: string;
    subscriptionAmountCents?: number;
    cardBrand?: string;
    cardCountry?: string;
    lastInvoiceAmountCents?: number;
    lastInvoiceCurrency?: string;
    lastInvoicePaidAt?: string;
    failedPaymentLastReason?: string;
    // Sticky chargeback marker. Set true when charge.dispute.created revokes
    // access so a stale/redelivered PRO-activation event (invoice.paid,
    // customer.subscription.*) cannot silently re-grant Pro to a user who
    // reversed payment. Cleared (true → removed) on charge.dispute.closed with
    // status="won". A PRO-activation write is refused while it is present.
    setDisputeOpen?: boolean;
    clearDisputeOpen?: boolean;
    // Stripe webhook envelope `event.created` (epoch seconds). Stamped as the
    // entitlement's lastStripeEventAt high-water mark and used to reject
    // out-of-order (reordered/retried) Stripe events. See
    // stripe-entitlement-write-core.ts for the ordering invariant.
    stripeEventCreatedAt?: number;
  }
): Promise<void> {
  // All UpdateExpression / ConditionExpression building lives in the pure
  // stripe-entitlement-write-core module (unit-tested without the AWS SDK).
  // Notably it adds the event-ordering guard (lastStripeEventAt) that rejects
  // out-of-order/reordered Stripe events.
  const built = buildEntitlementUpdateFromStripe(params, nowIso());

  try {
    await ddbDoc.send(
      new UpdateCommand({
        TableName: tableName,
        Key: {
          PK: bookUserPk(params.userId),
          SK: entitlementSk(),
        },
        ConditionExpression: built.conditionExpression,
        UpdateExpression: built.updateExpression,
        ExpressionAttributeNames: built.expressionAttributeNames,
        ExpressionAttributeValues: built.expressionAttributeValues,
      })
    );
  } catch (error: unknown) {
    if (isConditionalCheckFailed(error)) {
      // The conditional write was refused for one of three reasons, all of
      // which mean "do not overwrite, drop this event":
      //   1. the user is on a non-Stripe Pro source (license / flow_points),
      //   2. an unresolved chargeback marker (disputeOpen) blocks PRO
      //      re-activation, or
      //   3. this Stripe event is stale — an event with a newer event.created
      //      was already applied (lastStripeEventAt ordering guard).
      // Returning here (2xx to Stripe) is correct: the Stripe customer/
      // subscription IDs are still safe to attach via
      // attachStripeCustomerToEntitlement, and a retry of a genuinely stale
      // event would be refused identically, so there is nothing to retry.
      return;
    }
    throw error;
  }
}

/**
 * Stamp (open=true) or remove (open=false) the sticky `disputeOpen` chargeback
 * marker on a user's entitlement, INDEPENDENT of plan/proSource.
 *
 * `updateUserEntitlementFromStripe`'s combined dispute write carries the marker
 * under its proSource guard, so for a non-stripe-PRO account (license /
 * flow_points / gift_code / admin) the whole write — marker included — is
 * refused, and the chargeback leaves no `disputeOpen` to block a later stale
 * Stripe re-activation. The dispute webhook branches call this dedicated,
 * un-gated write so the marker is always recorded (and symmetrically cleared on
 * a won dispute) regardless of how the user obtained PRO.
 *
 * Condition is `attribute_exists(PK)` only: a missing entitlement row is a
 * no-op (that case is already covered by the branch's
 * updateUserEntitlementFromStripe upsert). Idempotent, so it is safe to call
 * alongside the combined write on the stripe-source path.
 */
export async function setEntitlementDisputeMarker(
  tableName: string,
  userId: string,
  open: boolean
): Promise<void> {
  const built = buildDisputeMarkerUpdate(open, nowIso());
  try {
    await ddbDoc.send(
      new UpdateCommand({
        TableName: tableName,
        Key: {
          PK: bookUserPk(userId),
          SK: entitlementSk(),
        },
        ConditionExpression: built.conditionExpression,
        UpdateExpression: built.updateExpression,
        ExpressionAttributeValues: built.expressionAttributeValues,
      })
    );
  } catch (error: unknown) {
    if (isConditionalCheckFailed(error)) {
      // No entitlement row for this user → nothing to mark. (For a chargeback the
      // row normally exists; this just guards the degenerate case.)
      return;
    }
    throw error;
  }
}

export async function attachStripeCustomerToEntitlement(
  tableName: string,
  userId: string,
  customerId: string
): Promise<void> {
  await ddbDoc.send(
    new UpdateCommand({
      TableName: tableName,
      Key: {
        PK: bookUserPk(userId),
        SK: entitlementSk(),
      },
      // unlockedBookIds is created lazily by reserveBookEntitlement's ADD; do not
      // initialize it here (an empty Set can no longer be marshalled).
      UpdateExpression:
        "SET stripeCustomerId = :customerId, updatedAt = :updatedAt, #plan = if_not_exists(#plan, :freePlan), freeBookSlots = if_not_exists(freeBookSlots, :defaultSlots)",
      ExpressionAttributeNames: {
        "#plan": "plan",
      },
      ExpressionAttributeValues: {
        ":customerId": customerId,
        ":updatedAt": nowIso(),
        ":freePlan": "FREE",
        ":defaultSlots": 2,
      },
    })
  );
}

/**
 * Attach a Stripe customer ID to a user entitlement, but ONLY if no customer
 * is already attached. Returns true on success, false if a different
 * customerId already exists (race winner). This is used at checkout-session
 * creation time to deduplicate concurrent customer creations.
 */
export async function attachStripeCustomerIfAbsent(
  tableName: string,
  userId: string,
  customerId: string
): Promise<boolean> {
  try {
    await ddbDoc.send(
      new UpdateCommand({
        TableName: tableName,
        Key: {
          PK: bookUserPk(userId),
          SK: entitlementSk(),
        },
        ConditionExpression: "attribute_not_exists(stripeCustomerId)",
        // unlockedBookIds is created lazily by reserveBookEntitlement's ADD; do not
        // initialize it here (an empty Set can no longer be marshalled).
        UpdateExpression:
          "SET stripeCustomerId = :customerId, updatedAt = :updatedAt, #plan = if_not_exists(#plan, :freePlan), freeBookSlots = if_not_exists(freeBookSlots, :defaultSlots)",
        ExpressionAttributeNames: { "#plan": "plan" },
        ExpressionAttributeValues: {
          ":customerId": customerId,
          ":updatedAt": nowIso(),
          ":freePlan": "FREE",
          ":defaultSlots": 2,
        },
      })
    );
    return true;
  } catch (error: unknown) {
    if (isConditionalCheckFailed(error)) return false;
    throw error;
  }
}
