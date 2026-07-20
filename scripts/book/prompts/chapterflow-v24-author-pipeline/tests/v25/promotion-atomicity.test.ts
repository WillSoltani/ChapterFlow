import assert from "node:assert/strict";
import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";

import type { AtomicBookFileSeams } from "../../src/books/atomicBookFiles.js";
import { createBookContentReader, type BookContentReader } from "../../src/books/bookContentReader.js";
import { createBookWriteLock } from "../../src/books/bookLease.js";
import { bookPaths, candidatePaths, contentPath } from "../../src/books/bookPaths.js";
import { createCandidateStore, type CandidateStore } from "../../src/books/candidateStore.js";
import {
  createCurrentPointerStore,
  type CurrentBookPointer,
  type CurrentPointerStore,
} from "../../src/books/currentPointer.js";
import type { CandidateIdentity, Result } from "../../src/contracts/v4Core.js";
import type { QcRoundResult, QcService } from "../../src/qc/qcTypes.js";
import { createPromotionService, type PromotionRequest } from "../../src/release/promotionService.js";
import type { CanonicalReviewResult, ReviewService } from "../../src/review/reviewTypes.js";
import { finishV25Tests, requiredTest } from "./harness.js";

const CREATED_AT = "2026-07-20T12:00:00.000Z";
const REVIEW_AT = "2026-07-20T12:00:01.000Z";
const QC_AT = "2026-07-20T12:00:02.000Z";
const PROMOTED_AT = "2026-07-20T12:00:03.000Z";
const CLOCK_AT = "2026-07-20T12:00:04.000Z";
const INVENTORY = [{ kind: "CHAPTER", logicalPath: "chapters/ch01.md", mediaType: "text/markdown" }] as const;

function setup(booksRoot: string, atomicSeams?: AtomicBookFileSeams) {
  const lock = createBookWriteLock({ booksRoot, timeoutMs: 1_000, pollMs: 1 });
  const pointerStore = createCurrentPointerStore({ booksRoot, writeLock: lock, atomicSeams });
  const candidateStore = createCandidateStore({ booksRoot, writeLock: lock, currentPointerStore: pointerStore });
  const contentReader = createBookContentReader({ booksRoot, currentPointerStore: pointerStore });
  return { pointerStore, candidateStore, contentReader };
}

async function stage(candidateStore: CandidateStore, bookId: string, candidateId: string, text: string): Promise<CandidateIdentity> {
  const result = await candidateStore.stage({
    bookId,
    candidateId,
    createdByRunId: `run-${candidateId}`,
    expectedInventory: INVENTORY,
    files: [{ ...INVENTORY[0], bytes: Buffer.from(text, "utf8") }],
    createdAt: CREATED_AT,
  });
  assert.equal(result.ok, true);
  assert.ok(result.ok);
  return { candidateId, manifestDigest: result.value.manifestDigest };
}

function request(bookId: string, candidate: CandidateIdentity, expectedBookRevision: number): PromotionRequest {
  return {
    bookId,
    candidate,
    reviewId: `review-${candidate.candidateId}`,
    qcRoundId: `round-${candidate.candidateId}`,
    expectedBookRevision,
    promotedAt: PROMOTED_AT,
  };
}

function authorities(input: PromotionRequest): { reviewService: ReviewService; qcService: QcService } {
  const review: CanonicalReviewResult = {
    schemaVersion: "1",
    reviewId: input.reviewId,
    candidate: { ...input.candidate },
    outcome: "PASS",
    issues: [],
    completedAt: REVIEW_AT,
  };
  const round: QcRoundResult = {
    schemaVersion: "1",
    roundId: input.qcRoundId,
    candidate: { ...input.candidate },
    reviewId: input.reviewId,
    outcome: "PASS",
    issues: [],
    completedAt: QC_AT,
  };
  return {
    reviewService: {
      screen: async () => { throw new Error("screen is outside promotion"); },
      reviewCanonical: async () => { throw new Error("review execution is outside promotion"); },
      get: async () => ({ ok: true, value: review }),
    },
    qcService: {
      readStatus: async () => { throw new Error("status is outside promotion"); },
      runFresh: async () => { throw new Error("QC execution is outside promotion"); },
      getRound: async () => ({ ok: true, value: round }),
      diagnose: async () => { throw new Error("diagnosis is outside promotion"); },
      repairLedger: async () => { throw new Error("repair is outside promotion"); },
    },
  };
}

function serviceFor(
  input: PromotionRequest,
  candidateStore: CandidateStore,
  contentReader: BookContentReader,
  currentPointerStore: CurrentPointerStore,
) {
  return createPromotionService({
    candidateStore,
    contentReader,
    currentPointerStore,
    ...authorities(input),
    clock: () => CLOCK_AT,
  });
}

