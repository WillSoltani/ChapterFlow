/**
 * Fixed-path IMP-24 pilot/gold operator workflow.
 *
 * The model-free materializers consume only the retained V3 qualification,
 * certificate/corpus/seal, fixed role assignment, and fresh IMP-24 input
 * materialization.  The live entrypoints have a literal executeLive barrier
 * before any file, auth, CLI, state, or model activity and delegate the entire
 * campaign to runForwardLiveCampaignV3FromExplicitArtifacts.  There is no
 * legacy qualification adapter and no injected process/model seam here.
 */

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { PIPELINE_DIR } from "../paths.js";
import { canonicalPretty } from "./corpusBuilderCore.js";
import {
  IMP24_CERTIFICATION_ARTIFACT_PATHS,
  certifyImp24Instrument,
} from "./imp24InstrumentCertification.js";
import {
  IMP24_ROLE_QUALIFICATION_ID,
  serializeImp24CorpusBundle,
  type Imp24CorpusBundle,
} from "./imp24Corpus.js";
import {
  IMP24_FROZEN_ROLE_THRESHOLDS,
  type CandidateAvailabilityV3,
  type InstrumentCertificationBindingV3,
} from "./roleQualificationRunnerV3.js";
import { hashCanonical, sha256Hex } from "../../contracts/contractUtil.js";
import { writeFileAtomic } from "../../lib/atomicWrite.js";
import {
  buildGoldArtifactsV2Envelope,
  buildPilotArtifactsV2Envelope,
} from "../../orchestrator/forwardLiveArtifactMaterializerV3.js";
import {
  stableForwardArtifactJson,
  validateForwardInputMaterializationBinding,
} from "../../orchestrator/forwardLiveArtifactMaterializer.js";
import {
  IMP22_FORWARD_INPUT_EXPECTED_HASHES,
  IMP24_FORWARD_INPUT_EXPERIMENT_IDS,
  type Imp22ForwardInputMaterializationV1,
} from "../../orchestrator/forwardInputMaterialization.js";
import {
  assertForwardInputFreezeFresh,
  type ForwardInputFreezeV1,
} from "../../orchestrator/forwardInputFreeze.js";
import {
  buildForwardV3QualificationProof,
  runForwardLiveCampaignV3FromExplicitArtifacts,
  type ForwardNoApiChatgptRouteProofV3,
  type ForwardV3QualificationProof,
  type RunForwardLiveCampaignResultV3,
} from "../../orchestrator/forwardLiveValidationDriver.js";
import {
  IMP24_FORWARD_PRODUCTION_INSTRUMENT_SEAL_ARTIFACT_REL_PATH,
  validateForwardProductionInstrumentSeal,
  type ForwardProductionInstrumentSealV1,
} from "../../orchestrator/forwardProductionInstrumentSeal.js";
import {
  validateForwardRoleAssignmentFreezeV3,
  type BuildForwardRoleAssignmentFreezeV3Input,
  type ForwardRoleAssignmentFreezeV3,
  type ForwardV3RouteBinding,
} from "../../orchestrator/forwardRoleAssignmentFreezeV3.js";
import {
  prepareLiveRoleQualificationV3,
  preflightLiveRoleQualificationV3,
  type LiveQualificationPreflightV3,
  type UnpreparedLiveRoleQualificationInputV3,
} from "../../orchestrator/forwardRoleQualificationLiveV3.js";
import {
  assertManifest,
  GOLD_ENVELOPE_EXPERIMENT_ID,
  PILOT_ENVELOPE_EXPERIMENT_ID,
  type ForwardGoldManifestV1,
  type ForwardPilotManifestV1,
  type FrozenForwardValidationManifestV1,
} from "../../orchestrator/forwardValidationCampaign.js";
import {
  assertVerifiedForwardRetainedCampaignEvidenceV3,
  verifyForwardRetainedCampaignEvidenceV3,
} from "../../orchestrator/forwardRetainedCampaignEvidenceV3.js";
import {
  assertVerifiedForwardRetainedRoleQualificationEvidenceV3,
  verifyForwardRetainedRoleQualificationEvidenceV3,
  type VerifiedForwardRetainedRoleQualificationEvidenceV3,
} from "../../orchestrator/forwardRetainedRoleQualificationEvidenceV3.js";

