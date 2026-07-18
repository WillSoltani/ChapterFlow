/** Stage-1 screening driver (scripts/screening/run-stage1-screening.mts +
 *  stage1Core.mts). Proves with injected doubles (nothing spawns):
 *   (1) the registered grid (3 blocks × 2 replicates from SCREENING_PLAN) and
 *       the per-invocation session estimates summing to the registered 84;
 *   (2) the seeded blind-label map is IDENTICAL across runs of one runHash and
 *       sealed only in the run manifests;
 *   (3) budget: the spawn gate halts BEFORE the offending reservation (campaign
 *       ceiling AND stage cap), and an at-ceiling invocation halts before its
 *       authoring double is ever invoked (exit 3);
 *   (4) a full r1 invocation: one E-audit per slot written to the EXACT
 *       eval-diagnostic.json location selection's evaluator-primary mode reads;
 *       one single-rater D7-lite session per candidate + ONE drift unit via the
 *       calibration branch; terminal d7.json records; selection deferred until
 *       the sibling replicate exists;
 *   (5) replicate r2 SKIPS D7-lite (registered design) and, once both
 *       replicates carry terminal audits, the block's FINAL selections are
 *       minted via the terminal-gated resume path;
 *   (6) resume: a re-run re-ingests completed audits — zero new E-audit or
 *       D7-lite dispatches;
 *   (7) the scoreboard is BLIND (no model-identity token anywhere in the
 *       serialized artifact), applies the §4.4 OWNER-RULING floors (advance 75
 *       / block 65), pairs Δs against the incumbent LABEL, and carries the
 *       D7-lite P1/P2 inputs;
 *   (8) scoreboard-only on empty state reports no cells; and
 *   (9) a second resolved rater model triggers the uniformity halt before any
 *       further cell is spawned (exit 4).
 * Zero model/api calls; all state lands under disposable temp roots. */

import assert from "node:assert/strict";
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

import { test } from "./harness.js";
import { mkTestRoots } from "./testRoots.js";
import { PIPELINE_DIR, bakeoffRoots, slotChaptersDir } from "../src/bakeoff/paths.js";
import { readManifest, writeManifest, type BakeoffOutcome, type RunBakeoffOptions } from "../src/bakeoff/runBakeoff.js";
import type { BlindLabel, CandidateD7JudgmentV1, CandidateEvalDiagnosticV1, SelectionV1 } from "../src/bakeoff/types.js";
import type { ChapterDiagnosticRunInput, ChapterDiagnosticRunResult, ChapterDiagnosticRoleResult } from "../src/evaluation/chapterDiagnosticRun.js";
import type { D7WorkerDispatch, D7WorkerRequest } from "../src/bakeoff/d7Judge.js";
import {
  PIPELINE_REL,
  RUBRIC_CALIBRATION_REFERENCES,
  RUBRIC_DOMAINS,
} from "../src/bakeoff/migration/rubricAuditInstrument.js";
import { extractRecordSkeleton } from "../src/bakeoff/migration/rubricAuditHarness.js";
import type { JsonRecord } from "../src/bakeoff/migration/rubricAuditReceipts.js";
import type { RunCallLedgerEntryV1 } from "../src/telemetry/runCallLedger.js";
import { fullFixtureChapter } from "./model-bakeoff-d7-helpers.js";
import {
  STAGE1_ADVANCE_FLOOR,
  STAGE1_BLOCK_FLOOR,
  STAGE1_INCUMBENT_MODEL,
  STAGE1_SESSION_CEILING,
  STAGE1_STAGE_CAP,
  Stage1SpawnGate,
  buildStage1Scoreboard,
  ensureStage1Manifest,
  executeStage1Invocation,
  invocationSessionEstimate,
  seededRng,
  stage1Blocks,
  stage1RunId,
  writeStage1Scoreboard,
  type Stage1Deps,
  type Stage1Replicate,
} from "../scripts/screening/stage1Core.mjs";
import type { D7LiteProbeGateResult } from "../scripts/screening/d7liteCore.mjs";

