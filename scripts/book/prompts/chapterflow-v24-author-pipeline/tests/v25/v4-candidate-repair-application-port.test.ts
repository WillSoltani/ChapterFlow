import assert from "node:assert/strict";
import { resolve } from "node:path";

import { assembleChapterV21OrThrow } from "../../src/assembler.js";
import type { SourcePacketV1 } from "../../src/artifacts/artifactTypes.js";
import {
  CANDIDATE_REPAIR_PROFILE_ID,
  CandidateRepairApplicationPort,
  type CandidateRepairApplicationRequest,
} from "../../src/app/candidateRepairApplicationPort.js";
import type { ModelTaskRunner } from "../../src/app/modelTaskRunner.js";
import type { CandidateSnapshot, CandidateStore } from "../../src/books/candidateTypes.js";
import { compileSourceUsePlan } from "../../src/compiler/sourceUsePlanCompiler.js";
import { sourcePacketHash } from "../../src/compiler/sourcePacket.js";
import type { CandidateIdentity, Result } from "../../src/contracts/v4Core.js";
import { BOOK_PATTERN_AUDIT_LOGICAL_PATH, runBookPatternAudit } from "../../src/critics/bookPatternAudit.js";
import type { DiagnosisLookup, RepairRequest, RepairService } from "../../src/qc/repairCoordinator.js";
import type { RepairHistoryRecord, RepairHistoryStore } from "../../src/qc/repairHistoryStore.js";
import type { QcRoundResult, QcService } from "../../src/qc/qcTypes.js";
import type { CanonicalReviewResult, ReviewService } from "../../src/review/reviewTypes.js";
import { SOURCE_CONTROLLED_EXECUTION_PROFILES } from "../../src/runtime/executionPolicy.js";
import { renderPrompt } from "../../src/runtime/promptRenderer.js";
import { createFileRunStore } from "../../src/run-state/fileRunStore.js";
import { createFileStageCoordinator } from "../../src/run-state/stageCoordinator.js";
import type { ChapterV21 } from "../../src/types.js";
import { compileCreditFixture } from "../fixtures/creditBookFixture.js";
import { finishV25Tests, requiredTest, type TestContext } from "./harness.js";

const BOOK = "repair-port-book";
const FAILED: CandidateIdentity = { candidateId: "candidate-failed", manifestDigest: "a".repeat(64) };

