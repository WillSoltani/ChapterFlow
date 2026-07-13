/** Fixed-path, versioned IMP-24 local activation workflow. */

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { PIPELINE_DIR } from "../paths.js";
import { canonicalJson, hashCanonical } from "../../contracts/contractUtil.js";
import { writeFileAtomic } from "../../lib/atomicWrite.js";
import {
  IMP24_PILOT_GOLD_FIXED_PATHS,
  loadImp24ActivationQualificationInputsV3,
} from "./imp24PilotGoldWorkflow.js";
import {
  certifyImp24Instrument,
  validateImp24InstrumentCertificationBinding,
  type Imp24InstrumentCertificationBinding,
} from "./imp24InstrumentCertification.js";
import { canonicalPretty } from "./corpusBuilderCore.js";
import {
  recordImp24ActivationFullSuiteV2,
  verifyImp24ActivationReadinessV2,
} from "../../orchestrator/forwardActivationReadinessV2.js";
import { verifyForwardRetainedCampaignEvidenceV3 } from "../../orchestrator/forwardRetainedCampaignEvidenceV3.js";
import {
  buildForwardLocalActivationArtifactsV2,
  type ForwardLocalActivationMaterializationV2,
} from "../../orchestrator/forwardLocalActivationMaterializerV2.js";
import { FORWARD_LOCAL_ACTIVATION_POLICY_REL_PATH } from "../../orchestrator/forwardLocalActivationMaterializer.js";
import {
  FORWARD_LOCAL_STATE_DIR,
  resolveStandardForwardAutopilotControl,
} from "../../orchestrator/forwardLocalAutopilot.js";
import {
  validateForwardProductionInstrumentSeal,
  type ForwardProductionInstrumentSealV1,
} from "../../orchestrator/forwardProductionInstrumentSeal.js";

export const IMP24_LOCAL_ACTIVATION_WORKFLOW_SCHEMA = "imp24-local-activation-workflow-v3" as const;
export const IMP24_LOCAL_ACTIVATION_EXPERIMENT_ID = "s16-forward-local-activation-v3-envelope" as const;

const REPOSITORY_ROOT = resolve(PIPELINE_DIR, "../../../..");
const ACTIVATION_ROOT = resolve(PIPELINE_DIR, "state", "migration-experiments", IMP24_LOCAL_ACTIVATION_EXPERIMENT_ID);

export const IMP24_LOCAL_ACTIVATION_FIXED_PATHS = Object.freeze({
  repositoryRoot: REPOSITORY_ROOT,
  activationRoot: ACTIVATION_ROOT,
  implementationCiGate: resolve(IMP24_PILOT_GOLD_FIXED_PATHS.qualificationRoot, "implementation-ci-gate.json"),
  fullSuiteLedger: resolve(ACTIVATION_ROOT, "full-suite-attempt-ledger.json"),
  pilotPhase: IMP24_PILOT_GOLD_FIXED_PATHS.pilotRoot,
  pilotInputFreeze: resolve(IMP24_PILOT_GOLD_FIXED_PATHS.pilotRoot, "input-freeze.json"),
  goldPhase: IMP24_PILOT_GOLD_FIXED_PATHS.goldRoot,
  goldInputFreeze: resolve(IMP24_PILOT_GOLD_FIXED_PATHS.goldRoot, "input-freeze.json"),
  localState: FORWARD_LOCAL_STATE_DIR,
} as const);

export class Imp24ActivationWorkflowError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "Imp24ActivationWorkflowError";
  }
}

function requireCondition(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Imp24ActivationWorkflowError(message);
}

function requireHead(value: string): void {
  requireCondition(/^[a-f0-9]{40}$/.test(value), "IMP-24 activation requires an exact lowercase 40-character HEAD");
}

function stableBytes(value: unknown): string {
  return `${canonicalJson(value)}\n`;
}

function persistReadBack(path: string, value: unknown): boolean {
  const bytes = stableBytes(value);
  if (existsSync(path) && readFileSync(path, "utf8") === bytes) return false;
  writeFileAtomic(path, bytes);
  requireCondition(readFileSync(path, "utf8") === bytes, `IMP-24 activation read-back drift at ${path}`);
  return true;
}

/** Pre-live readiness binding. This intentionally has no qualification-root,
 * role-freeze, candidate, receipt, or campaign dependency: §21 requires the
 * exact full-suite PASS before the first V3 model call can exist. */
