/**
 * readerBudgets (v24 B3) — five deterministic reader-correlated checks.
 *
 * Fixtures are synthetic (tests/helpers.ts makeChapter + inline packets);
 * nothing here touches canonical state. Each check has a firing and a
 * non-firing fixture plus the threshold-boundary cases from the build spec.
 */

import assert from "node:assert/strict";

import { test } from "./harness.js";
import { makeChapter } from "./helpers.js";
import type { ChapterV21 } from "../src/types.js";
import type { SourcePacketV1 } from "../src/artifacts/artifactTypes.js";
import {
  checkReaderBudgets,
  estimatedRenderedChars,
  openerSignature,
  practiceSignature,
  type BudgetFinding,
} from "../src/critics/readerBudgets.js";

const BOOK = "zz-fixture-reader-budgets";

function makePacket(n: number, caseLabels: string[]): SourcePacketV1 {
  return {
    schemaVersion: "source-packet-v1",
    bookId: BOOK,
    chapterId: `${BOOK}-ch${String(n).padStart(2, "0")}`,
    chapterNumber: n,
    chapterTitle: `Chapter ${n}`,
    sourceSidecarPath: null,
    sourceHash: null,
    facts: [],
    namedCases: caseLabels.map((label, i) => ({
      id: `ch${n}.case.${i + 1}`,
      label,
      summary: `${label} summary.`,
      realWorld: true,
      hardSpecifics: [],
      allowedUses: [],
      forbiddenUses: [],
      doNotRestamp: [],
    })),
    frameworks: [],
    allowedAnchors: [],
    allowedNumbers: [],
    allowedEntities: [],
    allowedPlaces: [],
    forbiddenClaims: [],
    forbiddenLeakage: [],
    sourceQuality: { status: "strong", risks: [] },
  };
}

function packetsFor(entries: Array<[number, string[]]>): Map<number, SourcePacketV1> {
  return new Map(entries.map(([n, labels]) => [n, makePacket(n, labels)]));
}

function only(findings: BudgetFinding[], checkId: string): BudgetFinding[] {
  return findings.filter((f) => f.checkId === checkId);
}

/** Two clean chapters with disjoint word banks — the baseline every negative
 *  test builds from. */
function cleanPair(): [ChapterV21, ChapterV21] {
  return [makeChapter(BOOK, 1), makeChapter(BOOK, 2)];
}

// ── CHB1: anchor repetition ─────────────────────────────────────────────────

test("CHB1 fires (blocker) when a packet case's distinctive token exceeds repCap on the reading surface", () => {
  const [ch1, ch2] = cleanPair();
  // 'popsicle' and 'hotline' tie on document frequency (both only in ch1);
  // the longer token wins, so 'popsicle' is the counted anchor. 7 > 6.
  ch1.breakdown.deepRead += " The popsicle hotline rang." + " The popsicle stayed cold.".repeat(6);
  const packets = packetsFor([[1, ["Popsicle Hotline"]], [2, ["Emerson Electric"]]]);
  const findings = only(checkReaderBudgets([ch1, ch2], { packets }), "CHB1.anchor_repetition");
  assert.equal(findings.length, 1);
  assert.equal(findings[0].severity, "blocker");
  assert.equal(findings[0].chapterNumber, 1);
  assert.match(findings[0].message, /"popsicle"/);
});

test("CHB1 boundary: count == repCap(6) passes; count 7 fires at cap 6 but passes at --rep-cap 7", () => {
  const build = (mentions: number): ChapterV21[] => {
    const [ch1, ch2] = cleanPair();
    ch1.breakdown.deepRead += " The popsicle hotline rang." + " The popsicle stayed cold.".repeat(mentions - 1);
    return [ch1, ch2];
  };
  const packets = packetsFor([[1, ["Popsicle Hotline"]], [2, ["Emerson Electric"]]]);
  assert.equal(only(checkReaderBudgets(build(6), { packets }), "CHB1.anchor_repetition").length, 0, "exactly at cap must pass");
  assert.equal(only(checkReaderBudgets(build(7), { packets }), "CHB1.anchor_repetition").length, 1, "one over cap must fire");
  assert.equal(only(checkReaderBudgets(build(7), { packets, repCap: 7 }), "CHB1.anchor_repetition").length, 0, "raised cap must pass");
});

