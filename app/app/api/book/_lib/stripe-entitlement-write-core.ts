/**
 * Pure builder for the DynamoDB UpdateCommand that `updateUserEntitlementFromStripe`
 * (repo.ts) issues against a user's entitlement item in response to a Stripe webhook.
 *
 * Extracted out of repo.ts so the expression/condition logic is unit-testable
 * without loading the AWS SDK (repo.ts pulls in aws.ts, which constructs clients
 * at module load). Dependency-free and deterministic — the clock value
 * (`updatedAtIso`) is passed in rather than read here.
 *
 * ## Event-ordering guard (the reason this module exists)
 *
 * Stripe does NOT guarantee webhook delivery order, and retries can reorder
 * deliveries. Without an ordering check, a delayed/reordered PRO-activation
 * event (e.g. an `invoice.paid` for the final billing period, whose
 * `event.created` predates a later `customer.subscription.deleted`) could be
 * applied AFTER the cancellation and silently re-grant PRO to a canceled user
 * forever (getUserEntitlement never expires a stripe-source grant at read time).
 *
 * Fix: every non-dispute Stripe entitlement write stamps `lastStripeEventAt`
 * (the envelope `event.created`, epoch seconds) and is guarded by
 * `(attribute_not_exists(lastStripeEventAt) OR lastStripeEventAt <= :eventCreated)`.
 * The guard applies UNIFORMLY to activations AND downgrades, which makes the
 * high-water mark monotonic by construction: a write only applies when its
 * event is at least as new as everything already applied, so it can never move
 * the mark backward (guarding activations alone would let an older downgrade
 * lower the mark and re-open the leak).
 *
 * `<=` (not `<`): two distinct Stripe events can share the same `created`
 * second, and a retried-after-partial-failure delivery re-applies the same
 * event id; `<=` keeps both idempotent (the webhook's claim-before-process
 * lease already prevents normal double-processing).
 *
 * Dispute writes (`setDisputeOpen` / `clearDisputeOpen`) are EXEMPT from the
 * ordering guard and do NOT touch `lastStripeEventAt`: a chargeback revocation
 * must always win regardless of timestamps, and dispute re-activation is
 * blocked by the orthogonal sticky `disputeOpen` marker, not by ordering.
 *
 * ## Paid-intent high-water mark & Apple takeover
 *
 * A *completed paid* activation — plan "PRO" AND proStatus "active"
 * (`isPaidActivation`) — stamps `activePaidIntentAtMs` (`event.created` × 1000)
 * and carries a clause letting a Stripe write activate over a proSource:"apple"
 * row when its paid intent is at least as new as Apple's. That closes the
 * Checkout race where money is taken but Apple already owns the row.
 *
 * A FAILED payment is plan "PRO" with proStatus "past_due" — the shape the
 * webhook feeds on `invoice.payment_failed` / `invoice.payment_action_required`
 * / a `customer.subscription.updated` whose status maps to past_due. A bounced
 * card is NOT a paid intent: it must never advance the paid-intent high-water
 * mark nor displace an Apple lineage. So both the stamp and the Apple-takeover
 * clause key off `isPaidActivation` (proStatus "active"), NOT `isProActivation`
 * (plan "PRO"). A past_due PRO write is still `isProActivation`: it stays
 * ordering-guarded, stays refused while `disputeOpen` exists, and stays
 * same-source only (the plain proSource guard).
 */
export type StripeEntitlementWriteParams = {
  plan: "FREE" | "PRO";
  proStatus: "inactive" | "active" | "past_due" | "canceled";
  proSource?: "stripe" | undefined;
  stripeCustomerId?: string | undefined;
  stripeSubscriptionId?: string | undefined;
  stripePriceId?: string | undefined;
  subscriptionInterval?: string | undefined;
  currentPeriodEnd?: string | undefined;
  cancelAtPeriodEnd?: boolean | undefined;
  // Billing intelligence (optional)
  billingCountry?: string | undefined;
  billingCurrency?: string | undefined;
  subscriptionAmountCents?: number | undefined;
  cardBrand?: string | undefined;
  cardCountry?: string | undefined;
  lastInvoiceAmountCents?: number | undefined;
  lastInvoiceCurrency?: string | undefined;
  lastInvoicePaidAt?: string | undefined;
  failedPaymentLastReason?: string | undefined;
  // Sticky chargeback marker (L13).
  setDisputeOpen?: boolean | undefined;
  clearDisputeOpen?: boolean | undefined;
  // Stripe webhook envelope `event.created` (epoch seconds). When present (and
  // finite) on a non-dispute write, enables the event-ordering guard above.
  stripeEventCreatedAt?: number | undefined;
};