export const IMP24_PILOT_GOLD_WORKFLOW_SCHEMA = "imp24-pilot-gold-workflow-result-v1" as const;

const REPOSITORY_ROOT = resolve(PIPELINE_DIR, "../../../..");
const EXPERIMENT_ROOT = resolve(PIPELINE_DIR, "state", "migration-experiments");
const QUALIFICATION_ROOT = resolve(EXPERIMENT_ROOT, IMP24_ROLE_QUALIFICATION_ID);

export const IMP24_PILOT_GOLD_FIXED_PATHS = Object.freeze({
  repositoryRoot: REPOSITORY_ROOT,
  qualificationRoot: QUALIFICATION_ROOT,
  corpusBundle: resolve(REPOSITORY_ROOT, IMP24_CERTIFICATION_ARTIFACT_PATHS.corpusBundle),
  certification: resolve(REPOSITORY_ROOT, IMP24_CERTIFICATION_ARTIFACT_PATHS.certificationBinding),
  thresholds: resolve(REPOSITORY_ROOT, IMP24_CERTIFICATION_ARTIFACT_PATHS.thresholds),
  productionInstrumentSeal: resolve(REPOSITORY_ROOT, IMP24_FORWARD_PRODUCTION_INSTRUMENT_SEAL_ARTIFACT_REL_PATH),
  candidateAvailability: resolve(QUALIFICATION_ROOT, "candidate-availability.json"),
  qualificationPreflight: resolve(QUALIFICATION_ROOT, "live", "preflight.json"),
  qualificationResult: resolve(QUALIFICATION_ROOT, "live", "qualification-result.json"),
  roleAssignmentFreeze: resolve(QUALIFICATION_ROOT, "role-assignment-freeze.json"),
  pilotRoot: resolve(EXPERIMENT_ROOT, PILOT_ENVELOPE_EXPERIMENT_ID),
  goldRoot: resolve(EXPERIMENT_ROOT, GOLD_ENVELOPE_EXPERIMENT_ID),
} as const);

export type Imp24EnvelopePhase = "pilot" | "gold";

export type Imp24PilotGoldMaterializationResultV1 = {
  schema: typeof IMP24_PILOT_GOLD_WORKFLOW_SCHEMA;
  phase: Imp24EnvelopePhase;
  experimentId: typeof PILOT_ENVELOPE_EXPERIMENT_ID | typeof GOLD_ENVELOPE_EXPERIMENT_ID;
  manifestSha256: string;
  targetCount: number;
  roleAssignmentFreezeSha256: string;
  qualificationProofSha256: string;
  goldEvaluatorInstrumentSha256: string | null;
  written: number;
  modelCalls: 0;
  apiCalls: 0;
};

export type Imp24PilotGoldDryResultV1 = {
  code: 2;
  executed: false;
  phase: Imp24EnvelopePhase;
  result: null;
  modelCalls: 0;
  apiCalls: 0;
  message: string;
};

export type Imp24PilotGoldLiveResultV1 = {
  code: 0 | 1;
  executed: true;
  phase: Imp24EnvelopePhase;
  result: RunForwardLiveCampaignResultV3;
  modelCalls: number;
  apiCalls: 0;
  message: string;
};

type LoadedImp24Qualification = {
  currentQualification: BuildForwardRoleAssignmentFreezeV3Input;
  roleFreeze: ForwardRoleAssignmentFreezeV3;
  qualification: Readonly<ForwardV3QualificationProof>;
  retainedPreflight: LiveQualificationPreflightV3;
  retainedQualificationEvidence: VerifiedForwardRetainedRoleQualificationEvidenceV3;
  preparedInput: ReturnType<typeof prepareLiveRoleQualificationV3>["input"];
};

