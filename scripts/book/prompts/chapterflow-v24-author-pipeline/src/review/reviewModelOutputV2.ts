/** IMP-24 inline V2 task cards and conductor-owned review assembly. */

import type { QuizIntegrityResultV1 } from "../contracts/quizIntegrityReview.js";
import type { ReaderExperienceReviewV1 } from "../contracts/readerExperienceReview.js";
import type { SourceIntegrityReviewV1 } from "../contracts/sourceIntegrityReview.js";
import type { ReviewEvidenceEnvelopeV1, ReviewEvidenceKind } from "../contracts/reviewEvidenceEnvelope.js";
import {
  QUIZ_INTEGRITY_MODEL_OUTPUT_V2_SCHEMA,
  READER_EXPERIENCE_MODEL_OUTPUT_V2_SCHEMA,
  SOURCE_INTEGRITY_MODEL_OUTPUT_V2_SCHEMA,
  SOURCE_PRIMARY_CATEGORY_PRECEDENCE_V2,
  validateQuizIntegrityModelOutputV2,
  validateReaderExperienceModelOutputV2,
  validateSourceIntegrityModelOutputV2,
  type QuizIntegrityModelItemV2,
  type QuizIntegrityModelOutputV2,
  type QuizIntegrityReviewV2,
  type QuizQuestionBindingV2,
  type ReaderExperienceFindingV2,
  type ReaderExperienceModelFindingV2,
  type ReaderExperienceModelOutputV2,
  type ReaderExperienceReviewV2,
  type ReviewRouteEvidenceV2,
  type SourceIntegrityModelAssessmentV2,
  type SourceIntegrityModelFindingV2,
  type SourceIntegrityModelOutputV2,
  type SourceIntegrityResultV2,
  type SourceIntegrityFindingV2,
  type SourceIntegrityReviewUnitV2,
  type SourceIntegrityReviewV2,
  type SourcePrimaryCategoryV2,
  type SourceTargetBindingV2,
} from "../contracts/reviewModelOutputV2.js";
import { buildInlineReviewTask, assertReviewEvidenceEnvelope } from "./reviewEvidenceEnvelope.js";
import { resolveEvidenceRefGroups, resolveEvidenceRefIds } from "./evidenceReferenceResolver.js";
import { readerAuthorityViolationsV2 } from "./readerAuthorityBoundaryV2.js";
import { READER_EXPERIENCE_RUBRIC_VERSION } from "./readerExperienceReview.js";

export type ReviewModelOutputV2ErrorCode =
  | "INVALID_JSON"
  | "INVALID_MODEL_OUTPUT"
  | "WRONG_ENVELOPE_LANE"
  | "INVALID_BINDING"
  | "UNKNOWN_TARGET"
  | "INVALID_EVIDENCE"
  | "READER_AUTHORITY_VIOLATION";

export class ReviewModelOutputV2Error extends Error {
  constructor(message: string, readonly code: ReviewModelOutputV2ErrorCode) {
    super(message);
    this.name = "ReviewModelOutputV2Error";
  }
}

function parseStrictObject(raw: string, where: string): unknown {
  try {
    const value = JSON.parse(raw);
    if (value === null || typeof value !== "object" || Array.isArray(value)) {
      throw new Error("top-level JSON must be an object");
    }
    return value;
  } catch (error) {
    throw new ReviewModelOutputV2Error(`${where}: invalid strict JSON: ${(error as Error).message}`, "INVALID_JSON");
  }
}

function parsedAndValidated<T>(raw: string, where: string, validate: (value: unknown) => string[]): T {
  const value = parseStrictObject(raw, where);
  const errors = validate(value);
  if (errors.length > 0) throw new ReviewModelOutputV2Error(`${where}: ${errors.join("; ")}`, "INVALID_MODEL_OUTPUT");
  return value as T;
}

export function parseReaderExperienceModelOutputV2(raw: string): ReaderExperienceModelOutputV2 {
  return parsedAndValidated(raw, "reader model output v2", validateReaderExperienceModelOutputV2);
}

export function parseSourceIntegrityModelOutputV2(raw: string): SourceIntegrityModelOutputV2 {
  return parsedAndValidated(raw, "source model output v2", validateSourceIntegrityModelOutputV2);
}

export function parseQuizIntegrityModelOutputV2(raw: string): QuizIntegrityModelOutputV2 {
  return parsedAndValidated(raw, "quiz model output v2", validateQuizIntegrityModelOutputV2);
}

function requireLane(envelope: ReviewEvidenceEnvelopeV1, lane: ReviewEvidenceEnvelopeV1["lane"]): void {
  assertReviewEvidenceEnvelope(envelope);
  if (envelope.lane !== lane) {
    throw new ReviewModelOutputV2Error(`expected ${lane} evidence envelope, received ${envelope.lane}`, "WRONG_ENVELOPE_LANE");
  }
}

