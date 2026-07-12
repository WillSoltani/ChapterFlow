import { test } from "node:test";
import assert from "node:assert/strict";
import {
  normalizeAppleAccountToken,
  buildAppleIapPolicyFromEnv,
  isAppleTestFlightSandboxUserAllowedFromEnv,
  parseAppleTestFlightSandboxConfig,
  parseAppleProductAllowlist,
  resolveAppleStorageLane,
  resolveAppleTransactionEnvironment,
  validateAppleAccountBinding,
  validateAppleNotificationAccountBinding,
  validateAppleNotificationEnvelopePolicy,
  validateAppleNotificationMutationShape,
  validateApplePurchasePolicy,
  type ApplePurchasePolicy,
} from "./apple-purchase-policy-core";
import type { AppleTransactionInfo } from "./apple-jws-verify-core";
import { hashAppleTestFlightSubject } from "./apple-testflight-subject-hash-core";

const USER = "8f14e45f-ea4f-4a1b-8c32-07bbf1cdb22f";
const OTHER_USER = "2c1743a3-9130-4fbf-b67d-f8e4f069f9f9";
const USER_HASH = hashAppleTestFlightSubject(USER);
const OTHER_USER_HASH = hashAppleTestFlightSubject(OTHER_USER);
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
const transaction: AppleTransactionInfo = {
  bundleId: policy.bundleId,
  productId: "com.chapterflow.pro.monthly",
  environment: "Production",
  subscriptionGroupIdentifier: policy.subscriptionGroupIdentifier,
  type: "Auto-Renewable Subscription",
  inAppOwnershipType: "PURCHASED",
};

test("production transaction matches the exact deployment policy", () => {
  assert.equal(validateApplePurchasePolicy(transaction, policy), null);
});

const policyCases: Array<{
  name: string;
  patch: Partial<AppleTransactionInfo>;
  expected: string;
}> = [
  {
    name: "wrong bundle",
    patch: { bundleId: "com.attacker.app" },
    expected: "bundle_mismatch",
  },
  {
    name: "Sandbox transaction",
    patch: { environment: "Sandbox" },
    expected: "transaction_environment_mismatch",
  },
  {
    name: "missing environment",
    patch: { environment: undefined },
    expected: "transaction_environment_mismatch",
  },
  {
    name: "wrong product",
    patch: { productId: "com.chapterflow.pro.unreleased" },
    expected: "product_not_allowed",
  },
  {
    name: "wrong group",
    patch: { subscriptionGroupIdentifier: "87654321" },
    expected: "subscription_group_mismatch",
  },
  {
    name: "non-subscription transaction",
    patch: { type: "Non-Consumable" },
    expected: "unsupported_transaction_type",
  },
  {
    name: "family-shared transaction",
    patch: { inAppOwnershipType: "FAMILY_SHARED" },
    expected: "family_shared_not_supported",
  },
  {
    name: "missing ownership type",
    patch: { inAppOwnershipType: undefined },
    expected: "unsupported_ownership_type",
  },
];

for (const scenario of policyCases) {
  test(`policy rejects ${scenario.name}`, () => {
    assert.equal(
      validateApplePurchasePolicy({ ...transaction, ...scenario.patch }, policy),
      scenario.expected,
    );
  });
}

test("staging policy accepts Sandbox but never Production", () => {
  const sandboxPolicy = { ...policy, environment: "Sandbox" as const };
  assert.equal(
    validateApplePurchasePolicy(
      { ...transaction, environment: "Sandbox" },
      sandboxPolicy,
    ),
    null,
  );
  assert.equal(
    validateApplePurchasePolicy(transaction, sandboxPolicy),
    "transaction_environment_mismatch",
  );
  assert.equal(
    resolveAppleStorageLane({
      signedEnvironment: "Sandbox",
      policy: sandboxPolicy,
    }),
    "Primary",
    "ordinary staging Sandbox must remain visible to default entitlement reads",
  );
});

test("Production Sandbox transactions require both opt-in and exact QA user", () => {
  const enabledPolicy: ApplePurchasePolicy = {
    ...policy,
    testFlightSandbox: { enabled: true, qaUserHashes: new Set([USER_HASH]) },
  };
  assert.equal(
    validateApplePurchasePolicy(
      { ...transaction, environment: "Sandbox" },
      enabledPolicy,
      { authenticatedUserId: USER },
    ),
    null,
  );
  assert.equal(
    resolveAppleTransactionEnvironment({
      signedEnvironment: "Sandbox",
      policy: enabledPolicy,
      authenticatedUserId: USER,
    }),
    "Sandbox",
  );
  assert.equal(
    resolveAppleStorageLane({
      signedEnvironment: "Sandbox",
      policy: enabledPolicy,
      authenticatedUserId: USER,
    }),
    "TestFlightSandbox",
  );
  for (const authenticatedUserId of [OTHER_USER, undefined]) {
    assert.equal(
      validateApplePurchasePolicy(
        { ...transaction, environment: "Sandbox" },
        enabledPolicy,
        { authenticatedUserId },
      ),
      "transaction_environment_mismatch",
    );
  }
});

