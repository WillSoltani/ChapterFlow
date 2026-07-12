import { test } from "node:test";
import assert from "node:assert/strict";
import {
  appleJwsBookApiError,
  verifyAppleTransactionForUser,
  type AppleVerifyServiceDependencies,
} from "./apple-verify-service-core";
import type { ApplePurchasePolicy } from "./apple-purchase-policy-core";
import type { AppleEntitlementWriteParams } from "./apple-entitlement-write-core";
import { BookApiError } from "./errors";
import { AppleJwsVerificationError } from "./apple-jws-verify-core";
import { hashAppleTestFlightSubject } from "./apple-testflight-subject-hash-core";

const NOW = Date.parse("2027-01-01T00:00:00Z");
const USER = "8f14e45f-ea4f-4a1b-8c32-07bbf1cdb22f";
const OTHER_USER = "2c1743a3-9130-4fbf-b67d-f8e4f069f9f9";
const ORIGINAL_TRANSACTION = "1000000987654321";
const policy: ApplePurchasePolicy = {
  bundleId: "com.chapterflow.ios",
  appAppleId: 1234567890,
  productIds: new Set([
    "com.chapterflow.pro.monthly",
    "com.chapterflow.pro.annual",
  ]),
  subscriptionGroupIdentifier: "12345678",
  environment: "Production",
  testFlightSandbox: { enabled: false, qaUserHashes: new Set() },
};

function transaction(
  patch: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    bundleId: policy.bundleId,
    productId: "com.chapterflow.pro.monthly",
    transactionId: "2000000123456789",
    originalTransactionId: ORIGINAL_TRANSACTION,
    environment: policy.environment,
    subscriptionGroupIdentifier: policy.subscriptionGroupIdentifier,
    appAccountToken: USER,
    inAppOwnershipType: "PURCHASED",
    expiresDate: NOW + 30 * 24 * 60 * 60 * 1000,
    signedDate: NOW,
    type: "Auto-Renewable Subscription",
    ...patch,
  };
}

function harness(
  initialPayload = transaction(),
  activePolicy: ApplePurchasePolicy = policy,
) {
  let payload = initialPayload;
  const owners = new Map<string, string>();
  const bindingVersions = new Map<string, string>();
  const mutations: Array<AppleEntitlementWriteParams & { userId: string }> = [];
  const claimEnvironments: string[] = [];
  const signedEnvironments: string[] = [];
  const mutationEnvironments: string[] = [];
  const readEnvironments: string[] = [];
  let entitlement: {
    plan?: string;
    proStatus?: string;
    proSource?: string;
    currentPeriodEnd?: string;
    cancelAtPeriodEnd?: boolean;
  } | null = null;
  let claimCalls = 0;
  const ownerKey = (id: string, storageLane = "Primary") =>
    storageLane === "Primary" ? id : `${storageLane}:${id}`;

  const dependencies: AppleVerifyServiceDependencies = {
    nowMs: () => NOW,
    verifyTransactionJws: async () => payload,
    getPolicy: async () => activePolicy,
    getExistingClaim: async (id, storageLane) => {
      readEnvironments.push(storageLane);
      const key = ownerKey(id, storageLane);
      const owner = owners.get(key);
      return owner
        ? {
            userId: owner,
            accountBindingVersion: bindingVersions.get(key),
          }
        : null;
    },
    claimTransaction: async (
      id,
      userId,
      bindingVersion,
      storageLane,
      storeEnvironment,
    ) => {
      claimCalls += 1;
      const resolvedStorageLane = storageLane ?? "Primary";
      claimEnvironments.push(resolvedStorageLane);
      if (storeEnvironment) signedEnvironments.push(storeEnvironment);
      const key = ownerKey(id, resolvedStorageLane);
      const owner = owners.get(key);
      if (owner && owner !== userId) return false;
      owners.set(key, userId);
      if (bindingVersion) bindingVersions.set(key, bindingVersion);
      return true;
    },
    updateEntitlement: async (params, storageLane) => {
      mutations.push(params);
      mutationEnvironments.push(storageLane);
      entitlement = {
        plan: params.plan,
        proStatus: params.proStatus,
        proSource: params.plan === "PRO" ? "apple" : undefined,
        currentPeriodEnd: params.currentPeriodEnd,
        cancelAtPeriodEnd: params.cancelAtPeriodEnd,
      };
      return true;
    },
    getEntitlement: async (_userId, storageLane) => {
      readEnvironments.push(storageLane);
      return entitlement;
    },
  };

  return {
    dependencies,
    owners,
    bindingVersions,
    mutations,
    claimEnvironments,
    signedEnvironments,
    mutationEnvironments,
    readEnvironments,
    setPayload(next: Record<string, unknown>) {
      payload = next;
    },
    setEntitlement(next: typeof entitlement) {
      entitlement = next;
    },
    claimCalls() {
      return claimCalls;
    },
    setOwner(
      storageLane: "Primary" | "TestFlightSandbox",
      userId: string,
    ) {
      owners.set(ownerKey(ORIGINAL_TRANSACTION, storageLane), userId);
    },
  };
}

