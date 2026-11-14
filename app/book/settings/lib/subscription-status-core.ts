import type { ProSource } from "@/lib/entitlement-types";

/**
 * What the Pro card in Settings says about the plan, by how Pro was obtained
 * (ACCT-10). Only Stripe and App Store subscriptions renew and can be managed;
 * gift, points and license Pro end on a date; admin Pro has neither.
 */
export type SubscriptionStatus = {
  dateLine: string | null;
  /** Shown when the subscription is set to end instead of renewing. */
  cancelNote: string | null;
  manage: "stripe" | "apple" | null;
};

export type SubscriptionStatusInput = {
  proSource?: ProSource | undefined;
  currentPeriodEnd?: string | undefined;
  cancelAtPeriodEnd?: boolean | undefined;
  licenseExpiresAt?: string | undefined;
};

function defaultFormat(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function subscriptionStatus(
  input: SubscriptionStatusInput,
  formatDate: (iso: string) => string = defaultFormat,
): SubscriptionStatus {
  const format = (iso: string | undefined) =>
    iso && !Number.isNaN(Date.parse(iso)) ? formatDate(iso) : null;

  switch (input.proSource) {
    case "gift_code":
    case "flow_points": {
      const until = format(input.currentPeriodEnd);
      return { dateLine: until ? `Pro until ${until}` : null, cancelNote: null, manage: null };
    }
    case "license": {
      const until = format(input.licenseExpiresAt ?? input.currentPeriodEnd);
      return { dateLine: until ? `Pro until ${until}` : null, cancelNote: null, manage: null };
    }
    case "admin":
      return { dateLine: null, cancelNote: null, manage: null };
    default: {
      const date = format(input.currentPeriodEnd);
      const cancels = Boolean(input.cancelAtPeriodEnd);
      return {
        dateLine: date ? (cancels ? `Cancels on ${date}` : `Next renewal: ${date}`) : null,
        cancelNote: cancels
          ? date
            ? "Your Pro access will end on the date above and won't auto-renew."
            : "Your Pro access won't auto-renew."
          : null,
        manage: input.proSource === "apple" ? "apple" : "stripe",
      };
    }
  }
}