export type Imp24ActivationQualificationInputsV3 = Pick<LoadedImp24Qualification,
  "currentQualification" | "roleFreeze" | "retainedPreflight" | "retainedQualificationEvidence">;

type LoadedImp24PhaseInputs = {
  root: string;
  inputFreezePath: string;
  inputMaterializationPath: string;
  manifestPath: string;
  inputFreeze: ForwardInputFreezeV1;
  inputMaterialization: Imp22ForwardInputMaterializationV1;
};

export class Imp24PilotGoldWorkflowError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "Imp24PilotGoldWorkflowError";
  }
}

function requireCondition(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Imp24PilotGoldWorkflowError(message);
}

function readJson<T>(path: string, label: string): T {
  requireCondition(existsSync(path), `${label} is not retained at the fixed IMP-24 path ${path}`);
  try {
    return JSON.parse(readFileSync(path, "utf8")) as T;
  } catch (error) {
    throw new Imp24PilotGoldWorkflowError(`${label} is not valid retained JSON: ${(error as Error).message}`);
  }
}

function persistCreateOnceExact(path: string, value: unknown, write: boolean, label: string): boolean {
  const bytes = stableForwardArtifactJson(value);
  if (existsSync(path)) {
    requireCondition(readFileSync(path, "utf8") === bytes,
      `${label} differs from the create-once exact retained bytes at ${path}`);
    return false;
  }
  if (!write) return false;
  writeFileAtomic(path, bytes);
  requireCondition(readFileSync(path, "utf8") === bytes, `${label} atomic read-back drift at ${path}`);
  return true;
}

function routeBindingFrom(preflight: LiveQualificationPreflightV3): ForwardV3RouteBinding {
  const { preflightSha256, ...core } = preflight;
  requireCondition(preflight.schema === "imp24-role-qualification-live-preflight-v3"
    && preflight.experimentId === IMP24_ROLE_QUALIFICATION_ID,
  "retained qualification preflight has the wrong V3 envelope identity");
  requireCondition(preflightSha256 === hashCanonical(core), "retained qualification preflight self hash drift");
  requireCondition(preflight.cliSynthetic === false,
    "synthetic qualification CLI evidence cannot authorize the pilot or gold campaign");
  requireCondition(preflight.executionRoute === "codex_exec_chatgpt_subscription"
    && preflight.authMode === "chatgpt"
    && preflight.apiKeyPresent === false
    && preflight.apiFallbackAllowed === false
    && preflight.directHttpOrSdkAllowed === false
    && preflight.forbiddenProviderEnvKeysPresent.length === 0,
  "retained V3 qualification preflight is not the exact no-API ChatGPT codex exec route");
  return {
    executionRoute: "codex_exec_chatgpt_subscription",
    authMode: "chatgpt",
    apiKeyPresent: false,
    apiFallbackAllowed: false,
    directHttpOrSdkAllowed: false,
    executionProfileHash: preflight.executionProfileHash,
    routePolicyVersion: preflight.routePolicyVersion,
  };
}

