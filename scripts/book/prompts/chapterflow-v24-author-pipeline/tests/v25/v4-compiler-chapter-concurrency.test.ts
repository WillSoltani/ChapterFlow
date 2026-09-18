/**
 * Bounded chapter-level concurrency in the compiler's drafting phase.
 *
 * The compile drafts N chapters through a fixed worker pool instead of one
 * strictly sequential for-await. These cases pin the three properties that make
 * that safe, each of which FAILS on the sequential port:
 *
 *   - chapters actually overlap, up to the bound and no further;
 *   - a structural block in one chapter still fails the ROUND, but the chapters
 *     already in flight settle their current attempt first, so a pack that
 *     passed its gate is stored and the next operator round reuses it;
 *   - what is stored does not depend on completion order: the same compile at
 *     concurrency 1 and at concurrency N stages byte-identical candidate files
 *     and checkpoints the same attempt ids in the same order.
 *
 * Section order WITHIN a chapter (summary → example → learning → action) and the
 * single post-loop assembly pass over every chapter are unchanged, and are
 * asserted here rather than assumed.
 */

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

import {
  CompilerApplicationPort,
  DEFAULT_CHAPTER_CONCURRENCY,
  MAX_SECTION_ATTEMPTS,
  type CompilerApplicationRequest,
} from "../../src/app/compilerApplicationPort.js";
import { createBookWriteLock } from "../../src/books/bookLease.js";
import { createFileSectionPackCache, sectionPackCacheDir } from "../../src/books/sectionPackCache.js";
import { bookDesignPath, writeJsonFile } from "../../src/artifacts/artifactStore.js";
import { deriveBookDesign } from "../../src/compiler/bookDesign.js";
import type { CandidateManifest, CandidateSnapshot, CandidateStore } from "../../src/books/candidateTypes.js";
import type { ModelTaskRunner } from "../../src/app/modelTaskRunner.js";
import { FileRunStore } from "../../src/run-state/fileRunStore.js";
import { FileStageCoordinator } from "../../src/run-state/stageCoordinator.js";
import {
  compileCreditFixture,
  creditSidecarForChapter,
  creditChapterSpecForChapter,
  type CreditFixture,
} from "../fixtures/creditBookFixture.js";
import { finishV25Tests, requiredTest, type TestContext } from "./harness.js";

const BOOK = "compiler-concurrency-book";
const INPUT = "candidate-input";
const DIGEST = "a".repeat(64);
const PROFILE = "attempt-read-json-v1" as const;
const INDEX = "inputs/chapter-index.json";
const CONTEXT = "inputs/compiler-section-task-context.json";

const chapterKey = (chapterNumber: number): string => `ch${String(chapterNumber).padStart(2, "0")}`;
const sidecarPath = (chapterNumber: number): string => `inputs/${chapterKey(chapterNumber)}.source.json`;
const sourcePath = (chapterNumber: number): string => `inputs/${chapterKey(chapterNumber)}.source.txt`;

const delay = (ms: number): Promise<void> => new Promise((done) => { setTimeout(done, ms); });

function contextBytes(): Uint8Array {
  return Buffer.from(JSON.stringify({
    schemaVersion: "compiler-section-task-context-v1",
    bookId: BOOK,
    voiceCard: "voice: direct and warm",
    bookScars: { bookId: BOOK, phrases: ["reused phrase"], frames: [], notes: [] },
  }));
}

/** An N-chapter input candidate: the credit fixture chapter re-keyed into N slots. */
function multiChapterCandidate(chapters: number): CandidateSnapshot {
  const specs = Array.from({ length: chapters }, (_, index) => creditChapterSpecForChapter(BOOK, index + 1));
  const files = [
    { kind: "SIDECAR" as const, mediaType: "application/json" as const, logicalPath: INDEX, bytes: Buffer.from(JSON.stringify(specs)) },
    ...specs.flatMap((_spec, index) => [
      {
        kind: "SIDECAR" as const,
        mediaType: "application/json" as const,
        logicalPath: sidecarPath(index + 1),
        bytes: Buffer.from(JSON.stringify(creditSidecarForChapter(index + 1))),
      },
      {
        kind: "SIDECAR" as const,
        mediaType: "text/plain" as const,
        logicalPath: sourcePath(index + 1),
        bytes: Buffer.from(`source text for ${chapterKey(index + 1)}`),
      },
    ]),
    { kind: "SIDECAR" as const, mediaType: "application/json" as const, logicalPath: CONTEXT, bytes: contextBytes() },
  ].map((file) => ({ ...file, byteLength: file.bytes.byteLength }));
  return {
    manifest: {
      schemaVersion: "1",
      bookId: BOOK,
      candidateId: INPUT,
      createdByRunId: "input-run",
      entries: files.map(({ bytes: _bytes, ...file }) => file),
      manifestDigest: DIGEST,
      createdAt: "2026-01-01T00:00:00.000Z",
    },
    files,
  };
}

