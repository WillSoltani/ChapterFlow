/**
 * IMP-20 §K (WP-B8) — §16 legacy-campaign closure + mechanical resume freeze.
 *
 * Proves the freeze is MECHANICAL (not a cosmetic status field): every CLOSED
 * §16 identity fail-closes at the gate-able src/ chokes, the go-forward recovery
 * id passes, the closure record mirrors the in-code CLOSED_EXPERIMENT_IDS + the
 * exact call ledger (711 / 811 / 2096 / 0 / 0), and the preserved old evidence is
 * byte-unchanged (test 34, xenv-guarded — preserved dirs may be absent on a bare
 * checkout). No live model call, no disk write to any campaign dir.
 */

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { test, xenv } from "./harness.js";
import type { AutopilotDeps } from "../src/orchestrator/autopilot.js";
import {
  CLOSED_EXPERIMENT_IDS,
  MigrationGuardError,
  assertNotClosed,
} from "../src/bakeoff/migration/guards.js";
import { runMigrationExperiment } from "../src/bakeoff/migration/runExperiment.js";
import { runNativeReviewQualification, type RunNativeReviewOptions } from "../src/bakeoff/migration/nativeReviewRunner.js";
import { sealNativeReview } from "../src/bakeoff/migration/nativeReviewSeal.js";
import type { ClosedExperimentRegistryV1 } from "../src/bakeoff/migration/reviewLaneTypes.js";
import { fakeAutopilotDeps } from "./model-bakeoff-helpers.js";

const MIG = resolve("state/migration-experiments");
const CLOSURE_JSON = resolve(MIG, "S16_LEGACY_CAMPAIGN_CLOSURE.json");

const CLOSED_CORPUS_ID = "s16-layer-n-native-review-v2";
const RECOVERY_ID = "s16-reviewer-recovery-v1";

function readClosure(): ClosedExperimentRegistryV1 {
  return JSON.parse(readFileSync(CLOSURE_JSON, "utf8")) as ClosedExperimentRegistryV1;
}

/** True only when the closure record AND every preserved artifact it references
 *  are present on disk (fail-closed to xenv on a bare checkout). */
function allPreservedPresent(): boolean {
  try {
    if (!existsSync(CLOSURE_JSON)) return false;
    const closure = readClosure();
    return Object.keys(closure.preservedArtifactHashes).every((rel) => existsSync(resolve(MIG, rel)));
  } catch {
    return false;
  }
}

// ── assertNotClosed unit behavior ──────────────────────────────────────────────

test("assertNotClosed throws for every CLOSED §16 id and passes any new id", () => {
  assert.ok(CLOSED_EXPERIMENT_IDS.size >= 10, "the closed set holds every archived experiment/corpus/instrument id");
  for (const id of CLOSED_EXPERIMENT_IDS) {
    assert.throws(() => assertNotClosed(id), MigrationGuardError, `closed id ${id} must fail closed`);
  }
  // The go-forward recovery id is NOT frozen; ordinary synthetic ids are free.
  assert.doesNotThrow(() => assertNotClosed(RECOVERY_ID));
  assert.doesNotThrow(() => assertNotClosed("exp-cond1"));
  assert.doesNotThrow(() => assertNotClosed("zz-fixture-experiment"));
});

// ── integration 12: no closed experiment can resume via the conductor ──────────

test("integration 12: runMigrationExperiment refuses to resume any CLOSED experiment id", async () => {
  // A throwing spawn proves NO live call is reachable — the freeze fires first.
  const throwingSpawn = (async () => {
    throw new Error("a closure test must never spawn");
  }) as unknown as AutopilotDeps["spawn"];
  const deps = fakeAutopilotDeps({ spawn: throwingSpawn }) as Partial<AutopilotDeps>;
  for (const id of ["diagnostic-stack-2026-07", "confirmatory-sol-2026-07", "layer-n-v2-qualification"]) {
    await assert.rejects(
      runMigrationExperiment({ experimentId: id, deps, log: () => {} }),
      MigrationGuardError,
      `resuming ${id} must halt before any live work`,
    );
  }
});

// ── feasibility-issue-1 regression: the Layer-N v2 LIVE entry is gated ──────────

