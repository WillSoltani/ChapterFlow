import { test } from "node:test";
import assert from "node:assert/strict";
import type { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";

import { isEmailSuppressed } from "./email-compliance";

// Regression for the suppression-fail-open defect (cluster T4 / finding E5).
//
// The reminder/nudge cron's suppression check used to swallow any DynamoDB error
// and return false ("not suppressed" → fail OPEN). During a partial DynamoDB
// outage that silently re-mailed addresses that had hard-bounced or filed a spam
// complaint (an implied opt-out) — a CASL/CAN-SPAM violation and a deliverability
// hazard. The check must now FAIL CLOSED: a read error is treated as suppressed
// so the individual send is skipped, not all email.

/** A stub DynamoDBDocumentClient whose send() resolves with a fixed result. */
function ddbReturning(item: Record<string, unknown> | undefined): DynamoDBDocumentClient {
  return {
    send: async () => ({ Item: item }),
  } as unknown as DynamoDBDocumentClient;
}

/** A stub DynamoDBDocumentClient whose send() rejects (transient DynamoDB blip). */
function ddbThrowing(): DynamoDBDocumentClient {
  return {
    send: async () => {
      throw new Error("ProvisionedThroughputExceededException: transient blip");
    },
  } as unknown as DynamoDBDocumentClient;
}

test("isEmailSuppressed: suppression record present → suppressed", async () => {
  const result = await isEmailSuppressed(
    ddbReturning({ email: "bounced@example.com" }),
    "BookTable",
    "bounced@example.com",
  );
  assert.equal(result, true);
});

test("isEmailSuppressed: no suppression record → not suppressed (send allowed)", async () => {
  const result = await isEmailSuppressed(ddbReturning(undefined), "BookTable", "ok@example.com");
  assert.equal(result, false);
});

test("isEmailSuppressed: empty email short-circuits to not suppressed", async () => {
  const result = await isEmailSuppressed(ddbThrowing(), "BookTable", "");
  assert.equal(result, false);
});

test("isEmailSuppressed: DynamoDB read ERROR fails CLOSED (treated as suppressed)", async () => {
  // The defect: this used to return false (fail open) and re-mail a complained
  // address during a DynamoDB blip. It must now return true so the send is skipped.
  const result = await isEmailSuppressed(
    ddbThrowing(),
    "BookTable",
    "complained@example.com",
  );
  assert.equal(result, true);
});
