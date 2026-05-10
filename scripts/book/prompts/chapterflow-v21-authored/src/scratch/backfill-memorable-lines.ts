/**
 * Backfill memorable-lines for chapters that pre-date the marker agent.
 *
 * Some chapters were generated in early pipeline runs before the
 * memorable-lines agent existed. Subsequent runs auto-resume from chapter
 * cache and never re-touch them, so they ship without the `memorableLines`
 * field. This script:
 *   1. Loads the v21 book package
 *   2. For each chapter missing `memorableLines`, calls runMemorableLines
 *   3. Writes the field back into the package
 *   4. Patches the corresponding state/chapters/*.json so the cache is consistent
 *
 * Usage:
 *   npx tsx scripts/book/prompts/chapterflow-v21-authored/src/scratch/backfill-memorable-lines.ts \
 *     book-packages/<bookId>.v21.json
 */

import { readFileSync, writeFileSync, existsSync } from "fs";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

import { runMemorableLines } from "../agents/memorable-lines.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "../../../../../..");
const STATE_CHAPTERS = resolve(__dirname, "../../state/chapters");

const argPath = process.argv[2];
if (!argPath) {
  console.error("usage: backfill-memorable-lines.ts <book-package.json>");
  process.exit(1);
}
const PACKAGE_PATH = resolve(REPO_ROOT, argPath);
if (!existsSync(PACKAGE_PATH)) {
  console.error(`Package not found: ${PACKAGE_PATH}`);
  process.exit(1);
}
const BOOK_ID = JSON.parse(readFileSync(PACKAGE_PATH, "utf8")).book?.bookId;
if (!BOOK_ID) {
  console.error(`Could not read book.bookId from ${PACKAGE_PATH}`);
  process.exit(1);
}

async function main() {
  const pkg = JSON.parse(readFileSync(PACKAGE_PATH, "utf8"));
  const targets = pkg.chapters.filter((ch: any) => !ch.memorableLines || ch.memorableLines.length === 0);

  if (targets.length === 0) {
    console.log("No chapters need backfill. Done.");
    return;
  }

  console.log(`Backfilling memorable-lines for ${targets.length} chapter(s):`, targets.map((c: any) => c.number).join(", "));

  for (const chapter of targets) {
    const t0 = Date.now();
    process.stdout.write(`  Ch${String(chapter.number).padStart(2, "0")} (${chapter.title})… `);
    try {
      const result = await runMemorableLines(chapter);
      chapter.memorableLines = result.memorableLines;
      const ms = Date.now() - t0;
      console.log(`${result.memorableLines.length} lines in ${ms}ms`);

      const sidecarPath = resolve(STATE_CHAPTERS, `${BOOK_ID}-ch${String(chapter.number).padStart(2, "0")}.v21-native.chapter.json`);
      if (existsSync(sidecarPath)) {
        const sidecar = JSON.parse(readFileSync(sidecarPath, "utf8"));
        sidecar.memorableLines = result.memorableLines;
        writeFileSync(sidecarPath, JSON.stringify(sidecar, null, 2));
      }
    } catch (err) {
      console.error(`FAILED:`, err);
      throw err;
    }
  }

  writeFileSync(PACKAGE_PATH, JSON.stringify(pkg, null, 2));
  console.log(`\nWrote ${PACKAGE_PATH}`);
  console.log("Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