export function buildReaderExperienceInlineReviewTask(envelope: ReviewEvidenceEnvelopeV1): string {
  requireLane(envelope, "reader");
  return buildInlineReviewTask({
    envelope,
    outputSchema: READER_EXPERIENCE_MODEL_OUTPUT_V2_SCHEMA,
    roleInstructions: [
      "Act only as the reader-experience reviewer. Judge the complete key-free reader-facing chapter.",
      "External factual truth and source contradiction are outside your authority. Use origin_ambiguous_to_reader when source status is unclear on the page.",
      "Use evidenceRefIds for every finding, strongest/weakest judgment, and each quiz derivation. Do not emit hashes, reviewer identity, route data, or copied evidence spans.",
      "Your recommendation is advisory; it cannot determine the aggregate result.",
    ].join("\n"),
  });
}

export function buildSourceIntegrityInlineReviewTask(envelope: ReviewEvidenceEnvelopeV1): string {
  requireLane(envelope, "source");
  return buildInlineReviewTask({
    envelope,
    outputSchema: SOURCE_INTEGRITY_MODEL_OUTPUT_V2_SCHEMA,
    roleInstructions: [
      "Act only as the source-and-claim-integrity reviewer. Judge each packet-local targetRef against the inline chapter, plan, source, mechanism, and anchor evidence.",
      `Freeze primary-category precedence exactly as: ${SOURCE_PRIMARY_CATEGORY_PRECEDENCE_V2.join(" > ")}.`,
      "Emit semantic assessments only. Do not emit or infer finding IDs, real unit IDs, origin/form/claim-strength labels, hashes, storage paths, a top-level result, or blockingFindingIds.",
      "Use chapterEvidenceRefIds and sourceEvidenceRefIds; never copy serialized JSON spans.",
    ].join("\n"),
  });
}

export function buildQuizIntegrityInlineReviewTask(envelope: ReviewEvidenceEnvelopeV1): string {
  requireLane(envelope, "quiz");
  return buildInlineReviewTask({
    envelope,
    outputSchema: QUIZ_INTEGRITY_MODEL_OUTPUT_V2_SCHEMA,
    roleInstructions: [
      "Act only as the quiz-integrity adjudicator. Judge each packet-local questionRef using the inline prompt, indexed choices, key-free chapter evidence, committed derivation, stored key, and key explanation.",
      "Emit semantic adjudication only. Do not emit internal item IDs, keyed indices, committed derived indices, agreement, hashes, document identity, or reviewer session identity.",
      "Use evidenceRefIds for the question, choices, chapter mechanism evidence, key, and key explanation.",
    ].join("\n"),
  });
}

function requireNonEmptyBindings(bindings: Record<string, string>, where: string): void {
  for (const [key, value] of Object.entries(bindings)) {
    if (typeof value !== "string" || value.trim().length === 0) {
      throw new ReviewModelOutputV2Error(`${where}.${key} must be non-empty`, "INVALID_BINDING");
    }
  }
}

function validateRouteEvidence(route: ReviewRouteEvidenceV2): ReviewRouteEvidenceV2 {
  requireNonEmptyBindings(route, "routeEvidence");
  return { ...route };
}

function assertReaderOutput(output: ReaderExperienceModelOutputV2): void {
  const errors = validateReaderExperienceModelOutputV2(output);
  if (errors.length > 0) throw new ReviewModelOutputV2Error(errors.join("; "), "INVALID_MODEL_OUTPUT");
  const authorityViolations = readerAuthorityViolationsV2(output);
  if (authorityViolations.length > 0) {
    const first = authorityViolations[0];
    throw new ReviewModelOutputV2Error(
      `reader authority violation at ${first.surface}: ${first.kind}`,
      "READER_AUTHORITY_VIOLATION",
    );
  }
}

function resolveReaderFindings<C extends string>(
  envelope: ReviewEvidenceEnvelopeV1,
  findings: Array<ReaderExperienceModelFindingV2<C>>,
  where: string,
): Array<ReaderExperienceFindingV2<C>> {
  return findings.map((finding, index) => {
    const resolved = resolveEvidenceRefIds(envelope, finding.evidenceRefIds, {
      allowedKinds: ["chapter"],
      where: `${where}[${index}].evidenceRefIds`,
    });
    return { ...finding, evidenceSpans: resolved.evidenceSpans };
  });
}

export type AssembleReaderExperienceReviewV2Input = {
  output: ReaderExperienceModelOutputV2;
  envelope: ReviewEvidenceEnvelopeV1;
  chapterContentSha256: string;
  readerDocumentSha256: string;
  schemaSha256: string;
  rubricVersion: string;
  routeEvidence: ReviewRouteEvidenceV2;
};

