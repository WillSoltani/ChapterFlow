/**
 * IMP-22 post-qualification role freeze.
 *
 * This is the additive bridge between the role-qualification runner and the
 * real forward chapter conductor.  It makes no model calls and owns no
 * activation capability.  A caller must first seal a complete, role-ready
 * qualification result; only that immutable bundle can be converted into a
 * fixed production review configuration and the existing IMP-20 recovery seal.
 */

import { validateJudgeCapabilityQualification } from "../contracts/judgeCapabilityQualification.js";
import { hashCanonical } from "../contracts/contractUtil.js";
import { READER_EXPERIENCE_RUBRIC_VERSION } from "../review/readerExperienceReview.js";
import { SOURCE_INTEGRITY_RUBRIC_VERSION } from "../review/sourceIntegrityReview.js";
import { QUIZ_INTEGRITY_ADJUDICATION_SCHEMA } from "../review/quizIntegrityReview.js";
import {
  FORWARD_FROZEN_REVIEW_CONFIG_SCHEMA,
  type ForwardFrozenReviewConfigV1,
} from "./forwardChapterConductor.js";
import {
  FIXED_ROLE_ASSIGNMENT_SCHEMA,
  REQUIRED_ROLE_SET_SCHEMA,
  ROLE_JUDGE_SELECTION_SCHEMA,
  SPLIT_LANE_INSTRUMENT_MANIFEST_SCHEMA,
  type FixedRoleAssignmentV1,
  type RecoveryExperimentSpecV1,
  type ReviewLaneRole,
  type RoleJudgeRefV1,
  type RoleJudgeSelectionV1,
  type RoleQualificationRegistryV1,
  type SplitLaneInstrumentManifestV1,
} from "../bakeoff/migration/reviewLaneTypes.js";
import {
  ROLE_QUALIFICATION_FREEZE_SCHEMA,
  ROLE_QUALIFICATION_RUNNER_SCHEMA,
  type RoleQualificationRunnerResultV1,
} from "../bakeoff/migration/roleQualificationRunner.js";
import { assertRoleSetReady } from "../bakeoff/migration/roleQualification.js";
import { assertNotClosed } from "../bakeoff/migration/guards.js";
import {
  RECOVERY_AGGREGATION_VERSION,
  RECOVERY_CONTRACT_SCHEMA_IDS,
  RECOVERY_EXPERIMENT_ID,
  RECOVERY_REQUIRED_ROLES,
  type RecoverySealV1,
  recoverySpecSha256,
  sealRecoveryExperiment,
  splitLaneInstrumentManifestSha256,
} from "../bakeoff/migration/recoveryExperiment.js";
import {
  QUIZ_DETERMINISTIC_CHECKER_VERSION,
} from "../bakeoff/migration/reviewerRoleAssignment.js";
import {
  assertForwardAssignmentIndependence,
  buildForwardPanelReviewPolicy,
  validateForwardPanelReviewPolicy,
  validateForwardReviewPolicies,
  type ForwardAuditSubsetPolicyV1,
  type ForwardDisagreementPolicyV1,
  type ForwardEscalationPolicyV1,
  type ForwardPanelReviewPolicyV1,
  type ForwardRoleFreezePoliciesV1,
} from "./forwardReviewPolicy.js";
import { buildForwardProductionInstrumentSeal } from "./forwardProductionInstrumentSeal.js";

export {
  FORWARD_AUDIT_SUBSET_POLICY_SCHEMA,
  FORWARD_DISAGREEMENT_POLICY_SCHEMA,
  FORWARD_ESCALATION_POLICY_SCHEMA,
  FORWARD_PANEL_REVIEW_POLICY_SCHEMA,
  assertForwardAssignmentIndependence,
  isInForwardReaderAuditSubset,
} from "./forwardReviewPolicy.js";
export type {
  ForwardAuditSubsetPolicyV1,
  ForwardDisagreementPolicyV1,
  ForwardEscalationPolicyV1,
  ForwardIndependenceLimitationV1,
  ForwardPanelReviewPolicyV1,
  ForwardRoleFreezePoliciesV1,
} from "./forwardReviewPolicy.js";

export const FORWARD_QUALIFICATION_INSTRUMENT_BINDING_SCHEMA = "imp22-forward-qualification-instrument-binding-v1" as const;
export const FORWARD_QUALIFICATION_SEAL_SCHEMA = "imp22-forward-role-qualification-seal-v1" as const;
export const FORWARD_SEALED_QUALIFICATION_BUNDLE_SCHEMA = "imp22-forward-sealed-role-qualification-bundle-v1" as const;
export const FORWARD_ROLE_ASSIGNMENT_FREEZE_SCHEMA = "imp22-forward-role-assignment-freeze-v1" as const;
export const FORWARD_ROLE_PROFILE_BINDING_SCHEMA = "imp22-forward-role-profile-binding-v1" as const;
export const FORWARD_ROLE_ASSIGNMENT_POLICY_VERSION = "imp22-forward-fixed-role-assignment-v1" as const;

const AGGREGATION_VERSION = RECOVERY_AGGREGATION_VERSION;
const SHA256_RE = /^[a-f0-9]{64}$/;
const ROLES: readonly ReviewLaneRole[] = ["reader", "source", "quiz"];

export type ForwardQualificationSchemaHashesV1 = Record<ReviewLaneRole, string>;

export type ForwardPromptSourceHashesV1 = {
  reader: string;
  source: string;
  quiz: string;
  aggregate: string;
};

