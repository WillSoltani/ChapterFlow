/** eval-book-proxy — the owner-instrument replica (Phase-0 judge iteration 1).
 *  Pins: score.py seeding parity (values computed with the python original),
 *  combined-doc answer-key handling, parse/adjudicate validity rules, and
 *  compose.py median/majority/mode math. */
import assert from "node:assert/strict";
import { test } from "./harness.js";

import type { ChapterV21 } from "../src/types.js";
import { REVIEW_FACTORS, type ReviewFactor } from "../src/artifacts/artifactTypes.js";
import {
  adjudicateBookReview,
  buildBookReviewTask,
  composeBookVerdict,
  parseBookReview,
  renderBookSampleDoc,
  selectSeededIdxs,
  type BookReaderResult,
  type ParsedBookReview,
} from "../src/review/evalBookProxy.js";

function scores(v: number, overrides: Partial<Record<ReviewFactor, number>> = {}): Record<ReviewFactor, number> {
  const s = {} as Record<ReviewFactor, number>;
  for (const f of REVIEW_FACTORS) s[f] = v;
  return { ...s, ...overrides };
}

function makeChapter(n: number, correct: number[]): ChapterV21 {
  return {
    schemaVersion: "chapterflow-chapter-v21",
    chapterId: `ch${String(n).padStart(2, "0")}`,
    number: n,
    title: `Chapter ${n}`,
    hook: `Hook for chapter ${n}: the lantern glows.`,
    keyTakeaway: "One move.",
    breakdown: { fastRead: `Fast ${n}.`, deepRead: `Deep ${n}.`, fullRead: `Full ${n}.` },
    examples: [{ title: "Harbor", scenario: `The harbor master checks the tide chart in chapter ${n}.`, whatToDo: "Check the chart.", whyItMatters: "Tides turn." }],
    quiz: { questions: correct.map((c, i) => ({ prompt: `Q${i + 1} of ch${n}?`, choices: ["alpha", "bravo", "charlie"], correctIndex: c, explanation: "Because." })) },
    reviewCards: [{ front: "F", back: "B" }],
    implementationPlan: { title: "Plan", coreSkill: "Skill", ifThenPlans: [{ context: "ctx", plan: "If x then y." }], twentyFourHourChallenge: "Do the thing once today.", weeklyPractice: "Weekly." },
    memorableLines: [{ text: "Short line that sticks." }],
  } as unknown as ChapterV21;
}

// ── score.py seeding parity (expected values computed with the python original) ──

test("selectSeededIdxs matches score.py for pinned real + synthetic cases", () => {
  assert.deepEqual(selectSeededIdxs("atomic-habits", 20), [14, 15, 16, 17]);
  assert.deepEqual(selectSeededIdxs("make-time", 5), [0, 2, 3, 4]);
  assert.deepEqual(selectSeededIdxs("good-to-great", 9), [1, 4, 6, 8]);
  assert.deepEqual(selectSeededIdxs("the-now-habit", 9), [2, 4, 6, 8]);
  assert.deepEqual(selectSeededIdxs("the-12-week-year", 21), [0, 2, 4, 6]);
  assert.deepEqual(selectSeededIdxs("test-book", 12), [2, 3, 4, 5]);
  assert.deepEqual(selectSeededIdxs("zz", 3), [0, 1, 2]);
});

test("selectSeededIdxs caps at chapter count and stays in range", () => {
  const idxs = selectSeededIdxs("any-book", 2);
  assert.equal(idxs.length, 2);
  for (const i of idxs) assert.ok(i >= 0 && i < 2);
});

// ── Combined doc ──────────────────────────────────────────────────────────────

test("renderBookSampleDoc strips per-chapter keys and appends ONE combined labeled key", () => {
  const doc = renderBookSampleDoc([makeChapter(3, [0, 2]), makeChapter(7, [1])]);
  const keyIdx = doc.indexOf("## ANSWER KEY");
  assert.ok(keyIdx > 0, "combined key present");
  assert.equal(doc.indexOf("## ANSWER KEY"), doc.lastIndexOf("## ANSWER KEY"), "exactly one answer-key section");
  const afterKey = doc.slice(keyIdx);
  assert.match(afterKey, /CHAPTER 3 Q1: a/);
  assert.match(afterKey, /CHAPTER 3 Q2: c/);
  assert.match(afterKey, /CHAPTER 7 Q1: b/);
  assert.match(doc, /==== CHAPTER 3: Chapter 3 ====/);
  assert.match(doc, /==== CHAPTER 7: Chapter 7 ====/);
  assert.ok(doc.indexOf("==== CHAPTER 7") < keyIdx, "chapters precede the combined key");
});

test("buildBookReviewTask embeds all ten factors, the gate, churn, and the doc path", () => {
  const task = buildBookReviewTask("scratch/eval-proxy/x/book-sample.txt");
  for (const f of REVIEW_FACTORS) assert.ok(task.includes(`- ${f} (`) || task.includes(`"${f}"`), `factor ${f} present`);
  assert.match(task, /gate_verdict/);
  assert.match(task, /book3_churn/);
  assert.match(task, /scratch\/eval-proxy\/x\/book-sample\.txt/);
  assert.match(task, /byte-verified/);
});

