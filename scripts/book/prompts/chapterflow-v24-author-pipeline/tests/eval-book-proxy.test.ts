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
  assertBookSampleDocIntegrity,
  buildBookReviewTask,
  chapterKeyRowLines,
  chapterQuestionLineIndexes,
  composeBookVerdict,
  DocIntegrityError,
  parseBookReview,
  recountChapterInDoc,
  renderBookSampleDoc,
  screenStructuralClaims,
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
    structuralScreen: { claimsScanned: 0, decisions: [] },
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

// ── Q1: trailing newline on the book-sample doc ───────────────────────────────

test("Q1 renderBookSampleDoc ends with a trailing newline; the LAST combined-key row is fully present", () => {
  // 9-question ch5 mirrors the POM incident: the doc's final line is the last
  // combined-key row (CHAPTER 5 Q9: <letter>). Without the trailing "\n" a
  // wc-l/sed chunked read drops it → the false "ch05 Q9 missing" claim.
  const doc = renderBookSampleDoc([makeChapter(5, [0, 1, 2, 0, 1, 2, 0, 1, 1])]);
  assert.ok(doc.endsWith("\n"), "doc must terminate with a newline");
  assert.ok(doc.includes("\nCHAPTER 5 Q9: b\n"), "the final combined-key row is a full line (not the truncated last byte)");
  // wc -l parity: the newline makes the line count match the number of lines.
  const nl = (doc.match(/\n/g) ?? []).length;
  assert.equal(nl, doc.split("\n").length - 1, "one newline per line incl. the last");
});

// ── Q2: doc-integrity postcondition (assertBookSampleDocIntegrity) ────────────

test("Q2 recount derives question-line + key-row counts straight off the doc bytes", () => {
  const chapters = [makeChapter(3, [0, 2]), makeChapter(5, [0, 1, 2, 0, 1, 2, 0, 1, 1])];
  const doc = renderBookSampleDoc(chapters);
  assert.deepEqual(chapterQuestionLineIndexes(doc, 3), [1, 2]);
  assert.deepEqual(chapterQuestionLineIndexes(doc, 5), [1, 2, 3, 4, 5, 6, 7, 8, 9]);
  const rows5 = chapterKeyRowLines(doc, 5);
  assert.equal(rows5.size, 9);
  assert.ok(rows5.get(9)! > 0, "ch5 Q9 key row is present with a real line number");
  const recount = recountChapterInDoc(doc, 5);
  assert.equal(recount.questionLines, 9);
  assert.equal(recount.keyRows, 9);
});

test("Q2 passes on a complete doc and THROWS DocIntegrityError on a truncated one", () => {
  const chapters = [makeChapter(5, [0, 1, 2, 0, 1, 2, 0, 1, 1])];
  const doc = renderBookSampleDoc(chapters);
  assert.doesNotThrow(() => assertBookSampleDocIntegrity(doc, chapters), "a complete, newline-terminated doc passes");

  // Simulate the exact POM truncation: drop the final combined-key row.
  const truncated = doc.replace(/\nCHAPTER 5 Q9: b\n$/, "\n");
  assert.throws(() => assertBookSampleDocIntegrity(truncated, chapters), (e: unknown) => {
    assert.ok(e instanceof DocIntegrityError, "truncation is an infra-class DocIntegrityError");
    assert.match((e as Error).message, /chapter 5: 8 combined-key row\(s\).*vs 9/);
    return true;
  });

  // A doc missing its terminal newline also fails Q2 (the root-cause trap).
  const noNewline = doc.replace(/\n$/, "");
  assert.throws(() => assertBookSampleDocIntegrity(noNewline, chapters), (e: unknown) => {
    assert.ok(e instanceof DocIntegrityError);
    assert.match((e as Error).message, /trailing newline/);
    return true;
  });
});

// ── Q3: structural key-coverage claim screen ──────────────────────────────────

