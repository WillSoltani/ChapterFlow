/**
 * HERMETIC END-TO-END PROOF for the two stages that have never executed against a
 * live book: FRESH QC (deterministic gates + the LLM answer-key judge) and
 * PROMOTION.
 *
 * Every stage before review is faked at its application port (research, compile),
 * exactly as the live composition does when its inputs are already durable. From
 * the compiled candidate onward everything is REAL: the real candidate store, the
 * real content reader, the real canonical review service, the real
 * CandidateQcEvaluator (deterministic gates AND the judge loop), the real QC
 * service (round commit + ledger), the real promotion service, and the real
 * file-backed run store / current-pointer store. The only injected fakes are the
 * MODEL SURFACES: one ModelTaskRunner for the canonical review panel and one for
 * the per-question quiz-key judge. Both admit and settle their attempts against
 * the real run store, so run-state capacity and attempt uniqueness are exercised
 * for real.
 */

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";

import { BookRunApplicationService, type BookRunEvent } from "../../src/app/bookRunApplicationService.js";
import { CandidateQcEvaluator } from "../../src/app/candidateQcEvaluator.js";
import type { CandidateRepairApplicationPort } from "../../src/app/candidateRepairApplicationPort.js";
import type { CompilerApplicationPort } from "../../src/app/compilerApplicationPort.js";
import { ModelGatewayReviewEvaluator } from "../../src/app/modelGatewayReviewEvaluator.js";
import type { ModelTaskRunner } from "../../src/app/modelTaskRunner.js";
import type { ResearchCandidateApplicationPort } from "../../src/app/researchCandidateApplicationPort.js";
import { createBookContentReader } from "../../src/books/bookContentReader.js";
import { createBookWriteLock } from "../../src/books/bookLease.js";
import { createCandidateStore } from "../../src/books/candidateStore.js";
import { createCurrentPointerStore, type CurrentPointerStore } from "../../src/books/currentPointer.js";
import type { CandidateInputFile, CandidateSnapshot } from "../../src/books/candidateTypes.js";
import { compileChapterBlueprint } from "../../src/compiler/chapterBlueprint.js";
import { compileSourcePacketFromSidecar } from "../../src/compiler/sourcePacket.js";
import { compileSourceUsePlan } from "../../src/compiler/sourceUsePlanCompiler.js";
import { BOOK_PATTERN_AUDIT_LOGICAL_PATH, runBookPatternAudit } from "../../src/critics/bookPatternAudit.js";
import type { QcEvaluation, QcService } from "../../src/qc/qcTypes.js";
import { createQcService } from "../../src/qc/qcService.js";
import { createQcStore } from "../../src/qc/qcStore.js";
import { createPromotionService } from "../../src/release/promotionService.js";
import type { PromotionService } from "../../src/release/promotionTypes.js";
import { createReviewServiceFactory } from "../../src/review/reviewService.js";
import { createFileRunStore } from "../../src/run-state/fileRunStore.js";
import { createFileStageCoordinator } from "../../src/run-state/stageCoordinator.js";
import type { ModelResult } from "../../src/runtime/modelResult.js";
import type { SourceSidecarV2 } from "../../src/source/sidecarSchema.js";
import type { ChapterV21 } from "../../src/types.js";
import { makeGateCleanChapter } from "../helpers.js";
import { finishV25Tests, requiredTest, type TestContext } from "./harness.js";
import { createCatalogRubricStore } from "../../src/review/catalogRubricStore.js";
import { passingRubricPanel } from "./catalogRubricFakes.js";

const BOOK = "fresh-qc-e2e";
const SOURCE_SHA = "8f14e45fceea167a5a36dedd4bea2543cb1e5d7f";
const BOOK_RUN_ID = "book-run-fresh-qc";

function derived(prefix: string, runId: string): string {
  return `${prefix}-${createHash("sha256").update(runId).digest("hex").slice(0, 32)}`;
}

const COMPILER_RUN_ID = derived("compiler-run", BOOK_RUN_ID);
const COMPILED_CANDIDATE_ID = `${COMPILER_RUN_ID}-candidate`;
const SEED_CANDIDATE_ID = "fresh-qc-seed-candidate";
const QC_ROUND_ID = derived("qc", BOOK_RUN_ID);
const REVIEW_ID = derived("review", BOOK_RUN_ID);

function jsonFile(logicalPath: string, value: unknown, kind: CandidateInputFile["kind"] = "SIDECAR"): CandidateInputFile {
  return { kind, logicalPath, mediaType: "application/json", bytes: Buffer.from(`${JSON.stringify(value)}\n`) };
}

function sidecar(): SourceSidecarV2 {
  const facts = Array.from({ length: 9 }, (_, index) => ({
    id: `ch01.fact.${index + 1}`,
    claim: `Candidate fact ${index + 1} describes a visible behavior change.`,
    becauseMechanism: `Candidate mechanism ${index + 1} connects action and consequence.`,
    commonError: `Candidate error ${index + 1} mistakes intention for action.`,
    errorIsWhy: `Candidate correction ${index + 1} follows observed behavior.`,
  }));
  return {
    schemaVersion: "source-v2",
    chapterNumber: 1,
    chapterTitle: "Candidate Chapter",
    centralConcept: { id: "ch01.concept.candidate", name: "Candidate concept", plainDefinition: "One bounded concept." },
    keyClaims: facts.map((fact) => fact.claim),
    namedExamples: [
      { id: "ch01.case.northstar", label: "Northstar intake review", summary: "Northstar changes one observable intake step.", hardSpecifics: ["Ch. 1 p. 1", "Ch. 1 p. 2"], realWorld: false },
      { id: "ch01.case.harbor", label: "Harbor handoff review", summary: "Harbor tests a second observable handoff step.", hardSpecifics: ["Ch. 1 p. 3", "Ch. 1 p. 4"], realWorld: false },
      { id: "ch01.case.atlas", label: "Atlas record review", summary: "Atlas tests one visible record correction.", hardSpecifics: ["Ch. 1 p. 5", "Ch. 1 p. 6"], realWorld: false },
    ],
    hardEdge: "Do not promise guaranteed outcomes.",
    testableFacts: facts,
  };
}

