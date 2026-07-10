/**
 * evalReaderProxy — the standalone `eval-reader-proxy` CLI verb (component A1).
 *
 *   eval-reader-proxy <bookId> [<bookId2> ...] [--chapters N] [--bar 80] [--json]
 *
 * For each book: load its production package (pipeline-local book-packages/
 * first, else the outer checkout's book-packages/), deterministically sample N
 * chapters (default 3), render each as a blinded reader document under
 * scratch/eval-proxy/, spawn ONE independent read-only codex reader per
 * sampled chapter (parallel, concurrency 4), then parse + adjudicate + persist
 * a ChapterReviewV1 per chapter and print a per-book table + median composite.
 *
 * This verb is a MEASUREMENT instrument only: it never touches autopilot /
 * conductor code, never mutates chapters, and its readers run sandbox
 * "read-only" with skipGitRepoCheck (they only read the rendered doc).
 */

import { existsSync, readFileSync } from "fs";
import { createHash } from "crypto";
import { resolve } from "path";

import type { BookPackageV21, ChapterV21 } from "../types.js";
import type { ChapterReviewV1 } from "../artifacts/artifactTypes.js";
import { CHAPTER_REVIEW_SCHEMA_VERSION, REVIEW_FACTORS, type ReviewFactor } from "../artifacts/artifactTypes.js";
import { chapterContentHash } from "../critics/qcAttestation.js";
import { REPO_ROOT, FORBIDDEN_STATE } from "../lib/chapterPaths.js";
import { ensureTrailingNewline, writeFileAtomic } from "../lib/atomicWrite.js";
import { spawnCodexAgent, codexAvailable } from "../orchestrator/codexAgent.js";
import { renderChapterReaderDocPhase1 } from "./renderReaderDoc.js";
import { adjudicateReview, assertPhase1KeyIsolated, AUTHOR_CHAPTER_BAR, buildReaderReviewTask, parseReaderReview, writeChapterReview } from "./readerReview.js";
import { buildReviewerWorkspace } from "./reviewerWorkspace.js";

/** The outer checkout root (the repo this pipeline package is nested inside).
 *  Derived from chapterPaths' exported outer-shadow constant: FORBIDDEN_STATE
 *  is `<outer-root>/state`, so its parent IS the outer root. Fallback source
 *  for book-packages/ when the pipeline-local copy is missing. */
const OUTER_CHECKOUT_ROOT = resolve(FORBIDDEN_STATE, "..");

const READER_CONCURRENCY = 4;

/** Local bounded-parallel map (self-contained: the verb must not import
 *  autopilot/conductor code). Preserves input order in the result. */
async function mapWithConcurrency<T, R>(items: T[], limit: number, fn: (item: T, i: number) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, async () => {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i], i);
    }
  });
  await Promise.all(workers);
  return results;
}

/** Resolve + parse a book's production package, or null with a reason. */
function loadBookPackage(bookId: string): { pkg: BookPackageV21; path: string } | { error: string } {
  const candidates = [
    resolve(REPO_ROOT, "book-packages", `${bookId}.v21.json`),
    resolve(OUTER_CHECKOUT_ROOT, "book-packages", `${bookId}.v21.json`),
  ];
  const path = candidates.find((p) => existsSync(p));
  if (!path) return { error: `package not found: tried ${candidates.join(" , ")}` };
  try {
    const pkg = JSON.parse(readFileSync(path, "utf8")) as BookPackageV21;
    if (!Array.isArray(pkg.chapters) || pkg.chapters.length === 0) return { error: `package has no chapters: ${path}` };
    return { pkg, path };
  } catch (err) {
    return { error: `package unreadable (${path}): ${(err as Error).message}` };
  }
}

/** Deterministic sample: sort chapters by md5(bookId + ':' + chapter.number)
 *  hex ascending, take the first n. Stable across runs and machines. */
export function sampleChapters(bookId: string, chapters: ChapterV21[], n: number): ChapterV21[] {
  const keyed = chapters.map((ch) => ({
    ch,
    key: createHash("md5").update(`${bookId}:${ch.number}`).digest("hex"),
  }));
  keyed.sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
  return keyed.slice(0, Math.max(0, Math.min(n, keyed.length))).map((k) => k.ch);
}

