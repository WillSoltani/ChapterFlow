/**
 * Source-and-claim-integrity review contract (frozen by IMP-20 §B / WP-A1).
 *
 * The separate SOURCE-AWARE lane — the ONLY lane with authority over external
 * factual truth, because it is the only reviewer that physically holds the
 * source packet, sidecar, anchor catalog, and immutable SourceUsePlanV1. Its
 * per-unit verdict reuses the compiler-owned origin/form/claim-strength ontology
 * verbatim (`SourceOriginV1`/`UnitFormV1`/`ClaimStrengthV1` are IMPORTED, not
 * re-declared) and `CriticSeverity` for finding severity; the register/support/
 * category enums are new to this lane.
 *
 * Two of the seven finding categories (`claim_strength_overreach`,
 * `generic_specificity_leak`) are byte-identical to the advisory-minor C37
 * checkId suffixes in `src/critics/sourceRegister.ts` — documented reuse of the
 * same concept, not a coincidence. Deterministic critics run FIRST and are never
 * re-voted by the semantic reviewer (that composition lives in the WP-B2 runtime).
 *
 * Fail-closed by construction: missing evidence yields `INCONCLUSIVE`, never a
 * guessed PASS. All five binding hashes anchor freshness.
 */

import { ContractDescriptor, expectFields, isNonEmptyString, isStringArray } from "./contractUtil.js";
import type { ClaimStrengthV1, SourceOriginV1, UnitFormV1 } from "./sourceUsePlan.js";
import type { CriticSeverity } from "../types.js";

/** Does the reader-facing prose make the unit's status legible? (New axis; the
 *  deterministic layer only carries the boolean `framingRequired` + C37 advisories.) */
export const SOURCE_VISIBLE_REGISTERS = [
  "clearly_sourced",
  "clearly_constructed",
  "clearly_generic",
  "ambiguous",
  "presented_as_fact",
] as const;
export type VisibleRegisterV1 = (typeof SOURCE_VISIBLE_REGISTERS)[number];

/** Evidence-support verdict (distinct from the DetailSufficiencyV1 PERMISSION axis). */
export const SOURCE_SUPPORT_STATUSES = [
  "SUPPORTED",
  "PARTIALLY_SUPPORTED",
  "UNSUPPORTED",
  "NOT_APPLICABLE",
  "INCONCLUSIVE",
] as const;
export type SupportStatusV1 = (typeof SOURCE_SUPPORT_STATUSES)[number];

/** `claim_strength_overreach` / `generic_specificity_leak` are byte-identical to
 *  the C37 checkId suffixes (sourceRegister.ts) — documented conceptual reuse. */
export const SOURCE_FINDING_CATEGORIES = [
  "invented_detail",
  "source_contradiction",
  "missing_visible_framing",
  "generic_specificity_leak",
  "claim_strength_overreach",
  "unsupported_attribution",
  "missing_required_evidence",
] as const;
export type SourceFindingCategoryV1 = (typeof SOURCE_FINDING_CATEGORIES)[number];

export type SourceIntegrityFindingV1 = {
  category: SourceFindingCategoryV1;
  severity: CriticSeverity;
  explanation: string;
};

export type SourceIntegrityReviewUnitV1 = {
  unitId: string;
  /** Maps 1:1 to SourceUsePlanUnitV1.origin. */
  expectedOrigin: SourceOriginV1;
  /** Maps 1:1 to SourceUsePlanUnitV1.form. */
  expectedForm: UnitFormV1;
  /** Maps 1:1 to SourceUsePlanUnitV1.claimStrength. */
  claimStrengthExpected: ClaimStrengthV1;
  visibleRegister: VisibleRegisterV1;
  supportStatus: SupportStatusV1;
  framingAdequate: boolean | null;
  claimStrengthFit: boolean | null;
  namedSpecificityAllowed: boolean | null;
  chapterEvidenceSpans: string[];
  sourceEvidenceSpans: string[];
  findings: SourceIntegrityFindingV1[];
};

export type SourceIntegrityReviewV1 = {
  schema: "source-integrity-review-v1";
  reviewerRole: "source-integrity";
  chapterContentSha256: string;
  sourceUsePlanSha256: string;
  sourcePacketSha256: string;
  sidecarSha256: string;
  /** sha256 of the bound JSON output-schema file (execution-enforced output). */
  schemaSha256: string;
  units: SourceIntegrityReviewUnitV1[];
  result: "PASS" | "BLOCK" | "INCONCLUSIVE";
  blockingFindingIds: string[];
  rationale: string;
};

// ── validation ─────────────────────────────────────────────────────────────

