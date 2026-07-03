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
      const tiers: Record<string, string> = {
        fastRead: ch.breakdown?.fastRead ?? "",
        deepRead: ch.breakdown?.deepRead ?? "",
        fullRead: ch.breakdown?.fullRead ?? "",
      };
      for (const [tierName, tierText] of Object.entries(tiers)) {
        const sentences = tierText.match(/[A-Z][^.!?]*[.!?]/g) ?? [];
        for (const sentence of sentences) {
          const wordCount = sentence.trim().split(/\s+/).filter(Boolean).length;
          if (wordCount < 6 || wordCount > 25) continue;
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
