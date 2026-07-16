/**
 * P6 stage-1 pilot binding: pure composition of the SOL pilot qualification
 * proof, fixed role assignment, and frozen review config from the RETAINED
 * pilot-role-readiness-v6 chain (owner-ratified plan v2, P5 -> P6).
 *
 * This module has no filesystem, process, model, network, or activation
 * capability. The campaign module loads retained artifacts and passes their
 * exact records here; every hash cross-reference is recomputed on each call so
 * the driver can re-assert the full chain immediately before every model call.
 *
 * Why this exists: the IMP-24 V3 qualification proof is hard-bound to
 * IMP24_ROLE_QUALIFICATION_EXECUTION_ID and requires that campaign's
 * role-assignment freeze, which was never minted (the campaign terminated
 * NOT_READY). The successor qualification evidence is the readiness-v6 chain
 * (terminalState PILOT_ROLE_SET_READY, pilot role freeze d54cc753...). This
 * module binds THAT chain without synthesizing any closed identity.
 */

import { hashCanonical } from "../contracts/contractUtil.js";
import type { EffortLevelV1 } from "../contracts/executionProfile.js";
import {
  FIXED_ROLE_ASSIGNMENT_SCHEMA,
  SPLIT_LANE_INSTRUMENT_MANIFEST_SCHEMA,
  type FixedRoleAssignmentV1,
  type RoleJudgeRefV1,
  type SplitLaneInstrumentManifestV1,
} from "../bakeoff/migration/reviewLaneTypes.js";
import { QUIZ_DETERMINISTIC_CHECKER_VERSION } from "../bakeoff/migration/reviewerRoleAssignment.js";
import {
  PILOT_ROLE_READINESS_V6_EXPERIMENT_ID,
  PILOT_ROLE_READINESS_V6_PLAN_SCHEMA,
  type PilotRoleReadinessPlanV1,
} from "../bakeoff/migration/pilotRoleReadinessInstrument.js";
import type {
  PilotRoleReadinessFreezeV1,
  PilotRoleReadinessRunnerResultV1,
} from "../bakeoff/migration/pilotRoleReadinessRunner.js";
import type { PilotRoleFreezeV1 } from "./forwardPilotRoleReadinessCampaign.js";
import {
  FORWARD_FROZEN_REVIEW_CONFIG_SCHEMA,
  type ForwardFrozenReviewConfigV1,
} from "./forwardChapterConductor.js";
import {
  FORWARD_PRODUCTION_REVIEW_INSTRUMENT_V2,
  FORWARD_PRODUCTION_REVIEW_PROTOCOL_V2,
} from "../review/forwardProductionReviewV2.js";
import { READER_DECISION_POLICY_V3 } from "../review/reviewProtocolV2.js";
import {
  buildForwardPanelReviewPolicy,
  validateForwardPanelReviewPolicy,
  validateForwardReviewPolicies,
  type ForwardPanelReviewPolicyV1,
} from "./forwardReviewPolicy.js";
import { buildFixedForwardRoleFreezePolicies } from "./forwardLiveArtifactMaterializer.js";
import {
  PILOT_ENVELOPE_EXPERIMENT_ID,
  type ForwardPilotManifestV1,
  type FrozenForwardValidationManifestV1,
} from "./forwardValidationCampaign.js";

export const SOL_PILOT_STAGE1_PROOF_SCHEMA = "sol-pilot-stage1-qualification-proof-v2" as const;
export const SOL_PILOT_STAGE1_SNAPSHOT_SCHEMA = "sol-pilot-stage1-instrument-snapshot-v1" as const;
export const SOL_PILOT_STAGE1_PLAN_SCHEMA = "sol-pilot-stage1-plan-v1" as const;
export const SOL_PILOT_STAGE1_STAGE_POLICY_ID = "sol-pilot-stage1-first-two-v1" as const;
export const SOL_PILOT_ROLE_ASSIGNMENT_POLICY_VERSION =
  "sol-pilot-readiness-fixed-role-assignment-v1" as const;

const SHA256 = /^[a-f0-9]{64}$/;

/** Certification fields that legitimately change when NON-instrument pipeline
 * source changes (the production seal inventories ALL pipeline src, so any
 * additive campaign module re-mints it). Every other certification field must
 * be byte-equal between the qualification-era snapshot and the current
 * re-minted certification, or the readiness qualification is stale. */
const CERTIFICATION_SEAL_DEPENDENT_FIELDS = new Set([
  "certificationSha256",
  "productionInstrumentSealSha256",
]);