function bindSourceAnchors(chapter: ChapterV21): void {
  const anchor = "ch01.case.northstar";
  const paths = [
    "hook", "counterintuition", "breakdown.fastRead", "breakdown.deepRead", "breakdown.fullRead", "keyTakeaway", "tryThisNow",
    ...chapter.examples.map((_, index) => `examples[${index}]`),
    ...chapter.quiz.questions.map((_, index) => `quiz.questions[${index}]`),
    ...chapter.reviewCards.map((_, index) => `reviewCards[${index}]`),
    "implementationPlan.title", "implementationPlan.coreSkill", "implementationPlan.twentyFourHourChallenge", "implementationPlan.weeklyPractice",
    ...chapter.implementationPlan.ifThenPlans.map((_, index) => `implementationPlan.ifThenPlans[${index}]`),
    ...(chapter.memorableLines ?? []).map((_, index) => `memorableLines[${index}]`),
  ];
  chapter.authoring = {
    schemaVersion: "chapter-authoring-v1",
    sourceAnchors: {
      schemaVersion: "chapter-source-anchor-map-v1",
      sourceHash: "candidate-source-hash",
      observedAnchorIds: [anchor],
      effectiveAnchors: Object.fromEntries(paths.map((path) => [path, [anchor]])),
    },
  };
}

function gateCleanChapter(): ChapterV21 {
  const chapter = JSON.parse(
    JSON.stringify(makeGateCleanChapter(BOOK, 1)).replace(/the book/gi, "the source"),
  ) as ChapterV21;
  bindSourceAnchors(chapter);
  return chapter;
}

/** The compiled candidate's full inventory: chapter + every compiler artifact the
 *  fresh-qc deterministic gates read. This is what compile(assembly) stages live. */
function compiledFiles(context: TestContext, chapter: ChapterV21): CandidateInputFile[] {
  const spec = { chapterId: chapter.chapterId, chapterNumber: 1, chapterTitle: "Candidate Chapter" };
  const sourcePath = "inputs/source/ch01.source.json";
  const packetPath = "compiler/ch01/source-packet.json";
  const packet = compileSourcePacketFromSidecar({
    bookId: BOOK,
    chapter: spec,
    sidecar: sidecar(),
    sidecarPath: sourcePath,
    sourceHash: "source-hash",
  });
  const blueprint = compileChapterBlueprint({
    bookId: BOOK,
    chapter: spec,
    packet,
    packetPath,
    totalChapters: 1,
    roots: { stateRoot: context.roots.stateRoot },
    salts: { chapters: {} },
  });
  const plan = compileSourceUsePlan(packet).plan;
  return [
    jsonFile(`content/chapters/${chapter.chapterId}.v21-native.chapter.json`, chapter, "CHAPTER"),
    jsonFile(sourcePath, sidecar()),
    jsonFile(packetPath, packet),
    jsonFile("compiler/ch01/blueprint.json", blueprint),
    jsonFile("compiler/ch01/source-use-plan.json", plan),
    jsonFile(BOOK_PATTERN_AUDIT_LOGICAL_PATH, runBookPatternAudit({
      bookId: BOOK,
      chapters: [chapter],
      requirePlanArtifacts: false,
      checkSourceAlignment: false,
    })),
  ];
}

type Judgment = { readonly index: number; readonly confidence: "high" | "medium" | "low" };

