/**
 * IMP-20 WP-A1 — the five frozen split-lane contract types.
 *
 * These are the interface surface every Wave-B lane compiles against, so this
 * suite pins: each strict validator accepts its canonical record and REJECTS
 * unknown keys (in-code additionalProperties:false) + out-of-enum values; the
 * reader lane carries NO external source-truth blocking category and NO ship84
 * (E-01/E-08); the reader scores are exactly the 10 imported REVIEW_FACTORS; the
 * freshness predicates stale a legacy record and any bound-hash drift; and the
 * descriptors are hash-stable and hash-sensitive (the contract-freeze mechanic).
 *
 * The descriptors are imported DIRECTLY from their Wave-A files — index.ts
 * registration is the Wave-C integration wave, not this package.
 */

import assert from "node:assert/strict";

import { test } from "./harness.js";
import { contractHash } from "../src/contracts/contractUtil.js";
import { REVIEW_FACTORS, type ReviewFactor } from "../src/artifacts/artifactTypes.js";
import {
  READER_BLOCKING_CATEGORIES,
  READER_EXPERIENCE_REVIEW_CONTRACT,
  READER_EXPERIENCE_RUBRIC_VERSION,
  readerReviewIsFresh,
  validateReaderExperienceReview,
  type ReaderExperienceReviewV1,
} from "../src/contracts/readerExperienceReview.js";
import {
  SOURCE_INTEGRITY_REVIEW_CONTRACT,
  sourceReviewIsFresh,
  validateSourceIntegrityReview,
  type SourceIntegrityReviewV1,
} from "../src/contracts/sourceIntegrityReview.js";
import {
  QUIZ_INTEGRITY_RESULT_CONTRACT,
  validateQuizIntegrityResult,
  type QuizIntegrityResultV1,
} from "../src/contracts/quizIntegrityReview.js";
import {
  AGGREGATED_CHAPTER_REVIEW_CONTRACT,
  aggregateIsFresh,
  validateAggregatedChapterReview,
  type AggregateChapterReviewInputV1,
  type AggregatedChapterReviewV1,
  type DeterministicCriticSummaryV1,
} from "../src/contracts/aggregateChapterReview.js";
import {
  JUDGE_CAPABILITY_QUALIFICATION_CONTRACT,
  validateJudgeCapabilityQualification,
  type JudgeCapabilityQualificationV1,
} from "../src/contracts/judgeCapabilityQualification.js";
import type { ContractDescriptor } from "../src/contracts/contractUtil.js";

const H = (c: string) => c.repeat(64);

// ── canonical fixtures ────────────────────────────────────────────────────────

function scores(): Record<ReviewFactor, number> {
  return Object.fromEntries(REVIEW_FACTORS.map((f) => [f, 88])) as Record<ReviewFactor, number>;
}

function mkReader(over: Partial<ReaderExperienceReviewV1> = {}): ReaderExperienceReviewV1 {
  return {
    schema: "reader-experience-review-v1",
    reviewerRole: "reader-experience",
    chapterContentSha256: H("a"),
    readerDocumentSha256: H("b"),
    rubricVersion: READER_EXPERIENCE_RUBRIC_VERSION,
    schemaSha256: H("c"),
    scores: scores(),
    quizDerivation: {
      answers: ["a", "b", "c"],
      mechanisms: ["mechanism one"],
      confidence: ["high", "medium", "low"],
      ambiguities: [],
      tells: [],
    },
    recommendation: "SHIP",
    blockingFindings: [],
    escalationSignals: [],
    advisoryFindings: [],
    strongestEvidence: ["a strong on-page quote"],
    weakestEvidence: [],
    oneParagraphVerdict: "Clear, self-consistent, and shippable on its own terms.",
    ...over,
  };
}

