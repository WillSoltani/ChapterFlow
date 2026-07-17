/**
 * WP-703 (model-free) — the pre-registered Stage-1 screening plan + its decision
 * functions, the no-draft corpus intake, the D7 dispatch seam, and the rt702-R3
 * advisory-judge refusal.
 *
 * ZERO live/paid calls. Every scenario drives code IN-PROCESS with injected
 * spawn/judge/session doubles; nothing touches canonical state (tmp roots + a
 * no-op lock). Proves:
 *   (a) the plan enumeration lists EXACTLY the registered 4 configs + 3 runs +
 *       caps, parsed from the machine-readable companion the doc references
 *       (not regexed prose), and the companion is byte-bound to the code;
 *   (b) a run that would exceed the ≤18 authoring / ≤40 total caps halts BEFORE
 *       the offending session;
 *   (c) a probe-failed config is dropped + recorded, never silently substituted;
 *   (d) advancement selects only configs meeting BOTH bar conditions, ≤3,
 *       highest D7 means first;
 *   (e) a zero-passing screening yields a STOP outcome with the owner-escalation
 *       note;
 *   (f) the REAL (not-ready) corpus manifest makes intake refuse; a READY fixture
 *       manifest makes intake proceed;
 *   (g) every registered run's calibration assignment is collision-free (the
 *       rt702-R1 guard would not fire), and the check is not a no-op;
 *   (h) an explicit gpt-5.5 advisory judge id is REFUSED before any spawn.
 * Plus: the D7 dispatch seam ledgers each dispatch (family claude-side) and stays
 * fail-closed without an operator-supplied session runner.
 */

import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

import { test } from "./harness.js";
import { PIPELINE_DIR } from "../src/bakeoff/paths.js";
import {
  SCREENING_PLAN,
  screeningPlanJson,
  enumerateScreeningPlan,
  calibrationCollision,
  assertNoCalibrationCollisions,
  dropProbeFailedConfigs,
  decideAdvancement,
  SCREENING_STOP_ESCALATION,
  ScreeningSessionBudget,
  ScreeningCapError,
  type ConfigScreeningResult,
  type ProbeVerdict,
} from "../src/bakeoff/screeningPlan.js";
import { intakeCorpus, CorpusIntakeError, isResolvedAuthoringSource } from "../src/bakeoff/corpusIntake.js";
import { createD7WorkerDispatch, D7_DISPATCH_LEDGER_STAGE } from "../src/bakeoff/d7WorkerDispatch.js";
import type { D7WorkerRequest } from "../src/bakeoff/d7Judge.js";
import { readCallLedgerEntries } from "../src/telemetry/runCallLedger.js";
import { runBakeoff, assertBakeoffJudgeSupported } from "../src/bakeoff/runBakeoff.js";
import { tmpRoot, fakeBakeoffDeps } from "./model-bakeoff-helpers.js";

const REPOSITORY_ROOT = resolve(PIPELINE_DIR, "../../../..");
const COMPANION_PATH = resolve(REPOSITORY_ROOT, "docs/v25/implementation/V25_BAKEOFF_STAGE1_SCREENING.plan.json");

// ── (a) plan enumeration + companion binding ─────────────────────────────────

test("(a) the machine-readable companion lists EXACTLY the registered 4 configs + 3 runs + caps", () => {
  const companion = JSON.parse(readFileSync(COMPANION_PATH, "utf8")) as typeof SCREENING_PLAN;
  assert.equal(companion.configs.length, 4, "exactly 4 configs");
  assert.deepEqual(
    companion.configs.map((c) => c.id).sort(),
    ["gpt-5.6-luna@xhigh", "gpt-5.6-sol@high", "gpt-5.6-sol@xhigh", "gpt-5.6-terra@xhigh"],
  );
  assert.ok(companion.configs.every((c) => c.probeSupported === true), "every registered config is probe-SUPPORTED (L-39)");
  assert.equal(companion.runs.length, 3, "exactly 3 compare-only book-runs");
  assert.deepEqual(
    companion.runs.map((r) => `${r.bookId}:${r.chapters.join(",")}`),
    ["nudge:3", "made-to-stick:4", "the-happiness-hypothesis:6"],
  );
  assert.deepEqual(companion.caps, { plannedAuthoringRuns: 12, maxAuthoringRuns: 18, maxTotalSessions: 40 });
  assert.equal(companion.advancementBar.d7ChapterDiagnosticMeanMin, 75);
  assert.equal(companion.advancementBar.hardGateFailuresAllowed, 0);
  assert.equal(companion.advancementBar.maxAdvance, 3);
});