/** An invalid placeholder artifact for a chapter whose reader output could not
 *  be parsed/verified even after the one retry. Durable so the failure is
 *  visible in state/reviews like any other review. */
function invalidStubReview(chapter: ChapterV21, sessionId: string, reason: string): ChapterReviewV1 {
  const scores = {} as Record<ReviewFactor, number>;
  for (const f of REVIEW_FACTORS) scores[f] = 0;
  return {
    schemaVersion: CHAPTER_REVIEW_SCHEMA_VERSION,
    chapterId: chapter.chapterId,
    chapterNumber: chapter.number,
    contentHash: chapterContentHash(chapter),
    reviewerSessionId: sessionId,
    scores,
    composite: 0,
    ship84: false,
    pass: false,
    valid: false,
    keyCheck: { derived: [], matches: 0, of: chapter.quiz?.questions?.length ?? 0, disagreements: [reason] },
    quotes: [],
    tells: [],
    complaints: [],
    oneParagraphVerdict: `INVALID: ${reason}`,
  };
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  const m = s.length % 2 === 1 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
  return Math.round(m * 10) / 10;
}

type BookResult = {
  id: string;
  chapters: Array<Record<string, unknown>>;
  medianComposite: number | null;
  validCount: number;
};

/** Strip verbatim quote text for the --json payload (quotes stay byte-heavy
 *  and are already persisted in the review artifacts). */
function reviewForJson(review: ChapterReviewV1): Record<string, unknown> {
  return { ...review, quotes: review.quotes.map((q) => ({ why: q.why, verified: q.verified })) };
}

/** Run one blinded reader over one rendered chapter doc; retry ONCE on a
 *  parse/verification failure with a fresh session id. IMP-08: the reader
 *  scores the PHASE-1 doc from a role workspace outside the repo — the same
 *  instrument and envelope as the production review lane, so eval scores stay
 *  comparable. */
async function reviewOneChapter(
  bookId: string,
  chapter: ChapterV21,
  docText: string,
  docRelPath: string,
  bar: number,
  log: (line: string) => void,
): Promise<ChapterReviewV1> {
  void docRelPath; // forensic-copy path; the reader reads its workspace copy
  const nn = String(chapter.number).padStart(2, "0");
  const docFileName = `ch${nn}.txt`;
  const task = buildReaderReviewTask(docFileName, bar);
  let lastSessionId = "";
  for (let attempt = 1; attempt <= 2; attempt++) {
    const sessionId = `eval-proxy-${bookId}-ch${nn}-${Date.now()}`;
    lastSessionId = sessionId;
    log(`[eval-proxy] ${bookId} ch${nn}: reader attempt ${attempt} (session ${sessionId})`);
    const ws = buildReviewerWorkspace({
      role: "direct-reader",
      artifacts: [{ kind: "phase1-doc", relPath: docFileName, content: docText }],
    });
    let r;
    try {
      r = await spawnCodexAgent({
        task,
        role: "eval-reader",
        sessionId,
        cwd: ws.dir,
        sandbox: "read-only",
        skipGitRepoCheck: true,
        reasoningEffort: "high",
      });
    } finally {
      ws.cleanup();
    }
    const parsed = parseReaderReview(r.finalMessage) ?? parseReaderReview(r.stdout);
    if (!parsed) {
      log(`[eval-proxy] ${bookId} ch${nn}: attempt ${attempt} unparseable (exit ${r.exitCode})`);
      continue;
    }
    const review = adjudicateReview(parsed, docText, chapter, { bar, reviewerSessionId: sessionId });
    if (review.valid) return review;
    if (attempt === 2) return review; // second attempt: keep the adjudicated-but-invalid artifact
    log(`[eval-proxy] ${bookId} ch${nn}: attempt ${attempt} failed quote verification — respawning once`);
  }
  return invalidStubReview(chapter, lastSessionId, "reader output could not be parsed after retry");
}

