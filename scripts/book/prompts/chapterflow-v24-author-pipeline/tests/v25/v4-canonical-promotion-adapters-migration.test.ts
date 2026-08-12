import assert from "node:assert/strict";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { createBookContentReader } from "../../src/books/bookContentReader.js";
import { createBookWriteLock } from "../../src/books/bookLease.js";
import { createCandidateStore, type CandidateStore } from "../../src/books/candidateStore.js";
import { createCurrentPointerStore, type CurrentPointerStore } from "../../src/books/currentPointer.js";
import type { CandidateIdentity, Result } from "../../src/contracts/v4Core.js";
import { normSlug } from "../../src/lib/chapterPaths.js";
import { buildExpectedProductionManifestForPackage } from "../../src/productionManifest.js";
import { createQcService } from "../../src/qc/qcService.js";
import type { QcService } from "../../src/qc/qcTypes.js";
import {
  assembleCanonicalPackage,
  buildCanonicalPackageManifest,
  CanonicalPackageAdapter,
  type CanonicalManifestOptions,
  type CanonicalReleaseRequest,
} from "../../src/release/canonicalPackageAdapter.js";
import {
  LegacyPromotionAdapter,
  type LegacyPromotionAuthority,
} from "../../src/release/legacyPromotionAdapter.js";
import { createPromotionService } from "../../src/release/promotionService.js";
import { publishReleaseArtifacts } from "../../src/release/publishReleaseArtifacts.js";
import { createReviewServiceFactory } from "../../src/review/reviewService.js";
import type { ReviewService } from "../../src/review/reviewTypes.js";
import {
  buildLegacyReaderPackage,
  PRODUCTION_MANIFEST_SIDECAR_SCHEMA,
  type ProductionManifestSidecar,
} from "../../src/promoteBook.js";
import { verifyProductionPackage } from "../../src/verifyProductionPackage.js";
import type { ChapterV21 } from "../../src/types.js";
import { makeSourceV2SidecarFixture, runCli, seedManifestEvidenceRoots } from "../helpers.js";
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

/** The manifest builder reads state/runs evidence and the source-reality policy;
 *  pin both to the fixture roots and a fixed instant so the build is hermetic. */
function manifestEnv(): NodeJS.ProcessEnv {
  return { ...process.env, CHAPTERFLOW_NO_API_CODEX_QC: "0", CHAPTERFLOW_ALLOW_MODEL_GEN: "0" };
}

/** Every release fixture needs manifest evidence now: the release route builds the
 *  production-manifest sidecar publish-final consumes AND self-verifies the pair
 *  against that evidence, so a book with no recomputable evidence cannot be
 *  released at all. `slot` gives one book several independent evidence roots (a
 *  re-release re-authors its state). */
function manifestRoots(context: TestContext, bookId: string, chapters: ChapterV21[], slot = ""): CanonicalManifestOptions {
  const roots = seedManifestEvidenceRoots({
    root: join(context.roots.tempRoot, `${bookId}-manifest${slot}`),
    bookId,
    chapters,
    reviewer: "codex-qc:canonical-release",
    reviewedAt: REVIEW_AT,
  });
  return { ...roots, env: manifestEnv(), now: new Date(PROMOTED_AT) };
}

/** The read-location half of a release's manifest options, replayed into an
 *  independent verifyProductionPackage call (the publish-final preflight). */
function verifyOptionsFrom(options: CanonicalManifestOptions) {
  return {
    stateRoot: options.stateRoot,
    runsRoot: options.runsRoot,
    recordPath: options.recordPath,
    exemptionsFile: options.exemptionsFile,
    env: options.env,
    now: options.now,
  };
}