function loadExactQualification(): LoadedImp24Qualification {
  const paths = IMP24_PILOT_GOLD_FIXED_PATHS;
  const retainedCorpus = readJson<Imp24CorpusBundle>(paths.corpusBundle, "IMP-24 V3 corpus bundle");
  const retainedCertification = readJson<InstrumentCertificationBindingV3>(paths.certification,
    "IMP-24 model-free instrument certification");
  const retainedSeal = readJson<ForwardProductionInstrumentSealV1>(paths.productionInstrumentSeal,
    "IMP-24 production instrument seal");
  const retainedThresholdBytes = readFileSync(paths.thresholds, "utf8");
  requireCondition(retainedThresholdBytes === canonicalPretty(IMP24_FROZEN_ROLE_THRESHOLDS),
    "retained V3 thresholds differ from the exact owner-frozen canonical bytes");

  // Re-run the complete model-free certificate against current implementation
  // bytes, then require the retained certificate/corpus/seal to be byte-semantic
  // matches.  This is validation, never recertification or live qualification.
  const certified = certifyImp24Instrument({ repositoryRoot: paths.repositoryRoot });
  requireCondition(hashCanonical(retainedCorpus) === hashCanonical(certified.corpusBundle),
    "retained V3 corpus differs from the current model-free certified corpus");
  requireCondition(hashCanonical(retainedCertification) === hashCanonical(certified.report.binding),
    "retained V3 certification binding differs from current model-free certification");
  requireCondition(readFileSync(paths.corpusBundle, "utf8") === serializeImp24CorpusBundle(certified.corpusBundle),
    "retained V3 corpus bytes are not the exact canonical certified artifact");
  requireCondition(readFileSync(paths.certification, "utf8") === canonicalPretty(certified.report.binding),
    "retained V3 certification bytes are not the exact canonical model-free artifact");
  const seal = validateForwardProductionInstrumentSeal(retainedSeal, { repositoryRoot: paths.repositoryRoot });
  requireCondition(seal.sealSha256 === retainedCertification.productionInstrumentSealSha256,
    "retained V3 production seal differs from the certified instrument");

  const candidateAvailability = readJson<CandidateAvailabilityV3>(paths.candidateAvailability,
    "IMP-24 candidate availability freeze");
  const roleFreeze = readJson<ForwardRoleAssignmentFreezeV3>(paths.roleAssignmentFreeze,
    "IMP-24 V3 role assignment freeze");
  for (const [path, value, label] of [
    [paths.candidateAvailability, candidateAvailability, "candidate availability"],
    [paths.roleAssignmentFreeze, roleFreeze, "role assignment freeze"],
  ] as const) {
    requireCondition(readFileSync(path, "utf8") === stableForwardArtifactJson(value),
      `retained V3 ${label} bytes are not the exact canonical campaign artifact`);
  }
  const unprepared: UnpreparedLiveRoleQualificationInputV3 = {
    experimentId: IMP24_ROLE_QUALIFICATION_ID,
    corpusBundle: retainedCorpus,
    corpusCertification: certified.report.corpusAudit,
    certification: retainedCertification,
    productionInstrumentSeal: retainedSeal,
    candidateAvailability,
    thresholds: IMP24_FROZEN_ROLE_THRESHOLDS,
    thresholdBytesSha256: sha256Hex(retainedThresholdBytes),
  };
  const prepared = prepareLiveRoleQualificationV3({ repositoryRoot: paths.repositoryRoot, input: unprepared });
  const retainedQualificationEvidence = verifyForwardRetainedRoleQualificationEvidenceV3({
    repositoryRoot: paths.repositoryRoot,
    experimentDir: paths.qualificationRoot,
    input: prepared.input,
    evaluateOutput: prepared.evaluateOutput,
    roleAssignmentFreeze: roleFreeze,
  });
  assertVerifiedForwardRetainedRoleQualificationEvidenceV3(retainedQualificationEvidence);
  const retainedPreflight = retainedQualificationEvidence.preflight;
  const result = retainedQualificationEvidence.result;
  requireCondition(unprepared.thresholdBytesSha256 === result.freeze.thresholdBytesSha256,
    "candidate availability/qualification does not retain the exact threshold bytes hash");
  const routeBinding = routeBindingFrom(retainedPreflight);
  const currentQualification: BuildForwardRoleAssignmentFreezeV3Input = {
    result,
    certification: retainedCertification,
    corpusBundle: retainedCorpus,
    schemaHashes: prepared.input.schemaHashes,
    promptSourceHashes: prepared.input.promptSourceHashes,
    routeBinding,
    productionInstrumentSeal: retainedSeal,
    repositoryRoot: paths.repositoryRoot,
  };
  validateForwardRoleAssignmentFreezeV3(roleFreeze, currentQualification);
  const qualification = buildForwardV3QualificationProof({ currentQualification, roleFreeze });
  return {
    currentQualification,
    roleFreeze,
    qualification,
    retainedPreflight,
    retainedQualificationEvidence,
    preparedInput: prepared.input,
  };
}

