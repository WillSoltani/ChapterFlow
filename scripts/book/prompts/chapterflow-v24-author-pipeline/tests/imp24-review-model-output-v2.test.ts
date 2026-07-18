import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { test } from "./harness.js";
import {
  QUIZ_INTEGRITY_MODEL_OUTPUT_V2_SCHEMA,
  READER_EXPERIENCE_MODEL_OUTPUT_V2_SCHEMA,
  SOURCE_INTEGRITY_MODEL_OUTPUT_V2_SCHEMA,
  SOURCE_PRIMARY_CATEGORY_PRECEDENCE_V2,
  validateQuizIntegrityModelOutputV2,
  validateReaderExperienceModelOutputV2,
  validateSourceIntegrityModelOutputV2,
  type QuizIntegrityModelOutputV2,
  type ReaderExperienceModelOutputV2,
  type SourceIntegrityModelOutputV2,
  type SourceTargetBindingV2,
} from "../src/contracts/reviewModelOutputV2.js";
import { createReviewEvidenceEnvelope } from "../src/review/reviewEvidenceEnvelope.js";
import { readerAuthorityViolationsV2 } from "../src/review/readerAuthorityBoundaryV2.js";
import {
  adaptQuizIntegrityReviewV2ToV1,
  adaptReaderExperienceReviewV2ToV1,
  adaptSourceIntegrityReviewV2ToV1,
  assembleQuizIntegrityReviewV2,
  assembleReaderExperienceReviewV2,
  assembleSourceIntegrityReviewV2,
  buildQuizIntegrityInlineReviewTask,
  buildReaderExperienceInlineReviewTask,
  buildSourceIntegrityInlineReviewTask,
  parseQuizIntegrityModelOutputV2,
  parseReaderExperienceModelOutputV2,
  parseSourceIntegrityModelOutputV2,
  sourcePrimaryCategoryByPrecedence,
} from "../src/review/reviewModelOutputV2.js";

const HASH = "a".repeat(64);
const ROUTE = { model: "qualified-model", effort: "high", routeReceiptSha256: "b".repeat(64) };

function scores(value = 90) {
  return {
    retention: value, quizzes: value, transfer: value, practical: value, summaries: value,
    tone: value, limits: value, insight: value, density: value, beginner: value,
  };
}

function readerOutput(): ReaderExperienceModelOutputV2 {
  return {
    schema: READER_EXPERIENCE_MODEL_OUTPUT_V2_SCHEMA,
    scores: scores(),
    quizDerivation: {
      answers: ["b"], mechanisms: ["The mechanism follows the chapter."], confidence: ["high"],
      ambiguities: [], tells: [], evidenceRefIds: [["RD-002"]],
    },
    recommendation: "SHIP",
    blockingFindings: [],
    escalationSignals: [{
      category: "origin_ambiguous_to_reader", unit: "example", problem: "The status is unclear on the page.", evidenceRefIds: ["RD-002"],
    }],
    advisoryFindings: [],
    strongestEvidenceRefIds: ["RD-001"],
    weakestEvidenceRefIds: ["RD-002"],
    oneParagraphVerdict: "The chapter is usable, with one reader-visible origin ambiguity.",
  };
}

function readerEnvelope() {
  return createReviewEvidenceEnvelope({
    lane: "reader", envelopeId: "reader-v2", caseId: "reader-case", instrumentVersion: "imp24-v1",
    segments: [
      { refId: "RD-001", kind: "chapter", text: "A complete chapter premise." },
      { refId: "RD-002", kind: "chapter", text: "A complete key-free example and quiz." },
    ],
  });
}

function sourceEnvelope() {
  return createReviewEvidenceEnvelope({
    lane: "source", envelopeId: "source-v2", caseId: "source-case", instrumentVersion: "imp24-v1",
    segments: [
      { refId: "CH-001", kind: "chapter", text: "The candidate says the process reduced delay." },
      { refId: "PLAN-001", kind: "plan", text: "U1 is source-bound and permits a descriptive claim." },
      { refId: "SRC-001", kind: "source_claim", text: "The source reports reduced delay." },
      { refId: "SRC-002", kind: "source_mechanism", text: "The source attributes the reduction to fewer handoffs." },
    ],
  });
}

