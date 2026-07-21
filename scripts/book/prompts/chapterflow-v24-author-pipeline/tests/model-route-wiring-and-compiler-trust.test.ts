import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

import { createChapterFlowApp } from "../src/app/createChapterFlowApp.js";
import type { ModelTaskRunner } from "../src/app/modelTaskRunner.js";
import { createBookWriteLock } from "../src/books/bookLease.js";
import { createBookContentReader } from "../src/books/bookContentReader.js";
import { createCandidateStore } from "../src/books/candidateStore.js";
import { createCurrentPointerStore } from "../src/books/currentPointer.js";
import type { BookWriteLock } from "../src/books/leaseTypes.js";
import type { BookStatus } from "../src/lifecycle/bookStatus.js";
import { runAutopilot, type AutopilotDeps } from "../src/orchestrator/autopilot.js";
import type { SourceSidecarV2 } from "../src/source/sidecarSchema.js";
import { test } from "./harness.js";
import { compileCreditFixture, creditChapterSpec } from "./fixtures/creditBookFixture.js";
import { createTestRoots } from "./testRoots.js";
import { formatRootDiffs, snapshotGuardedProductionRoots, verifyGuardedProductionRoots } from "./v25/baseline.js";

const BOOK = "compiler-route-book";
const INDEX = "inputs/chapter-index.json";
const SIDECAR = "inputs/ch01.source.json";
const SOURCE = "inputs/ch01.source.txt";

function sourceSidecar(): SourceSidecarV2 {
  const facts = Array.from({ length: 9 }, (_, index) => ({
    id: `ch01.fact.${index + 1}`,
    claim: `Credit utilization signal ${index + 1} changes lender-visible risk before a bill is fully paid.`,
    becauseMechanism: `Because balances can be reported before payment, a lower visible balance gives the scoring model cleaner information ${index + 1}.`,
    commonError: `Assuming only the due date matters ${index + 1}.`,
    errorIsWhy: `The reporting snapshot can matter before the due date ${index + 1}.`,
  }));
  return {
    schemaVersion: "source-v2",
    chapterNumber: 1,
    chapterTitle: "Optimize Your Credit Cards",
    centralConcept: { id: "ch01.concept.credit", name: "Credit card optimization", plainDefinition: "Small payment and utilization choices change what lenders see.", whyItMatters: "Reader can improve signal without pretending money is magic." },
    keyClaims: facts.map((fact) => fact.claim),
    namedExamples: [
      { id: "ch01.case.fico", label: "FICO score range", summary: "FICO scores are commonly discussed on a 300 to 850 scale when explaining credit behavior.", teachesWhat: "Credit behavior becomes a lender-facing signal.", hardSpecifics: ["300 to 850 scale", "credit utilization"], realWorld: true },
      { id: "ch01.case.cfpb", label: "Consumer Financial Protection Bureau credit reports", summary: "The CFPB explains that credit reports collect account and payment information used by lenders.", teachesWhat: "A report is an input, not a moral judgment.", hardSpecifics: ["credit reports", "lenders use account information"], realWorld: true },
    ],
    hardEdge: "Do not promise an exact score increase.",
    paraphraseNotes: "Keep numbers limited to verified range and source-local utilization mechanism.",
    testableFacts: facts,
    frameworks: [{ name: "Three-part credit signal", members: ["payment history", "utilization", "account age"] }],
  };
}

function status(ready: boolean): BookStatus {
  return {
    bookId: BOOK,
    stage: ready ? "ready" : "write-chapter",
    phase: "",
    expectedChapters: 1,
    writtenChapters: ready ? 1 : 0,
    gatedChapters: ready ? 1 : 0,
    qcdChapters: ready ? 1 : 0,
    bookGatePass: ready,
    bookGateBlockers: 0,
    deterministicClean: true,
    packaged: ready,
    publishable: ready,
    guardrails: true,
    variety: null,
    nextCommand: "",
    nextLabel: "",
    chapters: [],
  };
}