export function assembleReaderExperienceReviewV2(input: AssembleReaderExperienceReviewV2Input): ReaderExperienceReviewV2 {
  requireLane(input.envelope, "reader");
  assertReaderOutput(input.output);
  requireNonEmptyBindings({
    chapterContentSha256: input.chapterContentSha256,
    readerDocumentSha256: input.readerDocumentSha256,
    schemaSha256: input.schemaSha256,
    rubricVersion: input.rubricVersion,
  }, "readerAssembly");
  const quizEvidence = resolveEvidenceRefGroups(input.envelope, input.output.quizDerivation.evidenceRefIds, {
    allowedKinds: ["chapter"],
    where: "reader.quizDerivation.evidenceRefIds",
  });
  const strongest = resolveEvidenceRefIds(input.envelope, input.output.strongestEvidenceRefIds, {
    allowedKinds: ["chapter"],
    where: "reader.strongestEvidenceRefIds",
  });
  const weakest = resolveEvidenceRefIds(input.envelope, input.output.weakestEvidenceRefIds, {
    allowedKinds: ["chapter"],
    where: "reader.weakestEvidenceRefIds",
  });
  return {
    schema: "reader-experience-review-v2",
    reviewerRole: "reader-experience",
    chapterContentSha256: input.chapterContentSha256,
    readerDocumentSha256: input.readerDocumentSha256,
    evidenceEnvelopeSha256: input.envelope.envelopeSha256,
    schemaSha256: input.schemaSha256,
    rubricVersion: input.rubricVersion,
    routeEvidence: validateRouteEvidence(input.routeEvidence),
    scores: { ...input.output.scores },
    quizDerivation: {
      ...input.output.quizDerivation,
      answers: [...input.output.quizDerivation.answers],
      mechanisms: [...input.output.quizDerivation.mechanisms],
      confidence: [...input.output.quizDerivation.confidence],
      ambiguities: [...input.output.quizDerivation.ambiguities],
      tells: [...input.output.quizDerivation.tells],
      evidenceRefIds: input.output.quizDerivation.evidenceRefIds.map((refs) => [...refs]),
      evidenceSpans: quizEvidence.map((resolved) => resolved.evidenceSpans),
    },
    recommendation: input.output.recommendation,
    blockingFindings: resolveReaderFindings(input.envelope, input.output.blockingFindings, "reader.blockingFindings"),
    escalationSignals: resolveReaderFindings(input.envelope, input.output.escalationSignals, "reader.escalationSignals"),
    advisoryFindings: resolveReaderFindings(input.envelope, input.output.advisoryFindings, "reader.advisoryFindings"),
    strongestEvidenceRefIds: strongest.evidenceRefIds,
    strongestEvidenceSpans: strongest.evidenceSpans,
    weakestEvidenceRefIds: weakest.evidenceRefIds,
    weakestEvidenceSpans: weakest.evidenceSpans,
    oneParagraphVerdict: input.output.oneParagraphVerdict,
  };
}

// ── Source assembly and conductor-derived outcome ───────────────────────────

export function sourcePrimaryCategoryByPrecedence(
  categories: readonly SourcePrimaryCategoryV2[],
): SourcePrimaryCategoryV2 | null {
  return SOURCE_PRIMARY_CATEGORY_PRECEDENCE_V2.find((category) => categories.includes(category)) ?? null;
}

export type DerivedSourceIntegrityResultV2 = {
  result: SourceIntegrityResultV2;
  blockingFindingIds: string[];
};

