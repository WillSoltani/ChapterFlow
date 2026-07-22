import { test } from "node:test";
import assert from "node:assert/strict";
import { classifyRetryableAwsError } from "./aws-retryable-error-core";

test("ProvisionedThroughputExceededException (httpStatusCode 400) classifies retryable", () => {
  const err = Object.assign(new Error("rate exceeded"), {
    name: "ProvisionedThroughputExceededException",
    $metadata: { httpStatusCode: 400 },
  });
  assert.ok(classifyRetryableAwsError(err));
});

test("S3 SlowDown (503) classifies retryable", () => {
  assert.ok(
    classifyRetryableAwsError(
      Object.assign(new Error("slow"), { name: "SlowDown", $metadata: { httpStatusCode: 503 } })
    )
  );
});

test("$retryable.throttling=true classifies retryable", () => {
  assert.ok(
    classifyRetryableAwsError(
      Object.assign(new Error("x"), { $retryable: { throttling: true }, $metadata: {} })
    )
  );
});

test("$metadata 429 classifies retryable", () => {
  assert.ok(classifyRetryableAwsError(Object.assign(new Error("x"), { $metadata: { httpStatusCode: 429 } })));
});

test("a plain Error / BookApiError / AuthError classifies null", () => {
  assert.equal(classifyRetryableAwsError(new Error("boom")), null);
});

test("an object with httpStatusCode but no $metadata classifies null", () => {
  assert.equal(classifyRetryableAwsError({ httpStatusCode: 503 }), null);
});
