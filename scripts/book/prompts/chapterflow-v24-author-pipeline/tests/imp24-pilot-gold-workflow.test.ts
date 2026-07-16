import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { PIPELINE_DIR } from "../src/bakeoff/paths.js";
import { runMigrationBakeoffCli } from "../src/bakeoff/migration/cli.js";
import {
  assertExactImp24EnvelopeManifest,
  assertImp24GoldManifestPilotBinding,
  runImp24GoldV2EnvelopeLive,
  runImp24PilotV2EnvelopeLive,
} from "../src/bakeoff/migration/imp24PilotGoldWorkflow.js";
import { hashCanonical } from "../src/contracts/contractUtil.js";
import {
  materializeImp24ForwardInputs,
} from "../src/orchestrator/forwardInputMaterialization.js";
import {
  validateForwardInputMaterializationBinding,
} from "../src/orchestrator/forwardLiveArtifactMaterializer.js";
import {
  buildGoldManifestV2Envelope,
  buildPilotManifest,
  buildPilotManifestV2Envelope,
  GOLD_ENVELOPE_EXPERIMENT_ID,
  PILOT_ENVELOPE_EXPERIMENT_ID,
} from "../src/orchestrator/forwardValidationCampaign.js";
import { test } from "./harness.js";
import { mkTestRoots } from "./testRoots.js";

const HASH = "a".repeat(64);

test("IMP-24 pilot/gold live entrypoints stop at the literal dry barrier before fixed artifact or auth reads", async () => {
  for (const value of [undefined, false, "true", 1] as const) {
    const pilot = await runImp24PilotV2EnvelopeLive(value);
    const gold = await runImp24GoldV2EnvelopeLive(value);
    assert.equal(pilot.executed, false);
    assert.equal(gold.executed, false);
    assert.equal(pilot.code, 2);
    assert.equal(gold.code, 2);
    assert.equal(pilot.modelCalls, 0);
    assert.equal(gold.modelCalls, 0);
    assert.equal(pilot.apiCalls, 0);
    assert.equal(gold.apiCalls, 0);
  }
});

test("IMP-24 envelope shape gate pins the fresh 8-chapter pilot and full 13-chapter gold identities", () => {
  const roots = mkTestRoots("imp24-pilot-gold-shape");
  try {
    const materialized = materializeImp24ForwardInputs(roots.base);
    const inputMaterializationSha256 = validateForwardInputMaterializationBinding(
      materialized.freeze,
      materialized.materialization,
    );
    const common = {
      frozenAtIso: materialized.freeze.frozenAtIso,
      roleAssignmentSha256: HASH,
      instrumentManifestSha256: "b".repeat(64),
      thresholdsSha256: "c".repeat(64),
      inputMaterializationSha256,
      productionInstrumentSealSha256: "d".repeat(64),
      qualificationBookIds: materialized.freeze.sets.qualificationBookIds,
    };
    const pilot = buildPilotManifestV2Envelope({
      ...common,
      books: materialized.freeze.pilot,
      goldReservedBookIds: materialized.freeze.sets.goldBookIds,
    });
    assertExactImp24EnvelopeManifest("pilot", pilot, materialized.freeze);
    assert.equal(pilot.manifest.experimentId, PILOT_ENVELOPE_EXPERIMENT_ID);
    assert.equal(pilot.manifest.targets.length, 8);

    const gold = buildGoldManifestV2Envelope({
      ...common,
      books: [materialized.freeze.gold],
      pilotBookIds: materialized.freeze.sets.pilotBookIds,
      pilotAccepted: true,
      pilotManifestSha256: pilot.manifestSha256,
      pilotResultSha256: "e".repeat(64),
      goldEvaluatorInstrumentSha256: "f".repeat(64),
    });
    assertExactImp24EnvelopeManifest("gold", gold, materialized.freeze);
    assert.equal(gold.manifest.experimentId, GOLD_ENVELOPE_EXPERIMENT_ID);
    assert.equal(materialized.freeze.goldChapterCount, 13);
    assert.equal(gold.manifest.targets.length, 13);
    assertImp24GoldManifestPilotBinding(gold, pilot.manifestSha256, "e".repeat(64));
    const stalePilotManifest = { ...gold.manifest, pilotResultSha256: "0".repeat(64) };
    const stalePilotBinding = { manifest: stalePilotManifest, manifestSha256: hashCanonical(stalePilotManifest) };
    assert.throws(() => assertImp24GoldManifestPilotBinding(
      stalePilotBinding,
      pilot.manifestSha256,
      "e".repeat(64),
    ), /does not bind the freshly verified retained pilot/);

    const legacy = buildPilotManifest({
      ...common,
      books: materialized.freeze.pilot,
      goldReservedBookIds: materialized.freeze.sets.goldBookIds,
    });
    assert.throws(() => assertExactImp24EnvelopeManifest("pilot", legacy, materialized.freeze),
      /refuses a legacy or substituted experiment identity/);

    const truncatedGold = structuredClone(gold);
    truncatedGold.manifest.targets.pop();
    truncatedGold.manifestSha256 = hashCanonical(truncatedGold.manifest);
    assert.throws(() => assertExactImp24EnvelopeManifest("gold", truncatedGold, materialized.freeze),
      /exact 13-chapter denominator/);
  } finally {
    roots.dispose();
  }
});

