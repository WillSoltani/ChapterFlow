/**
 * Pure extraction of card-brand / card-country / billing-country from a Stripe
 * Charge, for the admin billing-intelligence panels (revenue-by-country, card
 * mix, data coverage). Extracted from the webhook so it is unit-testable; the
 * webhook retrieves the charge and persists the result on the entitlement.
 */

export type BillingDetailsCharge = {
  payment_method_details?: {
    card?: { brand?: string | null; country?: string | null } | null;
  } | null;
  billing_details?: {
    address?: { country?: string | null } | null;
  } | null;
};

export type ExtractedBillingDetails = {
  cardBrand?: string | undefined;
  cardCountry?: string | undefined;
  billingCountry?: string | undefined;
};

export function extractBillingDetails(
  charge: BillingDetailsCharge | null | undefined,
): ExtractedBillingDetails {
  if (!charge) return {};
  const card = charge.payment_method_details?.card ?? undefined;
  return {
    cardBrand: card?.brand ?? undefined,
    cardCountry: card?.country ?? undefined,
    billingCountry: charge.billing_details?.address?.country ?? undefined,
  };
}
