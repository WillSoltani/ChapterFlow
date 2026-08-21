/**
 * The shared BOOK-RUN-level repair rig.
 *
 * Both repair lanes hang off the same book run — the canonical-review FAIL lane
 * (`repair.runFromReviewFail`) and the fresh-QC FAIL lane (`repair.run`) — and
 * both are exercised through the real research/compile/review/QC wiring, so the
 * harness that stands a book run up is shared rather than copied. It is
 * deliberately NOT named `*.test.ts`: the v25 runner discovers test files by
 * that suffix and would otherwise spawn this one with no cases.
 *
 * The repair port is faked, but BOTH lane fakes mirror the REAL port's
 * run-lifecycle guard against the same run-state store (the
 * `created.value.status` ladder in `CandidateRepairApplicationPort.run` and in
 * `runFromReviewFail`): COMPLETED short-circuits to the durable successor,
 * CANCELLED/CANCEL_REQUESTED answers REPAIR_CANCELLED / REVIEW_REPAIR_CANCELLED,
 * any other non-RUNNING status answers REPAIR_RUN_TERMINAL /
 * REVIEW_REPAIR_RUN_TERMINAL. That ladder is what the book-run service has to
 * route around. HONEST COVERAGE NOTE: the real port's QC-lane ladder is pinned
 * by `v4-candidate-repair-application-port.test.ts` (terminal-FAILED replay);
 * the REVIEW-lane ladder codes (REVIEW_REPAIR_CANCELLED,
 * REVIEW_REPAIR_RUN_TERMINAL) are asserted only through THIS fake — the real
 * `runFromReviewFail` ladder at candidateRepairApplicationPort.ts:1337-1340 is
 * read-verified, not test-pinned. If the real ladder changes, this fake drifts
 * silently; extend the port-level tests before relying on those codes.
 *
 * The QC lane fake also COMMITS its fresh QC round to the real QC store and
 * derives its own status from that stored round, mirroring how the real port
 * records PASS / REPAIR_UNSUCCESSFUL from the round's own outcome.
 *
 * AND it mirrors the real port's DIAGNOSIS GATE (`priorUnsuccessful` +
 * `preflight` at candidateRepairApplicationPort.ts:843-857) against the same
 * durable QC store: a request whose failed round + failed candidate are a prior
 * transition's own unsuccessful fresh round REQUIRES a diagnosisId, and a
 * diagnosisId that does not resolve to a stored diagnosis for exactly that round
 * and candidate answers REPAIR_DIAGNOSIS_STALE. Without that mirror a book-run
 * test could "pass a diagnosisId" into a fake that ignores it, and the thing the
 * chained ladder exists to satisfy would go unexercised. HONEST COVERAGE NOTE:
 * the gate's own logic is pinned on the REAL port by
 * `v4-candidate-repair-application-port.test.ts` (REPAIR_DIAGNOSIS_REQUIRED and
 * REPAIR_DIAGNOSIS_STALE); the mirror here exists so the BOOK-RUN side is tested
 * against a port that actually enforces it, and it derives the
 * prior-unsuccessful condition from the transitions this fake itself completed
 * rather than from a repair-history store (which the fake does not own).
 */

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";

import {
  BookRunApplicationService,
  type BookRunEvent,
} from "../../src/app/bookRunApplicationService.js";
import type { CandidateQcEvaluator } from "../../src/app/candidateQcEvaluator.js";
import type {
  CandidateRepairApplicationPort,
  CandidateRepairApplicationRequest,
  ReviewRepairApplicationRequest,
} from "../../src/app/candidateRepairApplicationPort.js";
import type { CompilerApplicationPort } from "../../src/app/compilerApplicationPort.js";
import { ModelGatewayReviewEvaluator } from "../../src/app/modelGatewayReviewEvaluator.js";
import type { ModelTaskRunner } from "../../src/app/modelTaskRunner.js";
import type { ResearchCandidateApplicationPort } from "../../src/app/researchCandidateApplicationPort.js";
import { createBookWriteLock } from "../../src/books/bookLease.js";
import { createBookContentReader } from "../../src/books/bookContentReader.js";
import { createCandidateStore } from "../../src/books/candidateStore.js";
import { createCurrentPointerStore } from "../../src/books/currentPointer.js";
import type { CandidateInputFile, CandidateSnapshot } from "../../src/books/candidateTypes.js";
import type { CandidateIdentity } from "../../src/contracts/v4Core.js";
import { BOOK_PATTERN_AUDIT_LOGICAL_PATH, runBookPatternAudit } from "../../src/critics/bookPatternAudit.js";
import type { QcDiagnosis, QcRoundResult } from "../../src/qc/qcTypes.js";
import { createQcService } from "../../src/qc/qcService.js";
import { createQcStore } from "../../src/qc/qcStore.js";
import { createPromotionService } from "../../src/release/promotionService.js";
import { createReviewServiceFactory } from "../../src/review/reviewService.js";
import type { CanonicalReviewResult } from "../../src/review/reviewTypes.js";
import { createFileRunStore } from "../../src/run-state/fileRunStore.js";
import { createFileStageCoordinator } from "../../src/run-state/stageCoordinator.js";
import type { RunStore } from "../../src/run-state/runStore.js";
import type { ChapterV21 } from "../../src/types.js";
import { fixtureChapter } from "../model-bakeoff-helpers.js";
import type { TestContext } from "./harness.js";

