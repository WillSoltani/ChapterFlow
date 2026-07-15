import { test } from "node:test";
import assert from "node:assert/strict";
import {
  assertAppleIapDeploymentConfig,
  shouldAssertAppleIapDeploymentConfig,
  validateAppleIapDeploymentConfig,
} from "./apple-iap-config";

const VALID = {
  APPLE_IAP_BUNDLE_ID: "com.chapterflow.ios",
  APPLE_IAP_APP_APPLE_ID: "1234567890",
  APPLE_IAP_SUBSCRIPTION_GROUP_ID: "12345678",
  IOS_STOREKIT_PRODUCT_IDS:
    "com.chapterflow.pro.monthly,com.chapterflow.pro.annual",
  IOS_APP_STORE_URL:
    "https://apps.apple.com/ca/app/chapterflow/id1234567890",
  CHAPTERFLOW_ENV: "prod",
};
const USER_HASH =
  "f6f3b8eca8f49a1352f4bd948fb2c0d634b0fb81ccbf2b786c48cfa3ff7c3155";
const OTHER_USER_HASH =
  "24d1eb504f12b674b03e64f9feb191eea9c99704a86c12c0e4ed4237f88fbe24";

test("production IAP deployment fixture is accepted without exposing values", () => {
  assert.deepEqual(validateAppleIapDeploymentConfig(VALID), []);
});

test("missing deployment identity returns stable nonsecret issue codes", () => {
  assert.deepEqual(validateAppleIapDeploymentConfig({}), [
    "E_APPLE_IAP_BUNDLE_ID_INVALID",
    "E_APPLE_IAP_APP_APPLE_ID_INVALID",
    "E_APPLE_IAP_SUBSCRIPTION_GROUP_INVALID",
    "E_IOS_STOREKIT_PRODUCT_IDS_INVALID",
    "E_IOS_APP_STORE_URL_INVALID",
  ]);
});

test("annual-upfront and non-product App Store URLs fail synth validation", () => {
  assert.deepEqual(
    validateAppleIapDeploymentConfig({
      ...VALID,
      IOS_STOREKIT_PRODUCT_IDS: "com.chapterflow.pro.annual_upfront",
      IOS_APP_STORE_URL: "https://apps.apple.com/search?term=chapterflow",
    }),
    [
      "E_IOS_STOREKIT_ANNUAL_UPFRONT_UNSUPPORTED",
      "E_IOS_APP_STORE_URL_INVALID",
    ],
  );
});

test("duplicates, placeholders, malformed group, and foreign hosts fail closed", () => {
  assert.deepEqual(
    validateAppleIapDeploymentConfig({
      APPLE_IAP_BUNDLE_ID: "not a bundle",
      APPLE_IAP_APP_APPLE_ID: "not-an-id",
      APPLE_IAP_SUBSCRIPTION_GROUP_ID: "x",
      IOS_STOREKIT_PRODUCT_IDS:
        "com.chapterflow.placeholder,com.chapterflow.placeholder",
      IOS_APP_STORE_URL: "https://example.com/app/id1234567890",
    }),
    [
      "E_APPLE_IAP_BUNDLE_ID_INVALID",
      "E_APPLE_IAP_APP_APPLE_ID_INVALID",
      "E_APPLE_IAP_SUBSCRIPTION_GROUP_INVALID",
      "E_IOS_STOREKIT_PRODUCT_IDS_INVALID",
      "E_IOS_APP_STORE_URL_INVALID",
    ],
  );
});

test("an App Store URL with a nondefault port fails closed", () => {
  assert.deepEqual(
    validateAppleIapDeploymentConfig({
      ...VALID,
      IOS_APP_STORE_URL:
        "https://apps.apple.com:444/ca/app/chapterflow/id1234567890",
    }),
    ["E_IOS_APP_STORE_URL_INVALID"],
  );
});

test("App Store listing id must equal the configured appAppleId", () => {
  assert.deepEqual(
    validateAppleIapDeploymentConfig({
      ...VALID,
      IOS_APP_STORE_URL:
        "https://apps.apple.com/ca/app/chapterflow/id9999999999",
    }),
    ["E_IOS_APP_STORE_URL_INVALID"],
  );
});