export type EntitlementUpdate = {
  updateExpression: string;
  conditionExpression: string;
  expressionAttributeNames: Record<string, string>;
  expressionAttributeValues: Record<string, unknown>;
  // Structured pieces, exposed for unit tests (assert membership, not substrings).
  setParts: string[];
  removeParts: string[];
  conditionParts: string[];
};

/**
 * Build the UpdateExpression / ConditionExpression / attribute maps for a
 * Stripe-driven entitlement write. Does not assemble the Key or TableName —
 * the caller (repo.ts) adds those and sends the command.
 */
export function buildEntitlementUpdateFromStripe(
  params: StripeEntitlementWriteParams,
  updatedAtIso: string,
): EntitlementUpdate {
  // When entering a Pro state via Stripe, we must persist proSource so that
  // entitlement checks (e.g. reserveBookEntitlement) recognize the user as a
  // Stripe-backed Pro. When leaving Pro (FREE/canceled), clear proSource.
  const proSourceValue =
    params.plan === "PRO" ? params.proSource ?? "stripe" : null;
  const isProActivation = params.plan === "PRO";
  // A completed *paid* activation, narrower than any plan==="PRO" write. The
  // webhook feeds plan:"PRO" with proStatus:"past_due" on FAILED payments
  // (invoice.payment_failed / invoice.payment_action_required, and a
  // customer.subscription.updated whose status maps to past_due). A bounced card
  // is not a paid intent, so the paid-intent stamp and the Apple-takeover clause
  // below key off this (proStatus==="active"), not isProActivation. isProActivation
  // still gates the plain proSource guard, the ordering guard, and the disputeOpen
  // guard — a past_due PRO write remains ordering-guarded, dispute-blocked, and
  // same-source only.
  const isPaidActivation =
    params.plan === "PRO" && params.proStatus === "active";
  const isDisputeWrite =
    params.setDisputeOpen === true || params.clearDisputeOpen === true;
  // Only order-guard non-dispute writes that carry a valid envelope timestamp.
  // Number.isFinite mirrors the webhook's isoFromUnix guard: a null/NaN would
  // otherwise marshal to a DynamoDB NULL and `NULL <= number` is false, silently
  // dropping the write (table runs removeUndefinedValues:true, convertEmptyValues
  // OFF).
  const hasEventTime =
    Number.isFinite(params.stripeEventCreatedAt) && !isDisputeWrite;

  // Build the SET clause dynamically. Only fields explicitly provided by the
  // event source are written, so e.g. invoice.paid (which has no
  // cancel_at_period_end signal) does NOT clobber a previously-stored
  // cancellation flag from a customer.subscription.updated event.
  const setParts: string[] = [
    "#plan = :plan",
    "proStatus = :proStatus",
    "proSource = :proSource",
    "stripeCustomerId = :stripeCustomerId",
    "stripeSubscriptionId = :stripeSubscriptionId",
    "updatedAt = :updatedAt",
    "freeBookSlots = if_not_exists(freeBookSlots, :defaultSlots)",
    // unlockedBookIds is intentionally NOT initialized here. Writing an empty
    // Set is impossible now that convertEmptyValues is off (marshal throws), and
    // initializing it to NULL is what broke reserveBookEntitlement's ADD. The
    // attribute is created lazily by the first `ADD unlockedBookIds :bookSet`;
    // reads use parseStringArray which returns [] for a missing attribute.
  ];
  const eav: Record<string, unknown> = {
    ":plan": params.plan,
    ":proStatus": params.proStatus,
    ":proSource": proSourceValue,
    ":stripeSource": "stripe",
    ":nullSource": null,
    ":stripeCustomerId": params.stripeCustomerId ?? null,
    ":stripeSubscriptionId": params.stripeSubscriptionId ?? null,
    ":updatedAt": updatedAtIso,
    ":defaultSlots": 2,
  };
  if (params.currentPeriodEnd !== undefined) {
    setParts.push("currentPeriodEnd = :periodEnd");
    eav[":periodEnd"] = params.currentPeriodEnd;
  }
  if (params.cancelAtPeriodEnd !== undefined) {
    setParts.push("cancelAtPeriodEnd = :cancelAtPeriodEnd");
    eav[":cancelAtPeriodEnd"] = params.cancelAtPeriodEnd;
  }
  // When fully downgrading to FREE (e.g. customer.subscription.deleted), the
  // user is no longer in a cancellation-pending state — clear the flag.
  if (params.plan === "FREE" && params.cancelAtPeriodEnd === undefined) {
    setParts.push("cancelAtPeriodEnd = :cancelAtPeriodEnd");
    eav[":cancelAtPeriodEnd"] = false;
  }

  // Billing intelligence — merge only when source event provided the field
  if (params.billingCountry !== undefined) {
    setParts.push("billingCountry = :bc");
    eav[":bc"] = params.billingCountry;
  }
  if (params.billingCurrency !== undefined) {
    setParts.push("billingCurrency = :bcur");
    eav[":bcur"] = params.billingCurrency;
  }
  if (params.subscriptionAmountCents !== undefined) {
    setParts.push("subscriptionAmountCents = :sac");
    eav[":sac"] = params.subscriptionAmountCents;
  }
  if (params.cardBrand !== undefined) {
    setParts.push("cardBrand = :cbrand");
    eav[":cbrand"] = params.cardBrand;
  }
  if (params.cardCountry !== undefined) {
    setParts.push("cardCountry = :ccountry");
    eav[":ccountry"] = params.cardCountry;
  }
  if (params.lastInvoiceAmountCents !== undefined) {
    setParts.push("lastInvoiceAmountCents = :liac");
    eav[":liac"] = params.lastInvoiceAmountCents;
  }
  if (params.lastInvoiceCurrency !== undefined) {
    setParts.push("lastInvoiceCurrency = :licur");
    eav[":licur"] = params.lastInvoiceCurrency;
  }
  if (params.lastInvoicePaidAt !== undefined) {
    setParts.push("lastInvoicePaidAt = :lipa");
    eav[":lipa"] = params.lastInvoicePaidAt;
  }
  if (params.failedPaymentLastReason !== undefined) {
    setParts.push("failedPaymentLastReason = :fplr");
    eav[":fplr"] = params.failedPaymentLastReason;
  }
  if (params.stripePriceId !== undefined) {
    setParts.push("stripePriceId = :spi");
    eav[":spi"] = params.stripePriceId;
  }
  if (params.subscriptionInterval !== undefined) {
    setParts.push("subscriptionInterval = :sint");
    eav[":sint"] = params.subscriptionInterval;
  }

  // Event-ordering high-water mark (see module header). Stamped on every
  // non-dispute write that carries a valid event time; the guard below refuses
  // to apply an event older than the one already applied.
  if (hasEventTime) {
    setParts.push("lastStripeEventAt = :eventCreated");
    eav[":eventCreated"] = params.stripeEventCreatedAt;
  }
  // Paid-intent high-water mark (activePaidIntentAtMs, epoch ms): the newest
  // *completed* Stripe payment. Only a paid activation (proStatus "active")
  // earns it. A past_due/failed-payment PRO write must never advance it — a
  // bounced card would otherwise masquerade as the latest paid intent and win
  // the Apple-takeover comparison below off money that never cleared.
  const hasPaidIntentTimestamp = isPaidActivation && hasEventTime;
  if (hasPaidIntentTimestamp) {
    setParts.push("activePaidIntentAtMs = :paidIntentAtMs");
    eav[":paidIntentAtMs"] =
      (params.stripeEventCreatedAt as number) * 1000;
  }

  // Sticky chargeback marker (L13). The dispute downgrade sets it; a "won"
  // dispute clears it. setDisputeOpen wins if both are passed (defensive).
  const removeParts: string[] = [];
  if (params.setDisputeOpen) {
    setParts.push("disputeOpen = :disputeOpen");
    eav[":disputeOpen"] = true;
  } else if (params.clearDisputeOpen) {
    removeParts.push("disputeOpen");
  }

  // A completed Stripe payment is the newest paid intent and may activate over
  // an Apple source. This closes the Checkout-session race where an Apple
  // purchase lands after session creation but before Stripe completion: money
  // must never be accepted without granting access. Stripe terminal/dispute
  // writes remain same-source only, so they cannot later revoke Apple access.
  // Timed promos and administrative grants remain protected. A FAILED payment
  // (past_due) is NOT a paid intent: hasPaidIntentTimestamp is false, so this
  // clause stays empty and the isProActivation branch below collapses to the
  // plain same-source proSource guard — a bounced card can never displace Apple.
  const appleTakeoverGuard = hasPaidIntentTimestamp
    ? " OR (proSource = :appleSource AND ((attribute_exists(activePaidIntentAtMs) AND activePaidIntentAtMs <= :paidIntentAtMs) OR (attribute_not_exists(activePaidIntentAtMs) AND (attribute_not_exists(lastAppleSignedDate) OR lastAppleSignedDate <= :paidIntentAtMs))))"
    : "";
  if (hasPaidIntentTimestamp) eav[":appleSource"] = "apple";
  const conditionParts = [
    isProActivation
      ? `(attribute_not_exists(proSource) OR proSource = :stripeSource OR proSource = :nullSource${appleTakeoverGuard})`
      : "(attribute_not_exists(proSource) OR proSource = :stripeSource OR proSource = :nullSource)",
  ];
  // Event-ordering guard: refuse an out-of-order (stale) Stripe event. Uniform
  // across activations and downgrades so the high-water mark only moves forward.
  if (hasEventTime) {
    conditionParts.push(
      "(attribute_not_exists(lastStripeEventAt) OR lastStripeEventAt <= :eventCreated)",
    );
  }
  // Additionally, any plan==="PRO" write (a paid activation OR a past_due
  // failed-payment write) must not re-grant/re-touch access while an unresolved
  // chargeback marker is present (L13). After a dispute downgrade proSource is
  // null, which the proSource guard alone treats as writable — so a stale,
  // redelivered invoice.paid / customer.subscription.* could otherwise
  // re-activate a chargebacked user. The dispute downgrade itself (plan FREE,
  // setDisputeOpen) and the dispute-won clear are not plan==="PRO" writes, so
  // they are intentionally exempt from this guard.
  if (isProActivation && !params.setDisputeOpen) {
    conditionParts.push("attribute_not_exists(disputeOpen)");
  }

  const updateExpression =
    "SET " +
    setParts.join(", ") +
    (removeParts.length > 0 ? " REMOVE " + removeParts.join(", ") : "");

  return {
    updateExpression,
    conditionExpression: conditionParts.join(" AND "),
    expressionAttributeNames: { "#plan": "plan" },
    expressionAttributeValues: eav,
    setParts,
    removeParts,
    conditionParts,
  };
}

