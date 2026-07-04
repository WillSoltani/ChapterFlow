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
 *      4-chapter sample doc read by AUTHOR_BOOK_READERS (=3, Q5) independent
 *      book readers, composed by composeBookVerdict. ACCEPT when gate === "PASS"
 *      AND medianComposite >= FLOOR(74) AND >= beatShipped+MARGIN(5) AND validCount
 *      >= quorum (churn = telemetry + repair routing, never an accept veto —
 *      publish calibration 2026-07-04)
 *      (Q4). The book readers are the author arch's CONFIRMING function (the
 *      sweep-confirmation analog — runAutopilot's author branch substitutes this
 *      acceptance for deps.sweepConfirmed).
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

import { readFileSync } from "fs";
import { mkdirSync } from "fs";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";
import { createHash } from "crypto";

import { CANONICAL_STATE } from "../lib/chapterPaths.js";
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
  assertChapterReaderDocIntegrity,
  buildReaderReviewTask,
  parseReaderReview,
  writeChapterReview,
} from "../review/readerReview.js";
import { renderChapterReaderDoc } from "../review/renderReaderDoc.js";
import {
  adjudicateBookReview,
  assertBookSampleDocIntegrity,
  buildBookReviewTask,
  composeBookVerdict,
  DocIntegrityError,
  parseBookReview,
  renderBookSampleDoc,
  selectAcceptanceSample,
  type BookReaderResult,
  type BookVerdict,
} from "../review/evalBookProxy.js";
import { buildChurnEvidenceReport, rankSaturationContributors } from "../critics/readerBudgets.js";
import { chapterContentHash, writeAttestation, type QcAttestation } from "../critics/qcAttestation.js";
import { AXIS_WEIGHTS, computeVerdict, type AxisId, type AxisScore } from "../critics/semantic/publishableBar.js";
import { writeBarReadArtifact, writeConfirmReadArtifact } from "../qc/orchestrator/artifacts.js";
import type { ValidatedBarReadSubmission, ValidatedConfirmReadSubmission } from "../qc/orchestrator/schemas.js";
import { openQcRound, type QcRoundRole } from "../qc/qcRound.js";
import { writeFileAtomic, ensureTrailingNewline } from "../lib/atomicWrite.js";
import {
  runKeyJudgeEvidence,
  runSweepEvidence,
  type AuthorEvidenceResult,
  type AuthorEvidenceRound,
} from "./authorEvidence.js";
import {
  authorWriteOneChapter,
  ensureReaderBudgetsClean,
  resolveAuthorIo,
  type AuthorIo,
} from "./authorRun.js";
import {
  appendReviewHistory,
  appendTiebreakNote,
  carryReviewFor,
  loadTiebreakNotes,
  writeReviewClearsLedger,
} from "./authorReviewLedger.js";
import {
  RegenLedgerError,
  computeRegenLineage,
  loadAuthorRegenLedger,
  migrateLegacyRegenCounts,
  recordRegenConsumed,
  recordRepairConsumed,
  regenConsumedFor,
  repairConsumedFor,
} from "./authorRegenLedger.js";
import { classifyRepairEligibility, doRepairOneChapter, reviewRepairEnabled } from "./authorRepair.js";
import { resolveBeatShippedBar, type BeatShippedResult } from "./shippedControl.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PIPELINE_DIR = resolve(__dirname, "../..");

/** Total write attempts per chapter across write+review: the original authoring
 *  + ONE review-complaint regeneration. */
export const AUTHOR_REGEN_CAP = 2;
/** Book-acceptance rejection: at most this many chapters get the targeted regen. */
export const AUTHOR_BOOK_REGEN_CHAPTER_CAP = 3;
/** Independent book-level readers per acceptance round. THREE (Q5, owner
 *  decision 2026-07-03) restores parity with the owner-instrument replica (whose
 *  CLI default is 3) and compose.py's median/majority-of-odd-panel semantics:
 *  median-of-3 clips a single outlier composite (a lone hallucinating reader no
 *  longer drags the mean), the gate becomes a true majority (2P/1F PASS, 1P/2F
 *  FAIL — FAIL no longer needs unanimity), and churn resolves by real majority
 *  (the only remaining tie is a LOW/MEDIUM/HIGH one-each split, still decided by
 *  first-inserted). Was 2. */
export const AUTHOR_BOOK_READERS = 3;

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

/** Q6 — the durable per-round acceptance record. Every adjudicated reader result
 *  (scores, gate, churn, quotes tally, keyCheck, structuralScreen, invalidReason)
 *  + the composed verdict + the bar it was judged at + the beat-shipped floor +
 *  the sampled chapter numbers + a sha256 of the EXACT docText the readers scored
 *  + an ISO timestamp. Written to state/reviews/<bookId>/acceptance.<roundLabel>.json
 *  so forensics no longer depend on ~/.codex rollouts outside the repo. */
export type AuthorAcceptanceRecord = {
  schemaVersion: "author-acceptance-v1";
  bookId: string;
  roundLabel: string;
  at: string;
  bar: number;
  beatShipped: number | null;
  accepted: boolean;
  sampledChapters: number[];
  docSha256: string;
  verdict: BookVerdict;
  readers: BookReaderResult[];
};