export const SOURCE_SHA = "b41d1cdab0fc33c4c1f840f4cf99089816e022d4";

/** The stage id the real repair port admits its chapter work under. */
const REPAIR_STAGE = "candidate-repair";
/** The review-FAIL lane's OWN stage — deliberately not the QC lane's, exactly as
 *  `REVIEW_REPAIR_STAGE_ID` in the real port. */
const REVIEW_REPAIR_STAGE = "review-repair";

export function derivedIdOf(prefix: string, runId: string): string {
  return `${prefix}-${createHash("sha256").update(runId).digest("hex").slice(0, 32)}`;
}

function identityOf(candidate: CandidateSnapshot): CandidateIdentity {
  return { candidateId: candidate.manifest.candidateId, manifestDigest: candidate.manifest.manifestDigest };
}

function sameId(left: CandidateIdentity, right: CandidateIdentity): boolean {
  return left.candidateId === right.candidateId && left.manifestDigest === right.manifestDigest;
}

export type BookRunHarness = Readonly<{
  service: BookRunApplicationService;
  request: Omit<Parameters<BookRunApplicationService["run"]>[0], "resumeRunId">;
  bookRunId: string;
  events: BookRunEvent[];
  runStore: RunStore;
  reviewCalls: () => number;
  repairCalls: () => readonly ReviewRepairApplicationRequest[];
  /** Every `repair.run` (fresh-QC lane) request, in call order. */
  qcRepairCalls: () => readonly CandidateRepairApplicationRequest[];
  /** How many QC-lane repairs actually did model work (a short-circuited
   *  COMPLETED reconcile must not move this). */
  qcRepairModelCalls: () => number;
  /** The run id the QC lane would use for a given identity label. */
  qcRepairRunId: (label: string) => string;
  /** The run id the review-FAIL lane would use for a given identity label. */
  reviewRepairRunId: (label: string) => string;
  /** Drive a QC-lane repair run to a terminal state BEFORE the book run reaches
   *  it — the durable shape a crashed/failed earlier operator round leaves. */
  seedQcRepairRun: (label: string, status: "FAILED" | "CANCELLED") => Promise<void>;
  /** The durable shape an earlier operator round leaves when its repair RAN to
   *  completion: a COMPLETED run, its successor candidate on disk, and its own
   *  fresh QC round committed with `outcome`. `FAIL` is the REPAIR_UNSUCCESSFUL
   *  case — the repair worked, the QC verdict did not. */
  seedCompletedQcRepair: (
    label: string,
    outcome: "PASS" | "FAIL",
    options?: Readonly<{
      /** Whose successor this transition repaired. Omitted = the compiled
       *  candidate (an ordinal-1 shape); set for a CHAINED link so the seeded
       *  successor's parentage matches the request the ladder will build. */
      parentLabel?: string;
      /** The diagnosisId this transition EXECUTED under. The rig's replay
       *  identity check mirrors the real port (record.diagnosisId must equal
       *  request.diagnosisId on a COMPLETED replay), so a seeded CHAINED link
       *  must record the diagnosis the ladder will re-derive — and a test that
       *  wants the mismatch wedge seeds a DIFFERENT one. */
      completedUnderDiagnosisId?: string;
    }>,
  ) => Promise<void>;
  /** Same, for the review-FAIL lane, which owns no QC round. */
  seedReviewRepairRun: (label: string, status: "FAILED" | "CANCELLED") => Promise<void>;
  /**
   * The durable artifact `qc-diagnose` leaves: a diagnosis bound to a round and
   * a candidate. Defaults to the pair a CHAINED repair of `label`'s successor
   * needs — `label`'s OWN fresh round and the successor it staged — so the
   * overrides are how a test builds a diagnosis that must NOT chain (a different
   * round, a different candidate) or a second diagnosis for the same pair.
   * Requires `label`'s successor candidate to already exist on disk.
   */
  seedDiagnosis: (label: string, overrides?: Readonly<{
    diagnosisId?: string;
    roundId?: string;
    candidate?: CandidateIdentity;
    createdAt?: string;
  }>) => Promise<QcDiagnosis>;
  /** The candidate identity `label`'s repair transition staged as its successor. */
  successorIdentity: (label: string) => Promise<CandidateIdentity>;
}>;

