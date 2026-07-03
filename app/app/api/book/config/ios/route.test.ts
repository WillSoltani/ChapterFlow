import { test } from "node:test";
import assert from "node:assert/strict";
import { GET } from "./route";
import { buildIosAppConfig } from "./config-core";

// Contract tests for GET /app/api/book/config/ios — the native-iOS launch
// config the app reads to drive force-update, kill-switch flags, StoreKit
// products, and maintenance mode. The shape + caching asserted here are what
// shipped binaries depend on, so they must not regress.

test("GET returns 200, the documented shape, and public max-age=300 caching", async () => {
  const res = GET();
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
  assert.equal(typeof body.maintenanceMode, "boolean");
  // messageOfTheDay is optional: present only as a string, otherwise absent.
  assert.ok(
    body.messageOfTheDay === undefined ||
      typeof body.messageOfTheDay === "string",
  );
});

test("defaults are safe with no env configured", () => {
  const config = buildIosAppConfig({});
  assert.equal(config.minSupportedVersion, "1.0.0");
  assert.equal(config.latestVersion, "1.0.0");
  assert.deepEqual(config.featureFlags, {});
  assert.ok(config.storeKitProductIds.length > 0, "ships a non-empty store");
  assert.equal(config.maintenanceMode, false);
  assert.equal(config.messageOfTheDay, undefined);
});

test("env overrides drive every field (no app release needed)", () => {
  const config = buildIosAppConfig({
    IOS_MIN_SUPPORTED_VERSION: "1.2.0",
    IOS_LATEST_VERSION: "1.5.3",
    IOS_FEATURE_FLAGS: '{"audioTab": true, "newPaywall": false}',
    IOS_STOREKIT_PRODUCT_IDS: "com.chapterflow.pro.monthly, com.chapterflow.pro.annual",
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
  assert.equal(config.maintenanceMode, true);
  assert.equal(config.messageOfTheDay, "Welcome back!");
});

test("malformed feature-flag JSON fails safe to {} (never crashes launch)", () => {
  assert.deepEqual(buildIosAppConfig({ IOS_FEATURE_FLAGS: "not json" }).featureFlags, {});
  // Non-boolean values are dropped; only boolean flags survive.
  assert.deepEqual(
    buildIosAppConfig({ IOS_FEATURE_FLAGS: '{"a": true, "b": 1, "c": "x"}' })
      .featureFlags,
    { a: true },
  );
  // Arrays / non-objects are rejected.
  assert.deepEqual(buildIosAppConfig({ IOS_FEATURE_FLAGS: "[1,2]" }).featureFlags, {});
});

test("blank product-id override falls back to the default plan set", () => {
  const fallback = buildIosAppConfig({}).storeKitProductIds;
  assert.deepEqual(
    buildIosAppConfig({ IOS_STOREKIT_PRODUCT_IDS: "  ,  , " }).storeKitProductIds,
    fallback,
  );
});
