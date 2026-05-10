/**
 * Extract a chapter index from a v13 .modern.json package and write it to
 * state/indexes/<bookId>.json so the v21 pipeline can iterate the chapters.
 *
 *   npx tsx scripts/book/prompts/chapterflow-v21-authored/src/scratch/extract-chapter-index.ts \
 *     <bookId>
 *
 * Reads:  book-packages/<bookId>.modern.json
 * Writes: scripts/book/prompts/chapterflow-v21-authored/state/indexes/<bookId>.json
 *
 * The output is the array shape generateBook expects: [{ chapterId, chapterNumber, chapterTitle }, ...].
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "../../../../../..");
const INDEX_DIR = resolve(__dirname, "../../state/indexes");

const bookId = process.argv[2];
if (!bookId) {
  console.error(`Usage: extract-chapter-index.ts <bookId>`);
  console.error(`  Example: extract-chapter-index.ts atomic-habits`);
  process.exit(2);
}

const v13Path = resolve(REPO_ROOT, "book-packages", `${bookId}.modern.json`);
if (!existsSync(v13Path)) {
  console.error(`v13 package not found: ${v13Path}`);
  process.exit(2);
}

const pkg = JSON.parse(readFileSync(v13Path, "utf8"));
const chapters = pkg.chapters ?? [];
if (chapters.length === 0) {
  console.error(`No chapters in ${v13Path}`);
  process.exit(2);
}

const index = chapters.map((c: any) => ({
  chapterId: `${bookId}-ch${String(c.number).padStart(2, "0")}`,
  chapterNumber: c.number,
  chapterTitle: c.title,
}));

mkdirSync(INDEX_DIR, { recursive: true });
const outPath = resolve(INDEX_DIR, `${bookId}.json`);
writeFileSync(outPath, JSON.stringify(index, null, 2), "utf8");

console.log(`Wrote ${outPath} with ${index.length} chapters`);
console.log(`  Title:  ${pkg.book?.title}`);
console.log(`  Author: ${pkg.book?.author}`);
console.log(`First 3:`);
for (const c of index.slice(0, 3)) {
  console.log(`  ${c.chapterNumber}. ${c.chapterTitle}`);
}