export type SolPilotReviewRole = "reader" | "source" | "quiz";

/** Structural record types for the retained imp24f certification/seal JSON.
 * These are compared record-to-record; unknown extra keys fail closed via the
 * key-set equality check in `assertSolPilotInstrumentContinuity`. */
export type SolPilotCertificationRecordV1 = {
  schema: string;
  certificationSha256: string;
  thresholdsSha256: string;
  corpusBundleSha256: string;
  productionInstrumentSealSha256: string;
  productionQualificationParitySha256: string;
  [key: string]: unknown;
};

export type SolPilotProductionSealRecordV1 = {
  schema: string;
  sealSha256: string;
  [key: string]: unknown;
};

/** Create-once snapshot of the exact instrument records the readiness-v6
 * qualification was executed against. Minted BEFORE any P6 re-mint (the plan's
 * raw byte hashes prove provenance); after re-mint these bytes exist nowhere
 * else on disk. */
export type SolPilotInstrumentSnapshotV1 = {
  schema: typeof SOL_PILOT_STAGE1_SNAPSHOT_SCHEMA;
  experimentId: typeof PILOT_ENVELOPE_EXPERIMENT_ID;
  qualificationExperimentId: typeof PILOT_ROLE_READINESS_V6_EXPERIMENT_ID;
  certificationRecord: SolPilotCertificationRecordV1;
  certificationRawSha256: string;
  sealRecord: SolPilotProductionSealRecordV1;
  sealRawSha256: string;
  schemaHashes: Record<SolPilotReviewRole, string>;
  promptSourceHashes: Record<SolPilotReviewRole, string>;
  snapshotSha256: string;
};

/** Everything the campaign loads from retained state plus the CURRENT
 * (possibly re-minted) instrument identity, recomputed fresh per assertion. */
export type SolPilotReadinessChainV1 = {
  readinessResult: PilotRoleReadinessRunnerResultV1;
  readinessFreeze: PilotRoleReadinessFreezeV1;
  roleFreeze: PilotRoleFreezeV1;
  plan: PilotRoleReadinessPlanV1;
  planBytesSha256: string;
  callLedgerSha256: string;
  callLedgerBytesSha256: string;
  instrumentSnapshot: SolPilotInstrumentSnapshotV1;
  currentCertificationRecord: SolPilotCertificationRecordV1;
  currentCertificationRawSha256: string;
  currentSealRecord: SolPilotProductionSealRecordV1;
  currentSealRawSha256: string;
  currentSchemaHashes: Record<SolPilotReviewRole, string>;
  currentPromptSourceHashes: Record<SolPilotReviewRole, string>;
};

export type SolPilotStage1QualificationProofV2 = {
  schema: typeof SOL_PILOT_STAGE1_PROOF_SCHEMA;
  qualificationExperimentId: typeof PILOT_ROLE_READINESS_V6_EXPERIMENT_ID;
  roleSetReady: true;
  readinessResultSha256: string;
  readinessFreezeSha256: string;
  pilotRoleFreezeSha256: string;
  qualificationPlanSha256: string;
  qualificationPlanBytesSha256: string;
  callLedgerSha256: string;
  callLedgerBytesSha256: string;
  qualificationCandidateSealRawSha256: string;
  qualificationCandidateCertificationRawSha256: string;
  instrumentSnapshotSha256: string;
  currentCertificationSha256: string;
  currentCertificationRawSha256: string;
  currentProductionInstrumentSealSha256: string;
  currentProductionInstrumentSealRawSha256: string;
  schemaHashesSha256: string;
  promptSourceHashesSha256: string;
  productionThresholdsSha256: string;
  roleAssignmentSha256: string;
  readerDecisionPolicy: typeof READER_DECISION_POLICY_V3;
  reviewProtocolVersion: typeof FORWARD_PRODUCTION_REVIEW_PROTOCOL_V2;
  modelCalls: 0;
  apiCalls: 0;
  proofSha256: string;
};

/** Frozen review config the conductor consumes (structurally a
 * ForwardFrozenReviewConfigV1) with the readiness qualification chain bound
 * explicitly. First ACTIVE use of reader-decision-policy-v3. */
