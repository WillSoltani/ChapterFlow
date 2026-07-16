/**
 * Pure IMP-23 bridge from retained v2 live evidence to the exact local ACTIVE
 * artifacts consumed by forwardLocalAutopilot. This module owns no filesystem,
 * process, clock, provider, or model capability.
 */

import { canonicalJson, hashCanonical } from "../contracts/contractUtil.js";
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
  buildForwardLocalRuntimeBinding,
  fixedReviewersFromRuntimeBinding,
  type ForwardLocalRuntimeBindingV1,
} from "./forwardAuthorRuntime.js";
import {
  FORWARD_LOCAL_CURRENT_EVIDENCE_SCHEMA,
  FORWARD_LOCAL_CURRENT_PATHS,
  type ForwardLocalCurrentEvidenceV1,
} from "./forwardLocalAutopilot.js";
import {
  FORWARD_ROLE_ASSIGNMENT_FREEZE_SCHEMA,
  FORWARD_SEALED_QUALIFICATION_BUNDLE_SCHEMA,
  type ForwardQualificationInstrumentBindingV1,
  type ForwardRoleAssignmentFreezeV1,
  type ForwardSealedQualificationBundleV1,
} from "./forwardRoleAssignmentFreeze.js";
import type { LiveQualificationPreflightV1 } from "./forwardRoleQualificationLive.js";
/** The pre-migration rollback profile is named `baseline-55`; its writer is the
 *  HISTORICAL gpt-5.5 baseline, a frozen data identity. It used to read
 *  BASELINE_MODEL, which silently re-pointed the rollback target to gpt-5.6-sol
 *  when WP-302 flipped the live baseline — collapsing the rollback to the same
 *  model it rolls back FROM. Frozen per WP-501 Part 3. gpt-5.5 is VOID for the
 *  target architecture (no live route); this is a record of the prior profile. */
const HISTORICAL_BASELINE_55 = "gpt-5.5";
import {
  FORWARD_LIVE_CAMPAIGN_PREFLIGHT_SCHEMA,
  FORWARD_LIVE_CAMPAIGN_RESULT_SCHEMA,
  type ForwardLiveCampaignPreflightV1,
  type RunForwardLiveCampaignResultV1,
} from "./forwardLiveValidationDriver.js";

export const IMP23_QUALIFICATION_EXPERIMENT_ID = "s16-forward-role-qualification-v2" as const;
export const FORWARD_LOCAL_ACTIVATION_MATERIALIZATION_SCHEMA = "imp23-forward-local-activation-materialization-v1" as const;
export const FORWARD_LOCAL_RUNTIME_BINDING_REL_PATH = "runtime-binding.json" as const;
export const FORWARD_LOCAL_ACTIVATION_POLICY_REL_PATH = "activation-policy.json" as const;

const SHA256 = /^[a-f0-9]{64}$/;
const ZERO_EXTERNAL_CAPABILITIES = Object.freeze({
  publish: false,
  promote: false,
  deploy: false,
  upload: false,
  api: false,
} as const);

export class ForwardLocalActivationMaterializerError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ForwardLocalActivationMaterializerError";
  }
}

