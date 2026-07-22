/**
 * Pure parsing of a Stripe `charge.refunded` event into the refund record(s) we
 * persist. Extracted from the webhook so the tricky bits are unit-testable:
 *   - charge.amount_refunded is CUMULATIVE, so per-refund rows must use each
 *     refund's own amount;
 *   - the charge's `refunds` list is not guaranteed on the event payload, so we
 *     fall back to a single record keyed by the UNIQUE event id (never the
 *     charge id, which would collide across repeated partial refunds).
 * The webhook adds userId + converts createdUnix → ISO.
 */

export type RefundCharge = {
  id: string;
  customer?: string | null;
  amount_refunded?: number;
  currency?: string;
  created?: number;
  refunds?: {
    data?: Array<{
      id: string;
      amount?: number;
      currency?: string;
      reason?: string | null;
      status?: string | null;
      created?: number;
    }>;
  };
};

export type RefundRecord = {
  /** Idempotency key for the persisted record. */
  eventId: string;
  chargeId: string;
  stripeCustomerId: string | null;
  amountCents: number;
  currency: string; // uppercased ISO code
  reason: string | null;
  status: string;
  createdUnix?: number | undefined;
};

export function buildRefundRecords(
  charge: RefundCharge,
  stripeEventId: string,
  defaultCurrency: string,
): RefundRecord[] {
  const refunds = charge.refunds?.data ?? [];
  if (refunds.length > 0) {
    return refunds.map((r) => ({
      eventId: r.id,
      chargeId: charge.id,
      stripeCustomerId: charge.customer ?? null,
      amountCents: r.amount ?? 0,
      currency: (r.currency ?? charge.currency ?? defaultCurrency).toUpperCase(),
      reason: r.reason ?? null,
      status: r.status ?? "succeeded",
      createdUnix: r.created ?? charge.created,
    }));
  }
  return [
    {
      eventId: stripeEventId,
      chargeId: charge.id,
      stripeCustomerId: charge.customer ?? null,
      amountCents: charge.amount_refunded ?? 0,
      currency: (charge.currency ?? defaultCurrency).toUpperCase(),
      reason: null,
      status: "refunded",
      createdUnix: charge.created,
    },
  ];
}
