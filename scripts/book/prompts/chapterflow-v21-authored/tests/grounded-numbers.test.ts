/**
 * FIX 3 — VERIFIED-number provenance reaches the round reviewer.
 *
 * groundedNumbersForChapter surfaces ONLY numbers the FILLED source-verify record marks
 * VERIFIED (with their cited source), so the factual_accuracy axis stops re-distrusting them
 * every round. WRONG/UNVERIFIABLE/missing items contribute nothing (a distrusted number can
 * never be laundered into the trusted list), and no record at all → [] (fail-safe). The sweep
 * is forbidden from raising number/factual findings: an off-family sweep finding is DROPPED,
 * not coerced into a templating family.
 */

import assert from "node:assert/strict";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

import { test } from "./harness.js";
import { makeChapter, STATE_CHAPTERS, writeFixtureBook } from "./helpers.js";
import { groundedNumbersForChapter } from "../src/qc/barReview.js";
import { sourceVerifyRecordPath } from "../src/critics/sourceVerify.js";
import { REQUIRED_SWEEP_FAMILIES, loadSweepRecord, sweepFamilyForRepairClass, sweepRecordPath, writeSweepRecordFromSubmission } from "../src/qc/sweep.js";
import { AXIS_RUBRIC } from "../src/critics/semantic/publishableBar.js";

const BOOK = "zz-fixture-grounded-numbers";

const SIDECAR_CH1 = {
  chapterNumber: 1,
  namedExamples: [{ id: "ch01.ex.car", label: "The car-door case", hardSpecifics: ["a 68% drop", "by 1948"], realWorld: true }],
  testableFacts: [{ id: "ch01.fact.deaths", claim: "Confirmed deaths reached 15,894." }],
};

function writeRecord(json: unknown): void {
  const p = sourceVerifyRecordPath(BOOK);
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, JSON.stringify(json), "utf8");
}
function clearRecord(): void {
  rmSync(sourceVerifyRecordPath(BOOK), { force: true });
}
function record(items: Array<{ id: string; verdict: string; sourceRef?: string }>, chapterNumber = 1): unknown {
  return { schemaVersion: "source-verify-record-v1", bookId: BOOK, chapters: [{ chapterNumber, items }] };
}

test("groundedNumbersForChapter: NO source-verify record → [] (fail-safe, behaviour unchanged)", () => {
  clearRecord();
  assert.deepEqual(groundedNumbersForChapter(BOOK, 1, SIDECAR_CH1), []);
});

test("groundedNumbersForChapter: VERIFIED items surface their numbers with the cited source", () => {
  try {
    writeRecord(record([
      { id: "ch01.ex.car", verdict: "VERIFIED", sourceRef: "https://example.org/car" },
      { id: "ch01.fact.deaths", verdict: "VERIFIED", sourceRef: "https://example.org/deaths" },
    ]));
    const out = groundedNumbersForChapter(BOOK, 1, SIDECAR_CH1);
    const tokens = out.map((g) => g.token);
    for (const t of ["68", "1948", "15894"]) assert.ok(tokens.includes(t), `expected grounded token ${t} (got ${tokens.join(",")})`);
    const deaths = out.find((g) => g.token === "15894");
    assert.equal(deaths?.sourceRef, "https://example.org/deaths");
    assert.equal(deaths?.itemId, "ch01.fact.deaths");
  } finally {
    clearRecord();
  }
});

test("groundedNumbersForChapter: a WRONG or UNVERIFIABLE item never enters the trusted list", () => {
  try {
    writeRecord(record([
      { id: "ch01.ex.car", verdict: "VERIFIED", sourceRef: "https://example.org/car" },
      { id: "ch01.fact.deaths", verdict: "WRONG", sourceRef: "https://example.org/deaths" },
    ]));
    const tokens = groundedNumbersForChapter(BOOK, 1, SIDECAR_CH1).map((g) => g.token);
    assert.ok(tokens.includes("68") && tokens.includes("1948"), "the VERIFIED example's numbers are listed");
    assert.ok(!tokens.includes("15894"), "the WRONG fact's number is NOT trusted");

    writeRecord(record([
      { id: "ch01.ex.car", verdict: "UNVERIFIABLE", sourceRef: "" },
      { id: "ch01.fact.deaths", verdict: "VERIFIED", sourceRef: "https://example.org/deaths" },
    ]));
    const tokens2 = groundedNumbersForChapter(BOOK, 1, SIDECAR_CH1).map((g) => g.token);
    assert.ok(tokens2.includes("15894"), "the VERIFIED fact's number is listed");
    assert.ok(!tokens2.includes("68") && !tokens2.includes("1948"), "the UNVERIFIABLE example's numbers are NOT trusted");
  } finally {
    clearRecord();
  }
});