const CH5 = makeChapter(5, [0, 1, 2, 0, 1, 2, 0, 1, 1]);
const DOC5 = renderBookSampleDoc([CH5]);
const CLAIM_QUOTE = { quote: "Hook for chapter 5: the lantern glows.", why: "byte-verifiable so the vote is otherwise valid" };

function failParsed(over: Partial<ParsedBookReview> = {}): ParsedBookReview {
  return {
    gate_verdict: "FAIL",
    book3_churn: "MEDIUM",
    quizDerivation: { "5": { answers: ["a", "b", "c", "a", "b", "c", "a", "b", "b"] } },
    scores: scores(78),
    quotes: [CLAIM_QUOTE],
    oneParagraphVerdict: "The prose is solid.",
    ...over,
  };
}

test("Q3 disproven structural claim → vote INVALID (respawn-eligible) with a byte-level disproof reason", () => {
  const parsed = failParsed({
    oneParagraphVerdict: "Chapter 5 includes a Q9, but the combined answer key omits it, so the gate fails.",
  });
  const r = adjudicateBookReview(parsed, DOC5, [CH5], "s-fail");
  assert.equal(r.valid, false, "a disproven structural claim invalidates the vote, exactly like quote fabrication");
  assert.match(r.invalidReason!, /structural claim disproven: ch5 Q9 key row present \(doc line \d+\)/);
  assert.equal(r.structuralScreen.claimsScanned, 1);
  assert.equal(r.structuralScreen.decisions[0].verdict, "disproven");
  assert.equal(r.structuralScreen.decisions[0].chapter, 5);
  assert.equal(r.structuralScreen.decisions[0].q, 9);
});

test("Q3 also screens keyDisagreements and quote whys (not just the verdict)", () => {
  const viaDisagreement = adjudicateBookReview(
    failParsed({ quizDerivation: { "5": { answers: ["a"], keyDisagreements: ["Chapter 5 Q9 is missing from the answer key."] } } }),
    DOC5, [CH5], "s-a");
  assert.equal(viaDisagreement.valid, false);
  const viaQuoteWhy = adjudicateBookReview(
    failParsed({ quotes: [{ quote: "CHAPTER 5 Q8: c", why: "The answer key stops here, leaving Q9 unkeyed." }] }),
    DOC5, [CH5], "s-b");
  assert.equal(viaQuoteWhy.valid, false, "a false 'key stops at Q8, Q9 unkeyed' why is disproven and invalidates");
});

test("Q3 CONFIRMED claim (row genuinely absent) THROWS DocIntegrityError — machine truth, not a vote", () => {
  const truncated = DOC5.replace(/\nCHAPTER 5 Q9: b\n$/, "\n"); // Q9 row really gone
  const parsed = failParsed({ oneParagraphVerdict: "The answer key omits Chapter 5 Q9." });
  assert.throws(() => adjudicateBookReview(parsed, truncated, [CH5], "s-confirm"), (e: unknown) => {
    assert.ok(e instanceof DocIntegrityError, "a confirmed structural defect halts (infra), never votes");
    assert.match((e as Error).message, /CONFIRMED by recount: ch5 Q9/);
    return true;
  });
});

test("Q3 fuzzy / unparseable claims are a strict NO-OP (never invalidate on regex guesswork)", () => {
  // Omission verb but NO specific question number → NO-OP.
  const noQ = adjudicateBookReview(failParsed({ oneParagraphVerdict: "The answer key feels incomplete for chapter 5." }), DOC5, [CH5], "s1");
  assert.equal(noQ.valid, true);
  assert.equal(noQ.structuralScreen.claimsScanned, 0);
  // A SEMANTIC gate reason (prose contradicts the key) is not a coverage claim → NO-OP.
  const semantic = adjudicateBookReview(failParsed({ oneParagraphVerdict: "Chapter 5 Q9's keyed answer is contradicted by the prose." }), DOC5, [CH5], "s2");
  assert.equal(semantic.valid, true, "a 'contradicted by prose' claim is legitimately reader judgment, not a coverage omission");
  assert.equal(semantic.structuralScreen.claimsScanned, 0);
});

