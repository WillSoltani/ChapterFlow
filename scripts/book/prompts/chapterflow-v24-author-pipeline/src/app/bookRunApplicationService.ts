import { createHash } from "node:crypto";
import { mkdir } from "node:fs/promises";
import { isAbsolute, resolve } from "node:path";

import type { BookContentReader, CandidateSnapshot } from "../books/candidateTypes.js";
import type { CurrentPointerStore } from "../books/currentPointer.js";
import type { CandidateIdentity, Result, UtcIso } from "../contracts/v4Core.js";
import { isSafeResearchRunId } from "../lib/researchRunManifest.js";
import type { QcDiagnosis, QcDiagnosisIndex, QcRoundResult, QcService } from "../qc/qcTypes.js";
import type { PromotionService } from "../release/promotionTypes.js";
import { createFileReleaseJournal } from "../release/releaseJournal.js";
import type { CanonicalReviewResult, ReviewService } from "../review/reviewTypes.js";
import { reconcileAttempt, RECONCILED_UNSETTLED_ON_RESUME } from "../run-state/reconcileAttempt.js";
import type { RunStore } from "../run-state/runStore.js";
import type { RunDefinition, RunSnapshot } from "../run-state/runTypes.js";
import type { StageCoordinator } from "../run-state/stageTypes.js";
import type { CandidateRepairApplicationPort } from "./candidateRepairApplicationPort.js";
import { QUIZ_JUDGE_MAX_ATTEMPTS, type CandidateQcEvaluator } from "./candidateQcEvaluator.js";
import { isRepairReviewErrorTerminalReason } from "./contentRepairWorkflow.js";
import type { CompilerApplicationPort } from "./compilerApplicationPort.js";
import { researchSourcesFromChapterIndex } from "./researchCandidateApplicationPort.js";
import type {
  ResearchCandidateApplicationPort,
  ResearchCandidateApplicationResult,
  ResearchCandidateSourceMapping,
} from "./researchCandidateApplicationPort.js";
import type { ChapterFlowClock, ChapterFlowIdFactory } from "./pipeline.js";

export const BOOK_RUN_PHASES = Object.freeze([
  "intake",
  "research",
  "seed",
  "compile",
  "review",
  "fresh-qc",
  "repair",
  "promotion",
] as const);

export type BookRunPhase = typeof BOOK_RUN_PHASES[number];

export interface BookRunEvent {
  readonly schemaVersion: "1";
  readonly runId: string;
  readonly bookId: string;
  readonly phase: BookRunPhase;
  readonly status: "STARTED" | "COMPLETED" | "SKIPPED" | "FAILED";
  readonly at: UtcIso;
  readonly detail?: string;
  readonly candidate?: CandidateIdentity;
}

export interface BookRunEventSink {
  append(event: BookRunEvent): Promise<void>;
  read?(bookId: string, runId: string): Promise<readonly BookRunEvent[]>;
}

export interface BookRunApplicationRequest {
  readonly bookId: string;
  readonly title: string;
  readonly author: string;
  readonly sourceGitSha: string;
  readonly v25Root: string;
  readonly attemptRoot: string;
  readonly resumeRunId?: string;
  /**
   * Opt-in research-run pin for a content repair (friction F5). Names the exact
   * research run a FRESH run adopts, so research costs zero model calls and
   * every non-evicted section pack reuses from cache — only the evicted surfaces
   * re-draft. Mutually exclusive with resumeRunId: a resume rehydrates its
   * durable seed and never calls the research port, so a pin there would
   * silently do nothing, and accepting the combination would make the successor
   * exception reachable with a pin present. Composes with regen, which then
   * keeps ONLY its promotion-pointer meaning. Validated fail-closed by the
   * research port; it does NOT participate in run identity or in the intake bind.
   */
  readonly researchRunId?: string;
  readonly regen: boolean;
  readonly maxRepairRounds: 1;
  readonly promoteLocal: boolean;
  /**
   * Opt-in crash recovery for a resume. Threaded to the research and compiler
   * ports so a hard-killed run (which left an attempt admitted with no terminal
   * record) can be reconciled and resumed instead of fail-closing forever at
   * RESEARCH_ATTEMPT_UNCERTAIN / COMPILER_ATTEMPT_UNCERTAIN. Only meaningful with
   * resumeRunId; default (absent/false) preserves the fail-closed contract.
   */
  readonly reconcileUnsettled?: boolean;
  readonly signal: AbortSignal;
}

export interface BookRunApplicationResult {
  readonly schemaVersion: "1";
  readonly runId: string;
  readonly status: "READY" | "PROMOTED";
  readonly candidate: CandidateIdentity;
  readonly reviewId: string;
  readonly qcRoundId: string;
  readonly bookRevision?: number;
  readonly readback?: "VERIFIED";
  /**
   * What a local promotion did NOT do, stated on the result rather than left to
   * be inferred.
   *
   * `--promote-local` advances the local V25 CURRENT pointer and nothing else.
   * It does not assemble a reader package, so after a "PROMOTED" run there is no
   * `book-packages/<bookId>.v21.json` and no
   * `state/books/<bookId>.production-manifest.json` — publish-final's preflight
   * has nothing to verify and register-web has nothing to register. The book is
   * promoted in the V25 store and absent from the shipped set.
   *
   * That boundary is deliberate and belongs at this layer: book-run is
   * contractually local-only (it rejects --publish/--publish-final/--commit/
   * --push/--deploy outright), while producing the package is a PUBLISH-layer
   * act — it needs reader-facing metadata book-run never takes (categories,
   * tags, a packageId identity), it writes into `book-packages/`, and it must
   * pass the production verifier against loose state. The route that does all of
   * that is `promote-book` with an explicit candidate selector. So the fix is
   * not to smuggle the package write in here; it is to stop reporting an
   * unqualified success for work that was only half the journey.
   *
   * Present only when `status === "PROMOTED"`.
   */
  readonly readerPackage?: "NOT_PRODUCED";
  /** The exact command that turns this promoted candidate into a reader package
   *  + production-manifest sidecar. Present only when `readerPackage` is. */
  readonly readerPackageCommand?: string;
}

export interface BookRunApplicationDependencies {
  readonly research: ResearchCandidateApplicationPort;
  readonly compiler: CompilerApplicationPort;
  readonly repair?: CandidateRepairApplicationPort;
  readonly contentReader: BookContentReader;
  readonly candidateQc: CandidateQcEvaluator;
  readonly reviews: ReviewService;
  readonly qc: QcService;
  /** Read-only index over durable qc-diagnose output. REQUIRED, not optional:
   *  the chained qc-repair ladder needs it to tell "the operator has not
   *  diagnosed this" from "this composition forgot to wire the lookup", and a
   *  missing wire must be a type error rather than a book silently stuck on the
   *  REPAIR_DIAGNOSIS_REQUIRED escalation this dependency exists to clear. */
  readonly diagnoses: QcDiagnosisIndex;
  readonly promotion: PromotionService;
  readonly currentPointer: CurrentPointerStore;
  readonly runStore: RunStore;
  readonly stageCoordinator: StageCoordinator;
  readonly clock: ChapterFlowClock;
  readonly ids: ChapterFlowIdFactory;
  readonly events: BookRunEventSink;
  readonly pipelineRoot: string;
}

const REVIEW_STAGE = "canonical-review" as const;
const FRESH_QC_STAGE = "fresh-qc" as const;

/** Successor budget for the fresh-qc judge run (base + up to 4 successors). A
 *  judge run that ends terminal WITHOUT a committed round (evaluation error /
 *  crash) gets a fresh run id — and with it fresh attempt ids — on the next
 *  resume; the bound keeps a systematically-failing judge from minting runs
 *  forever. The committed round, once present, always short-circuits the walk. */
const MAX_QC_JUDGE_RUNS = 5;

/**
 * Successor budget for the QC-FAIL repair run (base + up to 2 successors).
 *
 * The repair run id used to be a single fixed `derivedId("repair-run", runId)`.
 * `CandidateRepairApplicationPort.run` refuses a run that is already terminal
 * and non-COMPLETED (REPAIR_RUN_TERMINAL), so the FIRST repair that ended FAILED
 * — a model failure, a rejected replacement, a workflow error — froze the book
 * permanently: every later operator round re-created the same id, read the same
 * FAILED record, and died one step past `fresh-qc COMPLETED outcome=FAIL`. The
 * successor walk below is the same machinery the fresh-qc judge (MAX_QC_JUDGE_RUNS)
 * and the compiler (operator-retry slots) already have.
 *
 * SMALLER than the judge's budget on purpose: one ordinal here is a full
 * chapter-scoped repair PLUS a canonical review PLUS a fresh QC round of the
 * successor, not a handful of per-question judge calls. Reaching the cap is NOT
 * a pass — the run fails closed with the cap named.
 */
const MAX_QC_REPAIR_RUNS = 3;

/** Resolve the qc-repair ordinal budget, honouring an optional
 *  CHAPTERFLOW_QC_REPAIR_RUNS override — the exact shape of the review lane's
 *  CHAPTERFLOW_REVIEW_REPAIR_ROUNDS (#494).
 *
 *  Live evidence for wanting more than 3 on a specific book: the Franklin
 *  S-tier run spent r1 (genuine FAIL), r2 (QC still failing), r4 (genuine
 *  FAIL with ONE seat-variance blocker) with r3 forgiven as infra loss — the
 *  book keeps landing one panel draw from clean, and the fixed budget keeps
 *  ending the game first. The DEFAULT stays 3: each ordinal is a full chapter
 *  repair + canonical re-review + fresh QC round, and the operator decides
 *  when a book is worth more. Malformed or out-of-range values fail closed
 *  (never silently revert); bounded 1-10; resolved ONCE per run so a mid-run
 *  env change cannot move the budget under an in-flight walk. */
export function resolveQcRepairRuns(): number {
  const raw = globalThis.process?.env?.CHAPTERFLOW_QC_REPAIR_RUNS;
  if (raw === undefined || raw.trim() === "") return MAX_QC_REPAIR_RUNS;
  const parsed = Number(raw);
  if (!Number.isInteger(parsed)) {
    throw new Error(`CHAPTERFLOW_QC_REPAIR_RUNS is set but not an integer: ${raw}`);
  }
  if (parsed < 1 || parsed > 10) {
    throw new Error(`CHAPTERFLOW_QC_REPAIR_RUNS must be 1-10 (got ${parsed})`);
  }
  return parsed;
}

/**
 * How many ordinals a lane may absorb as INFRASTRUCTURE LOSS without spending
 * its repair budget (see `#chooseLaneOrdinal.forgivableTerminalReason`).
 *
 * TWO, and the number is a judgement about what each side costs. A forgiven
 * ordinal is not free: the walk moves to a fresh ordinal, which re-repairs at
 * full model cost — so this is a bound on how much a flaky reviewer may cost a
 * book, not a licence to retry forever. It has to be at least ONE or the live
 * Franklin shape (the last ordinal lost to a review that never returned a
 * verdict) still wedges the book; TWO covers that plus one recurrence inside the
 * same book run. Beyond that, repeated panel-level ERRORs are not noise — they
 * are a route/instrument problem an operator has to see, and the lane fails
 * closed with the CAP named exactly as before.
 *
 * The budget the operator reasons about (MAX_QC_REPAIR_RUNS) is unchanged: this
 * only stops infrastructure from eating it.
 */
const MAX_FORGIVEN_INFRA_ORDINALS = 2;

/**
 * How many times one book run may repair-and-re-review a canonical review FAIL.
 *
 * SMALL ON PURPOSE. Each round is a full chapter-scoped repair plus a full
 * blind-panel re-read of the whole book — the most expensive loop in the
 * pipeline — and the failure mode it replaces (recompile-and-resample) was
 * itself a treadmill. Two rounds buy the case this exists for, a panel naming
 * fixable on-page contradictions, without letting a systematically-unfixable
 * book burn panels forever. Reaching the cap is NOT a pass: the run fails closed
 * with BOOK_RUN_REVIEW_FAILED and the cap named in the message, exactly as it
 * did before the lane existed.
 */
export const MAX_REVIEW_REPAIR_ROUNDS = 2;

/**
 * How many review-repair IDENTITIES one book run may ever mint.
 *
 * Distinct from the round cap above, and doing a different job. The round cap
 * bounds what a SINGLE run may SPEND: each round is a chapter repair plus a full
 * blind-panel re-read, and it is the operator's cost dial
 * (CHAPTERFLOW_REVIEW_REPAIR_ROUNDS, 1-10). This ceiling bounds the ORDINAL
 * SPACE the lane may walk across ALL operator rounds of one book run, so a lane
 * that keeps failing cannot mint ids forever.
 *
 * Twice the maximum resolvable round cap, on purpose: a run at the maximum cap
 * of 10 can still absorb ten dead ordinals left by earlier operator rounds
 * before the lane refuses. Skipping a spent ordinal costs one run-state read and
 * zero model calls, so this ceiling bounds identities, never spend — the round
 * cap is what bounds spend. Exhaustion is NOT a pass: it fails closed with the
 * ceiling named.
 */
export const MAX_REVIEW_REPAIR_ORDINALS = 20;

/** Resolve the review-repair cap, honouring an optional
 *  CHAPTERFLOW_REVIEW_REPAIR_ROUNDS override — the same shape as the chapter
 *  bar's CHAPTERFLOW_CHAPTER_BAR.
 *
 *  Measured on the live canary, one run, three panel verdicts:
 *      initial            5 blockers
 *      after round 1      3 blockers
 *      after round 2      2 blockers
 *  Monotonic. The loop converges; the default of 2 is simply below what that
 *  book needed. Raising the DEFAULT would spend a full repair plus a full
 *  blind-panel re-read of the whole book on every run that does not need it —
 *  the most expensive loop in the pipeline — so the default stays 2 and the
 *  operator decides when a book is worth more.
 *
 *  Fails closed on a malformed or out-of-range value rather than silently
 *  falling back: a cap that quietly ignores what the operator asked for is
 *  worse than one that refuses. Bounded at 10 so a typo cannot burn panels
 *  indefinitely. */
