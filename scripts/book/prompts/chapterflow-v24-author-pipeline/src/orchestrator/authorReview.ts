/**
 * authorReview — the v24 AUTHOR architecture's REVIEW phase (component B4).
 *
 * Replaces doQcWithRepair for architecture === "author":
 *
 *   1. Every chapter gets ONE blinded independent reader (readerReview.ts):
 *      rendered doc → read-only codex session → parse → deterministic
 *      adjudication (byte-verified quotes + positional key check + weighted
 *      composite) → persisted ChapterReviewV1.
 *   2. A failing chapter is REGENERATED (authorWriteOneChapter with the
 *      review's complaints — regeneration with complaints, never blind
 *      patching), then re-reviewed. CAP: 2 total write attempts per chapter
 *      (the original + one regen). Still failing → halt content.
 *   3. Book acceptance: the owner's book-score instrument shape — a seeded
 *      4-chapter sample doc read by TWO independent book readers, composed by
 *      composeBookVerdict. ACCEPT when gate === "PASS" AND churn !== "HIGH"
 *      AND medianComposite >= bar. The two book readers are the author arch's
 *      CONFIRMING function (the sweep-confirmation analog — runAutopilot's
 *      author branch substitutes this acceptance for deps.sweepConfirmed).
 *   4. On acceptance: FIRST produce the independent publish evidence the
 *      no-API promote gate additionally enforces (component B5,
 *      authorEvidence.ts) — the per-chapter manual key-judge records (blind
 *      key packs + TWO independent key-reader sessions fed through the real
 *      key-derive/key-resolve writers, round roles keyA/keyB) and the
 *      book-level sweep attestation (one independent sweep read submitted
 *      through the real qc-submit path, backed by roles.sweep) — then write
 *      the QC attestation + bar/confirm records in the shapes the promote
 *      gate reads (verdict PUBLISHABLE, bound to chapterContentHash, reviewer
 *      sessions from the review artifacts). A failure in either evidence step
 *      is a fail-closed halt (infra/content), never a skip.
 *
 *      HISTORY — the closed B4 KNOWN LIMITATION (verifier finding 2026-07-02):
 *      promote-book force-sets CHAPTERFLOW_NO_API_CODEX_QC=1 and in that mode
 *      ALSO enforces checkManualKeyJudge (keyA/keyB key-pack/derive/resolve
 *      records per chapter) and checkSweep (a sweep attestation backed by
 *      roles.sweep) — record families only the legacy/compiler QC round
 *      machinery produced, so an author-arch book reached READY but could not
 *      pass promote-book. B5 (2026-07-02) closed it by producing those exact
 *      record families as REAL independent evidence through the existing
 *      writers (never by touching promote/manualKeyJudge/sweep check code):
 *      see authorEvidence.ts runKeyJudgeEvidence + runSweepEvidence, wired in
 *      below at the acceptance step.
 *   5. On rejection: ONE targeted regen round (book complaints mapped to their
 *      chapters, cap 3), re-review, then re-run acceptance ONCE; still
 *      failing → halt content.
 *
 * Returns the same outcome shapes doQcWithRepair returns (AutopilotOutcome |
 * null; null = phase complete, re-loop) so runAutopilot handles ready/halt
 * identically. Compiler/legacy QC behavior is byte-untouched.
 */

import { mkdirSync } from "fs";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

import type { AutopilotDeps, AutopilotOutcome } from "./autopilot.js";
import type { ChapterV21 } from "../types.js";
import {
  CHAPTER_REVIEW_SCHEMA_VERSION,
  REVIEW_FACTORS,
  type ChapterReviewV1,
  type ReviewFactor,
} from "../artifacts/artifactTypes.js";
import {
  adjudicateReview,
  buildReaderReviewTask,
  parseReaderReview,
  writeChapterReview,
} from "../review/readerReview.js";
import { renderChapterReaderDoc } from "../review/renderReaderDoc.js";
import {
  adjudicateBookReview,
  buildBookReviewTask,
  composeBookVerdict,
  parseBookReview,
  renderBookSampleDoc,
  selectSeededChapters,
  type BookReaderResult,
  type BookVerdict,
} from "../review/evalBookProxy.js";
import { chapterContentHash, writeAttestation, type QcAttestation } from "../critics/qcAttestation.js";
import { AXIS_WEIGHTS, computeVerdict, type AxisId, type AxisScore } from "../critics/semantic/publishableBar.js";
import { writeBarReadArtifact, writeConfirmReadArtifact } from "../qc/orchestrator/artifacts.js";
import type { ValidatedBarReadSubmission, ValidatedConfirmReadSubmission } from "../qc/orchestrator/schemas.js";
import { openQcRound, type QcRoundRole } from "../qc/qcRound.js";
import { writeFileAtomic } from "../lib/atomicWrite.js";
import {
  runKeyJudgeEvidence,
  runSweepEvidence,
  type AuthorEvidenceResult,
  type AuthorEvidenceRound,
} from "./authorEvidence.js";
import {
  authorWriteOneChapter,
  resolveAuthorIo,
  type AuthorIo,
} from "./authorRun.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PIPELINE_DIR = resolve(__dirname, "../..");

