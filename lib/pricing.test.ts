import { test } from "node:test";
import assert from "node:assert/strict";
import {
  PRICING,
  ANNUAL_TOTAL_AMOUNT,
  ANNUAL_SAVINGS_PCT,
  formatAmount,
  formatAmountWithCurrency,
  PRICING_TIER_DISPLAY,
} from "./pricing";

test("ANNUAL_TOTAL_AMOUNT is 12x the annual monthly amount, rounded to 2dp", () => {
  assert.equal(ANNUAL_TOTAL_AMOUNT, 71.88);
  assert.equal(
    ANNUAL_TOTAL_AMOUNT,
    Math.round(PRICING.annualMonthlyAmount * 12 * 100) / 100,
  );
});

test("ANNUAL_SAVINGS_PCT is the whole-percent saving of annual vs monthly", () => {
  assert.equal(ANNUAL_SAVINGS_PCT, 25);
});

test("formatAmount / formatAmountWithCurrency render symbol + 2dp (+ code)", () => {
  assert.equal(formatAmount(7.99), "$7.99");
  assert.equal(formatAmount(5), "$5.00");
  assert.equal(formatAmountWithCurrency(7.99), "$7.99 CAD");
});

test("every pricing tier display row is internally consistent", () => {
  for (const interval of ["monthly", "annual", "annual_upfront"] as const) {
    const row = PRICING_TIER_DISPLAY[interval];
    assert.equal(row.interval, interval);
    assert.match(row.price, /^\$\d+\.\d{2}$/);
    // the human label always restates the per-interval price
    assert.ok(
      row.label.includes(row.price),
      `${interval} label "${row.label}" should contain price ${row.price}`,
    );
  }
});
