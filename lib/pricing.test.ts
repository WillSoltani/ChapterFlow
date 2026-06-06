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
