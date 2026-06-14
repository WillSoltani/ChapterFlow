import { test } from "node:test";
import assert from "node:assert/strict";
import {
  PRICING,
  BILLING_CURRENCY,
  ANNUAL_TOTAL_AMOUNT,
  ANNUAL_SAVINGS_PCT,
  formatAmount,
  formatAmountWithCurrency,
  TRIAL_CTA_LABEL,
  ANNUAL_SAVINGS_BADGE,
  MONTHLY_PRICE,
  MONTHLY_PRICE_WITH_CURRENCY,
  MONTHLY_PRICE_PER_MONTH,
  PRICING_TIER_DISPLAY,
  monthlySubscriptionCents,
} from "./pricing";

// W6 is "one source of truth for pricing"; this pins the load-bearing values so a
// change can't silently drift the public copy. If a price changes intentionally,
// update the Stripe Price + the Terms prose (app/legal/terms/page.tsx) too — this
// failing test is the reminder. (ANNUAL_SAVINGS_PCT sits on the 25.03% rounding
// boundary, so it's especially worth locking.)

test("base amounts, currency, and trial are the expected single-CAD values", () => {
  assert.equal(PRICING.currency, "CAD");
  assert.equal(BILLING_CURRENCY, "CAD");
  assert.equal(PRICING.monthlyAmount, 7.99);
  assert.equal(PRICING.annualMonthlyAmount, 5.99);
  assert.equal(PRICING.annualUpfrontAmount, 59.99);
  assert.equal(PRICING.trialDays, 14);
});

test("derived annual total and savings percent are pinned", () => {
  assert.equal(ANNUAL_TOTAL_AMOUNT, 71.88); // 5.99 * 12
  assert.equal(ANNUAL_SAVINGS_PCT, 25); // round((1 - 5.99/7.99) * 100) — boundary value
});

test("formatters produce the canonical strings", () => {
  assert.equal(formatAmount(7.99), "$7.99");
  assert.equal(formatAmount(5), "$5.00");
  assert.equal(formatAmountWithCurrency(7.99), "$7.99 CAD");
  assert.equal(MONTHLY_PRICE, "$7.99");
  assert.equal(MONTHLY_PRICE_WITH_CURRENCY, "$7.99 CAD");
  assert.equal(MONTHLY_PRICE_PER_MONTH, "$7.99/month");
});

test("canonical UI copy", () => {
  assert.equal(TRIAL_CTA_LABEL, "Start 14-day free trial");
  assert.equal(ANNUAL_SAVINGS_BADGE, "Save 25%");
});

// H1: admin MRR summed annual subscription amounts as if monthly, inflating MRR
// ~12x and ARR ~144x per annual subscriber. monthlySubscriptionCents normalizes
// the stored unit_amount (one billing period) to a per-month figure before any
// aggregation. These pin the normalization for every plan we actually sell.
test("monthlySubscriptionCents normalizes each plan's stored amount to a monthly figure", () => {
  // Monthly plan: unit_amount is already one month → unchanged.
  assert.equal(monthlySubscriptionCents(799, "month"), 799);
  // Annual plan ($5.99/mo billed annually): unit_amount is the full $71.88/yr.
  assert.equal(monthlySubscriptionCents(7188, "year"), 599);
  // Annual-upfront ($59.99/yr): full-year unit_amount → ~$5.00/mo equivalent.
  assert.equal(monthlySubscriptionCents(5999, "year"), 500); // round(499.916)
});

test("monthlySubscriptionCents treats missing/unknown interval as already-monthly (legacy rows)", () => {
  assert.equal(monthlySubscriptionCents(799, undefined), 799);
  assert.equal(monthlySubscriptionCents(799, null), 799);
  assert.equal(monthlySubscriptionCents(799, "fortnight"), 799);
  assert.equal(monthlySubscriptionCents(0, "year"), 0);
});

test("monthlySubscriptionCents honors interval_count and other Stripe intervals", () => {
  // Quarterly (interval=month, interval_count=3): 2397¢/quarter → 799¢/mo.
  assert.equal(monthlySubscriptionCents(2397, "month", 3), 799);
  // Two-year (interval=year, interval_count=2): divide by 24 months.
  assert.equal(monthlySubscriptionCents(14376, "year", 2), 599);
  // Weekly / daily normalize to a monthly figure too.
  assert.equal(monthlySubscriptionCents(100, "week"), Math.round((100 * 52) / 12));
  assert.equal(monthlySubscriptionCents(10, "day"), Math.round((10 * 365) / 12));
  // A nonsensical interval_count is ignored (treated as 1).
  assert.equal(monthlySubscriptionCents(799, "month", 0), 799);
  assert.equal(monthlySubscriptionCents(7188, "year", -5), 599);
});

test("monthlySubscriptionCents is case-insensitive and NaN-safe (cannot silently re-inflate MRR)", () => {
  // A capitalized interval must NOT fall through to monthly — that fall-through
  // would re-introduce the ~12x H1 over-count for an annual sub.
  assert.equal(monthlySubscriptionCents(7188, "Year"), 599);
  assert.equal(monthlySubscriptionCents(7188, "YEAR"), 599);
  // A corrupt amount yields 0, not NaN, so one bad row can't poison the MRR sum.
  assert.equal(monthlySubscriptionCents(Number.NaN, "month"), 0);
  assert.equal(monthlySubscriptionCents(Number.POSITIVE_INFINITY, "year"), 0);
});

test("paywall tier display rows match what the API returned before centralization", () => {
  assert.deepEqual(PRICING_TIER_DISPLAY.monthly, {
    interval: "monthly",
    price: "$7.99",
    label: "$7.99 CAD/month",
    period: "month",
  });
  assert.deepEqual(PRICING_TIER_DISPLAY.annual, {
    interval: "annual",
    price: "$5.99",
    label: "$5.99 CAD/month, billed annually",
    annualTotal: "$71.88",
    period: "year",
  });
  assert.deepEqual(PRICING_TIER_DISPLAY.annual_upfront, {
    interval: "annual_upfront",
    price: "$59.99",
    label: "$59.99 CAD/year",
    period: "year",
  });
});
