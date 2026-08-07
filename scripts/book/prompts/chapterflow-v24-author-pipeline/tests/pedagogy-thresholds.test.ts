/**
 * Pedagogy thresholds (P03, F12) — the rubric-parity section-gate budgets.
 *
 * Pins the three checks added to sectionGate.ts against score.py-parity metrics:
 *   - SEC116.quiz_distractor_tell  (learning-pack, ADVISORY/shadow): fires when
 *     more than QUIZ_TELL_MAX_PER_CHAPTER questions key the uniquely-longest
 *     choice by character count. Advisory because the published catalog already
 *     ships at 53-84% tell (see scratch/calibrate-pedagogy.ts) so it cannot be a
 *     zero-FP blocker.
 *   - SEC121.quiz_length_tell_majority (learning-pack, BLOCKER): fires when a
 *     strict MAJORITY of questions carry the tell — the blind panel prices
 *     catalog-level tell below the chapter bar (rounds 5-6 flagged 5/9 and
 *     8/9), and an advisory never reaches the writer's retry feedback.
 *   - SEC117.quiz_transfer_floor   (learning-pack): blocker below quizTransferFloor,
 *     advisory below quizTransferTarget. This is the check that actually trips POM.
 *   - SEC118.summary_memorable_lines (summary-pack, blocker): fewer than
 *     SUMMARY_MIN_CLEAN_MEMORABLE_LINES clean (<=14-word) candidates in the breakdown.
 *
 * The checks depend only on the quiz questions / breakdown prose, so the tests
 * drive the real validators with minimal blueprint/packet fixtures and filter to
 * the P03 check ids (other findings from the unrelated fixture fields are ignored).
 */

import assert from "node:assert/strict";

import { test } from "./harness.js";
import { validateLearningPack, validateSummaryPack, type SectionFinding } from "../src/sections/sectionGate.js";
import type { ChapterBlueprintV1, LearningPackV1, SourcePacketV1, SummaryPackV1 } from "../src/artifacts/artifactTypes.js";
import {
  QUIZ_TELL_MAX_PER_CHAPTER,
  quizTransferFloor,
  quizTransferTarget,
  SUMMARY_MIN_CLEAN_MEMORABLE_LINES,
} from "../src/sections/pedagogyThresholds.js";

const EMPTY_PACKET = { allowedAnchors: [], facts: [], namedCases: [] } as unknown as SourcePacketV1;

function blueprint(quizCount: number): ChapterBlueprintV1 {
  return {
    chapterNumber: 1,
    chapterId: "zz-pedagogy-ch01",
    sections: {
      quiz: Array.from({ length: quizCount }, (_, i) => ({ questionId: `q${String(i + 1).padStart(2, "0")}`, correctIndex: 0, depthLevel: "standard" })),
      cards: [],
    },
  } as unknown as ChapterBlueprintV1;
}

// A distractor that is the uniquely-longest choice → keyed answer is NOT the tell.
const LONGEST_DISTRACTOR = "This distractor is deliberately the longest option in the set by a clear margin of characters indeed here.";
const SHORT_KEY = "Lower the visible balance now.";
const SHORT_DISTRACTOR = "Wait for the statement first.";

// Choices where the KEYED answer (index 0) is the uniquely-longest → a tell.
const TELL_CHOICES = [
  "This is the deliberately longer keyed answer, carrying far more characters than either distractor option here.",
  "A short plausible distractor.",
  "Another short plausible distractor.",
];
// Choices where a DISTRACTOR is the longest → the key (index 0) is not a tell.
const EVEN_CHOICES = [SHORT_KEY, LONGEST_DISTRACTOR, SHORT_DISTRACTOR];

const TRANSFER_PROMPT = "You are advising a colleague who faces this exact situation. Which action fits the mechanism best?";
const RECALL_PROMPT = "Which statement best restates the definition given for the mechanism in the reading?";