const REPOSITORY_ROOT = resolve(PIPELINE_DIR, "../../../..");
const RUN_HASH = "t1";

// ── Rig ─────────────────────────────────────────────────────────────────────────

type Rig = {
  base: string;
  pipelineDir: string;
  stateRoot: string;
  dispose: () => void;
};

/** A temp repo carrying the sealed calibration docs at their registered
 *  rel-paths (byte-copies, so the owner-sha checks hold), with the pipeline dir
 *  + state root laid out in production geometry under it. */
function makeRig(prefix: string, opts?: { withCalibrationDocs?: boolean }): Rig {
  const roots = mkTestRoots(prefix);
  if (opts?.withCalibrationDocs !== false) {
    for (const ref of RUBRIC_CALIBRATION_REFERENCES) {
      const abs = resolve(roots.base, ref.docRelPath);
      mkdirSync(dirname(abs), { recursive: true });
      copyFileSync(resolve(REPOSITORY_ROOT, ref.docRelPath), abs);
    }
  }
  const pipelineDir = resolve(roots.base, PIPELINE_REL);
  return { base: roots.base, pipelineDir, stateRoot: resolve(pipelineDir, "state"), dispose: roots.dispose };
}

const probeOk = async (): Promise<D7LiteProbeGateResult> => ({
  ok: true,
  sidecarSha256: "test-probe-sha",
  reused: true,
  sessionsSpent: 0,
});

/** The conductor double. First call per run (no eval diagnostics yet) =
 *  authoring: writes one fixture chapter into each slot, returns the
 *  provisional-selection halt the real conductor emits. A later call with every
 *  label's eval-diagnostic on disk = the driver's selection resume pass: mints
 *  a FINAL (provisional:false) selection into the manifest. */
function makeAuthoringDouble(rig: Rig, calls: RunBakeoffOptions[]): (opts: RunBakeoffOptions) => Promise<BakeoffOutcome> {
  return async (opts) => {
    calls.push(opts);
    const bookId = opts.corpus!.bookId;
    const runId = opts.runId!;
    const roots = bakeoffRoots(bookId, runId, rig.stateRoot);
    const manifest = readManifest(roots);
    assert.ok(manifest, "the driver pre-seeds the manifest before the conductor runs");
    assert.equal(manifest.readabilityMeasureOnly, true, "measure-only flag sealed in the manifest");
    const labelOf = (model: string): string => Object.entries(manifest.blindMap).find(([, m]) => m === model)![0];
    const allDiag = manifest.candidates.every((spec) =>
      existsSync(resolve(roots.reviewsDir, labelOf(spec.model), "eval-diagnostic.json")));
    if (allDiag) {
      const selection: SelectionV1 = {
        schemaVersion: "model-bakeoff-selection-v1",
        selectedAt: new Date().toISOString(),
        provisional: false,
        winner: manifest.candidates[0]!.model,
        runnerUp: null,
        decidedByTieBreak: false,
        tieBand: 2,
        scorecards: [],
        reasons: ["test-double FINAL mint (terminal-gated resume pass)"],
        perChapterWinners: [],
      };
      manifest.selection = selection;
      writeManifest(roots, manifest);
      return { status: "compared", bookId, runId, winner: selection.winner };
    }
    const n = opts.corpus!.chapters[0]!;
    for (const spec of manifest.candidates) {
      const dir = slotChaptersDir(roots, spec.slot);
      mkdirSync(dir, { recursive: true });
      const abs = resolve(dir, `${bookId}-ch${String(n).padStart(2, "0")}.chapter.json`);
      writeFileSync(abs, `${JSON.stringify(fullFixtureChapter(bookId, n), null, 2)}\n`);
    }
    return {
      status: "halt", bookId, runId, winner: null,
      reason: "selection is PROVISIONAL (not evidence) — still D7-pending: test double",
    };
  };
}

