/**
 * The shared CandidateRepairApplicationPort test rig.
 *
 * Extracted from `v4-candidate-repair-application-port.test.ts` when the brief
 * wiring cases were added: every case here stages a full candidate to disk
 * (write, digest, atomic rename) under real write-lock polling, so the file
 * clocked ~262s for 16 cases and the v25 runner's per-file ceiling
 * (`tests/v25/run.ts`, 600s) carries an explicit instruction — "if this file
 * grows further it should be split rather than re-raised". This module is that
 * split: the rig lives here, the cases live in the two `*.test.ts` files that
 * import it. It is deliberately NOT named `*.test.ts` — the v25 runner discovers
 * test files by that suffix and would otherwise spawn this one with no cases.
 */

import assert from "node:assert/strict";
import { resolve } from "node:path";

import { assembleChapterV21OrThrow } from "../../src/assembler.js";
import type { SourcePacketV1 } from "../../src/artifacts/artifactTypes.js";
import {
  CandidateRepairApplicationPort,
  type CandidateRepairApplicationRequest,
} from "../../src/app/candidateRepairApplicationPort.js";
import type { ModelTaskRunner } from "../../src/app/modelTaskRunner.js";
import type { CandidateSnapshot, CandidateStore } from "../../src/books/candidateTypes.js";
import { compileSourceUsePlan } from "../../src/compiler/sourceUsePlanCompiler.js";
import { sourcePacketHash } from "../../src/compiler/sourcePacket.js";
import type { CandidateIdentity } from "../../src/contracts/v4Core.js";
import { BOOK_PATTERN_AUDIT_LOGICAL_PATH, runBookPatternAudit } from "../../src/critics/bookPatternAudit.js";
import type { DiagnosisLookup, RepairRequest, RepairService } from "../../src/qc/repairCoordinator.js";
import type { RepairHistoryRecord, RepairHistoryStore } from "../../src/qc/repairHistoryStore.js";
import type { QcIssue, QcRoundResult, QcService } from "../../src/qc/qcTypes.js";
import type { CanonicalReviewResult, ReviewService } from "../../src/review/reviewTypes.js";
import { createFileRunStore } from "../../src/run-state/fileRunStore.js";
import { createFileStageCoordinator } from "../../src/run-state/stageCoordinator.js";
import type { ChapterV21 } from "../../src/types.js";
import { compileCreditFixture } from "../fixtures/creditBookFixture.js";
import type { TestContext } from "./harness.js";

export const BOOK = "repair-port-book";
export const FAILED: CandidateIdentity = { candidateId: "candidate-failed", manifestDigest: "a".repeat(64) };

export function bytes(value: unknown): Buffer {
  return Buffer.from(`${JSON.stringify(value, null, 2)}\n`);
}

function chapterFixture(context: TestContext): { chapter: ChapterV21; blueprint: unknown; packet: unknown; sourcePlan: unknown } {
  const fixture = compileCreditFixture(BOOK, { stateRoot: resolve(context.roots.tempRoot, "compiler-fixture") });
  const chapter = assembleChapterV21OrThrow({
    plan: fixture.blueprint.plan,
    breakdown: fixture.summary.breakdown,
    examples: fixture.examples.examples,
    quiz: fixture.learning.quiz,
    cards: fixture.learning.cards,
    implementationPlan: fixture.action.implementationPlan,
    keyTakeaway: fixture.summary.keyTakeaway,
    keyTakeawaySourceAnchorIds: fixture.summary.keyTakeawaySourceAnchorIds,
    hook: fixture.summary.hook,
    tryThisNow: fixture.action.tryThisNow,
    tryThisNowSourceAnchorIds: fixture.action.tryThisNowSourceAnchorIds,
  });
  return { chapter, blueprint: fixture.blueprint, packet: fixture.packet, sourcePlan: compileSourceUsePlan(fixture.packet).plan };
}

