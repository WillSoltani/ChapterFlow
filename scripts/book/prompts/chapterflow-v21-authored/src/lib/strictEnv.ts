/**
 * The strict pipeline invariants — the single source of truth.
 *
 * Every no-API authoring/QC subprocess (a `codex exec` worker AND any CLI verb the
 * Book Autopilot conductor shells out to) must run under these. They are NOT
 * advisory: the enforcement they gate is absence-safe (defaults to OFF), so if a
 * subprocess inherits a shell that never exported them, the author≠reviewer
 * collision check and the source-verify gate SILENTLY no-op.
 *
 *  - CHAPTERFLOW_NO_API_CODEX_QC        — the no-funded-API operating mode.
 *  - CHAPTERFLOW_REQUIRE_SOURCE_VERIFY  — source-verify records are a hard blocker.
 *  - CHAPTERFLOW_ENFORCE_SESSION_INDEPENDENCE — finalize REVISE-rejects author=reviewer
 *    / keyA=keyB / bar=confirm collisions (see sessionProvenance.ts, qcAttestation.ts).
 *
 * `runbook.ts` (operator panel), `orchestrator/codexAgent.ts` (the codex worker
 * spawn), and `orchestrator/autopilot.ts` (the conductor's CLI runner) all consume
 * this so the list can never drift between the things that SET it and the thing
 * that REPORTS it.
 */

/** The invariants as an env map — spread into every subprocess env (force-set). */
export const STRICT_PIPELINE_ENV = {
  CHAPTERFLOW_NO_API_CODEX_QC: "1",
  CHAPTERFLOW_REQUIRE_SOURCE_VERIFY: "1",
  CHAPTERFLOW_ENFORCE_SESSION_INDEPENDENCE: "1",
} as const;

/** The bare variable names (for live presence checks). */
export const STRICT_ENV_VAR_NAMES = Object.keys(STRICT_PIPELINE_ENV) as Array<keyof typeof STRICT_PIPELINE_ENV>;

/** `NAME=1` assignment strings — threaded verbatim into a printed next-command. */
export const STRICT_ENV_ASSIGNMENTS = STRICT_ENV_VAR_NAMES.map((n) => `${n}=1`);