test("disabled TestFlight Sandbox lane is the safe default", () => {
  assert.deepEqual(
    validateAppleIapDeploymentConfig({
      ...VALID,
      APPLE_IAP_TESTFLIGHT_SANDBOX_ENABLED: "0",
    }),
    [],
  );
});

test("prod TestFlight Sandbox lane accepts only one-way QA subject hashes", () => {
  assert.deepEqual(
    validateAppleIapDeploymentConfig({
      ...VALID,
      APPLE_IAP_TESTFLIGHT_SANDBOX_ENABLED: "1",
      APPLE_IAP_TESTFLIGHT_QA_USER_HASHES: `${USER_HASH},${OTHER_USER_HASH}`,
    }),
    [],
  );
});

for (const [name, patch, issue] of [
  [
    "truthy flag alias",
    {
      APPLE_IAP_TESTFLIGHT_SANDBOX_ENABLED: "true",
      APPLE_IAP_TESTFLIGHT_QA_USER_HASHES: USER_HASH,
    },
    "E_APPLE_IAP_TESTFLIGHT_FLAG_INVALID",
  ],
  [
    "allowlist without enable",
    {
      APPLE_IAP_TESTFLIGHT_SANDBOX_ENABLED: "0",
      APPLE_IAP_TESTFLIGHT_QA_USER_HASHES: USER_HASH,
    },
    "E_APPLE_IAP_TESTFLIGHT_ALLOWLIST_WITHOUT_ENABLE",
  ],
  [
    "empty allowlist",
    {
      APPLE_IAP_TESTFLIGHT_SANDBOX_ENABLED: "1",
      APPLE_IAP_TESTFLIGHT_QA_USER_HASHES: "",
    },
    "E_APPLE_IAP_TESTFLIGHT_ALLOWLIST_INVALID",
  ],
  [
    "raw UUID instead of a hash",
    {
      APPLE_IAP_TESTFLIGHT_SANDBOX_ENABLED: "1",
      APPLE_IAP_TESTFLIGHT_QA_USER_HASHES:
        "8F14E45F-EA4F-4A1B-8C32-07BBF1CDB22F",
    },
    "E_APPLE_IAP_TESTFLIGHT_ALLOWLIST_INVALID",
  ],
  [
    "uppercase hash",
    {
      APPLE_IAP_TESTFLIGHT_SANDBOX_ENABLED: "1",
      APPLE_IAP_TESTFLIGHT_QA_USER_HASHES: USER_HASH.toUpperCase(),
    },
    "E_APPLE_IAP_TESTFLIGHT_ALLOWLIST_INVALID",
  ],
  [
    "duplicate hash",
    {
      APPLE_IAP_TESTFLIGHT_SANDBOX_ENABLED: "1",
      APPLE_IAP_TESTFLIGHT_QA_USER_HASHES: `${USER_HASH},${USER_HASH}`,
    },
    "E_APPLE_IAP_TESTFLIGHT_ALLOWLIST_INVALID",
  ],
  [
    "staging enablement",
    {
      CHAPTERFLOW_ENV: "staging",
      APPLE_IAP_TESTFLIGHT_SANDBOX_ENABLED: "1",
      APPLE_IAP_TESTFLIGHT_QA_USER_HASHES: USER_HASH,
    },
    "E_APPLE_IAP_TESTFLIGHT_PROD_ONLY",
  ],
] as const) {
  test(`TestFlight deployment validation rejects ${name}`, () => {
    assert.deepEqual(
      validateAppleIapDeploymentConfig({ ...VALID, ...patch }),
      [issue],
    );
  });
}

for (const deploymentEnvironment of ["dev", "staging", "prod"]) {
  test(`${deploymentEnvironment} fails before stack construction when Apple config is invalid`, () => {
    assert.throws(
      () => assertAppleIapDeploymentConfig(deploymentEnvironment, {}),
      new RegExp(
        `Refusing to synth the ${deploymentEnvironment} ChapterFlowFrontend stack`,
      ),
    );
  });
}

test("backend-only CDK paths skip frontend Apple validation", () => {
  assert.equal(shouldAssertAppleIapDeploymentConfig(undefined), false);
  assert.equal(shouldAssertAppleIapDeploymentConfig("0"), false);
  assert.equal(shouldAssertAppleIapDeploymentConfig("1"), true);
});