export type AuthorReviewIo = AuthorIo & {
  /** Persist a review input doc under scratch/review/<book>/; returns both paths. */
  writeReviewDoc: (bookId: string, fileName: string, text: string) => { absPath: string; relPath: string };
  /** Persist a chapter's ChapterReviewV1 artifact. */
  persistReview: (bookId: string, review: ChapterReviewV1) => string;
  /** Q6 — persist a durable acceptance-round record; returns the path written. */
  persistAcceptance: (bookId: string, record: AuthorAcceptanceRecord) => string;
  acceptance: AcceptanceWriters;
  evidence: EvidenceRunners;
  /** AUTO control-read: resolve the beat-shipped bar (env override / git-pinned
   *  shipped-package 3-reader control read / none). Injectable so tests never
   *  spawn a real reader or shell out to git. */
  resolveBeatShipped: (bookId: string, deps: AutopilotDeps, io: AuthorReviewIo) => Promise<BeatShippedResult>;
  /** E2 regen-cap persistence — how many REGENERATIONS a chapter has consumed
   *  across prior conductor entries AGAINST ITS CURRENT DESIGN LINEAGE (v2,
   *  durable). Throws RegenLedgerError when the lineage is uncomputable —
   *  an infra halt, never a fail-open cap. Injectable so tests exercise the
   *  GLOBAL cap without leaking into real state/. Default reads the on-disk
   *  ledger. */
  regenConsumedFor: (bookId: string, chapterNumber: number) => number;
  /** Record ONE more consumed regeneration for a chapter's current lineage
   *  (durable). Throws RegenLedgerError on uncomputable lineage. Injectable;
   *  default appends to the on-disk ledger. */
  recordRegenConsumed: (bookId: string, chapterNumber: number) => void;
  /** Stamp v1 legacy counts onto their on-disk design lineages (idempotent;
   *  see migrateLegacyRegenCounts). Called at phase entry BEFORE any regen
   *  decision. Throws RegenLedgerError when legacy counts exist but a lineage
   *  is uncomputable. */
  migrateRegenLedger: (bookId: string, log?: (m: string) => void) => void;
  /** Repair lane (plan R6): repairs consumed against the chapter's CURRENT
   *  design lineage (durable; cap 1). Injectable like the regen pair. */
  repairConsumedFor: (bookId: string, chapterNumber: number) => number;
  recordRepairConsumed: (bookId: string, chapterNumber: number) => void;
};

/** Default io lineage resolution: uncomputable lineage = infra, never no-cap. */
function requireLineage(bookId: string, chapterNumber: number): string {
  const lineage = computeRegenLineage(bookId, chapterNumber);
  if (!lineage) {
    throw new RegenLedgerError(
      `regen lineage uncomputable for ch${String(chapterNumber).padStart(2, "0")} of ${bookId} (brief or source packet unreadable) — cannot honor the regen cap honestly`,
    );
  }
  return lineage;
}

/** Thrown when the AUTO control-read is required (a shipped package exists, no
 *  env override) but cannot be produced — a fail-closed infra halt, never a
 *  silent drop of the beat-shipped protection. Caught by doAuthorReview like
 *  DocIntegrityError. */
export class ControlReadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ControlReadError";
  }
}

