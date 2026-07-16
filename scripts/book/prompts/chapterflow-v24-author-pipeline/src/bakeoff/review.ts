/**
 * Model bake-off — blinded comparison reviews.
 *
 * REUSES the existing blinded review instruments verbatim:
 *   - per-chapter: reviewOneChapter (renderChapterReaderDoc + 10-factor rubric +
 *     deterministic adjudication) — the SAME instrument the author arch ships on;
 *   - whole-book: the eval-book-proxy panel (renderBookSampleDocPhase1 +
 *     buildBookReviewTaskPhase1 + adjudicateBookReview + composeBookVerdict —
 *     the IMP-08 key-free instrument, identical to production acceptance).
 *
 * Blinding: candidates are randomly mapped to opaque labels (A/B/C…); every
 * reviewer-visible artifact (doc path, doc bytes, task text) is checked against
 * a forbidden-token list (model ids, slugs, slots, price/tier words) BEFORE any
 * reviewer spawn — a leak is a fail-closed error, never a warning.
 *
 * The judging instrument is FIXED across candidates: one explicit judge model +
 * effort (REQUIRED — no default, never the writer/baseline model; WP-501),
 * pinned on every spawn through the judge deps wrapper. A candidate model never
 * judges the primary selection.
 */

import { mkdirSync } from "fs";
import { dirname, resolve } from "path";

import type { AutopilotDeps } from "../orchestrator/autopilot.js";
import { reviewOneChapter, resolveAuthorReviewIo } from "../orchestrator/authorReview.js";
import type { ChapterV21 } from "../types.js";
import { writeFileAtomic, ensureTrailingNewline } from "../lib/atomicWrite.js";
import { AUTHOR_CHAPTER_BAR } from "../review/readerReview.js";
import {
  adjudicateBookReview,
  assertBookSamplePhase1Integrity,
  buildBookReviewTaskPhase1,
  composeBookVerdict,
  parseBookReview,
  renderBookSampleDocPhase1,
  selectAcceptanceSample,
  type BookReaderResult,
} from "../review/evalBookProxy.js";
import { buildReviewerWorkspace } from "../review/reviewerWorkspace.js";
import { chapterContentHash } from "../critics/qcAttestation.js";
import type { BlindLabel, CandidateBookReadV1, CandidateReviewV1, CandidateSpec, ReasoningEffort } from "./types.js";
import { PIPELINE_DIR, combineHashes, pipelineRel, type BakeoffRoots } from "./paths.js";

export const BLIND_LABELS: BlindLabel[] = ["A", "B", "C", "D", "E", "F"];

/** Number of independent whole-book reads per candidate (tiebreak adds one more
 *  only when these two disagree beyond the noise band / on the gate). */
export const BOOK_READS_PER_CANDIDATE = 2;

/** The tie/noise band shared with selection — mirrors the acceptance panel's
 *  PANEL_NOISE_BAND_DEFAULT (authorReview.ts). */
export const BAKEOFF_NOISE_BAND = 3.7;

export class BlindingLeakError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BlindingLeakError";
  }
}

/** Tokens that must NEVER reach a reviewer: model identities, candidate slugs,
 *  generation slots, and price/tier vocabulary. */
export function forbiddenReviewTokens(candidates: CandidateSpec[]): string[] {
  const tokens = new Set<string>();
  for (const c of candidates) {
    tokens.add(c.model.toLowerCase());
    tokens.add(c.slug.toLowerCase());
    tokens.add(c.slot.toLowerCase());
    // The bare family suffix ("sol" from "gpt-5.6-sol") — the strongest tell.
    const suffix = c.model.toLowerCase().split(/[-_./]/).filter(Boolean).pop();
    if (suffix && suffix.length >= 3 && !/^\d+$/.test(suffix)) tokens.add(suffix);
  }
  for (const t of ["gpt-", "flagship", "cheapest", "expensive model", "large model", "small model", "frontier model"]) tokens.add(t);
  return [...tokens];
}

/** Fail-closed leak check over any reviewer-visible text. Word-boundary matched
 *  so a short family name ("sol") can't false-positive inside prose words
 *  ("solution", "console"). */
export function assertNoIdentityLeak(text: string, forbidden: string[], where: string): void {
  const lower = text.toLowerCase();
  for (const token of forbidden) {
    const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = token.endsWith("-")
      ? new RegExp(`\\b${escaped}`, "i")
      : new RegExp(`(^|[^a-z0-9])${escaped}($|[^a-z0-9])`, "i");
    if (re.test(lower)) {
      throw new BlindingLeakError(`model-identity leak: "${token}" found in ${where} — refusing to spawn a reviewer over an unblinded packet`);
    }
  }
}

/** Randomly map candidates to opaque labels. Uses the injected rng (tests pin
 *  it; the live caller passes Math.random) exactly once per run — the mapping
 *  persists in the manifest and never re-rolls on resume. */
