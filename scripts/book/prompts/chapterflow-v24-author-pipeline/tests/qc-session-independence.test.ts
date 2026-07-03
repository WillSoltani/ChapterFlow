/**
 * Per-submission reviewer-session independence. These guard the PRIMITIVES that every
 * pairwise enforcement (keyA≠keyB, bar≠confirm, bar≠tiebreak, reviewer≠author) is built on:
 * low-level collision predicates are opt-in/absence-safe, while certification policy classifies
 * missing ids as legacy/unknown and non-certifying. qc-submit captures the env session id onto
 * the validated submission so the enforcement has real evidence to compare.
 */

import assert from "node:assert/strict";

import { test } from "./harness.js";
import { certificationSessionFailures, sessionsCollide, sessionsCollideAmong } from "../src/qc/sessionProvenance.js";
import { validateSubmission } from "../src/qc/orchestrator/schemas.js";
import { AXIS_WEIGHTS } from "../src/critics/semantic/publishableBar.js";

function withEnforce(on: boolean, fn: () => void): void {
  const prev = process.env.CHAPTERFLOW_ENFORCE_SESSION_INDEPENDENCE;
  const prevNoApi = process.env.CHAPTERFLOW_NO_API_CODEX_QC;
  try {
    if (on) process.env.CHAPTERFLOW_ENFORCE_SESSION_INDEPENDENCE = "1";
    else delete process.env.CHAPTERFLOW_ENFORCE_SESSION_INDEPENDENCE;
    if (!on) delete process.env.CHAPTERFLOW_NO_API_CODEX_QC;
    fn();
  } finally {
    if (prev === undefined) delete process.env.CHAPTERFLOW_ENFORCE_SESSION_INDEPENDENCE;
    else process.env.CHAPTERFLOW_ENFORCE_SESSION_INDEPENDENCE = prev;
    if (prevNoApi === undefined) delete process.env.CHAPTERFLOW_NO_API_CODEX_QC;
    else process.env.CHAPTERFLOW_NO_API_CODEX_QC = prevNoApi;
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

test("certificationSessionFailures classifies legacy/unknown provenance as non-certifying", () => {
  withEnforce(true, () => {
    const failures = certificationSessionFailures({
      chapterId: "zz-ch01",
      bookRound: "zz/r1",
      authorSessionId: undefined,
      sweepSessionId: "sweep",
      barSessionId: "bar",
      confirmSessionId: "confirm",
    });
    assert.ok(failures.some((failure) => failure.code === "missing_author"));
    assert.match(failures[0].message, /legacy\/unknown/);
  });
});

test("certificationSessionFailures blocks required session collisions", () => {
  withEnforce(true, () => {
    const base = {
      chapterId: "zz-ch01",
      bookRound: "zz/r1",
      authorSessionId: "author",
      sweepSessionId: "sweep",
      barSessionId: "bar",
      confirmSessionId: "confirm",
      barReadSessionIds: ["bar", "bar-t2", "bar-t3"],
    };
    assert.deepEqual(certificationSessionFailures(base), []);
    assert.ok(certificationSessionFailures({ ...base, barSessionId: "author" }).some((f) => f.code === "author_bar_collision"));
    assert.ok(certificationSessionFailures({ ...base, confirmSessionId: "author" }).some((f) => f.code === "author_confirm_collision"));
    assert.ok(certificationSessionFailures({ ...base, sweepSessionId: "author" }).some((f) => f.code === "author_sweep_collision"));
    assert.ok(certificationSessionFailures({ ...base, confirmSessionId: "bar" }).some((f) => f.code === "bar_confirm_collision"));
    assert.ok(certificationSessionFailures({ ...base, sweepSessionId: "bar" }).some((f) => f.code === "sweep_bar_collision"));
    assert.ok(certificationSessionFailures({ ...base, barReadSessionIds: ["bar", "bar-t2", "bar-t2"] }).some((f) => f.code === "bar_tiebreak_collision"));
  });
});

test("validateSubmission can require reviewerSessionId for fresh new-schema submissions", () => {
  const base = {
    schemaVersion: "qc-bar-read-v1", bookId: "zz", roundId: "r", role: "bar",
    reviewer: "codex-qc:t", chapterNumber: 1, chapterId: "zz-ch01", contentHash: "h", axes: greenAxes(),
  };
  const missing = validateSubmission("zz", "r", "bar", base, { requireReviewerSessionId: true });
  assert.equal(missing.ok, false);
  assert.match((missing as any).errors.join("\n"), /reviewerSessionId is required/);

  const present = validateSubmission("zz", "r", "bar", { ...base, reviewerSessionId: "bar-session" }, { requireReviewerSessionId: true });
  assert.equal(present.ok, true, (present as any).errors?.join("\n"));
});