/** Total write attempts per chapter across write+review: the original authoring
 *  + ONE review-complaint regeneration. */
export const AUTHOR_REGEN_CAP = 2;
/** Book-acceptance rejection: at most this many chapters get the targeted regen. */
export const AUTHOR_BOOK_REGEN_CHAPTER_CAP = 3;
/** Independent book-level readers per acceptance round. */
export const AUTHOR_BOOK_READERS = 2;

// ── Injectable IO (extends the write phase's AuthorIo) ────────────────────────

export type AcceptanceWriters = {
  /** Open a REAL QC round (state/qc-rounds/<book>.<roundId>.json) and return its id
   *  PLUS the role tokens — checkQcAttestation's no-API path requires the attestation's
   *  roundId/roundRole to resolve against an existing round record, and the B5 evidence
   *  writers (key-derive / qc-submit) verify their role tokens against the same round. */
  openRound: (bookId: string) => { roundId: string; tokens: Partial<Record<QcRoundRole, string>> };
  writeBar: (submission: ValidatedBarReadSubmission) => string;
  writeConfirm: (submission: ValidatedConfirmReadSubmission) => string;
  writeAttestation: (att: QcAttestation) => string;
};

/** B5 — the independent publish-evidence steps (injectable so unit tests stub
 *  them; the real implementations live in authorEvidence.ts). */
export type EvidenceRunners = {
  runKeyJudge: (bookId: string, chapters: ChapterV21[], deps: AutopilotDeps, io: AuthorReviewIo, round: AuthorEvidenceRound) => Promise<AuthorEvidenceResult>;
  runSweep: (bookId: string, chapters: ChapterV21[], deps: AutopilotDeps, io: AuthorReviewIo, round: AuthorEvidenceRound) => Promise<AuthorEvidenceResult>;
};

export type AuthorReviewIo = AuthorIo & {
  /** Persist a review input doc under scratch/review/<book>/; returns both paths. */
  writeReviewDoc: (bookId: string, fileName: string, text: string) => { absPath: string; relPath: string };
  /** Persist a chapter's ChapterReviewV1 artifact. */
  persistReview: (bookId: string, review: ChapterReviewV1) => string;
  acceptance: AcceptanceWriters;
  evidence: EvidenceRunners;
};

