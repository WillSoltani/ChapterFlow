import { test } from "node:test";
import assert from "node:assert/strict";
import { buildRefundRecords, type RefundCharge } from "./refund-events";

test("one record per individual refund, using each refund's own amount (not cumulative)", () => {
  const charge: RefundCharge = {
    id: "ch_1",
    customer: "cus_1",
    currency: "cad",
    amount_refunded: 800, // cumulative — must NOT be used per-row
    created: 1000,
    refunds: {
      data: [
        { id: "re_2", amount: 300, reason: "requested_by_customer", status: "succeeded", created: 2000 },
        { id: "re_1", amount: 500, reason: null, status: "succeeded", created: 1500 },
      ],
    },
  };
  const records = buildRefundRecords(charge, "evt_1", "CAD");
  assert.equal(records.length, 2);
  assert.deepEqual(
    records.map((r) => ({ eventId: r.eventId, amountCents: r.amountCents })),
    [
      { eventId: "re_2", amountCents: 300 },
      { eventId: "re_1", amountCents: 500 },
    ],
  );
  // currency uppercased, chargeId + customer carried, createdUnix from the refund
  assert.equal(records[0].currency, "CAD");
  assert.equal(records[0].chargeId, "ch_1");
  assert.equal(records[0].stripeCustomerId, "cus_1");
  assert.equal(records[0].createdUnix, 2000);
});

test("no refunds list → ONE record keyed by the unique event id (not charge id), cumulative amount", () => {
  const charge: RefundCharge = {
    id: "ch_1",
    customer: "cus_1",
    currency: "cad",
    amount_refunded: 799,
    created: 1000,
  };
  const records = buildRefundRecords(charge, "evt_42", "CAD");
  assert.equal(records.length, 1);
  // keyed by event id so repeated partial refunds don't collide on charge id
  assert.equal(records[0].eventId, "evt_42");
  assert.equal(records[0].amountCents, 799);
  assert.equal(records[0].status, "refunded");
  assert.equal(records[0].reason, null);
  assert.equal(records[0].createdUnix, 1000);
});

test("currency falls back refund → charge → default; null customer tolerated", () => {
  const charge: RefundCharge = {
    id: "ch_2",
    customer: null,
    refunds: { data: [{ id: "re_9" }] }, // no amount/currency/reason
  };
  const records = buildRefundRecords(charge, "evt_2", "CAD");
  assert.equal(records[0].amountCents, 0);
  assert.equal(records[0].currency, "CAD"); // default, since neither refund nor charge had one
  assert.equal(records[0].stripeCustomerId, null);
  assert.equal(records[0].status, "succeeded");
});