export function assignBlindLabels(candidates: CandidateSpec[], rng: () => number): Record<string, string> {
  if (candidates.length > BLIND_LABELS.length) {
    throw new Error(`too many candidates (${candidates.length}) for the blind label alphabet (${BLIND_LABELS.length})`);
  }
  const shuffled = [...candidates];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  const map: Record<string, string> = {};
  shuffled.forEach((c, i) => { map[BLIND_LABELS[i]] = c.model; });
  return map;
}

export type JudgeSpec = { model: string; effort: ReasoningEffort };

/** Pin every reviewer spawn to the FIXED judge instrument. */
export function judgeDeps(deps: AutopilotDeps, judge: JudgeSpec): AutopilotDeps {
  return {
    ...deps,
    spawn: (opts) => deps.spawn({ ...opts, model: judge.model, reasoningEffort: judge.effort }),
  };
}

export type ReviewCandidateOptions = {
  runId: string;
  judge: JudgeSpec;
  forbidden: string[];
  heartbeat?: () => boolean;
  log: (m: string) => void;
  /** Chapter-review concurrency within this candidate. */
  chapterParallel?: number;
};

export function combinedContentHash(chapters: ChapterV21[]): string {
  return combineHashes(chapters.map((c) => ({ relPath: `ch${String(c.number).padStart(2, "0")}`, sha256: chapterContentHash(c) })));
}

async function mapPool<T, R>(items: T[], limit: number, fn: (item: T, i: number) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.max(1, Math.min(limit, items.length || 1)) }, async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i], i);
    }
  });
  await Promise.all(workers);
  return out;
}

/**
 * Run the full blinded review battery for ONE candidate book under its opaque
 * label: one blinded reader per chapter + BOOK_READS_PER_CANDIDATE independent
 * whole-book panel reads (+1 tiebreak only on disagreement).
 */
