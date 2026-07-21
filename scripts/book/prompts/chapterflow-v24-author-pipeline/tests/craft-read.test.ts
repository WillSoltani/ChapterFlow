/**
 * F6b — the CRAFT READ (the fifth semantic QC read). Covers:
 *   - qc-craft-read-v1 schema validation (missing axis rejected, below-floor needs a hit, dupes)
 *   - computeCraftVerdict tier boundaries (0.59 axis → YELLOW; overall 74 → YELLOW; all-good → GREEN)
 *   - OFF mode is byte-identical: no craftRead column, no craft detail, verdict unchanged
 *   - SHADOW mode changes NO finalize verdict (a green book stays PUBLISHABLE with a YELLOW craft read)
 *   - the evidence matrix surfaces the (non-gating) craft column in shadow
 *   - ENFORCE mode flips a below-floor craft chapter PUBLISHABLE → REVISE (never CORRUPTION)
 *   - QC-CODEX-SESSION.md carries the craft section (doc-vs-code drift guard)
 *
 * The green-evidence scaffold is copied from qc-finalize-evidence.test.ts (a fully PUBLISHABLE
 * fixture chapter) so the craft integration can be exercised against a real finalize.
 */

import assert from "node:assert/strict";
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "fs";
import { dirname, resolve } from "path";

import { test } from "./harness.js";
import { PIPELINE_DIR, STATE_CHAPTERS, makeGateCleanChapter, makeSourceV2SidecarFixture, writeFixtureBook, writeResearchRunManifestFixture } from "./helpers.js";
import { attestationPath, chapterContentHash } from "../src/critics/qcAttestation.js";
import { parseBookPatternAuditReport, runBookPatternAudit } from "../src/critics/bookPatternAudit.js";
import { AXIS_WEIGHTS, computeVerdict, type AxisId, type AxisScore } from "../src/critics/semantic/publishableBar.js";
import { computeCraftVerdict, CRAFT_AXIS_WEIGHTS, type CraftAxisId, type CraftAxisScore } from "../src/critics/semantic/craftBar.js";
import { REPO_ROOT } from "../src/lib/chapterPaths.js";
import type { ChapterV21 } from "../src/types.js";
import { keyDerivationPath, keyPackDir, loadKeyPack, manualKeyJudgePath, writeKeyPacks, type KeyDerivation } from "../src/qc/manualKeyJudge.js";
import { waiverPath } from "../src/qc/majorDisposition.js";
import { openQcRound, qcRoundPath } from "../src/qc/qcRound.js";
import {
  craftArtifactPath,
  evidenceMatrixPath,
  loadCraftReadArtifact,
  roundRecordPath,
  writeBarReadArtifact,
  writeConfirmReadArtifact,
  writeCraftReadArtifact,
} from "../src/qc/orchestrator/artifacts.js";
import { finalizeQcRound } from "../src/qc/orchestrator/finalize.js";
import { validateSubmission, type ValidatedCraftReadSubmission } from "../src/qc/orchestrator/schemas.js";
import { sourceHashFor } from "../src/qc/sourceV2Gate.js";
import { chapterClearsPath, REQUIRED_SWEEP_FAMILIES, sweepHistoryPath, sweepRecordPath, writeSweepRecordFromSubmission } from "../src/qc/sweep.js";
import { provenancePath, recordAuthorProvenance } from "../src/qc/sessionProvenance.js";

const BOOK = "zz-fixture-craft-read";
const ROUND = "r-craft";
const RUN = "20260612T000000Z";
const CH = 5;
const AUTHOR_SESSION = "fixture-craft-author";
const SWEEP_SESSION = "fixture-craft-sweep";
const BAR_SESSION = "fixture-craft-bar";
const CONFIRM_SESSION = "fixture-craft-confirm";
const FINALIZER_SESSION = "fixture-craft-finalizer";

const CRAFT_AXES = Object.keys(CRAFT_AXIS_WEIGHTS) as CraftAxisId[];
const GROUNDED_QUOTE = "A good handoff starts with one visible source.";

