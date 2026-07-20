import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

import { createBookContentReader } from "../../src/books/bookContentReader.js";
import { createBookWriteLock } from "../../src/books/bookLease.js";
import { createCandidateStore } from "../../src/books/candidateStore.js";
import {
  createCurrentPointerStore,
  type CurrentPointerStore,
} from "../../src/books/currentPointer.js";
import { slotChapterAbsPath } from "../../src/bakeoff/candidates.js";
import { bakeoffRoots, pipelineRel } from "../../src/bakeoff/paths.js";
import { combinedContentHash } from "../../src/bakeoff/review.js";
import { runBakeoff, type BakeoffStages } from "../../src/bakeoff/runBakeoff.js";
import { buildScorecard, type SelectionInputs } from "../../src/bakeoff/selection.js";
import type {
  BlindLabel,
  CandidateReviewV1,
  CandidateSpec,
  CandidateStateV1,
  CandidateValidationV1,
  SharedInputsFreezeV1,
} from "../../src/bakeoff/types.js";
import { verifySharedInputs } from "../../src/bakeoff/freeze.js";
import { chapterContentHash } from "../../src/critics/qcAttestation.js";
import { createReviewServiceFactory } from "../../src/review/reviewService.js";
import type { ReviewService } from "../../src/review/reviewTypes.js";
import {
  BAKEOFF_SELECTION_AUTHORITY,
  LegacyBakeoffStateAdapter,
  normalizeV4BakeoffScorecard,
} from "../../src/release/legacyBakeoffStateAdapter.js";
import { fixtureChapter, fakeBakeoffDeps } from "../model-bakeoff-helpers.js";
import { finishV25Tests, requiredTest, type TestContext } from "./harness.js";

const SPECS: readonly CandidateSpec[] = [
  { model: "gpt-5.6-sol", slug: "gpt-5-6-sol", slot: "w1", effort: "xhigh" },
  { model: "gpt-5.6-terra", slug: "gpt-5-6-terra", slot: "w2", effort: "xhigh" },
];

function fixedReview(label: BlindLabel, chapters: readonly ReturnType<typeof fixtureChapter>[]): CandidateReviewV1 {
  const slot = (chapters[0]?.title.match(/w\d/) ?? ["w1"])[0];
  const composite = slot === "w1" ? 84 : 78;
  return {
    schemaVersion: "model-bakeoff-candidate-review-v1",
    label,
    contentSha256: combinedContentHash([...chapters]),
    chapterReviews: [{
      chapterNumber: 1,
      composite,
      ship: true,
      keysClean: true,
      valid: true,
      pass: true,
      reviewerSessionId: `screen-${label}`,
    }],
    bookReads: [],
    bookComposite: composite,
    bookGate: "PASS",
    bookChurn: "LOW",
    meanChapterComposite: composite,
    minChapterComposite: composite,
    chapterPassRate: 1,
    sampledChapterNumbers: [1],
    reviewedAt: "2026-07-20T12:00:00.000Z",
  };
}

