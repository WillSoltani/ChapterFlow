/**
 * authorAcceptanceState — E1: DURABLE, fail-closed derivation of whether the
 * v24 author-arch book acceptance still holds.
 *
 * The conductor's `authorBookAccepted` was a MEMORY-ONLY flag reset on every
 * entry, so a fully-QC'd, already-accepted book that RE-ENTERED the conductor
 * was routed straight back to the "qc" phase by decidePhase — re-running the
 * whole reader-review + acceptance + evidence machinery on byte-identical
 * content (the #1 re-entry cost). This derives acceptance from DURABLE, content-
 * bound evidence instead, so a re-entry over unchanged content goes straight to
 * READY (0 sessions).
 *
 * Acceptance is TRUE only when BOTH hold (any doubt → FALSE → the phase re-runs):
 *   (a) EVERY on-disk chapter carries a FRESH PUBLISHABLE attestation whose
 *       dimensions.bookAcceptance === true. Fresh = isAttestationFresh (the same
 *       content-binding the promote gate uses), so an edit to any chapter after
 *       acceptance stales its attestation and drops acceptance. These attestations
 *       are the ones writeAuthorAcceptance stamps at the end of a successful
 *       acceptance, so their presence + freshness is a durable certificate that
 *       acceptance was reached AT THESE BYTES.
 *   (b) The NEWEST persisted acceptance record (state/reviews/<book>/acceptance.*.json,
 *       written by Q6 in runBookAcceptance) has accepted === true AND met the
 *       valid-reader quorum (validCount >= AUTHOR_BOOK_READERS) — the SAME quorum
 *       runBookAcceptance itself enforces. This is a corroborating durable trail;
 *       acceptance is NEVER derived from the record alone (the attestations are
 *       the content-bound truth), but a record that says "rejected" or fell below
 *       quorum blocks acceptance even if attestations look fresh.
 *
 * Fail-closed everywhere: a missing/stale/unparseable/tampered attestation, no
 * acceptance record, an unreadable record, or a below-quorum/ not-accepted record
 * all resolve to NOT accepted. Never throws.
 */

import { existsSync, readFileSync, readdirSync } from "fs";
import { resolve } from "path";

import type { ChapterV21 } from "../types.js";
import { CANONICAL_STATE } from "../lib/chapterPaths.js";
import { attestationPath, isAttestationFresh, loadAttestation, type QcAttestation } from "../critics/qcAttestation.js";
import { loadBookChapters } from "../qc/manualKeyJudge.js";
import { AUTHOR_BOOK_READERS, type AuthorAcceptanceRecord } from "./authorReview.js";

export type DurableAcceptanceResult = {
  accepted: boolean;
  /** A human-legible reason acceptance did NOT hold (empty when accepted). */
  reason: string;
};

function loadStoredAttestation(bookId: string, chapterNumber: number): QcAttestation | null {
  try {
    const bytes = readFileSync(attestationPath(bookId, chapterNumber));
    return loadAttestation(bookId, chapterNumber, bytes);
  } catch {
    return null;
  }
}

/** Load the newest persisted acceptance record for a book, or null. "Newest" =
 *  the record with the greatest `at` ISO timestamp (round2 supersedes round1;
 *  a re-run supersedes an older one). Skips unparseable/foreign files. */
export function loadNewestAcceptanceRecord(bookId: string, stateRoot: string = CANONICAL_STATE): AuthorAcceptanceRecord | null {
  const dir = resolve(stateRoot, "reviews", bookId);
  if (!existsSync(dir)) return null;
  let newest: AuthorAcceptanceRecord | null = null;
  for (const f of readdirSync(dir)) {
    if (!/^acceptance\..+\.json$/.test(f)) continue;
    try {
      const rec = JSON.parse(readFileSync(resolve(dir, f), "utf8")) as AuthorAcceptanceRecord;
      if (!rec || rec.schemaVersion !== "author-acceptance-v1" || rec.bookId !== bookId) continue;
      if (!newest || String(rec.at) > String(newest.at)) newest = rec;
    } catch { /* skip torn/foreign record */ }
  }
  return newest;
}

/**
 * Derive whether book acceptance durably holds for `bookId` at its CURRENT
 * on-disk bytes. `loadChapters` injectable for tests (defaults to the real
 * canonical loader); `stateRoot` injectable so tests read a tmp state dir.
 */
export function deriveDurableAcceptance(
  bookId: string,
  loadChapters: (bookId: string) => ChapterV21[] = loadBookChapters,
  stateRoot: string = CANONICAL_STATE,
): DurableAcceptanceResult {
  let chapters: ChapterV21[];
  try {
    chapters = loadChapters(bookId);
  } catch (err) {
    return { accepted: false, reason: `could not load chapters: ${(err as Error).message}` };
  }
  if (chapters.length === 0) return { accepted: false, reason: "no chapters on disk" };

  // (a) EVERY chapter carries a FRESH PUBLISHABLE attestation with bookAcceptance.
  for (const ch of chapters) {
    const bookIdOfCh = bookId; // attestations are keyed by (bookId, chapterNumber)
    const att = loadStoredAttestation(bookIdOfCh, ch.number);
    if (!att) return { accepted: false, reason: `ch${ch.number}: no attestation` };
    if (att.verdict !== "PUBLISHABLE") return { accepted: false, reason: `ch${ch.number}: attestation verdict ${att.verdict}, not PUBLISHABLE` };
    if (att.dimensions?.bookAcceptance !== true) return { accepted: false, reason: `ch${ch.number}: attestation does not carry dimensions.bookAcceptance === true` };
    if (!isAttestationFresh(att, ch)) return { accepted: false, reason: `ch${ch.number}: attestation is STALE (content changed since acceptance)` };
  }

  // (b) The NEWEST acceptance record must say accepted at quorum. NEVER derive
  //     acceptance from this alone — it corroborates (a).
  const record = loadNewestAcceptanceRecord(bookId, stateRoot);
  if (!record) return { accepted: false, reason: "no persisted acceptance record" };
  if (record.accepted !== true) return { accepted: false, reason: `newest acceptance record (${record.roundLabel || "round1"}) is not accepted` };
  const validCount = record.verdict?.validCount ?? 0;
  if (validCount < AUTHOR_BOOK_READERS) {
    return { accepted: false, reason: `newest acceptance record met only ${validCount}/${AUTHOR_BOOK_READERS} valid-reader quorum` };
  }

  return { accepted: true, reason: "" };
}