const SOURCE_BINDING: SourceTargetBindingV2 = {
  targetRef: "U1",
  unitId: "internal-unit-47",
  expectedOrigin: "source_bound",
  expectedForm: "case",
  claimStrengthExpected: "descriptive",
  framingRequired: false,
  requiredSourceSupport: true,
};

function sourceOutput(over: Partial<SourceIntegrityModelOutputV2["assessments"][number]> = {}): SourceIntegrityModelOutputV2 {
  return {
    schema: SOURCE_INTEGRITY_MODEL_OUTPUT_V2_SCHEMA,
    assessments: [{
      targetRef: "U1",
      visibleRegister: "clearly_sourced",
      supportStatus: "SUPPORTED",
      framingAdequate: null,
      claimStrengthFit: true,
      namedSpecificityAllowed: true,
      findings: [],
      rationale: "The inline source evidence supports the descriptive claim.",
      ...over,
    }],
  };
}

function quizEnvelope() {
  return createReviewEvidenceEnvelope({
    lane: "quiz", envelopeId: "quiz-v2", caseId: "quiz-case", instrumentVersion: "imp24-v1",
    segments: [
      { refId: "CH-001", kind: "chapter", text: "Removing a handoff reduced delay." },
      { refId: "Q001-CHOICE-000", kind: "quiz_choice", text: "0: Add a handoff." },
      { refId: "Q001-CHOICE-001", kind: "quiz_choice", text: "1: Remove a handoff." },
      { refId: "Q001-DERIVATION", kind: "quiz_derivation", text: "Committed derivation: answer 1 because fewer handoffs reduce delay." },
      { refId: "Q001-EXPLANATION", kind: "quiz_explanation", text: "The stored explanation connects fewer handoffs to reduced delay." },
      { refId: "Q001-KEY", kind: "quiz_key", text: "Stored key: 1." },
      { refId: "Q001-PROMPT", kind: "quiz_prompt", text: "Which change reduced delay?" },
    ],
  });
}

const QUIZ_EVIDENCE = ["CH-001", "Q001-CHOICE-000", "Q001-CHOICE-001", "Q001-EXPLANATION", "Q001-KEY", "Q001-PROMPT"];

function quizOutput(over: Partial<QuizIntegrityModelOutputV2["items"][number]> = {}): QuizIntegrityModelOutputV2 {
  return {
    schema: QUIZ_INTEGRITY_MODEL_OUTPUT_V2_SCHEMA,
    items: [{
      questionRef: "Q1",
      keyCorrect: "correct",
      defensibleAnswerIndices: [1],
      keyedMechanismSupported: true,
      rationale: "Only choice 1 matches the chapter mechanism.",
      evidenceRefIds: QUIZ_EVIDENCE,
      ...over,
    }],
  };
}

test("IMP-24 reader V2 is semantic-only, self-contained, and conductor-stamped", () => {
  const envelope = readerEnvelope();
  const output = parseReaderExperienceModelOutputV2(JSON.stringify(readerOutput()));
  const review = assembleReaderExperienceReviewV2({
    output, envelope, chapterContentSha256: HASH, readerDocumentSha256: "c".repeat(64), schemaSha256: "d".repeat(64),
    rubricVersion: "reader-experience-review-v2", routeEvidence: ROUTE,
  });
  assert.equal(review.reviewerRole, "reader-experience");
  assert.equal(review.evidenceEnvelopeSha256, envelope.envelopeSha256);
  assert.deepEqual(review.escalationSignals[0].evidenceSpans, ["A complete key-free example and quiz."]);
  assert.deepEqual(review.quizDerivation.evidenceSpans, [["A complete key-free example and quiz."]]);
  assert.equal(adaptReaderExperienceReviewV2ToV1(review).strongestEvidence[0], "A complete chapter premise.");

  const task = buildReaderExperienceInlineReviewTask(envelope);
  assert.ok(task.includes(envelope.envelopeSha256));
  assert.doesNotMatch(task, /open (?:a )?file|workspace path/i);

  const forbidden = { ...readerOutput(), chapterContentSha256: HASH };
  assert.ok(validateReaderExperienceModelOutputV2(forbidden).some((error) => /unknown key/.test(error)));
  const sourceTruth = readerOutput() as unknown as Record<string, unknown>;
  sourceTruth.blockingFindings = [{ category: "source_contradiction", unit: "x", problem: "x", evidenceRefIds: ["RD-001"] }];
  assert.ok(validateReaderExperienceModelOutputV2(sourceTruth).some((error) => /invalid category/.test(error)));
});

