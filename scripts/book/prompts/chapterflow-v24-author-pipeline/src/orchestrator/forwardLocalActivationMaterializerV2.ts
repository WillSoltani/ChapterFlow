/**
 * IMP-24 transition gate from retained V3 qualification and fresh envelope
 * pilot/gold evidence to the local ACTIVE artifacts. The materializer makes no
 * model, provider, network, publication, promotion, deployment, or upload call.
 * Current repository bytes are nevertheless revalidated through the V3 role
 * freeze before ACTIVE artifacts are composed.
 */

import { canonicalJson, hashCanonical } from "../contracts/contractUtil.js";
import {
  IMP24_INSTRUMENT_CERTIFICATION_BINDING_SCHEMA,
  validateImp24InstrumentCertificationBinding,
} from "../bakeoff/migration/imp24InstrumentCertification.js";
import {
  IMP24_ROLE_QUALIFICATION_EXECUTION_ID,
} from "../bakeoff/migration/imp24Corpus.js";
import {
  IMP24_BASE_MAXIMUM_CALLS,
  IMP24_HARD_MAXIMUM_CALLS,
  IMP24_ROLE_QUALIFICATION_RUNNER_SCHEMA,
  type InstrumentCertificationBindingV3,
  type RoleQualificationRunnerResultV3,
} from "../bakeoff/migration/roleQualificationRunnerV3.js";
import {
  LOCAL_ROUTE_PROFILE_SCHEMA,
  VERIFIED_NO_API_ROUTE_SCHEMA,
  bindVerifiedNoApiRoute,
  buildForwardActivationPolicy,
  fixedReviewerProfilesHash,
  type ForwardActivationPolicyV1,
  type LocalForwardRouteProfileV1,
  type VerifiedNoApiRouteCoreV1,
  type VerifiedNoApiRouteV1,
} from "./forwardActivation.js";
import {
  buildForwardLocalRuntimeBindingV2,
  fixedReviewersFromRuntimeBinding,
  type ForwardLocalRuntimeBindingV1,
} from "./forwardAuthorRuntime.js";
import {
  FORWARD_LOCAL_CURRENT_EVIDENCE_SCHEMA,
  FORWARD_LOCAL_CURRENT_PATHS,
  type ForwardLocalCurrentEvidenceV1,
} from "./forwardLocalAutopilot.js";
import {
  validateForwardRoleAssignmentFreezeV3,
  type BuildForwardRoleAssignmentFreezeV3Input,
  type ForwardRoleAssignmentFreezeV3,
} from "./forwardRoleAssignmentFreezeV3.js";
import {
  IMP24_LIVE_PREFLIGHT_SCHEMA,
  type LiveQualificationPreflightV3,
} from "./forwardRoleQualificationLiveV3.js";
/** The pre-migration rollback profile is named `baseline-55`; its writer is the
 *  HISTORICAL gpt-5.5 baseline, a frozen data identity. It used to read
 *  BASELINE_MODEL, which silently re-pointed the rollback target to gpt-5.6-sol
 *  when WP-302 flipped the live baseline — collapsing the rollback to the same
 *  model it rolls back FROM. Frozen per WP-501 Part 3. gpt-5.5 is VOID for the
 *  target architecture (no live route); this is a record of the prior profile. */
const HISTORICAL_BASELINE_55 = "gpt-5.5";
import {
  FORWARD_LIVE_CAMPAIGN_PREFLIGHT_V3_SCHEMA,
  FORWARD_LIVE_CAMPAIGN_RESULT_V3_SCHEMA,
  buildForwardV3QualificationProof,
  type RunForwardLiveCampaignResultV3,
} from "./forwardLiveValidationDriver.js";
import {
  FORWARD_VALIDATION_RESULT_SCHEMA,
  GOLD_ENVELOPE_EXPERIMENT_ID,
  PILOT_ENVELOPE_EXPERIMENT_ID,
  type ForwardValidationCampaignResultV1,
} from "./forwardValidationCampaign.js";
import {
  FORWARD_LOCAL_ACTIVATION_POLICY_REL_PATH,
  FORWARD_LOCAL_RUNTIME_BINDING_REL_PATH,
} from "./forwardLocalActivationMaterializer.js";
import { IMP22_FORWARD_INPUT_EXPECTED_HASHES } from "./forwardInputMaterialization.js";
import {
  IMP24_ACTIVATION_READINESS_PROOF_SCHEMA,
  assertVerifiedImp24ActivationReadinessV2,
  type Imp24ActivationReadinessProofV2,
  type VerifiedImp24ActivationReadinessV2,
} from "./forwardActivationReadinessV2.js";
import {
  assertVerifiedForwardRetainedCampaignEvidenceV3,
  type Imp24RetainedCampaignEvidenceProofV1,
  type VerifiedForwardRetainedCampaignEvidenceV3,
} from "./forwardRetainedCampaignEvidenceV3.js";
import {
  assertVerifiedForwardRetainedRoleQualificationEvidenceV3,
  type Imp24RetainedRoleQualificationEvidenceProofV1,
  type VerifiedForwardRetainedRoleQualificationEvidenceV3,
} from "./forwardRetainedRoleQualificationEvidenceV3.js";

