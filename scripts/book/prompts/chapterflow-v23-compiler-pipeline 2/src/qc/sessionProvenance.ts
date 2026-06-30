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
 * AUTHOR vs ACCEPTER. Author provenance must identify the session that AUTHORED the
 * current chapter content — never a session that merely accepted, reused, or ingested
 * a cached chapter. v2 records bind to the authored content hash so provenance is
 * create-once per content: an identical-content re-stamp under a DIFFERENT session is
 * refused loudly (AuthorProvenanceConflictError), and only a deliberate re-authoring
 * that CHANGES the content may replace an existing author (logging the old→new
 * transition). A cache accepter is recorded — if at all — as a separate, append-only
 * cache-acceptance audit event (state/cache-acceptance/<chapterId>.jsonl) that is
 * NEVER read as author evidence. Absence of author provenance stays legacy/unknown;
 * accepting a cache must never invent it.
 *
 * Session id source: CHAPTERFLOW_SESSION_ID. A genuinely fresh QC session sets a
 * different id (or none); the same session authoring AND grading sets the same id,
 * which is exactly the violation this catches.
 */

import { appendFileSync, existsSync, mkdirSync, readFileSync } from "fs";
import { resolve } from "path";

import { CANONICAL_STATE } from "../lib/chapterPaths.js";
import { writeFileAtomic } from "../lib/atomicWrite.js";

export const PROVENANCE_DIR = resolve(CANONICAL_STATE, "provenance");
/** Append-only audit log of cache acceptances, kept STRICTLY SEPARATE from author
 *  provenance. A session that only accepts a cached chapter is not its author, so
 *  its evidence must never be readable as author evidence (it lives in a different
 *  directory with a different schema and is loaded by a different function). */
export const CACHE_ACCEPTANCE_DIR = resolve(CANONICAL_STATE, "cache-acceptance");
export const SESSION_INDEPENDENCE_ENV = "CHAPTERFLOW_ENFORCE_SESSION_INDEPENDENCE";

/**
 * Author provenance identifies the session that AUTHORED the current chapter
 * content — never a session that merely accepted, reused, or ingested a cache.
 *
 * v2 binds the record to the authored content hash so provenance is create-once
 * per content: a re-stamp with IDENTICAL content under a DIFFERENT session is
 * refused (loud conflict), and only a deliberate re-authoring that CHANGES the
 * content may replace an existing author (recording the old→new transition).
 *
 * v1 records (no `contentHash`) predate content binding; they remain readable and
 * their `authorSessionId` still counts for independence, but they are not content-
 * bound, so a genuine authoring caller that supplies a new hash upgrades them.
 */
export type AuthorProvenance = {
  schemaVersion: "author-provenance-v1" | "author-provenance-v2";
  chapterId: string;
  authorSessionId: string;
  stampedAt: string;
  /** v2: chapterContentHash() of the authored content this record attests. */
  contentHash?: string;
  /** Optional v23 compiler audit metadata. The single authorSessionId remains the
   *  certification handle; contributorSessionIds record the section-writer sessions
   *  that fed the deterministic assembler without changing the existing schema used
   *  by promotion/QC. */
  producer?: "whole-chapter-writer" | "provider-generator" | "v23-compiler-assembler" | "repair-session" | "manual-stamp";
  contributorSessionIds?: string[];
  /** v2: content hash this record's authoring moved away from (re-authoring audit). */
  previousContentHash?: string;
  /** v2: the author session this record replaced (re-authoring/upgrade audit). */
  previousAuthorSessionId?: string;
};

/** A cache acceptance is an audit event, NOT author evidence. */
export type CacheAcceptanceEvent = {
  schemaVersion: "cache-acceptance-v1";
  chapterId: string;
  cacheAcceptedBySessionId: string;
  acceptedAt: string;
  /** Content hash of the accepted output (chapterContentHash). */
  contentHash: string;
  /** Hash of the stage-cache manifest that blessed the reuse. */
  cacheManifestHash: string;
};

/** Thrown when a session tries to overwrite author provenance for content it did
 *  not author. A cache accepter or reviewer is not an author; only a deliberate
 *  re-authoring that CHANGES the content may replace an existing author record. */