export type BookRunHarnessOptions = Readonly<{
  /** Fail every review-lane repair with this code. */
  repairFails?: string;
  /** Fail every QC-lane repair with this code, driving its run FAILED first —
   *  exactly what the real port does on a model/workflow failure. */
  qcRepairFails?: string;
  /** Fresh-QC outcomes, scripted per `candidateQc.run` call (default: PASS). */
  qcOutcomes?: readonly ("PASS" | "FAIL")[];
  /** Promote at the end of the run (default true). QC-lane cases turn this off:
   *  the fake repair port returns a synthesized review/QC pair that the real
   *  promotion service has no stored record for. */
  promoteLocal?: boolean;
}>;

/**
 * A book run whose canonical review outcomes and fresh-QC outcomes are scripted
 * per call and whose repair port is a fake that stages a real successor
 * candidate. The review evaluator is the only runner consumer, so
 * `reviewCalls()` counts panel runs exactly.
 */
export async function buildBookRunHarness(
  context: TestContext,
  book: string,
  reviewOutcomes: readonly CanonicalReviewResult["outcome"][],
  options: BookRunHarnessOptions = {},
): Promise<BookRunHarness> {
  const now = () => {
    const value = context.clock.now();
    context.clock.advance(1);
    return value;
  };
  const suffix = book.replace(/[^a-z0-9]/g, "");
  const bookRunId = `book-run-${suffix}`;
  const compilerRunId = derivedIdOf("compiler-run", bookRunId);
  const compiledCandidateId = `${compilerRunId}-candidate`;
  const booksRoot = resolve(context.roots.tempRoot, `${suffix}-books`);
  const runRoot = resolve(context.roots.tempRoot, `${suffix}-runs`);
  mkdirSync(booksRoot, { recursive: true });
  const writeLock = createBookWriteLock({ booksRoot });
  const currentPointer = createCurrentPointerStore({ booksRoot, writeLock });
  const candidates = createCandidateStore({ booksRoot, writeLock, currentPointerStore: currentPointer });
  const reader = createBookContentReader({ booksRoot, currentPointerStore: currentPointer });
  const runStore = createFileRunStore(runRoot);
  const stageCoordinator = createFileStageCoordinator(runRoot);
  const chapter = fixtureChapter(book, 1, suffix);
  const chapterLogicalPath = `content/chapters/${chapter.chapterId}.v21-native.chapter.json`;
  const jsonFile = (logicalPath: string, value: unknown, kind: CandidateInputFile["kind"] = "SIDECAR"): CandidateInputFile =>
    ({ kind, logicalPath, mediaType: "application/json", bytes: Buffer.from(`${JSON.stringify(value)}\n`) });
  const stageLocal = async (input: { candidateId: string; runId: string; files: readonly CandidateInputFile[]; parentCandidateId?: string }): Promise<CandidateSnapshot> => {
    const staged = await candidates.stage({
      bookId: book,
      candidateId: input.candidateId,
      ...(input.parentCandidateId === undefined ? {} : { parentCandidateId: input.parentCandidateId }),
      createdByRunId: input.runId,
      expectedInventory: input.files.map(({ bytes: _bytes, ...file }) => file),
      files: input.files,
      createdAt: context.clock.now(),
    });
    assert.equal(staged.ok, true, JSON.stringify(staged));
    const opened = await candidates.open({ bookId: book, selector: { kind: "CANDIDATE", candidateId: input.candidateId } });
    assert.ok(opened.ok);
    return opened.value;
  };
  const seed = await stageLocal({
    candidateId: "seed-candidate",
    runId: "seed-run",
    files: [jsonFile("inputs/chapter-index.json", [{ chapterId: chapter.chapterId, chapterNumber: 1, chapterTitle: chapter.title }])],
  });
  const compiledFiles = [
    jsonFile(chapterLogicalPath, chapter, "CHAPTER"),
    jsonFile(BOOK_PATTERN_AUDIT_LOGICAL_PATH, runBookPatternAudit({ bookId: book, chapters: [chapter], requirePlanArtifacts: false, checkSourceAlignment: false })),
  ];
  const compiled = await stageLocal({
    candidateId: compiledCandidateId,
    parentCandidateId: seed.manifest.candidateId,
    runId: compilerRunId,
    files: compiledFiles,
  });

  let reviewCalls = 0;
  const outcomes = [...reviewOutcomes];
  const runner: ModelTaskRunner = {
    async run(request) {
      reviewCalls += 1;
      const admittedAt = context.clock.now();
      const admitted = await runStore.admitAttempt({
        bookId: request.context.bookId,
        runId: request.context.runId,
        attemptId: request.context.attemptId,
        stageId: request.context.stageId,
        operationId: request.context.operationId,
        admittedAt,
        staleAt: new Date(Date.parse(admittedAt) + 60_000).toISOString(),
      });
      assert.equal(admitted.ok, true, JSON.stringify(admitted));
      const finished = await runStore.finishAttempt({
        bookId: request.context.bookId,
        runId: request.context.runId,
        attemptId: request.context.attemptId,
        outcome: "SUCCEEDED",
        finishedAt: context.clock.now(),
      });
      assert.equal(finished.ok, true, JSON.stringify(finished));
      const outcome = outcomes.shift() ?? "PASS";
      return {
        attemptId: request.context.attemptId,
        outcome: "SUCCEEDED",
        output: outcome === "PASS"
          ? { outcome, issues: [] }
          : { outcome, issues: [{ code: "READER.BLOCKING.contradiction", severity: "BLOCKER", message: "card 5 contradicts the deep read", location: "ch01/reader-b/deep" }] },
      };
    },
  };
  const reviews = createReviewServiceFactory({ booksRoot, contentReader: reader, now })
    .create(new ModelGatewayReviewEvaluator(runner));
  const qc = createQcService({ booksRoot, contentReader: reader, reviewService: reviews, writeLock, now });
  // The same durable QC store the service above reads through. The QC-lane fake
  // commits its fresh round here and derives its own status from it, exactly as
  // the real port does (`qc.value.outcome === "PASS" ? "PASS" : "REPAIR_UNSUCCESSFUL"`),
  // so a COMPLETED-but-unsuccessful ordinal is a real durable record and not a
  // property of the fake.
  const qcStore = createQcStore({ booksRoot });
  const commitRound = async (round: QcRoundResult): Promise<QcRoundResult> => {
    const committed = await writeLock.run(book, () => qcStore.commitRound(book, round));
    assert.equal(committed.ok, true, JSON.stringify(committed));
    assert.ok(committed.ok);
    return committed.value;
  };
  const promotion = createPromotionService({ candidateStore: candidates, contentReader: reader, reviewService: reviews, qcService: qc, currentPointerStore: currentPointer, clock: now });
  const research = {
    async run(req: { resumeRunId?: string; newRunId?: string }) {
      return {
        schemaVersion: "1" as const,
        bookId: book,
        title: "Review Repair",
        author: "Fixture Author",
        intakeRunId: req.resumeRunId ?? req.newRunId ?? bookRunId,
        researchRunId: "research-fixture",
        candidate: { candidateId: seed.manifest.candidateId, manifestDigest: seed.manifest.manifestDigest },
        indexLogicalPath: "inputs/chapter-index.json" as const,
        sectionTaskContextLogicalPath: "inputs/compiler-section-task-context.json" as const,
        sources: [],
        resumed: req.resumeRunId !== undefined,
      };
    },
  } as unknown as ResearchCandidateApplicationPort;
  let compilerRunPersisted = false;
  const compiler = {
    async run() {
      if (!compilerRunPersisted) {
        const created = await runStore.createRun({
          schemaVersion: "1", bookId: book, runId: compilerRunId, commandId: "compiler-candidate", sourceGitSha: SOURCE_SHA,
          requiredStages: ["compiler-candidate"], requiredInventory: [],
          inputCandidate: { candidateId: seed.manifest.candidateId, manifestDigest: seed.manifest.manifestDigest },
          attemptLimits: { run: 4, byStage: { "compiler-candidate": 4 } }, createdAt: context.clock.now(),
        });
        assert.ok(created.ok);
        const finished = await runStore.finishRun({ bookId: book, runId: compilerRunId, status: "COMPLETED", finishedAt: context.clock.now() });
        assert.ok(finished.ok);
        compilerRunPersisted = true;
      }
      return { runId: compilerRunId, runStatus: "COMPLETED" as const, candidateId: compiled.manifest.candidateId, manifestDigest: compiled.manifest.manifestDigest };
    },
  } as unknown as CompilerApplicationPort;
  const qcOutcomes = [...(options.qcOutcomes ?? [])];
  const candidateQc = {
    async run(req: { roundId: string; candidate: CandidateSnapshot; canonicalReview: { reviewId: string } }) {
      const outcome = qcOutcomes.shift() ?? "PASS";
      return {
        ok: true as const,
        value: {
          roundId: req.roundId,
          candidate: { candidateId: req.candidate.manifest.candidateId, manifestDigest: req.candidate.manifest.manifestDigest },
          reviewId: req.canonicalReview.reviewId,
          outcome,
          issues: outcome === "PASS"
            ? []
            : [{ code: "CHAPTER_FIX", severity: "BLOCKER" as const, message: "chapter opening buries the ruling", location: chapterLogicalPath }],
        },
      };
    },
  } as unknown as CandidateQcEvaluator;

  // ── review-FAIL lane fake ────────────────────────────────────────────────
  //
  // Mirrors `CandidateRepairApplicationPort.runFromReviewFail`'s run-lifecycle
  // ladder against the SAME run-state store the QC-lane fake uses: COMPLETED
  // short-circuits to the durable successor, CANCELLED/CANCEL_REQUESTED answers
  // REVIEW_REPAIR_CANCELLED, any other non-RUNNING status answers
  // REVIEW_REPAIR_RUN_TERMINAL, and a scripted failure drives the run FAILED
  // before it returns. Without that ladder this lane's fake was blind to run
  // state, so the fixed-id wedge it actually has could not be reproduced here.
  const repairCalls: ReviewRepairApplicationRequest[] = [];
  const successors = new Map<string, CandidateSnapshot>();
  const runFromReviewFail = async (request: ReviewRepairApplicationRequest) => {
    repairCalls.push(request);
    const observedAt = context.clock.now();
    const prior = await runStore.readRun(book, request.repairRunId, observedAt);
    const priorCreatedAt = prior.ok ? prior.value.definition.createdAt : observedAt;
    const created = await runStore.createRun(
      repairRunDefinition(request.repairRunId, request.failedCandidate, priorCreatedAt, {
        commandId: "review-repair",
        stageId: REVIEW_REPAIR_STAGE,
      }),
    );
    if (!created.ok) {
      return { ok: false as const, error: { code: "REVIEW_REPAIR_RUN_UNAVAILABLE", message: `${created.error.code}:${created.error.message}` } };
    }
    if (created.value.status === "COMPLETED") {
      const durable = await candidates.open({ bookId: book, selector: { kind: "CANDIDATE", candidateId: request.successorCandidateId } });
      if (!durable.ok) return { ok: false as const, error: { code: "REVIEW_REPAIR_COMPLETED_MISMATCH", message: "successor missing" } };
      return { ok: true as const, value: { successor: durable.value, failedReviewId: request.failedReviewId, targetChapterNumbers: [1] } };
    }
    if (created.value.status === "CANCEL_REQUESTED" || created.value.status === "CANCELLED") {
      return { ok: false as const, error: { code: "REVIEW_REPAIR_CANCELLED", message: "review-repair run is cancelled" } };
    }
    if (created.value.status !== "RUNNING") {
      return { ok: false as const, error: { code: "REVIEW_REPAIR_RUN_TERMINAL", message: `review-repair run is ${created.value.status}` } };
    }
    if (options.repairFails !== undefined) {
      const failedRun = await runStore.finishRun({
        bookId: book,
        runId: request.repairRunId,
        status: "FAILED",
        finishedAt: context.clock.now(),
        reason: options.repairFails,
      });
      assert.equal(failedRun.ok, true, JSON.stringify(failedRun));
      return { ok: false as const, error: { code: options.repairFails, message: "scripted repair failure" } };
    }
    const existing = successors.get(request.successorCandidateId);
    if (existing) return { ok: true as const, value: { successor: existing, failedReviewId: request.failedReviewId, targetChapterNumbers: [1] } };
    const repairedChapter: ChapterV21 = {
      ...chapter,
      hook: `${chapter.hook} (repaired for ${request.successorCandidateId})`,
    };
    const files = [
      jsonFile(chapterLogicalPath, repairedChapter, "CHAPTER"),
      jsonFile(BOOK_PATTERN_AUDIT_LOGICAL_PATH, runBookPatternAudit({ bookId: book, chapters: [repairedChapter], requirePlanArtifacts: false, checkSourceAlignment: false })),
    ];
    const staged = await stageLocal({
      candidateId: request.successorCandidateId,
      parentCandidateId: request.failedCandidate.candidateId,
      runId: request.repairRunId,
      files,
    });
    successors.set(request.successorCandidateId, staged);
    const finished = await runStore.finishRun({ bookId: book, runId: request.repairRunId, status: "COMPLETED", finishedAt: context.clock.now() });
    assert.equal(finished.ok, true, JSON.stringify(finished));
    return { ok: true as const, value: { successor: staged, failedReviewId: request.failedReviewId, targetChapterNumbers: [1] } };
  };

  // ── fresh-QC FAIL lane fake ──────────────────────────────────────────────
  const qcRepairCalls: CandidateRepairApplicationRequest[] = [];
  let qcRepairModelCalls = 0;
  /** The repair-history surface the real port's `priorUnsuccessful` reads,
   *  keyed by the transition's own fresh QC round. */
  const laneHistory = new Map<string, Readonly<{ successor: CandidateIdentity; qcOutcome: "PASS" | "FAIL" | "ERROR" }>>();
  const qcRepairRunId = (label: string): string => derivedIdOf(`${label}-run`, bookRunId);
  /** Both lanes derive their run id the same way — from the label the ordinal
   *  walk chose — so the review lane's id function is the same shape. */
  const reviewRepairRunId = (label: string): string => derivedIdOf(`${label}-run`, bookRunId);
  const repairRunDefinition = (
    runId: string,
    inputCandidate: CandidateIdentity,
    createdAt: string,
    lane: Readonly<{ commandId: string; stageId: string }> = { commandId: "candidate-repair", stageId: REPAIR_STAGE },
  ) => ({
    schemaVersion: "1" as const,
    bookId: book,
    runId,
    commandId: lane.commandId,
    sourceGitSha: SOURCE_SHA,
    requiredStages: [lane.stageId],
    requiredInventory: [],
    inputCandidate,
    attemptLimits: { run: 4, byStage: { [lane.stageId]: 4 } },
    createdAt,
  });
  /** The QC lane's transition outcome, derived from the DURABLE fresh QC round
   *  the way the real port derives it: PASS iff that stored round PASSED,
   *  REPAIR_UNSUCCESSFUL otherwise. A round already on disk (an earlier operator
   *  round's, or a seeded one) is authoritative; a first execution commits its
   *  own PASS round. */
  const repairOutcome = async (request: CandidateRepairApplicationRequest, successor: CandidateSnapshot) => {
    const successorIdentity = identityOf(successor);
    const completedAt = context.clock.now();
    const stored = await qcStore.getRound(book, request.freshRoundId);
    const round: QcRoundResult = stored.ok ? stored.value : await commitRound({
      schemaVersion: "1",
      roundId: request.freshRoundId,
      candidate: successorIdentity,
      reviewId: request.reviewId,
      outcome: "PASS",
      issues: [],
      completedAt,
    });
    const review: CanonicalReviewResult = {
      schemaVersion: "1",
      reviewId: request.reviewId,
      candidate: successorIdentity,
      outcome: "PASS",
      issues: [],
      completedAt,
    };
    // The transition record the real port appends to its repair history, which
    // is what `priorUnsuccessful` reads. Keyed by fresh round: replaying the same
    // COMPLETED ordinal must not stack duplicates.
    laneHistory.set(request.freshRoundId, { successor: successorIdentity, qcOutcome: round.outcome });
    return {
      status: round.outcome === "PASS" ? ("PASS" as const) : ("REPAIR_UNSUCCESSFUL" as const),
      ordinal: 1,
      predecessor: compiled,
      successor,
      review,
      qc: round,
    };
  };
  const executedDiagnosis = new Map<string, string | undefined>();
  const runQcLaneRepair = async (request: CandidateRepairApplicationRequest) => {
    qcRepairCalls.push(request);
    // THE DIAGNOSIS GATE, in the real port's order: `run()` calls `preflight()`
    // BEFORE it touches run state, so a chained request that omits or misstates
    // its diagnosis never reaches the run-lifecycle ladder below.
    const priorUnsuccessful = [...laneHistory.entries()].some(([freshRoundId, record]) => (
      record.qcOutcome !== "PASS"
      && freshRoundId === request.failedRoundId
      && sameId(record.successor, request.failedCandidate)
    ));
    if (priorUnsuccessful && request.diagnosisId === undefined) {
      return { ok: false as const, error: { code: "REPAIR_DIAGNOSIS_REQUIRED", message: "second unsuccessful repair loop requires qc-diagnose for failed round" } };
    }
    if (request.diagnosisId !== undefined) {
      const diagnosis = await qcStore.getDiagnosis(book, request.diagnosisId);
      if (!diagnosis.ok) {
        return { ok: false as const, error: { code: "REPAIR_DIAGNOSIS_REQUIRED", message: diagnosis.error.message } };
      }
      if (
        diagnosis.value.diagnosisId !== request.diagnosisId
        || diagnosis.value.roundId !== request.failedRoundId
        || !sameId(diagnosis.value.candidate, request.failedCandidate)
      ) {
        return { ok: false as const, error: { code: "REPAIR_DIAGNOSIS_STALE", message: "diagnosis does not match selected failed candidate and round" } };
      }
    }
    // Mirrors CandidateRepairApplicationPort.run: the prior run's createdAt is
    // reused so re-creating the same id is not a definition CONFLICT.
    const observedAt = context.clock.now();
    const prior = await runStore.readRun(book, request.repairRunId, observedAt);
    const createdAt = prior.ok ? prior.value.definition.createdAt : observedAt;
    const created = await runStore.createRun(repairRunDefinition(request.repairRunId, request.failedCandidate, createdAt));
    if (!created.ok) {
      return { ok: false as const, error: { code: "REPAIR_RUN_UNAVAILABLE", message: `${created.error.code}:${created.error.message}` } };
    }
    if (created.value.status === "COMPLETED") {
      // Durable successor: re-read it, spend NOTHING. Mirror the real port's
      // replay identity check (candidateRepairApplicationPort.ts:754): the
      // recorded transition binds the diagnosisId it executed under, and a
      // replay request naming a DIFFERENT one is a mismatch, not a success —
      // this is exactly how latest-selection wedged before adversarial review
      // caught it, and the rig must be able to see that wedge.
      const recorded = executedDiagnosis.get(request.repairRunId);
      if (recorded !== request.diagnosisId) {
        return { ok: false as const, error: { code: "REPAIR_COMPLETED_MISMATCH", message: `recorded diagnosis ${recorded ?? "<none>"} != requested ${request.diagnosisId ?? "<none>"}` } };
      }
      const durable = await candidates.open({ bookId: book, selector: { kind: "CANDIDATE", candidateId: request.successorCandidateId } });
      if (!durable.ok) return { ok: false as const, error: { code: "REPAIR_COMPLETED_MISMATCH", message: "successor missing" } };
      return { ok: true as const, value: await repairOutcome(request, durable.value) };
    }
    if (created.value.status === "CANCEL_REQUESTED" || created.value.status === "CANCELLED") {
      return { ok: false as const, error: { code: "REPAIR_CANCELLED", message: "repair run is cancelled" } };
    }
    if (created.value.status !== "RUNNING") {
      return { ok: false as const, error: { code: "REPAIR_RUN_TERMINAL", message: `repair run is ${created.value.status}` } };
    }
    if (options.qcRepairFails !== undefined) {
      const failedRun = await runStore.finishRun({
        bookId: book,
        runId: request.repairRunId,
        status: "FAILED",
        finishedAt: context.clock.now(),
        reason: options.qcRepairFails,
      });
      assert.equal(failedRun.ok, true, JSON.stringify(failedRun));
      return { ok: false as const, error: { code: options.qcRepairFails, message: "scripted qc repair failure" } };
    }
    qcRepairModelCalls += 1;
    const repairedChapter: ChapterV21 = {
      ...chapter,
      hook: `${chapter.hook} (qc-repaired for ${request.successorCandidateId})`,
    };
    const staged = await stageLocal({
      candidateId: request.successorCandidateId,
      parentCandidateId: request.failedCandidate.candidateId,
      runId: request.repairRunId,
      files: [
        jsonFile(chapterLogicalPath, repairedChapter, "CHAPTER"),
        jsonFile(BOOK_PATTERN_AUDIT_LOGICAL_PATH, runBookPatternAudit({ bookId: book, chapters: [repairedChapter], requirePlanArtifacts: false, checkSourceAlignment: false })),
      ],
    });
    const finished = await runStore.finishRun({ bookId: book, runId: request.repairRunId, status: "COMPLETED", finishedAt: context.clock.now() });
    assert.equal(finished.ok, true, JSON.stringify(finished));
    executedDiagnosis.set(request.repairRunId, request.diagnosisId);
    return { ok: true as const, value: await repairOutcome(request, staged) };
  };

  const repair = { runFromReviewFail, run: runQcLaneRepair } as unknown as CandidateRepairApplicationPort;

  const events: BookRunEvent[] = [];
  const service = new BookRunApplicationService({
    research, compiler, repair, contentReader: reader, candidateQc, reviews, qc, diagnoses: qcStore, promotion, currentPointer, runStore, stageCoordinator,
    clock: { now },
    ids: {
      nextRunId: () => bookRunId,
      candidateId: (runId) => `${runId}-candidate`,
      modelAttemptId: (runId) => `${runId}-model`,
      reviewAttemptId: (runId) => `${runId}-review-attempt`,
      reviewId: (runId) => `${runId}-review`,
      qcRoundId: (runId) => `${runId}-qc`,
    },
    events: {
      async append(event) { events.push(event); },
      async read(bookId, runId) { return events.filter((event) => event.bookId === bookId && event.runId === runId); },
    },
    pipelineRoot: resolve(context.roots.base, "pipeline"),
  });
  return {
    service,
    bookRunId,
    events,
    runStore,
    reviewCalls: () => reviewCalls,
    repairCalls: () => repairCalls,
    qcRepairCalls: () => qcRepairCalls,
    qcRepairModelCalls: () => qcRepairModelCalls,
    qcRepairRunId,
    async seedQcRepairRun(label, status) {
      const runId = qcRepairRunId(label);
      const createdAt = context.clock.now();
      const created = await runStore.createRun(repairRunDefinition(runId, identityOf(compiled), createdAt));
      assert.equal(created.ok, true, JSON.stringify(created));
      if (status === "CANCELLED") {
        const requested = await runStore.requestCancel({ bookId: book, runId, reason: "operator cancelled", requestedAt: context.clock.now() });
        assert.equal(requested.ok, true, JSON.stringify(requested));
      }
      const finished = await runStore.finishRun({
        bookId: book,
        runId,
        status,
        finishedAt: context.clock.now(),
        reason: status === "FAILED" ? "seeded: earlier repair round died" : "operator cancelled",
      });
      assert.equal(finished.ok, true, JSON.stringify(finished));
    },
    reviewRepairRunId,
    async seedReviewRepairRun(label, status) {
      const runId = reviewRepairRunId(label);
      const createdAt = context.clock.now();
      const created = await runStore.createRun(
        repairRunDefinition(runId, identityOf(compiled), createdAt, { commandId: "review-repair", stageId: REVIEW_REPAIR_STAGE }),
      );
      assert.equal(created.ok, true, JSON.stringify(created));
      if (status === "CANCELLED") {
        const requested = await runStore.requestCancel({ bookId: book, runId, reason: "operator cancelled", requestedAt: context.clock.now() });
        assert.equal(requested.ok, true, JSON.stringify(requested));
      }
      const finished = await runStore.finishRun({
        bookId: book,
        runId,
        status,
        finishedAt: context.clock.now(),
        reason: status === "FAILED" ? "seeded: earlier review-repair round died" : "operator cancelled",
      });
      assert.equal(finished.ok, true, JSON.stringify(finished));
    },
    async seedCompletedQcRepair(label, outcome, options = {}) {
      if (options.completedUnderDiagnosisId !== undefined) {
        executedDiagnosis.set(qcRepairRunId(label), options.completedUnderDiagnosisId);
      }
      // Everything one COMPLETED repair transition leaves behind, under the ids
      // that label owns: the run, the successor candidate it staged, and its own
      // fresh QC round. `outcome: "FAIL"` is the REPAIR_UNSUCCESSFUL shape — a
      // repair that ran, produced a successor, and whose fresh QC still failed.
      const runId = qcRepairRunId(label);
      const successorCandidateId = derivedIdOf(`${label}-candidate`, bookRunId);
      const createdAt = context.clock.now();
      const parentCandidateId = options.parentLabel === undefined
        ? compiled.manifest.candidateId
        : derivedIdOf(`${options.parentLabel}-candidate`, bookRunId);
      const parent = await candidates.open({ bookId: book, selector: { kind: "CANDIDATE", candidateId: parentCandidateId } });
      assert.ok(parent.ok, `seedCompletedQcRepair(${label}) needs its parent staged first: ${JSON.stringify(parent)}`);
      const created = await runStore.createRun(repairRunDefinition(runId, identityOf(parent.value), createdAt));
      assert.equal(created.ok, true, JSON.stringify(created));
      const repairedChapter: ChapterV21 = {
        ...chapter,
        hook: `${chapter.hook} (qc-repaired for ${successorCandidateId})`,
      };
      const staged = await stageLocal({
        candidateId: successorCandidateId,
        parentCandidateId,
        runId,
        files: [
          jsonFile(chapterLogicalPath, repairedChapter, "CHAPTER"),
          jsonFile(BOOK_PATTERN_AUDIT_LOGICAL_PATH, runBookPatternAudit({ bookId: book, chapters: [repairedChapter], requirePlanArtifacts: false, checkSourceAlignment: false })),
        ],
      });
      await commitRound({
        schemaVersion: "1",
        roundId: derivedIdOf(`${label}-qc`, bookRunId),
        candidate: identityOf(staged),
        reviewId: derivedIdOf(`${label}-review`, bookRunId),
        outcome,
        issues: outcome === "PASS"
          ? []
          : [{ code: "CHAPTER_FIX", severity: "BLOCKER", message: "the repaired chapter still buries the ruling", location: chapterLogicalPath }],
        completedAt: context.clock.now(),
      });
      const finished = await runStore.finishRun({
        bookId: book,
        runId,
        status: "COMPLETED",
        finishedAt: context.clock.now(),
      });
      assert.equal(finished.ok, true, JSON.stringify(finished));
    },
    async successorIdentity(label) {
      const successorCandidateId = derivedIdOf(`${label}-candidate`, bookRunId);
      const opened = await candidates.open({ bookId: book, selector: { kind: "CANDIDATE", candidateId: successorCandidateId } });
      assert.ok(opened.ok, `no successor staged for label ${label}: ${JSON.stringify(opened)}`);
      return identityOf(opened.value);
    },
    async seedDiagnosis(label, overrides = {}) {
      const successorCandidateId = derivedIdOf(`${label}-candidate`, bookRunId);
      let candidate = overrides.candidate;
      if (candidate === undefined) {
        const opened = await candidates.open({ bookId: book, selector: { kind: "CANDIDATE", candidateId: successorCandidateId } });
        assert.ok(opened.ok, `seedDiagnosis(${label}) needs its successor staged first: ${JSON.stringify(opened)}`);
        candidate = identityOf(opened.value);
      }
      const diagnosis: QcDiagnosis = {
        diagnosisId: overrides.diagnosisId ?? `diagnosis-${label}`,
        roundId: overrides.roundId ?? derivedIdOf(`${label}-qc`, bookRunId),
        candidate,
        issues: [{ code: "CHAPTER_FIX", severity: "BLOCKER", message: "the repaired chapter still buries the ruling", location: chapterLogicalPath }],
        createdAt: overrides.createdAt ?? context.clock.now(),
      };
      const created = await writeLock.run(book, () => qcStore.createDiagnosis(book, diagnosis));
      assert.equal(created.ok, true, JSON.stringify(created));
      return diagnosis;
    },
    request: {
      bookId: book,
      title: "Review Repair",
      author: "Fixture Author",
      sourceGitSha: SOURCE_SHA,
      v25Root: resolve(context.roots.tempRoot, `${suffix}-v25`),
      attemptRoot: resolve(context.roots.attemptsRoot, `${suffix}-book-run`),
      regen: true,
      maxRepairRounds: 1 as const,
      promoteLocal: options.promoteLocal ?? true,
      signal: new AbortController().signal,
    },
  };
}