export function deriveSourceIntegrityResultV2(
  units: readonly SourceIntegrityReviewUnitV2[],
  unresolvedTargetRefs: readonly string[] = [],
): DerivedSourceIntegrityResultV2 {
  const blockingFindingIds = new Set<string>();
  let inconclusive = unresolvedTargetRefs.length > 0;
  let revise = false;

  for (const unit of units) {
    if (unit.supportStatus === "INCONCLUSIVE") inconclusive = true;
    if (unit.supportStatus === "PARTIALLY_SUPPORTED") revise = true;
    if (unit.visibleRegister === "ambiguous") revise = true;
    // These semantic fields describe the prose the reviewer actually saw. A
    // model may omit the corresponding finding, but it cannot turn an
    // acknowledged license violation into PASS by doing so. Source-bound prose
    // may state a supported fact directly; constructed and generic material may
    // never cross into a factual register. Other explicit origin/register
    // substitutions are likewise incompatible with the conductor-owned plan.
    const registerCompatible = unit.visibleRegister === "ambiguous"
      || (unit.expectedOrigin === "source_bound"
        ? unit.visibleRegister === "clearly_sourced" || unit.visibleRegister === "presented_as_fact"
        : unit.expectedOrigin === "constructed"
          ? unit.visibleRegister === "clearly_constructed"
          : unit.visibleRegister === "clearly_generic");
    if (!registerCompatible) blockingFindingIds.add(`${unit.targetRef}:visible-register-incompatible`);
    if (unit.namedSpecificityAllowed === false) {
      blockingFindingIds.add(`${unit.targetRef}:named-specificity-forbidden`);
    }
    for (const finding of unit.findings) {
      if (finding.primaryCategory === "missing_required_evidence") inconclusive = true;
      else if (finding.severity === "blocker") blockingFindingIds.add(finding.findingId);
      else revise = true;
    }
    if (unit.requiredSourceSupport && unit.supportStatus === "UNSUPPORTED") {
      blockingFindingIds.add(`${unit.targetRef}:required-source-support`);
    }
    // A source-bound unit can PASS only when its required source support was
    // actually adjudicated. NOT_APPLICABLE is valid for constructed/generic
    // material, but on a required source-bound target it is an unresolved
    // instrument outcome—not evidence of support.
    if (unit.requiredSourceSupport && unit.supportStatus === "NOT_APPLICABLE") {
      inconclusive = true;
    }
    if (unit.claimStrengthFit === false) blockingFindingIds.add(`${unit.targetRef}:claim-strength-fit`);
    if (unit.framingRequired && unit.framingAdequate === false) blockingFindingIds.add(`${unit.targetRef}:visible-framing`);
  }

  if (inconclusive) return { result: "INCONCLUSIVE", blockingFindingIds: [...blockingFindingIds].sort() };
  if (blockingFindingIds.size > 0) return { result: "BLOCK", blockingFindingIds: [...blockingFindingIds].sort() };
  if (revise) return { result: "REVISE", blockingFindingIds: [] };
  return { result: "PASS", blockingFindingIds: [] };
}

function assertSourceOutput(output: SourceIntegrityModelOutputV2): void {
  const errors = validateSourceIntegrityModelOutputV2(output);
  if (errors.length > 0) throw new ReviewModelOutputV2Error(errors.join("; "), "INVALID_MODEL_OUTPUT");
}

const SOURCE_OR_PLAN_KINDS: readonly ReviewEvidenceKind[] = ["source_claim", "source_mechanism", "source_anchor", "plan"];
const SOURCE_ONLY_KINDS: readonly ReviewEvidenceKind[] = ["source_claim", "source_mechanism", "source_anchor"];

function assembleSourceFinding(
  envelope: ReviewEvidenceEnvelopeV1,
  binding: SourceTargetBindingV2,
  finding: SourceIntegrityModelFindingV2,
  findingIndex: number,
  where: string,
): SourceIntegrityFindingV2 {
  const chapter = resolveEvidenceRefIds(envelope, finding.chapterEvidenceRefIds, {
    allowedKinds: ["chapter"],
    where: `${where}.chapterEvidenceRefIds`,
  });
  const source = resolveEvidenceRefIds(envelope, finding.sourceEvidenceRefIds, {
    allowedKinds: SOURCE_OR_PLAN_KINDS,
    required: false,
    where: `${where}.sourceEvidenceRefIds`,
  });
  const hasActualSource = source.segments.some((segment) => SOURCE_ONLY_KINDS.includes(segment.kind));
  if (binding.expectedOrigin === "source_bound" && finding.primaryCategory !== "missing_required_evidence" && !hasActualSource) {
    throw new ReviewModelOutputV2Error(`${where}: source-bound finding requires source evidence`, "INVALID_EVIDENCE");
  }
  if (
    binding.expectedOrigin !== "source_bound"
    && (finding.primaryCategory === "missing_visible_framing" || finding.primaryCategory === "generic_specificity_leak")
    && !source.segments.some((segment) => segment.kind === "plan")
  ) {
    throw new ReviewModelOutputV2Error(`${where}: constructed/generic register finding requires plan evidence`, "INVALID_EVIDENCE");
  }
  return {
    ...finding,
    findingId: `${binding.unitId}:source-finding:${String(findingIndex + 1).padStart(3, "0")}`,
    chapterEvidenceRefIds: chapter.evidenceRefIds,
    chapterEvidenceSpans: chapter.evidenceSpans,
    sourceEvidenceRefIds: source.evidenceRefIds,
    sourceEvidenceSpans: source.evidenceSpans,
  };
}

export type AssembleSourceIntegrityReviewV2Input = {
  output: SourceIntegrityModelOutputV2;
  envelope: ReviewEvidenceEnvelopeV1;
  targetBindings: SourceTargetBindingV2[];
  chapterContentSha256: string;
  sourceUsePlanSha256: string;
  sourcePacketSha256: string;
  sidecarSha256: string;
  schemaSha256: string;
  routeEvidence: ReviewRouteEvidenceV2;
};