type SectionCall = Readonly<{ chapterNumber: number; kind: string; operationId: string; attemptId: string }>;

type RigOptions = Readonly<{
  chapters: number;
  /** Shared durable section-pack cache; absent = always draft. */
  cache?: ReturnType<typeof createFileSectionPackCache>;
  /** Milliseconds each fake model call spends "in flight". */
  callMs?: number;
  /** Return a REPLACEMENT draft for this call, or undefined for the fixture pack. */
  sectionOutput?: (call: SectionCall, fixtures: readonly CreditFixture[], attempt: number) => unknown;
  /** Awaited BEFORE the fake call returns, so a test can order two chapters. */
  beforeReturn?: (call: SectionCall) => Promise<void> | void;
  /**
   * A provider-side block for this call: the message the provider itself would
   * emit, returned as the gateway's own MODEL_PROCESS_FAILED failure so the port
   * classifies it through `providerBlockOfError` and fails fast on attempt 1
   * (R-001). Absent = this call drafts normally.
   */
  providerBlock?: (call: SectionCall) => string | undefined;
  runStateSuffix?: string;
}>;

function rig(context: TestContext, suffix: string, options: RigOptions) {
  const { chapters } = options;
  const fixtureRoot = resolve(context.roots.tempRoot, `fixture-${suffix}`);
  const seeds = Array.from({ length: chapters }, (_, index) => compileCreditFixture(BOOK, { stateRoot: fixtureRoot }, index + 1));
  writeJsonFile(
    bookDesignPath(BOOK, { stateRoot: fixtureRoot }),
    deriveBookDesign(BOOK, { packets: seeds.map((seed) => seed.packet), chapters }),
  );
  // Re-compile AFTER the design is written: compileChapterBlueprint salts from it,
  // exactly as the rig in v4-compiler-application-port.test.ts does.
  const fixtures = Array.from({ length: chapters }, (_, index) => compileCreditFixture(BOOK, { stateRoot: fixtureRoot }, index + 1));

  const selected = multiChapterCandidate(chapters);
  const counts = { open: 0, runner: 0, stage: 0 };
  const calls: SectionCall[] = [];
  const attemptsByOperation = new Map<string, number>();
  const inFlight = new Set<number>();
  let maxInFlight = 0;
  let stagedInput: Parameters<CandidateStore["stage"]>[0] | null = null;
  let stagedSnapshot: CandidateSnapshot | null = null;
  const controller = new AbortController();
  const runStateRoot = resolve(context.roots.tempRoot, `run-state-${options.runStateSuffix ?? suffix}`);
  const runStore = new FileRunStore(runStateRoot);
  const stageCoordinator = new FileStageCoordinator(runStateRoot);

  const parse = (operationId: string): { chapterNumber: number; kind: string } => {
    const match = /^compiler-ch(\d+)-(.+)$/.exec(operationId);
    assert.ok(match, `unexpected compiler operation id ${operationId}`);
    return { chapterNumber: Number(match[1]), kind: match[2] };
  };

  const runner: ModelTaskRunner = {
    async run(request) {
      const { chapterNumber, kind } = parse(request.context.operationId);
      const call: SectionCall = {
        chapterNumber,
        kind,
        operationId: request.context.operationId,
        attemptId: request.context.attemptId,
      };
      counts.runner += 1;
      calls.push(call);
      // A chapter is IN FLIGHT for the duration of its own model call. Each chapter
      // makes its four calls strictly one at a time, so two distinct chapter numbers
      // outstanding at once is chapter-level concurrency and nothing else.
      inFlight.add(chapterNumber);
      maxInFlight = Math.max(maxInFlight, inFlight.size);
      try {
        const admittedAt = context.clock.now();
        const admission = await runStore.admitAttempt({
          bookId: request.context.bookId,
          runId: request.context.runId,
          attemptId: request.context.attemptId,
          stageId: request.context.stageId,
          operationId: request.context.operationId,
          admittedAt,
          staleAt: new Date(Date.parse(admittedAt) + 60_000).toISOString(),
        });
        assert.equal(admission.ok, true, `attempt ${request.context.attemptId} must admit`);
        await delay(options.callMs ?? 10);
        if (options.beforeReturn) await options.beforeReturn(call);
        const providerBlockMessage = options.providerBlock?.(call);
        if (providerBlockMessage !== undefined) {
          const failed = await runStore.finishAttempt({
            bookId: request.context.bookId,
            runId: request.context.runId,
            attemptId: request.context.attemptId,
            outcome: "FAILED",
            finishedAt: context.clock.now(),
          });
          assert.equal(failed.ok, true);
          return {
            attemptId: request.context.attemptId,
            outcome: "FAILED",
            error: { code: "MODEL_PROCESS_FAILED", message: providerBlockMessage },
          };
        }
        const finished = await runStore.finishAttempt({
          bookId: request.context.bookId,
          runId: request.context.runId,
          attemptId: request.context.attemptId,
          outcome: "SUCCEEDED",
          finishedAt: context.clock.now(),
        });
        assert.equal(finished.ok, true);
        const attempt = (attemptsByOperation.get(request.context.operationId) ?? 0) + 1;
        attemptsByOperation.set(request.context.operationId, attempt);
        const fixture = fixtures[chapterNumber - 1];
        const custom = options.sectionOutput?.(call, fixtures, attempt);
        const output = (custom ?? {
          "summary-pack": fixture.summary,
          "example-pack": fixture.examples,
          "learning-pack": fixture.learning,
          "action-pack": fixture.action,
        }[kind]) as Record<string, unknown>;
        return { attemptId: request.context.attemptId, outcome: "SUCCEEDED", output };
      } finally {
        inFlight.delete(chapterNumber);
      }
    },
  };

  const candidateStore: CandidateStore = {
    async open(input) {
      if (stagedSnapshot && input.selector.kind === "CANDIDATE" && input.selector.candidateId === stagedSnapshot.manifest.candidateId) {
        return { ok: true, value: stagedSnapshot };
      }
      return { ok: false, error: { code: "CANDIDATE_NOT_FOUND", message: "not found" } };
    },
    async stage(input) {
      counts.stage += 1;
      stagedInput = input;
      const manifest: CandidateManifest = {
        schemaVersion: "1",
        bookId: input.bookId,
        candidateId: input.candidateId,
        ...(input.parentCandidateId ? { parentCandidateId: input.parentCandidateId } : {}),
        createdByRunId: input.createdByRunId,
        entries: input.files.map((file) => ({ kind: file.kind, logicalPath: file.logicalPath, mediaType: file.mediaType, byteLength: file.bytes.byteLength })),
        manifestDigest: "b".repeat(64),
        createdAt: input.createdAt,
      };
      stagedSnapshot = { manifest, files: input.files.map((file) => ({ ...file, byteLength: file.bytes.byteLength })) };
      return { ok: true, value: manifest };
    },
  };

  const port = new CompilerApplicationPort({
    pipelineRoot: resolve(context.roots.base, "pipeline-root"),
    sleep: async () => {},
    ...(options.cache ? { sectionPackCache: options.cache } : {}),
    contentReader: {
      async open() {
        counts.open += 1;
        return { ok: true, value: selected };
      },
    },
    candidateStore,
    runner,
    runStore,
    stageCoordinator,
    ids: {
      nextRunId: () => `run-${suffix}`,
      candidateId: (runId) => `candidate-${runId}`,
      modelAttemptId: (runId) => `attempt-${runId}`,
      reviewAttemptId: (runId) => `review-attempt-${runId}`,
      reviewId: (runId) => `review-${runId}`,
      qcRoundId: (runId) => `qc-${runId}`,
    },
    clock: context.clock,
  });

  const request: CompilerApplicationRequest = {
    bookId: BOOK,
    candidateId: INPUT,
    manifestDigest: DIGEST,
    sourceGitSha: "a20d1cdab0fc33c4c1f840f4cf99089816e022d4",
    attemptRoot: resolve(context.roots.attemptsRoot, suffix),
    indexLogicalPath: INDEX,
    sectionTaskContextLogicalPath: CONTEXT,
    sources: Array.from({ length: chapters }, (_, index) => ({
      chapterNumber: index + 1,
      sidecarLogicalPath: sidecarPath(index + 1),
      sourceLogicalPaths: [sourcePath(index + 1)],
    })),
    profileId: PROFILE,
    signal: controller.signal,
  };

  return {
    port,
    request,
    counts,
    calls,
    fixtures,
    runStore,
    runStateRoot,
    staged: () => stagedInput,
    maxInFlight: () => maxInFlight,
  };
}