async function releaseAdapter(
  input: CanonicalReleaseRequest,
  stores: ReturnType<typeof storage>,
  packageRoot: string,
  manifest: CanonicalManifestOptions,
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
  const sidecars: ProductionManifestSidecar[] = [];
  const canonicalRelease = new CanonicalPackageAdapter({
    contentReader: stores.reader,
    promotionService: promotion,
    manifest,
    // Sidecar first, package second — the ordering promoteBook's transactional
    // publish uses, so an interrupted pair is detectable rather than a package
    // with no manifest behind it.
    packageWriter: ({ package: value, sidecar }) => {
      packageWrites += 1;
      writeFileSync(join(packageRoot, `${input.bookId}.production-manifest.json`), JSON.stringify(sidecar));
      sidecars.push(sidecar);
      if (failFirstPackageWrite && packageWrites === 1) throw new Error("injected package writer fault");
      writeFileSync(join(packageRoot, `${input.bookId}.package.json`), JSON.stringify(value));
    },
  });
  return { canonicalRelease, pointer, authority, packageWrites: () => packageWrites, sidecars };
}

function assertError(result: Result<unknown>, code: string): void {
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.error.code, code);
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

  const manifestOptions = manifestRoots(context, bookId, [chapter]);
  const manifestInput = {
    pkg: expectedPackage,
    stateRoot: manifestOptions.stateRoot,
    runsRoot: manifestOptions.runsRoot,
    env: manifestOptions.env,
    now: manifestOptions.now,
  };
  const legacyManifest = buildExpectedProductionManifestForPackage(manifestInput);
  assert.equal(legacyManifest.ok, true, legacyManifest.ok ? "" : legacyManifest.findings.map((finding) => finding.message).join("\n"));
  const canonicalManifest = buildCanonicalPackageManifest({
    package: assembled.value.package,
    ...manifestOptions,
  });
  assert.equal(canonicalManifest.ok, true, canonicalManifest.ok ? "" : canonicalManifest.findings.map((finding) => finding.message).join("\n"));
  if (!legacyManifest.ok || !canonicalManifest.ok) throw new Error("manifest parity requires two successful formatter results");
  const normalize = (manifest: typeof legacyManifest.manifest) => JSON.parse(JSON.stringify(manifest));
  assert.deepEqual(normalize(canonicalManifest.manifest), normalize(legacyManifest.manifest));

  const input = request(bookId, staged.identity);
  const release = await releaseAdapter(input, stores, context.roots.tempRoot, manifestOptions);
  const released = await release.canonicalRelease.release(input);
  assert.ok(released.ok);
  assert.equal(released.value.bookRevision, 1);
  assert.equal(released.value.readback, "VERIFIED");
  assert.deepEqual(released.value.package, expectedPackage);
  assert.deepEqual(JSON.parse(readFileSync(join(context.roots.tempRoot, `${bookId}.package.json`), "utf8")), expectedPackage);
  const current = await stores.pointer.read(bookId);
  assert.ok(current.ok && current.value);
  assert.equal(current.value.candidateId, staged.identity.candidateId);
  // The release also publishes the manifest sidecar, and it is the SAME manifest
  // the legacy promoter would have written for the same content.
  assert.deepEqual(normalize(released.value.sidecar.manifest), normalize(legacyManifest.manifest));
});

/**
 * CRITICAL-1 regression. Before this, a v25 candidate release wrote the reader
 * package and NOTHING else: publish-final's preflight (verifyProductionPackage)
 * derives the production-manifest sidecar from state/books/<bookId>.production-
 * manifest.json, found nothing, and failed PPKG.sidecar_missing — every
 * v25-promoted book was unshippable. Observed before the fix:
 *   TypeError: Cannot read properties of undefined (reading 'manifest')
 *   (release.sidecars is empty; CanonicalReleaseResult had no `sidecar`)
 * and, writing only the package to disk, verifyProductionPackage returned
 *   ok=false PPKG.sidecar_missing.
 */