test("Q3 leaves a valid FAIL untouched (PASS readers are never screened)", () => {
  const passReader = adjudicateBookReview({ ...GOOD_PARSED, gate_verdict: "PASS", oneParagraphVerdict: "the key omits chapter 3 Q1", quizDerivation: { "3": { answers: ["a", "c"] }, "7": { answers: ["b"] } }, quotes: [{ quote: "the lantern glows", why: "x" }] }, renderBookSampleDoc([makeChapter(3, [0, 2]), makeChapter(7, [1])]), [makeChapter(3, [0, 2]), makeChapter(7, [1])], "s-pass");
  assert.equal(passReader.valid, true, "a PASS reader is never structural-screened");
  assert.equal(passReader.structuralScreen.claimsScanned, 0);
  // A FAIL reader with NO structural claim stays valid (an honest quality veto survives).
  const honestFail = adjudicateBookReview(failParsed({ oneParagraphVerdict: "The examples are shallow and the tone is generic." }), DOC5, [CH5], "s-honest");
  assert.equal(honestFail.valid, true, "an honest non-structural FAIL is never invalidated");
});

test("screenStructuralClaims directly: PASS verdict is a no-op regardless of text", () => {
  const s = screenStructuralClaims({ ...GOOD_PARSED, gate_verdict: "PASS", oneParagraphVerdict: "the answer key omits chapter 5 Q9" } as ParsedBookReview, DOC5, [CH5]);
  assert.equal(s.claimsScanned, 0);
  assert.equal(s.invalidatedBy, undefined);
});

// ── Q5: 3-reader compose semantics ────────────────────────────────────────────

test("Q5 median-of-3 clips a single outlier composite", () => {
  // Two readers at 81, one hallucinating reader at 79 → median clips the 79.
  const v = composeBookVerdict("x", [1], [
    reader(scores(81), "PASS", "LOW"),
    reader(scores(81), "PASS", "LOW"),
    reader(scores(79), "FAIL", "MEDIUM"),
  ]);
  // Per-factor median of (81,81,79) = 81 on every factor → composite 81.0.
  assert.equal(v.medianComposite, 81);
  assert.equal(v.validCount, 3);
});

test("Q5 gate is a true majority: 2P/1F PASS, 1P/2F FAIL", () => {
  const pass = composeBookVerdict("x", [1], [reader(scores(80), "PASS", "LOW"), reader(scores(80), "PASS", "LOW"), reader(scores(80), "FAIL", "LOW")]);
  assert.equal(pass.gate, "PASS");
  assert.equal(pass.gateVotes, "2P/1F");
  const fail = composeBookVerdict("x", [1], [reader(scores(80), "PASS", "LOW"), reader(scores(80), "FAIL", "LOW"), reader(scores(80), "FAIL", "LOW")]);
  assert.equal(fail.gate, "FAIL");
  assert.equal(fail.gateVotes, "1P/2F");
});

test("Q5 churn is a real majority; the LOW/MEDIUM/HIGH one-each tie resolves to first-inserted", () => {
  const majority = composeBookVerdict("x", [1], [reader(scores(80), "PASS", "HIGH"), reader(scores(80), "PASS", "MEDIUM"), reader(scores(80), "PASS", "MEDIUM")]);
  assert.equal(majority.churn, "MEDIUM", "2 MEDIUM beat 1 HIGH");
  const oneEach = composeBookVerdict("x", [1], [reader(scores(80), "PASS", "LOW"), reader(scores(80), "PASS", "MEDIUM"), reader(scores(80), "PASS", "HIGH")]);
  assert.equal(oneEach.churn, "LOW", "documented tie rule: first-inserted (reader 1's LOW) wins a 1-1-1 split");
});
