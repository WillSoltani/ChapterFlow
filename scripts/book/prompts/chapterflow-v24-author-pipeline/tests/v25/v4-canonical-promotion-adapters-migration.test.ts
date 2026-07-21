import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

import { createBookContentReader } from "../../src/books/bookContentReader.js";
import { createBookWriteLock } from "../../src/books/bookLease.js";
import { createCandidateStore, type CandidateStore } from "../../src/books/candidateStore.js";
import { createCurrentPointerStore, type CurrentPointerStore } from "../../src/books/currentPointer.js";
import type { CandidateIdentity, Result } from "../../src/contracts/v4Core.js";
import { chapterContentHash } from "../../src/critics/qcAttestation.js";
import { buildExpectedProductionManifestForPackage } from "../../src/productionManifest.js";
import { createQcService } from "../../src/qc/qcService.js";
import type { QcService } from "../../src/qc/qcTypes.js";
import {
  assembleCanonicalPackage,
  buildCanonicalPackageManifest,
  CanonicalPackageAdapter,
  type CanonicalReleaseRequest,
} from "../../src/release/canonicalPackageAdapter.js";
import {
  LegacyPromotionAdapter,
  type LegacyPromotionAuthority,
} from "../../src/release/legacyPromotionAdapter.js";
import { createPromotionService } from "../../src/release/promotionService.js";
import { createReviewServiceFactory } from "../../src/review/reviewService.js";
import type { ReviewService } from "../../src/review/reviewTypes.js";
import { buildLegacyReaderPackage } from "../../src/promoteBook.js";
import type { ChapterV21 } from "../../src/types.js";
import { runCli, writeResearchRunManifestFixture } from "../helpers.js";
import { fixtureChapter } from "../model-bakeoff-helpers.js";
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
  return { pointer, candidates, reader, writeLock: lock, booksRoot: context.roots.booksRoot };
}