export type SolPilotBoundReviewConfigV1 = ForwardFrozenReviewConfigV1 & {
  reviewProtocolVersion: typeof FORWARD_PRODUCTION_REVIEW_PROTOCOL_V2;
  readerDecisionPolicy: typeof READER_DECISION_POLICY_V3;
  panelPolicy: ForwardPanelReviewPolicyV1;
  panelPolicySha256: string;
  qualificationExperimentId: typeof PILOT_ROLE_READINESS_V6_EXPERIMENT_ID;
  qualificationResultSha256: string;
  qualificationFreezeSha256: string;
  pilotRoleFreezeSha256: string;
  qualificationPlanSha256: string;
  qualificationCandidateSealRawSha256: string;
  qualificationCandidateCertificationRawSha256: string;
  instrumentSnapshotSha256: string;
  currentCertificationSha256: string;
  currentProductionInstrumentSealSha256: string;
  executionProfileHash: string;
  routePolicyVersion: string;
};

export class ForwardSolPilotStage1BindingError extends Error {
  readonly classification = "policy_preflight_failure" as const;

  constructor(message: string) {
    super(message);
    this.name = "ForwardSolPilotStage1BindingError";
  }
}

function requireCondition(condition: unknown, message: string): asserts condition {
  if (!condition) throw new ForwardSolPilotStage1BindingError(message);
}