test("groundedNumbersForChapter: a VERIFIED item in ANOTHER chapter does not leak into this chapter", () => {
  try {
    // The record only has a chapter-3 entry; asking for chapter 1 yields nothing.
    writeRecord(record([{ id: "ch03.fact.x", verdict: "VERIFIED", sourceRef: "https://example.org/x" }], 3));
    assert.deepEqual(groundedNumbersForChapter(BOOK, 1, SIDECAR_CH1), []);
  } finally {
    clearRecord();
  }
});

test("factual_accuracy rubric trusts groundedNumbers AND keeps the 'could not verify' floor (appended, not replaced)", () => {
  assert.ok(AXIS_RUBRIC.factual_accuracy.includes("groundedNumbers"), "rubric must reference groundedNumbers");
  assert.ok(AXIS_RUBRIC.factual_accuracy.includes("could not verify"), "rubric must keep the original 'could not verify' clause");
  assert.ok(/NOT on the list|CONTRADICTS/.test(AXIS_RUBRIC.factual_accuracy), "rubric must still require flagging unlisted/contradicting numbers");
});

test("sweepFamilyForRepairClass: canonical families pass through; FACTUAL labels drop; DESCRIPTIVE templating labels MAP (not drop)", () => {
  // Canonical families are kept as-is.
  for (const fam of REQUIRED_SWEEP_FAMILIES) assert.equal(sweepFamilyForRepairClass(fam), fam);
  // Clearly factual/numeric labels are out of scope for the sweep → dropped.
  for (const c of ["factual_accuracy", "unverifiable_number", "wrong_statistic", "source_citation", "drifted_date"]) {
    assert.equal(sweepFamilyForRepairClass(c), null, `${c} should drop`);
  }
  // REGRESSION: reviewers label real templating findings descriptively — these must be KEPT and
  // mapped, never dropped (dropping them left an empty REVISE that failed the whole book closed).
  assert.equal(sweepFamilyForRepairClass("deduplicate_practice_unit"), "repeated_unit");
  assert.equal(sweepFamilyForRepairClass("vary_scene_action"), "scene_skeleton");
  assert.equal(sweepFamilyForRepairClass("reused_card_shell"), "repeated_unit");
  assert.equal(sweepFamilyForRepairClass("name_collision_across_chapters"), "persona_drift");
  assert.equal(sweepFamilyForRepairClass("venue_stamping"), "location_stamping");
});

test("writeSweepRecordFromSubmission: an off-family (factual) finding is DROPPED; a real templating finding survives", () => {
  try {
    writeFixtureBook(STATE_CHAPTERS, [makeChapter(BOOK, 1), makeChapter(BOOK, 2)]);
    writeSweepRecordFromSubmission({
      schemaVersion: "qc-sweep-submission-v1",
      bookId: BOOK,
      roundId: "r-sweep-drop",
      role: "sweep",
      reviewer: "codex-qc:sweep",
      verdict: "REVISE",
      checkedFamilies: [...REQUIRED_SWEEP_FAMILIES],
      findings: [
        { chapters: [1], unitId: "hook", repairClass: "factual_accuracy", severity: "blocker", quote: "68% seems off", problem: "number doubt", expectedFix: "verify" },
        { chapters: [2], unitId: "reviewCards", repairClass: "repeated_unit", severity: "blocker", quote: "shared card shell", problem: "templating", expectedFix: "vary it" },
      ],
    });
    const rec = loadSweepRecord(BOOK);
    assert.equal(rec?.findings.length, 1, "the off-family factual finding is dropped");
    assert.equal(rec?.findings[0].family, "repeated_unit", "the real templating finding survives");
    assert.equal(rec?.findings[0].chapters[0], 2);
  } finally {
    rmSync(sweepRecordPath(BOOK), { force: true });
    for (const n of [1, 2]) rmSync(`${STATE_CHAPTERS}/${BOOK}-ch${String(n).padStart(2, "0")}.v21-native.chapter.json`, { force: true });
  }
});
