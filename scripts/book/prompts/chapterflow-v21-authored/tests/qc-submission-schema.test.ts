import assert from "node:assert/strict";

import { test } from "./harness.js";
import { AXIS_WEIGHTS } from "../src/critics/semantic/publishableBar.js";
import { findingsFromSubmission, validateSubmission } from "../src/qc/orchestrator/schemas.js";

const BOOK = "zz-fixture-schema";
const ROUND = "r-schema";

function greenAxes(): any[] {
  return Object.keys(AXIS_WEIGHTS).map((axis) => ({ axis, score: 0.9, tier: "PUBLISHABLE", hits: [] }));
}

test("qc-bar-read-v1 requires every publishableBar axis", () => {
  const axes = greenAxes().filter((a) => a.axis !== "factual_accuracy");
  const result = validateSubmission(BOOK, ROUND, "bar", {
    schemaVersion: "qc-bar-read-v1",
    bookId: BOOK,
    roundId: ROUND,
    role: "bar",
    reviewer: "codex-qc:schema-test",
    chapterNumber: 1,
    chapterId: `${BOOK}-ch01`,
    contentHash: "abc123",
    axes,
  });
  assert.equal(result.ok, false);
  assert.match((result as any).errors.join("\n"), /missing axis factual_accuracy/);
});

test("qc-key-derive-v2 requires confidence, source facts, and reason length", () => {
  const result = validateSubmission(BOOK, ROUND, "keyA", {
    schemaVersion: "qc-key-derive-v2",
    bookId: BOOK,
    roundId: ROUND,
    role: "keyA",
    chapters: [{
      chapterNumber: 1,
      packHash: "pack",
      answers: [{
        questionIndex: 0,
        choiceIndex: 1,
        confidence: "high",
        reason: "short",
        sourceFactIds: [],
      }],
    }],
  });
  assert.equal(result.ok, false);
  const errors = (result as any).errors.join("\n");
  assert.match(errors, /reason must be at least 40/);
  assert.match(errors, /sourceFactIds/);
});

test("qc-key-derive-v2 rejects an unfilled choiceIndex:null instead of coercing it to 0", () => {
  // The review-packet skeleton seeds choiceIndex:null; Number(null)===0 used to
  // pass validation as a silent answer index 0 (a wrong-key-catch hole). An
  // unfilled index must FAIL, not mean 0.
  const result = validateSubmission(BOOK, ROUND, "keyA", {
    schemaVersion: "qc-key-derive-v2",
    bookId: BOOK,
    roundId: ROUND,
    role: "keyA",
    chapters: [{
      chapterNumber: 1,
      packHash: "pack",
      answers: [{
        questionIndex: 0,
        choiceIndex: null,
        confidence: "high",
        reason: "A forty-plus character derivation reason long enough to pass the reason length check.",
        sourceFactIds: ["f1"],
      }],
    }],
  });
  assert.equal(result.ok, false);
  assert.match((result as any).errors.join("\n"), /choiceIndex must be a non-negative integer/);
});

test("qc-sweep-submission-v1 PASS requires all checked families", () => {
  const result = validateSubmission(BOOK, ROUND, "sweep", {
    schemaVersion: "qc-sweep-submission-v1",
    bookId: BOOK,
    roundId: ROUND,
    role: "sweep",
    reviewer: "codex-qc:sweep",
    verdict: "PASS",
    checkedFamilies: ["scene_skeleton", "persona_drift"],
    findings: [],
  });
  assert.equal(result.ok, false);
  assert.match((result as any).errors.join("\n"), /location_stamping/);
});

test("qc-sweep-submission-v1 PASS rejects blocker findings", () => {
  const result = validateSubmission(BOOK, ROUND, "sweep", {
    schemaVersion: "qc-sweep-submission-v1",
    bookId: BOOK,
    roundId: ROUND,
    role: "sweep",
    reviewer: "codex-qc:sweep",
    verdict: "PASS",
    checkedFamilies: ["scene_skeleton", "persona_drift", "repeated_unit", "location_stamping"],
    findings: [{
      family: "scene_skeleton",
      chapters: [1, 2],
      unitId: "examples",
      severity: "blocker",
      quote: "same quoted frame",
      problem: "Repeated scene skeleton.",
      expectedFix: "Vary the scene structures.",
    }],
  });
  assert.equal(result.ok, false);
  assert.match((result as any).errors.join("\n"), /PASS sweep submission may include advisory observations only/);
});

