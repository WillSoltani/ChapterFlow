/**
 * IMP-24 post-qualification role freeze.
 *
 * This is a new evidence identity. It never adapts, attests, or reopens either
 * retained V1/V2 qualification. The only accepted input is a role-ready V3
 * envelope result bound to the model-free certificate and live route proof.
 */

import { validateJudgeCapabilityQualification } from "../contracts/judgeCapabilityQualification.js";
import { hashCanonical } from "../contracts/contractUtil.js";
import {
  FIXED_ROLE_ASSIGNMENT_SCHEMA,
  SPLIT_LANE_INSTRUMENT_MANIFEST_SCHEMA,
  type FixedRoleAssignmentV1,
  type RoleJudgeRefV1,
  type SplitLaneInstrumentManifestV1,
} from "../bakeoff/migration/reviewLaneTypes.js";
import {
  IMP24_CORPUS_EXPECTED_COUNTS,
  IMP24_ROLE_QUALIFICATION_ID,
  type Imp24CorpusBundle,
  type Imp24ReviewRole,
} from "../bakeoff/migration/imp24Corpus.js";
import {
  IMP24_FROZEN_ROLE_THRESHOLDS,
  IMP24_INSTRUMENT_CERTIFICATION_BINDING_SCHEMA,
  IMP24_ROLE_QUALIFICATION_FREEZE_SCHEMA,
  IMP24_ROLE_QUALIFICATION_RUNNER_SCHEMA,
  instrumentCertificationBindingSha256,
  type InstrumentCertificationBindingV3,
  type ProfileRoleResultV3,
  type RoleQualificationRunnerResultV3,
} from "../bakeoff/migration/roleQualificationRunnerV3.js";
import { QUIZ_DETERMINISTIC_CHECKER_VERSION } from "../bakeoff/migration/reviewerRoleAssignment.js";
import {
  FORWARD_FROZEN_REVIEW_CONFIG_SCHEMA,
  type ForwardFrozenReviewConfigV1,
} from "./forwardChapterConductor.js";
import {
  buildForwardPanelReviewPolicy,
  validateForwardPanelReviewPolicy,
  validateForwardReviewPolicies,
  type ForwardAuditSubsetPolicyV1,
  type ForwardDisagreementPolicyV1,
  type ForwardEscalationPolicyV1,
  type ForwardPanelReviewPolicyV1,
  type ForwardRoleFreezePoliciesV1,
} from "./forwardReviewPolicy.js";
import { buildFixedForwardRoleFreezePolicies } from "./forwardLiveArtifactMaterializer.js";
import {
  validateForwardProductionInstrumentSeal,
  type ForwardProductionInstrumentSealV1,
} from "./forwardProductionInstrumentSeal.js";
import {
  FORWARD_PRODUCTION_REVIEW_INSTRUMENT_V2,
  FORWARD_PRODUCTION_REVIEW_PROTOCOL_V2,
} from "../review/forwardProductionReviewV2.js";

export const FORWARD_ROLE_ASSIGNMENT_FREEZE_V3_SCHEMA = "imp24-forward-role-assignment-freeze-v3" as const;
export const FORWARD_ROLE_PROFILE_BINDING_V3_SCHEMA = "imp24-forward-role-profile-binding-v3" as const;
export const FORWARD_ROLE_ASSIGNMENT_POLICY_V3 = "imp24-forward-fixed-role-assignment-v3" as const;

const SHA256 = /^[a-f0-9]{64}$/;

export type ForwardRoleSlotV3 =
  | "readerPrimary"
  | "readerAudit"
  | "sourcePrimary"
  | "sourceAdjudicator"
  | "quizSemanticAdjudicator";

export type ForwardV3RouteBinding = {
  executionRoute: "codex_exec_chatgpt_subscription";
  authMode: "chatgpt";
  apiKeyPresent: false;
  apiFallbackAllowed: false;
  directHttpOrSdkAllowed: false;
  executionProfileHash: string;
  routePolicyVersion: string;
};