export class AuthorProvenanceConflictError extends Error {
  readonly chapterId: string;
  readonly existingAuthorSessionId: string;
  readonly attemptedAuthorSessionId: string;
  readonly contentHash: string;
  constructor(
    chapterId: string,
    existingAuthorSessionId: string,
    attemptedAuthorSessionId: string,
    contentHash: string,
    detail = "the content is IDENTICAL",
  ) {
    super(
      `author provenance conflict for ${chapterId}: content ${contentHash} is already attributed to author ` +
        `session "${existingAuthorSessionId}"; refusing to record "${attemptedAuthorSessionId}" as author ` +
        `(${detail}). A cache accepter or reviewer is not an author — only a deliberate re-authoring that ` +
        `changes the chapter content may replace existing author provenance.`,
    );
    this.name = "AuthorProvenanceConflictError";
    this.chapterId = chapterId;
    this.existingAuthorSessionId = existingAuthorSessionId;
    this.attemptedAuthorSessionId = attemptedAuthorSessionId;
    this.contentHash = contentHash;
  }
}

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

function writeAuthorProvenance(
  chapterId: string,
  sessionId: string,
  contentHash: string | undefined,
  extra: {
    previousContentHash?: string;
    previousAuthorSessionId?: string;
    producer?: AuthorProvenance["producer"];
    contributorSessionIds?: string[];
  },
): string {
  mkdirSync(PROVENANCE_DIR, { recursive: true });
  const rec: AuthorProvenance = {
    schemaVersion: contentHash != null ? "author-provenance-v2" : "author-provenance-v1",
    chapterId,
    authorSessionId: sessionId,
    stampedAt: new Date().toISOString(),
    ...(contentHash != null ? { contentHash } : {}),
    ...(extra.producer != null ? { producer: extra.producer } : {}),
    ...(extra.contributorSessionIds?.length ? { contributorSessionIds: [...new Set(extra.contributorSessionIds)].sort() } : {}),
    ...(extra.previousContentHash != null ? { previousContentHash: extra.previousContentHash } : {}),
    ...(extra.previousAuthorSessionId != null ? { previousAuthorSessionId: extra.previousAuthorSessionId } : {}),
  };
  const p = provenancePath(chapterId);
  writeFileAtomic(p, JSON.stringify(rec, null, 2) + "\n");
  return p;
}

/**
 * Record the session that AUTHORED a chapter's current content. No-op when no
 * session id is set (nothing to record), so legacy/manual read-only flows can
 * still call this safely. New authoring entrypoints should require a session.
 *
 * Pass the authored content's `chapterContentHash` to bind the record to its
 * content. With a hash, provenance is create-once per content:
 *   - no existing record            → create it (create-once);
 *   - same content, same session    → idempotent no-op;
 *   - same content, OTHER session   → throw AuthorProvenanceConflictError;
 *   - changed content               → permitted re-authoring transition (old→new logged).
 * Without a hash (legacy callers/manual stamping), the historical overwrite
 * semantics are preserved EXCEPT that a content-bound (v2) record is never
 * silently clobbered by a hash-less re-stamp from a different session.
 *
 * Cache acceptance MUST NOT call this — use {@link recordCacheAcceptance}.
 */
export function recordAuthorProvenance(
  chapterId: string,
  sessionId: string | undefined = currentSessionId(),
  contentHash?: string,
): string | null {
  if (!sessionId) return null;
  const p = provenancePath(chapterId);
  const existing = loadAuthorProvenance(chapterId);

  if (existing && existing.contentHash != null) {
    // Existing record is content-bound (v2): create-once per content hash.
    if (contentHash == null) {
      // A re-stamp that cannot name the content it authored must not blindly
      // replace a content-bound author. Same session ⇒ harmless no-op.
      if (existing.authorSessionId === sessionId) return p;
      throw new AuthorProvenanceConflictError(
        chapterId,
        existing.authorSessionId,
        sessionId,
        existing.contentHash,
        "no new content hash was supplied to prove a re-authoring",
      );
    }
    if (existing.contentHash === contentHash) {
      if (existing.authorSessionId === sessionId) return p; // idempotent re-stamp of identical content
      throw new AuthorProvenanceConflictError(chapterId, existing.authorSessionId, sessionId, contentHash);
    }
    // Content changed ⇒ a deliberate re-authoring transition is allowed.
    return writeAuthorProvenance(chapterId, sessionId, contentHash, {
      previousContentHash: existing.contentHash,
      previousAuthorSessionId: existing.authorSessionId !== sessionId ? existing.authorSessionId : undefined,
    });
  }

  // No existing record (create-once) OR a legacy record with no content binding.
  // Legacy/no-hash callers keep their historical overwrite semantics; when a hash
  // is supplied the record is upgraded to v2 and the prior author is logged.
  const extra =
    existing && existing.authorSessionId !== sessionId ? { previousAuthorSessionId: existing.authorSessionId } : {};
  return writeAuthorProvenance(chapterId, sessionId, contentHash, extra);
}