async function expectCode(
  promise: Promise<unknown>,
  code: string,
  status: number,
): Promise<void> {
  await assert.rejects(promise, (error: unknown) => {
    assert.ok(error instanceof BookApiError);
    assert.equal(error.code, code);
    assert.equal(error.status, status);
    return true;
  });
}

test("authenticated active purchase is bound, claimed, written, and acknowledged", async () => {
  const state = harness();
  const response = await verifyAppleTransactionForUser({
    userId: USER,
    transactionJws: "signed-fixture",
    dependencies: state.dependencies,
  });

  assert.equal(state.owners.get(ORIGINAL_TRANSACTION), USER);
  assert.equal(
    state.bindingVersions.get(ORIGINAL_TRANSACTION),
    "cognito_sub_v1",
  );
  assert.equal(state.mutations.length, 1);
  assert.equal(state.mutations[0].guard, "activate");
  assert.equal(
    state.mutations[0].cancelAtPeriodEnd,
    undefined,
    "a transaction JWS has no renewal-status authority",
  );
  assert.deepEqual(response, {
    ok: true,
    processed: true,
    transactionState: "active",
    entitlement: {
      plan: "PRO",
      proStatus: "active",
      proSource: "apple",
      currentPeriodEnd: "2027-01-31T00:00:00.000Z",
      cancelAtPeriodEnd: false,
    },
  });
});

test("allowlisted Production QA purchase stays in the Sandbox namespace", async () => {
  const sandboxPolicy: ApplePurchasePolicy = {
    ...policy,
    testFlightSandbox: {
      enabled: true,
      qaUserHashes: new Set([hashAppleTestFlightSubject(USER)]),
    },
  };
  const state = harness(
    transaction({ environment: "Sandbox" }),
    sandboxPolicy,
  );

  const response = await verifyAppleTransactionForUser({
    userId: USER,
    transactionJws: "sandbox-signed-fixture",
    dependencies: state.dependencies,
  });

  assert.equal(response.entitlement.plan, "PRO");
  assert.equal(
    state.owners.get(`TestFlightSandbox:${ORIGINAL_TRANSACTION}`),
    USER,
  );
  assert.equal(state.owners.has(ORIGINAL_TRANSACTION), false);
  assert.deepEqual(state.claimEnvironments, ["TestFlightSandbox"]);
  assert.deepEqual(state.signedEnvironments, ["Sandbox"]);
  assert.deepEqual(state.mutationEnvironments, ["TestFlightSandbox"]);
  assert.deepEqual(state.readEnvironments, [
    "TestFlightSandbox",
    "TestFlightSandbox",
  ]);
});

test("ordinary staging Sandbox purchase stays on the Primary entitlement lane", async () => {
  const stagingPolicy: ApplePurchasePolicy = {
    ...policy,
    environment: "Sandbox",
    testFlightSandbox: { enabled: false, qaUserHashes: new Set() },
  };
  const state = harness(
    transaction({ environment: "Sandbox" }),
    stagingPolicy,
  );

  const response = await verifyAppleTransactionForUser({
    userId: USER,
    transactionJws: "staging-sandbox-signed-fixture",
    dependencies: state.dependencies,
  });

  assert.equal(response.entitlement.plan, "PRO");
  assert.equal(state.owners.get(ORIGINAL_TRANSACTION), USER);
  assert.deepEqual(state.claimEnvironments, ["Primary"]);
  assert.deepEqual(state.signedEnvironments, ["Sandbox"]);
  assert.deepEqual(state.mutationEnvironments, ["Primary"]);
  assert.deepEqual(state.readEnvironments, ["Primary", "Primary"]);
});

