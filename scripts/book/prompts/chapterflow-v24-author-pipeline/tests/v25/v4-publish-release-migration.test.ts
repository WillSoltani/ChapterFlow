import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";

import type { AtomicBookFileSeams } from "../../src/books/atomicBookFiles.js";
import { createBookContentReader } from "../../src/books/bookContentReader.js";
import { createBookWriteLock } from "../../src/books/bookLease.js";
import { createCandidateStore, type CandidateStore } from "../../src/books/candidateStore.js";
import { createCurrentPointerStore, type CurrentPointerStore } from "../../src/books/currentPointer.js";
import type { CandidateIdentity, Result } from "../../src/contracts/v4Core.js";
import type { QcRoundResult, QcService } from "../../src/qc/qcTypes.js";
import { applyCleanup } from "../../src/publish/cleanupBookDebris.js";
import { CanonicalPackageAdapter, type CanonicalReleaseRequest } from "../../src/release/canonicalPackageAdapter.js";
import { LegacyPublishAdapter } from "../../src/release/legacyPublishAdapter.js";
import { createPromotionService } from "../../src/release/promotionService.js";
import type { CanonicalReviewResult, ReviewService } from "../../src/review/reviewTypes.js";
import { fixtureChapter } from "../model-bakeoff-helpers.js";
import { finishV25Tests, requiredTest, type TestContext } from "./harness.js";

const CREATED_AT = "2026-07-20T12:00:00.000Z";
const REVIEW_AT = "2026-07-20T12:00:01.000Z";
const QC_AT = "2026-07-20T12:00:02.000Z";
const PROMOTED_AT = "2026-07-20T12:00:03.000Z";
const CLOCK_AT = "2026-07-20T12:00:04.000Z";

function storage(context: TestContext, atomicSeams?: AtomicBookFileSeams) {
  const writeLock = createBookWriteLock({ booksRoot: context.roots.booksRoot, timeoutMs: 1_000, pollMs: 1 });
  const pointer = createCurrentPointerStore({ booksRoot: context.roots.booksRoot, writeLock, atomicSeams });
  const candidates = createCandidateStore({
    booksRoot: context.roots.booksRoot,
    writeLock,
    currentPointerStore: pointer,
  });
  const reader = createBookContentReader({ booksRoot: context.roots.booksRoot, currentPointerStore: pointer });
  return { pointer, candidates, reader };
}

async function stage(store: CandidateStore, bookId: string, candidateId: string, marker = candidateId): Promise<CandidateIdentity> {
  const chapter = fixtureChapter(bookId, 1, marker);
  const bytes = Buffer.from(`${JSON.stringify(chapter, null, 2)}\n`);
  const staged = await store.stage({
    bookId,
    candidateId,
    createdByRunId: `run-${candidateId}`,
    expectedInventory: [{ kind: "CHAPTER", logicalPath: "chapters/ch01.json", mediaType: "application/json" }],
    files: [{ kind: "CHAPTER", logicalPath: "chapters/ch01.json", mediaType: "application/json", bytes }],
    createdAt: CREATED_AT,
  });
  assert.ok(staged.ok);
  return { candidateId, manifestDigest: staged.value.manifestDigest };
}

function releaseRequest(bookId: string, candidate: CandidateIdentity, expectedBookRevision = 0): CanonicalReleaseRequest {
  return {
    bookId,
    candidate,
    reviewId: `review-${candidate.candidateId}`,
    qcRoundId: `qc-${candidate.candidateId}`,
    expectedBookRevision,
    promotedAt: PROMOTED_AT,
    metadata: {
      title: `Title ${bookId}`,
      author: "Test Author",
      packageId: `${bookId}-v21-1784548803000`,
      createdAt: PROMOTED_AT,
      categories: ["Self-Help"],
      tags: ["fixture"],
    },
  };
}

function authorities(request: CanonicalReleaseRequest, reviewCandidate = request.candidate) {
  const counts = { reviewExecution: 0, qcExecution: 0, reviewRead: 0, qcRead: 0 };
  const review: CanonicalReviewResult = {
    schemaVersion: "1",
    reviewId: request.reviewId,
    candidate: { ...reviewCandidate },
    outcome: "PASS",
    issues: [],
    completedAt: REVIEW_AT,
  };
  const qc: QcRoundResult = {
    schemaVersion: "1",
    roundId: request.qcRoundId,
    candidate: { ...request.candidate },
    reviewId: request.reviewId,
    outcome: "PASS",
    issues: [],
    completedAt: QC_AT,
  };
  const reviewService: ReviewService = {
    screen: async () => { throw new Error("screening cannot authorize release"); },
    reviewCanonical: async () => { counts.reviewExecution += 1; throw new Error("release cannot execute review"); },
    get: async () => { counts.reviewRead += 1; return { ok: true, value: review }; },
  };
  const qcService: QcService = {
    readStatus: async () => { throw new Error("status is outside release"); },
    runFresh: async () => { counts.qcExecution += 1; throw new Error("release cannot execute QC"); },
    getRound: async () => { counts.qcRead += 1; return { ok: true, value: qc }; },
    diagnose: async () => { throw new Error("diagnose is outside release"); },
    repairLedger: async () => { throw new Error("repair is outside release"); },
  };
  return { counts, reviewService, qcService };
}