export type ForwardRoleProfileBindingV3 = {
  schema: typeof FORWARD_ROLE_PROFILE_BINDING_V3_SCHEMA;
  slot: ForwardRoleSlotV3;
  lane: Imp24ReviewRole;
  judge: RoleJudgeRefV1;
  qualificationResultSha256: string;
  profileRoleResultSha256: string;
  canaryAttemptsSha256: string;
  holdoutAttemptsSha256: string;
  promptSourceSha256: string;
  schemaSha256: string;
  envelopeCompilerSha256: string;
  envelopeContractSha256: string;
  modelOutputContractsSha256: string;
  productionQualificationParitySha256: string;
  corpusBundleSha256: string;
  thresholdsSha256: string;
  executionProfileHash: string;
  routePolicyVersion: string;
  productionInstrumentSealSha256: string;
};

/** Structurally consumable by the existing conductor, with V3 freshness bound
 * explicitly instead of through the closed IMP-22 qualification bundle. */
export type BoundForwardFrozenReviewConfigV3 = ForwardFrozenReviewConfigV1 & {
  reviewProtocolVersion: typeof FORWARD_PRODUCTION_REVIEW_PROTOCOL_V2;
  qualificationExperimentId: typeof IMP24_ROLE_QUALIFICATION_ID;
  qualificationResultSha256: string;
  qualificationFreezeSha256: string;
  instrumentCertificationSha256: string;
  corpusBundleSha256: string;
  roleProfileBindingsSha256: string;
  auditSubsetPolicySha256: string;
  escalationPolicySha256: string;
  disagreementPolicySha256: string;
  panelPolicy: ForwardPanelReviewPolicyV1;
  panelPolicySha256: string;
  promptSourceHashes: Record<Imp24ReviewRole, string>;
  schemaHashes: Record<Imp24ReviewRole, string>;
  executionProfileHash: string;
  routePolicyVersion: string;
  productionInstrumentSealSha256: string;
  productionQualificationParitySha256: string;
};

export type ForwardRoleAssignmentFreezeV3 = {
  schema: typeof FORWARD_ROLE_ASSIGNMENT_FREEZE_V3_SCHEMA;
  experimentId: typeof IMP24_ROLE_QUALIFICATION_ID;
  qualificationResultSha256: string;
  qualificationFreezeSha256: string;
  instrumentCertification: InstrumentCertificationBindingV3;
  instrumentCertificationSha256: string;
  corpusBundleSha256: string;
  schemaHashes: Record<Imp24ReviewRole, string>;
  schemaHashesSha256: string;
  promptSourceHashes: Record<Imp24ReviewRole, string>;
  promptSourceHashesSha256: string;
  routeBinding: ForwardV3RouteBinding;
  routeBindingSha256: string;
  roleAssignment: FixedRoleAssignmentV1;
  roleAssignmentSha256: string;
  roleProfileBindings: Record<ForwardRoleSlotV3, ForwardRoleProfileBindingV3>;
  roleProfileBindingsSha256: string;
  auditSubsetPolicy: ForwardAuditSubsetPolicyV1;
  auditSubsetPolicySha256: string;
  escalationPolicy: ForwardEscalationPolicyV1;
  escalationPolicySha256: string;
  disagreementPolicy: ForwardDisagreementPolicyV1;
  disagreementPolicySha256: string;
  panelPolicy: ForwardPanelReviewPolicyV1;
  panelPolicySha256: string;
  reviewConfig: BoundForwardFrozenReviewConfigV3;
  reviewConfigSha256: string;
  productionInstrumentSealSha256: string;
  productionQualificationParitySha256: string;
  frozenAt: string;
  freezeSha256: string;
};

export type BuildForwardRoleAssignmentFreezeV3Input = {
  result: RoleQualificationRunnerResultV3;
  certification: InstrumentCertificationBindingV3;
  corpusBundle: Imp24CorpusBundle;
  schemaHashes: Record<Imp24ReviewRole, string>;
  promptSourceHashes: Record<Imp24ReviewRole, string>;
  routeBinding: ForwardV3RouteBinding;
  productionInstrumentSeal: ForwardProductionInstrumentSealV1;
  repositoryRoot?: string;
  policies?: ForwardRoleFreezePoliciesV1;
};

export class ForwardRoleAssignmentFreezeV3Error extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ForwardRoleAssignmentFreezeV3Error";
  }
}

