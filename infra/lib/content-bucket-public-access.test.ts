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
// WS6-012 PR2: the content bucket is now BLOCK_ALL and serves covers only
// through CloudFront via Origin Access Control. The former transitional
// AnyPrincipal public-read statement (PublicReadLibraryCovers) has been removed.
// This suite proves the synth-provable half of that end state:
//   - the backend content bucket has all four PublicAccessBlock protections
//     enabled and carries NO public-read (AnyPrincipal Allow) statement — the
//     only AnyPrincipal statement left is the enforceSSL Deny;
//   - it still grants covers read to the CloudFront service principal,
//     conditioned on aws:SourceAccount (a NON-public statement that survives
//     restrictPublicBuckets);
//   - the frontend distribution routes book-content/library/covers/* to an OAC
//     origin whose domain is the content bucket.
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

// Both buckets are now BLOCK_ALL, so the content bucket can no longer be told
// apart by a two-flag PublicAccessBlock. Identify it by its bucket policy: the
// content bucket is the only one carrying the CloudFrontReadLibraryCovers
// covers-read statement.
function findContentBucket(resources: Record<string, Resource>): {
  logicalId: string;
  publicAccessBlock: Record<string, boolean>;
  statements: Array<Record<string, unknown>>;
} {
  const policies = Object.values(resources).filter((r) => {
    if (r.Type !== "AWS::S3::BucketPolicy") return false;
    const doc = r.Properties?.PolicyDocument as
      | { Statement?: Array<Record<string, unknown>> }
      | undefined;
    return (doc?.Statement ?? []).some((s) => s.Sid === "CloudFrontReadLibraryCovers");
  });
  assert.equal(
    policies.length,
    1,
    "exactly one content-bucket policy carrying the covers-read statement",
  );
  const bucketRef = policies[0]!.Properties!.Bucket as { Ref?: string };
  const logicalId = bucketRef.Ref!;
  const bucket = resources[logicalId];
  assert.ok(bucket && bucket.Type === "AWS::S3::Bucket", "content bucket resource present");
  const statements = (policies[0]!.Properties!.PolicyDocument as {
    Statement: Array<Record<string, unknown>>;
  }).Statement;
  return {
    logicalId,
    publicAccessBlock: bucket!.Properties!
      .PublicAccessBlockConfiguration as Record<string, boolean>,
    statements,
  };
}

// True iff a statement's Principal grants to anyone (Principal "*" or a keyed
// principal whose value is or contains "*"). Used to prove no *public grant*
// remains — the enforceSSL Deny is AnyPrincipal too, so callers must scope by
// Effect.
function isAnyPrincipal(statement: Record<string, unknown>): boolean {
  const principal = statement.Principal;
  if (principal === "*") return true;
  if (principal && typeof principal === "object") {
    return Object.values(principal as Record<string, unknown>).some(
      (value) => value === "*" || (Array.isArray(value) && value.includes("*")),
    );
  }
  return false;
}

test("content bucket is BLOCK_ALL with no public-read statement (PR2)", () => {
  const template = synthBackendTemplate();
  const resources = template.Resources as Record<string, Resource>;
  const { publicAccessBlock, statements } = findContentBucket(resources);

  assert.deepEqual(publicAccessBlock, {
    BlockPublicAcls: true,
    BlockPublicPolicy: true,
    IgnorePublicAcls: true,
    RestrictPublicBuckets: true,
  });

  // No public GRANT survives: the only AnyPrincipal statement allowed is the
  // enforceSSL Deny. Any AnyPrincipal Allow would be a public-read exposure.
  const anyPrincipalAllow = statements.filter(
    (s) => s.Effect === "Allow" && isAnyPrincipal(s),
  );
  assert.deepEqual(
    anyPrincipalAllow,
    [],
    "no AnyPrincipal (public-read) Allow statement on the content bucket policy",
  );
  // The transitional public-read statement is gone entirely.
  assert.equal(
    statements.some((s) => s.Sid === "PublicReadLibraryCovers"),
    false,
    "transitional PublicReadLibraryCovers statement removed in PR2",
  );
});

test("content bucket policy grants covers read to cloudfront.amazonaws.com conditioned on aws:SourceAccount", () => {
  const template = synthBackendTemplate();
  const resources = template.Resources as Record<string, Resource>;
  const { statements } = findContentBucket(resources);

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
