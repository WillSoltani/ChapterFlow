import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import * as cdk from "aws-cdk-lib";
import { Template } from "aws-cdk-lib/assertions";
import { ChapterFlowFrontendStack } from "./chapterflow-frontend-stack";
import { FRONTEND_SSM_RUNTIME_SECRET_NAMES } from "./frontend-runtime-config";

let openNextFixture = "";

before(() => {
  openNextFixture = fs.mkdtempSync(path.join(os.tmpdir(), "chapterflow-open-next-"));
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

function synthFrontendTemplate(options: {
  domainName?: string;
  hostedZoneId?: string;
} = {}): Record<string, unknown> {
  const app = new cdk.App();
  const stack = new ChapterFlowFrontendStack(app, "ChapterFlowFrontend-dev", {
    env: { account: "123456789012", region: "us-east-1" },
    envName: "dev",
    resourceSuffix: "-dev",
    appTableName: "ChapterFlowApp-dev",
    analyticsTableName: "ChapterFlowInsights-dev",
    ingestBucketName: "chapterflow-ingest-dev",
    contentBucketName: "chapterflow-content-dev",
    ssmPrefix: "/chapterflow/dev",
    openNextDir: openNextFixture,
    domainName: options.domainName,
    hostedZoneId: options.hostedZoneId,
    serverEnv: Object.fromEntries([
      ...FRONTEND_SSM_RUNTIME_SECRET_NAMES.map((name) => [
        name,
        "synthetic-value-that-must-not-project",
      ]),
      ["COGNITO_CLIENT_ID", "nonsecret-client-id"],
    ]),
    originVerifySecret: "synthetic-origin-lock-value-long-enough",
    lambdaConcurrency: {
      server: 25,
      image: 5,
      revalidation: 2,
      dynamoProvider: 2,
      warmer: 2,
    },
  });
  return Template.fromStack(stack).toJSON();
}

function resourcesOfType(
  template: Record<string, unknown>,
  type: string,
): Array<Record<string, unknown>> {
  const resources = template.Resources as Record<
    string,
    { Type?: string; Properties?: Record<string, unknown> }
  >;
  return Object.values(resources)
    .filter(({ Type }) => Type === type)
    .map(({ Properties }) => Properties ?? {});
}

test("revalidation queue visibility timeout is at least 6x the RevalidationFn timeout", () => {
  const template = synthFrontendTemplate();

  const queue = resourcesOfType(template, "AWS::SQS::Queue").find(
    ({ QueueName }) => QueueName === "ChapterFlowRevalidation-dev.fifo",
  );
  assert.ok(queue);
  const visibilityTimeout = queue.VisibilityTimeout as number;
  assert.ok(visibilityTimeout >= 180, `expected >= 180, got ${visibilityTimeout}`);

  const fn = resourcesOfType(template, "AWS::Lambda::Function").find(
    ({ FunctionName }) => FunctionName === "ChapterFlowRevalidation-dev",
  );
  assert.ok(fn);
  const fnTimeout = fn.Timeout as number;
  assert.ok(
    visibilityTimeout >= 6 * fnTimeout,
    `expected queue visibility (${visibilityTimeout}) >= 6x fn timeout (${fnTimeout})`,
  );
});
