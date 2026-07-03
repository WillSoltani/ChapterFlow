/**
 * CLI driver for the cross-book signature-phrase audit.
 *
 * Usage:
 *   npx tsx scripts/book/prompts/chapterflow-v21-authored/src/scratch/run-cross-book-audit.ts
 *
 * Prints the top 50 phrases that recur in ≥3 chapters across ≥2 books.
 * A phrase appearing in 4+ books is a banned-phrase candidate — operator
 * reviews the head of the list and adds entries to
 * config/banned-phrases.json (or regenerates the affected books).
 */

import { findCrossBookTells, runCrossBookSignatureAudit } from "../critics/crossBookSignatureAudit.js";

const tells = findCrossBookTells(runCrossBookSignatureAudit("book-packages"));
console.log("Cross-book signature phrase tells (≥3 chapters, ≥2 books):");
for (const tell of tells.slice(0, 50)) {
  console.log(`\n  ${tell.occurrences.length} hits across ${tell.bookCount} books: "${tell.phrase}"`);
  for (const occ of tell.occurrences.slice(0, 5)) {
    console.log(`    - ${occ.book} Ch${occ.chapter} (${occ.tier})`);
  }
  if (tell.occurrences.length > 5) console.log(`    - …+${tell.occurrences.length - 5} more`);
}
