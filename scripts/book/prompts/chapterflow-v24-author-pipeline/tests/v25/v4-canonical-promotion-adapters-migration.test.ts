import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { hostname } from "node:os";
import { dirname, join } from "node:path";

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
import { createFileReleaseJournal, type ReleaseJournal } from "../../src/release/releaseJournal.js";
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
  extras: Readonly<{ newTransactionId?: () => string; stateRoot?: string; journal?: ReleaseJournal }> = {},
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
    ...extras,
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

/** The record `quarantine-book <bookId>` writes, in its exact shape (cli.ts
 *  runQuarantineBook: `{ bookId, reason, quarantinedAt, movedTo }` under
 *  `<state>/books/_quarantined/<bookId>.json`). */
function writeQuarantineTombstone(
  manifest: CanonicalManifestOptions,
  bookId: string,
  reason: string,
  body?: string,
): string {
  const path = join(manifest.stateRoot as string, "books", "_quarantined", `${bookId}.json`);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(
    path,
    body ?? `${JSON.stringify({
      bookId,
      reason,
      quarantinedAt: "2026-07-20T11-00-00-000Z",
      movedTo: `/book-packages/_quarantined/${bookId}.2026-07-20T11-00-00-000Z.v21.json`,
    }, null, 2)}\n`,
  );
  return path;
}

function releaseJournalDir(manifest: CanonicalManifestOptions, bookId: string): string {
  return join(manifest.stateRoot as string, "books", "_release-journal", bookId);
}

function releaseJournalPath(manifest: CanonicalManifestOptions, bookId: string, txId: string): string {
  return join(releaseJournalDir(manifest, bookId), `${txId}.json`);
}

