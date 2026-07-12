/**
 * Reader-experience review contract (frozen by IMP-20 §A / WP-A1).
 *
 * The reader lane judges ONLY what is on the reader-facing page. It carries no
 * source evidence, so it has NO authority to decide external factual truth: the
 * blocking categories deliberately OMIT `fabricated`/`factually_wrong`/
 * `source_contradictory` and KEEP only on-page-decidable blockers
 * (`internal_contradiction`, `unusable`, …). A passage that reads as factual but
 * whose status is unclear is surfaced as the ESCALATION signal
 * `origin_ambiguous_to_reader`, never a fabrication blocker (IMP-20 E-01).
 *
 * This REPLACES the legacy model-owned ship gate (IMP-20 §E): the record
 * carries an advisory `recommendation`; the deterministic final status is owned
 * by the aggregator, not the model. `READER_EXPERIENCE_RUBRIC_VERSION` +
 * `schemaSha256` are the freshness anchors — a legacy `reader-rubric-v3-phase1`
 * record can NEVER satisfy `readerReviewIsFresh` (that is the version wedge that
 * stales incompatible evidence).
 *
 * The 10 review factors are IMPORTED from artifactTypes (`REVIEW_FACTORS`), not
 * re-declared, so this lane scores the exact same rubric axes the legacy lane did.
 */

import { ContractDescriptor, expectFields, isNonEmptyString, isStringArray } from "./contractUtil.js";
import { REVIEW_FACTORS, type ReviewFactor } from "../artifacts/artifactTypes.js";

/** The reader-lane rubric/version anchor. A record whose `rubricVersion` does not
 *  equal this string is NOT fresh (legacy `reader-rubric-v3-phase1` records fail). */
export const READER_EXPERIENCE_RUBRIC_VERSION = "reader-experience-review-v1" as const;

/** On-page-decidable blocker categories ONLY. No external source-truth category
 *  (`fabricated`/`factually_wrong`/`source_contradictory`) exists here (E-01). */
export const READER_BLOCKING_CATEGORIES = [
  "unsafe",
  "internal_contradiction",
  "structurally_invalid",
  "schema_or_app_breaking",
  "unusable",
] as const;
export type ReaderBlockingCategoryV1 = (typeof READER_BLOCKING_CATEGORIES)[number];

/** Advisory escalation signals — a possible source concern the reader CANNOT
 *  adjudicate, carried to the aggregator as an annotation, never a reader blocker. */
export const READER_ESCALATION_CATEGORIES = [
  "origin_ambiguous_to_reader",
  "possible_real_world_claim",
  "possible_attribution_issue",
] as const;
export type ReaderEscalationCategoryV1 = (typeof READER_ESCALATION_CATEGORIES)[number];

/** Non-blocking craft/learning defects. */
export const READER_ADVISORY_CATEGORIES = [
  "thin_example",
  "quiz_cue",
  "repetition",
  "tone",
  "density",
  "pacing",
  "other_craft",
] as const;
export type ReaderAdvisoryCategoryV1 = (typeof READER_ADVISORY_CATEGORIES)[number];

export type ReaderExperienceFindingV1<C extends string> = {
  category: C;
  unit: string;
  problem: string;
  evidenceSpans: string[];
};

export type ReaderExperienceReviewV1 = {
  schema: "reader-experience-review-v1";
  reviewerRole: "reader-experience";
  /** chapterContentHash (v2) of the reviewed chapter. */
  chapterContentSha256: string;
  /** sha256 of the EXACT phase-1 (key-free) reader document the reviewer saw. */
  readerDocumentSha256: string;
  /** Free rubric version tag stamped at write time; must equal
   *  `READER_EXPERIENCE_RUBRIC_VERSION` to be fresh. */
  rubricVersion: string;
  /** sha256 of the bound JSON output-schema file (E-01 fix: execution-enforced
   *  structured output). A legacy record uses the `"legacy-no-schema"` sentinel. */
  schemaSha256: string;
  /** The 10 existing review factors (imported, not re-declared). */
  scores: Record<ReviewFactor, number>;
  quizDerivation: {
    answers: Array<"a" | "b" | "c">;
    mechanisms: string[];
    confidence: Array<"low" | "medium" | "high">;
    ambiguities: string[];
    tells: string[];
  };
  /** REPLACES the legacy model-owned ship bit — advisory only; the aggregator
   *  owns final status. */
  recommendation: "SHIP" | "REVISE" | "BLOCK";
  blockingFindings: Array<ReaderExperienceFindingV1<ReaderBlockingCategoryV1>>;
  escalationSignals: Array<ReaderExperienceFindingV1<ReaderEscalationCategoryV1>>;
  advisoryFindings: Array<ReaderExperienceFindingV1<ReaderAdvisoryCategoryV1>>;
  strongestEvidence: string[];
  weakestEvidence: string[];
  oneParagraphVerdict: string;
};

