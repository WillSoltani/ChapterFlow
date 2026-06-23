/**
 * Full-book orchestrator. Generates every chapter of a book sequentially,
 * resume-aware (skips already-generated chapters), with a final book-level
 * gate.
 *
 * For mass production: run multiple `generateBook` calls in parallel rather
 * than parallelizing chapters within a single book. The library state ledger
 * handles cross-book name dedup correctly under sequential ingestion.
 */

import { writeFileSync, mkdirSync } from "fs";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

import { generateChapter, BookMeta, ChapterSpec } from "./generateChapter.js";
import { ChapterV21, PriorChapterShapes } from "./types.js";
import { runBookGate, formatBookGateReport, BookGateReport } from "./critics/bookGate.js";
import { classifyCounterShape } from "./critics/bookPatternAudit.js";
import { promoteBook, formatPromotionResult, PromotionResult } from "./promoteBook.js";
import { runCategorizer } from "./agents/categorizer.js";
import { loadCanonicalChapterIndex } from "./lib/chapterSet.js";
import { currentProviderIdentity } from "./cache/stageCache.js";
import { currentSessionId } from "./qc/sessionProvenance.js";
import {
  createGenerationRunManifest,
  generationInputHashes,
  recordGenerationDegradation,
  writeGenerationManifestSidecar,
} from "./generationDegradation.js";

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
  /** Skip the categorizer model call. Required for inline-operator runs that
   *  do not want any subprocess model calls. When true, the operator must
   *  provide manualCategories + manualTags. */
  noCategorizer?: boolean;
  /** Operator-supplied categories; used when noCategorizer is true. */
  manualCategories?: string[];
  /** Operator-supplied tags; used when noCategorizer is true. */
  manualTags?: string[];
  /** Bypass chapter/intermediate cache reuse. Newly generated output still gates normally. */
  force?: boolean;
  /** Test/tooling hook for deterministic cache-version invalidation. */
  cacheCodeVersion?: string;
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
      const priorChapterShapes = buildPriorChapterShapes(succeeded);
      const produced = await generateChapter(book, ch, {
        logger: log,
        priorChapterShapes,
        force: options.force,
        cacheCodeVersion: options.cacheCodeVersion,
      });
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
  const fullCanonicalRange =
    range.length === chapters.length &&
    range.every((c, i) => c.chapterId === chapters[i].chapterId && c.chapterNumber === chapters[i].chapterNumber);
  if (autoPromote) {
    if (!fullCanonicalRange) {
      log(`\n=== Skipping production promotion: chapter range runs are nonproduction (${range.length}/${chapters.length} canonical chapters) ===`);
    } else if (failed.length > 0) {
      log(`\n=== Skipping promotion: ${failed.length} chapter(s) failed during generation ===`);
    } else if (!bookGate.passed) {
      log(`\n=== Skipping promotion: book gate has blockers ===`);
    } else {
      let categories: string[] | undefined;
      let tags: string[] | undefined;
      if (options.noCategorizer) {
        log(`\n=== Categorizer SKIPPED (--no-categorizer) ===`);
        categories = options.manualCategories;
        tags = options.manualTags;
        if (categories) log(`manual categories: ${categories.join(", ")}`);
        if (tags) log(`manual tags: ${tags.join(", ")}`);
        if (!categories || !tags) {
          log(`WARNING: --no-categorizer set without manual categories/tags; promoting without metadata.`);
        }
      } else {
        log(`\n=== Categorizer ===`);
        try {
          const categorized = await runCategorizer({
            bookId: book.bookId,
            title: book.title,
            author: book.author,
            chapterTitles: chapters.map((c) => c.chapterTitle),
          });
          categories = categorized.categories;
          tags = categorized.tags;
          log(`categories: ${categories.join(", ")}`);
          log(`tags: ${tags.join(", ")}`);
        } catch (err) {
          // Categorizer failure shouldn't block promotion. Categories are
          // optional metadata; the book is still shippable. Operator can rerun
          // the categorizer later (it caches once it succeeds).
          const categorizerManifest = createGenerationRunManifest({
            runId: process.env.CHAPTERFLOW_RUN_ID ?? `${book.bookId}.categorizer.${Date.now()}`,
            chapterId: `${book.bookId}.categorizer`,
            authorSessionId: currentSessionId() ?? "legacy-unknown",
            provider: currentProviderIdentity("critic"),
            codeVersion: options.cacheCodeVersion,
            sourceHash: null,
            sourceAnchorCatalogHash: null,
            planHash: null,
          });
          const event = recordGenerationDegradation(categorizerManifest, {
            stage: "categorizer",
            inputHashes: generationInputHashes({ book, chapterTitles: chapters.map((c) => c.chapterTitle) }),
            error: err,
            attemptCount: 1,
            fallbackUsed: {
              kind: "omitted-categories-and-tags",
              policy: "metadata-only",
              reason: "Categorizer failed; promotion can continue because categories/tags are optional metadata.",
            },
            fallbackOutput: { categories: null, tags: null },
            severity: "advisory",
            requiredDisposition: "visible_advisory",
          });
          writeGenerationManifestSidecar(categorizerManifest);
          log(`categorizer failed (${(err as Error).message}); promoting without categories — recorded advisory degradation ${event.eventId}`);
        }
      }

      log(`\n=== Library promotion ===`);
      promotion = promoteBook({
        bookId: book.bookId,
        title: book.title,
        author: book.author,
        chapters: range,
        categories,
        tags,
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

/** Build PriorChapterShapes from the chapters already produced in this run.
 *  Cached/resumed chapters count too, because generateChapter ingests them
 *  into `succeeded` before returning. Keeps writers steered away from over-
 *  used opener words and counter shapes as the book is built. */
function buildPriorChapterShapes(prior: ChapterV21[]): PriorChapterShapes {
  const priorHookFirstWords: string[] = [];
  const priorCounterShapes: string[] = [];
  for (const ch of prior) {
    const hook = (ch.hook ?? "").trim();
    const firstWord = hook.split(/\s+/)[0]?.toLowerCase().replace(/[^a-z']/g, "") ?? "";
    priorHookFirstWords.push(firstWord);
    priorCounterShapes.push(classifyCounterShape(ch.counterintuition ?? ""));
  }
  return { priorHookFirstWords, priorCounterShapes };
}

/** Read a chapter index file. The index is an array of ChapterSpec objects
 *  describing every chapter in a book. Stored at state/indexes/<bookId>.json. */
export function loadChapterIndex(bookId: string): ChapterSpec[] {
  return loadCanonicalChapterIndex(bookId);
}