export {
  IMP24_ACTIVATION_READINESS_PROOF_SCHEMA,
  type Imp24ActivationReadinessProofV2,
} from "./forwardActivationReadinessV2.js";

export const FORWARD_LOCAL_ACTIVATION_MATERIALIZATION_V2_SCHEMA =
  "imp24-forward-local-activation-materialization-v3" as const;
export const FORWARD_LOCAL_ACTIVATION_READINESS_PROOF_REL_PATH =
  "activation-evidence/readiness-proof.json" as const;
export const FORWARD_LOCAL_ACTIVATION_QUALIFICATION_PROOF_REL_PATH =
  "activation-evidence/qualification-retained-evidence-proof.json" as const;
export const FORWARD_LOCAL_ACTIVATION_PILOT_PROOF_REL_PATH =
  "activation-evidence/pilot-retained-evidence-proof.json" as const;
export const FORWARD_LOCAL_ACTIVATION_GOLD_PROOF_REL_PATH =
  "activation-evidence/gold-retained-evidence-proof.json" as const;

const SHA256 = /^[a-f0-9]{64}$/;
const ZERO_EXTERNAL_CAPABILITIES = Object.freeze({
  publish: false,
  promote: false,
  deploy: false,
  upload: false,
  api: false,
} as const);

export class ForwardLocalActivationMaterializerV2Error extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ForwardLocalActivationMaterializerV2Error";
  }
}

function requireCondition(condition: unknown, message: string): asserts condition {
  if (!condition) throw new ForwardLocalActivationMaterializerV2Error(message);
}

function requireSha(value: unknown, label: string): asserts value is string {
  requireCondition(typeof value === "string" && SHA256.test(value), `${label} must be a lowercase sha256`);
}

function clone<T>(value: T): T {
  return JSON.parse(canonicalJson(value)) as T;
}

function deepFreeze<T>(value: T, seen = new WeakSet<object>()): Readonly<T> {
  if (value !== null && typeof value === "object") {
    const object = value as object;
    if (!seen.has(object)) {
      seen.add(object);
      for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child, seen);
      Object.freeze(object);
    }
  }
  return value;
}

function hashWithout(value: Record<string, unknown>, field: string): string {
  const draft = { ...value };
  delete draft[field];
  return hashCanonical(draft);
}

function allFalse(value: unknown): boolean {
  return value !== null
    && typeof value === "object"
    && !Array.isArray(value)
    && Object.values(value as Record<string, unknown>).every((entry) => entry === false);
}

