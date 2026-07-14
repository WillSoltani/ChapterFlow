/**
 * IMP-24 semantic-only reviewer outputs and conductor-assembled V2 records.
 *
 * Model contracts intentionally omit every immutable identity/hash/result field.
 * The conductor maps packet-local references, stamps bindings, resolves evidence,
 * and derives final lane outcomes.
 */

import { REVIEW_FACTORS, type ReviewFactor } from "../artifacts/artifactTypes.js";
import { type ContractDescriptor } from "./contractUtil.js";
import {
  READER_ADVISORY_CATEGORIES,
  READER_BLOCKING_CATEGORIES,
  READER_ESCALATION_CATEGORIES,
  type ReaderAdvisoryCategoryV1,
  type ReaderBlockingCategoryV1,
  type ReaderEscalationCategoryV1,
} from "./readerExperienceReview.js";
import {
  SOURCE_SUPPORT_STATUSES,
  SOURCE_VISIBLE_REGISTERS,
  type SupportStatusV1,
  type VisibleRegisterV1,
} from "./sourceIntegrityReview.js";
import type { ClaimStrengthV1, SourceOriginV1, UnitFormV1 } from "./sourceUsePlan.js";

export const READER_EXPERIENCE_MODEL_OUTPUT_V2_SCHEMA = "reader-experience-model-output-v2" as const;
export const SOURCE_INTEGRITY_MODEL_OUTPUT_V2_SCHEMA = "source-integrity-model-output-v2" as const;
export const QUIZ_INTEGRITY_MODEL_OUTPUT_V2_SCHEMA = "quiz-integrity-model-output-v2" as const;

export const SOURCE_PRIMARY_CATEGORY_PRECEDENCE_V2 = [
  "source_contradiction",
  "unsupported_attribution",
  "claim_strength_overreach",
  "missing_visible_framing",
  "generic_specificity_leak",
  "invented_detail",
  "missing_required_evidence",
] as const;
export type SourcePrimaryCategoryV2 = (typeof SOURCE_PRIMARY_CATEGORY_PRECEDENCE_V2)[number];
export type SourceFindingSeverityV2 = "blocker" | "major" | "minor";

export type ReviewRouteEvidenceV2 = {
  model: string;
  effort: string;
  routeReceiptSha256: string;
};

export type ResolvedEvidenceV2 = {
  evidenceRefIds: string[];
  evidenceSpans: string[];
};

// ── Reader ──────────────────────────────────────────────────────────────────

export type ReaderExperienceModelFindingV2<C extends string> = {
  category: C;
  unit: string;
  problem: string;
  evidenceRefIds: string[];
};

export type ReaderExperienceModelOutputV2 = {
  schema: typeof READER_EXPERIENCE_MODEL_OUTPUT_V2_SCHEMA;
  scores: Record<ReviewFactor, number>;
  quizDerivation: {
    answers: Array<"a" | "b" | "c">;
    mechanisms: string[];
    confidence: Array<"low" | "medium" | "high">;
    ambiguities: string[];
    tells: string[];
    evidenceRefIds: string[][];
  };
  recommendation: "SHIP" | "REVISE" | "BLOCK";
  blockingFindings: Array<ReaderExperienceModelFindingV2<ReaderBlockingCategoryV1>>;
  escalationSignals: Array<ReaderExperienceModelFindingV2<ReaderEscalationCategoryV1>>;
  advisoryFindings: Array<ReaderExperienceModelFindingV2<ReaderAdvisoryCategoryV1>>;
  strongestEvidenceRefIds: string[];
  weakestEvidenceRefIds: string[];
  oneParagraphVerdict: string;
};

export type ReaderExperienceFindingV2<C extends string> = ReaderExperienceModelFindingV2<C> & {
  evidenceSpans: string[];
};

export type ReaderExperienceReviewV2 = {
  schema: "reader-experience-review-v2";
  reviewerRole: "reader-experience";
  chapterContentSha256: string;
  readerDocumentSha256: string;
  evidenceEnvelopeSha256: string;
  schemaSha256: string;
  rubricVersion: string;
  routeEvidence: ReviewRouteEvidenceV2;
  scores: Record<ReviewFactor, number>;
  quizDerivation: ReaderExperienceModelOutputV2["quizDerivation"] & { evidenceSpans: string[][] };
  recommendation: "SHIP" | "REVISE" | "BLOCK";
  blockingFindings: Array<ReaderExperienceFindingV2<ReaderBlockingCategoryV1>>;
  escalationSignals: Array<ReaderExperienceFindingV2<ReaderEscalationCategoryV1>>;
  advisoryFindings: Array<ReaderExperienceFindingV2<ReaderAdvisoryCategoryV1>>;
  strongestEvidenceRefIds: string[];
  strongestEvidenceSpans: string[];
  weakestEvidenceRefIds: string[];
  weakestEvidenceSpans: string[];
  oneParagraphVerdict: string;
};

