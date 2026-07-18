/** Stage-0b D7-lite drill driver (scripts/screening/run-d7lite-drill.mts).
 * Proves with an injected dispatch double (nothing spawns):
 *  (1) exactly ONE single-rater "primary" calibration session per registered
 *      drill unit — never the 3-role choreography, never a retry;
 *  (2) the derived-diagnostic comparison math — the summary's per-unit score is
 *      deriveRecordAggregates' chapter diagnostic and delta = |derived − anchor|
 *      against the sealed owner-adjudicated values, tolerance ±3.0;
 *  (3) the P3 verdict BOTH ways (all |Δ| ≤ 3.0 → rule-7 alive; any miss →
 *      rule 7 dropped / descriptive-only), plus fail-closed drops on an
 *      incomplete drill;
 *  (4) hard session-cap enforcement BEFORE the offending spawn (and that a
 *      resume re-ingest never counts as spend).
 * Zero model/api calls; all custody lands under a disposable temp root. */

import assert from "node:assert/strict";
import { copyFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

import { test } from "./harness.js";
import { mkTestRoots } from "./testRoots.js";
import { PIPELINE_DIR } from "../src/bakeoff/paths.js";
import type { D7WorkerDispatch, D7WorkerRequest } from "../src/bakeoff/d7Judge.js";
import {
  RUBRIC_CALIBRATION_REFERENCES,
  RUBRIC_DOMAINS,
  deriveRecordAggregates,
} from "../src/bakeoff/migration/rubricAuditInstrument.js";
import { extractRecordSkeleton } from "../src/bakeoff/migration/rubricAuditHarness.js";
import type { JsonRecord } from "../src/bakeoff/migration/rubricAuditReceipts.js";
import {
  D7LITE_DRILL_UNITS,
  D7LITE_SESSION_CAP,
  D7LITE_TOLERANCE,
  runD7LiteDrill,
  type D7LiteDrillDeps,
  type D7LiteProbeGateResult,
} from "../scripts/screening/run-d7lite-drill.mjs";

const REPOSITORY_ROOT = resolve(PIPELINE_DIR, "../../../..");

/** Temp repo carrying the three sealed calibration docs at their registered
 *  rel-paths (byte-copies of the tracked worktree docs, so the harness's
 *  owner-sha checks hold). */
function makeDrillRepo(prefix: string): { base: string; dispose: () => void } {
  const roots = mkTestRoots(prefix);
  for (const ref of RUBRIC_CALIBRATION_REFERENCES) {
    const abs = resolve(roots.base, ref.docRelPath);
    mkdirSync(dirname(abs), { recursive: true });
    copyFileSync(resolve(REPOSITORY_ROOT, ref.docRelPath), abs);
  }
  return { base: roots.base, dispose: roots.dispose };
}

type RatingFor = (domainKey: string, subIndex: number) => number;

/** A valid rater record: the task's own ingest-valid fill-in skeleton with the
 *  32 atomic ratings replaced (identity/source/scope binding kept verbatim). */
function ratedRecordFromTask(task: string, ratingFor: RatingFor): string {
  const skeleton = extractRecordSkeleton(task);
  const domains = skeleton.domains as Record<string, JsonRecord>;
  for (const spec of RUBRIC_DOMAINS) {
    const subs = domains[spec.key].subcriteria as Record<string, JsonRecord>;
    spec.subcriteria.forEach((sub, index) => {
      subs[sub].rating = ratingFor(spec.key, index);
    });
  }
  return JSON.stringify(skeleton);
}

function makeDispatch(args: {
  calls: D7WorkerRequest[];
  ratingFor: RatingFor;
  sessionKind?: "session" | "reingest";
}): D7WorkerDispatch {
  return async (req) => {
    args.calls.push(req);
    return {
      record: ratedRecordFromTask(req.task, args.ratingFor),
      dispatchMeta: {
        model: "gpt-5.6-sol",
        effort: "ultra",
        sessionId: `test-${req.unit}`,
        manifestSha256: "test-manifest-sha",
        manifestPath: "/dev/null",
        sessionKind: args.sessionKind ?? "session",
        attemptIndex: 1,
      },
    };
  };
}

const probeOk = async (): Promise<D7LiteProbeGateResult> => ({
  ok: true,
  sidecarSha256: "test-probe-sha",
  reused: true,
  sessionsSpent: 0,
});

function baseDeps(repoBase: string, dispatch: D7WorkerDispatch): D7LiteDrillDeps {
  return {
    dispatch,
    repositoryRoot: repoBase,
    outDir: resolve(repoBase, "drill-out"),
    probeGate: probeOk,
    log: () => {},
    clock: () => new Date("2026-07-18T00:00:00.000Z"),
  };
}

/** Mixed integer ratings landing the derived diagnostic ≈69.47 — within ±3.0 of
 *  ALL three sealed anchors (67.664 / 68.816 / 70.757). */
const passRating: RatingFor = (domainKey, subIndex) =>
  domainKey === "epistemic_integrity" ? 2 : domainKey === "audience_fit" && subIndex < 2 ? 2 : 3;

/** All-3s → derived exactly 75 — misses every anchor by > 3.0. */
const missRating: RatingFor = () => 3;

test("d7lite drill: one primary calibration session per unit; derived-diagnostic math; rule-7 ALIVE when all |Δ| ≤ 3.0", async () => {
  const repo = makeDrillRepo("d7lite-pass");
  try {
    const calls: D7WorkerRequest[] = [];
    const { summary, outPath, exitCode } = await runD7LiteDrill({
      runHash: "t-pass",
      deps: baseDeps(repo.base, makeDispatch({ calls, ratingFor: passRating })),
    });

    // (1) Single-rater choreography: exactly one dispatch per registered unit,
    // every one a "primary"-role calibration session, first attempt, no retry.
    assert.equal(calls.length, D7LITE_DRILL_UNITS.length);
    assert.deepEqual(calls.map((c) => c.unit), D7LITE_DRILL_UNITS.map((u) => u.unit));
    for (const call of calls) {
      assert.equal(call.role, "primary");
      assert.equal(call.kind, "calibration");
      assert.equal(call.attempt, 1);
      assert.equal(call.auditId, "d7lite-t-pass");
    }

    // (2) Comparison math: the summary score IS the instrument-derived chapter
    // diagnostic and delta = |derived − sealed anchor|.
    assert.equal(summary.units.length, D7LITE_DRILL_UNITS.length);
    for (const [index, unit] of summary.units.entries()) {
      const record = JSON.parse(ratedRecordFromTask(calls[index].task, passRating)) as JsonRecord;
      const expected = deriveRecordAggregates(record);
      assert.ok(expected !== null);
      assert.equal(unit.derivedDiagnostic, expected.chapterDiagnostic);
      assert.equal(unit.delta, Math.abs(expected.chapterDiagnostic - unit.anchorValue));
      assert.ok(unit.delta !== null && unit.delta <= D7LITE_TOLERANCE, `${unit.unit} |Δ|=${unit.delta} should be ≤ ${D7LITE_TOLERANCE}`);
      assert.equal(unit.pass, true);
      assert.equal(unit.sessionKind, "session");
      // The record went through the real fail-closed ingest and was persisted.
      assert.ok(unit.persistedPath !== null && existsSync(unit.persistedPath), `${unit.unit} custody record persisted`);
    }
    // Anchors are the sealed owner-adjudicated values, resolved not retyped.
    assert.deepEqual(
      summary.units.map((u) => u.anchorValue),
      D7LITE_DRILL_UNITS.map((u) => RUBRIC_CALIBRATION_REFERENCES.find((r) => r.unit === u.unit)!.expectedChapterDiagnostic),
    );

    // (3) P3 verdict, alive side + spend accounting + summary sink.
    assert.equal(summary.verdict.allUnitsComplete, true);
    assert.equal(summary.verdict.allPass, true);
    assert.equal(summary.verdict.rule7, "alive");
    assert.equal(summary.sessionsSpent, 3);
    assert.equal(summary.sessionCap, D7LITE_SESSION_CAP);
    assert.deepEqual(summary.raterModels, ["gpt-5.6-sol"]);
    assert.equal(exitCode, 0);
    assert.ok(outPath !== null && outPath.endsWith("d7lite-drill-summary-t-pass.json"));
    const onDisk = JSON.parse(readFileSync(outPath, "utf8")) as { schema: string; verdict: { rule7: string } };
    assert.equal(onDisk.schema, "v25-d7lite-drill-summary-v1");
    assert.equal(onDisk.verdict.rule7, "alive");
  } finally {
    repo.dispose();
  }
});

test("d7lite drill: P3 verdict drops rule 7 (descriptive-only) when any unit misses the ±3.0 tolerance", async () => {
  const repo = makeDrillRepo("d7lite-miss");
  try {
    const calls: D7WorkerRequest[] = [];
    const { summary, exitCode } = await runD7LiteDrill({
      runHash: "t-miss",
      deps: baseDeps(repo.base, makeDispatch({ calls, ratingFor: missRating })),
    });
    assert.equal(calls.length, 3);
    for (const unit of summary.units) {
      assert.equal(unit.derivedDiagnostic, 75); // all-3s → (3/4)·100 exactly
      assert.ok(unit.delta !== null && unit.delta > D7LITE_TOLERANCE);
      assert.equal(unit.pass, false);
    }
    assert.equal(summary.verdict.allUnitsComplete, true);
    assert.equal(summary.verdict.allPass, false);
    assert.equal(summary.verdict.rule7, "dropped");
    assert.match(summary.verdict.detail, /descriptive-only/);
    // A completed drill with a calibration miss is a VALID scientific outcome,
    // not an infra failure: exit 0, verdict carries the drop.
    assert.equal(exitCode, 0);
  } finally {
    repo.dispose();
  }
});

test("d7lite drill: hard session cap halts BEFORE the offending spawn; incomplete drill drops rule 7 fail-closed", async () => {
  const repo = makeDrillRepo("d7lite-cap");
  try {
    const calls: D7WorkerRequest[] = [];
    const { summary, exitCode } = await runD7LiteDrill({
      runHash: "t-cap",
      sessionCap: 2,
      deps: baseDeps(repo.base, makeDispatch({ calls, ratingFor: passRating })),
    });
    // Only two dispatches ever happen — the third unit is never spawned.
    assert.equal(calls.length, 2);
    assert.equal(summary.sessionsSpent, 2);
    const third = summary.units[2];
    assert.equal(third.derivedDiagnostic, null);
    assert.match(String(third.skipped), /BUDGET HALT/);
    // Fail closed: an incomplete drill can never leave rule 7 alive.
    assert.equal(summary.verdict.allUnitsComplete, false);
    assert.equal(summary.verdict.rule7, "dropped");
    assert.equal(exitCode, 3);
  } finally {
    repo.dispose();
  }
});

test("d7lite drill: a resume re-ingest (sessionKind reingest) is never counted as live spend", async () => {
  const repo = makeDrillRepo("d7lite-reingest");
  try {
    const calls: D7WorkerRequest[] = [];
    const { summary, exitCode } = await runD7LiteDrill({
      runHash: "t-re",
      deps: baseDeps(repo.base, makeDispatch({ calls, ratingFor: passRating, sessionKind: "reingest" })),
    });
    assert.equal(calls.length, 3);
    assert.equal(summary.sessionsSpent, 0);
    assert.equal(summary.units.every((u) => u.sessionKind === "reingest"), true);
    assert.equal(summary.verdict.rule7, "alive");
    assert.equal(exitCode, 0);
  } finally {
    repo.dispose();
  }
});

test("d7lite drill: a failed probe gate spawns nothing and exits 2 with every unit skipped", async () => {
  const repo = makeDrillRepo("d7lite-probe");
  try {
    const calls: D7WorkerRequest[] = [];
    const probeFail = async (): Promise<D7LiteProbeGateResult> => ({
      ok: false,
      detail: "probe rejected (test)",
      sessionsSpent: 1,
    });
    const { summary, exitCode } = await runD7LiteDrill({
      runHash: "t-probe",
      deps: { ...baseDeps(repo.base, makeDispatch({ calls, ratingFor: passRating })), probeGate: probeFail },
    });
    assert.equal(calls.length, 0);
    assert.equal(summary.sessionsSpent, 1);
    assert.equal(summary.units.every((u) => u.skipped === "probe gate failed"), true);
    assert.equal(summary.verdict.rule7, "dropped");
    assert.equal(exitCode, 2);
  } finally {
    repo.dispose();
  }
});