test("IMP-24 reader V2 rejects schema-valid affirmative source-truth claims on every free-text surface", () => {
  const cases: Array<{ name: string; surface: string; mutate: (output: ReaderExperienceModelOutputV2) => void }> = [
    {
      name: "blocking finding problem declares external fabrication",
      surface: "blockingFindings[0].problem",
      mutate: (output) => { output.blockingFindings = [{
        category: "unsafe", unit: "study", problem: "The author fabricated this study.", evidenceRefIds: ["RD-001"],
      }]; },
    },
    {
      name: "escalation problem declares source contradiction",
      surface: "escalationSignals[0].problem",
      mutate: (output) => { output.escalationSignals = [{
        category: "origin_ambiguous_to_reader", unit: "claim", problem: "The passage contradicts the source.", evidenceRefIds: ["RD-001"],
      }]; },
    },
    {
      name: "advisory problem declares absent source support",
      surface: "advisoryFindings[0].problem",
      mutate: (output) => { output.advisoryFindings = [{
        category: "other_craft", unit: "claim", problem: "The citation does not support this claim.", evidenceRefIds: ["RD-001"],
      }]; },
    },
    {
      name: "finding unit declares fabrication",
      surface: "advisoryFindings[0].unit",
      mutate: (output) => { output.advisoryFindings = [{
        category: "other_craft", unit: "The study is fabricated.", problem: "The passage is distracting.", evidenceRefIds: ["RD-001"],
      }]; },
    },
    {
      name: "verdict declares misattribution",
      surface: "oneParagraphVerdict",
      mutate: (output) => { output.oneParagraphVerdict = "The quote is misattributed."; },
    },
    {
      name: "quiz mechanism declares fabrication",
      surface: "quizDerivation.mechanisms[0]",
      mutate: (output) => { output.quizDerivation.mechanisms[0] = "The study is fabricated."; },
    },
    {
      name: "quiz ambiguity declares source contradiction",
      surface: "quizDerivation.ambiguities[0]",
      mutate: (output) => { output.quizDerivation.ambiguities = ["The passage contradicts the source."]; },
    },
    {
      name: "quiz tell declares misattribution",
      surface: "quizDerivation.tells[0]",
      mutate: (output) => { output.quizDerivation.tells = ["The quote is misattributed."]; },
    },
  ];

  for (const item of cases) {
    const output = readerOutput();
    output.blockingFindings = [];
    output.escalationSignals = [];
    output.advisoryFindings = [];
    item.mutate(output);
    assert.deepEqual(validateReaderExperienceModelOutputV2(output), [], item.name);
    const parsed = parseReaderExperienceModelOutputV2(JSON.stringify(output));
    assert.ok(readerAuthorityViolationsV2(parsed).some((violation) => violation.surface === item.surface), item.name);
    assert.throws(() => assembleReaderExperienceReviewV2({
      output: parsed,
      envelope: readerEnvelope(),
      chapterContentSha256: HASH,
      readerDocumentSha256: "c".repeat(64),
      schemaSha256: "d".repeat(64),
      rubricVersion: "reader-experience-review-v2",
      routeEvidence: ROUTE,
    }), /reader authority violation/i, item.name);
  }
});

