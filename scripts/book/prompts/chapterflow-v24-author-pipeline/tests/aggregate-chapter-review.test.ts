/**
 * IMP-20 §D / WP-B4 — deterministic chapter-review aggregator.
 *
 * Pins the frozen §D policy over injected, in-repo-valid lane results (no model
 * calls anywhere — the lane verdicts are constructed directly as typed fixtures):
 *
 *   - test 13  reader ambiguity alone ≠ a source blocker (→ at most REVISE); a
 *              `possible_real_world_claim` is an advisory annotation only.
 *   - test 17  an inconclusive input never yields PASS (stale hash / quiz
 *              INCONCLUSIVE / unpinned source INCONCLUSIVE).
 *   - test 18  any high-severity source/quiz/reader/deterministic defect → BLOCK;
 *              a required-unit source INCONCLUSIVE blocks; a non-required one does
 *              not.
 *   - test 19  finalStatus is the conductor's deterministic composition
 *              (precedence BLOCK ▸ INCONCLUSIVE ▸ REVISE ▸ PASS + a computed
 *              reader composite), not a passed-in field.
 *   - test 20  the model `recommendation` is evidence, never the gate.
 *   - integration 9  a changed chapter invalidates every lane → INCONCLUSIVE.
 *
 * All assertions run through the frozen Wave-A types + the aggregator's own
 * output validator; zero live model calls, zero disk writes.
 */

import assert from "node:assert/strict";

import { test } from "./harness.js";
import { aggregateChapterReview, computeReaderComposite } from "../src/review/aggregateChapterReview.js";
import {
  validateAggregatedChapterReview,
  type AggregateChapterReviewInputV1,
  type DeterministicCriticSummaryV1,
} from "../src/contracts/aggregateChapterReview.js";
import {
  READER_EXPERIENCE_RUBRIC_VERSION,
  type ReaderExperienceReviewV1,
} from "../src/contracts/readerExperienceReview.js";
import type {
  SourceIntegrityReviewUnitV1,
  SourceIntegrityReviewV1,
} from "../src/contracts/sourceIntegrityReview.js";
import type {
  QuizIntegrityQuestionV1,
  QuizIntegrityResultV1,
} from "../src/contracts/quizIntegrityReview.js";
import { hashCanonical } from "../src/contracts/contractUtil.js";
import { REVIEW_FACTORS, type ReviewFactor } from "../src/artifacts/artifactTypes.js";
import { REVIEW_WEIGHTS } from "../src/review/readerReview.js";

// ── frozen fixture anchors ───────────────────────────────────────────────────
const CHAP = "chap-sha-1";
const READER_DOC = "reader-doc-1";
const PLAN = "plan-1";
const PACKET = "packet-1";
const SIDECAR = "sidecar-1";
const READER_SCHEMA = "reader-schema-1";
const SOURCE_SCHEMA = "source-schema-1";
const QUIZ_SCHEMA = "quiz-schema-1";
const BAR = 80;

function mkScores(value: number): Record<ReviewFactor, number> {
  const s = {} as Record<ReviewFactor, number>;
  for (const f of REVIEW_FACTORS) s[f] = value;
  return s;
}

function mkReader(over: Partial<ReaderExperienceReviewV1> = {}): ReaderExperienceReviewV1 {
  return {
    schema: "reader-experience-review-v1",
    reviewerRole: "reader-experience",
    chapterContentSha256: CHAP,
    readerDocumentSha256: READER_DOC,
    rubricVersion: READER_EXPERIENCE_RUBRIC_VERSION,
    schemaSha256: READER_SCHEMA,
    scores: mkScores(90),
    quizDerivation: { answers: [], mechanisms: [], confidence: [], ambiguities: [], tells: [] },
    recommendation: "SHIP",
    blockingFindings: [],
    escalationSignals: [],
    advisoryFindings: [],
    strongestEvidence: [],
    weakestEvidence: [],
    oneParagraphVerdict: "clean",
    ...over,
  };
}

function mkSourceUnit(over: Partial<SourceIntegrityReviewUnitV1> = {}): SourceIntegrityReviewUnitV1 {
  return {
    unitId: "u1",
    expectedOrigin: "source_bound",
    expectedForm: "case",
    claimStrengthExpected: "descriptive",
    visibleRegister: "clearly_sourced",
    supportStatus: "SUPPORTED",
    framingAdequate: true,
    claimStrengthFit: true,
    namedSpecificityAllowed: true,
    chapterEvidenceSpans: [],
    sourceEvidenceSpans: [],
    findings: [],
    ...over,
  };
}