/** Model-free exact retained qualification loader for the versioned IMP-24
 * activation workflow. This validates; it never requalifies or attests V1/V2. */
export function loadImp24ActivationQualificationInputsV3(): Imp24ActivationQualificationInputsV3 {
  const loaded = loadExactQualification();
  return {
    currentQualification: loaded.currentQualification,
    roleFreeze: loaded.roleFreeze,
    retainedPreflight: loaded.retainedPreflight,
    retainedQualificationEvidence: loaded.retainedQualificationEvidence,
  };
}

function loadPhaseInputs(phase: Imp24EnvelopePhase): LoadedImp24PhaseInputs {
  const root = phase === "pilot"
    ? IMP24_PILOT_GOLD_FIXED_PATHS.pilotRoot
    : IMP24_PILOT_GOLD_FIXED_PATHS.goldRoot;
  const inputFreezePath = resolve(root, "input-freeze.json");
  const inputMaterializationPath = resolve(root, "input-materialization.json");
  const manifestPath = resolve(root, "validation-manifest.json");
  const inputFreeze = readJson<ForwardInputFreezeV1>(inputFreezePath, `${phase} IMP-24 input freeze`);
  const inputMaterialization = readJson<Imp22ForwardInputMaterializationV1>(inputMaterializationPath,
    `${phase} IMP-24 input materialization`);
  requireCondition(readFileSync(inputFreezePath, "utf8") === stableForwardArtifactJson(inputFreeze),
    `${phase} input freeze bytes are not the exact canonical IMP-24 artifact`);
  requireCondition(readFileSync(inputMaterializationPath, "utf8") === stableForwardArtifactJson(inputMaterialization),
    `${phase} input materialization bytes are not the exact canonical IMP-24 artifact`);
  assertForwardInputFreezeFresh(inputFreeze);
  requireCondition(inputFreeze.freezeSha256 === IMP22_FORWARD_INPUT_EXPECTED_HASHES.freezeSha256,
    `${phase} input freeze is not the exact frozen IMP-24 denominator`);
  requireCondition(inputMaterialization.pilotExperimentId === IMP24_FORWARD_INPUT_EXPERIMENT_IDS.pilotExperimentId
    && inputMaterialization.goldExperimentId === IMP24_FORWARD_INPUT_EXPERIMENT_IDS.goldExperimentId,
  `${phase} input materialization carries a legacy pilot/gold identity`);
  validateForwardInputMaterializationBinding(inputFreeze, inputMaterialization);
  return { root, inputFreezePath, inputMaterializationPath, manifestPath, inputFreeze, inputMaterialization };
}

/** Public shape gate used by both materialization and live execution. */
export function assertExactImp24EnvelopeManifest(
  phase: Imp24EnvelopePhase,
  manifest: FrozenForwardValidationManifestV1,
  inputFreeze: ForwardInputFreezeV1,
): void {
  assertManifest(manifest.manifest);
  requireCondition(manifest.manifestSha256 === hashCanonical(manifest.manifest),
    `${phase} envelope manifest self hash drift`);
  const expectedId = phase === "pilot" ? PILOT_ENVELOPE_EXPERIMENT_ID : GOLD_ENVELOPE_EXPERIMENT_ID;
  const expectedCount = phase === "pilot" ? 8 : 13;
  requireCondition(manifest.manifest.kind === phase && manifest.manifest.experimentId === expectedId,
    `${phase} workflow refuses a legacy or substituted experiment identity`);
  requireCondition(manifest.manifest.targets.length === expectedCount,
    `${phase} workflow requires the exact ${expectedCount}-chapter denominator`);
  requireCondition(inputFreeze.freezeSha256 === IMP22_FORWARD_INPUT_EXPECTED_HASHES.freezeSha256,
    `${phase} manifest is not paired with the exact frozen IMP-24 input denominator`);
  const frozenTargets = phase === "pilot"
    ? inputFreeze.pilot.flatMap((book) => book.chapters)
    : inputFreeze.gold.chapters;
  requireCondition(frozenTargets.length === expectedCount,
    `${phase} frozen input denominator changed from ${expectedCount} chapters`);
  const targetKeys = manifest.manifest.targets.map((target) => `${target.bookId}/ch${target.chapterNumber}`);
  const frozenKeys = frozenTargets.map((target) => `${target.bookId}/ch${target.chapterNumber}`);
  requireCondition(hashCanonical([...targetKeys].sort()) === hashCanonical([...frozenKeys].sort()),
    `${phase} envelope manifest coordinates differ from the exact frozen denominator`);
}