test("IMP-24 reader V2 preserves reader-perception uncertainty and escalation wording", () => {
  const output = readerOutput();
  output.escalationSignals = [{
    category: "origin_ambiguous_to_reader",
    unit: "reader-visible origin",
    problem: "The origin is ambiguous to the reader; this could be a fabricated study or may contradict its source and needs source review.",
    evidenceRefIds: ["RD-002"],
  }, {
    category: "possible_real_world_claim",
    unit: "example",
    problem: "This may be a real-world claim with a possible attribution issue that needs verification.",
    evidenceRefIds: ["RD-002"],
  }];
  output.oneParagraphVerdict = "I cannot tell from the page whether the study is invented or the passage contradicts the source; source verification is needed.";
  output.quizDerivation.mechanisms = ["I cannot tell whether the study is fabricated; source verification is needed."];
  output.quizDerivation.ambiguities = ["It is unclear whether the passage contradicts the source."];
  output.quizDerivation.tells = ["A reader might suspect the quote is misattributed and request source review."];

  assert.deepEqual(validateReaderExperienceModelOutputV2(output), []);
  assert.deepEqual(readerAuthorityViolationsV2(output), []);
  assert.doesNotThrow(() => assembleReaderExperienceReviewV2({
    output,
    envelope: readerEnvelope(),
    chapterContentSha256: HASH,
    readerDocumentSha256: "c".repeat(64),
    schemaSha256: "d".repeat(64),
    rubricVersion: "reader-experience-review-v2",
    routeEvidence: ROUTE,
  }));
});

test("IMP-24 source V2 stamps immutable plan identity and derives PASS/BLOCK/INCONCLUSIVE", () => {
  const envelope = sourceEnvelope();
  const clean = assembleSourceIntegrityReviewV2({
    output: parseSourceIntegrityModelOutputV2(JSON.stringify(sourceOutput())),
    envelope, targetBindings: [SOURCE_BINDING], chapterContentSha256: HASH, sourceUsePlanSha256: "c".repeat(64),
    sourcePacketSha256: "d".repeat(64), sidecarSha256: "e".repeat(64), schemaSha256: "f".repeat(64), routeEvidence: ROUTE,
  });
  assert.equal(clean.result, "PASS");
  assert.equal(clean.units[0].unitId, "internal-unit-47");
  assert.equal(clean.units[0].expectedOrigin, "source_bound");
  assert.equal(clean.evidenceEnvelopeSha256, envelope.envelopeSha256);

  const blocker = assembleSourceIntegrityReviewV2({
    output: sourceOutput({
      supportStatus: "UNSUPPORTED",
      findings: [{
        primaryCategory: "invented_detail", secondaryCategories: [], severity: "blocker",
        explanation: "The detail is absent from the supplied source.", chapterEvidenceRefIds: ["CH-001"], sourceEvidenceRefIds: ["SRC-001"],
      }],
    }),
    envelope, targetBindings: [SOURCE_BINDING], chapterContentSha256: HASH, sourceUsePlanSha256: "c".repeat(64),
    sourcePacketSha256: "d".repeat(64), sidecarSha256: "e".repeat(64), schemaSha256: "f".repeat(64), routeEvidence: ROUTE,
  });
  assert.equal(blocker.result, "BLOCK");
  assert.equal(blocker.units[0].findings[0].findingId, "internal-unit-47:source-finding:001");
  assert.ok(blocker.blockingFindingIds.includes("internal-unit-47:source-finding:001"));
  assert.deepEqual(blocker.units[0].findings[0].sourceEvidenceSpans, ["The source reports reduced delay."]);

  const missing = assembleSourceIntegrityReviewV2({
    output: sourceOutput({
      supportStatus: "INCONCLUSIVE",
      findings: [{
        primaryCategory: "missing_required_evidence", secondaryCategories: [], severity: "major",
        explanation: "The required evidence is absent.", chapterEvidenceRefIds: ["CH-001"], sourceEvidenceRefIds: [],
      }],
    }),
    envelope, targetBindings: [SOURCE_BINDING], chapterContentSha256: HASH, sourceUsePlanSha256: "c".repeat(64),
    sourcePacketSha256: "d".repeat(64), sidecarSha256: "e".repeat(64), schemaSha256: "f".repeat(64), routeEvidence: ROUTE,
  });
  assert.equal(missing.result, "INCONCLUSIVE");
  assert.equal(adaptSourceIntegrityReviewV2ToV1(missing).review.result, "INCONCLUSIVE");

  const inapplicableRequiredSupport = assembleSourceIntegrityReviewV2({
    output: sourceOutput({
      supportStatus: "NOT_APPLICABLE",
      findings: [],
      rationale: "The reviewer incorrectly treated a required source-bound target as not applicable.",
    }),
    envelope, targetBindings: [SOURCE_BINDING], chapterContentSha256: HASH, sourceUsePlanSha256: "c".repeat(64),
    sourcePacketSha256: "d".repeat(64), sidecarSha256: "e".repeat(64), schemaSha256: "f".repeat(64), routeEvidence: ROUTE,
  });
  assert.equal(inapplicableRequiredSupport.result, "INCONCLUSIVE",
    "required source-bound support must be established before the conductor can derive PASS");
  assert.ok(buildSourceIntegrityInlineReviewTask(envelope).includes(SOURCE_PRIMARY_CATEGORY_PRECEDENCE_V2.join(" > ")));
});

