import { after, before, test } from "node:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import * as cdk from "aws-cdk-lib";
import { Template } from "aws-cdk-lib/assertions";
import { ChapterFlowFrontendStack } from "./chapterflow-frontend-stack";
import { FRONTEND_SSM_RUNTIME_SECRET_NAMES } from "./frontend-runtime-config";

// WS6-023: CI's infra-checks job only synths the dev backend stack — the
// frontend stack (CloudFront + Route53 + custom domain wiring) and the prod
// backend stack had zero synth coverage. Backend prod/staging synth is added
// to ci.yml directly (no AWS creds needed there — see chapterflow-backend-
// stack.ts, neither stack uses HostedZone.fromLookup). The frontend stack
// can't be synthed from CI's dev context the same way (it requires OpenNext
// build artifacts on disk — bin/app.ts auto-skips it when absent), so its
// coverage lives here instead: a prod-shaped and a staging-shaped synth
// against a non-secret stub .open-next/ fixture, exercising the custom-
// domain + explicit-hosted-zone path that real prod deploys take.

let openNextFixture = "";

before(() => {
  openNextFixture = fs.mkdtempSync(
    path.join(os.tmpdir(), "chapterflow-open-next-prod-"),
  );
  for (const relative of [
    "server-functions/default",
    "server-functions/admin",
    "image-optimization-function",
    "revalidation-function",
    "dynamodb-provider",
    "warmer-function",
    "assets",
    "cache",
  ]) {
    const directory = path.join(openNextFixture, relative);
    fs.mkdirSync(directory, { recursive: true });
    fs.writeFileSync(path.join(directory, "fixture.txt"), "nonsecret fixture\n");
  }
});

after(() => {
  fs.rmSync(openNextFixture, { recursive: true, force: true });
});

function syntheticServerEnv(): Record<string, string> {
  return Object.fromEntries([
    ...FRONTEND_SSM_RUNTIME_SECRET_NAMES.map((name) => [
      name,
      "synthetic-value-that-must-not-project",
    ]),
    ["COGNITO_CLIENT_ID", "nonsecret-client-id"],
  ]);
}

test("prod-shaped frontend stack synthesizes with explicit hosted zone", () => {
  const app = new cdk.App();
  const stack = new ChapterFlowFrontendStack(app, "ChapterFlowFrontend", {
    env: { account: "123456789012", region: "us-east-1" },
    envName: "prod",
    resourceSuffix: "",
    appTableName: "ChapterFlowApp",
    analyticsTableName: "ChapterFlowInsights",
    ingestBucketName: "chapterflow-ingest-prod",
    contentBucketName: "chapterflow-content-prod",
    ssmPrefix: "/chapterflow/prod",
    openNextDir: openNextFixture,
    domainName: "chapterflow.ca",
    hostedZoneId: "Z0123456789SYNTHETIC",
    serverEnv: syntheticServerEnv(),
    originVerifySecret: "synthetic-origin-lock-value-long-enough",
    lambdaConcurrency: {
      server: 400,
      image: 60,
      revalidation: 10,
      dynamoProvider: 2,
      warmer: 2,
    },
  });

  const template = Template.fromStack(stack);
  template.resourceCountIs("AWS::CloudFront::Distribution", 1);
});

test("staging-shaped frontend stack synthesizes", () => {
  const app = new cdk.App();
  const stack = new ChapterFlowFrontendStack(app, "ChapterFlowFrontend-staging", {
    env: { account: "123456789012", region: "us-east-1" },
    envName: "staging",
    resourceSuffix: "-staging",
    appTableName: "ChapterFlowApp-staging",
    analyticsTableName: "ChapterFlowInsights-staging",
    ingestBucketName: "chapterflow-ingest-staging",
    contentBucketName: "chapterflow-content-staging",
    ssmPrefix: "/chapterflow/staging",
    openNextDir: openNextFixture,
    serverEnv: syntheticServerEnv(),
    originVerifySecret: "synthetic-origin-lock-value-long-enough",
    lambdaConcurrency: {
      server: 25,
      image: 5,
      revalidation: 2,
      dynamoProvider: 2,
      warmer: 2,
    },
  });

  const template = Template.fromStack(stack);
  template.resourceCountIs("AWS::CloudFront::Distribution", 1);
});