export function candidate(context: TestContext, scars?: Record<string, unknown> | null): CandidateSnapshot {
  const fixture = chapterFixture(context);
  const second: ChapterV21 = {
    ...fixture.chapter,
    chapterId: `${BOOK}-ch02`,
    number: 2,
    title: "Keep The Signal Clean",
    hook: "Noisy account data can hide careful behavior before a lender sees the fuller pattern.",
  };
  const packetOne = { ...(fixture.packet as Record<string, unknown>), sourceSidecarPath: "research/ch01.source.json" };
  const packetOneHash = sourcePacketHash(packetOne as unknown as SourcePacketV1);
  const blueprintOne = {
    ...(fixture.blueprint as Record<string, unknown>),
    sourcePacketPath: "compiler/ch01/source-packet.json",
    sourcePacketHash: packetOneHash,
  };
  const sourcePlanOne = { ...(fixture.sourcePlan as Record<string, unknown>), sourcePacketSha256: packetOneHash };
  const sourceV2 = (number: number, title: string) => ({ schemaVersion: "source-v2", chapterNumber: number, chapterTitle: title });
  const files = [
    { kind: "CHAPTER" as const, logicalPath: `content/chapters/${BOOK}-ch01.v21-native.chapter.json`, mediaType: "application/json" as const, bytes: bytes(fixture.chapter) },
    { kind: "CHAPTER" as const, logicalPath: `content/chapters/${BOOK}-ch02.v21-native.chapter.json`, mediaType: "application/json" as const, bytes: bytes(second) },
    { kind: "SIDECAR" as const, logicalPath: "compiler/ch01/blueprint.json", mediaType: "application/json" as const, bytes: bytes(blueprintOne) },
    { kind: "SIDECAR" as const, logicalPath: "compiler/ch01/source-packet.json", mediaType: "application/json" as const, bytes: bytes(packetOne) },
    { kind: "SIDECAR" as const, logicalPath: "compiler/ch01/source-use-plan.json", mediaType: "application/json" as const, bytes: bytes(sourcePlanOne) },
    { kind: "SIDECAR" as const, logicalPath: "compiler/ch02/blueprint.json", mediaType: "application/json" as const, bytes: bytes({ ...(fixture.blueprint as object), chapterId: `${BOOK}-ch02`, chapterNumber: 2, title: second.title }) },
    { kind: "SIDECAR" as const, logicalPath: "compiler/ch02/source-packet.json", mediaType: "application/json" as const, bytes: bytes({ ...(fixture.packet as object), chapterId: `${BOOK}-ch02`, chapterNumber: 2, chapterTitle: second.title }) },
    { kind: "SIDECAR" as const, logicalPath: "compiler/ch02/source-use-plan.json", mediaType: "application/json" as const, bytes: bytes({ ...(fixture.sourcePlan as object), chapterNumber: 2 }) },
    { kind: "SIDECAR" as const, logicalPath: "research/ch01.source.json", mediaType: "application/json" as const, bytes: bytes(sourceV2(1, fixture.chapter.title)) },
    { kind: "SIDECAR" as const, logicalPath: "research/ch02.source.json", mediaType: "application/json" as const, bytes: bytes(sourceV2(2, second.title)) },
    { kind: "PROVENANCE" as const, logicalPath: "research/ch01.source.txt", mediaType: "text/plain" as const, bytes: Buffer.from("chapter one source") },
    { kind: "PROVENANCE" as const, logicalPath: "research/ch02.source.txt", mediaType: "text/plain" as const, bytes: Buffer.from("chapter two source") },
    { kind: "SIDECAR" as const, logicalPath: BOOK_PATTERN_AUDIT_LOGICAL_PATH, mediaType: "application/json" as const, bytes: bytes(runBookPatternAudit({ bookId: BOOK, chapters: [fixture.chapter, second], requirePlanArtifacts: false, checkSourceAlignment: false })) },
    ...(scars === undefined ? [] : [{
      kind: "SIDECAR" as const,
      logicalPath: "inputs/compiler-section-task-context.json",
      mediaType: "application/json" as const,
      bytes: bytes({ schemaVersion: "compiler-section-task-context-v1", bookId: BOOK, voiceCard: null, bookScars: scars }),
    }]),
  ].map((file) => ({ ...file, byteLength: file.bytes.byteLength }));
  return {
    manifest: {
      schemaVersion: "1",
      bookId: BOOK,
      candidateId: FAILED.candidateId,
      createdByRunId: "compiler-run",
      entries: files.map(({ bytes: _bytes, ...file }) => file),
      manifestDigest: FAILED.manifestDigest,
      createdAt: context.clock.now(),
    },
    files,
  };
}