// ── validation ─────────────────────────────────────────────────────────────

function isEnum(v: unknown, allowed: readonly string[]): boolean {
  return typeof v === "string" && allowed.includes(v);
}

/** Rejects any key not in `allowed` (in-code `additionalProperties:false`). */
function noUnknownKeys(v: Record<string, unknown>, allowed: readonly string[], errors: string[], where: string): void {
  for (const k of Object.keys(v)) {
    if (!allowed.includes(k)) errors.push(`${where}: unknown key "${k}"`);
  }
}

function isBoundedScore(v: unknown): boolean {
  return typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= 100;
}

const FINDING_KEYS = ["category", "unit", "problem", "evidenceSpans"] as const;

function validateFindings(value: unknown, allowedCategories: readonly string[], errors: string[], where: string): void {
  if (!Array.isArray(value)) { errors.push(`${where}: must be an array`); return; }
  value.forEach((f, i) => {
    const at = `${where}[${i}]`;
    if (f === null || typeof f !== "object") { errors.push(`${at}: not an object`); return; }
    const u = f as Record<string, unknown>;
    expectFields(u, FINDING_KEYS as unknown as string[], errors, at);
    noUnknownKeys(u, FINDING_KEYS as unknown as string[], errors, at);
    if (!isEnum(u.category, allowedCategories)) errors.push(`${at}: unknown category "${String(u.category)}"`);
    if (typeof u.unit !== "string") errors.push(`${at}: unit must be a string`);
    if (typeof u.problem !== "string") errors.push(`${at}: problem must be a string`);
    if (!isStringArray(u.evidenceSpans)) errors.push(`${at}: evidenceSpans must be string[]`);
  });
}

const READER_TOP_KEYS = [
  "schema", "reviewerRole", "chapterContentSha256", "readerDocumentSha256", "rubricVersion",
  "schemaSha256", "scores", "quizDerivation", "recommendation", "blockingFindings",
  "escalationSignals", "advisoryFindings", "strongestEvidence", "weakestEvidence", "oneParagraphVerdict",
] as const;

const QUIZ_DERIVATION_KEYS = ["answers", "mechanisms", "confidence", "ambiguities", "tells"] as const;

export function validateReaderExperienceReview(r: unknown): string[] {
  const errors: string[] = [];
  if (r === null || typeof r !== "object") return ["reader-review: not an object"];
  const v = r as Record<string, unknown>;
  expectFields(v, READER_TOP_KEYS as unknown as string[], errors, "reader-review");
  noUnknownKeys(v, READER_TOP_KEYS as unknown as string[], errors, "reader-review");
  if (v.schema !== "reader-experience-review-v1") errors.push("reader-review: wrong schema tag");
  if (v.reviewerRole !== "reader-experience") errors.push("reader-review: reviewerRole must be \"reader-experience\"");
  for (const f of ["chapterContentSha256", "readerDocumentSha256", "rubricVersion", "schemaSha256"] as const) {
    if (!isNonEmptyString(v[f])) errors.push(`reader-review: ${f} must be a non-empty string`);
  }
  if (typeof v.oneParagraphVerdict !== "string") errors.push("reader-review: oneParagraphVerdict must be a string");

  // scores: exactly the 10 factors, each a bounded number, no extras.
  if (v.scores === null || typeof v.scores !== "object") {
    errors.push("reader-review: scores must be an object");
  } else {
    const s = v.scores as Record<string, unknown>;
    for (const factor of REVIEW_FACTORS) {
      if (!(factor in s)) errors.push(`reader-review.scores: missing factor "${factor}"`);
      else if (!isBoundedScore(s[factor])) errors.push(`reader-review.scores.${factor}: must be a number in [0,100]`);
    }
    noUnknownKeys(s, REVIEW_FACTORS as unknown as string[], errors, "reader-review.scores");
  }

  // quizDerivation
  if (v.quizDerivation === null || typeof v.quizDerivation !== "object") {
    errors.push("reader-review: quizDerivation must be an object");
  } else {
    const q = v.quizDerivation as Record<string, unknown>;
    expectFields(q, QUIZ_DERIVATION_KEYS as unknown as string[], errors, "reader-review.quizDerivation");
    noUnknownKeys(q, QUIZ_DERIVATION_KEYS as unknown as string[], errors, "reader-review.quizDerivation");
    if (!Array.isArray(q.answers) || !q.answers.every((a) => isEnum(a, ["a", "b", "c"]))) {
      errors.push("reader-review.quizDerivation.answers: must be an array of \"a\"|\"b\"|\"c\"");
    }
    if (!Array.isArray(q.confidence) || !q.confidence.every((c) => isEnum(c, ["low", "medium", "high"]))) {
      errors.push("reader-review.quizDerivation.confidence: must be an array of \"low\"|\"medium\"|\"high\"");
    }
    if (!isStringArray(q.mechanisms)) errors.push("reader-review.quizDerivation.mechanisms: must be string[]");
    if (!isStringArray(q.ambiguities)) errors.push("reader-review.quizDerivation.ambiguities: must be string[]");
    if (!isStringArray(q.tells)) errors.push("reader-review.quizDerivation.tells: must be string[]");
  }

  if (!isEnum(v.recommendation, ["SHIP", "REVISE", "BLOCK"])) errors.push("reader-review: recommendation must be SHIP|REVISE|BLOCK");
  validateFindings(v.blockingFindings, READER_BLOCKING_CATEGORIES, errors, "reader-review.blockingFindings");
  validateFindings(v.escalationSignals, READER_ESCALATION_CATEGORIES, errors, "reader-review.escalationSignals");
  validateFindings(v.advisoryFindings, READER_ADVISORY_CATEGORIES, errors, "reader-review.advisoryFindings");
  if (!isStringArray(v.strongestEvidence)) errors.push("reader-review: strongestEvidence must be string[]");
  if (!isStringArray(v.weakestEvidence)) errors.push("reader-review: weakestEvidence must be string[]");
  return errors;
}