// ── Source ──────────────────────────────────────────────────────────────────

export type SourceIntegrityModelFindingV2 = {
  primaryCategory: SourcePrimaryCategoryV2;
  secondaryCategories: SourcePrimaryCategoryV2[];
  severity: SourceFindingSeverityV2;
  explanation: string;
  chapterEvidenceRefIds: string[];
  sourceEvidenceRefIds: string[];
};

export type SourceIntegrityModelAssessmentV2 = {
  targetRef: string;
  visibleRegister: VisibleRegisterV1;
  supportStatus: SupportStatusV1;
  framingAdequate: boolean | null;
  claimStrengthFit: boolean | null;
  namedSpecificityAllowed: boolean | null;
  findings: SourceIntegrityModelFindingV2[];
  rationale: string;
};

export type SourceIntegrityModelOutputV2 = {
  schema: typeof SOURCE_INTEGRITY_MODEL_OUTPUT_V2_SCHEMA;
  assessments: SourceIntegrityModelAssessmentV2[];
};

export type SourceTargetBindingV2 = {
  targetRef: string;
  unitId: string;
  expectedOrigin: SourceOriginV1;
  expectedForm: UnitFormV1;
  claimStrengthExpected: ClaimStrengthV1;
  framingRequired: boolean;
  requiredSourceSupport: boolean;
};

export type SourceIntegrityFindingV2 = SourceIntegrityModelFindingV2 & {
  findingId: string;
  chapterEvidenceSpans: string[];
  sourceEvidenceSpans: string[];
};

export type SourceIntegrityReviewUnitV2 = Omit<SourceIntegrityModelAssessmentV2, "findings"> & {
  unitId: string;
  expectedOrigin: SourceOriginV1;
  expectedForm: UnitFormV1;
  claimStrengthExpected: ClaimStrengthV1;
  framingRequired: boolean;
  requiredSourceSupport: boolean;
  findings: SourceIntegrityFindingV2[];
};

export type SourceIntegrityResultV2 = "PASS" | "REVISE" | "BLOCK" | "INCONCLUSIVE";

export type SourceIntegrityReviewV2 = {
  schema: "source-integrity-review-v2";
  reviewerRole: "source-integrity";
  chapterContentSha256: string;
  sourceUsePlanSha256: string;
  sourcePacketSha256: string;
  sidecarSha256: string;
  evidenceEnvelopeSha256: string;
  schemaSha256: string;
  routeEvidence: ReviewRouteEvidenceV2;
  units: SourceIntegrityReviewUnitV2[];
  unresolvedTargetRefs: string[];
  result: SourceIntegrityResultV2;
  blockingFindingIds: string[];
  rationale: string;
};

// ── Quiz ────────────────────────────────────────────────────────────────────

export type QuizIntegrityModelItemV2 = {
  questionRef: string;
  keyCorrect: "correct" | "ambiguous" | "wrong";
  defensibleAnswerIndices: number[];
  keyedMechanismSupported: boolean;
  rationale: string;
  evidenceRefIds: string[];
};

export type QuizIntegrityModelOutputV2 = {
  schema: typeof QUIZ_INTEGRITY_MODEL_OUTPUT_V2_SCHEMA;
  items: QuizIntegrityModelItemV2[];
};

export type QuizQuestionBindingV2 = {
  questionRef: string;
  /** Conductor-owned canonical evidence namespace (for example, Q001). */
  evidenceRefPrefix: string;
  itemId: string;
  choiceCount: number;
  keyedAnswerIndex: number;
  committedDerivedAnswerIndex: number;
  tellDetected: boolean;
};

export type QuizIntegrityQuestionV2 = QuizIntegrityModelItemV2 & {
  itemId: string;
  keyedAnswerIndex: number;
  committedDerivedAnswerIndex: number;
  agreement: boolean;
  keyCorrectDerived: boolean;
  uniqueAnswer: boolean;
  mechanismSupported: boolean;
  tellDetected: boolean;
  evidenceSpans: string[];
};