export type RigOptions = Readonly<{
  location?: string;
  history?: readonly RepairHistoryRecord[];
  modelOutcome?: "SUCCEEDED" | "UNKNOWN";
  modelNoChange?: boolean;
  issueCode?: string;
  /** Extra findings appended to the failed round — the WARN diagnosis the brief
   *  is supposed to carry, plus the ones it must NOT carry. */
  extraIssues?: readonly QcIssue[];
  diagnosisReturnedId?: string;
  completedHistoryMismatch?: boolean;
  /** undefined = no section-task-context sidecar at all (the pre-wiring shape). */
  scars?: Record<string, unknown> | null;
}>;

export function rig(context: TestContext, options: RigOptions = {}) {
  const predecessor = candidate(context, options.scars);
  const chapterOne = JSON.parse(Buffer.from(predecessor.files[0].bytes).toString("utf8")) as ChapterV21;
  const replacement: ChapterV21 = { ...chapterOne, hook: "A repaired opening names the visible credit signal before the reader can miss it." };
  const failedRound: QcRoundResult = {
    schemaVersion: "1",
    roundId: "qc-failed",
    candidate: FAILED,
    reviewId: "review-failed",
    outcome: "FAIL",
    issues: [
      { code: options.issueCode ?? "CHAPTER_FIX", severity: "BLOCKER", message: "repair chapter opening", location: options.location ?? predecessor.files[0].logicalPath },
      ...(options.extraIssues ?? []),
    ],
    completedAt: context.clock.now(),
  };
  let successor: CandidateSnapshot | null = null;
  let repairRequest: RepairRequest | null = null;
  let appended: RepairHistoryRecord | null = null;
  let storedReview: CanonicalReviewResult | null = null;
  let freshRound: QcRoundResult | null = null;
  const counts = { model: 0, repair: 0, review: 0, qc: 0 };
  const prompts: Parameters<ModelTaskRunner["run"]>[0][] = [];
  const runStore = createFileRunStore(resolve(context.roots.tempRoot, "repair-run-state"));
  const stageCoordinator = createFileStageCoordinator(resolve(context.roots.tempRoot, "repair-run-state"));

  const candidates: CandidateStore = {
    async stage() { throw new Error("unused: fake repair service materializes successor"); },
    async open(input) {
      if (input.selector.kind === "CANDIDATE" && input.selector.candidateId === FAILED.candidateId) return { ok: true, value: predecessor };
      if (input.selector.kind === "CANDIDATE" && input.selector.candidateId === "candidate-successor" && successor) return { ok: true, value: successor };
      return { ok: false, error: { code: "CANDIDATE_NOT_FOUND", message: "not found" } };
    },
  };
  const history: RepairHistoryStore = {
    async list() {
      const completed = appended
        ? [{ ...appended, ...(options.completedHistoryMismatch ? { reviewId: "wrong-review" } : {}) }]
        : [];
      return { ok: true, value: [...(options.history ?? []), ...completed] };
    },
    async append(record) { appended = record; return { ok: true, value: record }; },
  };
  const qc: QcService = {
    async getRound(_bookId, roundId) {
      if (roundId === failedRound.roundId) return { ok: true, value: failedRound };
      if (freshRound && roundId === freshRound.roundId) return { ok: true, value: freshRound };
      return { ok: false, error: { code: "QC_ROUND_NOT_FOUND", message: "missing" } };
    },
    async readStatus() { return { ok: false, error: { code: "UNUSED", message: "unused" } }; },
    async runFresh() { return { ok: false, error: { code: "UNUSED", message: "unused" } }; },
    async diagnose() { return { ok: false, error: { code: "UNUSED", message: "unused" } }; },
    async repairLedger() { return { ok: false, error: { code: "UNUSED", message: "unused" } }; },
  };
  const diagnoses: DiagnosisLookup = {
    async getDiagnosis(_bookId, diagnosisId) {
      return { ok: true, value: { diagnosisId: options.diagnosisReturnedId ?? diagnosisId, roundId: failedRound.roundId, candidate: FAILED, issues: failedRound.issues, createdAt: context.clock.now() } };
    },
  };
  const repairs: RepairService = {
    async createSuccessor(request) {
      counts.repair += 1;
      repairRequest = request;
      const files = request.files.map((file) => ({ ...file, byteLength: file.bytes.byteLength }));
      successor = {
        manifest: {
          schemaVersion: "1",
          bookId: BOOK,
          candidateId: request.successorCandidateId,
          parentCandidateId: FAILED.candidateId,
          createdByRunId: request.createdByRunId,
          entries: files.map(({ bytes: _bytes, ...file }) => file),
          manifestDigest: "b".repeat(64),
          createdAt: request.createdAt,
        },
        files,
      };
      return { ok: true, value: { repairId: request.repairId, predecessor: FAILED, successor: identity(successor), failedRoundId: request.failedRoundId, attemptNumber: 1, requiredNextStep: "CANONICAL_REVIEW" } };
    },
  };
  const reviews: ReviewService = {
    async screen(value) { return { ok: true, value: { candidate: identity(value), outcome: "SHORTLIST", issues: [] } }; },
    async reviewCanonical(input) {
      counts.review += 1;
      storedReview = { schemaVersion: "1", reviewId: input.reviewId, candidate: identity(input.candidate), outcome: "PASS", issues: [], completedAt: context.clock.now() };
      return { ok: true, value: storedReview };
    },
    async get(_bookId, reviewId) {
      return storedReview && storedReview.reviewId === reviewId
        ? { ok: true, value: storedReview }
        : { ok: false, error: { code: "REVIEW_NOT_FOUND", message: "missing" } };
    },
  };
  const runner: ModelTaskRunner = {
    async run(request) {
      counts.model += 1;
      prompts.push(request);
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
      assert.equal(admitted.ok, true);
      const outcome = options.modelOutcome ?? "SUCCEEDED";
      const finished = await runStore.finishAttempt({
        bookId: request.context.bookId,
        runId: request.context.runId,
        attemptId: request.context.attemptId,
        outcome,
        finishedAt: context.clock.now(),
      });
      assert.equal(finished.ok, true);
      return outcome === "SUCCEEDED"
        ? { attemptId: request.context.attemptId, outcome, output: options.modelNoChange ? chapterOne : replacement }
        : { attemptId: request.context.attemptId, outcome, error: { code: "UNCERTAIN", message: "uncertain" } };
    },
  };
  const port = new CandidateRepairApplicationPort({
    pipelineRoot: resolve(context.roots.base, "pipeline"),
    candidates,
    qc,
    history,
    diagnoses,
    runner,
    repairs,
    reviews,
    successorQc: {
      async run(input) {
        counts.qc += 1;
        freshRound = { schemaVersion: "1", roundId: input.roundId, candidate: identity(input.candidate), reviewId: input.canonicalReview.reviewId, outcome: "PASS", issues: [], completedAt: context.clock.now() };
        return { ok: true, value: freshRound };
      },
    },
    runStore,
    stageCoordinator,
    clock: context.clock,
  });
  const request: CandidateRepairApplicationRequest = {
    bookId: BOOK,
    failedCandidate: FAILED,
    failedRoundId: failedRound.roundId,
    repairId: "repair-1",
    successorCandidateId: "candidate-successor",
    reviewId: "review-successor",
    freshRoundId: "qc-fresh",
    repairRunId: "repair-run-1",
    sourceGitSha: "1".repeat(40),
    attemptRoot: resolve(context.roots.attemptsRoot, "repair"),
    signal: new AbortController().signal,
  };
  return { port, request, predecessor, runStore, counts, prompts, successor: () => successor, repairRequest: () => repairRequest, appended: () => appended };
}

export function identity(candidate: CandidateSnapshot): CandidateIdentity {
  return { candidateId: candidate.manifest.candidateId, manifestDigest: candidate.manifest.manifestDigest };
}