function roleResult(role: ChapterDiagnosticRoleResult["role"], raterModel: string): ChapterDiagnosticRoleResult {
  return {
    role,
    terminalState: "judged",
    attempts: [{ attempt: 1, ok: true, sessionModel: raterModel, outcome: "content_completed", failure: null, replyPath: null, recordPath: null }],
    recordPath: null,
    raterModel,
  };
}

function makeDiagDouble(args: {
  calls: ChapterDiagnosticRunInput[];
  valueBySlot: Record<string, number>;
  raterModelForCall?: (callIndex: number) => string;
}): (input: ChapterDiagnosticRunInput) => Promise<ChapterDiagnosticRunResult> {
  return async (input) => {
    const idx = args.calls.length;
    args.calls.push(input);
    const raterModel = args.raterModelForCall?.(idx) ?? "gpt-5.6-sol";
    const value = args.valueBySlot[input.slot];
    assert.ok(value !== undefined, `diag double has a value for slot ${input.slot}`);
    const diagnostic: CandidateEvalDiagnosticV1 = {
      schemaVersion: "model-bakeoff-candidate-eval-diagnostic-v1",
      label: input.label,
      contentSha256: "test-content-sha",
      evalRunId: input.runId,
      chapterDiagnostic: value,
      confidence: "high",
      gatesPass: true,
      raterModels: { primary: raterModel, verification: raterModel, adjudicator: raterModel },
      terminalState: "judged",
      receipts: { primaryDispatch: "", verificationDispatch: "", pairSeal: "", adjudicated: "" },
      judgedAt: new Date().toISOString(),
    };
    return {
      blindBookId: `chapterdiag--cf-${input.runHash}-${input.blockCode}-${input.slot}`,
      runRoot: "",
      diagnostic,
      roles: {
        primary: roleResult("primary", raterModel),
        verification: roleResult("verification", raterModel),
        adjudicator: roleResult("adjudicator", raterModel),
      },
      summaryLine: `CHAPTER DIAGNOSTIC — NOT A BOOK SCORE :: ${input.label}: ${value}`,
    };
  };
}

type RatingFor = (domainKey: string, subIndex: number) => number;

/** Mixed integer ratings → derived diagnostic ≈69.47 (within ±3.0 of every
 *  sealed anchor, so drift PASSES). Same fixture idiom as the drill test. */
const passRating: RatingFor = (domainKey, subIndex) =>
  domainKey === "epistemic_integrity" ? 2 : domainKey === "audience_fit" && subIndex < 2 ? 2 : 3;

function ratedRecordFromTask(task: string, ratingFor: RatingFor): string {
  const skeleton = extractRecordSkeleton(task);
  const domains = skeleton.domains as Record<string, JsonRecord>;
  for (const spec of RUBRIC_DOMAINS) {
    const subs = domains[spec.key]!.subcriteria as Record<string, JsonRecord>;
    spec.subcriteria.forEach((sub, index) => {
      subs[sub]!.rating = ratingFor(spec.key, index);
    });
  }
  return JSON.stringify(skeleton);
}

function makeD7Dispatch(calls: D7WorkerRequest[]): D7WorkerDispatch {
  return async (req) => {
    calls.push(req);
    return {
      record: ratedRecordFromTask(req.task, passRating),
      dispatchMeta: {
        model: "gpt-5.6-sol",
        effort: "ultra",
        sessionId: `test-${req.unit}-${req.label}`,
        sessionKind: "session",
        attemptIndex: 1,
      },
    };
  };
}

function baseDeps(rig: Rig, over: Partial<Stage1Deps>): Stage1Deps {
  return {
    pipelineDir: rig.pipelineDir,
    repositoryRoot: rig.base,
    stateRoot: rig.stateRoot,
    log: () => {},
    clock: () => new Date("2026-07-18T00:00:00.000Z"),
    probeGate: probeOk,
    bookMetadata: () => ({ title: "A Test Book", categories: ["testing"], tags: [] }),
    ...over,
  };
}