// ── Parse ─────────────────────────────────────────────────────────────────────

const GOOD_PARSED: ParsedBookReview = {
  gate_verdict: "PASS",
  book3_churn: "LOW",
  quizDerivation: { "3": { answers: ["a", "c"] }, "7": { answers: ["b"] } },
  scores: scores(80),
  quotes: [{ quote: "the lantern glows", why: "concrete image" }],
  oneParagraphVerdict: "fine",
};

test("parseBookReview accepts a valid fenced block and rejects bad shapes", () => {
  const text = "prose\n```json\n" + JSON.stringify(GOOD_PARSED) + "\n```\n";
  assert.ok(parseBookReview(text));
  assert.equal(parseBookReview("no json here"), null);
  const badGate = { ...GOOD_PARSED, gate_verdict: "MAYBE" };
  assert.equal(parseBookReview("```json\n" + JSON.stringify(badGate) + "\n```"), null);
  const badScore = { ...GOOD_PARSED, scores: { ...scores(80), retention: 101 } };
  assert.equal(parseBookReview("```json\n" + JSON.stringify(badScore) + "\n```"), null);
  const missingFactor = { ...GOOD_PARSED, scores: (() => { const s = scores(80) as Record<string, number>; delete s.tone; return s; })() };
  assert.equal(parseBookReview("```json\n" + JSON.stringify(missingFactor) + "\n```"), null);
});

// ── Adjudicate ────────────────────────────────────────────────────────────────

test("adjudicateBookReview verifies quotes byte-exactly and checks per-chapter keys", () => {
  const chapters = [makeChapter(3, [0, 2]), makeChapter(7, [1])];
  const doc = renderBookSampleDoc(chapters);
  const good = adjudicateBookReview({ ...GOOD_PARSED, quotes: [{ quote: "the harbor master checks the tide chart in chapter 3", why: "x" }] }, doc, chapters, "s1");
  assert.equal(good.valid, false, "case-mismatched quote must fail byte-verification");
  const exact = adjudicateBookReview({ ...GOOD_PARSED, quotes: [{ quote: "The harbor master checks the tide chart in chapter 3", why: "x" }] }, doc, chapters, "s1");
  assert.equal(exact.valid, true);
  assert.equal(exact.keyCheck.matches, 3);
  assert.equal(exact.keyCheck.of, 3);
  const wrongKeys = adjudicateBookReview({ ...GOOD_PARSED, quizDerivation: { "3": { answers: ["b", "c"] }, "7": { answers: ["b"] } }, quotes: exact ? [{ quote: "The harbor master checks the tide chart in chapter 3", why: "x" }] : [] }, doc, chapters, "s1");
  assert.equal(wrongKeys.keyCheck.matches, 2);
  assert.match(wrongKeys.keyCheck.disagreements[0], /ch3 Q1/);
});

test("adjudicateBookReview: zero quotes is invalid; composite uses the owner weights", () => {
  const chapters = [makeChapter(3, [0])];
  const doc = renderBookSampleDoc(chapters);
  const zero = adjudicateBookReview({ ...GOOD_PARSED, quotes: [] }, doc, chapters, "s1");
  assert.equal(zero.valid, false);
  const mixed = adjudicateBookReview(
    { ...GOOD_PARSED, scores: scores(80, { retention: 90 }), quotes: [{ quote: "Hook for chapter 3", why: "x" }] },
    doc,
    chapters,
    "s1",
  );
  assert.equal(mixed.composite, 81.3); // 80 + 13*(10)/100
});

// ── Compose (compose.py parity) ───────────────────────────────────────────────

function reader(comp: Record<ReviewFactor, number>, gate: "PASS" | "FAIL", churn: "LOW" | "MEDIUM" | "HIGH", valid = true): BookReaderResult {
  return {
    reviewerSessionId: "s",
    valid,
    gateVerdict: gate,
    churn,
    scores: comp,
    composite: 0,
    keyCheck: { matches: 0, of: 0, disagreements: [] },
    quotesVerified: 1,
    quotesTotal: 1,
    oneParagraphVerdict: "",
  };
}

test("composeBookVerdict medians factors, majority gate (ties PASS), churn mode, excludes invalid", () => {
  const v = composeBookVerdict("x", [1, 2], [
    reader(scores(70), "PASS", "LOW"),
    reader(scores(80), "FAIL", "MEDIUM"),
    reader(scores(90), "PASS", "LOW"),
    reader(scores(0), "FAIL", "HIGH", false), // invalid — excluded entirely
  ]);
  assert.equal(v.validCount, 3);
  assert.equal(v.medianComposite, 80);
  assert.equal(v.gate, "PASS");
  assert.equal(v.gateVotes, "2P/1F");
  assert.equal(v.churn, "LOW");
  const tie = composeBookVerdict("x", [1], [reader(scores(70), "PASS", "LOW"), reader(scores(80), "FAIL", "LOW")]);
  assert.equal(tie.gate, "PASS", "compose.py: PASS when npass >= nfail");
  const none = composeBookVerdict("x", [1], [reader(scores(0), "FAIL", "HIGH", false)]);
  assert.equal(none.medianComposite, null);
  assert.equal(none.gate, null);
});