function countedPointer(pointer: CurrentPointerStore) {
  const counts = { read: 0, compareAndSet: 0 };
  const store: CurrentPointerStore = {
    read: async (bookId) => { counts.read += 1; return pointer.read(bookId); },
    compareAndSet: async (input) => { counts.compareAndSet += 1; return pointer.compareAndSet(input); },
  };
  return { counts, store };
}

function adapter(
  request: CanonicalReleaseRequest,
  stores: ReturnType<typeof storage>,
  writer: ConstructorParameters<typeof CanonicalPackageAdapter>[0]["packageWriter"],
  reviewCandidate = request.candidate,
) {
  const auth = authorities(request, reviewCandidate);
  const pointer = countedPointer(stores.pointer);
  const promotionService = createPromotionService({
    candidateStore: stores.candidates,
    contentReader: stores.reader,
    currentPointerStore: pointer.store,
    reviewService: auth.reviewService,
    qcService: auth.qcService,
    clock: () => CLOCK_AT,
  });
  return {
    auth,
    pointer,
    adapter: new CanonicalPackageAdapter({ contentReader: stores.reader, promotionService, packageWriter: writer }),
  };
}

function assertError(result: Result<unknown>, code: string): void {
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.error.code, code);
}

requiredTest("mismatched candidate review QC tuple blocks package and pointer mutation", async (context) => {
  const stores = storage(context);
  const identity = await stage(stores.candidates, "tuple-book", "candidate-1");
  const request = releaseRequest("tuple-book", identity);
  let packageWrites = 0;
  const mismatch = { ...identity, manifestDigest: "f".repeat(64) };
  const route = adapter(request, stores, () => { packageWrites += 1; }, mismatch);
  const result = await route.adapter.release(request);
  assertError(result, "REVIEW_MISMATCH");
  assert.equal(route.pointer.counts.compareAndSet, 0);
  assert.equal(packageWrites, 0);
  assert.equal(route.auth.counts.qcRead, 0);
});

requiredTest("valid stored authority changes one revision and writes package after verified readback", async (context) => {
  const stores = storage(context);
  const identity = await stage(stores.candidates, "valid-release-book", "candidate-1");
  const request = releaseRequest("valid-release-book", identity);
  let packageWrites = 0;
  const route = adapter(request, stores, ({ package: value }) => {
    packageWrites += 1;
    writeFileSync(join(context.roots.tempRoot, "released-package.json"), JSON.stringify(value));
  });
  const result = await route.adapter.release(request);
  assert.ok(result.ok);
  assert.equal(result.value.bookRevision, 1);
  assert.equal(result.value.readback, "VERIFIED");
  assert.equal(route.pointer.counts.compareAndSet, 1);
  assert.equal(packageWrites, 1);
  const current = await stores.pointer.read(request.bookId);
  assert.ok(current.ok && current.value);
  assert.equal(current.value.candidateId, identity.candidateId);
  assert.equal(current.value.revision, 1);
});

requiredTest("two releases racing same expected revision have exactly one winner", async (context) => {
  const stores = storage(context);
  const left = await stage(stores.candidates, "race-release-book", "candidate-left", "left");
  const right = await stage(stores.candidates, "race-release-book", "candidate-right", "right");
  let packageWrites = 0;
  const leftRequest = releaseRequest("race-release-book", left);
  const rightRequest = releaseRequest("race-release-book", right);
  const leftRoute = adapter(leftRequest, stores, () => { packageWrites += 1; });
  const rightRoute = adapter(rightRequest, stores, () => { packageWrites += 1; });
  const results = await Promise.all([
    leftRoute.adapter.release(leftRequest),
    rightRoute.adapter.release(rightRequest),
  ]);
  assert.equal(results.filter((result) => result.ok).length, 1);
  const loser = results.find((result) => !result.ok);
  assert.ok(loser && !loser.ok);
  assert.equal(loser.error.code, "REVISION_CONFLICT");
  assert.equal(packageWrites, 1);
  assert.equal(leftRoute.pointer.counts.compareAndSet + rightRoute.pointer.counts.compareAndSet, 2);
});

