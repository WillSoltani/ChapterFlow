import { test } from "node:test";
import assert from "node:assert/strict";
import {
  RUNTIME_ENV_REQUIREMENTS,
  buildSyntheticRuntimeEnvironment,
  validateRuntimeEnvironment,
} from "./boot-env-core";

const PRODUCTION_ENV = buildSyntheticRuntimeEnvironment("prod");

test("runtime manifest has unique ids and valid structured requirements", () => {
  assert.ok(RUNTIME_ENV_REQUIREMENTS.length > 0);
  assert.equal(
    new Set(RUNTIME_ENV_REQUIREMENTS.map(({ id }) => id)).size,
    RUNTIME_ENV_REQUIREMENTS.length,
  );
  for (const requirement of RUNTIME_ENV_REQUIREMENTS) {
    assert.ok(requirement.id.trim());
    assert.ok(requirement.reason.trim());
    assert.ok(requirement.names.length > 0);
    assert.equal(new Set(requirement.names).size, requirement.names.length);
    assert.ok(requirement.syntheticValue.trim());
  }
});

test("always-on requirements apply to dev and staging runtimes", () => {
  for (const deploymentEnvironment of ["dev", "staging"] as const) {
    assert.deepEqual(
      validateRuntimeEnvironment(
        buildSyntheticRuntimeEnvironment(deploymentEnvironment),
      ).failures,
      [],
    );
  }

  const failures = validateRuntimeEnvironment({ CHAPTERFLOW_ENV: "dev" }).failures;
  assert.deepEqual(
    failures.map(({ requirementId }) => requirementId).sort(),
    ["book-content-bucket", "book-table"],
  );
});

test("derived production environment satisfies every runtime requirement", () => {
  assert.deepEqual(validateRuntimeEnvironment(PRODUCTION_ENV).failures, []);
});

test("missing and blank production values fail by stable nonsecret metadata", () => {
  const env = { ...PRODUCTION_ENV };
  delete env.BOOK_STRIPE_SECRET_KEY;
  env.COGNITO_CLIENT_ID = "   ";

  assert.deepEqual(validateRuntimeEnvironment(env).failures, [
    {
      requirementId: "stripe-secret-key",
      code: "missing",
      names: ["BOOK_STRIPE_SECRET_KEY"],
    },
    {
      requirementId: "cognito-client",
      code: "missing",
      names: ["COGNITO_CLIENT_ID"],
    },
  ]);
});

test("either standard or custom Cognito domain satisfies the one-of requirement", () => {
  const standard = { ...PRODUCTION_ENV };
  assert.ok(standard.COGNITO_DOMAIN);
  assert.deepEqual(validateRuntimeEnvironment(standard).failures, []);

  const custom: Record<string, string> = {
    ...standard,
    COGNITO_CUSTOM_DOMAIN: "auth.example.test",
  };
  delete custom.COGNITO_DOMAIN;
  assert.deepEqual(validateRuntimeEnvironment(custom).failures, []);

  delete custom.COGNITO_CUSTOM_DOMAIN;
  assert.deepEqual(
    validateRuntimeEnvironment(custom).failures.find(
      ({ requirementId }) => requirementId === "cognito-domain",
    ),
    {
      requirementId: "cognito-domain",
      code: "missing",
      names: ["COGNITO_DOMAIN", "COGNITO_CUSTOM_DOMAIN"],
    },
  );
});

test("allowed deployment environments fail closed on an unknown value", () => {
  const failures = validateRuntimeEnvironment({
    ...buildSyntheticRuntimeEnvironment("dev"),
    CHAPTERFLOW_ENV: "production",
  }).failures;
  assert.deepEqual(failures, [
    {
      requirementId: "deployment-environment",
      code: "invalid_value",
      names: ["CHAPTERFLOW_ENV"],
    },
  ]);
});

test("short production secrets fail without exposing values or observed lengths", () => {
  const authMarker = "auth-marker";
  const originMarker = "origin-marker";
  const failures = validateRuntimeEnvironment({
    ...PRODUCTION_ENV,
    AUTH_STATE_SECRET: authMarker,
    ORIGIN_VERIFY_SECRET: originMarker,
  }).failures;

  assert.deepEqual(failures, [
    {
      requirementId: "auth-state-secret",
      code: "too_short",
      names: ["AUTH_STATE_SECRET"],
    },
    {
      requirementId: "origin-verification-secret",
      code: "too_short",
      names: ["ORIGIN_VERIFY_SECRET"],
    },
  ]);
  const serialized = JSON.stringify(failures);
  assert.doesNotMatch(serialized, new RegExp(`${authMarker}|${originMarker}`));
  assert.doesNotMatch(serialized, /observed|actual|length/i);
});

test("build-only and documented optional settings are outside the boot contract", () => {
  const names = new Set<string>(
    RUNTIME_ENV_REQUIREMENTS.flatMap(({ names }) => names),
  );
  for (const optionalName of [
    "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY",
    "BOOK_STRIPE_PRICE_ID_ANNUAL",
    "BOOK_STRIPE_PRICE_ID_ANNUAL_UPFRONT",
    "COGNITO_LOGOUT_REDIRECT_URI",
    "AUTH_COOKIE_DOMAIN",
    "ELEVENLABS_API_KEY",
    "APPLE_IAP_TESTFLIGHT_SANDBOX_ENABLED",
    "APPLE_IAP_TESTFLIGHT_QA_USER_HASHES",
    "BOOK_INGEST_BUCKET",
  ]) {
    assert.equal(names.has(optionalName), false, optionalName);
  }
  assert.deepEqual(validateRuntimeEnvironment(PRODUCTION_ENV).failures, []);
});

test("derived production placeholders use valid callback, app, and App Store URLs", () => {
  for (const name of [
    "COGNITO_REDIRECT_URI",
    "CHAPTERFLOW_APP_BASE_URL",
    "IOS_APP_STORE_URL",
  ]) {
    assert.doesNotThrow(() => new URL(PRODUCTION_ENV[name]), name);
  }
});
