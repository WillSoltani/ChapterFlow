/**
 * Session provenance — make "the author never grades their own work" a recorded,
 * checkable fact instead of a prose rule.
 *
 * The trust boundary in no-API QC is the SESSION (QC-PLAYBOOK.md): whoever
 * authored a chapter must not be the session that attests it. These are local,
 * attributable workflow tokens. They provide procedural separation and auditability;
 * they are not cryptographic proof that two different humans touched the work.
 *
 * This records an author session id in a SIDECAR (state/provenance/<chapterId>.json)
 * at authoring time — zero impact on the chapter content hash — and the reviewer
 * session id on submissions/attestations. Legacy artifacts may lack one or both ids;
 * those are classified as legacy/unknown and cannot satisfy a new independent
 * certification requirement.
 *
 * Session id source: CHAPTERFLOW_SESSION_ID. A genuinely fresh QC session sets a
 * different id (or none); the same session authoring AND grading sets the same id,
 * which is exactly the violation this catches.
 */

import { existsSync, mkdirSync, readFileSync } from "fs";
import { resolve } from "path";

import { CANONICAL_STATE } from "../lib/chapterPaths.js";
import { writeFileAtomic } from "../lib/atomicWrite.js";

export const PROVENANCE_DIR = resolve(CANONICAL_STATE, "provenance");
export const SESSION_INDEPENDENCE_ENV = "CHAPTERFLOW_ENFORCE_SESSION_INDEPENDENCE";

export type AuthorProvenance = {
  schemaVersion: "author-provenance-v1";
  chapterId: string;
  authorSessionId: string;
  stampedAt: string;
};

export type SessionProvenanceState =
  | { kind: "present"; sessionId: string }
  | { kind: "legacy_unknown"; reason: string };

export type CertificationSessionFailureCode =
  | "missing_author"
  | "missing_sweep"
  | "missing_bar"
  | "missing_confirm"
  | "missing_tiebreak"
  | "author_bar_collision"
  | "author_confirm_collision"
  | "author_sweep_collision"
  | "bar_confirm_collision"
  | "sweep_bar_collision"
  | "sweep_confirm_collision"
  | "bar_tiebreak_collision";

export type CertificationSessionFailure = {
  code: CertificationSessionFailureCode;
  message: string;
};

/** The current session id, or undefined when unset. A fresh session leaves this
 *  unset (or distinct), so absence is the safe default — enforcement no-ops. */
export function currentSessionId(): string | undefined {
  const v = process.env.CHAPTERFLOW_SESSION_ID;
  return v && v.trim() ? v.trim() : undefined;
}

export function classifySessionProvenance(sessionId: string | undefined, label: string): SessionProvenanceState {
  return sessionId && sessionId.trim()
    ? { kind: "present", sessionId: sessionId.trim() }
    : { kind: "legacy_unknown", reason: `${label} session id is missing; legacy/unknown provenance cannot certify independence` };
}

export function requireCurrentSessionId(label: string): string {
  const sessionId = currentSessionId();
  if (!sessionId) {
    throw new Error(`${label} requires CHAPTERFLOW_SESSION_ID so reviewerSessionId provenance can be stamped`);
  }
  return sessionId;
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
 *  (nothing to record), so legacy/manual read-only flows can still call this
 *  safely. New authoring entrypoints should require a session before writing. */
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
  writeFileAtomic(p, JSON.stringify(rec, null, 2) + "\n");
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

export function certificationSessionFailures(args: {
  chapterId: string;
  bookRound: string;
  authorSessionId?: string;
  sweepSessionId?: string;
  barSessionId?: string;
  confirmSessionId?: string;
  barReadSessionIds?: Array<string | undefined>;
}): CertificationSessionFailure[] {
  const failures: CertificationSessionFailure[] = [];
  const missing = [
    ["missing_author", classifySessionProvenance(args.authorSessionId, `author ${args.chapterId}`)] as const,
    ["missing_sweep", classifySessionProvenance(args.sweepSessionId, `sweep reviewer ${args.bookRound}`)] as const,
    ["missing_bar", classifySessionProvenance(args.barSessionId, `bar reviewer ${args.chapterId}`)] as const,
    ["missing_confirm", classifySessionProvenance(args.confirmSessionId, `confirm reviewer ${args.chapterId}`)] as const,
  ];
  for (const [code, state] of missing) {
    if (state.kind === "legacy_unknown") failures.push({ code, message: state.reason });
  }
  const reads = args.barReadSessionIds ?? [];
  if (reads.length > 1) {
    reads.forEach((id, i) => {
      const state = classifySessionProvenance(id, `bar tiebreak read ${i + 1} ${args.chapterId}`);
      if (state.kind === "legacy_unknown") failures.push({ code: "missing_tiebreak", message: state.reason });
    });
  }

  if (sessionsCollide(args.authorSessionId, args.barSessionId)) {
    failures.push({ code: "author_bar_collision", message: `bar reviewer session matches the chapter's author session (${args.authorSessionId})` });
  }
  if (sessionsCollide(args.authorSessionId, args.confirmSessionId)) {
    failures.push({ code: "author_confirm_collision", message: `confirm reviewer session matches the chapter's author session (${args.authorSessionId})` });
  }
  if (sessionsCollide(args.authorSessionId, args.sweepSessionId)) {
    failures.push({ code: "author_sweep_collision", message: `sweep reviewer session matches the chapter's author session (${args.authorSessionId})` });
  }
  if (sessionsCollide(args.barSessionId, args.confirmSessionId)) {
    failures.push({ code: "bar_confirm_collision", message: `bar and confirm were graded in the SAME session (${args.barSessionId})` });
  }
  if (sessionsCollide(args.sweepSessionId, args.barSessionId)) {
    failures.push({ code: "sweep_bar_collision", message: `sweep and bar reviewers share a session (${args.sweepSessionId})` });
  }
  if (sessionsCollide(args.sweepSessionId, args.confirmSessionId)) {
    failures.push({ code: "sweep_confirm_collision", message: `sweep and confirm reviewers share a session (${args.sweepSessionId})` });
  }
  if (sessionsCollideAmong(reads)) {
    failures.push({ code: "bar_tiebreak_collision", message: "two bar reads (primary + tiebreak variants) share a session" });
  }
  return failures;
}