/** True iff the record was produced under the CURRENT reader instrument AND
 *  against the exact bound inputs. A legacy `reader-rubric-v3-phase1` record fails
 *  on `rubricVersion` (the version wedge that stales incompatible evidence). */
export function readerReviewIsFresh(
  r: ReaderExperienceReviewV1,
  chapterContentSha256: string,
  readerDocumentSha256: string,
  schemaSha256: string,
): boolean {
  return (
    r.schema === "reader-experience-review-v1" &&
    r.rubricVersion === READER_EXPERIENCE_RUBRIC_VERSION &&
    r.chapterContentSha256 === chapterContentSha256 &&
    r.readerDocumentSha256 === readerDocumentSha256 &&
    r.schemaSha256 === schemaSha256
  );
}

export const READER_EXPERIENCE_REVIEW_CONTRACT: ContractDescriptor = {
  name: "reader-experience-review",
  version: 1,
  ownerPrompt: "IMP-20",
  description:
    "Reader-lane review over the phase-1 (key-free) reader document: on-page-decidable blockers only (no external source-truth category), advisory recommendation replacing the legacy model-owned ship gate, escalation signals for reader-undecidable source concerns, and hash+rubric-version freshness anchors.",
  fields: {
    ReaderExperienceReviewV1: {
      schema: "\"reader-experience-review-v1\"",
      reviewerRole: "\"reader-experience\"",
      chapterContentSha256: "string", readerDocumentSha256: "string", rubricVersion: "string",
      schemaSha256: "string",
      scores: "Record<retention|quizzes|transfer|practical|summaries|tone|limits|insight|density|beginner, number>",
      quizDerivation: "{ answers: (\"a\"|\"b\"|\"c\")[], mechanisms: string[], confidence: (\"low\"|\"medium\"|\"high\")[], ambiguities: string[], tells: string[] }",
      recommendation: "\"SHIP\"|\"REVISE\"|\"BLOCK\"",
      blockingFindings: "{ category: \"unsafe\"|\"internal_contradiction\"|\"structurally_invalid\"|\"schema_or_app_breaking\"|\"unusable\", unit, problem, evidenceSpans: string[] }[]",
      escalationSignals: "{ category: \"origin_ambiguous_to_reader\"|\"possible_real_world_claim\"|\"possible_attribution_issue\", unit, problem, evidenceSpans: string[] }[]",
      advisoryFindings: "{ category: \"thin_example\"|\"quiz_cue\"|\"repetition\"|\"tone\"|\"density\"|\"pacing\"|\"other_craft\", unit, problem, evidenceSpans: string[] }[]",
      strongestEvidence: "string[]", weakestEvidence: "string[]", oneParagraphVerdict: "string",
    },
  },
};
