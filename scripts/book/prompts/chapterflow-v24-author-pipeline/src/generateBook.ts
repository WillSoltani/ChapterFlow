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
import { legacyRouteDisabled } from "./runtime/legacyRouteInventory.js";

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
  throw legacyRouteDisabled("generateBook.generateBook");
}

export function loadChapterIndex(bookId: string): ChapterSpec[] {
  return loadCanonicalChapterIndex(bookId);
}

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}