function requireCondition(condition: unknown, message: string): asserts condition {
  if (!condition) throw new ForwardRoleAssignmentFreezeV3Error(message);
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

function withoutSelfHash(value: ForwardRoleAssignmentFreezeV3): Omit<ForwardRoleAssignmentFreezeV3, "freezeSha256"> {
  const { freezeSha256: _freezeSha256, ...draft } = value;
  return draft;
}

function selectedJudge(result: RoleQualificationRunnerResultV3, profileId: string, lane: Imp24ReviewRole): RoleJudgeRefV1 {
  const record = result.registry.profiles.find((candidate) => candidate.profileId === profileId);
  requireCondition(record !== undefined, `${lane} selected profile ${profileId} is absent from the V3 registry`);
  const errors = validateJudgeCapabilityQualification(record);
  requireCondition(errors.length === 0, `${lane} selected profile ${profileId} has an invalid registry record: ${errors.join("; ")}`);
  const field = lane === "reader" ? "readerExperience" : lane === "source" ? "sourceIntegrity" : "quizIntegrity";
  requireCondition(record[field] === "QUALIFIED", `${lane} selected profile ${profileId} is not QUALIFIED for that role`);
  return { profileId: record.profileId, model: record.model, effort: record.effort };
}

function selectedProfileRoleResult(
  result: RoleQualificationRunnerResultV3,
  profileId: string,
  lane: Imp24ReviewRole,
): ProfileRoleResultV3 {
  const selected = result.profileRoleResults.find((entry) => entry.role === lane && entry.profile.profileId === profileId);
  requireCondition(selected?.status === "QUALIFIED" && selected.canaryProtocolPassed === true && selected.holdoutStarted === true,
    `${lane} selected profile ${profileId} lacks a complete QUALIFIED V3 result`);
  return selected;
}

function assertSelectedScheduleCoverage(
  result: RoleQualificationRunnerResultV3,
  profileId: string,
  lane: Imp24ReviewRole,
): void {
  const roleResult = selectedProfileRoleResult(result, profileId, lane);
  const expected = result.schedule.filter((entry) => entry.role === lane
    && entry.candidateOrdinal === roleResult.candidateOrdinal
    && entry.profileId === profileId);
  const expectedCanaries = expected.filter((entry) => entry.partition === "canary");
  const expectedHoldout = expected.filter((entry) => entry.partition === "holdout");
  requireCondition(expectedCanaries.length === IMP24_CORPUS_EXPECTED_COUNTS[lane].canary
    && expectedHoldout.length === IMP24_CORPUS_EXPECTED_COUNTS[lane].holdout,
  `${lane} selected profile ${profileId} does not bind the exact frozen canary/holdout schedule`);
  const expectedIds = new Set(expected.map((entry) => entry.scheduleId));
  const attempts = result.attempts.filter((attempt) => attempt.request.role === lane
    && attempt.request.profileId === profileId);
  requireCondition(attempts.length === roleResult.attempts,
    `${lane} selected profile ${profileId} attempt accounting drift`);
  requireCondition(attempts.every((attempt) => expectedIds.has(attempt.request.scheduleId)),
    `${lane} selected profile ${profileId} has an attempt outside its frozen schedule`);
  for (const entry of expected) {
    const retained = attempts
      .filter((attempt) => attempt.request.scheduleId === entry.scheduleId)
      .sort((left, right) => left.request.attemptNumber - right.request.attemptNumber);
    requireCondition(retained.length >= 1 && retained.length <= 2,
      `${entry.scheduleId} must retain exactly one base attempt and at most one infrastructure replay`);
    requireCondition(retained[0].request.attemptNumber === 1 && retained[0].request.replayOfAttemptId === null,
      `${entry.scheduleId} is missing its base attempt`);
    if (retained.length === 2) {
      requireCondition(retained[0].replayEligible === true
        && retained[1].request.attemptNumber === 2
        && retained[1].request.replayOfAttemptId === retained[0].request.attemptId,
      `${entry.scheduleId} replay is not the single authorized infrastructure replay`);
    }
    const terminal = retained[retained.length - 1];
    requireCondition(terminal.receipt?.status === "completed" && terminal.evaluation !== null,
      `${entry.scheduleId} selected qualification case has no completed retained judgment`);
  }
}

function resultAttemptHash(
  result: RoleQualificationRunnerResultV3,
  profileId: string,
  lane: Imp24ReviewRole,
  partition: "canary" | "holdout",
): string {
  assertSelectedScheduleCoverage(result, profileId, lane);
  const attempts = result.attempts.filter((attempt) => attempt.request.profileId === profileId
    && attempt.request.role === lane && attempt.request.partition === partition);
  requireCondition(attempts.length > 0, `${lane} selected profile ${profileId} has no retained ${partition} attempts`);
  return hashCanonical(attempts);
}

function roleProfileBinding(args: {
  input: BuildForwardRoleAssignmentFreezeV3Input;
  qualificationResultSha256: string;
  slot: ForwardRoleSlotV3;
  lane: Imp24ReviewRole;
  profileId: string;
}): ForwardRoleProfileBindingV3 {
  const roleResult = selectedProfileRoleResult(args.input.result, args.profileId, args.lane);
  return {
    schema: FORWARD_ROLE_PROFILE_BINDING_V3_SCHEMA,
    slot: args.slot,
    lane: args.lane,
    judge: selectedJudge(args.input.result, args.profileId, args.lane),
    qualificationResultSha256: args.qualificationResultSha256,
    profileRoleResultSha256: hashCanonical(roleResult),
    canaryAttemptsSha256: resultAttemptHash(args.input.result, args.profileId, args.lane, "canary"),
    holdoutAttemptsSha256: resultAttemptHash(args.input.result, args.profileId, args.lane, "holdout"),
    promptSourceSha256: args.input.promptSourceHashes[args.lane],
    schemaSha256: args.input.schemaHashes[args.lane],
    envelopeCompilerSha256: args.input.certification.envelopeCompilerSha256,
    envelopeContractSha256: args.input.certification.envelopeContractSha256,
    modelOutputContractsSha256: args.input.certification.modelOutputContractsSha256,
    productionQualificationParitySha256: args.input.certification.productionQualificationParitySha256,
    corpusBundleSha256: args.input.certification.corpusBundleSha256,
    thresholdsSha256: args.input.certification.thresholdsSha256,
    executionProfileHash: args.input.routeBinding.executionProfileHash,
    routePolicyVersion: args.input.routeBinding.routePolicyVersion,
    productionInstrumentSealSha256: args.input.certification.productionInstrumentSealSha256,
  };
}

function assertInput(input: BuildForwardRoleAssignmentFreezeV3Input): void {
  requireCondition(input.result.schema === IMP24_ROLE_QUALIFICATION_RUNNER_SCHEMA
    && input.result.experimentId === IMP24_ROLE_QUALIFICATION_ID
    && input.result.freeze.schema === IMP24_ROLE_QUALIFICATION_FREEZE_SCHEMA,
  "role freeze requires the V3 envelope qualification identity");
  requireCondition(input.result.roleSetReady === true && input.result.roleSetBlockedReason === null,
    `V3 role set is not ready: ${input.result.roleSetBlockedReason ?? "unknown"}`);
  const { freezeSha256, ...qualificationFreezeCore } = input.result.freeze;
  requireCondition(hashCanonical(qualificationFreezeCore) === freezeSha256,
    "V3 qualification freeze self hash drift");
  requireCondition(input.result.schedule.length === input.result.freeze.baseMaximumCalls
    && input.result.freeze.baseMaximumCalls === 464
    && input.result.freeze.hardMaximumCalls === 928
    && hashCanonical(input.result.schedule) === input.result.freeze.scheduleSha256,
  "V3 qualification result does not retain the exact frozen 464/928 schedule");
  requireCondition(input.certification.schema === IMP24_INSTRUMENT_CERTIFICATION_BINDING_SCHEMA
    && input.certification.status === "CERTIFIED_MODEL_FREE"
    && input.certification.experimentId === IMP24_ROLE_QUALIFICATION_ID,
  "role freeze requires the exact model-free V3 instrument certificate");
  const { certificationSha256, ...certificationCore } = input.certification;
  requireCondition(instrumentCertificationBindingSha256(certificationCore) === certificationSha256,
    "instrument certification self hash drift");
  requireCondition(input.result.freeze.certificationSha256 === certificationSha256,
    "qualification result is bound to another instrument certificate");
  requireCondition(input.result.freeze.productionQualificationParitySha256
      === input.certification.productionQualificationParitySha256,
    "qualification result is bound to another production/qualification parity identity");
  requireCondition(input.corpusBundle.experimentId === IMP24_ROLE_QUALIFICATION_ID
    && input.corpusBundle.substantiveBundleSha256 === input.certification.corpusBundleSha256
    && input.result.freeze.corpusBundleSha256 === input.certification.corpusBundleSha256
    && hashCanonical(input.corpusBundle) === input.result.freeze.corpusSnapshotSha256,
  "V3 corpus bundle differs from qualification/certification");
  requireCondition(hashCanonical(input.certification) === input.result.freeze.certificationSnapshotSha256,
    "V3 certification snapshot differs from the qualification freeze");
  requireCondition(hashCanonical(input.productionInstrumentSeal) === input.result.freeze.productionInstrumentSealSnapshotSha256,
    "V3 production-seal snapshot differs from the qualification freeze");
  requireCondition(hashCanonical(input.schemaHashes) === input.result.freeze.schemaHashesSha256,
    "role freeze schema hashes differ from the V3 qualification freeze");
  requireCondition(hashCanonical(input.promptSourceHashes) === input.result.freeze.promptSourceHashesSha256,
    "role freeze prompt hashes differ from the V3 qualification freeze");
  requireCondition(input.result.freeze.thresholdsSha256 === input.certification.thresholdsSha256
    && hashCanonical(IMP24_FROZEN_ROLE_THRESHOLDS) === input.certification.thresholdsSha256,
  "role freeze thresholds differ from the certified frozen V3 thresholds");
  for (const [label, value] of Object.entries({ ...input.schemaHashes, ...input.promptSourceHashes })) requireSha(value, label);
  requireCondition(input.routeBinding.executionRoute === "codex_exec_chatgpt_subscription"
    && input.routeBinding.authMode === "chatgpt"
    && input.routeBinding.apiKeyPresent === false
    && input.routeBinding.apiFallbackAllowed === false
    && input.routeBinding.directHttpOrSdkAllowed === false,
  "role freeze route is not the no-API ChatGPT-authenticated codex exec route");
  requireSha(input.routeBinding.executionProfileHash, "execution profile hash");
  requireCondition(typeof input.routeBinding.routePolicyVersion === "string" && input.routeBinding.routePolicyVersion.length > 0,
    "route policy version is missing");
  const seal = validateForwardProductionInstrumentSeal(input.productionInstrumentSeal, {
    ...(input.repositoryRoot ? { repositoryRoot: input.repositoryRoot } : {}),
  });
  requireCondition(seal.sealSha256 === input.certification.productionInstrumentSealSha256
    && seal.sealSha256 === input.result.freeze.productionInstrumentSealSha256,
  "production instrument seal differs from certification/qualification");
}

function composeForwardRoleAssignmentFreezeV3(
  input: BuildForwardRoleAssignmentFreezeV3Input,
): Readonly<ForwardRoleAssignmentFreezeV3> {
  assertInput(input);
  const selected = input.result.selected;
  for (const [slot, profileId] of Object.entries(selected)) {
    requireCondition(typeof profileId === "string" && profileId.length > 0, `V3 selected role ${slot} is missing`);
  }
  requireCondition(selected.readerPrimary !== selected.readerAudit,
    "reader primary and audit must be different exact profiles");
  requireCondition(selected.sourcePrimary !== selected.sourceAdjudicator,
    "source primary and adjudicator must be different exact profiles");
  const roleAssignment: FixedRoleAssignmentV1 = {
    schema: FIXED_ROLE_ASSIGNMENT_SCHEMA,
    readerPrimary: selectedJudge(input.result, selected.readerPrimary!, "reader"),
    readerBackup: selectedJudge(input.result, selected.readerAudit!, "reader"),
    sourcePrimary: selectedJudge(input.result, selected.sourcePrimary!, "source"),
    sourceAdjudicator: selectedJudge(input.result, selected.sourceAdjudicator!, "source"),
    quizChecker: { deterministic: true, checkerVersion: QUIZ_DETERMINISTIC_CHECKER_VERSION },
    quizAdjudicator: selectedJudge(input.result, selected.quizSemanticAdjudicator!, "quiz"),
  };
  const roleAssignmentSha256 = hashCanonical(roleAssignment);
  const qualificationResultSha256 = hashCanonical(input.result);
  const roleProfileBindings: Record<ForwardRoleSlotV3, ForwardRoleProfileBindingV3> = {
    readerPrimary: roleProfileBinding({ input, qualificationResultSha256, slot: "readerPrimary", lane: "reader", profileId: selected.readerPrimary! }),
    readerAudit: roleProfileBinding({ input, qualificationResultSha256, slot: "readerAudit", lane: "reader", profileId: selected.readerAudit! }),
    sourcePrimary: roleProfileBinding({ input, qualificationResultSha256, slot: "sourcePrimary", lane: "source", profileId: selected.sourcePrimary! }),
    sourceAdjudicator: roleProfileBinding({ input, qualificationResultSha256, slot: "sourceAdjudicator", lane: "source", profileId: selected.sourceAdjudicator! }),
    quizSemanticAdjudicator: roleProfileBinding({ input, qualificationResultSha256, slot: "quizSemanticAdjudicator", lane: "quiz", profileId: selected.quizSemanticAdjudicator! }),
  };
  const roleProfileBindingsSha256 = hashCanonical(roleProfileBindings);
  const policies = clone(input.policies ?? buildFixedForwardRoleFreezePolicies());
  validateForwardReviewPolicies(policies);
  const panelPolicy = buildForwardPanelReviewPolicy(policies);
  validateForwardPanelReviewPolicy(panelPolicy);
  const auditSubsetPolicySha256 = hashCanonical(policies.auditSubset);
  const escalationPolicySha256 = hashCanonical(policies.escalation);
  const disagreementPolicySha256 = hashCanonical(policies.disagreement);
  const panelPolicySha256 = hashCanonical(panelPolicy);
  const instrumentManifest: SplitLaneInstrumentManifestV1 = {
    schema: SPLIT_LANE_INSTRUMENT_MANIFEST_SCHEMA,
    readerRubricVersion: FORWARD_PRODUCTION_REVIEW_INSTRUMENT_V2,
    sourceRubricVersion: FORWARD_PRODUCTION_REVIEW_INSTRUMENT_V2,
    readerSchemaSha256: input.schemaHashes.reader,
    sourceSchemaSha256: input.schemaHashes.source,
    quizAdjudicationSchemaSha256: input.schemaHashes.quiz,
    quizPhase2Version: FORWARD_PRODUCTION_REVIEW_INSTRUMENT_V2,
    aggregationVersion: "aggregated-chapter-review-v1",
    roleAssignmentPolicyVersion: FORWARD_ROLE_ASSIGNMENT_POLICY_V3,
    fixedRoleAssignmentSha256: roleAssignmentSha256,
    executionProfileHash: input.routeBinding.executionProfileHash,
    routePolicyVersion: input.routeBinding.routePolicyVersion,
    thresholdsSha256: input.certification.thresholdsSha256,
    readerCorpusSha256: input.corpusBundle.reader.substantiveCorpusSha256,
    sourceCorpusSha256: input.corpusBundle.source.substantiveCorpusSha256,
    quizCorpusSha256: input.corpusBundle.quiz.substantiveCorpusSha256,
  };
  const instrumentManifestSha256 = hashCanonical(instrumentManifest);
  const selectedQualifiedAt = new Set(roleAssignmentToRefs(roleAssignment).map((judge) => {
    const record = input.result.registry.profiles.find((candidate) => candidate.profileId === judge.profileId)!;
    requireCondition(Number.isFinite(Date.parse(record.qualifiedAt)), `${judge.profileId} has an invalid qualifiedAt`);
    return new Date(record.qualifiedAt).toISOString();
  }));
  requireCondition(selectedQualifiedAt.size === 1, "selected V3 roles do not share one frozen qualification timestamp");
  const frozenAt = [...selectedQualifiedAt][0];
  const reviewConfig: BoundForwardFrozenReviewConfigV3 = {
    schema: FORWARD_FROZEN_REVIEW_CONFIG_SCHEMA,
    roleAssignment,
    roleAssignmentSha256,
    instrumentManifest,
    instrumentManifestSha256,
    readerBar: 80,
    reviewProtocolVersion: FORWARD_PRODUCTION_REVIEW_PROTOCOL_V2,
    qualificationExperimentId: IMP24_ROLE_QUALIFICATION_ID,
    qualificationResultSha256,
    qualificationFreezeSha256: input.result.freeze.freezeSha256,
    instrumentCertificationSha256: input.certification.certificationSha256,
    corpusBundleSha256: input.certification.corpusBundleSha256,
    roleProfileBindingsSha256,
    auditSubsetPolicySha256,
    escalationPolicySha256,
    disagreementPolicySha256,
    panelPolicy,
    panelPolicySha256,
    promptSourceHashes: clone(input.promptSourceHashes),
    schemaHashes: clone(input.schemaHashes),
    executionProfileHash: input.routeBinding.executionProfileHash,
    routePolicyVersion: input.routeBinding.routePolicyVersion,
    productionInstrumentSealSha256: input.certification.productionInstrumentSealSha256,
    productionQualificationParitySha256: input.certification.productionQualificationParitySha256,
  };
  const draft: Omit<ForwardRoleAssignmentFreezeV3, "freezeSha256"> = {
    schema: FORWARD_ROLE_ASSIGNMENT_FREEZE_V3_SCHEMA,
    experimentId: IMP24_ROLE_QUALIFICATION_ID,
    qualificationResultSha256,
    qualificationFreezeSha256: input.result.freeze.freezeSha256,
    instrumentCertification: clone(input.certification),
    instrumentCertificationSha256: input.certification.certificationSha256,
    corpusBundleSha256: input.certification.corpusBundleSha256,
    schemaHashes: clone(input.schemaHashes),
    schemaHashesSha256: hashCanonical(input.schemaHashes),
    promptSourceHashes: clone(input.promptSourceHashes),
    promptSourceHashesSha256: hashCanonical(input.promptSourceHashes),
    routeBinding: clone(input.routeBinding),
    routeBindingSha256: hashCanonical(input.routeBinding),
    roleAssignment,
    roleAssignmentSha256,
    roleProfileBindings,
    roleProfileBindingsSha256,
    auditSubsetPolicy: policies.auditSubset,
    auditSubsetPolicySha256,
    escalationPolicy: policies.escalation,
    escalationPolicySha256,
    disagreementPolicy: policies.disagreement,
    disagreementPolicySha256,
    panelPolicy,
    panelPolicySha256,
    reviewConfig,
    reviewConfigSha256: hashCanonical(reviewConfig),
    productionInstrumentSealSha256: input.certification.productionInstrumentSealSha256,
    productionQualificationParitySha256: input.certification.productionQualificationParitySha256,
    frozenAt,
  };
  const output: ForwardRoleAssignmentFreezeV3 = { ...draft, freezeSha256: hashCanonical(draft) };
  return deepFreeze(output);
}

export function buildForwardRoleAssignmentFreezeV3(
  input: BuildForwardRoleAssignmentFreezeV3Input,
): Readonly<ForwardRoleAssignmentFreezeV3> {
  const output = composeForwardRoleAssignmentFreezeV3(input);
  validateForwardRoleAssignmentFreezeV3(output, input);
  return output;
}

function roleAssignmentToRefs(roleAssignment: FixedRoleAssignmentV1): RoleJudgeRefV1[] {
  return [
    roleAssignment.readerPrimary,
    roleAssignment.readerBackup,
    roleAssignment.sourcePrimary,
    roleAssignment.sourceAdjudicator,
    roleAssignment.quizAdjudicator,
  ];
}

/** Revalidate retained V3 evidence and every behavior-affecting binding before
 * a pilot/gold reviewer call or activation read-back. */
export function validateForwardRoleAssignmentFreezeV3(
  freeze: ForwardRoleAssignmentFreezeV3,
  current: BuildForwardRoleAssignmentFreezeV3Input,
): void {
  assertInput(current);
  requireCondition(freeze.schema === FORWARD_ROLE_ASSIGNMENT_FREEZE_V3_SCHEMA
    && freeze.experimentId === IMP24_ROLE_QUALIFICATION_ID,
  "forward V3 role freeze has the wrong schema/identity");
  requireCondition(freeze.freezeSha256 === hashCanonical(withoutSelfHash(freeze)), "forward V3 role freeze self hash drift");
  const expected = composeForwardRoleAssignmentFreezeV3(current);
  requireCondition(hashCanonical(freeze) === hashCanonical(expected),
    "forward V3 role freeze differs from the deterministic projection of current qualification evidence");
  requireCondition(freeze.qualificationResultSha256 === hashCanonical(current.result)
    && freeze.qualificationFreezeSha256 === current.result.freeze.freezeSha256,
  "forward V3 role freeze qualification evidence drift");
  requireCondition(freeze.instrumentCertificationSha256 === current.certification.certificationSha256
    && hashCanonical(freeze.instrumentCertification) === hashCanonical(current.certification),
  "forward V3 role freeze instrument certification drift");
  requireCondition(freeze.corpusBundleSha256 === current.corpusBundle.substantiveBundleSha256,
    "forward V3 role freeze corpus drift");
  requireCondition(freeze.schemaHashesSha256 === hashCanonical(freeze.schemaHashes)
    && hashCanonical(freeze.schemaHashes) === hashCanonical(current.schemaHashes),
  "forward V3 role freeze schema drift");
  requireCondition(freeze.promptSourceHashesSha256 === hashCanonical(freeze.promptSourceHashes)
    && hashCanonical(freeze.promptSourceHashes) === hashCanonical(current.promptSourceHashes),
  "forward V3 role freeze prompt drift");
  requireCondition(freeze.routeBindingSha256 === hashCanonical(freeze.routeBinding)
    && hashCanonical(freeze.routeBinding) === hashCanonical(current.routeBinding),
  "forward V3 role freeze route drift");
  requireCondition(freeze.productionInstrumentSealSha256 === current.productionInstrumentSeal.sealSha256,
    "forward V3 role freeze production seal drift");
  requireCondition(freeze.productionQualificationParitySha256
      === current.certification.productionQualificationParitySha256
      && freeze.reviewConfig.productionQualificationParitySha256
        === freeze.productionQualificationParitySha256,
    "forward V3 role freeze production/qualification parity drift");
  requireCondition(freeze.roleAssignmentSha256 === hashCanonical(freeze.roleAssignment)
    && freeze.reviewConfig.roleAssignmentSha256 === freeze.roleAssignmentSha256,
  "forward V3 fixed role assignment drift");
  requireCondition(freeze.roleAssignment.readerPrimary.profileId !== freeze.roleAssignment.readerBackup.profileId
    && freeze.roleAssignment.sourcePrimary.profileId !== freeze.roleAssignment.sourceAdjudicator.profileId,
  "forward V3 independent reviewer assignments collapsed to one exact profile");
  requireCondition(freeze.roleProfileBindingsSha256 === hashCanonical(freeze.roleProfileBindings),
    "forward V3 role profile binding drift");
  requireCondition(freeze.auditSubsetPolicySha256 === hashCanonical(freeze.auditSubsetPolicy)
    && freeze.escalationPolicySha256 === hashCanonical(freeze.escalationPolicy)
    && freeze.disagreementPolicySha256 === hashCanonical(freeze.disagreementPolicy),
  "forward V3 review policy drift");
  validateForwardReviewPolicies({
    auditSubset: freeze.auditSubsetPolicy,
    escalation: freeze.escalationPolicy,
    disagreement: freeze.disagreementPolicy,
  });
  requireCondition(freeze.panelPolicySha256 === hashCanonical(freeze.panelPolicy), "forward V3 panel policy drift");
  validateForwardPanelReviewPolicy(freeze.panelPolicy);
  requireCondition(freeze.reviewConfigSha256 === hashCanonical(freeze.reviewConfig)
    && freeze.reviewConfig.reviewProtocolVersion === FORWARD_PRODUCTION_REVIEW_PROTOCOL_V2
    && freeze.reviewConfig.readerBar === 80,
  "forward V3 conductor review config drift");
}