function assertQualification(
  current: BuildForwardRoleAssignmentFreezeV3Input,
  freeze: ForwardRoleAssignmentFreezeV3,
  preflight: LiveQualificationPreflightV3,
  retainedEvidence: VerifiedForwardRetainedRoleQualificationEvidenceV3,
): void {
  assertVerifiedForwardRetainedRoleQualificationEvidenceV3(retainedEvidence);
  validateForwardRoleAssignmentFreezeV3(freeze, current);
  const result = current.result;
  const certification = current.certification;
  requireCondition(retainedEvidence.proof.qualificationResultSha256 === hashCanonical(result)
      && retainedEvidence.proof.qualificationFreezeSha256 === result.freeze.freezeSha256
      && retainedEvidence.proof.roleAssignmentFreezeSha256 === freeze.freezeSha256
      && retainedEvidence.proof.preflightSha256 === preflight.preflightSha256,
    "local activation V3 qualification differs from its exact retained request/envelope/receipt proof");
  requireCondition(result.schema === IMP24_ROLE_QUALIFICATION_RUNNER_SCHEMA
      && result.experimentId === IMP24_ROLE_QUALIFICATION_EXECUTION_ID
      && result.roleSetReady === true
      && result.roleSetBlockedReason === null,
    "local activation requires a role-ready V3 envelope qualification result");
  requireCondition(hashCanonical(result) === freeze.qualificationResultSha256,
    "V3 qualification result differs from the fixed role freeze");
  const certificationErrors = validateImp24InstrumentCertificationBinding(certification);
  requireCondition(certificationErrors.length === 0,
    `V3 model-free instrument certification is invalid: ${certificationErrors.join("; ")}`);
  requireCondition(certification.schema === IMP24_INSTRUMENT_CERTIFICATION_BINDING_SCHEMA
      && certification.certificationSha256 === freeze.instrumentCertificationSha256
      && hashCanonical(certification) === hashCanonical(freeze.instrumentCertification),
    "V3 certification differs from the fixed role freeze");

  requireCondition(preflight.schema === IMP24_LIVE_PREFLIGHT_SCHEMA
      && preflight.experimentId === IMP24_ROLE_QUALIFICATION_EXECUTION_ID,
    "qualification preflight is not the V3 envelope protocol");
  requireSha(preflight.preflightSha256, "V3 qualification preflight hash");
  requireCondition(preflight.preflightSha256 === hashWithout(preflight as unknown as Record<string, unknown>, "preflightSha256"),
    "V3 qualification preflight hash drift");
  requireCondition(preflight.freezeSha256 === result.freeze.freezeSha256
      && preflight.certificationSha256 === certification.certificationSha256
      && preflight.productionInstrumentSealSha256 === freeze.productionInstrumentSealSha256
      && preflight.corpusBundleSha256 === freeze.corpusBundleSha256,
    "V3 qualification preflight belongs to different qualification inputs");
  requireCondition(preflight.executionRoute === "codex_exec_chatgpt_subscription"
      && preflight.authMode === "chatgpt"
      && preflight.apiKeyPresent === false
      && preflight.apiFallbackAllowed === false
      && preflight.directHttpOrSdkAllowed === false
      && preflight.forbiddenProviderEnvKeysPresent.length === 0
      && preflight.cliSynthetic === false,
    "V3 qualification preflight is not a live key-free ChatGPT-authenticated codex exec route");
  requireCondition(preflight.executionProfileHash === freeze.routeBinding.executionProfileHash
      && preflight.routePolicyVersion === freeze.routeBinding.routePolicyVersion,
    "V3 qualification preflight route differs from the fixed role freeze");
  requireCondition(preflight.baseMaximumCalls === IMP24_BASE_MAXIMUM_CALLS
      && preflight.hardMaximumCalls === IMP24_HARD_MAXIMUM_CALLS,
    "V3 qualification call ceilings differ from the frozen 464/928 schedule");
}

