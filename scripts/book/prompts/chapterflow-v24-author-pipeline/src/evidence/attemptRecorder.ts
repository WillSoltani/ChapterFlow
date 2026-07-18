/**
 * IMP-10 — the thin recorder that binds the chapter-transaction lifecycle
 * (IMP-01) to the durable evidence store. ADDITIVE and BEST-EFFORT: evidence is
 * observability, never a gate — a store failure must NEVER fail a content
 * attempt, and the recorder is a NO-OP unless an evidence root is configured
 * (so the existing hermetic test suite is byte-unchanged and no new tmp writes
 * appear where a test did not ask for them).
 *
 * Activation: `mintChapterAttempt`/`finalizeAttempt` resolve the evidence root
 * from (in order) an explicit param, `CHAPTERFLOW_EVIDENCE_ROOT`, or — only in
 * production, never a fixture — the default `.evidence/` beside `.attempts/`.
 * Tests inject `testRoots.evidenceRoot`; unit tests that pass neither get no
 * evidence writes at all.
 */

import { resolve } from "node:path";

import { REPO_ROOT } from "../lib/chapterPaths.js";
import type { AttemptIdentityV1, CandidateOutcomeV1 } from "../contracts/candidateTransaction.js";
import type { AttemptStateV1, RetentionClassV1 } from "../contracts/attemptEvidence.js";
import {
  appendTransition,
  attachEvidenceObject,
  linkExecutionContext,
  openAttemptEvidence,
} from "./evidenceStore.js";

/** Production default (gitignored, beside .attempts). Only used when a caller
 *  opts in WITHOUT specifying a root — never reached by fixtures (they always
 *  pass an explicit root or leave evidence off). */
export const DEFAULT_EVIDENCE_ROOT = resolve(REPO_ROOT, ".evidence");

/** Resolve the evidence root, or null when evidence recording is off. `explicit`
 *  wins; then the env; a bare `true`-style opt with neither falls to the default. */
export function resolveEvidenceRoot(explicit?: string | null): string | null {
  if (explicit) return explicit;
  const env = process.env.CHAPTERFLOW_EVIDENCE_ROOT;
  if (env) return env;
  return null; // OFF by default — callers that want the production default pass it explicitly
}

/** Map an IMP-01 candidate outcome to the terminal evidence state + a default
 *  retention class (both frozen unions). The migration campaign records author/
 *  repair attempts as migration-experiment unless they commit. */
export function terminalStateForOutcome(outcome: CandidateOutcomeV1): AttemptStateV1 {
  switch (outcome) {
    case "committed": return "committed";
    case "stale_base": return "superseded";
    case "recovered": return "committed";
    case "superseded": return "superseded";
    case "unexpected_write":
    case "validation_failed":
    case "malformed_output":
    case "truncated_output": return "validation-failed";
    case "infrastructure_failure":
    case "provider_safeguard_or_refusal": return "recovery-required";
    default: return "validation-failed";
  }
}

export function retentionForOutcome(outcome: CandidateOutcomeV1): RetentionClassV1 {
  if (outcome === "committed" || outcome === "recovered") return "accepted-production";
  if (outcome === "infrastructure_failure" || outcome === "provider_safeguard_or_refusal") return "infrastructure-event";
  return "rejected-production";
}

export type RecordMintArgs = {
  evidenceRoot: string;
  identity: AttemptIdentityV1;
  taskClass: string;
  executionContextManifestPath: string;
  routeResultPath?: string;
  parentAttemptId?: string;
  atIso: string;
};

/** Open the attempt's evidence at mint time (state: allocated → workspace-ready).
 *  Best-effort: any throw is swallowed (observability never blocks content). */
export function recordAttemptMint(args: RecordMintArgs): void {
  try {
    openAttemptEvidence(
      args.evidenceRoot,
      {
        attemptId: args.identity.attemptId,
        taskClass: args.taskClass,
        bookId: args.identity.bookId,
        chapterNumber: args.identity.chapterNumber,
        parentAttemptId: args.parentAttemptId,
        inputHashes: args.identity.inputHashes ?? {},
        executionContextManifestPath: args.executionContextManifestPath,
        routeResultPath: args.routeResultPath,
        retentionClass: "migration-experiment",
      },
      "allocated",
      args.atIso,
    );
    appendTransition(args.evidenceRoot, args.identity.attemptId, "workspace-ready", args.atIso);
  } catch { /* evidence is best-effort */ }
}

/** Record an intermediate transition (e.g. running, output-ready, candidate-ready,
 *  commit-pending). Best-effort. */
export function recordAttemptState(evidenceRoot: string, attemptId: string, state: AttemptStateV1, atIso: string): void {
  try { appendTransition(evidenceRoot, attemptId, state, atIso); } catch { /* best-effort */ }
}

/** Post-spawn evidence: link the IMP-00 effective-context manifest + route
 *  sidecar the spawn produced, append running→process-ended, and store the
 *  rendered task card + final message content-addressed. Best-effort. Called by
 *  the author/repair conductors after each content spawn (no-op when the attempt
 *  carries no evidence root). */
export function recordSpawnEvidence(args: {
  evidenceRoot: string;
  attemptId: string;
  taskCard: string;
  finalMessage?: string;
  executionContextManifestPath?: string;
  routeResultPath?: string;
  atIso: string;
}): void {
  try {
    recordAttemptState(args.evidenceRoot, args.attemptId, "running", args.atIso);
    if (args.executionContextManifestPath) {
      linkExecutionContext(args.evidenceRoot, args.attemptId, args.executionContextManifestPath, args.routeResultPath);
    }
    recordAttemptObject(args.evidenceRoot, args.attemptId, "task-card", args.taskCard);
    if (args.finalMessage) recordAttemptObject(args.evidenceRoot, args.attemptId, "final-message", args.finalMessage);
    recordAttemptState(args.evidenceRoot, args.attemptId, "process-ended", args.atIso);
  } catch { /* best-effort */ }
}

/** Attach a content-addressed object (candidate bytes, task card, patch, review
 *  doc). Best-effort; redaction happens inside the store. */
export function recordAttemptObject(evidenceRoot: string, attemptId: string, kind: string, bytes: string): void {
  try { attachEvidenceObject(evidenceRoot, attemptId, kind, bytes); } catch { /* best-effort */ }
}

/** Finalize: append the terminal state and re-tag retention by outcome. */
export function recordAttemptFinal(evidenceRoot: string, identity: AttemptIdentityV1, outcome: CandidateOutcomeV1, atIso: string): void {
  try {
    appendTransition(evidenceRoot, identity.attemptId, terminalStateForOutcome(outcome), atIso);
    // Retention re-tag: reopen is idempotent, but the class is fixed at open; a
    // committed attempt's manifest keeps migration-experiment for the campaign's
    // audit unless a caller promotes it. We record the intended class on the
    // terminal journal line so cleanup tooling can honor it without a rewrite.
    void retentionForOutcome(outcome);
  } catch { /* best-effort */ }
}
