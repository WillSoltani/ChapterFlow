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
import { dirname, resolve } from "node:path";

import { test } from "./harness.js";
import { makeChapter, STATE_CHAPTERS, writeFixtureBook } from "./helpers.js";
import { groundedNumbersForChapter } from "../src/qc/barReview.js";
import { sourceFactsForPack } from "../src/qc/sourceV2Gate.js";
import { sourceVerifyRecordPath } from "../src/critics/sourceVerify.js";
import { chapterClearsPath, REQUIRED_SWEEP_FAMILIES, loadSweepRecord, sweepFamilyForRepairClass, sweepHistoryPath, sweepRecordPath, writeSweepRecordFromSubmission } from "../src/qc/sweep.js";
import { QC_ORCHESTRATOR_DIR } from "../src/qc/orchestrator/artifacts.js";
import { AXIS_RUBRIC } from "../src/critics/semantic/publishableBar.js";

const BOOK = "zz-fixture-grounded-numbers";
const SWEEP_DROP_ROUND = "r-sweep-drop";

const SIDECAR_CH1 = {
  chapterNumber: 1,
  namedExamples: [{ id: "ch01.ex.car", label: "The car-door case", hardSpecifics: ["a 68% drop", "by 1948"], realWorld: true }],
  testableFacts: [{ id: "ch01.fact.deaths", claim: "Confirmed deaths reached 15,894." }],
};

const SIDECAR_WORD_NUMBERS = {
  chapterNumber: 1,
  namedExamples: [{
    id: "ch01.ex.sharp",
    label: "Sharp HealthCare",
    summary: "Sharp used peak-end redesign in patient experience work.",
    teachesWhat: "A concrete service case anchors the mechanism.",
    hardSpecifics: ["four acute care hospitals", "over four years"],
    realWorld: true,
  }],
  testableFacts: [],
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


test("sourceFactsForPack exposes named-example hardSpecifics to the QC pack", () => {
  const facts = sourceFactsForPack(SIDECAR_WORD_NUMBERS);
  assert.equal(facts.some((f) => f.id === "ch01.ex.sharp.sourceDetails"), true);
  assert.equal(facts.some((f) => /four acute care hospitals/.test(f.claim) && /over four years/.test(f.claim)), true);
});

test("groundedNumbersForChapter extracts VERIFIED spelled quantities from source-verify items", () => {
  try {
    writeRecord(record([{ id: "ch01.ex.sharp", verdict: "VERIFIED", sourceRef: "https://example.org/sharp" }]));
    const out = groundedNumbersForChapter(BOOK, 1, SIDECAR_WORD_NUMBERS);
    assert.ok(out.some((g) => g.token === "4" && g.itemId === "ch01.ex.sharp"), `expected verified word number token 4 (got ${out.map((g) => `${g.token}:${g.itemId}`).join(",")})`);
  } finally {
    clearRecord();
  }
});

const SIDECAR_TRICKY_NUMBERS = {
  chapterNumber: 1,
  namedExamples: [{
    id: "ch01.ex.tricky",
    label: "Tricky number-word case",
    summary: "Exercises multi-word, hyphenated, ordinal, and 'a hundred' phrasing.",
    teachesWhat: "The tokenizer must not over- or under-match spelled-out quantities.",
    hardSpecifics: [
      "rose to four hundred and twenty-seven.",
      "the fee was twenty-seven.",
      "the fourth hospital joined the program",
      "a fortieth anniversary event",
      "raised a hundred dollars",
      "by 1948 the count held",
    ],
    realWorld: true,
  }],
  testableFacts: [],
};

test("groundedNumbersForChapter: tricky spelled quantities tokenize to the intended value, never truncated or ordinal-matched", () => {
  try {
    writeRecord(record([{ id: "ch01.ex.tricky", verdict: "VERIFIED", sourceRef: "https://example.org/tricky" }]));
    const tokens = groundedNumbersForChapter(BOOK, 1, SIDECAR_TRICKY_NUMBERS).map((g) => g.token);
    // "four hundred and twenty-seven." (trailing period, no space) must ground the FULL value,
    // not a truncated prefix — the regex used to stop consuming at the unspaced hyphen+word
    // boundary and silently drop the rest of the run.
    assert.ok(tokens.includes("427"), `expected the full value 427 (got ${tokens.join(",")})`);
    assert.ok(!tokens.includes("420"), `must not ground the truncated prefix 420 (got ${tokens.join(",")})`);
    // "twenty-seven." (hyphenated, trailing period) must ground 27, not a truncated "20".
    assert.ok(tokens.includes("27"), `expected 27 (got ${tokens.join(",")})`);
    assert.ok(!tokens.includes("20"), `must not ground the truncated prefix 20 (got ${tokens.join(",")})`);
    // "the fourth hospital" / "a fortieth anniversary" are ordinals, not quantities — must never
    // ground 4 or 40 from the word run (the digit 1948 below is the only legitimate digit token).
    assert.ok(!tokens.includes("4"), `ordinal "fourth" must not ground 4 (got ${tokens.join(",")})`);
    assert.ok(!tokens.includes("40"), `ordinal "fortieth" must not ground 40 (got ${tokens.join(",")})`);
    // "a hundred" must ground 100.
    assert.ok(tokens.includes("100"), `expected "a hundred" to ground 100 (got ${tokens.join(",")})`);
    // The plain digit year is untouched by word-parsing and still grounds via the digit regex.
    assert.ok(tokens.includes("1948"), `expected digit year 1948 (got ${tokens.join(",")})`);
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
  const immutableRoundRecord = resolve("state/qc-orchestrator", BOOK, SWEEP_DROP_ROUND, "sweep-record.json");
  try {
    rmSync(immutableRoundRecord, { force: true });
    writeFixtureBook(STATE_CHAPTERS, [makeChapter(BOOK, 1), makeChapter(BOOK, 2)]);
    writeSweepRecordFromSubmission({
      schemaVersion: "qc-sweep-submission-v1",
      bookId: BOOK,
      roundId: SWEEP_DROP_ROUND,
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
    rmSync(sweepHistoryPath(BOOK), { force: true });
    rmSync(chapterClearsPath(BOOK), { force: true });
    rmSync(immutableRoundRecord, { force: true });
    rmSync(resolve(QC_ORCHESTRATOR_DIR, BOOK), { recursive: true, force: true });
    for (const n of [1, 2]) rmSync(`${STATE_CHAPTERS}/${BOOK}-ch${String(n).padStart(2, "0")}.v21-native.chapter.json`, { force: true });
  }
});
