/**
 * Researcher orchestrator. Given a book title and author, produces every
 * artifact the downstream v21 pipeline expects:
 *
 *   .chapterflow/runs/<bookId>/<runId>/
 *     source-freeze/
 *       toc.json                       (the bibliography record)
 *       book-source.md                 (the book-level paraphrase summary)
 *       source-freeze-report.md        (research provenance + confidence)
 *     sidecars/
 *       source/
 *         ch01.source.txt              (paraphrase notes for downstream agents)
 *         ch01.source.json             (structured form of the same content)
 *         ch02.source.txt
 *         ...
 *
 *   state/indexes/<bookId>.json        (ChapterSpec[] for loadChapterIndex)
 *
 * Steps:
 *   1. runBibliographyResearch(title, author) → BibliographyResult
 *   2. For each chapter (with concurrency limit): runChapterResearch(chapter)
 *      → ChapterResearchResult
 *   3. runSourceCoherenceCheck(bundle) → coherence report
 *   4. If coherence passes (no blockers), write all artifacts to disk
 *   5. Return refs for downstream (bookId, runId, chapterSpecs)
 *
 * Idempotent / resume-aware: if .chapterflow/runs/<bookId> exists, re-uses
 * the latest run and only researches chapters whose source files are missing.
 */

import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "fs";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

import { BibliographyResult, flattenChapters, runResearcherBibliography } from "./agents/researcher-bibliography.js";
import {
  ChapterResearchResult,
  renderChapterSidecar,
  runResearcherChapter,
} from "./agents/researcher-chapter.js";
import {
  SourceCoherenceFinding,
  SourceCoherenceReport,
  formatSourceCoherenceReport,
  runSourceCoherenceCheck,
} from "./critics/sourceCoherence.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
// Repo-root anchored like every READER (source-loader, sourceGrounding,
// runDirs callers) — a cwd-relative anchor here meant research runs written
// from the documented pipeline-dir cwd landed where no reader looks.
const CHAPTERFLOW_RUNS = resolve(__dirname, "../../../../..", ".chapterflow/runs");
const STATE = resolve(__dirname, "../state");

export type ResearchBookOptions = {
  /** Override the inferred bookId. */
  bookId?: string;
  /** Parallel chapter research concurrency. Default 3. */
  chapterConcurrency?: number;
  /** Logger. Defaults to console with timestamp. */
  logger?: (msg: string) => void;
  /** If true, abort on coherence blockers. Default true. */
  failOnCoherenceBlockers?: boolean;
  /** If true, re-research a chapter even if its source file already exists.
   *  Default false (resume-aware). */
  forceRefresh?: boolean;
};

export type ResearchBookResult = {
  bookId: string;
  runId: string;
  bibliography: BibliographyResult;
  chapters: ChapterResearchResult[];
  coherence: SourceCoherenceReport;
  bundlePath: string;                  // .chapterflow/runs/<bookId>/<runId>/
  chapterIndexPath: string;            // state/indexes/<bookId>.json
};

export type ChapterSpec = {
  chapterId: string;
  chapterNumber: number;
  chapterTitle: string;
};