export function loadImp24PreLiveActivationCertificationV1(): {
  productionInstrumentSealSha256: string;
  instrumentCertificationSha256: string;
  modelCalls: 0;
  apiCalls: 0;
} {
  const certificationPath = IMP24_PILOT_GOLD_FIXED_PATHS.certification;
  const sealPath = IMP24_PILOT_GOLD_FIXED_PATHS.productionInstrumentSeal;
  requireCondition(existsSync(certificationPath) && existsSync(sealPath),
    "IMP-24 pre-live full suite requires retained model-free certification and production seal");
  const retainedCertification = JSON.parse(readFileSync(certificationPath, "utf8")) as Imp24InstrumentCertificationBinding;
  const retainedSeal = JSON.parse(readFileSync(sealPath, "utf8")) as ForwardProductionInstrumentSealV1;
  const certificationErrors = validateImp24InstrumentCertificationBinding(retainedCertification);
  requireCondition(certificationErrors.length === 0,
    `IMP-24 pre-live certification binding is invalid: ${certificationErrors.join("; ")}`);
  requireCondition(readFileSync(certificationPath, "utf8") === canonicalPretty(retainedCertification),
    "IMP-24 pre-live certification bytes are not the canonical model-free artifact");
  const certified = certifyImp24Instrument({ repositoryRoot: IMP24_LOCAL_ACTIVATION_FIXED_PATHS.repositoryRoot });
  requireCondition(hashCanonical(retainedCertification) === hashCanonical(certified.report.binding),
    "IMP-24 pre-live certification differs from current model-free certification");
  const seal = validateForwardProductionInstrumentSeal(retainedSeal, {
    repositoryRoot: IMP24_LOCAL_ACTIVATION_FIXED_PATHS.repositoryRoot,
  });
  requireCondition(seal.sealSha256 === retainedCertification.productionInstrumentSealSha256,
    "IMP-24 pre-live production seal differs from model-free certification");
  return {
    productionInstrumentSealSha256: seal.sealSha256,
    instrumentCertificationSha256: retainedCertification.certificationSha256,
    modelCalls: 0,
    apiCalls: 0,
  };
}

function loadVerifiedActivationEvidence(expectedHeadSha: string) {
  requireHead(expectedHeadSha);
  const qualification = loadImp24ActivationQualificationInputsV3();
  const pilotEvidence = verifyForwardRetainedCampaignEvidenceV3({
    kind: "pilot",
    phaseDir: IMP24_LOCAL_ACTIVATION_FIXED_PATHS.pilotPhase,
    inputFreezePath: IMP24_LOCAL_ACTIVATION_FIXED_PATHS.pilotInputFreeze,
    roleAssignmentFreeze: qualification.roleFreeze,
  });
  const goldEvidence = verifyForwardRetainedCampaignEvidenceV3({
    kind: "gold",
    phaseDir: IMP24_LOCAL_ACTIVATION_FIXED_PATHS.goldPhase,
    inputFreezePath: IMP24_LOCAL_ACTIVATION_FIXED_PATHS.goldInputFreeze,
    roleAssignmentFreeze: qualification.roleFreeze,
  });
  const readiness = verifyImp24ActivationReadinessV2({
    repositoryRoot: IMP24_LOCAL_ACTIVATION_FIXED_PATHS.repositoryRoot,
    expectedHeadSha,
    implementationCiGatePath: IMP24_LOCAL_ACTIVATION_FIXED_PATHS.implementationCiGate,
    fullSuiteLedgerPath: IMP24_LOCAL_ACTIVATION_FIXED_PATHS.fullSuiteLedger,
    expectedProductionInstrumentSealSha256: qualification.roleFreeze.productionInstrumentSealSha256,
    expectedInstrumentCertificationSha256: qualification.currentQualification.certification.certificationSha256,
  });
  return { qualification, pilotEvidence, goldEvidence, readiness };
}

export type Imp24ActivationFullSuiteDryResultV1 = {
  code: 2;
  executed: false;
  modelCalls: 0;
  apiCalls: 0;
  message: string;
};

/** Literal execution barrier is checked before any retained artifact, git, or
 * process access. The owned recorder is the only production ledger producer. */
export function recordImp24ActivationFullSuiteV3(
  executeLocalSuite: unknown,
  expectedHeadSha: string,
): Imp24ActivationFullSuiteDryResultV1 | {
  code: 0;
  executed: true;
  ledgerSha256: string;
  attemptCount: number;
  modelCalls: 0;
  apiCalls: 0;
  message: string;
} {
  if (executeLocalSuite !== true) return {
    code: 2,
    executed: false,
    modelCalls: 0,
    apiCalls: 0,
    message: "refusing full local suite without literal --execute-local-suite",
  };
  requireHead(expectedHeadSha);
  const certification = loadImp24PreLiveActivationCertificationV1();
  const ledger = recordImp24ActivationFullSuiteV2({
    repositoryRoot: IMP24_LOCAL_ACTIVATION_FIXED_PATHS.repositoryRoot,
    expectedHeadSha,
    fullSuiteLedgerPath: IMP24_LOCAL_ACTIVATION_FIXED_PATHS.fullSuiteLedger,
    expectedProductionInstrumentSealSha256: certification.productionInstrumentSealSha256,
    expectedInstrumentCertificationSha256: certification.instrumentCertificationSha256,
  });
  return {
    code: 0,
    executed: true,
    ledgerSha256: ledger.ledgerSha256,
    attemptCount: ledger.attempts.length,
    modelCalls: 0,
    apiCalls: 0,
    message: "exact no-API full local suite PASS retained",
  };
}

