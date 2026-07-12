import { test, before } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import {
  buildIosAppConfig,
  IosConfigValidationError,
  type IosConfigEnv,
} from "./config-core";

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

let GET: typeof import("./route").GET;

before(async () => {
  ({ GET } = await import("./route"));
});

const REQUIRED_ENV: IosConfigEnv = {
  APPLE_IAP_APP_APPLE_ID: "1234567890",
  IOS_STOREKIT_PRODUCT_IDS:
    "com.chapterflow.pro.monthly,com.chapterflow.pro.annual",
  IOS_APP_STORE_URL:
    "https://apps.apple.com/ca/app/chapterflow/id1234567890",
};

async function withProcessEnv<T>(
  values: Record<string, string | undefined>,
  operation: () => Promise<T>,
): Promise<T> {
  const saved = new Map<string, string | undefined>();
  for (const [key, value] of Object.entries(values)) {
    saved.set(key, process.env[key]);
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  try {
    return await operation();
  } finally {
    for (const [key, value] of saved) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

// Contract tests for GET /app/api/book/config/ios — the native-iOS launch
// config the app reads to drive force-update, kill-switch flags, StoreKit
// products, and maintenance mode. The shape + caching asserted here are what
// shipped binaries depend on, so they must not regress.

test("GET returns exact configured products/listing with public caching", async () => {
  const res = await withProcessEnv(REQUIRED_ENV, () =>
    GET(new Request("https://chapterflow.test/app/api/book/config/ios")),
  );
  assert.equal(res.status, 200);
  assert.equal(res.headers.get("cache-control"), "public, max-age=300");

  const body = await res.json();
  assert.equal(typeof body.minSupportedVersion, "string");
  assert.equal(typeof body.latestVersion, "string");
  assert.equal(
    typeof body.featureFlags,
    "object",
    "featureFlags is an object map",
  );
  assert.ok(!Array.isArray(body.featureFlags));
  assert.ok(
    Array.isArray(body.storeKitProductIds),
    "storeKitProductIds is an array",
  );
  assert.ok(
    body.storeKitProductIds.every((id: unknown) => typeof id === "string"),
  );
  assert.equal(body.appStoreURL, REQUIRED_ENV.IOS_APP_STORE_URL);
  assert.equal(typeof body.maintenanceMode, "boolean");
  // messageOfTheDay is optional: present only as a string, otherwise absent.
  assert.ok(
    body.messageOfTheDay === undefined ||
      typeof body.messageOfTheDay === "string",
  );
});

test("non-identity fields retain safe defaults with required identity configured", () => {
  const config = buildIosAppConfig(REQUIRED_ENV);
  assert.equal(config.minSupportedVersion, "1.0.0");
  assert.equal(config.latestVersion, "1.0.0");
  assert.deepEqual(config.featureFlags, {});
  assert.deepEqual(config.storeKitProductIds, [
    "com.chapterflow.pro.monthly",
    "com.chapterflow.pro.annual",
  ]);
  assert.equal(config.appStoreURL, REQUIRED_ENV.IOS_APP_STORE_URL);
  assert.equal(config.maintenanceMode, false);
  assert.equal(config.messageOfTheDay, undefined);
});

test("env overrides drive every field (no app release needed)", () => {
  const config = buildIosAppConfig({
    ...REQUIRED_ENV,
    IOS_MIN_SUPPORTED_VERSION: "1.2.0",
    IOS_LATEST_VERSION: "1.5.3",
    IOS_FEATURE_FLAGS: '{"audioTab": true, "newPaywall": false}',
    IOS_STOREKIT_PRODUCT_IDS:
      "com.chapterflow.pro.monthly, com.chapterflow.pro.annual",
    IOS_APP_STORE_URL:
      "https://apps.apple.com/us/app/chapterflow/id1234567890",
    IOS_MAINTENANCE_MODE: "true",
    IOS_MESSAGE_OF_THE_DAY: "  Welcome back!  ",
  });
  assert.equal(config.minSupportedVersion, "1.2.0");
  assert.equal(config.latestVersion, "1.5.3");
  assert.deepEqual(config.featureFlags, { audioTab: true, newPaywall: false });
  assert.deepEqual(config.storeKitProductIds, [
    "com.chapterflow.pro.monthly",
    "com.chapterflow.pro.annual",
  ]);
  assert.equal(
    config.appStoreURL,
    "https://apps.apple.com/us/app/chapterflow/id1234567890",
  );
  assert.equal(config.maintenanceMode, true);
  assert.equal(config.messageOfTheDay, "Welcome back!");
});

test("malformed feature-flag JSON fails safe to {} (never crashes launch)", () => {
  assert.deepEqual(
    buildIosAppConfig({ ...REQUIRED_ENV, IOS_FEATURE_FLAGS: "not json" })
      .featureFlags,
    {},
  );
  // Non-boolean values are dropped; only boolean flags survive.
  assert.deepEqual(
    buildIosAppConfig({
      ...REQUIRED_ENV,
      IOS_FEATURE_FLAGS: '{"a": true, "b": 1, "c": "x"}',
    })
      .featureFlags,
    { a: true },
  );
  // Arrays / non-objects are rejected.
  assert.deepEqual(
    buildIosAppConfig({ ...REQUIRED_ENV, IOS_FEATURE_FLAGS: "[1,2]" })
      .featureFlags,
    {},
  );
});

test("missing or blank product identity fails closed without a fallback", () => {
  assert.throws(
    () =>
      buildIosAppConfig({
        IOS_STOREKIT_PRODUCT_IDS: "  ,  , ",
        IOS_APP_STORE_URL: REQUIRED_ENV.IOS_APP_STORE_URL,
      }),
    (error: unknown) =>
      error instanceof IosConfigValidationError &&
      error.issues.includes("missing_product_allowlist"),
  );
});

test("unsupported annual-upfront product is rejected", () => {
  assert.throws(
    () =>
      buildIosAppConfig({
        ...REQUIRED_ENV,
        IOS_STOREKIT_PRODUCT_IDS: "com.chapterflow.pro.annual_upfront",
      }),
    (error: unknown) =>
      error instanceof IosConfigValidationError &&
      error.issues.includes("unsupported_annual_upfront"),
  );
});

for (const invalidUrl of [
  undefined,
  "http://apps.apple.com/ca/app/chapterflow/id1234567890",
  "https://example.com/app/id1234567890",
  "https://apps.apple.com:444/ca/app/chapterflow/id1234567890",
  "https://apps.apple.com/ca/app/chapterflow",
  "https://apps.apple.com/ca/app/chapterflow/id1234567890?campaign=x",
  "https://apps.apple.com/search?term=chapterflow",
]) {
  test(`invalid App Store destination fails closed: ${invalidUrl ?? "missing"}`, () => {
    assert.throws(
      () => buildIosAppConfig({ ...REQUIRED_ENV, IOS_APP_STORE_URL: invalidUrl }),
      (error: unknown) =>
        error instanceof IosConfigValidationError &&
        error.issues.includes("invalid_app_store_url"),
    );
  });
}

test("App Store listing id must equal the signed notification appAppleId", () => {
  assert.throws(
    () =>
      buildIosAppConfig({
        ...REQUIRED_ENV,
        IOS_APP_STORE_URL:
          "https://apps.apple.com/ca/app/chapterflow/id9999999999",
      }),
    (error: unknown) =>
      error instanceof IosConfigValidationError &&
      error.issues.includes("invalid_app_store_url"),
  );
});

test("route emits a stable error envelope when deployment identity is missing", async () => {
  const requestId = "Root=1-test-request";
  const res = await withProcessEnv(
    {
      IOS_STOREKIT_PRODUCT_IDS: undefined,
      IOS_APP_STORE_URL: undefined,
      APPLE_IAP_APP_APPLE_ID: undefined,
    },
    () =>
      GET(
        new Request("https://chapterflow.test/app/api/book/config/ios", {
          headers: { "x-amzn-trace-id": requestId },
        }),
      ),
  );
  assert.equal(res.status, 503);
  assert.equal(res.headers.get("cache-control"), null);
  assert.deepEqual(await res.json(), {
    error: {
      code: "ios_config_unavailable",
      message: "The iOS application configuration is temporarily unavailable.",
      requestId,
      details: {
        issues: [
          "missing_product_allowlist",
          "invalid_app_apple_id",
          "invalid_app_store_url",
        ],
      },
    },
  });
});