function mkSource(over: Partial<SourceIntegrityReviewV1> = {}): SourceIntegrityReviewV1 {
  return {
    schema: "source-integrity-review-v1",
    reviewerRole: "source-integrity",
    chapterContentSha256: CHAP,
    sourceUsePlanSha256: PLAN,
    sourcePacketSha256: PACKET,
    sidecarSha256: SIDECAR,
    schemaSha256: SOURCE_SCHEMA,
    units: [],
    result: "PASS",
    blockingFindingIds: [],
    rationale: "clean",
    ...over,
  };
}

function mkQuizQuestion(over: Partial<QuizIntegrityQuestionV1> = {}): QuizIntegrityQuestionV1 {
  return {
    itemId: "Q1",
    derivedAnswer: "a",
    keyedAnswer: "a",
    keyCorrect: true,
    uniqueAnswer: true,
    defensibleAlternatives: [],
    mechanismSupported: true,
    tellDetected: false,
    explanation: "",
    evidenceSpans: [],
    ...over,
  };
}

function mkQuiz(over: Partial<QuizIntegrityResultV1> = {}): QuizIntegrityResultV1 {
  return {
    schema: "quiz-integrity-result-v1",
    chapterContentSha256: CHAP,
    derivationSha256: "deriv-1",
    questions: [mkQuizQuestion()],
    result: "PASS",
    ...over,
  };
}

function mkDeterministic(over: Partial<DeterministicCriticSummaryV1> = {}): DeterministicCriticSummaryV1 {
  return { bundleSha256: "bundle-1", hasBlocker: false, blockerCheckIds: [], ...over };
}

function mkInput(over: Partial<AggregateChapterReviewInputV1> = {}): AggregateChapterReviewInputV1 {
  return {
    reader: mkReader(),
    source: mkSource(),
    quiz: mkQuiz(),
    deterministic: mkDeterministic(),
    readerBar: BAR,
    chapterContentSha256: CHAP,
    expectedChapterContentSha256: CHAP,
    expectedReaderDocumentSha256: READER_DOC,
    expectedSourceUsePlanSha256: PLAN,
    expectedSourcePacketSha256: PACKET,
    expectedSidecarSha256: SIDECAR,
    expectedReaderSchemaSha256: READER_SCHEMA,
    expectedSourceSchemaSha256: SOURCE_SCHEMA,
    expectedQuizSchemaSha256: QUIZ_SCHEMA,
    requiredSourceUnitIds: [],
    ...over,
  };
}

// ── baseline ─────────────────────────────────────────────────────────────────

test("aggregate: a clean, fresh, at-bar chapter with all lanes PASS → PASS", () => {
  const r = aggregateChapterReview(mkInput());
  assert.equal(r.finalStatus, "PASS");
  assert.deepEqual(r.blockingReasons, []);
  assert.deepEqual(r.revisionReasons, []);
  assert.deepEqual(r.escalationReasons, []);
  assert.deepEqual(validateAggregatedChapterReview(r), []);
  assert.equal(r.deterministicCriticBundleSha256, "bundle-1");
  assert.equal(r.chapterContentSha256, CHAP);
  assert.equal(r.readerBar, BAR);
});

// ── test 13 ──────────────────────────────────────────────────────────────────

test("13: reader origin-ambiguity while source PASS → REVISE, never a source BLOCK", () => {
  const reader = mkReader({
    escalationSignals: [
      { category: "origin_ambiguous_to_reader", unit: "hook", problem: "reads as factual, status unclear", evidenceSpans: ["the study found"] },
    ],
  });
  const r = aggregateChapterReview(mkInput({ reader }));
  assert.equal(r.finalStatus, "REVISE"); // at most REVISE — never a block
  assert.deepEqual(r.blockingReasons, []); // a reader ambiguity is NEVER a source blocker
  assert.ok(r.escalationReasons.some((x) => x.includes("origin_ambiguous_to_reader")));
  assert.ok(r.revisionReasons.some((x) => x.includes("origin_ambiguous_to_reader")));
});

test("13b: reader possible_real_world_claim is an advisory annotation only — source PASS stays PASS", () => {
  const reader = mkReader({
    escalationSignals: [
      { category: "possible_real_world_claim", unit: "deep read", problem: "might reference a real study", evidenceSpans: ["in 1997"] },
    ],
  });
  const r = aggregateChapterReview(mkInput({ reader }));
  assert.equal(r.finalStatus, "PASS"); // the annotation never changes the gate
  assert.deepEqual(r.blockingReasons, []);
  assert.deepEqual(r.revisionReasons, []);
  assert.ok(r.escalationReasons.some((x) => x.includes("possible_real_world_claim")));
});

