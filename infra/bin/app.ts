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
  domainName: cfg.domainName,
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

  // Prod must never ship a silently-degraded frontend. Every launch-critical
  // secret below is injected via a conditional spread (`...(process.env.X && …)`),
  // so a MISSING one is quietly omitted and the app would boot without Stripe,
  // Cognito/auth, the live app URL, or AI config. Assert their presence here and
  // fail the prod synth loudly instead. dev/staging may run degraded. (Annual
  // price IDs, logout redirect, cookie domain, and ElevenLabs stay optional —
  // they degrade gracefully.)
  if (cfg.env === "prod") {
    const requiredSecrets = [
      "BOOK_STRIPE_SECRET_KEY",
      "BOOK_STRIPE_WEBHOOK_SECRET",
      "BOOK_STRIPE_PRICE_ID",
      "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY",
      "COGNITO_DOMAIN",
      "COGNITO_CLIENT_ID",
      "COGNITO_REGION",
      "COGNITO_USER_POOL_ID",
      "COGNITO_REDIRECT_URI",
      "AUTH_STATE_SECRET",
      "CHAPTERFLOW_APP_BASE_URL",
      "ANTHROPIC_API_KEY",
    ];
    const missing = requiredSecrets.filter((key) => !process.env[key]?.trim());
    if (missing.length > 0) {
      throw new Error(
        "Refusing to synth the prod ChapterFlowFrontend stack — launch-critical " +
          `secrets are missing from the deploy environment: ${missing.join(", ")}. ` +
          "Set them as prod GitHub Environment secrets before deploying.",
      );
    }

    // OAuth strictness (#15): AUTH_STATE_SECRET keys the AES-256-GCM encryption
    // of the OAuth `state` (PKCE verifier + returnTo + nonce). A short secret
    // weakens that integrity guarantee, and the app code (app/auth/_lib/
    // state-crypto.ts getSecret) hard-rejects anything < 32 chars at RUNTIME —
    // which would silently degrade every login to the weaker cookie-only
    // fallback in prod. Fail the prod SYNTH loudly instead so the deploy can't
    // ship a too-short secret. Literal kept in sync with state-crypto.ts (infra
    // is a separate package; do NOT import app code).
    const AUTH_STATE_SECRET_MIN_LENGTH = 32; // MUST match app/auth/_lib/state-crypto.ts
    const authStateSecret = process.env.AUTH_STATE_SECRET ?? "";
    if (authStateSecret.length < AUTH_STATE_SECRET_MIN_LENGTH) {
      throw new Error(
        "Refusing to synth the prod ChapterFlowFrontend stack — AUTH_STATE_SECRET " +
          `must be at least ${AUTH_STATE_SECRET_MIN_LENGTH} characters (got ` +
          `${authStateSecret.length}). Rotate the prod secret to a longer value ` +
          "before deploying.",
      );
    }
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
      // CSRF/same-origin guard (#6). Injected UNCONDITIONALLY (default "1" = ON)
      // so the value is present in the Lambda config and can be flipped to "0"
      // (observe-only: log, don't block) directly on the live function for a
      // brief confirmation window after a deploy. CDK resets it to this default
      // on the next deploy. Read via raw process.env (isCsrfEnforcementOn).
      CSRF_ORIGIN_ENFORCE: process.env.CSRF_ORIGIN_ENFORCE ?? "1",
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
