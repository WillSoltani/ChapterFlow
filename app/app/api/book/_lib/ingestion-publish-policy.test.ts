import { test } from "node:test";
import assert from "node:assert/strict";
import { shouldPublishReusedVersion } from "./ingestion-publish-policy";

// Regression: a draft→publish re-ingest (existing version found by packageId,
// re-run with publishNow=true) must actually publish the reused version. Before
// the fix the reuse branch ignored publishNow and silently no-op'd, leaving the
// book DRAFT while the job reported SUCCEEDED + published:true.
test("publishNow=true on a DRAFT reused version publishes it (the regression)", () => {
  assert.equal(shouldPublishReusedVersion(true, "DRAFT"), true);
});

test("publishNow=true on an ARCHIVED reused version publishes it", () => {
  assert.equal(shouldPublishReusedVersion(true, "ARCHIVED"), true);
});

test("publishNow=true on an already-PUBLISHED reused version skips the redundant re-publish", () => {
  assert.equal(shouldPublishReusedVersion(true, "PUBLISHED"), false);
});

test("publishNow=false keeps a reused DRAFT version as a draft", () => {
  assert.equal(shouldPublishReusedVersion(false, "DRAFT"), false);
});

test("publishNow=false never republishes (PUBLISHED/ARCHIVED stay untouched)", () => {
  assert.equal(shouldPublishReusedVersion(false, "PUBLISHED"), false);
  assert.equal(shouldPublishReusedVersion(false, "ARCHIVED"), false);
});
