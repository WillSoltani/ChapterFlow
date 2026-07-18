/**
 * Candidate-transaction contract (frozen by IMP-00; IMPLEMENTED by IMP-01).
 *
 * Master plan §8.8 / F-001 / F-020: canonical chapter bytes may only change via
 * a conductor-owned compare-and-swap commit of a validated candidate. Content
 * agents never write the canonical path; a failed/stale/malformed attempt leaves
 * prior committed bytes untouched. This module freezes the SHAPES so IMP-01
 * (transaction engine), IMP-07 (typed patches), and IMP-10 (evidence) build
 * against one interface. No runtime behavior lives here.
 */

import { ContractDescriptor, expectFields, isNonEmptyString } from "./contractUtil.js";

export type AttemptKindV1 =
  | "author-initial"
  | "author-regeneration"
  | "surgical-repair"
  | "section-repair";

/** Immutable identity of one content attempt (IMP-01 item 3). */
export type AttemptIdentityV1 = {
  schema: "attempt-identity-v1";
  attemptId: string;
  bookId: string;
  chapterNumber: number;
  designLineage: string;
  attemptKind: AttemptKindV1;
  attemptSequence: number;
  executionProfileHash: string;
  /** Required once IMP-03 lands; optional in v1 so IMP-01 can ship first. */
  sourcePlanHash?: string;
  promptSha256: string;
  inputHashes: Record<string, string>;
  outputSchemaVersion: string;
  /** null = the canonical chapter does not exist yet (first write). */
  expectedBaseSha256: string | null;
  expectedBaseGeneration: number;
};

export type CandidateOutcomeV1 =
  | "committed"
  | "stale_base"
  | "validation_failed"
  | "malformed_output"
  | "truncated_output"
  | "unexpected_write"
  | "infrastructure_failure"
  | "provider_safeguard_or_refusal"
  | "superseded"
  | "recovered";

export type CandidateRecordV1 = {
  schema: "candidate-record-v1";
  attempt: AttemptIdentityV1;
  candidateSha256: string;
  candidatePath: string;
  producedAtIso: string;
  validations: Array<{ check: string; ok: boolean; detail?: string }>;
  outcome: CandidateOutcomeV1;
};

/** Written atomically WITH the canonical replacement so recovery is deterministic
 *  (IMP-01 item 15): chapter bytes, provenance, and evidence invalidation are
 *  reconciled from this manifest after a crash. */
export type CommitManifestV1 = {
  schema: "commit-manifest-v1";
  attemptId: string;
  bookId: string;
  chapterNumber: number;
  previousSha256: string | null;
  committedSha256: string;
  committedGeneration: number;
  /** Evidence paths/ids invalidated by this commit (reviews, acceptance, keys). */
  invalidated: string[];
  committedAtIso: string;
};

export function validateAttemptIdentity(a: unknown): string[] {
  const errors: string[] = [];
  if (a === null || typeof a !== "object") return ["attempt: not an object"];
  const v = a as Record<string, unknown>;
  expectFields(v, [
    "schema", "attemptId", "bookId", "chapterNumber", "designLineage", "attemptKind",
    "attemptSequence", "executionProfileHash", "promptSha256", "inputHashes",
    "outputSchemaVersion", "expectedBaseSha256", "expectedBaseGeneration",
  ], errors, "attempt");
  if (v.schema !== "attempt-identity-v1") errors.push("attempt: wrong schema tag");
  if (!isNonEmptyString(v.attemptId)) errors.push("attempt: attemptId required");
  if (!["author-initial", "author-regeneration", "surgical-repair", "section-repair"].includes(v.attemptKind as string)) {
    errors.push(`attempt: unknown attemptKind "${String(v.attemptKind)}"`);
  }
  if (v.expectedBaseSha256 !== null && !isNonEmptyString(v.expectedBaseSha256)) {
    errors.push("attempt: expectedBaseSha256 must be a hash or explicit null");
  }
  return errors;
}

export const CANDIDATE_TRANSACTION_CONTRACT: ContractDescriptor = {
  name: "candidate-transaction",
  version: 1,
  ownerPrompt: "IMP-01",
  description: "Attempt identity, candidate record, and compare-and-swap commit manifest for conductor-owned canonical chapter mutation.",
  fields: {
    AttemptIdentityV1: {
      schema: "\"attempt-identity-v1\"",
      attemptId: "string", bookId: "string", chapterNumber: "number",
      designLineage: "string", attemptKind: "\"author-initial\"|\"author-regeneration\"|\"surgical-repair\"|\"section-repair\"",
      attemptSequence: "number", executionProfileHash: "string", sourcePlanHash: "string?",
      promptSha256: "string", inputHashes: "Record<string,string>", outputSchemaVersion: "string",
      expectedBaseSha256: "string|null", expectedBaseGeneration: "number",
    },
    CandidateRecordV1: {
      schema: "\"candidate-record-v1\"",
      attempt: "AttemptIdentityV1", candidateSha256: "string", candidatePath: "string",
      producedAtIso: "string", validations: "{check,ok,detail?}[]",
      outcome: "\"committed\"|\"stale_base\"|\"validation_failed\"|\"malformed_output\"|\"truncated_output\"|\"unexpected_write\"|\"infrastructure_failure\"|\"provider_safeguard_or_refusal\"|\"superseded\"|\"recovered\"",
    },
    CommitManifestV1: {
      schema: "\"commit-manifest-v1\"",
      attemptId: "string", bookId: "string", chapterNumber: "number",
      previousSha256: "string|null", committedSha256: "string", committedGeneration: "number",
      invalidated: "string[]", committedAtIso: "string",
    },
  },
};
