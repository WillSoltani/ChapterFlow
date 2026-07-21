import assert from "node:assert/strict";
import { appendFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "fs";
import { dirname, resolve } from "path";

import { test } from "./harness.js";
import { PIPELINE_DIR, STATE_CHAPTERS, makeGateCleanChapter, makeSourceV2SidecarFixture, writeFixtureBook, writeResearchRunManifestFixture, writeVerifiedSourceVerifyRecord } from "./helpers.js";
import { sourceVerifyRecordPath } from "../src/critics/sourceVerify.js";
import type { ChapterV21 } from "../src/types.js";
import { chapterContentHash, attestationPath, writeAttestation } from "../src/critics/qcAttestation.js";
import { AXIS_WEIGHTS, computeVerdict, type AxisId, type AxisScore } from "../src/critics/semantic/publishableBar.js";
import { REPO_ROOT } from "../src/lib/chapterPaths.js";
import { keyDerivationPath, keyPackDir, loadKeyPack, manualKeyJudgePath, writeKeyPacks, type KeyDerivation } from "../src/qc/manualKeyJudge.js";
import { qcRoundPath, openQcRound } from "../src/qc/qcRound.js";
import { repairLedgerPath, roundRecordPath, orchestratorRoundDir, writeBarReadArtifact, writeConfirmReadArtifact } from "../src/qc/orchestrator/artifacts.js";
import { REQUIRED_SWEEP_FAMILIES, sweepRecordPath, writeSweepRecordFromSubmission } from "../src/qc/sweep.js";
import { sourceHashFor } from "../src/qc/sourceV2Gate.js";
import { publishAfterQc, formatPreflightChecklist, hermeticSelfTestEnv } from "../src/qc/publishAfterQc.js";
import { provenancePath, recordAuthorProvenance } from "../src/qc/sessionProvenance.js";
import { productionManifestSidecarPath } from "../src/promoteBook.js";

const GREEN_BOOK = "zz-fixture-publish-green";
const REVISE_BOOK = "zz-fixture-publish-revise";
const INCOMPLETE_BOOK = "zz-fixture-publish-incomplete";
const ROUND = "r-publish";
const RUN = "20260613T000000Z";
const SOURCE_CHAPTER_NUMBER = 5;
const AUTHOR_SESSION = "fixture-publish-author";
const SWEEP_SESSION = "fixture-publish-sweep";
const BAR_SESSION = "fixture-publish-bar";
const CONFIRM_SESSION = "fixture-publish-confirm";
const ATTEST_SESSION = "fixture-publish-attest";

function cleanup(bookIds = [GREEN_BOOK, REVISE_BOOK, INCOMPLETE_BOOK]): void {
  for (const bookId of bookIds) {
    for (const f of readdirSync(STATE_CHAPTERS)) {
      if (f.startsWith(`${bookId}-ch`)) rmSync(resolve(STATE_CHAPTERS, f), { force: true });
    }
    rmSync(resolve(REPO_ROOT, ".chapterflow/runs", bookId), { recursive: true, force: true });
    rmSync(orchestratorRoundDir(bookId, ROUND), { recursive: true, force: true });
    rmSync(resolve(PIPELINE_DIR, "state", "qc-orchestrator", bookId), { recursive: true, force: true });
    rmSync(keyPackDir(bookId, ROUND), { recursive: true, force: true });
    rmSync(resolve(PIPELINE_DIR, "state", "qc-packs", bookId), { recursive: true, force: true });
    rmSync(qcRoundPath(bookId, ROUND), { force: true });
    rmSync(sweepRecordPath(bookId), { force: true });
    rmSync(resolve(PIPELINE_DIR, "state", "indexes", `${bookId}.json`), { force: true });
    rmSync(resolve(PIPELINE_DIR, "state", "briefs", `${bookId}.manual-brief.json`), { force: true });
    rmSync(resolve(PIPELINE_DIR, "state", "shape-plans", `${bookId}.shape-plan.json`), { force: true });
    rmSync(resolve(PIPELINE_DIR, "state", "venue-plans", `${bookId}.venue-plan.json`), { force: true });
    rmSync(resolve(PIPELINE_DIR, "state", "exemplar-plans", `${bookId}.exemplar-plan.json`), { force: true });
    rmSync(resolve(PIPELINE_DIR, "state", "plans", `${bookId}-ch05.manual-plan.json`), { force: true });
    rmSync(attestationPath(bookId, SOURCE_CHAPTER_NUMBER), { force: true });
    rmSync(manualKeyJudgePath(bookId, SOURCE_CHAPTER_NUMBER), { force: true });
    rmSync(provenancePath(`${bookId}-ch${String(SOURCE_CHAPTER_NUMBER).padStart(2, "0")}`), { force: true });
    rmSync(sourceVerifyRecordPath(bookId), { force: true });
    rmSync(productionManifestSidecarPath(bookId), { force: true });
  }
}

function clonedChapter(bookId: string): ChapterV21 {
  const chapter = makeGateCleanChapter(bookId, SOURCE_CHAPTER_NUMBER);
  const nn = String(SOURCE_CHAPTER_NUMBER).padStart(2, "0");
  const factAnchor = `ch${nn}.fact.1`;
  const exampleAnchors = [
    `ch${nn}.ex.northstar-lab`,
    `ch${nn}.ex.harbor-clinic`,
    `ch${nn}.ex.atlas-foods`,
    `ch${nn}.ex.shah-onboarding`,
    `ch${nn}.ex.cedar-invoice`,
    `ch${nn}.ex.riverton-library`,
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
  for (let i = 0; i < chapter.examples.length; i++) {
    chapter.examples[i].sourceAnchorIds = [exampleAnchors[i]];
    chapter.examples[i].scenario = scenarios[i];
    (chapter.examples[i] as any).planSpec = {
      ...(chapter.examples[i] as any).planSpec,
      venue: `Fixture venue ${i + 1}`,
      exemplar: "",
    };
  }
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
  chapter.examples.forEach((_, i) => { effectiveAnchors[`examples[${i}]`] = [exampleAnchors[i]]; });
  chapter.quiz.questions.forEach((_, i) => { effectiveAnchors[`quiz.questions[${i}]`] = [factAnchor]; });
  chapter.reviewCards.forEach((card, i) => {
    effectiveAnchors[`reviewCards[${i}]`] = [factAnchor];
    card.sourceAnchorIds = [factAnchor];
  });
  chapter.implementationPlan.ifThenPlans.forEach((plan, i) => {
    effectiveAnchors[`implementationPlan.ifThenPlans[${i}]`] = [factAnchor];
    plan.sourceAnchorIds = [factAnchor];
  });
  chapter.memorableLines?.forEach((line, i) => {
    effectiveAnchors[`memorableLines[${i}]`] = [factAnchor];
    line.sourceAnchorIds = [factAnchor];
  });
  chapter.authoring = {
    schemaVersion: "chapter-authoring-v1",
    sourceAnchors: {
      schemaVersion: "chapter-source-anchor-map-v1",
      sourceHash: "sha256:publish-preflight-fixture",
      observedAnchorIds: [factAnchor, ...exampleAnchors],
      effectiveAnchors,
    },
  };
  return chapter;
}

function writeSourceSidecar(bookId: string): void {
  const chapter = clonedChapter(bookId);
  const sidecar = makeSourceV2SidecarFixture({ chapterNumber: SOURCE_CHAPTER_NUMBER, chapterTitle: chapter.title });
  sidecar.namedExamples = [
    ...(Array.isArray(sidecar.namedExamples) ? sidecar.namedExamples : []),
    {
      id: "ch05.ex.fixture-deliberation",
      label: "Fixture deliberation protocol",
      summary: "A synthetic fixture example that gives the source-v2 gate a third named example without changing the chapter text under test.",
      teachesWhat: "Stillness can be practiced as a deliberate pause before action.",
      hardSpecifics: ["Fixture deliberation", "deliberate pause", "response choice"],
      realWorld: false,
    },
    {
      id: "ch05.ex.shah-onboarding",
      label: "ch05 Shah onboarding owner",
      summary: "Shah's onboarding team reduced handoff errors by 41 percent after naming one owner.",
      teachesWhat: "A single owner keeps conflicting handoff records from becoming private instructions.",
      hardSpecifics: ["Shah", "41 percent", "one owner"],
      realWorld: false,
    },
    {
      id: "ch05.ex.cedar-invoice",
      label: "ch05 Cedar invoice pilot",
      summary: "The Cedar invoice pilot caught 6 duplicate invoices before the quarterly close on March 31.",
      teachesWhat: "An invoice check works while vendor context is still close enough to repair.",
      hardSpecifics: ["Cedar", "6 duplicate invoices", "March 31"],
      realWorld: false,
    },
    {
      id: "ch05.ex.riverton-library",
      label: "ch05 Riverton Library archive queue",
      summary: "Riverton Library moved archive requests from 5 inboxes into one Tuesday queue.",
      teachesWhat: "A shared queue preserves the audit path when requests would otherwise scatter.",
      hardSpecifics: ["Riverton Library", "5 inboxes", "Tuesday queue"],
      realWorld: false,
    },
  ];
  const runDir = resolve(REPO_ROOT, ".chapterflow/runs", bookId, RUN);
  writeResearchRunManifestFixture({ runDir, bookId, chapters: [{ number: SOURCE_CHAPTER_NUMBER, title: chapter.title }] });
  const dir = resolve(runDir, "sidecars/source");
  mkdirSync(dir, { recursive: true });
  writeFileSync(resolve(dir, `ch${String(SOURCE_CHAPTER_NUMBER).padStart(2, "0")}.source.json`), JSON.stringify(sidecar, null, 2), "utf8");
}

function writeBookState(bookId: string, chapter: ChapterV21): void {
  writeFixtureBook(STATE_CHAPTERS, [chapter]);
  writeSourceSidecar(bookId);
  recordAuthorProvenance(chapter.chapterId, AUTHOR_SESSION);
  const indexPath = resolve(PIPELINE_DIR, "state", "indexes", `${bookId}.json`);
  mkdirSync(dirname(indexPath), { recursive: true });
  writeFileSync(indexPath, JSON.stringify([{ chapterNumber: chapter.number, chapterId: chapter.chapterId, chapterTitle: chapter.title }], null, 2) + "\n", "utf8");
  const briefPath = resolve(PIPELINE_DIR, "state", "briefs", `${bookId}.manual-brief.json`);
  mkdirSync(dirname(briefPath), { recursive: true });
  writeFileSync(briefPath, JSON.stringify({ schemaVersion: "manual-book-brief-v1", bookId, title: "Publish Fixture", author: "Test Author" }, null, 2) + "\n", "utf8");
  const planPath = resolve(PIPELINE_DIR, "state", "plans", `${chapter.chapterId}.manual-plan.json`);
  mkdirSync(dirname(planPath), { recursive: true });
  writeFileSync(planPath, JSON.stringify({ schemaVersion: "manual-chapter-plan-v1", bookId, chapterId: chapter.chapterId, chapterNumber: chapter.number, title: chapter.title, coreMove: "Use the fixture signal." }, null, 2) + "\n", "utf8");
  const shapePath = resolve(PIPELINE_DIR, "state", "shape-plans", `${bookId}.shape-plan.json`);
  const venuePath = resolve(PIPELINE_DIR, "state", "venue-plans", `${bookId}.venue-plan.json`);
  const exemplarPath = resolve(PIPELINE_DIR, "state", "exemplar-plans", `${bookId}.exemplar-plan.json`);
  mkdirSync(dirname(shapePath), { recursive: true });
  mkdirSync(dirname(venuePath), { recursive: true });
  mkdirSync(dirname(exemplarPath), { recursive: true });
  writeFileSync(shapePath, JSON.stringify({ bookId, allocation: { [String(chapter.number)]: chapter.examples.map((ex: any) => ex.planSpec.format) } }, null, 2) + "\n", "utf8");
  writeFileSync(venuePath, JSON.stringify({ bookId, allocation: { [String(chapter.number)]: chapter.examples.map((ex: any) => ex.planSpec.venue) } }, null, 2) + "\n", "utf8");
  writeFileSync(exemplarPath, JSON.stringify({ bookId, allocation: { [String(chapter.number)]: { forbidden: [] } } }, null, 2) + "\n", "utf8");
}

function writeRoundRecord(bookId: string, chapter: ChapterV21): void {
  const path = roundRecordPath(bookId, ROUND);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify({
    schemaVersion: "qc-orchestrator-round-v1",
    bookId,
    roundId: ROUND,
    createdAt: "2026-06-13T00:00:00.000Z",
    chapters: [chapter.number],
    qcRoundFile: qcRoundPath(bookId, ROUND),
    preflight: {},
    taskCards: [],
  }, null, 2) + "\n", "utf8");
}

function sweepPassSubmission(bookId: string) {
  return {
    schemaVersion: "qc-sweep-submission-v1" as const,
    bookId,
    roundId: ROUND,
    role: "sweep" as const,
    reviewer: "codex-qc:publish-sweep",
    reviewerSessionId: SWEEP_SESSION,
    verdict: "PASS" as const,
    checkedFamilies: [...REQUIRED_SWEEP_FAMILIES],
    findings: [],
  };
}

function writeKeys(bookId: string, chapter: ChapterV21): void {
  writeKeyPacks(bookId, ROUND);
  for (const role of ["keyA", "keyB"] as const) {
    const pack = loadKeyPack(bookId, ROUND, chapter.number);
    assert.ok(pack, `missing key pack for ${chapter.chapterId}`);
    const factId = pack.sourceFacts[0]?.id;
    assert.ok(factId, "missing source fact");
    const rec: KeyDerivation = {
      schemaVersion: "manual-key-derive-v2",
      bookId,
      roundId: ROUND,
      role,
      reviewerSessionId: role === "keyA" ? "fixture-publish-keyA" : "fixture-publish-keyB",
      derivedAt: "2026-06-13T00:00:00.000Z",
      chapters: [{
        chapterNumber: chapter.number,
        chapterId: chapter.chapterId,
        packHash: pack.packHash,
        contentHash: pack.contentHash,
        sourceHash: pack.sourceHash,
        answers: chapter.quiz.questions.map((q, i) => ({
          questionIndex: i,
          choiceIndex: q.correctIndex,
          confidence: 0.97,
          reason: `The fixture source facts support the stored answer for question ${i + 1}; both readers independently agree.`,
          sourceFactIds: [factId],
        })),
      }],
    };
    writeFileSync(keyDerivationPath(bookId, ROUND, role), JSON.stringify(rec, null, 2) + "\n", "utf8");
  }
}

function writeBarConfirm(bookId: string, chapter: ChapterV21): void {
  const sourceHash = sourceHashFor(bookId, chapter.number);
  assert.ok(sourceHash, "missing source hash");
  const axes: AxisScore[] = (Object.keys(AXIS_WEIGHTS) as AxisId[])
    .filter((axis) => axis !== "quiz_key_correctness")
    .map((axis) => ({ axis, score: 0.94, tier: "PUBLISHABLE", hits: [] }));
  writeBarReadArtifact({
    schemaVersion: "qc-bar-read-v2",
    bookId,
    roundId: ROUND,
    role: "bar",
    reviewer: "codex-qc:publish-bar",
    reviewerSessionId: BAR_SESSION,
    chapterNumber: chapter.number,
    chapterId: chapter.chapterId,
    contentHash: chapterContentHash(chapter),
    sourceHash,
    axes,
    notes: "Fixture publish bar read.",
    verdict: computeVerdict(chapter.chapterId, axes, true),
  });
  writeConfirmReadArtifact({
    schemaVersion: "qc-confirm-read-v1",
    bookId,
    roundId: ROUND,
    role: "confirm",
    reviewer: "codex-qc:publish-confirm",
    reviewerSessionId: CONFIRM_SESSION,
    chapterNumber: chapter.number,
    chapterId: chapter.chapterId,
    contentHash: chapterContentHash(chapter),
    decision: "PUBLISHABLE",
    reason: "Independent fixture confirm read agrees that the chapter is publishable.",
    findings: [],
  });
}

// I3 regression: the publish self-test gate must run HERMETIC. The old code spread process.env and
// deleted only 2 strict vars, so REQUIRE_KEYJUDGE / ENFORCE_MAJORS / STATE_DIR leaked in and could
// nondeterministically block an otherwise-converged publish (the flake hit during the dopamine run).
// hermeticSelfTestEnv strips EVERY CHAPTERFLOW_* flag and forces only no-api. This guards that strip
// (it FAILS if reverted to the 2-var denylist — the keyjudge/majors/state-dir keys would survive).
test("hermeticSelfTestEnv strips every CHAPTERFLOW_* operator flag and forces only no-api (I3)", () => {
  const env = hermeticSelfTestEnv({
    PATH: "/usr/bin:/bin", HOME: "/home/x", LANG: "en_US.UTF-8", NODE_ENV: "test",
    CHAPTERFLOW_REQUIRE_SOURCE_VERIFY: "1", CHAPTERFLOW_ENFORCE_SESSION_INDEPENDENCE: "1",
    CHAPTERFLOW_REQUIRE_KEYJUDGE: "1", CHAPTERFLOW_ENFORCE_MAJORS: "1",
    CHAPTERFLOW_STATE_DIR: "/elsewhere", CHAPTERFLOW_SESSION_ID: "leak-me",
  });
  assert.equal(env.CHAPTERFLOW_NO_API_CODEX_QC, "1", "no-api mode forced on for the slice");
  for (const k of ["CHAPTERFLOW_REQUIRE_SOURCE_VERIFY", "CHAPTERFLOW_ENFORCE_SESSION_INDEPENDENCE", "CHAPTERFLOW_REQUIRE_KEYJUDGE", "CHAPTERFLOW_ENFORCE_MAJORS", "CHAPTERFLOW_STATE_DIR", "CHAPTERFLOW_SESSION_ID"]) {
    assert.equal(env[k], undefined, `${k} must be stripped so a real-book operator flag cannot block the synthetic fixture slice`);
  }
  assert.equal(env.PATH, "/usr/bin:/bin", "non-CHAPTERFLOW env preserved so npx/tsx still run");
  assert.equal(env.HOME, "/home/x");
  assert.equal(env.LANG, "en_US.UTF-8");
});

function setupGreen(bookId: string): void {
  const chapter = clonedChapter(bookId);
  writeBookState(bookId, chapter);
  // Source-reality is an always-on production invariant: this source-v2 fixture publishes only
  // with a valid VERIFIED source-verify record covering every sidecar item (no env var involved).
  writeVerifiedSourceVerifyRecord(bookId);
  openQcRound(bookId, ROUND);
  writeRoundRecord(bookId, chapter);
  writeKeys(bookId, chapter);
  writeSweepRecordFromSubmission(sweepPassSubmission(bookId));
  writeBarConfirm(bookId, chapter);
  writeAttestation({
    schemaVersion: "qc-attest-v1",
    bookId,
    chapterNumber: chapter.number,
    chapterId: chapter.chapterId,
    verdict: "PUBLISHABLE",
    contentHash: chapterContentHash(chapter),
    hashVersion: "v2",
    reviewer: "codex-qc:publish-confirm",
    reviewerSessionId: ATTEST_SESSION,
    reviewedAt: "2026-06-13T00:00:00.000Z",
    roundId: ROUND,
    roundRole: "confirm",
    dimensions: {
      keysCorrect: true,
      grounded: true,
      examplesDistinct: true,
      noCorruption: true,
      pedagogicallyUseful: true,
    },
    evidence: {
      orchestratorRoundId: ROUND,
      manualKeyJudgePath: manualKeyJudgePath(bookId, chapter.number),
      sweepPath: sweepRecordPath(bookId),
      repairLedgerPath: repairLedgerPath(bookId, ROUND),
    },
    findings: [],
    notes: "Synthetic publish-after-qc all-green fixture attestation.",
  });
}

function appendOpenLedgerFinding(bookId: string): void {
  const p = repairLedgerPath(bookId, ROUND);
  mkdirSync(dirname(p), { recursive: true });
  appendFileSync(p, JSON.stringify({
    schemaVersion: "qc-repair-ledger-event-v1",
    event: "finding",
    findingId: "qcf-publish-open",
    bookId,
    roundId: ROUND,
    chapterNumber: SOURCE_CHAPTER_NUMBER,
    unitId: "examples[0]",
    repairClass: "example_coherence",
    severity: "major",
    quote: "fixture quote",
    problem: "fixture open finding",
    expectedFix: "close the fixture finding",
    globalTheme: "example_coherence",
    status: "open",
    sources: [{ sourceRole: "finalizer", submissionFile: "evidence-matrix.json", observedAt: "2026-06-13T00:00:00.000Z" }],
    createdAt: "2026-06-13T00:00:00.000Z",
  }) + "\n", "utf8");
}

test("publish-after-qc fails when CHAPTERFLOW_NO_API_CODEX_QC is missing", () => {
  const prev = process.env.CHAPTERFLOW_NO_API_CODEX_QC;
  try {
    delete process.env.CHAPTERFLOW_NO_API_CODEX_QC;
    const result = publishAfterQc({ input: "missing-book", roundId: ROUND, dryRun: true });
    assert.equal(result.ok, false);
    assert.match(result.errors.join("\n"), /CHAPTERFLOW_NO_API_CODEX_QC=1/);
  } finally {
    if (prev === undefined) delete process.env.CHAPTERFLOW_NO_API_CODEX_QC;
    else process.env.CHAPTERFLOW_NO_API_CODEX_QC = prev;
  }
});

test("publish-after-qc fails on missing book or missing round before publish", () => {
  const prev = process.env.CHAPTERFLOW_NO_API_CODEX_QC;
  try {
    process.env.CHAPTERFLOW_NO_API_CODEX_QC = "1";
    let result = publishAfterQc({ input: "definitely missing publish fixture", roundId: ROUND, dryRun: true });
    assert.equal(result.ok, false);
    assert.match(result.errors.join("\n"), /Could not find a book/);
    cleanup([INCOMPLETE_BOOK]);
    writeBookState(INCOMPLETE_BOOK, clonedChapter(INCOMPLETE_BOOK));
    result = publishAfterQc({ input: INCOMPLETE_BOOK, roundId: ROUND, dryRun: true });
    assert.equal(result.ok, false);
    assert.match(result.errors.join("\n"), /Missing QC round/);
  } finally {
    if (prev === undefined) delete process.env.CHAPTERFLOW_NO_API_CODEX_QC;
    else process.env.CHAPTERFLOW_NO_API_CODEX_QC = prev;
    cleanup([INCOMPLETE_BOOK]);
  }
});

test("publish-after-qc blocks incomplete QC and reports repair prompt resume path", () => {
  const prev = process.env.CHAPTERFLOW_NO_API_CODEX_QC;
  try {
    process.env.CHAPTERFLOW_NO_API_CODEX_QC = "1";
    cleanup([INCOMPLETE_BOOK]);
    const chapter = clonedChapter(INCOMPLETE_BOOK);
    writeBookState(INCOMPLETE_BOOK, chapter);
    openQcRound(INCOMPLETE_BOOK, ROUND);
    writeRoundRecord(INCOMPLETE_BOOK, chapter);
    const result = publishAfterQc({ input: INCOMPLETE_BOOK, roundId: ROUND, title: "Publish Fixture", author: "Test Author", dryRun: true });
    assert.equal(result.ok, false);
    assert.match(result.errors.join("\n"), /QC is incomplete|not all-green/);
    assert.ok(result.next?.some((line) => line.includes("repair prompt:")));
  } finally {
    if (prev === undefined) delete process.env.CHAPTERFLOW_NO_API_CODEX_QC;
    else process.env.CHAPTERFLOW_NO_API_CODEX_QC = prev;
    cleanup([INCOMPLETE_BOOK]);
  }
});

test("publish-after-qc blocks REVISE evidence and prints repair prompt path", () => {
  const prev = process.env.CHAPTERFLOW_NO_API_CODEX_QC;
  try {
    process.env.CHAPTERFLOW_NO_API_CODEX_QC = "1";
    cleanup([REVISE_BOOK]);
    setupGreen(REVISE_BOOK);
    appendOpenLedgerFinding(REVISE_BOOK);
    const result = publishAfterQc({ input: REVISE_BOOK, roundId: ROUND, title: "Publish Fixture", author: "Test Author", dryRun: true });
    assert.equal(result.ok, false);
    assert.match(result.errors.join("\n"), /REVISE|repairRequired=true|repair-ledger/);
    assert.ok(result.next?.some((line) => line.includes("repair prompt:")));
  } finally {
    if (prev === undefined) delete process.env.CHAPTERFLOW_NO_API_CODEX_QC;
    else process.env.CHAPTERFLOW_NO_API_CODEX_QC = prev;
    cleanup([REVISE_BOOK]);
  }
});

test("formatPreflightChecklist marks passed checks ✓ and failed checks ✗ with a count", () => {
  const out = formatPreflightChecklist([
    { check: "source-v2", blockers: [] },
    { check: "sweep", blockers: ["sweep BP30: ...", "sweep BP31: ..."] },
    { check: "majors", blockers: [] },
  ]);
  assert.match(out, /2\/3 checks passed/);
  assert.match(out, /✓ source-v2/);
  assert.match(out, /✗ sweep \(2 blocker\(s\)\)/);
  assert.match(out, /✓ majors/);
});

test("publish-after-qc rejects ambient all-green legacy state without dry-run mutations", () => {
  const prev = process.env.CHAPTERFLOW_NO_API_CODEX_QC;
  // This fixture ships a real VERIFIED source-verify record (setupGreen), so source-reality
  // resolves required-and-verified regardless of CHAPTERFLOW_REQUIRE_SOURCE_VERIFY — the strip
  // below only keeps the assertion hermetic against an ambient strict env from the host shell.
  const prevSV = process.env.CHAPTERFLOW_REQUIRE_SOURCE_VERIFY;
  try {
    process.env.CHAPTERFLOW_NO_API_CODEX_QC = "1";
    delete process.env.CHAPTERFLOW_REQUIRE_SOURCE_VERIFY;
    cleanup([GREEN_BOOK]);
    setupGreen(GREEN_BOOK);
    const pkgPath = resolve(REPO_ROOT, "book-packages", `${GREEN_BOOK}.v21.json`);
    const sidecarPath = productionManifestSidecarPath(GREEN_BOOK);
    const transactionsPath = resolve(PIPELINE_DIR, "state", "books", "_transactions");
    const transactionNames = () => {
      try {
        return readdirSync(transactionsPath).filter((name) => name.startsWith(`${GREEN_BOOK}.`)).sort();
      } catch {
        return [];
      }
    };
    const watched = [
      attestationPath(GREEN_BOOK, SOURCE_CHAPTER_NUMBER),
      qcRoundPath(GREEN_BOOK, ROUND),
      roundRecordPath(GREEN_BOOK, ROUND),
      sweepRecordPath(GREEN_BOOK),
      repairLedgerPath(GREEN_BOOK, ROUND),
    ];
    const snapshot = () => watched.map((path) => existsSync(path) ? readFileSync(path, "utf8") : null);
    rmSync(pkgPath, { force: true });
    rmSync(sidecarPath, { force: true });
    const before = snapshot();
    const transactionsBefore = transactionNames();
    const result = publishAfterQc({ input: GREEN_BOOK, roundId: ROUND, title: "Publish Fixture", author: "Test Author", dryRun: true });
    assert.equal(result.ok, false, "ambient legacy files cannot authorize V4 release");
    assert.match(result.errors.join("\n"), /QC0\.missing_attestation/);
    assert.match(result.errors.join("\n"), /BOOK_PATTERN_AUDIT_UNBOUND/);
    assert.equal(existsSync(pkgPath), false, "blocked dry-run must not promote a package");
    assert.equal(existsSync(sidecarPath), false, "blocked dry-run must not write a manifest sidecar");
    assert.deepEqual(transactionNames(), transactionsBefore, "blocked dry-run must not create or reap promotion transactions");
    assert.deepEqual(snapshot(), before, "blocked dry-run preflight must not mutate ambient QC evidence");
  } finally {
    if (prev === undefined) delete process.env.CHAPTERFLOW_NO_API_CODEX_QC;
    else process.env.CHAPTERFLOW_NO_API_CODEX_QC = prev;
    if (prevSV === undefined) delete process.env.CHAPTERFLOW_REQUIRE_SOURCE_VERIFY;
    else process.env.CHAPTERFLOW_REQUIRE_SOURCE_VERIFY = prevSV;
    cleanup([GREEN_BOOK]);
  }
});
