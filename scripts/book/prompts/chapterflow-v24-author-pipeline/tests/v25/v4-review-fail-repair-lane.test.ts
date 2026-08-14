/**
 * The canonical-review FAIL -> repair lane.
 *
 * Before this lane existed a canonical review FAIL was TERMINAL: the book-run
 * service returned BOOK_RUN_REVIEW_FAILED and the whole book was discarded, so
 * the panel's named, reader-decidable blockers were answered by a fresh compile
 * that produced a DIFFERENT set of one-off contradictions. These cases pin the
 * replacement: the named blockers are routed into the repair machinery, the
 * repaired candidate is RE-REVIEWED by the panel, the loop is bounded and
 * operator-visible, a resume is idempotent, and a blocker whose location cannot
 * be mapped to exactly one chapter fails loud instead of vanishing.
 */

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";

import {
  BookRunApplicationService,
  MAX_REVIEW_REPAIR_ROUNDS,
  resolveReviewRepairRounds,
  type BookRunEvent,
} from "../../src/app/bookRunApplicationService.js";
import type { CandidateQcEvaluator } from "../../src/app/candidateQcEvaluator.js";
import {
  CandidateRepairApplicationPort,
  type ReviewRepairApplicationRequest,
} from "../../src/app/candidateRepairApplicationPort.js";
import type { CompilerApplicationPort } from "../../src/app/compilerApplicationPort.js";
import { ModelGatewayReviewEvaluator } from "../../src/app/modelGatewayReviewEvaluator.js";
import type { ModelTaskRunner } from "../../src/app/modelTaskRunner.js";
import type { ResearchCandidateApplicationPort } from "../../src/app/researchCandidateApplicationPort.js";
import { createBookWriteLock } from "../../src/books/bookLease.js";
import { createBookContentReader } from "../../src/books/bookContentReader.js";
import { createCandidateStore } from "../../src/books/candidateStore.js";
import { createCurrentPointerStore } from "../../src/books/currentPointer.js";
import type {
  CandidateInputFile,
  CandidateManifest,
  CandidateSnapshot,
  CandidateStore,
} from "../../src/books/candidateTypes.js";
import type { CandidateIdentity } from "../../src/contracts/v4Core.js";
import { BOOK_PATTERN_AUDIT_LOGICAL_PATH, runBookPatternAudit } from "../../src/critics/bookPatternAudit.js";
import type { DiagnosisLookup, RepairService } from "../../src/qc/repairCoordinator.js";
import type { RepairHistoryStore } from "../../src/qc/repairHistoryStore.js";
import type { QcService } from "../../src/qc/qcTypes.js";
import { createQcService } from "../../src/qc/qcService.js";
import { createPromotionService } from "../../src/release/promotionService.js";
import { createReviewServiceFactory } from "../../src/review/reviewService.js";
import type { CanonicalReviewResult, ReviewIssue, ReviewService } from "../../src/review/reviewTypes.js";
import { createFileRunStore } from "../../src/run-state/fileRunStore.js";
import { createFileStageCoordinator } from "../../src/run-state/stageCoordinator.js";
import type { ChapterV21 } from "../../src/types.js";
import { fixtureChapter } from "../model-bakeoff-helpers.js";
import { finishV25Tests, requiredTest, type TestContext } from "./harness.js";
import { BOOK as PORT_BOOK, FAILED, candidate as portCandidate, identity } from "./repairPortRig.js";

const SOURCE_SHA = "b41d1cdab0fc33c4c1f840f4cf99089816e022d4";

function digestOf(files: readonly { logicalPath: string; bytes: Uint8Array }[]): string {
  const hash = createHash("sha256");
  for (const file of [...files].sort((left, right) => left.logicalPath.localeCompare(right.logicalPath))) {
    hash.update(file.logicalPath).update("\0").update(Buffer.from(file.bytes)).update("\0");
  }
  return hash.digest("hex");
}

// ────────────────────────────────────────────────────────────────────────────
// Port-level rig: exercises CandidateRepairApplicationPort.runFromReviewFail in
// isolation. Only the seams that lane touches are real (candidate store,
// run-state, stage coordinator, review lookup); the QC-lane seams are inert.
// ────────────────────────────────────────────────────────────────────────────

type ReviewRig = Readonly<{
  port: CandidateRepairApplicationPort;
  request: ReviewRepairApplicationRequest;
  predecessor: CandidateSnapshot;
  counts: { model: number };
  prompts: Parameters<ModelTaskRunner["run"]>[0][];
}>;