requiredTest("a released candidate produces a production manifest publish-final can consume", async (context) => {
  const bookId = "sidecar-release-book";
  const stores = storage(context);
  const chapter = fixtureChapter(bookId, 1, "sidecar-release");
  const staged = await stage(stores.candidates, bookId, "candidate-1", chapter);
  const manifestOptions = manifestRoots(context, bookId, [chapter]);
  const input = request(bookId, staged.identity);
  const release = await releaseAdapter(input, stores, context.roots.tempRoot, manifestOptions);
  const released = await release.canonicalRelease.release(input);
  assert.ok(released.ok, released.ok ? "" : `${released.error.code}:${released.error.message}`);

  // The sidecar reached the writer, in the shape the existing consumers read.
  assert.equal(release.sidecars.length, 1);
  const sidecar = release.sidecars[0];
  assert.deepEqual(sidecar, released.value.sidecar);
  assert.equal(sidecar.schemaVersion, PRODUCTION_MANIFEST_SIDECAR_SCHEMA);
  assert.equal(sidecar.bookId, released.value.package.book.bookId);
  assert.equal(sidecar.packageId, released.value.package.packageId);
  assert.equal(sidecar.createdAt, released.value.package.createdAt);
  assert.equal(sidecar.manifest.metadata.createdAt, released.value.package.createdAt);

  // publish-final's PREFLIGHT is exactly this call. It must pass on the pair the
  // release just published — that is what "shippable" means.
  const packagePath = join(context.roots.tempRoot, `${bookId}.package.json`);
  const sidecarPath = join(context.roots.tempRoot, `${bookId}.production-manifest.json`);
  const verified = verifyProductionPackage({
    packagePath,
    manifestPath: sidecarPath,
    stateRoot: manifestOptions.stateRoot,
    runsRoot: manifestOptions.runsRoot,
    env: manifestOptions.env,
    now: manifestOptions.now,
  });
  assert.equal(verified.ok, true, verified.findings.map((finding) => `${finding.checkId}: ${finding.message}`).join("\n"));
  assert.equal(verified.contentId, sidecar.manifest.contentId);
});

/**
 * The pointer commits first, then the sidecar, then the package. Every crash
 * window must leave a state a later publish REFUSES, never one it ships wrongly.
 */
requiredTest("a crash between the pointer and the sidecar leaves a refused state, never a silently-wrong one", async (context) => {
  const bookId = "sidecar-crash-book";
  const stores = storage(context);
  const chapter = fixtureChapter(bookId, 1, "sidecar-crash");
  const staged = await stage(stores.candidates, bookId, "candidate-1", chapter);
  const manifestOptions = manifestRoots(context, bookId, [chapter]);
  const input = request(bookId, staged.identity);
  const packagePath = join(context.roots.tempRoot, `${bookId}.package.json`);
  const sidecarPath = join(context.roots.tempRoot, `${bookId}.production-manifest.json`);

  // (a) Crash BEFORE either artifact lands: pointer at revision 1, nothing on
  // disk. publish-final has no package to ship — refused, and the retry says so.
  const crashed = await releaseAdapter(input, stores, context.roots.tempRoot, manifestOptions, input.candidate, true);
  const first = await crashed.canonicalRelease.release(input);
  assertError(first, "RECONCILIATION_REQUIRED");
  assert.equal(existsSync(packagePath), false);
  const pointerAfterCrash = await stores.pointer.read(bookId);
  assert.ok(pointerAfterCrash.ok && pointerAfterCrash.value);
  assert.equal(pointerAfterCrash.value.revision, 1);
  assertError(await crashed.canonicalRelease.release(input), "RECONCILIATION_REQUIRED");

  // (b) The sidecar DID land (the writer wrote it before the fault) while the
  // package did not. The surviving pair must not verify: a manifest that names a
  // package nobody published is inert, and publish-final refuses.
  assert.equal(existsSync(sidecarPath), true);
  const orphanSidecar = verifyProductionPackage({
    packagePath,
    manifestPath: sidecarPath,
    stateRoot: manifestOptions.stateRoot,
    runsRoot: manifestOptions.runsRoot,
    env: manifestOptions.env,
    now: manifestOptions.now,
  });
  assert.equal(orphanSidecar.ok, false);
  assert.ok(orphanSidecar.findings.some((finding) => finding.checkId === "PPKG.package_missing"));

  // (c) Identity is bound in BOTH files, so a sidecar paired with a package that
  // is not its own is detected. This is the cross-BOOK pairing (a mis-wired path
  // or book id), which is what PPKG.sidecar_bookid_mismatch actually catches —
  // NOT the re-release crash window, whose true code is pinned by
  // "a kill between the two renames leaves a pair the verifier REFUSES" below.
  const otherBookId = "sidecar-crash-other-book";
  const otherChapter = fixtureChapter(otherBookId, 1, "sidecar-crash-other");
  const otherStores = storage(context);
  const otherStaged = await stage(otherStores.candidates, otherBookId, "candidate-1", otherChapter);
  const otherOptions = manifestRoots(context, otherBookId, [otherChapter]);
  const otherInput = request(otherBookId, otherStaged.identity);
  const otherRelease = await releaseAdapter(otherInput, otherStores, context.roots.tempRoot, otherOptions);
  const otherReleased = await otherRelease.canonicalRelease.release(otherInput);
  assert.ok(otherReleased.ok, otherReleased.ok ? "" : `${otherReleased.error.code}:${otherReleased.error.message}`);
  const mismatched = verifyProductionPackage({
    packagePath: join(context.roots.tempRoot, `${otherBookId}.package.json`),
    manifestPath: sidecarPath,
    stateRoot: otherOptions.stateRoot,
    runsRoot: otherOptions.runsRoot,
    env: otherOptions.env,
    now: otherOptions.now,
  });
  assert.equal(mismatched.ok, false);
  assert.ok(mismatched.findings.some((finding) => finding.checkId === "PPKG.sidecar_bookid_mismatch"));
});

