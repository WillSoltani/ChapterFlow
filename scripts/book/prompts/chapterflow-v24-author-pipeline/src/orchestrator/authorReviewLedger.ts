/**
 * authorReviewLedger — E2: the review-carry ledger (the P09 pattern applied to
 * the v24 author-arch per-chapter reader review).
 *
 * The review phase's convergence unit is the CHAPTER at its content hash + the
 * exact reader-doc bytes it was scored over. A repair to one chapter invalidates
 * ONLY that chapter's carry; untouched chapters keep the independent review they
 * already earned across a conductor re-entry — killing the measured POM cost of
 * re-reviewing 11 byte-identical chapters because 1 changed (and the flip-flop
 * regens a re-roll of unchanged bytes causes).
 *
 * Two layers, exactly like sweep.ts:826-925:
 *   (1) APPEND-ONLY HISTORY — one immutable record per persisted review, keyed by
 *       content: state/reviews/<bookId>/ch<NN>.<contentHash>.review.json. This is
 *       the authoritative evidence (a re-review at the SAME content overwrites its
 *       own file idempotently; a different content writes a new file).
 *   (2) MATERIALIZED CACHE — state/reviews/<bookId>.review-clears.json, REBUILDABLE
 *       from the history at any time (deletable without loss). It is a convenience
 *       index, never the evidence: the reuse predicate reverifies against the
 *       history record's own bytes.
 *
 * The reuse decision (doAuthorReview step 1) is fail-closed: a review is reused
 * for a chapter iff ALL hold at reuse time (checked against the CURRENT chapter):
 *   - recorded contentHash === chapterContentHash(current)
 *   - recorded docHash === chapterReaderDocHash(current) (the exact reader bytes)
 *   - recorded bar === the current phase bar
 *   - recorded schemaVersion + hashVersion match the current constants
 *   - review.pass && review.valid
 *   - recorded reviewerSessionId !== the chapter's CURRENT author session
 * A miss on ANY condition → no carry → a fresh review session. A legacy record
 * missing any binding field (bar/docHash/hashVersion) is never reusable (the
 * fields are `!== value` mismatches, so absence blocks).
 */

import { existsSync, mkdirSync, readdirSync, readFileSync } from "fs";
import { dirname, resolve } from "path";

import type { ChapterV21 } from "../types.js";
import {
  CHAPTER_REVIEW_SCHEMA_VERSION,
  type ChapterReviewV1,
} from "../artifacts/artifactTypes.js";
import { chapterContentHash } from "../critics/qcAttestation.js";
import { CANONICAL_STATE } from "../lib/chapterPaths.js";
import { writeFileAtomic } from "../lib/atomicWrite.js";
import {
  chapterReaderDocHash,
  REVIEW_DOC_HASH_VERSION,
} from "../review/readerReview.js";

// ── Paths ─────────────────────────────────────────────────────────────────────

/** Directory holding a book's review history + latest-pointer files. */
export function reviewDir(bookId: string, stateRoot: string = CANONICAL_STATE): string {
  return resolve(stateRoot, "reviews", bookId);
}

/** Append-only history record path: keyed by the reviewed CONTENT HASH so a
 *  re-review at the same content overwrites its own file (idempotent) and a
 *  different content mints a new file (history never lost). */
export function reviewHistoryPath(bookId: string, chapterNumber: number, contentHash: string, stateRoot: string = CANONICAL_STATE): string {
  const nn = String(chapterNumber).padStart(2, "0");
  return resolve(reviewDir(bookId, stateRoot), `ch${nn}.${contentHash}.review.json`);
}

/** The materialized (rebuildable) clears cache path. */
export function reviewClearsPath(bookId: string, stateRoot: string = CANONICAL_STATE): string {
  return resolve(stateRoot, "reviews", `${bookId}.review-clears.json`);
}

// ── Ledger shapes ─────────────────────────────────────────────────────────────

export type ReviewClearEntry = {
  chapterNumber: number;
  chapterId: string;
  contentHash: string;
  docHash: string;
  bar: number;
  reviewerSessionId: string;
  composite: number;
  reviewedAt: string;
};