/** Bind gold to the retained pilot proof that was freshly verified by the
 * durable evidence verifier in the caller. A self-hashed gold manifest cannot
 * substitute another pilot summary or stale result. */
export function assertImp24GoldManifestPilotBinding(
  goldManifest: FrozenForwardValidationManifestV1<ForwardGoldManifestV1>,
  verifiedPilotManifestSha256: string,
  verifiedPilotResultSha256: string,
): void {
  requireCondition(goldManifest.manifest.experimentId === GOLD_ENVELOPE_EXPERIMENT_ID
    && goldManifest.manifest.kind === "gold",
  "gold pilot binding requires the fresh IMP-24 gold identity");
  requireCondition(goldManifest.manifestSha256 === hashCanonical(goldManifest.manifest),
    "gold pilot binding received a manifest with self-hash drift");
  requireCondition(goldManifest.manifest.pilotAccepted === true
    && goldManifest.manifest.pilotManifestSha256 === verifiedPilotManifestSha256
    && goldManifest.manifest.pilotResultSha256 === verifiedPilotResultSha256,
  "gold manifest does not bind the freshly verified retained pilot manifest/result");
}

export function materializeImp24PilotV2Envelope(write = false): Imp24PilotGoldMaterializationResultV1 {
  const qualification = loadExactQualification();
  const inputs = loadPhaseInputs("pilot");
  const manifest = buildPilotArtifactsV2Envelope({
    currentQualification: qualification.currentQualification,
    roleFreeze: qualification.roleFreeze,
    inputFreeze: inputs.inputFreeze,
    inputMaterialization: inputs.inputMaterialization,
  });
  assertExactImp24EnvelopeManifest("pilot", manifest, inputs.inputFreeze);
  const written = persistCreateOnceExact(inputs.manifestPath, manifest, write, "IMP-24 pilot manifest") ? 1 : 0;
  return {
    schema: IMP24_PILOT_GOLD_WORKFLOW_SCHEMA,
    phase: "pilot",
    experimentId: PILOT_ENVELOPE_EXPERIMENT_ID,
    manifestSha256: manifest.manifestSha256,
    targetCount: manifest.manifest.targets.length,
    roleAssignmentFreezeSha256: qualification.roleFreeze.freezeSha256,
    qualificationProofSha256: qualification.qualification.proofSha256,
    goldEvaluatorInstrumentSha256: null,
    written,
    modelCalls: 0,
    apiCalls: 0,
  };
}

