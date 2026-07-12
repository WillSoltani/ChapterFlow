/**
 * IMP-20 §K (WP-C2) — closed-registry SYNC cross-check.
 *
 * The in-code `CLOSED_EXPERIMENT_IDS` Set is the SINGLE source of truth for the
 * §16 legacy-campaign resume freeze; the machine-readable closure record
 * (S16_LEGACY_CAMPAIGN_CLOSURE.json) MIRRORS it. This suite proves the two can
 * never drift apart and, critically, that editing the JSON ALONE can never
 * un-freeze anything (the in-code Set is a superset that is enforced regardless
 * of what the JSON lists). It further proves the freeze is MECHANICAL at ALL
 * THREE gate-able src/ chokes (not just the shared `assertNotClosed` primitive),
 * spot-verifies the preserved old evidence is byte-unchanged (test 34 support),
 * and proves every closure/recovery/corpus write target is OUTSIDE the canonical
 * chapter/book trees (test 35 support).
 *
 * No live model call (a throwing spawn proves the freeze fires first); no disk
 * write anywhere (every gated entry throws before any write; path checks are
 * pure). Leak-clean under CHAPTERFLOW_LEAK_GUARD=1.
 */

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { test, xenv } from "./harness.js";
import { PIPELINE_DIR } from "../src/bakeoff/paths.js";
import type { AutopilotDeps } from "../src/orchestrator/autopilot.js";
import {
  CLOSED_EXPERIMENT_IDS,
  MigrationGuardError,
  assertNotClosed,
  assertNotCanonical,
} from "../src/bakeoff/migration/guards.js";
import { runMigrationExperiment } from "../src/bakeoff/migration/runExperiment.js";
import { runNativeReviewQualification, type RunNativeReviewOptions } from "../src/bakeoff/migration/nativeReviewRunner.js";
import { sealNativeReview } from "../src/bakeoff/migration/nativeReviewSeal.js";
import type { ClosedExperimentRegistryV1 } from "../src/bakeoff/migration/reviewLaneTypes.js";
import { fakeAutopilotDeps } from "./model-bakeoff-helpers.js";

const MIG = resolve(PIPELINE_DIR, "state", "migration-experiments");
const CLOSURE_JSON = resolve(MIG, "S16_LEGACY_CAMPAIGN_CLOSURE.json");
const RECOVERY_ID = "s16-reviewer-recovery-v1";

/** The design §K canonical closed inventory — the exact ids that MUST be frozen
 *  in code (experiment-id slugs AND corpus/instrument ids). Hard-pinned so an
 *  accidental removal from the in-code Set fails this suite. */
const REQUIRED_CLOSED_IDS = [
  "diagnostic-stack-2026-07",
  "confirmatory-sol-2026-07",
  "diagnostic-stack-dryrun-2026-07",
  "confirmatory-dryrun-2026-07",
  "layer-n-v2-qualification",
  "s16-layer-n-native-review-v2",
  "stage-q-layer-o-v1",
  "stage-q-layer-o-v2",
  "stage-q-layer-o-v3",
  "layer-n-v1",
] as const;

function readClosure(): ClosedExperimentRegistryV1 {
  return JSON.parse(readFileSync(CLOSURE_JSON, "utf8")) as ClosedExperimentRegistryV1;
}

/** True only when the closure record AND every preserved artifact it references
 *  are present on disk (fail-closed to xenv on a bare checkout). */
function allPreservedPresent(): boolean {
  try {
    if (!existsSync(CLOSURE_JSON)) return false;
    const closure = readClosure();
    const keys = Object.keys(closure.preservedArtifactHashes);
    return keys.length > 0 && keys.every((rel) => existsSync(resolve(MIG, rel)));
  } catch {
    return false;
  }
}

// ── SYNC: in-code Set ⊇ closure JSON, and editing the JSON alone can't un-freeze ─