/** Every record filed for a book — the whole diagnosis is `ls` on this directory. */
function readReleaseJournals(manifest: CanonicalManifestOptions, bookId: string): Record<string, unknown>[] {
  const directory = releaseJournalDir(manifest, bookId);
  if (!existsSync(directory)) return [];
  return readdirSync(directory)
    .filter((name) => name.endsWith(".json"))
    .sort()
    .map((name) => JSON.parse(readFileSync(join(directory, name), "utf8")) as Record<string, unknown>);
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
  // The release also publishes the manifest sidecar. It is the legacy manifest in
  // every respect EXCEPT its chapter-set authority, and that one difference is
  // the whole point of the candidate route: a legacy manifest names
  // state/indexes/<bookId>.json (canonicalIndex), a candidate release names the
  // digest-bound candidate its chapters actually came from (candidateChapterSet),
  // because a candidate-only book root HAS no canonical index. The chapter SET
  // itself is identical either way, and so is every other field; only that block
  // and the contentId derived from it differ.
  const releasedManifest = normalize(released.value.sidecar.manifest);
  const legacy = normalize(legacyManifest.manifest);
  assert.deepEqual(releasedManifest.payload.candidateChapterSet.chapters, legacy.payload.canonicalIndex.chapters);
  assert.equal(releasedManifest.payload.candidateChapterSet.source, "candidate");
  assert.equal(releasedManifest.payload.candidateChapterSet.candidateId, staged.identity.candidateId);
  assert.equal(releasedManifest.payload.candidateChapterSet.manifestDigest, staged.identity.manifestDigest);
  assert.equal(releasedManifest.payload.canonicalIndex, undefined);
  assert.equal(legacy.payload.candidateChapterSet, undefined);
  delete releasedManifest.payload.candidateChapterSet;
  delete legacy.payload.canonicalIndex;
  delete releasedManifest.contentId;
  delete legacy.contentId;
  delete releasedManifest.payloadHash;
  delete legacy.payloadHash;
  assert.deepEqual(releasedManifest, legacy);
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

/**
 * SAFETY. `quarantine-book <bookId>` moves the shipped package aside AND writes
 * `state/books/_quarantined/<bookId>.json`, and prints — in its own output —
 * "promote-book and register-web now REFUSE this book until
 * `unquarantine-book <bookId>` releases it". The legacy promoter honours that
 * record as its Step 0. The v25 candidate-release route did not read it at all.
 *
 * Observed BEFORE this fix, on this fixture (tombstone on disk, release called):
 *   released.ok === true, bookRevision 1, readback VERIFIED
 *   packageWrites() === 1 and <bookId>.package.json existed
 * — a book an operator had explicitly pulled was re-released, with a fresh
 * pointer revision and a freshly published reader package, while its tombstone
 * sat on disk.
 */
requiredTest("a quarantined book cannot be released, and the tombstone is the only thing stopping it", async (context) => {
  const bookId = "quarantined-release-book";
  const stores = storage(context);
  const chapter = fixtureChapter(bookId, 1, "quarantined-release");
  const staged = await stage(stores.candidates, bookId, "candidate-1", chapter);
  const manifestOptions = manifestRoots(context, bookId, [chapter]);
  const input = request(bookId, staged.identity);
  const release = await releaseAdapter(input, stores, context.roots.tempRoot, manifestOptions);

  const tombstonePath = writeQuarantineTombstone(
    manifestOptions,
    bookId,
    "shipped corrupt: 108/108 word-salad quizzes",
  );
  const refused = await release.canonicalRelease.release(input);
  assertError(refused, "BOOK_QUARANTINED");
  assert.ok(!refused.ok && /^QUARANTINED: /.test(refused.error.message), refused.ok ? "" : refused.error.message);
  // The operator's own reason and the exact release verb reach the refusal —
  // the same two things the legacy promoter's refusal carries.
  assert.ok(!refused.ok && refused.error.message.includes("shipped corrupt: 108/108 word-salad quizzes"));
  assert.ok(!refused.ok && refused.error.message.includes(`unquarantine-book ${bookId}`));

  // Nothing was read, committed or written: no CAS, no package, no sidecar, and
  // no release journal — the refusal is BEFORE the pointer, not after it.
  assert.equal(release.pointer.counts.compareAndSet, 0);
  assert.equal(release.packageWrites(), 0);
  const blocked = await stores.pointer.read(bookId);
  assert.ok(blocked.ok);
  assert.equal(blocked.value, null);
  assert.equal(existsSync(join(context.roots.tempRoot, `${bookId}.package.json`)), false);
  assert.equal(existsSync(join(context.roots.tempRoot, `${bookId}.production-manifest.json`)), false);
  assert.deepEqual(readReleaseJournals(manifestOptions, bookId), []);

  // A tombstone that cannot be parsed still blocks. An unreadable pull-this-book
  // record is not permission to ship.
  writeQuarantineTombstone(manifestOptions, bookId, "", "{ this is not json");
  assertError(await release.canonicalRelease.release(input), "BOOK_QUARANTINED");
  assert.equal(release.packageWrites(), 0);

  // `unquarantine-book` archives the record. The SAME release then succeeds —
  // so the tombstone, and nothing incidental about this fixture, is the block.
  rmSync(tombstonePath, { force: true });
  const released = await release.canonicalRelease.release(input);
  assert.ok(released.ok, released.ok ? "" : `${released.error.code}:${released.error.message}`);
  assert.equal(released.value.bookRevision, 1);
  assert.equal(release.packageWrites(), 1);
});

/**
 * The tombstone covers the book, not one spelling of it. `quarantine-book`
 * files the record under the RAW argv id; the legacy promoter has always looked
 * up the NORMALISED slug. Either id must block, or an operator who quarantined
 * "Quarantine_Alias Book" would find a release of `Quarantine_Alias Book`
 * sailing straight past it.
 */
requiredTest("a tombstone filed under the normalised slug blocks a release requested under the raw id", async (context) => {
  const bookId = "Quarantine_Alias Book";
  const stores = storage(context);
  const stateRoot = join(context.roots.tempRoot, "alias-state");
  writeFileSync(
    (() => {
      const path = join(stateRoot, "books", "_quarantined", `${normSlug(bookId)}.json`);
      mkdirSync(dirname(path), { recursive: true });
      return path;
    })(),
    `${JSON.stringify({ bookId: normSlug(bookId), reason: "pulled under the slug" })}\n`,
  );
  const release = new CanonicalPackageAdapter({
    contentReader: stores.reader,
    stateRoot,
    // Reaching either of these would mean the tombstone did not stop the route.
    promotionService: { promote: () => { throw new Error("promotion must not be reached for a quarantined book"); } },
    packageWriter: () => { throw new Error("package writer must not be reached for a quarantined book"); },
  });
  const refused = await release.release(request(bookId, { candidateId: "candidate-1", manifestDigest: "0".repeat(64) }));
  assertError(refused, "BOOK_QUARANTINED");
  assert.ok(!refused.ok && refused.error.message.includes("pulled under the slug"));
  assert.ok(!refused.ok && refused.error.message.includes(`unquarantine-book ${normSlug(bookId)}`));
});

/**
 * JOURNAL. The route commits the CURRENT pointer, then writes the package and
 * its sidecar. A crash in between leaves a book at a new revision with no
 * artifacts — and before this record existed NOTHING on disk named the
 * candidate, the revision or the intent, so the state could not be diagnosed by
 * inspection at all.
 *
 * Observed BEFORE this fix, after the injected package-writer fault:
 *   state/books/_release-journal/ did not exist; the ONLY evidence was
 *   current.json at revision 1 and an orphan sidecar, with nothing saying which
 *   release put it there or how far it got.
 */
requiredTest("a crash between the pointer commit and the package write leaves a journal naming the window", async (context) => {
  const bookId = "journal-window-book";
  const stores = storage(context);
  const chapter = fixtureChapter(bookId, 1, "journal-window");
  const staged = await stage(stores.candidates, bookId, "candidate-1", chapter);
  const manifestOptions = manifestRoots(context, bookId, [chapter]);
  const input = request(bookId, staged.identity);
  const release = await releaseAdapter(
    input, stores, context.roots.tempRoot, manifestOptions, input.candidate, true,
    { newTransactionId: () => "tx-journal-window" },
  );

  const crashed = await release.canonicalRelease.release(input);
  assertError(crashed, "RECONCILIATION_REQUIRED");
  // The window itself: pointer advanced, package absent.
  const pointer = await stores.pointer.read(bookId);
  assert.ok(pointer.ok && pointer.value);
  assert.equal(pointer.value.revision, 1);
  assert.equal(existsSync(join(context.roots.tempRoot, `${bookId}.package.json`)), false);

  // And now it is diagnosable by inspection alone: one record, under this book's
  // journal directory, naming exactly where the release stopped.
  const filed = readReleaseJournals(manifestOptions, bookId);
  assert.equal(filed.length, 1);
  const record = filed[0];
  assert.equal(record.schemaVersion, "v25-release-journal-v1");
  assert.equal(record.bookId, bookId);
  assert.equal(record.txId, "tx-journal-window");
  assert.equal(record.state, "package-pending");
  assert.equal(record.candidateId, staged.identity.candidateId);
  assert.equal(record.manifestDigest, staged.identity.manifestDigest);
  assert.equal(record.expectedBookRevision, 0);
  assert.equal(record.targetBookRevision, 1);
  assert.equal(record.reviewId, input.reviewId);
  assert.equal(record.qcRoundId, input.qcRoundId);
  assert.equal(record.packageId, input.metadata.packageId);
  assert.equal(record.hostname, hostname());
  assert.equal(record.pid, process.pid);
  assert.ok(typeof record.detail === "string" && record.detail.includes("package write failed after pointer commit"), String(record.detail));

  // The record survives a LATER release of a different candidate. One record per
  // transaction is the whole point: revision 2 goes out normally (the pointer CAS
  // is what orders releases), and the only evidence that revision 1 was committed
  // and never published is still on disk, byte-identical, under its own txId.
  const crashBytes = readFileSync(releaseJournalPath(manifestOptions, bookId, "tx-journal-window"), "utf8");
  const second = await stage(stores.candidates, bookId, "candidate-2");
  const secondOptions = manifestRoots(context, bookId, [second.chapter], "-c2");
  const secondInput: CanonicalReleaseRequest = {
    ...request(bookId, second.identity),
    reviewId: "review-2",
    qcRoundId: "qc-2",
    expectedBookRevision: 1,
    metadata: { ...metadata(bookId), packageId: `${bookId}-v21-1784548804000`, createdAt: "2026-07-20T12:00:04.000Z" },
  };
  // Each release fixture re-authors its own disposable manifest evidence, so the
  // second release gets its own manifest stateRoot. Production has ONE state
  // root, so pin the journal to the first one — that is the directory the two
  // releases of this book really share.
  const secondRelease = await releaseAdapter(
    secondInput, stores, context.roots.tempRoot, secondOptions, secondInput.candidate, false,
    { stateRoot: manifestOptions.stateRoot as string, newTransactionId: () => "tx-second-release" },
  );
  const released = await secondRelease.canonicalRelease.release(secondInput);
  assert.ok(released.ok, released.ok ? "" : `${released.error.code}:${released.error.message}`);
  assert.equal(released.value.bookRevision, 2);
  assert.equal(secondRelease.packageWrites(), 1);
  // Its own record is gone (it completed); the crashed one is untouched.
  assert.equal(existsSync(releaseJournalPath(manifestOptions, bookId, "tx-second-release")), false);
  assert.equal(readFileSync(releaseJournalPath(manifestOptions, bookId, "tx-journal-window"), "utf8"), crashBytes);
});

/**
 * RECOVERY. With the pointer committed and nothing published, a retry hits
 *   RECONCILIATION_REQUIRED: CURRENT names this candidate, but prior release
 *   intent cannot be proven; package write suppressed
 * — correct while nothing could prove the intent, and unrecoverable forever.
 * The journal IS that proof.
 *
 * The default is NOT relaxed: proving the intent is not the same as being told
 * to act on it, so an unflagged retry still refuses exactly as before. Recovery
 * is an explicit operator act (`resumeUnfinished` / `--resume-unfinished-release`)
 * taken after reading the record the refusal now names, and even then it clears
 * the same bar a first attempt does — verified CURRENT readback, buildable
 * manifest, production-verified pair — while minting no second revision.
 */
requiredTest("a journalled release resumes only when asked, and then publishes without advancing the pointer again", async (context) => {
  const bookId = "journal-resume-book";
  const stores = storage(context);
  const chapter = fixtureChapter(bookId, 1, "journal-resume");
  const staged = await stage(stores.candidates, bookId, "candidate-1", chapter);
  const manifestOptions = manifestRoots(context, bookId, [chapter]);
  const input = request(bookId, staged.identity);
  const packagePath = join(context.roots.tempRoot, `${bookId}.package.json`);
  const sidecarPath = join(context.roots.tempRoot, `${bookId}.production-manifest.json`);
  const release = await releaseAdapter(
    input, stores, context.roots.tempRoot, manifestOptions, input.candidate, true,
    { newTransactionId: () => "tx-journal-resume" },
  );

  assertError(await release.canonicalRelease.release(input), "RECONCILIATION_REQUIRED");
  const journalBytes = readFileSync(releaseJournalPath(manifestOptions, bookId, "tx-journal-resume"), "utf8");
  assert.equal(existsSync(packagePath), false);

  // (a) DEFAULT, journal present: still refused. The record proves the intent,
  // and the route acts on it only when told to — but the refusal now names the
  // file to read and the flag that would finish it.
  const notRequested = await release.canonicalRelease.release(input);
  assertError(notRequested, "RECONCILIATION_REQUIRED");
  assert.ok(
    !notRequested.ok && notRequested.error.message.includes("prior release intent cannot be proven"),
    notRequested.ok ? "" : notRequested.error.message,
  );
  assert.ok(
    !notRequested.ok && notRequested.error.message.includes(releaseJournalPath(manifestOptions, bookId, "tx-journal-resume")),
    notRequested.ok ? "" : notRequested.error.message,
  );
  assert.ok(
    !notRequested.ok && notRequested.error.message.includes("--resume-unfinished-release"),
    notRequested.ok ? "" : notRequested.error.message,
  );
  assert.equal(release.packageWrites(), 1, "the suppressed retry must not have written anything");
  assert.equal(existsSync(packagePath), false);
  // A read-only refusal leaves the record byte-identical — a retry must not
  // overwrite the crash cause the record exists to preserve.
  assert.equal(readFileSync(releaseJournalPath(manifestOptions, bookId, "tx-journal-resume"), "utf8"), journalBytes);

  // (b) FLAG SET but journal gone: still refused. The flag is permission to act
  // on proof, never a substitute for it.
  rmSync(releaseJournalPath(manifestOptions, bookId, "tx-journal-resume"), { force: true });
  const unproven = await release.canonicalRelease.release({ ...input, resumeUnfinished: true });
  assertError(unproven, "RECONCILIATION_REQUIRED");
  assert.ok(
    !unproven.ok && unproven.error.message.includes("prior release intent cannot be proven"),
    unproven.ok ? "" : unproven.error.message,
  );
  assert.equal(release.packageWrites(), 1);
  assert.equal(existsSync(packagePath), false);
  // The noise record that attempt wrote for itself is cleaned up, not left to
  // masquerade as an unfinished release.
  assert.equal(existsSync(releaseJournalPath(manifestOptions, bookId, "tx-journal-resume")), false);

  // (c) Journal restored AND recovery requested: the same retry completes the
  // SAME release.
  writeFileSync(releaseJournalPath(manifestOptions, bookId, "tx-journal-resume"), journalBytes);
  const resumed = await release.canonicalRelease.release({ ...input, resumeUnfinished: true });
  assert.ok(resumed.ok, resumed.ok ? "" : `${resumed.error.code}:${resumed.error.message}`);
  assert.equal(resumed.value.bookRevision, 1, "a resume finishes revision 1; it does not mint revision 2");
  assert.equal(resumed.value.readback, "VERIFIED");
  const pointer = await stores.pointer.read(bookId);
  assert.ok(pointer.ok && pointer.value);
  assert.equal(pointer.value.revision, 1);
  assert.equal(pointer.value.candidateId, staged.identity.candidateId);

  // The artifacts the crash owed are on disk and pass the production verifier —
  // the resume met the same bar a first attempt would have.
  const verified = verifyProductionPackage({
    packagePath,
    manifestPath: sidecarPath,
    compareLooseState: true,
    ...verifyOptionsFrom(manifestOptions),
  });
  assert.equal(verified.ok, true, verified.findings.map((finding) => `${finding.checkId}: ${finding.message}`).join("\n"));
  // A completed release leaves no journal behind.
  assert.equal(existsSync(releaseJournalPath(manifestOptions, bookId, "tx-journal-resume")), false);
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

/**
 * A SHALLOW pin, deliberately labelled as one. It proves only that the CLI's
 * candidate-release wiring gets as far as the promotion authority check without
 * touching state/indexes — it stops at REVIEW_NOT_FOUND and never reaches the
 * production-manifest build, which is where the ambient index dependency
 * actually lived. That blind spot is why the first live candidate release
 * committed its pointer and then died on
 *   RECONCILIATION_REQUIRED: production manifest unbuildable after pointer
 *   commit; nothing published: CHSET.index_missing: Canonical chapter index is
 *   missing at .../state/indexes/the-autobiography-of-benjamin-franklin.json.
 * The manifest build itself is pinned by "a candidate release builds and
 * verifies its production manifest with NO canonical chapter index on disk"
 * below, which runs the whole route with valid review + QC.
 */
requiredTest("candidate-only CLI release wiring reaches the promotion authority check without an ambient chapter index", async (context) => {
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

/** The chapter-set block a candidate-sourced payload must carry. */
function candidateChapterSetBlock(sidecar: ProductionManifestSidecar): Record<string, unknown> {
  const payload = sidecar.manifest.payload as unknown as Record<string, unknown>;
  assert.equal(payload.canonicalIndex, undefined, "a candidate-sourced payload must not carry a canonicalIndex block");
  const block = payload.candidateChapterSet;
  assert.ok(block && typeof block === "object", "a candidate-sourced payload must carry a candidateChapterSet block");
  return block as Record<string, unknown>;
}

/**
 * THE LIVE FAILURE, pinned.
 *
 * The first real candidate release (promote-book --candidate-id, the V4 route)
 * committed its pointer (revision 1 -> 2) and then returned
 *   RECONCILIATION_REQUIRED: production manifest unbuildable after pointer
 *   commit; nothing published: CHSET.index_missing: Canonical chapter index is
 *   missing at .../state/indexes/the-autobiography-of-benjamin-franklin.json.
 *   Existing chapter files are not an inferred production index.
 * because the sidecar build read AMBIENT canonical state (chapterSet.ts,
 * state/indexes/<book>.json) that a candidate-only v25 root does not have.
 *
 * A candidate release is defined over ONE digest-bound candidate: its CHAPTER
 * artifacts are the chapter set, and they are the very chapters the release
 * assembled into this package. So the manifest must build, self-verify, and
 * later re-verify (publish-final's preflight) with NO state/indexes on disk at
 * all — which is exactly the state this test puts the root in.
 */
requiredTest("a candidate release builds and verifies its production manifest with NO canonical chapter index on disk", async (context) => {
  const bookId = "candidate-sourced-manifest-book";
  const stores = storage(context);
  const chapter = fixtureChapter(bookId, 1, "candidate-sourced");
  const staged = await stage(stores.candidates, bookId, "candidate-1", chapter);
  const manifestOptions = manifestRoots(context, bookId, [chapter]);
  // Make the root what a candidate-only v25 root actually is: every other piece
  // of manifest evidence present, and no canonical chapter index anywhere.
  const indexesDir = join(manifestOptions.stateRoot as string, "indexes");
  rmSync(indexesDir, { recursive: true, force: true });
  assert.equal(existsSync(indexesDir), false);

  const input = request(bookId, staged.identity);
  const packagePath = join(context.roots.tempRoot, `${bookId}.package.json`);
  const sidecarPath = join(context.roots.tempRoot, `${bookId}.production-manifest.json`);
  const release = await releaseAdapter(input, stores, context.roots.tempRoot, manifestOptions);
  const released = await release.canonicalRelease.release(input);
  assert.ok(released.ok, released.ok ? "" : `${released.error.code}:${released.error.message}`);
  assert.equal(released.value.bookRevision, 1);
  assert.equal(released.value.readback, "VERIFIED");
  assert.equal(release.packageWrites(), 1);

  // The payload names the candidate it was built from, and nothing else.
  const block = candidateChapterSetBlock(released.value.sidecar);
  assert.equal(block.source, "candidate");
  assert.equal(block.candidateId, staged.identity.candidateId);
  assert.equal(block.manifestDigest, staged.identity.manifestDigest);
  assert.deepEqual(block.chapters, [{
    chapterId: chapter.chapterId,
    chapterNumber: chapter.number,
    chapterTitle: chapter.title,
  }]);

  // publish-final's preflight, replayed independently on the same index-free
  // root. A released pair that only its own releaser can verify is not shippable.
  const verified = verifyProductionPackage({
    packagePath,
    manifestPath: sidecarPath,
    compareLooseState: true,
    ...verifyOptionsFrom(manifestOptions),
  });
  assert.equal(verified.ok, true, verified.findings.map((finding) => `${finding.checkId}: ${finding.message}`).join("\n"));
  assert.equal(verified.contentId, released.value.sidecar.manifest.contentId);
  // Not read, and not written either: the route must not "fix" the missing index
  // by inferring one onto disk.
  assert.equal(existsSync(indexesDir), false);
});

/**
 * RECONCILING AN INTERRUPTED RELEASE — the state the live run was left in.
 *
 * The pointer commits first and the artifacts land second. A release that dies
 * in between (unbuildable manifest, failed writer, crash) leaves CURRENT at the
 * new revision with nothing published. That must be COMPLETABLE, exactly once:
 *  - re-running the same candidate at the ORIGINAL --expected-book-revision with
 *    --resume-unfinished-release finishes manifest + sidecar and does NOT
 *    advance the pointer again;
 *  - re-running THIS candidate at the ADVANCED revision (the obvious operator
 *    reflex) is refused instead of minting a second revision of identical
 *    content over an unfinished one;
 *  - a DIFFERENT candidate can never finish the committed revision.
 *
 * A different candidate releasing FORWARD (a fresh revision that supersedes the
 * unfinished one with a complete pair) stays allowed and is pinned by "a crash
 * between the pointer commit and the package write leaves a journal naming the
 * window"; that is a new release, not a reconcile of this one.
 */
requiredTest("a candidate release interrupted after the pointer commit is completable exactly once, and never double-advances", async (context) => {
  const bookId = "interrupted-release-book";
  const stores = storage(context);
  const chapter = fixtureChapter(bookId, 1, "interrupted-release");
  const staged = await stage(stores.candidates, bookId, "candidate-1", chapter);
  const other = await stage(stores.candidates, bookId, "candidate-2");
  const manifestOptions = manifestRoots(context, bookId, [chapter]);
  rmSync(join(manifestOptions.stateRoot as string, "indexes"), { recursive: true, force: true });

  const input = request(bookId, staged.identity);
  const packagePath = join(context.roots.tempRoot, `${bookId}.package.json`);
  const sidecarPath = join(context.roots.tempRoot, `${bookId}.production-manifest.json`);
  let transactions = 0;
  const release = await releaseAdapter(
    input, stores, context.roots.tempRoot, manifestOptions, input.candidate, false,
    { newTransactionId: () => `tx-interrupted-${++transactions}` },
  );

  // ── The interruption, in the live shape: the pointer commits, then the
  // manifest cannot be built (here the chapter's QC attestation is gone, the
  // same class of post-commit build failure CHSET.index_missing was).
  const qcPath = join(manifestOptions.stateRoot as string, "qc", `${bookId}-ch01.qc.json`);
  const qcBytes = readFileSync(qcPath, "utf8");
  rmSync(qcPath);
  const interrupted = await release.canonicalRelease.release(input);
  assertError(interrupted, "RECONCILIATION_REQUIRED");
  assert.ok(
    !interrupted.ok && interrupted.error.message.includes("production manifest unbuildable after pointer commit"),
    interrupted.ok ? "" : interrupted.error.message,
  );
  const afterCrash = await stores.pointer.read(bookId);
  assert.ok(afterCrash.ok && afterCrash.value);
  assert.equal(afterCrash.value.revision, 1, "the pointer advanced before the build failed");
  assert.equal(afterCrash.value.candidateId, staged.identity.candidateId);
  assert.equal(existsSync(packagePath), false);
  assert.equal(existsSync(sidecarPath), false);
  assert.equal(release.packageWrites(), 0);
  // The window is on disk, naming the candidate and the revision it owes.
  const journalled = readReleaseJournals(manifestOptions, bookId);
  assert.equal(journalled.length, 1);
  assert.equal(journalled[0].state, "pointer-committed");
  assert.equal(journalled[0].candidateId, staged.identity.candidateId);
  assert.equal(journalled[0].targetBookRevision, 1);

  writeFileSync(qcPath, qcBytes);

  // ── The reflex retry: same candidate, --expected-book-revision now the
  // ADVANCED revision. The CAS would accept it and mint revision 2 over a
  // revision 1 that owes artifacts. Refused, with the record and the finishing
  // invocation named.
  const doubleAdvance = await release.canonicalRelease.release({ ...input, expectedBookRevision: 1 });
  assertError(doubleAdvance, "RELEASE_UNFINISHED");
  assert.ok(
    !doubleAdvance.ok && doubleAdvance.error.message.includes("--resume-unfinished-release"),
    doubleAdvance.ok ? "" : doubleAdvance.error.message,
  );
  assert.ok(
    !doubleAdvance.ok && doubleAdvance.error.message.includes(releaseJournalPath(manifestOptions, bookId, "tx-interrupted-1")),
    doubleAdvance.ok ? "" : doubleAdvance.error.message,
  );

  // ── A DIFFERENT candidate can never FINISH this revision. Reconcile is bound
  // to the candidate the journal names, so pointing it at other content is
  // refused before any publish — the committed revision belongs to candidate-1
  // and nothing else may claim it.
  const otherAtBase = await release.canonicalRelease.release({
    ...input, candidate: other.identity, resumeUnfinished: true,
  });
  assertError(otherAtBase, "REVIEW_MISMATCH");

  const afterRefusals = await stores.pointer.read(bookId);
  assert.ok(afterRefusals.ok && afterRefusals.value);
  assert.equal(afterRefusals.value.revision, 1, "no refusal may advance the pointer");
  assert.equal(afterRefusals.value.candidateId, staged.identity.candidateId);
  assert.equal(release.packageWrites(), 0);
  // The crash record is untouched, and no refusal left a record of its own.
  const stillJournalled = readReleaseJournals(manifestOptions, bookId);
  assert.equal(stillJournalled.length, 1);
  assert.equal(stillJournalled[0].txId, "tx-interrupted-1");
  assert.equal(stillJournalled[0].state, "pointer-committed");

  // ── The invocation that COMPLETES it: same candidate, ORIGINAL expected
  // revision, --resume-unfinished-release.
  const resumed = await release.canonicalRelease.release({ ...input, resumeUnfinished: true });
  assert.ok(resumed.ok, resumed.ok ? "" : `${resumed.error.code}:${resumed.error.message}`);
  assert.equal(resumed.value.bookRevision, 1, "a resume finishes revision 1; it does not mint revision 2");
  assert.equal(resumed.value.readback, "VERIFIED");
  assert.equal(release.packageWrites(), 1);
  const settled = await stores.pointer.read(bookId);
  assert.ok(settled.ok && settled.value);
  assert.equal(settled.value.revision, 1);
  assert.equal(settled.value.candidateId, staged.identity.candidateId);
  assert.equal(candidateChapterSetBlock(resumed.value.sidecar).candidateId, staged.identity.candidateId);
  const verified = verifyProductionPackage({
    packagePath,
    manifestPath: sidecarPath,
    compareLooseState: true,
    ...verifyOptionsFrom(manifestOptions),
  });
  assert.equal(verified.ok, true, verified.findings.map((finding) => `${finding.checkId}: ${finding.message}`).join("\n"));
  assert.deepEqual(readReleaseJournals(manifestOptions, bookId), [], "a completed release leaves no journal behind");
});

/**
 * CONTROL. The legacy (no-candidate) manifest route is untouched: the canonical
 * index is still its chapter-set authority, its absence is still CHSET.index_missing,
 * and its payload still carries the canonicalIndex block. Only a build that is
 * TOLD it is releasing a candidate uses the candidate's chapters.
 */
requiredTest("the legacy no-candidate manifest route still requires the ambient canonical chapter index", async (context) => {
  const bookId = "legacy-index-control-book";
  const chapter = fixtureChapter(bookId, 1, "legacy-index-control");
  const pkg = buildLegacyReaderPackage({ bookId, ...metadata(bookId), chapters: [chapter] });
  const manifestOptions = manifestRoots(context, bookId, [chapter]);
  const roots = verifyOptionsFrom(manifestOptions);

  const withIndex = buildExpectedProductionManifestForPackage({ pkg, ...roots });
  assert.equal(withIndex.ok, true, withIndex.ok ? "" : withIndex.findings.map((f) => `${f.checkId}: ${f.message}`).join("\n"));
  if (!withIndex.ok) throw new Error("legacy control needs a successful index-sourced build");
  const legacyPayload = withIndex.payload as unknown as Record<string, unknown>;
  assert.equal(legacyPayload.candidateChapterSet, undefined);
  assert.deepEqual(legacyPayload.canonicalIndex, {
    path: `state/indexes/${bookId}.json`,
    semanticHash: (legacyPayload.canonicalIndex as Record<string, unknown>).semanticHash,
    chapters: [{ chapterId: chapter.chapterId, chapterNumber: chapter.number, chapterTitle: chapter.title }],
  });

  rmSync(join(manifestOptions.stateRoot as string, "indexes"), { recursive: true, force: true });
  const withoutIndex = buildExpectedProductionManifestForPackage({ pkg, ...roots });
  assert.equal(withoutIndex.ok, false, "the legacy route must still refuse a book with no canonical index");
  assert.deepEqual(withoutIndex.findings.map((finding) => finding.checkId), ["CHSET.index_missing"]);

  // Same package, same index-free root — succeeds ONLY when the build is told the
  // chapter set came from a candidate.
  const asCandidate = buildExpectedProductionManifestForPackage({
    pkg,
    chapterSetSource: { kind: "candidate", candidateId: "candidate-1", manifestDigest: "a".repeat(64) },
    ...roots,
  });
  assert.equal(asCandidate.ok, true, asCandidate.ok ? "" : asCandidate.findings.map((f) => `${f.checkId}: ${f.message}`).join("\n"));
});

/** Stage a candidate carrying SEVERAL chapter artifacts. A one-chapter fixture
 *  cannot express "a chapter went missing" at all, which is why the chapter-set
 *  authority probes below need this. */
async function stageChapters(store: CandidateStore, bookId: string, candidateId: string, chapters: ChapterV21[]) {
  const files = chapters.map((chapter) => ({
    kind: "CHAPTER" as const,
    logicalPath: `chapters/ch${String(chapter.number).padStart(2, "0")}.json`,
    mediaType: "application/json" as const,
    bytes: Buffer.from(`${JSON.stringify(chapter, null, 2)}\n`),
  }));
  const staged = await store.stage({
    bookId,
    candidateId,
    createdByRunId: `run-${candidateId}`,
    expectedInventory: files.map(({ bytes: _bytes, ...file }) => file),
    files,
    createdAt: CREATED_AT,
  });
  assert.ok(staged.ok, staged.ok ? "" : `${staged.error.code}:${staged.error.message}`);
  return { identity: { candidateId, manifestDigest: staged.value.manifestDigest }, chapters };
}

/**
 * THE ADVERSARIAL-REVIEW BLOCKER, pinned.
 *
 * verifyProductionPackage reconstructs the expected manifest under the regime the
 * MANIFEST declares (declaredChapterSetSource). On the candidate regime that
 * reconstruction derives the chapter set from the package's own chapters, so the
 * artifact under test was supplying both the claim and the evidence. The
 * canonical-index regime catches a package that lost a chapter precisely because
 * state/indexes/<bookId>.json is an authority that exists independently of the
 * package; the candidate regime had no such authority at all.
 *
 * The independent authority it does have is the chapter set the RELEASE RECORDED
 * in the manifest — payload.candidateChapterSet.chapters, hashed into the
 * contentId. The package is compared to THAT, before any reconstruction.
 *
 * WHAT THE RECORDED BLOCK PINS: chapterId, chapterNumber and chapterTitle per
 * chapter — there is no per-chapter content hash in it (ProductionManifestChapterSpec).
 * So it speaks about the chapter SET (dropped / added / renumbered / reordered),
 * not chapter BODIES; bodies are pinned per chapter by
 * payload.chapters[].readerContentHash, which is now also checked against the
 * RECORDED chapters rather than reconstructed ones.
 *
 * WHAT IT CANNOT PIN, stated plainly: a wholesale re-authoring of BOTH files —
 * a truncated package republished with a freshly built candidate-declaring
 * manifest whose block, payload and contentId are all recomputed over the
 * truncated set. That pair is internally consistent and nothing inside the two
 * files can refute it; the anchor is outside the pair (the CURRENT pointer /
 * registry names the candidateId + manifestDigest actually released, and the
 * candidate is content-addressed by that digest). The test below this one is how
 * a caller holding that identity brings the anchor to bear.
 *
 * Observed on this fixture BEFORE the fix (2-chapter candidate released, then
 * chapter 2 dropped from the shipped package):
 *   truncated.findings = PPKG.manifest_payload_mismatch, PPKG.content_id_recomputed_mismatch
 * — the coarse whole-payload hash, with nothing naming the missing chapter, and
 * nothing at all once the manifest is rebuilt from the truncated package.
 */
requiredTest("a candidate manifest checks the package against the chapter set it RECORDED, not the package's own chapters", async (context) => {
  const bookId = "recorded-chapter-set-book";
  const stores = storage(context);
  const chapters = [fixtureChapter(bookId, 1, "recorded-set"), fixtureChapter(bookId, 2, "recorded-set")];
  const staged = await stageChapters(stores.candidates, bookId, "candidate-1", chapters);
  const manifestOptions = manifestRoots(context, bookId, chapters);
  // A candidate-only root: there is no ambient index to fall back on, which is
  // the state in which the recorded block is the ONLY chapter-set authority.
  rmSync(join(manifestOptions.stateRoot as string, "indexes"), { recursive: true, force: true });

  const input = request(bookId, staged.identity);
  const packagePath = join(context.roots.tempRoot, `${bookId}.package.json`);
  const sidecarPath = join(context.roots.tempRoot, `${bookId}.production-manifest.json`);
  const release = await releaseAdapter(input, stores, context.roots.tempRoot, manifestOptions);
  const released = await release.canonicalRelease.release(input);
  assert.ok(released.ok, released.ok ? "" : `${released.error.code}:${released.error.message}`);

  // The recorded set names both chapters, and the shipped pair verifies.
  const block = candidateChapterSetBlock(released.value.sidecar);
  assert.deepEqual(block.chapters, chapters.map((chapter) => ({
    chapterId: chapter.chapterId,
    chapterNumber: chapter.number,
    chapterTitle: chapter.title,
  })));
  const shipped = verifyProductionPackage({ packagePath, manifestPath: sidecarPath, ...verifyOptionsFrom(manifestOptions) });
  assert.equal(shipped.ok, true, shipped.findings.map((finding) => `${finding.checkId}: ${finding.message}`).join("\n"));
  const shippedPackageBytes = readFileSync(packagePath, "utf8");
  const shippedSidecarBytes = readFileSync(sidecarPath, "utf8");

  // ── (a) TRUNCATION. Chapter 2 is dropped from the shipped package; the
  // manifest is untouched, so its recorded set still names both.
  const pkg = JSON.parse(shippedPackageBytes) as Record<string, unknown>;
  writeFileSync(packagePath, JSON.stringify({ ...pkg, chapters: (pkg.chapters as unknown[]).slice(0, 1) }));
  const truncated = verifyProductionPackage({ packagePath, manifestPath: sidecarPath, ...verifyOptionsFrom(manifestOptions) });
  assert.equal(truncated.ok, false, "a truncated package must never verify");
  const truncatedCodes = truncated.findings.map((finding) => finding.checkId);
  assert.ok(truncatedCodes.includes("PPKG.candidate_chapter_set_mismatch"), truncatedCodes.join(", "));
  // Precise, not just "some byte of the payload differs": the refusal names the
  // chapter that went missing.
  assert.ok(
    truncated.findings.some((finding) =>
      finding.checkId === "PPKG.candidate_chapter_set_mismatch" && finding.message.includes(chapters[1].chapterId)),
    truncated.findings.map((finding) => finding.message).join("\n"),
  );

  // ── (b) SUBSTITUTION. The package keeps its chapter COUNT but ships a chapter
  // the recorded set does not name — the shape a count-only check would miss.
  // Built by re-identifying a SHIPPED chapter so it stays reader-clean and the
  // refusal is the chapter-set one, not the forbidden-field one.
  const foreignId = `${bookId}-ch03`;
  const foreign = { ...JSON.parse(JSON.stringify((pkg.chapters as unknown[])[1])) as Record<string, unknown>, chapterId: foreignId, number: 3 };
  writeFileSync(packagePath, JSON.stringify({ ...pkg, chapters: [(pkg.chapters as unknown[])[0], foreign] }));
  const substituted = verifyProductionPackage({ packagePath, manifestPath: sidecarPath, ...verifyOptionsFrom(manifestOptions) });
  assert.equal(substituted.ok, false);
  assert.ok(
    substituted.findings.some((finding) =>
      finding.checkId === "PPKG.candidate_chapter_set_mismatch" && finding.message.includes(foreignId)),
    substituted.findings.map((finding) => `${finding.checkId}: ${finding.message}`).join("\n"),
  );

  // ── (c) The recorded block is not taken on trust either. Edit it to agree with
  // a truncated package and leave its semanticHash — the hash the contentId is
  // derived over — as it was, and the block is refused for disagreeing with
  // itself, independently of the package comparison.
  writeFileSync(packagePath, JSON.stringify({ ...pkg, chapters: (pkg.chapters as unknown[]).slice(0, 1) }));
  const tampered = JSON.parse(shippedSidecarBytes) as { manifest: { payload: Record<string, unknown> } };
  const tamperedBlock = tampered.manifest.payload.candidateChapterSet as Record<string, unknown>;
  tamperedBlock.chapters = (tamperedBlock.chapters as unknown[]).slice(0, 1);
  const tamperedPath = join(context.roots.tempRoot, `${bookId}.tampered-manifest.json`);
  writeFileSync(tamperedPath, JSON.stringify(tampered));
  const halfForged = verifyProductionPackage({ packagePath, manifestPath: tamperedPath, ...verifyOptionsFrom(manifestOptions) });
  assert.equal(halfForged.ok, false);
  const halfForgedCodes = halfForged.findings.map((finding) => finding.checkId);
  assert.ok(halfForgedCodes.includes("PPKG.candidate_chapter_set_hash_mismatch"), halfForgedCodes.join(", "));

  // The shipped sidecar was never modified by any of this.
  assert.equal(readFileSync(sidecarPath, "utf8"), shippedSidecarBytes);
});

/**
 * LAYER 1. A caller that independently knows which release it is looking at gets
 * the last word on the chapter-set regime, so the artifact cannot select its own.
 * The release adapter's self-verify now passes the candidate identity it just
 * committed the pointer to.
 *
 * The expectation is OPTIONAL on purpose, and that is load-bearing: the recovery
 * flows verify an already-shipped pair with nothing but the two files (no
 * candidate identity in hand), and "a failed re-release leaves the previously
 * shipped package and sidecar byte-identical" would break under a blanket
 * caller-must-know-the-expectation design. Omitting it is pinned here as a
 * supported mode, not an accident.
 */
requiredTest("a caller that knows which candidate it released refuses a manifest declaring a different chapter-set authority", async (context) => {
  const bookId = "expected-chapter-set-book";
  const stores = storage(context);
  const chapter = fixtureChapter(bookId, 1, "expected-source");
  const staged = await stageChapters(stores.candidates, bookId, "candidate-1", [chapter]);
  const manifestOptions = manifestRoots(context, bookId, [chapter]);
  const input = request(bookId, staged.identity);
  const packagePath = join(context.roots.tempRoot, `${bookId}.package.json`);
  const sidecarPath = join(context.roots.tempRoot, `${bookId}.production-manifest.json`);
  const release = await releaseAdapter(input, stores, context.roots.tempRoot, manifestOptions);
  const released = await release.canonicalRelease.release(input);
  assert.ok(released.ok, released.ok ? "" : `${released.error.code}:${released.error.message}`);
  const roots = { packagePath, manifestPath: sidecarPath, ...verifyOptionsFrom(manifestOptions) };

  // The identity the release actually published verifies.
  const matched = verifyProductionPackage({
    ...roots,
    expectedChapterSetSource: { kind: "candidate", candidateId: staged.identity.candidateId, manifestDigest: staged.identity.manifestDigest },
  });
  assert.equal(matched.ok, true, matched.findings.map((finding) => `${finding.checkId}: ${finding.message}`).join("\n"));

  // No expectation at all — the recovery/publish-final mode — is unchanged.
  assert.equal(verifyProductionPackage(roots).ok, true);

  // A candidate-declaring manifest under a canonical-index expectation, a
  // different candidateId, and a different manifestDigest are all refused, each
  // by the same blocker, BEFORE the reconstruction regime is used for anything.
  for (const expectedChapterSetSource of [
    "canonical-index" as const,
    { kind: "candidate" as const, candidateId: "candidate-2", manifestDigest: staged.identity.manifestDigest },
    { kind: "candidate" as const, candidateId: staged.identity.candidateId, manifestDigest: "b".repeat(64) },
  ]) {
    const refused = verifyProductionPackage({ ...roots, expectedChapterSetSource });
    assert.equal(refused.ok, false, JSON.stringify(expectedChapterSetSource));
    const codes = refused.findings.map((finding) => finding.checkId);
    assert.deepEqual(codes, ["PPKG.chapter_set_source_mismatch"], codes.join(", "));
  }

  // And the symmetric direction: a LEGACY canonical-index manifest is accepted
  // under a canonical-index expectation and refused under a candidate one, so
  // neither regime can be smuggled past a caller expecting the other.
  const legacyBookId = "expected-legacy-index-book";
  const legacyChapter = fixtureChapter(legacyBookId, 1, "expected-legacy");
  const legacyPackage = buildLegacyReaderPackage({ bookId: legacyBookId, ...metadata(legacyBookId), chapters: [legacyChapter] });
  const legacyOptions = manifestRoots(context, legacyBookId, [legacyChapter]);
  const legacyBuilt = buildCanonicalPackageManifest({ package: legacyPackage, ...legacyOptions });
  assert.equal(legacyBuilt.ok, true, legacyBuilt.ok ? "" : legacyBuilt.findings.map((f) => f.message).join("\n"));
  if (!legacyBuilt.ok) throw new Error("the legacy control needs a successful index-sourced build");
  const legacySidecar: ProductionManifestSidecar = {
    schemaVersion: PRODUCTION_MANIFEST_SIDECAR_SCHEMA,
    bookId: legacyPackage.book.bookId,
    packageId: legacyPackage.packageId,
    createdAt: legacyPackage.createdAt,
    manifest: legacyBuilt.manifest,
  };
  const legacyRoots = { packageData: legacyPackage, manifestData: legacySidecar, ...verifyOptionsFrom(legacyOptions) };
  const legacyMatched = verifyProductionPackage({ ...legacyRoots, expectedChapterSetSource: "canonical-index" });
  assert.equal(legacyMatched.ok, true, legacyMatched.findings.map((finding) => `${finding.checkId}: ${finding.message}`).join("\n"));
  const legacyRefused = verifyProductionPackage({
    ...legacyRoots,
    expectedChapterSetSource: { kind: "candidate", candidateId: "candidate-1", manifestDigest: "c".repeat(64) },
  });
  assert.equal(legacyRefused.ok, false);
  assert.deepEqual(legacyRefused.findings.map((finding) => finding.checkId), ["PPKG.chapter_set_source_mismatch"]);
});

/**
 * The double-advance guard's remaining hole.
 *
 * The guard matched only `pointer-committed` / `package-pending` records. But
 * releaseJournal.ts documents `pointer-pending` as "the pointer CAS has been
 * attempted; its outcome is not yet known to the journal (a crash here may or may
 * not have committed)" — so a pointer-pending record whose TARGET revision is the
 * revision an operator is now passing as --expected-book-revision describes
 * exactly the state the guard exists for, with the commit unprovable rather than
 * absent. Treating "unknown" as "did not commit" is the one reading the record
 * forbids.
 *
 * Observed on this fixture BEFORE the fix: the retry at the advanced revision
 * returned ok=true with bookRevision 2 and packageWrites 1 — a second revision of
 * the same candidate minted over a revision 1 that still owes artifacts.
 *
 * The forward-release pin is unaffected and re-asserted here: a DIFFERENT
 * candidate releasing at the advanced revision is a normal supersede, not a
 * reconcile, and still goes out.
 */
requiredTest("a pointer-pending record blocks the same candidate from double-advancing, and never blocks a different one", async (context) => {
  const bookId = "pointer-pending-guard-book";
  const stores = storage(context);
  const chapter = fixtureChapter(bookId, 1, "pointer-pending");
  const staged = await stageChapters(stores.candidates, bookId, "candidate-1", [chapter]);
  const other = await stage(stores.candidates, bookId, "candidate-2");
  const manifestOptions = manifestRoots(context, bookId, [chapter]);
  const input = request(bookId, staged.identity);

  // The crash the state is named for: the CAS lands and the journal update that
  // would record it does not, so the surviving record is still `pointer-pending`.
  // Produced through the real route (the journal write throws), not by hand.
  const backing = createFileReleaseJournal({ stateRoot: manifestOptions.stateRoot as string });
  const stuck: ReleaseJournal = {
    ...backing,
    list: (id) => backing.list(id),
    pathFor: (id, txId) => backing.pathFor(id, txId),
    dirFor: (id) => backing.dirFor(id),
    clear: (id, txId) => backing.clear(id, txId),
    write: (record) => {
      if (record.state !== "pointer-pending") throw new Error("injected journal fault after the pointer CAS");
      backing.write(record);
    },
  };
  const crashing = await releaseAdapter(
    input, stores, context.roots.tempRoot, manifestOptions, input.candidate, false,
    { journal: stuck, newTransactionId: () => "tx-pointer-pending" },
  );
  const crashed = await crashing.canonicalRelease.release(input);
  assertError(crashed, "RECONCILIATION_REQUIRED");
  assert.equal(crashing.packageWrites(), 0);
  const pointerAfterCrash = await stores.pointer.read(bookId);
  assert.ok(pointerAfterCrash.ok && pointerAfterCrash.value);
  assert.equal(pointerAfterCrash.value.revision, 1, "the CAS landed");
  const filed = readReleaseJournals(manifestOptions, bookId);
  assert.equal(filed.length, 1);
  assert.equal(filed[0].state, "pointer-pending", "the crash window this test is about");
  assert.equal(filed[0].targetBookRevision, 1);
  const crashBytes = readFileSync(releaseJournalPath(manifestOptions, bookId, "tx-pointer-pending"), "utf8");

  // The reflex retry at the ADVANCED revision, with a working journal. The CAS
  // would accept it and mint revision 2 for the very same candidate.
  const retry = await releaseAdapter(
    input, stores, context.roots.tempRoot, manifestOptions, input.candidate, false,
    { newTransactionId: () => "tx-pointer-pending-retry" },
  );
  const doubleAdvance = await retry.canonicalRelease.release({ ...input, expectedBookRevision: 1 });
  assertError(doubleAdvance, "RELEASE_UNFINISHED");
  assert.ok(
    !doubleAdvance.ok && doubleAdvance.error.message.includes("--resume-unfinished-release"),
    doubleAdvance.ok ? "" : doubleAdvance.error.message,
  );
  assert.ok(
    !doubleAdvance.ok && doubleAdvance.error.message.includes(releaseJournalPath(manifestOptions, bookId, "tx-pointer-pending")),
    doubleAdvance.ok ? "" : doubleAdvance.error.message,
  );
  // The refusal does not claim proof it does not have: a pointer-pending record
  // says the CAS outcome was never recorded, not that it committed.
  assert.ok(
    !doubleAdvance.ok && doubleAdvance.error.message.includes("may have been committed"),
    doubleAdvance.ok ? "" : doubleAdvance.error.message,
  );
  assert.equal(retry.packageWrites(), 0);
  const afterRefusal = await stores.pointer.read(bookId);
  assert.ok(afterRefusal.ok && afterRefusal.value);
  assert.equal(afterRefusal.value.revision, 1, "no refusal may advance the pointer");
  // The evidence is untouched and the refusal left no record of its own.
  assert.equal(readFileSync(releaseJournalPath(manifestOptions, bookId, "tx-pointer-pending"), "utf8"), crashBytes);
  assert.equal(existsSync(releaseJournalPath(manifestOptions, bookId, "tx-pointer-pending-retry")), false);

  // A DIFFERENT candidate releasing forward at the same advanced revision is a
  // normal supersede and still proceeds — the guard is scoped to THIS candidate.
  const otherOptions = manifestRoots(context, bookId, [other.chapter], "-forward");
  const otherInput: CanonicalReleaseRequest = {
    ...request(bookId, other.identity),
    reviewId: "review-2",
    qcRoundId: "qc-2",
    expectedBookRevision: 1,
    metadata: { ...metadata(bookId), packageId: `${bookId}-v21-1784548804000`, createdAt: "2026-07-20T12:00:04.000Z" },
  };
  const forward = await releaseAdapter(
    otherInput, stores, context.roots.tempRoot, otherOptions, otherInput.candidate, false,
    { stateRoot: manifestOptions.stateRoot as string, newTransactionId: () => "tx-forward" },
  );
  const forwarded = await forward.canonicalRelease.release(otherInput);
  assert.ok(forwarded.ok, forwarded.ok ? "" : `${forwarded.error.code}:${forwarded.error.message}`);
  assert.equal(forwarded.value.bookRevision, 2);
  assert.equal(forward.packageWrites(), 1);
  // And the crashed record survives as evidence, byte-identical.
  assert.equal(readFileSync(releaseJournalPath(manifestOptions, bookId, "tx-pointer-pending"), "utf8"), crashBytes);
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