test("IMP-24 source V2 fails closed on semantic fields that contradict the frozen origin license", () => {
  const assemble = (
    binding: SourceTargetBindingV2,
    output: SourceIntegrityModelOutputV2,
  ) => assembleSourceIntegrityReviewV2({
    output,
    envelope: sourceEnvelope(),
    targetBindings: [binding],
    chapterContentSha256: HASH,
    sourceUsePlanSha256: "c".repeat(64),
    sourcePacketSha256: "d".repeat(64),
    sidecarSha256: "e".repeat(64),
    schemaSha256: "f".repeat(64),
    routeEvidence: ROUTE,
  });

  const genericBinding: SourceTargetBindingV2 = {
    ...SOURCE_BINDING,
    unitId: "internal-generic-unit",
    expectedOrigin: "generic",
    expectedForm: "operational_scenario",
    requiredSourceSupport: false,
  };
  const factualGeneric = assemble(genericBinding, sourceOutput({
    visibleRegister: "presented_as_fact",
    supportStatus: "NOT_APPLICABLE",
    framingAdequate: null,
    namedSpecificityAllowed: true,
    findings: [],
    rationale: "The generic target is presented as a real event despite its frozen license.",
  }));
  assert.equal(factualGeneric.result, "BLOCK");
  assert.ok(factualGeneric.blockingFindingIds.includes("U1:visible-register-incompatible"));

  const constructedBinding: SourceTargetBindingV2 = {
    ...SOURCE_BINDING,
    unitId: "internal-constructed-unit",
    expectedOrigin: "constructed",
    expectedForm: "application",
    framingRequired: true,
    requiredSourceSupport: false,
  };
  const contradictoryConstructed = assemble(constructedBinding, sourceOutput({
    visibleRegister: "presented_as_fact",
    supportStatus: "NOT_APPLICABLE",
    framingAdequate: true,
    namedSpecificityAllowed: true,
    findings: [],
    rationale: "The semantic register contradicts the claimed adequate hypothetical framing.",
  }));
  assert.equal(contradictoryConstructed.result, "BLOCK");
  assert.ok(contradictoryConstructed.blockingFindingIds.includes("U1:visible-register-incompatible"));

  const forbiddenSpecificity = assemble(SOURCE_BINDING, sourceOutput({
    namedSpecificityAllowed: false,
    findings: [],
    rationale: "The assessment reports named specificity that the visible license does not allow.",
  }));
  assert.equal(forbiddenSpecificity.result, "BLOCK");
  assert.ok(forbiddenSpecificity.blockingFindingIds.includes("U1:named-specificity-forbidden"));
});