/** Every stored section-pack cache entry's (chapterId, kind), sorted. */
function cachedPacks(booksRoot: string): string[] {
  const dir = sectionPackCacheDir(booksRoot, BOOK);
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((name) => name.endsWith(".json"))
    .map((name) => JSON.parse(readFileSync(resolve(dir, name), "utf8")) as Record<string, unknown>)
    .map((envelope) => {
      const key = envelope.key as Record<string, unknown> | undefined;
      return `${String(key?.chapterId ?? envelope.chapterId)}/${String(key?.kind ?? envelope.kind)}`;
    })
    .sort();
}

/** The section kinds one chapter drafted, in the order the calls were made. */
function kindsFor(calls: readonly SectionCall[], chapterNumber: number): string[] {
  return calls.filter((call) => call.chapterNumber === chapterNumber).map((call) => call.kind);
}

// ---------------------------------------------------------------------------
// (1) the pool itself
// ---------------------------------------------------------------------------

requiredTest("CONC-a three chapters draft CONCURRENTLY at the default bound, and each chapter's packs stay in SECTION_KINDS order", async (context) => {
  const subject = rig(context, "pool-default", { chapters: 3 });
  await subject.port.run(subject.request).catch(() => undefined);
  assert.equal(
    subject.maxInFlight(),
    3,
    `three chapters must be in flight at once at the default bound (saw ${subject.maxInFlight()})`,
  );
  assert.ok(DEFAULT_CHAPTER_CONCURRENCY >= 3, "the default bound must admit three chapters");
  // Within a chapter the four packs are still strictly ordered and strictly
  // sequential: summary-pack's accepted prose is a gate input for the other three.
  for (const chapterNumber of [1, 2, 3]) {
    assert.deepEqual(
      kindsFor(subject.calls, chapterNumber),
      ["summary-pack", "example-pack", "learning-pack", "action-pack"],
      `chapter ${chapterNumber} drafted its packs out of SECTION_KINDS order`,
    );
  }
  assert.equal(subject.counts.runner, 12, "every chapter must still draft all four packs");
});