function assertCampaignPreflight(args: {
  outer: RunForwardLiveCampaignResultV3;
  kind: "pilot" | "gold";
  experimentId: string;
  currentQualification: BuildForwardRoleAssignmentFreezeV3Input;
  freeze: ForwardRoleAssignmentFreezeV3;
  qualificationPreflight: LiveQualificationPreflightV3;
}): void {
  const preflight = args.outer.preflight;
  const proof = buildForwardV3QualificationProof({
    currentQualification: args.currentQualification,
    roleFreeze: args.freeze,
  });
  requireCondition(preflight.schema === FORWARD_LIVE_CAMPAIGN_PREFLIGHT_V3_SCHEMA
      && preflight.kind === args.kind
      && preflight.experimentId === args.experimentId,
    `${args.kind} live preflight schema/identity mismatch`);
  requireSha(preflight.preflightSha256, `${args.kind} live preflight hash`);
  requireCondition(preflight.preflightSha256 === hashWithout(preflight as unknown as Record<string, unknown>, "preflightSha256"),
    `${args.kind} live preflight hash drift`);
  requireCondition(preflight.manifestSha256 === args.outer.campaign.manifestSha256,
    `${args.kind} result belongs to another live manifest`);
  requireCondition(preflight.inputFreezeSha256 === IMP22_FORWARD_INPUT_EXPECTED_HASHES.freezeSha256,
    `${args.kind} live preflight differs from the exact frozen IMP-24 input denominator`);
  requireCondition(preflight.roleAssignmentFreezeSha256 === args.freeze.freezeSha256
      && preflight.roleAssignmentSha256 === args.freeze.roleAssignmentSha256
      && preflight.productionInstrumentSealSha256 === args.freeze.productionInstrumentSealSha256,
    `${args.kind} live preflight belongs to another fixed role set or production seal`);
  requireCondition(preflight.qualificationResultSha256 === hashCanonical(args.currentQualification.result)
      && preflight.instrumentCertificationSha256 === args.currentQualification.certification.certificationSha256
      && preflight.corpusBundleSha256 === args.currentQualification.certification.corpusBundleSha256
      && preflight.qualificationExperimentId === IMP24_ROLE_QUALIFICATION_EXECUTION_ID,
    `${args.kind} live preflight belongs to another V3 qualification/certification/corpus`);
  requireCondition(preflight.reviewProtocolVersion === "imp24-review-v2",
    `${args.kind} live preflight is not bound to the production envelope review protocol`);
  requireCondition(preflight.qualificationFreezeSha256 === args.currentQualification.result.freeze.freezeSha256
      && preflight.qualificationProofSha256 === proof.proofSha256,
    `${args.kind} live preflight belongs to another V3 qualification proof`);
  requireCondition(preflight.executionRoute === "codex_exec_chatgpt_subscription"
      && preflight.authMode === "chatgpt"
      && preflight.apiKeyPresent === false
      && preflight.apiFallbackAllowed === false
      && preflight.apiCallsMade === 0
      && preflight.maxParallel === 2
      && preflight.executionProfileHash === args.qualificationPreflight.executionProfileHash
      && preflight.routePolicyVersion === args.qualificationPreflight.routePolicyVersion,
    `${args.kind} live preflight is not the frozen key-free ChatGPT route`);
  requireCondition(preflight.directHttpOrSdkAllowed === false
      && Array.isArray(preflight.forbiddenProviderEnvKeysPresent)
      && preflight.forbiddenProviderEnvKeysPresent.length === 0,
    `${args.kind} live preflight permits a direct provider route`);
  requireCondition(allFalse(preflight.externalCapabilities),
    `${args.kind} live preflight enables an external capability`);
}

function assertAcceptedCampaign(args: {
  outer: RunForwardLiveCampaignResultV3;
  kind: "pilot" | "gold";
  experimentId: string;
  expectedChapters: number;
  currentQualification: BuildForwardRoleAssignmentFreezeV3Input;
  freeze: ForwardRoleAssignmentFreezeV3;
  qualificationPreflight: LiveQualificationPreflightV3;
}): void {
  const { outer, kind, experimentId, expectedChapters } = args;
  requireCondition(outer.schema === FORWARD_LIVE_CAMPAIGN_RESULT_V3_SCHEMA
      && outer.apiCallsMade === 0
      && outer.publish === false
      && outer.promote === false
      && outer.deploy === false
      && outer.upload === false,
    `${kind} outer live result records an API call or external capability`);
  assertCampaignPreflight(args);
  const campaign = outer.campaign;
  requireCondition(campaign.schema === FORWARD_VALIDATION_RESULT_SCHEMA
      && campaign.kind === kind
      && campaign.experimentId === experimentId,
    `${kind} campaign is not the fresh v2-envelope identity`);
  requireCondition(campaign.accepted === true && campaign.hardFailures.length === 0,
    `${kind} campaign was not accepted`);
  requireCondition(allFalse(campaign.capabilitiesUsed), `${kind} campaign used an external capability`);

  const accounting = campaign.accounting;
  requireCondition(accounting.totalChapters === expectedChapters
      && accounting.firstWritePassRate >= 0.75
      && accounting.finalPassCount === expectedChapters
      && accounting.finalPassRate === 1,
    `${kind} campaign does not meet the frozen first-write/final PASS thresholds`);
  for (const [label, count] of Object.entries({
    finalSourceBlockers: accounting.finalSourceBlockers,
    finalQuizBlockers: accounting.finalQuizBlockers,
    finalReaderHardBlockers: accounting.finalReaderHardBlockers,
    wrongQuizKeys: accounting.wrongQuizKeys,
    unsupportedSourceBoundInventedDetails: accounting.unsupportedSourceBoundInventedDetails,
    misleadingConstructedFraming: accounting.misleadingConstructedFraming,
    genericHistoricalSpecificityLeaks: accounting.genericHistoricalSpecificityLeaks,
    stateProvenanceSchemaFailures: accounting.stateProvenanceSchemaFailures,
    unexpectedWrites: accounting.unexpectedWrites,
    staleEvidenceAccepted: accounting.staleEvidenceAccepted,
    repeatedOrUnboundedRepair: accounting.repeatedOrUnboundedRepair,
  })) requireCondition(count === 0, `${kind} campaign has ${label}=${count}`);
  const finals = Object.values(campaign.finalByChapter);
  requireCondition(finals.length === expectedChapters
      && finals.every((entry) => entry.pass === true
        && entry.finalStatus === "PASS"
        && (entry.aggregate?.readerComposite ?? -1) >= 80
        && entry.executionEnvelope?.finalStatus === "PASS"),
    `${kind} campaign final chapter set is incomplete, stale, or below reader composite 80`);

  if (kind === "gold") {
    requireCondition(accounting.unsupportedHighSeverityCausalClaims === 0,
      "gold campaign has unsupported high-severity causal claims");
    requireCondition(accounting.fullRegenerations / accounting.totalChapters <= 0.25
        && accounting.chaptersRequiringContentRepair / accounting.totalChapters <= 0.40,
      "gold campaign exceeds the frozen regeneration or content-repair ceiling");
    const evaluation = campaign.goldEvaluation;
    requireCondition(evaluation !== null
        && evaluation.technicalCompleteness === "PASS"
        && evaluation.epistemicInstructionalSafety === "PASS"
        && evaluation.ethicsReaderAutonomy === "PASS"
        && evaluation.purposeAudienceDeclaration === "PASS"
        && evaluation.externalAccuracy === "PASS"
        && evaluation.contentDesignScore >= 80
        && evaluation.sweep.verdict === "PASS",
      "gold campaign has a failed evaluation hard gate or sweep");
    const raters = evaluation?.evidenceBinding?.raters;
    requireCondition(Array.isArray(raters) && raters.length === 2
        && raters[0].actorId !== raters[1].actorId
        && raters[0].executionId !== raters[1].executionId
        && raters[0].artifactSha256 !== raters[1].artifactSha256
        && raters[0].receipt.storageId !== raters[1].receipt.storageId,
      "gold campaign does not retain two distinct blind raters");
  }
}

