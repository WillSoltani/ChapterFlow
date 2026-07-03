/**
 * sweepRejectedRecord — E5: forensic persistence of a validator-REJECTED sweep
 * submission.
 *
 * A sweep submission that the qc-submit validator rejects (a format defect — e.g.
 * a finding missing its `chapters` attribution) currently VANISHES: no stored
 * bytes, no trace of what the reader actually said. POM round-1's REVISE read
 * left zero forensic record and lost its corroboration value. This persists the
 * rejected submission + the validator error to
 * state/qc-orchestrator/<book>/<round>/sweep-rejected.<attempt>.json.
 *
 * STRICTLY ADVISORY / FORENSIC. This artifact is NEVER read by checkSweep, the
 * sweep history, the key-evidence-clears ledger, or any promote predicate — it
 * grants NOTHING. It exists only so a rejected read leaves an auditable trail.
 * Best-effort: a write failure never converts a sweep step into a halt.
 */

import { mkdirSync } from "fs";
import { resolve } from "path";

import { writeFileAtomic } from "../lib/atomicWrite.js";
import { orchestratorRoundDir } from "../qc/orchestrator/artifacts.js";

export type SweepRejectedRecord = {
  schemaVersion: "sweep-rejected-v1";
  bookId: string;
  roundId: string;
  attempt: number;
  rejectedAt: string;
  /** The validator errors that rejected the submission. */
  errors: string[];
  /** The exact submission bytes (as parsed) the reader produced — advisory only. */
  submission: unknown;
  /** The reader session that produced the rejected submission. */
  reviewerSessionId: string;
};

export function sweepRejectedPath(bookId: string, roundId: string, attempt: number): string {
  return resolve(orchestratorRoundDir(bookId, roundId), `sweep-rejected.${attempt}.json`);
}

/** Persist a rejected sweep submission. Returns the path, or "" on a best-effort
 *  failure (the caller must not treat a failure here as fatal). */
export function persistRejectedSweep(rec: Omit<SweepRejectedRecord, "schemaVersion" | "rejectedAt">): string {
  try {
    const full: SweepRejectedRecord = {
      schemaVersion: "sweep-rejected-v1",
      rejectedAt: new Date().toISOString(),
      ...rec,
    };
    const p = sweepRejectedPath(rec.bookId, rec.roundId, rec.attempt);
    mkdirSync(orchestratorRoundDir(rec.bookId, rec.roundId), { recursive: true });
    writeFileAtomic(p, JSON.stringify(full, null, 2) + "\n");
    return p;
  } catch {
    return "";
  }
}