/** Exact behavior and route inputs used by the qualification run. */
export type ForwardQualificationInstrumentBindingV1 = {
  schema: typeof FORWARD_QUALIFICATION_INSTRUMENT_BINDING_SCHEMA;
  schemaHashes: ForwardQualificationSchemaHashesV1;
  promptSourceHashes: ForwardPromptSourceHashesV1;
  qualificationPromptBundleHashes: Record<ReviewLaneRole, string>;
  instrumentVersions: {
    reader: typeof READER_EXPERIENCE_RUBRIC_VERSION;
    source: typeof SOURCE_INTEGRITY_RUBRIC_VERSION;
    quiz: typeof QUIZ_INTEGRITY_ADJUDICATION_SCHEMA;
    aggregate: typeof AGGREGATION_VERSION;
  };
  executionRoute: {
    authMode: "chatgpt-subscription-codex-exec";
    executionProfileHash: string;
    routePolicyVersion: string;
    routeEvidenceSha256: string;
    apiAllowed: false;
    apiFallbackAllowed: false;
    apiCallsMade: 0;
  };
};

export type ForwardQualificationSealV1 = {
  schema: typeof FORWARD_QUALIFICATION_SEAL_SCHEMA;
  experimentId: string;
  sealed: true;
  qualificationResultSha256: string;
  registrySha256: string;
  qualificationFreezeSha256: string;
  instrumentBindingSha256: string;
  selectedRoleSetSha256: string;
  sealedAt: string;
  sealSha256: string;
};

/** Runtime-immutable qualification snapshot accepted by the config builder. */
export type ForwardSealedQualificationBundleV1 = {
  schema: typeof FORWARD_SEALED_QUALIFICATION_BUNDLE_SCHEMA;
  result: RoleQualificationRunnerResultV1;
  registry: RoleQualificationRegistryV1;
  instrumentBinding: ForwardQualificationInstrumentBindingV1;
  seal: ForwardQualificationSealV1;
  bundleSha256: string;
};

export type ForwardRoleSlot =
  | "readerPrimary"
  | "readerAudit"
  | "sourcePrimary"
  | "sourceAdjudicator"
  | "quizSemanticAdjudicator";

export type ForwardRoleProfileBindingV1 = {
  schema: typeof FORWARD_ROLE_PROFILE_BINDING_SCHEMA;
  slot: ForwardRoleSlot;
  lane: ReviewLaneRole;
  judge: RoleJudgeRefV1;
  profileSha256: string;
  qualificationRecordSha256: string;
  promptSourceSha256: string;
  qualificationPromptBundleSha256: string;
  schemaSha256: string;
  executionProfileHash: string;
  routePolicyVersion: string;
};

/** Additive subtype: structurally accepted by ForwardChapterConductor. */
export type BoundForwardFrozenReviewConfigV1 = ForwardFrozenReviewConfigV1 & {
  qualificationBundleSha256: string;
  instrumentBindingSha256: string;
  roleProfileBindingsSha256: string;
  auditSubsetPolicySha256: string;
  escalationPolicySha256: string;
  disagreementPolicySha256: string;
  panelPolicy: ForwardPanelReviewPolicyV1;
  panelPolicySha256: string;
  recoveryExperimentSealSha256: string;
  promptSourceHashes: ForwardPromptSourceHashesV1;
};

export type ForwardRoleAssignmentFreezeV1 = {
  schema: typeof FORWARD_ROLE_ASSIGNMENT_FREEZE_SCHEMA;
  qualificationBundleSha256: string;
  qualificationSealSha256: string;
  instrumentBinding: ForwardQualificationInstrumentBindingV1;
  instrumentBindingSha256: string;
  roleAssignment: FixedRoleAssignmentV1;
  roleAssignmentSha256: string;
  roleProfileBindings: Record<ForwardRoleSlot, ForwardRoleProfileBindingV1>;
  roleProfileBindingsSha256: string;
  quizDeterministicCheckerSha256: string;
  auditSubsetPolicy: ForwardAuditSubsetPolicyV1;
  auditSubsetPolicySha256: string;
  escalationPolicy: ForwardEscalationPolicyV1;
  escalationPolicySha256: string;
  disagreementPolicy: ForwardDisagreementPolicyV1;
  disagreementPolicySha256: string;
  panelPolicy: ForwardPanelReviewPolicyV1;
  panelPolicySha256: string;
  recoveryExperimentSpec: RecoveryExperimentSpecV1;
  recoveryExperimentSpecSha256: string;
  recoveryExperimentSeal: RecoverySealV1;
  recoveryExperimentSealSha256: string;
  reviewConfig: BoundForwardFrozenReviewConfigV1;
  reviewConfigSha256: string;
  productionInstrumentSealSha256: string;
  frozenAt: string;
  freezeSha256: string;
};

export type SealForwardRoleQualificationInputV1 = {
  experimentId: string;
  result: RoleQualificationRunnerResultV1;
  registry: RoleQualificationRegistryV1;
  /** Current hashes are captured into the qualification seal at this boundary. */
  instrumentBinding: Omit<ForwardQualificationInstrumentBindingV1, "qualificationPromptBundleHashes">;
  sealedAt: string;
};

export type BuildForwardRoleAssignmentFreezeInputV1 = {
  qualification: ForwardSealedQualificationBundleV1;
  currentInstrumentBinding: ForwardQualificationInstrumentBindingV1;
  currentInstrumentBindingSha256: string;
  baseRecoverySpec: RecoveryExperimentSpecV1;
  baseRecoverySpecSha256: string;
  policies: ForwardRoleFreezePoliciesV1;
  readerBar: number;
  frozenAt: string;
};

export class ForwardRoleAssignmentFreezeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ForwardRoleAssignmentFreezeError";
  }
}

function requireCondition(condition: unknown, message: string): asserts condition {
  if (!condition) throw new ForwardRoleAssignmentFreezeError(message);
}