/**
 * CRITICAL-1(a). promoteBook self-verifies its candidate pair
 * (verifyProductionPackage with packageData + manifestData + compareLooseState,
 * promoteBook.ts) BEFORE declaring success; the v25 release route did not.
 * Building the sidecar is not proof the pair is shippable: the manifest builder
 * hashes the PACKAGE chapters, so it cannot see reader content that has drifted
 * away from the loose state chapters. `register-web` verifies with
 * compareLooseState: true and refuses to register such a book, so a "successful"
 * release of that pair produces a book that can never reach the library.
 * (publish-final's own preflight verifies WITHOUT compareLooseState — the
 * loose-state comparison is the promoter's and register-web's bar, and it is the
 * bar this route now meets.)
 *
 * Observed BEFORE the self-verify, on this fixture: the release returned
 * ok=true, while verifyProductionPackage over the pair it wrote returned
 * ok=false with the single finding
 *   PPKG.loose_chapter_mismatch: Packaged drifted-state-book-ch01 differs from
 *   loose state after reader-content stripping.
 */
requiredTest("release refuses a pair the production verifier would refuse, instead of reporting success", async (context) => {
  const bookId = "drifted-state-book";
  const stores = storage(context);
  const candidateChapter = fixtureChapter(bookId, 1, "candidate-content");
  const staged = await stage(stores.candidates, bookId, "candidate-1", candidateChapter);
  // Same chapter identity and title (so the canonical index and the manifest
  // payload still agree), different reader bytes — state re-authored after the
  // candidate was staged. The manifest builds; the pair is unshippable.
  const driftedChapter = {
    ...candidateChapter,
    hook: `${candidateChapter.hook} State was re-authored after this candidate was staged.`,
  } as ChapterV21;
  const manifestOptions = manifestRoots(context, bookId, [driftedChapter]);
  const input = request(bookId, staged.identity);
  const release = await releaseAdapter(input, stores, context.roots.tempRoot, manifestOptions);

  // The manifest itself is buildable — the refusal is the verifier's, not the
  // builder's, which is the whole point of adding a self-verify.
  assert.equal(buildCanonicalPackageManifest({
    package: buildLegacyReaderPackage({ bookId, ...metadata(bookId), chapters: [candidateChapter] }),
    ...manifestOptions,
  }).ok, true);

  const released = await release.canonicalRelease.release(input);
  assertError(released, "RECONCILIATION_REQUIRED");
  assert.ok(!released.ok && released.error.message.includes("PPKG.loose_chapter_mismatch"), released.ok ? "" : released.error.message);
  // Nothing published: the writer never ran, so no package and no sidecar exist.
  assert.equal(release.packageWrites(), 0);
  assert.equal(existsSync(join(context.roots.tempRoot, `${bookId}.package.json`)), false);
  assert.equal(existsSync(join(context.roots.tempRoot, `${bookId}.production-manifest.json`)), false);
});