test("non-allowlisted Sandbox purchase fails before every ownership write", async () => {
  const sandboxPolicy: ApplePurchasePolicy = {
    ...policy,
    testFlightSandbox: {
      enabled: true,
      qaUserHashes: new Set([hashAppleTestFlightSubject(USER)]),
    },
  };
  const state = harness(
    transaction({ environment: "Sandbox", appAccountToken: OTHER_USER }),
    sandboxPolicy,
  );

  await expectCode(
    verifyAppleTransactionForUser({
      userId: OTHER_USER,
      transactionJws: "sandbox-signed-fixture",
      dependencies: state.dependencies,
    }),
    "transaction_environment_mismatch",
    400,
  );
  assert.equal(state.claimCalls(), 0);
  assert.equal(state.mutations.length, 0);
  assert.deepEqual(state.readEnvironments, []);
});

test("Production ownership never collides with the same Sandbox transaction id", async () => {
  const sandboxPolicy: ApplePurchasePolicy = {
    ...policy,
    testFlightSandbox: {
      enabled: true,
      qaUserHashes: new Set([hashAppleTestFlightSubject(USER)]),
    },
  };
  const state = harness(transaction({ environment: "Sandbox" }), sandboxPolicy);
  state.setOwner("Primary", OTHER_USER);

  const response = await verifyAppleTransactionForUser({
    userId: USER,
    transactionJws: "sandbox-signed-fixture",
    dependencies: state.dependencies,
  });

  assert.equal(response.processed, true);
  assert.equal(state.owners.get(ORIGINAL_TRANSACTION), OTHER_USER);
  assert.equal(
    state.owners.get(`TestFlightSandbox:${ORIGINAL_TRANSACTION}`),
    USER,
  );
});

test("Sandbox ownership remains account-bound inside its own namespace", async () => {
  const sandboxPolicy: ApplePurchasePolicy = {
    ...policy,
    testFlightSandbox: {
      enabled: true,
      qaUserHashes: new Set([hashAppleTestFlightSubject(USER)]),
    },
  };
  const state = harness(transaction({ environment: "Sandbox" }), sandboxPolicy);
  state.setOwner("TestFlightSandbox", OTHER_USER);

  await expectCode(
    verifyAppleTransactionForUser({
      userId: USER,
      transactionJws: "sandbox-replay-fixture",
      dependencies: state.dependencies,
    }),
    "transaction_already_claimed",
    409,
  );
  assert.equal(state.claimCalls(), 0);
  assert.equal(state.mutations.length, 0);
});

const rejectedPolicyCases = [
  ["product_not_allowed", { productId: "com.chapterflow.pro.foreign" }],
  ["transaction_environment_mismatch", { environment: "Sandbox" }],
  ["subscription_group_mismatch", { subscriptionGroupIdentifier: "99999999" }],
  ["family_shared_not_supported", { inAppOwnershipType: "FAMILY_SHARED" }],
  ["unsupported_transaction_type", { type: "Consumable" }],
  ["unsupported_ownership_type", { inAppOwnershipType: undefined }],
] as const;

for (const [code, patch] of rejectedPolicyCases) {
  test(`${code} is stable and performs no claim or entitlement write`, async () => {
    const state = harness(transaction(patch));
    await expectCode(
      verifyAppleTransactionForUser({
        userId: USER,
        transactionJws: "signed-fixture",
        dependencies: state.dependencies,
      }),
      code,
      400,
    );
    assert.equal(state.claimCalls(), 0);
    assert.equal(state.mutations.length, 0);
  });
}

for (const patch of [
  { originalTransactionId: undefined },
  { transactionId: undefined },
  { signedDate: undefined },
  { expiresDate: undefined },
]) {
  test(`missing required signed field fails before claim: ${Object.keys(patch)[0]}`, async () => {
    const state = harness(transaction(patch));
    await expectCode(
      verifyAppleTransactionForUser({
        userId: USER,
        transactionJws: "signed-fixture",
        dependencies: state.dependencies,
      }),
      "unsupported_transaction",
      400,
    );
    assert.equal(state.claimCalls(), 0);
    assert.equal(state.mutations.length, 0);
  });
}

const rejectedBindingCases = [
  ["account_token_required", { appAccountToken: undefined }, 400],
  ["account_token_malformed", { appAccountToken: "not-a-uuid" }, 400],
  ["account_token_mismatch", { appAccountToken: OTHER_USER }, 409],
] as const;