export type QuizIntegrityReviewV2 = {
  schema: "quiz-integrity-review-v2";
  reviewerRole: "quiz-integrity";
  chapterContentSha256: string;
  phase2DocumentSha256: string;
  derivationSha256: string;
  evidenceEnvelopeSha256: string;
  schemaSha256: string;
  routeEvidence: ReviewRouteEvidenceV2;
  questions: QuizIntegrityQuestionV2[];
  unresolvedQuestionRefs: string[];
  result: "PASS" | "BLOCK" | "INCONCLUSIVE";
};

// ── Strict model-output validators ──────────────────────────────────────────

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function requiredKeys(value: Record<string, unknown>, keys: readonly string[], errors: string[], where: string): void {
  for (const key of keys) if (!(key in value) || value[key] === undefined) errors.push(`${where}: missing required field "${key}"`);
}

function noUnknownKeys(value: Record<string, unknown>, keys: readonly string[], errors: string[], where: string): void {
  for (const key of Object.keys(value)) if (!keys.includes(key)) errors.push(`${where}: unknown key "${key}"`);
}

function exactKeys(value: Record<string, unknown>, keys: readonly string[], errors: string[], where: string): void {
  requiredKeys(value, keys, errors, where);
  noUnknownKeys(value, keys, errors, where);
}

function isEnum(value: unknown, allowed: readonly string[]): boolean {
  return typeof value === "string" && allowed.includes(value);
}

function validateStringArray(value: unknown, errors: string[], where: string, requireNonEmpty = false): value is string[] {
  if (!Array.isArray(value) || !value.every((item) => typeof item === "string")) {
    errors.push(`${where}: must be string[]`);
    return false;
  }
  if (requireNonEmpty && value.length === 0) errors.push(`${where}: must be non-empty`);
  return true;
}

/** Deterministic semantic uniqueness check for constraints that the installed
 * Codex structured-output transport cannot express. Each duplicate is reported
 * once, at the exact field, with the exact primitive value. */
function validateUniquePrimitiveValues(
  values: readonly (string | number)[],
  errors: string[],
  where: string,
): void {
  const seen = new Set<string | number>();
  const reported = new Set<string | number>();
  for (const value of values) {
    if (seen.has(value) && !reported.has(value)) {
      errors.push(`${where}: duplicate value ${JSON.stringify(value)}`);
      reported.add(value);
    }
    seen.add(value);
  }
}

function validateRefIds(value: unknown, errors: string[], where: string, requireNonEmpty = true): value is string[] {
  if (!validateStringArray(value, errors, where, requireNonEmpty)) return false;
  if (value.some((item) => item.length === 0)) errors.push(`${where}: references must be non-empty strings`);
  validateUniquePrimitiveValues(value, errors, where);
  return true;
}

function validateReaderFindingArray(
  value: unknown,
  categories: readonly string[],
  errors: string[],
  where: string,
): void {
  if (!Array.isArray(value)) {
    errors.push(`${where}: must be an array`);
    return;
  }
  const keys = ["category", "unit", "problem", "evidenceRefIds"] as const;
  value.forEach((item, index) => {
    const at = `${where}[${index}]`;
    if (!isRecord(item)) {
      errors.push(`${at}: not an object`);
      return;
    }
    exactKeys(item, keys, errors, at);
    if (!isEnum(item.category, categories)) errors.push(`${at}: invalid category "${String(item.category)}"`);
    if (typeof item.unit !== "string") errors.push(`${at}: unit must be a string`);
    if (typeof item.problem !== "string" || item.problem.trim().length === 0) errors.push(`${at}: problem must be non-empty`);
    validateRefIds(item.evidenceRefIds, errors, `${at}.evidenceRefIds`);
  });
}