/**
 * CRITICAL-1(b) + (c). The package and its sidecar are published as ONE
 * transaction. Before this the CLI made two independent writeFileAtomic calls,
 * so a re-release whose package write failed had ALREADY overwritten the shipped
 * book's sidecar — a book that was shippable became unshippable.
 *
 * Observed BEFORE the fix, replaying the pre-fix writer (writeFileAtomic sidecar,
 * then writeFileAtomic package, package write throwing) on this fixture: the
 * shipped sidecar's packageId went from retransaction-book-v21-1784548803000 to
 * retransaction-book-v21-1784548804000 while the shipped package was unchanged,
 * and verifying that surviving pair returned ok=false with
 *   PPKG.package_id_sidecar_mismatch, PPKG.created_at_mismatch,
 *   PPKG.sidecar_created_at_mismatch, PPKG.manifest_payload_mismatch,
 *   PPKG.content_id_recomputed_mismatch
 * — a book that was shippable a moment earlier is now unshippable.
 */
requiredTest("a failed re-release leaves the previously shipped package and sidecar byte-identical", async (context) => {
  const bookId = "retransaction-book";
  const stores = storage(context);
  const first = await stage(stores.candidates, bookId, "candidate-1");
  const firstOptions = manifestRoots(context, bookId, [first.chapter], "-r1");
  const firstInput = request(bookId, first.identity);
  const firstRelease = await releaseAdapter(firstInput, stores, context.roots.tempRoot, firstOptions);
  const firstResult = await firstRelease.canonicalRelease.release(firstInput);
  assert.ok(firstResult.ok, firstResult.ok ? "" : `${firstResult.error.code}:${firstResult.error.message}`);

  const shipRoot = join(context.roots.tempRoot, "shipped");
  const packagePath = join(shipRoot, `${bookId}.v21.json`);
  const sidecarPath = join(shipRoot, `${bookId}.production-manifest.json`);
  publishReleaseArtifacts({
    packagePath,
    sidecarPath,
    package: firstResult.value.package,
    sidecar: firstResult.value.sidecar,
    verifyOptions: verifyOptionsFrom(firstOptions),
  });
  const shippedPackage = readFileSync(packagePath, "utf8");
  const shippedSidecar = readFileSync(sidecarPath, "utf8");

  // A genuine SECOND release of the same book: new candidate, next revision, new
  // packageId — exactly the pair a re-release publishes.
  const second = await stage(stores.candidates, bookId, "candidate-2");
  const secondOptions = manifestRoots(context, bookId, [second.chapter], "-r2");
  const secondInput: CanonicalReleaseRequest = {
    ...request(bookId, second.identity),
    reviewId: "review-2",
    qcRoundId: "qc-2",
    expectedBookRevision: 1,
    metadata: { ...metadata(bookId), packageId: `${bookId}-v21-1784548804000`, createdAt: "2026-07-20T12:00:04.000Z" },
  };
  const secondRelease = await releaseAdapter(secondInput, stores, context.roots.tempRoot, secondOptions);
  const secondResult = await secondRelease.canonicalRelease.release(secondInput);
  assert.ok(secondResult.ok, secondResult.ok ? "" : `${secondResult.error.code}:${secondResult.error.message}`);
  assert.notEqual(secondResult.value.package.packageId, firstResult.value.package.packageId);

  // The package rename fails after the sidecar rename already landed — the one
  // window in which the two published files can disagree.
  assert.throws(
    () => publishReleaseArtifacts({
      packagePath,
      sidecarPath,
      package: secondResult.value.package,
      sidecar: secondResult.value.sidecar,
      verifyOptions: verifyOptionsFrom(secondOptions),
      seams: { onBeforePackageRename: () => { throw new Error("injected publish fault between the two renames"); } },
    }),
    /injected publish fault between the two renames/,
  );

  // The shipped book is exactly what it was, and still verifies at the strictest
  // bar any consumer applies (compareLooseState: true — register-web's gate).
  assert.equal(readFileSync(packagePath, "utf8"), shippedPackage);
  assert.equal(readFileSync(sidecarPath, "utf8"), shippedSidecar);
  const stillShippable = verifyProductionPackage({
    packagePath,
    manifestPath: sidecarPath,
    compareLooseState: true,
    ...verifyOptionsFrom(firstOptions),
  });
  assert.equal(stillShippable.ok, true, stillShippable.findings.map((finding) => `${finding.checkId}: ${finding.message}`).join("\n"));
  // No staging or backup debris survives a failed publish.
  for (const debris of [`${packagePath}.release-staging`, `${sidecarPath}.release-staging`, `${sidecarPath}.pre-release-backup`]) {
    assert.equal(existsSync(debris), false, debris);
  }

  // CRITICAL-1(c). The residual window is a process KILL between the two renames
  // — no code runs, so nothing rolls back and the fresh sidecar sits beside the
  // stale package. Assert what that state ACTUALLY produces. It is NOT
  // PPKG.sidecar_bookid_mismatch (same book, so the sidecar's bookId matches):
  // the re-release stamps a fresh "<bookId>-v21-<epochMs>", so the identity that
  // disagrees is the packageId.
  writeFileSync(sidecarPath, `${JSON.stringify(secondResult.value.sidecar, null, 2)}\n`);
  const killedBetweenRenames = verifyProductionPackage({
    packagePath,
    manifestPath: sidecarPath,
    compareLooseState: true,
    ...verifyOptionsFrom(secondOptions),
  });
  assert.equal(killedBetweenRenames.ok, false);
  const codes = killedBetweenRenames.findings.map((finding) => finding.checkId);
  assert.ok(codes.includes("PPKG.package_id_sidecar_mismatch"), codes.join(", "));
  assert.equal(codes.includes("PPKG.sidecar_bookid_mismatch"), false, codes.join(", "));
});