function bytes(value: unknown): Buffer {
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

function candidate(context: TestContext): CandidateSnapshot {
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

type RigOptions = Readonly<{
  location?: string;
  history?: readonly RepairHistoryRecord[];
  modelOutcome?: "SUCCEEDED" | "UNKNOWN";
  modelNoChange?: boolean;
  issueCode?: string;
  diagnosisReturnedId?: string;
  completedHistoryMismatch?: boolean;
}>;

function rig(context: TestContext, options: RigOptions = {}) {
  const predecessor = candidate(context);
  const chapterOne = JSON.parse(Buffer.from(predecessor.files[0].bytes).toString("utf8")) as ChapterV21;
  const replacement: ChapterV21 = { ...chapterOne, hook: "A repaired opening names the visible credit signal before the reader can miss it." };
  const failedRound: QcRoundResult = {
    schemaVersion: "1",
    roundId: "qc-failed",
    candidate: FAILED,
    reviewId: "review-failed",
    outcome: "FAIL",
    issues: [{ code: options.issueCode ?? "CHAPTER_FIX", severity: "BLOCKER", message: "repair chapter opening", location: options.location ?? predecessor.files[0].logicalPath }],
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

function identity(candidate: CandidateSnapshot): CandidateIdentity {
  return { candidateId: candidate.manifest.candidateId, manifestDigest: candidate.manifest.manifestDigest };
}

requiredTest("scoped repair changes one chapter, preserves untouched bytes, recomputes audit, and runs fresh lifecycle", async (context) => {
  const subject = rig(context);
  const untouchedBefore = Buffer.from(subject.predecessor.files[1].bytes);
  const result = await subject.port.run(subject.request);
  assert.equal(result.ok, true, JSON.stringify(result));
  assert.deepEqual(subject.counts, { model: 1, repair: 1, review: 1, qc: 1 });
  assert.equal(subject.prompts[0].context.operationId, "repair-ch01");
  assert.equal(subject.prompts[0].profileId, CANDIDATE_REPAIR_PROFILE_ID);
  assert.equal(CANDIDATE_REPAIR_PROFILE_ID, "attempt-read-json-v1");
  assert.equal(SOURCE_CONTROLLED_EXECUTION_PROFILES[CANDIDATE_REPAIR_PROFILE_ID].workDirPolicy, "ATTEMPT_ROOT");
  assert.equal(subject.prompts[0].prompt.templateId, "chapterflow-json-v1");
  const rendered = renderPrompt(subject.prompts[0].prompt);
  assert.equal(rendered.ok, true);
  if (rendered.ok) assert.match(Buffer.from(rendered.value).toString("utf8"), /CHAPTERFLOW SOURCE-CONTROLLED JSON TASK V1/);
  assert.deepEqual(subject.prompts[0].prompt.inputs.map((input) => input.name), [
    "control", "failed_chapter", "blueprint", "source_packet", "source_use_plan", "source_context_1", "source_context_2", "qc_findings",
  ]);
  const successor = subject.successor();
  assert.ok(successor);
  assert.deepEqual(Buffer.from(successor.files[1].bytes), untouchedBefore);
  assert.notDeepEqual(Buffer.from(successor.files[0].bytes), Buffer.from(subject.predecessor.files[0].bytes));
  const successorChapters = successor.files
    .filter((file) => file.kind === "CHAPTER")
    .map((file) => JSON.parse(Buffer.from(file.bytes).toString("utf8")) as ChapterV21);
  assert.deepEqual(
    Buffer.from(successor.files.find((file) => file.logicalPath === BOOK_PATTERN_AUDIT_LOGICAL_PATH)!.bytes),
    bytes(runBookPatternAudit({ bookId: BOOK, chapters: successorChapters, requirePlanArtifacts: false, checkSourceAlignment: false })),
  );
  assert.equal(subject.repairRequest()?.failedRoundId, "qc-failed");
  assert.equal(subject.appended()?.freshRoundId, "qc-fresh");
  const run = await subject.runStore.readRun(BOOK, subject.request.repairRunId, context.clock.now());
  assert.equal(run.ok && run.value.status, "COMPLETED");
  assert.equal(run.ok && run.value.attempts.length, 1);
});

requiredTest("completed repair run resumes from exact stored transition with zero model calls", async (context) => {
  const subject = rig(context);
  const first = await subject.port.run(subject.request);
  assert.equal(first.ok, true, JSON.stringify(first));
  const calls = { ...subject.counts };
  const resumed = await subject.port.run(subject.request);
  assert.equal(resumed.ok, true, JSON.stringify(resumed));
  assert.deepEqual(subject.counts, calls);
  assert.equal(subject.counts.model, 1);
  if (first.ok && resumed.ok) {
    assert.deepEqual(identity(resumed.value.predecessor), identity(first.value.predecessor));
    assert.deepEqual(identity(resumed.value.successor), identity(first.value.successor));
    assert.deepEqual(resumed.value.review, first.value.review);
    assert.deepEqual(resumed.value.qc, first.value.qc);
    assert.equal(resumed.value.ordinal, first.value.ordinal);
  }
});

requiredTest("completed repair run rejects mismatched stored transition without model replay", async (context) => {
  const subject = rig(context, { completedHistoryMismatch: true });
  const first = await subject.port.run(subject.request);
  assert.equal(first.ok, true, JSON.stringify(first));
  const modelCalls = subject.counts.model;
  const resumed = await subject.port.run(subject.request);
  assert.equal(resumed.ok, false);
  if (!resumed.ok) assert.equal(resumed.error.code, "REPAIR_COMPLETED_MISMATCH");
  assert.equal(subject.counts.model, modelCalls);
});

requiredTest("unscoped book finding blocks before run or model", async (context) => {
  const subject = rig(context, { location: BOOK_PATTERN_AUDIT_LOGICAL_PATH });
  const result = await subject.port.run(subject.request);
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.error.code, "REPAIR_FINDING_UNSCOPED");
  assert.deepEqual(subject.counts, { model: 0, repair: 0, review: 0, qc: 0 });
  const run = await subject.runStore.readRun(BOOK, subject.request.repairRunId, context.clock.now());
  assert.equal(run.ok, false);
});

requiredTest("compiler artifact blocker requires manual correction before run or model", async (context) => {
  const subject = rig(context, {
    issueCode: "SOURCE_USE_PLAN_INVALID",
    location: "compiler/ch01/source-use-plan.json",
  });
  const result = await subject.port.run(subject.request);
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.error.code, "REPAIR_FINDING_UNSCOPED");
  assert.deepEqual(subject.counts, { model: 0, repair: 0, review: 0, qc: 0 });
  const run = await subject.runStore.readRun(BOOK, subject.request.repairRunId, context.clock.now());
  assert.equal(run.ok, false);
});

requiredTest("second failed successor requires exact diagnosis before model", async (context) => {
  const history: RepairHistoryRecord = {
    schemaVersion: "1",
    repairId: "prior-repair",
    bookId: BOOK,
    ordinal: 1,
    predecessor: { candidateId: "older", manifestDigest: "0".repeat(64) },
    failedRoundId: "older-round",
    successor: FAILED,
    reviewId: "prior-review",
    freshRoundId: "qc-failed",
    qcOutcome: "FAIL",
    completedAt: context.clock.now(),
  };
  const subject = rig(context, { history: [history] });
  const blocked = await subject.port.run(subject.request);
  assert.equal(blocked.ok, false);
  if (!blocked.ok) assert.equal(blocked.error.code, "REPAIR_DIAGNOSIS_REQUIRED");
  assert.equal(subject.counts.model, 0);
  const allowed = await subject.port.run({ ...subject.request, diagnosisId: "diagnosis-qc-failed" });
  assert.equal(allowed.ok, true, JSON.stringify(allowed));
  assert.equal(subject.counts.model, 1);
});

requiredTest("stale diagnosis ID blocks before run or model", async (context) => {
  const history: RepairHistoryRecord = {
    schemaVersion: "1",
    repairId: "prior-repair",
    bookId: BOOK,
    ordinal: 1,
    predecessor: { candidateId: "older", manifestDigest: "0".repeat(64) },
    failedRoundId: "older-round",
    successor: FAILED,
    reviewId: "prior-review",
    freshRoundId: "qc-failed",
    qcOutcome: "FAIL",
    completedAt: context.clock.now(),
  };
  const subject = rig(context, { history: [history], diagnosisReturnedId: "different-diagnosis" });
  const result = await subject.port.run({ ...subject.request, diagnosisId: "diagnosis-qc-failed" });
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.error.code, "REPAIR_DIAGNOSIS_STALE");
  assert.deepEqual(subject.counts, { model: 0, repair: 0, review: 0, qc: 0 });
  const run = await subject.runStore.readRun(BOOK, subject.request.repairRunId, context.clock.now());
  assert.equal(run.ok, false);
});

requiredTest("unknown admitted attempt remains uncertain and creates no successor", async (context) => {
  const subject = rig(context, { modelOutcome: "UNKNOWN" });
  const result = await subject.port.run(subject.request);
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.error.code, "REPAIR_ATTEMPT_UNCERTAIN", JSON.stringify(result));
  assert.equal(subject.counts.repair, 0);
  assert.equal(subject.successor(), null);
  const replay = await subject.port.run(subject.request);
  assert.equal(replay.ok, false);
  if (!replay.ok) assert.equal(replay.error.code, "REPAIR_ATTEMPT_UNCERTAIN");
  assert.equal(subject.counts.model, 1);
});

requiredTest("no-op chapter output is rejected and settled run becomes FAILED", async (context) => {
  const subject = rig(context, { modelNoChange: true });
  const result = await subject.port.run(subject.request);
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.error.code, "REPAIR_OUTPUT_NO_CHANGE");
  assert.equal(subject.counts.repair, 0);
  const run = await subject.runStore.readRun(BOOK, subject.request.repairRunId, context.clock.now());
  assert.equal(run.ok && run.value.status, "FAILED");
});

finishV25Tests().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