test("IMP-24 source V2 rejects immutable echoes and primary-category precedence violations", () => {
  const echo = sourceOutput() as unknown as Record<string, unknown>;
  (echo.assessments as Array<Record<string, unknown>>)[0].unitId = "substituted-real-id";
  assert.ok(validateSourceIntegrityModelOutputV2(echo).some((error) => /unknown key "unitId"/.test(error)));

  const modelOwnedFindingId = sourceOutput({
    findings: [{
      primaryCategory: "invented_detail", secondaryCategories: [], severity: "blocker",
      explanation: "The detail is unsupported.", chapterEvidenceRefIds: ["CH-001"], sourceEvidenceRefIds: ["SRC-001"],
    }],
  }) as unknown as Record<string, unknown>;
  ((modelOwnedFindingId.assessments as Array<Record<string, unknown>>)[0].findings as Array<Record<string, unknown>>)[0].findingId = "MODEL-F1";
  assert.ok(validateSourceIntegrityModelOutputV2(modelOwnedFindingId).some((error) => /unknown key "findingId"/.test(error)));

  const precedence = sourceOutput({
    findings: [{
      primaryCategory: "invented_detail", secondaryCategories: ["source_contradiction"], severity: "blocker",
      explanation: "Contradictory evidence exists.", chapterEvidenceRefIds: ["CH-001"], sourceEvidenceRefIds: ["SRC-001"],
    }],
  });
  assert.ok(validateSourceIntegrityModelOutputV2(precedence).some((error) => /violates frozen precedence/.test(error)));
  assert.throws(() => assembleSourceIntegrityReviewV2({
    output: precedence, envelope: sourceEnvelope(), targetBindings: [SOURCE_BINDING], chapterContentSha256: HASH,
    sourceUsePlanSha256: HASH, sourcePacketSha256: HASH, sidecarSha256: HASH, schemaSha256: HASH, routeEvidence: ROUTE,
  }), /violates frozen precedence/);
  assert.equal(sourcePrimaryCategoryByPrecedence(["invented_detail", "source_contradiction"]), "source_contradiction");
});

test("IMP-24 quiz V2 hides immutable history and conductor derives identity, agreement, and outcome", () => {
  const envelope = quizEnvelope();
  const binding = {
    questionRef: "Q1", evidenceRefPrefix: "Q001", itemId: "internal-question-1", choiceCount: 2,
    keyedAnswerIndex: 1, committedDerivedAnswerIndex: 1, tellDetected: false,
  };
  const clean = assembleQuizIntegrityReviewV2({
    output: parseQuizIntegrityModelOutputV2(JSON.stringify(quizOutput())), envelope, questionBindings: [binding],
    chapterContentSha256: HASH, phase2DocumentSha256: "c".repeat(64), derivationSha256: "d".repeat(64), schemaSha256: "e".repeat(64), routeEvidence: ROUTE,
  });
  assert.equal(clean.result, "PASS");
  assert.equal(clean.questions[0].itemId, "internal-question-1");
  assert.equal(clean.questions[0].keyedAnswerIndex, 1);
  assert.equal(clean.questions[0].committedDerivedAnswerIndex, 1);
  assert.equal(clean.questions[0].agreement, true);
  assert.equal(adaptQuizIntegrityReviewV2ToV1(clean).questions[0].keyedAnswer, "b");

  const falseClaim = assembleQuizIntegrityReviewV2({
    output: quizOutput({ keyCorrect: "correct", defensibleAnswerIndices: [0] }), envelope, questionBindings: [binding],
    chapterContentSha256: HASH, phase2DocumentSha256: HASH, derivationSha256: HASH, schemaSha256: HASH, routeEvidence: ROUTE,
  });
  assert.equal(falseClaim.questions[0].keyCorrectDerived, false, "the conductor compares the defensible answer to its stamped key");
  assert.equal(falseClaim.result, "BLOCK");

  const wrong = assembleQuizIntegrityReviewV2({
    output: quizOutput({ keyCorrect: "wrong", defensibleAnswerIndices: [0] }), envelope, questionBindings: [binding],
    chapterContentSha256: HASH, phase2DocumentSha256: HASH, derivationSha256: HASH, schemaSha256: HASH, routeEvidence: ROUTE,
  });
  assert.equal(wrong.result, "BLOCK");
  assert.ok(buildQuizIntegrityInlineReviewTask(envelope).includes(envelope.envelopeSha256));

  const echo = quizOutput() as unknown as Record<string, unknown>;
  (echo.items as Array<Record<string, unknown>>)[0].keyedAnswerIndex = 1;
  assert.ok(validateQuizIntegrityModelOutputV2(echo).some((error) => /unknown key "keyedAnswerIndex"/.test(error)));
});

