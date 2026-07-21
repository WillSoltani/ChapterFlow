import assert from "node:assert/strict";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

import { createBookContentReader } from "../../src/books/bookContentReader.js";
import { createBookWriteLock } from "../../src/books/bookLease.js";
import { createCandidateStore, type CandidateStore } from "../../src/books/candidateStore.js";
import { createCurrentPointerStore, type CurrentPointerStore } from "../../src/books/currentPointer.js";
import type { CandidateIdentity, Result } from "../../src/contracts/v4Core.js";
import { chapterContentHash } from "../../src/critics/qcAttestation.js";
import type { QcRoundResult, QcService } from "../../src/qc/qcTypes.js";
import {
  assembleCanonicalPackage,
  buildCanonicalPackageManifest,
  CanonicalPackageAdapter,
  type CanonicalReleaseRequest,
} from "../../src/release/canonicalPackageAdapter.js";
import { LegacyPromotionAdapter } from "../../src/release/legacyPromotionAdapter.js";
import { createPromotionService } from "../../src/release/promotionService.js";
import type { CanonicalReviewResult, ReviewService } from "../../src/review/reviewTypes.js";
import { buildLegacyReaderPackage } from "../../src/promoteBook.js";
import { fixtureChapter } from "../model-bakeoff-helpers.js";
import { writeResearchRunManifestFixture } from "../helpers.js";
import { finishV25Tests, requiredTest, type TestContext } from "./harness.js";

const CREATED_AT = "2026-07-20T12:00:00.000Z";
const REVIEW_AT = "2026-07-20T12:00:01.000Z";
const QC_AT = "2026-07-20T12:00:02.000Z";
const PROMOTED_AT = "2026-07-20T12:00:03.000Z";
const CLOCK_AT = "2026-07-20T12:00:04.000Z";

function storage(context: TestContext) {
  const lock = createBookWriteLock({ booksRoot: context.roots.booksRoot, timeoutMs: 1_000, pollMs: 1 });
  const pointer = createCurrentPointerStore({ booksRoot: context.roots.booksRoot, writeLock: lock });
  const candidates = createCandidateStore({ booksRoot: context.roots.booksRoot, writeLock: lock, currentPointerStore: pointer });
  const reader = createBookContentReader({ booksRoot: context.roots.booksRoot, currentPointerStore: pointer });
  return { pointer, candidates, reader };
}

async function stage(store: CandidateStore, bookId: string, candidateId: string) {
  const chapter = fixtureChapter(bookId, 1, candidateId);
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
  return { identity: { candidateId, manifestDigest: staged.value.manifestDigest }, chapter };
}

function metadata(bookId: string) {
  return {
    title: `Title ${bookId}`,
    author: "Test Author",
    packageId: `${bookId}-v21-1784548803000`,
    createdAt: PROMOTED_AT,
    contentOwner: "chapterflow",
    categories: ["Self-Help"],
    tags: ["fixture"],
  };
}

function request(bookId: string, candidate: CandidateIdentity): CanonicalReleaseRequest {
  return {
    bookId,
    candidate,
    reviewId: "review-1",
    qcRoundId: "qc-1",
    expectedBookRevision: 0,
    promotedAt: PROMOTED_AT,
    metadata: metadata(bookId),
  };
}

function authorities(input: CanonicalReleaseRequest, reviewCandidate: CandidateIdentity = input.candidate) {
  const review: CanonicalReviewResult = {
    schemaVersion: "1",
    reviewId: input.reviewId,
    candidate: { ...reviewCandidate },
    outcome: "PASS",
    issues: [],
    completedAt: REVIEW_AT,
  };
  const qc: QcRoundResult = {
    schemaVersion: "1",
    roundId: input.qcRoundId,
    candidate: { ...input.candidate },
    reviewId: input.reviewId,
    outcome: "PASS",
    issues: [],
    completedAt: QC_AT,
  };
  const reviewService: ReviewService = {
    screen: async () => { throw new Error("screening is not canonical authority"); },
    reviewCanonical: async () => { throw new Error("cutover cannot execute review"); },
    get: async () => ({ ok: true, value: review }),
  };
  const qcService: QcService = {
    readStatus: async () => { throw new Error("status is outside cutover"); },
    runFresh: async () => { throw new Error("cutover cannot execute QC"); },
    getRound: async () => ({ ok: true, value: qc }),
    diagnose: async () => { throw new Error("diagnose is outside cutover"); },
    repairLedger: async () => { throw new Error("repair is outside cutover"); },
  };
  return { reviewService, qcService };
}

function countedPointer(pointer: CurrentPointerStore) {
  const counts = { read: 0, compareAndSet: 0 };
  const store: CurrentPointerStore = {
    read: async (bookId) => { counts.read += 1; return pointer.read(bookId); },
    compareAndSet: async (input) => { counts.compareAndSet += 1; return pointer.compareAndSet(input); },
  };
  return { counts, store };
}

function releaseAdapter(
  input: CanonicalReleaseRequest,
  stores: ReturnType<typeof storage>,
  packageRoot: string,
  reviewCandidate: CandidateIdentity = input.candidate,
) {
  const pointer = countedPointer(stores.pointer);
  const promotion = createPromotionService({
    candidateStore: stores.candidates,
    contentReader: stores.reader,
    currentPointerStore: pointer.store,
    ...authorities(input, reviewCandidate),
    clock: () => CLOCK_AT,
  });
  let packageWrites = 0;
  const canonicalRelease = new CanonicalPackageAdapter({
    contentReader: stores.reader,
    promotionService: promotion,
    packageWriter: ({ package: value }) => {
      packageWrites += 1;
      writeFileSync(join(packageRoot, `${input.bookId}.package.json`), JSON.stringify(value));
    },
  });
  return { canonicalRelease, pointer, packageWrites: () => packageWrites };
}

