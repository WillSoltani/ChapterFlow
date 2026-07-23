import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
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

// WS6-008 staged rollout (stage 1). The three ORIGINAL analytics GSIs retain
// ProjectionType.ALL so that the deployed table sees a NO-OP diff — the in-place
// projection edit (commit 693ad9908) was rejected by CloudFormation and rolled
// back. Right-sizing happens via a NEW index (plan-updatedAt-index-v2) plus
// staged deletions of the originals. See
// docs/architecture/adr-analytics-gsi-projection.md.

test("analytics original plan-updatedAt-index is deleted (WS6-008 stage 3 — readers on v2)", () => {
  const indexes = analyticsIndexesByName();
  assert.equal(
    indexes["plan-updatedAt-index"],
    undefined,
    "stage 3 removed the original index; readers query plan-updatedAt-index-v2",
  );
});

test("analytics contextKey-occurredAt-index is deleted (WS6-008 stage 2 — write-only, zero readers)", () => {
  const indexes = analyticsIndexesByName();
  assert.equal(
    indexes["contextKey-occurredAt-index"],
    undefined,
    "stage 2 removed this index; it must not reappear",
  );
});

test("analytics eventDate-eventType-index deliberately projects ALL", () => {
  const indexes = analyticsIndexesByName();
  const projection = indexes["eventDate-eventType-index"];
  assert.ok(projection, "eventDate-eventType-index must exist");
  assert.equal(projection.ProjectionType, "ALL");
  assert.equal(projection.NonKeyAttributes, undefined);
});

test("analytics plan-updatedAt-index-v2 projects INCLUDE with exactly the attributes the admin users/search reader consumes", () => {
  const indexes = analyticsIndexesByName();
  const projection = indexes["plan-updatedAt-index-v2"];
  assert.ok(projection, "plan-updatedAt-index-v2 must exist");
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

// The whole point of stage 1 is that the app readers move onto the v2 index in
// the same workflow run. Assert the reader source queries plan-updatedAt-index-v2
// and no longer names the original plan-updatedAt-index in any QueryCommand.
test("admin-metrics readers query plan-updatedAt-index-v2, not the original index", () => {
  const metricsSource = readFileSync(
    path.resolve(__dirname, "../../app/app/api/book/_lib/admin-metrics.ts"),
    "utf8",
  );
  assert.match(
    metricsSource,
    /IndexName:\s*"plan-updatedAt-index-v2"/,
    "admin-metrics.ts must query plan-updatedAt-index-v2",
  );
  assert.doesNotMatch(
    metricsSource,
    /IndexName:\s*"plan-updatedAt-index"/,
    "admin-metrics.ts must not query the original plan-updatedAt-index",
  );
});
