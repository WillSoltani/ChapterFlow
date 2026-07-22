import assert from "node:assert/strict";
import { test } from "node:test";
import * as cdk from "aws-cdk-lib";
import { Template } from "aws-cdk-lib/assertions";
import { ChapterFlowBackendStack } from "./chapterflow-backend-stack";

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
  });
  return Template.fromStack(stack).toJSON();
}

test("the two durable application tables explicitly synthesize AWS-managed KMS encryption", () => {
  const template = synthBackendTemplate();
  const resources = template.Resources as Record<
    string,
    {
      Type?: string;
      Properties?: Record<string, unknown>;
      DeletionPolicy?: string;
      UpdateReplacePolicy?: string;
    }
  >;
  const expectedTables = [
    {
      logicalId: "ChapterFlowAppTableD8C894A5",
      tableName: "ChapterFlowApp-dev",
      indexes: ["quiz-scope-createdAt-index"],
    },
    {
      logicalId: "ChapterFlowAnalyticsTable426A402C",
      tableName: "ChapterFlowInsights-dev",
      indexes: [
        "eventDate-eventType-index",
        "plan-updatedAt-index",
        "contextKey-occurredAt-index",
      ],
    },
  ];

  for (const { logicalId, tableName, indexes } of expectedTables) {
    const resource = resources[logicalId];
    assert.equal(resource?.Type, "AWS::DynamoDB::Table", logicalId);
    assert.deepEqual(resource.Properties?.SSESpecification, {
      SSEEnabled: true,
    });
    assert.equal(resource.Properties?.TableName, tableName);
    assert.equal(resource.Properties?.BillingMode, "PAY_PER_REQUEST");
    assert.equal(resource.Properties?.DeletionProtectionEnabled, false);
    assert.deepEqual(resource.Properties?.PointInTimeRecoverySpecification, {
      PointInTimeRecoveryEnabled: false,
    });
    assert.deepEqual(resource.Properties?.TimeToLiveSpecification, {
      AttributeName: "ttl",
      Enabled: true,
    });
    assert.deepEqual(resource.Properties?.KeySchema, [
      { AttributeName: "PK", KeyType: "HASH" },
      { AttributeName: "SK", KeyType: "RANGE" },
    ]);
    assert.deepEqual(
      (resource.Properties?.GlobalSecondaryIndexes as Array<{
        IndexName: string;
      }>).map(({ IndexName }) => IndexName),
      indexes,
    );
    assert.equal(resource.DeletionPolicy, "Delete");
    assert.equal(resource.UpdateReplacePolicy, "Delete");
  }

  const dynamodbTableIds = Object.entries(resources)
    .filter(([, { Type }]) => Type === "AWS::DynamoDB::Table")
    .map(([logicalId]) => logicalId)
    .sort();
  assert.deepEqual(
    dynamodbTableIds,
    expectedTables.map(({ logicalId }) => logicalId).sort(),
  );
});
