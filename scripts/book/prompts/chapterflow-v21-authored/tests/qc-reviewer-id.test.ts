import assert from "node:assert/strict";

import { test } from "./harness.js";
import { qcReviewerId } from "../src/qc/reviewerId.js";
import { isApprovedReviewer } from "../src/critics/qcAttestation.js";

const ROUND = "r20260615123456-abc123";

test("qcReviewerId is deterministic and stays an approved reviewer role", () => {
  assert.equal(qcReviewerId(ROUND, "bar", 7), qcReviewerId(ROUND, "bar", 7), "pure function of inputs");
  assert.equal(qcReviewerId(ROUND, "bar", 7), `codex-qc:${ROUND}:bar:ch07`);
  assert.equal(qcReviewerId(ROUND, "sweep"), `codex-qc:${ROUND}:sweep`, "no chapter suffix when omitted");
  // The prefix before the first ':' is what isApprovedReviewer inspects.
  for (const id of [qcReviewerId(ROUND, "bar", 1), qcReviewerId(ROUND, "confirm", 13), qcReviewerId(ROUND, "sweep"), qcReviewerId(ROUND, "keyA")]) {
    assert.ok(isApprovedReviewer(id), `reviewer "${id}" must remain approved`);
  }
});

test("bar and confirm reviewers for the same chapter differ by construction", () => {
  for (const ch of [1, 7, 13]) {
    assert.notEqual(
      qcReviewerId(ROUND, "bar", ch),
      qcReviewerId(ROUND, "confirm", ch),
      `bar(ch${ch}) must differ from confirm(ch${ch}) so sameReviewerConfirm cannot spuriously fire`,
    );
  }
  // Distinct per chapter so two bar subagents never collide on reviewer label.
  assert.notEqual(qcReviewerId(ROUND, "bar", 1), qcReviewerId(ROUND, "bar", 2));
});
