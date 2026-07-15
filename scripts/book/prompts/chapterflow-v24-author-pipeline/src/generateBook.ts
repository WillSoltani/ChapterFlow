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
import { RunPolicy } from "./policy/runPolicy.js";
import { ChapterV21, PriorChapterShapes } from "./types.js";
import { runBookGate, formatBookGateReport, BookGateReport } from "./critics/bookGate.js";
import { classifyCounterShape } from "./critics/bookPatternAudit.js";
import { promoteBook, formatPromotionResult, PromotionResult } from "./promoteBook.js";
import { runCategorizer } from "./agents/categorizer.js";
import { loadCanonicalChapterIndex } from "./lib/chapterSet.js";
import { currentProviderIdentity } from "./cache/stageCache.js";
import { currentSessionId } from "./qc/sessionProvenance.js";
import { repairPromptPathFromError, writeSelfHealingRepairPrompt } from "./repair/selfHealingRepair.js";
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
  /** v22 cost/quality policy. Final gates remain strict. */
  runPolicy?: RunPolicy;
};

export type GenerateBookFailure = { chapter: ChapterSpec; error: string; repairPromptPath?: string };

export type GenerateBookResult = {
  bookId: string;
  totalChapters: number;
  succeeded: ChapterV21[];
  failed: GenerateBookFailure[];
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
  const failed: GenerateBookFailure[] = [];

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
        runPolicy: options.runPolicy,
      });
      succeeded.push(produced);
    } catch (err) {
      const msg = (err as Error).message;
      const inheritedPrompt = repairPromptPathFromError(err);
      const repairPromptPath = inheritedPrompt ?? writeSelfHealingRepairPrompt({
        bookId: book.bookId,
        title: book.title,
        author: book.author,
        runId: process.env.CHAPTERFLOW_RUN_ID,
        stage: "chapter-generation",
        severity: "blocker",
        chapter: { chapterId: ch.chapterId, chapterNumber: ch.chapterNumber, chapterTitle: ch.chapterTitle },
        summary: `Chapter generation failed for ${ch.chapterId}.`,
        error: err,
        validationCommands: [
          `npx tsx src/cli.ts author-check state/chapters/${ch.chapterId}.v21-native.chapter.json`,
          `npx tsx src/cli.ts gate-chapter state/chapters/${ch.chapterId}.v21-native.chapter.json`,
          `npx tsx src/cli.ts book-gate ${book.bookId}`,
        ],
      }).promptPath;
      log(`Chapter ${ch.chapterNumber} FAILED: ${msg}`);
      log(`Repair prompt: ${repairPromptPath}`);
      failed.push({ chapter: ch, error: msg, repairPromptPath });
      if (!options.continueOnError) {
        log(`Aborting book generation. Pass continueOnError=true to skip and continue.`);
        break;
      }
    }
  }

  log(`\n=== Book gate (${succeeded.length} chapters succeeded, ${failed.length} failed) ===`);
  // Content-excellence Track B (2026-07-15): this is the NEW-authoring book gate
  // (runBookGate on freshly written chapters). Force structural-sameness
  // enforcement here so a SEVERE architecture monoculture (all-4-axes mold)
  // becomes a hard blocker that halts auto-promotion of a fresh book — the
  // pipeline should never first-ship a one-mold book. Replay/gold/repair and
  // promoteBook re-gates omit the option and stay advisory (gold corpus unchanged).
  const bookGate = runBookGate(book.bookId, succeeded, { structuralSamenessMode: "enforce" });
  log(formatBookGateReport(bookGate));

  // Persist book gate report
  const reportDir = resolve(STATE, "books");
  mkdirSync(reportDir, { recursive: true });
  const bookGateReportPath = resolve(reportDir, `${book.bookId}.book-gate.json`);
  writeFileSync(
    bookGateReportPath,
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
      const repair = writeSelfHealingRepairPrompt({
        bookId: book.bookId,
        title: book.title,
        author: book.author,
        runId: process.env.CHAPTERFLOW_RUN_ID,
        stage: "chapter-generation",
        severity: "blocker",
        summary: `${failed.length} chapter(s) failed during generation, so promotion was skipped.`,
        findings: failed.map((f) => ({
          id: "chapter-generation-failed",
          severity: "blocker",
          chapterNumber: f.chapter.chapterNumber,
          unit: f.chapter.chapterId,
          message: f.error,
          evidence: f.repairPromptPath,
          expectedFix: "Open the chapter-specific repair prompt and fix that chapter before rerunning the pipeline.",
        })),
        artifacts: failed.flatMap((f) => f.repairPromptPath ? [f.repairPromptPath] : []),
      });
      log(`\n=== Skipping promotion: ${failed.length} chapter(s) failed during generation ===`);
      log(`Book-level repair prompt: ${repair.promptPath}`);
    } else if (!bookGate.passed) {
      const offendingChapters = [...new Set(bookGate.findings.flatMap((f) => f.chapters ?? []))].sort((a, b) => a - b);
      const repair = writeSelfHealingRepairPrompt({
        bookId: book.bookId,
        title: book.title,
        author: book.author,
        runId: process.env.CHAPTERFLOW_RUN_ID,
        stage: "book-gate",
        severity: "blocker",
        summary: `Book gate blocked ${book.bookId}: ${bookGate.findings.filter((f) => f.severity === "blocker").length} blocker(s), ${bookGate.findings.filter((f) => f.severity === "major").length} major(s).`,
        findings: bookGate.findings.map((f) => ({
          id: f.catalogId,
          severity: f.severity,
          chapterNumber: f.chapters?.[0],
          path: f.path,
          message: f.message,
          evidence: f.evidence,
          expectedFix: "Repair the smallest named chapter set so the book-level pattern/identity issue clears; do not edit gate code or palette config.",
        })),
        artifacts: [bookGateReportPath],
        validationCommands: [
          ...offendingChapters.map((n) => `npx tsx src/cli.ts gate-chapter state/chapters/${book.bookId}-ch${String(n).padStart(2, "0")}.v21-native.chapter.json`),
          `npx tsx src/cli.ts book-gate ${book.bookId}`,
        ],
      });
      log(`\n=== Skipping promotion: book gate has blockers ===`);
      log(`Repair prompt: ${repair.promptPath}`);
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
      if (!promotion.promoted) {
        const repair = writeSelfHealingRepairPrompt({
          bookId: book.bookId,
          title: book.title,
          author: book.author,
          runId: process.env.CHAPTERFLOW_RUN_ID,
          stage: "promotion",
          severity: "blocker",
          summary: promotion.reason,
          artifacts: [promotion.reportPath],
          findings: [{
            id: "promotion-blocked",
            severity: "blocker",
            message: promotion.reason,
            evidence: promotion.reportPath,
            expectedFix: "Open the promotion report, fix the first blocking category, and rerun promote-book. Do not bypass QC/source/generation debt gates.",
          }],
          validationCommands: [
            `npx tsx src/cli.ts diagnose ${book.bookId}`,
            `npx tsx src/cli.ts promote-book ${book.bookId} --title ${shellQuote(book.title)} --author ${shellQuote(book.author)}`,
          ],
        });
        log(`Promotion repair prompt: ${repair.promptPath}`);
      }
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

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}
