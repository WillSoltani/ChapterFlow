/**
 * Quiz answer-key EVIDENCE resolver (F-10) + judge red-team fixture.
 *
 * The resolver turns promote's silent key-judge fail-open into a loud, per-chapter
 * evidence statement. This pins the three evidence states and the UNVERIFIED
 * summary, the current-content binding (a post-review edit demotes to UNVERIFIED),
 * and the no-session-id-leak guarantee. It also adds the multiple-correct red-team
 * fixture the audit found missing — a question with two defensibly-correct choices
 * — and DOCUMENTS the known gap it exposes (there is no deterministic
 * multiple-correct check; the judge relies on the model's self-reported
 * confidence). See `quiz-key-gate.test.ts` for the unchanged gate matrix.
 */

import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { test } from "./harness.js";
import { makeChapter } from "./helpers.js";
import type { ChapterV21 } from "../src/types.js";
import { chapterContentHash } from "../src/critics/qcAttestation.js";
import {
  CHAPTER_REVIEW_SCHEMA_VERSION,
  REVIEW_FACTORS,
  type ChapterReviewV1,
  type ReviewFactor,
} from "../src/artifacts/artifactTypes.js";
import { chapterReaderDocHash, REVIEW_DOC_HASH_VERSION } from "../src/review/readerReview.js";
import { appendReviewHistory } from "../src/orchestrator/authorReviewLedger.js";
import { writeKeyJudge, keyJudgePath } from "../src/critics/quizKeyGate.js";
import { resolveBookKeyEvidence, resolveChapterKeyEvidence } from "../src/critics/quizKeyEvidence.js";
import { judgeQuizKeys, type AskModel } from "../src/critics/semantic/quizKeyJudge.js";

const BOOK = "zz-fixture-key-evidence";
const REVIEWER = "indep-reviewer-session-abc123";

/** A durable PASS+valid review bound to the chapter's CURRENT content, with a
 *  clean key check (matches === of). Written into an injected tmp stateRoot. */
function mkReview(ch: ChapterV21, over: Partial<ChapterReviewV1> = {}): ChapterReviewV1 {
  const scores = Object.fromEntries(REVIEW_FACTORS.map((f) => [f, 90])) as Record<ReviewFactor, number>;
  const of = ch.quiz?.questions?.length ?? 0;
  return {
    schemaVersion: CHAPTER_REVIEW_SCHEMA_VERSION,
    chapterId: ch.chapterId,
    chapterNumber: ch.number,
    contentHash: chapterContentHash(ch),
    reviewerSessionId: REVIEWER,
    scores,
    composite: 90,
    ship84: true,
    pass: true,
    valid: true,
    keyCheck: { derived: [], matches: of, of, disagreements: [] },
    quotes: [{ quote: ch.title, why: "ok", verified: true }],
    tells: [],
    complaints: [],
    oneParagraphVerdict: "ships",
    bar: 84,
    docHash: chapterReaderDocHash(ch),
    hashVersion: REVIEW_DOC_HASH_VERSION,
    reviewedAt: new Date().toISOString(),
    ...over,
  };
}

/** Write a STALE key-judge sidecar (bogus content hash → never fresh) to the
 *  canonical QC dir. Returns the path so the caller can clean it up. */
function writeStaleKeyJudge(ch: ChapterV21): string {
  writeKeyJudge({
    schemaVersion: "quiz-keyjudge-v1",
    bookId: BOOK,
    chapterNumber: ch.number,
    chapterId: ch.chapterId!,
    judgedAt: "2026-06-01T00:00:00.000Z",
    model: "test-model",
    reviewer: "keyjudge:test",
    contentHash: "staledeadbeef", // does not match chapterContentHash(ch) → stale
    hashVersion: "v2",
    questionsJudged: ch.quiz?.questions?.length ?? 0,
    flagged: [],
    review: [],
  });
  return keyJudgePath(BOOK, ch.number);
}