function validateSourceTargetBindings(bindings: readonly SourceTargetBindingV2[]): void {
  if (bindings.length === 0) throw new ReviewModelOutputV2Error("source target bindings must be non-empty", "INVALID_BINDING");
  const targetRefs = new Set<string>();
  const unitIds = new Set<string>();
  for (const binding of bindings) {
    requireNonEmptyBindings({ targetRef: binding.targetRef, unitId: binding.unitId }, "sourceTargetBinding");
    if (targetRefs.has(binding.targetRef)) throw new ReviewModelOutputV2Error(`duplicate source targetRef ${binding.targetRef}`, "INVALID_BINDING");
    if (unitIds.has(binding.unitId)) throw new ReviewModelOutputV2Error(`duplicate source unitId ${binding.unitId}`, "INVALID_BINDING");
    targetRefs.add(binding.targetRef);
    unitIds.add(binding.unitId);
    if (binding.requiredSourceSupport && binding.expectedOrigin !== "source_bound") {
      throw new ReviewModelOutputV2Error(`${binding.targetRef}: only source_bound targets may require source support`, "INVALID_BINDING");
    }
  }
}

export function assembleSourceIntegrityReviewV2(input: AssembleSourceIntegrityReviewV2Input): SourceIntegrityReviewV2 {
  requireLane(input.envelope, "source");
  assertSourceOutput(input.output);
  validateSourceTargetBindings(input.targetBindings);
  requireNonEmptyBindings({
    chapterContentSha256: input.chapterContentSha256,
    sourceUsePlanSha256: input.sourceUsePlanSha256,
    sourcePacketSha256: input.sourcePacketSha256,
    sidecarSha256: input.sidecarSha256,
    schemaSha256: input.schemaSha256,
  }, "sourceAssembly");

  const bindingsByRef = new Map(input.targetBindings.map((binding) => [binding.targetRef, binding]));
  const assessmentsByRef = new Map<string, SourceIntegrityModelAssessmentV2>();
  for (const assessment of input.output.assessments) {
    if (!bindingsByRef.has(assessment.targetRef)) {
      throw new ReviewModelOutputV2Error(`unknown packet-local source target ${assessment.targetRef}`, "UNKNOWN_TARGET");
    }
    assessmentsByRef.set(assessment.targetRef, assessment);
  }
  const unresolvedTargetRefs = input.targetBindings
    .filter((binding) => !assessmentsByRef.has(binding.targetRef))
    .map((binding) => binding.targetRef);
  const units: SourceIntegrityReviewUnitV2[] = input.targetBindings.flatMap((binding) => {
    const assessment = assessmentsByRef.get(binding.targetRef);
    if (!assessment) return [];
    return [{
      ...assessment,
      unitId: binding.unitId,
      expectedOrigin: binding.expectedOrigin,
      expectedForm: binding.expectedForm,
      claimStrengthExpected: binding.claimStrengthExpected,
      framingRequired: binding.framingRequired,
      requiredSourceSupport: binding.requiredSourceSupport,
      findings: assessment.findings.map((finding, index) => assembleSourceFinding(
        input.envelope,
        binding,
        finding,
        index,
        `source.${binding.targetRef}.findings[${index}]`,
      )),
    }];
  });
  const derived = deriveSourceIntegrityResultV2(units, unresolvedTargetRefs);
  const rationaleParts = units.map((unit) => `${unit.targetRef}: ${unit.rationale}`);
  if (unresolvedTargetRefs.length > 0) rationaleParts.push(`unresolved targets: ${unresolvedTargetRefs.join(", ")}`);
  return {
    schema: "source-integrity-review-v2",
    reviewerRole: "source-integrity",
    chapterContentSha256: input.chapterContentSha256,
    sourceUsePlanSha256: input.sourceUsePlanSha256,
    sourcePacketSha256: input.sourcePacketSha256,
    sidecarSha256: input.sidecarSha256,
    evidenceEnvelopeSha256: input.envelope.envelopeSha256,
    schemaSha256: input.schemaSha256,
    routeEvidence: validateRouteEvidence(input.routeEvidence),
    units,
    unresolvedTargetRefs,
    result: derived.result,
    blockingFindingIds: derived.blockingFindingIds,
    rationale: rationaleParts.join("\n"),
  };
}

// ── Quiz assembly and conductor-derived outcome ─────────────────────────────

function assertQuizOutput(output: QuizIntegrityModelOutputV2): void {
  const errors = validateQuizIntegrityModelOutputV2(output);
  if (errors.length > 0) throw new ReviewModelOutputV2Error(errors.join("; "), "INVALID_MODEL_OUTPUT");
}