test("IMP-24 quiz V2 rejects cross-question evidence substitution", () => {
  const envelope = createReviewEvidenceEnvelope({
    lane: "quiz", envelopeId: "quiz-cross-question", caseId: "quiz-cross-question", instrumentVersion: "imp24-v1",
    segments: [
      { refId: "CH-001", kind: "chapter", text: "Removing a handoff reduced delay; adding review increased accuracy." },
      ...["Q001", "Q002"].flatMap((prefix) => [
        { refId: `${prefix}-CHOICE-000`, kind: "quiz_choice" as const, text: "0: First option." },
        { refId: `${prefix}-CHOICE-001`, kind: "quiz_choice" as const, text: "1: Second option." },
        { refId: `${prefix}-DERIVATION`, kind: "quiz_derivation" as const, text: "Committed derivation selects the second option." },
        { refId: `${prefix}-EXPLANATION`, kind: "quiz_explanation" as const, text: "The second option follows from the chapter." },
        { refId: `${prefix}-KEY`, kind: "quiz_key" as const, text: "Stored key: 1." },
        { refId: `${prefix}-PROMPT`, kind: "quiz_prompt" as const, text: "Which option follows?" },
      ]),
    ],
  });
  const q2Refs = ["CH-001", "Q002-CHOICE-000", "Q002-CHOICE-001", "Q002-EXPLANATION", "Q002-KEY", "Q002-PROMPT"];
  const output: QuizIntegrityModelOutputV2 = {
    schema: QUIZ_INTEGRITY_MODEL_OUTPUT_V2_SCHEMA,
    items: [
      { ...quizOutput().items[0], questionRef: "Q1", evidenceRefIds: q2Refs },
      { ...quizOutput().items[0], questionRef: "Q2", evidenceRefIds: q2Refs },
    ],
  };
  assert.throws(() => assembleQuizIntegrityReviewV2({
    output,
    envelope,
    questionBindings: [
      { questionRef: "Q1", evidenceRefPrefix: "Q001", itemId: "item-1", choiceCount: 2, keyedAnswerIndex: 1, committedDerivedAnswerIndex: 1, tellDetected: false },
      { questionRef: "Q2", evidenceRefPrefix: "Q002", itemId: "item-2", choiceCount: 2, keyedAnswerIndex: 1, committedDerivedAnswerIndex: 1, tellDetected: false },
    ],
    chapterContentSha256: HASH,
    phase2DocumentSha256: HASH,
    derivationSha256: HASH,
    schemaSha256: HASH,
    routeEvidence: ROUTE,
  }), /crosses the conductor-owned question namespace/);
});

test("IMP-24 V2 JSON schemas are strict and contain no immutable echo properties", () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const schemaDir = resolve(here, "../state/migration-experiments/contracts/schemas");
  for (const [file, schemaTag, forbidden] of [
    ["reader-experience-model-output-v2.schema.json", READER_EXPERIENCE_MODEL_OUTPUT_V2_SCHEMA, ["chapterContentSha256", "reviewerRole"]],
    ["source-integrity-model-output-v2.schema.json", SOURCE_INTEGRITY_MODEL_OUTPUT_V2_SCHEMA, ["unitId", "findingId", "expectedOrigin", "result", "blockingFindingIds"]],
    ["quiz-integrity-model-output-v2.schema.json", QUIZ_INTEGRITY_MODEL_OUTPUT_V2_SCHEMA, ["itemId", "keyedAnswerIndex", "derivedAnswerIndex", "agreement"]],
  ] as const) {
    const raw = readFileSync(resolve(schemaDir, file), "utf8");
    const schema = JSON.parse(raw) as Record<string, unknown>;
    assert.equal(schema.additionalProperties, false);
    assert.ok(raw.includes(schemaTag));
    for (const field of forbidden) assert.doesNotMatch(raw, new RegExp(`"${field}"\\s*:`));
  }
});
