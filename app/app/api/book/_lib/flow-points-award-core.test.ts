import { test } from "node:test";
import assert from "node:assert/strict";

import { BookApiError } from "./errors";
import {
  AWARD_TX_MAX_ATTEMPTS,
  classifyAwardTransactionError,
  runAwardTransaction,
} from "./flow-points-award-core";

function txCancel(codes: string[]) {
  return {
    name: "TransactionCanceledException",
    CancellationReasons: codes.map((Code) => ({ Code })),
  };
}

const noSleep = async () => {};

test("a failed condition on the grant marker is a duplicate", () => {
  assert.equal(
    classifyAwardTransactionError(txCancel(["ConditionalCheckFailed", "None", "None"])),
    "duplicate"
  );
});

test("a conflict on the engagement row is transient, not a duplicate", () => {
  assert.equal(
    classifyAwardTransactionError(txCancel(["None", "TransactionConflict", "None"])),
    "transient"
  );
});

test("throttling and capacity cancellations are transient", () => {
  assert.equal(classifyAwardTransactionError(txCancel(["ThrottlingError", "None", "None"])), "transient");
  assert.equal(
    classifyAwardTransactionError(txCancel(["None", "ProvisionedThroughputExceeded", "None"])),
    "transient"
  );
});

test("a cancellation with no reasons is transient", () => {
  assert.equal(classifyAwardTransactionError({ name: "TransactionCanceledException" }), "transient");
});

test("a condition failure on the ledger row is transient (fresh id on retry)", () => {
  assert.equal(
    classifyAwardTransactionError(txCancel(["None", "None", "ConditionalCheckFailed"])),
    "transient"
  );
});

test("a plain conditional failure stays a duplicate; other errors rethrow", () => {
  assert.equal(classifyAwardTransactionError({ name: "ConditionalCheckFailedException" }), "duplicate");
  assert.equal(classifyAwardTransactionError(new Error("boom")), "rethrow");
  assert.equal(classifyAwardTransactionError(null), "rethrow");
});

test("runAwardTransaction retries a conflict and then awards", async () => {
  let calls = 0;
  const result = await runAwardTransaction({
    sleep: noSleep,
    write: async () => {
      calls += 1;
      if (calls < 3) throw txCancel(["None", "TransactionConflict", "None"]);
    },
  });
  assert.equal(result, "awarded");
  assert.equal(calls, 3);
});

test("runAwardTransaction reports duplicate without retrying", async () => {
  let calls = 0;
  const result = await runAwardTransaction({
    sleep: noSleep,
    write: async () => {
      calls += 1;
      throw txCancel(["ConditionalCheckFailed", "None", "None"]);
    },
  });
  assert.equal(result, "duplicate");
  assert.equal(calls, 1);
});

test("runAwardTransaction surfaces a 503 after the retry budget", async () => {
  let calls = 0;
  await assert.rejects(
    runAwardTransaction({
      sleep: noSleep,
      write: async () => {
        calls += 1;
        throw txCancel(["None", "ThrottlingError", "None"]);
      },
    }),
    (error: unknown) =>
      error instanceof BookApiError && error.status === 503 && error.code === "points_award_contended"
  );
  assert.equal(calls, AWARD_TX_MAX_ATTEMPTS);
});

test("runAwardTransaction rethrows non-cancellation errors at once", async () => {
  let calls = 0;
  const boom = new Error("boom");
  await assert.rejects(
    runAwardTransaction({
      sleep: noSleep,
      write: async () => {
        calls += 1;
        throw boom;
      },
    }),
    (error: unknown) => error === boom
  );
  assert.equal(calls, 1);
});
