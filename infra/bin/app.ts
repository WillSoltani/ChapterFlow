#!/usr/bin/env node
import "source-map-support/register";
import * as fs from "fs";
import * as path from "path";
import * as cdk from "aws-cdk-lib";
import { ChapterFlowBackendStack } from "../lib/chapterflow-backend-stack";
import { ChapterFlowFrontendStack } from "../lib/chapterflow-frontend-stack";

const app = new cdk.App();

const env = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: "us-east-1",
};

new ChapterFlowBackendStack(app, "ChapterFlowBackend", { env });

// Backend resource names — these are stable, well-known values.
// Using explicit strings instead of cross-stack references so each
// stack can be deployed independently without CloudFormation export conflicts.
const appTableName =
  process.env.CHAPTERFLOW_BOOK_TABLE_NAME || "ChapterFlowApp";
const analyticsTableName =
  process.env.CHAPTERFLOW_BOOK_ANALYTICS_TABLE_NAME || "ChapterFlowInsights";
const ingestBucketName =
  process.env.BOOK_INGEST_BUCKET ||
  "chapterflowbackend-chapterflowingestbucketdb5de03f-3yot64zeyaq7";
const contentBucketName =
  process.env.BOOK_CONTENT_BUCKET ||
  "chapterflowbackend-chapterflowcontentbucket2ed1848-qo8kewolurc0";
const ssmPrefix = process.env.SSM_PARAMETER_PREFIX || "/chapterflow/prod";

// The frontend stack requires OpenNext build artifacts (.open-next/).
// Only instantiate it when those artifacts exist — this allows
// `cdk deploy ChapterFlowBackend` to run independently (e.g. in the
// deploy-infra-dev workflow) without needing a full app build.
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
new ChapterFlowFrontendStack(app, "ChapterFlowFrontend", {
  env,
  appTableName,
  analyticsTableName,
  ingestBucketName,
  contentBucketName,
  ssmPrefix,
  domainName: process.env.CHAPTERFLOW_DOMAIN_NAME || "chapterflow.ca",
  serverEnv: {
    // These are populated from GitHub Secrets in CI/CD.
    // For local synth/deploy, set them as env vars or omit for dry-run.
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
  },
});
}