export type ActivateImp24LocalV3Args = {
  activateLocal: unknown;
  expectedHeadSha: string;
  activatedAt: string;
  activationId?: string;
};

/** Validate every exact retained gate, then write policy last so partial
 * materialization can never expose a new ACTIVE policy over missing evidence. */
export function activateImp24LocalV3(
  args: ActivateImp24LocalV3Args,
): Readonly<ForwardLocalActivationMaterializationV2> & { written: number } {
  requireCondition(args.activateLocal === true,
    "refusing IMP-24 local activation without literal --activate-local");
  const evidence = loadVerifiedActivationEvidence(args.expectedHeadSha);
  const materialized = buildForwardLocalActivationArtifactsV2({
    activationId: args.activationId?.trim() || "imp24-forward-local-active-v3",
    activatedAt: args.activatedAt,
    currentQualification: evidence.qualification.currentQualification,
    roleAssignmentFreeze: evidence.qualification.roleFreeze,
    qualificationPreflight: evidence.qualification.retainedPreflight,
    retainedQualificationEvidence: evidence.qualification.retainedQualificationEvidence,
    pilotEvidence: evidence.pilotEvidence,
    goldEvidence: evidence.goldEvidence,
    readiness: evidence.readiness,
  });
  let written = 0;
  for (const [relPath, value] of Object.entries(materialized.artifactsByPath)) {
    if (relPath === FORWARD_LOCAL_ACTIVATION_POLICY_REL_PATH) continue;
    if (persistReadBack(resolve(FORWARD_LOCAL_STATE_DIR, relPath), value)) written += 1;
  }
  if (persistReadBack(
    resolve(FORWARD_LOCAL_STATE_DIR, FORWARD_LOCAL_ACTIVATION_POLICY_REL_PATH),
    materialized.artifactsByPath[FORWARD_LOCAL_ACTIVATION_POLICY_REL_PATH],
  )) written += 1;
  const control = resolveStandardForwardAutopilotControl();
  requireCondition(control.runtime.mode === "FORWARD_ACTIVE",
    "IMP-24 local activation read-back did not resolve FORWARD_ACTIVE");
  return Object.freeze({ ...materialized, written });
}

/** Read-only exact re-projection. A retained V2 policy or a synthetic PASS
 * summary cannot satisfy the V3 proof/evidence comparison. */
export function verifyImp24LocalActivationV3(expectedHeadSha: string): {
  schema: typeof IMP24_LOCAL_ACTIVATION_WORKFLOW_SCHEMA;
  status: "FORWARD_ACTIVE";
  activationId: string;
  materializationSha256: string;
  evidenceSha256: string;
  modelCalls: 0;
  apiCalls: 0;
} {
  const evidence = loadVerifiedActivationEvidence(expectedHeadSha);
  const control = resolveStandardForwardAutopilotControl();
  requireCondition(control.runtime.mode === "FORWARD_ACTIVE",
    `local forward runtime is ${control.runtime.mode}, not FORWARD_ACTIVE`);
  const expected = buildForwardLocalActivationArtifactsV2({
    activationId: control.runtime.policy.activationId,
    activatedAt: control.runtime.policy.activatedAt,
    currentQualification: evidence.qualification.currentQualification,
    roleAssignmentFreeze: evidence.qualification.roleFreeze,
    qualificationPreflight: evidence.qualification.retainedPreflight,
    retainedQualificationEvidence: evidence.qualification.retainedQualificationEvidence,
    pilotEvidence: evidence.pilotEvidence,
    goldEvidence: evidence.goldEvidence,
    readiness: evidence.readiness,
  });
  for (const [relPath, value] of Object.entries(expected.artifactsByPath)) {
    const path = resolve(FORWARD_LOCAL_STATE_DIR, relPath);
    requireCondition(existsSync(path) && readFileSync(path, "utf8") === stableBytes(value),
      `local activation artifact differs from retained V3 projection: ${relPath}`);
  }
  return {
    schema: IMP24_LOCAL_ACTIVATION_WORKFLOW_SCHEMA,
    status: "FORWARD_ACTIVE",
    activationId: control.runtime.policy.activationId,
    materializationSha256: expected.materializationSha256,
    evidenceSha256: hashCanonical({
      readiness: evidence.readiness.proof,
      pilot: evidence.pilotEvidence.proof,
      gold: evidence.goldEvidence.proof,
    }),
    modelCalls: 0,
    apiCalls: 0,
  };
}
