import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { canonicalPretty } from "../src/bakeoff/migration/corpusBuilderCore.js";
import {
  IMP24_ROLE_QUALIFICATION_CLOSED_EXECUTION_ID,
  IMP24_ROLE_QUALIFICATION_EXECUTION_ID,
  IMP24_ROLE_QUALIFICATION_ID,
  buildImp24CorpusBundle,
  certifyImp24Corpora,
  loadImp24FrozenV2Inputs,
} from "../src/bakeoff/migration/imp24Corpus.js";
import {
  IMP24_FROZEN_ROLE_THRESHOLDS,
  IMP24_INSTRUMENT_CERTIFICATION_BINDING_SCHEMA,
  instrumentCertificationBindingSha256,
  type InstrumentCertificationBindingV3,
} from "../src/bakeoff/migration/roleQualificationRunnerV3.js";
import {
  runMigrationBakeoffCli,
  type Imp24RoleQualificationCliArtifactsV3,
} from "../src/bakeoff/migration/cli.js";
import { PIPELINE_DIR } from "../src/bakeoff/paths.js";
import { hashCanonical, sha256Hex } from "../src/contracts/contractUtil.js";
import {
  IMP24_CANDIDATE_AVAILABILITY_POLICY_BYTES_SHA256,
  IMP24_CANDIDATE_AVAILABILITY_POLICY_CANONICAL_BYTES,
  IMP24_FROZEN_CANDIDATE_AVAILABILITY_POLICY,
  discoverCandidateAvailabilityV3,
} from "../src/orchestrator/forwardRoleQualificationLiveV3.js";
import {
  type Imp24RoleQualificationCampaignLiveResultV1,
  type RunImp24RoleQualificationCampaignV3Args,
} from "../src/orchestrator/forwardRoleQualificationCampaignV3.js";
import { buildForwardProductionInstrumentSeal } from "../src/orchestrator/forwardProductionInstrumentSeal.js";
import { test } from "./harness.js";
import { mkTestRoots } from "./testRoots.js";

const REPOSITORY_ROOT = resolve(PIPELINE_DIR, "../../../..");
const CONTRACTS_DIR = resolve(PIPELINE_DIR, "state", "migration-experiments", "contracts");
const HEAD = "1".repeat(40);
const WORKFLOW_RUN_ID = 2401;

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function cliArtifacts(): Imp24RoleQualificationCliArtifactsV3 {
  const corpusBundle = buildImp24CorpusBundle(loadImp24FrozenV2Inputs(CONTRACTS_DIR));
  const corpusCertification = certifyImp24Corpora(corpusBundle);
  const productionInstrumentSeal = clone(buildForwardProductionInstrumentSeal({ repositoryRoot: REPOSITORY_ROOT }));
  const thresholds = clone(IMP24_FROZEN_ROLE_THRESHOLDS);
  const certificationCore: Omit<InstrumentCertificationBindingV3, "certificationSha256"> = {
    schema: IMP24_INSTRUMENT_CERTIFICATION_BINDING_SCHEMA,
    status: "CERTIFIED_MODEL_FREE",
    sourceMissingEvidenceInconclusiveCertified: true,
    experimentId: IMP24_ROLE_QUALIFICATION_ID,
    corpusCertificationSha256: hashCanonical(corpusCertification),
    corpusBundleSha256: corpusBundle.substantiveBundleSha256,
    productionInstrumentSealSha256: productionInstrumentSeal.sealSha256,
    envelopeContractSha256: "2".repeat(64),
    envelopeCompilerSha256: "3".repeat(64),
    modelOutputContractsSha256: "4".repeat(64),
    productionQualificationParitySha256: "b".repeat(64),
    scorerSha256: "5".repeat(64),
    promptBundleSha256: "6".repeat(64),
    schemaBundleSha256: "7".repeat(64),
    thresholdsSha256: hashCanonical(thresholds),
    legacyEvidenceClosureSha256: "8".repeat(64),
    independentAuditPasses: 2,
    modelCalls: 0,
    apiCalls: 0,
  };
  return {
    corpusBundle,
    certification: {
      ...certificationCore,
      certificationSha256: instrumentCertificationBindingSha256(certificationCore),
    },
    productionInstrumentSeal,
    thresholds,
    thresholdBytesSha256: sha256Hex(canonicalPretty(thresholds)),
  };
}