function validateQuizBindings(bindings: readonly QuizQuestionBindingV2[]): void {
  if (bindings.length === 0) throw new ReviewModelOutputV2Error("quiz question bindings must be non-empty", "INVALID_BINDING");
  const refs = new Set<string>();
  const ids = new Set<string>();
  const evidencePrefixes = new Set<string>();
  for (const binding of bindings) {
    requireNonEmptyBindings({
      questionRef: binding.questionRef,
      evidenceRefPrefix: binding.evidenceRefPrefix,
      itemId: binding.itemId,
    }, "quizQuestionBinding");
    if (refs.has(binding.questionRef)) throw new ReviewModelOutputV2Error(`duplicate quiz questionRef ${binding.questionRef}`, "INVALID_BINDING");
    if (ids.has(binding.itemId)) throw new ReviewModelOutputV2Error(`duplicate quiz itemId ${binding.itemId}`, "INVALID_BINDING");
    if (evidencePrefixes.has(binding.evidenceRefPrefix)) {
      throw new ReviewModelOutputV2Error(`duplicate quiz evidenceRefPrefix ${binding.evidenceRefPrefix}`, "INVALID_BINDING");
    }
    refs.add(binding.questionRef);
    ids.add(binding.itemId);
    evidencePrefixes.add(binding.evidenceRefPrefix);
    if (!Number.isSafeInteger(binding.choiceCount) || binding.choiceCount < 2) throw new ReviewModelOutputV2Error(`${binding.questionRef}: invalid choiceCount`, "INVALID_BINDING");
    for (const field of ["keyedAnswerIndex", "committedDerivedAnswerIndex"] as const) {
      if (!Number.isSafeInteger(binding[field]) || binding[field] < 0 || binding[field] >= binding.choiceCount) {
        throw new ReviewModelOutputV2Error(`${binding.questionRef}: ${field} is out of range`, "INVALID_BINDING");
      }
    }
  }
}

const QUIZ_ALLOWED_KINDS: readonly ReviewEvidenceKind[] = [
  "chapter", "quiz_prompt", "quiz_choice", "quiz_derivation", "quiz_key", "quiz_explanation",
];
const QUIZ_REQUIRED_JUDGMENT_KINDS: readonly ReviewEvidenceKind[] = [
  "chapter", "quiz_prompt", "quiz_choice", "quiz_key", "quiz_explanation",
];

function assembleQuizItem(
  envelope: ReviewEvidenceEnvelopeV1,
  binding: QuizQuestionBindingV2,
  item: QuizIntegrityModelItemV2,
) {
  const evidence = resolveEvidenceRefIds(envelope, item.evidenceRefIds, {
    allowedKinds: QUIZ_ALLOWED_KINDS,
    where: `quiz.${binding.questionRef}.evidenceRefIds`,
  });
  const foreignQuestionEvidence = evidence.segments.filter(
    (segment) => segment.kind !== "chapter" && !segment.refId.startsWith(`${binding.evidenceRefPrefix}-`),
  );
  if (foreignQuestionEvidence.length > 0) {
    throw new ReviewModelOutputV2Error(
      `quiz.${binding.questionRef}: evidence crosses the conductor-owned question namespace: ${foreignQuestionEvidence.map((segment) => segment.refId).join(", ")}`,
      "INVALID_EVIDENCE",
    );
  }
  const missingKinds = QUIZ_REQUIRED_JUDGMENT_KINDS.filter(
    (kind) => !evidence.segments.some((segment) => segment.kind === kind),
  );
  if (missingKinds.length > 0) {
    throw new ReviewModelOutputV2Error(
      `quiz.${binding.questionRef}: judgment evidence missing kind(s) ${missingKinds.join(", ")}`,
      "INVALID_EVIDENCE",
    );
  }
  const requiredQuestionRefs = [
    `${binding.evidenceRefPrefix}-PROMPT`,
    ...Array.from({ length: binding.choiceCount }, (_, index) =>
      `${binding.evidenceRefPrefix}-CHOICE-${String(index).padStart(3, "0")}`),
    `${binding.evidenceRefPrefix}-KEY`,
    `${binding.evidenceRefPrefix}-EXPLANATION`,
  ];
  const citedRefs = new Set(evidence.evidenceRefIds);
  const missingQuestionRefs = requiredQuestionRefs.filter((refId) => !citedRefs.has(refId));
  if (missingQuestionRefs.length > 0) {
    throw new ReviewModelOutputV2Error(
      `quiz.${binding.questionRef}: judgment evidence omits conductor-owned ref(s) ${missingQuestionRefs.join(", ")}`,
      "INVALID_EVIDENCE",
    );
  }
  if (item.defensibleAnswerIndices.some((index) => index >= binding.choiceCount)) {
    throw new ReviewModelOutputV2Error(`quiz.${binding.questionRef}: defensible answer index out of range`, "INVALID_MODEL_OUTPUT");
  }
  return {
    ...item,
    itemId: binding.itemId,
    keyedAnswerIndex: binding.keyedAnswerIndex,
    committedDerivedAnswerIndex: binding.committedDerivedAnswerIndex,
    agreement: binding.keyedAnswerIndex === binding.committedDerivedAnswerIndex,
    keyCorrectDerived: item.keyCorrect === "correct"
      && item.defensibleAnswerIndices.length === 1
      && item.defensibleAnswerIndices[0] === binding.keyedAnswerIndex,
    uniqueAnswer: item.defensibleAnswerIndices.length === 1,
    mechanismSupported: item.keyedMechanismSupported,
    tellDetected: binding.tellDetected,
    evidenceRefIds: evidence.evidenceRefIds,
    evidenceSpans: evidence.evidenceSpans,
  };
}

