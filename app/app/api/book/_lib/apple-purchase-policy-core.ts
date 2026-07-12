import type { AppleTransactionInfo } from "./apple-jws-verify-core";
import type { AppleStorageLane } from "./keys";
import {
  APPLE_TESTFLIGHT_SUBJECT_HASH_PATTERN,
  hashAppleTestFlightSubject,
} from "./apple-testflight-subject-hash-core";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const APPLE_ACCOUNT_BINDING_VERSION = "cognito_sub_v1";

export type AppleStoreEnvironment = "Production" | "Sandbox";

export type ApplePurchasePolicy = {
  bundleId: string;
  /** Numeric App Store app identity (`data.appAppleId` in Production notifications). */
  appAppleId: number;
  productIds: ReadonlySet<string>;
  subscriptionGroupIdentifier: string;
  environment: AppleStoreEnvironment;
  testFlightSandbox: {
    enabled: boolean;
    qaUserHashes: ReadonlySet<string>;
  };
};

export type ApplePurchasePolicyViolation =
  | "bundle_mismatch"
  | "app_apple_id_mismatch"
  | "transaction_environment_mismatch"
  | "product_not_allowed"
  | "subscription_group_mismatch"
  | "unsupported_transaction_type"
  | "unsupported_ownership_type"
  | "family_shared_not_supported";

export type AppleAccountBindingViolation =
  | "account_identifier_unsupported"
  | "account_token_required"
  | "account_token_malformed"
  | "account_token_mismatch";

/**
 * Canonicalise an RFC UUID without accepting partial UUIDs or arbitrary
 * account identifiers. Cognito-generated `sub` values and StoreKit
 * `appAccountToken` values are compared only in this canonical form.
 */
export function normalizeAppleAccountToken(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed && UUID_PATTERN.test(trimmed) ? trimmed.toLowerCase() : null;
}

/**
 * Validate signed StoreKit business claims after JWS authenticity has been
 * established and before any transaction mapping or entitlement write.
 */
export function validateApplePurchasePolicy(
  transaction: AppleTransactionInfo,
  policy: ApplePurchasePolicy,
  context?: { authenticatedUserId?: string },
): ApplePurchasePolicyViolation | null {
  if (transaction.bundleId !== policy.bundleId) return "bundle_mismatch";
  if (
    resolveAppleTransactionEnvironment({
      signedEnvironment: transaction.environment,
      policy,
      authenticatedUserId: context?.authenticatedUserId,
    }) === null
  ) {
    return "transaction_environment_mismatch";
  }
  if (!transaction.productId || !policy.productIds.has(transaction.productId)) {
    return "product_not_allowed";
  }
  if (
    transaction.subscriptionGroupIdentifier !==
    policy.subscriptionGroupIdentifier
  ) {
    return "subscription_group_mismatch";
  }
  if (transaction.type !== "Auto-Renewable Subscription") {
    return "unsupported_transaction_type";
  }
  if (transaction.inAppOwnershipType === "FAMILY_SHARED") {
    return "family_shared_not_supported";
  }
  if (transaction.inAppOwnershipType !== "PURCHASED") {
    return "unsupported_ownership_type";
  }
  return null;
}

/** True only for an explicitly enabled prod TestFlight QA account. */
export function isAppleTestFlightSandboxUserAllowed(
  policy: ApplePurchasePolicy,
  authenticatedUserId: string | undefined,
): boolean {
  const canonicalUserId = normalizeAppleAccountToken(authenticatedUserId);
  return (
    policy.environment === "Production" &&
    policy.testFlightSandbox.enabled &&
    canonicalUserId !== null &&
    policy.testFlightSandbox.qaUserHashes.has(
      hashAppleTestFlightSubject(canonicalUserId),
    )
  );
}

/** Select a signed transaction lane without weakening notification policy. */
export function resolveAppleTransactionEnvironment(input: {
  signedEnvironment: string | undefined;
  policy: ApplePurchasePolicy;
  authenticatedUserId?: string;
}): AppleStoreEnvironment | null {
  if (input.signedEnvironment === input.policy.environment) {
    return input.policy.environment;
  }
  if (
    input.signedEnvironment === "Sandbox" &&
    isAppleTestFlightSandboxUserAllowed(
      input.policy,
      input.authenticatedUserId,
    )
  ) {
    return "Sandbox";
  }
  return null;
}

/**
 * Resolve signed claims to storage without conflating Apple's Sandbox with the
 * isolated Production TestFlight QA lane. A normal dev/staging Sandbox
 * transaction is deployment-authoritative and stays on the byte-compatible
 * Primary keys.
 */
export function resolveAppleStorageLane(input: {
  signedEnvironment: string | undefined;
  policy: ApplePurchasePolicy;
  authenticatedUserId?: string;
}): AppleStorageLane | null {
  const transactionEnvironment = resolveAppleTransactionEnvironment(input);
  if (!transactionEnvironment) return null;
  return input.policy.environment === "Production" &&
    transactionEnvironment === "Sandbox"
    ? "TestFlightSandbox"
    : "Primary";
}