test("CHB1 without packets (title-fallback labels) reports ADVISORY, not blocker", () => {
  const [ch1, ch2] = cleanPair();
  ch1.examples[0].title = "The Popsicle Hotline";
  ch1.breakdown.deepRead += " The popsicle hotline rang." + " The popsicle stayed cold.".repeat(6);
  const findings = only(checkReaderBudgets([ch1, ch2]), "CHB1.anchor_repetition");
  const popsicle = findings.filter((f) => /"popsicle"/.test(f.message));
  assert.equal(popsicle.length, 1);
  assert.ok(findings.every((f) => f.severity === "advisory"), "every title-fallback CHB1 finding must be advisory");
});

test("CHB1 SEC119 lesson: common-word person tokens (Grant/Chase) are never counted", () => {
  const [ch1, ch2] = cleanPair();
  ch1.breakdown.deepRead += " They grant access to the grant desk.".repeat(8);
  const packets = packetsFor([[1, ["Grant Chase"]], [2, ["Emerson Electric"]]]);
  assert.equal(only(checkReaderBudgets([ch1, ch2], { packets }), "CHB1.anchor_repetition").length, 0);
});

test("CHB1 skips concept-cases whose label has no capitalized anchor token (packet path)", () => {
  const [ch1, ch2] = cleanPair();
  // 'coverage' repeats 9x on the reading surface — but "Bond interest
  // coverage" names a concept the chapter teaches, not a source anchor.
  ch1.breakdown.deepRead += " The coverage ratio moved again.".repeat(9);
  const packets = packetsFor([[1, ["Bond interest coverage"]], [2, ["Emerson Electric"]]]);
  assert.equal(only(checkReaderBudgets([ch1, ch2], { packets }), "CHB1.anchor_repetition").length, 0);
});

// ── CHB2: length budget ─────────────────────────────────────────────────────

test("CHB2 fires when estimated rendered length is inflated past +tolerance, and names the direction", () => {
  const [ch1, ch2] = cleanPair();
  const est = estimatedRenderedChars(ch1);
  const budget = { renderedChars: Math.round(est / 1.3), tolerance: 0.2 };
  const findings = only(checkReaderBudgets([ch1, ch2], { lengthBudget: budget }), "CHB2.length_budget");
  assert.ok(findings.length >= 1);
  assert.equal(findings[0].severity, "blocker");
  assert.match(findings[0].message, /over/);
});

test("CHB2 passes when every chapter sits inside budget*(1±tolerance)", () => {
  const [ch1, ch2] = cleanPair();
  const budget = { renderedChars: Math.round((estimatedRenderedChars(ch1) + estimatedRenderedChars(ch2)) / 2), tolerance: 0.2 };
  assert.equal(only(checkReaderBudgets([ch1, ch2], { lengthBudget: budget }), "CHB2.length_budget").length, 0);
});

test("CHB2 boundary: the ±20% edge is inclusive (a few chars inside passes, a few outside fires)", () => {
  const [ch1] = cleanPair();
  const est = estimatedRenderedChars(ch1);
  // hi-edge: budget*1.2 lands ~2.4 chars ABOVE est → inside, must pass.
  const justInside = { renderedChars: Math.ceil(est / 1.2) + 2, tolerance: 0.2 };
  assert.equal(only(checkReaderBudgets([ch1], { lengthBudget: justInside }), "CHB2.length_budget").length, 0);
  // hi-edge: budget*1.2 lands ~2.4 chars BELOW est → est is over, must fire.
  const justOutside = { renderedChars: Math.floor(est / 1.2) - 2, tolerance: 0.2 };
  const over = only(checkReaderBudgets([ch1], { lengthBudget: justOutside }), "CHB2.length_budget");
  assert.equal(over.length, 1);
  assert.match(over[0].message, /over/);
  // lo-edge mirror: budget*0.8 lands just above est → under, must fire.
  const underBudget = { renderedChars: Math.ceil(est / 0.8) + 4, tolerance: 0.2 };
  const under = only(checkReaderBudgets([ch1], { lengthBudget: underBudget }), "CHB2.length_budget");
  assert.equal(under.length, 1);
  assert.match(under[0].message, /under/);
});