function currentEvidence(
  kind: "pilot" | "gold",
  payload: ForwardValidationCampaignResultV1,
): ForwardLocalCurrentEvidenceV1 {
  const draft = {
    schema: FORWARD_LOCAL_CURRENT_EVIDENCE_SCHEMA,
    kind,
    payload: clone(payload),
    payloadSha256: hashCanonical(payload),
  };
  return { ...draft, evidenceSha256: hashCanonical(draft) };
}

export type ForwardLocalActivationArtifactValuesV2 = {
  [FORWARD_LOCAL_CURRENT_PATHS.qualification]: RoleQualificationRunnerResultV3;
  [FORWARD_LOCAL_CURRENT_PATHS.pilot]: ForwardLocalCurrentEvidenceV1;
  [FORWARD_LOCAL_CURRENT_PATHS.gold]: ForwardLocalCurrentEvidenceV1;
  [FORWARD_LOCAL_CURRENT_PATHS.instrumentBinding]: InstrumentCertificationBindingV3;
  [FORWARD_LOCAL_CURRENT_PATHS.reviewConfig]: ForwardRoleAssignmentFreezeV3["reviewConfig"];
  [FORWARD_LOCAL_CURRENT_PATHS.roleAssignmentFreeze]: ForwardRoleAssignmentFreezeV3;
  [FORWARD_LOCAL_CURRENT_PATHS.noApiRoute]: VerifiedNoApiRouteV1;
  [FORWARD_LOCAL_RUNTIME_BINDING_REL_PATH]: ForwardLocalRuntimeBindingV1;
  [FORWARD_LOCAL_ACTIVATION_POLICY_REL_PATH]: ForwardActivationPolicyV1;
  [FORWARD_LOCAL_ACTIVATION_READINESS_PROOF_REL_PATH]: Imp24ActivationReadinessProofV2;
  [FORWARD_LOCAL_ACTIVATION_QUALIFICATION_PROOF_REL_PATH]: Imp24RetainedRoleQualificationEvidenceProofV1;
  [FORWARD_LOCAL_ACTIVATION_PILOT_PROOF_REL_PATH]: Imp24RetainedCampaignEvidenceProofV1;
  [FORWARD_LOCAL_ACTIVATION_GOLD_PROOF_REL_PATH]: Imp24RetainedCampaignEvidenceProofV1;
};