function makeQuestion(i: number, opts: { tell: boolean; transfer: boolean }): Record<string, unknown> {
  return {
    questionId: `q${String(i + 1).padStart(2, "0")}`,
    sourceAnchorIds: [],
    keyEvidenceAnchorIds: [],
    prompt: opts.transfer ? TRANSFER_PROMPT : RECALL_PROMPT,
    choices: opts.tell ? [...TELL_CHOICES] : [...EVEN_CHOICES],
    correctIndex: 0,
    explanation: "The keyed action changes the visible signal; the distractors rely on delay or intention.",
    bloomsLevel: opts.transfer ? "apply" : "remember",
    depthLevel: "standard",
  };
}

function learningPack(questions: Array<{ tell: boolean; transfer: boolean }>): LearningPackV1 {
  return {
    schemaVersion: "section-artifact-v1",
    artifactType: "learning-pack",
    chapterId: "zz-pedagogy-ch01",
    quiz: { passingScorePercent: 70, questions: questions.map((q, i) => makeQuestion(i, q)) },
    cards: { cards: [] },
  } as unknown as LearningPackV1;
}

function learningFindings(questions: Array<{ tell: boolean; transfer: boolean }>): SectionFinding[] {
  return validateLearningPack(learningPack(questions), blueprint(questions.length), EMPTY_PACKET);
}

function byCheck(findings: SectionFinding[], id: string): SectionFinding[] {
  return findings.filter((f) => f.checkId === id);
}

// ---- distractor tell (SEC116, advisory) -----------------------------------

test("a longest-key quiz trips the distractor-tell advisory when tells exceed the budget", () => {
  // all transfer (isolate tell); QUIZ_TELL_MAX_PER_CHAPTER + 1 tells
  const qs = Array.from({ length: 9 }, (_, i) => ({ tell: i <= QUIZ_TELL_MAX_PER_CHAPTER, transfer: true }));
  const tell = byCheck(learningFindings(qs), "SEC116.quiz_distractor_tell");
  assert.equal(tell.length, 1, "tell advisory should fire");
  assert.equal(tell[0].severity, "advisory", "tell is shadow — never a blocker (catalog ships 53-84% tell)");
  assert.match(tell[0].message, /q01/, "message names the offending questionIds");
  assert.match(tell[0].message, /longest/, "message states the reason");
});

test("an evenly-built quiz (a distractor is longest) does not trip the tell advisory", () => {
  const qs = Array.from({ length: 9 }, () => ({ tell: false, transfer: true }));
  assert.deepEqual(byCheck(learningFindings(qs), "SEC116.quiz_distractor_tell"), []);
});

test("tell budget boundary is exact: QUIZ_TELL_MAX passes, +1 fires", () => {
  const atBudget = Array.from({ length: 9 }, (_, i) => ({ tell: i < QUIZ_TELL_MAX_PER_CHAPTER, transfer: true }));
  assert.deepEqual(byCheck(learningFindings(atBudget), "SEC116.quiz_distractor_tell"), [], `${QUIZ_TELL_MAX_PER_CHAPTER} tells is within budget`);
  const overBudget = Array.from({ length: 9 }, (_, i) => ({ tell: i <= QUIZ_TELL_MAX_PER_CHAPTER, transfer: true }));
  assert.equal(byCheck(learningFindings(overBudget), "SEC116.quiz_distractor_tell").length, 1, `${QUIZ_TELL_MAX_PER_CHAPTER + 1} tells exceeds budget`);
});

// ---- length-tell majority (SEC121, blocker) --------------------------------

test("a majority of longest-key questions is a blocker, not an advisory (SEC121)", () => {
  // 5 of 9 tells — the round-5 live shape the panel flagged on ch01.
  const qs = Array.from({ length: 9 }, (_, i) => ({ tell: i < 5, transfer: true }));
  const majority = byCheck(learningFindings(qs), "SEC121.quiz_length_tell_majority");
  assert.equal(majority.length, 1, "majority tell must block");
  assert.equal(majority[0].severity, "blocker", "the panel prices catalog-level tell below the chapter bar; retry feedback must carry it");
  assert.match(majority[0].message, /5\/9/, "message states the rate");
  assert.match(majority[0].message, /q01/, "message names the offending questionIds");
});

