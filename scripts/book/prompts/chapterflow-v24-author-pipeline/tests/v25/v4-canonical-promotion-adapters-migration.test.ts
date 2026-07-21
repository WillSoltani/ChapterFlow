import assert from "node:assert/strict";
import { cpSync, existsSync, mkdirSync, readFileSync, symlinkSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { pathToFileURL } from "node:url";

import { createBookContentReader } from "../../src/books/bookContentReader.js";
import { createBookWriteLock } from "../../src/books/bookLease.js";
import { createCandidateStore, type CandidateStore } from "../../src/books/candidateStore.js";
import { createCurrentPointerStore, type CurrentPointerStore } from "../../src/books/currentPointer.js";
import type { CandidateIdentity, Result } from "../../src/contracts/v4Core.js";
import { chapterContentHash } from "../../src/critics/qcAttestation.js";
import { createQcService } from "../../src/qc/qcService.js";
import type { QcService } from "../../src/qc/qcTypes.js";
import {
  assembleCanonicalPackage,
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
import type { BookPackageV21, ChapterV21 } from "../../src/types.js";
import { fixtureChapter } from "../model-bakeoff-helpers.js";
import {
  makeGateCleanChapter,
  makeSourceV2SidecarFixture,
  PIPELINE_DIR,
  writeResearchRunManifestFixture,
} from "../helpers.js";
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

function writeJson(path: string, value: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

function assertError(result: Result<unknown>, code: string): void {
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.error.code, code);
}

async function actualLegacyPromotion(context: TestContext, bookId: string) {
  const cloneRoot = join(context.roots.tempRoot, "legacy-pipeline");
  const excluded = new Set([".chapterflow", "book-packages", "node_modules", "state", "tests"]);
  cpSync(PIPELINE_DIR, cloneRoot, {
    recursive: true,
    filter(source) {
      const rel = relative(PIPELINE_DIR, source);
      return rel === "" || !excluded.has(rel.split(/[\\/]/)[0]);
    },
  });
  assert.equal(existsSync(join(PIPELINE_DIR, "node_modules")), true, "named gate requires installed pipeline dependencies");
  symlinkSync(join(PIPELINE_DIR, "node_modules"), join(cloneRoot, "node_modules"), "dir");

  const chapter = makeGateCleanChapter(bookId, 1);
  const sixthQuestion = chapter.quiz.questions[5];
  sixthQuestion.prompt = sixthQuestion.prompt.replace(/\bbook\b/gi, "record");
  sixthQuestion.choices = sixthQuestion.choices.map((choice) => choice.replace(/\bbook\b/gi, "record"));
  sixthQuestion.explanation = sixthQuestion.explanation.replace(/\bbook\b/gi, "record");
  const factAnchor = "ch01.fact.1";
  const exampleAnchors = [
    "ch01.ex.northstar-lab",
    "ch01.ex.harbor-clinic",
    "ch01.ex.atlas-foods",
    "ch01.ex.shah-onboarding",
    "ch01.ex.cedar-invoice",
    "ch01.ex.riverton-library",
  ];
  const scenarios = [
    "On Monday morning at Northstar Lab's intake desk, Rina sees that the support ticket count no longer matches the May 2026 source note. She pauses the queue, checks the 37 to 12 audit record, and fixes the entry before another team uses it.",
    "At Harbor Clinic before Friday discharge, Quin finds 18 forms missing from the signed consent packet. He compares the consent list with the source note and keeps the discharge review from moving on a guessed count.",
    "During Atlas Foods' June 2026 launch review at the warehouse dock, Bria is the operations manager reviewing a cold-chain sensor note that conflicts with the release label. The team delays the shipment by 9 days, traces the failed device, and repairs the batch record before product leaves.",
    "In Shah's onboarding room at 9:00 a.m., Soren is the training lead reading two handoff sheets that name different owners. She checks the source note, names one owner, and keeps the new hire from following a private version.",
    "At the Cedar invoice pilot before quarterly close, Ivo catches 6 duplicate invoices in the source packet. He restores the vendor context and assigns the follow-up before the summary is approved.",
    "Inside Riverton Library's Tuesday archive queue, Yara finds requests split across 5 inboxes. The group chooses the source queue, links the evidence, and blocks the scattered histories from becoming policy.",
  ];
  chapter.counterintuition = "Unit5 restraint works because the original custody record has not gone stale.";
  chapter.breakdown.fastRead =
    "Northstar Lab saw ticket reopenings fall from 37 to 12 after a May 2026 intake checkpoint. The lesson is simple: pause early, compare the record, and name one owner. Harbor Clinic found 18 missing consent forms before Friday discharge because Quin checked the packet. Atlas Foods delayed the June launch by 9 days when Bria found the bad cold-chain sensor. A small check keeps the wrong value from spreading.";
  chapter.breakdown.deepRead += " Early verification keeps the rhythm problem small enough for one owner to repair.";
  chapter.breakdown.fullRead += " A visible owner turns scattered sonata signals into one decision trail.";
  chapter.memorableLines = [
    { text: "Northstar Lab saw ticket reopenings fall from 37 to 12 after a May 2026 intake checkpoint.", location: "fastRead", why: "It names the source-backed checkpoint." },
    { text: "Early verification keeps the rhythm problem small enough for one owner to repair.", location: "deepRead", why: "It explains why early repair is cheaper." },
    { text: "A visible owner turns scattered sonata signals into one decision trail.", location: "fullRead", why: "It ties ownership to evidence." },
  ];
  const effectiveAnchors: Record<string, string[]> = {
    hook: [factAnchor],
    counterintuition: [factAnchor],
    "breakdown.fastRead": [factAnchor],
    "breakdown.deepRead": [factAnchor],
    "breakdown.fullRead": [factAnchor],
    keyTakeaway: [factAnchor],
    tryThisNow: [factAnchor],
    "implementationPlan.title": [factAnchor],
    "implementationPlan.coreSkill": [factAnchor],
    "implementationPlan.twentyFourHourChallenge": [factAnchor],
    "implementationPlan.weeklyPractice": [factAnchor],
  };
  chapter.examples.forEach((example, index) => {
    example.sourceAnchorIds = [exampleAnchors[index]];
    example.scenario = scenarios[index];
    (example as ChapterV21["examples"][number] & { planSpec?: Record<string, unknown> }).planSpec = {
      ...((example as ChapterV21["examples"][number] & { planSpec?: Record<string, unknown> }).planSpec ?? {}),
      venue: `Fixture venue ${index + 1}`,
      exemplar: "",
    };
    effectiveAnchors[`examples[${index}]`] = [exampleAnchors[index]];
  });
  chapter.quiz.questions.forEach((_, index) => { effectiveAnchors[`quiz.questions[${index}]`] = [factAnchor]; });
  chapter.reviewCards.forEach((card, index) => {
    card.sourceAnchorIds = [factAnchor];
    effectiveAnchors[`reviewCards[${index}]`] = [factAnchor];
  });
  chapter.implementationPlan.ifThenPlans.forEach((plan, index) => {
    plan.sourceAnchorIds = [factAnchor];
    effectiveAnchors[`implementationPlan.ifThenPlans[${index}]`] = [factAnchor];
  });
  chapter.memorableLines?.forEach((line, index) => {
    line.sourceAnchorIds = [factAnchor];
    effectiveAnchors[`memorableLines[${index}]`] = [factAnchor];
  });
  chapter.authoring = {
    schemaVersion: "chapter-authoring-v1",
    sourceAnchors: {
      schemaVersion: "chapter-source-anchor-map-v1",
      sourceHash: "sha256:v4-real-legacy-parity",
      observedAnchorIds: [factAnchor, ...exampleAnchors],
      effectiveAnchors,
    },
  };
  writeJson(join(cloneRoot, "state", "indexes", `${bookId}.json`), [{
    chapterId: chapter.chapterId,
    chapterNumber: chapter.number,
    chapterTitle: chapter.title,
  }]);
  writeJson(join(cloneRoot, "state", "chapters", `${chapter.chapterId}.v21-native.chapter.json`), chapter);
  writeJson(join(cloneRoot, "state", "briefs", `${bookId}.manual-brief.json`), {
    schemaVersion: "manual-book-brief-v1",
    bookId,
    title: `Title ${bookId}`,
    author: "Test Author",
  });
  writeJson(join(cloneRoot, "state", "plans", `${chapter.chapterId}.manual-plan.json`), {
    schemaVersion: "manual-chapter-plan-v1",
    bookId,
    chapterId: chapter.chapterId,
    chapterNumber: 1,
    title: chapter.title,
    coreMove: "Use the fixture signal.",
  });
  const runDir = join(cloneRoot, ".chapterflow", "runs", bookId, "run-a");
  writeResearchRunManifestFixture({ runDir, bookId, chapters: [{ number: 1, title: chapter.title }] });
  const sidecar = makeSourceV2SidecarFixture({ chapterNumber: 1, chapterTitle: chapter.title });
  sidecar.namedExamples.push(
    {
      id: exampleAnchors[3], label: "Shah onboarding owner", summary: "Mira Shah named one owner before onboarding handoff.",
      teachesWhat: "One owner keeps records coherent.", hardSpecifics: ["Mira Shah", "one owner", "onboarding"], realWorld: false,
    },
    {
      id: exampleAnchors[4], label: "Cedar invoice pilot", summary: "Cedar caught 6 duplicate invoices before close.",
      teachesWhat: "Early checks preserve vendor context.", hardSpecifics: ["Cedar", "6 invoices", "quarterly close"], realWorld: false,
    },
    {
      id: exampleAnchors[5], label: "Riverton archive queue", summary: "Riverton moved requests from 5 inboxes into one queue.",
      teachesWhat: "One queue preserves the audit path.", hardSpecifics: ["Riverton", "5 inboxes", "Tuesday queue"], realWorld: false,
    },
  );
  writeJson(join(runDir, "sidecars", "source", "ch01.source.json"), sidecar);
  writeJson(join(cloneRoot, "state", "qc", `${bookId}-ch01.qc.json`), {
    schemaVersion: "qc-attest-v1",
    bookId,
    chapterNumber: 1,
    chapterId: chapter.chapterId,
    verdict: "PUBLISHABLE",
    contentHash: chapterContentHash(chapter),
    hashVersion: "v2",
    reviewer: "codex-qc:v4-real-legacy-parity",
    reviewedAt: QC_AT,
    roundId: "qc-legacy",
    roundRole: "attest",
  });

  const prior = {
    noApi: process.env.CHAPTERFLOW_NO_API_CODEX_QC,
    source: process.env.CHAPTERFLOW_REQUIRE_SOURCE_VERIFY,
    key: process.env.CHAPTERFLOW_REQUIRE_KEYJUDGE,
    majors: process.env.CHAPTERFLOW_ENFORCE_MAJORS,
  };
  process.env.CHAPTERFLOW_NO_API_CODEX_QC = "0";
  process.env.CHAPTERFLOW_REQUIRE_SOURCE_VERIFY = "0";
  process.env.CHAPTERFLOW_REQUIRE_KEYJUDGE = "0";
  process.env.CHAPTERFLOW_ENFORCE_MAJORS = "0";
  try {
    // Legacy promote is synchronous and offline: model judge runs out-of-band and
    // this route only reads its records. NO_API=0 reproduces legacy gate mode;
    // sanitized provider credentials plus ALLOW_MODEL_GEN=0 forbid live fallback.
    assert.equal(process.env.CHAPTERFLOW_ALLOW_MODEL_GEN, "0");
    for (const key of [
      "OPENAI_API_KEY", "CODEX_API_KEY", "AZURE_OPENAI_API_KEY", "ANTHROPIC_API_KEY",
    ]) assert.equal(process.env[key], undefined, `${key} must stay sanitized`);
    const gateModule = await import(pathToFileURL(join(cloneRoot, "src", "critics", "finalGate.ts")).href) as typeof import("../../src/critics/finalGate.js");
    const shipGate = gateModule.runShipGate(chapter);
    assert.deepEqual(shipGate.blockers, [], JSON.stringify(shipGate.blockers, null, 2));
    const promoteModule = await import(pathToFileURL(join(cloneRoot, "src", "promoteBook.ts")).href) as typeof import("../../src/promoteBook.js");
    const result = promoteModule.promoteBook({
      bookId,
      title: `Title ${bookId}`,
      author: "Test Author",
      chapters: [{ chapterId: chapter.chapterId, chapterNumber: 1, chapterTitle: chapter.title }],
      categories: ["Self-Help"],
      tags: ["fixture"],
    }, { now: () => new Date(PROMOTED_AT), transactionId: "legacy-parity" });
    assert.equal(result.promoted, true, result.reason);
    assert.ok(result.packagePath);
    const bookPackage = JSON.parse(readFileSync(result.packagePath, "utf8")) as BookPackageV21;
    const sidecarPath = join(cloneRoot, "state", "books", `${bookId}.production-manifest.json`);
    const sidecar = JSON.parse(readFileSync(sidecarPath, "utf8")) as {
      manifest: { schemaVersion: string; metadata: { createdAt: string; generator: string; runId: string } };
    };
    return { cloneRoot, chapter, packagePath: result.packagePath, bookPackage, manifest: sidecar.manifest };
  } finally {
    const restore = (name: string, value: string | undefined): void => {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    };
    restore("CHAPTERFLOW_NO_API_CODEX_QC", prior.noApi);
    restore("CHAPTERFLOW_REQUIRE_SOURCE_VERIFY", prior.source);
    restore("CHAPTERFLOW_REQUIRE_KEYJUDGE", prior.key);
    restore("CHAPTERFLOW_ENFORCE_MAJORS", prior.majors);
  }
}

requiredTest("actual disposable legacy promotion and V4 candidate package plus manifest match", async (context) => {
  const bookId = "package-parity-book";
  const legacy = await actualLegacyPromotion(context, bookId);
  const stores = storage(context);
  const staged = await stage(stores.candidates, bookId, "candidate-1", legacy.chapter);
  const assembled = await assembleCanonicalPackage({
    bookId,
    candidate: staged.identity,
    metadata: {
      title: legacy.bookPackage.book.title,
      author: legacy.bookPackage.book.author,
      packageId: legacy.bookPackage.packageId,
      createdAt: legacy.bookPackage.createdAt,
      contentOwner: legacy.bookPackage.contentOwner,
      categories: legacy.bookPackage.book.categories,
      tags: legacy.bookPackage.book.tags,
    },
    contentReader: stores.reader,
  });
  assert.ok(assembled.ok);
  assert.deepEqual(assembled.value.package, legacy.bookPackage);

  const productionModule = await import(pathToFileURL(join(legacy.cloneRoot, "src", "productionManifest.ts")).href) as typeof import("../../src/productionManifest.js");
  const v4Manifest = productionModule.buildExpectedProductionManifestForPackage({
    pkg: assembled.value.package,
    stateRoot: join(legacy.cloneRoot, "state"),
    runsRoot: join(legacy.cloneRoot, ".chapterflow", "runs"),
    createdAt: legacy.manifest.metadata.createdAt,
    generator: legacy.manifest.metadata.generator,
    runId: legacy.manifest.metadata.runId,
    packagePath: legacy.packagePath,
    manifestVersion: legacy.manifest.schemaVersion.endsWith("v2") ? "v2" : "v1",
    env: { ...process.env, CHAPTERFLOW_NO_API_CODEX_QC: "0", CHAPTERFLOW_ALLOW_MODEL_GEN: "0" },
    now: new Date(PROMOTED_AT),
  });
  assert.equal(v4Manifest.ok, true, v4Manifest.ok ? "" : v4Manifest.findings.map((finding) => finding.message).join("; "));
  assert.ok(v4Manifest.ok);
  assert.deepEqual(v4Manifest.manifest, legacy.manifest);
});

function sharedLegacyAuthority(initialActiveUses: number) {
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
      enabled = false;
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

  const reconciled = await faultRelease.canonicalRelease.release(faultInput);
  assert.ok(reconciled.ok);
  assert.equal(reconciled.value.bookRevision, 1);
  assert.equal(faultRelease.pointer.counts.compareAndSet, 1);
  assert.equal(faultRelease.packageWrites(), 2);
  assert.equal(existsSync(join(context.roots.tempRoot, `${faultBookId}.package.json`)), true);
  assert.equal(faultShared.enabled(), false);
  assert.equal(faultShared.calls.restore, 0);

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
