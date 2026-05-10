/**
 * Full-book orchestrator. Generates every chapter of a book sequentially,
 * resume-aware (skips already-generated chapters), with a final book-level
 * gate.
 *
 * For mass production: run multiple `generateBook` calls in parallel rather
 * than parallelizing chapters within a single book. The library state ledger
 * handles cross-book name dedup correctly under sequential ingestion.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

import { generateChapter, BookMeta, ChapterSpec } from "./generateChapter.js";
import { ChapterV21 } from "./types.js";
import { runBookGate, formatBookGateReport, BookGateReport } from "./critics/bookGate.js";
import { promoteBook, formatPromotionResult, PromotionResult } from "./promoteBook.js";
import { runCategorizer } from "./agents/categorizer.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const STATE = resolve(__dirname, "../state");

export type GenerateBookOptions = {
  /** Optional chapter range. If omitted, generates all chapters in `chapters`. */
  fromChapter?: number;
  toChapter?: number;
  /** Logger. Defaults to console with timestamps. */
  logger?: (msg: string) => void;
  /** Continue past failures rather than aborting the run. */
  continueOnError?: boolean;
  /** Auto-promote to book-packages/ on success. Default true. */
  autoPromote?: boolean;
};

export type GenerateBookResult = {
  bookId: string;
  totalChapters: number;
  succeeded: ChapterV21[];
  failed: Array<{ chapter: ChapterSpec; error: string }>;
  bookGate: BookGateReport;
  promotion?: PromotionResult;
  totalWallTimeSec: number;
};

export async function generateBook(
  book: BookMeta,
  chapters: ChapterSpec[],
  options: GenerateBookOptions = {},
): Promise<GenerateBookResult> {
  const log = options.logger ?? ((m: string) => {
    const ts = new Date().toISOString().slice(11, 19);
    console.log(`[${ts}] ${m}`);
  });

  const range = chapters.filter((c) => {
    if (options.fromChapter !== undefined && c.chapterNumber < options.fromChapter) return false;
    if (options.toChapter !== undefined && c.chapterNumber > options.toChapter) return false;
    return true;
  });

  log(`=== generateBook: ${book.title} (${range.length} chapters) ===`);

  const overall = Date.now();
  const succeeded: ChapterV21[] = [];
  const failed: Array<{ chapter: ChapterSpec; error: string }> = [];

  for (let i = 0; i < range.length; i++) {
    const ch = range[i];
    log(`\n--- Chapter ${ch.chapterNumber}/${range[range.length - 1].chapterNumber}: ${ch.chapterTitle} ---`);
    try {
      const produced = await generateChapter(book, ch);
      succeeded.push(produced);
    } catch (err) {
      const msg = (err as Error).message;
      log(`Chapter ${ch.chapterNumber} FAILED: ${msg}`);
      failed.push({ chapter: ch, error: msg });
      if (!options.continueOnError) {
        log(`Aborting book generation. Pass continueOnError=true to skip and continue.`);
        break;
      }
    }
  }

  log(`\n=== Book gate (${succeeded.length} chapters succeeded, ${failed.length} failed) ===`);
  const bookGate = runBookGate(book.bookId, succeeded);
  log(formatBookGateReport(bookGate));

  // Persist book gate report
  const reportDir = resolve(STATE, "books");
  mkdirSync(reportDir, { recursive: true });
  writeFileSync(
    resolve(reportDir, `${book.bookId}.book-gate.json`),
    JSON.stringify(bookGate, null, 2),
    "utf8",
  );

  // Library promotion — the final gate. Runs only if every chapter succeeded
  // AND the book gate had no blockers. Even then, promoteBook re-validates.
  let promotion: PromotionResult | undefined;
  const autoPromote = options.autoPromote !== false;
  if (autoPromote) {
    if (failed.length > 0) {
      log(`\n=== Skipping promotion: ${failed.length} chapter(s) failed during generation ===`);
    } else if (!bookGate.passed) {
      log(`\n=== Skipping promotion: book gate has blockers ===`);
    } else {
      log(`\n=== Categorizer ===`);
      const categorized = await runCategorizer({
        bookId: book.bookId,
        title: book.title,
        author: book.author,
        chapterTitles: chapters.map((c) => c.chapterTitle),
      });
      log(`categories: ${categorized.categories.join(", ")}`);
      log(`tags: ${categorized.tags.join(", ")}`);

      log(`\n=== Library promotion ===`);
      promotion = promoteBook({
        bookId: book.bookId,
        title: book.title,
        author: book.author,
        chapters: range,
        categories: categorized.categories,
        tags: categorized.tags,
      });
      log(formatPromotionResult(promotion));
    }
  }

  const totalWallTimeSec = Math.round((Date.now() - overall) / 1000);
  log(`\n=== generateBook done in ${totalWallTimeSec}s (${(totalWallTimeSec / 60).toFixed(1)} min) ===`);

  return {
    bookId: book.bookId,
    totalChapters: range.length,
    succeeded,
    failed,
    bookGate,
    promotion,
    totalWallTimeSec,
  };
}

/** Read a chapter index file. The index is an array of ChapterSpec objects
 *  describing every chapter in a book. Stored at state/indexes/<bookId>.json. */
export function loadChapterIndex(bookId: string): ChapterSpec[] {
  const path = resolve(STATE, "indexes", `${bookId}.json`);
  if (!existsSync(path)) {
    throw new Error(`Chapter index not found at ${path}. Create it before running generateBook.`);
  }
  return JSON.parse(readFileSync(path, "utf8")) as ChapterSpec[];
}