export async function reviewCandidate(
  bookId: string,
  label: BlindLabel,
  chapters: ChapterV21[],
  deps: AutopilotDeps,
  roots: BakeoffRoots,
  opts: ReviewCandidateOptions,
): Promise<CandidateReviewV1> {
  const jdeps = judgeDeps(deps, opts.judge);
  const labelDir = resolve(roots.reviewsDir, label);
  mkdirSync(labelDir, { recursive: true });

  // Injected review IO: docs + persisted reviews live under reviews/<label>/;
  // the author session is invisible (a bake-off judge never meets provenance).
  const io = resolveAuthorReviewIo({
    writeReviewDoc: (_bookId, fileName, text) => {
      const absPath = resolve(labelDir, fileName);
      mkdirSync(dirname(absPath), { recursive: true });
      const finalText = ensureTrailingNewline(text);
      assertNoIdentityLeak(finalText, opts.forbidden, `review doc ${fileName} (label ${label})`);
      writeFileAtomic(absPath, finalText);
      return { absPath, relPath: pipelineRel(absPath) };
    },
    persistReview: (_bookId, review) => {
      const p = resolve(labelDir, `ch${String(review.chapterNumber).padStart(2, "0")}.review.json`);
      writeFileAtomic(p, JSON.stringify(review, null, 2) + "\n");
      return p;
    },
    authorSessionOf: () => undefined,
    loadChapters: () => chapters,
  });

  // ── Per-chapter blinded reads ──────────────────────────────────────────────
  const chapterReviews = await mapPool(
    [...chapters].sort((a, b) => a.number - b.number),
    Math.max(1, opts.chapterParallel ?? 2),
    async (ch) => {
      const review = await reviewOneChapter(bookId, ch, jdeps, io, AUTHOR_CHAPTER_BAR, `-blind${label}`);
      return {
        chapterNumber: ch.number,
        composite: review.composite,
        ship: review.ship84 === true,
        keysClean: review.keyCheck.matches === review.keyCheck.of,
        valid: review.valid,
        pass: review.pass,
        reviewerSessionId: review.reviewerSessionId ?? "",
      };
    },
  );

  // ── Whole-book panel reads (same seeded sample for every candidate) ───────
  // IMP-08: the bake-off measures the PHASE-1 instrument (key-free doc,
  // workspace-isolated judges) — the same instrument acceptance runs, so
  // bake-off composites stay comparable with production reads.
  const sample = selectAcceptanceSample(bookId, chapters, 4, `bakeoff-${opts.runId}`);
  const docText = ensureTrailingNewline(renderBookSampleDocPhase1(sample));
  assertBookSamplePhase1Integrity(docText, sample);
  const bookDocFileName = "book-sample.txt";
  io.writeReviewDoc(bookId, "book-sample.phase1.txt", docText);
  const task = buildBookReviewTaskPhase1(bookDocFileName);
  assertNoIdentityLeak(task, opts.forbidden, `book review task (label ${label})`);

  const spawnBookRead = async (readerNo: number, tag: string): Promise<{ result: BookReaderResult; sessionId: string }> => {
    let lastSessionId = "";
    for (let attempt = 1; attempt <= 2; attempt++) {
      const sessionId = deps.mkSessionId(`bakeoff-review-${label}-r${readerNo}${tag}${attempt > 1 ? "-r2" : ""}`);
      lastSessionId = sessionId;
      const ws = buildReviewerWorkspace({
        role: "acceptance-reader",
        artifacts: [{ kind: "phase1-doc", relPath: bookDocFileName, content: docText }],
      });
      let r;
      try {
        r = await jdeps.spawn({
          task,
          role: "bakeoff-judge",
          sessionId,
          cwd: ws.dir,
          sandbox: "read-only",
          skipGitRepoCheck: true,
          reasoningEffort: opts.judge.effort,
        });
      } finally {
        ws.cleanup();
      }
      try { deps.logSession(bookId, `bakeoff-review-${label}-r${readerNo}`, r); } catch { /* best-effort */ }
      const parsed = parseBookReview(r.finalMessage) ?? parseBookReview(r.stdout);
      if (!parsed) {
        opts.log(`[bakeoff] review ${label} r${readerNo}: attempt ${attempt} unparseable (exit ${r.exitCode})`);
        continue;
      }
      const adjudicated = adjudicateBookReview(parsed, docText, sample, sessionId);
      if (adjudicated.valid || attempt === 2) return { result: adjudicated, sessionId };
      opts.log(`[bakeoff] review ${label} r${readerNo}: attempt ${attempt} invalid (${adjudicated.invalidReason}) — one respawn`);
    }
    const invalid = adjudicateBookReview(
      {
        gate_verdict: "FAIL",
        book3_churn: "HIGH",
        quizDerivation: {},
        scores: { retention: 0, quizzes: 0, transfer: 0, practical: 0, summaries: 0, tone: 0, limits: 0, insight: 0, density: 0, beginner: 0 },
        quotes: [],
        oneParagraphVerdict: "INVALID: unparseable after retry",
      },
      docText,
      sample,
      lastSessionId,
    );
    return { result: invalid, sessionId: lastSessionId };
  };

  const primaryReads = await mapPool(
    Array.from({ length: BOOK_READS_PER_CANDIDATE }, (_, i) => i + 1),
    BOOK_READS_PER_CANDIDATE,
    (readerNo) => spawnBookRead(readerNo, ""),
  );
  const reads = [...primaryReads];
  const valids = primaryReads.filter((r) => r.result.valid);
  const disagree =
    valids.length < BOOK_READS_PER_CANDIDATE ||
    (valids.length >= 2 && (
      valids[0].result.gateVerdict !== valids[1].result.gateVerdict ||
      Math.abs((valids[0].result.composite ?? 0) - (valids[1].result.composite ?? 0)) > BAKEOFF_NOISE_BAND
    ));
  if (disagree) {
    opts.log(`[bakeoff] review ${label}: the two independent reads disagree — spawning one tiebreak read`);
    reads.push(await spawnBookRead(BOOK_READS_PER_CANDIDATE + 1, "-tiebreak"));
  }

  const verdict = composeBookVerdict(label, sample.map((c) => c.number), reads.map((r) => r.result));
  const bookReads: CandidateBookReadV1[] = reads.map((r, i) => ({
    readerNo: i + 1,
    sessionId: r.sessionId,
    composite: r.result.composite,
    gate: r.result.gateVerdict,
    churn: r.result.churn ?? "?",
    valid: r.result.valid,
    invalidReason: r.result.valid ? undefined : r.result.invalidReason,
  }));

  const composites = chapterReviews.map((c) => c.composite).filter((c) => Number.isFinite(c));
  const review: CandidateReviewV1 = {
    schemaVersion: "model-bakeoff-candidate-review-v1",
    label,
    contentSha256: combinedContentHash(chapters),
    chapterReviews,
    bookReads,
    bookComposite: verdict.medianComposite,
    bookGate: verdict.gate,
    bookChurn: verdict.churn,
    meanChapterComposite: composites.length ? Math.round((composites.reduce((s, c) => s + c, 0) / composites.length) * 10) / 10 : null,
    minChapterComposite: composites.length ? Math.min(...composites) : null,
    chapterPassRate: chapterReviews.length ? Math.round((chapterReviews.filter((c) => c.pass).length / chapterReviews.length) * 1000) / 1000 : null,
    sampledChapterNumbers: sample.map((c) => c.number),
    reviewedAt: new Date().toISOString(),
  };
  writeFileAtomic(resolve(labelDir, "review.json"), JSON.stringify(review, null, 2) + "\n");
  return review;
}