test("feasibility-1 regression: runNativeReviewQualification refuses the closed Layer-N v2 corpus id", async () => {
  // assertNotClosed(opts.corpus.corpusId) is the first statement, so a minimal
  // corpus (only the id) reaches the throw before any real work.
  const opts = {
    corpus: { corpusId: CLOSED_CORPUS_ID, items: [] },
    judge: { model: "gpt-5.5", effort: "high" },
    log: () => {},
  } as unknown as RunNativeReviewOptions;
  await assert.rejects(runNativeReviewQualification(opts), MigrationGuardError);
});

test("sealNativeReview refuses to re-seal the closed Layer-N v2 corpus id", () => {
  const args = {
    corpus: { corpusId: CLOSED_CORPUS_ID, items: [] },
  } as unknown as Parameters<typeof sealNativeReview>[0];
  assert.throws(() => sealNativeReview(args), MigrationGuardError);
});

// ── the closure record: status + ledger + mirrored closed-id set ────────────────

test("closure record: status, exact call ledger, and the mirrored closed-id set", () => {
  const closure = readClosure();
  assert.equal(closure.schema, "split-lane-closed-experiment-registry-v1");
  assert.equal(closure.status, "ARCHIVED_INCONCLUSIVE_REVIEW_INSTRUMENT_MISMATCH");
  assert.equal(closure.canResume, false);
  assert.equal(closure.authoringMigrationDecisionProduced, false);
  assert.equal(closure.oldArtifactsImmutable, true);
  assert.equal(closure.oldResultsAreDevelopmentEvidence, true);

  // BOTH totals stated explicitly: 711 ledgered, 811 ever (+100 Layer-N v1).
  const l = closure.callLedger;
  assert.equal(l.campaignTotalConsumed, 711);
  assert.equal(l.totalLiveCallsEverIncludingLayerNv1, 811);
  assert.equal(l.stageQLayerOCalls, 540);
  assert.equal(l.layerNv2Calls, 171);
  assert.equal(l.layerNv1Calls, 100);
  assert.equal(l.sealedHardMax, 2096);
  assert.equal(l.diagnosticCalls, 0);
  assert.equal(l.confirmatoryCalls, 0);
  assert.equal(l.stageQLayerOCalls + l.layerNv2Calls, l.campaignTotalConsumed, "540 + 171 = 711");
  assert.equal(l.campaignTotalConsumed + l.layerNv1Calls, l.totalLiveCallsEverIncludingLayerNv1, "711 + 100 = 811");

  // The JSON's closedExperimentIds MIRRORS the in-code Set (no duplicates; set-equal).
  assert.equal(closure.closedExperimentIds.length, new Set(closure.closedExperimentIds).size, "no duplicate closed ids");
  assert.equal(closure.closedExperimentIds.length, CLOSED_EXPERIMENT_IDS.size);
  assert.deepEqual(new Set(closure.closedExperimentIds), CLOSED_EXPERIMENT_IDS);
  for (const id of closure.closedExperimentIds) {
    assert.throws(() => assertNotClosed(id), MigrationGuardError, `mirrored id ${id} is enforced in code`);
  }

  // Full inventory recorded: seals, per-lane histories, R-2b residual.
  assert.ok(closure.oldSeals.length >= 5, "old experiment/instrument seals inventoried");
  assert.ok(closure.stageQHistory.length >= 3 && closure.layerNHistory.length >= 4, "Stage-Q + Layer-N history recorded");
  assert.ok(
    closure.unresolvedRisks.some((r) => r.startsWith("R-2b")),
    "the un-mechanizable Stage-Q Layer-O raw-spawn residual is recorded honestly",
  );
  assert.ok(Object.keys(closure.preservedArtifactHashes).length >= 20, "preserved-artifact immutability map is populated");

  // The go-forward recovery id must NOT be in the closed set.
  assert.ok(!closure.closedExperimentIds.includes(RECOVERY_ID));
});

// ── test 34: old campaign artifacts byte-unchanged (xenv-guarded) ───────────────

xenv(
  "test 34: every preserved §16 artifact is byte-unchanged (recomputed sha256 == closure map)",
  "preserved migration-experiment evidence absent on a bare checkout",
  allPreservedPresent,
  () => {
    const closure = readClosure();
    const sha256 = (abs: string): string => createHash("sha256").update(readFileSync(abs)).digest("hex");
    for (const [rel, expected] of Object.entries(closure.preservedArtifactHashes)) {
      const abs = resolve(MIG, rel);
      assert.equal(sha256(abs), expected, `preserved §16 artifact ${rel} changed — old evidence must be immutable`);
    }
  },
);
