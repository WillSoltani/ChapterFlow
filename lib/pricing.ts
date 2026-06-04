/**
 * Single source of truth for DISPLAYED pricing, currency, discount, and trial
 * copy across ChapterFlow — the landing pricing section, the settings/profile
 * billing UI, and the paywall API (me/entitlements).
 *
 * What this is NOT: the Stripe Price IDs that are actually CHARGED live in env
 * (BOOK_STRIPE_PRICE_ID / _ANNUAL / _ANNUAL_UPFRONT) and are resolved server-
 * side in env.ts. This module is display-only. When a number changes here you
 * must also update the matching Stripe Price, and the legal Terms copy in
 * app/legal/terms/page.tsx (which intentionally restates these figures as prose
 * — it is not generated from this module).
 *
 * Currency is single-CAD today. To support multiple currencies later, turn the
 * scalar amounts into a per-currency map and thread a currency code through the
 * formatters below — every consumer already routes its symbol/code/amount
 * through formatAmount / formatAmountWithCurrency, so the UI needs no further
 * change once those formatters become currency-aware.
 *
 * Client-safe (no server-only imports): importable from both Server Components /
 * route handlers and Client Components.
 */

export type PricingTierInterval = "monthly" | "annual" | "annual_upfront";

export const PRICING = {
  /** ISO 4217 currency code used for all plans today. */
  currency: "CAD",
  /** Symbol shown before the amount. */
  symbol: "$",
  /** Free-trial length in days, applied to new Stripe subscriptions at checkout. */
  trialDays: 14,
  /** Free-plan book-finish limit (display only; the enforced limit is BOOK_FREE_SLOTS_DEFAULT). */
  freeBookLimit: 2,
  /** Per-month price, billed monthly. */
  monthlyAmount: 7.99,
  /** Per-month-equivalent price, billed annually. */
  annualMonthlyAmount: 5.99,
  /** Flat price, billed once per year (annual upfront). */
  annualUpfrontAmount: 59.99,
} as const;

/** Total charged per year on the annual (monthly-equivalent) plan, e.g. 71.88. */
export const ANNUAL_TOTAL_AMOUNT =
  Math.round(PRICING.annualMonthlyAmount * 12 * 100) / 100;

/** Whole-percent saving of the annual plan vs paying monthly, e.g. 25. */
export const ANNUAL_SAVINGS_PCT = Math.round(
  (1 - PRICING.annualMonthlyAmount / PRICING.monthlyAmount) * 100,
);

/** "$7.99" — symbol + 2dp amount, no currency code. */
export function formatAmount(amount: number): string {
  return `${PRICING.symbol}${amount.toFixed(2)}`;
}

/** "$7.99 CAD" — formatAmount + currency code. */
export function formatAmountWithCurrency(amount: number): string {
  return `${formatAmount(amount)} ${PRICING.currency}`;
}

/**
 * The ISO 4217 currency ChapterFlow charges in. Single-currency today (same as
 * the display currency). Admin revenue aggregation assumes ONE billing currency
 * and sums across subscriptions; if you start selling in another currency, group
 * MRR/ARR per currency — the admin billing route already warns when it sees more
 * than one distinct currency. Stripe is the source of truth per subscription
 * (entitlement.billingCurrency); this is the expected/default value.
 */
export const BILLING_CURRENCY = PRICING.currency;

/** Canonical CTA shown on every upgrade button, e.g. "Start 14-day free trial". */
export const TRIAL_CTA_LABEL = `Start ${PRICING.trialDays}-day free trial`;

/** Annual-tier discount badge, e.g. "Save 25%". */
export const ANNUAL_SAVINGS_BADGE = `Save ${ANNUAL_SAVINGS_PCT}%`;

/** "$7.99" */
export const MONTHLY_PRICE = formatAmount(PRICING.monthlyAmount);
/** "$7.99 CAD" */
export const MONTHLY_PRICE_WITH_CURRENCY = formatAmountWithCurrency(PRICING.monthlyAmount);
/** "$7.99/month" — the default paywall price-display string. */
export const MONTHLY_PRICE_PER_MONTH = `${MONTHLY_PRICE}/month`;

export type PricingTierDisplay = {
  interval: PricingTierInterval;
  price: string;
  label: string;
  annualTotal?: string;
  period: string;
};

/**
 * Per-interval display rows for the paywall / settings billing card. The
 * paywall API (me/entitlements) includes the annual / annual_upfront rows only
 * when the corresponding Stripe Price ID is configured, so it picks from this
 * map rather than rebuilding the strings inline.
 */
export const PRICING_TIER_DISPLAY: Record<PricingTierInterval, PricingTierDisplay> = {
  monthly: {
    interval: "monthly",
    price: MONTHLY_PRICE,
    label: `${MONTHLY_PRICE_WITH_CURRENCY}/month`,
    period: "month",
  },
  annual: {
    interval: "annual",
    price: formatAmount(PRICING.annualMonthlyAmount),
    label: `${formatAmountWithCurrency(PRICING.annualMonthlyAmount)}/month, billed annually`,
    annualTotal: formatAmount(ANNUAL_TOTAL_AMOUNT),
    period: "year",
  },
  annual_upfront: {
    interval: "annual_upfront",
    price: formatAmount(PRICING.annualUpfrontAmount),
    label: `${formatAmountWithCurrency(PRICING.annualUpfrontAmount)}/year`,
    period: "year",
  },
};