export function resolveAuthorReviewIo(over?: Partial<AuthorReviewIo>): AuthorReviewIo {
  const base = resolveAuthorIo(over);
  return {
    ...base,
    writeReviewDoc: over?.writeReviewDoc ?? ((bookId, fileName, text) => {
      const relPath = `scratch/review/${bookId}/${fileName}`;
      const absPath = resolve(PIPELINE_DIR, relPath);
      mkdirSync(dirname(absPath), { recursive: true });
      writeFileAtomic(absPath, text);
      return { absPath, relPath };
    }),
    persistReview: over?.persistReview ?? ((bookId, review) => writeChapterReview(bookId, review)),
    acceptance: over?.acceptance ?? {
      openRound: (bookId) => {
        const opened = openQcRound(bookId);
        return { roundId: opened.record.roundId, tokens: opened.tokens };
      },
      writeBar: (submission) => writeBarReadArtifact(submission),
      writeConfirm: (submission) => writeConfirmReadArtifact(submission),
      writeAttestation: (att) => writeAttestation(att),
    },
    evidence: over?.evidence ?? {
      runKeyJudge: runKeyJudgeEvidence,
      runSweep: runSweepEvidence,
    },
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function halt(bookId: string, category: "infra" | "content" | "progress", reason: string): AutopilotOutcome {
  return { status: "halt", bookId, phase: "qc", category, reason };
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

/** Actionable complaint lines for a failed review: the reader's explicit
 *  complaints, else quote whys + key disagreements, else a generic line. */
export function complaintsOf(review: ChapterReviewV1): string[] {
  const explicit = (review.complaints ?? [])
    .map((c) => `${c.unit}: ${c.problem}${c.mustFix ? " (must fix)" : ""}`)
    .filter((s) => s.trim().length > 2);
  if (explicit.length > 0) return explicit;
  const fallback = [
    ...(review.quotes ?? []).map((q) => q.why).filter((w) => typeof w === "string" && w.trim().length > 0),
    ...(review.keyCheck?.disagreements ?? []).map((d) => `quiz key disagreement — ${d}`),
  ];
  if (fallback.length > 0) return fallback;
  return [`independent reader refused to ship this chapter (composite ${review.composite}, ship84=${review.ship84}, valid=${review.valid})`];
}

/** An invalid placeholder review for a reader whose output stayed unparseable
 *  after the retry — pass=false so the chapter routes to regeneration. */
function unparseableReview(chapter: ChapterV21, reviewerSessionId: string): ChapterReviewV1 {
  const scores = Object.fromEntries(REVIEW_FACTORS.map((f) => [f, 0])) as Record<ReviewFactor, number>;
  return {
    schemaVersion: CHAPTER_REVIEW_SCHEMA_VERSION,
    chapterId: chapter.chapterId,
    chapterNumber: chapter.number,
    contentHash: chapterContentHash(chapter),
    reviewerSessionId,
    scores,
    composite: 0,
    ship84: false,
    pass: false,
    valid: false,
    keyCheck: { derived: [], matches: 0, of: chapter.quiz?.questions?.length ?? 0, disagreements: [] },
    quotes: [],
    tells: [],
    complaints: [{ unit: "review", problem: "reader session produced no parseable review after a retry", mustFix: true }],
    oneParagraphVerdict: "INVALID: unparseable reader output after retry",
  };
}

/** Map book readers' complaints to sampled chapter numbers (cap 3): key-check
 *  disagreement lines carry "chN Q…"; verdict prose may name "chapter N" /
 *  "chNN". Falls back to the first `cap` sampled chapters carrying the
 *  readers' verdict prose when nothing chapter-specific was named. */
export function mapBookComplaintsToChapters(
  readers: Array<Pick<BookReaderResult, "keyCheck" | "oneParagraphVerdict" | "gateVerdict" | "churn">>,
  sampledNumbers: number[],
  cap: number = AUTHOR_BOOK_REGEN_CHAPTER_CAP,
): Map<number, string[]> {
  const sampledSet = new Set(sampledNumbers);
  const byChapter = new Map<number, string[]>();
  const add = (n: number, line: string): void => {
    if (!sampledSet.has(n)) return;
    const list = byChapter.get(n) ?? [];
    if (!list.includes(line)) list.push(line);
    byChapter.set(n, list);
  };
  for (const reader of readers) {
    for (const line of reader.keyCheck?.disagreements ?? []) {
      const m = line.match(/\bch(?:apter)?\s*0*(\d+)\b/i);
      if (m) add(Number(m[1]), `book reader key check: ${line}`);
    }
    const verdict = reader.oneParagraphVerdict ?? "";
    for (const m of verdict.matchAll(/\bch(?:apter)?\s*0*(\d+)\b/gi)) {
      add(Number(m[1]), `book reader verdict: ${verdict.slice(0, 500)}`);
    }
  }
  if (byChapter.size === 0) {
    const generic = readers
      .map((r) => r.oneParagraphVerdict?.trim())
      .filter((v): v is string => !!v && v.length > 0)
      .map((v) => `book reader verdict: ${v.slice(0, 500)}`);
    const lines = generic.length
      ? generic
      : [`book acceptance rejected (gate ${readers.map((r) => r.gateVerdict).join("/")}, churn ${readers.map((r) => r.churn).join("/")})`];
    for (const n of sampledNumbers.slice(0, cap)) byChapter.set(n, [...lines]);
  }
  // Deterministic cap: keep the lowest-numbered chapters first.
  const capped = [...byChapter.entries()].sort((a, b) => a[0] - b[0]).slice(0, cap);
  return new Map(capped);
}

// ── One blinded chapter review ───────────────────────────────────────────────

async function reviewOneChapter(
  bookId: string,
  chapter: ChapterV21,
  deps: AutopilotDeps,
  io: AuthorReviewIo,
  bar: number,
  labelSuffix = "",
): Promise<ChapterReviewV1> {
  const nn = String(chapter.number).padStart(2, "0");
  const docText = renderChapterReaderDoc(chapter);
  const { relPath } = io.writeReviewDoc(bookId, `ch${nn}.txt`, docText);
  const authorSid = io.authorSessionOf(chapter.chapterId);
  const task = buildReaderReviewTask(relPath, bar);

  let lastSessionId = "";
  for (let attempt = 1; attempt <= 2; attempt++) {
    // INDEPENDENCE: a fresh session per read; NEVER the chapter's recorded
    // author session (mirrors the qc reviewers' author≠reviewer invariant).
    let sessionId = deps.mkSessionId(`author-review-ch${nn}${labelSuffix}${attempt > 1 ? "-r2" : ""}`);
    if (authorSid && sessionId === authorSid) sessionId = deps.mkSessionId(`author-review-ch${nn}${labelSuffix}-indep`);
    lastSessionId = sessionId;
    const r = await deps.spawn({
      task,
      sessionId,
      cwd: PIPELINE_DIR,
      sandbox: "read-only",
      skipGitRepoCheck: true,
      reasoningEffort: "high",
    });
    try { deps.logSession(bookId, `author-review-ch${nn}${labelSuffix}`, r); } catch { /* best-effort */ }
    const parsed = parseReaderReview(r.finalMessage) ?? parseReaderReview(r.stdout);
    if (!parsed) {
      deps.log(`[autopilot] author review ch${nn}: attempt ${attempt} unparseable (exit ${r.exitCode})${attempt === 1 ? " — respawning once" : ""}`);
      continue;
    }
    const review = adjudicateReview(parsed, docText, chapter, { bar, reviewerSessionId: sessionId });
    if (review.valid || attempt === 2) {
      io.persistReview(bookId, review);
      deps.log(`[autopilot] author review ch${nn}: composite ${review.composite} ship=${review.ship84} keys ${review.keyCheck.matches}/${review.keyCheck.of} → ${review.pass ? "PASS" : "FAIL"}${review.valid ? "" : " (INVALID quotes)"}`);
      return review;
    }
    deps.log(`[autopilot] author review ch${nn}: attempt ${attempt} failed quote verification — respawning once`);
  }
  const review = unparseableReview(chapter, lastSessionId);
  io.persistReview(bookId, review);
  return review;
}

// ── Book acceptance ───────────────────────────────────────────────────────────

export type BookAcceptanceResult = {
  accepted: boolean;
  verdict: BookVerdict;
  readers: BookReaderResult[];
  readerSessionIds: string[];
  sampledNumbers: number[];
};

/** Book-acceptance bar, CALIBRATED separately from the 84 chapter-review bar
 *  (owner decision 2026-07-03): the book-level instrument reads ~4-5 points
 *  harsher than the owner's own scores — Phase-0: atomic-habits (owner 85.3,
 *  #1 of 131) scores 80.2; the LIVE shipped POM scores 80.0 with a unanimous
 *  correctness-gate FAIL; no real book has ever scored >=84 on this read. 80
 *  therefore corresponds to an owner-84/85 book. Additionally, when
 *  CHAPTERFLOW_BEAT_SHIPPED_COMPOSITE is set (regens of published books: the
 *  operator runs the same-instrument control read over the shipped package and
 *  exports its composite), acceptance ALSO requires meeting it — the regen must
 *  never be accepted below the book it replaces. */
export const AUTHOR_BOOK_ACCEPT_BAR = 80;

function beatShippedComposite(): number | null {
  const raw = process.env.CHAPTERFLOW_BEAT_SHIPPED_COMPOSITE;
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

async function runBookAcceptance(
  bookId: string,
  chapters: ChapterV21[],
  deps: AutopilotDeps,
  io: AuthorReviewIo,
  bar: number,
  roundLabel: string,
): Promise<BookAcceptanceResult> {
  const sampled = selectSeededChapters(bookId, chapters, 4);
  const docText = renderBookSampleDoc(sampled);
  const { relPath } = io.writeReviewDoc(bookId, "book-sample.txt", docText);
  const task = buildBookReviewTask(relPath);
  deps.log(`[autopilot] author acceptance${roundLabel}: sampled ch ${sampled.map((c) => c.number).join(", ")} → ${docText.length} chars; spawning ${AUTHOR_BOOK_READERS} independent book readers`);

  const readerSessionIds: string[] = [];
  const readers = await mapPool(
    Array.from({ length: AUTHOR_BOOK_READERS }, (_, i) => i + 1),
    AUTHOR_BOOK_READERS,
    async (readerNo) => {
      let lastSessionId = `author-book-reader-${readerNo}-invalid`;
      for (let attempt = 1; attempt <= 2; attempt++) {
        const sessionId = deps.mkSessionId(`author-book-reader-${readerNo}${roundLabel}${attempt > 1 ? "-r2" : ""}`);
        lastSessionId = sessionId;
        const r = await deps.spawn({
          task,
          sessionId,
          cwd: PIPELINE_DIR,
          sandbox: "read-only",
          skipGitRepoCheck: true,
          reasoningEffort: "high",
        });
        try { deps.logSession(bookId, `author-book-reader-${readerNo}${roundLabel}`, r); } catch { /* best-effort */ }
        const parsed = parseBookReview(r.finalMessage) ?? parseBookReview(r.stdout);
        if (!parsed) {
          deps.log(`[autopilot] author acceptance${roundLabel} r${readerNo}: attempt ${attempt} unparseable (exit ${r.exitCode})`);
          continue;
        }
        const adjudicated = adjudicateBookReview(parsed, docText, sampled, sessionId);
        if (adjudicated.valid || attempt === 2) {
          if (!adjudicated.valid) deps.log(`[autopilot] author acceptance${roundLabel} r${readerNo}: INVALID — ${adjudicated.invalidReason}`);
          readerSessionIds.push(sessionId);
          return adjudicated;
        }
        deps.log(`[autopilot] author acceptance${roundLabel} r${readerNo}: attempt ${attempt} failed verification (${adjudicated.invalidReason}) — respawning once`);
      }
      readerSessionIds.push(lastSessionId);
      return adjudicateBookReview(
        {
          gate_verdict: "FAIL",
          book3_churn: "HIGH",
          quizDerivation: {},
          scores: Object.fromEntries(REVIEW_FACTORS.map((f) => [f, 0])) as Record<ReviewFactor, number>,
          quotes: [],
          oneParagraphVerdict: "INVALID: unparseable after retry",
        },
        docText,
        sampled,
        lastSessionId,
      );
    },
  );

  const verdict = composeBookVerdict(bookId, sampled.map((c) => c.number), readers);
  const shipped = beatShippedComposite();
  const comp = verdict.medianComposite ?? 0;
  const accepted = verdict.gate === "PASS" && verdict.churn !== "HIGH"
    && comp >= AUTHOR_BOOK_ACCEPT_BAR
    && (shipped === null || comp >= shipped);
  deps.log(`[autopilot] author acceptance${roundLabel}: composite ${verdict.medianComposite ?? "n/a"} gate ${verdict.gate ?? "?"} (${verdict.gateVotes}) churn ${verdict.churn} vs bar ${AUTHOR_BOOK_ACCEPT_BAR}${shipped === null ? "" : ` + beat-shipped ${shipped}`} → ${accepted ? "ACCEPT" : "REJECT"}`);
  return { accepted, verdict, readers, readerSessionIds, sampledNumbers: sampled.map((c) => c.number) };
}

// ── Acceptance records (what the promote gate reads) ─────────────────────────

/** Write the PUBLISHABLE records promote-book verifies for every chapter: one
 *  qc-attest-v1 attestation (verdict PUBLISHABLE, hashVersion v2 bound to
 *  chapterContentHash, approved codex-qc reviewer role, the chapter reader's
 *  session id, backed by a REAL opened QC round) plus the round's bar-read and
 *  confirm-read artifacts (matching contentHash; confirm decision PUBLISHABLE)
 *  that checkBarConfirmArtifactsForPublishable requires in no-API mode.
 *  The caller opens the round (writers.openRound) so the B5 evidence steps can
 *  share it; returns the roundId used. Exported for tests. */
export function writeAuthorAcceptance(
  bookId: string,
  chapters: ChapterV21[],
  reviews: Map<number, ChapterReviewV1>,
  acceptance: BookAcceptanceResult,
  writers: AcceptanceWriters,
  openedRoundId?: string,
): string {
  const roundId = openedRoundId ?? writers.openRound(bookId).roundId;
  const reviewedAt = new Date().toISOString();
  const barReaderSession = acceptance.readerSessionIds[0] ?? `author-book-reader:${roundId}`;
  for (const chapter of chapters) {
    const review = reviews.get(chapter.number);
    if (!review) throw new Error(`writeAuthorAcceptance: no review for chapter ${chapter.number}`);
    const contentHash = chapterContentHash(chapter);
    const score = Math.max(0, Math.min(1, review.composite / 100));
    const axes: AxisScore[] = (Object.keys(AXIS_WEIGHTS) as AxisId[]).map((axis) => ({
      axis,
      score,
      tier: "PUBLISHABLE",
      hits: [],
    }));
    writers.writeBar({
      schemaVersion: "qc-bar-read-v1",
      bookId,
      roundId,
      role: "bar",
      reviewer: `codex-qc:author-book-reader:${roundId}`,
      reviewerSessionId: barReaderSession,
      chapterNumber: chapter.number,
      chapterId: chapter.chapterId,
      contentHash,
      axes,
      verdict: computeVerdict(chapter.chapterId, axes),
    });
    writers.writeConfirm({
      schemaVersion: "qc-confirm-read-v1",
      bookId,
      roundId,
      role: "confirm",
      reviewer: `codex-qc:author-review:${roundId}`,
      reviewerSessionId: review.reviewerSessionId,
      chapterNumber: chapter.number,
      chapterId: chapter.chapterId,
      contentHash,
      decision: "PUBLISHABLE",
      reason: `v24 author-arch independent reader: composite ${review.composite}, ship=${review.ship84}, keys ${review.keyCheck.matches}/${review.keyCheck.of}`,
      findings: [],
    });
    writers.writeAttestation({
      schemaVersion: "qc-attest-v1",
      bookId,
      chapterNumber: chapter.number,
      chapterId: chapter.chapterId,
      verdict: "PUBLISHABLE",
      contentHash,
      hashVersion: "v2",
      reviewer: `codex-qc:author-review:${roundId}`,
      reviewedAt,
      roundId,
      roundRole: "confirm",
      reviewerSessionId: review.reviewerSessionId,
      dimensions: {
        readerReviewPass: true,
        quoteByteVerified: review.valid,
        keysCorrect: review.keyCheck.matches === review.keyCheck.of,
        bookAcceptance: true,
      },
      findings: [],
      notes:
        `v24 author-arch acceptance: chapter composite ${review.composite} (bar pass), book verdict ` +
        `${acceptance.verdict.medianComposite ?? "n/a"} gate ${acceptance.verdict.gate ?? "?"} churn ${acceptance.verdict.churn} ` +
        `(${acceptance.readers.length} independent book readers).`,
    });
  }
  return roundId;
}

// ── The review phase ──────────────────────────────────────────────────────────

export type AuthorReviewOptions = {
  maxParallel: number;
  bar?: number;
  heartbeat?: () => boolean;
  io?: Partial<AuthorReviewIo>;
};

export async function doAuthorReview(
  bookId: string,
  deps: AutopilotDeps,
  opts: AuthorReviewOptions,
): Promise<AutopilotOutcome | null> {
  const io = resolveAuthorReviewIo(opts.io);
  const heartbeat = opts.heartbeat ?? (() => true);
  const bar = opts.bar ?? 84;

  let chapters: ChapterV21[];
  try {
    chapters = [...io.loadChapters(bookId)].sort((a, b) => a.number - b.number);
  } catch (err) {
    return halt(bookId, "infra", `author review: could not load chapters: ${(err as Error).message}`);
  }
  if (chapters.length === 0) return halt(bookId, "infra", `author review: no chapters on disk for ${bookId}`);

  // ── 1. One blinded reader per chapter. ─────────────────────────────────────
  deps.log(`[autopilot] author review: ${chapters.length} chapter(s), one blinded reader each (parallel ≤${opts.maxParallel}, bar ${bar})`);
  const reviews = new Map<number, ChapterReviewV1>();
  await mapPool(chapters, opts.maxParallel, async (chapter) => {
    heartbeat();
    reviews.set(chapter.number, await reviewOneChapter(bookId, chapter, deps, io, bar));
  });
  if (!heartbeat()) return halt(bookId, "infra", `lost the run lock for ${bookId} during author review — halting to avoid two conductors on the same book.`);

  // ── 2. Regenerate failing chapters WITH the review complaints (cap: the
  //       original + ONE regen = AUTHOR_REGEN_CAP total write attempts). ──────
  const failing = chapters.filter((chapter) => !reviews.get(chapter.number)!.pass);
  const regenerated = new Set<number>(); // chapters that consumed their single regen (AUTHOR_REGEN_CAP is GLOBAL across the review round and the book-rejection round)
  if (failing.length > 0) {
    deps.log(`[autopilot] author review: ${failing.length} chapter(s) failed independent review — regenerating with complaints (1 regen each; ${AUTHOR_REGEN_CAP} total attempts/chapter)`);
    const stillFailing: Array<{ chapterNumber: number; summary: string }> = [];
    await mapPool(failing, opts.maxParallel, async (chapter) => {
      heartbeat();
      const nn = String(chapter.number).padStart(2, "0");
      const complaints = complaintsOf(reviews.get(chapter.number)!);
      regenerated.add(chapter.number);
      const regen = await authorWriteOneChapter(bookId, chapter.number, deps, { complaints, io: opts.io });
      if (!regen.ok) {
        stillFailing.push({ chapterNumber: chapter.number, summary: regen.reason });
        return;
      }
      const fresh = io.loadChapters(bookId).find((c) => c.number === chapter.number);
      if (!fresh) {
        stillFailing.push({ chapterNumber: chapter.number, summary: `ch${nn}: regenerated file missing after write` });
        return;
      }
      const review = await reviewOneChapter(bookId, fresh, deps, io, bar, "-regen");
      reviews.set(chapter.number, review);
      if (!review.pass) stillFailing.push({ chapterNumber: chapter.number, summary: complaintsOf(review).join("; ").slice(0, 400) });
    });
    if (stillFailing.length > 0) {
      const table = stillFailing
        .sort((a, b) => a.chapterNumber - b.chapterNumber)
        .map((f) => `  ch${String(f.chapterNumber).padStart(2, "0")} — ${f.summary}`)
        .join("\n");
      return halt(bookId, "content", `author review: ${stillFailing.length} chapter(s) still fail independent review after the regen cap (${AUTHOR_REGEN_CAP} write attempts each):\n${table}`);
    }
    chapters = [...io.loadChapters(bookId)].sort((a, b) => a.number - b.number);
  }

  // ── 3. Book acceptance (the author arch's confirming function). ────────────
  let acceptance = await runBookAcceptance(bookId, chapters, deps, io, bar, "");
  if (!acceptance.accepted) {
    // ONE targeted regen round: the book readers' complaints mapped to their
    // chapters (cap 3), re-review, then re-run acceptance ONCE.
    const allTargets = mapBookComplaintsToChapters(acceptance.readers, acceptance.sampledNumbers);
    const targets = new Map([...allTargets.entries()].filter(([n]) => !regenerated.has(n)));
    const skipped = [...allTargets.keys()].filter((n) => regenerated.has(n));
    if (skipped.length > 0) {
      deps.log(`[autopilot] author acceptance: ${skipped.length} target chapter(s) already consumed their regen (${AUTHOR_REGEN_CAP} total write attempts is a GLOBAL cap): ${skipped.map((n) => `ch${String(n).padStart(2, "0")}`).join(", ")}`);
    }
    if (targets.size === 0) {
      const readerLines = acceptance.readers
        .map((r) => `  reader ${r.reviewerSessionId}: comp=${r.composite} gate=${r.gateVerdict} churn=${r.churn} — ${r.oneParagraphVerdict.slice(0, 300)}`)
        .join("\n");
      return halt(bookId, "content", `author acceptance REJECTED and every targeted chapter has already consumed its regen budget (cap ${AUTHOR_REGEN_CAP} write attempts/chapter, global across review + acceptance rounds):\n${readerLines}`);
    }
    deps.log(`[autopilot] author acceptance REJECTED — one targeted regen round over ${targets.size} chapter(s): ${[...targets.keys()].map((n) => `ch${String(n).padStart(2, "0")}`).join(", ")}`);
    const regenFailures: string[] = [];
    await mapPool([...targets.entries()], opts.maxParallel, async ([chapterNumber, complaints]) => {
      heartbeat();
      const nn = String(chapterNumber).padStart(2, "0");
      const regen = await authorWriteOneChapter(bookId, chapterNumber, deps, { complaints, io: opts.io });
      if (!regen.ok) {
        regenFailures.push(regen.reason);
        return;
      }
      const fresh = io.loadChapters(bookId).find((c) => c.number === chapterNumber);
      if (!fresh) {
        regenFailures.push(`ch${nn}: regenerated file missing after write`);
        return;
      }
      const review = await reviewOneChapter(bookId, fresh, deps, io, bar, "-bookregen");
      reviews.set(chapterNumber, review);
      if (!review.pass) regenFailures.push(`ch${nn}: ${complaintsOf(review).join("; ").slice(0, 400)}`);
    });
    if (regenFailures.length > 0) {
      return halt(bookId, "content", `author acceptance: targeted regen round failed:\n${regenFailures.map((f) => `  ${f}`).join("\n")}`);
    }
    chapters = [...io.loadChapters(bookId)].sort((a, b) => a.number - b.number);
    acceptance = await runBookAcceptance(bookId, chapters, deps, io, bar, "-round2");
    if (!acceptance.accepted) {
      const readerLines = acceptance.readers
        .map((r) => `  reader ${r.reviewerSessionId}: comp=${r.composite} gate=${r.gateVerdict} churn=${r.churn} valid=${r.valid ? "yes" : `NO (${r.invalidReason})`} — ${r.oneParagraphVerdict.slice(0, 300)}`)
        .join("\n");
      return halt(bookId, "content", `author acceptance still REJECTED after the one targeted regen round (composite ${acceptance.verdict.medianComposite ?? "n/a"}, gate ${acceptance.verdict.gate ?? "?"}, churn ${acceptance.verdict.churn}, bar ${AUTHOR_BOOK_ACCEPT_BAR}):\n${readerLines}`);
    }
  }

  // ── 4. Accepted: produce the independent publish evidence (B5), then write
  //       the records the promote gate reads. The evidence steps drive the
  //       REAL key-pack/key-derive/key-resolve and qc-submit/sweep-record
  //       writers against the SAME opened round the attestations cite; a
  //       failure in either is a fail-closed halt, never a skip. ─────────────
  let opened: AuthorEvidenceRound;
  try {
    opened = io.acceptance.openRound(bookId);
  } catch (err) {
    return halt(bookId, "infra", `author acceptance passed but opening the QC round failed: ${(err as Error).message}`);
  }
  const keyEvidence = await io.evidence.runKeyJudge(bookId, chapters, deps, io, opened);
  if (!keyEvidence.ok) {
    return halt(bookId, keyEvidence.category, `author publish evidence (manual key-judge) failed for round ${opened.roundId}: ${keyEvidence.reason}`);
  }
  const sweepEvidence = await io.evidence.runSweep(bookId, chapters, deps, io, opened);
  if (!sweepEvidence.ok) {
    return halt(bookId, sweepEvidence.category, `author publish evidence (sweep) failed for round ${opened.roundId}: ${sweepEvidence.reason}`);
  }
  try {
    const roundId = writeAuthorAcceptance(bookId, chapters, reviews, acceptance, io.acceptance, opened.roundId);
    deps.log(`[autopilot] author acceptance PASSED — key-judge + sweep evidence complete; wrote ${chapters.length} PUBLISHABLE attestation(s) + bar/confirm artifacts (round ${roundId})`);
  } catch (err) {
    return halt(bookId, "infra", `author acceptance passed but the attestation write failed: ${(err as Error).message}`);
  }
  return null;
}