export function materializeImp24GoldV2Envelope(write = false): Imp24PilotGoldMaterializationResultV1 {
  const qualification = loadExactQualification();
  const pilotInputs = loadPhaseInputs("pilot");
  const goldInputs = loadPhaseInputs("gold");
  const pilotEvidence = verifyForwardRetainedCampaignEvidenceV3({
    kind: "pilot",
    phaseDir: pilotInputs.root,
    inputFreezePath: pilotInputs.inputFreezePath,
    roleAssignmentFreeze: qualification.roleFreeze,
  });
  assertVerifiedForwardRetainedCampaignEvidenceV3(pilotEvidence, "pilot");
  assertExactImp24EnvelopeManifest("pilot", pilotEvidence.manifest, pilotEvidence.inputFreeze);
  const retainedPilotManifest = readJson<FrozenForwardValidationManifestV1<ForwardPilotManifestV1>>(pilotInputs.manifestPath,
    "root IMP-24 pilot manifest");
  requireCondition(hashCanonical(retainedPilotManifest) === hashCanonical(pilotEvidence.manifest),
    "retained accepted pilot evidence differs from the create-once root manifest");
  const artifacts = buildGoldArtifactsV2Envelope({
    currentQualification: qualification.currentQualification,
    roleFreeze: qualification.roleFreeze,
    inputFreeze: goldInputs.inputFreeze,
    inputMaterialization: goldInputs.inputMaterialization,
    pilotManifest: retainedPilotManifest,
    pilotResult: pilotEvidence.result.campaign,
  });
  assertExactImp24EnvelopeManifest("gold", artifacts.goldManifest, goldInputs.inputFreeze);
  assertImp24GoldManifestPilotBinding(
    artifacts.goldManifest,
    pilotEvidence.manifest.manifestSha256,
    hashCanonical(pilotEvidence.result.campaign),
  );
  const evaluatorPath = resolve(goldInputs.root, "gold-evaluator-config.json");
  // Validate every create-once destination before the first possible write so
  // a stale manifest cannot leave a newly written evaluator behind (or vice
  // versa). Only after that complete check may both outputs be persisted.
  persistCreateOnceExact(evaluatorPath, artifacts.goldEvaluatorConfig, false, "IMP-24 fixed gold evaluator");
  persistCreateOnceExact(goldInputs.manifestPath, artifacts.goldManifest, false, "IMP-24 gold manifest");
  const written = write === true
    ? [
        persistCreateOnceExact(evaluatorPath, artifacts.goldEvaluatorConfig, true, "IMP-24 fixed gold evaluator"),
        persistCreateOnceExact(goldInputs.manifestPath, artifacts.goldManifest, true, "IMP-24 gold manifest"),
      ].filter(Boolean).length
    : 0;
  return {
    schema: IMP24_PILOT_GOLD_WORKFLOW_SCHEMA,
    phase: "gold",
    experimentId: GOLD_ENVELOPE_EXPERIMENT_ID,
    manifestSha256: artifacts.goldManifest.manifestSha256,
    targetCount: artifacts.goldManifest.manifest.targets.length,
    roleAssignmentFreezeSha256: qualification.roleFreeze.freezeSha256,
    qualificationProofSha256: qualification.qualification.proofSha256,
    goldEvaluatorInstrumentSha256: artifacts.goldEvaluatorConfig.instrumentSha256,
    written,
    modelCalls: 0,
    apiCalls: 0,
  };
}

async function currentLiveRoute(qualification: LoadedImp24Qualification): Promise<ForwardNoApiChatgptRouteProofV3> {
  assertVerifiedForwardRetainedRoleQualificationEvidenceV3(qualification.retainedQualificationEvidence);
  // This repeats the real auth and installed-CLI checks immediately before the
  // campaign. No caller can substitute auth, env, binary, CLI qualifier, or a
  // synthetic runner through this production surface.
  const current = await preflightLiveRoleQualificationV3(qualification.preparedInput, {
    repositoryRoot: IMP24_PILOT_GOLD_FIXED_PATHS.repositoryRoot,
  });
  requireCondition(current.cliSynthetic === false, "current synthetic CLI evidence cannot authorize live validation");
  requireCondition(current.executionProfileHash === qualification.retainedPreflight.executionProfileHash
    && current.routePolicyVersion === qualification.retainedPreflight.routePolicyVersion,
  "current ChatGPT codex exec route differs from the retained V3 qualification route");
  return {
    executionRoute: "codex_exec_chatgpt_subscription",
    authMode: "chatgpt",
    apiKeyPresent: false,
    apiFallbackAllowed: false,
    directHttpOrSdkAllowed: false,
    apiCallsMade: 0,
    forbiddenProviderEnvKeysPresent: [],
    maxParallel: 2,
    executionProfileHash: current.executionProfileHash,
    routePolicyVersion: current.routePolicyVersion,
  };
}