export type AssembleQuizIntegrityReviewV2Input = {
  output: QuizIntegrityModelOutputV2;
  envelope: ReviewEvidenceEnvelopeV1;
  questionBindings: QuizQuestionBindingV2[];
  chapterContentSha256: string;
  phase2DocumentSha256: string;
  derivationSha256: string;
  schemaSha256: string;
  routeEvidence: ReviewRouteEvidenceV2;
};

export function assembleQuizIntegrityReviewV2(input: AssembleQuizIntegrityReviewV2Input): QuizIntegrityReviewV2 {
  requireLane(input.envelope, "quiz");
  assertQuizOutput(input.output);
  validateQuizBindings(input.questionBindings);
  requireNonEmptyBindings({
    chapterContentSha256: input.chapterContentSha256,
    phase2DocumentSha256: input.phase2DocumentSha256,
    derivationSha256: input.derivationSha256,
    schemaSha256: input.schemaSha256,
  }, "quizAssembly");
  const bindingsByRef = new Map(input.questionBindings.map((binding) => [binding.questionRef, binding]));
  const itemsByRef = new Map<string, QuizIntegrityModelItemV2>();
  for (const item of input.output.items) {
    if (!bindingsByRef.has(item.questionRef)) {
      throw new ReviewModelOutputV2Error(`unknown packet-local quiz target ${item.questionRef}`, "UNKNOWN_TARGET");
    }
    itemsByRef.set(item.questionRef, item);
  }
  const unresolvedQuestionRefs = input.questionBindings
    .filter((binding) => !itemsByRef.has(binding.questionRef))
    .map((binding) => binding.questionRef);
  const questions = input.questionBindings.flatMap((binding) => {
    const item = itemsByRef.get(binding.questionRef);
    return item ? [assembleQuizItem(input.envelope, binding, item)] : [];
  });
  const result: QuizIntegrityReviewV2["result"] = unresolvedQuestionRefs.length > 0
    ? "INCONCLUSIVE"
    : questions.some((question) => !question.keyCorrectDerived || !question.uniqueAnswer || !question.mechanismSupported)
      ? "BLOCK"
      : "PASS";
  return {
    schema: "quiz-integrity-review-v2",
    reviewerRole: "quiz-integrity",
    chapterContentSha256: input.chapterContentSha256,
    phase2DocumentSha256: input.phase2DocumentSha256,
    derivationSha256: input.derivationSha256,
    evidenceEnvelopeSha256: input.envelope.envelopeSha256,
    schemaSha256: input.schemaSha256,
    routeEvidence: validateRouteEvidence(input.routeEvidence),
    questions,
    unresolvedQuestionRefs,
    result,
  };
}

// ── Explicit V2 → frozen aggregate-input V1 projections ─────────────────────

/**
 * These adapters do not mutate or replace V2 evidence.  They create the narrow
 * legacy views consumed by the existing deterministic aggregator while the V2
 * records remain the authoritative retained artifacts.
 */
