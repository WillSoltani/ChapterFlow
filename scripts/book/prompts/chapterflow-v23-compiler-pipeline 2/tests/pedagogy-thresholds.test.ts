/**
 * Pedagogy thresholds (P03, F12) — the rubric-parity section-gate budgets.
 *
 * Pins the three checks added to sectionGate.ts against score.py-parity metrics:
 *   - SEC116.quiz_distractor_tell  (learning-pack, ADVISORY/shadow): fires when
 *     more than QUIZ_TELL_MAX_PER_CHAPTER questions key the uniquely-longest
 *     choice by character count. Advisory because the published catalog already
 *     ships at 53-84% tell (see scratch/calibrate-pedagogy.ts) so it cannot be a
 *     zero-FP blocker.
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
