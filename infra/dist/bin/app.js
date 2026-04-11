#!/usr/bin/env node
"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
require("source-map-support/register");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const cdk = __importStar(require("aws-cdk-lib"));
const chapterflow_backend_stack_1 = require("../lib/chapterflow-backend-stack");
const chapterflow_frontend_stack_1 = require("../lib/chapterflow-frontend-stack");
const app = new cdk.App();
const env = {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: "us-east-1",
};
new chapterflow_backend_stack_1.ChapterFlowBackendStack(app, "ChapterFlowBackend", { env });
// Backend resource names — these are stable, well-known values.
// Using explicit strings instead of cross-stack references so each
// stack can be deployed independently without CloudFormation export conflicts.
const appTableName = process.env.CHAPTERFLOW_BOOK_TABLE_NAME || "ChapterFlowApp";
const analyticsTableName = process.env.CHAPTERFLOW_BOOK_ANALYTICS_TABLE_NAME || "ChapterFlowInsights";
const ingestBucketName = process.env.BOOK_INGEST_BUCKET ||
    "chapterflowbackend-chapterflowingestbucketdb5de03f-3yot64zeyaq7";
const contentBucketName = process.env.BOOK_CONTENT_BUCKET ||
    "chapterflowbackend-chapterflowcontentbucket2ed1848-qo8kewolurc0";
const ssmPrefix = process.env.SSM_PARAMETER_PREFIX || "/chapterflow/prod";
// The frontend stack requires OpenNext build artifacts (.open-next/).
// Only instantiate it when those artifacts exist — this allows
// `cdk deploy ChapterFlowBackend` to run independently (e.g. in the
// deploy-infra-dev workflow) without needing a full app build.
const openNextDir = path.join(__dirname, "../../.open-next");
const openNextExists = fs.existsSync(path.join(openNextDir, "server-functions/default"));
if (!openNextExists) {
    console.warn("⚠ Skipping ChapterFlowFrontend stack — .open-next/ build output not found.\n" +
        "  Run `npx open-next build` first to include the frontend stack.");
}
if (openNextExists) {
    new chapterflow_frontend_stack_1.ChapterFlowFrontendStack(app, "ChapterFlowFrontend", {
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
                BOOK_STRIPE_PRICE_ID_ANNUAL_UPFRONT: process.env.BOOK_STRIPE_PRICE_ID_ANNUAL_UPFRONT,
            }),
            ...(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY && {
                NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
            }),
        },
    });
}