function isEnum(v: unknown, allowed: readonly string[]): boolean {
  return typeof v === "string" && allowed.includes(v);
}

function noUnknownKeys(v: Record<string, unknown>, allowed: readonly string[], errors: string[], where: string): void {
  for (const k of Object.keys(v)) {
    if (!allowed.includes(k)) errors.push(`${where}: unknown key "${k}"`);
  }
}

function isBoolOrNull(v: unknown): boolean {
  return v === null || typeof v === "boolean";
}

const FINDING_KEYS = ["category", "severity", "explanation"] as const;
const UNIT_KEYS = [
  "unitId", "expectedOrigin", "expectedForm", "claimStrengthExpected", "visibleRegister",
  "supportStatus", "framingAdequate", "claimStrengthFit", "namedSpecificityAllowed",
  "chapterEvidenceSpans", "sourceEvidenceSpans", "findings",
] as const;
const TOP_KEYS = [
  "schema", "reviewerRole", "chapterContentSha256", "sourceUsePlanSha256", "sourcePacketSha256",
  "sidecarSha256", "schemaSha256", "units", "result", "blockingFindingIds", "rationale",
] as const;

const ORIGINS = ["source_bound", "constructed", "generic"] as const;
const FORMS = ["case", "application", "operational_scenario", "explanation", "analogy"] as const;
const STRENGTHS = ["descriptive", "inferential", "correlational", "mechanistic", "causal"] as const;
const SEVERITIES = ["blocker", "major", "minor"] as const;

function validateUnit(u: unknown, errors: string[], where: string): void {
  if (u === null || typeof u !== "object") { errors.push(`${where}: not an object`); return; }
  const unit = u as Record<string, unknown>;
  expectFields(unit, UNIT_KEYS as unknown as string[], errors, where);
  noUnknownKeys(unit, UNIT_KEYS as unknown as string[], errors, where);
  if (!isNonEmptyString(unit.unitId)) errors.push(`${where}: unitId must be a non-empty string`);
  if (!isEnum(unit.expectedOrigin, ORIGINS)) errors.push(`${where}: unknown expectedOrigin "${String(unit.expectedOrigin)}"`);
  if (!isEnum(unit.expectedForm, FORMS)) errors.push(`${where}: unknown expectedForm "${String(unit.expectedForm)}"`);
  if (!isEnum(unit.claimStrengthExpected, STRENGTHS)) errors.push(`${where}: unknown claimStrengthExpected "${String(unit.claimStrengthExpected)}"`);
  if (!isEnum(unit.visibleRegister, SOURCE_VISIBLE_REGISTERS)) errors.push(`${where}: unknown visibleRegister "${String(unit.visibleRegister)}"`);
  if (!isEnum(unit.supportStatus, SOURCE_SUPPORT_STATUSES)) errors.push(`${where}: unknown supportStatus "${String(unit.supportStatus)}"`);
  if (!isBoolOrNull(unit.framingAdequate)) errors.push(`${where}: framingAdequate must be boolean|null`);
  if (!isBoolOrNull(unit.claimStrengthFit)) errors.push(`${where}: claimStrengthFit must be boolean|null`);
  if (!isBoolOrNull(unit.namedSpecificityAllowed)) errors.push(`${where}: namedSpecificityAllowed must be boolean|null`);
  if (!isStringArray(unit.chapterEvidenceSpans)) errors.push(`${where}: chapterEvidenceSpans must be string[]`);
  if (!isStringArray(unit.sourceEvidenceSpans)) errors.push(`${where}: sourceEvidenceSpans must be string[]`);
  if (!Array.isArray(unit.findings)) { errors.push(`${where}: findings must be an array`); return; }
  unit.findings.forEach((f, i) => {
    const at = `${where}.findings[${i}]`;
    if (f === null || typeof f !== "object") { errors.push(`${at}: not an object`); return; }
    const uf = f as Record<string, unknown>;
    expectFields(uf, FINDING_KEYS as unknown as string[], errors, at);
    noUnknownKeys(uf, FINDING_KEYS as unknown as string[], errors, at);
    if (!isEnum(uf.category, SOURCE_FINDING_CATEGORIES)) errors.push(`${at}: unknown category "${String(uf.category)}"`);
    if (!isEnum(uf.severity, SEVERITIES)) errors.push(`${at}: unknown severity "${String(uf.severity)}"`);
    if (typeof uf.explanation !== "string") errors.push(`${at}: explanation must be a string`);
  });
}