test("at exactly half the questions the majority blocker stays silent (SEC116 advisory still covers it)", () => {
  const qs = Array.from({ length: 9 }, (_, i) => ({ tell: i < 4, transfer: true }));
  assert.deepEqual(byCheck(learningFindings(qs), "SEC121.quiz_length_tell_majority"), [], "4/9 is not a majority");
  assert.equal(byCheck(learningFindings(qs), "SEC116.quiz_distractor_tell").length, 1, "the shadow advisory still reports it");
});

// ---- transfer floor (SEC117, blocker/advisory) ----------------------------

test("a recall-heavy quiz trips the transfer-floor blocker and names the bare-recall questions", () => {
  const qs = Array.from({ length: 9 }, () => ({ tell: false, transfer: false }));
  const transfer = byCheck(learningFindings(qs), "SEC117.quiz_transfer_floor");
  assert.equal(transfer.length, 1);
  assert.equal(transfer[0].severity, "blocker");
  assert.match(transfer[0].message, /q01/, "lists which questions read as bare recall");
  assert.match(transfer[0].message, new RegExp(`0/9`), "reports the realized transfer count");
});

test("transfer floor/target boundaries are exact at 9 questions (floor=6, target=7)", () => {
  assert.equal(quizTransferFloor(9), 6);
  assert.equal(quizTransferTarget(9), 7);
  const withTransfer = (k: number) => Array.from({ length: 9 }, (_, i) => ({ tell: false, transfer: i < k }));

  const belowFloor = byCheck(learningFindings(withTransfer(5)), "SEC117.quiz_transfer_floor");
  assert.equal(belowFloor[0]?.severity, "blocker", "5/9 transfer < floor 6 → blocker");

  const atFloor = byCheck(learningFindings(withTransfer(6)), "SEC117.quiz_transfer_floor");
  assert.equal(atFloor.length, 1, "6/9 transfer is at floor but below target → advisory");
  assert.equal(atFloor[0].severity, "advisory");

  const atTarget = byCheck(learningFindings(withTransfer(7)), "SEC117.quiz_transfer_floor");
  assert.deepEqual(atTarget, [], "7/9 transfer meets the target → no finding");
});

test("transfer floor scales with question count (10 questions → floor 6, target 7)", () => {
  assert.equal(quizTransferFloor(10), 6);
  assert.equal(quizTransferTarget(10), 7);
});

// ---- summary memorable lines (SEC118, blocker) ----------------------------

// Distinct sentences that score as memorable-line candidates (6-16 words).
// Clean = <=14 rubric words; dirty = 15-16 words (a candidate the rubric won't count).
const CLEAN_LINES = [
  "You choose the smaller balance today so the lender sees your signal.", // 12
  "You act before the snapshot when the balance still moves under your control.", // 13
  "You lower the visible number first because the system reads facts not hopes.", // 13
];
const DIRTY_LINES = [
  "You choose the smaller balance today so that the lender clearly sees the real signal now.", // 16
  "You act well before the snapshot moment when the balance still moves under your own control.", // 16
  "You lower the visible number first because the system reads plain facts not your good hopes.", // 16
];

function summaryPack(fullRead: string): SummaryPackV1 {
  return {
    schemaVersion: "section-artifact-v1",
    artifactType: "summary-pack",
    chapterId: "zz-pedagogy-ch01",
    hook: { hook: "A short hook that is long enough to exist for the fixture only.", sourceAnchorIds: [] },
    breakdown: { fastRead: "", deepRead: "", fullRead, sourceAnchorIds: { fastRead: [], deepRead: [], fullRead: [] } },
    keyTakeaway: "Change what the system can see rather than trusting that intention will be read.",
    keyTakeawaySourceAnchorIds: [],
  } as unknown as SummaryPackV1;
}

function memorableFindings(fullRead: string): SectionFinding[] {
  return byCheck(validateSummaryPack(summaryPack(fullRead), blueprint(0), EMPTY_PACKET), "SEC118.summary_memorable_lines");
}

test("a breakdown of only 16-word aphorisms trips the memorable-lines blocker (0 clean)", () => {
  const findings = memorableFindings(DIRTY_LINES.join(" "));
  assert.equal(findings.length, 1);
  assert.equal(findings[0].severity, "blocker");
  assert.match(findings[0].message, /0 clean/);
});