requiredTest("CONC-b the bound is honoured: chapterConcurrency 1 is the strictly sequential pass, and chapters still interleave at 2", async (context) => {
  const sequential = rig(context, "pool-one", { chapters: 3 });
  await sequential.port.run({ ...sequential.request, chapterConcurrency: 1 }).catch(() => undefined);
  assert.equal(sequential.maxInFlight(), 1, "chapterConcurrency 1 must never overlap two chapters");
  assert.deepEqual(
    sequential.calls.map((call) => call.chapterNumber),
    [1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3],
    "chapterConcurrency 1 must draft chapter by chapter in index order",
  );

  const bounded = rig(context, "pool-two", { chapters: 3 });
  await bounded.port.run({ ...bounded.request, chapterConcurrency: 2 }).catch(() => undefined);
  assert.equal(bounded.maxInFlight(), 2, "chapterConcurrency 2 must admit exactly two chapters at a time");
});

requiredTest("CONC-c an out-of-range chapterConcurrency fails CLOSED before any model call", async (context) => {
  for (const bad of [0, -1, 2.5, Number.NaN]) {
    const subject = rig(context, `bad-${String(bad)}`, { chapters: 2 });
    await assert.rejects(
      subject.port.run({ ...subject.request, chapterConcurrency: bad }),
      /COMPILER_INPUT_INVALID:chapterConcurrency/,
      `chapterConcurrency ${String(bad)} must be refused`,
    );
    assert.equal(subject.counts.runner, 0, "a refused knob must not spend a model call");
  }
});

// ---------------------------------------------------------------------------
// (2) round semantics — a structural block still fails the round, after a drain
// ---------------------------------------------------------------------------

