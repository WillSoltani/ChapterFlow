/**
 * Deterministic IMP-23 retained-artifact materializers.
 *
 * This module deliberately owns no filesystem, process, provider, model, or
 * publication capability.  Callers supply already-retained evidence; the
 * functions below validate and compose it through the existing qualification,
 * campaign, gold-instrument, and production-seal boundaries.
 *
 * SUPERSEDED-BY-S-TIER (V25 decision ledger L-16; WP-203). This IMP-23 base
 * live-artifact materializer is superseded for the active-candidate path by
 * ./forwardLiveArtifactMaterializerV3.ts (IMP-24). It is NOT deleted here
 * because it is still referenced by: (a) the V3 successor, which re-imports the
 * shared helpers `assertAcceptedForwardPilotResult` and
 * `validateForwardInputMaterializationBinding` from it; (b) the quarantined-but-
 * restorable campaign verbs — bakeoff/migration/cli.ts and imp24PilotGoldWorkflow.ts
 * still consume its IMP-23 composition (buildQualificationAndRoleFreezeArtifacts /
 * buildPilotArtifacts / buildGoldArtifacts / stableForwardArtifactJson); (c)
 * forwardRoleAssignmentFreezeV3.ts (buildFixedForwardRoleFreezePolicies); and (d)
 * retained-evidence verification suites (imp24-final-attestation, imp24-pilot-gold-
 * workflow, forward-live-artifact-materializer). The author-first ship path has
 * ZERO runtime reach into this module (tests/campaign-quarantine.test.ts, WP-202).
 * Physical deletion + helper re-homing is deferred to the Phase-8 end-state
 * deletion gate (WP-804 / decision D-5).
 */

import { canonicalJson, hashCanonical, sha256Hex } from "../contracts/contractUtil.js";
import type { RecoveryExperimentSpecV1 } from "../bakeoff/migration/reviewLaneTypes.js";
import type { RoleQualificationRegistryV1 } from "../bakeoff/migration/reviewLaneTypes.js";
import {
  assertRoleQualificationCalibrationInspection,
  type RoleQualificationCalibrationInspectionV1,
  type RoleQualificationCalibrationSealV1,
  type RoleQualificationRunnerResultV1,
} from "../bakeoff/migration/roleQualificationRunner.js";
import type { LiveQualificationPreflightV1 } from "./forwardRoleQualificationLive.js";
import {
  FORWARD_AUDIT_SUBSET_POLICY_SCHEMA,
  FORWARD_DISAGREEMENT_POLICY_SCHEMA,
  FORWARD_ESCALATION_POLICY_SCHEMA,
  validateForwardReviewPolicies,
  type ForwardRoleFreezePoliciesV1,
} from "./forwardReviewPolicy.js";
import {
  FORWARD_QUALIFICATION_INSTRUMENT_BINDING_SCHEMA,
  assertForwardRoleAssignmentFreezeFresh,
  buildForwardRoleAssignmentFreeze,
  sealForwardRoleQualification,
  type ForwardQualificationInstrumentBindingV1,
  type ForwardRoleAssignmentFreezeV1,
  type ForwardSealedQualificationBundleV1,
} from "./forwardRoleAssignmentFreeze.js";
import {
  assertForwardInputFreezeFresh,
  type ForwardInputFreezeV1,
} from "./forwardInputFreeze.js";
import {
  IMP22_FORWARD_INPUT_MATERIALIZATION_SCHEMA,
  type Imp22ForwardInputMaterializationV1,
} from "./forwardInputMaterialization.js";
import {
  buildGoldManifest,
  buildPilotManifest,
  assertManifest,
  type ForwardGoldManifestV1,
  type ForwardPilotManifestV1,
  type ForwardValidationCampaignResultV1,
  type FrozenForwardValidationManifestV1,
} from "./forwardValidationCampaign.js";
import {
  buildForwardGoldEvaluatorInstrument,
  validateForwardGoldEvaluatorInstrument,
  type ForwardGoldEvaluatorInstrumentV1,
} from "./forwardGoldEvaluatorInstrument.js";
import {
  validateForwardProductionInstrumentSeal,
  type ForwardProductionInstrumentSealV1,
} from "./forwardProductionInstrumentSeal.js";
export const IMP23_QUALIFICATION_EXPERIMENT_ID = "s16-forward-role-qualification-v2" as const;
export const FORWARD_LIVE_ARTIFACT_BUNDLE_SCHEMA = "imp23-forward-live-artifact-bundle-v1" as const;