test("(a) the on-disk companion is byte-identical to screeningPlanJson() — the registered numbers cannot drift from code", () => {
  assert.equal(readFileSync(COMPANION_PATH, "utf8"), screeningPlanJson(), "the doc's companion must be exactly the code's canonical plan JSON");
});

test("(a) enumerateScreeningPlan lists the registered configs, book-runs, and 6 conductor invocations", () => {
  const e = enumerateScreeningPlan();
  assert.deepEqual(e.configIds, ["gpt-5.6-sol@xhigh", "gpt-5.6-terra@xhigh", "gpt-5.6-luna@xhigh", "gpt-5.6-sol@high"]);
  assert.deepEqual(e.runIds, ["stage1-nudge-ch03", "stage1-made-to-stick-ch04", "stage1-the-happiness-hypothesis-ch06"]);
  assert.equal(e.conductorRunIds.length, 6, "each book-run decomposes into an xhigh trio + a high solo");
  assert.equal(new Set(e.conductorRunIds).size, 6, "conductor runIds are distinct");
  assert.equal(e.caps.plannedAuthoringRuns, 12);
});

// ── (b) session caps halt BEFORE the offending session ───────────────────────

test("(b) the ≤18 authoring cap halts BEFORE the 19th authoring session (state unchanged on refusal)", () => {
  const budget = new ScreeningSessionBudget(); // registered caps
  for (let i = 1; i <= 18; i++) budget.reserveAuthoring(`author-${i}`);
  assert.equal(budget.authoringUsed, 18);
  assert.throws(() => budget.reserveAuthoring("author-19"), (err: unknown) => err instanceof ScreeningCapError && /authoring cap reached/.test((err as Error).message));
  assert.equal(budget.authoringUsed, 18, "the refused session was NOT counted — the cap halts before the offending session");
});

test("(b) the ≤40 total cap halts BEFORE the 41st session (authoring + repairs)", () => {
  const budget = new ScreeningSessionBudget();
  for (let i = 1; i <= 18; i++) budget.reserveAuthoring(`author-${i}`);
  for (let i = 1; i <= 22; i++) budget.reserveRepair(`repair-${i}`);
  assert.equal(budget.totalUsed, 40);
  assert.throws(() => budget.reserveRepair("repair-23"), (err: unknown) => err instanceof ScreeningCapError && /total session cap reached/.test((err as Error).message));
  assert.equal(budget.totalUsed, 40, "the refused session was NOT counted");
});

// ── (c) probe-failed config dropped + recorded, never substituted ────────────

test("(c) a probe-failed config is dropped and recorded, never silently substituted", () => {
  const probe: ProbeVerdict[] = [
    { configId: "gpt-5.6-sol@xhigh", supported: true },
    { configId: "gpt-5.6-terra@xhigh", supported: false, detail: "UNSUPPORTED_MODEL_CONFIG" },
    { configId: "gpt-5.6-luna@xhigh", supported: true },
    { configId: "gpt-5.6-sol@high", supported: true },
  ];
  const { advancing, dropped } = dropProbeFailedConfigs(SCREENING_PLAN.configs, probe);
  assert.deepEqual(advancing.map((c) => c.id), ["gpt-5.6-sol@xhigh", "gpt-5.6-luna@xhigh", "gpt-5.6-sol@high"]);
  assert.equal(advancing.length, 3, "the dropped config is NOT back-filled by another model (no substitution)");
  assert.equal(dropped.length, 1);
  assert.equal(dropped[0].configId, "gpt-5.6-terra@xhigh");
  assert.match(dropped[0].reason, /capability probe FAILED/);
});