requiredTest("fault before pointer replacement preserves old complete pointer and suppresses package write", async (context) => {
  let armed = false;
  const stores = storage(context, {
    point(name) {
      if (armed && name === "file.before-replace") throw new Error("injected pre-replace fault");
    },
  });
  const oldIdentity = await stage(stores.candidates, "fault-release-book", "candidate-old", "old");
  const oldRequest = releaseRequest("fault-release-book", oldIdentity);
  let packageWrites = 0;
  assert.ok((await adapter(oldRequest, stores, () => { packageWrites += 1; }).adapter.release(oldRequest)).ok);
  const newIdentity = await stage(stores.candidates, "fault-release-book", "candidate-new", "new");
  const newRequest = releaseRequest("fault-release-book", newIdentity, 1);
  armed = true;
  const result = await adapter(newRequest, stores, () => { packageWrites += 1; }).adapter.release(newRequest);
  assertError(result, "RECONCILIATION_REQUIRED");
  assert.equal(packageWrites, 1);
  const current = await stores.pointer.read(newRequest.bookId);
  assert.ok(current.ok && current.value);
  assert.equal(current.value.candidateId, oldIdentity.candidateId);
  assert.equal(current.value.revision, 1);
});

function inventory(root: string): Record<string, string> {
  const out: Record<string, string> = {};
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) walk(path);
      else out[relative(root, path)] = createHash("sha256").update(readFileSync(path)).digest("hex");
    }
  };
  walk(root);
  return out;
}

requiredTest("cleanup removes disposable debris but preserves candidate attempt review and QC evidence", async (context) => {
  const stores = storage(context);
  const bookId = "cleanup-evidence-book";
  await stage(stores.candidates, bookId, "candidate-1");
  const evidenceRoot = join(context.roots.booksRoot, bookId);
  for (const [path, value] of [
    [join(evidenceRoot, "attempts", "attempt-1.json"), { attemptId: "attempt-1" }],
    [join(evidenceRoot, "reviews", "review-1.json"), { outcome: "PASS" }],
    [join(evidenceRoot, "qc", "round-1.json"), { outcome: "PASS" }],
  ] as const) {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, `${JSON.stringify(value)}\n`);
  }
  const before = inventory(evidenceRoot);
  const pipelineRoot = join(context.roots.tempRoot, "pipeline");
  const outerRoot = join(context.roots.tempRoot, "outer");
  mkdirSync(join(context.roots.stateRoot, "books"), { recursive: true });
  mkdirSync(outerRoot, { recursive: true });
  mkdirSync(pipelineRoot, { recursive: true });
  const debris = join(context.roots.stateRoot, "books", `${bookId}.gate.json`);
  writeFileSync(debris, "{}\n");
  const cleaned = applyCleanup(bookId, { pushedCommit: "disposable-commit", syncState: "0 0" }, {
    pipelineRoot,
    stateRoot: context.roots.stateRoot,
    outerRoot,
  });
  assert.equal(cleaned.ok, true);
  assert.equal(existsSync(debris), false);
  assert.deepEqual(inventory(evidenceRoot), before);
  assert.ok(Object.keys(before).some((path) => path.includes("candidates/candidate-1")));
  assert.ok(Object.keys(before).some((path) => path.includes("attempts/attempt-1")));
  assert.ok(Object.keys(before).some((path) => path.includes("reviews/review-1")));
  assert.ok(Object.keys(before).some((path) => path.includes("qc/round-1")));
});

requiredTest("no-live release and legacy shadow keep remote network credential and execution counts zero", async (context) => {
  const stores = storage(context);
  const identity = await stage(stores.candidates, "no-live-book", "candidate-1");
  const request = releaseRequest("no-live-book", identity);
  const calls = { git: 0, registry: 0, network: 0, credential: 0, packageWrite: 0 };
  const route = adapter(request, stores, ({ package: value }) => {
    calls.packageWrite += 1;
    writeFileSync(join(context.roots.tempRoot, "no-live-package.json"), JSON.stringify(value));
  });
  const released = await route.adapter.release(request);
  assert.ok(released.ok);
  const legacy = new LegacyPublishAdapter({
    git: () => { calls.git += 1; },
    registry: () => { calls.registry += 1; },
    network: () => { calls.network += 1; },
    credential: () => { calls.credential += 1; },
  });
  assert.ok(legacy.shadow(released.value.package).ok);
  assert.deepEqual(calls, { git: 0, registry: 0, network: 0, credential: 0, packageWrite: 1 });
  assert.equal(route.pointer.counts.compareAndSet, 1);
  assert.equal(route.auth.counts.reviewExecution, 0);
  assert.equal(route.auth.counts.qcExecution, 0);
});

finishV25Tests().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