function nonEmpty(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function requireSha(value: unknown, label: string): asserts value is string {
  requireCondition(typeof value === "string" && SHA256_RE.test(value), `${label}: expected lowercase sha256 hex`);
}

function requireContentHash(value: unknown, label: string): asserts value is string {
  requireCondition(
    typeof value === "string" && (SHA256_RE.test(value) || /^sha256:[a-f0-9]{64}$/.test(value)),
    `${label}: expected sha256 content hash`,
  );
}

function deepFreeze<T>(value: T, seen = new WeakSet<object>()): T {
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

function assertDeepFrozen(value: unknown, label: string, seen = new WeakSet<object>()): void {
  if (value === null || typeof value !== "object") return;
  const object = value as object;
  if (seen.has(object)) return;
  seen.add(object);
  requireCondition(Object.isFrozen(object), `${label}: mutable sealed input refused`);
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    assertDeepFrozen(child, `${label}.${key}`, seen);
  }
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function hashWithout<T extends Record<string, unknown>>(value: T, key: keyof T): string {
  const draft = { ...value };
  delete draft[key];
  return hashCanonical(draft);
}

function validateInstrumentBinding(binding: ForwardQualificationInstrumentBindingV1): void {
  requireCondition(binding?.schema === FORWARD_QUALIFICATION_INSTRUMENT_BINDING_SCHEMA, "instrument binding schema mismatch");
  for (const role of ROLES) {
    requireSha(binding.schemaHashes?.[role], `instrument binding ${role} schema`);
    requireSha(binding.qualificationPromptBundleHashes?.[role], `instrument binding ${role} qualification prompt bundle`);
  }
  for (const [name, value] of Object.entries(binding.promptSourceHashes ?? {})) requireSha(value, `instrument binding ${name} prompt source`);
  requireCondition(Object.keys(binding.promptSourceHashes ?? {}).length === 4, "instrument binding must carry exactly four prompt/aggregator source hashes");
  requireCondition(binding.instrumentVersions?.reader === READER_EXPERIENCE_RUBRIC_VERSION, "stale reader instrument version");
  requireCondition(binding.instrumentVersions?.source === SOURCE_INTEGRITY_RUBRIC_VERSION, "stale source instrument version");
  requireCondition(binding.instrumentVersions?.quiz === QUIZ_INTEGRITY_ADJUDICATION_SCHEMA, "stale quiz instrument version");
  requireCondition(binding.instrumentVersions?.aggregate === AGGREGATION_VERSION, "stale aggregate instrument version");
  requireCondition(binding.executionRoute?.authMode === "chatgpt-subscription-codex-exec", "qualification route is not ChatGPT subscription codex exec");
  requireSha(binding.executionRoute?.executionProfileHash, "qualification execution profile");
  requireCondition(nonEmpty(binding.executionRoute?.routePolicyVersion), "qualification route policy version is missing");
  requireSha(binding.executionRoute?.routeEvidenceSha256, "qualification route evidence");
  requireCondition(binding.executionRoute?.apiAllowed === false, "qualification binding permits API execution");
  requireCondition(binding.executionRoute?.apiFallbackAllowed === false, "qualification binding permits API fallback");
  requireCondition(binding.executionRoute?.apiCallsMade === 0, "qualification binding records API calls");
}

function deriveSchemaHashes(result: RoleQualificationRunnerResultV1): ForwardQualificationSchemaHashesV1 {
  const output = {} as ForwardQualificationSchemaHashesV1;
  for (const role of ROLES) {
    const hashes = new Set(
      result.attempts
        .filter((attempt) => attempt.role === role && attempt.routeValid && attempt.receipt !== null)
        .map((attempt) => attempt.receipt!.schemaSha256),
    );
    requireCondition(hashes.size === 1, `qualification ${role} attempts do not bind exactly one schema hash`);
    const [schemaSha256] = hashes;
    requireSha(schemaSha256, `qualification ${role} schema`);
    output[role] = schemaSha256;
  }
  return output;
}

function qualificationStatusField(role: ReviewLaneRole): "readerExperience" | "sourceIntegrity" | "quizIntegrity" {
  return role === "reader" ? "readerExperience" : role === "source" ? "sourceIntegrity" : "quizIntegrity";
}

function validateQualificationResult(
  result: RoleQualificationRunnerResultV1,
  registry: RoleQualificationRegistryV1,
): ForwardQualificationSchemaHashesV1 {
  requireCondition(result?.schema === ROLE_QUALIFICATION_RUNNER_SCHEMA, "role qualification result schema mismatch");
  requireCondition(result.freeze?.schema === ROLE_QUALIFICATION_FREEZE_SCHEMA, "role qualification freeze schema mismatch");
  requireCondition(hashWithout(result.freeze as unknown as Record<string, unknown>, "freezeSha256") === result.freeze.freezeSha256, "role qualification freeze hash drift");
  requireCondition(hashCanonical(result.schedule) === result.freeze.scheduleSha256, "role qualification schedule hash drift");
  requireCondition(registry?.schema === "split-lane-role-qualification-registry-v1", "role qualification registry schema mismatch");
  requireCondition(hashCanonical(result.registry) === hashCanonical(registry), "qualification result/registry mismatch");
  requireCondition(result.roleSetReady === true && result.roleSetBlockedReason === null, "role qualification result is not role-set ready");

  const schemaHashes = deriveSchemaHashes(result);
  requireCondition(hashCanonical(schemaHashes) === result.freeze.schemaHashesSha256, "qualification schema hash set drift");
  for (const role of ROLES) {
    requireContentHash(result.freeze.corpusHashes[role], `qualification ${role} corpus`);
    requireSha(result.freeze.corpusEnvelopeHashes[role], `qualification ${role} corpus envelope`);
    requireSha(result.freeze.promptBundleHashes[role], `qualification ${role} prompt bundle`);
    const ids = result.qualifiers[role] ?? [];
    requireCondition(ids.length >= (role === "quiz" ? 1 : 2), `qualification lacks the required ${role} role count`);
    requireCondition(new Set(ids).size === ids.length, `qualification ${role} qualifier list contains duplicates`);
    for (const profileId of ids) {
      const record = result.profileRoleResults.find((entry) => entry.role === role && entry.profile.profileId === profileId);
      requireCondition(record?.calibrationValid === true && record.holdoutStarted === true && record.holdoutCaseCount > 0, `${profileId} has no valid ${role} calibration/holdout record`);
      requireCondition(record.outcome.status === "QUALIFIED", `${profileId} is not qualified for ${role}`);
    }
  }

  requireCondition(result.selected.readerPrimary === result.qualifiers.reader[0], "reader primary is not the first qualified profile");
  requireCondition(result.selected.readerAudit === result.qualifiers.reader[1], "reader audit is not the second qualified profile");
  requireCondition(result.selected.sourcePrimary === result.qualifiers.source[0], "source primary is not the first qualified profile");
  requireCondition(result.selected.sourceAdjudicator === result.qualifiers.source[1], "source adjudicator is not the second qualified profile");
  requireCondition(result.selected.quizSemanticAdjudicator === result.qualifiers.quiz[0], "quiz adjudicator is not the first qualified profile");

  const ids = new Set<string>();
  for (const profile of registry.profiles) {
    const errors = validateJudgeCapabilityQualification(profile);
    requireCondition(errors.length === 0, `invalid qualification registry profile ${profile.profileId || "(missing)"}: ${errors.join("; ")}`);
    requireCondition(!ids.has(profile.profileId), `duplicate registry profile ${profile.profileId}`);
    ids.add(profile.profileId);
    requireCondition(profile.profileId === `${profile.model}@${profile.effort}`, `registry profile identity mismatch for ${profile.profileId}`);
    requireCondition(profile.instrumentHashes.includes(result.freeze.freezeSha256), `registry profile ${profile.profileId} is stale against qualification freeze`);
    for (const corpusSha256 of Object.values(result.freeze.corpusHashes)) {
      requireCondition(profile.corpusHashes.includes(corpusSha256), `registry profile ${profile.profileId} is stale against a qualification corpus`);
    }
  }

  const selectedByRole: Array<[ReviewLaneRole, string | null]> = [
    ["reader", result.selected.readerPrimary],
    ["reader", result.selected.readerAudit],
    ["source", result.selected.sourcePrimary],
    ["source", result.selected.sourceAdjudicator],
    ["quiz", result.selected.quizSemanticAdjudicator],
  ];
  for (const [role, profileId] of selectedByRole) {
    requireCondition(nonEmpty(profileId), `missing selected ${role} profile`);
    const profile = registry.profiles.find((entry) => entry.profileId === profileId);
    requireCondition(profile !== undefined, `selected profile ${profileId} is absent from registry`);
    requireCondition(profile[qualificationStatusField(role)] === "QUALIFIED", `selected profile ${profileId} is unqualified for ${role}`);
    requireCondition(profile.evidenceHashes.length > 0, `selected profile ${profileId} has no qualification evidence`);
  }

  assertRoleSetReady(registry, RECOVERY_REQUIRED_ROLES);
  return schemaHashes;
}

function assertSealedQualificationBundle(bundle: ForwardSealedQualificationBundleV1): void {
  requireCondition(bundle?.schema === FORWARD_SEALED_QUALIFICATION_BUNDLE_SCHEMA, "sealed qualification bundle schema mismatch");
  assertDeepFrozen(bundle, "sealed qualification bundle");
  const schemaHashes = validateQualificationResult(bundle.result, bundle.registry);
  validateInstrumentBinding(bundle.instrumentBinding);
  requireCondition(hashCanonical(schemaHashes) === hashCanonical(bundle.instrumentBinding.schemaHashes), "sealed qualification schema binding drift");
  requireCondition(hashCanonical(bundle.result.freeze.promptBundleHashes) === hashCanonical(bundle.instrumentBinding.qualificationPromptBundleHashes), "sealed qualification prompt-bundle binding drift");
  requireCondition(bundle.seal?.schema === FORWARD_QUALIFICATION_SEAL_SCHEMA && bundle.seal.sealed === true, "qualification seal schema/state mismatch");
  requireCondition(bundle.seal.qualificationResultSha256 === hashCanonical(bundle.result), "qualification result hash drift");
  requireCondition(bundle.seal.registrySha256 === hashCanonical(bundle.registry), "qualification registry hash drift");
  requireCondition(bundle.seal.qualificationFreezeSha256 === bundle.result.freeze.freezeSha256, "qualification freeze/seal mismatch");
  requireCondition(bundle.seal.instrumentBindingSha256 === hashCanonical(bundle.instrumentBinding), "qualification instrument binding drift");
  requireCondition(bundle.seal.selectedRoleSetSha256 === hashCanonical(bundle.result.selected), "qualification selected-role-set drift");
  requireCondition(hashWithout(bundle.seal as unknown as Record<string, unknown>, "sealSha256") === bundle.seal.sealSha256, "qualification seal hash drift");
  requireCondition(hashWithout(bundle as unknown as Record<string, unknown>, "bundleSha256") === bundle.bundleSha256, "qualification bundle hash drift");
}

/**
 * Validate and snapshot a completed runner result into the only input accepted by
 * the post-qualification builder.  The returned graph is recursively frozen;
 * JSON loaded from disk must pass through this boundary before use.
 */
export function sealForwardRoleQualification(
  input: SealForwardRoleQualificationInputV1,
): ForwardSealedQualificationBundleV1 {
  requireCondition(nonEmpty(input.experimentId), "qualification experiment id is missing");
  assertNotClosed(input.experimentId);
  requireCondition(nonEmpty(input.sealedAt), "qualification sealedAt is missing");
  const result = clone(input.result);
  const registry = clone(input.registry);
  const schemaHashes = validateQualificationResult(result, registry);
  const instrumentBinding: ForwardQualificationInstrumentBindingV1 = {
    ...clone(input.instrumentBinding),
    qualificationPromptBundleHashes: clone(result.freeze.promptBundleHashes),
  };
  validateInstrumentBinding(instrumentBinding);
  requireCondition(hashCanonical(schemaHashes) === hashCanonical(instrumentBinding.schemaHashes), "provided qualification schema binding is stale");

  const sealDraft = {
    schema: FORWARD_QUALIFICATION_SEAL_SCHEMA,
    experimentId: input.experimentId,
    sealed: true as const,
    qualificationResultSha256: hashCanonical(result),
    registrySha256: hashCanonical(registry),
    qualificationFreezeSha256: result.freeze.freezeSha256,
    instrumentBindingSha256: hashCanonical(instrumentBinding),
    selectedRoleSetSha256: hashCanonical(result.selected),
    sealedAt: input.sealedAt,
  };
  const seal: ForwardQualificationSealV1 = { ...sealDraft, sealSha256: hashCanonical(sealDraft) };
  const bundleDraft = {
    schema: FORWARD_SEALED_QUALIFICATION_BUNDLE_SCHEMA,
    result,
    registry,
    instrumentBinding,
    seal,
  };
  const bundle: ForwardSealedQualificationBundleV1 = {
    ...bundleDraft,
    bundleSha256: hashCanonical(bundleDraft),
  };
  deepFreeze(bundle);
  assertSealedQualificationBundle(bundle);
  return bundle;
}

function selectedProfile(bundle: ForwardSealedQualificationBundleV1, profileId: string | null, lane: ReviewLaneRole): RoleJudgeRefV1 {
  requireCondition(nonEmpty(profileId), `missing selected ${lane} profile`);
  const profile = bundle.registry.profiles.find((entry) => entry.profileId === profileId);
  requireCondition(profile !== undefined, `selected profile ${profileId} is absent from registry`);
  requireCondition(profile[qualificationStatusField(lane)] === "QUALIFIED", `selected profile ${profileId} is unqualified for ${lane}`);
  return { profileId: profile.profileId, model: profile.model, effort: profile.effort };
}

function buildRoleAssignment(bundle: ForwardSealedQualificationBundleV1): FixedRoleAssignmentV1 {
  return {
    schema: FIXED_ROLE_ASSIGNMENT_SCHEMA,
    readerPrimary: selectedProfile(bundle, bundle.result.selected.readerPrimary, "reader"),
    readerBackup: selectedProfile(bundle, bundle.result.selected.readerAudit, "reader"),
    sourcePrimary: selectedProfile(bundle, bundle.result.selected.sourcePrimary, "source"),
    sourceAdjudicator: selectedProfile(bundle, bundle.result.selected.sourceAdjudicator, "source"),
    quizChecker: { deterministic: true, checkerVersion: QUIZ_DETERMINISTIC_CHECKER_VERSION },
    quizAdjudicator: selectedProfile(bundle, bundle.result.selected.quizSemanticAdjudicator, "quiz"),
  };
}

function validateAssignmentAgainstBaseSpec(
  assignment: FixedRoleAssignmentV1,
  base: RecoveryExperimentSpecV1,
): void {
  const judges = [
    assignment.readerPrimary,
    assignment.readerBackup,
    assignment.sourcePrimary,
    assignment.sourceAdjudicator,
    assignment.quizAdjudicator,
  ];
  for (const judge of judges) {
    const candidate = base.candidateJudgeProfiles.find((profile) => profile.profileId === judge.profileId);
    requireCondition(candidate !== undefined, `selected profile ${judge.profileId} is absent from the base recovery candidate panel`);
    requireCondition(candidate.model === judge.model && candidate.effort === judge.effort, `selected profile ${judge.profileId} drifts from the base recovery candidate panel`);
  }
  const baseRefs = [
    base.roleAssignment.readerPrimary,
    base.roleAssignment.readerBackup,
    base.roleAssignment.sourcePrimary,
    base.roleAssignment.sourceAdjudicator,
    base.roleAssignment.quizAdjudicator,
  ];
  const baseIsPending = baseRefs.every((ref) => ref.profileId.startsWith("pending-") && ref.model === "pending");
  requireCondition(baseIsPending || hashCanonical(base.roleAssignment) === hashCanonical(assignment), "base recovery spec already carries a different role assignment");
}

function roleBinding(
  bundle: ForwardSealedQualificationBundleV1,
  slot: ForwardRoleSlot,
  lane: ReviewLaneRole,
  judge: RoleJudgeRefV1,
): ForwardRoleProfileBindingV1 {
  const record = bundle.registry.profiles.find((entry) => entry.profileId === judge.profileId);
  requireCondition(record !== undefined, `missing qualification record for ${judge.profileId}`);
  const binding = bundle.instrumentBinding;
  const promptSourceSha256 = lane === "reader"
    ? binding.promptSourceHashes.reader
    : lane === "source"
      ? binding.promptSourceHashes.source
      : binding.promptSourceHashes.quiz;
  return {
    schema: FORWARD_ROLE_PROFILE_BINDING_SCHEMA,
    slot,
    lane,
    judge,
    profileSha256: hashCanonical({
      judge,
      executionProfileHash: binding.executionRoute.executionProfileHash,
      routePolicyVersion: binding.executionRoute.routePolicyVersion,
    }),
    qualificationRecordSha256: hashCanonical(record),
    promptSourceSha256,
    qualificationPromptBundleSha256: binding.qualificationPromptBundleHashes[lane],
    schemaSha256: binding.schemaHashes[lane],
    executionProfileHash: binding.executionRoute.executionProfileHash,
    routePolicyVersion: binding.executionRoute.routePolicyVersion,
  };
}

function validateBaseRecoverySpec(spec: RecoveryExperimentSpecV1): void {
  requireCondition(spec?.schema === "split-lane-recovery-experiment-spec-v1", "base recovery spec schema mismatch");
  requireCondition(spec.experimentId === RECOVERY_EXPERIMENT_ID, "base recovery spec is not the IMP-20 recovery identity");
  assertNotClosed(spec.experimentId);
  requireCondition(spec.imp13Dormant === true && spec.productionActivation === false && spec.separateAuthorizationRequired === true, "base recovery spec carries activation authority");
  requireCondition(spec.execution?.authMode === "chatgpt-subscription-codex-exec", "base recovery spec route is not ChatGPT subscription codex exec");
  requireCondition(spec.execution.boundedRetry.maxReplaysPerCall <= 1, "base recovery spec permits more than one replay");
  requireCondition(spec.bookSpecificExceptions.length === 0, "base recovery spec carries book-specific exceptions");
  requireCondition(hashCanonical(spec.requiredRoles) === hashCanonical(RECOVERY_REQUIRED_ROLES), "base recovery required-role set drift");
  requireCondition(hashCanonical(spec.contractSchemaIds) === hashCanonical(RECOVERY_CONTRACT_SCHEMA_IDS), "base recovery contract schemas drift");
}

function selectedRoleSelection(bundle: ForwardSealedQualificationBundleV1, role: ReviewLaneRole): RoleJudgeSelectionV1 {
  const selected = bundle.result.selected;
  const primaryProfileId = role === "reader"
    ? selected.readerPrimary
    : role === "source"
      ? selected.sourcePrimary
      : selected.quizSemanticAdjudicator;
  const backupProfileId = role === "reader"
    ? selected.readerAudit
    : role === "source"
      ? selected.sourceAdjudicator
      : null;
  return {
    schema: ROLE_JUDGE_SELECTION_SCHEMA,
    role,
    status: "SELECTED",
    primaryProfileId,
    backupProfileId,
    blockedReason: null,
    selectionRationale: [
      "IMP-22 frozen candidate order: first qualified profile is primary; qualification stops after the required backup/adjudicator",
      "selection frozen before any authoring candidate output",
    ],
  };
}

function buildFinalRecoverySpec(
  base: RecoveryExperimentSpecV1,
  bundle: ForwardSealedQualificationBundleV1,
  assignment: FixedRoleAssignmentV1,
  escalation: ForwardEscalationPolicyV1,
): RecoveryExperimentSpecV1 {
  const assignmentSha256 = hashCanonical(assignment);
  const binding = bundle.instrumentBinding;
  const manifest: SplitLaneInstrumentManifestV1 = {
    schema: SPLIT_LANE_INSTRUMENT_MANIFEST_SCHEMA,
    readerRubricVersion: binding.instrumentVersions.reader,
    sourceRubricVersion: binding.instrumentVersions.source,
    readerSchemaSha256: binding.schemaHashes.reader,
    sourceSchemaSha256: binding.schemaHashes.source,
    quizAdjudicationSchemaSha256: binding.schemaHashes.quiz,
    quizPhase2Version: binding.instrumentVersions.quiz,
    aggregationVersion: binding.instrumentVersions.aggregate,
    roleAssignmentPolicyVersion: FORWARD_ROLE_ASSIGNMENT_POLICY_VERSION,
    fixedRoleAssignmentSha256: assignmentSha256,
    executionProfileHash: binding.executionRoute.executionProfileHash,
    routePolicyVersion: binding.executionRoute.routePolicyVersion,
    thresholdsSha256: bundle.result.freeze.thresholdsSha256,
    readerCorpusSha256: bundle.result.freeze.corpusHashes.reader,
    sourceCorpusSha256: bundle.result.freeze.corpusHashes.source,
    quizCorpusSha256: bundle.result.freeze.corpusHashes.quiz,
  };
  return {
    ...clone(base),
    title: "§16 forward-only split-lane reviewer configuration — role qualified",
    instrumentManifest: manifest,
    roleThresholdsSha256: bundle.result.freeze.thresholdsSha256,
    roleAssignment: assignment,
    roleAssignmentPolicyVersion: FORWARD_ROLE_ASSIGNMENT_POLICY_VERSION,
    escalation: {
      sourceHighSeverityRequiresAdjudicator: escalation.sourceHighSeverityRequiresAdjudicator,
      quizAmbiguityRequiresAdjudicator: escalation.quizAmbiguityRequiresAdjudicator,
      readerEscalationAdvisoryOnly: escalation.readerEscalationAdvisoryOnly,
    },
    humanAdjudicationPause: { required: false, unadjudicatedDisputes: [] },
    imp13Dormant: true,
    productionActivation: false,
    separateAuthorizationRequired: true,
    bookSpecificExceptions: [],
  };
}

function verifyCurrentInstrument(
  qualification: ForwardSealedQualificationBundleV1,
  current: ForwardQualificationInstrumentBindingV1,
  expectedSha256: string,
): void {
  requireSha(expectedSha256, "current instrument binding seal");
  validateInstrumentBinding(current);
  requireCondition(hashCanonical(current) === expectedSha256, "current instrument binding hash drift");
  requireCondition(hashCanonical(current) === qualification.seal.instrumentBindingSha256, "current prompt/schema/profile/route binding is stale against qualification");
}

/**
 * Build the fixed role assignment, exact role/profile bindings, policy seals,
 * finalized IMP-20 recovery spec/seal, and conductor-ready review config.
 */
export function buildForwardRoleAssignmentFreeze(
  input: BuildForwardRoleAssignmentFreezeInputV1,
): ForwardRoleAssignmentFreezeV1 {
  assertSealedQualificationBundle(input.qualification);
  verifyCurrentInstrument(input.qualification, input.currentInstrumentBinding, input.currentInstrumentBindingSha256);
  requireSha(input.baseRecoverySpecSha256, "base recovery spec seal");
  requireCondition(hashCanonical(input.baseRecoverySpec) === input.baseRecoverySpecSha256, "base recovery spec hash drift");
  validateBaseRecoverySpec(input.baseRecoverySpec);
  requireCondition(input.baseRecoverySpec.execution.routePolicyVersion === input.qualification.instrumentBinding.executionRoute.routePolicyVersion, "base recovery route policy is stale against qualification");
  requireCondition(input.baseRecoverySpec.instrumentManifest.executionProfileHash === input.qualification.instrumentBinding.executionRoute.executionProfileHash, "base recovery execution profile is stale against qualification");
  requireCondition(input.readerBar === 80, "IMP-22 readerBar must remain exactly 80");
  requireCondition(nonEmpty(input.frozenAt), "role assignment frozenAt is missing");
  validateForwardReviewPolicies(input.policies);

  const roleAssignment = buildRoleAssignment(input.qualification);
  validateAssignmentAgainstBaseSpec(roleAssignment, input.baseRecoverySpec);
  assertForwardAssignmentIndependence(roleAssignment, input.policies.disagreement);
  const roleAssignmentSha256 = hashCanonical(roleAssignment);
  const binding = input.qualification.instrumentBinding;
  const roleProfileBindings: Record<ForwardRoleSlot, ForwardRoleProfileBindingV1> = {
    readerPrimary: roleBinding(input.qualification, "readerPrimary", "reader", roleAssignment.readerPrimary),
    readerAudit: roleBinding(input.qualification, "readerAudit", "reader", roleAssignment.readerBackup),
    sourcePrimary: roleBinding(input.qualification, "sourcePrimary", "source", roleAssignment.sourcePrimary),
    sourceAdjudicator: roleBinding(input.qualification, "sourceAdjudicator", "source", roleAssignment.sourceAdjudicator),
    quizSemanticAdjudicator: roleBinding(input.qualification, "quizSemanticAdjudicator", "quiz", roleAssignment.quizAdjudicator),
  };
  const roleProfileBindingsSha256 = hashCanonical(roleProfileBindings);
  const auditSubsetPolicy = clone(input.policies.auditSubset);
  const escalationPolicy = clone(input.policies.escalation);
  const disagreementPolicy = clone(input.policies.disagreement);
  const auditSubsetPolicySha256 = hashCanonical(auditSubsetPolicy);
  const escalationPolicySha256 = hashCanonical(escalationPolicy);
  const disagreementPolicySha256 = hashCanonical(disagreementPolicy);
  const panelPolicy = buildForwardPanelReviewPolicy({
    auditSubset: auditSubsetPolicy,
    escalation: escalationPolicy,
    disagreement: disagreementPolicy,
  });
  const panelPolicySha256 = hashCanonical(panelPolicy);

  const recoveryExperimentSpec = buildFinalRecoverySpec(input.baseRecoverySpec, input.qualification, roleAssignment, escalationPolicy);
  const recoveryExperimentSpecSha256 = recoverySpecSha256(recoveryExperimentSpec);
  const recoveryExperimentSeal = sealRecoveryExperiment(
    recoveryExperimentSpec,
    input.qualification.registry,
    recoveryExperimentSpec.requiredRoles,
    {
      assertNotClosed,
      assertRoleSetReady,
      selectRoleJudges: (_registry, role) => selectedRoleSelection(input.qualification, role),
    },
    input.frozenAt,
  );
  const recoveryExperimentSealSha256 = hashCanonical(recoveryExperimentSeal);
  requireCondition(recoveryExperimentSeal.specSha256 === recoveryExperimentSpecSha256, "recovery seal/spec hash mismatch");
  requireCondition(recoveryExperimentSeal.instrumentManifestSha256 === splitLaneInstrumentManifestSha256(recoveryExperimentSpec.instrumentManifest), "recovery seal/instrument hash mismatch");

  const reviewConfig: BoundForwardFrozenReviewConfigV1 = {
    schema: FORWARD_FROZEN_REVIEW_CONFIG_SCHEMA,
    roleAssignment,
    roleAssignmentSha256,
    instrumentManifest: recoveryExperimentSpec.instrumentManifest,
    instrumentManifestSha256: splitLaneInstrumentManifestSha256(recoveryExperimentSpec.instrumentManifest),
    readerBar: input.readerBar,
    qualificationBundleSha256: input.qualification.bundleSha256,
    instrumentBindingSha256: input.qualification.seal.instrumentBindingSha256,
    roleProfileBindingsSha256,
    auditSubsetPolicySha256,
    escalationPolicySha256,
    disagreementPolicySha256,
    panelPolicy,
    panelPolicySha256,
    recoveryExperimentSealSha256,
    promptSourceHashes: clone(binding.promptSourceHashes),
  };
  const reviewConfigSha256 = hashCanonical(reviewConfig);
  const productionInstrumentSealSha256 = buildForwardProductionInstrumentSeal().sealSha256;
  const draft = {
    schema: FORWARD_ROLE_ASSIGNMENT_FREEZE_SCHEMA,
    qualificationBundleSha256: input.qualification.bundleSha256,
    qualificationSealSha256: input.qualification.seal.sealSha256,
    instrumentBinding: clone(binding),
    instrumentBindingSha256: input.qualification.seal.instrumentBindingSha256,
    roleAssignment,
    roleAssignmentSha256,
    roleProfileBindings,
    roleProfileBindingsSha256,
    quizDeterministicCheckerSha256: hashCanonical(roleAssignment.quizChecker),
    auditSubsetPolicy,
    auditSubsetPolicySha256,
    escalationPolicy,
    escalationPolicySha256,
    disagreementPolicy,
    disagreementPolicySha256,
    panelPolicy,
    panelPolicySha256,
    recoveryExperimentSpec,
    recoveryExperimentSpecSha256,
    recoveryExperimentSeal,
    recoveryExperimentSealSha256,
    reviewConfig,
    reviewConfigSha256,
    productionInstrumentSealSha256,
    frozenAt: input.frozenAt,
  };
  const output: ForwardRoleAssignmentFreezeV1 = {
    ...draft,
    freezeSha256: hashCanonical(draft),
  };
  deepFreeze(output);
  assertForwardRoleAssignmentFreezeFresh(output, input.qualification, input.currentInstrumentBinding, input.currentInstrumentBindingSha256);
  return output;
}

/** Reverify every seal before handing `freeze.reviewConfig` to the conductor. */
export function assertForwardRoleAssignmentFreezeFresh(
  freeze: ForwardRoleAssignmentFreezeV1,
  qualification: ForwardSealedQualificationBundleV1,
  currentInstrumentBinding: ForwardQualificationInstrumentBindingV1,
  currentInstrumentBindingSha256: string,
): void {
  requireCondition(freeze?.schema === FORWARD_ROLE_ASSIGNMENT_FREEZE_SCHEMA, "forward role freeze schema mismatch");
  assertDeepFrozen(freeze, "forward role assignment freeze");
  assertSealedQualificationBundle(qualification);
  verifyCurrentInstrument(qualification, currentInstrumentBinding, currentInstrumentBindingSha256);
  requireCondition(freeze.qualificationBundleSha256 === qualification.bundleSha256, "forward role freeze is bound to another qualification bundle");
  requireCondition(freeze.qualificationSealSha256 === qualification.seal.sealSha256, "forward role freeze is bound to another qualification seal");
  requireCondition(freeze.instrumentBindingSha256 === hashCanonical(freeze.instrumentBinding), "forward role freeze instrument binding hash drift");
  requireCondition(hashCanonical(freeze.instrumentBinding) === hashCanonical(currentInstrumentBinding), "forward role freeze prompt/schema/profile/route drift");
  requireCondition(freeze.roleAssignmentSha256 === hashCanonical(freeze.roleAssignment), "forward role assignment hash drift");
  requireCondition(freeze.roleProfileBindingsSha256 === hashCanonical(freeze.roleProfileBindings), "forward role profile binding hash drift");
  requireCondition(freeze.quizDeterministicCheckerSha256 === hashCanonical(freeze.roleAssignment.quizChecker), "deterministic quiz checker hash drift");
  validateForwardReviewPolicies({
    auditSubset: freeze.auditSubsetPolicy,
    escalation: freeze.escalationPolicy,
    disagreement: freeze.disagreementPolicy,
  });
  assertForwardAssignmentIndependence(freeze.roleAssignment, freeze.disagreementPolicy);
  requireCondition(freeze.auditSubsetPolicySha256 === hashCanonical(freeze.auditSubsetPolicy), "audit-subset policy hash drift");
  requireCondition(freeze.escalationPolicySha256 === hashCanonical(freeze.escalationPolicy), "escalation policy hash drift");
  requireCondition(freeze.disagreementPolicySha256 === hashCanonical(freeze.disagreementPolicy), "disagreement policy hash drift");
  requireCondition(freeze.panelPolicySha256 === hashCanonical(freeze.panelPolicy), "panel policy hash drift");
  validateForwardPanelReviewPolicy(freeze.panelPolicy);
  requireCondition(hashCanonical(freeze.panelPolicy.auditSubset) === hashCanonical(freeze.auditSubsetPolicy), "panel/audit-subset policy mismatch");
  requireCondition(hashCanonical(freeze.panelPolicy.escalation) === hashCanonical(freeze.escalationPolicy), "panel/escalation policy mismatch");
  requireCondition(hashCanonical(freeze.panelPolicy.disagreement) === hashCanonical(freeze.disagreementPolicy), "panel/disagreement policy mismatch");
  requireCondition(freeze.panelPolicy.policySha256 === freeze.reviewConfig.panelPolicy.policySha256, "forward conductor config panel policy drift");
  requireCondition(freeze.recoveryExperimentSpecSha256 === recoverySpecSha256(freeze.recoveryExperimentSpec), "recovery experiment spec hash drift");
  requireCondition(freeze.recoveryExperimentSealSha256 === hashCanonical(freeze.recoveryExperimentSeal), "recovery experiment seal hash drift");
  requireCondition(freeze.recoveryExperimentSeal.specSha256 === freeze.recoveryExperimentSpecSha256, "recovery experiment seal is stale against spec");
  requireCondition(freeze.recoveryExperimentSeal.instrumentManifestSha256 === splitLaneInstrumentManifestSha256(freeze.recoveryExperimentSpec.instrumentManifest), "recovery experiment seal is stale against instrument manifest");
  requireCondition(freeze.recoveryExperimentSpec.instrumentManifest.fixedRoleAssignmentSha256 === freeze.roleAssignmentSha256, "recovery instrument is bound to another role assignment");
  requireCondition(freeze.reviewConfigSha256 === hashCanonical(freeze.reviewConfig), "forward conductor config hash drift");
  requireCondition(freeze.reviewConfig.readerBar === 80, "IMP-22 frozen readerBar must remain exactly 80");
  requireCondition(freeze.reviewConfig.roleAssignmentSha256 === freeze.roleAssignmentSha256, "forward conductor config role assignment drift");
  requireCondition(freeze.reviewConfig.instrumentManifestSha256 === freeze.recoveryExperimentSeal.instrumentManifestSha256, "forward conductor config instrument drift");
  requireCondition(freeze.reviewConfig.recoveryExperimentSealSha256 === freeze.recoveryExperimentSealSha256, "forward conductor config recovery seal drift");
  requireCondition(freeze.reviewConfig.instrumentBindingSha256 === freeze.instrumentBindingSha256, "forward conductor config exact binding drift");
  requireCondition(freeze.reviewConfig.panelPolicySha256 === freeze.panelPolicySha256, "forward conductor config panel-policy hash drift");
  requireCondition(freeze.productionInstrumentSealSha256 === buildForwardProductionInstrumentSeal().sealSha256,
    "forward role freeze production-instrument bytes drift");
  requireCondition(hashWithout(freeze as unknown as Record<string, unknown>, "freezeSha256") === freeze.freezeSha256, "forward role assignment freeze hash drift");
}