requiredTest("CONC-d a COMPILER_SECTION_BLOCKED chapter fails the ROUND, but an in-flight chapter's passed pack is already stored", async (context) => {
  const writeLock = createBookWriteLock({ booksRoot: context.roots.booksRoot });
  const cache = createFileSectionPackCache({ booksRoot: context.roots.booksRoot, writeLock });
  // Chapter 2 reaches its example-pack only after its summary-pack cleared the
  // gate and was written to the durable cache, so resolving this there is an
  // order-free way to say "chapter 2's summary is stored".
  let chapter2SummaryStored: () => void = () => {};
  const chapter2Progressed = new Promise<void>((done) => { chapter2SummaryStored = done; });

  const subject = rig(context, "blocked-drain", {
    chapters: 2,
    cache,
    // Chapter 1's summary-pack is refused by the gate on every attempt (a hook far
    // under SEC3's floor), so the chapter exhausts MAX_SECTION_ATTEMPTS and throws.
    sectionOutput: (call, fixtures) => (call.chapterNumber === 1 && call.kind === "summary-pack"
      ? { ...fixtures[0].summary, hook: { ...fixtures[0].summary.hook, hook: "Too short." } }
      : undefined),
    beforeReturn: async (call) => {
      if (call.chapterNumber === 2 && call.kind === "example-pack") chapter2SummaryStored();
      // Chapter 1 may only burn its three attempts once chapter 2 has stored a
      // pack — bounded, so the SEQUENTIAL port does not hang here, it just fails
      // the assertion below with nothing of chapter 2's stored.
      if (call.chapterNumber === 1) await Promise.race([chapter2Progressed, delay(400)]);
    },
  });

  await assert.rejects(
    subject.port.run(subject.request),
    /COMPILER_SECTION_BLOCKED:summary-pack/,
    "a structural block must still fail the whole round",
  );
  const stored = cachedPacks(context.roots.booksRoot);
  assert.ok(
    stored.includes(`${BOOK}-ch02/summary-pack`),
    `chapter 2's gate-passed summary-pack must survive chapter 1's block (stored: ${JSON.stringify(stored)})`,
  );
  assert.ok(
    !stored.some((entry) => entry.startsWith(`${BOOK}-ch01/`)),
    `chapter 1 never cleared a gate, so it must have stored nothing (stored: ${JSON.stringify(stored)})`,
  );
  assert.equal(subject.counts.stage, 0, "a failed round stages no candidate");
  const run = await subject.runStore.readRun(BOOK, "run-blocked-drain", context.clock.now());
  assert.equal(run.ok, true);
  if (run.ok) assert.equal(run.value.status, "FAILED");
});

// ---------------------------------------------------------------------------
// (3) determinism — stored artifacts do not depend on completion order
// ---------------------------------------------------------------------------

requiredTest("CONC-e what the round STORES is identical at concurrency 1 and at the bound: same packs, same attempt ids in the same order, same assembly verdict", async (context) => {
  // Two copies of the one gate-clean chapter fixture pass every PER-CHAPTER gate
  // and are then correctly refused by the CROSS-chapter anti-sameness gates at
  // assembly (SEC81/82/94/114) — which is itself the point being pinned: assembly
  // still sees the whole book, in chapter order, and still blocks it, whether the
  // chapters were drafted one at a time or together. Everything the round made
  // durable before that verdict is compared byte for byte.
  const run = async (suffix: string, chapterConcurrency: number) => {
    const booksRoot = resolve(context.roots.tempRoot, `books-${suffix}`);
    mkdirSync(booksRoot, { recursive: true });
    const cache = createFileSectionPackCache({ booksRoot, writeLock: createBookWriteLock({ booksRoot }) });
    const subject = rig(context, suffix, { chapters: 2, cache });
    const failure = await subject.port.run({ ...subject.request, chapterConcurrency }).then(
      () => { throw new Error("two copies of one chapter must be refused by the cross-chapter gates"); },
      (error: unknown) => (error as Error).message,
    );
    return { subject, failure, booksRoot };
  };

  const one = await run("det-one", 1);
  const many = await run("det-many", 8);
  assert.equal(one.subject.maxInFlight(), 1);
  assert.equal(many.subject.maxInFlight(), 2, "both chapters must have overlapped in the concurrent run");

  // (i) the DRAFTED PACKS. The cache is content-addressed per
  // (chapterId, kind, blueprintDigest, packetDigest, scarsDigest, taskCardDigest),
  // so identical file names AND identical bytes is the whole claim: nothing about
  // what was stored, or where, moved with completion order.
  const entries = (booksRoot: string): Array<[string, string]> => {
    const dir = sectionPackCacheDir(booksRoot, BOOK);
    return readdirSync(dir)
      .filter((name) => name.endsWith(".json"))
      .sort()
      .map((name) => [name, readFileSync(resolve(dir, name), "utf8")] as [string, string]);
  };
  // Eight packs are stored as they clear their gates; assembly then evicts exactly
  // one of them (ch02's action-pack, the surplus side of the SEC94/SEC114 opener
  // collision) as its re-draft plan. Seven surviving entries is therefore the
  // post-eviction truth, and it must be the SAME seven either way.
  const identities = (booksRoot: string): string[] => entries(booksRoot)
    .map(([, body]) => {
      const envelope = JSON.parse(body) as Record<string, unknown>;
      return `${String(envelope.chapterId)}/${String(envelope.kind)}`;
    })
    .sort();
  assert.deepEqual(identities(one.booksRoot), [
    `${BOOK}-ch01/action-pack`,
    `${BOOK}-ch01/example-pack`,
    `${BOOK}-ch01/learning-pack`,
    `${BOOK}-ch01/summary-pack`,
    `${BOOK}-ch02/example-pack`,
    `${BOOK}-ch02/learning-pack`,
    `${BOOK}-ch02/summary-pack`,
  ], "the sequential round's surviving cache entries are the contract");
  assert.deepEqual(entries(many.booksRoot), entries(one.booksRoot), "stored section packs must not depend on completion order");

  // (ii) the CHECKPOINT. Attempt ids are checkpointed on the failure path too, and
  // they are flattened in CHAPTER order, never completion order.
  const checkpointAttemptIds = (runStateRoot: string, runId: string): unknown => {
    const dir = resolve(runStateRoot, "books", BOOK, "runs", runId);
    const files = readdirSync(dir, { recursive: true, encoding: "utf8" })
      .filter((name) => name.endsWith(".json") && name.includes("compiler-candidate"))
      .sort();
    assert.equal(files.length, 1, `expected exactly one compiler checkpoint under ${dir}, saw ${JSON.stringify(files)}`);
    return (JSON.parse(readFileSync(resolve(dir, files[0]), "utf8")) as Record<string, unknown>).attemptIds;
  };
  // Compiler attempt ids are `cmp-<sha256(runId \0 operationId)[0..40]>` — unchanged
  // by this package — and they are checkpointed on the failure path too. They are
  // flattened in CHAPTER order after the pool drains, never in completion order, so
  // both rounds must checkpoint exactly the ids their own run id mints, in
  // chapter-then-SECTION_KINDS order.
  const expectedIds = (runId: string): string[] => [1, 2].flatMap((chapterNumber) =>
    ["summary-pack", "example-pack", "learning-pack", "action-pack"].map((kind) => {
      const operationId = `compiler-ch${String(chapterNumber).padStart(2, "0")}-${kind}`;
      return `cmp-${createHash("sha256").update(runId).update("\0").update(operationId).digest("hex").slice(0, 40)}`;
    }));
  assert.deepEqual(
    checkpointAttemptIds(one.subject.runStateRoot, "run-det-one"),
    expectedIds("run-det-one"),
    "the sequential round's checkpointed attempt ids are the contract",
  );
  assert.deepEqual(
    checkpointAttemptIds(many.subject.runStateRoot, "run-det-many"),
    expectedIds("run-det-many"),
    "attempt ids must be unchanged and in chapter order when chapters draft concurrently",
  );

  // (iii) the ASSEMBLY VERDICT. The message is derived from every chapter's packs
  // read together in chapter order, so byte-identity here is the strongest single
  // statement that assembly's input was unchanged by the pool.
  assert.match(one.failure, /^COMPILER_ASSEMBLY_BLOCKED:/);
  assert.equal(many.failure, one.failure, "the whole-book assembly verdict must not depend on completion order");
});