const SHA256 = /^[a-f0-9]{64}$/;
const EXTERNAL_CAPABILITIES = Object.freeze({
  publish: false,
  promote: false,
  deploy: false,
  upload: false,
  api: false,
} as const);
const ZERO_EXTERNAL_ACTIVITY = Object.freeze({
  modelCalls: 0,
  apiCalls: 0,
  networkCalls: 0,
  externalCapabilities: EXTERNAL_CAPABILITIES,
} as const);

export class ForwardLiveArtifactMaterializerError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ForwardLiveArtifactMaterializerError";
  }
}

function requireCondition(condition: unknown, message: string): asserts condition {
  if (!condition) throw new ForwardLiveArtifactMaterializerError(message);
}

function requireSha(value: unknown, label: string): asserts value is string {
  requireCondition(typeof value === "string" && SHA256.test(value), `${label} must be a lowercase sha256`);
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
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

function withoutSelfHash<T extends Record<string, unknown>>(value: T, key: keyof T): Record<string, unknown> {
  const draft = { ...value };
  delete draft[key];
  return draft;
}

/** Exact policy used by the qualification-freeze tests and production panel. */
export function buildFixedForwardRoleFreezePolicies(): ForwardRoleFreezePoliciesV1 {
  const policies: ForwardRoleFreezePoliciesV1 = {
    auditSubset: {
      schema: FORWARD_AUDIT_SUBSET_POLICY_SCHEMA,
      policyVersion: "balanced-forward-reader-audit-v1",
      strategy: "sha256-chapter-coordinate-bucket-v1",
      salt: "imp22-forward-reader-audit-v1",
      modulus: 4,
      includedBuckets: [0],
      coordinateFields: ["bookId", "chapterNumber"],
      frozenBeforeCandidateOutput: true,
      outputIndependent: true,
    },
    escalation: {
      schema: FORWARD_ESCALATION_POLICY_SCHEMA,
      sourceHighSeverityRequiresAdjudicator: true,
      quizAmbiguityRequiresAdjudicator: true,
      readerEscalationAdvisoryOnly: true,
      adjudicatorOperationalFailure: "INCONCLUSIVE",
      outputInformedJudgeRotationAllowed: false,
    },
    disagreement: {
      schema: FORWARD_DISAGREEMENT_POLICY_SCHEMA,
      policyVersion: "fail-closed-forward-disagreement-v1",
      readerPrimaryAuditDisagreement: "REVISE",
      sourceHighSeverityUnresolvedDisagreement: "INCONCLUSIVE",
      quizDeterministicBlockerPrevails: true,
      quizUnresolvedSemanticDisagreement: "INCONCLUSIVE",
      outputInformedResamplingAllowed: false,
      independenceLimitations: {
        readerAudit: { allowSameExactProfile: false, reason: null, mitigation: null },
        sourceAdjudicator: { allowSameExactProfile: false, reason: null, mitigation: null },
      },
    },
  };
  validateForwardReviewPolicies(policies);
  return clone(policies);
}

export type RetainedQualificationSpecV2 = {
  experimentId: string;
  status: string;
  correction?: { ordinal?: number; additionalCorrectedRerunsAllowed?: boolean };
  instruments: {
    aggregator: { sourceBytesSha256: string };
  };
  schedule: { seed: string; maxParallel: number; outputIndependent: boolean };
  executionRoute: {
    authMode: string;
    apiAllowed: boolean;
    apiFallbackAllowed: boolean;
    executionProfileHash: string;
    routePolicyVersion: string;
  };
};

export function assertRetainedV2QualificationIdentity(args: {
  spec: RetainedQualificationSpecV2;
  preflight: Pick<LiveQualificationPreflightV1, "experimentId" | "maxParallel" | "authMode" | "apiKeyPresent" | "apiFallbackAllowed">;
  holdoutResult?: Pick<RoleQualificationRunnerResultV1, "roleSetReady" | "roleSetBlockedReason">;
}): void {
  requireCondition(args.spec.experimentId === IMP23_QUALIFICATION_EXPERIMENT_ID,
    `qualification spec must be ${IMP23_QUALIFICATION_EXPERIMENT_ID}`);
  requireCondition(args.spec.status === "FROZEN_PRE_CALIBRATION",
    "qualification spec is not frozen pre-calibration");
  requireCondition(args.preflight.experimentId === args.spec.experimentId,
    "qualification preflight belongs to another experiment identity");
  requireCondition(args.spec.correction?.ordinal === 1
    && args.spec.correction.additionalCorrectedRerunsAllowed === false,
  "qualification spec is not the one-time corrected v2 instrument");
  requireCondition(args.spec.schedule.maxParallel === 2 && args.preflight.maxParallel === 2
    && args.spec.schedule.outputIndependent === true,
  "qualification concurrency or output-independence policy drift");
  requireCondition(args.spec.executionRoute.authMode === "chatgpt"
    && args.spec.executionRoute.apiAllowed === false
    && args.spec.executionRoute.apiFallbackAllowed === false
    && args.preflight.authMode === "chatgpt"
    && args.preflight.apiKeyPresent === false
    && args.preflight.apiFallbackAllowed === false,
  "qualification is not bound to the no-API ChatGPT route");
  if (args.holdoutResult) {
    requireCondition(args.holdoutResult.roleSetReady === true,
      `qualification role set is not ready: ${args.holdoutResult.roleSetBlockedReason ?? "unknown"}`);
  }
}

function selectedQualifiedAt(result: RoleQualificationRunnerResultV1, registry: RoleQualificationRegistryV1): string {
  const ids = [
    result.selected.readerPrimary,
    result.selected.readerAudit,
    result.selected.sourcePrimary,
    result.selected.sourceAdjudicator,
    result.selected.quizSemanticAdjudicator,
  ];
  requireCondition(ids.every((id): id is string => typeof id === "string" && id.length > 0),
    "qualification is missing a selected required role");
  const timestamps = new Set(ids.map((id) => {
    const profile = registry.profiles.find((candidate) => candidate.profileId === id);
    requireCondition(profile !== undefined, `selected profile ${id} is missing from the retained registry`);
    requireCondition(typeof profile.qualifiedAt === "string" && Number.isFinite(Date.parse(profile.qualifiedAt)),
      `selected profile ${id} has no valid qualifiedAt`);
    return profile.qualifiedAt;
  }));
  requireCondition(timestamps.size === 1, "selected profiles do not share the retained qualification timestamp");
  return [...timestamps][0];
}

export type BuildQualificationAndRoleFreezeInputV1 = {
  spec: RetainedQualificationSpecV2;
  preflight: LiveQualificationPreflightV1;
  calibration: RoleQualificationCalibrationSealV1;
  inspection: RoleQualificationCalibrationInspectionV1;
  holdoutResult: RoleQualificationRunnerResultV1;
  registry: RoleQualificationRegistryV1;
  baseRecoverySpec: RecoveryExperimentSpecV1;
  routeEvidenceSha256: string;
};

export type QualificationAndRoleFreezeArtifactsV1 = {
  schema: typeof FORWARD_LIVE_ARTIFACT_BUNDLE_SCHEMA;
  experimentId: typeof IMP23_QUALIFICATION_EXPERIMENT_ID;
  qualificationBundle: ForwardSealedQualificationBundleV1;
  qualificationBundleSha256: string;
  roleAssignmentFreeze: ForwardRoleAssignmentFreezeV1;
  roleAssignmentFreezeSha256: string;
  policies: ForwardRoleFreezePoliciesV1;
  retainedQualifiedAt: string;
  modelCalls: 0;
  apiCalls: 0;
  networkCalls: 0;
  externalCapabilities: typeof EXTERNAL_CAPABILITIES;
  artifactSha256: string;
};

/** Seal the retained holdout and materialize the conductor-ready role freeze. */
export function buildQualificationAndRoleFreezeArtifacts(
  input: BuildQualificationAndRoleFreezeInputV1,
): Readonly<QualificationAndRoleFreezeArtifactsV1> {
  assertRetainedV2QualificationIdentity({ spec: input.spec, preflight: input.preflight, holdoutResult: input.holdoutResult });
  requireSha(input.routeEvidenceSha256, "retained live route evidence hash");
  assertRoleQualificationCalibrationInspection(input.calibration, input.inspection);
  requireCondition(input.holdoutResult.calibrationInspection?.inspectionSha256 === input.inspection.inspectionSha256,
    "holdout result belongs to another calibration inspection");
  requireCondition(hashCanonical(input.holdoutResult.registry) === hashCanonical(input.registry),
    "retained registry differs from the holdout result registry");
  requireCondition(input.preflight.candidateAvailabilitySha256 === input.calibration.candidateAvailability.availabilitySha256,
    "preflight and calibration candidate availability drift");
  requireCondition(input.preflight.executionProfileHash === input.spec.executionRoute.executionProfileHash
    && input.preflight.routePolicyVersion === input.spec.executionRoute.routePolicyVersion,
  "preflight route differs from the retained qualification spec");
  requireSha(input.spec.instruments.aggregator.sourceBytesSha256, "aggregate prompt source hash");

  const qualifiedAt = selectedQualifiedAt(input.holdoutResult, input.registry);
  const bindingInput: Omit<ForwardQualificationInstrumentBindingV1, "qualificationPromptBundleHashes"> = {
    schema: FORWARD_QUALIFICATION_INSTRUMENT_BINDING_SCHEMA,
    schemaHashes: clone(input.preflight.schemaBytesSha256),
    promptSourceHashes: {
      reader: input.preflight.promptSourceBytesSha256.reader,
      source: input.preflight.promptSourceBytesSha256.source,
      quiz: input.preflight.promptSourceBytesSha256.quiz,
      aggregate: input.spec.instruments.aggregator.sourceBytesSha256,
    },
    instrumentVersions: {
      reader: "reader-experience-review-v1",
      source: "source-integrity-review-v1",
      quiz: "quiz-integrity-adjudication-v1",
      aggregate: "aggregated-chapter-review-v1",
    },
    executionRoute: {
      authMode: "chatgpt-subscription-codex-exec",
      executionProfileHash: input.preflight.executionProfileHash,
      routePolicyVersion: input.preflight.routePolicyVersion,
      routeEvidenceSha256: input.routeEvidenceSha256,
      apiAllowed: false,
      apiFallbackAllowed: false,
      apiCallsMade: 0,
    },
  };
  const qualificationBundle = sealForwardRoleQualification({
    experimentId: IMP23_QUALIFICATION_EXPERIMENT_ID,
    result: input.holdoutResult,
    registry: input.registry,
    instrumentBinding: bindingInput,
    sealedAt: qualifiedAt,
  });
  const currentInstrumentBinding = qualificationBundle.instrumentBinding;
  const policies = buildFixedForwardRoleFreezePolicies();
  const roleAssignmentFreeze = buildForwardRoleAssignmentFreeze({
    qualification: qualificationBundle,
    currentInstrumentBinding,
    currentInstrumentBindingSha256: hashCanonical(currentInstrumentBinding),
    baseRecoverySpec: input.baseRecoverySpec,
    baseRecoverySpecSha256: hashCanonical(input.baseRecoverySpec),
    policies,
    readerBar: 80,
    frozenAt: qualifiedAt,
  });
  const draft = {
    schema: FORWARD_LIVE_ARTIFACT_BUNDLE_SCHEMA,
    experimentId: IMP23_QUALIFICATION_EXPERIMENT_ID,
    qualificationBundle,
    qualificationBundleSha256: qualificationBundle.bundleSha256,
    roleAssignmentFreeze,
    roleAssignmentFreezeSha256: roleAssignmentFreeze.freezeSha256,
    policies,
    retainedQualifiedAt: qualifiedAt,
    ...ZERO_EXTERNAL_ACTIVITY,
  };
  const output = { ...draft, artifactSha256: hashCanonical(draft) } as QualificationAndRoleFreezeArtifactsV1;
  validateQualificationAndRoleFreezeArtifacts(output);
  return deepFreeze(output);
}

export function validateQualificationAndRoleFreezeArtifacts(
  value: QualificationAndRoleFreezeArtifactsV1,
): void {
  requireCondition(value.schema === FORWARD_LIVE_ARTIFACT_BUNDLE_SCHEMA
    && value.experimentId === IMP23_QUALIFICATION_EXPERIMENT_ID,
  "qualification artifact bundle schema or v2 identity mismatch");
  requireCondition(value.qualificationBundle.seal.experimentId === IMP23_QUALIFICATION_EXPERIMENT_ID,
    "qualification bundle is not v2");
  requireCondition(value.qualificationBundleSha256 === value.qualificationBundle.bundleSha256,
    "qualification bundle hash drift");
  requireCondition(value.roleAssignmentFreezeSha256 === value.roleAssignmentFreeze.freezeSha256,
    "role assignment freeze hash drift");
  requireCondition(value.artifactSha256 === hashCanonical(withoutSelfHash(
    value as unknown as Record<string, unknown>, "artifactSha256",
  )), "qualification artifact bundle self hash drift");
  requireCondition(value.modelCalls === 0 && value.apiCalls === 0 && value.networkCalls === 0
    && hashCanonical(value.externalCapabilities) === hashCanonical(EXTERNAL_CAPABILITIES),
  "qualification materializer records an external capability or call");
  assertForwardRoleAssignmentFreezeFresh(
    value.roleAssignmentFreeze,
    value.qualificationBundle,
    value.qualificationBundle.instrumentBinding,
    value.qualificationBundle.seal.instrumentBindingSha256,
  );
}

export function validateForwardInputMaterializationBinding(
  freeze: ForwardInputFreezeV1,
  materialization: Imp22ForwardInputMaterializationV1,
): string {
  assertForwardInputFreezeFresh(freeze);
  requireCondition(materialization.schema === IMP22_FORWARD_INPUT_MATERIALIZATION_SCHEMA,
    "input materialization schema mismatch");
  requireCondition(materialization.inputFreezeSha256 === freeze.freezeSha256,
    "input materialization belongs to another input freeze");
  requireCondition(materialization.priorChapterProseUsed === false,
    "input materialization admits prior chapter prose");
  requireCondition(hashCanonical(materialization.qualificationBookIds) === hashCanonical(freeze.sets.qualificationBookIds),
    "input materialization qualification exclusions drift");
  requireCondition(Object.values(materialization.capabilities).every((capability) => capability === false),
    "input materialization carries an external capability");
  return sha256Hex(`${canonicalJson(materialization)}\n`);
}

function validateRoleAndProductionSeals(
  roleFreeze: ForwardRoleAssignmentFreezeV1,
  productionSeal: ForwardProductionInstrumentSealV1,
  repositoryRoot?: string,
): void {
  requireCondition(roleFreeze.freezeSha256 === hashCanonical(withoutSelfHash(
    roleFreeze as unknown as Record<string, unknown>, "freezeSha256",
  )), "role assignment freeze self hash drift");
  const current = validateForwardProductionInstrumentSeal(productionSeal, { repositoryRoot });
  requireCondition(roleFreeze.productionInstrumentSealSha256 === current.sealSha256,
    "role freeze and current production instrument seal drift");
}

export type BuildPilotArtifactsInputV1 = {
  inputFreeze: ForwardInputFreezeV1;
  inputMaterialization: Imp22ForwardInputMaterializationV1;
  roleFreeze: ForwardRoleAssignmentFreezeV1;
  productionInstrumentSeal: ForwardProductionInstrumentSealV1;
  repositoryRoot?: string;
};

/** Build the exact eight-coordinate pilot manifest from the frozen denominator. */
export function buildPilotArtifacts(
  input: BuildPilotArtifactsInputV1,
): FrozenForwardValidationManifestV1<ForwardPilotManifestV1> {
  const inputMaterializationSha256 = validateForwardInputMaterializationBinding(input.inputFreeze, input.inputMaterialization);
  validateRoleAndProductionSeals(input.roleFreeze, input.productionInstrumentSeal, input.repositoryRoot);
  const manifest = buildPilotManifest({
    frozenAtIso: input.inputFreeze.frozenAtIso,
    roleAssignmentSha256: input.roleFreeze.roleAssignmentSha256,
    instrumentManifestSha256: input.roleFreeze.reviewConfig.instrumentManifestSha256,
    thresholdsSha256: input.roleFreeze.reviewConfig.instrumentManifest.thresholdsSha256,
    inputMaterializationSha256,
    productionInstrumentSealSha256: input.productionInstrumentSeal.sealSha256,
    qualificationBookIds: input.inputFreeze.sets.qualificationBookIds,
    books: input.inputFreeze.pilot,
    goldReservedBookIds: input.inputFreeze.sets.goldBookIds,
  });
  requireCondition(manifest.manifest.targets.length === 8, "pilot selection did not preserve the exact eight-coordinate denominator");
  return manifest;
}

export function assertAcceptedForwardPilotResult(
  pilotManifest: FrozenForwardValidationManifestV1<ForwardPilotManifestV1>,
  pilotResult: ForwardValidationCampaignResultV1,
): void {
  assertManifest(pilotManifest.manifest);
  requireCondition(pilotManifest.manifestSha256 === hashCanonical(pilotManifest.manifest), "pilot manifest hash drift");
  requireCondition(pilotResult.kind === "pilot" && pilotResult.experimentId === pilotManifest.manifest.experimentId
    && pilotResult.manifestSha256 === pilotManifest.manifestSha256,
  "pilot result belongs to another manifest");
  requireCondition(pilotResult.accepted === true && pilotResult.hardFailures.length === 0,
    "gold materialization requires an accepted pilot with no hard failures");
  requireCondition(Object.values(pilotResult.capabilitiesUsed).every((capability) => capability === false),
    "accepted pilot records an external capability");
  requireCondition(pilotResult.accounting.totalChapters === 8
    && pilotResult.accounting.finalPassCount === 8
    && pilotResult.accounting.firstWritePassRate >= 6 / 8
    && pilotResult.accounting.finalPassRate === 1
    && pilotResult.accounting.finalSourceBlockers === 0
    && pilotResult.accounting.finalQuizBlockers === 0
    && pilotResult.accounting.finalReaderHardBlockers === 0
    && pilotResult.accounting.stateProvenanceSchemaFailures === 0
    && pilotResult.accounting.unexpectedWrites === 0
    && pilotResult.accounting.staleEvidenceAccepted === 0,
  "accepted pilot does not meet the frozen 8/8 final and 6/8 first-write barriers");
}

export type GoldArtifactsV1 = {
  goldEvaluatorConfig: Readonly<ForwardGoldEvaluatorInstrumentV1>;
  goldManifest: FrozenForwardValidationManifestV1<ForwardGoldManifestV1>;
};

/** Build the pinned evaluator and an untruncated full-book gold manifest. */
export function buildGoldArtifacts(input: BuildPilotArtifactsInputV1 & {
  pilotManifest: FrozenForwardValidationManifestV1<ForwardPilotManifestV1>;
  pilotResult: ForwardValidationCampaignResultV1;
}): GoldArtifactsV1 {
  assertAcceptedForwardPilotResult(input.pilotManifest, input.pilotResult);
  const inputMaterializationSha256 = validateForwardInputMaterializationBinding(input.inputFreeze, input.inputMaterialization);
  validateRoleAndProductionSeals(input.roleFreeze, input.productionInstrumentSeal, input.repositoryRoot);
  const goldEvaluatorConfig = buildForwardGoldEvaluatorInstrument({ repositoryRoot: input.repositoryRoot });
  validateForwardGoldEvaluatorInstrument(goldEvaluatorConfig, { repositoryRoot: input.repositoryRoot });
  const goldManifest = buildGoldManifest({
    frozenAtIso: input.inputFreeze.frozenAtIso,
    roleAssignmentSha256: input.roleFreeze.roleAssignmentSha256,
    instrumentManifestSha256: input.roleFreeze.reviewConfig.instrumentManifestSha256,
    thresholdsSha256: input.roleFreeze.reviewConfig.instrumentManifest.thresholdsSha256,
    inputMaterializationSha256,
    productionInstrumentSealSha256: input.productionInstrumentSeal.sealSha256,
    qualificationBookIds: input.inputFreeze.sets.qualificationBookIds,
    books: [input.inputFreeze.gold],
    pilotBookIds: input.inputFreeze.sets.pilotBookIds,
    pilotAccepted: true,
    pilotManifestSha256: input.pilotManifest.manifestSha256,
    pilotResultSha256: hashCanonical(input.pilotResult),
    goldEvaluatorInstrumentSha256: goldEvaluatorConfig.instrumentSha256,
  });
  requireCondition(goldManifest.manifest.targets.length === input.inputFreeze.goldChapterCount,
    "gold full-book selection was truncated or expanded");
  return { goldEvaluatorConfig, goldManifest };
}

/** Canonical portable bytes used by callers that elect to persist an artifact. */
export function stableForwardArtifactJson(value: unknown): string {
  return `${canonicalJson(value)}\n`;
}

/** Generic zero-I/O readback helper for self-hashed materializer products. */
export function parseStableForwardArtifact<T>(text: string, selfHashField: string): T {
  let value: Record<string, unknown>;
  try { value = JSON.parse(text) as Record<string, unknown>; }
  catch (error) { throw new ForwardLiveArtifactMaterializerError(`forward artifact is not JSON: ${(error as Error).message}`); }
  const retained = value[selfHashField];
  requireSha(retained, `forward artifact ${selfHashField}`);
  const draft = { ...value };
  delete draft[selfHashField];
  requireCondition(retained === hashCanonical(draft), `forward artifact ${selfHashField} mismatch`);
  return value as T;
}