async function executeLivePhase(phase: Imp24EnvelopePhase): Promise<Imp24PilotGoldLiveResultV1> {
  const qualification = loadExactQualification();
  assertVerifiedForwardRetainedRoleQualificationEvidenceV3(qualification.retainedQualificationEvidence);
  const inputs = loadPhaseInputs(phase);
  const manifest = readJson<FrozenForwardValidationManifestV1>(inputs.manifestPath, `${phase} IMP-24 envelope manifest`);
  assertExactImp24EnvelopeManifest(phase, manifest, inputs.inputFreeze);
  if (phase === "gold") {
    const pilotInputs = loadPhaseInputs("pilot");
    const pilotEvidence = verifyForwardRetainedCampaignEvidenceV3({
      kind: "pilot",
      phaseDir: pilotInputs.root,
      inputFreezePath: pilotInputs.inputFreezePath,
      roleAssignmentFreeze: qualification.roleFreeze,
    });
    assertVerifiedForwardRetainedCampaignEvidenceV3(pilotEvidence, "pilot");
    assertExactImp24EnvelopeManifest("pilot", pilotEvidence.manifest, pilotEvidence.inputFreeze);
    assertImp24GoldManifestPilotBinding(
      manifest as FrozenForwardValidationManifestV1<ForwardGoldManifestV1>,
      pilotEvidence.manifest.manifestSha256,
      hashCanonical(pilotEvidence.result.campaign),
    );
  }
  const route = await currentLiveRoute(qualification);
  const result = await runForwardLiveCampaignV3FromExplicitArtifacts({
    expectedKind: phase,
    phaseDir: inputs.root,
    manifestPath: inputs.manifestPath,
    inputFreezePath: inputs.inputFreezePath,
    inputMaterializationPath: inputs.inputMaterializationPath,
    productionInstrumentSealPath: IMP24_PILOT_GOLD_FIXED_PATHS.productionInstrumentSeal,
    ...(phase === "gold"
      ? { goldEvaluatorConfigPath: resolve(inputs.root, "gold-evaluator-config.json") }
      : {}),
  }, {
    currentQualification: qualification.currentQualification,
    roleFreeze: qualification.roleFreeze,
    qualification: qualification.qualification,
    route,
  });
  return {
    code: result.campaign.accepted ? 0 : 1,
    executed: true,
    phase,
    result,
    modelCalls: result.codexExecInvocations,
    apiCalls: 0,
    message: result.campaign.accepted
      ? `${phase} fresh envelope campaign accepted`
      : `${phase} fresh envelope campaign completed without acceptance`,
  };
}

/** Literal dry barrier: keep this check before every other operation. */
export async function runImp24PilotV2EnvelopeLive(
  executeLive: unknown,
): Promise<Imp24PilotGoldDryResultV1 | Imp24PilotGoldLiveResultV1> {
  if (executeLive !== true) return {
    code: 2,
    executed: false,
    phase: "pilot",
    result: null,
    modelCalls: 0,
    apiCalls: 0,
    message: "IMP-24 pilot refused: executeLive must be the literal true value",
  };
  return executeLivePhase("pilot");
}

/** Literal dry barrier: keep this check before every other operation. */
export async function runImp24GoldV2EnvelopeLive(
  executeLive: unknown,
): Promise<Imp24PilotGoldDryResultV1 | Imp24PilotGoldLiveResultV1> {
  if (executeLive !== true) return {
    code: 2,
    executed: false,
    phase: "gold",
    result: null,
    modelCalls: 0,
    apiCalls: 0,
    message: "IMP-24 gold refused: executeLive must be the literal true value",
  };
  return executeLivePhase("gold");
}