export function resolveReviewRepairRounds(): number {
  const raw = globalThis.process?.env?.CHAPTERFLOW_REVIEW_REPAIR_ROUNDS;
  if (raw === undefined || raw.trim() === "") return MAX_REVIEW_REPAIR_ROUNDS;
  const parsed = Number(raw);
  if (!Number.isInteger(parsed)) {
    throw new Error(`CHAPTERFLOW_REVIEW_REPAIR_ROUNDS is set but not an integer: ${raw}`);
  }
  if (parsed < 1 || parsed > 10) {
    throw new Error(`CHAPTERFLOW_REVIEW_REPAIR_ROUNDS must be 1-10 (got ${parsed})`);
  }
  return parsed;
}
const RETRYABLE_COMPILER_FAILURES = Object.freeze([
  "COMPILER_ASSEMBLY_BLOCKED:",
  "COMPILER_SECTION_BLOCKED:",
  "COMPILER_SECTION_OUTPUT_INVALID:",
  // 11j terminal codes: section exhausted on gateway schema rejections or
  // transient process/timeout failures — same operator-retry class as BLOCKED.
  "COMPILER_SECTION_MODEL_INVALID:",
  "COMPILER_SECTION_PROCESS_FAILED:",
  // R-001, deliberately ABSENT: COMPILER_SECTION_PROVIDER_BLOCKED. Every code
  // above describes model-output variance a fresh attempt can clear. A provider
  // block (exhausted quota window, dead credential) clears only when the window
  // resets or a human re-authenticates, so granting an operator retry against it
  // just spends another round on the same wall — the burn this list would
  // otherwise re-open one layer up. Its absence is load-bearing and pinned by
  // "R-001 a provider-blocked compile failure is NOT operator-retryable" in
  // tests/v25/v4-book-run-application-service.test.ts.
] as const);

function failed<T>(code: string, message: string): Result<T> {
  return { ok: false, error: { code, message } };
}

function identity(candidate: CandidateSnapshot): CandidateIdentity {
  return {
    candidateId: candidate.manifest.candidateId,
    manifestDigest: candidate.manifest.manifestDigest,
  };
}

function sameIdentity(left: CandidateIdentity, right: CandidateIdentity): boolean {
  return left.candidateId === right.candidateId && left.manifestDigest === right.manifestDigest;
}

/**
 * The `promote-book` candidate-release invocation that turns a locally promoted
 * candidate into the reader package + production-manifest sidecar `--promote-local`
 * does not produce.
 *
 * `--expected-book-revision` is the revision the local promotion started FROM
 * (bookRevision - 1), paired with `--resume-unfinished-release` (R-233).
 *
 * It used to print the revision the promotion just COMMITTED. The release route
 * CASes expectedRevision -> expectedRevision + 1, so that command minted a SECOND
 * pointer revision for byte-identical content: revision N+1 already named this
 * candidate with nothing published, and the follow-up made N+2 name it again. The
 * adapter's own double-advance guard could not stop it, because that guard keys on
 * a release-journal record and this path — calling the promotion service directly —
 * wrote none.
 *
 * So `--promote-local` now FILES the record (state `pointer-committed`, which is
 * exactly what it achieved: the CAS landed, nothing is published) and the printed
 * command resumes THAT record. The resume publishes at the same revision and
 * advances the pointer no further; the recovery path's own bar is unchanged — it
 * still re-verifies the CURRENT readback content-addressed and re-runs the full
 * production verifier before it writes anything.
 *
 * `--categories` / `--tags` are left as placeholders on purpose — candidate
 * release requires both to be explicit, and book-run never takes reader-facing
 * metadata, so there is nothing truthful to fill in here.
 */
export function readerPackageCommandFor(input: Readonly<{
  bookId: string;
  title: string;
  author: string;
  v25Root: string;
  attemptRoot: string;
  sourceGitSha: string;
  candidate: CandidateIdentity;
  reviewId: string;
  qcRoundId: string;
  bookRevision: number;
}>): string {
  return [
    `promote-book ${input.bookId}`,
    `--title ${JSON.stringify(input.title)}`,
    `--author ${JSON.stringify(input.author)}`,
    "--categories <Category,...>",
    "--tags <tag,...>",
    `--v25-root ${input.v25Root}`,
    `--attempt-root ${input.attemptRoot}`,
    `--source-git-sha ${input.sourceGitSha}`,
    `--candidate-id ${input.candidate.candidateId}`,
    `--manifest-digest ${input.candidate.manifestDigest}`,
    `--review-id ${input.reviewId}`,
    `--qc-round-id ${input.qcRoundId}`,
    `--expected-book-revision ${input.bookRevision - 1}`,
    "--resume-unfinished-release",
  ].join(" ");
}

/** The packageId a `--promote-local` journal record carries. There is no package —
 *  that is the whole point of the record — and the field is documented as evidence
 *  rather than a constraint (a resumed release re-assembles and mints a fresh id),
 *  so it says so instead of inventing a plausible-looking id. */
export const PROMOTE_LOCAL_PACKAGE_ID = "NOT_PRODUCED";

/**
 * File the release-journal record a `--promote-local` promotion owes.
 *
 * The pointer HAS been committed and nothing is published — the journal's
 * `pointer-committed` state, verbatim. Without it the printed follow-up command
 * dead-ends in "CURRENT names this candidate, but prior release intent cannot be
 * proven; package write suppressed", because nothing on disk could ever prove it.
 *
 * Rooted at the run's own `--v25-root`, the same root the CLI candidate release
 * journals into, so the record the resume reads is the record this wrote.
 * Best-effort by design: a journal that cannot be written must not fail a
 * promotion that already succeeded, and the caller reports it as a detail.
 */
export function fileLocalPromotionJournal(input: Readonly<{
  v25Root: string;
  bookId: string;
  candidate: CandidateIdentity;
  reviewId: string;
  qcRoundId: string;
  bookRevision: number;
  promotedAt: string;
}>): { ok: true } | { ok: false; error: string } {
  try {
    const journal = createFileReleaseJournal({ stateRoot: input.v25Root });
    journal.write({
      bookId: input.bookId,
      txId: `promote-local-${input.candidate.candidateId}-r${input.bookRevision}`,
      state: "pointer-committed",
      candidateId: input.candidate.candidateId,
      manifestDigest: input.candidate.manifestDigest,
      reviewId: input.reviewId,
      qcRoundId: input.qcRoundId,
      expectedBookRevision: input.bookRevision - 1,
      targetBookRevision: input.bookRevision,
      promotedAt: input.promotedAt,
      packageId: PROMOTE_LOCAL_PACKAGE_ID,
      detail: "--promote-local advanced the CURRENT pointer and produced no reader package; finish with --resume-unfinished-release",
    });
    return { ok: true };
  } catch (cause) {
    return { ok: false, error: cause instanceof Error ? cause.message : String(cause) };
  }
}

function expectedRevisionFromEvents(events: readonly BookRunEvent[]): Result<number> {
  const values = events
    .filter((event) => event.phase === "intake" && event.status === "COMPLETED")
    .map((event) => /^expectedBookRevision=(\d+)$/.exec(event.detail ?? "")?.[1])
    .filter((value): value is string => value !== undefined)
    .map(Number);
  if (values.length === 0 || values.some((value) => !Number.isSafeInteger(value))) {
    return failed("BOOK_RUN_RESUME_UNAVAILABLE", "resume lacks durable original pointer revision");
  }
  if (new Set(values).size !== 1) {
    return failed("BOOK_RUN_RESUME_UNAVAILABLE", "resume pointer revision evidence conflicts");
  }
  return { ok: true, value: values[0] };
}

function completedResearchSeed(events: readonly BookRunEvent[]): Result<CandidateIdentity | null> {
  const researchCompleted = events.some((event) => event.phase === "research" && event.status === "COMPLETED");
  const seeds = events
    .filter((event) => event.phase === "seed" && event.status === "COMPLETED")
    .map((event) => event.candidate)
    .filter((candidate): candidate is CandidateIdentity => candidate !== undefined);
  if (!researchCompleted && seeds.length === 0) return { ok: true, value: null };
  if (!researchCompleted || seeds.length === 0) {
    return failed("BOOK_RUN_RESUME_UNAVAILABLE", "resume research and seed completion evidence is incomplete");
  }
  if (seeds.some((candidate) => !sameIdentity(candidate, seeds[0]))) {
    return failed("BOOK_RUN_RESUME_UNAVAILABLE", "resume seed completion evidence conflicts");
  }
  return { ok: true, value: seeds[0] };
}

/** The durable compiled-candidate identity a resumed run's compile phase already
 *  COMPLETED (task 11ab / finding 37), or null when no compile has completed. The
 *  compile COMPLETED event carries the compiled child candidate's identity; a run
 *  resumed after that event must rehydrate that exact candidate rather than re-derive
 *  compile state from the base compiler run (terminal FAILED, retryable) and enter the
 *  operator-grant scan, which fail-closes on the COMPLETED slot. Mirror of
 *  completedResearchSeed. */
function completedCompileCandidate(events: readonly BookRunEvent[]): Result<CandidateIdentity | null> {
  const candidates = events
    .filter((event) => event.phase === "compile" && event.status === "COMPLETED")
    .map((event) => event.candidate)
    .filter((candidate): candidate is CandidateIdentity => candidate !== undefined);
  if (candidates.length === 0) return { ok: true, value: null };
  if (candidates.some((candidate) => !sameIdentity(candidate, candidates[0]))) {
    return failed("BOOK_RUN_RESUME_UNAVAILABLE", "resume compile completion evidence conflicts");
  }
  return { ok: true, value: candidates[0] };
}

/** Exported for the R-001 classification pin: the retryable set is a policy
 *  decision worth asserting directly, not only through a multi-hundred-line
 *  resume fixture. */
export function retryableCompilerFailure(detail: string | undefined): boolean {
  return detail !== undefined && RETRYABLE_COMPILER_FAILURES.some((prefix) => detail.startsWith(prefix));
}

function hasRetryableCompilerFailureEvent(events: readonly BookRunEvent[]): boolean {
  return events.some((event) =>
    event.phase === "compile" && event.status === "FAILED" && retryableCompilerFailure(event.detail));
}

function canonicalUtc(value: string): value is UtcIso {
  const milliseconds = Date.parse(value);
  return Number.isFinite(milliseconds) && new Date(milliseconds).toISOString() === value;
}

function safeNow(clock: ChapterFlowClock): Result<UtcIso> {
  try {
    const value = clock.now();
    return canonicalUtc(value)
      ? { ok: true, value }
      : failed("BOOK_RUN_CLOCK_INVALID", "clock must return canonical UTC ISO time");
  } catch {
    return failed("BOOK_RUN_CLOCK_INVALID", "clock failed");
  }
}

function derivedId(prefix: string, runId: string): string {
  return `${prefix}-${createHash("sha256").update(runId).digest("hex").slice(0, 32)}`;
}

function reviewDefinition(input: Readonly<{
  bookId: string;
  runId: string;
  sourceGitSha: string;
  candidate: CandidateSnapshot;
  createdAt: UtcIso;
}>): RunDefinition {
  return {
    schemaVersion: "1",
    bookId: input.bookId,
    runId: input.runId,
    commandId: "canonical-review",
    sourceGitSha: input.sourceGitSha,
    requiredStages: [REVIEW_STAGE],
    requiredInventory: input.candidate.manifest.entries.map(({ kind, logicalPath, mediaType }) => ({
      kind,
      logicalPath,
      mediaType,
    })),
    inputCandidate: identity(input.candidate),
    attemptLimits: { run: 1, byStage: { [REVIEW_STAGE]: 1 } },
    createdAt: input.createdAt,
  };
}

/** Total quiz questions across the candidate's chapters. The fresh-qc answer-key
 *  judge runs one model call per question, so this sizes the judge run's attempt
 *  capacity. Malformed chapters are surfaced as blockers by CandidateQcEvaluator;
 *  they contribute zero here and never under-block. */
export function countQuizQuestions(candidate: CandidateSnapshot): number {
  let total = 0;
  for (const file of candidate.files) {
    if (file.kind !== "CHAPTER") continue;
    try {
      const chapter = JSON.parse(Buffer.from(file.bytes).toString("utf8")) as { quiz?: { questions?: unknown } };
      if (Array.isArray(chapter.quiz?.questions)) total += (chapter.quiz.questions as unknown[]).length;
    } catch {
      // ignore — deterministic QC inputs gate re-parses and blocks malformed chapters
    }
  }
  return total;
}

/** Run definition for the dedicated fresh-qc answer-key-judge run. The judge is
 *  per-question model work the gateway admits against run-state, so it needs a
 *  live run whose stage capacity covers every quiz question. */
export function freshQcRunDefinition(input: Readonly<{
  bookId: string;
  runId: string;
  sourceGitSha: string;
  candidate: CandidateSnapshot;
  createdAt: UtcIso;
  questionCount: number;
}>): RunDefinition {
  // One admission per judge ATTEMPT, not per question: each question gets up to
  // QUIZ_JUDGE_MAX_ATTEMPTS distinct attempt ids (a transient timeout or invalid
  // JSON shape from one single-shot call was previously committed as a durable
  // CANDIDATE_QC_QUIZ_JUDGE_ERROR blocker that repair rejects as compiler-owned
  // and resume replays forever — a permanent dead end from one flaky call).
  const capacity = Math.max(1, input.questionCount * QUIZ_JUDGE_MAX_ATTEMPTS);
  return {
    schemaVersion: "1",
    bookId: input.bookId,
    runId: input.runId,
    commandId: "fresh-qc",
    sourceGitSha: input.sourceGitSha,
    requiredStages: [FRESH_QC_STAGE],
    requiredInventory: input.candidate.manifest.entries.map(({ kind, logicalPath, mediaType }) => ({
      kind,
      logicalPath,
      mediaType,
    })),
    inputCandidate: identity(input.candidate),
    attemptLimits: { run: capacity, byStage: { [FRESH_QC_STAGE]: capacity } },
    createdAt: input.createdAt,
  };
}