test("sync: in-code CLOSED_EXPERIMENT_IDS ⊇ the closure JSON closed-id list (JSON alone cannot un-freeze)", () => {
  const closure = readClosure();

  // The required §K inventory is present in code regardless of the JSON — the
  // in-code Set, not the file, is the enforcement authority.
  for (const id of REQUIRED_CLOSED_IDS) {
    assert.ok(CLOSED_EXPERIMENT_IDS.has(id), `required §K id "${id}" must be frozen in code`);
    assert.throws(() => assertNotClosed(id), MigrationGuardError, `required §K id "${id}" must fail closed`);
  }
  assert.ok(CLOSED_EXPERIMENT_IDS.size >= REQUIRED_CLOSED_IDS.length);

  // SUPERSET: every id the JSON lists is enforced in code. Even if a future edit
  // deletes ids from the JSON, the in-code freeze still throws for them.
  assert.equal(
    closure.closedExperimentIds.length,
    new Set(closure.closedExperimentIds).size,
    "no duplicate ids in the closure JSON",
  );
  for (const id of closure.closedExperimentIds) {
    assert.ok(CLOSED_EXPERIMENT_IDS.has(id), `JSON closed id "${id}" is NOT enforced in code — sync drift`);
    assert.throws(() => assertNotClosed(id), MigrationGuardError, `JSON closed id "${id}" must fail closed in code`);
  }

  // MIRROR: the JSON reflects the in-code Set exactly (no id in code that the
  // record omits). Together with the superset check above this pins bidirectional
  // sync — a change to either surface without the other fails here.
  assert.deepEqual(new Set(closure.closedExperimentIds), CLOSED_EXPERIMENT_IDS);
});

// ── the closure record: frozen status + exact call ledger ───────────────────────

test("closure record: frozen status + exact call ledger (711 / 811 / 2096 / 0 / 0) + arithmetic", () => {
  const closure = readClosure();
  assert.equal(closure.schema, "split-lane-closed-experiment-registry-v1");
  assert.equal(closure.status, "ARCHIVED_INCONCLUSIVE_REVIEW_INSTRUMENT_MISMATCH");
  assert.equal(closure.canResume, false);
  assert.equal(closure.authoringMigrationDecisionProduced, false);
  assert.equal(closure.oldArtifactsImmutable, true);
  assert.equal(closure.oldResultsAreDevelopmentEvidence, true);

  const l = closure.callLedger;
  assert.equal(l.campaignTotalConsumed, 711, "711 §16-ledgered live calls");
  assert.equal(l.totalLiveCallsEverIncludingLayerNv1, 811, "811 total live calls ever (+100 Layer-N v1)");
  assert.equal(l.stageQLayerOCalls, 540);
  assert.equal(l.layerNv2Calls, 171);
  assert.equal(l.layerNv1Calls, 100);
  assert.equal(l.sealedHardMax, 2096, "old sealed hard-max ceiling recorded (NOT reused by recovery)");
  assert.equal(l.diagnosticCalls, 0, "no §16 diagnostic calls consumed");
  assert.equal(l.confirmatoryCalls, 0, "no §16 confirmatory calls consumed");
  // Arithmetic identities: 540 + 171 = 711; 711 + 100 = 811.
  assert.equal(l.stageQLayerOCalls + l.layerNv2Calls, l.campaignTotalConsumed);
  assert.equal(l.campaignTotalConsumed + l.layerNv1Calls, l.totalLiveCallsEverIncludingLayerNv1);
});

// ── the go-forward recovery id is NOT closed ────────────────────────────────────

test("s16-reviewer-recovery-v1 is NOT closed (go-forward id passes the freeze)", () => {
  assert.ok(!CLOSED_EXPERIMENT_IDS.has(RECOVERY_ID), "the recovery id must not be frozen");
  assert.doesNotThrow(() => assertNotClosed(RECOVERY_ID), "the recovery id must pass every gate's freeze");

  const closure = readClosure();
  assert.ok(!closure.closedExperimentIds.includes(RECOVERY_ID), "the recovery id is absent from the closure record");

  // A fresh synthetic id is likewise free — the freeze is exact, not a prefix ban.
  assert.doesNotThrow(() => assertNotClosed("zz-fixture-not-closed"));
});

// ── the freeze is MECHANICAL at ALL THREE gate-able src/ chokes ──────────────────