export function resolveAuthorReviewIo(over?: Partial<AuthorReviewIo>): AuthorReviewIo {
  const base = resolveAuthorIo(over);
  return {
    ...base,
    writeReviewDoc: over?.writeReviewDoc ?? ((bookId, fileName, text) => {
      const relPath = `scratch/review/${bookId}/${fileName}`;
      const absPath = resolve(PIPELINE_DIR, relPath);
      mkdirSync(dirname(absPath), { recursive: true });
      // Q1 central choke point: EVERY reader-facing doc written here (per-chapter
      // reader doc, book-sample doc, key-judge doc, sweep-submission/answers JSON)
      // is guaranteed to end with a trailing newline. See ensureTrailingNewline.
      writeFileAtomic(absPath, ensureTrailingNewline(text));
      return { absPath, relPath };
    }),
    persistReview: over?.persistReview ?? ((bookId, review) => {
      // Latest-pointer artifact (state/reviews/<book>/ch<NN>.review.json) — the
      // existing per-chapter review file every prior consumer reads.
      const path = writeChapterReview(bookId, review);
      // E2: append to the immutable content-keyed history + rebuild the
      // materialized clears cache. Best-effort — a ledger write must never
      // convert a valid review into a halt; the reuse predicate reverifies the
      // history bytes anyway and the cache is rebuildable.
      try {
        appendReviewHistory(bookId, review);
        writeReviewClearsLedger(bookId);
      } catch { /* forensic ledger; never fail the review on it */ }
      return path;
    }),
    persistAcceptance: over?.persistAcceptance ?? ((bookId, record) => {
      const path = acceptanceRecordPath(bookId, record.roundLabel);
      mkdirSync(dirname(path), { recursive: true });
      writeFileAtomic(path, JSON.stringify(record, null, 2) + "\n");
      return path;
    }),
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
    resolveBeatShipped: over?.resolveBeatShipped ?? ((bookId, deps, io) => resolveBeatShippedBar(bookId, deps, io)),
    regenConsumedFor: over?.regenConsumedFor ?? ((bookId, n) => regenConsumedFor(loadAuthorRegenLedger(bookId), n, requireLineage(bookId, n))),
    recordRegenConsumed: over?.recordRegenConsumed ?? ((bookId, n) => { recordRegenConsumed(bookId, n, requireLineage(bookId, n)); }),
    migrateRegenLedger: over?.migrateRegenLedger ?? ((bookId, log) => { migrateLegacyRegenCounts(bookId, undefined, log); }),
    repairConsumedFor: over?.repairConsumedFor ?? ((bookId, n) => repairConsumedFor(loadAuthorRegenLedger(bookId), n, requireLineage(bookId, n))),
    recordRepairConsumed: over?.recordRepairConsumed ?? ((bookId, n) => { recordRepairConsumed(bookId, n, requireLineage(bookId, n)); }),
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function halt(bookId: string, category: "infra" | "content" | "progress", reason: string): AutopilotOutcome {
  return { status: "halt", bookId, phase: "qc", category, reason };
}

/** Normalize an acceptance round label ("" → "round1"; "-round2" → "round2") to
 *  a filesystem-safe segment. Exported for the durable-record test. */
export function acceptanceRoundSegment(roundLabel: string): string {
  const seg = (roundLabel || "").replace(/^-/, "").trim() || "round1";
  return seg.replace(/[^A-Za-z0-9._-]/g, "_");
}

/** Path of a durable acceptance record under `stateRoot` (default: canonical
 *  pipeline state dir). Injectable root so tests write to a tmp dir. */
export function acceptanceRecordPath(bookId: string, roundLabel: string, stateRoot: string = CANONICAL_STATE): string {
  return resolve(stateRoot, "reviews", bookId, `acceptance.${acceptanceRoundSegment(roundLabel)}.json`);
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
  readers: Array<Pick<BookReaderResult, "keyCheck" | "oneParagraphVerdict" | "gateVerdict" | "churn"> & { valid?: boolean }>,
  sampledNumbers: number[],
  cap: number = AUTHOR_BOOK_REGEN_CHAPTER_CAP,
): Map<number, string[]> {
  // Q7 — complaint-targeting guard: only a still-VALID reader (post-Q3 screen)
  // may steer a targeted regen. A disproven structural claim invalidated its
  // reader (adjudicateBookReview), and that reader's complaints must NOT burn an
  // innocent chapter's regen budget (the POM round-1 ch05 waste). A reader
  // missing `valid` (older Pick call sites in tests) is treated as valid.
  const readersValid = readers.filter((r) => r.valid !== false);
  // No valid reader left → no VALID complaint to target; return no targets so the
  // caller halts on "nothing actionable" rather than burning an innocent chapter
  // on a disproven claim (Q7). Quorum (Q4) already blocks accepting such a round.
  if (readersValid.length === 0) return new Map();
  const sampledSet = new Set(sampledNumbers);
  const byChapter = new Map<number, string[]>();
  const add = (n: number, line: string): void => {
    if (!sampledSet.has(n)) return;
    const list = byChapter.get(n) ?? [];
    if (!list.includes(line)) list.push(line);
    byChapter.set(n, list);
  };
  for (const reader of readersValid) {
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
    const generic = readersValid
      .map((r) => r.oneParagraphVerdict?.trim())
      .filter((v): v is string => !!v && v.length > 0)
      .map((v) => `book reader verdict: ${v.slice(0, 500)}`);
    const lines = generic.length
      ? generic
      : [`book acceptance rejected (gate ${readersValid.map((r) => r.gateVerdict).join("/")}, churn ${readersValid.map((r) => r.churn).join("/")})`];
    for (const n of sampledNumbers.slice(0, cap)) byChapter.set(n, [...lines]);
  }
  // Deterministic cap: keep the lowest-numbered chapters first.
  const capped = [...byChapter.entries()].sort((a, b) => a[0] - b[0]).slice(0, cap);
  return new Map(capped);
}

/** C2/#21: ONLY the complaints that explicitly NAME a chapter ("ch3 Q2…",
 *  "chapter 5's examples…") — no fallback. Used by the churn-driven repair
 *  router so reader-named defects outrank measured-saturation targets. Same
 *  Q7 valid-reader guard as mapBookComplaintsToChapters. */
export function mapNamedBookComplaints(
  readers: Array<Pick<BookReaderResult, "keyCheck" | "oneParagraphVerdict" | "gateVerdict" | "churn"> & { valid?: boolean }>,
  sampledNumbers: number[],
): Map<number, string[]> {
  const readersValid = readers.filter((r) => r.valid !== false);
  const sampledSet = new Set(sampledNumbers);
  const byChapter = new Map<number, string[]>();
  const add = (n: number, line: string): void => {
    if (!sampledSet.has(n)) return;
    const list = byChapter.get(n) ?? [];
    if (!list.includes(line)) list.push(line);
    byChapter.set(n, list);
  };
  for (const reader of readersValid) {
    for (const line of reader.keyCheck?.disagreements ?? []) {
      const m = line.match(/\bch(?:apter)?\s*0*(\d+)\b/i);
      if (m) add(Number(m[1]), `book reader key check: ${line}`);
    }
    const verdict = reader.oneParagraphVerdict ?? "";
    for (const m of verdict.matchAll(/\bch(?:apter)?\s*0*(\d+)\b/gi)) {
      add(Number(m[1]), `book reader verdict: ${verdict.slice(0, 500)}`);
    }
  }
  return byChapter;
}

/** C2/#21: the three divergence assignments dealt (deterministically, by target
 *  index) to churn-round regen writers — three writers handed ONE identical
 *  churn pack converge on identical avoidance moves; distinct lanes prevent
 *  the repaired chapters from matching each other instead of the book. */
export const CHURN_DIVERGENCE_ASSIGNMENTS = [
  "YOUR DIVERGENCE LANE — VOCABULARY: rewrite the teaching through your own cases' concrete referents (names, artifacts, numbers). Respect the framework-vocabulary budget ruthlessly; where the old draft leaned on the framework nouns, this one names the person, the document, the number.",
  "YOUR DIVERGENCE LANE — SCENE ARCHITECTURE: recast your examples into your dealt lenses. No more than ONE person-handling-a-document tableau in the whole chapter — deliberately TIGHTER than your brief's cap of two; this lane overrides the brief on that one number. Lead with ledgers, postmortems, walkthroughs, dialogue, or counterfactual reasoning instead.",
  "YOUR DIVERGENCE LANE — QUIZ SEMANTICS: rebuild every distractor from the packet's commonError material (defensible operational alternatives); kill every tone-giveaway option; every explanation names why the tempting wrong answer fails, in varied phrasing.",
] as const;

// ── One blinded chapter review ───────────────────────────────────────────────

async function reviewOneChapter(
  bookId: string,
  chapter: ChapterV21,
  deps: AutopilotDeps,
  io: AuthorReviewIo,
  bar: number,
  labelSuffix = "",
  // C3 (#1): tiebreak reads are adjudicated WITHOUT persistence — the deciding
  // read is persisted LAST by the tiebreak composer, so a lone PASS completing
  // after a majority FAIL can never own the latest-pointer or mint a carryable
  // clear. Default true preserves every existing call site.
  persist = true,
): Promise<ChapterReviewV1> {
  const nn = String(chapter.number).padStart(2, "0");
  // docText carries the trailing newline the reader's FILE has (writeReviewDoc
  // adds it centrally) so adjudication + the Q2/Q3 recount see the exact reader
  // bytes; quotes are interior substrings, so byte-verification is unaffected.
  const docText = ensureTrailingNewline(renderChapterReaderDoc(chapter));
  // Q2 (chapter analog): certify the doc BEFORE spawning — a truncated/
  // mis-rendered chapter doc is an infra halt, never a reader verdict.
  assertChapterReaderDocIntegrity(docText, chapter);
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
      if (persist) io.persistReview(bookId, review);
      deps.log(`[autopilot] author review ch${nn}${labelSuffix}: composite ${review.composite} ship=${review.ship84} keys ${review.keyCheck.matches}/${review.keyCheck.of} → ${review.pass ? "PASS" : "FAIL"}${review.valid ? "" : " (INVALID quotes)"}`);
      return review;
    }
    deps.log(`[autopilot] author review ch${nn}${labelSuffix}: attempt ${attempt} failed quote verification — respawning once`);
  }
  const review = unparseableReview(chapter, lastSessionId);
  if (persist) io.persistReview(bookId, review);
  return review;
}