test("TestFlight exception never weakens Production notification policy", () => {
  const enabledPolicy: ApplePurchasePolicy = {
    ...policy,
    testFlightSandbox: { enabled: true, qaUserHashes: new Set([USER_HASH]) },
  };
  assert.equal(
    validateAppleNotificationEnvelopePolicy({
      bundleId: policy.bundleId,
      appAppleId: policy.appAppleId,
      environment: "Sandbox",
      policy: enabledPolicy,
    }),
    "transaction_environment_mismatch",
  );
});

test("UUID normalization is exact and case-insensitive", () => {
  assert.equal(normalizeAppleAccountToken(USER.toUpperCase()), USER);
  assert.equal(normalizeAppleAccountToken("not-a-uuid"), null);
  assert.equal(normalizeAppleAccountToken(undefined), null);
});

test("new claims require a signed appAccountToken matching the authenticated sub", () => {
  assert.equal(
    validateAppleAccountBinding({
      authenticatedUserId: USER,
      appAccountToken: USER.toUpperCase(),
      existingOwnerId: null,
    }),
    null,
  );
  assert.equal(
    validateAppleAccountBinding({
      authenticatedUserId: USER,
      appAccountToken: undefined,
      existingOwnerId: null,
    }),
    "account_token_required",
  );
  assert.equal(
    validateAppleAccountBinding({
      authenticatedUserId: USER,
      appAccountToken: "malformed",
      existingOwnerId: null,
    }),
    "account_token_malformed",
  );
  assert.equal(
    validateAppleAccountBinding({
      authenticatedUserId: USER,
      appAccountToken: OTHER_USER,
      existingOwnerId: null,
    }),
    "account_token_mismatch",
  );
});

test("legacy tokenless replay is allowed only for an existing same-user map", () => {
  assert.equal(
    validateAppleAccountBinding({
      authenticatedUserId: USER,
      appAccountToken: undefined,
      existingOwnerId: USER,
    }),
    null,
  );
  assert.equal(
    validateAppleAccountBinding({
      authenticatedUserId: USER,
      appAccountToken: undefined,
      existingOwnerId: USER,
      existingBindingVersion: "cognito_sub_v1",
    }),
    null,
    "a mapped same-owner offer-code transaction may omit the token",
  );
  assert.equal(
    validateAppleAccountBinding({
      authenticatedUserId: USER,
      appAccountToken: undefined,
      existingOwnerId: OTHER_USER,
    }),
    "account_token_required",
    "a tokenless replay can never cross the preexisting owner map",
  );
});

test("notification compatibility allows nil only after a mapped owner exists", () => {
  assert.equal(
    validateAppleNotificationAccountBinding({
      mappedUserId: USER,
      appAccountToken: undefined,
    }),
    null,
  );
  assert.equal(
    validateAppleNotificationAccountBinding({
      mappedUserId: USER,
      appAccountToken: undefined,
      bindingVersion: "cognito_sub_v1",
    }),
    null,
    "a mapped same-owner offer-code transaction may omit the token",
  );
  assert.equal(
    validateAppleNotificationAccountBinding({
      mappedUserId: USER,
      appAccountToken: OTHER_USER,
    }),
    "account_token_mismatch",
  );
});

test("notification envelope requires exact signed bundle and environment", () => {
  assert.equal(
    validateAppleNotificationEnvelopePolicy({
      bundleId: policy.bundleId,
      appAppleId: policy.appAppleId,
      environment: policy.environment,
      policy,
    }),
    null,
  );
  assert.equal(
    validateAppleNotificationEnvelopePolicy({
      bundleId: policy.bundleId,
      appAppleId: policy.appAppleId,
      environment: "Sandbox",
      policy,
    }),
    "transaction_environment_mismatch",
  );
  assert.equal(
    validateAppleNotificationEnvelopePolicy({
      bundleId: undefined,
      appAppleId: policy.appAppleId,
      environment: policy.environment,
      policy,
    }),
    "bundle_mismatch",
  );
  assert.equal(
    validateAppleNotificationEnvelopePolicy({
      bundleId: policy.bundleId,
      appAppleId: 999999999,
      environment: policy.environment,
      policy,
    }),
    "app_apple_id_mismatch",
  );
  assert.equal(
    validateAppleNotificationEnvelopePolicy({
      bundleId: policy.bundleId,
      appAppleId: undefined,
      environment: policy.environment,
      policy,
    }),
    "app_apple_id_mismatch",
  );
  assert.equal(
    validateAppleNotificationEnvelopePolicy({
      bundleId: policy.bundleId,
      appAppleId: undefined,
      environment: "Sandbox",
      policy: { ...policy, environment: "Sandbox" },
    }),
    null,
    "Apple's official verifier requires appAppleId only in Production",
  );
});