async function stage(store: CandidateStore, bookId: string, candidateId: string, inputChapter?: ChapterV21) {
  const chapter = inputChapter ?? fixtureChapter(bookId, 1, candidateId);
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

function patternAudit(bookId: string) {
  return {
    bookId,
    chapterCount: 1,
    passed: true,
    findings: [],
    stats: {
      repeatedQuizExplanationGroups: 0,
      repeatedSurfaceFrameGroups: 0,
      repeatedExampleFrameGroups: 0,
      repeatedConcreteAnchors: 0,
      templatedBreakdownShellGroups: 0,
      shortParagraphDuplicateGroups: 0,
      literalSubstringGroups: 0,
      quizPositionTemplateDuplicates: 0,
      missingPlanChapters: [],
      missingBrief: false,
      sourceAlignmentWarnings: 0,
    },
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

async function authorities(
  input: CanonicalReleaseRequest,
  stores: ReturnType<typeof storage>,
  authorityCandidate: CandidateIdentity = input.candidate,
) {
  const counts = { reviewExecution: 0, reviewEvaluation: 0, qcExecution: 0 };
  const opened = await stores.reader.open({
    bookId: input.bookId,
    selector: { kind: "CANDIDATE", candidateId: authorityCandidate.candidateId },
  });
  assert.ok(opened.ok);
  assert.equal(opened.value.manifest.manifestDigest, authorityCandidate.manifestDigest);
  const reviewInner = createReviewServiceFactory({
    booksRoot: stores.booksRoot,
    contentReader: stores.reader,
    now: () => REVIEW_AT,
  }).create({
    async evaluate() {
      counts.reviewEvaluation += 1;
      return { ok: true, value: { outcome: "PASS", issues: [] } };
    },
  });
  const reviewService: ReviewService = {
    screen: (candidate) => reviewInner.screen(candidate),
    reviewCanonical: (request) => { counts.reviewExecution += 1; return reviewInner.reviewCanonical(request); },
    get: (bookId, reviewId) => reviewInner.get(bookId, reviewId),
  };
  const review = await reviewService.reviewCanonical({
    reviewId: input.reviewId,
    candidate: opened.value,
    taskContext: {
      bookId: input.bookId,
      runId: `run-${authorityCandidate.candidateId}`,
      attemptId: `attempt-${authorityCandidate.candidateId}`,
      stageId: "canonical-review",
      operationId: `review-${authorityCandidate.candidateId}`,
      workDir: stores.booksRoot,
      signal: new AbortController().signal,
    },
  });
  assert.ok(review.ok);
  const qcInner = createQcService({
    booksRoot: stores.booksRoot,
    contentReader: stores.reader,
    reviewService,
    writeLock: stores.writeLock,
    now: () => QC_AT,
  });
  const qcService: QcService = {
    readStatus: (bookId) => qcInner.readStatus(bookId),
    runFresh: (request) => { counts.qcExecution += 1; return qcInner.runFresh(request); },
    getRound: (bookId, roundId) => qcInner.getRound(bookId, roundId),
    diagnose: (bookId, roundId) => qcInner.diagnose(bookId, roundId),
    repairLedger: (request) => qcInner.repairLedger(request),
  };
  const qc = await qcService.runFresh({
    roundId: input.qcRoundId,
    candidate: opened.value,
    canonicalReview: review.value,
    evaluation: {
      roundId: input.qcRoundId,
      candidate: { ...authorityCandidate },
      reviewId: input.reviewId,
      outcome: "PASS",
      issues: [],
    },
  });
  assert.ok(qc.ok);
  return {
    reviewService,
    qcService,
    counts,
    baseline: { review: counts.reviewExecution, evaluation: counts.reviewEvaluation, qc: counts.qcExecution },
  };
}

function countedPointer(pointer: CurrentPointerStore) {
  const counts = { read: 0, compareAndSet: 0 };
  const store: CurrentPointerStore = {
    read: async (bookId) => { counts.read += 1; return pointer.read(bookId); },
    compareAndSet: async (input) => { counts.compareAndSet += 1; return pointer.compareAndSet(input); },
  };
  return { counts, store };
}

async function releaseAdapter(
  input: CanonicalReleaseRequest,
  stores: ReturnType<typeof storage>,
  packageRoot: string,
  reviewCandidate: CandidateIdentity = input.candidate,
  failFirstPackageWrite = false,
) {
  const authority = await authorities(input, stores, reviewCandidate);
  const pointer = countedPointer(stores.pointer);
  const promotion = createPromotionService({
    candidateStore: stores.candidates,
    contentReader: stores.reader,
    currentPointerStore: pointer.store,
    reviewService: authority.reviewService,
    qcService: authority.qcService,
    clock: () => CLOCK_AT,
  });
  let packageWrites = 0;
  const canonicalRelease = new CanonicalPackageAdapter({
    contentReader: stores.reader,
    promotionService: promotion,
    packageWriter: ({ package: value }) => {
      packageWrites += 1;
      if (failFirstPackageWrite && packageWrites === 1) throw new Error("injected package writer fault");
      writeFileSync(join(packageRoot, `${input.bookId}.package.json`), JSON.stringify(value));
    },
  });
  return { canonicalRelease, pointer, authority, packageWrites: () => packageWrites };
}

function assertError(result: Result<unknown>, code: string): void {
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.error.code, code);
}

function writeJson(path: string, value: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

requiredTest("pure package and manifest parity survives real canonical adapter release", async (context) => {
  const bookId = "package-parity-book";
  const stores = storage(context);
  const chapter = fixtureChapter(bookId, 1, "package-parity");
  const staged = await stage(stores.candidates, bookId, "candidate-1", chapter);
  const packageMetadata = metadata(bookId);
  const expectedPackage = buildLegacyReaderPackage({ bookId, ...packageMetadata, chapters: [chapter] });
  const assembled = await assembleCanonicalPackage({
    bookId,
    candidate: staged.identity,
    metadata: packageMetadata,
    contentReader: stores.reader,
  });
  assert.ok(assembled.ok);
  assert.deepEqual(assembled.value.package, expectedPackage);

  const stateRoot = join(context.roots.tempRoot, "legacy-manifest-state");
  const runsRoot = join(context.roots.tempRoot, "legacy-manifest-runs");
  const runDir = join(runsRoot, bookId, "run-package-parity");
  writeJson(join(stateRoot, "indexes", `${bookId}.json`), [{
    chapterId: chapter.chapterId,
    chapterNumber: chapter.number,
    chapterTitle: chapter.title,
  }]);
  writeJson(join(stateRoot, "chapters", `${chapter.chapterId}.v21-native.chapter.json`), chapter);
  writeJson(join(stateRoot, "qc", `${bookId}-ch01.qc.json`), {
    schemaVersion: "qc-attest-v1",
    bookId,
    chapterNumber: chapter.number,
    chapterId: chapter.chapterId,
    verdict: "PUBLISHABLE",
    contentHash: chapterContentHash(chapter),
    hashVersion: "v2",
    reviewer: "codex-qc:canonical-manifest-parity",
    reviewedAt: REVIEW_AT,
    roundId: "round-package-parity",
    roundRole: "confirm",
  });
  writeResearchRunManifestFixture({
    runDir,
    bookId,
    chapters: [{ number: chapter.number, title: chapter.title }],
  });
  writeJson(join(runDir, "sidecars", "source", "ch01.source.json"), {
    schemaVersion: "source-v1",
    bookId,
    chapterId: chapter.chapterId,
    chapterNumber: chapter.number,
    summary: "Disposable legacy source formatter input for successful manifest parity.",
  });

  const manifestInput = {
    pkg: expectedPackage,
    stateRoot,
    runsRoot,
    env: { ...process.env, CHAPTERFLOW_NO_API_CODEX_QC: "0", CHAPTERFLOW_ALLOW_MODEL_GEN: "0" },
    now: new Date(PROMOTED_AT),
  };
  const legacyManifest = buildExpectedProductionManifestForPackage(manifestInput);
  assert.equal(legacyManifest.ok, true, legacyManifest.ok ? "" : legacyManifest.findings.map((finding) => finding.message).join("\n"));
  const canonicalManifest = buildCanonicalPackageManifest({
    package: assembled.value.package,
    stateRoot,
    runsRoot,
    env: manifestInput.env,
    now: manifestInput.now,
  });
  assert.equal(canonicalManifest.ok, true, canonicalManifest.ok ? "" : canonicalManifest.findings.map((finding) => finding.message).join("\n"));
  if (!legacyManifest.ok || !canonicalManifest.ok) throw new Error("manifest parity requires two successful formatter results");
  const normalize = (manifest: typeof legacyManifest.manifest) => JSON.parse(JSON.stringify(manifest));
  assert.deepEqual(normalize(canonicalManifest.manifest), normalize(legacyManifest.manifest));

  const input = request(bookId, staged.identity);
  const release = await releaseAdapter(input, stores, context.roots.tempRoot);
  const released = await release.canonicalRelease.release(input);
  assert.ok(released.ok);
  assert.equal(released.value.bookRevision, 1);
  assert.equal(released.value.readback, "VERIFIED");
  assert.deepEqual(released.value.package, expectedPackage);
  assert.deepEqual(JSON.parse(readFileSync(join(context.roots.tempRoot, `${bookId}.package.json`), "utf8")), expectedPackage);
  const current = await stores.pointer.read(bookId);
  assert.ok(current.ok && current.value);
  assert.equal(current.value.candidateId, staged.identity.candidateId);
});

requiredTest("candidate-only CLI release does not require ambient canonical chapter index", async (context) => {
  const bookId = "candidate-only-cli-release";
  const stores = storage(context);
  const chapter = fixtureChapter(bookId, 1, "candidate-only");
  const files = [
    { kind: "CHAPTER" as const, logicalPath: "chapters/ch01.json", mediaType: "application/json" as const, bytes: Buffer.from(`${JSON.stringify(chapter)}\n`) },
    { kind: "SIDECAR" as const, logicalPath: "critics/book-pattern-audit.json", mediaType: "application/json" as const, bytes: Buffer.from(`${JSON.stringify(patternAudit(bookId))}\n`) },
  ];
  const staged = await stores.candidates.stage({
    bookId,
    candidateId: "candidate-1",
    createdByRunId: "candidate-only-cli",
    expectedInventory: files.map(({ bytes: _bytes, ...file }) => file),
    files,
    createdAt: CREATED_AT,
  });
  assert.ok(staged.ok);
  const result = runCli([
    "promote-book", bookId,
    "--title", "Candidate only",
    "--author", "Fixture",
    "--categories", "Self-Help",
    "--tags", "fixture",
    "--v25-root", context.roots.base,
    "--attempt-root", context.roots.attemptsRoot,
    "--candidate-id", "candidate-1",
    "--manifest-digest", staged.value.manifestDigest,
    "--source-git-sha", "candidate-only-sha",
    "--review-id", "missing-review",
    "--qc-round-id", "missing-qc",
    "--expected-book-revision", "0",
  ]);
  assert.equal(result.status, 1, result.out);
  assert.match(result.out, /REVIEW_NOT_FOUND/);
  assert.doesNotMatch(result.out, /chapter index|state\/indexes|ENOENT/i);
});

function sharedLegacyAuthority(initialActiveUses: number, remainEnabledAfterBegin = false) {
  let enabled = true;
  let activeUses = initialActiveUses;
  let held = false;
  const calls = { begin: 0, denied: 0, keepDisabled: 0, restore: 0 };
  const authority: LegacyPromotionAuthority = {
    activeUseCount: () => activeUses,
    isEnabled: () => enabled,
    async beginCutover() {
      calls.begin += 1;
      if (held) {
        calls.denied += 1;
        return { ok: false, error: { code: "CUTOVER_IN_PROGRESS", message: "shared cutover lease is held", retryable: true } };
      }
      if (activeUses !== 0) {
        calls.denied += 1;
        return { ok: false, error: { code: "LEGACY_PROMOTER_ACTIVE", message: "legacy promoter has active uses" } };
      }
      if (!enabled) {
        calls.denied += 1;
        return { ok: false, error: { code: "LEGACY_AUTHORITY_UNAVAILABLE", message: "legacy authority already disabled" } };
      }
      held = true;
      enabled = remainEnabledAfterBegin;
      let finished = false;
      return {
        ok: true,
        value: {
          finish(resolution: "KEEP_DISABLED" | "RESTORE_LEGACY") {
            if (finished) throw new Error("cutover lease already finished");
            finished = true;
            held = false;
            if (resolution === "RESTORE_LEGACY") {
              calls.restore += 1;
              enabled = true;
            } else {
              calls.keepDisabled += 1;
              enabled = false;
            }
          },
        },
      };
    },
  };
  return {
    authority,
    calls,
    enabled: () => enabled,
    setActiveUses(value: number) { activeUses = value; },
  };
}

requiredTest("shared atomic first cutover has one revision-one winner and never re-enables legacy after V4 authority", async (context) => {
  const faultBookId = "legacy-cutover-writer-fault-book";
  const faultStores = storage(context);
  const faultStaged = await stage(faultStores.candidates, faultBookId, "candidate-fault");
  const faultInput = request(faultBookId, faultStaged.identity);
  const faultShared = sharedLegacyAuthority(0);
  const faultRelease = await releaseAdapter(
    faultInput,
    faultStores,
    context.roots.tempRoot,
    faultInput.candidate,
    true,
  );
  const faultCutover = new LegacyPromotionAdapter({
    canonicalRelease: faultRelease.canonicalRelease,
    legacyAuthority: faultShared.authority,
  });

  assertError(await faultCutover.cutoverFirstCandidate(faultInput), "RECONCILIATION_REQUIRED");
  const faultCurrent = await faultStores.pointer.read(faultBookId);
  assert.ok(faultCurrent.ok && faultCurrent.value);
  assert.equal(faultCurrent.value.revision, 1);
  assert.equal(faultCurrent.value.candidateId, faultInput.candidate.candidateId);
  assert.equal(faultShared.enabled(), false);
  assert.equal(faultShared.calls.keepDisabled, 1);
  assert.equal(faultShared.calls.restore, 0);
  assert.equal(faultRelease.packageWrites(), 1);

  assertError(await faultRelease.canonicalRelease.release(faultInput), "RECONCILIATION_REQUIRED");
  assert.equal(faultRelease.pointer.counts.compareAndSet, 1);
  assert.equal(faultRelease.packageWrites(), 1);
  assert.equal(existsSync(join(context.roots.tempRoot, `${faultBookId}.package.json`)), false);
  assert.equal(faultShared.enabled(), false);
  assert.equal(faultShared.calls.restore, 0);

  const mixedShared = sharedLegacyAuthority(0, true);
  const mixedCutover = new LegacyPromotionAdapter({
    canonicalRelease: faultRelease.canonicalRelease,
    legacyAuthority: mixedShared.authority,
  });
  assertError(await mixedCutover.cutoverFirstCandidate(faultInput), "MIXED_PROMOTER");
  assert.equal(mixedShared.enabled(), false);
  assert.equal(mixedShared.calls.keepDisabled, 1);
  assert.equal(mixedShared.calls.restore, 0);
  assert.equal(faultRelease.pointer.counts.compareAndSet, 1);
  assert.equal(faultRelease.packageWrites(), 1);

  const bookId = "legacy-cutover-book";
  const stores = storage(context);
  const staged = await stage(stores.candidates, bookId, "candidate-1");
  const wrong = await stage(stores.candidates, bookId, "candidate-wrong");
  const input = request(bookId, staged.identity);
  assert.equal(existsSync(join(context.roots.booksRoot, bookId, "current.json")), false);

  const shared = sharedLegacyAuthority(1);
  const failingInput = { ...input, reviewId: "review-wrong", qcRoundId: "qc-wrong" };
  const failingRelease = await releaseAdapter(failingInput, stores, context.roots.tempRoot, wrong.identity);
  const failingCutover = new LegacyPromotionAdapter({ canonicalRelease: failingRelease.canonicalRelease, legacyAuthority: shared.authority });
  assertError(await failingCutover.cutoverFirstCandidate(failingInput), "LEGACY_PROMOTER_ACTIVE");
  assert.equal(shared.enabled(), true);

  shared.setActiveUses(0);
  const failed = await failingCutover.cutoverFirstCandidate(failingInput);
  assertError(failed, "REVIEW_MISMATCH");
  assert.equal(shared.enabled(), true);
  assert.equal(shared.calls.restore, 1);
  assert.equal(failingRelease.pointer.counts.compareAndSet, 0);
  assert.equal(failingRelease.packageWrites(), 0);
  assert.equal(existsSync(join(context.roots.booksRoot, bookId, "current.json")), false);

  const leftRelease = await releaseAdapter(input, stores, context.roots.tempRoot);
  const rightRelease = await releaseAdapter(input, stores, context.roots.tempRoot);
  const left = new LegacyPromotionAdapter({ canonicalRelease: leftRelease.canonicalRelease, legacyAuthority: shared.authority });
  const right = new LegacyPromotionAdapter({ canonicalRelease: rightRelease.canonicalRelease, legacyAuthority: shared.authority });
  const results = await Promise.all([left.cutoverFirstCandidate(input), right.cutoverFirstCandidate(input)]);
  assert.equal(results.filter((result) => result.ok).length, 1);
  const loser = results.find((result) => !result.ok);
  assert.ok(loser && !loser.ok);
  assert.equal(loser.error.code, "CUTOVER_IN_PROGRESS");
  assert.equal(shared.enabled(), false);
  assert.equal(shared.calls.keepDisabled, 1);
  assert.equal(shared.calls.restore, 1);
  assert.equal(leftRelease.pointer.counts.compareAndSet + rightRelease.pointer.counts.compareAndSet, 1);
  assert.equal(leftRelease.packageWrites() + rightRelease.packageWrites(), 1);
  const current = await stores.pointer.read(bookId);
  assert.ok(current.ok && current.value);
  assert.equal(current.value.revision, 1);
  assert.equal(current.value.candidateId, staged.identity.candidateId);
  for (const release of [faultRelease, failingRelease, leftRelease, rightRelease]) {
    assert.deepEqual(
      {
        review: release.authority.counts.reviewExecution,
        evaluation: release.authority.counts.reviewEvaluation,
        qc: release.authority.counts.qcExecution,
      },
      release.authority.baseline,
    );
  }
});

finishV25Tests().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