test("IMP-24 production pilot/gold boundary wires only the explicit V3 adapter and exposes no fake process seam", () => {
  const source = readFileSync(resolve(PIPELINE_DIR, "src/bakeoff/migration/imp24PilotGoldWorkflow.ts"), "utf8");
  assert.match(source, /await runForwardLiveCampaignV3FromExplicitArtifacts\(\{/);
  assert.doesNotMatch(source, /runForwardLiveCampaignFromExplicitArtifacts/);
  assert.doesNotMatch(source, /runForwardLiveCampaignCliBoundary/);
  assert.doesNotMatch(source, /qualificationBundlePath|calibrationSealPath|calibrationInspectionPath/);
  assert.doesNotMatch(source, /\bspawn\s*:/);
  assert.doesNotMatch(source, /preCallVerifier|injectedRunner|callerEnv|authJsonPath\?:/);
  assert.match(source, /runImp24PilotV2EnvelopeLive\(\s*executeLive: unknown/);
  assert.match(source, /runImp24GoldV2EnvelopeLive\(\s*executeLive: unknown/);
});

test("IMP-24 CLI first-barrier closes every V2 pilot/gold transition and exposes only versioned live commands", async () => {
  const errors: string[] = [];
  const originalError = console.error;
  console.error = (...values: unknown[]) => { errors.push(values.map(String).join(" ")); };
  try {
    for (const subverb of [
      "role-qualification-freeze",
      "forward-materialize-pilot-artifacts",
      "forward-materialize-gold-artifacts",
      "forward-pilot",
      "forward-gold",
    ]) {
      const code = await runMigrationBakeoffCli([subverb], {
        campaign: true, // WP-202: un-gate so the CLOSED-experiment disposition still refuses
        "execute-live": true,
        write: true,
        experiment: "s16-forward-role-qualification-v2",
        "phase-dir": "/must-not-be-read",
        manifest: "/must-not-be-read",
      });
      assert.equal(code, 2, `${subverb} must be closed`);
      assert.ok(errors.some((line) => line.includes(subverb)
        && line.includes("s16-forward-role-qualification-v2")
        && line.includes("BLOCKED_CALIBRATION_INVALID")), `${subverb} must print the exact retained disposition`);
    }
    for (const subverb of ["imp24-pilot-v2-envelope", "imp24-gold-v2-envelope"]) {
      assert.equal(await runMigrationBakeoffCli([subverb], { campaign: true }), 2);
      assert.ok(errors.some((line) => line.includes("executeLive must be the literal true value")));
      assert.equal(await runMigrationBakeoffCli([subverb], {
        campaign: true, // WP-202: un-gate to exercise the artifact/route-substitution refusal
        "execute-live": true,
        "phase-dir": "/must-not-be-read",
      }), 2);
      assert.ok(errors.some((line) => line.includes(subverb) && line.includes("refuses artifact/route substitution")));
    }
    for (const subverb of ["imp24-materialize-pilot-v2-envelope", "imp24-materialize-gold-v2-envelope"]) {
      assert.equal(await runMigrationBakeoffCli([subverb], {
        campaign: true, // WP-202: un-gate to exercise the artifact-substitution refusal
        write: true,
        "state-root": "/must-not-be-written",
      }), 2);
      assert.ok(errors.some((line) => line.includes(subverb) && line.includes("refuses artifact substitution")));
    }
  } finally {
    console.error = originalError;
  }
});
