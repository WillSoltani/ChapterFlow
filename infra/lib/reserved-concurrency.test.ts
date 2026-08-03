import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import * as cdk from "aws-cdk-lib";
import { Template } from "aws-cdk-lib/assertions";
import { ChapterFlowFrontendStack } from "./chapterflow-frontend-stack";
import { ChapterFlowBackendStack } from "./chapterflow-backend-stack";
import { resolveEnvConfig, type ChapterFlowEnvConfig } from "./env-config";

// -----------------------------------------------------------------------
// Fixture (frontend) — same mkdtemp OpenNext directory shape used by
// frontend-secret-boundary.test.ts, so this file can synth the frontend
// stack without a real `.open-next/` build.
// -----------------------------------------------------------------------

let openNextFixture = "";

before(() => {
  openNextFixture = fs.mkdtempSync(
    path.join(os.tmpdir(), "chapterflow-reserved-concurrency-"),
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

const devLambdaConcurrency = {
  server: 25,
  image: 5,
  revalidation: 2,
  dynamoProvider: 2,
  warmer: 2,
  reminder: 2,
  suppression: 2,
  preSignUp: 2,
};

function synthFrontendTemplate(enforced = true): Record<string, unknown> {
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
    originVerifySecret: "synthetic-origin-lock-value-long-enough",
    lambdaConcurrencyEnforced: enforced,
    lambdaConcurrency: devLambdaConcurrency,
  });
  return Template.fromStack(stack).toJSON();
}

function synthBackendTemplate(enforced = true): Record<string, unknown> {
  const app = new cdk.App();
  const stack = new ChapterFlowBackendStack(app, "ChapterFlowBackend-dev", {
    env: { account: "123456789012", region: "us-east-1" },
    envName: "dev",
    resourceSuffix: "-dev",
    tableName: "ChapterFlowApp-dev",
    analyticsTableName: "ChapterFlowInsights-dev",
    ssmPrefix: "/chapterflow/dev",
    removalPolicy: cdk.RemovalPolicy.DESTROY,
    deletionProtection: false,
    pointInTimeRecovery: false,
    // Required so preSignUpFn (and its reserved concurrency) actually
    // instantiates — omitted, the conditional block never runs.
    cognitoUserPoolId: "us-east-1_TestPool123",
    lambdaConcurrencyEnforced: enforced,
    lambdaConcurrency: devLambdaConcurrency,
  });
  return Template.fromStack(stack).toJSON();
}

function functionsByName(
  template: Record<string, unknown>,
): Map<string, Record<string, unknown>> {
  const resources = template.Resources as Record<
    string,
    { Type?: string; Properties?: Record<string, unknown> }
  >;
  const byName = new Map<string, Record<string, unknown>>();
  for (const { Type, Properties } of Object.values(resources)) {
    if (Type !== "AWS::Lambda::Function" || !Properties) continue;
    const functionName = Properties.FunctionName;
    if (typeof functionName === "string") {
      byName.set(functionName, Properties);
    }
  }
  return byName;
}

test("frontend stack synthesizes ReservedConcurrentExecutions on every Lambda", () => {
  const template = synthFrontendTemplate();
  const functions = functionsByName(template);

  const expected: Record<string, number> = {
    "ChapterFlowServer-dev": devLambdaConcurrency.server,
    "ChapterFlowImage-dev": devLambdaConcurrency.image,
    "ChapterFlowRevalidation-dev": devLambdaConcurrency.revalidation,
    "ChapterFlowDynamoProvider-dev": devLambdaConcurrency.dynamoProvider,
    "ChapterFlowWarmer-dev": devLambdaConcurrency.warmer,
  };

  for (const [functionName, reserved] of Object.entries(expected)) {
    const fn = functions.get(functionName);
    assert.ok(fn, `expected a Lambda function named ${functionName}`);
    assert.equal(
      fn.ReservedConcurrentExecutions,
      reserved,
      `${functionName} ReservedConcurrentExecutions`,
    );
  }
});

test("backend cron/auth Lambdas synthesize a reserved floor", () => {
  const template = synthBackendTemplate();
  const functions = functionsByName(template);

  const expected: Record<string, number> = {
    "ChapterFlowReadingReminder-dev": devLambdaConcurrency.reminder,
    "ChapterFlowSuppressionHandler-dev": devLambdaConcurrency.suppression,
    "ChapterFlowCognitoPreSignUp-dev": devLambdaConcurrency.preSignUp,
  };

  for (const [functionName, reserved] of Object.entries(expected)) {
    const fn = functions.get(functionName);
    assert.ok(fn, `expected a Lambda function named ${functionName}`);
    assert.equal(
      fn.ReservedConcurrentExecutions,
      reserved,
      `${functionName} ReservedConcurrentExecutions`,
    );
  }
});

// -----------------------------------------------------------------------
// Cross-env guard. dev/staging/prod are ONE AWS account, so their reserved
// concurrency sums against the SAME default-1000 account limit at deploy
// time — the real constraint is the total across all three, not any one
// env in isolation. AWS refuses to apply a reservation that would leave
// <100 unreserved account-wide, so this test fails loudly (at synth-review
// time, long before a deploy attempt) if the budget ever creeps too high.
// -----------------------------------------------------------------------

function sumLambdaConcurrency(cfg: ChapterFlowEnvConfig): number {
  const c = cfg.lambdaConcurrency;
  return (
    c.server +
    c.image +
    c.revalidation +
    c.dynamoProvider +
    c.warmer +
    c.reminder +
    c.suppression +
    c.preSignUp
  );
}

test("reserved concurrency across all three env configs leaves >=100 unreserved at the 1000 default account limit", () => {
  const totals = (["dev", "staging", "prod"] as const).map((envName) => {
    const app = new cdk.App({ context: { env: envName } });
    return sumLambdaConcurrency(resolveEnvConfig(app));
  });

  const accountWideTotal = totals.reduce((sum, n) => sum + n, 0);
  assert.ok(
    accountWideTotal <= 900,
    `dev(${totals[0]}) + staging(${totals[1]}) + prod(${totals[2]}) = ` +
      `${accountWideTotal} reserved must leave >=100 of the default 1000 ` +
      "account-wide unreserved concurrency limit",
  );
});

// ----------------------------------------------------------------------------
// Account-quota gate (2026-07-22): the account's Lambda concurrent-executions
// quota is still the unraised default of 10, so ANY reservation fails the
// deploy ("decreases UnreservedConcurrentExecution below its minimum value of
// [10]" — prod run 29967575538). Until the Service Quotas increase
// (L-B99A9384 -> 1000, request 46c3aa6abb9744e68072b0888fc4f1ceYQkUo8pA) is
// approved, resolveEnvConfig ships lambdaConcurrencyEnforced=false and the
// stacks must omit ReservedConcurrentExecutions entirely.
// ----------------------------------------------------------------------------

test("quota gate: enforced=false omits ReservedConcurrentExecutions on every Lambda in both stacks", () => {
  for (const template of [synthFrontendTemplate(false), synthBackendTemplate(false)]) {
    for (const [name, properties] of functionsByName(template)) {
      assert.equal(
        properties.ReservedConcurrentExecutions,
        undefined,
        `${name} must not reserve concurrency while the account quota gate is active`,
      );
    }
  }
});

test("quota gate lifted: resolveEnvConfig ships lambdaConcurrencyEnforced=true (quota approved 2026-07-22, limit=1000)", () => {
  for (const env of ["dev", "staging", "prod"] as const) {
    const app = new cdk.App({ context: { env } });
    assert.equal(resolveEnvConfig(app).lambdaConcurrencyEnforced, true);
  }
});