function mkSource(over: Partial<SourceIntegrityReviewV1> = {}): SourceIntegrityReviewV1 {
  return {
    schema: "source-integrity-review-v1",
    reviewerRole: "source-integrity",
    chapterContentSha256: H("a"),
    sourceUsePlanSha256: H("d"),
    sourcePacketSha256: H("e"),
    sidecarSha256: H("f"),
    schemaSha256: H("0"),
    units: [{
      unitId: "unit.case.1",
      expectedOrigin: "source_bound",
      expectedForm: "case",
      claimStrengthExpected: "descriptive",
      visibleRegister: "clearly_sourced",
      supportStatus: "SUPPORTED",
      framingAdequate: null,
      claimStrengthFit: true,
      namedSpecificityAllowed: true,
      chapterEvidenceSpans: ["prose span"],
      sourceEvidenceSpans: ["anchor span"],
      findings: [],
    }],
    result: "PASS",
    blockingFindingIds: [],
    rationale: "Every unit is source-supported.",
    ...over,
  };
}

function mkQuiz(over: Partial<QuizIntegrityResultV1> = {}): QuizIntegrityResultV1 {
  return {
    schema: "quiz-integrity-result-v1",
    chapterContentSha256: H("a"),
    derivationSha256: H("9"),
    questions: [{
      itemId: "q01",
      derivedAnswer: "a",
      keyedAnswer: "a",
      keyCorrect: true,
      uniqueAnswer: true,
      defensibleAlternatives: [],
      mechanismSupported: true,
      tellDetected: false,
      explanation: "Prose mechanism uniquely supports a.",
      evidenceSpans: ["span"],
    }],
    result: "PASS",
    ...over,
  };
}

function mkAggregate(over: Partial<AggregatedChapterReviewV1> = {}): AggregatedChapterReviewV1 {
  return {
    schema: "aggregated-chapter-review-v1",
    chapterContentSha256: H("a"),
    readerResultSha256: H("1"),
    sourceResultSha256: H("2"),
    quizResultSha256: H("3"),
    deterministicCriticBundleSha256: H("4"),
    readerComposite: 88,
    readerBar: 80,
    finalStatus: "PASS",
    blockingReasons: [],
    revisionReasons: [],
    escalationReasons: [],
    ...over,
  };
}

function mkQual(over: Partial<JudgeCapabilityQualificationV1> = {}): JudgeCapabilityQualificationV1 {
  return {
    profileId: "gpt-5.5@high",
    model: "gpt-5.5",
    effort: "high",
    readerExperience: "QUALIFIED",
    sourceIntegrity: "NOT_QUALIFIED",
    quizIntegrity: "NOT_TESTED",
    securityBoundary: "QUALIFIED",
    evidenceHashes: [H("e")],
    corpusHashes: [H("c")],
    instrumentHashes: [H("1")],
    qualifiedAt: "2026-07-12T00:00:00.000Z",
    ...over,
  };
}

// ── canonical acceptance ──────────────────────────────────────────────────────

test("every canonical split-lane record passes its own strict validator", () => {
  assert.deepEqual(validateReaderExperienceReview(mkReader()), []);
  assert.deepEqual(validateSourceIntegrityReview(mkSource()), []);
  assert.deepEqual(validateQuizIntegrityResult(mkQuiz()), []);
  assert.deepEqual(validateAggregatedChapterReview(mkAggregate()), []);
  assert.deepEqual(validateJudgeCapabilityQualification(mkQual()), []);
});

// ── reader lane: E-01 (no source-truth blockers) + E-08 (no ship84) ───────────

test("reader blocking categories are on-page-decidable only — no external source-truth category exists (E-01)", () => {
  for (const banned of ["fabricated", "factually_wrong", "source_contradictory"]) {
    assert.ok(!(READER_BLOCKING_CATEGORIES as readonly string[]).includes(banned), `${banned} is not a reader blocker`);
    const errs = validateReaderExperienceReview(mkReader({
      blockingFindings: [{ category: banned as never, unit: "example 2", problem: "x", evidenceSpans: [] }],
    }));
    assert.ok(errs.some((e) => e.includes("unknown category")), `validator rejects the "${banned}" reader blocker`);
  }
  // internal_contradiction stays a reader blocker (baseline (a): on-page decidable).
  assert.deepEqual(
    validateReaderExperienceReview(mkReader({
      blockingFindings: [{ category: "internal_contradiction", unit: "deep read", problem: "contradicts the hook", evidenceSpans: ["p1", "p2"] }],
    })),
    [],
    "internal_contradiction remains a valid on-page reader blocker",
  );
});