async function captureErrors<T>(action: () => Promise<T>): Promise<{ result: T; errors: string[] }> {
  const original = console.error;
  const errors: string[] = [];
  console.error = (...values: unknown[]) => { errors.push(values.map(String).join(" ")); };
  try {
    return { result: await action(), errors };
  } finally {
    console.error = original;
  }
}

test("IMP-24 V3 qualification CLI literal dry barrier precedes every injected read/discovery/campaign seam", async () => {
  let touched = 0;
  const deps = {
    imp24RoleQualificationV3: {
      repositoryRoot: "/must-not-be-resolved",
      clock: () => { touched += 1; throw new Error("dry command read clock"); },
      loadArtifacts: () => { touched += 1; throw new Error("dry command loaded artifacts"); },
      discoverAvailability: () => { touched += 1; throw new Error("dry command read models cache"); },
      runCampaign: async () => { touched += 1; throw new Error("dry command ran campaign"); },
    },
  };
  for (const executeLive of [undefined, "true"] as const) {
    const flags: Record<string, string | boolean> = {
      "head-sha": HEAD,
      "workflow-run-id": String(WORKFLOW_RUN_ID),
      ...(executeLive === undefined ? {} : { "execute-live": executeLive }),
    };
    const captured = await captureErrors(() => runMigrationBakeoffCli(["imp24-role-qualification-v3"], flags, deps));
    assert.equal(captured.result, 2);
  }
  assert.equal(touched, 0);
});

test("IMP-24 V3 qualification CLI requires argv or injected models-cache context before retained reads", async () => {
  let touched = 0;
  const captured = await captureErrors(() => runMigrationBakeoffCli(["imp24-role-qualification-v3"], {
    "execute-live": true,
    "head-sha": HEAD,
    "workflow-run-id": String(WORKFLOW_RUN_ID),
  }, {
    imp24RoleQualificationV3: {
      clock: () => { touched += 1; return new Date("2026-07-13T12:00:00.000Z"); },
      loadArtifacts: () => { touched += 1; return cliArtifacts(); },
      discoverAvailability: () => { touched += 1; throw new Error("must not discover without explicit context"); },
      runCampaign: async () => { touched += 1; throw new Error("must not run without explicit context"); },
    },
  }));
  assert.equal(captured.result, 2);
  assert.equal(touched, 0);
  assert.ok(captured.errors.some((line) => line.includes("--models-cache or the outer CLI runtime context")));
});

test("IMP-24 V3 candidate discovery binds the supplied bytes hash to the exact canonical frozen policy", () => {
  assert.equal(sha256Hex(IMP24_CANDIDATE_AVAILABILITY_POLICY_CANONICAL_BYTES),
    IMP24_CANDIDATE_AVAILABILITY_POLICY_BYTES_SHA256);
  assert.throws(() => discoverCandidateAvailabilityV3({
    policy: IMP24_FROZEN_CANDIDATE_AVAILABILITY_POLICY,
    policyBytesSha256: "0".repeat(64),
    modelsCachePath: "/this/cache/must/not/be/read.json",
    verifiedAt: "2026-07-13T12:00:00.000Z",
  }), /differs from exact canonical frozen policy bytes/);
});