/** Write a FRESH clean key-judge sidecar (content hash matches). */
function writeFreshKeyJudge(ch: ChapterV21): string {
  writeKeyJudge({
    schemaVersion: "quiz-keyjudge-v1",
    bookId: BOOK,
    chapterNumber: ch.number,
    chapterId: ch.chapterId!,
    judgedAt: "2026-06-01T00:00:00.000Z",
    model: "test-model",
    reviewer: "keyjudge:test",
    contentHash: chapterContentHash(ch),
    hashVersion: "v2",
    questionsJudged: ch.quiz?.questions?.length ?? 0,
    flagged: [],
    review: [],
  });
  return keyJudgePath(BOOK, ch.number);
}

// ── Resolver matrix: judge-fresh / judge-stale+reader / neither ───────────────

test("resolveBookKeyEvidence: the three evidence states + UNVERIFIED summary only on the third", () => {
  const root = mkdtempSync(join(tmpdir(), "key-evidence-"));
  // ch1: FRESH judge result → judge-verified.
  const ch1 = makeChapter(BOOK, 1);
  // ch2: STALE judge + a durable reader review at current content → reader-verified.
  const ch2 = makeChapter(BOOK, 2);
  // ch3: neither → unverified.
  const ch3 = makeChapter(BOOK, 3);
  const judgePaths = [writeFreshKeyJudge(ch1), writeStaleKeyJudge(ch2)];
  try {
    appendReviewHistory(BOOK, mkReview(ch2), root);

    const ev = resolveBookKeyEvidence([ch1, ch2, ch3], root);
    assert.equal(ev.perChapter.length, 3);
    assert.equal(ev.perChapter[0].state, "judge-verified");
    assert.equal(ev.perChapter[1].state, "reader-verified");
    assert.equal(ev.perChapter[2].state, "unverified");

    assert.match(ev.perChapter[0].line, /judge-verified \(fresh\)/);
    assert.match(ev.perChapter[1].line, /reader-verified \(review 9\/9 at current contentHash\)/);
    assert.match(ev.perChapter[2].line, /UNVERIFIED/);

    assert.deepEqual(ev.counts, { judgeVerified: 1, readerVerified: 1, unverified: 1 });
    assert.deepEqual(ev.unverifiedChapters, [3]);
    // Prominent UNVERIFIED summary names the offending chapter.
    assert.match(ev.summary, /⚠ KEY EVIDENCE UNVERIFIED for 1\/3 chapter\(s\): ch03/);
    assert.match(ev.summary, /Advisory — does not block this promote/);
  } finally {
    for (const p of judgePaths) rmSync(p, { force: true });
    rmSync(root, { recursive: true, force: true });
  }
});

test("resolveBookKeyEvidence: all-verified summary states no UNVERIFIED chapters", () => {
  const root = mkdtempSync(join(tmpdir(), "key-evidence-all-"));
  const ch1 = makeChapter(BOOK, 1);
  const ch2 = makeChapter(BOOK, 2);
  const jp = writeFreshKeyJudge(ch1);
  try {
    appendReviewHistory(BOOK, mkReview(ch2), root);
    const ev = resolveBookKeyEvidence([ch1, ch2], root);
    assert.deepEqual(ev.unverifiedChapters, []);
    assert.match(ev.summary, /all 2 chapter\(s\) key-verified \(1 judge, 1 reader\)/);
    assert.doesNotMatch(ev.summary, /UNVERIFIED/);
  } finally {
    rmSync(jp, { force: true });
    rmSync(root, { recursive: true, force: true });
  }
});

// ── Red-team: reader evidence binds to the CURRENT content hash ────────────────