export type ReviewClearsLedger = {
  schemaVersion: "review-clears-v1";
  bookId: string;
  updatedAt: string;
  clears: ReviewClearEntry[];
};

// ── Persist a review into the history (called on every persistReview) ─────────

/** Append the review to the immutable content-keyed history. Idempotent per
 *  (chapter, contentHash): re-persisting the same content overwrites its own
 *  file with byte-identical content. Returns the history path written. Best-
 *  effort caller: a history write failure must never convert a valid review into
 *  a halt (the latest-pointer artifact is still written by writeChapterReview). */
export function appendReviewHistory(bookId: string, review: ChapterReviewV1, stateRoot: string = CANONICAL_STATE): string {
  const p = reviewHistoryPath(bookId, review.chapterNumber, review.contentHash, stateRoot);
  mkdirSync(dirname(p), { recursive: true });
  writeFileAtomic(p, JSON.stringify(review, null, 2) + "\n");
  return p;
}

// ── C3 tiebreak notes (S-tier plan, adversarial round-2 #4) ───────────────────

export type TiebreakNote = {
  chapterNumber: number;
  contentHash: string;
  at: string;
  outcome: "converted-to-pass" | "fail-stands";
  /** The must-fix complaints of the read(s) the majority overrode — preserved so
   *  a later churn-HIGH acceptance reject can still target them (the early
   *  signal stays aggregatable instead of dying with the overridden read). */
  overriddenComplaints: string[];
  reads: Array<{ reviewerSessionId: string; composite: number; ship: boolean; valid: boolean }>;
};

export function tiebreakNotesPath(bookId: string, stateRoot: string = CANONICAL_STATE): string {
  return resolve(reviewDir(bookId, stateRoot), "tiebreak-notes.json");
}

/** Append one tiebreak note (read-modify-write; the file is small and single-
 *  writer by the run lock). Best-effort caller: a note failure never converts a
 *  decided review into a halt. */
export function appendTiebreakNote(bookId: string, note: TiebreakNote, stateRoot: string = CANONICAL_STATE): string {
  const p = tiebreakNotesPath(bookId, stateRoot);
  mkdirSync(dirname(p), { recursive: true });
  const notes = loadTiebreakNotes(bookId, stateRoot);
  notes.push(note);
  writeFileAtomic(p, JSON.stringify(notes, null, 2) + "\n");
  return p;
}

export function loadTiebreakNotes(bookId: string, stateRoot: string = CANONICAL_STATE): TiebreakNote[] {
  const p = tiebreakNotesPath(bookId, stateRoot);
  if (!existsSync(p)) return [];
  try {
    const parsed = JSON.parse(readFileSync(p, "utf8"));
    return Array.isArray(parsed) ? (parsed as TiebreakNote[]) : [];
  } catch {
    return [];
  }
}

/** Load every history record for a book (newest-mtime-independent; we key on
 *  content, not time). Skips unparseable/mismatched files. */
export function loadReviewHistory(bookId: string, stateRoot: string = CANONICAL_STATE): ChapterReviewV1[] {
  const dir = reviewDir(bookId, stateRoot);
  if (!existsSync(dir)) return [];
  const out: ChapterReviewV1[] = [];
  for (const f of readdirSync(dir)) {
    // History files are ch<NN>.<hash>.review.json; the latest-pointer is
    // ch<NN>.review.json (no hash segment) — skip the pointer so a legacy
    // pointer without binding fields can't sneak into the ledger.
    if (!/^ch\d+\.[0-9a-f]+\.review\.json$/.test(f)) continue;
    try {
      const rec = JSON.parse(readFileSync(resolve(dir, f), "utf8")) as ChapterReviewV1;
      if (rec && rec.schemaVersion === CHAPTER_REVIEW_SCHEMA_VERSION) out.push(rec);
    } catch { /* skip torn record */ }
  }
  return out;
}

// ── Rebuild the materialized clears cache from the history ────────────────────