test("reader lane can carry an origin_ambiguous_to_reader ESCALATION signal (the E-01 replacement for a fabrication call)", () => {
  assert.deepEqual(
    validateReaderExperienceReview(mkReader({
      escalationSignals: [{ category: "origin_ambiguous_to_reader", unit: "example 1", problem: "reads factual, status unclear", evidenceSpans: ["span"] }],
    })),
    [],
  );
});

test("reader contract has no ship84 — the strict validator rejects any unknown key (E-08 / in-code additionalProperties:false)", () => {
  const withShip = { ...mkReader(), ship84: false } as unknown;
  const errs = validateReaderExperienceReview(withShip);
  assert.ok(errs.some((e) => e.includes('unknown key "ship84"')), "ship84 is not part of the reader contract");
  assert.ok(!JSON.stringify(READER_EXPERIENCE_REVIEW_CONTRACT.fields).includes("ship84"), "descriptor carries no ship84 field");
});

test("reader scores must be EXACTLY the 10 imported REVIEW_FACTORS — a missing or extra factor is rejected", () => {
  const missing = mkReader();
  const s = { ...missing.scores } as Record<string, number>;
  delete s[REVIEW_FACTORS[0]];
  assert.ok(validateReaderExperienceReview({ ...missing, scores: s }).some((e) => e.includes(`missing factor "${REVIEW_FACTORS[0]}"`)));
  assert.ok(validateReaderExperienceReview(mkReader({ scores: { ...scores(), bogus: 50 } as never })).some((e) => e.includes('unknown key "bogus"')));
  assert.ok(validateReaderExperienceReview(mkReader({ scores: { ...scores(), [REVIEW_FACTORS[1]]: 140 } as never })).some((e) => e.includes("in [0,100]")));
});

test("reader quizDerivation enforces the a/b/c and low/medium/high enums", () => {
  assert.ok(validateReaderExperienceReview(mkReader({
    quizDerivation: { answers: ["a", "d" as never], mechanisms: [], confidence: [], ambiguities: [], tells: [] },
  })).some((e) => e.includes("answers")));
  assert.ok(validateReaderExperienceReview(mkReader({
    quizDerivation: { answers: [], mechanisms: [], confidence: ["hot" as never], ambiguities: [], tells: [] },
  })).some((e) => e.includes("confidence")));
});

test("reader freshness: fresh only under the current rubric version + bound hashes; a legacy reader-rubric-v3-phase1 record is never fresh", () => {
  assert.equal(READER_EXPERIENCE_RUBRIC_VERSION, "reader-experience-review-v1");
  const r = mkReader();
  assert.equal(readerReviewIsFresh(r, H("a"), H("b"), H("c")), true, "fresh under matching version + hashes");
  assert.equal(readerReviewIsFresh(mkReader({ rubricVersion: "reader-rubric-v3-phase1" }), H("a"), H("b"), H("c")), false, "a legacy-adapted record can never be fresh (version wedge)");
  assert.equal(readerReviewIsFresh(r, H("z"), H("b"), H("c")), false, "chapter-content drift stales");
  assert.equal(readerReviewIsFresh(r, H("a"), H("b"), H("9")), false, "schema drift stales");
});

// ── source lane ───────────────────────────────────────────────────────────────

test("source lane rejects out-of-enum register / support / finding category / severity and unit unknown keys", () => {
  assert.ok(validateSourceIntegrityReview(mkSource({ units: [{ ...mkSource().units[0], visibleRegister: "totally_made_up" as never }] })).some((e) => e.includes("visibleRegister")));
  assert.ok(validateSourceIntegrityReview(mkSource({ units: [{ ...mkSource().units[0], supportStatus: "MAYBE" as never }] })).some((e) => e.includes("supportStatus")));
  assert.ok(validateSourceIntegrityReview(mkSource({ units: [{ ...mkSource().units[0], findings: [{ category: "nope" as never, severity: "blocker", explanation: "x" }] }] })).some((e) => e.includes("unknown category")));
  assert.ok(validateSourceIntegrityReview(mkSource({ units: [{ ...mkSource().units[0], findings: [{ category: "invented_detail", severity: "fatal" as never, explanation: "x" }] }] })).some((e) => e.includes("unknown severity")));
  const badUnit = { ...mkSource().units[0], sneaky: true } as unknown;
  assert.ok(validateSourceIntegrityReview(mkSource({ units: [badUnit as never] })).some((e) => e.includes('unknown key "sneaky"')));
  assert.ok(validateSourceIntegrityReview(mkSource({ result: "MAYBE" as never })).some((e) => e.includes("result")));
});