for (const [code, patch, status] of rejectedBindingCases) {
  test(`${code} rejects a first claim before mutation`, async () => {
    const state = harness(transaction(patch));
    await expectCode(
      verifyAppleTransactionForUser({
        userId: USER,
        transactionJws: "signed-fixture",
        dependencies: state.dependencies,
      }),
      code,
      status,
    );
    assert.equal(state.claimCalls(), 0);
    assert.equal(state.mutations.length, 0);
  });
}

test("cross-account first claim fails, then the signed initiating account succeeds", async () => {
  const state = harness();
  await expectCode(
    verifyAppleTransactionForUser({
      userId: OTHER_USER,
      transactionJws: "stolen-signed-fixture",
      dependencies: state.dependencies,
    }),
    "account_token_mismatch",
    409,
  );
  assert.equal(state.owners.size, 0);

  const response = await verifyAppleTransactionForUser({
    userId: USER,
    transactionJws: "signed-fixture",
    dependencies: state.dependencies,
  });
  assert.equal(response.transactionState, "active");
  assert.equal(state.owners.get(ORIGINAL_TRANSACTION), USER);
});

test("cross-account replay of an existing claim is refused", async () => {
  const state = harness();
  state.owners.set(ORIGINAL_TRANSACTION, USER);
  state.setPayload(transaction({ appAccountToken: OTHER_USER }));
  await expectCode(
    verifyAppleTransactionForUser({
      userId: OTHER_USER,
      transactionJws: "replayed-signed-fixture",
      dependencies: state.dependencies,
    }),
    "transaction_already_claimed",
    409,
  );
  assert.equal(state.claimCalls(), 0);
  assert.equal(state.mutations.length, 0);
});

test("legacy tokenless transaction is accepted only for its existing same-user map", async () => {
  const state = harness(transaction({ appAccountToken: undefined }));
  state.owners.set(ORIGINAL_TRANSACTION, USER);
  const response = await verifyAppleTransactionForUser({
    userId: USER,
    transactionJws: "legacy-signed-fixture",
    dependencies: state.dependencies,
  });
  assert.equal(response.processed, true);
  assert.equal(state.claimCalls(), 1);
});

test("non-UUID authenticated subject fails closed before claim", async () => {
  const state = harness(transaction({ appAccountToken: USER }));
  await expectCode(
    verifyAppleTransactionForUser({
      userId: "legacy-non-uuid-sub",
      transactionJws: "signed-fixture",
      dependencies: state.dependencies,
    }),
    "account_identifier_unsupported",
    409,
  );
  assert.equal(state.claimCalls(), 0);
});

test("a claim race is classified without writing an entitlement", async () => {
  const state = harness();
  state.dependencies.claimTransaction = async () => false;
  await expectCode(
    verifyAppleTransactionForUser({
      userId: USER,
      transactionJws: "signed-fixture",
      dependencies: state.dependencies,
    }),
    "transaction_already_claimed",
    409,
  );
  assert.equal(state.mutations.length, 0);
});

test("active purchase never fabricates a grant when the authoritative read is empty", async () => {
  const state = harness();
  state.dependencies.updateEntitlement = async (params) => {
    state.mutations.push(params);
    return true;
  };
  await expectCode(
    verifyAppleTransactionForUser({
      userId: USER,
      transactionJws: "signed-fixture",
      dependencies: state.dependencies,
    }),
    "entitlement_confirmation_unavailable",
    503,
  );
});

for (const proSource of ["license", "admin"] as const) {
  test(`active Apple transaction is processed under authoritative ${proSource} access`, async () => {
    const state = harness();
    state.setEntitlement({
      plan: "PRO",
      proStatus: "active",
      proSource,
      currentPeriodEnd: "2027-12-31T00:00:00.000Z",
      cancelAtPeriodEnd: false,
    });
    state.dependencies.updateEntitlement = async (params, environment) => {
      state.mutations.push(params);
      state.mutationEnvironments.push(environment);
      return false;
    };

    const response = await verifyAppleTransactionForUser({
      userId: USER,
      transactionJws: "active-signed-fixture",
      dependencies: state.dependencies,
    });

    assert.equal(response.ok, true);
    assert.equal(response.processed, true);
    assert.equal(response.transactionState, "active");
    assert.equal(response.entitlement.plan, "PRO");
    assert.equal(response.entitlement.proSource, proSource);
    assert.equal(state.mutations[0].guard, "activate");
  });
}