function reviewRig(
  context: TestContext,
  options: Readonly<{ issues: readonly ReviewIssue[]; outcome?: CanonicalReviewResult["outcome"]; slug: string }>,
): ReviewRig {
  const predecessor = portCandidate(context);
  const chapterOne = JSON.parse(Buffer.from(predecessor.files[0].bytes).toString("utf8")) as ChapterV21;
  const replacement: ChapterV21 = {
    ...chapterOne,
    hook: "A repaired opening names the ruling the panel said the chapter never issued.",
  };
  const stored = new Map<string, CandidateSnapshot>([[FAILED.candidateId, predecessor]]);
  const counts = { model: 0 };
  const prompts: Parameters<ModelTaskRunner["run"]>[0][] = [];
  const runRoot = resolve(context.roots.tempRoot, `${options.slug}-run-state`);
  const runStore = createFileRunStore(runRoot);
  const stageCoordinator = createFileStageCoordinator(runRoot);

  const candidates: CandidateStore = {
    async stage(input) {
      if (stored.has(input.candidateId)) return { ok: false, error: { code: "CANDIDATE_EXISTS", message: "exists" } };
      const files = input.files.map((file) => ({ ...file, byteLength: file.bytes.byteLength }));
      const manifest: CandidateManifest = {
        schemaVersion: "1",
        bookId: input.bookId,
        candidateId: input.candidateId,
        ...(input.parentCandidateId === undefined ? {} : { parentCandidateId: input.parentCandidateId }),
        createdByRunId: input.createdByRunId,
        entries: files.map(({ bytes: _bytes, ...file }) => file),
        manifestDigest: digestOf(files),
        createdAt: input.createdAt,
      };
      stored.set(input.candidateId, { manifest, files });
      return { ok: true, value: manifest };
    },
    async open(input) {
      if (input.selector.kind !== "CANDIDATE") return { ok: false, error: { code: "CANDIDATE_NOT_FOUND", message: "not found" } };
      const snapshot = stored.get(input.selector.candidateId);
      return snapshot ? { ok: true, value: snapshot } : { ok: false, error: { code: "CANDIDATE_NOT_FOUND", message: "not found" } };
    },
  };
  const failedReview: CanonicalReviewResult = {
    schemaVersion: "1",
    reviewId: "review-panel-fail",
    candidate: FAILED,
    outcome: options.outcome ?? "FAIL",
    issues: options.issues,
    completedAt: context.clock.now(),
  };
  const reviews: ReviewService = {
    async screen(value) { return { ok: true, value: { candidate: identity(value), outcome: "SHORTLIST", issues: [] } }; },
    async reviewCanonical() { throw new Error("unused: the book-run service owns re-review, not the port"); },
    async get(_bookId, reviewId) {
      return reviewId === failedReview.reviewId
        ? { ok: true, value: failedReview }
        : { ok: false, error: { code: "REVIEW_NOT_FOUND", message: "missing" } };
    },
  };
  const inert = { code: "UNUSED", message: "unused" } as const;
  const qc: QcService = {
    async getRound() { return { ok: false, error: inert }; },
    async readStatus() { return { ok: false, error: inert }; },
    async runFresh() { return { ok: false, error: inert }; },
    async diagnose() { return { ok: false, error: inert }; },
    async repairLedger() { return { ok: false, error: inert }; },
  };
  const history: RepairHistoryStore = {
    async list() { return { ok: true, value: [] }; },
    async append() { throw new Error("unused: the review lane appends no QC repair-history record"); },
  };
  const diagnoses: DiagnosisLookup = { async getDiagnosis() { return { ok: false, error: inert }; } };
  const repairs: RepairService = { async createSuccessor() { throw new Error("unused: review lane stages its own successor"); } };
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
      assert.equal(admitted.ok, true, JSON.stringify(admitted));
      const finished = await runStore.finishAttempt({
        bookId: request.context.bookId,
        runId: request.context.runId,
        attemptId: request.context.attemptId,
        outcome: "SUCCEEDED",
        finishedAt: context.clock.now(),
      });
      assert.equal(finished.ok, true, JSON.stringify(finished));
      return { attemptId: request.context.attemptId, outcome: "SUCCEEDED", output: replacement };
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
    successorQc: { async run() { throw new Error("unused: the review lane runs no fresh QC"); } },
    runStore,
    stageCoordinator,
    clock: context.clock,
  });
  return {
    port,
    predecessor,
    counts,
    prompts,
    request: {
      bookId: PORT_BOOK,
      failedCandidate: FAILED,
      failedReviewId: failedReview.reviewId,
      successorCandidateId: "candidate-review-successor",
      repairRunId: `review-repair-run-${options.slug}`,
      sourceGitSha: "1".repeat(40),
      attemptRoot: resolve(context.roots.attemptsRoot, `${options.slug}-review-repair`),
      signal: new AbortController().signal,
    },
  };
}