export function validateReaderExperienceModelOutputV2(value: unknown): string[] {
  const errors: string[] = [];
  if (!isRecord(value)) return ["reader-model-output-v2: not an object"];
  const topKeys = [
    "schema", "scores", "quizDerivation", "recommendation", "blockingFindings", "escalationSignals",
    "advisoryFindings", "strongestEvidenceRefIds", "weakestEvidenceRefIds", "oneParagraphVerdict",
  ] as const;
  exactKeys(value, topKeys, errors, "reader-model-output-v2");
  if (value.schema !== READER_EXPERIENCE_MODEL_OUTPUT_V2_SCHEMA) errors.push("reader-model-output-v2: wrong schema tag");

  if (!isRecord(value.scores)) {
    errors.push("reader-model-output-v2.scores: must be an object");
  } else {
    exactKeys(value.scores, REVIEW_FACTORS, errors, "reader-model-output-v2.scores");
    for (const factor of REVIEW_FACTORS) {
      const score = value.scores[factor];
      if (typeof score !== "number" || !Number.isFinite(score) || score < 0 || score > 100) {
        errors.push(`reader-model-output-v2.scores.${factor}: must be a finite number in [0,100]`);
      }
    }
  }

  if (!isRecord(value.quizDerivation)) {
    errors.push("reader-model-output-v2.quizDerivation: must be an object");
  } else {
    const q = value.quizDerivation;
    const qKeys = ["answers", "mechanisms", "confidence", "ambiguities", "tells", "evidenceRefIds"] as const;
    exactKeys(q, qKeys, errors, "reader-model-output-v2.quizDerivation");
    if (!Array.isArray(q.answers) || q.answers.length === 0 || !q.answers.every((item) => isEnum(item, ["a", "b", "c"]))) {
      errors.push("reader-model-output-v2.quizDerivation.answers: must be a non-empty a|b|c[]");
    }
    validateStringArray(q.mechanisms, errors, "reader-model-output-v2.quizDerivation.mechanisms", true);
    if (!Array.isArray(q.confidence) || !q.confidence.every((item) => isEnum(item, ["low", "medium", "high"]))) {
      errors.push("reader-model-output-v2.quizDerivation.confidence: must be low|medium|high[]");
    }
    validateStringArray(q.ambiguities, errors, "reader-model-output-v2.quizDerivation.ambiguities");
    validateStringArray(q.tells, errors, "reader-model-output-v2.quizDerivation.tells");
    if (!Array.isArray(q.evidenceRefIds)) {
      errors.push("reader-model-output-v2.quizDerivation.evidenceRefIds: must be string[][]");
    } else {
      q.evidenceRefIds.forEach((refs, index) => validateRefIds(refs, errors, `reader-model-output-v2.quizDerivation.evidenceRefIds[${index}]`));
    }
    const answerCount = Array.isArray(q.answers) ? q.answers.length : -1;
    for (const [field, candidate] of [["mechanisms", q.mechanisms], ["confidence", q.confidence], ["evidenceRefIds", q.evidenceRefIds]] as const) {
      if (Array.isArray(candidate) && answerCount >= 0 && candidate.length !== answerCount) {
        errors.push(`reader-model-output-v2.quizDerivation.${field}: length must equal answers length`);
      }
    }
  }

  if (!isEnum(value.recommendation, ["SHIP", "REVISE", "BLOCK"])) errors.push("reader-model-output-v2: invalid recommendation");
  validateReaderFindingArray(value.blockingFindings, READER_BLOCKING_CATEGORIES, errors, "reader-model-output-v2.blockingFindings");
  validateReaderFindingArray(value.escalationSignals, READER_ESCALATION_CATEGORIES, errors, "reader-model-output-v2.escalationSignals");
  validateReaderFindingArray(value.advisoryFindings, READER_ADVISORY_CATEGORIES, errors, "reader-model-output-v2.advisoryFindings");
  validateRefIds(value.strongestEvidenceRefIds, errors, "reader-model-output-v2.strongestEvidenceRefIds");
  validateRefIds(value.weakestEvidenceRefIds, errors, "reader-model-output-v2.weakestEvidenceRefIds");
  if (typeof value.oneParagraphVerdict !== "string" || value.oneParagraphVerdict.trim().length === 0) {
    errors.push("reader-model-output-v2: oneParagraphVerdict must be non-empty");
  }
  return errors;
}