const BLOCK = stage1Blocks()[0]!; // nudge-ch03
const VALUE_BY_SLOT: Record<string, number> = { w1: 80, w2: 74.5, w3: 60 };

function sealedLabelOf(rig: Rig, replicate: Stage1Replicate, model: string): BlindLabel {
  const roots = bakeoffRoots(BLOCK.bookId, stage1RunId(RUN_HASH, BLOCK.unit, replicate), rig.stateRoot);
  const manifest = readManifest(roots)!;
  return Object.entries(manifest.blindMap).find(([, m]) => m === model)![0] as BlindLabel;
}

// ── (1) registered grid + estimates ────────────────────────────────────────────

test("stage1: registered grid is 3 blocks × 2 replicates; estimates sum to the registered 84 planned sessions", () => {
  const blocks = stage1Blocks();
  assert.deepEqual(blocks.map((b) => b.unit), ["nudge-ch03", "made-to-stick-ch04", "the-happiness-hypothesis-ch06"]);
  for (const b of blocks) {
    assert.equal(b.models.length, 3, "xhigh trio");
    assert.equal(b.effort, "xhigh");
    assert.ok(!b.calibrationUnit.startsWith(`${b.bookId}-ch`), "drift unit disjoint from the block book (rt702-R1)");
  }
  const total = blocks.length * (invocationSessionEstimate("r1").planned + invocationSessionEstimate("r2").planned);
  assert.equal(total, 84, "protocol §5 Stage-1 row: 18 author + 54 E-audit + 12 D7-lite = 84");
  assert.equal(STAGE1_SESSION_CEILING, 170, "D-3 amended ceiling");
  assert.equal(STAGE1_STAGE_CAP, 119, "registered Stage-1 cap");
});

// ── (2) seeded blind map ───────────────────────────────────────────────────────

test("stage1: seeded blind-label map is identical across runs of one runHash and sealed in the manifest", () => {
  const rig = makeRig("stage1-blindmap", { withCalibrationDocs: false });
  try {
    const clock = (): Date => new Date("2026-07-18T00:00:00.000Z");
    const maps = (["r1", "r2"] as const).map((rep) => {
      const runId = stage1RunId(RUN_HASH, BLOCK.unit, rep);
      const roots = bakeoffRoots(BLOCK.bookId, runId, rig.stateRoot);
      return ensureStage1Manifest(roots, BLOCK, runId, RUN_HASH, clock).blindMap;
    });
    assert.deepEqual(maps[0], maps[1], "same sealed map on both replicates");
    assert.equal(Object.keys(maps[0]!).length, 3);
    // A DIFFERENT runHash reshuffles (the seed is the campaign key).
    const rng1 = seededRng("stage1-blind-a");
    const rng2 = seededRng("stage1-blind-a");
    assert.equal(rng1(), rng2(), "seeded rng is deterministic");
  } finally {
    rig.dispose();
  }
});

// ── (3) budget halts BEFORE the offending spawn ────────────────────────────────