const PANEL_BLOCKER: ReviewIssue = {
  code: "READER.BLOCKING.contradiction",
  severity: "BLOCKER",
  message: "the Deep read calls the statement 'his ruling'; Review Card 5 says he issued no ruling",
  location: "ch01/reader-b/deep",
};

requiredTest("a review FAIL routes its panel-named blockers into a chapter-scoped repair and stages a successor", async (context: TestContext) => {
  const rig = reviewRig(context, {
    slug: "review-repair-happy",
    issues: [
      PANEL_BLOCKER,
      { code: "READER.PANEL.FACTOR_SCORES", severity: "WARN", message: "clarity 6; momentum 7", location: "ch01" },
      { code: "READER.ADVISORY.pacing", severity: "WARN", message: "the middle beat drags", location: "ch01/reader-a/beat" },
    ],
  });

  const repaired = await rig.port.runFromReviewFail(rig.request);
  if (!repaired.ok) throw new Error(`review-repair must succeed: ${JSON.stringify(repaired.error)}`);

  // Chapter-scoped: only the chapter the blocker names was rewritten.
  assert.deepEqual([...repaired.value.targetChapterNumbers], [1]);
  assert.equal(rig.counts.model, 1, "exactly one chapter repair call");
  assert.equal(repaired.value.successor.manifest.candidateId, rig.request.successorCandidateId);
  assert.equal(repaired.value.successor.manifest.parentCandidateId, FAILED.candidateId);
  assert.notEqual(repaired.value.successor.manifest.manifestDigest, FAILED.manifestDigest);

  // The panel's blocker reached the model as a MANDATORY fix, and the advisories
  // reached it as diagnosis — the verdict itself is never rewritten or lowered.
  const brief = rig.prompts[0].prompt.inputs.find((entry) => entry.name === "repair_brief");
  assert.ok(brief, "the repair prompt must carry a brief");
  const briefText = Buffer.from(brief!.bytes).toString("utf8");
  assert.ok(briefText.includes("MANDATORY FIXES — BLOCKERS (1)"), briefText);
  assert.ok(briefText.includes("READER.BLOCKING.contradiction"), briefText);
  assert.ok(briefText.includes("READER.ADVISORY.pacing"), briefText);

  // The port does NOT judge its own work: no review, no QC round, no promotion.
  const findings = rig.prompts[0].prompt.inputs.find((entry) => entry.name === "qc_findings");
  assert.ok(findings, "the repair prompt must carry the machine-readable findings");
  const parsed = JSON.parse(Buffer.from(findings!.bytes).toString("utf8")) as readonly { code: string }[];
  assert.deepEqual(parsed.map((issue) => issue.code), ["READER.BLOCKING.contradiction"]);

  // Only chapter 1 changed; chapter 2 is byte-identical to the predecessor.
  const beforeTwo = rig.predecessor.files.find((file) => file.logicalPath.endsWith("ch02.v21-native.chapter.json"))!;
  const afterTwo = repaired.value.successor.files.find((file) => file.logicalPath === beforeTwo.logicalPath)!;
  assert.ok(Buffer.from(beforeTwo.bytes).equals(Buffer.from(afterTwo.bytes)), "an unnamed chapter must not be resampled");
});

requiredTest("a review blocker that names no single chapter fails LOUD instead of being silently dropped", async (context: TestContext) => {
  const rig = reviewRig(context, {
    slug: "review-repair-unmappable",
    issues: [
      PANEL_BLOCKER,
      { code: "READER.BLOCKING.throughline", severity: "BLOCKER", message: "the book's spine never resolves", location: "book/global" },
    ],
  });

  const repaired = await rig.port.runFromReviewFail(rig.request);
  assert.equal(repaired.ok, false, JSON.stringify(repaired));
  if (repaired.ok) throw new Error("an unmappable blocker must not be dropped");
  assert.equal(repaired.error.code, "REVIEW_REPAIR_FINDING_UNSCOPED");
  assert.ok(repaired.error.message.includes("READER.BLOCKING.throughline"), repaired.error.message);
  assert.ok(repaired.error.message.includes("book/global"), repaired.error.message);
  assert.equal(rig.counts.model, 0, "an unscoped blocker must burn zero model calls");
});