test("qc-sweep-submission-v1 REVISE requires a finding", () => {
  const result = validateSubmission(BOOK, ROUND, "sweep", {
    schemaVersion: "qc-sweep-submission-v1",
    bookId: BOOK,
    roundId: ROUND,
    role: "sweep",
    reviewer: "codex-qc:sweep",
    verdict: "REVISE",
    checkedFamilies: ["scene_skeleton", "persona_drift", "repeated_unit", "location_stamping"],
    findings: [],
  });
  assert.equal(result.ok, false);
  assert.match((result as any).errors.join("\n"), /REVISE sweep submission requires/);
});

test("qc-sweep-submission-v1 findings require family and affected chapters", () => {
  const result = validateSubmission(BOOK, ROUND, "sweep", {
    schemaVersion: "qc-sweep-submission-v1",
    bookId: BOOK,
    roundId: ROUND,
    role: "sweep",
    reviewer: "codex-qc:sweep",
    verdict: "REVISE",
    checkedFamilies: ["scene_skeleton", "persona_drift", "repeated_unit", "location_stamping"],
    findings: [{
      unitId: "examples",
      quote: "same quoted frame",
      problem: "Repeated scene skeleton.",
      expectedFix: "Vary the scene structures.",
    }],
  });
  assert.equal(result.ok, false);
  const errors = (result as any).errors.join("\n");
  assert.match(errors, /family must be one of/);
  assert.match(errors, /chapters must list affected chapters/);
});

test("qc-bar-read-v2 requires non-key axes but excludes quiz_key_correctness", () => {
  const axes = greenAxes().filter((a) => a.axis !== "quiz_key_correctness");
  const ok = validateSubmission(BOOK, ROUND, "bar", {
    schemaVersion: "qc-bar-read-v2",
    bookId: BOOK,
    roundId: ROUND,
    role: "bar",
    reviewer: "codex-qc:bar",
    chapterNumber: 1,
    chapterId: `${BOOK}-ch01`,
    contentHash: "abc123",
    axes,
  });
  assert.equal(ok.ok, true, (ok as any).errors?.join("\n"));

  const withKey = validateSubmission(BOOK, ROUND, "bar", {
    schemaVersion: "qc-bar-read-v2",
    bookId: BOOK,
    roundId: ROUND,
    role: "bar",
    reviewer: "codex-qc:bar",
    chapterNumber: 1,
    chapterId: `${BOOK}-ch01`,
    contentHash: "abc123",
    axes: greenAxes(),
  });
  assert.equal(withKey.ok, false);
  assert.match((withKey as any).errors.join("\n"), /must not include quiz_key_correctness/);
});

test("qc-bar-read-v2 missing non-key axis fails", () => {
  const axes = greenAxes().filter((a) => a.axis !== "quiz_key_correctness" && a.axis !== "factual_accuracy");
  const result = validateSubmission(BOOK, ROUND, "bar", {
    schemaVersion: "qc-bar-read-v2",
    bookId: BOOK,
    roundId: ROUND,
    role: "bar",
    reviewer: "codex-qc:bar",
    chapterNumber: 1,
    chapterId: `${BOOK}-ch01`,
    contentHash: "abc123",
    axes,
  });
  assert.equal(result.ok, false);
  assert.match((result as any).errors.join("\n"), /missing axis factual_accuracy/);
});

