#!/usr/bin/env tsx

/**
 * Repair broken memorableLines across every v21 chapter.
 *
 * A pinned memorable line is "broken" when its `.text` field no longer
 * appears verbatim in any of the chapter's breakdown tiers (fastRead /
 * deepRead / fullRead). This happens when a polish or refactor pass
 * rewrote the prose without updating the pin. The polish operation
 * shipped 298 broken lines across 22 books before the A11 gate-chapter
 * critic was added.
 *
 * For each broken pin, this script:
 *   1. Splits the chapter's breakdown prose into sentences.
 *   2. For each prose sentence, computes word-overlap with the broken
 *      pin's text (case-insensitive token Jaccard).
 *   3. If the best-match sentence's overlap is >= 0.55 (over half the
 *      content words shared), repoints memorableLines[i].text to that
 *      sentence. Updates the matching state/chapters/<id>.v21-native.
 *      chapter.json AND the book-packages/<id>.v21.json so reader and
 *      catalog stay in sync.
 *   4. If no good match exists, leaves the pin broken and adds it to a
 *      manual-review report.
 *
 * Run after a polish pass. Re-run gate-chapter on the repaired chapters
 * to confirm A11 now passes.
 *
 *   npx tsx scripts/book/prompts/chapterflow-v21-authored/src/scratch/repair-broken-memorable-lines.ts
 *   npx tsx scripts/book/prompts/chapterflow-v21-authored/src/scratch/repair-broken-memorable-lines.ts --book antifragile
 *   npx tsx scripts/book/prompts/chapterflow-v21-authored/src/scratch/repair-broken-memorable-lines.ts --dry-run
 */

import { existsSync, readFileSync, readdirSync, writeFileSync } from "fs";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "../../../../../..");
const BOOK_PACKAGES = resolve(REPO_ROOT, "book-packages");
const STATE_CHAPTERS = resolve(__dirname, "../../state/chapters");

const MATCH_THRESHOLD = 0.55;
const STOPWORDS = new Set(
  "the a an and or but if of in on at to for is are was were be been being have has had do does did".split(" "),
);

function tokenize(s: string): Set<string> {
  return new Set(
    s
      .toLowerCase()
      .replace(/[^\w\s']/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 1 && !STOPWORDS.has(w)),
  );
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter += 1;
  return inter / (a.size + b.size - inter);
}

function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 15);
}

type Repair = {
  bookId: string;
  chapter: number;
  pinIndex: number;
  before: string;
  after: string | null;
  score: number;
};

type ManualReview = {
  bookId: string;
  chapter: number;
  pinIndex: number;
  text: string;
  bestMatch: string;
  bestScore: number;
};

function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const bookFilterIdx = args.indexOf("--book");
  const bookFilter = bookFilterIdx >= 0 ? args[bookFilterIdx + 1] : null;

  const v21Files = readdirSync(BOOK_PACKAGES).filter((f) => f.endsWith(".v21.json"));
  const repaired: Repair[] = [];
  const manual: ManualReview[] = [];

  for (const file of v21Files) {
    const bookId = file.replace(".v21.json", "");
    if (bookFilter && bookId !== bookFilter) continue;

    const pkgPath = resolve(BOOK_PACKAGES, file);
    const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
    let pkgChanged = false;

    for (const chapter of pkg.chapters) {
      const lines = Array.isArray(chapter.memorableLines) ? chapter.memorableLines : [];
      if (lines.length === 0) continue;

      const prose =
        (chapter.breakdown?.fastRead ?? "") +
        "\n" +
        (chapter.breakdown?.deepRead ?? "") +
        "\n" +
        (chapter.breakdown?.fullRead ?? "");
      const sentences = splitSentences(prose);
      const sentenceTokens = sentences.map((s) => tokenize(s));

      for (let i = 0; i < lines.length; i++) {
        const pinText: string | undefined = lines[i]?.text;
        if (!pinText) continue;
        if (prose.includes(pinText)) continue; // pin is intact, skip

        const pinTokens = tokenize(pinText);
        let bestScore = 0;
        let bestSentence: string | null = null;
        for (let j = 0; j < sentences.length; j++) {
          const score = jaccard(pinTokens, sentenceTokens[j]);
          if (score > bestScore) {
            bestScore = score;
            bestSentence = sentences[j];
          }
        }

        if (bestSentence && bestScore >= MATCH_THRESHOLD) {
          repaired.push({
            bookId,
            chapter: chapter.number,
            pinIndex: i,
            before: pinText,
            after: bestSentence,
            score: bestScore,
          });
          if (!dryRun) {
            lines[i].text = bestSentence;
            pkgChanged = true;
          }
        } else {
          manual.push({
            bookId,
            chapter: chapter.number,
            pinIndex: i,
            text: pinText,
            bestMatch: bestSentence ?? "(none)",
            bestScore,
          });
        }
      }
    }

    if (pkgChanged && !dryRun) {
      writeFileSync(pkgPath, JSON.stringify(pkg, null, 2), "utf8");

      // Mirror the same change into the per-chapter sidecar so the cache
      // stays consistent with the package. If we skip this, a future
      // generateBook resume would re-promote from the sidecars and undo
      // the repair.
      for (const chapter of pkg.chapters) {
        const sidecarPath = resolve(
          STATE_CHAPTERS,
          `${bookId}-ch${String(chapter.number).padStart(2, "0")}.v21-native.chapter.json`,
        );
        if (!existsSync(sidecarPath)) continue;
        const sidecar = JSON.parse(readFileSync(sidecarPath, "utf8"));
        if (Array.isArray(sidecar.memorableLines) && Array.isArray(chapter.memorableLines)) {
          for (let i = 0; i < chapter.memorableLines.length; i++) {
            if (sidecar.memorableLines[i]?.text !== chapter.memorableLines[i]?.text) {
              sidecar.memorableLines[i].text = chapter.memorableLines[i].text;
            }
          }
          writeFileSync(sidecarPath, JSON.stringify(sidecar, null, 2), "utf8");
        }
      }
    }
  }

  console.log(`\n=== repair summary ===`);
  console.log(`repaired: ${repaired.length} pins across ${new Set(repaired.map((r) => r.bookId)).size} books`);
  console.log(`needs manual review: ${manual.length} pins`);
  if (dryRun) console.log(`(dry-run — no files modified)`);

  if (manual.length > 0) {
    console.log(`\n=== manual review needed ===`);
    for (const m of manual.slice(0, 20)) {
      console.log(`  ${m.bookId} ch${m.chapter} pin[${m.pinIndex}]: score ${m.bestScore.toFixed(2)}`);
      console.log(`    before: "${m.text.slice(0, 80)}${m.text.length > 80 ? "…" : ""}"`);
      console.log(`    best:   "${m.bestMatch.slice(0, 80)}${m.bestMatch.length > 80 ? "…" : ""}"`);
    }
    if (manual.length > 20) console.log(`  ... and ${manual.length - 20} more`);
  }

  if (repaired.length > 0 && !dryRun) {
    const reviewPath = resolve(__dirname, "../../reports/memorable-line-repairs.json");
    writeFileSync(reviewPath, JSON.stringify({ repaired, manual }, null, 2), "utf8");
    console.log(`\nfull repair log: ${reviewPath}`);
  }
}

main();
