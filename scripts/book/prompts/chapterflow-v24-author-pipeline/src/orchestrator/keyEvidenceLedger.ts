/**
 * keyEvidenceLedger — E4: the key-evidence-clears ledger + its REVERIFICATION.
 *
 * A materialized cache at state/qc/<bookId>.key-evidence-clears.json recording,
 * per chapter that has PASSing manual-keyjudge evidence, the round + session +
 * content bindings the evidence was produced under. It exists so the author-arch
 * E3 per-chapter stale-subset decision can quickly tell which chapters still have
 * good keys — but it is a DERIVED CACHE, NEVER THE EVIDENCE.
 *
 * The load-bearing rule: before the stale/skip decision TRUSTS a clear, it
 * REVERIFIES the underlying round-token-anchored artifacts (reverifyClear):
 *   - both keyA AND keyB derivation files exist under clear.roundId and cover the
 *     chapter at its CURRENT contentHash + sourceHash;
 *   - the packContentKey recomputed from the CURRENT bytes (the pack projection
 *     MINUS roundId/createdAt) equals the stored pack file's projection;
 *   - the answerKeyHash recomputed from the CURRENT chapter quiz equals the stored
 *     one (a choice/correctIndex edit invalidates even without a prose change);
 *   - keyASessionId !== keyBSessionId (HARD — never env-gated) and NEITHER equals
 *     the chapter's author session.
 * Any failure → the clear is STALE → the chapter falls through to fresh
 * derivation. Delete the ledger and every chapter reverifies-or-re-derives from
 * the round-anchored artifacts (never a silent pass).
 *
 * Promote's checkManualKeyJudge / checkSweep are UNTOUCHED — they are already
 * content-bound; this ledger only accelerates (and hardens) the AUTHOR-ARCH
 * evidence-production decision, and it can only ever cause MORE derivation, never
 * less (fail-closed).
 */

import { createHash } from "crypto";
import { existsSync, mkdirSync, readFileSync } from "fs";
import { dirname, resolve } from "path";

import type { ChapterV21 } from "../types.js";
import { CANONICAL_STATE } from "../lib/chapterPaths.js";
import { writeFileAtomic } from "../lib/atomicWrite.js";
import { chapterContentHash } from "../critics/qcAttestation.js";
import {
  keyDerivationPath,
  loadKeyPack,
  loadManualKeyJudge,
  type KeyDerivation,
  type KeyPack,
} from "../qc/manualKeyJudge.js";
import { sourceHashFor } from "../qc/sourceV2Gate.js";

// ── Content-identity projections ──────────────────────────────────────────────

function sha256(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value), "utf8").digest("hex");
}

/** sha256 over the canonical [{prompt,choices,correctIndex}] of a chapter quiz.
 *  The chapter's ANSWER-KEY identity: a choice text edit OR a correctIndex flip
 *  changes it (even when the surrounding prose does not). */
export function answerKeyHashFor(chapter: ChapterV21): string {
  const canon = (chapter.quiz?.questions ?? []).map((q) => ({
    prompt: q.prompt,
    choices: q.choices,
    correctIndex: q.correctIndex,
  }));
  return sha256(canon);
}

/** The CONTENT-ONLY identity of a key pack: shaJson of the pack MINUS the
 *  round-scoped/time fields (roundId, createdAt). Two packs built for the same
 *  chapter bytes + source in DIFFERENT rounds share this key, so a pack carried
 *  from an older round still matches the current bytes' projection. */
export function packContentKeyOf(pack: Pick<KeyPack, Exclude<keyof KeyPack, "roundId" | "createdAt">> & Partial<Pick<KeyPack, "roundId" | "createdAt">>): string {
  const { roundId: _r, createdAt: _c, ...rest } = pack as KeyPack;
  return sha256(rest);
}

// ── Ledger shapes ─────────────────────────────────────────────────────────────

export type KeyEvidenceClear = {
  chapterNumber: number;
  chapterId: string;
  contentHash: string;
  sourceHash: string;
  /** sha256 over the canonical [{prompt,choices,correctIndex}] of the chapter quiz. */
  answerKeyHash: string;
  /** shaJson of the key pack projection MINUS roundId/createdAt (content-only identity). */
  packContentKey: string;
  roundId: string;
  keyASessionId: string;
  keyBSessionId: string;
  status: "PASS";
  resolvedAt: string;
};

export type KeyEvidenceClearsLedger = {
  schemaVersion: "key-evidence-clears-v1";
  bookId: string;
  updatedAt: string;
  clears: KeyEvidenceClear[];
};