test("stage1: the spawn gate halts BEFORE the offending reservation (ceiling, stage cap, ledger recount)", () => {
  const gate = new Stage1SpawnGate("/nonexistent-pipeline", { ceiling: 2, stageCap: 99, readEntries: () => [] });
  gate.reserve("a");
  gate.reserve("b");
  assert.throws(() => gate.reserve("c"), /campaign-ceiling HALT before "c"/);
  assert.equal(gate.breached, true);
  assert.equal(gate.reservedThisProcess, 2, "the offending reservation was refused, not recorded");

  // Prior ledger spend (TRUE sessions only) counts against the ceiling.
  const entry = { sessionKind: "session", runId: "s1x-x-nudge-ch03-r1", family: "codex-exec" } as unknown as RunCallLedgerEntryV1;
  const reingest = { sessionKind: "reingest", runId: "s1x-x-nudge-ch03-r1", family: "codex-exec" } as unknown as RunCallLedgerEntryV1;
  const gate2 = new Stage1SpawnGate("/nonexistent-pipeline", { ceiling: 2, readEntries: () => [entry, reingest] });
  gate2.reserve("a");
  assert.throws(() => gate2.reserve("b"), /campaign-ceiling HALT/);

  const gate3 = new Stage1SpawnGate("/nonexistent-pipeline", { ceiling: 99, stageCap: 1, readEntries: () => [entry] });
  assert.throws(() => gate3.reserve("a"), /stage-1 cap HALT/);
});

test("stage1: an at-ceiling invocation hard-halts BEFORE any spawn (authoring double never invoked; exit 3)", async () => {
  const rig = makeRig("stage1-budget", { withCalibrationDocs: false });
  try {
    const authoringCalls: RunBakeoffOptions[] = [];
    const diagCalls: ChapterDiagnosticRunInput[] = [];
    const d7Calls: D7WorkerRequest[] = [];
    const gate = new Stage1SpawnGate(rig.pipelineDir, { ceiling: 0, readEntries: () => [] });
    const result = await executeStage1Invocation({
      unit: BLOCK.unit,
      replicate: "r1",
      runHash: RUN_HASH,
      deps: baseDeps(rig, {
        gate,
        runBakeoffFn: makeAuthoringDouble(rig, authoringCalls),
        runDiagnosticFn: makeDiagDouble({ calls: diagCalls, valueBySlot: VALUE_BY_SLOT }),
        d7Dispatch: makeD7Dispatch(d7Calls),
      }),
    });
    assert.equal(result.exitCode, 3, "budget halt exit code");
    assert.equal(authoringCalls.length, 0, "halted BEFORE the authoring pass");
    assert.equal(diagCalls.length, 0);
    assert.equal(d7Calls.length, 0);
    assert.match(result.summary.budget.haltDetail ?? "", /HALT before/);
    assert.match(result.summary.budget.haltDetail ?? "", /Stage 1 at cap without confirmation = STOP/);
  } finally {
    rig.dispose();
  }
});

// ── (4)-(8) the shared full-flow rig ───────────────────────────────────────────

const flowRig = makeRig("stage1-flow");