test("(c) a config with NO probe verdict is dropped fail-closed (never assumed supported)", () => {
  const { advancing, dropped } = dropProbeFailedConfigs(SCREENING_PLAN.configs, [
    { configId: "gpt-5.6-sol@xhigh", supported: true },
  ]);
  assert.deepEqual(advancing.map((c) => c.id), ["gpt-5.6-sol@xhigh"]);
  assert.equal(dropped.length, 3);
  assert.ok(dropped.every((d) => /no capability-probe verdict/.test(d.reason)));
});

// ── (d) advancement: both conditions, ≤3, highest means first ────────────────

test("(d) advancement selects only configs meeting BOTH bar conditions, ≤3, highest D7 means first", () => {
  const results: ConfigScreeningResult[] = [
    { configId: "gpt-5.6-sol@xhigh", hardGateFailures: 0, d7ChapterDiagnosticMean: 88 },
    { configId: "gpt-5.6-terra@xhigh", hardGateFailures: 0, d7ChapterDiagnosticMean: 90 },
    { configId: "gpt-5.6-luna@xhigh", hardGateFailures: 0, d7ChapterDiagnosticMean: 82 },
    { configId: "gpt-5.6-sol@high", hardGateFailures: 0, d7ChapterDiagnosticMean: 79 },
  ];
  const decision = decideAdvancement(results);
  assert.equal(decision.outcome, "ADVANCE");
  assert.deepEqual(
    decision.advancing.map((a) => a.configId),
    ["gpt-5.6-terra@xhigh", "gpt-5.6-sol@xhigh", "gpt-5.6-luna@xhigh"],
    "top 3 by D7 mean descending; the 4th (still >=75) is not carried",
  );
});

test("(d) a hard-gate failure, a sub-75 mean, and a null mean each block advancement even with an otherwise-passing peer", () => {
  const results: ConfigScreeningResult[] = [
    { configId: "gpt-5.6-sol@xhigh", hardGateFailures: 1, d7ChapterDiagnosticMean: 92 },  // hard-gate fail → out
    { configId: "gpt-5.6-terra@xhigh", hardGateFailures: 0, d7ChapterDiagnosticMean: 74 }, // < 75 → out
    { configId: "gpt-5.6-luna@xhigh", hardGateFailures: 0, d7ChapterDiagnosticMean: null }, // null → out
    { configId: "gpt-5.6-sol@high", hardGateFailures: 0, d7ChapterDiagnosticMean: 76 },     // the only advancer
  ];
  const decision = decideAdvancement(results);
  assert.equal(decision.outcome, "ADVANCE");
  assert.deepEqual(decision.advancing.map((a) => a.configId), ["gpt-5.6-sol@high"]);
  assert.ok(decision.reasons.some((r) => /gpt-5.6-sol@xhigh: NOT advancing — 1 hard-gate/.test(r)));
  assert.ok(decision.reasons.some((r) => /gpt-5.6-terra@xhigh: NOT advancing — D7 mean 74/.test(r)));
  assert.ok(decision.reasons.some((r) => /gpt-5.6-luna@xhigh: NOT advancing — no finite D7 chapter-diagnostic mean/.test(r)));
});

