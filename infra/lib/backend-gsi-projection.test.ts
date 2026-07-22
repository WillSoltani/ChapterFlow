import assert from "node:assert/strict";
import { test } from "node:test";
import * as cdk from "aws-cdk-lib";
import { Template } from "aws-cdk-lib/assertions";
import { ChapterFlowBackendStack } from "./chapterflow-backend-stack";

// Synthesize the backend stack and pull the analytics table's GSI definitions
// out of the CloudFormation template so we can assert on projection shape
// (mirrors the Template.fromStack pattern in backend-table-encryption.test.ts).
function analyticsIndexesByName(): Record<
  string,
  { ProjectionType?: string; NonKeyAttributes?: string[] }
> {
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
    lambdaConcurrency: { reminder: 2, suppression: 2, preSignUp: 2 },
  });
  const template = Template.fromStack(stack).toJSON();
  const resources = template.Resources as Record<
    string,
    { Type?: string; Properties?: Record<string, unknown> }
  >;
  const analytics = resources["ChapterFlowAnalyticsTable426A402C"];
  assert.equal(analytics?.Type, "AWS::DynamoDB::Table");
  const gsis = analytics.Properties?.GlobalSecondaryIndexes as Array<{
    IndexName: string;
    Projection: { ProjectionType?: string; NonKeyAttributes?: string[] };
  }>;
  const byName: Record<
    string,
    { ProjectionType?: string; NonKeyAttributes?: string[] }
  > = {};
  for (const gsi of gsis) byName[gsi.IndexName] = gsi.Projection;
  return byName;
}

test("analytics contextKey-occurredAt-index projects KEYS_ONLY", () => {
  const indexes = analyticsIndexesByName();
  const projection = indexes["contextKey-occurredAt-index"];
  assert.ok(projection, "contextKey-occurredAt-index must exist");
  assert.equal(projection.ProjectionType, "KEYS_ONLY");
  assert.equal(projection.NonKeyAttributes, undefined);
});

test("analytics plan-updatedAt-index projects INCLUDE with exactly the attributes the admin users/search reader consumes", () => {
  const indexes = analyticsIndexesByName();
  const projection = indexes["plan-updatedAt-index"];
  assert.ok(projection, "plan-updatedAt-index must exist");
  assert.equal(projection.ProjectionType, "INCLUDE");
  // The exact non-key attribute union read by formatUser + readTime in
  // app/app/api/book/admin/users/search/route.ts. plan/updatedAt (index keys)
  // and PK/SK (table keys) are auto-projected and MUST NOT be listed here.
  const expected = [
    "badgeCount",
    "booksCompleted",
    "email",
    "firstSeenAt",
    "flowPoints",
    "lastActiveAt",
    "onboardingCompletedAt",
    "proSource",
    "proStatus",
    "totalQuizAttempts",
    "totalQuizPasses",
    "totalReadingMs",
    "userId",
  ];
  assert.deepEqual(
    [...(projection.NonKeyAttributes ?? [])].sort(),
    expected,
  );
});

test("analytics eventDate-eventType-index deliberately projects ALL", () => {
  const indexes = analyticsIndexesByName();
  const projection = indexes["eventDate-eventType-index"];
  assert.ok(projection, "eventDate-eventType-index must exist");
  assert.equal(projection.ProjectionType, "ALL");
  assert.equal(projection.NonKeyAttributes, undefined);
});