test("stage1 r1: E-audit per slot at the selection read location; D7-lite per candidate + ONE drift unit; terminal d7.json; selection deferred", async () => {
  const authoringCalls: RunBakeoffOptions[] = [];
  const diagCalls: ChapterDiagnosticRunInput[] = [];
  const d7Calls: D7WorkerRequest[] = [];
  const result = await executeStage1Invocation({
    unit: BLOCK.unit,
    replicate: "r1",
    runHash: RUN_HASH,
    deps: baseDeps(flowRig, {
      runBakeoffFn: makeAuthoringDouble(flowRig, authoringCalls),
      runDiagnosticFn: makeDiagDouble({ calls: diagCalls, valueBySlot: VALUE_BY_SLOT }),
      d7Dispatch: makeD7Dispatch(d7Calls),
    }),
  });
  assert.equal(result.exitCode, 0);
  assert.equal(authoringCalls.length, 1, "one conductor pass");
  assert.equal(diagCalls.length, 3, "one E-audit per candidate slot");
  assert.deepEqual(diagCalls.map((c) => c.slot).sort(), ["w1", "w2", "w3"]);
  assert.equal(new Set(diagCalls.map((c) => c.label)).size, 3, "distinct blind labels");
  assert.ok(diagCalls.every((c) => c.runId.includes("-r1-w")), "eval runId derives from invocation + slot");

  // Exactly 3 candidate D7-lite sessions + 1 drift via the calibration branch.
  assert.equal(d7Calls.length, 4);
  assert.equal(d7Calls.filter((c) => c.kind === "candidate" && c.unit === BLOCK.unit && c.role === "primary").length, 3);
  const driftCalls = d7Calls.filter((c) => c.kind === "calibration");
  assert.equal(driftCalls.length, 1, "ONE drift unit per r1 invocation");
  assert.equal(driftCalls[0]!.unit, BLOCK.calibrationUnit);

  const runId = stage1RunId(RUN_HASH, BLOCK.unit, "r1");
  const roots = bakeoffRoots(BLOCK.bookId, runId, flowRig.stateRoot);
  const manifest = readManifest(roots)!;
  for (const spec of manifest.candidates) {
    const label = Object.entries(manifest.blindMap).find(([, m]) => m === spec.model)![0];
    // WP-E32's exact read location: reviews/<label>/eval-diagnostic.json.
    const diagPath = resolve(roots.reviewsDir, label, "eval-diagnostic.json");
    assert.ok(existsSync(diagPath), `eval diagnostic written where selection reads it (${label})`);
    const diag = JSON.parse(readFileSync(diagPath, "utf8")) as CandidateEvalDiagnosticV1;
    assert.equal(diag.chapterDiagnostic, VALUE_BY_SLOT[spec.slot]);
    // Terminal d7.json (secondary-only lane: null composite, explicit reason).
    const d7 = JSON.parse(readFileSync(resolve(roots.reviewsDir, label, "d7.json"), "utf8")) as CandidateD7JudgmentV1;
    assert.equal(d7.terminalState, "judged");
    assert.equal(d7.d7Composite, null);
    assert.match(d7.ineligibleReason ?? "", /NOT RUN in the Stage-1 lane/);
    // D7-lite sidecar carries the DERIVED single-rater diagnostic.
    const cell = JSON.parse(readFileSync(resolve(roots.runRoot, "d7lite", `${label}.json`), "utf8")) as { value: number | null };
    assert.ok(cell.value !== null && Math.abs(cell.value - 69.47368421052632) < 1e-9);
  }
  const drift = JSON.parse(readFileSync(resolve(roots.runRoot, "d7lite", "drift.json"), "utf8")) as { pass: boolean | null; unit: string };
  assert.equal(drift.unit, BLOCK.calibrationUnit);
  assert.equal(drift.pass, true, "69.47 vs the sealed anchor is within ±3.0");

  assert.equal(result.summary.selection.minted, false);
  assert.match(result.summary.selection.detail, /deferred — sibling replicate r2/);
  assert.ok(result.summaryPath && existsSync(result.summaryPath), "invocation summary persisted");
});

test("stage1 r2: D7-lite SKIPPED (registered design); block completion mints FINAL selections for BOTH replicates", async () => {
  const authoringCalls: RunBakeoffOptions[] = [];
  const diagCalls: ChapterDiagnosticRunInput[] = [];
  const d7Calls: D7WorkerRequest[] = [];
  const result = await executeStage1Invocation({
    unit: BLOCK.unit,
    replicate: "r2",
    runHash: RUN_HASH,
    deps: baseDeps(flowRig, {
      runBakeoffFn: makeAuthoringDouble(flowRig, authoringCalls),
      runDiagnosticFn: makeDiagDouble({ calls: diagCalls, valueBySlot: VALUE_BY_SLOT }),
      d7Dispatch: makeD7Dispatch(d7Calls),
    }),
  });
  assert.equal(result.exitCode, 0);
  assert.equal(d7Calls.length, 0, "replicate-2 spawns ZERO D7-lite sessions");
  assert.match(result.summary.d7lite.skippedReason ?? "", /replicate-1 cells only/);
  assert.equal(diagCalls.length, 3);

  // Both replicates now carry terminal audits → the driver minted BOTH runs'
  // FINAL selections via the terminal-gated resume path.
  assert.equal(result.summary.selection.minted, true);
  assert.ok(result.summary.selection.winnerLabel, "winner reported as a BLIND label");
  for (const rep of ["r1", "r2"] as const) {
    const roots = bakeoffRoots(BLOCK.bookId, stage1RunId(RUN_HASH, BLOCK.unit, rep), flowRig.stateRoot);
    const manifest = readManifest(roots)!;
    assert.equal(manifest.selection?.provisional, false, `${rep} selection is FINAL`);
  }
});