export type DisputeMarkerUpdate = {
  updateExpression: string;
  conditionExpression: string;
  expressionAttributeValues: Record<string, unknown>;
};

/**
 * Build the UpdateCommand pieces for stamping (or removing) the sticky
 * `disputeOpen` chargeback marker INDEPENDENT of plan/proSource.
 *
 * `buildEntitlementUpdateFromStripe` carries `disputeOpen` on the same write as
 * the plan downgrade, gated by the proSource guard. That is correct for the
 * downgrade (a chargeback must not clobber a legitimate license/flow_points/gift
 * grant), but it means the marker is LOST whenever the guard refuses the write —
 * exactly the accounts (non-stripe proSource) for which a stale, reordered
 * Stripe activation later needs blocking. This builder is the dedicated,
 * un-gated marker path used by both dispute branches so the marker is recorded
 * (set on dispute-created, removed on dispute-won) regardless of proSource.
 *
 * Condition is only `attribute_exists(PK)`: the entitlement row must exist, but
 * its proSource is irrelevant. A missing row is intentionally a no-op here — the
 * dispute branch's `updateUserEntitlementFromStripe` call upserts a fresh row
 * (its `attribute_not_exists(proSource)` clause holds) and stamps the marker
 * there, so only the existing-non-stripe-row case needs this complementary write.
 *
 * Boolean attribute only — never writes an empty Set (keeps the
 * convertEmptyValues-off marshalling invariant intact).
 */
export function buildDisputeMarkerUpdate(
  open: boolean,
  updatedAtIso: string,
): DisputeMarkerUpdate {
  if (open) {
    return {
      updateExpression: "SET disputeOpen = :disputeOpen, updatedAt = :updatedAt",
      conditionExpression: "attribute_exists(PK)",
      expressionAttributeValues: {
        ":disputeOpen": true,
        ":updatedAt": updatedAtIso,
      },
    };
  }
  return {
    updateExpression: "SET updatedAt = :updatedAt REMOVE disputeOpen",
    conditionExpression: "attribute_exists(PK)",
    expressionAttributeValues: { ":updatedAt": updatedAtIso },
  };
}