export function keyEvidenceClearsPath(bookId: string, stateRoot: string = CANONICAL_STATE): string {
  return resolve(stateRoot, "qc", `${bookId}.key-evidence-clears.json`);
}

export function loadKeyEvidenceClears(bookId: string, stateRoot: string = CANONICAL_STATE): KeyEvidenceClearsLedger | null {
  const p = keyEvidenceClearsPath(bookId, stateRoot);
  if (!existsSync(p)) return null;
  try {
    const rec = JSON.parse(readFileSync(p, "utf8")) as KeyEvidenceClearsLedger;
    if (rec && rec.schemaVersion === "key-evidence-clears-v1" && Array.isArray(rec.clears)) return rec;
  } catch { /* torn ledger → treat as absent (reverify/re-derive) */ }
  return null;
}

// ── Derivation loading (round-token-anchored artifacts) ───────────────────────

function loadDerivationFile(bookId: string, roundId: string, role: "keyA" | "keyB"): KeyDerivation | null {
  const p = keyDerivationPath(bookId, roundId, role);
  if (!existsSync(p)) return null;
  try {
    const rec = JSON.parse(readFileSync(p, "utf8")) as KeyDerivation;
    if (rec && rec.schemaVersion === "manual-key-derive-v2") return rec;
  } catch { /* torn → null */ }
  return null;
}

// ── Rebuild the ledger from the round-anchored artifacts ──────────────────────

/**
 * Rebuild the ledger from the manual-keyjudge records + their backing derivation
 * files. A chapter earns a clear ONLY when its manual-keyjudge record is PASS at
 * the current content+source AND both keyA/keyB derivations covering it (under
 * that record's roundId) exist with distinct sessions. Pure over on-disk
 * artifacts; never throws.
 */
export function buildKeyEvidenceClearsLedger(bookId: string, chapters: ChapterV21[], stateRoot: string = CANONICAL_STATE): KeyEvidenceClearsLedger {
  const clears: KeyEvidenceClear[] = [];
  for (const ch of [...chapters].sort((a, b) => a.number - b.number)) {
    const rec = loadManualKeyJudge(bookId, ch.number);
    if (!rec || rec.status !== "PASS") continue;
    const contentHash = chapterContentHash(ch);
    const sourceHash = sourceHashFor(bookId, ch.number) ?? "";
    if (rec.contentHash !== contentHash || rec.sourceHash !== sourceHash) continue;
    const a = loadDerivationFile(bookId, rec.roundId, "keyA");
    const b = loadDerivationFile(bookId, rec.roundId, "keyB");
    const ca = a?.chapters.find((c) => c.chapterNumber === ch.number);
    const cb = b?.chapters.find((c) => c.chapterNumber === ch.number);
    if (!a || !b || !ca || !cb) continue;
    const pack = loadKeyPack(bookId, rec.roundId, ch.number);
    if (!pack) continue;
    clears.push({
      chapterNumber: ch.number,
      chapterId: ch.chapterId,
      contentHash,
      sourceHash,
      answerKeyHash: answerKeyHashFor(ch),
      packContentKey: packContentKeyOf(pack),
      roundId: rec.roundId,
      keyASessionId: String(a.reviewerSessionId ?? ""),
      keyBSessionId: String(b.reviewerSessionId ?? ""),
      status: "PASS",
      resolvedAt: rec.resolvedAt,
    });
  }
  return { schemaVersion: "key-evidence-clears-v1", bookId, updatedAt: new Date().toISOString(), clears };
}

export function writeKeyEvidenceClearsLedger(bookId: string, chapters: ChapterV21[], stateRoot: string = CANONICAL_STATE): string {
  const p = keyEvidenceClearsPath(bookId, stateRoot);
  mkdirSync(dirname(p), { recursive: true });
  writeFileAtomic(p, JSON.stringify(buildKeyEvidenceClearsLedger(bookId, chapters, stateRoot), null, 2) + "\n");
  return p;
}

// ── The REVERIFICATION (the load-bearing gate) ────────────────────────────────

export type ReverifyResult = { fresh: true } | { fresh: false; reason: string };

/**
 * Reverify a clear against the CURRENT chapter bytes + the round-token-anchored
 * derivation/pack artifacts. Returns fresh:true ONLY when every binding still
 * holds. Any failure → fresh:false with a reason (the chapter falls through to
 * fresh derivation — fail-closed).
 *
 * `authorSession` is the chapter's CURRENT author session; the two key sessions
 * must be distinct from each other AND from it (a HARD independence check that is
 * NOT gated on CHAPTERFLOW_ENFORCE_SESSION_INDEPENDENCE).
 */
