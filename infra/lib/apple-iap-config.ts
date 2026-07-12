export type AppleIapDeploymentEnv = {
  APPLE_IAP_BUNDLE_ID?: string;
  APPLE_IAP_APP_APPLE_ID?: string;
  APPLE_IAP_SUBSCRIPTION_GROUP_ID?: string;
  IOS_STOREKIT_PRODUCT_IDS?: string;
  IOS_APP_STORE_URL?: string;
  CHAPTERFLOW_ENV?: string;
  APPLE_IAP_TESTFLIGHT_SANDBOX_ENABLED?: string;
  APPLE_IAP_TESTFLIGHT_QA_USER_HASHES?: string;
};

const SUBJECT_HASH_PATTERN = /^[0-9a-f]{64}$/;

/**
 * Pure synth-time mirror of the runtime StoreKit identity checks. Infra is a
 * separate package, so it deliberately cannot import application route code.
 * It returns nonsecret issue codes only; callers must never print configured
 * values into deployment logs.
 */
export function validateAppleIapDeploymentConfig(
  env: AppleIapDeploymentEnv,
): string[] {
  const issues: string[] = [];
  const bundleId = env.APPLE_IAP_BUNDLE_ID?.trim() ?? "";
  if (!/^[A-Za-z0-9]+(?:\.[A-Za-z0-9-]+)+$/.test(bundleId)) {
    issues.push("E_APPLE_IAP_BUNDLE_ID_INVALID");
  }

  const appAppleId = env.APPLE_IAP_APP_APPLE_ID?.trim() ?? "";
  if (!/^\d{6,15}$/.test(appAppleId) || !Number.isSafeInteger(Number(appAppleId))) {
    issues.push("E_APPLE_IAP_APP_APPLE_ID_INVALID");
  }

  const subscriptionGroup =
    env.APPLE_IAP_SUBSCRIPTION_GROUP_ID?.trim() ?? "";
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{2,127}$/.test(subscriptionGroup)) {
    issues.push("E_APPLE_IAP_SUBSCRIPTION_GROUP_INVALID");
  }

  const productIds = (env.IOS_STOREKIT_PRODUCT_IDS ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  if (
    productIds.length === 0 ||
    new Set(productIds).size !== productIds.length ||
    productIds.some(
      (value) =>
        !/^[A-Za-z0-9]+(?:[._-][A-Za-z0-9]+)+$/.test(value) ||
        value.toLowerCase().includes("placeholder"),
    )
  ) {
    issues.push("E_IOS_STOREKIT_PRODUCT_IDS_INVALID");
  } else if (
    productIds.some((value) =>
      /(?:^|[._-])annual(?:[._-])upfront$/i.test(value),
    )
  ) {
    issues.push("E_IOS_STOREKIT_ANNUAL_UPFRONT_UNSUPPORTED");
  }

  let appStoreUrlInvalid = false;
  try {
    const appStoreUrl = new URL(env.IOS_APP_STORE_URL ?? "");
    const listingId = appStoreUrl.pathname.match(
      /\/id([1-9][0-9]{5,14})\/?$/,
    )?.[1];
    if (
      appStoreUrl.protocol !== "https:" ||
      appStoreUrl.hostname !== "apps.apple.com" ||
      appStoreUrl.port !== "" ||
      appStoreUrl.username ||
      appStoreUrl.password ||
      appStoreUrl.search ||
      appStoreUrl.hash ||
      !listingId ||
      (/^\d{6,15}$/.test(appAppleId) && listingId !== appAppleId)
    ) {
      appStoreUrlInvalid = true;
    }
  } catch {
    appStoreUrlInvalid = true;
  }
  if (appStoreUrlInvalid) issues.push("E_IOS_APP_STORE_URL_INVALID");

  const testFlightFlag =
    env.APPLE_IAP_TESTFLIGHT_SANDBOX_ENABLED?.trim() ?? "";
  const testFlightAllowlist =
    env.APPLE_IAP_TESTFLIGHT_QA_USER_HASHES?.trim() ?? "";
  if (
    testFlightFlag !== "" &&
    testFlightFlag !== "0" &&
    testFlightFlag !== "1"
  ) {
    issues.push("E_APPLE_IAP_TESTFLIGHT_FLAG_INVALID");
  } else if (testFlightFlag !== "1") {
    if (testFlightAllowlist !== "") {
      issues.push("E_APPLE_IAP_TESTFLIGHT_ALLOWLIST_WITHOUT_ENABLE");
    }
  } else if (env.CHAPTERFLOW_ENV?.trim() !== "prod") {
    issues.push("E_APPLE_IAP_TESTFLIGHT_PROD_ONLY");
  } else {
    const qaUserHashes = testFlightAllowlist
      .split(",")
      .map((value) => value.trim());
    if (
      qaUserHashes.length === 0 ||
      qaUserHashes.some((value) => !SUBJECT_HASH_PATTERN.test(value)) ||
      new Set(qaUserHashes).size !== qaUserHashes.length
    ) {
      issues.push("E_APPLE_IAP_TESTFLIGHT_ALLOWLIST_INVALID");
    }
  }

  return issues;
}

/** Fail before CDK creates or updates any resource, in every deployment env. */
export function assertAppleIapDeploymentConfig(
  deploymentEnvironment: string,
  env: AppleIapDeploymentEnv,
): void {
  const issues = validateAppleIapDeploymentConfig({
    ...env,
    CHAPTERFLOW_ENV: deploymentEnvironment,
  });
  if (issues.length > 0) {
    throw new Error(
      `Refusing to synth the ${deploymentEnvironment} ChapterFlowFrontend stack — ` +
        `native Apple configuration failed: ${issues.join(", ")}.`,
    );
  }
}

/** Backend-only CDK deploys do not construct or publish the frontend runtime. */
export function shouldAssertAppleIapDeploymentConfig(
  frontendDeploymentFlag: string | undefined,
): boolean {
  return frontendDeploymentFlag === "1";
}