/** Validate signed notification-envelope identity before nested state mapping. */
export function validateAppleNotificationEnvelopePolicy(input: {
  bundleId: string | undefined;
  appAppleId: number | undefined;
  environment: string | undefined;
  policy: ApplePurchasePolicy;
}): ApplePurchasePolicyViolation | null {
  if (input.environment !== input.policy.environment) {
    return "transaction_environment_mismatch";
  }
  if (input.bundleId !== input.policy.bundleId) return "bundle_mismatch";
  if (
    input.policy.environment === "Production" &&
    input.appAppleId !== input.policy.appAppleId
  ) {
    return "app_apple_id_mismatch";
  }
  return null;
}

export type AppleNotificationMutationViolation =
  | "unsupported_transaction"
  | "transaction_expired";

/** Require orderable subscription fields before a notification can mutate. */
export function validateAppleNotificationMutationShape(input: {
  transaction: AppleTransactionInfo;
  notificationSignedDateMs: number | undefined;
  grantsPro: boolean;
  serviceExpiresDateMs: number | undefined;
  nowMs: number;
}): AppleNotificationMutationViolation | null {
  const { transaction } = input;
  if (
    !transaction.transactionId ||
    !transaction.originalTransactionId ||
    transaction.signedDateMs === undefined ||
    transaction.expiresDateMs === undefined ||
    input.notificationSignedDateMs === undefined
  ) {
    return "unsupported_transaction";
  }
  return input.grantsPro &&
    (input.serviceExpiresDateMs === undefined ||
      input.serviceExpiresDateMs <= input.nowMs)
    ? "transaction_expired"
    : null;
}

/**
 * Bind the signed StoreKit transaction to the currently authenticated Cognito
 * identity. A tokenless transaction is accepted only for a reverse-map that
 * was already created by the same user before this control shipped.
 */
export function validateAppleAccountBinding(input: {
  authenticatedUserId: string;
  appAccountToken: string | undefined;
  existingOwnerId: string | null;
  existingBindingVersion?: string;
}): AppleAccountBindingViolation | null {
  const expected = normalizeAppleAccountToken(input.authenticatedUserId);
  if (!expected) return "account_identifier_unsupported";

  if (!input.appAccountToken) {
    return input.existingOwnerId === input.authenticatedUserId
      ? null
      : "account_token_required";
  }

  const actual = normalizeAppleAccountToken(input.appAccountToken);
  if (!actual) return "account_token_malformed";
  return actual === expected ? null : "account_token_mismatch";
}

/** Validate a notification's signed transaction against its mapped owner. */
export function validateAppleNotificationAccountBinding(input: {
  mappedUserId: string;
  appAccountToken: string | undefined;
  bindingVersion?: string;
}): AppleAccountBindingViolation | null {
  // Tokenless transactions are the deliberate compatibility path for mappings
  // written before appAccountToken enforcement. No new mapping is created here.
  if (!input.appAccountToken) {
    return null;
  }
  return validateAppleAccountBinding({
    authenticatedUserId: input.mappedUserId,
    appAccountToken: input.appAccountToken,
    existingOwnerId: input.mappedUserId,
    existingBindingVersion: input.bindingVersion,
  });
}

const PRODUCT_ID_PATTERN = /^[A-Za-z0-9]+(?:[._-][A-Za-z0-9]+)+$/;

export type AppleProductAllowlistResult =
  | { valid: true; productIds: string[] }
  | {
      valid: false;
      reason:
        | "missing_product_allowlist"
        | "malformed_product_allowlist"
        | "unsupported_annual_upfront";
    };

