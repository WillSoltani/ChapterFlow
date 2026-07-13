/** Focused, model-free IMP-23 live-artifact materializer tests. */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { test } from "./harness.js";
import { PIPELINE_DIR } from "./helpers.js";
import { hashCanonical, sha256Hex } from "../src/contracts/contractUtil.js";
import {
  FORWARD_INPUT_FREEZE_SCHEMA,
  FORWARD_INPUT_SELECTION_POLICY,
  type ForwardInputFreezeV1,
} from "../src/orchestrator/forwardInputFreeze.js";
import {
  IMP22_FORWARD_INPUT_FROZEN_AT,
  IMP22_FORWARD_INPUT_MATERIALIZATION_SCHEMA,
  type Imp22ForwardInputMaterializationV1,
} from "../src/orchestrator/forwardInputMaterialization.js";
import {
  FORWARD_CHAPTER_STRATA,
  type ForwardBookSelectionCandidateV1,
  type ForwardChapterStratum,
  type ForwardValidationCampaignResultV1,
} from "../src/orchestrator/forwardValidationCampaign.js";
import {
  buildForwardProductionInstrumentSeal,
} from "../src/orchestrator/forwardProductionInstrumentSeal.js";
import type { ForwardRoleAssignmentFreezeV1 } from "../src/orchestrator/forwardRoleAssignmentFreeze.js";
import {
  IMP23_QUALIFICATION_EXPERIMENT_ID,
  assertRetainedV2QualificationIdentity,
  buildFixedForwardRoleFreezePolicies,
  buildGoldArtifacts,
  buildPilotArtifacts,
  stableForwardArtifactJson,
  type RetainedQualificationSpecV2,
} from "../src/orchestrator/forwardLiveArtifactMaterializer.js";

const REPOSITORY_ROOT = resolve(PIPELINE_DIR, "../../../..");
const sha = (value: string): string => sha256Hex(value);

function coordinate(bookId: string, chapterNumber: number, stratum: ForwardChapterStratum) {
  return {
    bookId,
    chapterNumber,
    chapterId: `${bookId}-ch${String(chapterNumber).padStart(2, "0")}`,
    stratum,
    sourceComplete: true,
    evidenceFresh: true,
    sourceUsePlanSha256: sha(`plan:${bookId}:${chapterNumber}`),
    sourcePacketSha256: sha(`packet:${bookId}:${chapterNumber}`),
    sidecarSha256: sha(`sidecar:${bookId}:${chapterNumber}`),
    anchorCatalogSha256: sha(`anchors:${bookId}:${chapterNumber}`),
    sourceArchiveId: `archive-${bookId}`,
    riskSignals: [],
  };
}

function book(bookId: string, chapterCount: number): ForwardBookSelectionCandidateV1 {
  return {
    bookId,
    sourceComplete: true,
    representativeTags: ["fixture"],
    chapters: Array.from({ length: chapterCount }, (_, index) =>
      coordinate(bookId, index + 1, FORWARD_CHAPTER_STRATA[index % FORWARD_CHAPTER_STRATA.length])),
  };
}

function inputFreeze(): ForwardInputFreezeV1 {
  const pilot = [book("pilot-alpha", 4), book("pilot-beta", 4)];
  const gold = book("gold-thirteen", 13);
  const goldAssignment = gold.chapters.map((chapter) => ({
    bookId: chapter.bookId,
    chapterNumber: chapter.chapterNumber,
    chapterId: chapter.chapterId,
    stratum: chapter.stratum,
    sourcePacketSha256: chapter.sourcePacketSha256,
    sourceUsePlanSha256: chapter.sourceUsePlanSha256,
    sidecarSha256: chapter.sidecarSha256,
    anchorCatalogSha256: chapter.anchorCatalogSha256,
  }));
  const draft = {
    schema: FORWARD_INPUT_FREEZE_SCHEMA,
    policyVersion: FORWARD_INPUT_SELECTION_POLICY,
    frozenAtIso: IMP22_FORWARD_INPUT_FROZEN_AT,
    sets: {
      qualificationBookIds: ["qualification-only"],
      pilotBookIds: pilot.map((entry) => entry.bookId),
      goldBookIds: [gold.bookId],
    },
    pilot,
    pilotInputHashes: Object.fromEntries(pilot.map((entry) => [entry.bookId, sha(entry.bookId)])),
    gold,
    goldInputHash: sha(gold.bookId),
    goldStratumAssignmentSha256: hashCanonical(goldAssignment),
    goldChapterCount: 13,
    goldCampaignHarnessCompatible: true,
    sourceFiles: [],
  };
  return { ...draft, freezeSha256: hashCanonical(draft) };
}