function world(context: TestContext, bookId: string, runId = "bakeoff-r1") {
  const roots = bakeoffRoots(bookId, runId, context.roots.bakeoffRoot);
  mkdirSync(roots.v4BooksRoot, { recursive: true });
  const writeLock = createBookWriteLock({ booksRoot: roots.v4BooksRoot, timeoutMs: 1_000, pollMs: 1 });
  const rawPointer = createCurrentPointerStore({ booksRoot: roots.v4BooksRoot, writeLock });
  let pointerWriteAttempts = 0;
  const pointerStore: CurrentPointerStore = {
    read: (id) => rawPointer.read(id),
    compareAndSet: async (input) => {
      pointerWriteAttempts += 1;
      return rawPointer.compareAndSet(input);
    },
  };
  const candidateStore = createCandidateStore({
    booksRoot: roots.v4BooksRoot,
    writeLock,
    currentPointerStore: pointerStore,
  });
  const contentReader = createBookContentReader({ booksRoot: roots.v4BooksRoot, currentPointerStore: pointerStore });
  let canonicalEvaluatorCalls = 0;
  const reviewService: ReviewService = createReviewServiceFactory({
    booksRoot: roots.v4BooksRoot,
    contentReader,
    now: () => context.clock.now(),
  }).create({
    async evaluate() {
      canonicalEvaluatorCalls += 1;
      return { ok: true, value: { outcome: "PASS", issues: [] } };
    },
  });
  let selectionReviewerCalls = 0;
  const adapter = new LegacyBakeoffStateAdapter({
    roots,
    candidateStore,
    contentReader,
    reviewService,
    selectionReviewer: {
      root: roots.reviewsDir,
      async review({ label, chapters }) {
        selectionReviewerCalls += 1;
        const review = fixedReview(label, chapters as ReturnType<typeof fixtureChapter>[]);
        const path = join(roots.reviewsDir, label, "review.json");
        mkdirSync(dirname(path), { recursive: true });
        writeFileSync(path, `${JSON.stringify(review, null, 2)}\n`);
        return review;
      },
    },
  });
  return {
    roots,
    adapter,
    reviewService,
    candidateStore,
    contentReader,
    pointerWrites: () => pointerWriteAttempts,
    evaluatorCalls: () => canonicalEvaluatorCalls,
    reviewerCalls: () => selectionReviewerCalls,
  };
}

function writeSlot(roots: ReturnType<typeof bakeoffRoots>, bookId: string, spec: CandidateSpec, marker = spec.slot): string {
  const path = slotChapterAbsPath(roots, spec.slot, bookId, 1);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(fixtureChapter(bookId, 1, marker), null, 2)}\n`);
  return path;
}

requiredTest("complete two-candidate bakeoff stages immutable V4 candidates and selects deterministically", async (context) => {
  const bookId = "v4-bakeoff-complete";
  const runId = "bakeoff-complete";
  const w = world(context, bookId, runId);
  const draftPath = join(context.roots.tempRoot, "draft.md");
  writeFileSync(draftPath, `---\ntitle: V4 Bakeoff Complete\nauthor: Test Author\n---\n# V4 Bakeoff Complete\n\n${"Grounded draft text. ".repeat(20)}`);
  const bundle = fakeBakeoffDeps({ expectedChapterNumbers: () => [1] });
  const freeze: SharedInputsFreezeV1 = {
    schemaVersion: "model-bakeoff-shared-inputs-v1",
    frozenAt: "2026-07-20T12:00:00.000Z",
    files: [],
    combinedSha256: "shared",
    taskCardTemplateSha256: { ch01: "template" },
    retryBudget: { gateRetries: 1, leadDegradeRetries: 1 },
    chapterNumbers: [1],
  };
  const stages: Partial<BakeoffStages> = {
    freezeInputs: () => freeze,
    verifyInputs: () => [],
    generate: (async (id, spec, _deps, roots, _options, persist) => {
      const chapter = fixtureChapter(id, 1, spec.slot);
      writeSlot(roots, id, spec);
      const state: CandidateStateV1 = {
        schemaVersion: "model-bakeoff-candidate-v1",
        spec,
        status: "complete",
        chapters: [{
          chapterNumber: 1,
          ok: true,
          firstAttemptPass: true,
          attempts: [],
          totalDurationMs: spec.slot === "w1" ? 10 : 20,
          contentSha256: chapterContentHash(chapter),
        }],
        totalDurationMs: spec.slot === "w1" ? 10 : 20,
        totalRetries: 0,
        firstAttemptPasses: 1,
      };
      persist(state);
      return state;
    }) as BakeoffStages["generate"],
    validate: (async (_id, spec) => ({
      schemaVersion: "model-bakeoff-candidate-validation-v1",
      model: spec.model,
      validatedAt: "2026-07-20T12:00:00.000Z",
      complete: true,
      hardFailures: [],
      advisories: [],
      bookGatePassed: true,
      rubricVerdict: "pass",
      readerBudgetBlockers: 0,
      shipGateBlockers: 0,
    })) as BakeoffStages["validate"],
  };
  const outcome = await runBakeoff({
    draftPath,
    bookId,
    runId,
    models: SPECS.map((spec) => spec.model),
    deps: bundle.deps,
    stateRoot: context.roots.bakeoffRoot,
    stages,
    v4: w.adapter,
  });
  assert.equal(outcome.status, "complete");
  assert.equal(outcome.winner, SPECS[0].model);
  const report = JSON.parse(readFileSync(w.roots.reportJsonPath, "utf8"));
  assert.equal(report.selection.authority, BAKEOFF_SELECTION_AUTHORITY);
  assert.equal(report.promotion, null);
  assert.deepEqual(readdirSync(join(w.roots.v4BooksRoot, bookId, "candidates")).sort(), SPECS.map((spec) => spec.slug).sort());

  writeSlot(w.roots, bookId, SPECS[0], "drifted-after-finalization");
  const restage = await w.adapter.stageCandidate({
    bookId,
    runId,
    spec: SPECS[0],
    chapterNumbers: [1],
    createdAt: "2026-07-20T12:01:00.000Z",
  });
  assert.equal(restage.ok, false);
  if (!restage.ok) assert.equal(restage.error.code, "CANDIDATE_MISMATCH");
  assert.equal(w.pointerWrites(), 0);
  assert.equal(w.evaluatorCalls(), 0);
  assert.equal(bundle.delegations.length, 0);
  assert.equal(bundle.verbs.some((verb) => /^(qc-|publish|promote|register)/.test(verb[0] ?? "")), false);
  assert.equal(existsSync(join(w.roots.v4BooksRoot, bookId, "current.json")), false);
  assert.equal(existsSync(join(w.roots.v4BooksRoot, bookId, "reviews")), false);
});