function uncertainReviewAttempt(snapshot: RunSnapshot): boolean {
  return snapshot.attempts.some((attempt) =>
    attempt.status === "ACTIVE" || attempt.status === "STALE" || attempt.status === "UNKNOWN");
}

function exactReviewAttempt(
  snapshot: RunSnapshot,
  attemptId: string,
  outcome: CanonicalReviewResult["outcome"],
): boolean {
  if (snapshot.attempts.length !== 1 || snapshot.attempts[0].admission.attemptId !== attemptId) return false;
  if (outcome === "PASS" || outcome === "FAIL") return snapshot.attempts[0].status === "SUCCEEDED";
  return ["SUCCEEDED", "FAILED", "TIMED_OUT", "CANCELLED"].includes(snapshot.attempts[0].status);
}

async function exactReview(
  dependencies: BookRunApplicationDependencies,
  input: Readonly<{
    bookId: string;
    sourceGitSha: string;
    parentRunId: string;
    candidate: CandidateSnapshot;
    attemptRoot: string;
    signal: AbortSignal;
  }>,
): Promise<Result<CanonicalReviewResult>> {
  const runId = derivedId("review-run", input.parentRunId);
  const reviewId = derivedId("review", input.parentRunId);
  const attemptId = derivedId("review-attempt", input.parentRunId);
  const observedAt = safeNow(dependencies.clock);
  if (!observedAt.ok) return observedAt;
  let createdAt = observedAt.value;
  const prior = await dependencies.runStore.readRun(input.bookId, runId, observedAt.value);
  if (prior.ok) createdAt = prior.value.definition.createdAt;
  else if (prior.error.code !== "NOT_FOUND") return failed("BOOK_RUN_REVIEW_UNAVAILABLE", prior.error.message);
  const definition = reviewDefinition({
    bookId: input.bookId,
    runId,
    sourceGitSha: input.sourceGitSha,
    candidate: input.candidate,
    createdAt,
  });
  const created = await dependencies.runStore.createRun(definition);
  if (!created.ok) return failed("BOOK_RUN_REVIEW_UNAVAILABLE", `${created.error.code}:${created.error.message}`);
  if (created.value.status === "CANCEL_REQUESTED" || created.value.status === "CANCELLED") {
    return failed("BOOK_RUN_CANCELLED", "canonical review run is cancelled");
  }
  if (created.value.status === "FAILED") return failed("BOOK_RUN_REVIEW_UNAVAILABLE", "canonical review run is terminal FAILED");

  const stored = await dependencies.reviews.get(input.bookId, reviewId);
  if (created.value.status === "COMPLETED") {
    if (!stored.ok || !sameIdentity(stored.value.candidate, identity(input.candidate))
      || stored.value.reviewId !== reviewId
      || !exactReviewAttempt(created.value, attemptId, stored.value.outcome)) {
      return failed("BOOK_RUN_REVIEW_UNAVAILABLE", "completed review run lacks exact stored review");
    }
    return stored;
  }
  if (uncertainReviewAttempt(created.value)) {
    return failed("BOOK_RUN_REVIEW_ATTEMPT_UNCERTAIN", "canonical review attempt is unsettled; replay refused");
  }
  if (created.value.attempts.length > 0 && !stored.ok) {
    return failed("BOOK_RUN_REVIEW_ATTEMPT_UNCERTAIN", "settled review call lacks durable review; replay refused");
  }
  if (stored.ok && !exactReviewAttempt(created.value, attemptId, stored.value.outcome)) {
    return failed("BOOK_RUN_REVIEW_MISMATCH", "stored canonical review lacks its exact settled model attempt");
  }

  let review: Result<CanonicalReviewResult>;
  if (stored.ok) {
    review = stored;
  } else if (stored.error.code === "REVIEW_NOT_FOUND") {
    if (input.signal.aborted) return failed("BOOK_RUN_CANCELLED", "cancelled before canonical review");
    await mkdir(input.attemptRoot, { recursive: true });
    review = await dependencies.reviews.reviewCanonical({
      reviewId,
      candidate: input.candidate,
      taskContext: {
        bookId: input.bookId,
        runId,
        attemptId,
        stageId: REVIEW_STAGE,
        operationId: REVIEW_STAGE,
        workDir: input.attemptRoot,
        signal: input.signal,
      },
    });
  } else {
    return failed("BOOK_RUN_REVIEW_UNAVAILABLE", stored.error.message);
  }
  if (!review.ok) return review;
  if (!sameIdentity(review.value.candidate, identity(input.candidate)) || review.value.reviewId !== reviewId) {
    return failed("BOOK_RUN_REVIEW_MISMATCH", "canonical review does not bind exact compiled candidate");
  }

  const liveAt = safeNow(dependencies.clock);
  if (!liveAt.ok) return liveAt;
  const live = await dependencies.runStore.readRun(input.bookId, runId, liveAt.value);
  if (!live.ok || uncertainReviewAttempt(live.value)) {
    return failed("BOOK_RUN_REVIEW_ATTEMPT_UNCERTAIN", "canonical review attempt terminal readback failed");
  }
  if (!exactReviewAttempt(live.value, attemptId, review.value.outcome)) {
    return failed("BOOK_RUN_REVIEW_ATTEMPT_UNCERTAIN", "canonical review lacks exact settled attempt readback");
  }
  const checkpointAt = safeNow(dependencies.clock);
  if (!checkpointAt.ok) return checkpointAt;
  const checkpoint = await dependencies.stageCoordinator.checkpoint({
    schemaVersion: "1",
    bookId: input.bookId,
    runId,
    stageId: REVIEW_STAGE,
    status: "COMPLETED",
    attemptIds: live.value.attempts.map((attempt) => attempt.admission.attemptId),
    candidate: identity(input.candidate),
    completedAt: checkpointAt.value,
  });
  if (!checkpoint.ok) return failed("BOOK_RUN_REVIEW_UNAVAILABLE", `${checkpoint.error.code}:${checkpoint.error.message}`);
  const finishedAt = safeNow(dependencies.clock);
  if (!finishedAt.ok) return finishedAt;
  const finished = await dependencies.runStore.finishRun({
    bookId: input.bookId,
    runId,
    status: "COMPLETED",
    finishedAt: finishedAt.value,
  });
  if (!finished.ok) return failed("BOOK_RUN_REVIEW_UNAVAILABLE", `${finished.error.code}:${finished.error.message}`);
  const verifiedAt = safeNow(dependencies.clock);
  if (!verifiedAt.ok) return verifiedAt;
  const verified = await dependencies.runStore.readRun(input.bookId, runId, verifiedAt.value);
  return verified.ok && verified.value.status === "COMPLETED"
    ? review
    : failed("BOOK_RUN_REVIEW_UNAVAILABLE", "canonical review terminal readback failed");
}

export class BookRunApplicationService {
  readonly #dependencies: BookRunApplicationDependencies;

  constructor(dependencies: BookRunApplicationDependencies) {
    this.#dependencies = dependencies;
  }