export type BuildForwardLocalActivationArtifactsInputV2 = {
  activationId: string;
  activatedAt: string;
  currentQualification: BuildForwardRoleAssignmentFreezeV3Input;
  roleAssignmentFreeze: ForwardRoleAssignmentFreezeV3;
  qualificationPreflight: LiveQualificationPreflightV3;
  retainedQualificationEvidence: VerifiedForwardRetainedRoleQualificationEvidenceV3;
  pilotEvidence: VerifiedForwardRetainedCampaignEvidenceV3;
  goldEvidence: VerifiedForwardRetainedCampaignEvidenceV3;
  readiness: VerifiedImp24ActivationReadinessV2;
};

export type ForwardLocalActivationMaterializationV2 = {
  schema: typeof FORWARD_LOCAL_ACTIVATION_MATERIALIZATION_V2_SCHEMA;
  readinessProof: Imp24ActivationReadinessProofV2;
  qualificationEvidenceProof: Imp24RetainedRoleQualificationEvidenceProofV1;
  pilotEvidenceProof: Imp24RetainedCampaignEvidenceProofV1;
  goldEvidenceProof: Imp24RetainedCampaignEvidenceProofV1;
  artifactsByPath: ForwardLocalActivationArtifactValuesV2;
  modelCalls: 0;
  apiCalls: 0;
  networkCalls: 0;
  externalCapabilities: typeof ZERO_EXTERNAL_CAPABILITIES;
  materializationSha256: string;
};