requiredTest("missing or extra candidate inventory blocks before screening reviewer", async (context) => {
  const bookId = "v4-bakeoff-inventory";
  const w = world(context, bookId);
  const missing = await w.adapter.stageCandidate({
    bookId,
    runId: "bakeoff-r1",
    spec: SPECS[0],
    chapterNumbers: [1],
    createdAt: "2026-07-20T12:00:00.000Z",
  });
  assert.equal(missing.ok, false);
  if (!missing.ok) assert.equal(missing.error.code, "CANDIDATE_INVENTORY");

  writeSlot(w.roots, bookId, SPECS[0]);
  writeFileSync(join(dirname(slotChapterAbsPath(w.roots, SPECS[0].slot, bookId, 1)), "extra.json"), "{}\n");
  const extra = await w.adapter.stageCandidate({
    bookId,
    runId: "bakeoff-r1",
    spec: SPECS[0],
    chapterNumbers: [1],
    createdAt: "2026-07-20T12:00:00.000Z",
  });
  assert.equal(extra.ok, false);
  if (!extra.ok) assert.equal(extra.error.code, "CANDIDATE_INVENTORY");
  assert.equal(w.reviewerCalls(), 0);
  assert.equal(w.evaluatorCalls(), 0);
});

requiredTest("shared input freeze reports explicit byte drift mismatch", ({ roots }) => {
  const input = join(roots.tempRoot, "frozen-input.txt");
  writeFileSync(input, "before\n");
  const freeze: SharedInputsFreezeV1 = {
    schemaVersion: "model-bakeoff-shared-inputs-v1",
    frozenAt: "2026-07-20T12:00:00.000Z",
    files: [{ relPath: pipelineRel(input), sha256: "1234567890abcdef", bytes: 7 }],
    combinedSha256: "combined",
    taskCardTemplateSha256: {},
    retryBudget: { gateRetries: 1, leadDegradeRetries: 1 },
    chapterNumbers: [1],
  };
  writeFileSync(input, "after\n");
  const drift = verifySharedInputs(freeze);
  assert.equal(drift.length, 1);
  assert.match(drift[0], /frozen input drifted/);
});