test("stage1 resume: a re-run re-ingests completed audits — zero new E-audit or D7-lite dispatches", async () => {
  const authoringCalls: RunBakeoffOptions[] = [];
  const diagCalls: ChapterDiagnosticRunInput[] = [];
  const d7Calls: D7WorkerRequest[] = [];
  const result = await executeStage1Invocation({
    unit: BLOCK.unit,
    replicate: "r1",
    runHash: RUN_HASH,
    deps: baseDeps(flowRig, {
      runBakeoffFn: makeAuthoringDouble(flowRig, authoringCalls),
      runDiagnosticFn: makeDiagDouble({ calls: diagCalls, valueBySlot: VALUE_BY_SLOT }),
      d7Dispatch: makeD7Dispatch(d7Calls),
    }),
  });
  assert.equal(result.exitCode, 0);
  assert.equal(diagCalls.length, 0, "completed E-audits are never respawned (hash-verified resume)");
  assert.equal(d7Calls.length, 0, "completed D7-lite cells are never respawned");
  assert.ok(result.summary.evalCells.every((c) => c.reused), "every cell re-ingested");
});

test("stage1 scoreboard: BLIND (no model token), floors applied, paired Δs vs the incumbent LABEL, D7-lite P1/P2 inputs", () => {
  const { cellsFound, scoreboard } = buildStage1Scoreboard({
    runHash: RUN_HASH,
    pipelineDir: flowRig.pipelineDir,
    stateRoot: flowRig.stateRoot,
  });
  assert.ok(scoreboard, "scoreboard built");
  assert.equal(cellsFound, 6, "1 block × 2 replicates × 3 labels");
  assert.equal(scoreboard.completeness.expectedCells, 18);

  // BLIND: the serialized artifact never contains a model-identity token.
  const bytes = JSON.stringify(scoreboard);
  for (const token of ["sol", "terra", "luna"]) {
    assert.ok(!new RegExp(`(^|[^a-z0-9])${token}($|[^a-z0-9])`, "i").test(bytes), `no "${token}" in the scoreboard`);
  }
  assert.ok(!/gpt-5\.6/i.test(bytes), "no model family string in the scoreboard");
  assert.ok(!/xhigh/i.test(bytes), "no candidate effort string in the scoreboard");

  const incumbentLabel = sealedLabelOf(flowRig, "r1", STAGE1_INCUMBENT_MODEL);
  assert.equal(scoreboard.incumbentLabel, incumbentLabel, "Δs keyed on the incumbent's BLIND label");

  // Floors (protocol §4.4 OWNER RULING: advance 75, block 65) — values by slot:
  // w1 (incumbent) = 80 passes both; w2 = 74.5 fails the advance floor; w3 = 60
  // falls below the block floor.
  const models = stage1Blocks()[0]!.models;
  const perLabelOf = (model: string) => scoreboard.perLabel.find((p) => p.label === sealedLabelOf(flowRig, "r1", model))!;
  assert.equal(STAGE1_ADVANCE_FLOOR, 75.0);
  assert.equal(STAGE1_BLOCK_FLOOR, 65.0);
  assert.equal(perLabelOf(models[0]!).advanceFloorPass, true);
  assert.equal(perLabelOf(models[0]!).blockFloorPass, true);
  assert.equal(perLabelOf(models[1]!).advanceFloorPass, false);
  assert.equal(perLabelOf(models[2]!).blockFloorPass, false);
  assert.deepEqual(perLabelOf(models[2]!).blocksBelowBlockFloor, [BLOCK.unit]);

  // Paired Δs vs the incumbent label (both replicates paired).
  const d3 = scoreboard.pairedDeltasVsIncumbent.find((p) => p.label === sealedLabelOf(flowRig, "r1", models[2]!))!;
  assert.equal(d3.meanDelta, -20);
  assert.equal(d3.signConsistent, true);
  assert.equal(d3.exceedsW, true);
  assert.equal(d3.perBlock.find((b) => b.block === BLOCK.unit)!.replicatesPaired, 2);

  // D7-lite P1/P2 inputs present (identical single-rater reads ⇒ Δ_D7 = 0 ⇒ no
  // sign flip is counted for a zero delta).
  const chal = scoreboard.d7lite.perChallenger.find((p) => p.label === d3.label)!;
  const blockRow = chal.perBlock.find((b) => b.block === BLOCK.unit)!;
  assert.equal(blockRow.deltaD7, 0);
  assert.equal(blockRow.deltaE, -20);
  assert.equal(blockRow.deltaEOverW, -10);
  assert.equal(chal.p1SignFlipBlocks, 0);
  assert.ok(chal.p2MeanNoiseUnitGap !== null);

  // The write path persists under the campaign stage1 dir and stays blind.
  const written = writeStage1Scoreboard({ runHash: RUN_HASH, pipelineDir: flowRig.pipelineDir, stateRoot: flowRig.stateRoot });
  assert.ok(written.outPath && existsSync(written.outPath));
  const fileBytes = readFileSync(written.outPath!, "utf8");
  assert.ok(!/(^|[^a-z0-9])(sol|terra|luna)($|[^a-z0-9])/im.test(fileBytes) && !/gpt-5\.6/i.test(fileBytes));

  flowRig.dispose();
});