test("a source BLOCK verdict with a blocker finding is a valid record (the lane can express what the reader lane cannot)", () => {
  assert.deepEqual(validateSourceIntegrityReview(mkSource({
    result: "BLOCK",
    blockingFindingIds: ["unit.case.1#0"],
    units: [{ ...mkSource().units[0], supportStatus: "UNSUPPORTED", findings: [{ category: "invented_detail", severity: "blocker", explanation: "invented a dated statistic" }] }],
  })), []);
});

test("source freshness stales on any of the five bound-hash drifts and on schema drift", () => {
  const r = mkSource();
  assert.equal(sourceReviewIsFresh(r, H("a"), H("d"), H("e"), H("f"), H("0")), true);
  assert.equal(sourceReviewIsFresh(r, H("a"), H("d"), H("e"), H("f"), H("z")), false, "schema drift stales");
  assert.equal(sourceReviewIsFresh(r, H("a"), H("z"), H("e"), H("f"), H("0")), false, "plan drift stales");
  assert.equal(sourceReviewIsFresh({ ...r, schema: "wrong" as never }, H("a"), H("d"), H("e"), H("f"), H("0")), false, "wrong schema tag is never fresh");
});

// ── quiz lane ─────────────────────────────────────────────────────────────────

test("quiz lane enforces a/b/c answers, boolean verdict fields, the result enum, and unknown-key rejection", () => {
  assert.ok(validateQuizIntegrityResult(mkQuiz({ questions: [{ ...mkQuiz().questions[0], derivedAnswer: "z" as never }] })).some((e) => e.includes("derivedAnswer")));
  assert.ok(validateQuizIntegrityResult(mkQuiz({ questions: [{ ...mkQuiz().questions[0], keyCorrect: "yes" as never }] })).some((e) => e.includes("keyCorrect must be boolean")));
  assert.ok(validateQuizIntegrityResult(mkQuiz({ questions: [{ ...mkQuiz().questions[0], defensibleAlternatives: ["a", "q" as never] }] })).some((e) => e.includes("defensibleAlternatives")));
  assert.ok(validateQuizIntegrityResult(mkQuiz({ result: "MEH" as never })).some((e) => e.includes("result")));
  const withExtra = { ...mkQuiz(), extra: 1 } as unknown;
  assert.ok(validateQuizIntegrityResult(withExtra).some((e) => e.includes('unknown key "extra"')));
});

test("a quiz BLOCK (wrong key / genuine ambiguity) is a valid record shape", () => {
  assert.deepEqual(validateQuizIntegrityResult(mkQuiz({
    result: "BLOCK",
    questions: [{ ...mkQuiz().questions[0], keyedAnswer: "b", keyCorrect: false, uniqueAnswer: false, defensibleAlternatives: ["a", "b"] }],
  })), []);
});

// ── aggregate lane + frozen helper input types ────────────────────────────────

test("aggregate lane validates finalStatus enum, rejects unknown keys, and is fresh only against matching lane shas", () => {
  assert.ok(validateAggregatedChapterReview(mkAggregate({ finalStatus: "SHIP" as never })).some((e) => e.includes("finalStatus")));
  const withExtra = { ...mkAggregate(), recommendation: "SHIP" } as unknown;
  assert.ok(validateAggregatedChapterReview(withExtra).some((e) => e.includes('unknown key "recommendation"')), "the model recommendation is NOT a field of the conductor-owned aggregate");
  const a = mkAggregate();
  const expected = { chapterContentSha256: H("a"), readerResultSha256: H("1"), sourceResultSha256: H("2"), quizResultSha256: H("3"), deterministicCriticBundleSha256: H("4") };
  assert.equal(aggregateIsFresh(a, expected), true);
  assert.equal(aggregateIsFresh(a, { ...expected, sourceResultSha256: H("z") }), false, "a stale source-lane sha stales the aggregate");
});

