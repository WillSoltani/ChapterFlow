import { test, before } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import {
  verifyAppleTransactionForUser,
  type AppleVerifyServiceDependencies,
} from "./apple-verify-service-core";

const require = createRequire(import.meta.url);
const Module = require("node:module") as {
  _load: (request: string, parent: unknown, isMain: boolean) => unknown;
};
const originalLoad = Module._load;
Module._load = function patchedLoad(
  request: string,
  parent: unknown,
  isMain: boolean,
) {
  if (request === "server-only") return {};
  return originalLoad.call(this, request, parent, isMain);
};

let withBookApiErrors: typeof import("./http").withBookApiErrors;
let bookOk: typeof import("./http").bookOk;

before(async () => {
  ({ withBookApiErrors, bookOk } = await import("./http"));
});

const USER = "8f14e45f-ea4f-4a1b-8c32-07bbf1cdb22f";
const NOW = Date.parse("2027-01-01T00:00:00Z");

function dependencies(
  productId: string,
): AppleVerifyServiceDependencies {
  return {
    nowMs: () => NOW,
    verifyTransactionJws: async () => ({
      bundleId: "com.chapterflow.ios",
      appAppleId: 1234567890,
      productId,
      transactionId: "2000000123456789",
      originalTransactionId: "1000000987654321",
      environment: "Production",
      subscriptionGroupIdentifier: "12345678",
      appAccountToken: USER,
      inAppOwnershipType: "PURCHASED",
      expiresDate: NOW + 1000,
      signedDate: NOW,
      type: "Auto-Renewable Subscription",
    }),
    getPolicy: async () => ({
      bundleId: "com.chapterflow.ios",
      appAppleId: 1234567890,
      productIds: new Set(["com.chapterflow.pro.monthly"]),
      subscriptionGroupIdentifier: "12345678",
      environment: "Production",
      testFlightSandbox: { enabled: false, qaUserHashes: new Set() },
    }),
    getExistingClaim: async () => null,
    claimTransaction: async () => true,
    updateEntitlement: async () => true,
    getEntitlement: async () => null,
  };
}

test("authenticated verification policy error uses the stable Book API envelope", async () => {
  const requestId = "Root=1-apple-policy-test";
  const request = new Request(
    "https://chapterflow.test/app/api/book/me/billing/apple/verify",
    {
      method: "POST",
      headers: {
        authorization: "Bearer fixture.id.token",
        "x-amzn-trace-id": requestId,
      },
    },
  );
  const response = await withBookApiErrors(request, async () =>
    bookOk(
      await verifyAppleTransactionForUser({
        userId: USER,
        transactionJws: "signed-fixture",
        dependencies: dependencies("com.chapterflow.pro.foreign"),
      }),
    ),
  );

  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), {
    error: {
      code: "product_not_allowed",
      message: "This App Store product is not supported.",
      requestId,
    },
  });
});