test("(d2) rt703 FINDING-1: a NON-FINITE D7 mean (NaN/Infinity) never advances — the bar is positive-form, not reject-guards", () => {
  const results: ConfigScreeningResult[] = [
    { configId: "gpt-5.6-sol@xhigh", hardGateFailures: 0, d7ChapterDiagnosticMean: Number.NaN },
    { configId: "gpt-5.6-terra@xhigh", hardGateFailures: 0, d7ChapterDiagnosticMean: Number.POSITIVE_INFINITY },
    { configId: "gpt-5.6-luna@xhigh", hardGateFailures: 0, d7ChapterDiagnosticMean: 76 },
  ];
  const decision = decideAdvancement(results);
  assert.equal(decision.outcome, "ADVANCE");
  assert.deepEqual(decision.advancing.map((a) => a.configId), ["gpt-5.6-luna@xhigh"],
    "only the finite >=75 mean advances; NaN and Infinity are ineligible");
  // And when EVERY mean is non-finite, the screening STOPs — no best-of-a-bad-lot.
  const allBad = decideAdvancement([
    { configId: "gpt-5.6-sol@xhigh", hardGateFailures: 0, d7ChapterDiagnosticMean: Number.NaN },
    { configId: "gpt-5.6-terra@xhigh", hardGateFailures: 0, d7ChapterDiagnosticMean: Number.POSITIVE_INFINITY },
  ]);
  assert.equal(allBad.outcome, "STOP");
  assert.equal(allBad.advancing.length, 0);
});

// ── (e) zero-passing screening → STOP + owner escalation ─────────────────────

test("(e) a zero-passing screening yields a STOP outcome with the owner-escalation note (bar never lowered)", () => {
  const results: ConfigScreeningResult[] = [
    { configId: "gpt-5.6-sol@xhigh", hardGateFailures: 0, d7ChapterDiagnosticMean: 71 },
    { configId: "gpt-5.6-terra@xhigh", hardGateFailures: 2, d7ChapterDiagnosticMean: 80 },
    { configId: "gpt-5.6-luna@xhigh", hardGateFailures: 0, d7ChapterDiagnosticMean: null },
    { configId: "gpt-5.6-sol@high", hardGateFailures: 0, d7ChapterDiagnosticMean: 74.9 },
  ];
  const decision = decideAdvancement(results);
  assert.equal(decision.outcome, "STOP");
  assert.equal(decision.advancing.length, 0);
  assert.equal(decision.escalation, SCREENING_STOP_ESCALATION);
  assert.match(decision.escalation!, /escalate to the owner/i);
  assert.match(decision.escalation!, /C->D/);
  assert.match(decision.escalation!, /not lowered/i);
});

// ── (f) corpus intake: real not-ready refuses; ready fixture proceeds ────────

test("(f) the REAL corpus manifest is RESOLVED (Stage-B freeze, L-44) and intake proceeds against the real frozen inputs", () => {
  // The freeze committed the shared inputs alongside the manifest, so the REAL
  // intake path (on-disk manifest + real collectSharedInputPaths) must succeed.
  const record = intakeCorpus({ bookId: "nudge", chapters: [3] });
  assert.equal(record.corpusId, "bakeoff-corpus-v1");
  assert.equal(record.units.length, 1);
  assert.equal(record.units[0].unit, "nudge-ch03");
  assert.ok(isResolvedAuthoringSource(record.units[0].authoringSource));
  assert.ok(record.sharedInputCount > 0, "shared inputs verified via the freeze machinery");
});


const READY_FIXTURE = {
  schema: "bakeoff-corpus-manifest-v1",
  corpusId: "bakeoff-corpus-v1-fixture",
  bakeoffReadiness: "ready-for-bakeoff",
  bakeoffReadinessReason: "",
  units: [
    { unit: "nudge-ch03", bookId: "nudge", chapterNumber: 3, authoringSource: "docs/v25/bakeoff-corpus-v1/frozen-inputs/nudge-ch03.md#draft", sourceHash: "5561431c", sealedChapterDiagnostic: 70.75657894736842 },
  ],
};

test("(f) a READY fixture manifest makes intake proceed (resolved authoringSource + shared inputs present)", () => {
  const record = intakeCorpus({
    bookId: "nudge",
    chapters: [3],
    deps: {
      readManifestText: () => JSON.stringify(READY_FIXTURE),
      collectSharedInputs: () => ["state/indexes/nudge.json", "state/source-v2/nudge/ch03.json"],
    },
  });
  assert.equal(record.schemaVersion, "model-bakeoff-corpus-intake-v1");
  assert.equal(record.corpusId, "bakeoff-corpus-v1-fixture");
  assert.equal(record.units.length, 1);
  assert.equal(record.units[0].unit, "nudge-ch03");
  assert.ok(isResolvedAuthoringSource(record.units[0].authoringSource));
  assert.equal(record.sharedInputCount, 2);
});