test("the frozen Wave-A helper input types compile against the three typed lane results", () => {
  const deterministic: DeterministicCriticSummaryV1 = { bundleSha256: H("4"), hasBlocker: false, blockerCheckIds: [] };
  const input: AggregateChapterReviewInputV1 = {
    reader: mkReader(),
    source: mkSource(),
    quiz: mkQuiz(),
    deterministic,
    readerBar: 80,
    chapterContentSha256: H("a"),
    expectedChapterContentSha256: H("a"),
    expectedReaderDocumentSha256: H("b"),
    expectedSourceUsePlanSha256: H("d"),
    expectedSourcePacketSha256: H("e"),
    expectedSidecarSha256: H("f"),
    expectedReaderSchemaSha256: H("c"),
    expectedSourceSchemaSha256: H("0"),
    expectedQuizSchemaSha256: H("9"),
    requiredSourceUnitIds: ["unit.case.1"],
  };
  // The aggregator's inputs are self-consistent: each lane's own bound hash equals
  // the aggregate input's freshness expectation (the WP-B4 runtime enforces this).
  assert.equal(input.reader.chapterContentSha256, input.expectedChapterContentSha256);
  assert.equal(input.source.sourceUsePlanSha256, input.expectedSourceUsePlanSha256);
  assert.equal(input.deterministic.bundleSha256, deterministic.bundleSha256);
  assert.deepEqual(input.requiredSourceUnitIds, [input.source.units[0].unitId]);
});

// ── judge qualification ───────────────────────────────────────────────────────

test("judge qualification is per-role independent and rejects bad status/effort/unknown keys", () => {
  // one QUALIFIED, one NOT_QUALIFIED, one NOT_TESTED all coexist on one profile.
  assert.deepEqual(validateJudgeCapabilityQualification(mkQual()), []);
  assert.ok(validateJudgeCapabilityQualification(mkQual({ readerExperience: "MAYBE" as never })).some((e) => e.includes("readerExperience")));
  assert.ok(validateJudgeCapabilityQualification(mkQual({ effort: "max" as never })).some((e) => e.includes("effort")), "API-only max is not a repo-local effort");
  const withExtra = { ...mkQual(), qualified: true } as unknown;
  assert.ok(validateJudgeCapabilityQualification(withExtra).some((e) => e.includes('unknown key "qualified"')), "no monolithic single-boolean qualified field survives");
});

// ── descriptor invariants (the contract-freeze mechanic) ──────────────────────

test("the five descriptors map name→schema-id, are v1/IMP-20, and contractHash is deterministic + field-sensitive", () => {
  const cases: Array<{ d: ContractDescriptor; schemaId: string }> = [
    { d: READER_EXPERIENCE_REVIEW_CONTRACT, schemaId: "reader-experience-review-v1" },
    { d: SOURCE_INTEGRITY_REVIEW_CONTRACT, schemaId: "source-integrity-review-v1" },
    { d: QUIZ_INTEGRITY_RESULT_CONTRACT, schemaId: "quiz-integrity-result-v1" },
    { d: AGGREGATED_CHAPTER_REVIEW_CONTRACT, schemaId: "aggregated-chapter-review-v1" },
    { d: JUDGE_CAPABILITY_QUALIFICATION_CONTRACT, schemaId: "judge-capability-qualification-v1" },
  ];
  const names = new Set<string>();
  for (const { d, schemaId } of cases) {
    assert.equal(d.version, 1, `${d.name} is v1`);
    assert.equal(d.ownerPrompt, "IMP-20", `${d.name} is owned by IMP-20`);
    assert.equal(`${d.name}-v1`, schemaId, `${d.name} maps to schema id ${schemaId}`);
    names.add(d.name);
    // deterministic
    assert.equal(contractHash(d), contractHash(d), `${d.name} hash is stable`);
    // field-sensitive: mutating a field description changes the hash (drift is caught)
    const mutated: ContractDescriptor = { ...d, fields: { ...d.fields, __probe__: "x" } };
    assert.notEqual(contractHash(mutated), contractHash(d), `${d.name} hash is sensitive to a field change`);
  }
  assert.equal(names.size, 5, "the five contract names are distinct");
});