// ── CHB3: cast disjointness ─────────────────────────────────────────────────

test("CHB3 fires when the same invented first name is cast in two chapters", () => {
  const [ch1, ch2] = cleanPair();
  ch1.examples[0].scenario += " Maren checks the tide chart before the shift begins.";
  ch2.examples[0].scenario += " Maren reviews the harvest ledger at closing time.";
  const findings = only(checkReaderBudgets([ch1, ch2]), "CHB3.cast_disjoint");
  assert.equal(findings.length, 2, "one finding per involved chapter");
  assert.deepEqual(findings.map((f) => f.chapterNumber).sort(), [1, 2]);
  assert.ok(findings.every((f) => f.severity === "blocker" && /"Maren"/.test(f.message)));
});

test("CHB3 does not fire when each chapter casts a different bank name", () => {
  const [ch1, ch2] = cleanPair();
  ch1.examples[0].scenario += " Maren checks the tide chart before the shift begins.";
  ch2.examples[0].scenario += " Sage reviews the harvest ledger at closing time.";
  assert.equal(only(checkReaderBudgets([ch1, ch2]), "CHB3.cast_disjoint").length, 0);
});

test("CHB3 does not fire on a protected source-person name (packet namedCases label token)", () => {
  const [ch1, ch2] = cleanPair();
  ch1.examples[0].scenario += " Gemma tapes the checklist to the cooler door.";
  ch2.examples[0].scenario += " Gemma repeats the drill with the night crew.";
  const packets = packetsFor([[1, ["Gemma Hartley emotional-labor essay"]], [2, ["Emerson Electric"]]]);
  assert.equal(only(checkReaderBudgets([ch1, ch2], { packets }), "CHB3.cast_disjoint").length, 0);
  // Control: the identical chapters WITHOUT packets treat Gemma as invented cast.
  assert.equal(only(checkReaderBudgets([ch1, ch2]), "CHB3.cast_disjoint").length, 2);
});

test("CHB3 (no packets) treats a first name that also appears in breakdown prose as a source figure", () => {
  const [ch1, ch2] = cleanPair();
  ch1.examples[0].scenario += " Maren checks the tide chart before the shift begins.";
  ch1.breakdown.deepRead += " Maren's original study followed forty harbor pilots.";
  ch2.examples[0].scenario += " Maren reviews the harvest ledger at closing time.";
  ch2.breakdown.deepRead += " Maren's follow-up replicated the effect in orchards.";
  assert.equal(only(checkReaderBudgets([ch1, ch2]), "CHB3.cast_disjoint").length, 0);
});

// ── CHB4: opener signature ──────────────────────────────────────────────────

test("CHB4 fires when two first-example openers share 6 of their first 8 content tokens", () => {
  const [ch1, ch2] = cleanPair();
  ch1.examples[0].scenario =
    "Budget spreadsheet quarterly forecast variance printer window stapler trouble arrives before anyone has coffee.";
  // Order-shuffled, 6 of 8 shared (spreadsheet+budget+forecast+variance+printer+quarterly), 2 new.
  ch2.examples[0].scenario =
    "Forecast variance printer quarterly budget spreadsheet kettle doorway trouble arrives before anyone has coffee.";
  const findings = only(checkReaderBudgets([ch1, ch2]), "CHB4.opener_signature");
  assert.equal(findings.length, 1);
  assert.equal(findings[0].severity, "blocker");
  assert.equal(findings[0].chapterNumber, 2, "reported on the later chapter");
});