/** Derive the review-clears ledger from the full history. Pure over the
 *  immutable history records — only PASS+valid reviews carrying all binding
 *  fields become clears (the cache mirrors what the reuse predicate would
 *  accept, so a stale cache can never grant a carry the predicate would refuse:
 *  the predicate reverifies anyway). Deterministic order: chapter then
 *  contentHash. */
export function buildReviewClearsLedger(bookId: string, stateRoot: string = CANONICAL_STATE): ReviewClearsLedger {
  const history = loadReviewHistory(bookId, stateRoot);
  const clears: ReviewClearEntry[] = [];
  for (const rec of history) {
    if (!rec.pass || !rec.valid) continue;
    if (rec.hashVersion !== REVIEW_DOC_HASH_VERSION) continue;
    if (typeof rec.bar !== "number" || typeof rec.docHash !== "string" || rec.docHash.length === 0) continue;
    if (!rec.reviewerSessionId) continue;
    clears.push({
      chapterNumber: rec.chapterNumber,
      chapterId: rec.chapterId,
      contentHash: rec.contentHash,
      docHash: rec.docHash,
      bar: rec.bar,
      reviewerSessionId: rec.reviewerSessionId,
      composite: rec.composite,
      reviewedAt: rec.reviewedAt ?? "",
    });
  }
  clears.sort((a, b) => (a.chapterNumber - b.chapterNumber) || (a.contentHash < b.contentHash ? -1 : a.contentHash > b.contentHash ? 1 : 0));
  return { schemaVersion: "review-clears-v1", bookId, updatedAt: new Date().toISOString(), clears };
}

/** Materialize the derived clears ledger to disk (called after each persisted
 *  review). Returns the path. */
export function writeReviewClearsLedger(bookId: string, stateRoot: string = CANONICAL_STATE): string {
  const p = reviewClearsPath(bookId, stateRoot);
  mkdirSync(dirname(p), { recursive: true });
  writeFileAtomic(p, JSON.stringify(buildReviewClearsLedger(bookId, stateRoot), null, 2) + "\n");
  return p;
}

// ── The reuse predicate ───────────────────────────────────────────────────────

export type ReviewCarryResult =
  | { hit: true; review: ChapterReviewV1 }
  | { hit: false; reason: string };

/**
 * Decide whether a persisted review can be REUSED for `chapter` at the current
 * `bar`, given the chapter's CURRENT author session (recomputed NOW by the
 * caller). Reverifies against the HISTORY records directly (the ledger cache is
 * never trusted as evidence). Fail-closed: any missing/mismatched condition →
 * { hit: false }.
 *
 * The winning record is the history record for THIS chapter whose contentHash +
 * docHash match the current chapter bytes, that PASSed valid at the current bar
 * under the current hash version, and whose reviewer was not the current author.
 */
export function carryReviewFor(
  bookId: string,
  chapter: ChapterV21,
  bar: number,
  currentAuthorSession: string | undefined,
  stateRoot: string = CANONICAL_STATE,
): ReviewCarryResult {
  const wantContent = chapterContentHash(chapter);
  const wantDoc = chapterReaderDocHash(chapter);
  const candidates = loadReviewHistory(bookId, stateRoot).filter((r) => r.chapterNumber === chapter.number);
  if (candidates.length === 0) return { hit: false, reason: "no persisted review history for this chapter" };
  for (const rec of candidates) {
    if (rec.schemaVersion !== CHAPTER_REVIEW_SCHEMA_VERSION) continue;
    if (rec.contentHash !== wantContent) continue;
    if (rec.hashVersion !== REVIEW_DOC_HASH_VERSION) continue;
    if (rec.docHash !== wantDoc) continue;
    if (rec.bar !== bar) continue;
    if (!rec.pass || !rec.valid) continue;
    if (!rec.reviewerSessionId) continue;
    // Independence is re-checked NOW against the chapter's CURRENT author
    // session (a chapter re-authored by the same session that once reviewed it
    // must not carry that review forward).
    if (currentAuthorSession && rec.reviewerSessionId === currentAuthorSession) continue;
    return { hit: true, review: rec };
  }
  return {
    hit: false,
    reason: `no reusable review: needs a PASS+valid record at content ${wantContent} / doc ${wantDoc.slice(0, 12)}… / bar ${bar} / hash ${REVIEW_DOC_HASH_VERSION}, reviewer ≠ current author`,
  };
}