/** Record the deterministic v23 compiler assembler as the content producer for the
 *  final ChapterV21 file while retaining the contributing section-writer session ids
 *  for audit. This is intentionally a chapter-level author provenance record because
 *  QC/promotion certify independence at the final chapter-content boundary, not at
 *  intermediate section artifact boundaries. */
export function recordCompilerAssemblyProvenance(args: {
  chapterId: string;
  assemblerSessionId: string;
  contentHash?: string;
  contributorSessionIds?: string[];
}): string | null {
  const contributors = [...new Set((args.contributorSessionIds ?? []).filter((x) => x && x.trim()).map((x) => x.trim()))].sort();
  const existing = loadAuthorProvenance(args.chapterId);

  // Preserve the create-once-per-content invariant: identical content stamped by a
  // different assembly session is a no-op that keeps the original producer. A real
  // changed chapter may transition to this new assembly session.
  if (existing?.contentHash && args.contentHash && existing.contentHash === args.contentHash) {
    return provenancePath(args.chapterId);
  }

  if (!args.assemblerSessionId.trim()) return null;
  const p = provenancePath(args.chapterId);
  const existingBound = existing && existing.contentHash != null;
  if (existingBound && args.contentHash != null && existing.contentHash === args.contentHash && existing.authorSessionId !== args.assemblerSessionId) {
    return p;
  }
  return writeAuthorProvenance(args.chapterId, args.assemblerSessionId, args.contentHash, {
    producer: "v23-compiler-assembler",
    contributorSessionIds: contributors,
    ...(existing?.contentHash && existing.contentHash !== args.contentHash ? { previousContentHash: existing.contentHash } : {}),
    ...(existing?.authorSessionId && existing.authorSessionId !== args.assemblerSessionId ? { previousAuthorSessionId: existing.authorSessionId } : {}),
  });
}

export function cacheAcceptancePath(chapterId: string): string {
  return resolve(CACHE_ACCEPTANCE_DIR, `${chapterId}.jsonl`);
}

/** Record that `sessionId` ACCEPTED a cached chapter (append-only audit log).
 *  This is acceptance evidence, never author evidence: it is written to a separate
 *  directory/schema and is never consulted by author-independence certification.
 *  No-op without a session id. */
export function recordCacheAcceptance(args: {
  chapterId: string;
  contentHash: string;
  cacheManifestHash: string;
  sessionId?: string;
}): string | null {
  const sessionId = args.sessionId ?? currentSessionId();
  if (!sessionId) return null;
  mkdirSync(CACHE_ACCEPTANCE_DIR, { recursive: true });
  const event: CacheAcceptanceEvent = {
    schemaVersion: "cache-acceptance-v1",
    chapterId: args.chapterId,
    cacheAcceptedBySessionId: sessionId,
    acceptedAt: new Date().toISOString(),
    contentHash: args.contentHash,
    cacheManifestHash: args.cacheManifestHash,
  };
  const p = cacheAcceptancePath(args.chapterId);
  appendFileSync(p, JSON.stringify(event) + "\n");
  return p;
}

/** Read the append-only cache-acceptance audit log for a chapter (oldest first). */
export function loadCacheAcceptances(chapterId: string): CacheAcceptanceEvent[] {
  const p = cacheAcceptancePath(chapterId);
  if (!existsSync(p)) return [];
  const out: CacheAcceptanceEvent[] = [];
  for (const line of readFileSync(p, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      out.push(JSON.parse(trimmed) as CacheAcceptanceEvent);
    } catch {
      // Skip a torn/partial line rather than throwing on an audit read.
    }
  }
  return out;
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
