/**
 * Per-submission reviewer-session independence. These guard the PRIMITIVES that every
 * pairwise enforcement (keyA≠keyB, bar≠confirm, bar≠tiebreak, reviewer≠author) is built on:
 * the collision predicates are opt-in (CHAPTERFLOW_ENFORCE_SESSION_INDEPENDENCE) and
 * absence-safe (an unset id never blocks), and qc-submit captures the env session id onto the
 * validated submission so the enforcement has real evidence to compare. The keyA/keyB and
 * finalize wiring that consumes these is exercised in manual-keyjudge.test.ts / finalize tests.
 */

import assert from "node:assert/strict";

import { test } from "./harness.js";
import { sessionsCollide, sessionsCollideAmong } from "../src/qc/sessionProvenance.js";
import { validateSubmission } from "../src/qc/orchestrator/schemas.js";
import { AXIS_WEIGHTS } from "../src/critics/semantic/publishableBar.js";

function withEnforce(on: boolean, fn: () => void): void {
  const prev = process.env.CHAPTERFLOW_ENFORCE_SESSION_INDEPENDENCE;
  try {
    if (on) process.env.CHAPTERFLOW_ENFORCE_SESSION_INDEPENDENCE = "1";
    else delete process.env.CHAPTERFLOW_ENFORCE_SESSION_INDEPENDENCE;
    fn();
  } finally {
    if (prev === undefined) delete process.env.CHAPTERFLOW_ENFORCE_SESSION_INDEPENDENCE;
    else process.env.CHAPTERFLOW_ENFORCE_SESSION_INDEPENDENCE = prev;
  }
}

test("sessionsCollide is opt-in and absence-safe", () => {
  withEnforce(false, () => {
    assert.equal(sessionsCollide("s", "s"), false, "off by default even when equal");
  });
  withEnforce(true, () => {
    assert.equal(sessionsCollide("s", "s"), true, "equal + enforced ⇒ collide");
    assert.equal(sessionsCollide("a", "b"), false, "distinct ⇒ no collide");
    assert.equal(sessionsCollide(undefined, "s"), false, "absent author ⇒ no collide");
    assert.equal(sessionsCollide("s", undefined), false, "absent reviewer ⇒ no collide");
  });
});

test("sessionsCollideAmong flags any two present ids that match (gated)", () => {
  withEnforce(true, () => {
    assert.equal(sessionsCollideAmong(["a", "b", "a"]), true, "a duplicate among the present ids");
    assert.equal(sessionsCollideAmong(["a", "b", "c"]), false, "all distinct");
    assert.equal(sessionsCollideAmong(["a", undefined, undefined]), false, "undefined never pairs with undefined");
    assert.equal(sessionsCollideAmong([]), false);
  });
  withEnforce(false, () => assert.equal(sessionsCollideAmong(["a", "a"]), false, "off by default"));
});

function greenAxes(): any[] {
  return Object.keys(AXIS_WEIGHTS).map((axis) => ({ axis, score: 0.9, tier: "PUBLISHABLE", hits: [] }));
}

test("validateSubmission carries reviewerSessionId through to the validated submission; absence ⇒ undefined", () => {
  const base = {
    schemaVersion: "qc-bar-read-v1", bookId: "zz", roundId: "r", role: "bar",
    reviewer: "codex-qc:t", chapterNumber: 1, chapterId: "zz-ch01", contentHash: "h", axes: greenAxes(),
  };
  const withId = validateSubmission("zz", "r", "bar", { ...base, reviewerSessionId: "qc-bar-ch01-x" });
  assert.equal(withId.ok, true, (withId as any).errors?.join("\n"));
  assert.equal((withId as any).submission.reviewerSessionId, "qc-bar-ch01-x");

  const noId = validateSubmission("zz", "r", "bar", base);
  assert.equal(noId.ok, true);
  assert.equal((noId as any).submission.reviewerSessionId, undefined, "absent ⇒ undefined, never blocks validation");
});