/**
 * PASS-lock predicate (CONVERGENCE-SAFE PASS, 2026-07-05): does `chapter`
 * currently hold a DURABLE PASS — an independent reviewer's PASS bound to its
 * exact current content+doc bytes at `bar`? This is a thin, side-effect-free
 * wrapper over `carryReviewFor` (the same fail-closed evidence), used by the
 * book-wide budget-repair lane to REFUSE full-re-authoring a passing chapter.
 *
 * Fail-DIRECTION is deliberately "NOT locked" on every uncertainty (unknown bar,
 * unreadable/torn ledger, any throw): a false "locked" could let a genuine
 * blocker be force-carried (worse); a false "not locked" only risks re-authoring
 * a chapter whose PASS we could not confirm — exactly today's behavior. So the
 * predicate can only ever PROTECT, never HIDE.
 */
export function holdsDurablePass(
  bookId: string,
  chapter: ChapterV21,
  bar: number | undefined,
  currentAuthorSession: string | undefined,
  stateRoot: string = CANONICAL_STATE,
): boolean {
  if (typeof bar !== "number" || !Number.isFinite(bar)) return false;
  try {
    return carryReviewFor(bookId, chapter, bar, currentAuthorSession, stateRoot).hit;
  } catch {
    return false;
  }
}

// ── PASS-lock decision forensics (CONVERGENCE-SAFE PASS, 2026-07-05) ───────────

/** A durable audit trail of every PASS-lock decision the book-wide budget-repair
 *  lane made about a chapter holding a durable PASS:
 *   - `protected-downgrade`: a book-wide budget blocker was carried ONLY by
 *     PASS-locked chapter(s), so it was downgraded to advisory and the passing
 *     chapter was NOT reopened (the convergence-safe outcome).
 *   - `reopened-anomaly`: the regression guard observed a PASS-locked chapter's
 *     content hash CHANGE across the repair round — this must never happen under
 *     the carry-aware router, so it is recorded as a bug signal alongside a halt.
 *  This is the "why was / wasn't a passing chapter reopened" record the operator
 *  reads to audit convergence. Rebuildable/deletable; never gates a decision. */
export type ReopenDecision = "protected-downgrade" | "reopened-anomaly";

export type ReopenNote = {
  chapterNumber: number;
  contentHash: string;
  at: string;
  decision: ReopenDecision;
  /** The checkId that would have reopened the chapter (e.g. "CHB10.lexical_saturation"). */
  trigger: string;
  detail?: string;
};

export function reopenNotesPath(bookId: string, stateRoot: string = CANONICAL_STATE): string {
  return resolve(reviewDir(bookId, stateRoot), "reopen-notes.json");
}

/** Append one reopen note (read-modify-write, small single-writer file). Best-
 *  effort: a note failure never converts a decided repair into a halt. Mirrors
 *  `appendTiebreakNote`. */
export function appendReopenNote(bookId: string, note: ReopenNote, stateRoot: string = CANONICAL_STATE): string {
  const p = reopenNotesPath(bookId, stateRoot);
  mkdirSync(dirname(p), { recursive: true });
  const notes = loadReopenNotes(bookId, stateRoot);
  notes.push(note);
  writeFileAtomic(p, JSON.stringify(notes, null, 2) + "\n");
  return p;
}

export function loadReopenNotes(bookId: string, stateRoot: string = CANONICAL_STATE): ReopenNote[] {
  const p = reopenNotesPath(bookId, stateRoot);
  if (!existsSync(p)) return [];
  try {
    const parsed = JSON.parse(readFileSync(p, "utf8"));
    return Array.isArray(parsed) ? (parsed as ReopenNote[]) : [];
  } catch {
    return [];
  }
}