test("IMP-24 V3 qualification CLI loads fresh artifacts, discovers local candidates, recomputes certification, and wires one injected campaign", async () => {
  const roots = mkTestRoots("imp24-role-qualification-cli-v3");
  const modelsCachePath = resolve(roots.base, "models_cache.json");
  writeFileSync(modelsCachePath, JSON.stringify({
    fetched_at: "2026-07-13T12:00:00.000Z",
    models: ["gpt-5.6-sol", "gpt-5.5"].map((slug) => ({
      slug,
      visibility: "list",
      supported_reasoning_levels: [{ effort: "high" }, { effort: "xhigh" }],
    })),
  }));
  let loaded = 0;
  let campaignCalls = 0;
  let observed: RunImp24RoleQualificationCampaignV3Args | null = null;
  const artifacts = cliArtifacts();
  const injectedResult = {
    code: 0,
    executed: true,
    result: {
      experimentId: IMP24_ROLE_QUALIFICATION_EXECUTION_ID,
      roleSetReady: true,
      roleSetBlockedReason: null,
      selected: {
        readerPrimary: "gpt-5.6-sol@high",
        readerAudit: "gpt-5.5@high",
        sourcePrimary: "gpt-5.6-sol@xhigh",
        sourceAdjudicator: "gpt-5.5@xhigh",
        quizSemanticAdjudicator: "gpt-5.6-sol@xhigh",
      },
      baseCallsAttempted: 190,
      infrastructureReplays: 0,
      maxPlanEvents: 0,
      totalAttempts: 190,
    },
    callLedger: { codexExecInvocations: 190, cachedReceipts: 0, maxPlanCapacityEvents: 0 },
    roleAssignmentFreeze: { freezeSha256: "9".repeat(64) },
    modelCalls: 190,
    apiCalls: 0,
    paths: {},
  } as unknown as Imp24RoleQualificationCampaignLiveResultV1;
  const originalLog = console.log;
  console.log = () => undefined;
  try {
    const code = await runMigrationBakeoffCli(["imp24-role-qualification-v3"], {
      "execute-live": true,
      "head-sha": HEAD,
      "workflow-run-id": String(WORKFLOW_RUN_ID),
      json: true,
    }, {
      imp24RoleQualificationV3: {
        repositoryRoot: REPOSITORY_ROOT,
        modelsCachePath,
        clock: () => new Date("2026-07-13T12:00:00.000Z"),
        loadArtifacts: (repositoryRoot) => {
          loaded += 1;
          assert.equal(repositoryRoot, REPOSITORY_ROOT);
          return artifacts;
        },
        runCampaign: async (args) => {
          campaignCalls += 1;
          observed = args;
          return injectedResult;
        },
      },
    });
    assert.equal(code, 0);
  } finally {
    console.log = originalLog;
    roots.dispose();
  }
  assert.equal(loaded, 1);
  assert.equal(campaignCalls, 1);
  const wired = observed as unknown as RunImp24RoleQualificationCampaignV3Args | null;
  assert.ok(wired);
  assert.equal(wired.executeLive, true);
  assert.equal(wired.expectedHeadSha, HEAD);
  assert.equal(wired.workflowRunId, WORKFLOW_RUN_ID);
  assert.equal(wired.input.experimentId, IMP24_ROLE_QUALIFICATION_EXECUTION_ID);
  assert.equal(wired.input.corpusCertification.status, "PASS");
  assert.equal(wired.input.candidateAvailability.entries.length, 12);
  assert.ok(wired.input.candidateAvailability.entries.every((entry) => entry.status === "AVAILABLE"));
  assert.equal(wired.input.candidateAvailability.policyBytesSha256,
    IMP24_CANDIDATE_AVAILABILITY_POLICY_BYTES_SHA256);
  assert.equal("executor" in wired, false, "the CLI test must not expose a spawn/model seam");
  assert.equal("clock" in wired, false, "the official campaign must own its evidence timestamps");
  assert.equal("calibration" in wired.input, false);
  assert.equal("attestation" in wired.input, false);
});

test("IMP-24 CLI cannot resume or attest immutable V1/V2 or closed zero-call V3 execution identities", async () => {
  const errors: string[] = [];
  const original = console.error;
  console.error = (...values: unknown[]) => { errors.push(values.map(String).join(" ")); };
  try {
    for (const [experiment, disposition] of [
      ["s16-forward-role-qualification-v1", "INVALID_INSTRUMENT_DO_NOT_ATTEST"],
      ["s16-forward-role-qualification-v2", "BLOCKED_CALIBRATION_INVALID"],
      [IMP24_ROLE_QUALIFICATION_CLOSED_EXECUTION_ID, "BLOCKED_ZERO_CALL_CONTROL_PLANE_DEFECT"],
    ] as const) {
      for (const subverb of ["role-qualification-calibrate", "role-qualification-holdout"] as const) {
        assert.equal(await runMigrationBakeoffCli([subverb], {
          "execute-live": true,
          experiment,
        }), 2);
      }
      assert.equal(await runMigrationBakeoffCli(["role-qualification-attest-calibration"], {
        experiment,
        inspector: "must-not-run",
        "confirm-calibration-sha": "a".repeat(64),
        "approve-holdout": true,
      }), 2);
      assert.equal(errors.filter((line) => line.includes(experiment) && line.includes(disposition)).length, 3);
    }
  } finally {
    console.error = original;
  }
});
