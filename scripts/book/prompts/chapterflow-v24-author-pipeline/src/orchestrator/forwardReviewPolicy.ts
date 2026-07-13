/** Shared, model-free IMP-22 panel policy used by the freeze builder and conductor. */

import { hashCanonical, sha256Hex } from "../contracts/contractUtil.js";
import type {
  FixedRoleAssignmentV1,
  RecoveryEscalationPolicyV1,
  RoleJudgeRefV1,
} from "../bakeoff/migration/reviewLaneTypes.js";

export const FORWARD_AUDIT_SUBSET_POLICY_SCHEMA = "imp22-forward-audit-subset-policy-v1" as const;
export const FORWARD_ESCALATION_POLICY_SCHEMA = "imp22-forward-escalation-policy-v1" as const;
export const FORWARD_DISAGREEMENT_POLICY_SCHEMA = "imp22-forward-disagreement-policy-v1" as const;
export const FORWARD_PANEL_REVIEW_POLICY_SCHEMA = "imp22-forward-panel-review-policy-v1" as const;

export type ForwardAuditSubsetPolicyV1 = {
  schema: typeof FORWARD_AUDIT_SUBSET_POLICY_SCHEMA;
  policyVersion: string;
  strategy: "sha256-chapter-coordinate-bucket-v1";
  salt: string;
  modulus: number;
  includedBuckets: number[];
  coordinateFields: readonly ["bookId", "chapterNumber"];
  frozenBeforeCandidateOutput: true;
  outputIndependent: true;
};

export type ForwardIndependenceLimitationV1 = {
  allowSameExactProfile: boolean;
  reason: string | null;
  mitigation: string | null;
};

export type ForwardEscalationPolicyV1 = RecoveryEscalationPolicyV1 & {
  schema: typeof FORWARD_ESCALATION_POLICY_SCHEMA;
  adjudicatorOperationalFailure: "INCONCLUSIVE";
  outputInformedJudgeRotationAllowed: false;
};

export type ForwardDisagreementPolicyV1 = {
  schema: typeof FORWARD_DISAGREEMENT_POLICY_SCHEMA;
  policyVersion: string;
  readerPrimaryAuditDisagreement: "REVISE";
  sourceHighSeverityUnresolvedDisagreement: "INCONCLUSIVE";
  quizDeterministicBlockerPrevails: true;
  quizUnresolvedSemanticDisagreement: "INCONCLUSIVE";
  outputInformedResamplingAllowed: false;
  independenceLimitations: {
    readerAudit: ForwardIndependenceLimitationV1;
    sourceAdjudicator: ForwardIndependenceLimitationV1;
  };
};

export type ForwardRoleFreezePoliciesV1 = {
  auditSubset: ForwardAuditSubsetPolicyV1;
  escalation: ForwardEscalationPolicyV1;
  disagreement: ForwardDisagreementPolicyV1;
};

/** The exact policy object embedded in a conductor-ready config. */
export type ForwardPanelReviewPolicyV1 = ForwardRoleFreezePoliciesV1 & {
  schema: typeof FORWARD_PANEL_REVIEW_POLICY_SCHEMA;
  auditSubsetPolicySha256: string;
  escalationPolicySha256: string;
  disagreementPolicySha256: string;
  policySha256: string;
};

export class ForwardReviewPolicyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ForwardReviewPolicyError";
  }
}

function requireCondition(condition: unknown, message: string): asserts condition {
  if (!condition) throw new ForwardReviewPolicyError(message);
}