test("notification mutations require orderable fields and active Pro expiry", () => {
  const complete = {
    ...transaction,
    transactionId: "2000000123456789",
    originalTransactionId: "1000000987654321",
    signedDateMs: 1_800_000_000_000,
    expiresDateMs: 1_900_000_000_000,
  };
  assert.equal(
    validateAppleNotificationMutationShape({
      transaction: complete,
      notificationSignedDateMs: 1_800_000_000_001,
      grantsPro: true,
      serviceExpiresDateMs: 1_900_000_000_000,
      nowMs: 1_800_000_000_000,
    }),
    null,
  );
  assert.equal(
    validateAppleNotificationMutationShape({
      transaction: { ...complete, transactionId: undefined },
      notificationSignedDateMs: 1_800_000_000_001,
      grantsPro: true,
      serviceExpiresDateMs: 1_900_000_000_000,
      nowMs: 1_800_000_000_000,
    }),
    "unsupported_transaction",
  );
  assert.equal(
    validateAppleNotificationMutationShape({
      transaction: { ...complete, expiresDateMs: 1_700_000_000_000 },
      notificationSignedDateMs: 1_800_000_000_001,
      grantsPro: true,
      serviceExpiresDateMs: 1_700_000_000_000,
      nowMs: 1_800_000_000_000,
    }),
    "transaction_expired",
  );
  assert.equal(
    validateAppleNotificationMutationShape({
      transaction: { ...complete, expiresDateMs: 1_700_000_000_000 },
      notificationSignedDateMs: 1_800_000_000_001,
      grantsPro: false,
      serviceExpiresDateMs: 1_700_000_000_000,
      nowMs: 1_800_000_000_000,
    }),
    null,
    "terminal notifications may close an already-expired Apple entitlement",
  );
});

test("product allowlist is exact, duplicate-free, and rejects annual upfront", () => {
  assert.deepEqual(
    parseAppleProductAllowlist(
      "com.chapterflow.pro.monthly,com.chapterflow.pro.annual",
    ),
    {
      valid: true,
      productIds: [
        "com.chapterflow.pro.monthly",
        "com.chapterflow.pro.annual",
      ],
    },
  );
  assert.deepEqual(parseAppleProductAllowlist(undefined), {
    valid: false,
    reason: "missing_product_allowlist",
  });
  assert.deepEqual(
    parseAppleProductAllowlist(
      "com.chapterflow.pro.monthly,com.chapterflow.pro.monthly",
    ),
    { valid: false, reason: "malformed_product_allowlist" },
  );
  assert.deepEqual(
    parseAppleProductAllowlist("com.chapterflow.pro.annual_upfront"),
    { valid: false, reason: "unsupported_annual_upfront" },
  );
});

test("deployment policy uses explicit IAP identity and maps prod to Production", () => {
  const result = buildAppleIapPolicyFromEnv({
    APPLE_IAP_BUNDLE_ID: "com.chapterflow.ios",
    APPLE_IAP_APP_APPLE_ID: "1234567890",
    APPLE_IAP_SUBSCRIPTION_GROUP_ID: "12345678",
    IOS_STOREKIT_PRODUCT_IDS:
      "com.chapterflow.pro.monthly,com.chapterflow.pro.annual",
    CHAPTERFLOW_ENV: "prod",
  });
  assert.equal(result.valid, true);
  if (!result.valid) return;
  assert.equal(result.policy.bundleId, "com.chapterflow.ios");
  assert.equal(result.policy.appAppleId, 1234567890);
  assert.equal(result.policy.environment, "Production");
  assert.equal(result.policy.testFlightSandbox.enabled, false);
  assert.deepEqual([...result.policy.productIds], [
    "com.chapterflow.pro.monthly",
    "com.chapterflow.pro.annual",
  ]);
});