/** Parse the exact deployment allowlist. There is intentionally no fallback. */
export function parseAppleProductAllowlist(
  raw: string | undefined,
): AppleProductAllowlistResult {
  const values = (raw ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  if (values.length === 0) {
    return { valid: false, reason: "missing_product_allowlist" };
  }
  if (
    values.some(
      (value) =>
        !PRODUCT_ID_PATTERN.test(value) ||
        value.toLowerCase().includes("placeholder"),
    ) || new Set(values).size !== values.length
  ) {
    return { valid: false, reason: "malformed_product_allowlist" };
  }
  if (
    values.some((value) =>
      /(?:^|[._-])annual(?:[._-])upfront$/i.test(value),
    )
  ) {
    return { valid: false, reason: "unsupported_annual_upfront" };
  }
  return { valid: true, productIds: values };
}

const BUNDLE_ID_PATTERN = /^[A-Za-z0-9]+(?:\.[A-Za-z0-9-]+)+$/;
const SUBSCRIPTION_GROUP_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{2,127}$/;

export type AppleIapPolicyEnv = {
  APPLE_IAP_BUNDLE_ID?: string;
  APPLE_IAP_APP_APPLE_ID?: string;
  APPLE_IAP_SUBSCRIPTION_GROUP_ID?: string;
  IOS_STOREKIT_PRODUCT_IDS?: string;
  CHAPTERFLOW_ENV?: string;
  APPLE_IAP_TESTFLIGHT_SANDBOX_ENABLED?: string;
  APPLE_IAP_TESTFLIGHT_QA_USER_HASHES?: string;
};

export type AppleIapPolicyConfigResult =
  | { valid: true; policy: ApplePurchasePolicy }
  | { valid: false; issues: string[] };

export type AppleTestFlightSandboxConfigResult =
  | {
      valid: true;
      config: { enabled: boolean; qaUserHashes: ReadonlySet<string> };
    }
  | { valid: false; issues: string[] };

/** Parse the TestFlight exception with no wildcard or normalization fallback. */
export function parseAppleTestFlightSandboxConfig(
  env: Pick<
    AppleIapPolicyEnv,
    | "CHAPTERFLOW_ENV"
    | "APPLE_IAP_TESTFLIGHT_SANDBOX_ENABLED"
    | "APPLE_IAP_TESTFLIGHT_QA_USER_HASHES"
  >,
): AppleTestFlightSandboxConfigResult {
  const enabledRaw =
    env.APPLE_IAP_TESTFLIGHT_SANDBOX_ENABLED?.trim() ?? "";
  const allowlistRaw = env.APPLE_IAP_TESTFLIGHT_QA_USER_HASHES?.trim() ?? "";
  if (enabledRaw !== "" && enabledRaw !== "0" && enabledRaw !== "1") {
    return { valid: false, issues: ["invalid_testflight_sandbox_flag"] };
  }
  if (enabledRaw !== "1") {
    return allowlistRaw === ""
      ? { valid: true, config: { enabled: false, qaUserHashes: new Set() } }
      : { valid: false, issues: ["testflight_allowlist_without_enable"] };
  }

  const values = allowlistRaw.split(",").map((value) => value.trim());
  if (
    env.CHAPTERFLOW_ENV?.trim() !== "prod" ||
    values.some(
      (value) => !APPLE_TESTFLIGHT_SUBJECT_HASH_PATTERN.test(value),
    ) ||
    new Set(values).size !== values.length
  ) {
    return { valid: false, issues: ["invalid_testflight_qa_allowlist"] };
  }
  return {
    valid: true,
    config: { enabled: true, qaUserHashes: new Set(values) },
  };
}

/** Default read-model gate; malformed/off config makes Sandbox non-authoritative. */
export function isAppleTestFlightSandboxUserAllowedFromEnv(
  env: AppleIapPolicyEnv,
  authenticatedUserId: string,
): boolean {
  const parsed = parseAppleTestFlightSandboxConfig(env);
  const canonicalUserId = normalizeAppleAccountToken(authenticatedUserId);
  return (
    parsed.valid &&
    parsed.config.enabled &&
    canonicalUserId !== null &&
    parsed.config.qaUserHashes.has(
      hashAppleTestFlightSubject(canonicalUserId),
    )
  );
}

/** Resolve deployment values into a strict policy without inventing defaults. */
export function buildAppleIapPolicyFromEnv(
  env: AppleIapPolicyEnv,
): AppleIapPolicyConfigResult {
  const issues: string[] = [];
  const bundleId = env.APPLE_IAP_BUNDLE_ID?.trim() ?? "";
  if (!BUNDLE_ID_PATTERN.test(bundleId)) issues.push("invalid_bundle_id");

  const appAppleIdRaw = env.APPLE_IAP_APP_APPLE_ID?.trim() ?? "";
  const appAppleId = Number(appAppleIdRaw);
  if (!/^\d{6,15}$/.test(appAppleIdRaw) || !Number.isSafeInteger(appAppleId)) {
    issues.push("invalid_app_apple_id");
  }

  const productAllowlist = parseAppleProductAllowlist(
    env.IOS_STOREKIT_PRODUCT_IDS,
  );
  if (!productAllowlist.valid) issues.push(productAllowlist.reason);

  const subscriptionGroupIdentifier =
    env.APPLE_IAP_SUBSCRIPTION_GROUP_ID?.trim() ?? "";
  if (!SUBSCRIPTION_GROUP_PATTERN.test(subscriptionGroupIdentifier)) {
    issues.push("invalid_subscription_group");
  }

  const deploymentEnvironment = env.CHAPTERFLOW_ENV?.trim();
  if (
    !deploymentEnvironment ||
    !["dev", "staging", "prod"].includes(deploymentEnvironment)
  ) {
    issues.push("invalid_deployment_environment");
  }

  const testFlight = parseAppleTestFlightSandboxConfig(env);
  if (!testFlight.valid) issues.push(...testFlight.issues);

  if (issues.length > 0 || !productAllowlist.valid) {
    return { valid: false, issues };
  }
  return {
    valid: true,
    policy: {
      bundleId,
      appAppleId,
      productIds: new Set(productAllowlist.productIds),
      subscriptionGroupIdentifier,
      environment: deploymentEnvironment === "prod" ? "Production" : "Sandbox",
      testFlightSandbox: testFlight.valid
        ? testFlight.config
        : { enabled: false, qaUserHashes: new Set() },
    },
  };
}