function nonEmpty(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function validateAuditPolicy(policy: ForwardAuditSubsetPolicyV1): void {
  requireCondition(policy?.schema === FORWARD_AUDIT_SUBSET_POLICY_SCHEMA, "audit-subset policy schema mismatch");
  requireCondition(nonEmpty(policy.policyVersion) && nonEmpty(policy.salt), "audit-subset policy version/salt is missing");
  requireCondition(policy.strategy === "sha256-chapter-coordinate-bucket-v1", "unsupported audit-subset strategy");
  requireCondition(Number.isSafeInteger(policy.modulus) && policy.modulus > 0 && policy.modulus <= 10_000, "audit-subset modulus is invalid");
  requireCondition(Array.isArray(policy.includedBuckets) && policy.includedBuckets.length > 0, "audit-subset has no included bucket");
  requireCondition(new Set(policy.includedBuckets).size === policy.includedBuckets.length, "audit-subset buckets contain duplicates");
  requireCondition(policy.includedBuckets.every((bucket) => Number.isSafeInteger(bucket) && bucket >= 0 && bucket < policy.modulus), "audit-subset bucket is out of range");
  requireCondition(policy.coordinateFields?.[0] === "bookId" && policy.coordinateFields?.[1] === "chapterNumber", "audit-subset coordinates are mutable/unsupported");
  requireCondition(policy.frozenBeforeCandidateOutput === true && policy.outputIndependent === true, "audit-subset policy is output-informed");
}

function validateLimitation(limitation: ForwardIndependenceLimitationV1, label: string): void {
  requireCondition(typeof limitation?.allowSameExactProfile === "boolean", `${label}: missing allowSameExactProfile`);
  if (limitation.allowSameExactProfile) {
    requireCondition(nonEmpty(limitation.reason) && nonEmpty(limitation.mitigation), `${label}: an allowed independence limitation requires reason and mitigation`);
  } else {
    requireCondition(limitation.reason === null && limitation.mitigation === null, `${label}: inactive limitation must record null reason/mitigation`);
  }
}

export function validateForwardReviewPolicies(policies: ForwardRoleFreezePoliciesV1): void {
  validateAuditPolicy(policies.auditSubset);
  const escalation = policies.escalation;
  requireCondition(escalation?.schema === FORWARD_ESCALATION_POLICY_SCHEMA, "escalation policy schema mismatch");
  requireCondition(escalation.sourceHighSeverityRequiresAdjudicator === true, "source high-severity adjudication cannot be disabled");
  requireCondition(escalation.quizAmbiguityRequiresAdjudicator === true, "quiz ambiguity adjudication cannot be disabled");
  requireCondition(escalation.readerEscalationAdvisoryOnly === true, "reader escalation cannot acquire source authority");
  requireCondition(escalation.adjudicatorOperationalFailure === "INCONCLUSIVE", "adjudicator failure must be INCONCLUSIVE");
  requireCondition(escalation.outputInformedJudgeRotationAllowed === false, "output-informed judge rotation is forbidden");
  const disagreement = policies.disagreement;
  requireCondition(disagreement?.schema === FORWARD_DISAGREEMENT_POLICY_SCHEMA, "disagreement policy schema mismatch");
  requireCondition(nonEmpty(disagreement.policyVersion), "disagreement policy version is missing");
  requireCondition(disagreement.readerPrimaryAuditDisagreement === "REVISE", "reader disagreement must route to REVISE");
  requireCondition(disagreement.sourceHighSeverityUnresolvedDisagreement === "INCONCLUSIVE", "source disagreement must fail closed to INCONCLUSIVE");
  requireCondition(disagreement.quizDeterministicBlockerPrevails === true, "deterministic quiz blocker cannot be overridden");
  requireCondition(disagreement.quizUnresolvedSemanticDisagreement === "INCONCLUSIVE", "quiz disagreement must fail closed to INCONCLUSIVE");
  requireCondition(disagreement.outputInformedResamplingAllowed === false, "output-informed disagreement resampling is forbidden");
  validateLimitation(disagreement.independenceLimitations?.readerAudit, "reader audit independence limitation");
  validateLimitation(disagreement.independenceLimitations?.sourceAdjudicator, "source adjudicator independence limitation");
}

export function buildForwardPanelReviewPolicy(
  policies: ForwardRoleFreezePoliciesV1,
): ForwardPanelReviewPolicyV1 {
  validateForwardReviewPolicies(policies);
  const draft = {
    schema: FORWARD_PANEL_REVIEW_POLICY_SCHEMA,
    auditSubset: structuredClone(policies.auditSubset),
    escalation: structuredClone(policies.escalation),
    disagreement: structuredClone(policies.disagreement),
    auditSubsetPolicySha256: hashCanonical(policies.auditSubset),
    escalationPolicySha256: hashCanonical(policies.escalation),
    disagreementPolicySha256: hashCanonical(policies.disagreement),
  };
  return { ...draft, policySha256: hashCanonical(draft) };
}

export function validateForwardPanelReviewPolicy(policy: ForwardPanelReviewPolicyV1): void {
  requireCondition(policy?.schema === FORWARD_PANEL_REVIEW_POLICY_SCHEMA, "panel review policy schema mismatch");
  validateForwardReviewPolicies(policy);
  requireCondition(policy.auditSubsetPolicySha256 === hashCanonical(policy.auditSubset), "audit-subset policy hash drift");
  requireCondition(policy.escalationPolicySha256 === hashCanonical(policy.escalation), "escalation policy hash drift");
  requireCondition(policy.disagreementPolicySha256 === hashCanonical(policy.disagreement), "disagreement policy hash drift");
  const { policySha256: _policySha256, ...draft } = policy;
  requireCondition(policy.policySha256 === hashCanonical(draft), "panel review policy hash drift");
}

/** Fail closed unless exact-profile reuse is explicitly and honestly recorded. */
export function assertForwardAssignmentIndependence(
  assignment: FixedRoleAssignmentV1,
  policy: ForwardDisagreementPolicyV1,
): void {
  const checks: Array<[string, RoleJudgeRefV1, RoleJudgeRefV1, ForwardIndependenceLimitationV1]> = [
    ["reader primary/audit", assignment.readerPrimary, assignment.readerBackup, policy.independenceLimitations.readerAudit],
    ["source primary/adjudicator", assignment.sourcePrimary, assignment.sourceAdjudicator, policy.independenceLimitations.sourceAdjudicator],
  ];
  for (const [label, primary, independent, limitation] of checks) {
    if (primary.profileId !== independent.profileId) continue;
    requireCondition(limitation.allowSameExactProfile === true && nonEmpty(limitation.reason) && nonEmpty(limitation.mitigation), `${label} reuse the same exact profile without an explicit independence limitation`);
  }
}

/** Output-independent reader-audit membership helper for the frozen policy. */
export function isInForwardReaderAuditSubset(
  policy: ForwardAuditSubsetPolicyV1,
  coordinate: { bookId: string; chapterNumber: number },
): boolean {
  validateAuditPolicy(policy);
  requireCondition(nonEmpty(coordinate.bookId) && Number.isSafeInteger(coordinate.chapterNumber) && coordinate.chapterNumber > 0, "invalid reader-audit chapter coordinate");
  const digest = sha256Hex(`${policy.salt}\0${coordinate.bookId}\0${coordinate.chapterNumber}`);
  const bucket = Number(BigInt(`0x${digest.slice(0, 13)}`) % BigInt(policy.modulus));
  return policy.includedBuckets.includes(bucket);
}