test("every CLOSED id fail-closes at all three gate-able src/ entries", async () => {
  // A throwing spawn proves the freeze fires BEFORE any live model call.
  const throwingSpawn = (async () => {
    throw new Error("a closed-registry-sync test must never spawn");
  }) as unknown as AutopilotDeps["spawn"];
  const deps = fakeAutopilotDeps({ spawn: throwingSpawn }) as Partial<AutopilotDeps>;

  for (const id of CLOSED_EXPERIMENT_IDS) {
    // (1) runMigrationExperiment gates on experimentId.
    await assert.rejects(
      runMigrationExperiment({ experimentId: id, deps, log: () => {} }),
      MigrationGuardError,
      `runMigrationExperiment must refuse closed experiment id "${id}"`,
    );

    // (2) sealNativeReview gates on corpus.corpusId (first statement).
    const sealArgs = { corpus: { corpusId: id, items: [] } } as unknown as Parameters<typeof sealNativeReview>[0];
    assert.throws(
      () => sealNativeReview(sealArgs),
      MigrationGuardError,
      `sealNativeReview must refuse closed corpus id "${id}"`,
    );

    // (3) runNativeReviewQualification gates on corpus.corpusId — the Layer-N v2
    //     LIVE entry (feasibility-issue-1 regression).
    const runOpts = {
      corpus: { corpusId: id, items: [] },
      judge: { model: "gpt-5.5", effort: "high" },
      log: () => {},
    } as unknown as RunNativeReviewOptions;
    await assert.rejects(
      runNativeReviewQualification(runOpts),
      MigrationGuardError,
      `runNativeReviewQualification must refuse closed corpus id "${id}"`,
    );
  }
});

// ── test 34 support: preserved §16 evidence byte-unchanged (spot-verify) ─────────

xenv(
  "test 34 support: preserved §16 artifacts recompute to the closure preservedArtifactHashes map",
  "preserved migration-experiment evidence absent on a bare checkout",
  allPreservedPresent,
  () => {
    const closure = readClosure();
    const entries = Object.entries(closure.preservedArtifactHashes);
    assert.ok(entries.length >= 20, "preserved-artifact immutability map is populated");
    const sha256 = (abs: string): string => createHash("sha256").update(readFileSync(abs)).digest("hex");
    for (const [rel, expected] of entries) {
      // Path discipline: preserved evidence lives UNDER the migration tree, never
      // in a canonical chapter/book tree.
      const abs = resolve(MIG, rel);
      assert.ok(abs.startsWith(MIG + "/"), `preserved artifact ${rel} must live under the migration tree`);
      assert.equal(sha256(abs), expected, `preserved §16 artifact ${rel} changed — old evidence must be immutable`);
    }
  },
);

// ── test 35 support: no closure/recovery/corpus write can land in canonical state ─

test("test 35 support: every closure/recovery/corpus write target is OUTSIDE the canonical trees", () => {
  // The sanctioned non-canonical write targets (§K/§M/§H) — assertNotCanonical
  // is a PURE path check, so these need not exist on disk to prove the property.
  const sanctioned = [
    CLOSURE_JSON,
    resolve(MIG, "s16-reviewer-recovery-v1", "spec.json"),
    resolve(MIG, "s16-reviewer-recovery-v1", "seal-prep.json"),
    resolve(MIG, "s16-reviewer-recovery-v1", "pilot-dryrun", "manifest.json"),
    resolve(MIG, "contracts", "reader-corpus.v1.json"),
    resolve(MIG, "contracts", "source-corpus.v1.json"),
    resolve(MIG, "contracts", "quiz-corpus.v1.json"),
    resolve(MIG, "contracts", "schemas", "reader-experience-review.schema.json"),
  ];
  for (const abs of sanctioned) {
    assert.doesNotThrow(
      () => assertNotCanonical(abs),
      `sanctioned migration target must be writable (non-canonical): ${abs}`,
    );
  }

  // The canonical chapter/book trees are REFUSED — a recovery/closure/corpus
  // write can never mutate canonical state, even by misconfiguration.
  const canonical = [
    resolve(PIPELINE_DIR, "state", "chapters", "x.chapter.json"),
    resolve(PIPELINE_DIR, "state", "books", "b.json"),
    resolve(PIPELINE_DIR, "state", "provenance", "p.json"),
    resolve(PIPELINE_DIR, "state", "indexes", "i.json"),
    resolve(PIPELINE_DIR, "book-packages", "x.v21.json"),
  ];
  for (const abs of canonical) {
    assert.throws(
      () => assertNotCanonical(abs),
      MigrationGuardError,
      `canonical target must be refused: ${abs}`,
    );
  }
});