/** Validate every retained gate and compose the exact local ACTIVE projection. */
export function buildForwardLocalActivationArtifactsV2(
  input: BuildForwardLocalActivationArtifactsInputV2,
): Readonly<ForwardLocalActivationMaterializationV2> {
  requireCondition(typeof input.activationId === "string" && input.activationId.trim().length > 0,
    "activationId is required");
  requireCondition(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(input.activatedAt)
      && Number.isFinite(Date.parse(input.activatedAt)),
    "activatedAt must be an explicit UTC ISO timestamp");
  assertVerifiedImp24ActivationReadinessV2(input.readiness);
  assertVerifiedForwardRetainedCampaignEvidenceV3(input.pilotEvidence, "pilot");
  assertVerifiedForwardRetainedCampaignEvidenceV3(input.goldEvidence, "gold");
  assertQualification(
    input.currentQualification,
    input.roleAssignmentFreeze,
    input.qualificationPreflight,
    input.retainedQualificationEvidence,
  );
  const result = input.currentQualification.result;
  const certification = input.currentQualification.certification;
  const pilotLiveResult = input.pilotEvidence.result;
  const goldLiveResult = input.goldEvidence.result;
  requireCondition(input.readiness.proof.productionInstrumentSealSha256 === input.roleAssignmentFreeze.productionInstrumentSealSha256
      && input.readiness.proof.instrumentCertificationSha256 === certification.certificationSha256,
    "activation readiness proof belongs to another production seal or instrument certification");
  assertAcceptedCampaign({
    outer: pilotLiveResult,
    kind: "pilot",
    experimentId: input.pilotEvidence.manifest.manifest.experimentId,
    expectedChapters: 8,
    currentQualification: input.currentQualification,
    freeze: input.roleAssignmentFreeze,
    qualificationPreflight: input.qualificationPreflight,
  });
  assertAcceptedCampaign({
    outer: goldLiveResult,
    kind: "gold",
    experimentId: GOLD_ENVELOPE_EXPERIMENT_ID,
    expectedChapters: 13,
    currentQualification: input.currentQualification,
    freeze: input.roleAssignmentFreeze,
    qualificationPreflight: input.qualificationPreflight,
  });
  if (input.goldEvidence.manifest.manifest.kind !== "gold") {
    throw new ForwardLocalActivationMaterializerV2Error("gold retained evidence manifest kind drift");
  }
  requireCondition(input.goldEvidence.manifest.manifest.pilotManifestSha256 === input.pilotEvidence.manifest.manifestSha256
      && input.goldEvidence.manifest.manifest.pilotResultSha256 === hashCanonical(pilotLiveResult.campaign),
    "gold retained evidence is not bound to the exact accepted pilot manifest/result");

  const runtimeBinding = buildForwardLocalRuntimeBindingV2(input.roleAssignmentFreeze);
  const reviewers = fixedReviewersFromRuntimeBinding(runtimeBinding);
  const routeCore: VerifiedNoApiRouteCoreV1 = {
    schema: VERIFIED_NO_API_ROUTE_SCHEMA,
    verified: true,
    executionRoute: "codex_exec_chatgpt_subscription",
    authMode: "chatgpt",
    apiKeyPresent: false,
    apiFallbackAllowed: false,
    routePolicyVersion: input.qualificationPreflight.routePolicyVersion,
    executionProfileHash: input.qualificationPreflight.executionProfileHash,
    cliVersion: input.qualificationPreflight.cliVersion,
  };
  const noApiRoute = bindVerifiedNoApiRoute(routeCore);
  const pilotEvidence = currentEvidence("pilot", pilotLiveResult.campaign);
  const goldEvidence = currentEvidence("gold", goldLiveResult.campaign);
  const previousProfile: LocalForwardRouteProfileV1 = {
    schema: LOCAL_ROUTE_PROFILE_SCHEMA,
    profileId: "baseline-55",
    writer: { model: HISTORICAL_BASELINE_55, effort: "xhigh" },
    highRiskWriter: { model: HISTORICAL_BASELINE_55, effort: "xhigh" },
    reviewers: clone(reviewers),
  };
  const activationPolicy = buildForwardActivationPolicy({
    activationId: input.activationId,
    activatedAt: input.activatedAt,
    qualificationPassed: true,
    pilotPassed: true,
    goldBookPassed: true,
    hardGateFailures: [],
    frozenRoleAssignmentHash: fixedReviewerProfilesHash(reviewers),
    fixedReviewerProfiles: reviewers,
    noApiRoute,
    previousProfile,
    evidence: {
      qualificationEvidenceHash: input.roleAssignmentFreeze.qualificationResultSha256,
      pilotEvidenceHash: pilotEvidence.evidenceSha256,
      goldBookEvidenceHash: goldEvidence.evidenceSha256,
    },
  });

  const artifactsByPath: ForwardLocalActivationArtifactValuesV2 = {
    [FORWARD_LOCAL_CURRENT_PATHS.qualification]: clone(result),
    [FORWARD_LOCAL_CURRENT_PATHS.pilot]: pilotEvidence,
    [FORWARD_LOCAL_CURRENT_PATHS.gold]: goldEvidence,
    [FORWARD_LOCAL_CURRENT_PATHS.instrumentBinding]: clone(certification),
    [FORWARD_LOCAL_CURRENT_PATHS.reviewConfig]: clone(input.roleAssignmentFreeze.reviewConfig),
    [FORWARD_LOCAL_CURRENT_PATHS.roleAssignmentFreeze]: clone(input.roleAssignmentFreeze),
    [FORWARD_LOCAL_CURRENT_PATHS.noApiRoute]: noApiRoute,
    [FORWARD_LOCAL_RUNTIME_BINDING_REL_PATH]: runtimeBinding,
    [FORWARD_LOCAL_ACTIVATION_POLICY_REL_PATH]: activationPolicy,
    [FORWARD_LOCAL_ACTIVATION_READINESS_PROOF_REL_PATH]: clone(input.readiness.proof),
    [FORWARD_LOCAL_ACTIVATION_QUALIFICATION_PROOF_REL_PATH]: clone(input.retainedQualificationEvidence.proof),
    [FORWARD_LOCAL_ACTIVATION_PILOT_PROOF_REL_PATH]: clone(input.pilotEvidence.proof),
    [FORWARD_LOCAL_ACTIVATION_GOLD_PROOF_REL_PATH]: clone(input.goldEvidence.proof),
  };
  const draft = {
    schema: FORWARD_LOCAL_ACTIVATION_MATERIALIZATION_V2_SCHEMA,
    readinessProof: clone(input.readiness.proof),
    qualificationEvidenceProof: clone(input.retainedQualificationEvidence.proof),
    pilotEvidenceProof: clone(input.pilotEvidence.proof),
    goldEvidenceProof: clone(input.goldEvidence.proof),
    artifactsByPath,
    modelCalls: 0 as const,
    apiCalls: 0 as const,
    networkCalls: 0 as const,
    externalCapabilities: ZERO_EXTERNAL_CAPABILITIES,
  };
  return deepFreeze({ ...draft, materializationSha256: hashCanonical(draft) });
}
