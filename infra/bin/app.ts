#!/usr/bin/env node
import * as fs from "fs";
import * as path from "path";
import * as cdk from "aws-cdk-lib";
import { ChapterFlowBackendStack } from "../lib/chapterflow-backend-stack";
import { ChapterFlowFrontendStack } from "../lib/chapterflow-frontend-stack";
import { resolveEnvConfig } from "../lib/env-config";

const app = new cdk.App();

// dev | staging | prod — selected with `-c env=<env>` (or CHAPTERFLOW_ENV).
// prod maps to the existing unsuffixed stacks/resources (zero-diff); dev and
// staging stand up as independent suffixed stacks in the same account.
const cfg = resolveEnvConfig(app);

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
  removalPolicy: cfg.removalPolicy,
  deletionProtection: cfg.deletionProtection,
  pointInTimeRecovery: cfg.pointInTimeRecovery,
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

if (!openNextExists) {
  console.warn(
    "⚠ Skipping ChapterFlowFrontend stack — .open-next/ build output not found.\n" +
      "  Run `npx open-next build` first to include the frontend stack.",
  );
}

if (openNextExists) {
  if (!ingestBucketName || !contentBucketName) {
    throw new Error(
      "Frontend stack requires BOOK_INGEST_BUCKET and BOOK_CONTENT_BUCKET. " +
        `Resolve them from SSM /chapterflow/${cfg.env}/BOOK_INGEST_BUCKET and ` +
        `/chapterflow/${cfg.env}/BOOK_CONTENT_BUCKET (the deploy workflow does ` +
        "this). Refusing to synth the frontend against unknown buckets.",
    );
  }

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
    serverEnv: {
      // These are populated from GitHub Secrets in CI/CD.
      // For local synth/deploy, set them as env vars or omit for dry-run.
      ...(process.env.CHAPTERFLOW_COMMIT_SHA && {
        CHAPTERFLOW_COMMIT_SHA: process.env.CHAPTERFLOW_COMMIT_SHA,
      }),
      ...(process.env.CHAPTERFLOW_APP_BASE_URL && {
        CHAPTERFLOW_APP_BASE_URL: process.env.CHAPTERFLOW_APP_BASE_URL,
      }),
      ...(process.env.COGNITO_DOMAIN && {
        COGNITO_DOMAIN: process.env.COGNITO_DOMAIN,
      }),
      ...(process.env.COGNITO_CLIENT_ID && {
        COGNITO_CLIENT_ID: process.env.COGNITO_CLIENT_ID,
      }),
      ...(process.env.COGNITO_REGION && {
        COGNITO_REGION: process.env.COGNITO_REGION,
      }),
      ...(process.env.COGNITO_USER_POOL_ID && {
        COGNITO_USER_POOL_ID: process.env.COGNITO_USER_POOL_ID,
      }),
      ...(process.env.COGNITO_REDIRECT_URI && {
        COGNITO_REDIRECT_URI: process.env.COGNITO_REDIRECT_URI,
      }),
      ...(process.env.COGNITO_LOGOUT_REDIRECT_URI && {
        COGNITO_LOGOUT_REDIRECT_URI: process.env.COGNITO_LOGOUT_REDIRECT_URI,
      }),
      ...(process.env.AUTH_STATE_SECRET && {
        AUTH_STATE_SECRET: process.env.AUTH_STATE_SECRET,
      }),
      ...(process.env.AUTH_COOKIE_DOMAIN && {
        AUTH_COOKIE_DOMAIN: process.env.AUTH_COOKIE_DOMAIN,
      }),
      ...(process.env.BOOK_STRIPE_SECRET_KEY && {
        BOOK_STRIPE_SECRET_KEY: process.env.BOOK_STRIPE_SECRET_KEY,
      }),
      ...(process.env.BOOK_STRIPE_WEBHOOK_SECRET && {
        BOOK_STRIPE_WEBHOOK_SECRET: process.env.BOOK_STRIPE_WEBHOOK_SECRET,
      }),
      ...(process.env.BOOK_STRIPE_PRICE_ID && {
        BOOK_STRIPE_PRICE_ID: process.env.BOOK_STRIPE_PRICE_ID,
      }),
      ...(process.env.BOOK_STRIPE_PRICE_ID_ANNUAL && {
        BOOK_STRIPE_PRICE_ID_ANNUAL: process.env.BOOK_STRIPE_PRICE_ID_ANNUAL,
      }),
      ...(process.env.BOOK_STRIPE_PRICE_ID_ANNUAL_UPFRONT && {
        BOOK_STRIPE_PRICE_ID_ANNUAL_UPFRONT:
          process.env.BOOK_STRIPE_PRICE_ID_ANNUAL_UPFRONT,
      }),
      ...(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY && {
        NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY:
          process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
      }),
      // AI providers
      ...(process.env.ANTHROPIC_API_KEY && {
        ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
      }),
      ...(process.env.ELEVENLABS_API_KEY && {
        ELEVENLABS_API_KEY: process.env.ELEVENLABS_API_KEY,
      }),
    },
  });
}