  async #event(
    runId: string,
    bookId: string,
    phase: BookRunPhase,
    status: BookRunEvent["status"],
    detail?: string,
    candidate?: CandidateIdentity,
  ): Promise<Result<void>> {
    const at = safeNow(this.#dependencies.clock);
    if (!at.ok) return at;
    try {
      await this.#dependencies.events.append({
        schemaVersion: "1",
        runId,
        bookId,
        phase,
        status,
        at: at.value,
        ...(detail === undefined ? {} : { detail }),
        ...(candidate === undefined ? {} : { candidate }),
      });
      return { ok: true, value: undefined };
    } catch (cause) {
      return failed("BOOK_RUN_EVENT_WRITE_FAILED", (cause as Error).message);
    }
  }

  /** True iff a research intake bound to a run OTHER than the resumed run is a
   *  legitimate successor-recovery of that exact run. Fail-closed source-integrity
   *  boundary (task 11e): the successor is accepted only when BOTH hold —
   *   1. the port attests it recovered from the exact resumed run
   *      (`recoveredFromRunId === predecessorRunId`), on a resume marked resumed, and
   *   2. that successor run is a genuine COMPLETED run in THIS book's durable
   *      run-state (same bookId).
   *  Both facts are read from the pipeline's own durable journal — run-state and
   *  the port's structured attestation — never from the intake artifacts, so a
   *  foreign research run (different book/root) or a fabricated provenance claim
   *  can never be intaken. */
  async #successorChainBindsRun(
    bookId: string,
    predecessorRunId: string,
    intake: ResearchCandidateApplicationResult,
  ): Promise<boolean> {
    if (intake.resumed !== true) return false;
    if (intake.recoveredFromRunId !== predecessorRunId) return false;
    const observedAt = safeNow(this.#dependencies.clock);
    if (!observedAt.ok) return false;
    const successor = await this.#dependencies.runStore.readRun(bookId, intake.intakeRunId, observedAt.value);
    if (!successor.ok) return false;
    return successor.value.status === "COMPLETED" && successor.value.definition.bookId === bookId;
  }

  /** Post-recovery resume rehydrate (task 11g / finding 10). Once durable
   *  research+seed COMPLETED events exist for the resumed run, the research phase
   *  is DONE and MUST NOT be re-run: re-invoking the port would re-read the
   *  terminal-FAILED predecessor and mint a SECOND successor whose candidate id
   *  diverges from the durable seed, fail-closing at BOOK_RUN_RESEARCH_MISMATCH.
   *  Instead, rehydrate the exact durable seed candidate from the candidate store
   *  and reconstruct the compiler inputs from its own chapter index. Fail closed —
   *  never silently re-research — when the recorded seed candidate is unavailable
   *  or its manifest digest does not match the durable seed identity. */
  async #rehydrateDurableSeed(
    bookId: string,
    durableSeed: CandidateIdentity,
  ): Promise<Result<Readonly<{
    candidate: CandidateIdentity;
    indexLogicalPath: "inputs/chapter-index.json";
    sectionTaskContextLogicalPath: "inputs/compiler-section-task-context.json";
    sources: readonly ResearchCandidateSourceMapping[];
  }>>> {
    const opened = await this.#dependencies.contentReader.open({
      bookId,
      selector: { kind: "CANDIDATE", candidateId: durableSeed.candidateId },
    });
    if (!opened.ok) {
      return failed("BOOK_RUN_SEED_REHYDRATE_FAILED", `durable seed candidate ${durableSeed.candidateId} is unavailable: ${opened.error.message}`);
    }
    if (opened.value.manifest.manifestDigest !== durableSeed.manifestDigest) {
      return failed("BOOK_RUN_SEED_REHYDRATE_FAILED", "durable seed candidate digest does not match recorded seed identity");
    }
    const indexFile = opened.value.files.find((file) => file.logicalPath === "inputs/chapter-index.json");
    if (!indexFile) {
      return failed("BOOK_RUN_SEED_REHYDRATE_FAILED", "durable seed candidate lacks chapter index");
    }
    let sources: readonly ResearchCandidateSourceMapping[];
    try {
      sources = researchSourcesFromChapterIndex(indexFile.bytes);
    } catch (cause) {
      return failed("BOOK_RUN_SEED_REHYDRATE_FAILED", (cause as Error).message);
    }
    return {
      ok: true,
      value: Object.freeze({
        candidate: {
          candidateId: opened.value.manifest.candidateId,
          manifestDigest: opened.value.manifest.manifestDigest,
        },
        indexLogicalPath: "inputs/chapter-index.json",
        sectionTaskContextLogicalPath: "inputs/compiler-section-task-context.json",
        sources,
      }),
    };
  }

  /** Post-recovery resume rehydrate for a durably-COMPLETED compile (task 11ab /
   *  finding 37). Once a durable compile COMPLETED event exists for the resumed run,
   *  compile is DONE and MUST NOT be re-derived from the base compiler run: that run
   *  is terminal FAILED (retryable) but compile actually SUCCEEDED via an operator
   *  slot, so re-entering the exhausted/grant scan fail-closes on the COMPLETED slot
   *  ("...is COMPLETED, not re-grantable" / RETRY_EXHAUSTED). Instead, rehydrate the
   *  exact staged compiled candidate the event recorded, digest-validated against the
   *  candidate store. Fail closed — never silently re-compile — when that candidate is
   *  unavailable or its manifest digest does not match the durable compile identity.
   *  Mirror of #rehydrateDurableSeed. */
  async #rehydrateDurableCompile(
    bookId: string,
    durableCompiled: CandidateIdentity,
  ): Promise<Result<CandidateSnapshot>> {
    const opened = await this.#dependencies.contentReader.open({
      bookId,
      selector: { kind: "CANDIDATE", candidateId: durableCompiled.candidateId },
    });
    if (!opened.ok) {
      return failed("BOOK_RUN_COMPILE_REHYDRATE_FAILED", `durable compiled candidate ${durableCompiled.candidateId} is unavailable: ${opened.error.message}`);
    }
    if (opened.value.manifest.manifestDigest !== durableCompiled.manifestDigest) {
      return failed("BOOK_RUN_COMPILE_REHYDRATE_FAILED", "durable compiled candidate digest does not match recorded compile identity");
    }
    return { ok: true, value: opened.value };
  }

  /** Allocate the next operator-authorized compile control run past an exhausted
   *  deterministic retry budget (task 11i / finding 12). Enumerates the
   *  `compiler-operator-retry-{n}-run` ids for the resumed run and grants the first
   *  slot that is not already a terminal FAILED run: every lower-numbered operator
   *  attempt has already FAILED, so exactly one fresh attempt is minted per flagged
   *  resume. `priorExhaustedAttempts` counts the durable failures the operator is
   *  authorizing past — the base compile plus the single deterministic retry
   *  (2) plus each prior operator attempt (`operatorAttempt - 1`).
   *
   *  A RUNNING operator-retry run is the FINDING-25 wedge: an earlier grant was
   *  admitted (run RUNNING) but crashed INSIDE the grant (e.g. ENOSPC at the
   *  `.writer.lock` mkdir) before its section attempt could settle, leaving a
   *  durably RUNNING run with an admitted-unsettled attempt. Failing closed on it
   *  wedges the book-run forever. Under operator consent (`reconcileUnsettled`) such
   *  a slot is instead returned as a `RECONCILE_WEDGED` directive: the caller resumes
   *  THAT run through the compiler resume+reconcile machinery (task 11c), which
   *  settles the unsettled attempt ABANDONED with the RECONCILED marker and drives the
   *  crashed run to terminal FAILED. Per-invocation consent (task 11i) is spent
   *  un-wedging; the NEXT slot is granted only on a further explicit flagged resume —
   *  mirroring how a RUNNING base compiler run reconciles-then-requires-resume, never a
   *  silent same-invocation loop. Any OTHER non-FAILED state (a lost race, a
   *  cancellation, or a partially-written run), and a RUNNING slot WITHOUT consent,
   *  still fail closed: such a run must never be silently re-granted. */
  async #grantOperatorCompileRetry(
    bookId: string,
    runId: string,
    observedAt: UtcIso,
    reconcileUnsettled: boolean,
  ): Promise<Result<Readonly<
    | {
        kind: "GRANT";
        compilerRunId: string;
        attemptSubdir: string;
        operatorAttempt: number;
        priorExhaustedAttempts: number;
      }
    | {
        kind: "RECONCILE_WEDGED";
        compilerRunId: string;
        attemptSubdir: string;
        operatorAttempt: number;
      }
  >>> {
    for (let operatorAttempt = 1; ; operatorAttempt += 1) {
      const operatorRunId = derivedId(`compiler-operator-retry-${operatorAttempt}-run`, runId);
      const existing = await this.#dependencies.runStore.readRun(bookId, operatorRunId, observedAt);
      if (existing.ok) {
        if (existing.value.status === "FAILED") continue;
        if (existing.value.status === "RUNNING" && reconcileUnsettled) {
          return {
            ok: true,
            value: Object.freeze({
              kind: "RECONCILE_WEDGED" as const,
              compilerRunId: operatorRunId,
              attemptSubdir: `compiler-operator-retry-${operatorAttempt}`,
              operatorAttempt,
            }),
          };
        }
        return failed(
          "BOOK_RUN_COMPILER_RETRY_BLOCKED",
          `operator compile retry run ${operatorRunId} is ${existing.value.status}, not re-grantable`,
        );
      }
      if (existing.error.code !== "NOT_FOUND") {
        return failed("BOOK_RUN_COMPILER_UNAVAILABLE", existing.error.message);
      }
      return {
        ok: true,
        value: Object.freeze({
          kind: "GRANT" as const,
          compilerRunId: operatorRunId,
          attemptSubdir: `compiler-operator-retry-${operatorAttempt}`,
          operatorAttempt,
          // base compile + single deterministic retry (2) + prior operator failures.
          priorExhaustedAttempts: operatorAttempt + 1,
        }),
      };
    }
  }

  /**
   * ONE ordinal walk, shared by BOTH repair lanes.
   *
   * Every id a repair transition owns — the repair run, the successor candidate,
   * its canonical review, its fresh QC round, the repair record, the attempt
   * root — derives from ONE label, so an ordinal is a self-contained transition
   * that never collides with a predecessor's durable artifacts. (The port binds
   * a stored successor to `manifest.createdByRunId === repairRunId`, so a
   * successor written under ordinal 1 is not reconcilable under ordinal 2 —
   * scoping only the run id would trade one wedge for another.) Ordinal 1 keeps
   * each lane's historical label EXACTLY, so a book already mid-repair resumes
   * onto its own durable ids.
   *
   * SPENT is what the walk skips, and the lane says what spent means:
   *   NOT_FOUND         free ordinal; execute here.
   *   FAILED            SPENT — unless the lane supplies forgivableTerminalReason
   *                     and the run's durable terminal reason matches (infra
   *                     loss, e.g. REPAIR_REVIEW_ERROR): such an ordinal is
   *                     walked past WITHOUT consuming the spend budget, bounded
   *                     by MAX_FORGIVEN_INFRA_ORDINALS. Genuinely-failed runs:
   *                     SPENT in both lanes. The port refuses a run that is
   *                     already terminal and non-COMPLETED (REPAIR_RUN_TERMINAL /
   *                     REVIEW_REPAIR_RUN_TERMINAL), so re-deriving a dead id is
   *                     the wedge itself: same id, same tombstone, forever.
   *   COMPLETED         NEVER walked past. The ordinal is the answer: the port
   *                     short-circuits to its durable successor with ZERO new
   *                     model calls. A COMPLETED-but-UNSUCCESSFUL qc-repair is
   *                     NOT spent — it is the DESIGNED diagnosis escalation:
   *                     the book-run answers REPAIR_DIAGNOSIS_REQUIRED naming
   *                     the ordinal's own failed round, and the forward path is
   *                     qc-diagnose then a CHAINED repair of that successor
   *                     (which is exactly when the port's priorUnsuccessful
   *                     gate demands the diagnosisId). An earlier draft of this
   *                     walk skipped such ordinals; that minted a fresh repair
   *                     of the ORIGINAL candidate with NO diagnosis — bypassing
   *                     the gate and orphaning the successor — and was rejected
   *                     in adversarial review.
   *   RUNNING           the port owns resume/uncertainty (settled-but-unfinished
   *                     reconciles, unsettled stays fail-closed).
   *   CANCEL_REQUESTED
   *   CANCELLED         OPERATOR INTENT. Never walked past — the port answers
   *                     REPAIR_CANCELLED / REVIEW_REPAIR_CANCELLED.
   * A run-state read that fails for any reason other than NOT_FOUND fails
   * closed: an ordinal whose state cannot be established is never treated as
   * spent OR as free.
   *
   * Exhaustion is NOT a pass — it fails closed with the ceiling named.
   */
  async #chooseLaneOrdinal(walk: Readonly<{
    lane: string;
    errorCode: string;
    bookId: string;
    runId: string;
    observedAt: UtcIso;
    firstOrdinal: number;
    maxOrdinal: number;
    label: (ordinal: number) => string;
    /**
     * A FAILED ordinal whose TERMINAL REASON satisfies this predicate was lost to
     * INFRASTRUCTURE, not to a verdict about the book (see
     * `isRepairReviewErrorTerminalReason`). Such an ordinal is still walked past —
     * run state is terminal and a dead run id can never be re-entered — but it
     * EXTENDS the walk by one ordinal instead of consuming one of the lane's
     * `maxOrdinal` repair rounds, up to `MAX_FORGIVEN_INFRA_ORDINALS`.
     *
     * Absent = today's behaviour exactly: every FAILED ordinal is spent.
     */
    forgivableTerminalReason?: (reason: string | undefined) => boolean;
  }>): Promise<Result<Readonly<{ label: string; ordinal: number }>>> {
    /** Ordinals absorbed as infrastructure loss; each one raises the identity
     *  ceiling by one WITHOUT raising the lane's spend budget.
     *
     *  SEEDED FROM DISK, not zero (adversarial review): a chained call passes a
     *  firstOrdinal PAST an infra-lost ordinal, so a walk starting there never
     *  walks the forgiven one — a call-local zero silently lowered the ceiling
     *  back and the earlier forgiveness cost a genuine repair round after all.
     *  Ordinals below firstOrdinal are re-counted from their durable terminal
     *  reasons so forgiveness is a property of the RUN STATE, not of which call
     *  happens to walk it. */
    let forgiven = 0;
    if (walk.forgivableTerminalReason !== undefined) {
      for (let below = 1; below < walk.firstOrdinal && forgiven < MAX_FORGIVEN_INFRA_ORDINALS; below += 1) {
        const priorBelow = await this.#dependencies.runStore.readRun(
          walk.bookId, derivedId(`${walk.label(below)}-run`, walk.runId), walk.observedAt);
        if (priorBelow.ok && priorBelow.value.status === "FAILED"
          && walk.forgivableTerminalReason(priorBelow.value.terminalReason) === true) {
          forgiven += 1;
        }
      }
    }
    for (let ordinal = walk.firstOrdinal; ordinal <= walk.maxOrdinal + forgiven; ordinal += 1) {
      const label = walk.label(ordinal);
      const prior = await this.#dependencies.runStore.readRun(walk.bookId, derivedId(`${label}-run`, walk.runId), walk.observedAt);
      if (!prior.ok) {
        if (prior.error.code !== "NOT_FOUND") {
          return failed(walk.errorCode, `${prior.error.code}:${prior.error.message}`);
        }
        return { ok: true, value: Object.freeze({ label, ordinal }) };
      }
      if (prior.value.status !== "FAILED") {
        return { ok: true, value: Object.freeze({ label, ordinal }) };
      }
      const forgivable = forgiven < MAX_FORGIVEN_INFRA_ORDINALS
        && walk.forgivableTerminalReason?.(prior.value.terminalReason) === true;
      console.error(
        `[book-run] ${walk.lane} book=${walk.bookId} run=${walk.runId} ordinal=${ordinal}/${walk.maxOrdinal + forgiven}`
        + ` action=${forgivable ? "SKIP_INFRA_LOST_REPAIR_RUN" : "SKIP_FAILED_REPAIR_RUN"} label=${label}`
        + (forgivable ? `;forgiven=${forgiven + 1}/${MAX_FORGIVEN_INFRA_ORDINALS};reason=${prior.value.terminalReason ?? ""}` : ""),
      );
      if (forgivable) forgiven += 1;
    }
    return failed(
      walk.errorCode,
      `${walk.lane} successor budget exhausted after ${walk.maxOrdinal} ordinals;`
      + ` every ${walk.lane} ordinal is spent`,
    );
  }

  /**
   * Pick the identity label the QC-FAIL repair executes under.
   *
   * Walks past FAILED ordinals only. A COMPLETED ordinal — successful or not —
   * stops the walk: successful short-circuits to its durable successor, and
   * COMPLETED-but-UNSUCCESSFUL replays into the caller's decision — escalate
   * REPAIR_DIAGNOSIS_REQUIRED naming the ordinal's own failed round when no
   * durable diagnosis exists for it, or CHAIN into the next ordinal when one
   * does (see the ladder at the QC-FAIL call site, and #chooseLaneOrdinal).
   *
   * `firstOrdinal` is how the ladder refuses to re-enter a link it has already
   * driven within this one run: each link advances it past its own ordinal, so
   * a chained repair can only ever move forward, and the cap bounds the chain.
   */
  async #chooseQcRepairLabel(
    bookId: string,
    runId: string,
    observedAt: UtcIso,
    firstOrdinal: number,
    maxOrdinal: number,
  ): Promise<Result<Readonly<{ label: string; ordinal: number }>>> {
    return this.#chooseLaneOrdinal({
      lane: "qc-repair",
      errorCode: "BOOK_RUN_REPAIR_UNAVAILABLE",
      bookId,
      runId,
      observedAt,
      firstOrdinal,
      maxOrdinal,
      label: (ordinal) => (ordinal === 1 ? "repair" : `repair-r${ordinal}`),
      // A repair whose chapter work SUCCEEDED and whose re-review then errored
      // spent no judgment on this book — only infrastructure. It must not cost
      // the book one of its three repair rounds (the live Franklin wedge).
      forgivableTerminalReason: isRepairReviewErrorTerminalReason,
    });
  }

  /**
   * The durable diagnosis, if any, that authorizes chaining a repair of
   * `candidate` after `roundId` failed it.
   *
   * EXACT MATCH ONLY, on both axes the port's own gate checks: a diagnosis for
   * a different round, or for a different candidate, authorizes nothing and is
   * not a near-miss to be tolerated. Returning `undefined` means "the operator
   * has not diagnosed exactly this", which is the escalation the caller owns.
   *
   * AMBIGUITY IS NOT SILENT. An operator can legitimately run qc-diagnose twice
   * on the same round; the LATEST by createdAt wins (ties broken by id, so the
   * choice is deterministic across resumes — the port re-checks the recorded
   * diagnosisId when it replays a COMPLETED link, and a coin-flip here would
   * turn into REPAIR_COMPLETED_MISMATCH), and the count travels back to the
   * caller so the phase log can say a choice was made.
   *
   * READ-ONLY and repeatable: it creates nothing and mutates nothing.
   */
  async #findChainDiagnosis(
    bookId: string,
    roundId: string,
    candidate: CandidateIdentity,
  ): Promise<Result<Readonly<{ diagnosis: QcDiagnosis; matches: number }> | undefined>> {
    const all = await this.#dependencies.diagnoses.listDiagnoses(bookId);
    // A lookup that cannot be established is NOT "no diagnosis": answering
    // absence here would convert an unreadable diagnoses directory into a
    // permanent REPAIR_DIAGNOSIS_REQUIRED the operator can never clear.
    if (!all.ok) return failed("BOOK_RUN_REPAIR_UNAVAILABLE", `${all.error.code}:${all.error.message}`);
    const matches = all.value.filter((entry) => entry.roundId === roundId && sameIdentity(entry.candidate, candidate));
    if (matches.length === 0) return { ok: true, value: undefined };
    const ordered = [...matches].sort((left, right) => (
      left.createdAt === right.createdAt
        ? (left.diagnosisId < right.diagnosisId ? -1 : left.diagnosisId > right.diagnosisId ? 1 : 0)
        : (left.createdAt < right.createdAt ? -1 : 1)
    ));
    // EARLIEST, not latest — replay stability is the whole game. qc-diagnose
    // mints a fresh diagnosis-<uuid> per invocation, so "latest" changes every
    // time the operator re-runs it; a chained ordinal COMPLETED under diagnosis
    // A would then replay with B selected, and the port's identity check
    // (`record.diagnosisId !== request.diagnosisId` -> REPAIR_COMPLETED_MISMATCH)
    // would wedge the run PERMANENTLY. The diagnoses store is append-only, so
    // the earliest (createdAt, diagnosisId) match is the one selection no later
    // qc-diagnose can ever disturb: resume re-derives the identical choice with
    // no dependency on how many times the operator diagnosed. Adversarial review
    // caught latest-selection as exactly this wedge before it merged.
    return { ok: true, value: Object.freeze({ diagnosis: ordered[0], matches: matches.length }) };
  }

  /** Run the deterministic gates + LLM answer-key judge under a dedicated
   *  fresh-qc run, then commit the round. The judge is per-question model work
   *  the gateway admits against run-state, so it needs a live run sized to the
   *  candidate's quiz-question count; the judge's READ_ONLY profile pins its
   *  workDir to the exact pipeline root. */
  async #runFreshQcWithJudge(
    input: BookRunApplicationRequest,
    parentRunId: string,
    candidate: CandidateSnapshot,
    review: CanonicalReviewResult,
    roundId: string,
  ): Promise<Result<QcRoundResult>> {
    const baseJudgeRunId = derivedId("qc-judge-run", parentRunId);
    const observedAt = safeNow(this.#dependencies.clock);
    if (!observedAt.ok) return observedAt;
    // The COMMITTED ROUND is the durable authority, not any judge run's status.
    // The round is committed BEFORE its run is finished COMPLETED (see below), so
    // on resume a present round means the judge's work is durable regardless of
    // run state — return it (and best-effort settle a run a crash left RUNNING).
    const committed = await this.#dependencies.qc.getRound(input.bookId, roundId);
    if (committed.ok) {
      // Settle across the WHOLE successor ladder, not just the base id. Once the
      // walk below has minted a successor, the run that commits the round is
      // `-r2`/`-r3`/… — so a crash between that commit and its finish strands a
      // SUCCESSOR RUNNING, and a base-only settle left it RUNNING forever with
      // the round already durable (the short-circuit above returns before the
      // walk can ever abandon it). Only one ordinal can be RUNNING here: every
      // lower one was driven terminal before the walk moved past it.
      for (let ordinal = 1; ordinal <= MAX_QC_JUDGE_RUNS; ordinal += 1) {
        const ordinalRunId = ordinal === 1 ? baseJudgeRunId : `${baseJudgeRunId}-r${ordinal}`;
        const settled = await this.#dependencies.runStore.readRun(input.bookId, ordinalRunId, observedAt.value);
        if (!settled.ok) break;
        if (settled.value.status !== "RUNNING") continue;
        const settleAt = safeNow(this.#dependencies.clock);
        if (settleAt.ok) {
          await this.#dependencies.runStore.finishRun({
            bookId: input.bookId,
            runId: ordinalRunId,
            status: "COMPLETED",
            finishedAt: settleAt.value,
          });
        }
        break;
      }
      return committed;
    }
    // No committed round: pick the judge run to execute under. A prior judge run
    // that ended terminal WITHOUT committing a round (evaluation error: cancelled
    // signal, retry-exhausted transients, credential expiry — or a crash that
    // left it RUNNING) was previously a permanent wedge: the run id is
    // deterministic, the terminal state is immutable, and resume failed
    // BOOK_RUN_QC_UNAVAILABLE forever one step before promotion. Fresh-qc now has
    // the successor machinery compile (operator-retry slots) and review (the 11ac
    // ERROR successor) already have: walk base, -r2, -r3 … to the first free
    // ordinal, abandoning a RUNNING-with-no-round predecessor as FAILED (only a
    // dead process can own one here — this process has not created its run yet).
    // Each successor id feeds the attempt-id base below, so a re-judge never
    // replays a predecessor's frozen attempt ids into the admission log (which
    // burned the per-question retry budget on MODEL_ATTEMPT_EXISTS collisions).
    // COMPLETED-without-round stays an honest legacy error: that judge already
    // ran to completion and cannot legally re-run.
    let judgeRunId: string | undefined;
    for (let ordinal = 1; ordinal <= MAX_QC_JUDGE_RUNS; ordinal += 1) {
      const candidateRunId = ordinal === 1 ? baseJudgeRunId : `${baseJudgeRunId}-r${ordinal}`;
      const prior = await this.#dependencies.runStore.readRun(input.bookId, candidateRunId, observedAt.value);
      if (!prior.ok) {
        if (prior.error.code !== "NOT_FOUND") return failed("BOOK_RUN_QC_UNAVAILABLE", `${prior.error.code}:${prior.error.message}`);
        judgeRunId = candidateRunId;
        break;
      }
      if (prior.value.status === "COMPLETED") {
        return failed(
          "BOOK_RUN_QC_UNAVAILABLE",
          "fresh-qc judge run is COMPLETED but its round is missing (QC_ROUND_NOT_FOUND) — legacy ordering wedge; the judge cannot legally re-run",
        );
      }
      if (prior.value.status === "RUNNING") {
        // A hard kill mid-judge leaves its per-question attempt ADMITTED with no
        // terminal record, and run-state refuses to close a run that still owns
        // admitted work (UNSETTLED_ATTEMPTS). Abandoning the run WITHOUT first
        // reconciling those attempts is therefore a silent no-op in exactly the
        // crash case this branch exists for: the predecessor stayed RUNNING with
        // a permanently ACTIVE attempt, so every later reader of run-state saw
        // live judge work that no process owns. Settle each unsettled attempt
        // ABANDONED with the RECONCILED_UNSETTLED_ON_RESUME marker first —
        // the same recovery the research port performs (task 11c) — and only
        // then drive the crashed run terminal. reconcileAttempt is a no-op on an
        // already-settled attempt, so a lost race never rewrites a real outcome.
        const abandonAt = safeNow(this.#dependencies.clock);
        // A clock that cannot stamp the abandonment is not a licence to skip it:
        // silently continuing would leave the same phantom RUNNING predecessor.
        if (!abandonAt.ok) return abandonAt;
        for (const attempt of prior.value.attempts) {
          if (attempt.status !== "ACTIVE" && attempt.status !== "STALE") continue;
          const settled = await reconcileAttempt(this.#dependencies.runStore, {
            bookId: input.bookId,
            runId: candidateRunId,
            attemptId: attempt.admission.attemptId,
            outcome: "ABANDONED",
            finishedAt: abandonAt.value,
            detail: RECONCILED_UNSETTLED_ON_RESUME,
          });
          if (!settled.ok && settled.error.code !== "CONFLICT") {
            return failed("BOOK_RUN_QC_UNAVAILABLE", `crashed fresh-qc judge attempt cannot be reconciled: ${settled.error.code}:${settled.error.message}`);
          }
          console.error(
            `[book-run] reconcile phase=${FRESH_QC_STAGE} run=${candidateRunId} attempt=${attempt.admission.attemptId} action=${RECONCILED_UNSETTLED_ON_RESUME}`,
          );
        }
        const abandoned = await this.#dependencies.runStore.finishRun({
          bookId: input.bookId,
          runId: candidateRunId,
          status: "FAILED",
          finishedAt: abandonAt.value,
          reason: "abandoned: resumed with no committed round",
        });
        // Never claim an abandonment that did not happen: a predecessor left
        // RUNNING would be re-read as live work by cancel/doctor/capacity
        // readers, and the successor walk below would keep minting runs past a
        // predecessor nobody ever closes.
        if (!abandoned.ok) {
          return failed("BOOK_RUN_QC_UNAVAILABLE", `crashed fresh-qc judge run cannot be abandoned: ${abandoned.error.code}:${abandoned.error.message}`);
        }
      }
      // FAILED / CANCELLED (including just-abandoned): try the next ordinal.
    }
    if (judgeRunId === undefined) {
      return failed("BOOK_RUN_QC_UNAVAILABLE", `fresh-qc judge successor budget exhausted after ${MAX_QC_JUDGE_RUNS} runs`);
    }
    const created = await this.#dependencies.runStore.createRun(freshQcRunDefinition({
      bookId: input.bookId,
      runId: judgeRunId,
      sourceGitSha: input.sourceGitSha,
      candidate,
      createdAt: observedAt.value,
      questionCount: countQuizQuestions(candidate),
    }));
    if (!created.ok) return failed("BOOK_RUN_QC_UNAVAILABLE", `${created.error.code}:${created.error.message}`);
    if (created.value.status !== "RUNNING") return failed("BOOK_RUN_QC_UNAVAILABLE", "fresh-qc judge run is not RUNNING");
    const evaluation = await this.#dependencies.candidateQc.run({
      candidate,
      canonicalReview: review,
      roundId,
      taskContext: {
        bookId: input.bookId,
        runId: judgeRunId,
        attemptId: derivedId("qc-attempt", judgeRunId),
        stageId: FRESH_QC_STAGE,
        operationId: FRESH_QC_STAGE,
        workDir: this.#dependencies.pipelineRoot,
        signal: input.signal,
      },
    });
    if (!evaluation.ok) {
      const failedAt = safeNow(this.#dependencies.clock);
      if (failedAt.ok) {
        await this.#dependencies.runStore.finishRun({
          bookId: input.bookId,
          runId: judgeRunId,
          // Operator intent stays distinguishable from infrastructure failure in
          // the durable record; both are non-COMPLETED, so the successor walk
          // above re-judges either on the next resume.
          status: evaluation.error.code === "CANDIDATE_QC_JUDGE_CANCELLED" ? "CANCELLED" : "FAILED",
          finishedAt: failedAt.value,
          reason: evaluation.error.code,
        });
      }
      return evaluation;
    }
    // Crash-safe ordering: commit the durable QC round FIRST, finish the judge
    // run COMPLETED second — the same order every other store uses (the review
    // service stores the review before exactReview finishes its run; the repair
    // port commits its round before its run terminal). The previous order
    // finished the run COMPLETED and THEN committed the round, so a crash or a
    // transient commit failure in between left a COMPLETED run with no round —
    // and because the judge is non-deterministic, resume could never legally
    // re-run it: the run was wedged one step before promotion with all its
    // model spend stranded. If the commit fails now, the run stays RUNNING and
    // a resume re-enters cleanly; if the process dies after the commit, resume
    // finds the round and settles the run.
    const round = await this.#dependencies.qc.runFresh({ roundId, candidate, canonicalReview: review, evaluation: evaluation.value });
    if (!round.ok) return round;
    const finishedAt = safeNow(this.#dependencies.clock);
    if (finishedAt.ok) {
      await this.#dependencies.runStore.finishRun({
        bookId: input.bookId,
        runId: judgeRunId,
        status: "COMPLETED",
        finishedAt: finishedAt.value,
      });
    }
    return round;
  }

  async run(input: BookRunApplicationRequest): Promise<Result<BookRunApplicationResult>> {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(input.bookId) || !input.title.trim() || !input.author.trim() || !input.sourceGitSha.trim()) {
      return failed("BOOK_RUN_INPUT_INVALID", "bookId, title, author, and sourceGitSha are required");
    }
    if (!isAbsolute(input.v25Root) || !isAbsolute(input.attemptRoot)) {
      return failed("BOOK_RUN_INPUT_INVALID", "v25Root and attemptRoot must be absolute");
    }
    if (input.maxRepairRounds !== 1) {
      return failed("BOOK_RUN_INPUT_INVALID", "maxRepairRounds must equal 1");
    }
    if (!(input.signal instanceof AbortSignal)) return failed("BOOK_RUN_INPUT_INVALID", "signal must be AbortSignal");
    if (input.researchRunId !== undefined && input.resumeRunId !== undefined) {
      return failed("BOOK_RUN_INPUT_INVALID", "researchRunId and resumeRunId are mutually exclusive");
    }
    // Shape-validate at the INPUT boundary, not just in the research port. The
    // port's check (isSafeResearchRunId, applied at path-resolution time) is the
    // path-traversal guard; this one exists because the value reaches an operator
    // audit line on stderr BEFORE the port ever runs. Without it, a newline-bearing
    // id forges additional "[book-run] …" records in the operator's own log.
    if (input.researchRunId !== undefined && !isSafeResearchRunId(input.researchRunId)) {
      return failed("BOOK_RUN_INPUT_INVALID", "researchRunId must be one opaque path segment: [A-Za-z0-9][A-Za-z0-9._-]{0,127}");
    }
    if (input.signal.aborted) return failed("BOOK_RUN_CANCELLED", "cancelled before intake");

    const runId = input.resumeRunId ?? this.#dependencies.ids.nextRunId();
    let resumedRevision: Result<number> | undefined;
    let priorEvents: readonly BookRunEvent[] = [];
    let durableSeed: CandidateIdentity | null = null;
    if (input.resumeRunId !== undefined) {
      if (this.#dependencies.events.read === undefined) {
        return failed("BOOK_RUN_RESUME_UNAVAILABLE", "durable phase event readback is required for resume");
      }
      try {
        priorEvents = await this.#dependencies.events.read(input.bookId, runId);
        resumedRevision = expectedRevisionFromEvents(priorEvents);
      } catch (cause) {
        return failed("BOOK_RUN_RESUME_UNAVAILABLE", (cause as Error).message);
      }
      if (!resumedRevision.ok) return resumedRevision;
      const seedEvidence = completedResearchSeed(priorEvents);
      if (!seedEvidence.ok) return seedEvidence;
      durableSeed = seedEvidence.value;
    }
    const intakeStarted = await this.#event(runId, input.bookId, "intake", "STARTED");
    if (!intakeStarted.ok) return intakeStarted;
    const pointer = await this.#dependencies.currentPointer.read(input.bookId);
    if (!pointer.ok) {
      await this.#event(runId, input.bookId, "intake", "FAILED", pointer.error.message);
      return pointer;
    }
    if (pointer.value !== null && !input.regen && input.resumeRunId === undefined) {
      const message = "book already has local V4 promotion; pass regen to create a fresh candidate";
      await this.#event(runId, input.bookId, "intake", "FAILED", message, {
        candidateId: pointer.value.candidateId,
        manifestDigest: pointer.value.manifestDigest,
      });
      return failed("BOOK_RUN_ALREADY_PROMOTED", message);
    }
    const expectedBookRevision = resumedRevision !== undefined && resumedRevision.ok
      ? resumedRevision.value
      : pointer.value?.revision ?? 0;
    const intakeCompleted = await this.#event(runId, input.bookId, "intake", "COMPLETED", `expectedBookRevision=${expectedBookRevision}`);
    if (!intakeCompleted.ok) return intakeCompleted;

    const rehydrateSeed = input.resumeRunId !== undefined && durableSeed !== null;
    let intake: Readonly<{
      candidate: CandidateIdentity;
      indexLogicalPath: "inputs/chapter-index.json";
      sectionTaskContextLogicalPath: "inputs/compiler-section-task-context.json";
      sources: readonly ResearchCandidateSourceMapping[];
    }>;
    if (rehydrateSeed && durableSeed !== null) {
      // Research already COMPLETED durably for this run (task 11g / finding 10):
      // do NOT re-invoke the research port — that would mint a divergent second
      // successor and fail-close at RESEARCH_MISMATCH. Rehydrate the exact durable
      // seed candidate from the candidate store instead; the research/seed phase
      // events already exist and are not re-emitted.
      const rehydrated = await this.#rehydrateDurableSeed(input.bookId, durableSeed);
      if (!rehydrated.ok) return rehydrated;
      intake = rehydrated.value;
    } else {
      const researchStarted = await this.#event(runId, input.bookId, "research", "STARTED");
      if (!researchStarted.ok) return researchStarted;
      let researched: ResearchCandidateApplicationResult;
      if (input.researchRunId !== undefined && input.regen) {
        // --regen is overloaded. Split the axes rather than rejecting the pair:
        // regen keeps its BOOK_RUN_ALREADY_PROMOTED bypass (without it the pin
        // would be unusable on any previously-promoted book — precisely the
        // second-repair case F5 exists for), while the research axis belongs to
        // the pin. Never silent.
        console.error(
          `[book-run] research-pin book=${input.bookId} pinned-research-run=${input.researchRunId} regen=true action=REGEN_SUPERSEDES_POINTER_ONLY`,
        );
      }
      try {
        researched = await this.#dependencies.research.run({
          bookId: input.bookId,
          title: input.title,
          author: input.author,
          sourceGitSha: input.sourceGitSha,
          v25Root: input.v25Root,
          attemptRoot: resolve(input.attemptRoot, "research"),
          ...(input.resumeRunId === undefined ? { newRunId: runId } : { resumeRunId: input.resumeRunId }),
          ...(input.researchRunId === undefined ? {} : { researchRunId: input.researchRunId }),
          // The --regen split: a pin owns the research axis, so regen retains
          // only its promotion-pointer meaning (the ALREADY_PROMOTED bypass
          // above). Unpinned behaviour is byte-unchanged.
          forceRefresh: input.researchRunId === undefined && input.regen,
          reconcileUnsettled: input.reconcileUnsettled === true,
          signal: input.signal,
        });
      } catch (cause) {
        const message = (cause as Error).message;
        await this.#event(runId, input.bookId, "research", "FAILED", message);
        return failed("BOOK_RUN_RESEARCH_FAILED", message);
      }
      const boundToCurrentRun = researched.intakeRunId === runId;
      // A successor-recovery intake (finding 8 / task 11d) legitimately returns
      // artifacts bound to a fresh successor control run rather than the resumed
      // run. Accept it ONLY when its durable provenance chains to the exact run we
      // asked to resume: the port attests the predecessor link (recoveredFromRunId)
      // AND that successor run is a genuine COMPLETED run in THIS book's durable
      // run-state. The corroboration is read from run-state — the pipeline's own
      // journal — never from the intake artifacts, so a foreign or forged research
      // run (wrong book/root, or a fabricated provenance claim) can never masquerade
      // as this book-run's research. A single attested hop suffices: every book-run
      // resume presents the original resumed run id, and each recovery mints exactly
      // one successor off it.
      // A --research-run-id pin selects which research BUNDLE the researcher reads
      // and never the control-run bind: it is mutually exclusive with resumeRunId,
      // so a pinned run always presents intakeRunId === runId and can never reach
      // the successor exception below.
      const successorAccepted = !boundToCurrentRun
        && input.resumeRunId !== undefined
        && await this.#successorChainBindsRun(input.bookId, runId, researched);
      if ((!boundToCurrentRun && !successorAccepted) || researched.bookId !== input.bookId) {
        const message = "research intake does not bind exact production run and book";
        await this.#event(runId, input.bookId, "research", "FAILED", message);
        return failed("BOOK_RUN_RESEARCH_MISMATCH", message);
      }
      if (successorAccepted) {
        console.error(
          `[book-run] research-intake-successor book=${input.bookId} resumed-run=${runId} successor-run=${researched.intakeRunId} action=ACCEPT_SUCCESSOR_CHAIN`,
        );
      }
      const researchCompleted = await this.#event(
        runId,
        input.bookId,
        "research",
        "COMPLETED",
        `intakeRunId=${researched.intakeRunId};researchRunId=${researched.researchRunId}${input.researchRunId === undefined ? "" : `;pinnedResearchRunId=${input.researchRunId}`}`,
      );
      if (!researchCompleted.ok) return researchCompleted;
      const seedStarted = await this.#event(runId, input.bookId, "seed", "STARTED");
      if (!seedStarted.ok) return seedStarted;
      const seedCompleted = await this.#event(runId, input.bookId, "seed", "COMPLETED", undefined, researched.candidate);
      if (!seedCompleted.ok) return seedCompleted;
      intake = {
        candidate: researched.candidate,
        indexLogicalPath: researched.indexLogicalPath,
        sectionTaskContextLogicalPath: researched.sectionTaskContextLogicalPath,
        sources: researched.sources,
      };
    }

    const durableCompiled = completedCompileCandidate(priorEvents);
    if (!durableCompiled.ok) return durableCompiled;
    let candidate: CandidateSnapshot;
    if (input.resumeRunId !== undefined && durableCompiled.value !== null) {
      // Compile already COMPLETED durably for this run (task 11ab / finding 37) — via
      // an operator-retry slot whose control run is COMPLETED while the base compiler
      // run is terminal FAILED (retryable). Re-deriving compile state from that base
      // run would enter the exhausted/grant scan, which fail-closes on the COMPLETED
      // operator slot ("...is COMPLETED, not re-grantable" / RETRY_EXHAUSTED). Instead
      // rehydrate the exact staged compiled candidate the durable event recorded,
      // digest-validated against the candidate store; the compile phase events already
      // exist and are NOT re-emitted. Touch neither the compiler nor the grant scan —
      // proceed to the next incomplete stage (review). Mirror of the durable-seed
      // short-circuit (11g).
      const rehydrated = await this.#rehydrateDurableCompile(input.bookId, durableCompiled.value);
      if (!rehydrated.ok) return rehydrated;
      candidate = rehydrated.value;
      console.error(
        `[book-run] compile-rehydrate book=${input.bookId} run=${runId} candidate=${durableCompiled.value.candidateId} action=REHYDRATE_DURABLE_COMPILE`,
      );
    } else {
      const baseCompilerRunId = derivedId("compiler-run", runId);
      let compilerRunId = baseCompilerRunId;
      let compilerAttemptRoot = resolve(input.attemptRoot, "compiler");
      if (input.resumeRunId !== undefined) {
        const observedAt = safeNow(this.#dependencies.clock);
        if (!observedAt.ok) return observedAt;
        const baseCompiler = await this.#dependencies.runStore.readRun(input.bookId, baseCompilerRunId, observedAt.value);
        if (!baseCompiler.ok && baseCompiler.error.code !== "NOT_FOUND") {
          return failed("BOOK_RUN_COMPILER_UNAVAILABLE", baseCompiler.error.message);
        }
        if (
          !baseCompiler.ok
          && priorEvents.some((event) => event.phase === "compile")
        ) {
          return failed("BOOK_RUN_COMPILER_STATE_MISSING", "durable compile event lacks base compiler run state");
        }
        if (
          baseCompiler.ok
          && (baseCompiler.value.status === "CANCEL_REQUESTED" || baseCompiler.value.status === "CANCELLED")
        ) {
          return failed("BOOK_RUN_COMPILER_RETRY_BLOCKED", "cancelled compiler run cannot be restarted");
        }
        if (baseCompiler.ok && baseCompiler.value.status === "FAILED") {
          if (
            !retryableCompilerFailure(baseCompiler.value.terminalReason)
            || !hasRetryableCompilerFailureEvent(priorEvents)
          ) {
            return failed("BOOK_RUN_COMPILER_RETRY_BLOCKED", "compiler failure is not known deterministic retryable state");
          }
          const retryRunId = derivedId("compiler-retry-1-run", runId);
          const retryAt = safeNow(this.#dependencies.clock);
          if (!retryAt.ok) return retryAt;
          const retryCompiler = await this.#dependencies.runStore.readRun(input.bookId, retryRunId, retryAt.value);
          // CANCELLED joins FAILED as a consumed slot. A SIGINT during the
          // deterministic retry — the CLI's own documented cancellation path —
          // leaves the retry run terminal-CANCELLED; resuming it verbatim just
          // makes the compiler port throw MODEL_RUN_CANCELLED on every resume,
          // wedging the book forever (observed live on the Franklin canary).
          // Cancellation stays terminal for THAT run; stepping past it costs the
          // same explicit per-invocation consent as an exhausted retry.
          const retryConsumed = retryCompiler.ok
            && (retryCompiler.value.status === "FAILED"
              || retryCompiler.value.status === "CANCELLED"
              || retryCompiler.value.status === "CANCEL_REQUESTED");
          if (retryConsumed) {
            // The single deterministic compiler retry (service-level, one shot) has
            // already failed. Default (no flag): fail closed, preserving the exhausted
            // contract verbatim. The service-level retry budget cannot tell "failed
            // under a since-fixed defect" from "content genuinely cannot pass", so a
            // resume that survived earlier recovery fixes could otherwise be blocked
            // one stage later forever. An operator resolves that ambiguity explicitly:
            // resuming with --reconcile-unsettled is per-invocation consent for exactly
            // ONE additional compile attempt past the exhausted budget. Each grant
            // mints a distinct operator-retry control run and is durably logged; a
            // further grant requires another explicit flagged resume (no silent loop),
            // and the in-run deterministic retry / MAX_SECTION_ATTEMPTS logic is
            // untouched — this is a resume-boundary decision only.
            if (input.reconcileUnsettled !== true) {
              return failed(
                "BOOK_RUN_COMPILER_RETRY_EXHAUSTED",
                retryCompiler.ok && retryCompiler.value.status === "FAILED"
                  ? "single deterministic compiler retry already failed"
                  : "single deterministic compiler retry was cancelled; resume with --reconcile-unsettled to grant the next compile slot",
              );
            }
            const granted = await this.#grantOperatorCompileRetry(input.bookId, runId, retryAt.value, input.reconcileUnsettled === true);
            if (!granted.ok) return granted;
            compilerRunId = granted.value.compilerRunId;
            compilerAttemptRoot = resolve(input.attemptRoot, granted.value.attemptSubdir);
            if (granted.value.kind === "RECONCILE_WEDGED") {
              // FINDING 25: a prior operator grant crashed INSIDE the grant (e.g. ENOSPC),
              // leaving its control run durably RUNNING with an admitted-unsettled attempt.
              // Resume THAT run through the same compiler resume+reconcile machinery (11c)
              // that un-wedges a crashed base compile: the compile call below settles the
              // unsettled attempt ABANDONED (RECONCILED marker) and drives the crashed run
              // to terminal FAILED, then fails closed. This flagged invocation's consent is
              // spent un-wedging; the operator grants the NEXT slot with a further flagged
              // resume (which then finds this run FAILED and steps past it).
              const authorized = await this.#event(
                runId,
                input.bookId,
                "compile",
                "STARTED",
                `action=OPERATOR_COMPILE_RECONCILE_WEDGED;operatorAttempt=${granted.value.operatorAttempt}`,
              );
              if (!authorized.ok) return authorized;
              console.error(
                `[book-run] operator-compile-reconcile-wedged book=${input.bookId} run=${runId} operatorAttempt=${granted.value.operatorAttempt} wedgedRun=${granted.value.compilerRunId} action=OPERATOR_COMPILE_RECONCILE_WEDGED`,
              );
            } else {
              const authorized = await this.#event(
                runId,
                input.bookId,
                "compile",
                "STARTED",
                `action=OPERATOR_COMPILE_RETRY;priorExhaustedAttempts=${granted.value.priorExhaustedAttempts};operatorAttempt=${granted.value.operatorAttempt}`,
              );
              if (!authorized.ok) return authorized;
              console.error(
                `[book-run] operator-compile-retry book=${input.bookId} run=${runId} operatorAttempt=${granted.value.operatorAttempt} priorExhaustedAttempts=${granted.value.priorExhaustedAttempts} action=OPERATOR_COMPILE_RETRY`,
              );
            }
          } else if (!retryCompiler.ok && retryCompiler.error.code !== "NOT_FOUND") {
            return failed("BOOK_RUN_COMPILER_UNAVAILABLE", retryCompiler.error.message);
          } else {
            compilerRunId = retryRunId;
            compilerAttemptRoot = resolve(input.attemptRoot, "compiler-retry-1");
          }
        }
      }
      const compileStarted = await this.#event(runId, input.bookId, "compile", "STARTED", undefined, intake.candidate);
      if (!compileStarted.ok) return compileStarted;
      let compiled;
      try {
        compiled = await this.#dependencies.compiler.run({
          bookId: input.bookId,
          candidateId: intake.candidate.candidateId,
          manifestDigest: intake.candidate.manifestDigest,
          sourceGitSha: input.sourceGitSha,
          resumeRunId: compilerRunId,
          attemptRoot: compilerAttemptRoot,
          indexLogicalPath: intake.indexLogicalPath,
          sectionTaskContextLogicalPath: intake.sectionTaskContextLogicalPath,
          sources: intake.sources,
          profileId: "attempt-read-json-v1",
          reconcileUnsettled: input.reconcileUnsettled === true,
          signal: input.signal,
        });
      } catch (cause) {
        const message = (cause as Error).message;
        await this.#event(runId, input.bookId, "compile", "FAILED", message, intake.candidate);
        return failed("BOOK_RUN_COMPILER_FAILED", message);
      }
      const selected = await this.#dependencies.contentReader.open({
        bookId: input.bookId,
        selector: { kind: "CANDIDATE", candidateId: compiled.candidateId },
      });
      if (
        !selected.ok
        || selected.value.manifest.manifestDigest !== compiled.manifestDigest
        || compiled.runId !== compilerRunId
        || compiled.runStatus !== "COMPLETED"
        || compiled.candidateId !== this.#dependencies.ids.candidateId(compilerRunId)
        || selected.value.manifest.parentCandidateId !== intake.candidate.candidateId
        || selected.value.manifest.createdByRunId !== compilerRunId
      ) {
        const message = selected.ok ? "compiled candidate digest readback mismatch" : selected.error.message;
        await this.#event(runId, input.bookId, "compile", "FAILED", message);
        return failed("BOOK_RUN_CANDIDATE_MISMATCH", message);
      }
      candidate = selected.value;
      const compileCompleted = await this.#event(runId, input.bookId, "compile", "COMPLETED", `compilerRunId=${compiled.runId}`, identity(candidate));
      if (!compileCompleted.ok) return compileCompleted;
    }

    const reviewStarted = await this.#event(runId, input.bookId, "review", "STARTED", undefined, identity(candidate));
    if (!reviewStarted.ok) return reviewStarted;
    let review = await exactReview(this.#dependencies, {
      bookId: input.bookId,
      sourceGitSha: input.sourceGitSha,
      parentRunId: runId,
      candidate,
      attemptRoot: resolve(input.attemptRoot, "review"),
      signal: input.signal,
    });
    // Task 11ac / finding 38 LAYER B — ERROR-review successor on flagged resume.
    // A stored canonical review whose outcome is ERROR is UNCERTAINTY (a transient
    // reader-lane failure fail-closed the panel), NOT a verdict — yet the exact-single-
    // attempt review run persists it as canonical, so every resume replays the ERROR
    // with ZERO model calls. Under per-invocation operator consent (--reconcile-unsettled)
    // it is superseded EXACTLY ONCE by a fresh full-panel review keyed off a distinct
    // seed (fresh reviewId / run / attempt), mirroring the research (11d) and compile
    // (operator-slot) successor paths. A stored FAIL is deliberately NOT eligible: FAIL is
    // a real verdict repair machinery owns, so `outcome === "ERROR"` gates this exactly.
    // Fresh-QC binds to the review id it is handed, so reassigning `review` to the
    // successor keeps downstream identity coherent. Idempotent on repeated flagged
    // resumes: the successor's own exact-review run replays its stored result model-free.
    if (review.ok && review.value.outcome === "ERROR" && input.reconcileUnsettled === true) {
      const predecessorReviewId = review.value.reviewId;
      const successorStarted = await this.#event(
        runId,
        input.bookId,
        "review",
        "STARTED",
        `action=REVIEW_SUCCESSOR;predecessorReviewId=${predecessorReviewId}`,
        identity(candidate),
      );
      if (!successorStarted.ok) return successorStarted;
      console.error(
        `[book-run] review-successor book=${input.bookId} run=${runId} predecessorReviewId=${predecessorReviewId} action=REVIEW_SUCCESSOR`,
      );
      review = await exactReview(this.#dependencies, {
        bookId: input.bookId,
        sourceGitSha: input.sourceGitSha,
        parentRunId: derivedId("review-successor-1", runId),
        candidate,
        attemptRoot: resolve(input.attemptRoot, "review-successor-1"),
        signal: input.signal,
      });
    }
    // ── Canonical review FAIL -> repair -> RE-REVIEW, bounded ──────────────────
    //
    // A review FAIL used to be TERMINAL here, and that was the convergence
    // blocker: the blind panel names 3-7 precise, reader-decidable
    // contradictions, and the pipeline's only answer was to discard the whole
    // book and recompile. Each recompile is a fresh sample producing DIFFERENT
    // one-off contradictions, so consecutive verdicts shared no blockers and the
    // book never converged.
    //
    // The named blockers now route into the repair machinery, chapter-scoped,
    // and the SUCCESSOR GOES BACK THROUGH THE SAME PANEL. Nothing here rewrites
    // the verdict, lowers a bar, or marks a chapter passed: the loop only ever
    // produces a new candidate, and `exactReview` below is what judges it.
    //
    // BOUNDED, like the compile operator-retry slots: at most
    // `resolveReviewRepairRounds()` rounds (MAX_REVIEW_REPAIR_ROUNDS unless the
    // operator overrides it), each one an event in the durable phase log and a
    // line on stderr. An unbounded review->repair->review loop would be
    // worse than the terminal failure it replaces, so hitting the cap falls
    // straight through to the fail-closed path below with the cap named.
    //
    // IDEMPOTENT ON RESUME: every round's repair-run id, successor candidate id
    // and review id derive deterministically from (runId, ORDINAL). A resumed run
    // re-drives the same identities — the repair port reconciles its COMPLETED
    // run and re-reads its durable successor, and `exactReview` replays the
    // stored verdict — so a crash mid-repair costs zero model calls and can
    // never mint a second successor for the same round.
    //
    // THE ORDINAL IS DURABLE, THE COUNTER IS NOT. `reviewRepairRounds` is a local
    // that resets to 0 on every `run()`, so deriving the label from it made round
    // one ALWAYS "review-repair-1". Once that run had ended FAILED, every later
    // operator round re-created the same dead id and the port answered
    // REVIEW_REPAIR_RUN_TERMINAL — the identical wedge the QC lane had. The label
    // now comes from `#chooseLaneOrdinal`, which reads run-state, so the counter
    // only ever bounds SPEND (the cap) and never names an identity.
    //
    // A COMPLETED ordinal is NOT spent in this lane, and that asymmetry with the
    // QC lane is deliberate. This loop is a CHAIN: round N repairs the successor
    // round N-1 produced, and the panel re-judges it. A COMPLETED ordinal whose
    // re-review FAILED is therefore a link, not a dead end — replaying it re-reads
    // that successor with zero model calls and the loop advances to the NEXT
    // ordinal, which is exactly the forward progress the QC lane had to walk for.
    // Skipping it would discard the accumulated repair and re-repair the original
    // candidate at full model cost on every operator round.
    //
    // Not eligible: a review ERROR (uncertainty, owned by the 11ac successor path
    // above) and a run with no repair port composed (the FAIL stays terminal and
    // says so).
    const reviewRepair = this.#dependencies.repair;
    let reviewRepairRounds = 0;
    /** Where the next round's ordinal walk starts. Advances past every ordinal
     *  this run has already used, so one run never re-enters its own link. */
    let nextReviewRepairOrdinal = 1;
    // Resolved ONCE per run so a mid-run env change cannot move the cap under it.
    const reviewRepairCap = resolveReviewRepairRounds();
    let reviewRepairNote = "";
    while (reviewRepair !== undefined && review.ok && review.value.outcome === "FAIL") {
      if (reviewRepairRounds >= reviewRepairCap) {
        reviewRepairNote = `; unresolved after ${reviewRepairRounds} of ${reviewRepairCap} review-repair round(s) (cap reached)`;
        const capped = await this.#event(
          runId,
          input.bookId,
          "repair",
          "FAILED",
          `action=REVIEW_REPAIR;round=${reviewRepairRounds};cap=${reviewRepairCap};reviewId=${review.value.reviewId}`,
          identity(candidate),
        );
        if (!capped.ok) return capped;
        break;
      }
      const walkAt = safeNow(this.#dependencies.clock);
      if (!walkAt.ok) return walkAt;
      const chosen = await this.#chooseLaneOrdinal({
        lane: "review-repair",
        errorCode: "BOOK_RUN_REPAIR_UNAVAILABLE",
        bookId: input.bookId,
        runId,
        observedAt: walkAt.value,
        firstOrdinal: nextReviewRepairOrdinal,
        maxOrdinal: MAX_REVIEW_REPAIR_ORDINALS,
        label: (ordinal) => `review-repair-${ordinal}`,
      });
      if (!chosen.ok) {
        await this.#event(
          runId,
          input.bookId,
          "repair",
          "FAILED",
          `action=REVIEW_REPAIR;round=${reviewRepairRounds + 1};${chosen.error.code}:${chosen.error.message}`,
          identity(candidate),
        );
        return chosen;
      }
      reviewRepairRounds += 1;
      const ordinal = chosen.value.ordinal;
      nextReviewRepairOrdinal = ordinal + 1;
      const label = chosen.value.label;
      const failedReviewId = review.value.reviewId;
      const blockerCodes = review.value.issues
        .filter((issue) => issue.severity === "BLOCKER")
        .map((issue) => issue.code)
        .join(",");
      const repairStarted = await this.#event(
        runId,
        input.bookId,
        "repair",
        "STARTED",
        `action=REVIEW_REPAIR;round=${reviewRepairRounds};label=${label};failedReviewId=${failedReviewId};blockers=${blockerCodes}`,
        identity(candidate),
      );
      if (!repairStarted.ok) return repairStarted;
      console.error(
        // The RESOLVED cap, not the constant. The loop honours
        // resolveReviewRepairRounds(); interpolating MAX_REVIEW_REPAIR_ROUNDS
        // here printed the frozen default instead — observed under
        // CHAPTERFLOW_REVIEW_REPAIR_ROUNDS=3 as "round=1/2", the one line the
        // operator watches under-reporting the limit it is reporting.
        // The ordinal is printed NEXT TO the round because they legitimately
        // diverge: round is this run's spend against the cap, ordinal is the
        // durable identity, and a spent ordinal left by an earlier operator round
        // pushes the second ahead of the first.
        `[book-run] review-repair book=${input.bookId} run=${runId} round=${reviewRepairRounds}/${reviewRepairCap}`
        + ` ordinal=${ordinal}/${MAX_REVIEW_REPAIR_ORDINALS} label=${label}`
        + ` failedReviewId=${failedReviewId} action=REVIEW_REPAIR`,
      );
      const repairedCandidate = await reviewRepair.runFromReviewFail({
        bookId: input.bookId,
        failedCandidate: identity(candidate),
        failedReviewId,
        successorCandidateId: derivedId(`${label}-candidate`, runId),
        repairRunId: derivedId(`${label}-run`, runId),
        sourceGitSha: input.sourceGitSha,
        attemptRoot: resolve(input.attemptRoot, label),
        signal: input.signal,
      });
      if (!repairedCandidate.ok) {
        await this.#event(
          runId,
          input.bookId,
          "repair",
          "FAILED",
          `action=REVIEW_REPAIR;round=${reviewRepairRounds};${repairedCandidate.error.code}:${repairedCandidate.error.message}`,
          identity(candidate),
        );
        return repairedCandidate;
      }
      if (repairedCandidate.value.replayed) {
        // A replay re-read a COMPLETED ordinal with zero model calls. The spend
        // cap bounds MODEL SPEND, so replays are free: counting them let a
        // resumed run exhaust its cap replaying ordinals 1..cap and die without
        // ever executing fresh work (live: the Franklin S-tier resume replayed
        // 6/6 and never reached ordinal 7). The ordinal walk still advances, so
        // the loop cannot spin on one replayed ordinal, and fresh executions
        // still consume the cap exactly as before.
        reviewRepairRounds -= 1;
      }
      candidate = repairedCandidate.value.successor;
      const repairCompleted = await this.#event(
        runId,
        input.bookId,
        "repair",
        "COMPLETED",
        `action=REVIEW_REPAIR;round=${reviewRepairRounds};failedReviewId=${failedReviewId}`
        + `;chapters=${repairedCandidate.value.targetChapterNumbers.join("|")}`,
        identity(candidate),
      );
      if (!repairCompleted.ok) return repairCompleted;
      const reReviewStarted = await this.#event(
        runId,
        input.bookId,
        "review",
        "STARTED",
        `action=REVIEW_REPAIR_REVIEW;round=${reviewRepairRounds};predecessorReviewId=${failedReviewId}`,
        identity(candidate),
      );
      if (!reReviewStarted.ok) return reReviewStarted;
      review = await exactReview(this.#dependencies, {
        bookId: input.bookId,
        sourceGitSha: input.sourceGitSha,
        parentRunId: derivedId(label, runId),
        candidate,
        attemptRoot: resolve(input.attemptRoot, `${label}-review`),
        signal: input.signal,
      });
    }
    if (!review.ok || review.value.outcome !== "PASS") {
      const message = (review.ok ? `canonical review outcome=${review.value.outcome}` : review.error.message) + reviewRepairNote;
      await this.#event(runId, input.bookId, "review", "FAILED", message, identity(candidate));
      return failed("BOOK_RUN_REVIEW_FAILED", message);
    }
    const reviewCompleted = await this.#event(runId, input.bookId, "review", "COMPLETED", `reviewId=${review.value.reviewId}`, identity(candidate));
    if (!reviewCompleted.ok) return reviewCompleted;

    const qcStarted = await this.#event(runId, input.bookId, "fresh-qc", "STARTED", undefined, identity(candidate));
    if (!qcStarted.ok) return qcStarted;
    let roundId = derivedId("qc", runId);
    let qc: Result<QcRoundResult>;
    if (priorEvents.some((phaseEvent) => phaseEvent.phase === "fresh-qc" && phaseEvent.status === "COMPLETED")) {
      // Resume: reuse the durable QC round. The answer-key judge is
      // non-deterministic, so re-running it would break QC-round idempotency on
      // replay; the committed round is authoritative (mirrors canonical review).
      const stored = await this.#dependencies.qc.getRound(input.bookId, roundId);
      if (!stored.ok) {
        await this.#event(runId, input.bookId, "fresh-qc", "FAILED", stored.error.message, identity(candidate));
        return failed("BOOK_RUN_QC_FAILED", stored.error.message);
      }
      qc = stored;
    } else {
      // Initial: deterministic gates + the LLM answer-key judge, the latter run
      // as per-question model work under a dedicated fresh-qc run, then committed.
      const judged = await this.#runFreshQcWithJudge(input, runId, candidate, review.value, roundId);
      if (!judged.ok) {
        await this.#event(runId, input.bookId, "fresh-qc", "FAILED", judged.error.message, identity(candidate));
        return judged;
      }
      qc = judged;
    }
    if (qc.value.outcome === "ERROR") {
      await this.#event(runId, input.bookId, "fresh-qc", "FAILED", "fresh QC outcome=ERROR", identity(candidate));
      return failed("BOOK_RUN_QC_FAILED", "fresh QC outcome=ERROR");
    }
    const qcCompleted = await this.#event(runId, input.bookId, "fresh-qc", "COMPLETED", `outcome=${qc.value.outcome};roundId=${qc.value.roundId}`, identity(candidate));
    if (!qcCompleted.ok) return qcCompleted;

    if (qc.value.outcome === "FAIL") {
      if (!this.#dependencies.repair) {
        const message = "fresh QC failed and candidate repair is not composed";
        await this.#event(runId, input.bookId, "repair", "FAILED", message, identity(candidate));
        return failed("BOOK_RUN_REPAIR_UNAVAILABLE", message);
      }
      // THE CHAINED QC-REPAIR LADDER.
      //
      // One ordinal is one repair transition: repair the failed candidate, review
      // and re-QC the successor it produces. When that successor's OWN fresh QC
      // still FAILs, the transition is COMPLETED-but-UNSUCCESSFUL, and the walk
      // (#chooseLaneOrdinal) deliberately stops ON it rather than skipping it —
      // skipping would mint a fresh repair of the ORIGINAL candidate with no
      // diagnosis, bypassing the port's `priorUnsuccessful` gate and orphaning
      // the successor.
      //
      // What that gate is FOR is the chain: repair ordinal N's successor, citing
      // the diagnosis the operator produced for ordinal N's own failed round.
      // Until this loop existed nothing could build that request — the book-run
      // escalated REPAIR_DIAGNOSIS_REQUIRED, the operator ran qc-diagnose, and
      // the resulting durable diagnosis had no consumer, so every later operator
      // round got the identical escalation forever (observed on the live canary).
      //
      // So: on COMPLETED-but-UNSUCCESSFUL, look for a durable diagnosis whose
      // roundId is THIS ordinal's own fresh round and whose candidate is THIS
      // ordinal's successor.
      //   none  -> escalate exactly as before, naming that round. Byte-identical
      //            message; the no-diagnosis side is unchanged and pinned.
      //   found -> advance to ordinal N+1 as a CHAINED repair whose
      //            failedCandidate is ordinal N's successor, whose failedRoundId
      //            is ordinal N's fresh round, and which CARRIES the diagnosisId
      //            — so the port's gate fires and is SATISFIED, never bypassed.
      // A diagnosis for a different round or a different candidate matches
      // nothing and therefore chains nothing.
      //
      // BOUNDED by MAX_QC_REPAIR_RUNS through the same walk: each link consumes
      // an ordinal, and exhaustion fails closed with the cap named. IDEMPOTENT:
      // the lookup is a read, and a resume that lands on a COMPLETED link is
      // replayed by the port from its durable artifacts at zero model cost.
      /** Where the next link's ordinal walk starts — never re-enters a link this
       *  run already drove. */
      let nextQcRepairOrdinal = 1;
      // Resolved ONCE per run so a mid-run env change cannot move the budget.
      const qcRepairBudget = resolveQcRepairRuns();
      /** The round + candidate the NEXT repair is aimed at. Starts as the failed
       *  fresh-QC round, then becomes each link's own. */
      let failedRoundId = qc.value.roundId;
      /** Set once the loop is chaining: the diagnosis authorizing the next link. */
      let chain: Readonly<{ diagnosisId: string; predecessorLabel: string; matches: number }> | undefined;
      for (;;) {
        const repairObservedAt = safeNow(this.#dependencies.clock);
        if (!repairObservedAt.ok) return repairObservedAt;
        const repairLabel = await this.#chooseQcRepairLabel(input.bookId, runId, repairObservedAt.value, nextQcRepairOrdinal, qcRepairBudget);
        if (!repairLabel.ok) {
          await this.#event(runId, input.bookId, "repair", "FAILED", repairLabel.error.message, identity(candidate));
          return repairLabel;
        }
        const label = repairLabel.value.label;
        nextQcRepairOrdinal = repairLabel.value.ordinal + 1;
        const repairStarted = await this.#event(
          runId,
          input.bookId,
          "repair",
          "STARTED",
          `failedRoundId=${failedRoundId};label=${label}`
          + (chain === undefined
            ? ""
            : `;diagnosisId=${chain.diagnosisId};predecessorLabel=${chain.predecessorLabel}`
              + (chain.matches > 1 ? `;diagnosisMatches=${chain.matches};diagnosisSelected=EARLIEST_BY_CREATED_AT` : "")),
          identity(candidate),
        );
        if (!repairStarted.ok) return repairStarted;
        const repaired = await this.#dependencies.repair.run({
          bookId: input.bookId,
          failedCandidate: identity(candidate),
          failedRoundId,
          repairId: derivedId(label, runId),
          successorCandidateId: derivedId(`${label}-candidate`, runId),
          reviewId: derivedId(`${label}-review`, runId),
          freshRoundId: derivedId(`${label}-qc`, runId),
          repairRunId: derivedId(`${label}-run`, runId),
          sourceGitSha: input.sourceGitSha,
          attemptRoot: resolve(input.attemptRoot, label),
          signal: input.signal,
          // Only a chained link carries one. The port's gate answers
          // REPAIR_DIAGNOSIS_STALE if it does not match the request's exact
          // round + candidate, and that error is RETURNED, never swallowed into
          // the escalation below: a mismatched diagnosis must be visible.
          ...(chain === undefined ? {} : { diagnosisId: chain.diagnosisId }),
        });
        if (!repaired.ok) {
          await this.#event(runId, input.bookId, "repair", "FAILED", repaired.error.message, identity(candidate));
          return repaired;
        }
        candidate = repaired.value.successor;
        review = { ok: true, value: repaired.value.review };
        qc = { ok: true, value: repaired.value.qc };
        roundId = repaired.value.qc.roundId;
        if (repaired.value.status === "PASS" && repaired.value.qc.outcome === "PASS") {
          const repairCompleted = await this.#event(runId, input.bookId, "repair", "COMPLETED", `roundId=${roundId}`, identity(candidate));
          if (!repairCompleted.ok) return repairCompleted;
          break;
        }
        const diagnosis = await this.#findChainDiagnosis(input.bookId, roundId, identity(candidate));
        if (!diagnosis.ok) {
          await this.#event(runId, input.bookId, "repair", "FAILED", diagnosis.error.message, identity(candidate));
          return diagnosis;
        }
        if (diagnosis.value === undefined) {
          const message = `qc-diagnose ${input.bookId} --round ${repaired.value.qc.roundId} required before another repair`;
          await this.#event(runId, input.bookId, "repair", "FAILED", message, identity(candidate));
          return failed("REPAIR_DIAGNOSIS_REQUIRED", message);
        }
        // NO "repair COMPLETED" event here: this link did not succeed, and the
        // phase log must not claim otherwise. The chain is legible from the NEXT
        // link's STARTED event, which names the diagnosis and the predecessor.
        chain = {
          diagnosisId: diagnosis.value.diagnosis.diagnosisId,
          predecessorLabel: label,
          matches: diagnosis.value.matches,
        };
        failedRoundId = roundId;
      }
    } else {
      const repairSkipped = await this.#event(runId, input.bookId, "repair", "SKIPPED", "fresh QC passed", identity(candidate));
      if (!repairSkipped.ok) return repairSkipped;
    }

    if (!input.promoteLocal) {
      const skipped = await this.#event(runId, input.bookId, "promotion", "SKIPPED", "promoteLocal=false", identity(candidate));
      if (!skipped.ok) return skipped;
      return {
        ok: true,
        value: {
          schemaVersion: "1",
          runId,
          status: "READY",
          candidate: identity(candidate),
          reviewId: review.value.reviewId,
          qcRoundId: roundId,
        },
      };
    }

    const livePointer = await this.#dependencies.currentPointer.read(input.bookId);
    if (!livePointer.ok) {
      await this.#event(runId, input.bookId, "promotion", "FAILED", livePointer.error.message, identity(candidate));
      return failed("BOOK_RUN_PROMOTION_FAILED", livePointer.error.message);
    }
    const liveRevision = livePointer.value?.revision ?? 0;
    if (
      input.resumeRunId !== undefined
      && livePointer.value !== null
      && liveRevision === expectedBookRevision + 1
      && sameIdentity(livePointer.value, identity(candidate))
    ) {
      const current = await this.#dependencies.contentReader.open({
        bookId: input.bookId,
        selector: { kind: "CURRENT" },
      });
      if (
        !current.ok
        || current.value.currentRevision !== liveRevision
        || !sameIdentity(identity(current.value), identity(candidate))
      ) {
        const message = current.ok ? "resumed CURRENT readback does not match promoted candidate" : current.error.message;
        await this.#event(runId, input.bookId, "promotion", "FAILED", message, identity(candidate));
        return failed("BOOK_RUN_PROMOTION_FAILED", message);
      }
      const resumed = await this.#event(
        runId,
        input.bookId,
        "promotion",
        "COMPLETED",
        `bookRevision=${livePointer.value.revision};resumedReadback=VERIFIED`,
        identity(candidate),
      );
      if (!resumed.ok) return resumed;
      return {
        ok: true,
        value: {
          schemaVersion: "1",
          runId,
          status: "PROMOTED",
          candidate: identity(candidate),
          reviewId: review.value.reviewId,
          qcRoundId: roundId,
          bookRevision: livePointer.value.revision,
          readback: "VERIFIED",
          // The resumed pointer is the SAME local-only promotion: it moved the
          // pointer and produced no reader package either.
          readerPackage: "NOT_PRODUCED",
          readerPackageCommand: readerPackageCommandFor({
            bookId: input.bookId,
            title: input.title,
            author: input.author,
            v25Root: input.v25Root,
            attemptRoot: input.attemptRoot,
            sourceGitSha: input.sourceGitSha,
            candidate: identity(candidate),
            reviewId: review.value.reviewId,
            qcRoundId: roundId,
            bookRevision: livePointer.value.revision,
          }),
        },
      };
    }
    if (liveRevision !== expectedBookRevision) {
      const message = `current pointer revision ${liveRevision} does not match original expected ${expectedBookRevision}`;
      await this.#event(runId, input.bookId, "promotion", "FAILED", message, identity(candidate));
      return failed("BOOK_RUN_POINTER_CONFLICT", message);
    }

    const promotionStarted = await this.#event(runId, input.bookId, "promotion", "STARTED", `expectedBookRevision=${expectedBookRevision}`, identity(candidate));
    if (!promotionStarted.ok) return promotionStarted;
    const promotedAt = safeNow(this.#dependencies.clock);
    if (!promotedAt.ok) return promotedAt;
    const promoted = await this.#dependencies.promotion.promote({
      bookId: input.bookId,
      candidate: identity(candidate),
      reviewId: review.value.reviewId,
      qcRoundId: roundId,
      expectedBookRevision,
      promotedAt: promotedAt.value,
    });
    if (!promoted.ok) {
      await this.#event(runId, input.bookId, "promotion", "FAILED", promoted.error.message, identity(candidate));
      return { ok: false, error: promoted.error };
    }
    if (promoted.value.readback !== "VERIFIED") {
      const message = "promotion readback is not VERIFIED";
      await this.#event(runId, input.bookId, "promotion", "FAILED", message, identity(candidate));
      return failed("BOOK_RUN_PROMOTION_FAILED", message);
    }
    // R-233: FILE THE RELEASE-JOURNAL RECORD this promotion owes. The pointer is
    // committed and nothing is published — the journal's `pointer-committed` state
    // exactly — and the follow-up command printed below resumes THIS record instead
    // of minting a second revision for identical content. Without the record the
    // resume dead-ends in "prior release intent cannot be proven".
    const journalled = fileLocalPromotionJournal({
      v25Root: input.v25Root,
      bookId: input.bookId,
      candidate: identity(candidate),
      reviewId: review.value.reviewId,
      qcRoundId: roundId,
      bookRevision: promoted.value.bookRevision,
      promotedAt: promotedAt.value,
    });
    // The event detail says what the phase actually achieved. `readerPackage=NOT_PRODUCED`
    // is part of the durable run log, not only of the returned value, so an
    // operator reading events.jsonl after the fact sees the same qualified claim.
    const promotionCompleted = await this.#event(
      runId,
      input.bookId,
      "promotion",
      "COMPLETED",
      `bookRevision=${promoted.value.bookRevision};readerPackage=NOT_PRODUCED` +
        (journalled.ok ? ";releaseJournal=FILED" : `;releaseJournal=UNWRITTEN:${journalled.error}`),
      identity(candidate),
    );
    if (!promotionCompleted.ok) return promotionCompleted;
    return {
      ok: true,
      value: {
        schemaVersion: "1",
        runId,
        status: "PROMOTED",
        candidate: identity(candidate),
        reviewId: review.value.reviewId,
        qcRoundId: roundId,
        bookRevision: promoted.value.bookRevision,
        readback: "VERIFIED",
        // --promote-local advanced the local V25 pointer and stopped there. No
        // book-packages/<bookId>.v21.json and no production-manifest sidecar
        // exist, so publish-final has nothing to verify and register-web has
        // nothing to register. Say so on the result instead of letting
        // status=PROMOTED imply a shippable book.
        readerPackage: "NOT_PRODUCED",
        readerPackageCommand: readerPackageCommandFor({
          bookId: input.bookId,
          title: input.title,
          author: input.author,
          v25Root: input.v25Root,
          attemptRoot: input.attemptRoot,
          sourceGitSha: input.sourceGitSha,
          candidate: identity(candidate),
          reviewId: review.value.reviewId,
          qcRoundId: roundId,
          bookRevision: promoted.value.bookRevision,
        }),
      },
    };
  }
}