test("a breakdown with >= the required clean lines passes the memorable-lines check", () => {
  // 2 clean + 1 dirty
  const findings = memorableFindings([CLEAN_LINES[0], CLEAN_LINES[1], DIRTY_LINES[0]].join(" "));
  assert.deepEqual(findings, [], "2 clean candidates meets the floor");
});

test("memorable-lines boundary is exact: floor passes, floor-1 fires", () => {
  assert.equal(SUMMARY_MIN_CLEAN_MEMORABLE_LINES, 2);
  const atFloor = memorableFindings([CLEAN_LINES[0], CLEAN_LINES[1], DIRTY_LINES[0]].join(" "));
  assert.deepEqual(atFloor, [], "exactly 2 clean → pass");
  const belowFloor = memorableFindings([CLEAN_LINES[0], DIRTY_LINES[0], DIRTY_LINES[1]].join(" "));
  assert.equal(belowFloor.length, 1, "exactly 1 clean → blocker");
  assert.equal(belowFloor[0].severity, "blocker");
});

// ---- grounding-aware memorable-line selection (SEC16, Task 11q) ------------
//
// The selector harvests every memorable candidate across the three tiers, then
// picks the top-3 to hand to SEC16 (the memorable-line grounding gate). Blind
// score-only selection can pick a prettier UNgroundable aphorism over a lower-
// scoring one that carries a cited case's verbatim specifics, so SEC16 fails
// even though a groundable candidate existed. Task 11q makes selection prefer
// SEC16-groundable candidates (using the SAME validateAnchorHardSpecifics call
// the gate runs), then by score. The gate itself is unchanged: when NO candidate
// is groundable, SEC16 still blocks exactly as before.

const GROUNDING_CHECK = "SEC16.summary_memorable_anchor_specifics";

// A specifics-rich anchor: 2 hardSpecifics, supports memorable_line grounding.
const CASTLE_ANCHOR = {
  id: "a-castle",
  kind: "case",
  label: "Magic Castle Hotel",
  text: "The Magic Castle Hotel gives guests free popsicles by the pool.",
  hardSpecifics: ["magic castle", "popsicles"],
  supportsClaimTypes: ["memorable_line", "breakdown_claim"],
};
// A specifics-POOR anchor: only 1 hardSpecific (< the min of 2) → SEC16 is
// vacuous on it, so grounding preference is a no-op (pure score ordering).
const POOR_ANCHOR = {
  id: "a-poor",
  kind: "case",
  label: "Popsicle Stand",
  text: "The stand hands out popsicles.",
  hardSpecifics: ["popsicles"],
  supportsClaimTypes: ["memorable_line", "breakdown_claim"],
};

function groundingPacket(anchors: unknown[]): SourcePacketV1 {
  return { allowedAnchors: anchors, facts: [], namedCases: [] } as unknown as SourcePacketV1;
}

function groundingSummaryPack(fullRead: string, fullReadIds: string[]): SummaryPackV1 {
  return {
    schemaVersion: "section-artifact-v1",
    artifactType: "summary-pack",
    chapterId: "zz-pedagogy-ch01",
    hook: { hook: "A short hook that is long enough to exist for the fixture only.", sourceAnchorIds: [] },
    breakdown: {
      fastRead: "",
      deepRead: "",
      fullRead,
      sourceAnchorIds: { fastRead: [], deepRead: [], fullRead: fullReadIds },
    },
    keyTakeaway: "Change what the system can see rather than trusting that intention will be read.",
    keyTakeawaySourceAnchorIds: [],
  } as unknown as SummaryPackV1;
}

