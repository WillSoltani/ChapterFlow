import { test } from "node:test";
import assert from "node:assert/strict";
import {
  BookApiError,
  isBookApiError,
  transactionCancellationReasons,
  isTransactionConditionFailedAt,
} from "./errors";

// These lock the helpers the P0b clobber guards rely on to surface the correct
// per-item error from a cancelled DynamoDB TransactWrite.

test("BookApiError carries status/code/message and is detectable", () => {
  const e = new BookApiError(409, "active_subscription", "nope", { a: 1 });
  assert.equal(e.status, 409);
  assert.equal(e.code, "active_subscription");
  assert.equal(e.message, "nope");
  assert.deepEqual(e.details, { a: 1 });
  assert.equal(isBookApiError(e), true);
  assert.equal(isBookApiError(new Error("x")), false);
  assert.equal(isBookApiError(null), false);
});

test("transactionCancellationReasons returns null for non-transaction errors", () => {
  assert.equal(transactionCancellationReasons(null), null);
  assert.equal(transactionCancellationReasons(undefined), null);
  assert.equal(transactionCancellationReasons(new Error("plain")), null);
  assert.equal(transactionCancellationReasons({ name: "ConditionalCheckFailedException" }), null);
});

test("transactionCancellationReasons reads CancellationReasons by name or __type", () => {
  const reasons = [{ Code: "None" }, { Code: "ConditionalCheckFailed" }];
  assert.deepEqual(
    transactionCancellationReasons({ name: "TransactionCanceledException", CancellationReasons: reasons }),
    reasons,
  );
  assert.deepEqual(
    transactionCancellationReasons({ __type: "TransactionCanceledException", CancellationReasons: reasons }),
    reasons,
  );
});

test("transactionCancellationReasons returns [] when the reasons array is absent", () => {
  assert.deepEqual(transactionCancellationReasons({ name: "TransactionCanceledException" }), []);
});

test("isTransactionConditionFailedAt pinpoints the failing item index", () => {
  const err = {
    name: "TransactionCanceledException",
    CancellationReasons: [{ Code: "None" }, { Code: "ConditionalCheckFailed" }],
  };
  // index 1 = the entitlement guard (the clobber case)
  assert.equal(isTransactionConditionFailedAt(err, 1), true);
  // index 0 didn't fail
  assert.equal(isTransactionConditionFailedAt(err, 0), false);
  // out of range / non-transaction errors are false, never throw
  assert.equal(isTransactionConditionFailedAt(err, 4), false);
  assert.equal(isTransactionConditionFailedAt(new Error("x"), 1), false);
});
