/**
 * Judge capability qualification contract (frozen by IMP-20 §F / WP-A1).
 *
 * Per-ROLE qualification replaces the monolithic single-boolean judge gate: a
 * profile may qualify for one role and fail another (`readerExperience`,
 * `sourceIntegrity`, `quizIntegrity`, `securityBoundary` are independent). The
 * registry never requires every profile to qualify — an unqualified UNUSED
 * profile blocks nothing. `securityBoundary` is INHERITED from the Stage-Q
 * Layer-O v3 qualification (LN-08 delegates security to Layer-O), not re-measured.
 *
 * `effort` reuses the repo-local `EffortLevelV1` union (no API-only `max`).
 */

import { ContractDescriptor, expectFields, isNonEmptyString, isStringArray } from "./contractUtil.js";
import type { EffortLevelV1 } from "./executionProfile.js";

/** The three per-role qualification outcomes. `NOT_TESTED` is distinct from
 *  `NOT_QUALIFIED` — an untested role is honestly recorded, never assumed pass. */
export const JUDGE_ROLE_QUALIFICATION_STATUSES = ["QUALIFIED", "NOT_QUALIFIED", "NOT_TESTED"] as const;
export type JudgeRoleQualificationStatusV1 = (typeof JUDGE_ROLE_QUALIFICATION_STATUSES)[number];

export type JudgeCapabilityQualificationV1 = {
  profileId: string;
  model: string;
  effort: EffortLevelV1;
  readerExperience: JudgeRoleQualificationStatusV1;
  sourceIntegrity: JudgeRoleQualificationStatusV1;
  quizIntegrity: JudgeRoleQualificationStatusV1;
  securityBoundary: JudgeRoleQualificationStatusV1;
  /** Hashes of the held-out evidence, gold corpora, and behavior-affecting
   *  instrument components this qualification was measured under. A change in any
   *  of them (schema/prompt/threshold/corpus) stales the qualification. */
  evidenceHashes: string[];
  corpusHashes: string[];
  instrumentHashes: string[];
  qualifiedAt: string;
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

const EFFORTS = ["minimal", "low", "medium", "high", "xhigh"] as const;
const ROLE_FIELDS = ["readerExperience", "sourceIntegrity", "quizIntegrity", "securityBoundary"] as const;
const TOP_KEYS = [
  "profileId", "model", "effort", "readerExperience", "sourceIntegrity", "quizIntegrity",
  "securityBoundary", "evidenceHashes", "corpusHashes", "instrumentHashes", "qualifiedAt",
] as const;

export function validateJudgeCapabilityQualification(r: unknown): string[] {
  const errors: string[] = [];
  if (r === null || typeof r !== "object") return ["judge-qualification: not an object"];
  const v = r as Record<string, unknown>;
  expectFields(v, TOP_KEYS as unknown as string[], errors, "judge-qualification");
  noUnknownKeys(v, TOP_KEYS as unknown as string[], errors, "judge-qualification");
  if (!isNonEmptyString(v.profileId)) errors.push("judge-qualification: profileId must be a non-empty string");
  if (!isNonEmptyString(v.model)) errors.push("judge-qualification: model must be a non-empty string");
  if (!isEnum(v.effort, EFFORTS)) errors.push(`judge-qualification: unknown effort "${String(v.effort)}"`);
  for (const role of ROLE_FIELDS) {
    if (!isEnum(v[role], JUDGE_ROLE_QUALIFICATION_STATUSES)) {
      errors.push(`judge-qualification: ${role} must be QUALIFIED|NOT_QUALIFIED|NOT_TESTED`);
    }
  }
  if (!isStringArray(v.evidenceHashes)) errors.push("judge-qualification: evidenceHashes must be string[]");
  if (!isStringArray(v.corpusHashes)) errors.push("judge-qualification: corpusHashes must be string[]");
  if (!isStringArray(v.instrumentHashes)) errors.push("judge-qualification: instrumentHashes must be string[]");
  if (!isNonEmptyString(v.qualifiedAt)) errors.push("judge-qualification: qualifiedAt must be a non-empty string");
  return errors;
}

export const JUDGE_CAPABILITY_QUALIFICATION_CONTRACT: ContractDescriptor = {
  name: "judge-capability-qualification",
  version: 1,
  ownerPrompt: "IMP-20",
  description:
    "Per-role judge qualification registry entry: independent QUALIFIED|NOT_QUALIFIED|NOT_TESTED status for readerExperience/sourceIntegrity/quizIntegrity/securityBoundary, with evidence/corpus/instrument hashes binding the qualification to the exact instrument it was measured under; a profile may qualify for one role and fail another.",
  fields: {
    JudgeCapabilityQualificationV1: {
      profileId: "string", model: "string",
      effort: "\"minimal\"|\"low\"|\"medium\"|\"high\"|\"xhigh\"",
      readerExperience: "\"QUALIFIED\"|\"NOT_QUALIFIED\"|\"NOT_TESTED\"",
      sourceIntegrity: "\"QUALIFIED\"|\"NOT_QUALIFIED\"|\"NOT_TESTED\"",
      quizIntegrity: "\"QUALIFIED\"|\"NOT_QUALIFIED\"|\"NOT_TESTED\"",
      securityBoundary: "\"QUALIFIED\"|\"NOT_QUALIFIED\"|\"NOT_TESTED\"",
      evidenceHashes: "string[]", corpusHashes: "string[]", instrumentHashes: "string[]",
      qualifiedAt: "string",
    },
  },
};