function validateSourceFinding(value: unknown, errors: string[], where: string): void {
  if (!isRecord(value)) {
    errors.push(`${where}: not an object`);
    return;
  }
  const keys = [
    "primaryCategory", "secondaryCategories", "severity", "explanation",
    "chapterEvidenceRefIds", "sourceEvidenceRefIds",
  ] as const;
  exactKeys(value, keys, errors, where);
  if (!isEnum(value.primaryCategory, SOURCE_PRIMARY_CATEGORY_PRECEDENCE_V2)) errors.push(`${where}: invalid primaryCategory`);
  if (!Array.isArray(value.secondaryCategories) || !value.secondaryCategories.every((item) => isEnum(item, SOURCE_PRIMARY_CATEGORY_PRECEDENCE_V2))) {
    errors.push(`${where}: secondaryCategories must use the frozen category enum`);
  } else {
    validateUniquePrimitiveValues(value.secondaryCategories as string[], errors, `${where}.secondaryCategories`);
    if (value.secondaryCategories.includes(value.primaryCategory)) errors.push(`${where}: primaryCategory cannot repeat as secondary`);
    if (isEnum(value.primaryCategory, SOURCE_PRIMARY_CATEGORY_PRECEDENCE_V2)) {
      const all = [value.primaryCategory as SourcePrimaryCategoryV2, ...value.secondaryCategories as SourcePrimaryCategoryV2[]];
      const expected = SOURCE_PRIMARY_CATEGORY_PRECEDENCE_V2.find((category) => all.includes(category));
      if (expected !== value.primaryCategory) errors.push(`${where}: primaryCategory violates frozen precedence; expected ${expected}`);
    }
  }
  if (!isEnum(value.severity, ["blocker", "major", "minor"])) errors.push(`${where}: invalid severity`);
  if (typeof value.explanation !== "string" || value.explanation.trim().length === 0) errors.push(`${where}: explanation must be non-empty`);
  validateRefIds(value.chapterEvidenceRefIds, errors, `${where}.chapterEvidenceRefIds`);
  validateRefIds(value.sourceEvidenceRefIds, errors, `${where}.sourceEvidenceRefIds`, false);
}

export function validateSourceIntegrityModelOutputV2(value: unknown): string[] {
  const errors: string[] = [];
  if (!isRecord(value)) return ["source-model-output-v2: not an object"];
  exactKeys(value, ["schema", "assessments"], errors, "source-model-output-v2");
  if (value.schema !== SOURCE_INTEGRITY_MODEL_OUTPUT_V2_SCHEMA) errors.push("source-model-output-v2: wrong schema tag");
  if (!Array.isArray(value.assessments) || value.assessments.length === 0) {
    errors.push("source-model-output-v2.assessments: must be a non-empty array");
    return errors;
  }
  const targetRefs = new Set<string>();
  const keys = [
    "targetRef", "visibleRegister", "supportStatus", "framingAdequate", "claimStrengthFit",
    "namedSpecificityAllowed", "findings", "rationale",
  ] as const;
  value.assessments.forEach((assessment, index) => {
    const where = `source-model-output-v2.assessments[${index}]`;
    if (!isRecord(assessment)) {
      errors.push(`${where}: not an object`);
      return;
    }
    exactKeys(assessment, keys, errors, where);
    if (typeof assessment.targetRef !== "string" || assessment.targetRef.length === 0) errors.push(`${where}: targetRef must be non-empty`);
    else if (targetRefs.has(assessment.targetRef)) errors.push(`${where}: duplicate targetRef "${assessment.targetRef}"`);
    else targetRefs.add(assessment.targetRef);
    if (!isEnum(assessment.visibleRegister, SOURCE_VISIBLE_REGISTERS)) errors.push(`${where}: invalid visibleRegister`);
    if (!isEnum(assessment.supportStatus, SOURCE_SUPPORT_STATUSES)) errors.push(`${where}: invalid supportStatus`);
    for (const field of ["framingAdequate", "claimStrengthFit", "namedSpecificityAllowed"] as const) {
      if (assessment[field] !== null && typeof assessment[field] !== "boolean") errors.push(`${where}.${field}: must be boolean|null`);
    }
    if (!Array.isArray(assessment.findings)) errors.push(`${where}.findings: must be an array`);
    else assessment.findings.forEach((finding, findingIndex) => validateSourceFinding(finding, errors, `${where}.findings[${findingIndex}]`));
    if (typeof assessment.rationale !== "string" || assessment.rationale.trim().length === 0) errors.push(`${where}: rationale must be non-empty`);
  });
  return errors;
}