export function adaptReaderExperienceReviewV2ToV1(review: ReaderExperienceReviewV2): ReaderExperienceReviewV1 {
  return {
    schema: "reader-experience-review-v1",
    reviewerRole: "reader-experience",
    chapterContentSha256: review.chapterContentSha256,
    readerDocumentSha256: review.readerDocumentSha256,
    // This is a deliberately narrow V1 aggregate projection. The authoritative
    // V2 record above retains the IMP-24 instrument identity; the frozen V1
    // freshness helper requires its own legacy rubric tag.
    rubricVersion: READER_EXPERIENCE_RUBRIC_VERSION,
    schemaSha256: review.schemaSha256,
    scores: { ...review.scores },
    quizDerivation: {
      answers: [...review.quizDerivation.answers],
      mechanisms: [...review.quizDerivation.mechanisms],
      confidence: [...review.quizDerivation.confidence],
      ambiguities: [...review.quizDerivation.ambiguities],
      tells: [...review.quizDerivation.tells],
    },
    recommendation: review.recommendation,
    blockingFindings: review.blockingFindings.map(({ category, unit, problem, evidenceSpans }) => ({ category, unit, problem, evidenceSpans: [...evidenceSpans] })),
    escalationSignals: review.escalationSignals.map(({ category, unit, problem, evidenceSpans }) => ({ category, unit, problem, evidenceSpans: [...evidenceSpans] })),
    advisoryFindings: review.advisoryFindings.map(({ category, unit, problem, evidenceSpans }) => ({ category, unit, problem, evidenceSpans: [...evidenceSpans] })),
    strongestEvidence: [...review.strongestEvidenceSpans],
    weakestEvidence: [...review.weakestEvidenceSpans],
    oneParagraphVerdict: review.oneParagraphVerdict,
  };
}

function uniqueStrings(values: readonly string[]): string[] {
  return [...new Set(values)];
}

export type SourceIntegrityAggregateV1Projection = {
  review: SourceIntegrityReviewV1;
  /** V1 has no REVISE value.  This explicit flag preserves that V2 outcome for
   *  the integration wrapper instead of silently relabeling it. */
  sourceRevisionRequired: boolean;
  authoritativeV2Result: SourceIntegrityResultV2;
};

export function adaptSourceIntegrityReviewV2ToV1(review: SourceIntegrityReviewV2): SourceIntegrityAggregateV1Projection {
  const sourceRevisionRequired = review.result === "REVISE";
  return {
    authoritativeV2Result: review.result,
    sourceRevisionRequired,
    review: {
      schema: "source-integrity-review-v1",
      reviewerRole: "source-integrity",
      chapterContentSha256: review.chapterContentSha256,
      sourceUsePlanSha256: review.sourceUsePlanSha256,
      sourcePacketSha256: review.sourcePacketSha256,
      sidecarSha256: review.sidecarSha256,
      schemaSha256: review.schemaSha256,
      units: review.units.map((unit) => ({
        unitId: unit.unitId,
        expectedOrigin: unit.expectedOrigin,
        expectedForm: unit.expectedForm,
        claimStrengthExpected: unit.claimStrengthExpected,
        visibleRegister: unit.visibleRegister,
        supportStatus: unit.supportStatus,
        framingAdequate: unit.framingAdequate,
        claimStrengthFit: unit.claimStrengthFit,
        namedSpecificityAllowed: unit.namedSpecificityAllowed,
        chapterEvidenceSpans: uniqueStrings(unit.findings.flatMap((finding) => finding.chapterEvidenceSpans)),
        sourceEvidenceSpans: uniqueStrings(unit.findings.flatMap((finding) => finding.sourceEvidenceSpans)),
        findings: unit.findings.map((finding) => ({
          category: finding.primaryCategory,
          severity: finding.severity,
          explanation: finding.explanation,
        })),
      })),
      // Preserve the authoritative non-PASS disposition conservatively.  The
      // explicit flag above lets the V2 integration wrapper retain REVISE rather
      // than pretending this projection is the authoritative result.
      result: review.result === "REVISE" ? "INCONCLUSIVE" : review.result,
      blockingFindingIds: [...review.blockingFindingIds],
      rationale: review.rationale,
    },
  };
}

function answerLetter(index: number, where: string): "a" | "b" | "c" {
  if (index === 0) return "a";
  if (index === 1) return "b";
  if (index === 2) return "c";
  throw new ReviewModelOutputV2Error(`${where}: V1 aggregate adapter supports exactly the frozen a|b|c answer space`, "INVALID_BINDING");
}

export function adaptQuizIntegrityReviewV2ToV1(review: QuizIntegrityReviewV2): QuizIntegrityResultV1 {
  return {
    schema: "quiz-integrity-result-v1",
    chapterContentSha256: review.chapterContentSha256,
    derivationSha256: review.derivationSha256,
    questions: review.questions.map((question) => ({
      itemId: question.itemId,
      derivedAnswer: answerLetter(question.committedDerivedAnswerIndex, question.questionRef),
      keyedAnswer: answerLetter(question.keyedAnswerIndex, question.questionRef),
      keyCorrect: question.keyCorrectDerived,
      uniqueAnswer: question.uniqueAnswer,
      defensibleAlternatives: question.defensibleAnswerIndices.map((index) => answerLetter(index, question.questionRef)),
      mechanismSupported: question.mechanismSupported,
      tellDetected: question.tellDetected,
      explanation: question.rationale,
      evidenceSpans: [...question.evidenceSpans],
    })),
    result: review.result,
  };
}