// ── (8) empty state ────────────────────────────────────────────────────────────

test("stage1 scoreboard on empty state: no cells, nothing written, clean exit", () => {
  const rig = makeRig("stage1-empty", { withCalibrationDocs: false });
  try {
    const result = writeStage1Scoreboard({ runHash: RUN_HASH, pipelineDir: rig.pipelineDir, stateRoot: rig.stateRoot });
    assert.equal(result.cellsFound, 0);
    assert.equal(result.outPath, null);
  } finally {
    rig.dispose();
  }
});

// ── (9) rater-uniformity halt ──────────────────────────────────────────────────

test("stage1: a second resolved rater model triggers the uniformity halt before any further cell (exit 4)", async () => {
  const rig = makeRig("stage1-uniformity", { withCalibrationDocs: false });
  try {
    const authoringCalls: RunBakeoffOptions[] = [];
    const diagCalls: ChapterDiagnosticRunInput[] = [];
    const d7Calls: D7WorkerRequest[] = [];
    const result = await executeStage1Invocation({
      unit: BLOCK.unit,
      replicate: "r2", // r2: no D7-lite, so no calibration docs needed
      runHash: RUN_HASH,
      deps: baseDeps(rig, {
        runBakeoffFn: makeAuthoringDouble(rig, authoringCalls),
        runDiagnosticFn: makeDiagDouble({
          calls: diagCalls,
          valueBySlot: VALUE_BY_SLOT,
          raterModelForCall: (i) => (i === 0 ? "gpt-5.6-sol" : "gpt-5.6-terra"),
        }),
        d7Dispatch: makeD7Dispatch(d7Calls),
      }),
    });
    assert.equal(result.exitCode, 4, "uniformity halt exit code");
    assert.equal(diagCalls.length, 2, "the third cell is never spawned after the halt");
    assert.equal(result.summary.uniformity.halted, true);
    assert.equal(result.summary.uniformity.uniform, false);
  } finally {
    rig.dispose();
  }
});
