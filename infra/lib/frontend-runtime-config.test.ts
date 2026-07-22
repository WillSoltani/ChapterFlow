import assert from "node:assert/strict";
import { test } from "node:test";

import {
  RUNTIME_ENV_REQUIREMENTS,
  buildSyntheticRuntimeEnvironment,
  validateRuntimeEnvironment,
} from "../../app/app/api/_lib/boot-env-core";
import {
  FRONTEND_SSM_RUNTIME_SECRET_NAMES,
  FRONTEND_RUNTIME_ENV_REQUIREMENTS,
  buildFrontendRuntimeConfig,
  projectFrontendServerEnv,
  resolveFrontendHostedZoneId,
  validateFrontendRuntimeEnvironment,
} from "./frontend-runtime-config";

function appProjection() {
  return RUNTIME_ENV_REQUIREMENTS.map(
    ({ reason: _reason, syntheticValue: _syntheticValue, ...requirement }) =>
      requirement,
  );
}

function productionDeployFixture(): Record<string, string> {
  const runtime = buildSyntheticRuntimeEnvironment("prod");
  const deploy = { ...runtime };
  deploy.CHAPTERFLOW_ORIGIN_VERIFY_SECRET = runtime.ORIGIN_VERIFY_SECRET;
  delete deploy.ORIGIN_VERIFY_SECRET;
  delete deploy.CHAPTERFLOW_ENV;
  delete deploy.BOOK_TABLE_NAME;
  delete deploy.BOOK_CONTENT_BUCKET;
  for (const name of FRONTEND_SSM_RUNTIME_SECRET_NAMES) delete deploy[name];
  return deploy;
}

const PROD_SSM_PREFIX = "/chapterflow/prod";

test("hosted-zone config validates before frontend stack construction", () => {
  assert.equal(resolveFrontendHostedZoneId(undefined, undefined), undefined);
  assert.equal(
    resolveFrontendHostedZoneId("example.test", " Z12345SYNTHETIC "),
    "Z12345SYNTHETIC",
  );
  assert.throws(
    () => resolveFrontendHostedZoneId("example.test", undefined),
    /must be configured together/,
  );
  assert.throws(
    () => resolveFrontendHostedZoneId(undefined, "Z12345SYNTHETIC"),
    /must be configured together/,
  );
  assert.throws(
    () => resolveFrontendHostedZoneId("example.test", "not-a-zone"),
    /invalid format/,
  );
});

test("infra runtime requirement projection exactly matches the app authority", () => {
  assert.deepEqual(FRONTEND_RUNTIME_ENV_REQUIREMENTS, appProjection());
});

test("infra and app validators return the same production failures", () => {
  const runtime = buildSyntheticRuntimeEnvironment("prod");
  runtime.AUTH_STATE_SECRET = "short";
  delete runtime.COGNITO_DOMAIN;

  assert.deepEqual(
    validateFrontendRuntimeEnvironment(runtime),
    validateRuntimeEnvironment(runtime).failures,
  );
});

test("frontend resolver maps deploy origin verification into the runtime name", () => {
  const config = buildFrontendRuntimeConfig({
    deploymentEnvironment: "prod",
    appTableName: "e2e-book-table",
    contentBucketName: "e2e-book-content-bucket",
    ssmParameterPrefix: PROD_SSM_PREFIX,
    deployEnv: productionDeployFixture(),
  });

  assert.ok(config.originVerifySecret);
  assert.equal(config.serverEnv.ORIGIN_VERIFY_SECRET, config.originVerifySecret);
  assert.equal("CHAPTERFLOW_ORIGIN_VERIFY_SECRET" in config.serverEnv, false);
});

test("either Cognito domain projects and validates without requiring both", () => {
  const deployEnv = productionDeployFixture();
  deployEnv.COGNITO_CUSTOM_DOMAIN = "auth.example.test";
  delete deployEnv.COGNITO_DOMAIN;

  assert.doesNotThrow(() =>
    buildFrontendRuntimeConfig({
      deploymentEnvironment: "prod",
      appTableName: "e2e-book-table",
      contentBucketName: "e2e-book-content-bucket",
      ssmParameterPrefix: PROD_SSM_PREFIX,
      deployEnv,
    }),
  );
});

test("public Stripe config is build-only and optional runtime values remain optional", () => {
  const deployEnv = productionDeployFixture();
  deployEnv.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY = "e2e-public-key";
  delete deployEnv.BOOK_STRIPE_PRICE_ID_ANNUAL;
  delete deployEnv.COGNITO_LOGOUT_REDIRECT_URI;
  delete deployEnv.ELEVENLABS_API_KEY;

  const serverEnv = projectFrontendServerEnv(deployEnv);
  assert.equal("NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY" in serverEnv, false);
  assert.doesNotThrow(() =>
    buildFrontendRuntimeConfig({
      deploymentEnvironment: "prod",
      appTableName: "e2e-book-table",
      contentBucketName: "e2e-book-content-bucket",
      ssmParameterPrefix: PROD_SSM_PREFIX,
      deployEnv,
    }),
  );
});

test("missing production environment config fails without values or observed lengths", () => {
  const deployEnv = productionDeployFixture();
  delete deployEnv.BOOK_STRIPE_PRICE_ID;
  delete deployEnv.COGNITO_CLIENT_ID;

  assert.throws(
    () =>
      buildFrontendRuntimeConfig({
        deploymentEnvironment: "prod",
        appTableName: "e2e-book-table",
        contentBucketName: "e2e-book-content-bucket",
        ssmParameterPrefix: PROD_SSM_PREFIX,
        deployEnv,
      }),
    (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.match(error.message, /stripe-monthly-price:missing/);
      assert.match(error.message, /cognito-client:missing/);
      assert.doesNotMatch(error.message, /observed|actual|got \d+|length \d+/i);
      return true;
    },
  );
});

test("dev and staging need only always-on base resources", () => {
  for (const deploymentEnvironment of ["dev", "staging"] as const) {
    assert.doesNotThrow(() =>
      buildFrontendRuntimeConfig({
        deploymentEnvironment,
        appTableName: `${deploymentEnvironment}-table`,
        contentBucketName: `${deploymentEnvironment}-content`,
        ssmParameterPrefix: `/chapterflow/${deploymentEnvironment}`,
        deployEnv: {},
      }),
    );
  }
});

test("the five audited secret-class keys are never projected into Lambda plaintext environment", () => {
  const deployEnv = productionDeployFixture();
  for (const name of FRONTEND_SSM_RUNTIME_SECRET_NAMES) {
    deployEnv[name] = "synthetic-value-that-must-not-project";
  }

  const serverEnv = projectFrontendServerEnv(deployEnv);
  for (const name of FRONTEND_SSM_RUNTIME_SECRET_NAMES) {
    assert.equal(name in serverEnv, false, name);
  }
  assert.doesNotThrow(() =>
    buildFrontendRuntimeConfig({
      deploymentEnvironment: "prod",
      appTableName: "e2e-book-table",
      contentBucketName: "e2e-book-content-bucket",
      ssmParameterPrefix: PROD_SSM_PREFIX,
      deployEnv,
    }),
  );
});

test("production synth fails closed without the runtime SSM prefix", () => {
  assert.throws(
    () =>
      buildFrontendRuntimeConfig({
        deploymentEnvironment: "prod",
        appTableName: "e2e-book-table",
        contentBucketName: "e2e-book-content-bucket",
        ssmParameterPrefix: "",
        deployEnv: productionDeployFixture(),
      }),
    /runtime-secret-prefix:missing:SSM_PARAMETER_PREFIX/,
  );
});