requiredTest("a review-repair replays idempotently: a second call re-reads its successor with zero new model calls", async (context: TestContext) => {
  const rig = reviewRig(context, { slug: "review-repair-idempotent", issues: [PANEL_BLOCKER] });

  const first = await rig.port.runFromReviewFail(rig.request);
  if (!first.ok) throw new Error(`first review-repair must succeed: ${JSON.stringify(first.error)}`);
  assert.equal(rig.counts.model, 1);

  const replay = await rig.port.runFromReviewFail(rig.request);
  if (!replay.ok) throw new Error(`replayed review-repair must reconcile: ${JSON.stringify(replay.error)}`);
  assert.equal(rig.counts.model, 1, "a replayed review-repair must NOT re-run the model");
  assert.deepEqual(
    identity(replay.value.successor),
    identity(first.value.successor),
    "a replay must return the SAME successor, never a second one",
  );
});

requiredTest("a PASS canonical review is never repair-authorizing", async (context: TestContext) => {
  const rig = reviewRig(context, { slug: "review-repair-pass", outcome: "PASS", issues: [], });

  const repaired = await rig.port.runFromReviewFail(rig.request);
  assert.equal(repaired.ok, false, JSON.stringify(repaired));
  if (repaired.ok) throw new Error("a PASS review must never authorize a repair");
  assert.equal(repaired.error.code, "REVIEW_REPAIR_VERDICT_STALE");
  assert.equal(rig.counts.model, 0);
});

// ────────────────────────────────────────────────────────────────────────────
// Book-run-level: the loop, its bound, and its resume behaviour.
// ────────────────────────────────────────────────────────────────────────────

function derivedIdOf(prefix: string, runId: string): string {
  return `${prefix}-${createHash("sha256").update(runId).digest("hex").slice(0, 32)}`;
}

type BookRunHarness = Readonly<{
  service: BookRunApplicationService;
  request: Omit<Parameters<BookRunApplicationService["run"]>[0], "resumeRunId">;
  bookRunId: string;
  events: BookRunEvent[];
  reviewCalls: () => number;
  repairCalls: () => readonly ReviewRepairApplicationRequest[];
}>;

/**
 * A book run whose canonical review outcomes are scripted per call and whose
 * repair port is a fake that stages a real successor candidate. The review
 * evaluator is the only runner consumer, so `reviewCalls()` counts panel runs
 * exactly.
 */