requiredTest("screening winner has no canonical review authority", async (context) => {
  const bookId = "v4-bakeoff-authority";
  const w = world(context, bookId);
  writeSlot(w.roots, bookId, SPECS[0]);
  const staged = await w.adapter.stageCandidate({
    bookId,
    runId: "bakeoff-r1",
    spec: SPECS[0],
    chapterNumbers: [1],
    createdAt: "2026-07-20T12:00:00.000Z",
  });
  assert.equal(staged.ok, true);
  const deps = fakeBakeoffDeps().deps as Parameters<typeof runBakeoff>[0]["deps"];
  const screened = await w.adapter.reviewForSelection({
    bookId,
    spec: SPECS[0],
    label: "A",
    deps: deps as never,
    options: {
      runId: "bakeoff-r1",
      judge: { model: "fake-judge", effort: "high" },
      forbidden: [],
      log: () => {},
      chapterParallel: 1,
    },
  });
  assert.equal(screened.ok, true);
  const canonical = await w.reviewService.get(bookId, "screening-winner");
  assert.equal(canonical.ok, false);
  if (!canonical.ok) assert.equal(canonical.error.code, "REVIEW_NOT_FOUND");
  assert.equal(w.evaluatorCalls(), 0);
  const evidence = JSON.parse(readFileSync(join(w.roots.reviewsDir, "A", "screening.json"), "utf8"));
  assert.equal(evidence.authority, BAKEOFF_SELECTION_AUTHORITY);
});

requiredTest("legacy and V4 normalized scorecards preserve exact parity", async (context) => {
  const bookId = "v4-bakeoff-parity";
  const w = world(context, bookId);
  writeSlot(w.roots, bookId, SPECS[0]);
  const staged = await w.adapter.stageCandidate({
    bookId,
    runId: "bakeoff-r1",
    spec: SPECS[0],
    chapterNumbers: [1],
    createdAt: "2026-07-20T12:00:00.000Z",
  });
  assert.ok(staged.ok);
  const screening = await w.adapter.screening(bookId, SPECS[0], "A");
  assert.ok(screening.ok);
  if (!screening.ok) return;
  const generation: CandidateStateV1 = {
    schemaVersion: "model-bakeoff-candidate-v1",
    spec: SPECS[0],
    status: "complete",
    chapters: [],
    totalDurationMs: 10,
    totalRetries: 0,
    firstAttemptPasses: 1,
  };
  const validation: CandidateValidationV1 = {
    schemaVersion: "model-bakeoff-candidate-validation-v1",
    model: SPECS[0].model,
    validatedAt: "2026-07-20T12:00:00.000Z",
    complete: true,
    hardFailures: [],
    advisories: [],
    bookGatePassed: true,
    rubricVerdict: "pass",
    readerBudgetBlockers: 0,
    shipGateBlockers: 0,
  };
  const chapters = w.adapter.candidateChapters(staged.value);
  assert.ok(chapters.ok);
  if (!chapters.ok) return;
  const input: SelectionInputs[number] = {
    spec: SPECS[0],
    label: "A",
    generation,
    validation,
    review: fixedReview("A", chapters.value as ReturnType<typeof fixtureChapter>[]),
  };
  assert.deepEqual(normalizeV4BakeoffScorecard(input, screening.value), buildScorecard(input));
});

requiredTest("completed screening leaves current pointer and production package routes untouched", async (context) => {
  const bookId = "v4-bakeoff-zero-writes";
  const w = world(context, bookId);
  writeSlot(w.roots, bookId, SPECS[0]);
  const staged = await w.adapter.stageCandidate({
    bookId,
    runId: "bakeoff-r1",
    spec: SPECS[0],
    chapterNumbers: [1],
    createdAt: "2026-07-20T12:00:00.000Z",
  });
  assert.ok(staged.ok);
  const screened = await w.adapter.screening(bookId, SPECS[0], "A");
  assert.ok(screened.ok);
  assert.equal(w.pointerWrites(), 0);
  assert.equal(w.evaluatorCalls(), 0);
  assert.equal(existsSync(join(w.roots.v4BooksRoot, bookId, "current.json")), false);
  assert.equal(existsSync(join(w.roots.v4BooksRoot, bookId, "reviews")), false);
  assert.equal(existsSync(join(w.roots.runRoot, "book-packages")), false);
});

finishV25Tests().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