function counted(store: CurrentPointerStore) {
  const calls = { read: 0, cas: 0 };
  const wrapped: CurrentPointerStore = {
    read: async (bookId) => { calls.read += 1; return store.read(bookId); },
    compareAndSet: async (input) => { calls.cas += 1; return store.compareAndSet(input); },
  };
  return { calls, store: wrapped };
}

function assertErrorCode(result: Result<unknown>, code: string): void {
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.error.code, code);
}

requiredTest("missing current expected zero creates revision one and later promotion reports previous candidate", async ({ roots }) => {
  const storage = setup(roots.booksRoot);
  const first = await stage(storage.candidateStore, "atomic-book", "candidate-1", "first\n");
  const firstRequest = request("atomic-book", first, 0);
  const firstResult = await serviceFor(firstRequest, storage.candidateStore, storage.contentReader, storage.pointerStore)
    .promote(firstRequest);
  assert.deepEqual(firstResult, {
    ok: true,
    value: {
      bookId: "atomic-book",
      candidate: first,
      bookRevision: 1,
      readback: "VERIFIED",
      promotedAt: PROMOTED_AT,
    },
  });

  const second = await stage(storage.candidateStore, "atomic-book", "candidate-2", "second\n");
  const secondRequest = request("atomic-book", second, 1);
  const secondResult = await serviceFor(secondRequest, storage.candidateStore, storage.contentReader, storage.pointerStore)
    .promote(secondRequest);
  assert.deepEqual(secondResult, {
    ok: true,
    value: {
      bookId: "atomic-book",
      candidate: second,
      previousCandidateId: "candidate-1",
      bookRevision: 2,
      readback: "VERIFIED",
      promotedAt: PROMOTED_AT,
    },
  });
  const current = await storage.pointerStore.read("atomic-book");
  assert.ok(current.ok && current.value);
  assert.equal(current.value.candidateId, "candidate-2");
  assert.equal(current.value.revision, 2);
});

requiredTest("missing current with nonzero expected revision conflicts without pointer mutation", async ({ roots }) => {
  const storage = setup(roots.booksRoot);
  const identity = await stage(storage.candidateStore, "missing-current-book", "candidate-1", "first\n");
  const input = request("missing-current-book", identity, 3);
  const tracked = counted(storage.pointerStore);
  const result = await serviceFor(input, storage.candidateStore, storage.contentReader, tracked.store).promote(input);
  assertErrorCode(result, "REVISION_CONFLICT");
  assert.equal(tracked.calls.cas, 0);
  assert.equal(existsSync(bookPaths(roots.booksRoot, input.bookId).currentPointer), false);
});

requiredTest("missing incomplete and drifted candidates block before compare-and-set", async ({ roots }) => {
  const storage = setup(roots.booksRoot);
  const missingRequest: PromotionRequest = {
    bookId: "candidate-block-book",
    candidate: { candidateId: "missing", manifestDigest: "a".repeat(64) },
    reviewId: "review-missing",
    qcRoundId: "round-missing",
    expectedBookRevision: 0,
    promotedAt: PROMOTED_AT,
  };
  let tracked = counted(storage.pointerStore);
  assertErrorCode(
    await serviceFor(missingRequest, storage.candidateStore, storage.contentReader, tracked.store).promote(missingRequest),
    "CANDIDATE_NOT_FOUND",
  );
  assert.equal(tracked.calls.cas, 0);

  const incomplete = await stage(storage.candidateStore, "candidate-block-book", "incomplete", "complete\n");
  const incompletePath = contentPath(
    candidatePaths(roots.booksRoot, "candidate-block-book", "incomplete").contentRoot,
    INVENTORY[0].logicalPath,
  );
  rmSync(incompletePath);
  const incompleteRequest = request("candidate-block-book", incomplete, 0);
  tracked = counted(storage.pointerStore);
  assertErrorCode(
    await serviceFor(incompleteRequest, storage.candidateStore, storage.contentReader, tracked.store).promote(incompleteRequest),
    "CANDIDATE_MISMATCH",
  );
  assert.equal(tracked.calls.cas, 0);

  const drifted = await stage(storage.candidateStore, "candidate-block-book", "drifted", "same-size\n");
  const driftedPath = contentPath(
    candidatePaths(roots.booksRoot, "candidate-block-book", "drifted").contentRoot,
    INVENTORY[0].logicalPath,
  );
  writeFileSync(driftedPath, "diff-size\n");
  const driftedRequest = request("candidate-block-book", drifted, 0);
  tracked = counted(storage.pointerStore);
  assertErrorCode(
    await serviceFor(driftedRequest, storage.candidateStore, storage.contentReader, tracked.store).promote(driftedRequest),
    "CANDIDATE_MISMATCH",
  );
  assert.equal(tracked.calls.cas, 0);
  assert.equal(existsSync(bookPaths(roots.booksRoot, "candidate-block-book").currentPointer), false);
});

