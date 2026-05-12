#!/usr/bin/env tsx

/**
 * Regenerate memorable lines for any chapter where one or more pins no longer
 * appear verbatim in the prose. Uses the memorable-lines marker agent which
 * is cheap (Haiku-tier, ~30s/chapter) and free under the Anthropic CLI
 * provider on a Max subscription.
 *
 * Triggered when a polish/refactor pass rewrote prose without updating pins.
 * The A11 ship-gate critic now catches this at gate time; this script fixes
 * the existing damage. After regeneration each chapter is re-validated; the
 * book package + sidecar are both updated so reader and catalog stay in sync.
 *
 *   npx tsx scripts/book/prompts/chapterflow-v21-authored/src/scratch/regenerate-broken-memorable-lines.ts
 *   npx tsx scripts/book/prompts/chapterflow-v21-authored/src/scratch/regenerate-broken-memorable-lines.ts --book antifragile
 *   npx tsx scripts/book/prompts/chapterflow-v21-authored/src/scratch/regenerate-broken-memorable-lines.ts --dry-run
 */

import { existsSync, readFileSync, readdirSync, writeFileSync } from "fs";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

import { runMemorableLines } from "../agents/memorable-lines.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "../../../../../..");
const BOOK_PACKAGES = resolve(REPO_ROOT, "book-packages");
const STATE_CHAPTERS = resolve(__dirname, "../../state/chapters");

function proseFor(chapter: any): string {
  return (
    (chapter.breakdown?.fastRead ?? "") +
    "\n" +
    (chapter.breakdown?.deepRead ?? "") +
    "\n" +
    (chapter.breakdown?.fullRead ?? "")
  );
}

function brokenPins(chapter: any): number[] {
  const lines = Array.isArray(chapter.memorableLines) ? chapter.memorableLines : [];
  if (lines.length === 0) return [];
  const prose = proseFor(chapter);
  const broken: number[] = [];
  for (let i = 0; i < lines.length; i++) {
    const t = lines[i]?.text;
    if (!t) continue;
    if (!prose.includes(t)) broken.push(i);
  }
  return broken;
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const bookFilterIdx = args.indexOf("--book");
  const bookFilter = bookFilterIdx >= 0 ? args[bookFilterIdx + 1] : null;

  const v21Files = readdirSync(BOOK_PACKAGES).filter((f) => f.endsWith(".v21.json"));
  let touchedBooks = 0;
  let regenChapters = 0;
  let failed: Array<{ bookId: string; chapter: number; reason: string }> = [];

  for (const file of v21Files) {
    const bookId = file.replace(".v21.json", "");
    if (bookFilter && bookId !== bookFilter) continue;

    const pkgPath = resolve(BOOK_PACKAGES, file);
    const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
    let pkgChanged = false;

    for (const chapter of pkg.chapters) {
      const broken = brokenPins(chapter);
      if (broken.length === 0) continue;

      console.log(
        `${bookId} ch${chapter.number}: ${broken.length} broken pin(s) — regenerating all memorableLines from current prose`,
      );

      if (dryRun) continue;

      try {
        const result = await runMemorableLines(chapter);
        chapter.memorableLines = result.memorableLines;
        pkgChanged = true;
        regenChapters += 1;

        // Update the corresponding chapter sidecar so the cache matches.
        const sidecarPath = resolve(
          STATE_CHAPTERS,
          `${bookId}-ch${String(chapter.number).padStart(2, "0")}.v21-native.chapter.json`,
        );
        if (existsSync(sidecarPath)) {
          const sidecar = JSON.parse(readFileSync(sidecarPath, "utf8"));
          sidecar.memorableLines = result.memorableLines;
          writeFileSync(sidecarPath, JSON.stringify(sidecar, null, 2), "utf8");
        }
      } catch (err) {
        const msg = (err as Error).message;
        console.error(`  FAILED ${bookId} ch${chapter.number}: ${msg}`);
        failed.push({ bookId, chapter: chapter.number, reason: msg });
      }
    }

    if (pkgChanged) {
      writeFileSync(pkgPath, JSON.stringify(pkg, null, 2), "utf8");
      touchedBooks += 1;
    }
  }

  console.log(`\n=== regeneration complete ===`);
  console.log(`books touched: ${touchedBooks}`);
  console.log(`chapters regenerated: ${regenChapters}`);
  console.log(`failures: ${failed.length}`);
  if (failed.length > 0) {
    for (const f of failed) console.log(`  - ${f.bookId} ch${f.chapter}: ${f.reason}`);
  }
  if (dryRun) console.log(`(dry-run — no files modified)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
