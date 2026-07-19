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

function synthFrontendTemplate(): Record<string, unknown> {
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
    originVerifySecret: "synthetic-origin-lock-value-long-enough",
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

test("server Lambda environment excludes all five runtime secrets while preserving the origin lock", () => {
  const template = synthFrontendTemplate();
  const server = resourcesOfType(template, "AWS::Lambda::Function").find(
    ({ FunctionName }) => FunctionName === "ChapterFlowServer-dev",
  );
  assert.ok(server);
  const variables = (server.Environment as { Variables: Record<string, unknown> })
    .Variables;

  for (const name of FRONTEND_SSM_RUNTIME_SECRET_NAMES) {
    assert.equal(name in variables, false, name);
  }
  assert.equal(variables.SSM_PARAMETER_PREFIX, "/chapterflow/dev");
  assert.equal(
    variables.ORIGIN_VERIFY_SECRET,
    "synthetic-origin-lock-value-long-enough",
  );
});

test("server role grants only prefix-scoped GetParameter plus SSM-bound KMS decrypt", () => {
  const template = synthFrontendTemplate();
  const policies = resourcesOfType(template, "AWS::IAM::Policy");
  const statements = policies.flatMap((policy) => {
    const document = policy.PolicyDocument as {
      Statement?: Array<Record<string, unknown>>;
    };
    return document.Statement ?? [];
  });

  const ssm = statements.find(({ Sid }) => Sid === "SsmConfigAccess");
  assert.ok(ssm);
  assert.deepEqual(ssm.Action, "ssm:GetParameter");
  assert.match(JSON.stringify(ssm.Resource), /parameter.*chapterflow.*dev/);

  const kms = statements.find(({ Sid }) => Sid === "KmsDecryptSsmConfig");
  assert.ok(kms);
  assert.equal(kms.Action, "kms:Decrypt");
  assert.deepEqual(kms.Resource, "*");
  assert.match(JSON.stringify(kms.Condition), /kms:ViaService/);
  assert.match(
    JSON.stringify(kms.Condition),
    /kms:EncryptionContext:PARAMETER_ARN/,
  );
  assert.match(JSON.stringify(kms.Condition), /parameter.*chapterflow.*dev/);
});

test("frontend deploy does not export runtime SSM secrets into the CDK process", () => {
  const workflow = fs.readFileSync(
    path.resolve(__dirname, "../../.github/workflows/_deploy-app.yml"),
    "utf8",
  );
  for (const name of FRONTEND_SSM_RUNTIME_SECRET_NAMES) {
    assert.doesNotMatch(
      workflow,
      new RegExp(`${name}: \\$\\{\\{ secrets\\.${name} \\}\\}`),
      name,
    );
  }
});
