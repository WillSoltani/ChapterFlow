import { test } from "node:test";
import assert from "node:assert/strict";
import { AppleJwsVerificationError } from "./apple-jws-verify-core";
import { verifyAppleTransactionWithTestFlightFallback } from "./apple-testflight-verification-core";
import type { ApplePurchasePolicy } from "./apple-purchase-policy-core";
import { hashAppleTestFlightSubject } from "./apple-testflight-subject-hash-core";

const QA_USER = "8f14e45f-ea4f-4a1b-8c32-07bbf1cdb22f";
const policy: ApplePurchasePolicy = {
  bundleId: "com.chapterflow.ios",
  appAppleId: 6787864558,
  productIds: new Set(["com.chapterflow.pro.monthly"]),
  subscriptionGroupIdentifier: "22211821",
  environment: "Production",
  testFlightSandbox: {
    enabled: true,
    qaUserHashes: new Set([hashAppleTestFlightSubject(QA_USER)]),
  },
};

test("allowlisted QA account falls back only after authenticated environment mismatch", async () => {
  const environments: string[] = [];
  const payload = await verifyAppleTransactionWithTestFlightFallback({
    jws: "fixture",
    policy,
    authenticatedUserId: QA_USER,
    verify: async (_jws, selectedPolicy) => {
      environments.push(selectedPolicy.environment);
      if (selectedPolicy.environment === "Production") {
        throw new AppleJwsVerificationError(
          "invalid_environment",
          "fixture Sandbox JWS",
        );
      }
      return { environment: "Sandbox" };
    },
  });
  assert.deepEqual(environments, ["Production", "Sandbox"]);
  assert.equal(payload.environment, "Sandbox");
});

for (const error of [
  new AppleJwsVerificationError("bad_signature", "fixture"),
  new AppleJwsVerificationError(
    "verification_unavailable",
    "fixture",
    true,
  ),
]) {
  test(`${error.code} never falls back to Sandbox`, async () => {
    let calls = 0;
    await assert.rejects(
      () =>
        verifyAppleTransactionWithTestFlightFallback({
          jws: "fixture",
          policy,
          authenticatedUserId: QA_USER,
          verify: async () => {
            calls += 1;
            throw error;
          },
        }),
      error,
    );
    assert.equal(calls, 1);
  });
}

test("nonallowlisted and disabled accounts never get Sandbox fallback", async () => {
  for (const candidatePolicy of [
    policy,
    {
      ...policy,
      testFlightSandbox: { enabled: false, qaUserHashes: new Set<string>() },
    },
  ]) {
    let calls = 0;
    await assert.rejects(
      () =>
        verifyAppleTransactionWithTestFlightFallback({
          jws: "fixture",
          policy: candidatePolicy,
          authenticatedUserId:
            candidatePolicy === policy
              ? "2c1743a3-9130-4fbf-b67d-f8e4f069f9f9"
              : QA_USER,
          verify: async () => {
            calls += 1;
            throw new AppleJwsVerificationError(
              "invalid_environment",
              "fixture",
            );
          },
        }),
      AppleJwsVerificationError,
    );
    assert.equal(calls, 1);
  }
});

test("ordinary staging Sandbox verification never enters the prod fallback", async () => {
  const sandboxPolicy: ApplePurchasePolicy = {
    ...policy,
    environment: "Sandbox",
    testFlightSandbox: { enabled: false, qaUserHashes: new Set() },
  };
  let calls = 0;
  const payload = await verifyAppleTransactionWithTestFlightFallback({
    jws: "fixture",
    policy: sandboxPolicy,
    authenticatedUserId: QA_USER,
    verify: async (_jws, selectedPolicy) => {
      calls += 1;
      assert.equal(selectedPolicy.environment, "Sandbox");
      return { environment: "Sandbox" };
    },
  });
  assert.equal(calls, 1);
  assert.equal(payload.environment, "Sandbox");
});
