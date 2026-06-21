/**
 * Session provenance — make "the author never grades their own work" a recorded,
 * checkable fact instead of a prose rule.
 *
 * The trust boundary in no-API QC is the SESSION (QC-PLAYBOOK.md): whoever
 * authored a chapter must not be the session that attests it. Nothing in the code
 * captured that, so the rule lived only in prompts. This records an author session
 * id in a SIDECAR (state/provenance/<chapterId>.json) at authoring time — zero
 * impact on the chapter content hash — and the reviewer session id on the
 * attestation. checkQcAttestation refuses a PUBLISHABLE attestation when the two
 * match, but only when BOTH are present AND CHAPTERFLOW_ENFORCE_SESSION_INDEPENDENCE=1
 * (so legacy/un-stamped books are never falsely blocked).
 *
 * Session id source: CHAPTERFLOW_SESSION_ID. A genuinely fresh QC session sets a
 * different id (or none); the same session authoring AND grading sets the same id,
 * which is exactly the violation this catches.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { resolve } from "path";

import { CANONICAL_STATE } from "../lib/chapterPaths.js";

export const PROVENANCE_DIR = resolve(CANONICAL_STATE, "provenance");
export const SESSION_INDEPENDENCE_ENV = "CHAPTERFLOW_ENFORCE_SESSION_INDEPENDENCE";

export type AuthorProvenance = {
  schemaVersion: "author-provenance-v1";
  chapterId: string;
  authorSessionId: string;
  stampedAt: string;
};

/** The current session id, or undefined when unset. A fresh session leaves this
 *  unset (or distinct), so absence is the safe default — enforcement no-ops. */
export function currentSessionId(): string | undefined {
  const v = process.env.CHAPTERFLOW_SESSION_ID;
  return v && v.trim() ? v.trim() : undefined;
}

export function sessionIndependenceEnforced(): boolean {
  // Enforced when EITHER the explicit opt-in is set OR we're in no-API codex-QC mode. The
  // canonical autopilot/book-run path force-sets the explicit var, but a bare manual `qc-auto`
  // (CHAPTERFLOW_NO_API_CODEX_QC=1) used to leave independence OFF — so a single agent could
  // author + bar-grade + confirm-grade the same chapter with two relabeled reviewer strings and
  // self-certify. No-API mode is exactly where the SESSION is the trust boundary, so it implies
  // enforcement. (Absence-safe per-id short-circuits still protect legacy/un-stamped chapters.)
  return process.env[SESSION_INDEPENDENCE_ENV] === "1" || process.env.CHAPTERFLOW_NO_API_CODEX_QC === "1";
}

export function provenancePath(chapterId: string): string {
  return resolve(PROVENANCE_DIR, `${chapterId}.json`);
}

export function loadAuthorProvenance(chapterId: string): AuthorProvenance | null {
  const p = provenancePath(chapterId);
  if (!existsSync(p)) return null;
  try {
    return JSON.parse(readFileSync(p, "utf8")) as AuthorProvenance;
  } catch {
    return null;
  }
}

/** Record the authoring session for a chapter. No-op when no session id is set
 *  (nothing to record), so it is safe to call unconditionally from generation. */
export function recordAuthorProvenance(chapterId: string, sessionId = currentSessionId()): string | null {
  if (!sessionId) return null;
  mkdirSync(PROVENANCE_DIR, { recursive: true });
  const rec: AuthorProvenance = {
    schemaVersion: "author-provenance-v1",
    chapterId,
    authorSessionId: sessionId,
    stampedAt: new Date().toISOString(),
  };
  const p = provenancePath(chapterId);
  writeFileSync(p, JSON.stringify(rec, null, 2) + "\n", "utf8");
  return p;
}

/** True only when independence is ENFORCED, BOTH ids are present, and they match
 *  (the same session authored and graded). Short-circuits on any absence so a
 *  legacy/un-stamped chapter or a reviewer with no session id is never blocked. */
export function violatesSessionIndependence(authorSessionId: string | undefined, reviewerSessionId: string | undefined): boolean {
  if (!sessionIndependenceEnforced()) return false;
  if (authorSessionId == null || reviewerSessionId == null) return false;
  return authorSessionId === reviewerSessionId;
}

/** Two reviewer sessions collide — the same session produced both reads, so they are
 *  NOT independent. Same opt-in + absence-safe contract as violatesSessionIndependence:
 *  no block unless independence is ENFORCED and BOTH ids are present. This is what turns
 *  "separate reviewers" (keyA≠keyB, bar≠confirm, bar≠tiebreak) from a derived role-string
 *  label into recorded evidence — each subagent stamps its own CHAPTERFLOW_SESSION_ID. */
export function sessionsCollide(a: string | undefined, b: string | undefined): boolean {
  if (!sessionIndependenceEnforced()) return false;
  if (a == null || b == null) return false;
  return a === b;
}

/** Any two of the given reviewer sessions collide (for the bar primary + tiebreak variants).
 *  Absence-safe per id: undefined ids never pair. No block unless independence is ENFORCED. */
export function sessionsCollideAmong(ids: Array<string | undefined>): boolean {
  if (!sessionIndependenceEnforced()) return false;
  const present = ids.filter((x): x is string => x != null);
  return new Set(present).size < present.length;
}
