import { test } from "node:test";
import assert from "node:assert/strict";
import { extractBillingDetails } from "./billing-details";

test("extracts card brand/country and billing country from a charge", () => {
  assert.deepEqual(
    extractBillingDetails({
      payment_method_details: { card: { brand: "visa", country: "CA" } },
      billing_details: { address: { country: "CA" } },
    }),
    { cardBrand: "visa", cardCountry: "CA", billingCountry: "CA" },
  );
});

test("missing pieces become undefined (so they don't clobber stored values)", () => {
  assert.deepEqual(extractBillingDetails(null), {});
  assert.deepEqual(extractBillingDetails(undefined), {});
  assert.deepEqual(
    extractBillingDetails({ payment_method_details: { card: { brand: "amex" } } }),
    { cardBrand: "amex", cardCountry: undefined, billingCountry: undefined },
  );
  // null nested fields normalize to undefined, not null
  assert.deepEqual(
    extractBillingDetails({
      payment_method_details: { card: { brand: null, country: null } },
      billing_details: { address: { country: null } },
    }),
    { cardBrand: undefined, cardCountry: undefined, billingCountry: undefined },
  );
});
