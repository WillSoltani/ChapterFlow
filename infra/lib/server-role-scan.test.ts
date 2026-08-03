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
  openNextFixture = fs.mkdtempSync(path.join(os.tmpdir(), "chapterflow-server-role-scan-"));
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

const ORIGIN_SECRET = "synthetic-origin-lock-value-long-enough";

function synthFrontendTemplate(): {
  json: Record<string, unknown>;
  resources: Record<string, { Type?: string; Properties?: Record<string, unknown> }>;
} {
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
    serverEnv: Object.fromEntries([
      ...FRONTEND_SSM_RUNTIME_SECRET_NAMES.map((name) => [
        name,
        "synthetic-value-that-must-not-project",
      ]),
      ["COGNITO_CLIENT_ID", "nonsecret-client-id"],
    ]),
    originVerifySecret: ORIGIN_SECRET,
    lambdaConcurrency: {
      server: 25,
      image: 5,
      revalidation: 2,
      dynamoProvider: 2,
      warmer: 2,
    },
  });
  const json = Template.fromStack(stack).toJSON() as Record<string, unknown>;
  const resources = json.Resources as Record<
    string,
    { Type?: string; Properties?: Record<string, unknown> }
  >;
  return { json, resources };
}

/** Statements on the CDK-generated DefaultPolicy for the role whose logical id starts with `prefix`. */
function statementsForRole(
  resources: Record<string, { Type?: string; Properties?: Record<string, unknown> }>,
  prefix: string,
): Array<Record<string, unknown>> {
  const entry = Object.entries(resources).find(
    ([logicalId, resource]) =>
      resource.Type === "AWS::IAM::Policy" &&
      logicalId.startsWith(`${prefix}DefaultPolicy`),
  );
  assert.ok(entry, `no DefaultPolicy found for role prefix ${prefix}`);
  const document = (entry[1].Properties as { PolicyDocument?: { Statement?: Array<Record<string, unknown>> } })
    .PolicyDocument;
  return document?.Statement ?? [];
}

function lambdaByFunctionName(
  resources: Record<string, { Type?: string; Properties?: Record<string, unknown> }>,
  functionName: string,
): Record<string, unknown> {
  const props = Object.values(resources)
    .filter(({ Type }) => Type === "AWS::Lambda::Function")
    .map(({ Properties }) => Properties ?? {})
    .find(({ FunctionName }) => FunctionName === functionName);
  assert.ok(props, `no Lambda named ${functionName}`);
  return props;
}

test("server LambdaRole AppDynamoDbAccess statement does not include dynamodb:Scan", () => {
  const { resources } = synthFrontendTemplate();
  const statements = statementsForRole(resources, "LambdaRole");
  const app = statements.find(({ Sid }) => Sid === "AppDynamoDbAccess");
  assert.ok(app, "server role is missing the AppDynamoDbAccess statement");
  const actions = app.Action as string[];
  assert.equal(
    actions.includes("dynamodb:Scan"),
    false,
    "server role must not grant dynamodb:Scan on the app/analytics tables",
  );
  // The ISR cache-table Scan (CacheDynamoDbAccess) stays — OpenNext needs it.
  const cache = statements.find(({ Sid }) => Sid === "CacheDynamoDbAccess");
  assert.ok(cache);
  assert.equal((cache.Action as string[]).includes("dynamodb:Scan"), true);
});

test("admin function role grants dynamodb:Scan scoped to the app + analytics table ARNs only", () => {
  const { resources } = synthFrontendTemplate();
  const statements = statementsForRole(resources, "AdminRole");
  const app = statements.find(({ Sid }) => Sid === "AppDynamoDbAccess");
  assert.ok(app, "admin role is missing the AppDynamoDbAccess statement");
  const actions = app.Action as string[];
  assert.equal(
    actions.includes("dynamodb:Scan"),
    true,
    "admin role must grant dynamodb:Scan for the metrics/economy aggregates",
  );
  // Scoped to exactly the two app tables + their indexes — never "*".
  const resourceJson = JSON.stringify(app.Resource);
  assert.match(resourceJson, /ChapterFlowApp-dev/);
  assert.match(resourceJson, /ChapterFlowInsights-dev/);
  assert.doesNotMatch(resourceJson, /"\*"/);
  const resourceArr = app.Resource as unknown[];
  assert.equal(resourceArr.length, 4);
});

test("CloudFront distribution has a cache behavior for app/api/book/admin/* targeting the admin function origin", () => {
  const { resources } = synthFrontendTemplate();
  const distribution = Object.values(resources).find(
    ({ Type }) => Type === "AWS::CloudFront::Distribution",
  );
  assert.ok(distribution);
  const config = (distribution.Properties as {
    DistributionConfig: {
      CacheBehaviors?: Array<Record<string, unknown>>;
      Origins?: Array<Record<string, unknown>>;
    };
  }).DistributionConfig;
  const adminBehavior = (config.CacheBehaviors ?? []).find(
    ({ PathPattern }) => PathPattern === "app/api/book/admin/*",
  );
  assert.ok(adminBehavior, "missing admin cache behavior");
  const origin = (config.Origins ?? []).find(
    ({ Id }) => Id === adminBehavior.TargetOriginId,
  );
  assert.ok(origin, "admin behavior points at no declared origin");
  // FunctionUrlOrigin derives DomainName from the admin Function URL GetAtt.
  assert.match(JSON.stringify(origin.DomainName), /AdminFn/);
});

test("admin Function URL lambda carries ORIGIN_VERIFY_SECRET env + wrapper when originVerifySecret is set", () => {
  const { resources } = synthFrontendTemplate();
  const admin = lambdaByFunctionName(resources, "ChapterFlowAdmin-dev");
  const variables = (admin.Environment as { Variables: Record<string, unknown> }).Variables;
  assert.equal(variables.ORIGIN_VERIFY_SECRET, ORIGIN_SECRET);
  assert.equal(variables.ORIGIN_VERIFY_MODE, "enforce");

  // The CloudFront admin origin stamps the shared secret header (the "wrapper"
  // half of the interim origin lock — mirrors the ServerFn origin treatment).
  const distribution = Object.values(resources).find(
    ({ Type }) => Type === "AWS::CloudFront::Distribution",
  );
  assert.ok(distribution);
  const config = (distribution.Properties as {
    DistributionConfig: {
      CacheBehaviors?: Array<Record<string, unknown>>;
      Origins?: Array<Record<string, unknown>>;
    };
  }).DistributionConfig;
  const adminBehavior = (config.CacheBehaviors ?? []).find(
    ({ PathPattern }) => PathPattern === "app/api/book/admin/*",
  );
  assert.ok(adminBehavior);
  const origin = (config.Origins ?? []).find(
    ({ Id }) => Id === adminBehavior.TargetOriginId,
  ) as { OriginCustomHeaders?: Array<{ HeaderName: string; HeaderValue: string }> };
  assert.ok(origin);
  const verifyHeader = (origin.OriginCustomHeaders ?? []).find(
    ({ HeaderName }) => HeaderName === "x-origin-verify",
  );
  assert.ok(verifyHeader, "admin origin missing x-origin-verify header");
  assert.equal(verifyHeader.HeaderValue, ORIGIN_SECRET);
});