async function buildBookRunHarness(
  context: TestContext,
  book: string,
  reviewOutcomes: readonly CanonicalReviewResult["outcome"][],
  options: Readonly<{ repairFails?: string }> = {},
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
    jsonFile(`content/chapters/${chapter.chapterId}.v21-native.chapter.json`, chapter, "CHAPTER"),
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
  const candidateQc = {
    async run(req: { roundId: string; candidate: CandidateSnapshot; canonicalReview: { reviewId: string } }) {
      return {
        ok: true as const,
        value: {
          roundId: req.roundId,
          candidate: { candidateId: req.candidate.manifest.candidateId, manifestDigest: req.candidate.manifest.manifestDigest },
          reviewId: req.canonicalReview.reviewId,
          outcome: "PASS" as const,
          issues: [],
        },
      };
    },
  } as unknown as CandidateQcEvaluator;

  const repairCalls: ReviewRepairApplicationRequest[] = [];
  const successors = new Map<string, CandidateSnapshot>();
  const repair = {
    async runFromReviewFail(request: ReviewRepairApplicationRequest) {
      repairCalls.push(request);
      if (options.repairFails !== undefined) {
        return { ok: false as const, error: { code: options.repairFails, message: "scripted repair failure" } };
      }
      const existing = successors.get(request.successorCandidateId);
      if (existing) return { ok: true as const, value: { successor: existing, failedReviewId: request.failedReviewId, targetChapterNumbers: [1] } };
      const repairedChapter: ChapterV21 = {
        ...chapter,
        hook: `${chapter.hook} (repaired for ${request.successorCandidateId})`,
      };
      const files = [
        jsonFile(`content/chapters/${chapter.chapterId}.v21-native.chapter.json`, repairedChapter, "CHAPTER"),
        jsonFile(BOOK_PATTERN_AUDIT_LOGICAL_PATH, runBookPatternAudit({ bookId: book, chapters: [repairedChapter], requirePlanArtifacts: false, checkSourceAlignment: false })),
      ];
      const staged = await stageLocal({
        candidateId: request.successorCandidateId,
        parentCandidateId: request.failedCandidate.candidateId,
        runId: request.repairRunId,
        files,
      });
      successors.set(request.successorCandidateId, staged);
      return { ok: true as const, value: { successor: staged, failedReviewId: request.failedReviewId, targetChapterNumbers: [1] } };
    },
  } as unknown as CandidateRepairApplicationPort;

  const events: BookRunEvent[] = [];
  const service = new BookRunApplicationService({
    research, compiler, repair, contentReader: reader, candidateQc, reviews, qc, promotion, currentPointer, runStore, stageCoordinator,
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
    reviewCalls: () => reviewCalls,
    repairCalls: () => repairCalls,
    request: {
      bookId: book,
      title: "Review Repair",
      author: "Fixture Author",
      sourceGitSha: SOURCE_SHA,
      v25Root: resolve(context.roots.tempRoot, `${suffix}-v25`),
      attemptRoot: resolve(context.roots.attemptsRoot, `${suffix}-book-run`),
      regen: true,
      maxRepairRounds: 1 as const,
      promoteLocal: true,
      signal: new AbortController().signal,
    },
  };
}

requiredTest("a canonical review FAIL is repaired and RE-REVIEWED, and the repaired candidate is what gets promoted", async (context: TestContext) => {
  const book = "review-repair-converges";
  const h = await buildBookRunHarness(context, book, ["FAIL", "PASS"]);

  const result = await h.service.run({ ...h.request });
  if (!result.ok) throw new Error(`review-repair must converge: ${JSON.stringify(result.error)}`);
  assert.equal(result.value.status, "PROMOTED");

  // Exactly one repair round, and the panel judged the successor.
  assert.equal(h.repairCalls().length, 1, JSON.stringify(h.repairCalls()));
  assert.equal(h.reviewCalls(), 2, "the repaired candidate must be re-reviewed by the panel");

  // The PROMOTED candidate is the REPAIRED successor, not the compiled original.
  const successorId = h.repairCalls()[0].successorCandidateId;
  assert.equal(result.value.candidate.candidateId, successorId, JSON.stringify(result.value));
  assert.notEqual(result.value.candidate.candidateId, h.repairCalls()[0].failedCandidate.candidateId);

  // The verdict that counts is the successor's own review, not the FAIL.
  assert.equal(result.value.reviewId, derivedIdOf("review", derivedIdOf("review-repair-1", h.bookRunId)));

  // Operator-visible: the repair round is in the durable phase log.
  const repairEvents = h.events.filter((event) => event.phase === "repair" && event.detail?.includes("REVIEW_REPAIR"));
  assert.ok(repairEvents.some((event) => event.status === "STARTED"), JSON.stringify(h.events.map((e) => e.detail)));
  assert.ok(repairEvents.some((event) => event.status === "COMPLETED"), JSON.stringify(h.events.map((e) => e.detail)));
  assert.ok(repairEvents.some((event) => event.detail?.includes("round=1")), JSON.stringify(repairEvents.map((e) => e.detail)));
});

requiredTest("the review-repair loop is BOUNDED: the cap is enforced and the run fails closed with a clear message", async (context: TestContext) => {
  const book = "review-repair-capped";
  const h = await buildBookRunHarness(context, book, ["FAIL", "FAIL", "FAIL", "FAIL", "FAIL"]);

  const result = await h.service.run({ ...h.request });
  assert.equal(result.ok, false, JSON.stringify(result));
  if (result.ok) throw new Error("an unconverged review-repair loop must fail closed");
  assert.equal(result.error.code, "BOOK_RUN_REVIEW_FAILED");
  assert.ok(
    result.error.message.includes(String(MAX_REVIEW_REPAIR_ROUNDS)),
    `the cap must be named in the failure: ${result.error.message}`,
  );
  assert.equal(h.repairCalls().length, MAX_REVIEW_REPAIR_ROUNDS, "the loop must stop at the cap");
  assert.equal(h.reviewCalls(), MAX_REVIEW_REPAIR_ROUNDS + 1, "one panel run per candidate, and no more");
  // Each round is individually visible, and the cap itself is recorded.
  for (let round = 1; round <= MAX_REVIEW_REPAIR_ROUNDS; round += 1) {
    assert.ok(
      h.events.some((event) => event.phase === "repair" && event.status === "STARTED" && event.detail?.includes(`round=${round}`)),
      `round ${round} must be in the durable phase log`,
    );
  }
  assert.ok(
    h.events.some((event) => event.phase === "repair" && event.status === "FAILED" && event.detail?.includes("cap")),
    JSON.stringify(h.events.filter((e) => e.phase === "repair").map((e) => [e.status, e.detail])),
  );
});

requiredTest("a resume mid review-repair is idempotent: no double repair, no second successor", async (context: TestContext) => {
  const book = "review-repair-resume";
  // The first run repairs once and then the panel FAILs the successor too, so the
  // run dies with a durable round-1 successor on disk. The resume must reuse it.
  const h = await buildBookRunHarness(context, book, ["FAIL", "FAIL", "FAIL", "FAIL", "FAIL"]);

  const first = await h.service.run({ ...h.request });
  assert.equal(first.ok, false);
  const roundsFirst = h.repairCalls().length;
  const reviewsFirst = h.reviewCalls();
  assert.equal(roundsFirst, MAX_REVIEW_REPAIR_ROUNDS);

  const resumed = await h.service.run({ ...h.request, resumeRunId: h.bookRunId });
  assert.equal(resumed.ok, false, JSON.stringify(resumed));
  if (resumed.ok) throw new Error("the resume must not invent a pass");
  assert.equal(resumed.error.code, "BOOK_RUN_REVIEW_FAILED");
  assert.equal(h.reviewCalls(), reviewsFirst, "a resume must replay stored reviews with ZERO new panel calls");
  // The resume re-drives the SAME repair-round identities (idempotent reconcile),
  // never a fresh successor id per round.
  const ids = new Set(h.repairCalls().map((request) => request.successorCandidateId));
  assert.equal(ids.size, MAX_REVIEW_REPAIR_ROUNDS, "a resumed round must reuse its successor candidate id");
});

requiredTest("a failing review-repair surfaces its own error and never masks the panel verdict", async (context: TestContext) => {
  const book = "review-repair-portfails";
  const h = await buildBookRunHarness(context, book, ["FAIL"], { repairFails: "REVIEW_REPAIR_FINDING_UNSCOPED" });

  const result = await h.service.run({ ...h.request });
  assert.equal(result.ok, false, JSON.stringify(result));
  if (result.ok) throw new Error("a failed review-repair must not promote");
  assert.equal(result.error.code, "REVIEW_REPAIR_FINDING_UNSCOPED");
  assert.ok(
    h.events.some((event) => event.phase === "repair" && event.status === "FAILED"),
    JSON.stringify(h.events.map((e) => [e.phase, e.status, e.detail])),
  );
});

requiredTest("the review-repair cap honours CHAPTERFLOW_REVIEW_REPAIR_ROUNDS and fails closed on a bad value", () => {
  const saved = process.env.CHAPTERFLOW_REVIEW_REPAIR_ROUNDS;
  try {
    delete process.env.CHAPTERFLOW_REVIEW_REPAIR_ROUNDS;
    assert.equal(resolveReviewRepairRounds(), MAX_REVIEW_REPAIR_ROUNDS, "unset falls back to the default");
    process.env.CHAPTERFLOW_REVIEW_REPAIR_ROUNDS = "4";
    assert.equal(resolveReviewRepairRounds(), 4, "an operator override is honoured");
    process.env.CHAPTERFLOW_REVIEW_REPAIR_ROUNDS = "not-a-number";
    assert.throws(() => resolveReviewRepairRounds(), /not an integer/, "garbage fails closed, never silently defaults");
    process.env.CHAPTERFLOW_REVIEW_REPAIR_ROUNDS = "0";
    assert.throws(() => resolveReviewRepairRounds(), /must be 1-10/, "zero would disable the lane silently");
    process.env.CHAPTERFLOW_REVIEW_REPAIR_ROUNDS = "99";
    assert.throws(() => resolveReviewRepairRounds(), /must be 1-10/, "a typo must not burn panels indefinitely");
  } finally {
    if (saved === undefined) delete process.env.CHAPTERFLOW_REVIEW_REPAIR_ROUNDS;
    else process.env.CHAPTERFLOW_REVIEW_REPAIR_ROUNDS = saved;
  }
});

finishV25Tests().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