test("TestFlight config requires exact prod opt-in and one-way subject hashes", () => {
  assert.deepEqual(
    parseAppleTestFlightSandboxConfig({ CHAPTERFLOW_ENV: "prod" }),
    {
      valid: true,
      config: { enabled: false, qaUserHashes: new Set() },
    },
  );
  const enabled = parseAppleTestFlightSandboxConfig({
    CHAPTERFLOW_ENV: "prod",
    APPLE_IAP_TESTFLIGHT_SANDBOX_ENABLED: "1",
    APPLE_IAP_TESTFLIGHT_QA_USER_HASHES: `${USER_HASH},${OTHER_USER_HASH}`,
  });
  assert.equal(enabled.valid, true);
  if (enabled.valid) {
    assert.deepEqual([...enabled.config.qaUserHashes], [
      USER_HASH,
      OTHER_USER_HASH,
    ]);
  }
  assert.equal(
    isAppleTestFlightSandboxUserAllowedFromEnv(
      {
        CHAPTERFLOW_ENV: "prod",
        APPLE_IAP_TESTFLIGHT_SANDBOX_ENABLED: "1",
        APPLE_IAP_TESTFLIGHT_QA_USER_HASHES: USER_HASH,
      },
      USER,
    ),
    true,
  );
});

for (const [name, env, issue] of [
  [
    "truthy flag aliases",
    {
      CHAPTERFLOW_ENV: "prod",
      APPLE_IAP_TESTFLIGHT_SANDBOX_ENABLED: "true",
      APPLE_IAP_TESTFLIGHT_QA_USER_HASHES: USER_HASH,
    },
    "invalid_testflight_sandbox_flag",
  ],
  [
    "an allowlist without opt-in",
    {
      CHAPTERFLOW_ENV: "prod",
      APPLE_IAP_TESTFLIGHT_SANDBOX_ENABLED: "0",
      APPLE_IAP_TESTFLIGHT_QA_USER_HASHES: USER_HASH,
    },
    "testflight_allowlist_without_enable",
  ],
  [
    "an empty allowlist",
    {
      CHAPTERFLOW_ENV: "prod",
      APPLE_IAP_TESTFLIGHT_SANDBOX_ENABLED: "1",
      APPLE_IAP_TESTFLIGHT_QA_USER_HASHES: "",
    },
    "invalid_testflight_qa_allowlist",
  ],
  [
    "raw UUIDs",
    {
      CHAPTERFLOW_ENV: "prod",
      APPLE_IAP_TESTFLIGHT_SANDBOX_ENABLED: "1",
      APPLE_IAP_TESTFLIGHT_QA_USER_HASHES: USER,
    },
    "invalid_testflight_qa_allowlist",
  ],
  [
    "uppercase hashes",
    {
      CHAPTERFLOW_ENV: "prod",
      APPLE_IAP_TESTFLIGHT_SANDBOX_ENABLED: "1",
      APPLE_IAP_TESTFLIGHT_QA_USER_HASHES: USER_HASH.toUpperCase(),
    },
    "invalid_testflight_qa_allowlist",
  ],
  [
    "duplicate hashes",
    {
      CHAPTERFLOW_ENV: "prod",
      APPLE_IAP_TESTFLIGHT_SANDBOX_ENABLED: "1",
      APPLE_IAP_TESTFLIGHT_QA_USER_HASHES: `${USER_HASH},${USER_HASH}`,
    },
    "invalid_testflight_qa_allowlist",
  ],
  [
    "non-production deployment",
    {
      CHAPTERFLOW_ENV: "staging",
      APPLE_IAP_TESTFLIGHT_SANDBOX_ENABLED: "1",
      APPLE_IAP_TESTFLIGHT_QA_USER_HASHES: USER_HASH,
    },
    "invalid_testflight_qa_allowlist",
  ],
] as const) {
  test(`TestFlight config rejects ${name}`, () => {
    const result = parseAppleTestFlightSandboxConfig(env);
    assert.equal(result.valid, false);
    if (!result.valid) assert.deepEqual(result.issues, [issue]);
  });
}

test("SIWA APPLE_BUNDLE_ID is never an implicit IAP fallback", () => {
  const result = buildAppleIapPolicyFromEnv({
    APPLE_IAP_APP_APPLE_ID: "1234567890",
    APPLE_IAP_SUBSCRIPTION_GROUP_ID: "12345678",
    IOS_STOREKIT_PRODUCT_IDS: "com.chapterflow.pro.monthly",
    CHAPTERFLOW_ENV: "prod",
    // Deliberately supplied as an excess legacy/SIWA key at runtime.
    ...({ APPLE_BUNDLE_ID: "com.chapterflow.services" } as Record<string, string>),
  });
  assert.deepEqual(result, {
    valid: false,
    issues: ["invalid_bundle_id"],
  });
});

test("deployment policy fails closed on missing group, products, and environment", () => {
  assert.deepEqual(
    buildAppleIapPolicyFromEnv({ APPLE_IAP_BUNDLE_ID: "com.chapterflow.ios" }),
    {
      valid: false,
      issues: [
        "invalid_app_apple_id",
        "missing_product_allowlist",
        "invalid_subscription_group",
        "invalid_deployment_environment",
      ],
    },
  );
});