export async function researchBook(
  title: string,
  author: string,
  options: ResearchBookOptions = {},
): Promise<ResearchBookResult> {
  const log = options.logger ?? ((m: string) => {
    const ts = new Date().toISOString().slice(11, 19);
    console.log(`[${ts}] ${m}`);
  });

  log(`=== researchBook: "${title}" by ${author} ===`);

  // Step 1: Bibliography
  log("Step 1/4: bibliography research…");
  const bibliography = await runResearcherBibliography({
    title,
    author,
    bookIdHint: options.bookId,
  });
  log(`  bibliography: bookId=${bibliography.bookId}, ${bibliography.edition.chapterCount} chapters, confidence=${bibliography.confidence}`);
  if (bibliography.confidence === "low") {
    log(`  WARNING: low confidence. Notes: ${bibliography.notes ?? "(none)"}`);
  }

  const bookId = bibliography.bookId;
  const runId = newRunId();
  const bundlePath = resolve(CHAPTERFLOW_RUNS, bookId, runId);
  const sourceFreezeDir = resolve(bundlePath, "source-freeze");
  const sidecarsDir = resolve(bundlePath, "sidecars", "source");
  mkdirSync(sourceFreezeDir, { recursive: true });
  mkdirSync(sidecarsDir, { recursive: true });

  // Step 2: Chapter research (parallel with concurrency limit)
  log(`Step 2/4: chapter research (${bibliography.edition.chapterCount} chapters, concurrency=${options.chapterConcurrency ?? 3})…`);
  const chapterList = flattenChapters(bibliography);
  const chapters = await researchChaptersInParallel(
    bibliography,
    chapterList,
    {
      concurrency: options.chapterConcurrency ?? 3,
      sidecarsDir,
      forceRefresh: options.forceRefresh ?? false,
      log,
    },
  );
  log(`  chapter research complete: ${chapters.length}/${chapterList.length} produced`);

  // Step 3: Coherence check
  log("Step 3/4: source coherence check…");
  const coherence = runSourceCoherenceCheck({ bibliography, chapters });
  log("  " + formatSourceCoherenceReport(coherence).replace(/\n/g, "\n  "));

  if (!coherence.passed && options.failOnCoherenceBlockers !== false) {
    throw new Error(`Source coherence failed with ${coherence.findings.filter((f) => f.severity === "blocker").length} blocker(s). Inspect findings and re-run failing chapters with forceRefresh=true.`);
  }

  // Step 4: Write artifacts
  log("Step 4/4: writing artifacts…");
  writeFileSync(resolve(sourceFreezeDir, "toc.json"), JSON.stringify(bibliographyToTocJson(bibliography), null, 2), "utf8");
  writeFileSync(resolve(sourceFreezeDir, "book-source.md"), renderBookSource(bibliography, chapters), "utf8");
  writeFileSync(resolve(sourceFreezeDir, "source-freeze-report.md"), renderProvenanceReport(bibliography, chapters, coherence), "utf8");

  for (const ch of chapters) {
    const numStr = String(ch.chapterNumber).padStart(2, "0");
    writeFileSync(resolve(sidecarsDir, `ch${numStr}.source.txt`), renderChapterSidecar(ch), "utf8");
    writeFileSync(resolve(sidecarsDir, `ch${numStr}.source.json`), JSON.stringify(ch, null, 2), "utf8");
  }

  // Chapter index for loadChapterIndex
  const chapterIndexPath = resolve(STATE, "indexes", `${bookId}.json`);
  mkdirSync(dirname(chapterIndexPath), { recursive: true });
  const chapterSpecs: ChapterSpec[] = chapters.map((ch) => ({
    chapterId: `${bookId}-ch${String(ch.chapterNumber).padStart(2, "0")}`,
    chapterNumber: ch.chapterNumber,
    chapterTitle: ch.chapterTitle,
  }));
  writeFileSync(chapterIndexPath, JSON.stringify(chapterSpecs, null, 2), "utf8");

  log(`=== researchBook done: ${bundlePath} ===`);

  return {
    bookId,
    runId,
    bibliography,
    chapters,
    coherence,
    bundlePath,
    chapterIndexPath,
  };
}

async function researchChaptersInParallel(
  bibliography: BibliographyResult,
  chapterList: Array<{ number: number; title: string }>,
  opts: { concurrency: number; sidecarsDir: string; forceRefresh: boolean; log: (m: string) => void },
): Promise<ChapterResearchResult[]> {
  const results: ChapterResearchResult[] = new Array(chapterList.length);
  let cursor = 0;

  async function worker(workerId: number) {
    while (true) {
      const myIndex = cursor++;
      if (myIndex >= chapterList.length) return;
      const chapter = chapterList[myIndex];
      const numStr = String(chapter.number).padStart(2, "0");
      const sidecarPath = resolve(opts.sidecarsDir, `ch${numStr}.source.json`);

      if (!opts.forceRefresh && existsSync(sidecarPath)) {
        try {
          const cached = JSON.parse(readFileSync(sidecarPath, "utf8")) as ChapterResearchResult;
          if (cached.chapterNumber === chapter.number) {
            opts.log(`  ch${numStr} cached — skipping`);
            results[myIndex] = cached;
            continue;
          }
        } catch {
          // Fall through to fresh research if cache is corrupt.
        }
      }

      opts.log(`  ch${numStr} (worker ${workerId}): "${chapter.title}"…`);
      const startedAt = Date.now();
      try {
        const priorTitles = chapterList.filter((c) => c.number < chapter.number).map((c) => c.title);
        const ch = await runResearcherChapter({
          bibliography,
          chapter,
          priorChapterTitles: priorTitles,
        });
        const durationMs = Date.now() - startedAt;
        opts.log(`  ch${numStr} done in ${(durationMs / 1000).toFixed(1)}s (${ch.paraphraseNotes.length}c paraphrase)`);
        results[myIndex] = ch;
      } catch (err) {
        opts.log(`  ch${numStr} FAILED: ${(err as Error).message}`);
        throw err;
      }
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(opts.concurrency, chapterList.length) }, (_, i) => worker(i + 1)),
  );

  return results;
}

function newRunId(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return [
    now.getUTCFullYear(),
    pad(now.getUTCMonth() + 1),
    pad(now.getUTCDate()),
    "-",
    pad(now.getUTCHours()),
    pad(now.getUTCMinutes()),
    pad(now.getUTCSeconds()),
  ].join("");
}