// ── test 17 ──────────────────────────────────────────────────────────────────

test("17: an inconclusive input never yields PASS", () => {
  const staleReaderSchema = aggregateChapterReview(mkInput({ expectedReaderSchemaSha256: "reader-schema-CHANGED" }));
  assert.equal(staleReaderSchema.finalStatus, "INCONCLUSIVE");

  const quizInconclusive = aggregateChapterReview(mkInput({ quiz: mkQuiz({ result: "INCONCLUSIVE" }) }));
  assert.equal(quizInconclusive.finalStatus, "INCONCLUSIVE");

  const sourceInconclusive = aggregateChapterReview(mkInput({ source: mkSource({ result: "INCONCLUSIVE", units: [] }) }));
  assert.equal(sourceInconclusive.finalStatus, "INCONCLUSIVE");

  for (const r of [staleReaderSchema, quizInconclusive, sourceInconclusive]) {
    assert.notEqual(r.finalStatus, "PASS");
    assert.ok(r.blockingReasons.length > 0, "the cannot-certify reason is surfaced in blockingReasons");
    assert.deepEqual(validateAggregatedChapterReview(r), []);
  }
});

// ── test 18 ──────────────────────────────────────────────────────────────────

test("18: any high-severity source/quiz/reader/deterministic defect → BLOCK", () => {
  const sourceBlock = aggregateChapterReview(
    mkInput({ source: mkSource({ result: "BLOCK", blockingFindingIds: ["u1:invented_detail"] }) }),
  );
  assert.equal(sourceBlock.finalStatus, "BLOCK");
  assert.ok(sourceBlock.blockingReasons.some((x) => x.includes("source lane BLOCK")));

  const quizBlock = aggregateChapterReview(
    mkInput({ quiz: mkQuiz({ result: "BLOCK", questions: [mkQuizQuestion({ keyCorrect: false })] }) }),
  );
  assert.equal(quizBlock.finalStatus, "BLOCK");
  assert.ok(quizBlock.blockingReasons.some((x) => x.includes("quiz lane BLOCK")));

  const detBlock = aggregateChapterReview(
    mkInput({ deterministic: mkDeterministic({ hasBlocker: true, blockerCheckIds: ["SC11.1"] }) }),
  );
  assert.equal(detBlock.finalStatus, "BLOCK");
  assert.ok(detBlock.blockingReasons.some((x) => x.includes("SC11.1")));

  const readerBlock = aggregateChapterReview(
    mkInput({
      reader: mkReader({
        blockingFindings: [{ category: "unusable", unit: "full read", problem: "cannot learn the move", evidenceSpans: ["…"] }],
      }),
    }),
  );
  assert.equal(readerBlock.finalStatus, "BLOCK");
  assert.ok(readerBlock.blockingReasons.some((x) => x.includes("[unusable]")));

  // required-unit source INCONCLUSIVE blocks; a non-required one does NOT.
  const requiredInconclusive = aggregateChapterReview(
    mkInput({
      source: mkSource({ result: "INCONCLUSIVE", units: [mkSourceUnit({ unitId: "u1", supportStatus: "INCONCLUSIVE" })] }),
      requiredSourceUnitIds: ["u1"],
    }),
  );
  assert.equal(requiredInconclusive.finalStatus, "BLOCK");
  assert.ok(requiredInconclusive.blockingReasons.some((x) => x.includes("required source-bound unit")));

  const nonRequiredInconclusive = aggregateChapterReview(
    mkInput({
      source: mkSource({
        result: "INCONCLUSIVE",
        units: [mkSourceUnit({ unitId: "u9", expectedOrigin: "generic", supportStatus: "INCONCLUSIVE" })],
      }),
      requiredSourceUnitIds: ["u1"], // u9 is NOT required
    }),
  );
  assert.equal(nonRequiredInconclusive.finalStatus, "REVISE");
  assert.deepEqual(nonRequiredInconclusive.blockingReasons, []);
  assert.ok(nonRequiredInconclusive.escalationReasons.some((x) => x.includes("u9")));
});

// ── test 19 ──────────────────────────────────────────────────────────────────