test("(f) a NOT-READY manifest (pre-freeze shape) makes intake refuse fail-closed", () => {
  const notReady = {
    ...READY_FIXTURE,
    corpusId: "bakeoff-corpus-v1-notready-fixture",
    bakeoffReadiness: "not-ready-for-bakeoff",
    units: [{ ...READY_FIXTURE.units[0], authoringSource: "UNRESOLVED" }],
  };
  assert.throws(
    () => intakeCorpus({ bookId: "nudge", chapters: [3], deps: { readManifestText: () => JSON.stringify(notReady), collectSharedInputs: () => ["x"] } }),
    (err: unknown) => err instanceof CorpusIntakeError && /not bakeoff-ready/.test((err as Error).message),
    "a not-ready manifest must refuse intake",
  );
});

test("(f) a READY manifest whose target unit is still UNRESOLVED refuses (authoringSource gate is independent of the readiness flag)", () => {
  const fixture = { ...READY_FIXTURE, units: [{ ...READY_FIXTURE.units[0], authoringSource: "UNRESOLVED" }] };
  assert.throws(
    () => intakeCorpus({ bookId: "nudge", chapters: [3], deps: { readManifestText: () => JSON.stringify(fixture), collectSharedInputs: () => ["x"] } }),
    (err: unknown) => err instanceof CorpusIntakeError && /UNRESOLVED authoringSource/.test((err as Error).message),
  );
});

test("(f) a corpus chapter not present in the manifest units refuses", () => {
  assert.throws(
    () => intakeCorpus({ bookId: "nudge", chapters: [99], deps: { readManifestText: () => JSON.stringify(READY_FIXTURE), collectSharedInputs: () => ["x"] } }),
    (err: unknown) => err instanceof CorpusIntakeError && /no unit for nudge chapter 99/.test((err as Error).message),
  );
});

// ── (g) per-book calibration assignments are collision-free (rt702-R1) ───────

test("(g) every registered run's D7 calibration unit is collision-free (the rt702-R1 guard would not fire)", () => {
  assert.doesNotThrow(() => assertNoCalibrationCollisions());
  for (const run of SCREENING_PLAN.runs) {
    assert.equal(calibrationCollision(run), null, `${run.id} calibration unit must be disjoint from its book`);
    assert.notEqual(run.calibrationUnit.split("-ch")[0], run.bookId, `${run.id} calibration must be a different book`);
  }
});

test("(g) the collision check is not a no-op — a same-book calibration unit is flagged", () => {
  const colliding = { bookId: "nudge", unit: "nudge-ch03", calibrationUnit: "nudge-ch03" };
  assert.match(calibrationCollision(colliding) ?? "", /belongs to the book under test/);
  const collidingSibling = { bookId: "nudge", unit: "nudge-ch03", calibrationUnit: "nudge-ch07" };
  assert.match(calibrationCollision(collidingSibling) ?? "", /belongs to the book under test/);
});

// ── (h) gpt-5.5 advisory judge id REFUSED before any spawn ───────────────────

test("(h) assertBakeoffJudgeSupported refuses a legacy-baseline-family judge id and accepts a supported 5.6 id", () => {
  assert.throws(
    () => assertBakeoffJudgeSupported("gpt-5.5"),
    (err: unknown) => /UNSUPPORTED_MODEL_CONFIG/.test((err as Error).message) && /supported 5\.6 candidate/i.test((err as Error).message),
    "resolveRoute(requireSupportedModel) refuses a non-5.6 advisory judge id",
  );
  assert.doesNotThrow(() => assertBakeoffJudgeSupported("gpt-5.6-terra"));
  assert.doesNotThrow(() => assertBakeoffJudgeSupported("gpt-5.6-sol"));
});