export function validateSourceIntegrityReview(r: unknown): string[] {
  const errors: string[] = [];
  if (r === null || typeof r !== "object") return ["source-review: not an object"];
  const v = r as Record<string, unknown>;
  expectFields(v, TOP_KEYS as unknown as string[], errors, "source-review");
  noUnknownKeys(v, TOP_KEYS as unknown as string[], errors, "source-review");
  if (v.schema !== "source-integrity-review-v1") errors.push("source-review: wrong schema tag");
  if (v.reviewerRole !== "source-integrity") errors.push("source-review: reviewerRole must be \"source-integrity\"");
  for (const f of ["chapterContentSha256", "sourceUsePlanSha256", "sourcePacketSha256", "sidecarSha256", "schemaSha256"] as const) {
    if (!isNonEmptyString(v[f])) errors.push(`source-review: ${f} must be a non-empty string`);
  }
  if (!isEnum(v.result, ["PASS", "BLOCK", "INCONCLUSIVE"])) errors.push("source-review: result must be PASS|BLOCK|INCONCLUSIVE");
  if (!isStringArray(v.blockingFindingIds)) errors.push("source-review: blockingFindingIds must be string[]");
  if (typeof v.rationale !== "string") errors.push("source-review: rationale must be a string");
  if (!Array.isArray(v.units)) errors.push("source-review: units must be an array");
  else v.units.forEach((u, i) => validateUnit(u, errors, `source-review.units[${i}]`));
  return errors;
}

/** True iff the record was produced against the exact chapter + source artifacts
 *  + schema. Any drift in any of the five bound hashes stales the record. */
export function sourceReviewIsFresh(
  r: SourceIntegrityReviewV1,
  chapterContentSha256: string,
  sourceUsePlanSha256: string,
  sourcePacketSha256: string,
  sidecarSha256: string,
  schemaSha256: string,
): boolean {
  return (
    r.schema === "source-integrity-review-v1" &&
    r.chapterContentSha256 === chapterContentSha256 &&
    r.sourceUsePlanSha256 === sourceUsePlanSha256 &&
    r.sourcePacketSha256 === sourcePacketSha256 &&
    r.sidecarSha256 === sidecarSha256 &&
    r.schemaSha256 === schemaSha256
  );
}

export const SOURCE_INTEGRITY_REVIEW_CONTRACT: ContractDescriptor = {
  name: "source-integrity-review",
  version: 1,
  ownerPrompt: "IMP-20",
  description:
    "Source-aware per-unit integrity review over the immutable source-use plan, packet, sidecar, and anchor catalog: register/support/claim-strength-fit verdicts, seven blocking finding categories, and PASS|BLOCK|INCONCLUSIVE with fail-closed missing-evidence handling; the only lane with external-factual-truth authority.",
  fields: {
    SourceIntegrityReviewV1: {
      schema: "\"source-integrity-review-v1\"",
      reviewerRole: "\"source-integrity\"",
      chapterContentSha256: "string", sourceUsePlanSha256: "string", sourcePacketSha256: "string",
      sidecarSha256: "string", schemaSha256: "string",
      units: "SourceIntegrityReviewUnitV1[]",
      result: "\"PASS\"|\"BLOCK\"|\"INCONCLUSIVE\"",
      blockingFindingIds: "string[]", rationale: "string",
    },
    SourceIntegrityReviewUnitV1: {
      unitId: "string",
      expectedOrigin: "\"source_bound\"|\"constructed\"|\"generic\"",
      expectedForm: "\"case\"|\"application\"|\"operational_scenario\"|\"explanation\"|\"analogy\"",
      claimStrengthExpected: "\"descriptive\"|\"inferential\"|\"correlational\"|\"mechanistic\"|\"causal\"",
      visibleRegister: "\"clearly_sourced\"|\"clearly_constructed\"|\"clearly_generic\"|\"ambiguous\"|\"presented_as_fact\"",
      supportStatus: "\"SUPPORTED\"|\"PARTIALLY_SUPPORTED\"|\"UNSUPPORTED\"|\"NOT_APPLICABLE\"|\"INCONCLUSIVE\"",
      framingAdequate: "boolean|null", claimStrengthFit: "boolean|null", namedSpecificityAllowed: "boolean|null",
      chapterEvidenceSpans: "string[]", sourceEvidenceSpans: "string[]",
      findings: "{ category: \"invented_detail\"|\"source_contradiction\"|\"missing_visible_framing\"|\"generic_specificity_leak\"|\"claim_strength_overreach\"|\"unsupported_attribution\"|\"missing_required_evidence\", severity: \"blocker\"|\"major\"|\"minor\", explanation }[]",
    },
  },
};
