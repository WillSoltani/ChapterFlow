/**
 * Cross-book signature-phrase audit.
 *
 * Scans EVERY v21 book package in a directory and surfaces sentences that
 * recur verbatim across multiple books. Catches model-voice signatures that
 * a single-book audit cannot see — phrases like "On a note beside the work,
 * write the reminders plainly" appearing in 7 different books, or "the real
 * lever is" spreading across books before being banned.
 *
 * Output is a watchlist of (phrase, occurrences, bookCount) tuples. A phrase
 * appearing in ≥3 chapters across ≥2 distinct books is a candidate for
 * banned-phrases.json — operator reviews the top of the list and decides.
 */

import { readFileSync, readdirSync } from "fs";
import { join } from "path";

export type Occurrence = { book: string; chapter: number; tier: string };

/** Ordinary short sentences (4–5 words) would flood the watchlist, so the length
 *  floor drops from 6 to 4 words ONLY for aphorism-SHAPED sentences: a semicolon-
 *  joined antithesis, or a two-clause comma couplet whose halves are each 1–4
 *  words ("Agreement nods, commitment signs"). Everything else keeps the 6-word
 *  floor. Deliberately simple — the point is to admit minted one-liners like
 *  "Agreement nods; commitment signs" (4 words) without lowering the floor for
 *  every 4-word sentence in the catalog. */
export function isAphorismShaped(sentence: string): boolean {
  if (/;/.test(sentence)) return true;
  const parts = sentence
    .replace(/[.!?]+\s*$/g, "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (parts.length !== 2) return false;
  return parts.every((p) => {
    const w = p.split(/\s+/).filter(Boolean).length;
    return w >= 1 && w <= 4;
  });
}

export function runCrossBookSignatureAudit(packageDir: string): Map<string, Occurrence[]> {
  const phraseHits: Map<string, Occurrence[]> = new Map();
  const books = readdirSync(packageDir).filter((f) => f.endsWith(".v21.json"));

  for (const filename of books) {
    const path = join(packageDir, filename);
    let pkg: any;
    try {
      pkg = JSON.parse(readFileSync(path, "utf8"));
    } catch {
      continue;
    }
    const bookId = pkg.book?.bookId ?? filename;
    const chapters = pkg.chapters ?? [];

    for (const ch of chapters) {
      // The fields a model-voice signature actually leaks into. The original
      // audit scanned only the three breakdown tiers; "Agreement nods;
      // commitment signs" leaked through coreSkill / counterintuition /
      // memorableLines — fields no breakdown-only scan ever read.
      const fields: Array<[string, string]> = [
        ["fastRead", ch.breakdown?.fastRead ?? ""],
        ["deepRead", ch.breakdown?.deepRead ?? ""],
        ["fullRead", ch.breakdown?.fullRead ?? ""],
        ["counterintuition", ch.counterintuition ?? ""],
        ["keyTakeaway", ch.keyTakeaway ?? ""],
        ["tryThisNow", ch.tryThisNow ?? ""],
        ["coreSkill", ch.implementationPlan?.coreSkill ?? ""],
        ["memorableLines", (ch.memorableLines ?? []).map((m: any) => m?.text ?? "").join(". ")],
      ];
      for (const [tierName, tierText] of fields) {
        const sentences = tierText.match(/[A-Z][^.!?]*[.!?]/g) ?? [];
        for (const sentence of sentences) {
          const wordCount = sentence.trim().split(/\s+/).filter(Boolean).length;
          // Aphorism-shaped one-liners get a 4-word floor; everything else 6.
          const floor = isAphorismShaped(sentence) ? 4 : 6;
          if (wordCount < floor || wordCount > 25) continue;
          const normalized = sentence
            .toLowerCase()
            .replace(/[^a-z\s]/g, "")
            .replace(/\s+/g, " ")
            .trim();
          if (!normalized) continue;
          const arr = phraseHits.get(normalized) ?? [];
          arr.push({ book: bookId, chapter: ch.number, tier: tierName });
          phraseHits.set(normalized, arr);
        }
      }
    }
  }
  return phraseHits;
}

export type CrossBookTell = {
  phrase: string;
  occurrences: Occurrence[];
  bookCount: number;
};

export function findCrossBookTells(hits: Map<string, Occurrence[]>): CrossBookTell[] {
  const tells: CrossBookTell[] = [];
  for (const [phrase, occs] of hits) {
    const distinctBooks = new Set(occs.map((o) => o.book)).size;
    if (occs.length >= 3 && distinctBooks >= 2) {
      tells.push({ phrase, occurrences: occs, bookCount: distinctBooks });
    }
  }
  return tells.sort(
    (a, b) => b.bookCount - a.bookCount || b.occurrences.length - a.occurrences.length,
  );
}