function writeJson(path: string, value: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

function assertError(result: Result<unknown>, code: string): void {
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.error.code, code);
}

requiredTest("fixed candidate legacy and V4 packages plus real manifests normalize identically", async (context) => {
  const bookId = "package-parity-book";
  const stores = storage(context);
  const staged = await stage(stores.candidates, bookId, "candidate-1");
  const assembled = await assembleCanonicalPackage({
    bookId,
    candidate: staged.identity,
    metadata: metadata(bookId),
    contentReader: stores.reader,
  });
  assert.ok(assembled.ok);
  const legacy = buildLegacyReaderPackage({
    bookId,
    ...metadata(bookId),
    chapters: [staged.chapter],
  });
  assert.deepEqual(assembled.value.package, legacy);

  writeJson(join(context.roots.stateRoot, "indexes", `${bookId}.json`), [{
    chapterId: staged.chapter.chapterId,
    chapterNumber: 1,
    chapterTitle: staged.chapter.title,
  }]);
  writeJson(join(context.roots.stateRoot, "chapters", `${staged.chapter.chapterId}.v21-native.chapter.json`), staged.chapter);
  const runDir = join(context.roots.tempRoot, "runs", bookId, "run-a");
  writeResearchRunManifestFixture({
    runDir,
    bookId,
    chapters: [{ number: 1, title: staged.chapter.title }],
  });
  writeJson(join(runDir, "sidecars", "source", "ch01.source.json"), {
    schemaVersion: "source-v1",
    bookId,
    chapterId: staged.chapter.chapterId,
    chapterNumber: 1,
  });
  writeJson(join(context.roots.stateRoot, "qc", `${bookId}-ch01.qc.json`), {
    schemaVersion: "qc-attest-v1",
    bookId,
    chapterNumber: 1,
    chapterId: staged.chapter.chapterId,
    verdict: "PUBLISHABLE",
    contentHash: chapterContentHash(staged.chapter),
    hashVersion: "v2",
    reviewer: "codex-qc:v4-package-parity",
    reviewedAt: QC_AT,
    roundId: "qc-1",
    roundRole: "attest",
  });
  const args = {
    stateRoot: context.roots.stateRoot,
    runsRoot: join(context.roots.tempRoot, "runs"),
    manifestVersion: "v1" as const,
    env: { CHAPTERFLOW_NO_API_CODEX_QC: "1", CHAPTERFLOW_ALLOW_MODEL_GEN: "0" },
    now: new Date(PROMOTED_AT),
  };
  const legacyManifest = buildCanonicalPackageManifest({ package: legacy, ...args });
  const v4Manifest = buildCanonicalPackageManifest({ package: assembled.value.package, ...args });
  assert.equal(legacyManifest.ok, true, legacyManifest.ok ? "" : legacyManifest.findings.map((f) => f.message).join("; "));
  assert.equal(v4Manifest.ok, true, v4Manifest.ok ? "" : v4Manifest.findings.map((f) => f.message).join("; "));
  assert.deepEqual(v4Manifest, legacyManifest);
});

requiredTest("first V4 cutover disables legacy then creates revision one while safe failure retains legacy authority", async (context) => {
  const bookId = "legacy-cutover-book";
  const stores = storage(context);
  const staged = await stage(stores.candidates, bookId, "candidate-1");
  const input = request(bookId, staged.identity);
  assert.equal(existsSync(join(context.roots.booksRoot, bookId, "current.json")), false);

  let enabled = true;
  let activeUses = 1;
  const calls = { disable: 0, restore: 0 };
  const authority = {
    activeUseCount: () => activeUses,
    isEnabled: () => enabled,
    disable: () => { calls.disable += 1; enabled = false; },
    restore: () => { calls.restore += 1; enabled = true; },
  };
  const wrongReview = { ...staged.identity, manifestDigest: "e".repeat(64) };
  const failingRelease = releaseAdapter(input, stores, context.roots.tempRoot, wrongReview);
  const failingCutover = new LegacyPromotionAdapter({ canonicalRelease: failingRelease.canonicalRelease, legacyAuthority: authority });
  assertError(await failingCutover.cutoverFirstCandidate(input), "LEGACY_PROMOTER_ACTIVE");
  assert.deepEqual(calls, { disable: 0, restore: 0 });

  activeUses = 0;
  const failed = await failingCutover.cutoverFirstCandidate(input);
  assertError(failed, "REVIEW_MISMATCH");
  assert.equal(enabled, true);
  assert.deepEqual(calls, { disable: 1, restore: 1 });
  assert.equal(failingRelease.pointer.counts.compareAndSet, 0);
  assert.equal(failingRelease.packageWrites(), 0);
  assert.equal(existsSync(join(context.roots.booksRoot, bookId, "current.json")), false);

  const successfulRelease = releaseAdapter(input, stores, context.roots.tempRoot);
  const successfulCutover = new LegacyPromotionAdapter({ canonicalRelease: successfulRelease.canonicalRelease, legacyAuthority: authority });
  const succeeded = await successfulCutover.cutoverFirstCandidate(input);
  assert.ok(succeeded.ok);
  assert.equal(succeeded.value.bookRevision, 1);
  assert.equal(enabled, false);
  assert.deepEqual(calls, { disable: 2, restore: 1 });
  assert.equal(successfulRelease.pointer.counts.compareAndSet, 1);
  assert.equal(successfulRelease.packageWrites(), 1);
  const current = await stores.pointer.read(bookId);
  assert.ok(current.ok && current.value);
  assert.equal(current.value.revision, 1);
  assert.equal(current.value.candidateId, staged.identity.candidateId);
});

finishV25Tests().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