test("a post-review edit demotes reader-verified → UNVERIFIED (evidence binds to current content)", () => {
  const root = mkdtempSync(join(tmpdir(), "key-evidence-edit-"));
  const ch = makeChapter(BOOK, 4);
  try {
    appendReviewHistory(BOOK, mkReview(ch), root);
    assert.equal(resolveChapterKeyEvidence(ch, root).state, "reader-verified");

    // Any reader-facing edit changes chapterContentHash → the review no longer
    // binds → the chapter loses its key evidence.
    ch.title = `${ch.title} (edited after review)`;
    const after = resolveChapterKeyEvidence(ch, root);
    assert.equal(after.state, "unverified", "a stale review must not count as key evidence");
    assert.match(after.line, /UNVERIFIED/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("the report line never leaks the reviewer session id", () => {
  const root = mkdtempSync(join(tmpdir(), "key-evidence-noleak-"));
  const ch = makeChapter(BOOK, 5);
  try {
    appendReviewHistory(BOOK, mkReview(ch), root);
    const ev = resolveChapterKeyEvidence(ch, root);
    assert.equal(ev.state, "reader-verified");
    assert.ok(!ev.line.includes(REVIEWER), `report line must not contain the reviewer session id: ${ev.line}`);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

// ── Red-team fixture: a question with TWO defensibly-correct choices ───────────
//
// KNOWN GAP (documented, NOT fixed — see F-10). The judge has NO deterministic
// multiple-correct-answer check anywhere; its only safeguard is the model's
// self-reported confidence plus a prompt instruction (quizKeyJudge.ts:87 tells it
// to reserve "high" for a single defensibly-correct answer). This fixture pins
// that reality two ways:
//   1. A careful model that OBEYS the instruction returns non-high confidence on a
//      two-correct question, so the disagreement does NOT flag — it is routed to
//      human review instead. Good behavior, but it depends entirely on the model.
//   2. Nothing structural stops a model that IGNORES the instruction and returns
//      HIGH confidence on the OTHER (equally-correct) choice from FALSELY flagging
//      the (also-correct) stored key. The harness cannot catch that; only the
//      prompt discourages it. This is the residual gap the audit named.

/** A single-question chapter where choices [0] and [1] are BOTH defensible. */
function twoCorrectChapter(): ChapterV21 {
  const ch = makeChapter(BOOK, 6);
  ch.quiz = {
    passingScorePercent: 70,
    questions: [
      {
        questionId: "q01",
        prompt: "Which practice most reduces the risk of shipping a wrong quiz key?",
        choices: [
          "Have an independent reviewer re-derive the answer from the prose.", // defensibly correct
          "Run a model-backed judge that re-derives the answer independently.", // ALSO defensibly correct
          "Increase the passing score threshold to 90%.", // clearly wrong
        ],
        correctIndex: 0,
        explanation: "Independent re-derivation catches a wrong key regardless of who wrote it.",
        bloomsLevel: "apply" as const,
        depthLevel: "standard" as const,
      },
    ],
  };
  return ch;
}

test("red-team: a two-correct question at MEDIUM confidence is NOT flagged (routed to review)", async () => {
  const ch = twoCorrectChapter();
  // Oracle models a careful judge OBEYING quizKeyJudge.ts:87: it leans to the
  // other defensible choice but, seeing two correct answers, reports MEDIUM.
  const ask: AskModel = async () => ({
    index: 1,
    confidence: "medium",
    correctText: ch.quiz!.questions[0].choices[1],
    reason: "Both choice 0 and choice 1 are defensible; leaning 1 but the question is ambiguous.",
  });
  const report = await judgeQuizKeys(ch, { ask });
  assert.equal(report.flagged.length, 0, "medium-confidence disagreement must not flag (no wrong-key veto)");
  assert.equal(report.review.length, 1, "it is surfaced for a human read instead");
  assert.equal(report.all[0].confidence, "medium");
  assert.equal(report.all[0].agree, false);
});

test("red-team: the KNOWN GAP — a model that returns HIGH confidence on the other correct choice DOES falsely flag", async () => {
  // This is NOT desired behavior; it documents that nothing structural prevents
  // it. The stored key (index 0) is genuinely correct, yet a HIGH-confidence pick
  // of the equally-correct index 1 flags it as a wrong key. Only the judge PROMPT
  // (not any harness check) discourages this; there is no multiple-correct
  // detector to catch it. Pinning this keeps the gap honest — if a future change
  // claims to close it, this test forces that claim to be demonstrated here.
  const ch = twoCorrectChapter();
  const ask: AskModel = async () => ({
    index: 1,
    confidence: "high",
    correctText: ch.quiz!.questions[0].choices[1],
    reason: "Choice 1 is correct.",
  });
  const report = await judgeQuizKeys(ch, { ask });
  assert.equal(report.flagged.length, 1, "documents the false-flag gap on a two-correct question");
  assert.equal(report.flagged[0].storedIndex, 0);
  assert.equal(report.flagged[0].modelIndex, 1);
});