function withEnv<T>(vars: Record<string, string | undefined>, fn: () => T): T {
  const prev: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(vars)) {
    prev[k] = process.env[k];
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  try {
    return fn();
  } finally {
    for (const [k, v] of Object.entries(prev)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }
}

function cleanup(): void {
  mkdirSync(STATE_CHAPTERS, { recursive: true });
  for (const f of readdirSync(STATE_CHAPTERS)) {
    if (f.startsWith(`${BOOK}-ch`)) rmSync(resolve(STATE_CHAPTERS, f), { force: true });
  }
  rmSync(resolve(REPO_ROOT, ".chapterflow/runs", BOOK), { recursive: true, force: true });
  rmSync(resolve(PIPELINE_DIR, "state", "qc-orchestrator", BOOK), { recursive: true, force: true });
  rmSync(keyPackDir(BOOK, ROUND), { recursive: true, force: true });
  rmSync(dirname(keyPackDir(BOOK, ROUND)), { recursive: true, force: true });
  rmSync(qcRoundPath(BOOK, ROUND), { force: true });
  rmSync(waiverPath(BOOK), { force: true });
  rmSync(sweepHistoryPath(BOOK), { force: true });
  rmSync(chapterClearsPath(BOOK), { force: true });
  rmSync(sweepRecordPath(BOOK), { force: true });
  rmSync(resolve(PIPELINE_DIR, "state", "briefs", `${BOOK}.manual-brief.json`), { force: true });
  for (const n of [CH]) {
    rmSync(attestationPath(BOOK, n), { force: true });
    rmSync(manualKeyJudgePath(BOOK, n), { force: true });
    rmSync(provenancePath(`${BOOK}-ch${String(n).padStart(2, "0")}`), { force: true });
    rmSync(resolve(PIPELINE_DIR, "state", "plans", `${BOOK}-ch${String(n).padStart(2, "0")}.manual-plan.json`), { force: true });
  }
}

// ── Green-evidence scaffold (copied from qc-finalize-evidence.test.ts) ──────────
function clonedCleanChapter(): ChapterV21 {
  const chapter = makeGateCleanChapter(BOOK, CH);
  const nn = String(CH).padStart(2, "0");
  const factAnchor = `ch${nn}.fact.1`;
  const exampleAnchors = [
    `ch${nn}.ex.northstar-lab`, `ch${nn}.ex.harbor-clinic`, `ch${nn}.ex.atlas-foods`,
    `ch${nn}.ex.shah-onboarding`, `ch${nn}.ex.cedar-invoice`, `ch${nn}.ex.riverton-library`,
  ];
  chapter.counterintuition = "Unit 5 restraint works because the original viola context has not gone stale.";
  chapter.breakdown.fastRead = [
    GROUNDED_QUOTE,
    "The owner checks the live record before the next team uses it.",
    "If the record and source disagree, the work pauses.",
    "The fix is small because the evidence is still nearby.",
    "Northstar Lab shows the pattern in a support queue.",
    "Harbor Clinic shows it in consent forms.",
    "Atlas Foods shows it before a launch.",
    "The useful habit is simple: stop, compare, assign, repair, and then restart.",
  ].join(" ");
  while (chapter.breakdown.fastRead.length < 430) {
    chapter.breakdown.fastRead += " A short source check keeps one bad record from becoming a wider promise.";
  }
  const memorableLines = chapter.memorableLines ?? [];
  chapter.memorableLines = memorableLines;
  memorableLines[0] = { ...memorableLines[0], text: GROUNDED_QUOTE, location: "fastRead" };
  const scenarios = [
    "On Monday morning at Northstar Lab's intake desk, Rina sees that the support ticket count no longer matches the May 2026 source note. She pauses the queue, checks the 37 to 12 audit record, and fixes the entry before another team uses it.",
    "At Harbor Clinic before Friday discharge, Quin finds 18 forms missing from the signed consent packet. He compares the consent list with the source note and keeps the discharge review from moving on a guessed count.",
    "During Atlas Foods' June 2026 launch review at the warehouse dock, Bria is the operations manager reviewing a cold-chain sensor note that conflicts with the release label. The team delays the shipment by 9 days, traces the failed device, and repairs the batch record before product leaves.",
    "In Shah's onboarding room at 9:00 a.m., Soren is the training lead reading two handoff sheets that name different owners. She checks the source note, names one owner, and keeps the new hire from following a private version.",
    "At the Cedar invoice pilot before quarterly close, Ivo catches 6 duplicate invoices in the source packet. He restores the vendor context and assigns the follow-up before the summary is approved.",
    "Inside Riverton Library's Tuesday archive queue, Yara finds requests split across 5 inboxes. The group chooses the source queue, links the evidence, and blocks the scattered histories from becoming policy.",
  ];
  chapter.examples = chapter.examples.map((example, i) => ({ ...example, sourceAnchorIds: [exampleAnchors[i]], scenario: scenarios[i] }));
  const effectiveAnchors: Record<string, string[]> = {
    hook: [factAnchor], counterintuition: [factAnchor],
    "breakdown.fastRead": [factAnchor], "breakdown.deepRead": [factAnchor], "breakdown.fullRead": [factAnchor],
    keyTakeaway: [factAnchor], tryThisNow: [factAnchor],
    "implementationPlan.title": [factAnchor], "implementationPlan.coreSkill": [factAnchor],
    "implementationPlan.twentyFourHourChallenge": [factAnchor], "implementationPlan.weeklyPractice": [factAnchor],
  };
  chapter.examples.forEach((_, i) => { effectiveAnchors[`examples[${i}]`] = [exampleAnchors[i]]; });
  chapter.quiz.questions.forEach((_, i) => { effectiveAnchors[`quiz.questions[${i}]`] = [factAnchor]; });
  chapter.reviewCards.forEach((card, i) => { effectiveAnchors[`reviewCards[${i}]`] = [factAnchor]; card.sourceAnchorIds = [factAnchor]; });
  chapter.implementationPlan.ifThenPlans.forEach((plan, i) => { effectiveAnchors[`implementationPlan.ifThenPlans[${i}]`] = [factAnchor]; plan.sourceAnchorIds = [factAnchor]; });
  chapter.memorableLines?.forEach((line, i) => { effectiveAnchors[`memorableLines[${i}]`] = [factAnchor]; line.sourceAnchorIds = [factAnchor]; });
  chapter.authoring = {
    ...chapter.authoring,
    schemaVersion: "chapter-authoring-v1",
    sourceAnchors: {
      schemaVersion: "chapter-source-anchor-map-v1",
      sourceHash: "sha256:synthetic-source-fixture",
      observedAnchorIds: [factAnchor, ...exampleAnchors],
      effectiveAnchors,
    },
  };
  return chapter;
}

function writeClonedSourceSidecar(): void {
  const chapter = clonedCleanChapter();
  const sidecar = makeSourceV2SidecarFixture({ chapterNumber: CH, chapterTitle: chapter.title });
  sidecar.namedExamples = [
    ...sidecar.namedExamples,
    { id: "ch05.ex.shah-onboarding", label: "ch05 Shah onboarding owner", summary: "Shah's onboarding team reduced handoff errors by 41 percent after naming one owner.", teachesWhat: "A single owner keeps conflicting handoff records from becoming private instructions.", hardSpecifics: ["Shah", "41 percent", "one owner"], realWorld: false },
    { id: "ch05.ex.cedar-invoice", label: "ch05 Cedar invoice pilot", summary: "The Cedar invoice pilot caught 6 duplicate invoices before the quarterly close on March 31.", teachesWhat: "An invoice check works while vendor context is still close enough to repair.", hardSpecifics: ["Cedar", "6 duplicate invoices", "March 31"], realWorld: false },
    { id: "ch05.ex.riverton-library", label: "ch05 Riverton Library archive queue", summary: "Riverton Library moved archive requests from 5 inboxes into one Tuesday queue.", teachesWhat: "A shared queue preserves the audit path when requests would otherwise scatter.", hardSpecifics: ["Riverton Library", "5 inboxes", "Tuesday queue"], realWorld: false },
  ];
  const runDir = resolve(REPO_ROOT, ".chapterflow/runs", BOOK, RUN);
  writeResearchRunManifestFixture({ runDir, bookId: BOOK, chapters: [{ number: CH, title: chapter.title }] });
  const dir = resolve(runDir, "sidecars/source");
  mkdirSync(dir, { recursive: true });
  writeFileSync(resolve(dir, `ch${String(CH).padStart(2, "0")}.source.json`), JSON.stringify(sidecar, null, 2), "utf8");
}

function writeRoundRecord(chapters: ChapterV21[]): void {
  const path = roundRecordPath(BOOK, ROUND);
  mkdirSync(dirname(path), { recursive: true });
  const patternAudit = parseBookPatternAuditReport(runBookPatternAudit({
    bookId: BOOK,
    chapters,
    stateDir: resolve(PIPELINE_DIR, "state"),
  }), { bookId: BOOK, chapterCount: chapters.length });
  writeFileSync(path, JSON.stringify({
    schemaVersion: "qc-orchestrator-round-v1", bookId: BOOK, roundId: ROUND, createdAt: "2026-06-12T00:00:00.000Z",
    chapters: chapters.map((ch) => ch.number), qcRoundFile: qcRoundPath(BOOK, ROUND),
    preflight: { sourceV2Gate: { passed: true, findings: 0 }, bookGate: { passed: true, findings: 0 }, keyPack: { paths: [] }, sweepPack: {}, barPack: { errors: [] } },
    taskCards: [],
    chapterContentHashes: Object.fromEntries(chapters.map((ch) => [String(ch.number), chapterContentHash(ch)])),
    patternAudit,
  }, null, 2) + "\n", "utf8");
}

function writePlanningArtifacts(chapters: ChapterV21[]): void {
  const briefPath = resolve(PIPELINE_DIR, "state", "briefs", `${BOOK}.manual-brief.json`);
  mkdirSync(dirname(briefPath), { recursive: true });
  writeFileSync(briefPath, JSON.stringify({ schemaVersion: "manual-book-brief-v1", bookId: BOOK, title: "Craft Fixture", audience: "test readers", corePromise: "Slow the first decision until the evidence is visible." }, null, 2) + "\n", "utf8");
  for (const chapter of chapters) {
    const planPath = resolve(PIPELINE_DIR, "state", "plans", `${chapter.chapterId}.manual-plan.json`);
    mkdirSync(dirname(planPath), { recursive: true });
    writeFileSync(planPath, JSON.stringify({ schemaVersion: "manual-chapter-plan-v1", bookId: BOOK, chapterId: chapter.chapterId, chapterNumber: chapter.number, title: chapter.title, coreMove: "Pause the handoff, inspect the current signal, and decide from evidence." }, null, 2) + "\n", "utf8");
  }
}

function sweepPassSubmission() {
  return { schemaVersion: "qc-sweep-submission-v1" as const, bookId: BOOK, roundId: ROUND, role: "sweep" as const, reviewer: "codex-qc:sweep-fixture", reviewerSessionId: SWEEP_SESSION, verdict: "PASS" as const, checkedFamilies: [...REQUIRED_SWEEP_FAMILIES], findings: [] };
}

function writeKeyDerivations(chapters: ChapterV21[]): void {
  writeKeyPacks(BOOK, ROUND);
  for (const role of ["keyA", "keyB"] as const) {
    const rec: KeyDerivation = {
      schemaVersion: "manual-key-derive-v2", bookId: BOOK, roundId: ROUND, role,
      reviewerSessionId: role === "keyA" ? "fixture-keyA-session" : "fixture-keyB-session", derivedAt: "2026-06-12T00:00:00.000Z",
      chapters: chapters.map((chapter) => {
        const pack = loadKeyPack(BOOK, ROUND, chapter.number);
        assert.ok(pack, `missing key pack for ch${chapter.number}`);
        const factId = pack.sourceFacts[0]?.id;
        assert.ok(factId, `missing source fact for ch${chapter.number}`);
        return {
          chapterNumber: chapter.number, chapterId: chapter.chapterId, packHash: pack.packHash, contentHash: pack.contentHash, sourceHash: pack.sourceHash,
          answers: chapter.quiz.questions.map((q, i) => ({ questionIndex: i, choiceIndex: q.correctIndex, confidence: 0.96, reason: `The fixture sidecar fact supports the stored answer for question ${i + 1}, and both readers cite it.`, sourceFactIds: [factId] })),
        };
      }),
    };
    writeFileSync(keyDerivationPath(BOOK, ROUND, role), JSON.stringify(rec, null, 2) + "\n", "utf8");
  }
}

function writeBarAndConfirm(chapters: ChapterV21[]): void {
  for (const chapter of chapters) {
    const contentHash = chapterContentHash(chapter);
    const sourceHash = sourceHashFor(BOOK, chapter.number);
    assert.ok(sourceHash, `missing source hash for ch${chapter.number}`);
    const axes: AxisScore[] = (Object.keys(AXIS_WEIGHTS) as AxisId[]).filter((axis) => axis !== "quiz_key_correctness").map((axis) => ({ axis, score: 0.94, tier: "PUBLISHABLE", hits: [] }));
    writeBarReadArtifact({ schemaVersion: "qc-bar-read-v2", bookId: BOOK, roundId: ROUND, role: "bar", reviewer: "codex-qc:bar-fixture", reviewerSessionId: BAR_SESSION, chapterNumber: chapter.number, chapterId: chapter.chapterId, contentHash, sourceHash, axes, notes: "Fixture bar read: every non-key axis publishable.", verdict: computeVerdict(chapter.chapterId, axes, true) });
    writeConfirmReadArtifact({ schemaVersion: "qc-confirm-read-v1", bookId: BOOK, roundId: ROUND, role: "confirm", reviewer: "codex-qc:confirm-fixture", reviewerSessionId: CONFIRM_SESSION, chapterNumber: chapter.number, chapterId: chapter.chapterId, contentHash, decision: "PUBLISHABLE", reason: "Independent confirm read agrees the chapter is publishable for this fixture.", findings: [] });
  }
}

function setupGreenEvidence(chapters: ChapterV21[]): void {
  writeFixtureBook(STATE_CHAPTERS, chapters);
  for (const chapter of chapters) recordAuthorProvenance(chapter.chapterId, AUTHOR_SESSION);
  writeClonedSourceSidecar();
  writePlanningArtifacts(chapters);
  openQcRound(BOOK, ROUND);
  writeRoundRecord(chapters);
  writeKeyDerivations(chapters);
  writeSweepRecordFromSubmission(sweepPassSubmission());
  writeBarAndConfirm(chapters);
}

/** Write a craft-read artifact for the fixture chapter. `yellow` puts summaries_depth below the
 *  0.6 axis floor with a chapter-grounded cited hit (so it survives finalize's fabrication guard). */
function writeCraft(chapter: ChapterV21, yellow: boolean): void {
  const axes: CraftAxisScore[] = CRAFT_AXES.map((axis) => {
    if (yellow && axis === "summaries_depth") {
      return { axis, score: 0.5, hits: [{ unitId: "fastRead", quote: GROUNDED_QUOTE, defect: "the fast read pads one idea and the deep read only restates it", fix: "Distill the fast read to the core claim and add new information at each deeper tier." }] };
    }
    return { axis, score: 0.9, hits: [] };
  });
  const submission: ValidatedCraftReadSubmission = {
    schemaVersion: "qc-craft-read-v1", bookId: BOOK, roundId: ROUND, role: "craft",
    reviewer: "codex-qc:craft-fixture", reviewerSessionId: "fixture-craft-session",
    chapterNumber: chapter.number, chapterId: chapter.chapterId, contentHash: chapterContentHash(chapter),
    sourceHash: sourceHashFor(BOOK, chapter.number) ?? null, notes: "Fixture craft read.",
    axes, verdict: computeCraftVerdict(chapter.chapterId, axes, true),
  };
  writeCraftReadArtifact(submission);
}

function finalizeMode(mode: string | undefined) {
  return withEnv({ CHAPTERFLOW_SESSION_ID: FINALIZER_SESSION, CHAPTERFLOW_CRAFT_READ: mode }, () => finalizeQcRound(BOOK, ROUND, { chapters: [CH], attest: false }));
}

// ── Pure unit tests ─────────────────────────────────────────────────────────────
test("qc-craft-read-v1: a valid five-axis submission passes validateSubmission", () => {
  const axes = CRAFT_AXES.map((axis) => ({ axis, score: 0.9, hits: [] }));
  const raw = { schemaVersion: "qc-craft-read-v1", bookId: "b", roundId: "r", role: "craft", reviewer: "codex-qc:r:craft:ch01", chapterNumber: 1, chapterId: "b-ch01", contentHash: "h", axes };
  const v = validateSubmission("b", "r", "craft", raw);
  assert.equal(v.ok, true, `valid craft rejected: ${"errors" in v ? v.errors.join("; ") : ""}`);
});

test("qc-craft-read-v1: a missing axis is rejected", () => {
  const axes = CRAFT_AXES.slice(1).map((axis) => ({ axis, score: 0.9, hits: [] }));
  const raw = { schemaVersion: "qc-craft-read-v1", bookId: "b", roundId: "r", role: "craft", reviewer: "codex-qc:r:craft:ch01", chapterNumber: 1, chapterId: "b-ch01", contentHash: "h", axes };
  const v = validateSubmission("b", "r", "craft", raw);
  assert.equal(v.ok, false);
  assert.ok("errors" in v && v.errors.some((e) => /missing axis summaries_depth/.test(e)), JSON.stringify(v));
});

test("qc-craft-read-v1: a below-0.6 axis without a cited hit is rejected; a dup axis is rejected", () => {
  const noHit = CRAFT_AXES.map((axis) => ({ axis, score: axis === "idea_density" ? 0.4 : 0.9, hits: [] }));
  const v1 = validateSubmission("b", "r", "craft", { schemaVersion: "qc-craft-read-v1", bookId: "b", roundId: "r", role: "craft", reviewer: "codex-qc:r:craft:ch01", chapterNumber: 1, chapterId: "b-ch01", contentHash: "h", axes: noHit });
  assert.equal(v1.ok, false);
  assert.ok("errors" in v1 && v1.errors.some((e) => /score < 0\.6 requires at least one cited hit/.test(e)), JSON.stringify(v1));
  const dup = [...CRAFT_AXES, "idea_density"].map((axis) => ({ axis, score: 0.9, hits: [] }));
  const v2 = validateSubmission("b", "r", "craft", { schemaVersion: "qc-craft-read-v1", bookId: "b", roundId: "r", role: "craft", reviewer: "codex-qc:r:craft:ch01", chapterNumber: 1, chapterId: "b-ch01", contentHash: "h", axes: dup });
  assert.equal(v2.ok, false);
  assert.ok("errors" in v2 && v2.errors.some((e) => /duplicate axis idea_density/.test(e)), JSON.stringify(v2));
});

test("computeCraftVerdict: tier boundaries (0.59 axis → YELLOW; overall 74 → YELLOW; all-good → GREEN)", () => {
  const belowAxis: CraftAxisScore[] = CRAFT_AXES.map((axis) => ({ axis, score: axis === "summaries_depth" ? 0.59 : 1.0, hits: [] }));
  assert.equal(computeCraftVerdict("c", belowAxis).gate, "YELLOW", "an axis below 0.6 must cap at YELLOW even with a high overall");
  const lowOverall: CraftAxisScore[] = CRAFT_AXES.map((axis) => ({ axis, score: 0.74, hits: [] }));
  const lo = computeCraftVerdict("c", lowOverall);
  assert.equal(lo.overall, 74);
  assert.equal(lo.gate, "YELLOW", "overall 74 (< 75 floor) must be YELLOW even with no axis below floor");
  const green: CraftAxisScore[] = CRAFT_AXES.map((axis) => ({ axis, score: 0.8, hits: [] }));
  const g = computeCraftVerdict("c", green);
  assert.equal(g.overall, 80);
  assert.equal(g.gate, "GREEN");
  // The craft bar never claims CORRUPTION — a DID-NOT-RUN read is YELLOW, not RED.
  assert.equal(computeCraftVerdict("c", green, false).gate, "YELLOW");
});

// ── Finalize integration ─────────────────────────────────────────────────────────
test("OFF mode: no craft column, no craft detail, verdict unchanged (byte-identical to pre-craft)", () => {
  cleanup();
  try {
    const chapter = clonedCleanChapter();
    setupGreenEvidence([chapter]);
    writeCraft(chapter, true); // even a below-floor craft artifact must be inert in off mode
    const result = finalizeMode("off");
    const d = result.chapters[0];
    assert.equal(d.finalVerdict, "PUBLISHABLE", JSON.stringify(d.checks));
    assert.ok(!("craftRead" in d.checks), "off mode must NOT add a craftRead column");
    assert.equal(d.craft, undefined, "off mode must NOT surface craft detail");
    assert.equal(existsSync(craftArtifactPath(BOOK, ROUND, CH)), true, "the craft artifact exists but is ignored in off mode");
  } finally {
    cleanup();
  }
});

test("SHADOW mode changes NO finalize verdict: a green book with a YELLOW craft read still PUBLISHES; matrix surfaces the non-gating craft column", () => {
  cleanup();
  try {
    const chapter = clonedCleanChapter();
    setupGreenEvidence([chapter]);
    writeCraft(chapter, true);
    const off = finalizeMode("off");
    const shadow = finalizeMode("shadow");
    assert.equal(off.chapters[0].finalVerdict, "PUBLISHABLE");
    assert.equal(shadow.chapters[0].finalVerdict, "PUBLISHABLE", "shadow must not change the verdict");
    assert.equal(off.chapters[0].finalVerdict, shadow.chapters[0].finalVerdict, "off and shadow must reach the SAME verdict");
    const d = shadow.chapters[0];
    assert.equal(d.checks.craftRead, "NOT_APPLICABLE", "shadow craftRead is always NOT_APPLICABLE (non-gating)");
    assert.equal(d.craft?.status, "YELLOW", "shadow surfaces the real craft status");
    assert.equal(d.craft?.mode, "shadow");
    // The evidence matrix on disk carries the craft column too.
    const matrix = JSON.parse(readFileSync(evidenceMatrixPath(BOOK, ROUND), "utf8"));
    assert.equal(matrix.chapters[0].checks.craftRead, "NOT_APPLICABLE");
    assert.equal(matrix.chapters[0].craft.status, "YELLOW");
    // Shadow must NOT write a blocking ledger finding for craft (repairLedger stays clean).
    assert.equal(d.checks.repairLedger, "NO_OPEN_BLOCKERS");
  } finally {
    cleanup();
  }
});

test("ENFORCE mode flips a below-floor craft chapter PUBLISHABLE → REVISE (never CORRUPTION)", () => {
  cleanup();
  try {
    const chapter = clonedCleanChapter();
    setupGreenEvidence([chapter]);
    writeCraft(chapter, true);
    const result = finalizeMode("enforce");
    const d = result.chapters[0];
    assert.equal(d.checks.craftRead, "YELLOW", "enforce carries the real craft gate");
    assert.equal(d.finalVerdict, "REVISE", `enforce must flip a below-floor chapter to REVISE, got ${d.finalVerdict}: ${d.reason}`);
    assert.notEqual(d.finalVerdict, "CORRUPTION", "craft never produces CORRUPTION");
    assert.match(d.reason, /craft bar below floor/);
  } finally {
    cleanup();
  }
});

test("ENFORCE mode leaves a GREEN craft chapter PUBLISHABLE (craft only ADDS a reason to revise)", () => {
  cleanup();
  try {
    const chapter = clonedCleanChapter();
    setupGreenEvidence([chapter]);
    writeCraft(chapter, false); // all axes 0.9 → GREEN craft
    const result = finalizeMode("enforce");
    const d = result.chapters[0];
    assert.equal(d.checks.craftRead, "GREEN");
    assert.equal(d.finalVerdict, "PUBLISHABLE", "a GREEN craft read must not demote a publishable chapter");
  } finally {
    cleanup();
  }
});

test("the craft artifact round-trips through loadCraftReadArtifact", () => {
  cleanup();
  try {
    const chapter = clonedCleanChapter();
    writeFixtureBook(STATE_CHAPTERS, [chapter]);
    writeCraft(chapter, false);
    const loaded = loadCraftReadArtifact(BOOK, ROUND, CH);
    assert.ok(loaded);
    assert.equal(loaded!.schemaVersion, "qc-craft-read-v1");
    assert.equal(loaded!.axes.length, 5);
  } finally {
    cleanup();
  }
});

test("QC-CODEX-SESSION.md carries the craft-read section (doc-vs-code drift guard)", () => {
  const doc = readFileSync(resolve(PIPELINE_DIR, "agent-prompts/QC-CODEX-SESSION.md"), "utf8");
  assert.match(doc, /\*\*craft\*\*/, "QC-CODEX-SESSION must document the craft role");
  assert.match(doc, /qc-craft-read-v1/, "QC-CODEX-SESSION must name the craft submission schema");
  assert.match(doc, /CHAPTERFLOW_CRAFT_READ/, "QC-CODEX-SESSION must name the craft mode switch");
  for (const axis of CRAFT_AXES) assert.ok(doc.includes(axis), `QC-CODEX-SESSION must list craft axis ${axis}`);
});