export function validateQuizIntegrityModelOutputV2(value: unknown): string[] {
  const errors: string[] = [];
  if (!isRecord(value)) return ["quiz-model-output-v2: not an object"];
  exactKeys(value, ["schema", "items"], errors, "quiz-model-output-v2");
  if (value.schema !== QUIZ_INTEGRITY_MODEL_OUTPUT_V2_SCHEMA) errors.push("quiz-model-output-v2: wrong schema tag");
  if (!Array.isArray(value.items) || value.items.length === 0) {
    errors.push("quiz-model-output-v2.items: must be a non-empty array");
    return errors;
  }
  const refs = new Set<string>();
  const keys = ["questionRef", "keyCorrect", "defensibleAnswerIndices", "keyedMechanismSupported", "rationale", "evidenceRefIds"] as const;
  value.items.forEach((item, index) => {
    const where = `quiz-model-output-v2.items[${index}]`;
    if (!isRecord(item)) {
      errors.push(`${where}: not an object`);
      return;
    }
    exactKeys(item, keys, errors, where);
    if (typeof item.questionRef !== "string" || item.questionRef.length === 0) errors.push(`${where}: questionRef must be non-empty`);
    else if (refs.has(item.questionRef)) errors.push(`${where}: duplicate questionRef "${item.questionRef}"`);
    else refs.add(item.questionRef);
    if (!isEnum(item.keyCorrect, ["correct", "ambiguous", "wrong"])) errors.push(`${where}: invalid keyCorrect`);
    if (!Array.isArray(item.defensibleAnswerIndices) || item.defensibleAnswerIndices.length === 0
      || !item.defensibleAnswerIndices.every((answer) => Number.isSafeInteger(answer) && answer >= 0)) {
      errors.push(`${where}: defensibleAnswerIndices must be a non-empty non-negative integer[]`);
    } else {
      validateUniquePrimitiveValues(item.defensibleAnswerIndices, errors, `${where}.defensibleAnswerIndices`);
      if (item.keyCorrect === "ambiguous" && item.defensibleAnswerIndices.length < 2) errors.push(`${where}: ambiguous requires at least two defensible answers`);
      if (item.keyCorrect === "correct" && item.defensibleAnswerIndices.length !== 1) errors.push(`${where}: correct requires exactly one defensible answer`);
    }
    if (typeof item.keyedMechanismSupported !== "boolean") errors.push(`${where}: keyedMechanismSupported must be boolean`);
    if (typeof item.rationale !== "string" || item.rationale.trim().length === 0) errors.push(`${where}: rationale must be non-empty`);
    validateRefIds(item.evidenceRefIds, errors, `${where}.evidenceRefIds`);
  });
  return errors;
}

export const REVIEW_MODEL_OUTPUT_V2_CONTRACT: ContractDescriptor = {
  name: "review-model-output-v2",
  version: 2,
  ownerPrompt: "IMP-24",
  description: "Semantic-only reader, source, and quiz model outputs plus conductor-owned assembled V2 reviews. Packet-local evidence references replace copied spans; immutable identities and final outcomes are conductor-owned.",
  fields: {
    ReaderExperienceModelOutputV2: {
      schema: `\"${READER_EXPERIENCE_MODEL_OUTPUT_V2_SCHEMA}\"`,
      scores: "Record<ReviewFactor, number>",
      quizDerivation: "semantic derivation plus evidenceRefIds:string[][]",
      findings: "reader-authority categories plus evidenceRefIds:string[]",
      immutableEchoFields: "forbidden",
    },
    SourceIntegrityModelOutputV2: {
      schema: `\"${SOURCE_INTEGRITY_MODEL_OUTPUT_V2_SCHEMA}\"`,
      assessments: "packet-local targetRef plus semantic judgment/findings/evidence refs",
      primaryCategoryPrecedence: SOURCE_PRIMARY_CATEGORY_PRECEDENCE_V2,
      immutableEchoFields: "unitId/findingId/origin/form/claimStrength/hashes/result/blocking ids forbidden",
    },
    QuizIntegrityModelOutputV2: {
      schema: `\"${QUIZ_INTEGRITY_MODEL_OUTPUT_V2_SCHEMA}\"`,
      items: "questionRef/keyCorrect/defensibleAnswerIndices/mechanism/rationale/evidenceRefIds",
      immutableEchoFields: "itemId/keyed index/derived index/agreement/hashes forbidden",
    },
    AssembledReviewsV2: {
      reader: "hashes/role/route/resolved spans stamped by conductor",
      source: "real unit metadata stamped and PASS|REVISE|BLOCK|INCONCLUSIVE derived by conductor",
      quiz: "real identity/indices/agreement stamped and PASS|BLOCK|INCONCLUSIVE derived by conductor",
    },
  },
};
