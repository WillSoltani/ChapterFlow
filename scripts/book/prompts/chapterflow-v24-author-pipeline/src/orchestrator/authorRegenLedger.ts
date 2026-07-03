/**
 * authorRegenLedger — E2 regen-cap persistence.
 *
 * AUTHOR_REGEN_CAP is a GLOBAL cap on write attempts per chapter across the
 * review round + the book-rejection round. The original doAuthorReview tracked
 * consumption in an IN-MEMORY `regenerated` Set that is created fresh on every
 * conductor entry — so a re-entry silently RESET each chapter's budget, letting
 * a chapter that already exhausted its regen quietly regenerate again (the
 * budget-reset that lets a churning chapter loop instead of halting).
 *
 * This durable ledger persists the consumed regen count per chapter to
 * state/books/<bookId>.author-regen-ledger.json. doAuthorReview LOADS it on
 * entry and MERGES it with the in-memory tracking, so the cap is honored across
 * re-entries. A CARRIED review PASS never resets the counts (a carry is not a
 * write attempt). AUTHOR_REGEN_CAP semantics are otherwise identical.
 */

import { existsSync, mkdirSync, readFileSync } from "fs";
import { dirname, resolve } from "path";

import { CANONICAL_STATE } from "../lib/chapterPaths.js";
import { writeFileAtomic } from "../lib/atomicWrite.js";

export type AuthorRegenLedger = {
  schemaVersion: "author-regen-ledger-v1";
  bookId: string;
  updatedAt: string;
  /** chapterNumber → number of REGENERATIONS consumed (write attempts BEYOND the
   *  original authoring). A chapter at AUTHOR_REGEN_CAP-1 has no regen left. */
  consumed: Record<string, number>;
};

export function authorRegenLedgerPath(bookId: string, stateRoot: string = CANONICAL_STATE): string {
  return resolve(stateRoot, "books", `${bookId}.author-regen-ledger.json`);
}

export function loadAuthorRegenLedger(bookId: string, stateRoot: string = CANONICAL_STATE): AuthorRegenLedger {
  const p = authorRegenLedgerPath(bookId, stateRoot);
  if (existsSync(p)) {
    try {
      const rec = JSON.parse(readFileSync(p, "utf8")) as AuthorRegenLedger;
      if (rec && rec.schemaVersion === "author-regen-ledger-v1" && rec.consumed && typeof rec.consumed === "object") {
        return rec;
      }
    } catch { /* torn ledger → start empty (a lost budget-count fails OPEN toward
                 fewer regens because the in-memory tracking still caps the run;
                 but an unreadable ledger cannot be trusted to have counted, so
                 we treat it as empty and re-accumulate this run). */ }
  }
  return { schemaVersion: "author-regen-ledger-v1", bookId, updatedAt: new Date().toISOString(), consumed: {} };
}

/** How many regens a chapter has ALREADY consumed across prior entries. */
export function regenConsumedFor(ledger: AuthorRegenLedger, chapterNumber: number): number {
  const v = ledger.consumed[String(chapterNumber)];
  return Number.isInteger(v) && v > 0 ? v : 0;
}

/** Record ONE additional consumed regeneration for a chapter and persist. The
 *  count only ever grows (a carried PASS or a fresh review is not a regen and
 *  never decrements it). Returns the new persisted ledger. */
export function recordRegenConsumed(bookId: string, chapterNumber: number, stateRoot: string = CANONICAL_STATE): AuthorRegenLedger {
  const ledger = loadAuthorRegenLedger(bookId, stateRoot);
  const key = String(chapterNumber);
  ledger.consumed[key] = regenConsumedFor(ledger, chapterNumber) + 1;
  ledger.updatedAt = new Date().toISOString();
  const p = authorRegenLedgerPath(bookId, stateRoot);
  mkdirSync(dirname(p), { recursive: true });
  writeFileAtomic(p, JSON.stringify(ledger, null, 2) + "\n");
  return ledger;
}