export async function runEvalReaderProxy(args: string[], flags: Record<string, string | boolean>): Promise<number> {
  const bookIds = args.filter(Boolean);
  if (bookIds.length === 0) {
    console.error("Usage: eval-reader-proxy <bookId> [<bookId2> ...] [--chapters N] [--bar 80] [--json]");
    return 2;
  }
  const chaptersN = typeof flags.chapters === "string" ? parseInt(flags.chapters, 10) : 3;
  if (!Number.isFinite(chaptersN) || chaptersN < 1) {
    console.error("eval-reader-proxy: --chapters must be a positive integer");
    return 2;
  }
  const bar = typeof flags.bar === "string" ? parseFloat(flags.bar) : AUTHOR_CHAPTER_BAR;
  if (!Number.isFinite(bar) || bar < 0 || bar > 100) {
    console.error("eval-reader-proxy: --bar must be a number in 0..100");
    return 2;
  }
  const asJson = flags.json === true;
  // With --json, stdout must stay clean for the final JSON payload.
  const log = (line: string): void => { if (asJson) console.error(line); else console.log(line); };

  if (!codexAvailable()) {
    console.error("eval-reader-proxy: codex binary not found. Install codex or set CHAPTERFLOW_CODEX_BIN.");
    return 2;
  }

  const books: BookResult[] = [];
  let anyLoadError = false;
  let anyInvalid = false;

  for (const bookId of bookIds) {
    const loaded = loadBookPackage(bookId);
    if ("error" in loaded) {
      console.error(`eval-reader-proxy: ${bookId}: ${loaded.error}`);
      anyLoadError = true;
      continue;
    }
    const sampled = sampleChapters(bookId, loaded.pkg.chapters, chaptersN);
    log(`[eval-proxy] ${bookId}: ${loaded.pkg.chapters.length} chapters in package (${loaded.path}); sampling ${sampled.length}: ${sampled.map((c) => c.number).join(", ")}`);

    // IMP-08: render the PHASE-1 (key-free) doc, certify key isolation, and
    // keep a forensic copy under scratch; readers score a workspace copy.
    const jobs = sampled.map((chapter) => {
      const nn = String(chapter.number).padStart(2, "0");
      const docRelPath = `scratch/eval-proxy/${bookId}/ch${nn}.phase1.txt`;
      const docText = ensureTrailingNewline(renderChapterReaderDocPhase1(chapter));
      assertPhase1KeyIsolated(docText, chapter);
      writeFileAtomic(resolve(REPO_ROOT, docRelPath), docText);
      return { chapter, docText, docRelPath };
    });

    const reviews = await mapWithConcurrency(jobs, READER_CONCURRENCY, (job) =>
      reviewOneChapter(bookId, job.chapter, job.docText, job.docRelPath, bar, log),
    );

    const rows: string[] = [];
    for (const review of reviews) {
      writeChapterReview(bookId, review);
      if (!review.valid) anyInvalid = true;
      rows.push(
        `  ch${String(review.chapterNumber).padStart(2, "0")}  composite=${review.composite.toFixed(1).padStart(5)}  ship=${review.ship84 ? "yes" : "no "}  keys=${review.keyCheck.matches}/${review.keyCheck.of}  valid=${review.valid ? "yes" : "NO"}  pass=${review.pass ? "PASS" : "fail"}`,
      );
    }
    const validReviews = reviews.filter((r) => r.valid);
    const med = median(validReviews.map((r) => r.composite));

    log(`\n${bookId} — reader-proxy reviews (bar ${bar}):`);
    log("  chapter  composite  ship  keys  valid  verdict");
    for (const row of rows) log(row);
    log(`  median composite (valid reviews): ${med === null ? "-" : med.toFixed(1)}  (${validReviews.length}/${reviews.length} valid)`);

    books.push({
      id: bookId,
      chapters: reviews.map(reviewForJson),
      medianComposite: med,
      validCount: validReviews.length,
    });
  }

  if (asJson) console.log(JSON.stringify({ books }));

  if (anyLoadError) return 2;
  return anyInvalid ? 1 : 0;
}