for (const fault of ["before", "after"] as const) {
  requiredTest(`pointer crash ${fault} replace exposes complete old or complete new candidate`, async ({ roots }) => {
    let armed: typeof fault | null = null;
    const storage = setup(roots.booksRoot, {
      point: (name) => {
        if (armed === "before" && name === "file.before-replace") throw new Error("crash before replace");
        if (armed === "after" && name === "file.after-replace") throw new Error("crash after replace");
      },
    });
    const oldIdentity = await stage(storage.candidateStore, `crash-${fault}-book`, "candidate-old", "old\n");
    const oldRequest = request(`crash-${fault}-book`, oldIdentity, 0);
    assert.equal((await serviceFor(oldRequest, storage.candidateStore, storage.contentReader, storage.pointerStore)
      .promote(oldRequest)).ok, true);

    const newIdentity = await stage(storage.candidateStore, `crash-${fault}-book`, "candidate-new", "new\n");
    const newRequest = request(`crash-${fault}-book`, newIdentity, 1);
    armed = fault;
    const result = await serviceFor(newRequest, storage.candidateStore, storage.contentReader, storage.pointerStore)
      .promote(newRequest);
    assertErrorCode(result, "RECONCILIATION_REQUIRED");

    const current = await storage.pointerStore.read(newRequest.bookId);
    assert.ok(current.ok && current.value);
    assert.equal(current.value.candidateId, fault === "before" ? "candidate-old" : "candidate-new");
    assert.equal(current.value.revision, fault === "before" ? 1 : 2);
    const decoded = JSON.parse(readFileSync(bookPaths(roots.booksRoot, newRequest.bookId).currentPointer, "utf8")) as CurrentBookPointer;
    assert.deepEqual(decoded, current.value);
  });
}

requiredTest("post-commit readback failure returns reconciliation blocker with no publication action", async ({ roots }) => {
  const storage = setup(roots.booksRoot);
  const identity = await stage(storage.candidateStore, "readback-book", "candidate-1", "candidate\n");
  const input = request("readback-book", identity, 0);
  let publicationCount = 0;
  const failingReader: BookContentReader = {
    open: async () => ({ ok: false, error: { code: "READBACK_FAULT", message: "injected readback fault" } }),
  };
  const promoteThenPublish = async () => {
    const promoted = await serviceFor(input, storage.candidateStore, failingReader, storage.pointerStore).promote(input);
    if (promoted.ok) publicationCount += 1;
    return promoted;
  };
  const result = await promoteThenPublish();
  assertErrorCode(result, "RECONCILIATION_REQUIRED");
  assert.equal(publicationCount, 0);
  const current = await storage.pointerStore.read(input.bookId);
  assert.ok(current.ok && current.value);
  assert.equal(current.value.candidateId, identity.candidateId);
  assert.equal(current.value.revision, 1);
});

requiredTest("non-conflict commit error or throw returns reconciliation without retry or readback", async ({ roots }) => {
  const storage = setup(roots.booksRoot);
  for (const mode of ["error", "throw"] as const) {
    const bookId = `commit-${mode}-book`;
    const identity = await stage(storage.candidateStore, bookId, `candidate-${mode}`, `${mode}\n`);
    const input = request(bookId, identity, 0);
    let casCalls = 0;
    let readbackCalls = 0;
    const uncertainPointer: CurrentPointerStore = {
      read: async () => ({ ok: true, value: null }),
      compareAndSet: async () => {
        casCalls += 1;
        if (mode === "throw") throw new Error("lost commit acknowledgement");
        return { ok: false, error: { code: "POINTER_WRITE_FAILED", message: "uncertain atomic replace" } };
      },
    };
    const noReadback: BookContentReader = {
      open: async () => {
        readbackCalls += 1;
        return { ok: false, error: { code: "UNEXPECTED_READBACK", message: "must not read after uncertain CAS" } };
      },
    };
    const result = await serviceFor(input, storage.candidateStore, noReadback, uncertainPointer).promote(input);
    assertErrorCode(result, "RECONCILIATION_REQUIRED");
    assert.equal(casCalls, 1, mode);
    assert.equal(readbackCalls, 0, mode);
  }
});

finishV25Tests().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