test("CHB4 does not fire on a 5-of-8 opener overlap", () => {
  const [ch1, ch2] = cleanPair();
  ch1.examples[0].scenario =
    "Budget spreadsheet quarterly forecast variance printer window stapler trouble arrives before anyone has coffee.";
  ch2.examples[0].scenario =
    "Forecast variance printer quarterly budget kettle doorway carpet trouble arrives before anyone has coffee.";
  assert.equal(only(checkReaderBudgets([ch1, ch2]), "CHB4.opener_signature").length, 0);
});

// ── CHB5: practice format ───────────────────────────────────────────────────

test("CHB5 allows a practice-format signature in exactly 2 chapters, blocks it in 3", () => {
  const shared = "Write the budget summary before the standup meeting ends tonight.";
  const two = [makeChapter(BOOK, 1), makeChapter(BOOK, 2), makeChapter(BOOK, 3)];
  two[0].implementationPlan.twentyFourHourChallenge = shared;
  two[1].implementationPlan.twentyFourHourChallenge = shared;
  assert.equal(only(checkReaderBudgets(two), "CHB5.practice_format").length, 0, "2 repeats allowed");

  const three = [makeChapter(BOOK, 1), makeChapter(BOOK, 2), makeChapter(BOOK, 3)];
  for (const ch of three) ch.implementationPlan.twentyFourHourChallenge = shared;
  const findings = only(checkReaderBudgets(three), "CHB5.practice_format");
  assert.equal(findings.length, 3, "3 repeats block, one finding per chapter");
  assert.ok(findings.every((f) => f.severity === "blocker" && /twentyFourHourChallenge/.test(f.message)));
});

test("CHB5 tracks weeklyPractice as its own signature namespace", () => {
  const chapters = [makeChapter(BOOK, 1), makeChapter(BOOK, 2), makeChapter(BOOK, 3)];
  for (const ch of chapters) ch.implementationPlan.weeklyPractice = "Review the vendor ledger every Friday before invoices close.";
  const findings = only(checkReaderBudgets(chapters), "CHB5.practice_format");
  assert.equal(findings.length, 3);
  assert.ok(findings.every((f) => /weeklyPractice/.test(f.message)));
});

test("practiceSignature: first verb lemma + up to 3 salient nouns, function words skipped", () => {
  assert.equal(practiceSignature("Once today, write the budget summary before the standup meeting."), "write|budget+summary+standup");
  assert.equal(practiceSignature(""), null);
});

test("openerSignature: 8 stemmed content tokens after function-word removal", () => {
  const ch = makeChapter(BOOK, 1);
  ch.examples[0].scenario = "The budget spreadsheets showed a quarterly forecast variance the printers flagged during scoring reviews.";
  assert.deepEqual(openerSignature(ch), ["budget", "spreadsheet", "show", "quarterly", "forecast", "variance", "printer", "flagg"]);
});

// ── calibration helper ──────────────────────────────────────────────────────

test("calibration: two synthetic 'shipped' chapters produce zero findings under their own budget", () => {
  // Mirrors the zero-FP calibration runner's packet path: shipped-quality
  // chapters + their source packets, budget defined by the book itself.
  const chapters = cleanPair();
  const packets = packetsFor([[1, ["Popsicle Hotline at the Magic Castle"]], [2, ["Emerson Electric"]]]);
  const ests = chapters.map((ch) => estimatedRenderedChars(ch)).sort((a, b) => a - b);
  const budget = { renderedChars: ests[Math.floor(ests.length / 2)], tolerance: 0.2 };
  const findings = checkReaderBudgets(chapters, { packets, lengthBudget: budget });
  assert.deepEqual(findings, [], `expected zero findings, got: ${findings.map((f) => `${f.checkId}@ch${f.chapterNumber}`).join(", ")}`);
  // The no-packets fallback on the same chapters must still produce ZERO
  // BLOCKERS (CHB1's title-fallback path is advisory by design).
  const fallback = checkReaderBudgets(chapters, { lengthBudget: budget });
  assert.equal(fallback.filter((f) => f.severity === "blocker").length, 0);
});