function requireCondition(condition: unknown, message: string): asserts condition {
  if (!condition) throw new ForwardLocalActivationMaterializerError(message);
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

function assertQualificationIdentity(
  bundle: ForwardSealedQualificationBundleV1,
  freeze: ForwardRoleAssignmentFreezeV1,
): void {
  requireCondition(bundle.schema === FORWARD_SEALED_QUALIFICATION_BUNDLE_SCHEMA,
    "qualification bundle schema mismatch");
  requireCondition(bundle.seal.experimentId === IMP23_QUALIFICATION_EXPERIMENT_ID,
    "local activation requires the corrected v2 qualification bundle");
  requireSha(bundle.bundleSha256, "qualification bundle hash");
  requireCondition(bundle.bundleSha256 === hashWithout(bundle as unknown as Record<string, unknown>, "bundleSha256"),
    "qualification bundle hash drift");
  requireSha(bundle.seal.sealSha256, "qualification seal hash");
  requireCondition(bundle.seal.sealSha256 === hashWithout(bundle.seal as unknown as Record<string, unknown>, "sealSha256"),
    "qualification seal hash drift");
  requireCondition(bundle.seal.qualificationResultSha256 === hashCanonical(bundle.result),
    "qualification result differs from its seal");
  requireCondition(bundle.seal.registrySha256 === hashCanonical(bundle.registry),
    "qualification registry differs from its seal");
  requireCondition(bundle.seal.instrumentBindingSha256 === hashCanonical(bundle.instrumentBinding),
    "qualification instrument binding differs from its seal");

  requireCondition(freeze.schema === FORWARD_ROLE_ASSIGNMENT_FREEZE_SCHEMA,
    "role-assignment freeze schema mismatch");
  requireSha(freeze.freezeSha256, "role-assignment freeze hash");
  requireCondition(freeze.freezeSha256 === hashWithout(freeze as unknown as Record<string, unknown>, "freezeSha256"),
    "role-assignment freeze hash drift");
  requireCondition(freeze.qualificationBundleSha256 === bundle.bundleSha256,
    "role-assignment freeze belongs to another qualification bundle");
  requireCondition(freeze.qualificationSealSha256 === bundle.seal.sealSha256,
    "role-assignment freeze belongs to another qualification seal");
  requireCondition(freeze.instrumentBindingSha256 === hashCanonical(freeze.instrumentBinding)
      && freeze.instrumentBindingSha256 === bundle.seal.instrumentBindingSha256
      && hashCanonical(freeze.instrumentBinding) === hashCanonical(bundle.instrumentBinding),
    "qualification and role-freeze instrument bindings differ");
}

function assertQualificationPreflight(
  preflight: LiveQualificationPreflightV1,
  freeze: ForwardRoleAssignmentFreezeV1,
): void {
  requireCondition(preflight.experimentId === IMP23_QUALIFICATION_EXPERIMENT_ID,
    "activation preflight is not the corrected v2 qualification spec");
  requireCondition(preflight.specRelPath === `state/migration-experiments/${IMP23_QUALIFICATION_EXPERIMENT_ID}/spec.json`,
    "activation preflight is bound to another qualification spec path");
  requireSha(preflight.specBytesSha256, "qualification spec bytes hash");
  requireCondition(typeof preflight.cliVersion === "string" && preflight.cliVersion.trim().length > 0,
    "qualification preflight lacks the verified Codex CLI version");
  requireCondition(preflight.authMode === "chatgpt"
      && preflight.apiKeyPresent === false
      && preflight.apiFallbackAllowed === false
      && preflight.forbiddenProviderEnvKeysPresent.length === 0,
    "qualification preflight is not a key-free ChatGPT route");
  requireCondition(preflight.maxParallel === 2, "qualification preflight maxParallel must remain exactly 2");
  requireCondition(preflight.executionProfileHash === freeze.instrumentBinding.executionRoute.executionProfileHash
      && preflight.routePolicyVersion === freeze.instrumentBinding.executionRoute.routePolicyVersion,
    "qualification preflight route differs from the role freeze");
}

function assertOuterPreflight(
  preflight: ForwardLiveCampaignPreflightV1,
  kind: "pilot" | "gold",
  campaign: RunForwardLiveCampaignResultV1["campaign"],
  bundle: ForwardSealedQualificationBundleV1,
  freeze: ForwardRoleAssignmentFreezeV1,
  qualificationPreflight: LiveQualificationPreflightV1,
): void {
  requireCondition(preflight.schema === FORWARD_LIVE_CAMPAIGN_PREFLIGHT_SCHEMA && preflight.kind === kind,
    `${kind} live preflight schema/kind mismatch`);
  requireSha(preflight.preflightSha256, `${kind} live preflight hash`);
  requireCondition(preflight.preflightSha256 === hashWithout(preflight as unknown as Record<string, unknown>, "preflightSha256"),
    `${kind} live preflight hash drift`);
  const expectedCampaignExperimentId = kind === "pilot"
    ? "s16-forward-sol-pilot-v1"
    : "s16-forward-sol-gold-book-v1";
  requireCondition(preflight.experimentId === expectedCampaignExperimentId
      && campaign.experimentId === expectedCampaignExperimentId,
    `${kind} campaign identity differs from the frozen campaign identity`);
  requireCondition(preflight.manifestSha256 === campaign.manifestSha256,
    `${kind} result belongs to another live preflight manifest`);
  requireCondition(preflight.qualificationBundleSha256 === bundle.bundleSha256
      && preflight.roleAssignmentFreezeSha256 === freeze.freezeSha256
      && preflight.roleAssignmentSha256 === freeze.roleAssignmentSha256
      && preflight.productionInstrumentSealSha256 === freeze.productionInstrumentSealSha256,
    `${kind} preflight belongs to another qualification bundle or role freeze`);
  requireCondition(preflight.executionRoute === "codex_exec_chatgpt_subscription"
      && preflight.authMode === "chatgpt"
      && preflight.apiKeyPresent === false
      && preflight.apiFallbackAllowed === false
      && preflight.apiCallsMade === 0,
    `${kind} preflight permits or records an API route`);
  requireCondition(preflight.executionProfileHash === qualificationPreflight.executionProfileHash
      && preflight.routePolicyVersion === qualificationPreflight.routePolicyVersion,
    `${kind} preflight route differs from the v2 qualification preflight`);
  requireCondition(preflight.maxParallel === 2 && allFalse(preflight.externalCapabilities),
    `${kind} preflight concurrency or external capabilities drift`);
}

function assertAcceptedCampaign(
  outer: RunForwardLiveCampaignResultV1,
  kind: "pilot" | "gold",
  expectedChapters: 8 | 13,
  bundle: ForwardSealedQualificationBundleV1,
  freeze: ForwardRoleAssignmentFreezeV1,
  qualificationPreflight: LiveQualificationPreflightV1,
): void {
  requireCondition(outer.schema === FORWARD_LIVE_CAMPAIGN_RESULT_SCHEMA,
    `${kind} outer live result schema mismatch`);
  requireCondition(outer.apiCallsMade === 0
      && outer.publish === false
      && outer.promote === false
      && outer.deploy === false
      && outer.upload === false,
    `${kind} outer live result records an API call or external capability`);
  const campaign = outer.campaign;
  assertOuterPreflight(outer.preflight, kind, campaign, bundle, freeze, qualificationPreflight);
  requireCondition(campaign.schema === "forward-validation-campaign-result-v1" && campaign.kind === kind,
    `${kind} inner campaign schema/kind mismatch`);
  requireCondition(campaign.accepted === true && campaign.hardFailures.length === 0,
    `${kind} campaign was not accepted`);
  requireCondition(allFalse(campaign.capabilitiesUsed), `${kind} campaign used an external capability`);
  const accounting = campaign.accounting;
  requireCondition(accounting.totalChapters === expectedChapters,
    `${kind} campaign must contain exactly ${expectedChapters} chapters`);
  requireCondition(accounting.firstWritePassRate >= 0.75 && accounting.finalPassRate === 1,
    `${kind} campaign does not meet first-write/final pass thresholds`);
  requireCondition(accounting.finalSourceBlockers === 0
      && accounting.finalQuizBlockers === 0
      && accounting.finalReaderHardBlockers === 0
      && accounting.stateProvenanceSchemaFailures === 0
      && accounting.unexpectedWrites === 0
      && accounting.staleEvidenceAccepted === 0,
    `${kind} campaign has a blocker, state/provenance failure, unexpected write, or stale evidence`);
  if (kind === "gold") {
    const evaluation = campaign.goldEvaluation;
    requireCondition(evaluation !== null && evaluation.contentDesignScore >= 80,
      "gold campaign lacks the minimum Content Design Score");
    requireCondition(evaluation.technicalCompleteness === "PASS"
        && evaluation.epistemicInstructionalSafety === "PASS"
        && evaluation.ethicsReaderAutonomy === "PASS"
        && evaluation.purposeAudienceDeclaration === "PASS"
        && evaluation.externalAccuracy === "PASS"
        && evaluation.sweep.verdict === "PASS",
      "gold campaign has a failed hard gate or sweep");
  }
}

function currentEvidence(
  kind: "pilot" | "gold",
  payload: RunForwardLiveCampaignResultV1["campaign"],
): ForwardLocalCurrentEvidenceV1 {
  const draft = {
    schema: FORWARD_LOCAL_CURRENT_EVIDENCE_SCHEMA,
    kind,
    payload: clone(payload),
    payloadSha256: hashCanonical(payload),
  };
  return { ...draft, evidenceSha256: hashCanonical(draft) };
}

export type ForwardLocalActivationArtifactValuesV1 = {
  [FORWARD_LOCAL_CURRENT_PATHS.qualification]: ForwardSealedQualificationBundleV1;
  [FORWARD_LOCAL_CURRENT_PATHS.pilot]: ForwardLocalCurrentEvidenceV1;
  [FORWARD_LOCAL_CURRENT_PATHS.gold]: ForwardLocalCurrentEvidenceV1;
  [FORWARD_LOCAL_CURRENT_PATHS.instrumentBinding]: ForwardQualificationInstrumentBindingV1;
  [FORWARD_LOCAL_CURRENT_PATHS.reviewConfig]: ForwardRoleAssignmentFreezeV1["reviewConfig"];
  [FORWARD_LOCAL_CURRENT_PATHS.roleAssignmentFreeze]: ForwardRoleAssignmentFreezeV1;
  [FORWARD_LOCAL_CURRENT_PATHS.noApiRoute]: VerifiedNoApiRouteV1;
  [FORWARD_LOCAL_RUNTIME_BINDING_REL_PATH]: ForwardLocalRuntimeBindingV1;
  [FORWARD_LOCAL_ACTIVATION_POLICY_REL_PATH]: ForwardActivationPolicyV1;
};

export type BuildForwardLocalActivationArtifactsInputV1 = {
  activationId: string;
  activatedAt: string;
  qualificationBundle: ForwardSealedQualificationBundleV1;
  roleAssignmentFreeze: ForwardRoleAssignmentFreezeV1;
  qualificationPreflight: LiveQualificationPreflightV1;
  pilotLiveResult: RunForwardLiveCampaignResultV1;
  goldLiveResult: RunForwardLiveCampaignResultV1;
};

export type ForwardLocalActivationMaterializationV1 = {
  schema: typeof FORWARD_LOCAL_ACTIVATION_MATERIALIZATION_SCHEMA;
  artifactsByPath: ForwardLocalActivationArtifactValuesV1;
  modelCalls: 0;
  apiCalls: 0;
  networkCalls: 0;
  externalCapabilities: typeof ZERO_EXTERNAL_CAPABILITIES;
  materializationSha256: string;
};

/** Validate retained live evidence and compose all local ACTIVE artifacts. */
export function buildForwardLocalActivationArtifacts(
  input: BuildForwardLocalActivationArtifactsInputV1,
): Readonly<ForwardLocalActivationMaterializationV1> {
  requireCondition(typeof input.activationId === "string" && input.activationId.trim().length > 0,
    "activationId is required");
  requireCondition(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(input.activatedAt)
      && Number.isFinite(Date.parse(input.activatedAt)),
    "activatedAt must be an explicit UTC ISO timestamp");
  assertQualificationIdentity(input.qualificationBundle, input.roleAssignmentFreeze);
  assertQualificationPreflight(input.qualificationPreflight, input.roleAssignmentFreeze);
  assertAcceptedCampaign(input.pilotLiveResult, "pilot", 8, input.qualificationBundle,
    input.roleAssignmentFreeze, input.qualificationPreflight);
  assertAcceptedCampaign(input.goldLiveResult, "gold", 13, input.qualificationBundle,
    input.roleAssignmentFreeze, input.qualificationPreflight);

  const runtimeBinding = buildForwardLocalRuntimeBinding(input.roleAssignmentFreeze);
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
  const pilotEvidence = currentEvidence("pilot", input.pilotLiveResult.campaign);
  const goldEvidence = currentEvidence("gold", input.goldLiveResult.campaign);
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
      qualificationEvidenceHash: input.qualificationBundle.bundleSha256,
      pilotEvidenceHash: pilotEvidence.evidenceSha256,
      goldBookEvidenceHash: goldEvidence.evidenceSha256,
    },
  });

  const artifactsByPath: ForwardLocalActivationArtifactValuesV1 = {
    [FORWARD_LOCAL_CURRENT_PATHS.qualification]: clone(input.qualificationBundle),
    [FORWARD_LOCAL_CURRENT_PATHS.pilot]: pilotEvidence,
    [FORWARD_LOCAL_CURRENT_PATHS.gold]: goldEvidence,
    [FORWARD_LOCAL_CURRENT_PATHS.instrumentBinding]: clone(input.roleAssignmentFreeze.instrumentBinding),
    [FORWARD_LOCAL_CURRENT_PATHS.reviewConfig]: clone(input.roleAssignmentFreeze.reviewConfig),
    [FORWARD_LOCAL_CURRENT_PATHS.roleAssignmentFreeze]: clone(input.roleAssignmentFreeze),
    [FORWARD_LOCAL_CURRENT_PATHS.noApiRoute]: noApiRoute,
    [FORWARD_LOCAL_RUNTIME_BINDING_REL_PATH]: runtimeBinding,
    [FORWARD_LOCAL_ACTIVATION_POLICY_REL_PATH]: activationPolicy,
  };
  const draft = {
    schema: FORWARD_LOCAL_ACTIVATION_MATERIALIZATION_SCHEMA,
    artifactsByPath,
    modelCalls: 0 as const,
    apiCalls: 0 as const,
    networkCalls: 0 as const,
    externalCapabilities: ZERO_EXTERNAL_CAPABILITIES,
  };
  return deepFreeze({ ...draft, materializationSha256: hashCanonical(draft) });
}