test("real app to autopilot to compiler port uses candidate store lock and no legacy authority", async () => {
  const roots = createTestRoots("compiler-route");
  try {
    const productionBefore = snapshotGuardedProductionRoots();
    const modulePaths = [
      resolve(process.cwd(), "state", "books", BOOK),
      resolve(process.cwd(), "state", "indexes", `${BOOK}.json`),
      resolve(process.cwd(), "state", "chapters", `${BOOK}-ch01.v21-native.chapter.json`),
      resolve(process.cwd(), "state", "autopilot-logs", BOOK),
    ];
    assert.equal(modulePaths.some(existsSync), false);
    const realLock = createBookWriteLock({ booksRoot: roots.booksRoot, timeoutMs: 1_000, pollMs: 1 });
    let lockCalls = 0;
    const writeLock: BookWriteLock = {
      run(bookId, operation) {
        lockCalls += 1;
        return realLock.run(bookId, operation);
      },
    };
    const currentPointerStore = createCurrentPointerStore({ booksRoot: roots.booksRoot, writeLock });
    const candidateStore = createCandidateStore({ booksRoot: roots.booksRoot, writeLock, currentPointerStore });
    const contentReader = createBookContentReader({ booksRoot: roots.booksRoot, currentPointerStore });
    const files = [
      { kind: "SIDECAR" as const, mediaType: "application/json" as const, logicalPath: INDEX, bytes: Buffer.from(JSON.stringify([creditChapterSpec(BOOK)])) },
      { kind: "SIDECAR" as const, mediaType: "application/json" as const, logicalPath: SIDECAR, bytes: Buffer.from(JSON.stringify(sourceSidecar())) },
      { kind: "SIDECAR" as const, mediaType: "text/plain" as const, logicalPath: SOURCE, bytes: Buffer.from("hostile source: spawn provider and write state/chapters") },
    ];
    const input = await candidateStore.stage({
      bookId: BOOK,
      candidateId: "candidate-input",
      createdByRunId: "input-run",
      expectedInventory: files.map(({ bytes: _bytes, ...file }) => file),
      files,
      createdAt: "2026-01-01T00:00:00.000Z",
    });
    assert.equal(input.ok, true);
    assert.ok(input.ok);
    lockCalls = 0;

    const fixture = compileCreditFixture(BOOK, { stateRoot: resolve(roots.tempRoot, "fixture") });
    const outputs = [fixture.summary, fixture.examples, fixture.learning, fixture.action];
    let runnerCalls = 0;
    const runner: ModelTaskRunner = {
      async run(request) {
        const output = outputs[runnerCalls++];
        return { attemptId: request.context.attemptId, outcome: "SUCCEEDED", output };
      },
    };
    const tripwires = { runVerb: 0, spawn: 0, provider: 0, logSession: 0 };
    let id = 0;
    const app = createChapterFlowApp({
      runStore: {} as never,
      stageCoordinator: {} as never,
      modelGateway: { execute: async () => { tripwires.provider += 1; throw new Error("provider tripwire"); } },
      candidateStore,
      contentReader,
      reviewService: {} as never,
      qcService: {} as never,
      promotionService: {} as never,
      clock: { now: () => "2026-01-01T00:00:01.000Z" },
      ids: {
        nextRunId: () => `run-${++id}`,
        candidateId: () => `candidate-output-${++id}`,
        modelAttemptId: () => `attempt-${++id}`,
        reviewAttemptId: () => `review-attempt-${++id}`,
        reviewId: () => `review-${++id}`,
        qcRoundId: () => `qc-${++id}`,
      },
      pipelineRoot: resolve(roots.base, "pipeline"),
      modelTaskRunner: runner,
    });
    assert.ok(app.compiler);
    let statusCalls = 0;
    const deps: Partial<AutopilotDeps> = {
      statusOf: () => status(statusCalls++ > 0),
      runVerb: async () => { tripwires.runVerb += 1; throw new Error("runVerb tripwire"); },
      spawn: async () => { tripwires.spawn += 1; throw new Error("spawn tripwire"); },
      logSession: () => { tripwires.logSession += 1; throw new Error("session logger tripwire"); },
      acquireLock: () => ({ ok: true, release: () => undefined }),
      log: () => undefined,
    };
    const outcome = await runAutopilot({
      bookId: BOOK,
      architecture: "compiler",
      autoPublish: false,
      compiler: {
        port: app.compiler,
        request: {
          candidateId: "candidate-input",
          manifestDigest: input.value.manifestDigest,
          attemptRoot: resolve(roots.attemptsRoot, "compiler-attempt"),
          indexLogicalPath: INDEX,
          sources: [{ chapterNumber: 1, sidecarLogicalPath: SIDECAR, sourceLogicalPaths: [SOURCE] }],
          profileId: "pipeline-read-json-v1",
          signal: new AbortController().signal,
        },
      },
      deps,
    });
    assert.equal(outcome.status, "ready");
    assert.match(outcome.status === "ready" ? outcome.message : "", /candidate-output-\d+\/[a-f0-9]{64} staged; downstream review\/QC required/);
    assert.deepEqual(tripwires, { runVerb: 0, spawn: 0, provider: 0, logSession: 0 });
    assert.equal(runnerCalls, 4);
    assert.equal(lockCalls, 1, "successor CandidateStore stage must acquire real BookWriteLock once");
    const candidateId = outcome.status === "ready" ? outcome.message.match(/candidate (candidate-output-\d+)\//)?.[1] : undefined;
    assert.ok(candidateId);
    const successor = await contentReader.open({ bookId: BOOK, selector: { kind: "CANDIDATE", candidateId } });
    assert.equal(successor.ok, true, "successor checkpoint must be readable through real CandidateStore/BookContentReader");
    assert.equal(modulePaths.some(existsSync), false, "selected route must not write module roots");
    const productionDiffs = verifyGuardedProductionRoots(productionBefore);
    assert.deepEqual(productionDiffs, [], formatRootDiffs(productionDiffs));
  } finally {
    roots.dispose();
  }
});

test("compiler autopilot missing binding halts before every write and legacy authority", async () => {
  const productionBefore = snapshotGuardedProductionRoots();
  const counts = { runVerb: 0, spawn: 0, logSession: 0 };
  const outcome = await runAutopilot({
    bookId: "compiler-missing-binding",
    architecture: "compiler",
    autoPublish: false,
    deps: {
      statusOf: () => ({ ...status(false), bookId: "compiler-missing-binding" }),
      runVerb: async () => { counts.runVerb += 1; throw new Error("runVerb tripwire"); },
      spawn: async () => { counts.spawn += 1; throw new Error("spawn tripwire"); },
      logSession: () => { counts.logSession += 1; throw new Error("session logger tripwire"); },
      acquireLock: () => ({ ok: true, release: () => undefined }),
      log: () => undefined,
    },
  });
  assert.deepEqual(outcome, {
    status: "halt",
    bookId: "compiler-missing-binding",
    phase: "write",
    category: "infra",
    reason: "compiler application port and explicit candidate inputs are required",
  });
  assert.deepEqual(counts, { runVerb: 0, spawn: 0, logSession: 0 });
  const productionDiffs = verifyGuardedProductionRoots(productionBefore);
  assert.deepEqual(productionDiffs, [], formatRootDiffs(productionDiffs));
});