test("qc-bar-read-v2 axis hits become repair findings", () => {
  const axes = greenAxes().filter((a) => a.axis !== "quiz_key_correctness");
  const example = axes.find((a) => a.axis === "example_coherence");
  example.score = 0.4;
  example.tier = "GENERATED_DRAFT";
  example.hits = [{ unitId: "examples[0]", quote: "planning-note scene", defect: "Scene is not reader-facing." }];
  const result = validateSubmission(BOOK, ROUND, "bar", {
    schemaVersion: "qc-bar-read-v2",
    bookId: BOOK,
    roundId: ROUND,
    role: "bar",
    reviewer: "codex-qc:bar",
    chapterNumber: 1,
    chapterId: `${BOOK}-ch01`,
    contentHash: "abc123",
    notes: "Example slate is below the publishable floor.",
    axes,
  });
  assert.equal(result.ok, true, (result as any).errors?.join("\n"));
  const findings = findingsFromSubmission((result as any).submission);
  assert.equal(findings.length, 1);
  assert.equal(findings[0].repairClass, "example_coherence");
  assert.equal(findings[0].chapterNumber, 1);
});

test("qc-bar-read-v2 sub-floor axes require cited hits", () => {
  const axes = greenAxes().filter((a) => a.axis !== "quiz_key_correctness");
  const weak = axes.find((a) => a.axis === "example_coherence");
  weak.score = 0.55;
  weak.tier = "GENERATED_DRAFT";
  weak.hits = [];
  const result = validateSubmission(BOOK, ROUND, "bar", {
    schemaVersion: "qc-bar-read-v2",
    bookId: BOOK,
    roundId: ROUND,
    role: "bar",
    reviewer: "codex-qc:bar",
    chapterNumber: 1,
    chapterId: `${BOOK}-ch01`,
    contentHash: "abc123",
    notes: "This chapter has weak examples but no specific cited hit.",
    axes,
  });
  assert.equal(result.ok, false);
  assert.match((result as any).errors.join("\n"), /score < 0\.6 requires at least one cited hit/);
});

test("qc-bar-read-v2 yellow-range axes can use notes without hits", () => {
  const axes = greenAxes().filter((a) => a.axis !== "quiz_key_correctness");
  const weak = axes.find((a) => a.axis === "example_coherence");
  weak.score = 0.7;
  weak.tier = "GENERATED_DRAFT";
  weak.hits = [];
  const result = validateSubmission(BOOK, ROUND, "bar", {
    schemaVersion: "qc-bar-read-v2",
    bookId: BOOK,
    roundId: ROUND,
    role: "bar",
    reviewer: "codex-qc:bar",
    chapterNumber: 1,
    chapterId: `${BOOK}-ch01`,
    contentHash: "abc123",
    notes: "The examples are plausible but not yet publishable enough.",
    axes,
  });
  assert.equal(result.ok, true, (result as any).errors?.join("\n"));
});

test("qc-confirm-read-v1 enforces finding policy by decision", () => {
  const publishableWithFinding = validateSubmission(BOOK, ROUND, "confirm", {
    schemaVersion: "qc-confirm-read-v1",
    bookId: BOOK,
    roundId: ROUND,
    role: "confirm",
    reviewer: "codex-qc:confirm",
    chapterNumber: 1,
    chapterId: `${BOOK}-ch01`,
    contentHash: "abc123",
    decision: "PUBLISHABLE",
    reason: "This second read found no open defects and agrees with the green bar read.",
    findings: [{
      unitId: "examples[0]",
      repairClass: "confirm_read",
      quote: "bad quote",
      problem: "There is still a defect.",
      expectedFix: "Fix the defect.",
    }],
  });
  assert.equal(publishableWithFinding.ok, false);
  assert.match((publishableWithFinding as any).errors.join("\n"), /must not include open findings/);

  const reviseWithoutFinding = validateSubmission(BOOK, ROUND, "confirm", {
    schemaVersion: "qc-confirm-read-v1",
    bookId: BOOK,
    roundId: ROUND,
    role: "confirm",
    reviewer: "codex-qc:confirm",
    chapterNumber: 1,
    chapterId: `${BOOK}-ch01`,
    contentHash: "abc123",
    decision: "REVISE",
    reason: "This second read found a revision-level issue that needs quote-backed repair.",
    findings: [],
  });
  assert.equal(reviseWithoutFinding.ok, false);
  assert.match((reviseWithoutFinding as any).errors.join("\n"), /REVISE confirm-read requires/);
});