/** The package BODY always carries the normalised slug; a packageId derived from
 *  a raw argv bookId could never satisfy the production verifier's
 *  PPKG.package_id_shape. Release refuses it instead of shipping it. */
requiredTest("release refuses a packageId derived from the raw book id instead of the normalised slug", async (context) => {
  const bookId = "raw-argv-book";
  const stores = storage(context);
  const chapter = fixtureChapter(bookId, 1, "raw-argv");
  const staged = await stage(stores.candidates, bookId, "candidate-1", chapter);
  const rawArgvBookId = "Raw_Argv Book";
  assert.equal(normSlug(rawArgvBookId), "raw-argv-book");
  const assembled = await assembleCanonicalPackage({
    bookId,
    candidate: staged.identity,
    metadata: { ...metadata(bookId), packageId: `${rawArgvBookId}-v21-1784548803000` },
    contentReader: stores.reader,
  });
  assertError(assembled, "PACKAGE_METADATA_INVALID");
});

requiredTest("candidate-only CLI release does not require ambient canonical chapter index", async (context) => {
  const bookId = "candidate-only-cli-release";
  const stores = storage(context);
  const chapter = fixtureChapter(bookId, 1, "candidate-only");
  const sourceSidecarPath = "sidecars/source/ch01.source.json";
  const files = [
    { kind: "CHAPTER" as const, logicalPath: "chapters/ch01.json", mediaType: "application/json" as const, bytes: Buffer.from(`${JSON.stringify(chapter)}\n`) },
    { kind: "SIDECAR" as const, logicalPath: "compiler/ch01/source-packet.json", mediaType: "application/json" as const, bytes: Buffer.from(`${JSON.stringify({ sourceSidecarPath })}\n`) },
    { kind: "SIDECAR" as const, logicalPath: sourceSidecarPath, mediaType: "application/json" as const, bytes: Buffer.from(`${JSON.stringify(makeSourceV2SidecarFixture({ chapterNumber: chapter.number, chapterTitle: chapter.title }))}\n`) },
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
    manifestRoots(context, faultBookId, [faultStaged.chapter]),
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
  const cutoverManifest = manifestRoots(context, bookId, [staged.chapter]);
  const input = request(bookId, staged.identity);
  assert.equal(existsSync(join(context.roots.booksRoot, bookId, "current.json")), false);

  const shared = sharedLegacyAuthority(1);
  const failingInput = { ...input, reviewId: "review-wrong", qcRoundId: "qc-wrong" };
  const failingRelease = await releaseAdapter(failingInput, stores, context.roots.tempRoot, cutoverManifest, wrong.identity);
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

  const leftRelease = await releaseAdapter(input, stores, context.roots.tempRoot, cutoverManifest);
  const rightRelease = await releaseAdapter(input, stores, context.roots.tempRoot, cutoverManifest);
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