export function reverifyClear(
  bookId: string,
  chapter: ChapterV21,
  clear: KeyEvidenceClear,
  authorSession: string | undefined,
  stateRoot: string = CANONICAL_STATE,
): ReverifyResult {
  const contentHash = chapterContentHash(chapter);
  const sourceHash = sourceHashFor(bookId, chapter.number) ?? "";

  // 1. The clear must bind to the CURRENT content + source + answer-key.
  if (clear.contentHash !== contentHash) return { fresh: false, reason: "content hash changed since the clear" };
  if (clear.sourceHash !== sourceHash) return { fresh: false, reason: "source hash changed since the clear" };
  if (clear.answerKeyHash !== answerKeyHashFor(chapter)) return { fresh: false, reason: "answer-key hash changed (a choice/correctIndex edit) since the clear" };

  // 2. Session independence is HARD (never env-gated).
  if (!clear.keyASessionId || !clear.keyBSessionId) return { fresh: false, reason: "clear is missing a key session id" };
  if (clear.keyASessionId === clear.keyBSessionId) return { fresh: false, reason: "keyA and keyB were the same session — not independent" };
  if (authorSession && (clear.keyASessionId === authorSession || clear.keyBSessionId === authorSession)) {
    return { fresh: false, reason: "a key session is the chapter's own author session" };
  }

  // 3. Both derivation files must still exist under the clear's round and cover
  //    this chapter at the CURRENT content+source, with matching sessions.
  const a = loadDerivationFile(bookId, clear.roundId, "keyA");
  const b = loadDerivationFile(bookId, clear.roundId, "keyB");
  if (!a || !b) return { fresh: false, reason: `a keyA/keyB derivation file is missing under round ${clear.roundId}` };
  if (String(a.reviewerSessionId ?? "") !== clear.keyASessionId) return { fresh: false, reason: "keyA derivation session no longer matches the clear" };
  if (String(b.reviewerSessionId ?? "") !== clear.keyBSessionId) return { fresh: false, reason: "keyB derivation session no longer matches the clear" };
  const ca = a.chapters.find((c) => c.chapterNumber === chapter.number);
  const cb = b.chapters.find((c) => c.chapterNumber === chapter.number);
  if (!ca || !cb) return { fresh: false, reason: `a derivation no longer covers ch${chapter.number}` };
  if (ca.contentHash !== contentHash || cb.contentHash !== contentHash) return { fresh: false, reason: "a derivation's content hash is stale" };
  if (ca.sourceHash !== sourceHash || cb.sourceHash !== sourceHash) return { fresh: false, reason: "a derivation's source hash is stale" };

  // 4. Recompute the pack projection from the CURRENT stored pack file and match.
  const pack = loadKeyPack(bookId, clear.roundId, chapter.number);
  if (!pack) return { fresh: false, reason: `key pack missing under round ${clear.roundId}` };
  if (packContentKeyOf(pack) !== clear.packContentKey) return { fresh: false, reason: "pack content projection changed since the clear" };
  // The pack must itself bind to the current bytes (defence-in-depth: a pack from
  // a different content would have a different packContentKey, but assert anyway).
  if (pack.contentHash !== contentHash) return { fresh: false, reason: "stored pack content hash is stale" };

  return { fresh: true };
}

/**
 * The chapter numbers whose key evidence is DURABLY fresh according to the ledger
 * AFTER reverification. A chapter counts as fresh iff the ledger has a clear for
 * it that reverifies. Any chapter without a reverified clear is treated as stale
 * (needs fresh derivation) by the caller. Returns a Set of chapter numbers.
 */
export function reverifiedFreshChapters(
  bookId: string,
  chapters: ChapterV21[],
  authorSessionOf: (chapterId: string) => string | undefined,
  stateRoot: string = CANONICAL_STATE,
): Set<number> {
  const fresh = new Set<number>();
  const ledger = loadKeyEvidenceClears(bookId, stateRoot);
  if (!ledger) return fresh;
  const byChapter = new Map<number, KeyEvidenceClear>();
  for (const c of ledger.clears) byChapter.set(c.chapterNumber, c); // last wins; caller ledger is rebuilt each write
  for (const ch of chapters) {
    const clear = byChapter.get(ch.number);
    if (!clear) continue;
    if (reverifyClear(bookId, ch, clear, authorSessionOf(ch.chapterId), stateRoot).fresh) fresh.add(ch.number);
  }
  return fresh;
}