// ---------------------------------------------------------------------------
// (4) WHICH failure the round reports — chapter order, never wall-clock order
// ---------------------------------------------------------------------------
//
// The round's error is stored durably as the run's failure `reason`
// (failCompilerRun) and its PREFIX is what bookRunApplicationService matches
// against RETRYABLE_COMPILER_FAILURES to decide whether the operator is granted
// another round. COMPILER_SECTION_PROVIDER_BLOCKED is deliberately absent from
// that list (R-001: never retry against a provider wall) and
// COMPILER_SECTION_BLOCKED is on it — so if concurrency let the reported class
// depend on which fake call happened to be slower, R-001 itself would become a
// race. These cases pin the selection instead: the round always reports the
// LOWEST-NUMBERED failing chapter, which is exactly the chapter the sequential
// loop would have reported, and a chapter is only ever stopped early by a
// failure BELOW it — never by one above, which would mask its own.

const QUOTA_MESSAGE = "You've hit your weekly limit \u00b7 resets Sep 1 at 8pm (America/Halifax) (api_error_status=429)";

/** A gate-refusable summary draft: a hook far under SEC3's floor. */
const shortHookSummary = (fixture: CreditFixture): unknown =>
  ({ ...fixture.summary, hook: { ...fixture.summary.hook, hook: "Too short." } });