// ── C3: the in-pipeline near-bar tiebreak (the owner-approved ch07 protocol) ──
//
// A single-reader FAIL with the FLIP SIGNATURE — valid, composite ≥ bar, keys
// 9/9, ship=false — is a proven coin-flip surface (POM forensics: 3/12 verdicts
// flipped on byte-identical bytes; this run: ch01/ch03/ch05/ch07). Before any
// regen budget is consumed, spawn TWO more independent readers over the SAME
// bytes; the chapter converts to PASS iff BOTH ship clean (2/3 majority with
// the original FAIL). Strictly MORE scrutiny than the status quo (a regen's
// PASS rests on ONE fresh read; conversion here needs two). A keyCheck
// disagreement is NOT a flip (#2) — a real key defect must regen, not vote.
//
// Persistence discipline (#1): the extra reads never self-persist. On majority-
// SHIP the deciding PASS is persisted LAST (latest-pointer + history + clears);
// on fail-stands the losing PASS is persisted NOWHERE (a persisted PASS at the
// current content hash would mint a carryable clear). The overridden read's
// complaints are preserved in a tiebreak note either way (#4).

export function isFlipSignature(review: ChapterReviewV1, bar: number): boolean {
  return review.valid === true
    && review.pass === false
    && review.ship84 === false
    && review.composite >= bar
    && review.keyCheck.matches === review.keyCheck.of;
}