// High-scoring UNgroundable aphorisms (no "magic castle"/"popsicles" verbatim).
const UNGROUNDABLE_TOP = "You notice the signal not before you act but only after."; // ~52
const UNGROUNDABLE_2 = "You weigh the choice not in comfort but under real cost."; // ~48
const UNGROUNDABLE_3 = "You decide the default before the moment not after you stall."; // ~44
// Lower-scoring GROUNDABLE aphorisms: each carries both of a-castle's specifics.
const GROUNDABLE_1 = "You call the magic castle desk for free popsicles before doubt."; // ~38
const GROUNDABLE_2 = "You visit the magic castle and share popsicles when guests arrive."; // ~38
const GROUNDABLE_3 = "You keep the magic castle warm with popsicles before anyone asks."; // ~38

test("selection prefers SEC16-groundable candidates over prettier ungroundable ones (Task 11q)", () => {
  // One high-scoring ungroundable line + three lower-scoring groundable lines,
  // all in a tier citing the specifics-rich a-castle. Blind score-only selection
  // picks the ungroundable line into the top-3 and SEC16 fails; grounding-aware
  // selection fills the top-3 with the three groundable lines and SEC16 passes.
  const fullRead = [UNGROUNDABLE_TOP, GROUNDABLE_1, GROUNDABLE_2, GROUNDABLE_3].join(" ");
  const findings = validateSummaryPack(groundingSummaryPack(fullRead, ["a-castle"]), blueprint(0), groundingPacket([CASTLE_ANCHOR]));
  assert.deepEqual(byCheck(findings, GROUNDING_CHECK), [], "the three groundable lines fill the top-3; SEC16 passes");
  // 4 candidates → 3 selected → the candidate-count gate stays silent.
  assert.deepEqual(byCheck(findings, "SEC17.summary_memorable_candidate_count"), [], "3 candidates are still selected");
});

test("when NO candidate is groundable, SEC16 still blocks exactly as before (Task 11q pin a)", () => {
  // Three ungroundable lines citing the specifics-rich a-castle: no groundable
  // candidate exists, so grounding-aware sort collapses to pure score and SEC16
  // fires on every selected line — the gate is not weakened.
  const fullRead = [UNGROUNDABLE_TOP, UNGROUNDABLE_2, UNGROUNDABLE_3].join(" ");
  const findings = byCheck(validateSummaryPack(groundingSummaryPack(fullRead, ["a-castle"]), blueprint(0), groundingPacket([CASTLE_ANCHOR])), GROUNDING_CHECK);
  assert.equal(findings.length, 3, "all three selected lines are ungroundable → one SEC16 blocker each");
  assert.ok(findings.every((f) => f.severity === "blocker"), "SEC16 stays a blocker");
});

test("SEC17 count and clean-floor are computed over all candidates, unaffected by grounding (Task 11q pin b)", () => {
  // Only two candidates total → SEC17 reports 2/3 regardless of grounding order;
  // both are clean (<=14 words) so the clean-memorable floor stays silent.
  const fullRead = [GROUNDABLE_1, GROUNDABLE_2].join(" ");
  const findings = validateSummaryPack(groundingSummaryPack(fullRead, ["a-castle"]), blueprint(0), groundingPacket([CASTLE_ANCHOR]));
  const count = byCheck(findings, "SEC17.summary_memorable_candidate_count");
  assert.equal(count.length, 1, "2 candidates trips the count gate");
  assert.match(count[0].message, /2\/3/, "count gate still reports the realized candidate count");
  assert.deepEqual(byCheck(findings, "SEC118.summary_memorable_lines"), [], "2 clean candidates meets the clean floor");
});

test("tiers citing only specifics-poor anchors keep pure score ordering (Task 11q pin c)", () => {
  // Same ungroundable-only lines as pin (a), but cited against a specifics-poor
  // anchor where SEC16 is vacuous. Grounding is uniformly true, so selection is
  // pure score and SEC16 does NOT fire — the grounding preference is a no-op.
  const fullRead = [UNGROUNDABLE_TOP, UNGROUNDABLE_2, UNGROUNDABLE_3].join(" ");
  const findings = validateSummaryPack(groundingSummaryPack(fullRead, ["a-poor"]), blueprint(0), groundingPacket([POOR_ANCHOR]));
  assert.deepEqual(byCheck(findings, GROUNDING_CHECK), [], "specifics-poor anchor → SEC16 vacuous → grounding sort is a no-op");
});
