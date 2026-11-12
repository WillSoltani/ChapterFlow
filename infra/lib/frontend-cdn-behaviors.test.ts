import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import * as cdk from "aws-cdk-lib";
import { Template } from "aws-cdk-lib/assertions";
import { ChapterFlowFrontendStack } from "./chapterflow-frontend-stack";
import { FRONTEND_SSM_RUNTIME_SECRET_NAMES } from "./frontend-runtime-config";

// Production returned 403 AccessDenied (from S3) for /robots.txt, /sitemap.xml
// and /icon.svg: single-file CloudFront behaviors sent them to the assets
// bucket, but the Next server generates those files and OpenNext never uploads
// them. Only files OpenNext uploads (favicon.ico, BUILD_ID) may have such a
// behavior; every generated metadata route must reach the server function.

let fixture = "";

before(() => {
  fixture = fs.mkdtempSync(path.join(os.tmpdir(), "chapterflow-open-next-cdn-"));
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
    const directory = path.join(fixture, relative);
    fs.mkdirSync(directory, { recursive: true });
    fs.writeFileSync(path.join(directory, "fixture.txt"), "nonsecret fixture\n");
  }
});

after(() => {
  fs.rmSync(fixture, { recursive: true, force: true });
});

function pathPatterns(): string[] {
  const app = new cdk.App();
  const stack = new ChapterFlowFrontendStack(app, "ChapterFlowFrontend-cdn", {
    env: { account: "123456789012", region: "us-east-1" },
    envName: "staging",
    resourceSuffix: "-staging",
    appTableName: "ChapterFlowApp-staging",
    analyticsTableName: "ChapterFlowInsights-staging",
    ingestBucketName: "chapterflow-ingest-staging",
    contentBucketName: "chapterflow-content-staging",
    ssmPrefix: "/chapterflow/staging",
    openNextDir: fixture,
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
  const distributions = Template.fromStack(stack).findResources(
    "AWS::CloudFront::Distribution",
  );
  const [distribution] = Object.values(distributions);
  const behaviors: Array<{ PathPattern: string }> =
    distribution.Properties.DistributionConfig.CacheBehaviors ?? [];
  return behaviors.map((behavior) => behavior.PathPattern);
}

// Public path of a Next metadata route file in app/, or null if it is not one.
function publicPathFor(file: string): string | null {
  const name = file.replace(/\.[^.]+$/, "");
  const ext = path.extname(file);
  if (name === "robots") return "robots.txt";
  if (name === "sitemap") return "sitemap.xml";
  if (name === "manifest") return "manifest.webmanifest";
  if (["icon", "apple-icon", "opengraph-image", "twitter-image"].includes(name)) {
    // Static image files keep their name; code routes (.ts/.tsx) serve the stem.
    return [".ts", ".tsx", ".js", ".jsx"].includes(ext) ? name : file;
  }
  return null;
}

test("generated metadata routes have no CloudFront behavior pointing at S3", () => {
  const patterns = pathPatterns();
  for (const forbidden of ["robots.txt", "sitemap.xml", "icon.svg"]) {
    assert.ok(!patterns.includes(forbidden), `${forbidden} must reach the server`);
  }

  const appDir = path.join(__dirname, "..", "..", "app");
  const metadataFiles = fs
    .readdirSync(appDir, { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .filter((file) => file !== "favicon.ico");
  for (const file of metadataFiles) {
    const served = publicPathFor(file);
    if (served) {
      assert.ok(!patterns.includes(served), `${served} (from app/${file}) must reach the server`);
    }
  }
});

test("asset behaviors that must stay are still present", () => {
  const patterns = pathPatterns();
  for (const required of [
    "_next/static/*",
    "favicon.ico",
    "BUILD_ID",
    "fonts/*",
    "book-covers/*",
    "films/*",
  ]) {
    assert.ok(patterns.includes(required), `missing behavior ${required}`);
  }
});
