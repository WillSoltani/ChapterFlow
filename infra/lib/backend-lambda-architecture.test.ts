import assert from "node:assert/strict";
import { test } from "node:test";
import * as cdk from "aws-cdk-lib";
import { Template } from "aws-cdk-lib/assertions";
import { ChapterFlowBackendStack } from "./chapterflow-backend-stack";

const devLambdaConcurrency = {
  reminder: 2,
  suppression: 2,
  preSignUp: 2,
};

function synthBackendTemplate(): Record<string, unknown> {
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
    // Required so preSignUpFn (guarded by `if (props.cognitoUserPoolId)`)
    // actually instantiates and can be asserted below.
    cognitoUserPoolId: "us-east-1_TestPool123",
    lambdaConcurrency: devLambdaConcurrency,
  });
  return Template.fromStack(stack).toJSON();
}

test("backend crons synthesize arm64 architecture", () => {
  const template = synthBackendTemplate();
  const resources = template.Resources as Record<
    string,
    { Type?: string; Properties?: Record<string, unknown> }
  >;

  // Filter by FunctionName prefix, NOT resource count — logRetention
  // synthesizes an extra LogRetention helper Lambda (CDK custom resource)
  // that must stay unasserted here.
  const trackedPrefixes = [
    "ChapterFlowReadingReminder",
    "ChapterFlowSuppressionHandler",
    "ChapterFlowCognitoPreSignUp",
  ];

  const matched = new Map<string, Record<string, unknown>>();
  for (const { Type, Properties } of Object.values(resources)) {
    if (Type !== "AWS::Lambda::Function" || !Properties) continue;
    const functionName = Properties.FunctionName;
    if (typeof functionName !== "string") continue;
    if (trackedPrefixes.some((prefix) => functionName.startsWith(prefix))) {
      matched.set(functionName, Properties);
    }
  }

  // Sanity: all three tracked crons must actually have synthesized —
  // otherwise this test would silently pass on zero assertions.
  assert.equal(
    matched.size,
    trackedPrefixes.length,
    `expected ${trackedPrefixes.length} tracked cron functions, found: ${[...matched.keys()].join(", ")}`,
  );

  for (const [functionName, properties] of matched) {
    assert.deepEqual(
      properties.Architectures,
      ["arm64"],
      `${functionName} should synthesize arm64 architecture`,
    );
  }
});