requiredTest("CONC-f two chapters fail with DIFFERENT classes: the round reports the LOWER chapter's class in either timing", async (context) => {
  // Chapter 1 is gate-refused on every summary attempt (COMPILER_SECTION_BLOCKED,
  // retryable); chapter 2 walks into a quota wall on its first call
  // (COMPILER_SECTION_PROVIDER_BLOCKED, deliberately NOT retryable). Chapter 1 is
  // the lower chapter, so its class is the round's class — whichever failure the
  // clock happens to produce first.
  const run = async (suffix: string, holdChapter2UntilChapter1Fails: boolean, chapterConcurrency?: number) => {
    let releaseChapter2: () => void = () => {};
    const chapter1Exhausted = new Promise<void>((done) => { releaseChapter2 = done; });
    let chapter1SummaryCalls = 0;
    const subject = rig(context, suffix, {
      chapters: 2,
      sectionOutput: (call, fixtures) => (call.chapterNumber === 1 && call.kind === "summary-pack"
        ? shortHookSummary(fixtures[0])
        : undefined),
      providerBlock: (call) => (call.chapterNumber === 2 && call.kind === "summary-pack" ? QUOTA_MESSAGE : undefined),
      beforeReturn: async (call) => {
        if (call.chapterNumber === 1 && call.kind === "summary-pack") {
          chapter1SummaryCalls += 1;
          if (chapter1SummaryCalls >= MAX_SECTION_ATTEMPTS) releaseChapter2();
        }
        if (!holdChapter2UntilChapter1Fails || call.chapterNumber !== 2) return;
        // Timing B: chapter 1's block is recorded FIRST. Without the hold chapter 2
        // wins by a wide margin (one call against three), so this is the other side
        // of the same race.
        await Promise.race([chapter1Exhausted, delay(4000)]);
        await delay(400);
      },
    });
    const failure = await subject.port.run({
      ...subject.request,
      ...(chapterConcurrency === undefined ? {} : { chapterConcurrency }),
    }).then(
      () => { throw new Error("both chapters fail, so the round must fail"); },
      (error: unknown) => (error as Error).message,
    );
    return { subject, failure };
  };

  // Timing A: chapter 2's provider block lands FIRST (one call against three).
  const providerFirst = await run("class-provider-first", false);
  // Timing B: chapter 1's structural block lands first.
  const blockedFirst = await run("class-blocked-first", true);
  // The BASELINE this has to match: at chapterConcurrency 1 the compile is the
  // pre-concurrency sequential pass, which fails on chapter 1 and never reaches
  // chapter 2 at all.
  const sequential = await run("class-sequential", false, 1);
  assert.equal(sequential.subject.maxInFlight(), 1);
  assert.ok(
    !sequential.subject.calls.some((call) => call.chapterNumber === 2),
    "the sequential baseline must never reach chapter 2",
  );

  for (const [label, outcome] of [["provider-block-first", providerFirst], ["blocked-first", blockedFirst]] as const) {
    assert.match(
      outcome.failure,
      /^COMPILER_SECTION_BLOCKED:summary-pack:/,
      `${label}: the round must report chapter 1's class, not whichever chapter lost the race (got ${outcome.failure})`,
    );
  }
  assert.equal(
    providerFirst.failure,
    blockedFirst.failure,
    "the stored failure reason must be identical in both timings",
  );
  assert.equal(
    providerFirst.failure,
    sequential.failure,
    "the concurrent round must store the same failure reason the sequential pass stores",
  );
  // Both chapters really did fail, in both timings — the selection is what is
  // being pinned here, not one chapter quietly never running.
  assert.ok(
    providerFirst.subject.calls.some((call) => call.chapterNumber === 2),
    "chapter 2 must have run in timing A",
  );
  assert.ok(
    blockedFirst.subject.calls.some((call) => call.chapterNumber === 2),
    "chapter 2 must have run in timing B",
  );
});