function requireSha(value: unknown, label: string): asserts value is string {
  requireCondition(typeof value === "string" && SHA256.test(value), `${label} must be a lowercase sha256`);
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

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function roleHashMap(value: Record<SolPilotReviewRole, string>, label: string): Record<SolPilotReviewRole, string> {
  for (const role of ["reader", "source", "quiz"] as const) requireSha(value?.[role], `${label}.${role}`);
  return { reader: value.reader, source: value.source, quiz: value.quiz };
}

/** Compose the create-once instrument snapshot. The caller (mint verb) reads
 * the CURRENT imp24f files; this refuses to mint unless their raw byte hashes
 * still equal the frozen readiness-plan bindings — i.e. minting is only
 * possible BEFORE any instrument re-mint, closing the provenance gap. */
export function composeSolPilotInstrumentSnapshot(args: {
  plan: PilotRoleReadinessPlanV1;
  certificationRecord: SolPilotCertificationRecordV1;
  certificationRawSha256: string;
  sealRecord: SolPilotProductionSealRecordV1;
  sealRawSha256: string;
  schemaHashes: Record<SolPilotReviewRole, string>;
  promptSourceHashes: Record<SolPilotReviewRole, string>;
}): Readonly<SolPilotInstrumentSnapshotV1> {
  // The plan record type declares the base readiness schema/id; the v6
  // identity was minted through the aliased-import chain, so compare the
  // exact v6 runtime literals.
  requireCondition((args.plan?.schema as string) === PILOT_ROLE_READINESS_V6_PLAN_SCHEMA
    && (args.plan.experimentId as string) === PILOT_ROLE_READINESS_V6_EXPERIMENT_ID,
  "instrument snapshot requires the frozen readiness-v6 plan");
  const { planSha256, ...planCore } = args.plan;
  requireCondition(planSha256 === hashCanonical(planCore), "readiness plan self hash drift");
  requireSha(args.certificationRawSha256, "certificationRawSha256");
  requireSha(args.sealRawSha256, "sealRawSha256");
  requireCondition(args.certificationRawSha256 === args.plan.bindings.candidateCertificationRawSha256,
    "certification bytes no longer match the readiness plan binding; the snapshot window has closed");
  requireCondition(args.sealRawSha256 === args.plan.bindings.candidateSealRawSha256,
    "production seal bytes no longer match the readiness plan binding; the snapshot window has closed");
  requireCondition(args.certificationRecord?.schema === "imp24-instrument-certification-binding-v1",
    "snapshot certification record has the wrong schema");
  requireCondition(args.sealRecord?.schema === "forward-production-instrument-seal-v1",
    "snapshot production seal record has the wrong schema");
  requireCondition(args.certificationRecord.productionInstrumentSealSha256 === args.sealRecord.sealSha256,
    "snapshot certification is not bound to the snapshot production seal");
  const core: Omit<SolPilotInstrumentSnapshotV1, "snapshotSha256"> = {
    schema: SOL_PILOT_STAGE1_SNAPSHOT_SCHEMA,
    experimentId: PILOT_ENVELOPE_EXPERIMENT_ID,
    qualificationExperimentId: PILOT_ROLE_READINESS_V6_EXPERIMENT_ID,
    certificationRecord: clone(args.certificationRecord),
    certificationRawSha256: args.certificationRawSha256,
    sealRecord: clone(args.sealRecord),
    sealRawSha256: args.sealRawSha256,
    schemaHashes: roleHashMap(args.schemaHashes, "schemaHashes"),
    promptSourceHashes: roleHashMap(args.promptSourceHashes, "promptSourceHashes"),
  };
  return deepFreeze({ ...core, snapshotSha256: hashCanonical(core) });
}

export function validateSolPilotInstrumentSnapshot(
  snapshot: SolPilotInstrumentSnapshotV1,
  plan: PilotRoleReadinessPlanV1,
): void {
  requireCondition(snapshot?.schema === SOL_PILOT_STAGE1_SNAPSHOT_SCHEMA
    && snapshot.experimentId === PILOT_ENVELOPE_EXPERIMENT_ID
    && snapshot.qualificationExperimentId === PILOT_ROLE_READINESS_V6_EXPERIMENT_ID,
  "instrument snapshot identity drift");
  const { snapshotSha256, ...core } = snapshot;
  requireCondition(snapshotSha256 === hashCanonical(core), "instrument snapshot self hash drift");
  requireCondition(snapshot.certificationRawSha256 === plan.bindings.candidateCertificationRawSha256
    && snapshot.sealRawSha256 === plan.bindings.candidateSealRawSha256,
  "instrument snapshot is not the certification/seal the readiness plan qualified against");
  requireCondition(snapshot.certificationRecord.productionInstrumentSealSha256 === snapshot.sealRecord.sealSha256,
    "instrument snapshot certification/seal cross-binding drift");
}

/** Fail-closed instrument continuity: the roles were qualified under the
 * snapshot instruments; the campaign runs under the CURRENT instruments. They
 * must be semantically identical. Only the two fields that transitively hash
 * ALL pipeline src (and therefore change when any non-instrument module is
 * added) may differ; every other certification field, and the exact per-role
 * reviewer schema/prompt byte hashes, must be equal. */
export function assertSolPilotInstrumentContinuity(chain: SolPilotReadinessChainV1): void {
  const retained = chain.instrumentSnapshot.certificationRecord;
  const current = chain.currentCertificationRecord;
  const retainedKeys = Object.keys(retained).sort();
  const currentKeys = Object.keys(current).sort();
  requireCondition(hashCanonical(retainedKeys) === hashCanonical(currentKeys),
    `certification field inventory drifted between qualification and campaign: [${retainedKeys.join(",")}] vs [${currentKeys.join(",")}]`);
  for (const key of retainedKeys) {
    if (CERTIFICATION_SEAL_DEPENDENT_FIELDS.has(key)) continue;
    requireCondition(hashCanonical(retained[key] ?? null) === hashCanonical(current[key] ?? null),
      `certification component drifted since role qualification: ${key}`);
  }
  requireCondition(current.productionInstrumentSealSha256 === chain.currentSealRecord.sealSha256,
    "current certification is not bound to the current production seal");
  const { certificationSha256: currentCertSha, ...currentCertCore } = current;
  requireCondition(currentCertSha === hashCanonical(currentCertCore), "current certification self hash drift");
  const { certificationSha256: retainedCertSha, ...retainedCertCore } = retained;
  requireCondition(retainedCertSha === hashCanonical(retainedCertCore), "snapshot certification self hash drift");
  // Reviewer-facing instrument files must be byte-identical to what the
  // readiness freeze recorded at qualification time.
  requireCondition(hashCanonical(roleHashMap(chain.currentSchemaHashes, "currentSchemaHashes"))
      === chain.readinessFreeze.schemaHashesSha256,
    "current reviewer output schemas differ from the qualification-era schema hashes");
  requireCondition(hashCanonical(roleHashMap(chain.currentPromptSourceHashes, "currentPromptSourceHashes"))
      === chain.readinessFreeze.promptSourceHashesSha256,
    "current reviewer prompt sources differ from the qualification-era prompt hashes");
  requireCondition(hashCanonical(chain.instrumentSnapshot.schemaHashes)
      === chain.readinessFreeze.schemaHashesSha256
    && hashCanonical(chain.instrumentSnapshot.promptSourceHashes)
      === chain.readinessFreeze.promptSourceHashesSha256,
  "instrument snapshot per-role hashes are not the qualification-era hashes");
}

function selectedJudge(
  result: PilotRoleReadinessRunnerResultV1,
  role: SolPilotReviewRole,
  profileId: string | null,
  slot: string,
): RoleJudgeRefV1 {
  requireCondition(typeof profileId === "string" && profileId.length > 0, `readiness result has no selected ${slot}`);
  requireCondition(result.qualifiers[role]?.includes(profileId),
    `${slot}: ${profileId} is not a recorded ${role} qualifier`);
  const record = result.profileRoleResults.find((item) =>
    item.role === role && item.profile.profileId === profileId && item.status === "READY");
  requireCondition(record !== undefined, `${slot}: ${profileId} has no READY ${role} qualification record`);
  const judge = record!.profile;
  requireCondition(typeof judge.model === "string" && judge.model.length > 0
    && typeof judge.effort === "string" && judge.profileId === `${judge.model}@${judge.effort}`,
  `${slot}: qualified profile identity is not canonical (<model>@<effort>)`);
  const efforts: readonly EffortLevelV1[] = ["minimal", "low", "medium", "high", "xhigh"];
  requireCondition((efforts as readonly string[]).includes(judge.effort),
    `${slot}: qualified profile effort is not a known effort level: ${judge.effort}`);
  return { profileId: judge.profileId, model: judge.model, effort: judge.effort as EffortLevelV1 };
}

/** Build the conductor-facing fixed role assignment from the readiness result.
 * Slot mapping is fixed: the conductor's readerBackup slot serves the frozen
 * readerAudit role; quizAdjudicator serves quizSemanticAdjudicator. */
export function buildSolPilotFixedRoleAssignment(
  result: PilotRoleReadinessRunnerResultV1,
  roleFreeze: PilotRoleFreezeV1,
): Readonly<FixedRoleAssignmentV1> {
  requireCondition(result.terminalState === "PILOT_ROLE_SET_READY", "readiness result is not PILOT_ROLE_SET_READY");
  for (const [slot, frozenProfileId] of Object.entries({
    readerPrimary: roleFreeze.roles.readerPrimary,
    readerAudit: roleFreeze.roles.readerAudit,
    sourcePrimary: roleFreeze.roles.sourcePrimary,
    sourceAdjudicator: roleFreeze.roles.sourceAdjudicator,
    quizSemanticAdjudicator: roleFreeze.roles.quizSemanticAdjudicator,
  })) {
    requireCondition(result.selected[slot as keyof typeof result.selected] === frozenProfileId,
      `pilot role freeze and readiness result disagree on ${slot}`);
  }
  requireCondition(roleFreeze.roles.quizChecker.deterministic === true
    && roleFreeze.roles.quizChecker.checkerVersion === QUIZ_DETERMINISTIC_CHECKER_VERSION,
  "pilot role freeze quiz checker is not the deterministic answer-tell checker");
  const assignment: FixedRoleAssignmentV1 = {
    schema: FIXED_ROLE_ASSIGNMENT_SCHEMA,
    readerPrimary: selectedJudge(result, "reader", result.selected.readerPrimary, "readerPrimary"),
    readerBackup: selectedJudge(result, "reader", result.selected.readerAudit, "readerAudit"),
    sourcePrimary: selectedJudge(result, "source", result.selected.sourcePrimary, "sourcePrimary"),
    sourceAdjudicator: selectedJudge(result, "source", result.selected.sourceAdjudicator, "sourceAdjudicator"),
    quizChecker: { deterministic: true, checkerVersion: QUIZ_DETERMINISTIC_CHECKER_VERSION },
    quizAdjudicator: selectedJudge(result, "quiz", result.selected.quizSemanticAdjudicator, "quizSemanticAdjudicator"),
  };
  requireCondition(assignment.readerPrimary.profileId !== assignment.readerBackup.profileId,
    "reader primary and audit must be different exact profiles");
  requireCondition(assignment.sourcePrimary.profileId !== assignment.sourceAdjudicator.profileId,
    "source primary and adjudicator must be different exact profiles");
  return deepFreeze(assignment);
}

function assertChainInternallyBound(chain: SolPilotReadinessChainV1): void {
  const result = chain.readinessResult;
  requireCondition(result?.schema === "pilot-role-readiness-runner-result-v1"
    && result.experimentId === PILOT_ROLE_READINESS_V6_EXPERIMENT_ID
    && result.terminalState === "PILOT_ROLE_SET_READY"
    && result.blockedReason === null,
  "retained readiness result is not the READY v6 terminal record");
  requireCondition(hashCanonical(result.freeze) === hashCanonical(chain.readinessFreeze),
    "retained readiness freeze differs from the freeze embedded in the result");
  const freeze = chain.readinessFreeze;
  requireCondition(freeze.experimentId === PILOT_ROLE_READINESS_V6_EXPERIMENT_ID, "readiness freeze identity drift");
  const { freezeSha256, ...freezeCore } = freeze;
  requireCondition(freezeSha256 === hashCanonical(freezeCore), "readiness freeze self hash drift");
  const plan = chain.plan;
  const { planSha256, ...planCore } = plan;
  requireCondition((plan.schema as string) === PILOT_ROLE_READINESS_V6_PLAN_SCHEMA
    && (plan.experimentId as string) === PILOT_ROLE_READINESS_V6_EXPERIMENT_ID
    && planSha256 === hashCanonical(planCore),
  "readiness plan identity/self hash drift");
  requireCondition(freeze.planSha256 === plan.planSha256 && freeze.planBytesSha256 === chain.planBytesSha256,
    "readiness freeze is not bound to the exact retained plan");
  requireCondition(freeze.certificationRawBytesSha256 === plan.bindings.candidateCertificationRawSha256
    && freeze.productionInstrumentSealRawBytesSha256 === plan.bindings.candidateSealRawSha256,
  "readiness freeze and plan disagree on the qualified instrument bytes");
  requireCondition(plan.bindings.readerDecisionPolicy === READER_DECISION_POLICY_V3,
    "readiness plan does not bind reader-decision-policy-v3");
  const roleFreeze = chain.roleFreeze;
  requireCondition(roleFreeze?.schema === "pilot-role-freeze-v1"
    && roleFreeze.experimentId === PILOT_ROLE_READINESS_V6_EXPERIMENT_ID,
  "pilot role freeze identity drift");
  const { freezeSha256: roleFreezeSha, ...roleFreezeCore } = roleFreeze;
  requireCondition(roleFreezeSha === hashCanonical(roleFreezeCore), "pilot role freeze self hash drift");
  requireCondition(roleFreeze.bindings.planSha256 === plan.planSha256
    && roleFreeze.bindings.planBytesSha256 === chain.planBytesSha256
    && roleFreeze.bindings.freezeSha256 === freeze.freezeSha256
    && roleFreeze.bindings.resultSha256 === hashCanonical(result)
    && roleFreeze.bindings.candidateSealRawSha256 === plan.bindings.candidateSealRawSha256
    && roleFreeze.bindings.candidateCertificationRawSha256 === plan.bindings.candidateCertificationRawSha256
    && roleFreeze.bindings.callLedgerSha256 === chain.callLedgerSha256
    && roleFreeze.bindings.callLedgerBytesSha256 === chain.callLedgerBytesSha256
    && roleFreeze.bindings.readerDecisionPolicy === READER_DECISION_POLICY_V3,
  "pilot role freeze bindings do not rebuild from the retained chain");
  validateSolPilotInstrumentSnapshot(chain.instrumentSnapshot, plan);
  requireCondition(hashCanonical(chain.instrumentSnapshot.certificationRecord) === freeze.certificationSha256,
    "instrument snapshot certification is not the certification the readiness freeze qualified against");
  requireCondition(hashCanonical(chain.instrumentSnapshot.sealRecord) === freeze.productionInstrumentSealSha256,
    "instrument snapshot seal is not the seal the readiness freeze qualified against");
  requireSha(chain.currentCertificationRawSha256, "currentCertificationRawSha256");
  requireSha(chain.currentSealRawSha256, "currentSealRawSha256");
  assertSolPilotInstrumentContinuity(chain);
}

/** Recompose the stage-1 qualification proof from the exact retained chain.
 * Safe to invoke immediately before every model call. */
export function composeSolPilotStage1QualificationProof(args: {
  chain: SolPilotReadinessChainV1;
  roleAssignment: FixedRoleAssignmentV1;
}): Readonly<SolPilotStage1QualificationProofV2> {
  assertChainInternallyBound(args.chain);
  const rebuilt = buildSolPilotFixedRoleAssignment(args.chain.readinessResult, args.chain.roleFreeze);
  requireCondition(hashCanonical(rebuilt) === hashCanonical(args.roleAssignment),
    "bound role assignment does not rebuild from the retained readiness chain");
  const chain = args.chain;
  const core: Omit<SolPilotStage1QualificationProofV2, "proofSha256"> = {
    schema: SOL_PILOT_STAGE1_PROOF_SCHEMA,
    qualificationExperimentId: PILOT_ROLE_READINESS_V6_EXPERIMENT_ID,
    roleSetReady: true,
    readinessResultSha256: hashCanonical(chain.readinessResult),
    readinessFreezeSha256: chain.readinessFreeze.freezeSha256,
    pilotRoleFreezeSha256: chain.roleFreeze.freezeSha256,
    qualificationPlanSha256: chain.plan.planSha256,
    qualificationPlanBytesSha256: chain.planBytesSha256,
    callLedgerSha256: chain.callLedgerSha256,
    callLedgerBytesSha256: chain.callLedgerBytesSha256,
    qualificationCandidateSealRawSha256: chain.plan.bindings.candidateSealRawSha256,
    qualificationCandidateCertificationRawSha256: chain.plan.bindings.candidateCertificationRawSha256,
    instrumentSnapshotSha256: chain.instrumentSnapshot.snapshotSha256,
    currentCertificationSha256: chain.currentCertificationRecord.certificationSha256,
    currentCertificationRawSha256: chain.currentCertificationRawSha256,
    currentProductionInstrumentSealSha256: chain.currentSealRecord.sealSha256,
    currentProductionInstrumentSealRawSha256: chain.currentSealRawSha256,
    schemaHashesSha256: hashCanonical(roleHashMap(chain.currentSchemaHashes, "currentSchemaHashes")),
    promptSourceHashesSha256: hashCanonical(roleHashMap(chain.currentPromptSourceHashes, "currentPromptSourceHashes")),
    productionThresholdsSha256: chain.currentCertificationRecord.thresholdsSha256,
    roleAssignmentSha256: hashCanonical(args.roleAssignment),
    readerDecisionPolicy: READER_DECISION_POLICY_V3,
    reviewProtocolVersion: FORWARD_PRODUCTION_REVIEW_PROTOCOL_V2,
    modelCalls: 0,
    apiCalls: 0,
  };
  return deepFreeze({ ...core, proofSha256: hashCanonical(core) });
}

export function assertSolPilotStage1QualificationProofFresh(args: {
  proof: SolPilotStage1QualificationProofV2;
  chain: SolPilotReadinessChainV1;
  roleAssignment: FixedRoleAssignmentV1;
}): void {
  requireCondition(args.proof?.schema === SOL_PILOT_STAGE1_PROOF_SCHEMA
    && args.proof.qualificationExperimentId === PILOT_ROLE_READINESS_V6_EXPERIMENT_ID,
  "retained stage-1 qualification proof has the wrong schema/identity");
  const { proofSha256, ...core } = args.proof;
  requireCondition(proofSha256 === hashCanonical(core), "stage-1 qualification proof self hash drift");
  const expected = composeSolPilotStage1QualificationProof({
    chain: args.chain,
    roleAssignment: args.roleAssignment,
  });
  requireCondition(hashCanonical(args.proof) === hashCanonical(expected),
    "stage-1 qualification proof differs from the exact retained readiness chain");
}

/** Compose the frozen conductor review config for the pilot. readerBar 80 and
 * the V2 evidence-envelope protocol are the owner-ratified production values;
 * reader-decision-policy-v3 goes ACTIVE here for the first time. */
export function composeSolPilotBoundReviewConfig(args: {
  chain: SolPilotReadinessChainV1;
  roleAssignment: FixedRoleAssignmentV1;
  executionProfileHash: string;
  routePolicyVersion: string;
}): Readonly<{ config: SolPilotBoundReviewConfigV1; configSha256: string }> {
  assertChainInternallyBound(args.chain);
  requireCondition(typeof args.executionProfileHash === "string" && args.executionProfileHash.length > 0,
    "review config requires the live execution profile hash");
  requireCondition(args.routePolicyVersion === args.chain.roleFreeze.bindings.routePolicyVersion,
    "route policy version differs from the pilot role freeze binding");
  const roleAssignmentSha256 = hashCanonical(args.roleAssignment);
  const policies = buildFixedForwardRoleFreezePolicies();
  validateForwardReviewPolicies(policies);
  const panelPolicy = buildForwardPanelReviewPolicy(policies);
  validateForwardPanelReviewPolicy(panelPolicy);
  // The three corpus fields record which frozen corpus qualified the judges.
  // Readiness-v6 qualifies all three roles against ONE corpus by design.
  const instrumentManifest: SplitLaneInstrumentManifestV1 = {
    schema: SPLIT_LANE_INSTRUMENT_MANIFEST_SCHEMA,
    readerRubricVersion: FORWARD_PRODUCTION_REVIEW_INSTRUMENT_V2,
    sourceRubricVersion: FORWARD_PRODUCTION_REVIEW_INSTRUMENT_V2,
    readerSchemaSha256: args.chain.currentSchemaHashes.reader,
    sourceSchemaSha256: args.chain.currentSchemaHashes.source,
    quizAdjudicationSchemaSha256: args.chain.currentSchemaHashes.quiz,
    quizPhase2Version: FORWARD_PRODUCTION_REVIEW_INSTRUMENT_V2,
    aggregationVersion: "aggregated-chapter-review-v1",
    roleAssignmentPolicyVersion: SOL_PILOT_ROLE_ASSIGNMENT_POLICY_VERSION,
    fixedRoleAssignmentSha256: roleAssignmentSha256,
    executionProfileHash: args.executionProfileHash,
    routePolicyVersion: args.routePolicyVersion,
    thresholdsSha256: args.chain.currentCertificationRecord.thresholdsSha256,
    readerCorpusSha256: args.chain.plan.corpusSha256,
    sourceCorpusSha256: args.chain.plan.corpusSha256,
    quizCorpusSha256: args.chain.plan.corpusSha256,
  };
  const config: SolPilotBoundReviewConfigV1 = {
    schema: FORWARD_FROZEN_REVIEW_CONFIG_SCHEMA,
    roleAssignment: clone(args.roleAssignment),
    roleAssignmentSha256,
    instrumentManifest,
    instrumentManifestSha256: hashCanonical(instrumentManifest),
    readerBar: 80,
    reviewProtocolVersion: FORWARD_PRODUCTION_REVIEW_PROTOCOL_V2,
    readerDecisionPolicy: READER_DECISION_POLICY_V3,
    panelPolicy,
    panelPolicySha256: hashCanonical(panelPolicy),
    qualificationExperimentId: PILOT_ROLE_READINESS_V6_EXPERIMENT_ID,
    qualificationResultSha256: hashCanonical(args.chain.readinessResult),
    qualificationFreezeSha256: args.chain.readinessFreeze.freezeSha256,
    pilotRoleFreezeSha256: args.chain.roleFreeze.freezeSha256,
    qualificationPlanSha256: args.chain.plan.planSha256,
    qualificationCandidateSealRawSha256: args.chain.plan.bindings.candidateSealRawSha256,
    qualificationCandidateCertificationRawSha256: args.chain.plan.bindings.candidateCertificationRawSha256,
    instrumentSnapshotSha256: args.chain.instrumentSnapshot.snapshotSha256,
    currentCertificationSha256: args.chain.currentCertificationRecord.certificationSha256,
    currentProductionInstrumentSealSha256: args.chain.currentSealRecord.sealSha256,
    executionProfileHash: args.executionProfileHash,
    routePolicyVersion: args.routePolicyVersion,
  };
  return deepFreeze({ config, configSha256: hashCanonical(config) });
}

/** Stage-1 scope: the FIRST TWO targets of the frozen eight-coordinate pilot
 * manifest, in frozen manifest order (stratum-major, so one chapter from each
 * pilot book). The full manifest identity is untouched; stage 2 resumes the
 * remaining six on the same manifest. */
export function buildSolPilotStage1Scope(
  manifest: FrozenForwardValidationManifestV1<ForwardPilotManifestV1>,
): Readonly<{ policyId: typeof SOL_PILOT_STAGE1_STAGE_POLICY_ID; executeChapterKeys: string[] }> {
  requireCondition(manifest.manifest.experimentId === PILOT_ENVELOPE_EXPERIMENT_ID
    && manifest.manifest.kind === "pilot"
    && manifest.manifest.targets.length === 8,
  "stage-1 scope requires the frozen eight-coordinate envelope pilot manifest");
  requireCondition(hashCanonical(manifest.manifest) === manifest.manifestSha256, "stage-1 scope: manifest hash drift");
  const keys = manifest.manifest.targets.slice(0, 2).map((target) =>
    `${target.bookId}/ch${String(target.chapterNumber).padStart(2, "0")}`);
  const books = new Set(manifest.manifest.targets.slice(0, 2).map((target) => target.bookId));
  requireCondition(books.size === 2, "stage-1 scope must cover one chapter from each pilot book");
  return deepFreeze({ policyId: SOL_PILOT_STAGE1_STAGE_POLICY_ID, executeChapterKeys: keys });
}