async function buildWorld(
  context: TestContext,
  options: Readonly<{
    /** Oracle for the injected quiz-key judge model surface. */
    judge?: (question: Readonly<{ questionId: string; correctIndex: number; choices: readonly string[] }>) => Judgment;
    /** Settle this judge call FAILED (a transient the per-question retry absorbs). */
    transient?: (question: Readonly<{ questionId: string }>) => boolean;
    /** Kill the judge process after the attempt is admitted and before it settles. */
    killAfterAdmit?: () => boolean;
  }> = {},
) {
  const now = () => {
    const value = context.clock.now();
    context.clock.advance(1);
    return value;
  };
  const booksRoot = resolve(context.roots.tempRoot, "books");
  const runRoot = resolve(context.roots.tempRoot, "runs");
  mkdirSync(booksRoot, { recursive: true });
  const writeLock = createBookWriteLock({ booksRoot });
  const currentPointer = createCurrentPointerStore({ booksRoot, writeLock });
  const candidates = createCandidateStore({ booksRoot, writeLock, currentPointerStore: currentPointer });
  const reader = createBookContentReader({ booksRoot, currentPointerStore: currentPointer });
  const runStore = createFileRunStore(runRoot);
  const stageCoordinator = createFileStageCoordinator(runRoot);

  const chapter = gateCleanChapter();
  const stage = async (input: Readonly<{
    candidateId: string;
    runId: string;
    files: readonly CandidateInputFile[];
    parentCandidateId?: string;
  }>): Promise<CandidateSnapshot> => {
    const staged = await candidates.stage({
      bookId: BOOK,
      candidateId: input.candidateId,
      ...(input.parentCandidateId === undefined ? {} : { parentCandidateId: input.parentCandidateId }),
      createdByRunId: input.runId,
      expectedInventory: input.files.map(({ bytes: _bytes, ...file }) => file),
      files: input.files,
      createdAt: now(),
    });
    assert.equal(staged.ok, true, JSON.stringify(staged));
    const opened = await candidates.open({ bookId: BOOK, selector: { kind: "CANDIDATE", candidateId: input.candidateId } });
    assert.ok(opened.ok, JSON.stringify(opened));
    return opened.value;
  };

  const seed = await stage({
    candidateId: SEED_CANDIDATE_ID,
    runId: "fresh-qc-seed-run",
    files: [jsonFile("inputs/chapter-index.json", [{ chapterId: chapter.chapterId, chapterNumber: 1, chapterTitle: chapter.title }])],
  });
  const compiled = await stage({
    candidateId: COMPILED_CANDIDATE_ID,
    parentCandidateId: seed.manifest.candidateId,
    runId: COMPILER_RUN_ID,
    files: compiledFiles(context, chapter),
  });

  // ── model surface 1: the canonical review panel ────────────────────────────
  let reviewCalls = 0;
  const reviewRunner: ModelTaskRunner = {
    async run(request): Promise<ModelResult> {
      reviewCalls += 1;
      const admittedAt = now();
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
        finishedAt: now(),
      });
      assert.equal(finished.ok, true, JSON.stringify(finished));
      return { attemptId: request.context.attemptId, outcome: "SUCCEEDED", output: { outcome: "PASS", issues: [] } };
    },
  };

  // ── model surface 2: the per-question quiz-key judge ───────────────────────
  // The judge deliberately never sees correctIndex, so the oracle recovers the
  // question from the rendered prompt exactly as a real model would read it.
  const questionsByPrompt = new Map(chapter.quiz.questions.map((question) => [question.prompt, question]));
  const judgeAttemptIds: string[] = [];
  const judge = options.judge ?? ((question) => ({ index: question.correctIndex, confidence: "high" as const }));
  const judgeRunner: ModelTaskRunner = {
    async run(request): Promise<ModelResult> {
      const userPrompt = Buffer.from(request.prompt.inputs[1].bytes).toString("utf8");
      // Fresh-qc hosts a SECOND judge on this run: the source-fidelity judge,
      // one call per chapter source chunk. It admits and settles its own
      // run-state attempt exactly as the answer-key judge does (so the capacity
      // and attempt-uniqueness assertions below still cover it) and answers with
      // an empty finding set, keeping these promotion cases about the key judge.
      if (request.context.operationId.startsWith("source-fidelity-judge-")) {
        const fidelityAdmittedAt = now();
        const fidelityAdmitted = await runStore.admitAttempt({
          bookId: request.context.bookId,
          runId: request.context.runId,
          attemptId: request.context.attemptId,
          stageId: request.context.stageId,
          operationId: request.context.operationId,
          admittedAt: fidelityAdmittedAt,
          staleAt: new Date(Date.parse(fidelityAdmittedAt) + 60_000).toISOString(),
        });
        if (!fidelityAdmitted.ok) {
          return { attemptId: request.context.attemptId, outcome: "UNKNOWN", error: { code: fidelityAdmitted.error.code, message: fidelityAdmitted.error.message } };
        }
        const fidelitySettled = await runStore.finishAttempt({
          bookId: request.context.bookId,
          runId: request.context.runId,
          attemptId: request.context.attemptId,
          outcome: "SUCCEEDED",
          finishedAt: now(),
        });
        assert.equal(fidelitySettled.ok, true, JSON.stringify(fidelitySettled));
        return { attemptId: request.context.attemptId, outcome: "SUCCEEDED", output: { findings: [] } };
      }
      const match = /^QUESTION:\n([\s\S]*?)\n\nCHOICES:/.exec(userPrompt);
      assert.ok(match, "quiz-key judge prompt must carry its question");
      const question = questionsByPrompt.get(match[1]);
      assert.ok(question, `unknown judged question: ${match[1]}`);
      judgeAttemptIds.push(request.context.attemptId);
      const admittedAt = now();
      const admitted = await runStore.admitAttempt({
        bookId: request.context.bookId,
        runId: request.context.runId,
        attemptId: request.context.attemptId,
        stageId: request.context.stageId,
        operationId: request.context.operationId,
        admittedAt,
        staleAt: new Date(Date.parse(admittedAt) + 60_000).toISOString(),
      });
      if (!admitted.ok) {
        return { attemptId: request.context.attemptId, outcome: "UNKNOWN", error: { code: admitted.error.code, message: admitted.error.message } };
      }
      if (options.killAfterAdmit?.() === true) {
        // The process dies here: the attempt stays admitted and unsettled.
        throw new Error("SIGKILL: judge process died with an admitted attempt");
      }
      if (options.transient?.({ questionId: question.questionId }) === true) {
        const settled = await runStore.finishAttempt({
          bookId: request.context.bookId,
          runId: request.context.runId,
          attemptId: request.context.attemptId,
          outcome: "FAILED",
          finishedAt: now(),
          detail: "injected transient judge failure",
        });
        assert.equal(settled.ok, true, JSON.stringify(settled));
        return { attemptId: request.context.attemptId, outcome: "FAILED", error: { code: "JUDGE_TRANSIENT", message: "injected transient judge failure" } };
      }
      const verdict = judge({
        questionId: question.questionId,
        correctIndex: question.correctIndex,
        choices: question.choices,
      });
      const finished = await runStore.finishAttempt({
        bookId: request.context.bookId,
        runId: request.context.runId,
        attemptId: request.context.attemptId,
        outcome: "SUCCEEDED",
        finishedAt: now(),
      });
      assert.equal(finished.ok, true, JSON.stringify(finished));
      return {
        attemptId: request.context.attemptId,
        outcome: "SUCCEEDED",
        output: {
          index: verdict.index,
          confidence: verdict.confidence,
          correctText: question.choices[verdict.index],
          reason: "scripted hermetic verdict",
        },
      };
    },
  };

  const reviews = createReviewServiceFactory({ booksRoot, contentReader: reader, now })
    .create(new ModelGatewayReviewEvaluator(reviewRunner));
  const qc = createQcService({ booksRoot, contentReader: reader, reviewService: reviews, writeLock, now });
  const promotion = createPromotionService({
    candidateStore: candidates,
    contentReader: reader,
    reviewService: reviews,
    qcService: qc,
    currentPointerStore: currentPointer,
    clock: now,
  });
  const candidateQc = new CandidateQcEvaluator(reader, { runner: judgeRunner });

  const research = {
    async run(request: { resumeRunId?: string; newRunId?: string }) {
      return {
        schemaVersion: "1" as const,
        bookId: BOOK,
        title: "Fresh QC End To End",
        author: "Fixture Author",
        intakeRunId: request.resumeRunId ?? request.newRunId ?? BOOK_RUN_ID,
        researchRunId: "research-fresh-qc-fixture",
        candidate: { candidateId: seed.manifest.candidateId, manifestDigest: seed.manifest.manifestDigest },
        indexLogicalPath: "inputs/chapter-index.json" as const,
        sectionTaskContextLogicalPath: "inputs/compiler-section-task-context.json" as const,
        sources: [],
        resumed: request.resumeRunId !== undefined,
      };
    },
  } as unknown as ResearchCandidateApplicationPort;

  let compilerRunPersisted = false;
  const compiler = {
    async run(request: { resumeRunId?: string }) {
      assert.equal(request.resumeRunId, COMPILER_RUN_ID);
      if (!compilerRunPersisted) {
        const created = await runStore.createRun({
          schemaVersion: "1",
          bookId: BOOK,
          runId: COMPILER_RUN_ID,
          commandId: "compiler-candidate",
          sourceGitSha: SOURCE_SHA,
          requiredStages: ["compiler-candidate"],
          requiredInventory: [],
          inputCandidate: { candidateId: seed.manifest.candidateId, manifestDigest: seed.manifest.manifestDigest },
          attemptLimits: { run: 4, byStage: { "compiler-candidate": 4 } },
          createdAt: now(),
        });
        assert.ok(created.ok, JSON.stringify(created));
        const finished = await runStore.finishRun({ bookId: BOOK, runId: COMPILER_RUN_ID, status: "COMPLETED", finishedAt: now() });
        assert.ok(finished.ok, JSON.stringify(finished));
        compilerRunPersisted = true;
      }
      return {
        runId: COMPILER_RUN_ID,
        runStatus: "COMPLETED" as const,
        candidateId: compiled.manifest.candidateId,
        manifestDigest: compiled.manifest.manifestDigest,
      };
    },
  } as unknown as CompilerApplicationPort;

  const events: BookRunEvent[] = [];
  const service = (overrides: Readonly<{
    promotion?: PromotionService;
    currentPointer?: CurrentPointerStore;
    repair?: CandidateRepairApplicationPort;
    qc?: QcService;
  }> = {}) => new BookRunApplicationService({
    research,
    compiler,
    ...(overrides.repair === undefined ? {} : { repair: overrides.repair }),
    contentReader: reader,
    candidateQc,
    reviews,
    qc: overrides.qc ?? qc,
    diagnoses: createQcStore({ booksRoot }),
    // R-080 — the whole-book rubric gate every book run now passes through.
    // These cases are about OTHER lanes, so the panel is a passing fake and the
    // store is the real one: the gate is exercised, not bypassed.
    rubric: passingRubricPanel(),
    rubricStore: createCatalogRubricStore({ booksRoot }),
    promotion: overrides.promotion ?? promotion,
    currentPointer: overrides.currentPointer ?? currentPointer,
    runStore,
    stageCoordinator,
    clock: { now },
    ids: {
      nextRunId: () => BOOK_RUN_ID,
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

  const request = (overrides: Partial<Parameters<BookRunApplicationService["run"]>[0]> = {}) => ({
    bookId: BOOK,
    title: "Fresh QC End To End",
    author: "Fixture Author",
    sourceGitSha: SOURCE_SHA,
    v25Root: resolve(context.roots.tempRoot, "v25"),
    attemptRoot: resolve(context.roots.attemptsRoot, "fresh-qc"),
    regen: true,
    maxRepairRounds: 1 as const,
    promoteLocal: true,
    signal: new AbortController().signal,
    ...overrides,
  });

  return {
    now, booksRoot, runRoot, writeLock, currentPointer, candidates, reader, runStore, stageCoordinator,
    chapter, seed, compiled, stage, reviews, qc, promotion, service, request, events,
    judgeAttemptIds,
    reviewCalls: () => reviewCalls,
    judgeCalls: () => judgeAttemptIds.length,
  };
}

function completedPhases(events: readonly BookRunEvent[]): string[] {
  return events.filter((event) => event.status === "COMPLETED").map((event) => event.phase);
}

requiredTest("fresh QC judge PASS commits a durable round and promotes the reviewed candidate end to end", async (context: TestContext) => {
  const world = await buildWorld(context);
  const result = await world.service().run(world.request());
  if (!result.ok) throw new Error(`BOOK_RUN_RESULT:${JSON.stringify(result.error)}`);
  assert.equal(result.value.status, "PROMOTED");
  assert.equal(result.value.readback, "VERIFIED");
  assert.equal(result.value.bookRevision, 1);
  assert.equal(result.value.qcRoundId, QC_ROUND_ID);
  assert.equal(result.value.reviewId, REVIEW_ID);
  assert.deepEqual(result.value.candidate, {
    candidateId: world.compiled.manifest.candidateId,
    manifestDigest: world.compiled.manifest.manifestDigest,
  });

  // The judge really ran: one model call per quiz question, each with a distinct
  // attempt id admitted against the real run store.
  assert.equal(world.judgeCalls(), world.chapter.quiz.questions.length);
  assert.equal(new Set(world.judgeAttemptIds).size, world.judgeAttemptIds.length, "each judged question mints a distinct attempt");

  // The QC round is durable, PASS, and bound to the exact reviewed candidate.
  const round = await world.qc.getRound(BOOK, QC_ROUND_ID);
  assert.ok(round.ok, JSON.stringify(round));
  assert.equal(round.value.outcome, "PASS");
  assert.equal(round.value.reviewId, REVIEW_ID);
  assert.deepEqual(round.value.candidate, {
    candidateId: world.compiled.manifest.candidateId,
    manifestDigest: world.compiled.manifest.manifestDigest,
  });
  assert.equal(round.value.issues.some((issue) => issue.severity === "BLOCKER"), false, JSON.stringify(round.value.issues));

  // The QC ledger's authoritative status is clean.
  const status = await world.qc.readStatus(BOOK);
  assert.ok(status.ok, JSON.stringify(status));
  assert.equal(status.value.issues.some((issue) => issue.severity === "BLOCKER"), false, JSON.stringify(status.value.issues));

  // The promoted pointer is durable and CURRENT reads back the promoted bytes.
  const pointer = await world.currentPointer.read(BOOK);
  assert.ok(pointer.ok && pointer.value, JSON.stringify(pointer));
  assert.equal(pointer.value.revision, 1);
  assert.equal(pointer.value.candidateId, world.compiled.manifest.candidateId);
  assert.equal(pointer.value.manifestDigest, world.compiled.manifest.manifestDigest);
  const current = await world.reader.open({ bookId: BOOK, selector: { kind: "CURRENT" } });
  assert.ok(current.ok, JSON.stringify(current));
  assert.equal(current.value.currentRevision, 1);
  assert.equal(current.value.manifest.candidateId, world.compiled.manifest.candidateId);

  // The judge's own run is durably settled: the service commits the round first
  // and finishes the run second, and that finish must actually land.
  const judgeRun = await world.runStore.readRun(BOOK, derived("qc-judge-run", BOOK_RUN_ID), world.now());
  assert.ok(judgeRun.ok, JSON.stringify(judgeRun));
  assert.equal(judgeRun.value.status, "COMPLETED", "the fresh-qc judge run must not be left RUNNING");
  // One attempt per quiz question (the answer-key judge) plus one per chapter
  // source chunk (the source-fidelity judge). This fixture book is one chapter
  // researched WITHOUT a source text, so its fidelity judgment is a single
  // model-memory call — hence exactly one extra admission.
  assert.equal(judgeRun.value.attempts.length, world.chapter.quiz.questions.length + 1);
  assert.equal(
    judgeRun.value.attempts.filter((attempt) => attempt.admission.operationId.startsWith("source-fidelity-judge-")).length,
    1,
    "the source-fidelity judge admits its own attempt against the same fresh-qc run",
  );
  assert.equal(judgeRun.value.attempts.every((attempt) => attempt.status === "SUCCEEDED"), true);

  // The durable phase-event sequence is the whole contract of the run.
  assert.deepEqual(completedPhases(world.events), [
    // R-080: the whole-book rubric gate between the fresh QC PASS and promotion.
    "intake", "research", "seed", "compile", "review", "fresh-qc", "rubric", "promotion",
  ]);
  assert.ok(world.events.some((event) => event.phase === "repair" && event.status === "SKIPPED"));
  const qcCompleted = world.events.find((event) => event.phase === "fresh-qc" && event.status === "COMPLETED");
  assert.equal(qcCompleted?.detail, `outcome=PASS;roundId=${QC_ROUND_ID}`);
});

requiredTest("a fresh QC FAIL routes to repair and promotes the repaired successor", async (context: TestContext) => {
  // The judge confidently contradicts the stored key on the FIRST question only:
  // one wrong-key BLOCKER, which is exactly what a live first promotion hits.
  let firstQuestionId: string | undefined;
  const world = await buildWorld(context, {
    judge: (question) => {
      firstQuestionId ??= question.questionId;
      return question.questionId === firstQuestionId
        ? { index: (question.correctIndex + 1) % question.choices.length, confidence: "high" }
        : { index: question.correctIndex, confidence: "high" };
    },
  });

  const repairRunId = derived("repair-run", BOOK_RUN_ID);
  const successorId = derived("repair-candidate", BOOK_RUN_ID);
  const repairReviewId = derived("repair-review", BOOK_RUN_ID);
  const repairRoundId = derived("repair-qc", BOOK_RUN_ID);
  let repairCalls = 0;
  const repair = {
    async run(request: {
      bookId: string;
      failedCandidate: { candidateId: string; manifestDigest: string };
      failedRoundId: string;
      repairId: string;
      successorCandidateId: string;
      reviewId: string;
      freshRoundId: string;
      repairRunId: string;
      attemptRoot: string;
      signal: AbortSignal;
    }) {
      repairCalls += 1;
      assert.equal(request.bookId, BOOK);
      assert.equal(request.failedRoundId, QC_ROUND_ID);
      assert.equal(request.repairRunId, repairRunId);
      assert.deepEqual(request.failedCandidate, {
        candidateId: world.compiled.manifest.candidateId,
        manifestDigest: world.compiled.manifest.manifestDigest,
      });
      // The durable FAIL round the repair is scoped from must already exist.
      const failed = await world.qc.getRound(BOOK, request.failedRoundId);
      assert.ok(failed.ok, JSON.stringify(failed));
      assert.equal(failed.value.outcome, "FAIL");

      // Stage a successor whose repaired chapter differs from the predecessor.
      const repaired = gateCleanChapter();
      repaired.keyTakeaway = `${repaired.keyTakeaway} The repaired key now matches the marked choice.`;
      const files = compiledFiles(context, repaired);
      const successor = await world.stage({
        candidateId: request.successorCandidateId,
        parentCandidateId: request.failedCandidate.candidateId,
        runId: request.repairRunId,
        files,
      });

      const created = await world.runStore.createRun({
        schemaVersion: "1",
        bookId: BOOK,
        runId: request.repairRunId,
        commandId: "candidate-repair",
        sourceGitSha: SOURCE_SHA,
        requiredStages: ["candidate-repair"],
        requiredInventory: successor.manifest.entries.map(({ kind, logicalPath, mediaType }) => ({ kind, logicalPath, mediaType })),
        inputCandidate: request.failedCandidate,
        attemptLimits: { run: 4, byStage: { "candidate-repair": 4 } },
        createdAt: world.now(),
      });
      assert.ok(created.ok, JSON.stringify(created));
      const review = await world.reviews.reviewCanonical({
        reviewId: request.reviewId,
        candidate: successor,
        taskContext: {
          bookId: BOOK,
          runId: request.repairRunId,
          attemptId: `${request.repairRunId}-review`,
          stageId: "candidate-repair",
          operationId: "repair-review",
          workDir: resolve(context.roots.tempRoot, "repair-workdir"),
          signal: request.signal,
        },
      });
      assert.ok(review.ok, JSON.stringify(review));
      assert.equal(review.value.outcome, "PASS");
      const evaluation: QcEvaluation = {
        roundId: request.freshRoundId,
        candidate: { candidateId: successor.manifest.candidateId, manifestDigest: successor.manifest.manifestDigest },
        reviewId: review.value.reviewId,
        outcome: "PASS",
        issues: [],
      };
      const round = await world.qc.runFresh({
        roundId: request.freshRoundId,
        candidate: successor,
        canonicalReview: review.value,
        evaluation,
      });
      assert.ok(round.ok, JSON.stringify(round));
      const finished = await world.runStore.finishRun({ bookId: BOOK, runId: request.repairRunId, status: "COMPLETED", finishedAt: world.now() });
      assert.ok(finished.ok, JSON.stringify(finished));
      return {
        ok: true as const,
        value: {
          status: "PASS" as const,
          ordinal: 1,
          predecessor: world.compiled,
          successor,
          review: review.value,
          qc: round.value,
        },
      };
    },
  } as unknown as CandidateRepairApplicationPort;

  const result = await world.service({ repair }).run(world.request());
  if (!result.ok) throw new Error(`BOOK_RUN_REPAIR_RESULT:${JSON.stringify(result.error)}`);
  assert.equal(repairCalls, 1);
  assert.equal(result.value.status, "PROMOTED");
  assert.equal(result.value.candidate.candidateId, successorId);
  assert.equal(result.value.qcRoundId, repairRoundId);
  assert.equal(result.value.reviewId, repairReviewId);
  assert.equal(result.value.bookRevision, 1);

  // The FAIL round stays durable next to the repaired PASS round.
  const failedRound = await world.qc.getRound(BOOK, QC_ROUND_ID);
  assert.ok(failedRound.ok, JSON.stringify(failedRound));
  assert.equal(failedRound.value.outcome, "FAIL");
  assert.ok(
    failedRound.value.issues.some((issue) => issue.code === "QC1.wrong_quiz_key" && issue.severity === "BLOCKER"),
    JSON.stringify(failedRound.value.issues),
  );

  // The book's authoritative QC status must reflect the repaired PASS round, not
  // the superseded FAIL: a promoted book whose ledger status still reads BLOCKER
  // is a book every later gate refuses to touch.
  const status = await world.qc.readStatus(BOOK);
  assert.ok(status.ok, JSON.stringify(status));
  assert.equal(
    status.value.issues.some((issue) => issue.severity === "BLOCKER"),
    false,
    JSON.stringify(status.value.issues),
  );

  const pointer = await world.currentPointer.read(BOOK);
  assert.ok(pointer.ok && pointer.value, JSON.stringify(pointer));
  assert.equal(pointer.value.candidateId, successorId);
  assert.deepEqual(completedPhases(world.events), [
    // R-080: the whole-book rubric gate runs on the REPAIRED successor, between
    // the repair that produced it and the promotion it authorizes.
    "intake", "research", "seed", "compile", "review", "fresh-qc", "repair", "rubric", "promotion",
  ]);
});

requiredTest("promotion racing a concurrent pointer write fails closed and never clobbers the rival", async (context: TestContext) => {
  const world = await buildWorld(context);
  // A rival candidate another operator promotes between this run's pre-promotion
  // pointer read and its own CAS.
  const rival = await world.stage({
    candidateId: "rival-candidate",
    runId: "rival-run",
    files: compiledFiles(context, gateCleanChapter()),
  });
  let raced = false;
  const racingPointer: CurrentPointerStore = {
    async read(bookId) {
      const value = await world.currentPointer.read(bookId);
      // Race exactly once, on the first read AFTER the QC round is durable —
      // i.e. the book-run's own pre-promotion pointer check.
      const roundCommitted = await world.qc.getRound(BOOK, QC_ROUND_ID);
      if (!raced && roundCommitted.ok) {
        raced = true;
        const rivalCommit = await world.currentPointer.compareAndSet({
          bookId: BOOK,
          expectedRevision: 0,
          next: {
            schemaVersion: "1",
            bookId: BOOK,
            candidateId: rival.manifest.candidateId,
            manifestDigest: rival.manifest.manifestDigest,
            revision: 1,
            updatedAt: world.now(),
          },
        });
        assert.ok(rivalCommit.ok, JSON.stringify(rivalCommit));
      }
      return value;
    },
    compareAndSet(input) {
      return world.currentPointer.compareAndSet(input);
    },
  };

  const result = await world.service({ currentPointer: racingPointer }).run(world.request());
  assert.equal(result.ok, false, "a lost pointer race must never report a promotion");
  if (!result.ok) {
    assert.equal(result.error.code, "REVISION_CONFLICT", JSON.stringify(result.error));
    assert.equal(result.error.retryable, true);
  }
  assert.equal(raced, true, "the concurrent write must actually have landed");
  const pointer = await world.currentPointer.read(BOOK);
  assert.ok(pointer.ok && pointer.value, JSON.stringify(pointer));
  assert.equal(pointer.value.candidateId, rival.manifest.candidateId, "the rival promotion must survive intact");
  assert.equal(pointer.value.revision, 1);
  assert.ok(world.events.some((event) => event.phase === "promotion" && event.status === "FAILED"));
  assert.equal(world.events.some((event) => event.phase === "promotion" && event.status === "COMPLETED"), false);
});

requiredTest("a crash between the QC commit and promotion resumes onto the durable round without re-judging", async (context: TestContext) => {
  const world = await buildWorld(context);
  const crashing: PromotionService = {
    promote() {
      throw new Error("SIGKILL: process died between QC commit and pointer CAS");
    },
  };
  await assert.rejects(
    world.service({ promotion: crashing }).run(world.request()),
    /SIGKILL/,
  );
  const judgedBeforeCrash = world.judgeCalls();
  const reviewedBeforeCrash = world.reviewCalls();
  assert.ok(judgedBeforeCrash > 0, "the judge must have run before the crash");
  const round = await world.qc.getRound(BOOK, QC_ROUND_ID);
  assert.ok(round.ok, "the QC round must be durable across the crash");
  assert.equal(round.value.outcome, "PASS");
  const crashedPointer = await world.currentPointer.read(BOOK);
  assert.ok(crashedPointer.ok, JSON.stringify(crashedPointer));
  assert.equal(crashedPointer.value, null, "no pointer may exist after a pre-CAS crash");

  const resumed = await world.service().run(world.request({ resumeRunId: BOOK_RUN_ID }));
  if (!resumed.ok) throw new Error(`BOOK_RUN_RESUME_RESULT:${JSON.stringify(resumed.error)}`);
  assert.equal(resumed.value.status, "PROMOTED");
  assert.equal(resumed.value.bookRevision, 1);
  assert.equal(resumed.value.qcRoundId, QC_ROUND_ID);
  assert.equal(world.judgeCalls(), judgedBeforeCrash, "a resumed run must reuse the committed round, never re-judge");
  assert.equal(world.reviewCalls(), reviewedBeforeCrash, "a resumed run must replay the stored canonical review model-free");
  const pointer = await world.currentPointer.read(BOOK);
  assert.ok(pointer.ok && pointer.value, JSON.stringify(pointer));
  assert.equal(pointer.value.revision, 1);
  assert.equal(pointer.value.candidateId, world.compiled.manifest.candidateId);
});

requiredTest("a crash after the pointer CAS resumes to VERIFIED without a second revision", async (context: TestContext) => {
  const world = await buildWorld(context);
  const crashAfterCommit: PromotionService = {
    async promote(request) {
      await world.promotion.promote(request);
      throw new Error("SIGKILL: process died after the pointer CAS committed");
    },
  };
  await assert.rejects(
    world.service({ promotion: crashAfterCommit }).run(world.request()),
    /SIGKILL/,
  );
  const committed = await world.currentPointer.read(BOOK);
  assert.ok(committed.ok && committed.value, JSON.stringify(committed));
  assert.equal(committed.value.revision, 1);
  assert.equal(
    world.events.some((event) => event.phase === "promotion" && event.status === "COMPLETED"),
    false,
    "the crash must land before the durable promotion COMPLETED event",
  );

  const resumed = await world.service().run(world.request({ resumeRunId: BOOK_RUN_ID }));
  if (!resumed.ok) throw new Error(`BOOK_RUN_POST_CAS_RESUME:${JSON.stringify(resumed.error)}`);
  assert.equal(resumed.value.status, "PROMOTED");
  assert.equal(resumed.value.readback, "VERIFIED");
  assert.equal(resumed.value.bookRevision, 1, "a post-CAS resume must not mint a second revision");
  const pointer = await world.currentPointer.read(BOOK);
  assert.ok(pointer.ok && pointer.value, JSON.stringify(pointer));
  assert.equal(pointer.value.revision, 1);
  const resumedEvent = world.events.find(
    (event) => event.phase === "promotion" && event.status === "COMPLETED",
  );
  assert.equal(resumedEvent?.detail, "bookRevision=1;resumedReadback=VERIFIED");
});

requiredTest("a fresh QC FAIL with no repair composed fails closed and never promotes", async (context: TestContext) => {
  let firstQuestionId: string | undefined;
  const world = await buildWorld(context, {
    judge: (question) => {
      firstQuestionId ??= question.questionId;
      return question.questionId === firstQuestionId
        ? { index: (question.correctIndex + 1) % question.choices.length, confidence: "high" }
        : { index: question.correctIndex, confidence: "high" };
    },
  });
  const result = await world.service().run(world.request());
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.error.code, "BOOK_RUN_REPAIR_UNAVAILABLE", JSON.stringify(result.error));
  const round = await world.qc.getRound(BOOK, QC_ROUND_ID);
  assert.ok(round.ok, "the FAIL round stays durable for qc-diagnose");
  assert.equal(round.value.outcome, "FAIL");
  const pointer = await world.currentPointer.read(BOOK);
  assert.ok(pointer.ok, JSON.stringify(pointer));
  assert.equal(pointer.value, null, "a failed QC round must never reach the pointer");
  // The durable FAIL round is diagnosable — the operator's documented next step.
  const diagnosis = await world.qc.diagnose(BOOK, QC_ROUND_ID);
  assert.ok(diagnosis.ok, JSON.stringify(diagnosis));
  assert.ok(diagnosis.value.issues.some((issue) => issue.code === "QC1.wrong_quiz_key"));
});

requiredTest("a rival pointer commit landing inside the promotion CAS window fails closed", async (context: TestContext) => {
  // The tighter race: this run's own pre-promotion read AND the promotion
  // service's read both see revision 0, and the rival lands between that read
  // and the compare-and-set. Only the atomic CAS can catch it.
  const world = await buildWorld(context);
  const rival = await world.stage({
    candidateId: "cas-window-rival",
    runId: "cas-window-rival-run",
    files: compiledFiles(context, gateCleanChapter()),
  });
  let raced = false;
  const racingPointer: CurrentPointerStore = {
    read: (bookId) => world.currentPointer.read(bookId),
    async compareAndSet(input) {
      if (!raced) {
        raced = true;
        const rivalCommit = await world.currentPointer.compareAndSet({
          bookId: BOOK,
          expectedRevision: 0,
          next: {
            schemaVersion: "1",
            bookId: BOOK,
            candidateId: rival.manifest.candidateId,
            manifestDigest: rival.manifest.manifestDigest,
            revision: 1,
            updatedAt: world.now(),
          },
        });
        assert.ok(rivalCommit.ok, JSON.stringify(rivalCommit));
      }
      return world.currentPointer.compareAndSet(input);
    },
  };
  const promotion = createPromotionService({
    candidateStore: world.candidates,
    contentReader: world.reader,
    reviewService: world.reviews,
    qcService: world.qc,
    currentPointerStore: racingPointer,
    clock: world.now,
  });
  const result = await world.service({ promotion }).run(world.request());
  assert.equal(result.ok, false, "a CAS-window race must never report a promotion");
  if (!result.ok) assert.equal(result.error.code, "REVISION_CONFLICT", JSON.stringify(result.error));
  assert.equal(raced, true);
  const pointer = await world.currentPointer.read(BOOK);
  assert.ok(pointer.ok && pointer.value, JSON.stringify(pointer));
  assert.equal(pointer.value.candidateId, rival.manifest.candidateId);
  assert.equal(pointer.value.revision, 1, "the losing CAS must not bump the revision");
});

requiredTest("promoteLocal=false stops at READY with a committed round and no pointer", async (context: TestContext) => {
  const world = await buildWorld(context);
  const result = await world.service().run(world.request({ promoteLocal: false }));
  if (!result.ok) throw new Error(`BOOK_RUN_READY:${JSON.stringify(result.error)}`);
  assert.equal(result.value.status, "READY");
  assert.equal(result.value.bookRevision, undefined);
  assert.equal(result.value.readback, undefined);
  const round = await world.qc.getRound(BOOK, QC_ROUND_ID);
  assert.ok(round.ok && round.value.outcome === "PASS", JSON.stringify(round));
  const pointer = await world.currentPointer.read(BOOK);
  assert.ok(pointer.ok, JSON.stringify(pointer));
  assert.equal(pointer.value, null, "a READY run must never write the current pointer");
  assert.ok(world.events.some((event) => event.phase === "promotion" && event.status === "SKIPPED"));
});

requiredTest("a transient judge failure retries onto a fresh attempt inside the run's sized capacity", async (context: TestContext) => {
  // The fresh-qc run is sized questionCount * QUIZ_JUDGE_MAX_ATTEMPTS precisely so
  // one flaky call per question can retry. Fail the FIRST call of every question.
  const failedOnce = new Set<string>();
  const world = await buildWorld(context, {
    transient: (question) => {
      if (failedOnce.has(question.questionId)) return false;
      failedOnce.add(question.questionId);
      return true;
    },
  });
  const result = await world.service().run(world.request());
  if (!result.ok) throw new Error(`BOOK_RUN_JUDGE_RETRY:${JSON.stringify(result.error)}`);
  assert.equal(result.value.status, "PROMOTED");
  assert.equal(
    world.judgeCalls(),
    world.chapter.quiz.questions.length * 2,
    "every question must burn exactly one retry",
  );
  assert.equal(new Set(world.judgeAttemptIds).size, world.judgeAttemptIds.length, "a retry must mint a distinct attempt id");
  const round = await world.qc.getRound(BOOK, QC_ROUND_ID);
  assert.ok(round.ok && round.value.outcome === "PASS", JSON.stringify(round));
});

requiredTest("a judge killed mid-question resumes onto a successor judge run and leaves no unsettled predecessor", async (context: TestContext) => {
  // Hard kill: the attempt is admitted and the process dies before it settles —
  // the exact shape run-state's UNSETTLED_ATTEMPTS guard exists for.
  let kill = true;
  const world = await buildWorld(context, { killAfterAdmit: () => kill });
  const crashed = await world.service().run(world.request());
  assert.equal(crashed.ok, false, "an unrunnable judge must never commit a round");
  if (!crashed.ok) assert.equal(crashed.error.code, "CANDIDATE_QC_JUDGE_UNAVAILABLE", JSON.stringify(crashed.error));
  const missing = await world.qc.getRound(BOOK, QC_ROUND_ID);
  assert.equal(missing.ok, false, "no round may be committed for a judge that could not run");

  const baseJudgeRunId = derived("qc-judge-run", BOOK_RUN_ID);
  kill = false;
  const resumed = await world.service().run(world.request({ resumeRunId: BOOK_RUN_ID }));
  if (!resumed.ok) throw new Error(`BOOK_RUN_JUDGE_KILL_RESUME:${JSON.stringify(resumed.error)}`);
  assert.equal(resumed.value.status, "PROMOTED");
  const round = await world.qc.getRound(BOOK, QC_ROUND_ID);
  assert.ok(round.ok && round.value.outcome === "PASS", JSON.stringify(round));

  // The abandoned predecessor must be DURABLY terminal. Leaving it RUNNING with
  // admitted-unsettled attempts strands the crashed run in run-state forever and
  // makes every later reader (cancel, doctor, capacity accounting) see live work
  // that no process owns.
  const predecessor = await world.runStore.readRun(BOOK, baseJudgeRunId, world.now());
  assert.ok(predecessor.ok, JSON.stringify(predecessor));
  assert.equal(predecessor.value.status, "FAILED", "the crashed judge run must be abandoned terminal FAILED");
  assert.equal(
    predecessor.value.attempts.every((attempt) => attempt.status !== "ACTIVE"),
    true,
    "no attempt of an abandoned judge run may remain ACTIVE",
  );
  const successor = await world.runStore.readRun(BOOK, `${baseJudgeRunId}-r2`, world.now());
  assert.ok(successor.ok, "the re-judge must run under a distinct successor run");
  assert.equal(successor.value.status, "COMPLETED");
});

requiredTest("a crash between the round commit and the judge run finish settles the run on resume without re-judging", async (context: TestContext) => {
  const world = await buildWorld(context);
  const baseJudgeRunId = derived("qc-judge-run", BOOK_RUN_ID);
  let armed = true;
  const crashingQc = {
    ...world.qc,
    readStatus: (bookId: string) => world.qc.readStatus(bookId),
    getRound: (bookId: string, roundId: string) => world.qc.getRound(bookId, roundId),
    diagnose: (bookId: string, roundId: string) => world.qc.diagnose(bookId, roundId),
    repairLedger: (request: Parameters<typeof world.qc.repairLedger>[0]) => world.qc.repairLedger(request),
    async runFresh(input: Parameters<typeof world.qc.runFresh>[0]) {
      const committed = await world.qc.runFresh(input);
      if (armed) throw new Error("SIGKILL: process died after the QC round commit");
      return committed;
    },
  };
  await assert.rejects(world.service({ qc: crashingQc }).run(world.request()), /SIGKILL/);
  const judgedBeforeCrash = world.judgeCalls();
  const committed = await world.qc.getRound(BOOK, QC_ROUND_ID);
  assert.ok(committed.ok, "the round is committed before the judge run is finished");
  const stranded = await world.runStore.readRun(BOOK, baseJudgeRunId, world.now());
  assert.ok(stranded.ok && stranded.value.status === "RUNNING", "the crash strands the judge run RUNNING");

  armed = false;
  const resumed = await world.service().run(world.request({ resumeRunId: BOOK_RUN_ID }));
  if (!resumed.ok) throw new Error(`BOOK_RUN_ROUND_COMMIT_CRASH:${JSON.stringify(resumed.error)}`);
  assert.equal(resumed.value.status, "PROMOTED");
  assert.equal(world.judgeCalls(), judgedBeforeCrash, "the committed round is authoritative — never re-judge");
  const settled = await world.runStore.readRun(BOOK, baseJudgeRunId, world.now());
  assert.ok(settled.ok, JSON.stringify(settled));
  assert.equal(settled.value.status, "COMPLETED", "resume settles the stranded judge run");
});

requiredTest("a crash between the round commit and the finish of a SUCCESSOR judge run is settled too", async (context: TestContext) => {
  // Two crashes stacked, which is what a real first fresh-qc actually looks like:
  //   1. the base judge run is killed mid-question   -> abandoned, re-judge on -r2
  //   2. -r2 commits the round and dies before finishing
  // The committed round short-circuits every later resume BEFORE the successor
  // walk runs, so if the settle only ever looks at the base id, -r2 stays RUNNING
  // in run-state forever with no process owning it.
  const baseJudgeRunId = derived("qc-judge-run", BOOK_RUN_ID);
  let kill = true;
  const world = await buildWorld(context, { killAfterAdmit: () => kill });
  const crashed = await world.service().run(world.request());
  assert.equal(crashed.ok, false);
  kill = false;

  let armed = true;
  const crashingQc = {
    readStatus: (bookId: string) => world.qc.readStatus(bookId),
    getRound: (bookId: string, roundId: string) => world.qc.getRound(bookId, roundId),
    diagnose: (bookId: string, roundId: string) => world.qc.diagnose(bookId, roundId),
    repairLedger: (request: Parameters<typeof world.qc.repairLedger>[0]) => world.qc.repairLedger(request),
    async runFresh(input: Parameters<typeof world.qc.runFresh>[0]) {
      const committed = await world.qc.runFresh(input);
      if (armed) throw new Error("SIGKILL: successor judge run died after committing the round");
      return committed;
    },
  };
  await assert.rejects(
    world.service({ qc: crashingQc }).run(world.request({ resumeRunId: BOOK_RUN_ID })),
    /SIGKILL/,
  );
  const strandedSuccessor = await world.runStore.readRun(BOOK, `${baseJudgeRunId}-r2`, world.now());
  assert.ok(strandedSuccessor.ok && strandedSuccessor.value.status === "RUNNING", JSON.stringify(strandedSuccessor));

  armed = false;
  const resumed = await world.service().run(world.request({ resumeRunId: BOOK_RUN_ID }));
  if (!resumed.ok) throw new Error(`BOOK_RUN_SUCCESSOR_SETTLE:${JSON.stringify(resumed.error)}`);
  assert.equal(resumed.value.status, "PROMOTED");
  const settledSuccessor = await world.runStore.readRun(BOOK, `${baseJudgeRunId}-r2`, world.now());
  assert.ok(settledSuccessor.ok, JSON.stringify(settledSuccessor));
  assert.equal(
    settledSuccessor.value.status,
    "COMPLETED",
    "the successor judge run that committed the round must not be left RUNNING",
  );
});

finishV25Tests().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
