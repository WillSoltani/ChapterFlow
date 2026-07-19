#!/usr/bin/env node
import * as fs from "fs";
import * as path from "path";
import * as cdk from "aws-cdk-lib";
import { ChapterFlowBackendStack } from "../lib/chapterflow-backend-stack";
import { ChapterFlowFrontendStack } from "../lib/chapterflow-frontend-stack";
import { resolveEnvConfig } from "../lib/env-config";
import {
  assertAppleIapDeploymentConfig,
  shouldAssertAppleIapDeploymentConfig,
} from "../lib/apple-iap-config";
import { buildFrontendRuntimeConfig } from "../lib/frontend-runtime-config";
import { SensitiveWildcardGuard } from "../lib/iam-guards";

const app = new cdk.App();
// WS6-003: fail synth closed if any stack (this app, any env) grants a
// sensitive account-global IAM action on Resource "*".
cdk.Aspects.of(app).add(new SensitiveWildcardGuard());

// dev | staging | prod — selected with `-c env=<env>` (or CHAPTERFLOW_ENV).
// prod maps to the existing unsuffixed stacks/resources (zero-diff); dev and
// staging stand up as independent suffixed stacks in the same account.
const cfg = resolveEnvConfig(app);

// Native purchase/config identity is required in every deployed environment.
// Run this before constructing either stack so `cdk deploy` cannot mutate AWS
// and only then discover that the runtime routes will fail closed.
if (
  shouldAssertAppleIapDeploymentConfig(
    process.env.CHAPTERFLOW_VALIDATE_APPLE_IAP_CONFIG,
  )
) {
  assertAppleIapDeploymentConfig(cfg.env, process.env);
}

const env = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: cfg.region,
};

new ChapterFlowBackendStack(app, cfg.backendStackId, {
  env,
  envName: cfg.env,
  resourceSuffix: cfg.resourceSuffix,
  tableName: cfg.tableName,
  analyticsTableName: cfg.analyticsTableName,
  ssmPrefix: cfg.ssmPrefix,
  domainName: cfg.domainName,
  removalPolicy: cfg.removalPolicy,
  deletionProtection: cfg.deletionProtection,
  pointInTimeRecovery: cfg.pointInTimeRecovery,
  // The Cognito user pool is external (created outside this CDK, referenced by
  // secret). When its id is known at synth, the backend stack provisions the
  // Sign-in-with-Apple PreSignUp linking Lambda + scoped IAM. Omitted → no
  // trigger resources (dev/staging without the secret synth cleanly).
  cognitoUserPoolId: process.env.COGNITO_USER_POOL_ID?.trim() || undefined,
});

// Backend resource names are the single source of truth published by the
// backend stack to SSM (`/chapterflow/<env>/BOOK_*`). The deploy workflow reads
// them and injects them here — NO hardcoded bucket/table literals (that drift
// was the original problem). Table names fall back to the env-config values;
// bucket names are CDK-auto-generated so they MUST be provided.
const appTableName =
  process.env.CHAPTERFLOW_BOOK_TABLE_NAME || cfg.tableName;
const analyticsTableName =
  process.env.CHAPTERFLOW_BOOK_ANALYTICS_TABLE_NAME || cfg.analyticsTableName;
const ingestBucketName = process.env.BOOK_INGEST_BUCKET;
const contentBucketName = process.env.BOOK_CONTENT_BUCKET;

// The frontend stack requires OpenNext build artifacts (.open-next/).
// Only instantiate it when those artifacts exist — this allows
// `cdk deploy ChapterFlowBackend[-env]` to run independently (e.g. in the
// infra deploy job / CI synth) without needing a full app build.
const openNextDir = path.join(__dirname, "../../.open-next");
const openNextExists = fs.existsSync(
  path.join(openNextDir, "server-functions/default"),
);

// Escape hatch for backend-only synth/diff (e.g. `cdk diff ChapterFlowBackend`
// from a checkout that happens to have a stale .open-next/ build): skip the
// frontend stack entirely so it doesn't demand bucket names. The deploy
// workflow never sets this, so deploy behavior is unchanged.
//   npx cdk diff -c env=prod -c skipFrontend=true ChapterFlowBackend
const skipFrontend =
  app.node.tryGetContext("skipFrontend") === "true" ||
  app.node.tryGetContext("skipFrontend") === true ||
  process.env.CHAPTERFLOW_SKIP_FRONTEND === "1";

if (skipFrontend) {
  console.warn(
    "⚠ Skipping ChapterFlowFrontend stack — skipFrontend flag set " +
      "(backend-only synth/diff).",
  );
} else if (!openNextExists) {
  console.warn(
    "⚠ Skipping ChapterFlowFrontend stack — .open-next/ build output not found.\n" +
      "  Run `npx open-next build` first to include the frontend stack.",
  );
}

if (!skipFrontend && openNextExists) {
  if (!ingestBucketName || !contentBucketName) {
    throw new Error(
      "Frontend stack requires BOOK_INGEST_BUCKET and BOOK_CONTENT_BUCKET. " +
        `Resolve them from SSM /chapterflow/${cfg.env}/BOOK_INGEST_BUCKET and ` +
        `/chapterflow/${cfg.env}/BOOK_CONTENT_BUCKET (the deploy workflow does ` +
        "this), or pass `-c skipFrontend=true` to synth/diff the backend alone. " +
        "Refusing to synth the frontend against unknown buckets.",
    );
  }

  const frontendRuntimeConfig = buildFrontendRuntimeConfig({
    deploymentEnvironment: cfg.env,
    appTableName,
    contentBucketName,
    deployEnv: process.env,
  });

  new ChapterFlowFrontendStack(app, cfg.frontendStackId, {
    env,
    envName: cfg.env,
    resourceSuffix: cfg.resourceSuffix,
    appTableName,
    analyticsTableName,
    ingestBucketName,
    contentBucketName,
    ssmPrefix: cfg.ssmPrefix,
    domainName: cfg.domainName,
    // WS6-002 interim origin lock. Secret unset → byte-identical to today (no
    // header, no enforcement). Mode is passed through ONLY when exactly "log"
    // (the two-phase observation window); anything else leaves it undefined so
    // the stack defaults to "enforce".
    originVerifySecret: frontendRuntimeConfig.originVerifySecret,
    originVerifyMode: frontendRuntimeConfig.originVerifyMode,
    serverEnv: frontendRuntimeConfig.serverEnv,
  });
}