async function tiebreakFlipVerdict(
  bookId: string,
  chapter: ChapterV21,
  original: ChapterReviewV1,
  deps: AutopilotDeps,
  io: AuthorReviewIo,
  bar: number,
): Promise<{ review: ChapterReviewV1; extraComplaints: string[]; upheldReadSets?: string[][]; upheldComposites?: number[] }> {
  const nn = String(chapter.number).padStart(2, "0");
  deps.log(`[autopilot] author review ch${nn}: FAIL carries the flip signature (composite ${original.composite} ≥ bar ${bar}, keys ${original.keyCheck.matches}/${original.keyCheck.of}, ship=false) — spawning 2 tiebreak readers (majority-of-3, no cap consumed)`);
  const extras: ChapterReviewV1[] = [];
  for (const suffix of ["-tiebreak-r2", "-tiebreak-r3"]) {
    extras.push(await reviewOneChapter(bookId, chapter, deps, io, bar, suffix, /* persist */ false));
  }
  const cleanShips = extras.filter((r) => r.valid && r.ship84 && r.keyCheck.matches === r.keyCheck.of && r.composite >= bar);
  const converted = cleanShips.length === 2; // both fresh reads must ship clean → 2/3 with the original FAIL
  const reads = [original, ...extras].map((r) => ({
    reviewerSessionId: r.reviewerSessionId, composite: r.composite, ship: r.ship84, valid: r.valid,
  }));
  if (converted) {
    const deciding = [...cleanShips].sort((a, b) => b.composite - a.composite)[0];
    // Deciding PASS persists LAST — it owns the latest-pointer and the history
    // slot for this content hash; the clears ledger rebuild sees the PASS.
    io.persistReview(bookId, deciding);
    try {
      appendTiebreakNote(bookId, {
        chapterNumber: chapter.number,
        contentHash: original.contentHash,
        at: new Date().toISOString(),
        outcome: "converted-to-pass",
        overriddenComplaints: complaintsOf(original),
        reads,
      });
    } catch { /* forensic note; never fail a decided review on it */ }
    deps.log(`[autopilot] author review ch${nn}: tiebreak 2/3 SHIP (${extras.map((r) => r.composite).join(", ")}) — deciding PASS ${deciding.composite} persisted; original FAIL's complaints preserved in tiebreak notes`);
    return { review: deciding, extraComplaints: [] };
  }
  // Fail stands. Never persist a losing PASS (it would mint a clear at this
  // content hash), and extra FAILs share the one history slot anyway — the
  // original FAIL persists LAST as the canonical latest-pointer, and the extra
  // valid FAILs' complaints ride to the regen via extraComplaints.
  const extraComplaints = extras.filter((r) => r.valid && !r.ship84).flatMap((r) => complaintsOf(r));
  io.persistReview(bookId, original);
  try {
    appendTiebreakNote(bookId, {
      chapterNumber: chapter.number,
      contentHash: original.contentHash,
      at: new Date().toISOString(),
      outcome: "fail-stands",
      overriddenComplaints: extraComplaints,
      reads,
    });
  } catch { /* forensic note */ }
  deps.log(`[autopilot] author review ch${nn}: tiebreak upheld the FAIL (${extras.map((r) => `${r.composite}${r.ship84 ? " ship" : ""}${r.valid ? "" : " invalid"}`).join(", ")}) — regen proceeds with merged complaints`);
  // Repair-lane inputs (plan R1): per-read must-fix sets and composites of the
  // valid reads, so the caller can test scope-level complaint convergence.
  const validReads = [original, ...extras.filter((r) => r.valid)];
  return {
    review: original,
    extraComplaints,
    upheldReadSets: validReads.filter((r) => !r.ship84).map((r) => complaintsOf(r)),
    upheldComposites: validReads.map((r) => r.composite),
  };
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

/** Publish calibration (2026-07-04): the ACCEPT floor. 74 sits below the
 *  demonstrated good-book noise band (a 9×85.7-88.9 chapter board read 75.0-78.7
 *  across 5 panels, ±3.7 on identical bytes) and above every correctness-broken
 *  era reading. The 80 bar above remains the premium telemetry target. */
export const AUTHOR_BOOK_ACCEPT_FLOOR = 74;

/** A regen must beat its shipped control by a REAL margin, not by noise. */
export const BEAT_SHIPPED_MARGIN = 5;

async function runBookAcceptance(
  bookId: string,
  chapters: ChapterV21[],
  deps: AutopilotDeps,
  io: AuthorReviewIo,
  bar: number,
  roundLabel: string,
  // C4: round 2 salts the sample with its raw roundLabel and FORCE-INCLUDES the
  // regen targets, so the re-accept always re-reads the repaired bytes and never
  // re-judges only the identical round-1 four. Round 1 passes nothing — its
  // sample stays byte-identical to the score.py-parity path (and to the
  // shipped-control read, which never salts).
  sampleOpts?: { salt?: string; forceInclude?: number[] },
): Promise<BookAcceptanceResult> {
  // AUTO control-read: resolve the beat-shipped bar BEFORE spawning any reader,
  // so a regen's acceptance is judged against the book it replaces on the same
  // instrument. Env override → that value; a tracked shipped package with no
  // override → the git-pinned 3-reader control read (cached by pin); no shipped
  // package → null (bar-80-only). A required control read that cannot be
  // produced throws ControlReadError → doAuthorReview halts infra (never a silent
  // drop of the beat-shipped protection).
  const beat = await io.resolveBeatShipped(bookId, deps, io);
  if (!beat.ok) throw new ControlReadError(beat.reason);
  const shipped = beat.composite;
  const sampled = selectAcceptanceSample(bookId, chapters, 4, sampleOpts?.salt ?? "", sampleOpts?.forceInclude ?? []);
  const docText = renderBookSampleDoc(sampled);
  // Q2 — doc-integrity postcondition: certify the rendered bytes BEFORE any
  // reader spawns. Per sampled chapter, question-line count === quiz question
  // count === combined-key-row count, and the doc ends with a newline. A
  // mismatch throws DocIntegrityError (caught by doAuthorReview → halt infra),
  // so no reader ever scores a truncated/mis-rendered doc and any later "key
  // omits chapter N Q<k>" claim is provably a reader error (Q3).
  assertBookSampleDocIntegrity(docText, sampled);
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
  const comp = verdict.medianComposite ?? 0;
  // Q4 — valid-count QUORUM (fail-closed): a book is NEVER accepted below full
  // panel. composeBookVerdict happily composes over even ONE valid reader, so
  // without this floor a Q3 invalidation (or unparseable-after-retry readers)
  // could shrink the panel and let a single voice carry acceptance. Requiring
  // validCount >= AUTHOR_BOOK_READERS is a pure strengthen AND the guarantee
  // that makes Q3's invalidation weaken-proof.
  const quorumMet = verdict.validCount >= AUTHOR_BOOK_READERS;
  // Red-team BREAK-2 (publish calibration): REJECT had no memory — identical
  // bytes could re-roll a fresh panel every conductor entry until noise (±3.7)
  // cleared the floor, while one ACCEPT persisted forever. Pool the on-disk
  // acceptance records for the SAME docSha256: the decision composite is the
  // MEDIAN across all same-doc reads, and a gate FAIL recorded on these exact
  // bytes sticks (fail-closed) until the bytes change.
  const docSha = createHash("sha256").update(docText).digest("hex");
  let compPooled = comp;
  let gatePooled = verdict.gate;
  try {
    const priors: Array<{ c: number | null; gate: string | null }> = [];
    for (const label of ["", "-round2"]) {
      try {
        const rec = JSON.parse(readFileSync(acceptanceRecordPath(bookId, label), "utf8")) as AuthorAcceptanceRecord;
        if (rec && rec.docSha256 === docSha && typeof rec.verdict?.medianComposite === "number") {
          priors.push({ c: rec.verdict.medianComposite, gate: rec.verdict.gate ?? null });
        }
      } catch { /* no prior record for this label */ }
    }
    if (priors.length > 0) {
      const reads = [...priors.map((p) => p.c as number), comp].sort((a, b) => a - b);
      compPooled = reads[Math.floor(reads.length / 2)];
      if (priors.some((p) => p.gate === "FAIL")) gatePooled = "FAIL";
      deps.log(`[autopilot] author acceptance${roundLabel}: pooled ${priors.length + 1} same-doc read(s) → composite ${compPooled}, gate ${gatePooled} (re-roll guard)`);
    }
  } catch { /* pooling is best-effort; the single-read decision stands */ }
  // Publish calibration (owner decision 2026-07-04, plan docs/v24/
  // PUBLISH-CALIBRATION-PLAN-2026-07-04.md): the single bar-80 demanded
  // corpus-#1 quality (atomic-habits reads 80.2 on this instrument; panel noise
  // is ±3.7 on identical bytes; no real book has read ≥84) and churn-HIGH as a
  // binary veto fired on genre-inherent framework repetition through every
  // texture lever. ACCEPT is now multi-signal: correctness gate PASS stays a
  // HARD blocker (stricter than the shipped corpus's own history — POM shipped
  // at 80.0 with a unanimous gate FAIL), composite must clear the absolute
  // FLOOR and beat the shipped control by a real MARGIN. Churn is telemetry +
  // repair routing, never an accept-time veto. AUTHOR_BOOK_ACCEPT_BAR (80)
  // remains in the record as the premium telemetry target.
  const accepted = quorumMet
    && gatePooled === "PASS"
    && compPooled >= AUTHOR_BOOK_ACCEPT_FLOOR
    && (shipped === null || compPooled >= shipped + BEAT_SHIPPED_MARGIN);
  deps.log(`[autopilot] author acceptance${roundLabel}: composite ${verdict.medianComposite ?? "n/a"} gate ${verdict.gate ?? "?"} (${verdict.gateVotes}) churn ${verdict.churn} valid ${verdict.validCount}/${AUTHOR_BOOK_READERS} vs floor ${AUTHOR_BOOK_ACCEPT_FLOOR}${shipped === null ? "" : ` + beat-shipped ${shipped}+${BEAT_SHIPPED_MARGIN}`} (premium target ${AUTHOR_BOOK_ACCEPT_BAR}) → ${accepted ? "ACCEPT" : `REJECT${quorumMet ? "" : " (below valid-reader quorum)"}`}`);

  // Q6 — durable acceptance record over the EXACT bytes readers scored. Best-
  // effort (a record-write failure never converts a valid acceptance into a
  // halt), but attempted for every round so forensics have a repo-local trail.
  try {
    const record: AuthorAcceptanceRecord = {
      schemaVersion: "author-acceptance-v1",
      bookId,
      roundLabel,
      at: new Date().toISOString(),
      bar: AUTHOR_BOOK_ACCEPT_BAR,
      beatShipped: shipped,
      accepted,
      sampledChapters: sampled.map((c) => c.number),
      docSha256: createHash("sha256").update(docText).digest("hex"),
      verdict,
      readers,
    };
    const path = io.persistAcceptance(bookId, record);
    deps.log(`[autopilot] author acceptance${roundLabel}: durable record → ${path}`);
  } catch (err) {
    deps.log(`[autopilot] author acceptance${roundLabel}: WARNING durable record write failed: ${(err as Error).message}`);
  }

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

/** Public entry: run the review phase, converting any DocIntegrityError (Q2 doc
 *  postcondition or a Q3 CONFIRMED structural claim, from either the chapter or
 *  book path) into a fail-closed infra halt — machine truth about a broken doc
 *  must halt the run, never surface as a content verdict or an unhandled throw. */
export async function doAuthorReview(
  bookId: string,
  deps: AutopilotDeps,
  opts: AuthorReviewOptions,
): Promise<AutopilotOutcome | null> {
  try {
    return await doAuthorReviewInner(bookId, deps, opts);
  } catch (err) {
    if (err instanceof DocIntegrityError) return halt(bookId, "infra", `author review: ${err.message}`);
    // A required AUTO control-read that cannot be produced is a fail-closed infra
    // halt — never a silent drop of the beat-shipped protection.
    if (err instanceof ControlReadError) return halt(bookId, "infra", `author acceptance beat-shipped control read: ${err.message}`);
    // A regen cap that cannot be honored honestly (unreadable ledger, or a
    // chapter whose design lineage is uncomputable) is an infra halt — never a
    // fail-open cap and never a faked content cap-exhaustion (#8).
    if (err instanceof RegenLedgerError) return halt(bookId, "infra", `author review regen ledger: ${err.message}`);
    throw err;
  }
}

async function doAuthorReviewInner(
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

  // C1 (#7): stamp any v1 legacy regen counts onto their on-disk design lineages
  // BEFORE any regen decision reads the ledger. Idempotent; throws RegenLedgerError
  // (→ infra halt via the doAuthorReview wrapper) when a legacy count's lineage is
  // uncomputable. The write phase migrates too — first one in wins.
  io.migrateRegenLedger(bookId, deps.log);

  // Reader budgets hold at THIS entry too (live-caught 2026-07-03): a budgets
  // BLOCK halts the write phase, but a re-entry conductor routes gate→qc past
  // the write phase entirely — without this check the flagged bytes would reach
  // reviewers with the block never re-run. Deterministic and instant when clean;
  // on a block it runs the same ONE bounded repair round, then re-checks.
  const budgetOutcome = await ensureReaderBudgetsClean(bookId, deps, io, {
    maxParallel: opts.maxParallel,
    heartbeat,
    haltPhase: "qc",
    label: "author review budgets",
    io: opts.io,
  });
  if (budgetOutcome) return budgetOutcome;
  // The repair round may have rewritten chapters — reload so reviews score the
  // repaired bytes (carries for rewritten chapters correctly miss on contentHash).
  try {
    chapters = [...io.loadChapters(bookId)].sort((a, b) => a.number - b.number);
  } catch (err) {
    return halt(bookId, "infra", `author review: could not reload chapters after the budget check: ${(err as Error).message}`);
  }

  // ── 1. One blinded reader per chapter — UNLESS a durable review can be
  //       CARRIED for the current bytes (E2). A carry hits only when a persisted
  //       PASS+valid review binds to this chapter's CURRENT content AND the exact
  //       reader-doc bytes AND the current bar AND schema/hash versions, with a
  //       reviewer that is not the chapter's current author. A carry spawns
  //       NOTHING; any miss falls through to a fresh independent read. ─────────
  deps.log(`[autopilot] author review: ${chapters.length} chapter(s), one blinded reader each (parallel ≤${opts.maxParallel}, bar ${bar})`);
  const reviews = new Map<number, ChapterReviewV1>();
  let carryHits = 0;
  await mapPool(chapters, opts.maxParallel, async (chapter) => {
    heartbeat();
    const carry = carryReviewFor(bookId, chapter, bar, io.authorSessionOf(chapter.chapterId));
    if (carry.hit) {
      carryHits++;
      deps.noteReviewCarry?.(true); // C5: the cost report's review-carry tally
      const nn = String(chapter.number).padStart(2, "0");
      deps.log(`[autopilot] author review ch${nn}: CARRIED durable review (composite ${carry.review.composite}, reviewer ${carry.review.reviewerSessionId}) — no reader spawned`);
      reviews.set(chapter.number, carry.review);
      return;
    }
    deps.noteReviewCarry?.(false);
    reviews.set(chapter.number, await reviewOneChapter(bookId, chapter, deps, io, bar));
  });
  if (carryHits > 0) deps.log(`[autopilot] author review: carried ${carryHits}/${chapters.length} chapter review(s) unchanged — spawned ${chapters.length - carryHits} fresh reader(s)`);
  if (!heartbeat()) return halt(bookId, "infra", `lost the run lock for ${bookId} during author review — halting to avoid two conductors on the same book.`);

  // ── 2. Regenerate failing chapters WITH the review complaints (cap: the
  //       original + ONE regen = AUTHOR_REGEN_CAP total write attempts). ──────
  // E2 regen-cap PERSISTENCE: the in-memory `regenerated` set is created fresh
  // every conductor entry, so a re-entry used to silently RESET each chapter's
  // regen budget. Load the durable per-chapter consumed-regen ledger and treat a
  // chapter that already consumed AUTHOR_REGEN_CAP-1 regens (across prior entries)
  // as exhausted, so the GLOBAL cap survives re-entry. A carried PASS is not a
  // regen and never touches the ledger.
  const regenExhausted = (n: number): boolean => io.regenConsumedFor(bookId, n) >= (AUTHOR_REGEN_CAP - 1);

  // ── C3: near-bar tiebreak BEFORE any regen decision. A flip-signature FAIL
  //    (valid, composite ≥ bar, keys 9/9, ship=false) gets two more independent
  //    reads; 2/3 SHIP converts it — a ~1-minute answer to a proven coin-flip
  //    surface, instead of a ~14-minute regen + a consumed durable cap. ────────
  const tiebreakExtraComplaints = new Map<number, string[]>();
  const tiebreakReadEvidence = new Map<number, { readSets: string[][]; composites: number[] }>();
  {
    const flips = chapters.filter((chapter) => {
      const r = reviews.get(chapter.number)!;
      return !r.pass && isFlipSignature(r, bar);
    });
    await mapPool(flips, opts.maxParallel, async (chapter) => {
      heartbeat();
      const outcome = await tiebreakFlipVerdict(bookId, chapter, reviews.get(chapter.number)!, deps, io, bar);
      reviews.set(chapter.number, outcome.review);
      if (outcome.extraComplaints.length > 0) tiebreakExtraComplaints.set(chapter.number, outcome.extraComplaints);
      if (outcome.upheldReadSets) tiebreakReadEvidence.set(chapter.number, { readSets: outcome.upheldReadSets, composites: outcome.upheldComposites ?? [] });
    });
  }
  if (!heartbeat()) return halt(bookId, "infra", `lost the run lock for ${bookId} during the review tiebreak — halting to avoid two conductors on the same book.`);

  const failing = chapters.filter((chapter) => !reviews.get(chapter.number)!.pass);
  const regenerated = new Set<number>(); // chapters that consumed their single regen THIS entry (unioned with the durable ledger for the GLOBAL cap)
  if (failing.length > 0) {
    // A failing chapter that already exhausted its durable regen budget cannot be
    // written again — that is a fail-closed content halt (the cap is global).
    const exhaustedFailing = failing.filter((c) => regenExhausted(c.number));
    if (exhaustedFailing.length > 0) {
      const table = exhaustedFailing
        .sort((a, b) => a.number - b.number)
        .map((c) => `  ch${String(c.number).padStart(2, "0")} — ${complaintsOf(reviews.get(c.number)!).join("; ").slice(0, 400)}`)
        .join("\n");
      return halt(bookId, "content", `author review: ${exhaustedFailing.length} chapter(s) fail independent review and have ALREADY consumed their durable regen budget across prior entries (cap ${AUTHOR_REGEN_CAP} write attempts/chapter, global):\n${table}`);
    }
    deps.log(`[autopilot] author review: ${failing.length} chapter(s) failed independent review — regenerating with complaints (1 regen each; ${AUTHOR_REGEN_CAP} total attempts/chapter, durable ledger loaded)`);
    const stillFailing: Array<{ chapterNumber: number; summary: string }> = [];
    await mapPool(failing, opts.maxParallel, async (chapter) => {
      heartbeat();
      const nn = String(chapter.number).padStart(2, "0");
      // C3 (#4): a tiebreak that UPHELD the fail contributes its corroborating
      // reads' complaints — the regen writer sees every independent objection.
      let complaints = [...new Set([
        ...complaintsOf(reviews.get(chapter.number)!),
        ...(tiebreakExtraComplaints.get(chapter.number) ?? []),
      ])];
      // ── Repair lane (plan docs/v24/REPAIR-LANE-PLAN-2026-07-04.md): when the
      //    upheld tiebreak's must-fixes CONVERGE on field scopes, try ONE
      //    surgical repair before spending the regen. The confirming read is
      //    the normal repair-unaware review of the new content hash; a
      //    withheld confirm falls through to regen with the CONFIRM round's
      //    complaints (hash-scoped — pre-repair complaints about fixed
      //    defects never reach the regen writer). ─────────────────────────────
      const evidence = tiebreakReadEvidence.get(chapter.number);
      // Classify FIRST (pure); consult the durable cap only for eligible
      // chapters, and treat an uncomputable lineage as "lane unavailable" —
      // the regen path owns the infra-halt semantics for that case.
      let repairCapFree = false;
      const cls = reviewRepairEnabled() && evidence ? classifyRepairEligibility(evidence.readSets, evidence.composites) : undefined;
      if (cls?.eligible) {
        try { repairCapFree = io.repairConsumedFor(bookId, chapter.number) === 0; } catch { repairCapFree = false; }
      }
      if (cls && evidence) {
        if (cls.eligible && repairCapFree) {
          deps.log(`[autopilot] author review ch${nn}: repair lane ENGAGED (${cls.reason}) — one surgical repair before any regen`);
          io.recordRepairConsumed(bookId, chapter.number);
          const rep = await doRepairOneChapter(bookId, chapter.number, deps, { io, scopes: cls.scopes, complaints });
          if (rep.ok) {
            const repaired = io.loadChapters(bookId).find((c) => c.number === chapter.number);
            if (repaired) {
              let confirm = await reviewOneChapter(bookId, repaired, deps, io, bar, "-repair");
              if (!confirm.pass && isFlipSignature(confirm, bar)) {
                const tb = await tiebreakFlipVerdict(bookId, repaired, confirm, deps, io, bar);
                confirm = tb.review;
                tiebreakExtraComplaints.set(chapter.number, tb.extraComplaints);
              }
              reviews.set(chapter.number, confirm);
              if (confirm.pass) {
                deps.log(`[autopilot] author review ch${nn}: repair CONFIRMED by a fresh read (${confirm.composite}) — no regen spent`);
                return;
              }
              deps.log(`[autopilot] author review ch${nn}: repair confirm withheld (${confirm.composite}) — escalating to regen with the confirm round's complaints`);
              complaints = [...new Set([
                ...complaintsOf(confirm),
                ...(tiebreakExtraComplaints.get(chapter.number) ?? []),
              ])];
            }
          } else {
            deps.log(`[autopilot] author review ch${nn}: repair rejected (${rep.reason ?? "unknown"}) — regen proceeds`);
          }
        } else {
          deps.log(`[autopilot] author review ch${nn}: repair lane not eligible (${cls.reason}) — regen proceeds`);
        }
      }
      if (regenExhausted(chapter.number)) {
        // The repair path consumed wall-clock; re-check the durable budget
        // before spending a regen (another conductor could have moved it).
        stillFailing.push({ chapterNumber: chapter.number, summary: `ch${nn}: regen budget exhausted after repair path` });
        return;
      }
      regenerated.add(chapter.number);
      io.recordRegenConsumed(bookId, chapter.number); // durable: this write attempt counts across re-entries
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
      let review = await reviewOneChapter(bookId, fresh, deps, io, bar, "-regen");
      // C3 on the post-regen read too: with the cap now consumed, a flip here
      // would otherwise halt the book on a coin toss (the exact ch07 scenario).
      if (!review.pass && isFlipSignature(review, bar)) {
        review = (await tiebreakFlipVerdict(bookId, fresh, review, deps, io, bar)).review;
      }
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
  //   A DocIntegrityError from the Q2 postcondition or a Q3 CONFIRMED structural
  //   claim is machine truth about a broken doc, never a content verdict — halt
  //   infra so the operator repairs the render, don't spawn/compose readers.
  let acceptance: BookAcceptanceResult;
  try {
    acceptance = await runBookAcceptance(bookId, chapters, deps, io, bar, "");
  } catch (err) {
    if (err instanceof DocIntegrityError) return halt(bookId, "infra", `author acceptance: ${err.message}`);
    throw err;
  }
  if (!acceptance.accepted) {
    // ONE targeted regen round, then re-run acceptance ONCE.
    //
    // C2: when the rejection is CHURN-DRIVEN (book-wide sameness), the old
    // ch-ref router degraded to "first three sampled chapters" and the writers
    // got no cross-chapter evidence — the halted execution run regened ch03 by
    // lowest-number fallback and the composite DROPPED. Churn routing instead:
    // reader-NAMED chapters first, measured saturation contributors fill to the
    // cap, and every target gets the deterministic churn-evidence report + a
    // DISTINCT divergence lane (+ any tiebreak-overridden complaints for that
    // chapter). Non-churn rejections keep the existing complaint mapping.
    const churnDriven = acceptance.verdict.churn === "HIGH";
    let allTargets: Map<number, string[]>;
    if (churnDriven) {
      const named = mapNamedBookComplaints(acceptance.readers, acceptance.sampledNumbers);
      const report = buildChurnEvidenceReport(chapters);
      // B19 (live, twice-proven negative): SATURATION-FILL never re-rolls a
      // strong-pass chapter (latest review ships at >= 87) — ch03's 87.5 v4
      // bytes re-rolled to an 0-3 upheld 84.7 and halted the round. Reader-NAMED
      // chapters stay routable at any score (a named defect is evidence; a
      // saturation rank is a coin flip). The honest lever for strong old
      // chapters is an owner-decided refresh round, not churn-routed variance.
      const strongPass = (n: number): boolean => {
        const r = reviews.get(n);
        return !!r && r.pass && r.composite >= 87;
      };
      const contributors = rankSaturationContributors(chapters).filter((n) => acceptance.sampledNumbers.includes(n) && !strongPass(n));
      const targetNums = [...named.keys()].sort((a, b) => a - b).slice(0, AUTHOR_BOOK_REGEN_CHAPTER_CAP);
      for (const n of contributors) {
        if (targetNums.length >= AUTHOR_BOOK_REGEN_CHAPTER_CAP) break;
        if (!targetNums.includes(n)) targetNums.push(n);
      }
      const verdictLines = acceptance.readers
        .filter((r) => r.valid !== false)
        .map((r) => `book reader verdict: ${(r.oneParagraphVerdict ?? "").slice(0, 350)}`);
      const notes = loadTiebreakNotes(bookId);
      allTargets = new Map(targetNums.map((n, i) => [n, [
        "book acceptance REJECTED with churn HIGH — the book reads as one template stamped repeatedly. Your rewrite must DIVERGE from the book-wide patterns below; improving the chapter in place while keeping the shared machine will fail again.",
        ...(named.get(n) ?? []),
        ...verdictLines,
        ...report,
        CHURN_DIVERGENCE_ASSIGNMENTS[i % CHURN_DIVERGENCE_ASSIGNMENTS.length],
        ...notes
          .filter((t) => t.chapterNumber === n && t.overriddenComplaints.length > 0)
          .flatMap((t) => t.overriddenComplaints.map((c) => `earlier independent-review complaint (tiebreak-preserved): ${c}`)),
      ]]));
      deps.log(`[autopilot] author acceptance: churn-driven repair routing — targets ${targetNums.map((n) => `ch${String(n).padStart(2, "0")}`).join(", ")} (named: ${[...named.keys()].join(",") || "none"}; saturation-ranked fill), churn pack ${report.length} measured line(s)`);
    } else {
      allTargets = mapBookComplaintsToChapters(acceptance.readers, acceptance.sampledNumbers);
    }
    // A chapter is skipped when it consumed its regen THIS entry (in-memory set)
    // OR across a prior entry (durable ledger) — the GLOBAL cap survives re-entry.
    const consumedGlobally = (n: number): boolean => regenerated.has(n) || regenExhausted(n);
    const targets = new Map([...allTargets.entries()].filter(([n]) => !consumedGlobally(n)));
    const skipped = [...allTargets.keys()].filter((n) => consumedGlobally(n));
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
      regenerated.add(chapterNumber);
      io.recordRegenConsumed(bookId, chapterNumber); // durable: the acceptance-round regen also counts against the global cap
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
      let review = await reviewOneChapter(bookId, fresh, deps, io, bar, "-bookregen");
      // C3 applies here too: this chapter's budget is now consumed — a flip on
      // this read would otherwise halt the whole book on a coin toss.
      if (!review.pass && isFlipSignature(review, bar)) {
        review = (await tiebreakFlipVerdict(bookId, fresh, review, deps, io, bar)).review;
      }
      reviews.set(chapterNumber, review);
      if (!review.pass) regenFailures.push(`ch${nn}: ${complaintsOf(review).join("; ").slice(0, 400)}`);
    });
    if (regenFailures.length > 0) {
      return halt(bookId, "content", `author acceptance: targeted regen round failed:\n${regenFailures.map((f) => `  ${f}`).join("\n")}`);
    }
    chapters = [...io.loadChapters(bookId)].sort((a, b) => a.number - b.number);
    try {
      // C4: salt = the raw round label; regen targets force-included so the
      // re-accept provably re-reads the repaired bytes (#5/#6).
      acceptance = await runBookAcceptance(bookId, chapters, deps, io, bar, "-round2", {
        salt: "-round2",
        forceInclude: [...targets.keys()],
      });
    } catch (err) {
      if (err instanceof DocIntegrityError) return halt(bookId, "infra", `author acceptance (round2): ${err.message}`);
      throw err;
    }
    if (!acceptance.accepted) {
      const readerLines = acceptance.readers
        .map((r) => `  reader ${r.reviewerSessionId}: comp=${r.composite} gate=${r.gateVerdict} churn=${r.churn} valid=${r.valid ? "yes" : `NO (${r.invalidReason})`} — ${r.oneParagraphVerdict.slice(0, 300)}`)
        .join("\n");
      return halt(bookId, "content", `author acceptance still REJECTED after the one targeted regen round (composite ${acceptance.verdict.medianComposite ?? "n/a"}, gate ${acceptance.verdict.gate ?? "?"}, churn ${acceptance.verdict.churn}, floor ${AUTHOR_BOOK_ACCEPT_FLOOR}):\n${readerLines}`);
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