test("JWS verification failures retain the stable invalid_transaction code", async () => {
  const state = harness();
  state.dependencies.verifyTransactionJws = async () => {
    throw new AppleJwsVerificationError("bad_signature", "fixture failure");
  };
  await expectCode(
    verifyAppleTransactionForUser({
      userId: USER,
      transactionJws: "invalid-fixture",
      dependencies: state.dependencies,
    }),
    "invalid_transaction",
    400,
  );
  assert.equal(state.claimCalls(), 0);
});

test("official OCSP transport failure remains retryable", async () => {
  const state = harness();
  state.dependencies.verifyTransactionJws = async () => {
    throw new AppleJwsVerificationError(
      "verification_unavailable",
      "fixture OCSP outage",
      true,
    );
  };
  await expectCode(
    verifyAppleTransactionForUser({
      userId: USER,
      transactionJws: "signed-fixture",
      dependencies: state.dependencies,
    }),
    "apple_verification_unavailable",
    503,
  );
  assert.equal(state.claimCalls(), 0);
});

for (const [verifierCode, expectedApiCode] of [
  ["invalid_app_identifier", "bundle_mismatch"],
  ["invalid_environment", "transaction_environment_mismatch"],
] as const) {
  test(`official ${verifierCode} precheck preserves ${expectedApiCode}`, async () => {
    const state = harness();
    state.dependencies.verifyTransactionJws = async () => {
      throw new AppleJwsVerificationError(verifierCode, "fixture mismatch");
    };
    await expectCode(
      verifyAppleTransactionForUser({
        userId: USER,
        transactionJws: "signed-fixture",
        dependencies: state.dependencies,
      }),
      expectedApiCode,
      400,
    );
    assert.equal(state.claimCalls(), 0);
  });
}

test("notification identity precheck can preserve appAppleId mismatch", () => {
  const error = appleJwsBookApiError({
    error: new AppleJwsVerificationError(
      "invalid_app_identifier",
      "fixture mismatch",
    ),
    invalidCode: "invalid_signature",
    invalidMessage: "Invalid notification signature.",
    identityCode: "app_apple_id_mismatch",
    identityMessage: "Wrong App Store app.",
  });
  assert.equal(error.status, 400);
  assert.equal(error.code, "app_apple_id_mismatch");
});

for (const [transactionState, patch, expectedStatus] of [
  ["expired", { expiresDate: NOW - 1 }, "inactive"],
  ["revoked", { revocationDate: NOW - 1 }, "canceled"],
] as const) {
  test(`${transactionState} transaction is safely processed without granting`, async () => {
    const state = harness(transaction(patch));
    const response = await verifyAppleTransactionForUser({
      userId: USER,
      transactionJws: "terminal-signed-fixture",
      dependencies: state.dependencies,
    });
    assert.equal(response.ok, true);
    assert.equal(response.processed, true);
    assert.equal(response.transactionState, transactionState);
    assert.equal(response.entitlement.plan, "FREE");
    assert.equal(response.entitlement.proStatus, expectedStatus);
    const serialized = JSON.parse(JSON.stringify(response)) as {
      entitlement: Record<string, unknown>;
    };
    assert.equal(
      Object.prototype.hasOwnProperty.call(
        serialized.entitlement,
        "proSource",
      ),
      false,
      "terminal JSON omits an unknown source instead of fabricating Apple",
    );
    assert.equal(state.mutations[0].guard, "apple_only");
    assert.equal(state.mutations[0].plan, "FREE");
  });
}

test("terminal processing cannot downgrade an authoritative Stripe entitlement", async () => {
  const state = harness(transaction({ expiresDate: NOW - 1 }));
  state.setEntitlement({
    plan: "PRO",
    proStatus: "active",
    proSource: "stripe",
    cancelAtPeriodEnd: false,
  });
  state.dependencies.updateEntitlement = async (params) => {
    state.mutations.push(params);
    return false;
  };
  const response = await verifyAppleTransactionForUser({
    userId: USER,
    transactionJws: "terminal-signed-fixture",
    dependencies: state.dependencies,
  });
  assert.equal(response.transactionState, "expired");
  assert.equal(response.entitlement.plan, "PRO");
  assert.equal(response.entitlement.proSource, "stripe");
  assert.equal(state.mutations[0].guard, "apple_only");
});
