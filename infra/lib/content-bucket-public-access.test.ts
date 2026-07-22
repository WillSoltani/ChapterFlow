import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, before, test } from "node:test";
import * as cdk from "aws-cdk-lib";
import { Template } from "aws-cdk-lib/assertions";
import { ChapterFlowBackendStack } from "./chapterflow-backend-stack";
import { ChapterFlowFrontendStack } from "./chapterflow-frontend-stack";
import { FRONTEND_SSM_RUNTIME_SECRET_NAMES } from "./frontend-runtime-config";

// ---------------------------------------------------------------------------
// WS6-012 PR1: covers are served from the content bucket through CloudFront via
// Origin Access Control, so the bucket can drop its AnyPrincipal public-read
// grant (BLOCK_ALL) in PR2 without breaking covers. This suite proves the
// synth-provable half of that rollout:
//   - the backend content bucket grants covers read to the CloudFront service
//     principal, conditioned on aws:SourceAccount (a NON-public statement that
//     survives restrictPublicBuckets), while (PR1) STILL keeping the transitional
//     public-read statement and the current two-flag PublicAccessBlock;
//   - the frontend distribution routes book-content/library/covers/* to an OAC
//     origin whose domain is the content bucket.
// PR2 will flip this suite to assert all four PublicAccessBlock protections and
// the absence of any AnyPrincipal statement.
// ---------------------------------------------------------------------------

type Resource = {
  Type?: string;
  Properties?: Record<string, unknown>;
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
    lambdaConcurrency: { reminder: 2, suppression: 2, preSignUp: 2 },
  });
  return Template.fromStack(stack).toJSON();
}

// The content bucket is the one with the deliberate two-flag PublicAccessBlock
// (blockPublicPolicy/restrictPublicBuckets false) — the ingest bucket is
// BLOCK_ALL (all four true). Identify it structurally rather than by an
// auto-generated logical id.
function findContentBucket(resources: Record<string, Resource>): {
  logicalId: string;
  publicAccessBlock: Record<string, boolean>;
} {
  const matches = Object.entries(resources).filter(([, r]) => {
    if (r.Type !== "AWS::S3::Bucket") return false;
    const pab = r.Properties?.PublicAccessBlockConfiguration as
      | Record<string, boolean>
      | undefined;
    return pab?.RestrictPublicBuckets === false && pab?.BlockPublicPolicy === false;
  });
  assert.equal(matches.length, 1, "exactly one two-flag content bucket");
  const [logicalId, r] = matches[0]!;
  return {
    logicalId,
    publicAccessBlock: r.Properties!
      .PublicAccessBlockConfiguration as Record<string, boolean>,
  };
}

function contentBucketPolicyStatements(
  resources: Record<string, Resource>,
  contentBucketLogicalId: string,
): Array<Record<string, unknown>> {
  const policies = Object.values(resources).filter((r) => {
    if (r.Type !== "AWS::S3::BucketPolicy") return false;
    const bucketRef = r.Properties?.Bucket as { Ref?: string } | undefined;
    return bucketRef?.Ref === contentBucketLogicalId;
  });
  assert.equal(policies.length, 1, "one bucket policy for the content bucket");
  const doc = policies[0]!.Properties!.PolicyDocument as {
    Statement: Array<Record<string, unknown>>;
  };
  return doc.Statement;
}

test("content bucket keeps the transitional two-flag PublicAccessBlock (PR1)", () => {
  const template = synthBackendTemplate();
  const resources = template.Resources as Record<string, Resource>;
  const { publicAccessBlock } = findContentBucket(resources);
  assert.deepEqual(publicAccessBlock, {
    BlockPublicAcls: true,
    BlockPublicPolicy: false,
    IgnorePublicAcls: true,
    RestrictPublicBuckets: false,
  });
});

test("content bucket policy grants covers read to cloudfront.amazonaws.com conditioned on aws:SourceAccount", () => {
  const template = synthBackendTemplate();
  const resources = template.Resources as Record<string, Resource>;
  const { logicalId } = findContentBucket(resources);
  const statements = contentBucketPolicyStatements(resources, logicalId);

  const cloudfront = statements.find(
    (s) => s.Sid === "CloudFrontReadLibraryCovers",
  );
  assert.ok(cloudfront, "CloudFrontReadLibraryCovers statement present");
  assert.equal(cloudfront!.Effect, "Allow");
  assert.equal(cloudfront!.Action, "s3:GetObject");
  assert.deepEqual(cloudfront!.Principal, {
    Service: "cloudfront.amazonaws.com",
  });
  assert.deepEqual(cloudfront!.Condition, {
    StringEquals: { "aws:SourceAccount": { Ref: "AWS::AccountId" } },
  });
  // Scoped to the covers key prefix only.
  assert.match(JSON.stringify(cloudfront!.Resource), /book-content\/library\/covers\/\*/);

  // PR1 still carries the transitional public-read statement (removed in PR2).
  const publicRead = statements.find((s) => s.Sid === "PublicReadLibraryCovers");
  assert.ok(publicRead, "transitional PublicReadLibraryCovers statement present in PR1");
  assert.deepEqual(publicRead!.Principal, { AWS: "*" });
});

// --- Frontend distribution: OAC origin on the content bucket -----------------

let openNextFixture = "";

before(() => {
  openNextFixture = fs.mkdtempSync(path.join(os.tmpdir(), "chapterflow-open-next-covers-"));
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
      ...FRONTEND_SSM_RUNTIME_SECRET_NAMES.map((name) => [name, "synthetic"]),
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

test("distribution routes book-content/library/covers/* to an OAC origin on the content bucket", () => {
  const template = synthFrontendTemplate();
  const resources = template.Resources as Record<string, Resource>;
  const distribution = Object.values(resources).find(
    (r) => r.Type === "AWS::CloudFront::Distribution",
  );
  assert.ok(distribution, "distribution present");
  const config = distribution!.Properties!.DistributionConfig as {
    CacheBehaviors: Array<{
      PathPattern: string;
      TargetOriginId: string;
      ViewerProtocolPolicy: string;
    }>;
    Origins: Array<{
      Id: string;
      DomainName: unknown;
      OriginAccessControlId?: unknown;
    }>;
  };

  const behavior = config.CacheBehaviors.find(
    (b) => b.PathPattern === "book-content/library/covers/*",
  );
  assert.ok(behavior, "covers cache behavior present");
  assert.equal(behavior!.ViewerProtocolPolicy, "redirect-to-https");

  const origin = config.Origins.find((o) => o.Id === behavior!.TargetOriginId);
  assert.ok(origin, "covers origin present");
  // OAC (not OAI) — the signed-request access-control id must be attached.
  assert.ok(origin!.OriginAccessControlId, "covers origin uses OAC");
  // Domain is the content bucket (imported by name), not the OpenNext assets bucket.
  assert.match(JSON.stringify(origin!.DomainName), /chapterflow-content-dev/);
});