/** Convert a BibliographyResult to the toc.json shape expected by
 *  source-loader.loadTableOfContents and the upload-book-package pipeline. */
function bibliographyToTocJson(b: BibliographyResult): object {
  const toc: any = {
    title: b.title,
    author: b.author,
    edition: {
      name: b.edition.name,
      publisher: b.edition.publisher,
      publishedYear: b.edition.publishedYear,
      isbn13: b.edition.isbn13,
      language: b.edition.language ?? "English",
      chapterCount: b.edition.chapterCount,
      sectionCount: b.edition.sectionCount,
    },
  };
  if (b.introduction) toc.introduction = b.introduction;
  if (b.sections && b.sections.length > 0) {
    toc.sections = b.sections;
  } else {
    toc.chapters = b.flatChapters ?? [];
  }
  return toc;
}

/** Render the book-source.md companion file. Contains the bibliography's
 *  thesis + teachingArc, plus a per-chapter index of central concepts.
 *  Downstream editor-in-chief reads this for book-level grounding. */
function renderBookSource(b: BibliographyResult, chapters: ChapterResearchResult[]): string {
  const lines: string[] = [];
  lines.push(`# ${b.title}`);
  lines.push(`by ${b.author}`);
  lines.push("");
  if (b.edition.publishedYear) lines.push(`Published ${b.edition.publishedYear}.`);
  if (b.edition.publisher) lines.push(`Publisher: ${b.edition.publisher}.`);
  lines.push("");
  lines.push(`## Thesis`);
  lines.push(b.thesis);
  lines.push("");
  lines.push(`## Teaching arc`);
  lines.push(b.teachingArc);
  lines.push("");
  lines.push(`## Author voice`);
  lines.push(`Register: ${b.authorVoice.register}.`);
  lines.push(`Signature moves:`);
  for (const m of b.authorVoice.signatureMoves) lines.push(`- ${m}`);
  lines.push(`Avoid moves:`);
  for (const m of b.authorVoice.avoidMoves) lines.push(`- ${m}`);
  lines.push("");
  lines.push(`## Chapter index of central concepts`);
  const sorted = [...chapters].sort((a, b) => a.chapterNumber - b.chapterNumber);
  for (const ch of sorted) {
    lines.push(`### Ch${ch.chapterNumber}. ${ch.chapterTitle}`);
    lines.push(`Central concept: ${ch.centralConcept.name}.`);
    lines.push(`Core claim: ${ch.coreClaim}`);
    lines.push("");
  }
  return lines.join("\n");
}

function renderProvenanceReport(
  b: BibliographyResult,
  chapters: ChapterResearchResult[],
  coherence: SourceCoherenceReport,
): string {
  const lines: string[] = [];
  lines.push(`# Source-freeze provenance — ${b.bookId}`);
  lines.push("");
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push(`Title: ${b.title}`);
  lines.push(`Author: ${b.author}`);
  lines.push(`Chapter count: ${b.edition.chapterCount}`);
  lines.push(`Bibliography confidence: ${b.confidence}`);
  if (b.notes) lines.push(`Bibliography notes: ${b.notes}`);
  lines.push("");
  lines.push(`## Per-chapter paraphrase lengths`);
  for (const ch of [...chapters].sort((a, b) => a.chapterNumber - b.chapterNumber)) {
    lines.push(`- Ch${ch.chapterNumber}: ${ch.paraphraseNotes.length} chars, ${ch.namedExamples.length} named examples`);
  }
  lines.push("");
  lines.push(`## Source coherence`);
  lines.push(formatSourceCoherenceReport(coherence));
  return lines.join("\n");
}

/** Find the most recent runId for an existing bookId. Returns null if no
 *  research has been run for this book. */
export function findLatestResearchRun(bookId: string): string | null {
  const bookDir = resolve(CHAPTERFLOW_RUNS, bookId);
  if (!existsSync(bookDir)) return null;
  const runs = readdirSync(bookDir)
    .filter((d) => statSync(resolve(bookDir, d)).isDirectory())
    .sort();
  return runs.length > 0 ? runs[runs.length - 1] : null;
}

/** Best-effort: check whether a chapter index already exists for a book.
 *  Used by the CLI to decide whether to run the researcher or skip straight
 *  to generation. */
export function hasChapterIndex(bookId: string): boolean {
  return existsSync(resolve(STATE, "indexes", `${bookId}.json`));
}

/** Convert a book title to a slug. The researcher self-reports a slug too,
 *  but the CLI uses this for quick "is there already a run?" checks before
 *  any model call. */
export function titleToSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .split(/\s+/)
    .join("-");
}