function materialization(freeze: ForwardInputFreezeV1): Imp22ForwardInputMaterializationV1 {
  return {
    schema: IMP22_FORWARD_INPUT_MATERIALIZATION_SCHEMA,
    frozenAtIso: IMP22_FORWARD_INPUT_FROZEN_AT,
    inputFreezeSha256: freeze.freezeSha256,
    qualificationBookIds: [...freeze.sets.qualificationBookIds],
    pilotExperimentId: "s16-forward-sol-pilot-v1",
    goldExperimentId: "s16-forward-sol-gold-book-v1",
    pilot: [],
    gold: {},
    priorChapterProseUsed: false,
    capabilities: { publish: false, promote: false, deploy: false, upload: false },
  };
}

function roleFreeze(productionInstrumentSealSha256: string): ForwardRoleAssignmentFreezeV1 {
  const roleAssignmentSha256 = sha("role-assignment");
  const base = {
    productionInstrumentSealSha256,
    roleAssignmentSha256,
    reviewConfig: {
      instrumentManifestSha256: sha("instrument-manifest"),
      instrumentManifest: { thresholdsSha256: sha("thresholds") },
    },
  };
  return { ...base, freezeSha256: hashCanonical(base) } as unknown as ForwardRoleAssignmentFreezeV1;
}

function acceptedPilot(manifestSha256: string): ForwardValidationCampaignResultV1 {
  return {
    kind: "pilot",
    experimentId: "s16-forward-sol-pilot-v1",
    manifestSha256,
    accepted: true,
    hardFailures: [],
    capabilitiesUsed: { publish: false, promote: false, deploy: false, upload: false },
    accounting: {
      totalChapters: 8,
      finalPassCount: 8,
      firstWritePassRate: 0.75,
      finalPassRate: 1,
      finalSourceBlockers: 0,
      finalQuizBlockers: 0,
      finalReaderHardBlockers: 0,
      stateProvenanceSchemaFailures: 0,
      unexpectedWrites: 0,
      staleEvidenceAccepted: 0,
    },
  } as unknown as ForwardValidationCampaignResultV1;
}

function v2Spec(): RetainedQualificationSpecV2 {
  return {
    experimentId: IMP23_QUALIFICATION_EXPERIMENT_ID,
    status: "FROZEN_PRE_CALIBRATION",
    correction: { ordinal: 1, additionalCorrectedRerunsAllowed: false },
    instruments: { aggregator: { sourceBytesSha256: "a".repeat(64) } },
    schedule: { seed: "fixed", maxParallel: 2, outputIndependent: true },
    executionRoute: {
      authMode: "chatgpt",
      apiAllowed: false,
      apiFallbackAllowed: false,
      executionProfileHash: "b".repeat(64),
      routePolicyVersion: "route-policy-v1.0",
    },
  };
}

test("retained qualification identity is exactly corrected v2 and policies freeze a pre-output 25% coordinate audit", () => {
  const spec = v2Spec();
  assert.doesNotThrow(() => assertRetainedV2QualificationIdentity({
    spec,
    preflight: {
      experimentId: IMP23_QUALIFICATION_EXPERIMENT_ID,
      maxParallel: 2,
      authMode: "chatgpt",
      apiKeyPresent: false,
      apiFallbackAllowed: false,
    },
    holdoutResult: { roleSetReady: true, roleSetBlockedReason: null },
  }));
  assert.throws(() => assertRetainedV2QualificationIdentity({
    spec: { ...spec, experimentId: "s16-forward-role-qualification-v1" },
    preflight: {
      experimentId: "s16-forward-role-qualification-v1",
      maxParallel: 2,
      authMode: "chatgpt",
      apiKeyPresent: false,
      apiFallbackAllowed: false,
    },
  }), /must be s16-forward-role-qualification-v2/);

  const policies = buildFixedForwardRoleFreezePolicies();
  assert.equal(policies.auditSubset.modulus, 4);
  assert.deepEqual(policies.auditSubset.includedBuckets, [0]);
  assert.equal(policies.auditSubset.frozenBeforeCandidateOutput, true);
  assert.equal(policies.auditSubset.outputIndependent, true);
  assert.equal(policies.escalation.adjudicatorOperationalFailure, "INCONCLUSIVE");
  assert.equal(policies.disagreement.readerPrimaryAuditDisagreement, "REVISE");
  assert.equal(policies.disagreement.outputInformedResamplingAllowed, false);
});

