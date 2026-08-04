/**
 * Attempt-evidence contract (frozen by IMP-00; IMPLEMENTED by IMP-10).
 *
 * Master plan §IMP-10 / F-014: every generation/review/repair attempt gets an
 * immutable, content-addressed evidence manifest linking execution context,
 * inputs, outputs, validations, filesystem effects, provider outcome, and
 * state transitions — durable enough that a failed campaign never again needs
 * an external 10-second file watcher to preserve its history.
 */

import { ContractDescriptor, expectFields, isNonEmptyString } from "./contractUtil.js";

export type AttemptStateV1 =
  | "allocated"
  | "workspace-ready"
  | "running"
  | "process-ended"
  | "output-ready"
  | "candidate-ready"
  | "validation-failed"
  | "commit-pending"
  | "committed"
  | "review-failed"
  | "repair-planned"
  | "repaired"
  | "regenerated"
  | "carried"
  | "superseded"
  | "cleaned"
  | "recovery-required";

export type RetentionClassV1 =
  | "migration-experiment"
  | "accepted-production"
  | "rejected-production"
  | "infrastructure-event"
  | "sensitive-source"
  | "temporary-workspace";

export type EvidenceObjectV1 = {
  /** e.g. "task-card", "candidate-bytes", "patch", "review-doc", "jsonl-events". */
  kind: string;
  sha256: string;
  path: string;
  bytes: number;
};

export type AttemptEvidenceManifestV1 = {
  schema: "attempt-evidence-manifest-v1";
  attemptId: string;
  parentAttemptId?: string;
  taskClass: string;
  bookId: string;
  chapterNumber?: number;
  inputHashes: Record<string, string>;
  /** Path of the IMP-00 effective-context manifest for this attempt's spawn. */
  executionContextManifestPath: string;
  routeResultPath?: string;
  stateTransitions: Array<{ state: AttemptStateV1; atIso: string }>;
  retentionClass: RetentionClassV1;
  objects: EvidenceObjectV1[];
};

export function validateAttemptEvidenceManifest(m: unknown): string[] {
  const errors: string[] = [];
  if (m === null || typeof m !== "object") return ["evidence: not an object"];
  const v = m as Record<string, unknown>;
  expectFields(v, [
    "schema", "attemptId", "taskClass", "bookId", "inputHashes",
    "executionContextManifestPath", "stateTransitions", "retentionClass", "objects",
  ], errors, "evidence");
  if (v.schema !== "attempt-evidence-manifest-v1") errors.push("evidence: wrong schema tag");
  if (!isNonEmptyString(v.executionContextManifestPath)) {
    errors.push("evidence: executionContextManifestPath required (attempts must link their effective context)");
  }
  if (!Array.isArray(v.stateTransitions) || (v.stateTransitions as unknown[]).length === 0) {
    errors.push("evidence: stateTransitions must be a non-empty append-only array");
  }
  return errors;
}

export const ATTEMPT_EVIDENCE_CONTRACT: ContractDescriptor = {
  name: "attempt-evidence-manifest",
  version: 1,
  ownerPrompt: "IMP-10",
  description: "Immutable per-attempt evidence manifest: execution-context link, input hashes, content-addressed objects, append-only state transitions, retention class.",
  fields: {
    AttemptEvidenceManifestV1: {
      schema: "\"attempt-evidence-manifest-v1\"",
      attemptId: "string", parentAttemptId: "string?", taskClass: "string",
      bookId: "string", chapterNumber: "number?", inputHashes: "Record<string,string>",
      executionContextManifestPath: "string", routeResultPath: "string?",
      stateTransitions: "{ state: AttemptStateV1, atIso }[] (17-state union, append-only)",
      retentionClass: "\"migration-experiment\"|\"accepted-production\"|\"rejected-production\"|\"infrastructure-event\"|\"sensitive-source\"|\"temporary-workspace\"",
      objects: "{ kind, sha256, path, bytes }[]",
    },
  },
};
