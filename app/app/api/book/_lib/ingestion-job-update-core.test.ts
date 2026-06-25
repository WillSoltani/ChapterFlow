// Regression coverage for the B8 ingestion-job clobber bug.
//
// Background: updateIngestionJob (repo.ts) used a STATIC UpdateExpression that always
// SET details/errorReportKey/bookId, defaulting each to a DynamoDB NULL when the
// caller omitted it:
//   "SET #status = :status, details = :details, errorReportKey = :errorReportKey,
//    bookId = :bookId, updatedAt = :updatedAt"
//   ":bookId": params.bookId ?? null
// The FAILED-status update in admin/ingest/run/route.ts passes NO bookId, so a job
// created/moved to RUNNING WITH a bookId had that bookId overwritten to NULL the
// instant ingestion failed — destroying the book↔job association.
//
// Fix: the SET clause is now built dynamically (buildIngestionJobUpdate). Only fields
// the caller actually supplies are written; omitted optional fields are left out of
// the expression entirely, so their stored attribute is untouched.
//
// repo.ts imports `server-only` (via aws.ts) and cannot be imported by `tsx --test`;
// this pure builder is the testable seam (the repo's documented *-core pattern).

import { test } from "node:test";
import assert from "node:assert/strict";
import { buildIngestionJobUpdate } from "./ingestion-job-update-core";

test("FAILED transition without bookId does NOT write bookId (no clobber) — the B8 fix", () => {
  // This mirrors the FAILED caller in admin/ingest/run/route.ts (status + details +
  // errorReportKey, NO bookId).
  const update = buildIngestionJobUpdate({
    status: "FAILED",
    updatedAt: "2026-06-24T00:00:00.000Z",
    details: { ok: false, message: "boom" },
    errorReportKey: "book-ingest-errors/job-1.json",
  });

  // The old code produced "... bookId = :bookId ..." with ":bookId": null. The fix
  // must omit bookId from BOTH the expression and the values map, so the previously
  // stored bookId on the item survives.
  assert.doesNotMatch(update.UpdateExpression, /bookId/);
  assert.ok(!(":bookId" in update.ExpressionAttributeValues));

  // status, updatedAt, details, errorReportKey are all written.
  assert.match(update.UpdateExpression, /#status = :status/);
  assert.match(update.UpdateExpression, /updatedAt = :updatedAt/);
  assert.match(update.UpdateExpression, /details = :details/);
  assert.match(update.UpdateExpression, /errorReportKey = :errorReportKey/);
  assert.equal(update.ExpressionAttributeNames["#status"], "status");
  assert.equal(update.ExpressionAttributeValues[":status"], "FAILED");
  assert.equal(update.ExpressionAttributeValues[":updatedAt"], "2026-06-24T00:00:00.000Z");
  assert.deepEqual(update.ExpressionAttributeValues[":details"], { ok: false, message: "boom" });
  assert.equal(
    update.ExpressionAttributeValues[":errorReportKey"],
    "book-ingest-errors/job-1.json"
  );
});

test("status-only transition writes ONLY status + updatedAt (preserves details/errorReportKey/bookId)", () => {
  const update = buildIngestionJobUpdate({
    status: "RUNNING",
    updatedAt: "2026-06-24T00:00:00.000Z",
  });
  assert.equal(update.UpdateExpression, "SET #status = :status, updatedAt = :updatedAt");
  assert.doesNotMatch(update.UpdateExpression, /details/);
  assert.doesNotMatch(update.UpdateExpression, /errorReportKey/);
  assert.doesNotMatch(update.UpdateExpression, /bookId/);
  assert.deepEqual(Object.keys(update.ExpressionAttributeValues).sort(), [":status", ":updatedAt"]);
});

test("provided bookId is written (SUCCEEDED / RUNNING paths still set the association)", () => {
  const update = buildIngestionJobUpdate({
    status: "SUCCEEDED",
    updatedAt: "2026-06-24T00:00:00.000Z",
    details: { stage: "succeeded" },
    bookId: "atomic-habits",
  });
  assert.match(update.UpdateExpression, /bookId = :bookId/);
  assert.equal(update.ExpressionAttributeValues[":bookId"], "atomic-habits");
});

test("explicit details/errorReportKey values (including falsy) are written when provided", () => {
  // `details` may legitimately be an empty object or null when the caller passes it.
  const update = buildIngestionJobUpdate({
    status: "FAILED",
    updatedAt: "2026-06-24T00:00:00.000Z",
    details: null,
    errorReportKey: "",
  });
  assert.match(update.UpdateExpression, /details = :details/);
  assert.match(update.UpdateExpression, /errorReportKey = :errorReportKey/);
  assert.equal(update.ExpressionAttributeValues[":details"], null);
  assert.equal(update.ExpressionAttributeValues[":errorReportKey"], "");
  // bookId still omitted (not provided).
  assert.doesNotMatch(update.UpdateExpression, /bookId/);
});

test("UpdateExpression is always comma-joined with no trailing/leading comma", () => {
  for (const u of [
    buildIngestionJobUpdate({ status: "RUNNING", updatedAt: "t" }),
    buildIngestionJobUpdate({ status: "FAILED", updatedAt: "t", details: {}, errorReportKey: "k" }),
    buildIngestionJobUpdate({ status: "SUCCEEDED", updatedAt: "t", details: {}, bookId: "b" }),
  ]) {
    assert.ok(u.UpdateExpression.startsWith("SET "));
    assert.doesNotMatch(u.UpdateExpression, /,\s*$/);
    assert.doesNotMatch(u.UpdateExpression, /SET\s*,/);
    assert.doesNotMatch(u.UpdateExpression, /,\s*,/);
  }
});