test("pilot and accepted-pilot gold materializers preserve exact 8 and 13 chapter selections", () => {
  const freeze = inputFreeze();
  const inputs = materialization(freeze);
  const productionSeal = buildForwardProductionInstrumentSeal({ repositoryRoot: REPOSITORY_ROOT });
  const role = roleFreeze(productionSeal.sealSha256);
  const pilot = buildPilotArtifacts({
    inputFreeze: freeze,
    inputMaterialization: inputs,
    roleFreeze: role,
    productionInstrumentSeal: productionSeal,
    repositoryRoot: REPOSITORY_ROOT,
  });
  assert.equal(pilot.manifest.targets.length, 8);
  assert.equal(new Set(pilot.manifest.targets.map((target) => `${target.bookId}/${target.chapterNumber}`)).size, 8);
  assert.deepEqual(pilot.manifest.capabilities, { publish: false, promote: false, deploy: false, upload: false });

  const gold = buildGoldArtifacts({
    inputFreeze: freeze,
    inputMaterialization: inputs,
    roleFreeze: role,
    productionInstrumentSeal: productionSeal,
    repositoryRoot: REPOSITORY_ROOT,
    pilotManifest: pilot,
    pilotResult: acceptedPilot(pilot.manifestSha256),
  });
  assert.equal(gold.goldManifest.manifest.targets.length, 13);
  assert.deepEqual(gold.goldManifest.manifest.targets.map((target) => target.chapterNumber),
    Array.from({ length: 13 }, (_, index) => index + 1));
  assert.equal(gold.goldManifest.manifest.goldEvaluatorInstrumentSha256, gold.goldEvaluatorConfig.instrumentSha256);
});

test("self-rehashed denominator/materialization drift is rejected before manifest construction", () => {
  const freeze = inputFreeze();
  const inputs = materialization(freeze);
  const productionSeal = buildForwardProductionInstrumentSeal({ repositoryRoot: REPOSITORY_ROOT });
  const role = roleFreeze(productionSeal.sealSha256);
  const drifted = { ...inputs, inputFreezeSha256: "0".repeat(64) };
  assert.throws(() => buildPilotArtifacts({
    inputFreeze: freeze,
    inputMaterialization: drifted,
    roleFreeze: role,
    productionInstrumentSeal: productionSeal,
    repositoryRoot: REPOSITORY_ROOT,
  }), /belongs to another input freeze/);

  const changedRole = structuredClone(role);
  changedRole.roleAssignmentSha256 = "f".repeat(64);
  assert.throws(() => buildPilotArtifacts({
    inputFreeze: freeze,
    inputMaterialization: inputs,
    roleFreeze: changedRole,
    productionInstrumentSeal: productionSeal,
    repositoryRoot: REPOSITORY_ROOT,
  }), /role assignment freeze self hash drift/);
});

test("materializer dependency surface is zero-model and zero external-capability", () => {
  const source = readFileSync(resolve(PIPELINE_DIR, "src/orchestrator/forwardLiveArtifactMaterializer.ts"), "utf8");
  for (const forbidden of ["node:fs", "child_process", "spawnCodexAgent", "fetch(", "publishFinal", "publish: true", "promote: true", "deploy: true", "upload: true", "uploadAllowed: true"]) {
    assert.equal(source.includes(forbidden), false, `forbidden materializer capability: ${forbidden}`);
  }
  const portable = stableForwardArtifactJson({
    modelCalls: 0,
    apiCalls: 0,
    networkCalls: 0,
    externalCapabilities: { publish: false, promote: false, deploy: false, upload: false, api: false },
  });
  assert.ok(portable.endsWith("\n"));
  assert.equal(portable.includes("true"), false);
});