test("(h) runBakeoff refuses an explicit gpt-5.5 advisory judge BEFORE any spawn", async () => {
  const dir = tmpRoot("cf-wp703-judge-");
  const draftPath = join(dir, "draft.md");
  writeFileSync(draftPath, "# A Draft\n\n" + "This is grounded manuscript text. ".repeat(20));
  const bundle = fakeBakeoffDeps();
  await assert.rejects(
    runBakeoff({
      draftPath,
      runId: "wp703-judge-refusal",
      models: ["gpt-5.6-sol", "gpt-5.6-terra"],
      judgeModel: "gpt-5.5",
      deps: bundle.deps,
      stateRoot: join(dir, "state"),
      acquireLock: () => ({ ok: true, release: () => {} }),
    }),
    (err: unknown) => /UNSUPPORTED_MODEL_CONFIG/.test((err as Error).message),
  );
  assert.equal(bundle.spawns.length, 0, "the run was refused BEFORE any spawn (no preflight probe, no candidate generation)");
});

// ── D7 dispatch seam (deliverable 3): ledgered, fail-closed ──────────────────

function fixtureD7Request(over: Partial<D7WorkerRequest> = {}): D7WorkerRequest {
  return {
    auditId: "bakeoff-stage1-nudge-ch03-a",
    bookId: "nudge",
    label: "A",
    unit: "nudge-ch03",
    role: "primary",
    kind: "candidate",
    task: "RATER TASK (already leak-checked by the judge)",
    ...over,
  };
}

test("D7 dispatch seam: a successful dispatch returns the record verbatim and ledgers ONE claude-side entry with a measured latency", async () => {
  const pipelineDir = tmpRoot("cf-wp703-dispatch-");
  let clock = 1000;
  const dispatch = createD7WorkerDispatch({
    sessionRunner: async () => "WORKER-RECORD-JSON",
    pipelineDir,
    now: () => (clock += 5),
  });
  const req = fixtureD7Request();
  const record = await dispatch(req);
  assert.equal(record, "WORKER-RECORD-JSON", "the external session's record is returned verbatim, never fabricated");

  const entries = readCallLedgerEntries(pipelineDir, "nudge", req.auditId);
  assert.equal(entries.length, 1, "exactly one ledger entry per real dispatch");
  const e = entries[0];
  assert.equal(e.family, "claude-side");
  assert.equal(e.stage, D7_DISPATCH_LEDGER_STAGE);
  assert.equal(e.role, "primary");
  assert.equal(e.model, null, "the external Claude session's model is unobservable — recorded null, never guessed");
  assert.equal(e.effort, null);
  assert.equal(e.outcome, "content_completed");
  assert.equal(e.sessionId, "bakeoff-stage1-nudge-ch03-a/nudge-ch03/primary");
  assert.equal(typeof e.latencyMs, "number");
  assert.ok((e.latencyMs ?? -1) >= 0, "a measured latency the pure-ingest choke point cannot observe");
});

test("D7 dispatch seam: a runner failure is ledgered (failure outcome) and re-thrown — never a fabricated record", async () => {
  const pipelineDir = tmpRoot("cf-wp703-dispatch-fail-");
  const dispatch = createD7WorkerDispatch({
    sessionRunner: async () => { throw new Error("isolated session crashed"); },
    pipelineDir,
  });
  await assert.rejects(dispatch(fixtureD7Request()), /isolated session crashed/);
  const entries = readCallLedgerEntries(pipelineDir, "nudge", "bakeoff-stage1-nudge-ch03-a");
  assert.equal(entries.length, 1);
  assert.notEqual(entries[0].outcome, "content_completed", "a failed dispatch is recorded as a failure, not a fake success");
});

test("D7 dispatch seam: the default (no operator session runner) is fail-closed — it refuses, never fabricates a rating", async () => {
  const pipelineDir = tmpRoot("cf-wp703-dispatch-unwired-");
  const dispatch = createD7WorkerDispatch({ pipelineDir });
  await assert.rejects(dispatch(fixtureD7Request()), /no isolated-Claude-session runner supplied/);
});