requiredTest("CONC-g a LOWER chapter's provider wall is never masked by a HIGHER chapter's retryable block", async (context) => {
  // The R-001 harm this guards. Chapter 1's example-pack hits a quota wall
  // (not retryable); chapter 2 is gate-refused on its summary (retryable). If a
  // sibling's failure could stop chapter 1 BEFORE it reached its own wall, the
  // round would report the retryable class and the operator would be granted a
  // round against a wall the sequential compile would have reported. So a chapter
  // stops for a failure BELOW it only — never for one above.
  const run = async (suffix: string, holdChapter1UntilChapter2Fails: boolean, chapterConcurrency?: number) => {
    let releaseChapter1: () => void = () => {};
    const chapter2Exhausted = new Promise<void>((done) => { releaseChapter1 = done; });
    let chapter2SummaryCalls = 0;
    const subject = rig(context, suffix, {
      chapters: 2,
      sectionOutput: (call, fixtures) => (call.chapterNumber === 2 && call.kind === "summary-pack"
        ? shortHookSummary(fixtures[1])
        : undefined),
      providerBlock: (call) => (call.chapterNumber === 1 && call.kind === "example-pack" ? QUOTA_MESSAGE : undefined),
      beforeReturn: async (call) => {
        if (call.chapterNumber === 2 && call.kind === "summary-pack") {
          chapter2SummaryCalls += 1;
          if (chapter2SummaryCalls >= MAX_SECTION_ATTEMPTS) releaseChapter1();
        }
        if (!holdChapter1UntilChapter2Fails || call.chapterNumber !== 1 || call.kind !== "summary-pack") return;
        // Timing A: chapter 2's block is recorded while chapter 1 sits exactly at
        // the boundary between its accepted summary-pack and its doomed
        // example-pack — the one window in which a sibling's failure could talk
        // chapter 1 out of ever meeting its own wall.
        await Promise.race([chapter2Exhausted, delay(4000)]);
        await delay(400);
      },
    });
    const failure = await subject.port.run({
      ...subject.request,
      ...(chapterConcurrency === undefined ? {} : { chapterConcurrency }),
    }).then(
      () => { throw new Error("both chapters fail, so the round must fail"); },
      (error: unknown) => (error as Error).message,
    );
    return { subject, failure };
  };

  const higherFirst = await run("mask-higher-first", true);
  const lowerFirst = await run("mask-lower-first", false);
  const sequential = await run("mask-sequential", false, 1);
  assert.equal(sequential.subject.maxInFlight(), 1);

  for (const [label, outcome] of [["higher-chapter-failed-first", higherFirst], ["lower-chapter-failed-first", lowerFirst]] as const) {
    assert.match(
      outcome.failure,
      /^COMPILER_SECTION_PROVIDER_BLOCKED:example-pack:quota-exhausted:/,
      `${label}: chapter 1's provider wall must be the round's reported failure (got ${outcome.failure})`,
    );
    assert.match(outcome.failure, /weekly limit/, `${label}: the operator must see the provider's own words`);
  }
  assert.equal(higherFirst.failure, lowerFirst.failure, "the stored failure reason must be identical in both timings");
  assert.equal(
    higherFirst.failure,
    sequential.failure,
    "the concurrent round must report the same provider wall the sequential pass reports",
  );
  // Chapter 1 reached its example-pack in BOTH timings: that is the claim.
  for (const [label, outcome] of [["higher-chapter-failed-first", higherFirst], ["lower-chapter-failed-first", lowerFirst]] as const) {
    assert.deepEqual(
      kindsFor(outcome.subject.calls, 1),
      ["summary-pack", "example-pack"],
      `${label}: chapter 1 must have drafted through to its own failing section`,
    );
  }
});

requiredTest("CONC-h a chapter above the failure SETTLES the attempt it holds and then spends nothing more", async (context) => {
  // Requirement (c) exactly, made deterministic: chapter 2's first summary call is
  // held until chapter 1's provider block has been recorded, so every later choice
  // chapter 2 makes is a choice made on a round that is ALREADY lost. It must
  // settle the call it holds — that draft still reaches its gate, and a passing one
  // is still stored (CONC-d) — and then stop, rather than burn the remaining
  // MAX_SECTION_ATTEMPTS-1 attempts of a section whose round cannot be saved.
  let chapter1Failed = false;
  let releaseChapter2: () => void = () => {};
  const chapter1Blocked = new Promise<void>((done) => { releaseChapter2 = done; });
  const chapter2CallsAfterTheRoundWasLost: string[] = [];
  const subject = rig(context, "settle-then-stop", {
    chapters: 2,
    sectionOutput: (call, fixtures) => (call.chapterNumber === 2 && call.kind === "summary-pack"
      ? shortHookSummary(fixtures[1])
      : undefined),
    providerBlock: (call) => (call.chapterNumber === 1 && call.kind === "example-pack" ? QUOTA_MESSAGE : undefined),
    beforeReturn: async (call) => {
      if (call.chapterNumber === 1 && call.kind === "example-pack") {
        chapter1Failed = true;
        releaseChapter2();
      }
      if (call.chapterNumber !== 2) return;
      if (!chapter1Failed) {
        await Promise.race([chapter1Blocked, delay(4000)]);
        await delay(400);
      }
      if (chapter1Failed) chapter2CallsAfterTheRoundWasLost.push(call.kind);
    },
  });

  const failure = await subject.port.run(subject.request).then(
    () => { throw new Error("chapter 1 hits a provider wall, so the round must fail"); },
    (error: unknown) => (error as Error).message,
  );
  assert.match(
    failure,
    /^COMPILER_SECTION_PROVIDER_BLOCKED:example-pack:quota-exhausted:/,
    `the lower chapter's provider wall must be the round's failure (got ${failure})`,
  );
  assert.deepEqual(
    kindsFor(subject.calls, 2),
    ["summary-pack"],
    "chapter 2 must settle the ONE attempt it held and spend no further model call",
  );
  assert.deepEqual(
    chapter2CallsAfterTheRoundWasLost,
    ["summary-pack"],
    "the attempt chapter 2 held when the round was lost must still have settled",
  );
});

finishV25Tests().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