test("19: finalStatus is the conductor's deterministic composition (precedence + computed composite)", () => {
  // readerComposite is COMPUTED by the aggregator (weighted mean), not passed in.
  const scores = mkScores(0);
  scores.retention = 100;
  let expected = 0;
  for (const f of REVIEW_FACTORS) expected += REVIEW_WEIGHTS[f] * scores[f];
  expected = Math.round((expected / 100) * 10) / 10;
  const r = aggregateChapterReview(mkInput({ reader: mkReader({ scores }) }));
  assert.equal(r.readerComposite, expected);
  assert.equal(computeReaderComposite(scores), expected);

  // precedence ladder: PASS ▸ REVISE ▸ INCONCLUSIVE ▸ BLOCK (most-severe wins).
  assert.equal(aggregateChapterReview(mkInput()).finalStatus, "PASS");

  assert.equal(
    aggregateChapterReview(mkInput({ reader: mkReader({ scores: mkScores(50) }) })).finalStatus,
    "REVISE", // composite 50 < 80
  );

  assert.equal(
    aggregateChapterReview(
      mkInput({ reader: mkReader({ scores: mkScores(50) }), quiz: mkQuiz({ result: "INCONCLUSIVE" }) }),
    ).finalStatus,
    "INCONCLUSIVE", // INCONCLUSIVE overrides a REVISE
  );

  assert.equal(
    aggregateChapterReview(
      mkInput({
        reader: mkReader({
          scores: mkScores(50),
          blockingFindings: [{ category: "unsafe", unit: "try this", problem: "harmful advice", evidenceSpans: ["…"] }],
        }),
        quiz: mkQuiz({ result: "INCONCLUSIVE" }),
      }),
    ).finalStatus,
    "BLOCK", // BLOCK overrides INCONCLUSIVE and REVISE
  );
});

// ── test 20 ──────────────────────────────────────────────────────────────────

test("20: reader.recommendation is evidence, never the gate", () => {
  // recommendation BLOCK over an otherwise-clean chapter does NOT force a block.
  const cleanButRecBlock = aggregateChapterReview(mkInput({ reader: mkReader({ recommendation: "BLOCK" }) }));
  assert.equal(cleanButRecBlock.finalStatus, "PASS");

  // recommendation SHIP over a real quiz BLOCK does NOT rescue it.
  const defectButRecShip = aggregateChapterReview(
    mkInput({
      reader: mkReader({ recommendation: "SHIP" }),
      quiz: mkQuiz({ result: "BLOCK", questions: [mkQuizQuestion({ keyCorrect: false })] }),
    }),
  );
  assert.equal(defectButRecShip.finalStatus, "BLOCK");

  // finalStatus is invariant under recommendation with the lanes held fixed.
  const base = mkInput();
  for (const rec of ["SHIP", "REVISE", "BLOCK"] as const) {
    const out = aggregateChapterReview({ ...base, reader: mkReader({ recommendation: rec }) });
    assert.equal(out.finalStatus, "PASS", `recommendation ${rec} must not move a clean chapter off PASS`);
  }
});

// ── integration 9 ────────────────────────────────────────────────────────────

test("integration 9: a changed chapter invalidates every lane → INCONCLUSIVE", () => {
  const NEW = "chap-sha-NEW";
  const OLD = "chap-sha-OLD";
  const r = aggregateChapterReview(
    mkInput({
      reader: mkReader({ chapterContentSha256: OLD }),
      source: mkSource({ chapterContentSha256: OLD }),
      quiz: mkQuiz({ chapterContentSha256: OLD }),
      chapterContentSha256: NEW,
      expectedChapterContentSha256: NEW,
    }),
  );
  assert.equal(r.finalStatus, "INCONCLUSIVE");
  assert.notEqual(r.finalStatus, "PASS");
  assert.ok(r.blockingReasons.some((x) => x.includes("reader review is not fresh")));
  assert.ok(r.blockingReasons.some((x) => x.includes("source review is not fresh")));
  assert.ok(r.blockingReasons.some((x) => x.includes("quiz review is not fresh")));
});

// ── output-contract sanity ───────────────────────────────────────────────────

test("aggregate: every produced output validates + binds the lane result shas", () => {
  const inputs = [
    mkInput(),
    mkInput({ reader: mkReader({ scores: mkScores(50) }) }),
    mkInput({ quiz: mkQuiz({ result: "BLOCK", questions: [mkQuizQuestion({ keyCorrect: false })] }) }),
    mkInput({ source: mkSource({ result: "INCONCLUSIVE", units: [] }) }),
    mkInput({ expectedReaderSchemaSha256: "changed" }),
  ];
  for (const inp of inputs) {
    const r = aggregateChapterReview(inp);
    assert.deepEqual(validateAggregatedChapterReview(r), []);
    assert.equal(r.readerResultSha256, hashCanonical(inp.reader));
    assert.equal(r.sourceResultSha256, hashCanonical(inp.source));
    assert.equal(r.quizResultSha256, hashCanonical(inp.quiz));
    assert.equal(r.deterministicCriticBundleSha256, inp.deterministic.bundleSha256);
  }
});
