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
  return process.env[SESSION_INDEPENDENCE_ENV] === "1";
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
