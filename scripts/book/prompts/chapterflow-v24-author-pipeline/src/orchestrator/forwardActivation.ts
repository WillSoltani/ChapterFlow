/**
 * Dormant, local-only forward activation policy for a qualified SOL authoring
 * profile. This module does not change modelPolicy.ts, register a CLI command,
 * read process state, or choose a default path. Every durable effect is an
 * injected, atomic write of one explicitly supplied policy file.
 */

import { canonicalJson, hashCanonical } from "../contracts/contractUtil.js";
import type { EffortLevelV1 } from "../contracts/executionProfile.js";

export const FORWARD_ACTIVATION_SCHEMA = "forward-activation-policy-v1" as const;
export const LOCAL_ROUTE_PROFILE_SCHEMA = "local-forward-route-profile-v1" as const;
export const VERIFIED_NO_API_ROUTE_SCHEMA = "verified-no-api-route-v1" as const;
export const FORWARD_ROLLBACK_AUDIT_SCHEMA = "forward-rollback-audit-v1" as const;
export const SOL_FORWARD_PROFILE_ID = "sol-forward-qualified-v1" as const;
export const SOL_FORWARD_WRITER_MODEL = "gpt-5.6-sol" as const;

export const FORWARD_ROLLBACK_TRIGGERS = [
  "qualification_stale",
  "role_assignment_drift",
  "route_verification_failed",
  "hard_gate_failure",
  "pilot_or_gold_regression",
  "operator_requested",
] as const;

export type ForwardRollbackTriggerV1 = (typeof FORWARD_ROLLBACK_TRIGGERS)[number];
export type ForwardWriterRiskClassV1 = "ordinary" | "high-risk";

export class ForwardActivationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ForwardActivationError";
  }
}

export type ModelEffortPinV1 = {
  model: string;
  effort: EffortLevelV1;
};

export type QualifiedReviewerProfileV1 = ModelEffortPinV1 & {
  profileId: string;
  qualificationHash: string;
};

export type FixedReviewerProfilesV1 = {
  readerPrimary: QualifiedReviewerProfileV1;
  readerBackup: QualifiedReviewerProfileV1;
  sourcePrimary: QualifiedReviewerProfileV1;
  sourceAdjudicator: QualifiedReviewerProfileV1;
  quizAdjudicator: QualifiedReviewerProfileV1;
  quizChecker: { deterministic: true; checkerVersion: string };
};

export type LocalForwardRouteProfileV1 = {
  schema: typeof LOCAL_ROUTE_PROFILE_SCHEMA;
  profileId: string;
  writer: ModelEffortPinV1;
  highRiskWriter: ModelEffortPinV1;
  reviewers: FixedReviewerProfilesV1;
};

export type SolForwardRouteProfileV1 = LocalForwardRouteProfileV1 & {
  profileId: typeof SOL_FORWARD_PROFILE_ID;
  writer: { model: typeof SOL_FORWARD_WRITER_MODEL; effort: "high" };
  highRiskWriter: { model: typeof SOL_FORWARD_WRITER_MODEL; effort: "xhigh" };
};

export type VerifiedNoApiRouteCoreV1 = {
  schema: typeof VERIFIED_NO_API_ROUTE_SCHEMA;
  verified: true;
  executionRoute: "codex_exec_chatgpt_subscription";
  authMode: "chatgpt";
  apiKeyPresent: false;
  apiFallbackAllowed: false;
  routePolicyVersion: string;
  executionProfileHash: string;
  cliVersion: string;
};

export type VerifiedNoApiRouteV1 = VerifiedNoApiRouteCoreV1 & {
  verificationHash: string;
};

export type ForwardActivationEvidenceV1 = {
  qualificationEvidenceHash: string;
  pilotEvidenceHash: string;
  goldBookEvidenceHash: string;
};

export type ForwardActivationCriteriaV1 = {
  qualificationPassed: true;
  pilotPassed: true;
  goldBookPassed: true;
  hardGateFailureCount: 0;
  hardGateFailures: [];
  frozenRoleAssignmentHash: string;
  noApiRouteVerified: true;
  evidence: ForwardActivationEvidenceV1;
};

export type ForwardRollbackAuditV1 = {
  schema: typeof FORWARD_ROLLBACK_AUDIT_SCHEMA;
  rollbackId: string;
  rolledBackAt: string;
  trigger: ForwardRollbackTriggerV1;
  reason: string;
  fromProfileId: typeof SOL_FORWARD_PROFILE_ID;
  restoredProfileId: string;
  priorActivePolicyHash: string;
};

type ForwardActivationPolicyBaseV1 = {
  schema: typeof FORWARD_ACTIVATION_SCHEMA;
  policyVersion: 1;
  activationId: string;
  activatedAt: string;
  localOnly: true;
  criteria: ForwardActivationCriteriaV1;
  noApiRoute: VerifiedNoApiRouteV1;
  activatedProfile: SolForwardRouteProfileV1;
  previousProfile: LocalForwardRouteProfileV1;
  rollbackTriggers: ForwardRollbackTriggerV1[];
  /** These capabilities are intentionally unrepresentable as true. */
  publish: false;
  promotion: false;
  deployment: false;
  upload: false;
};

export type ForwardActivationPolicyV1 =
  | (ForwardActivationPolicyBaseV1 & {
      status: "ACTIVE";
      selectedProfile: SolForwardRouteProfileV1;
      rollback: null;
    })
  | (ForwardActivationPolicyBaseV1 & {
      status: "ROLLED_BACK";
      selectedProfile: LocalForwardRouteProfileV1;
      rollback: ForwardRollbackAuditV1;
    });

export type ForwardActivationRequestV1 = {
  activationId: string;
  activatedAt: string;
  qualificationPassed: boolean;
  pilotPassed: boolean;
  goldBookPassed: boolean;
  hardGateFailures: readonly string[];
  frozenRoleAssignmentHash: string;
  fixedReviewerProfiles: FixedReviewerProfilesV1;
  noApiRoute: VerifiedNoApiRouteV1;
  previousProfile: LocalForwardRouteProfileV1;
  evidence: ForwardActivationEvidenceV1;
};

export type ForwardRollbackRequestV1 = {
  rollbackId: string;
  rolledBackAt: string;
  trigger: ForwardRollbackTriggerV1;
  reason: string;
};

/** The caller owns the storage root and the atomic-write implementation. */
export type ForwardActivationIO = {
  readText: (path: string) => string | null;
  writeTextAtomic: (path: string, text: string) => void;
};

export type ResolvedForwardWriterRouteV1 = ModelEffortPinV1 & {
  profileId: string;
  riskClass: ForwardWriterRiskClassV1;
  source: typeof FORWARD_ACTIVATION_SCHEMA;
};

const EFFORTS: readonly EffortLevelV1[] = ["minimal", "low", "medium", "high", "xhigh"];
const SHA256 = /^[a-f0-9]{64}$/;
const MODEL_ID = /^[a-z0-9][a-z0-9.-]{1,63}$/;

function cloneJson<T>(value: T): T {
  return JSON.parse(canonicalJson(value)) as T;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isNonEmpty(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isIsoTimestamp(value: unknown): value is string {
  return isNonEmpty(value) && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value) && !Number.isNaN(Date.parse(value));
}

function exactKeys(value: Record<string, unknown>, expected: readonly string[], where: string, errors: string[]): void {
  const expectedSet = new Set(expected);
  for (const key of expected) if (!(key in value)) errors.push(`${where}: missing "${key}"`);
  for (const key of Object.keys(value)) if (!expectedSet.has(key)) errors.push(`${where}: unexpected "${key}"`);
}

function validateHash(value: unknown, where: string, errors: string[]): void {
  if (typeof value !== "string" || !SHA256.test(value)) errors.push(`${where}: must be a lowercase sha256`);
}

function validateModelPin(value: unknown, where: string, errors: string[]): void {
  if (!isRecord(value)) {
    errors.push(`${where}: must be an object`);
    return;
  }
  exactKeys(value, ["model", "effort"], where, errors);
  if (typeof value.model !== "string" || !MODEL_ID.test(value.model)) errors.push(`${where}.model: invalid explicit model id`);
  if (!EFFORTS.includes(value.effort as EffortLevelV1)) errors.push(`${where}.effort: invalid explicit effort`);
}

function validateReviewerProfile(value: unknown, where: string, errors: string[]): void {
  if (!isRecord(value)) {
    errors.push(`${where}: must be an object`);
    return;
  }
  exactKeys(value, ["profileId", "model", "effort", "qualificationHash"], where, errors);
  validateModelPin({ model: value.model, effort: value.effort }, where, errors);
  if (!isNonEmpty(value.profileId)) errors.push(`${where}.profileId: required`);
  if (typeof value.model === "string" && typeof value.effort === "string" && value.profileId !== `${value.model}@${value.effort}`) {
    errors.push(`${where}.profileId: must equal <model>@<effort>`);
  }
  validateHash(value.qualificationHash, `${where}.qualificationHash`, errors);
}

function validateFixedReviewers(value: unknown, where: string, errors: string[]): void {
  if (!isRecord(value)) {
    errors.push(`${where}: must be an object`);
    return;
  }
  const slots = ["readerPrimary", "readerBackup", "sourcePrimary", "sourceAdjudicator", "quizAdjudicator"] as const;
  exactKeys(value, [...slots, "quizChecker"], where, errors);
  for (const slot of slots) validateReviewerProfile(value[slot], `${where}.${slot}`, errors);
  if (!isRecord(value.quizChecker)) {
    errors.push(`${where}.quizChecker: must be an object`);
  } else {
    exactKeys(value.quizChecker, ["deterministic", "checkerVersion"], `${where}.quizChecker`, errors);
    if (value.quizChecker.deterministic !== true) errors.push(`${where}.quizChecker.deterministic: must be true`);
    if (!isNonEmpty(value.quizChecker.checkerVersion)) errors.push(`${where}.quizChecker.checkerVersion: required`);
  }
}

function validateRouteProfile(value: unknown, where: string, errors: string[]): void {
  if (!isRecord(value)) {
    errors.push(`${where}: must be an object`);
    return;
  }
  exactKeys(value, ["schema", "profileId", "writer", "highRiskWriter", "reviewers"], where, errors);
  if (value.schema !== LOCAL_ROUTE_PROFILE_SCHEMA) errors.push(`${where}.schema: invalid`);
  if (!isNonEmpty(value.profileId)) errors.push(`${where}.profileId: required`);
  validateModelPin(value.writer, `${where}.writer`, errors);
  validateModelPin(value.highRiskWriter, `${where}.highRiskWriter`, errors);
  validateFixedReviewers(value.reviewers, `${where}.reviewers`, errors);
}

function noApiRouteCore(value: Record<string, unknown>): VerifiedNoApiRouteCoreV1 {
  return {
    schema: value.schema as VerifiedNoApiRouteCoreV1["schema"],
    verified: value.verified as true,
    executionRoute: value.executionRoute as VerifiedNoApiRouteCoreV1["executionRoute"],
    authMode: value.authMode as "chatgpt",
    apiKeyPresent: value.apiKeyPresent as false,
    apiFallbackAllowed: value.apiFallbackAllowed as false,
    routePolicyVersion: value.routePolicyVersion as string,
    executionProfileHash: value.executionProfileHash as string,
    cliVersion: value.cliVersion as string,
  };
}

function validateNoApiRoute(value: unknown, where: string, errors: string[]): void {
  if (!isRecord(value)) {
    errors.push(`${where}: must be an object`);
    return;
  }
  exactKeys(value, [
    "schema", "verified", "executionRoute", "authMode", "apiKeyPresent", "apiFallbackAllowed",
    "routePolicyVersion", "executionProfileHash", "cliVersion", "verificationHash",
  ], where, errors);
  if (value.schema !== VERIFIED_NO_API_ROUTE_SCHEMA) errors.push(`${where}.schema: invalid`);
  if (value.verified !== true) errors.push(`${where}.verified: must be true`);
  if (value.executionRoute !== "codex_exec_chatgpt_subscription") errors.push(`${where}.executionRoute: subscription codex exec required`);
  if (value.authMode !== "chatgpt") errors.push(`${where}.authMode: chatgpt required`);
  if (value.apiKeyPresent !== false) errors.push(`${where}.apiKeyPresent: must be false`);
  if (value.apiFallbackAllowed !== false) errors.push(`${where}.apiFallbackAllowed: must be false`);
  if (!isNonEmpty(value.routePolicyVersion)) errors.push(`${where}.routePolicyVersion: required`);
  validateHash(value.executionProfileHash, `${where}.executionProfileHash`, errors);
  if (!isNonEmpty(value.cliVersion)) errors.push(`${where}.cliVersion: required`);
  validateHash(value.verificationHash, `${where}.verificationHash`, errors);
  if (typeof value.verificationHash === "string" && value.verificationHash !== hashCanonical(noApiRouteCore(value))) {
    errors.push(`${where}.verificationHash: does not bind the route proof`);
  }
}

function validateEvidence(value: unknown, where: string, errors: string[]): void {
  if (!isRecord(value)) {
    errors.push(`${where}: must be an object`);
    return;
  }
  exactKeys(value, ["qualificationEvidenceHash", "pilotEvidenceHash", "goldBookEvidenceHash"], where, errors);
  validateHash(value.qualificationEvidenceHash, `${where}.qualificationEvidenceHash`, errors);
  validateHash(value.pilotEvidenceHash, `${where}.pilotEvidenceHash`, errors);
  validateHash(value.goldBookEvidenceHash, `${where}.goldBookEvidenceHash`, errors);
}

function validateRollbackAudit(value: unknown, policy: Record<string, unknown>, errors: string[]): void {
  if (!isRecord(value)) {
    errors.push("policy.rollback: must be an object after rollback");
    return;
  }
  exactKeys(value, [
    "schema", "rollbackId", "rolledBackAt", "trigger", "reason", "fromProfileId",
    "restoredProfileId", "priorActivePolicyHash",
  ], "policy.rollback", errors);
  if (value.schema !== FORWARD_ROLLBACK_AUDIT_SCHEMA) errors.push("policy.rollback.schema: invalid");
  if (!isNonEmpty(value.rollbackId)) errors.push("policy.rollback.rollbackId: required");
  if (!isIsoTimestamp(value.rolledBackAt)) errors.push("policy.rollback.rolledBackAt: UTC ISO timestamp required");
  if (!FORWARD_ROLLBACK_TRIGGERS.includes(value.trigger as ForwardRollbackTriggerV1)) errors.push("policy.rollback.trigger: unknown trigger");
  if (!isNonEmpty(value.reason)) errors.push("policy.rollback.reason: required");
  if (value.fromProfileId !== SOL_FORWARD_PROFILE_ID) errors.push("policy.rollback.fromProfileId: invalid");
  const previous = isRecord(policy.previousProfile) ? policy.previousProfile : null;
  if (previous && value.restoredProfileId !== previous.profileId) errors.push("policy.rollback.restoredProfileId: must restore previousProfile");
  validateHash(value.priorActivePolicyHash, "policy.rollback.priorActivePolicyHash", errors);
}

export function fixedReviewerProfilesHash(reviewers: FixedReviewerProfilesV1): string {
  return hashCanonical(reviewers);
}

export function bindVerifiedNoApiRoute(core: VerifiedNoApiRouteCoreV1): VerifiedNoApiRouteV1 {
  const route = { ...cloneJson(core), verificationHash: hashCanonical(core) } as VerifiedNoApiRouteV1;
  const errors: string[] = [];
  validateNoApiRoute(route, "noApiRoute", errors);
  if (errors.length) throw new ForwardActivationError(`invalid no-API route proof:\n- ${errors.join("\n- ")}`);
  return route;
}

function validateActivationRequest(request: unknown): string[] {
  const errors: string[] = [];
  if (!isRecord(request)) return ["activation request: must be an object"];
  exactKeys(request, [
    "activationId", "activatedAt", "qualificationPassed", "pilotPassed", "goldBookPassed",
    "hardGateFailures", "frozenRoleAssignmentHash", "fixedReviewerProfiles", "noApiRoute",
    "previousProfile", "evidence",
  ], "activation request", errors);
  if (!isNonEmpty(request.activationId)) errors.push("activation request.activationId: required");
  if (!isIsoTimestamp(request.activatedAt)) errors.push("activation request.activatedAt: UTC ISO timestamp required");
  if (request.qualificationPassed !== true) errors.push("qualificationPassed must be true");
  if (request.pilotPassed !== true) errors.push("pilotPassed must be true");
  if (request.goldBookPassed !== true) errors.push("goldBookPassed must be true");
  if (!Array.isArray(request.hardGateFailures) || request.hardGateFailures.length !== 0) {
    errors.push("hardGateFailures must be an empty array");
  }
  validateHash(request.frozenRoleAssignmentHash, "activation request.frozenRoleAssignmentHash", errors);
  validateFixedReviewers(request.fixedReviewerProfiles, "activation request.fixedReviewerProfiles", errors);
  if (isRecord(request.fixedReviewerProfiles) && typeof request.frozenRoleAssignmentHash === "string" &&
      request.frozenRoleAssignmentHash !== hashCanonical(request.fixedReviewerProfiles)) {
    errors.push("frozenRoleAssignmentHash does not bind fixedReviewerProfiles");
  }
  validateNoApiRoute(request.noApiRoute, "activation request.noApiRoute", errors);
  validateRouteProfile(request.previousProfile, "activation request.previousProfile", errors);
  if (isRecord(request.previousProfile) && request.previousProfile.profileId === SOL_FORWARD_PROFILE_ID) {
    errors.push("previousProfile must be a distinct rollback target");
  }
  validateEvidence(request.evidence, "activation request.evidence", errors);
  return errors;
}

export function buildForwardActivationPolicy(request: ForwardActivationRequestV1): ForwardActivationPolicyV1 {
  const requestErrors = validateActivationRequest(request);
  if (requestErrors.length) throw new ForwardActivationError(`forward activation refused:\n- ${requestErrors.join("\n- ")}`);

  const reviewers = cloneJson(request.fixedReviewerProfiles);
  const activatedProfile: SolForwardRouteProfileV1 = {
    schema: LOCAL_ROUTE_PROFILE_SCHEMA,
    profileId: SOL_FORWARD_PROFILE_ID,
    writer: { model: SOL_FORWARD_WRITER_MODEL, effort: "high" },
    highRiskWriter: { model: SOL_FORWARD_WRITER_MODEL, effort: "xhigh" },
    reviewers,
  };
  const policy: ForwardActivationPolicyV1 = {
    schema: FORWARD_ACTIVATION_SCHEMA,
    policyVersion: 1,
    activationId: request.activationId,
    activatedAt: request.activatedAt,
    status: "ACTIVE",
    localOnly: true,
    criteria: {
      qualificationPassed: true,
      pilotPassed: true,
      goldBookPassed: true,
      hardGateFailureCount: 0,
      hardGateFailures: [],
      frozenRoleAssignmentHash: request.frozenRoleAssignmentHash,
      noApiRouteVerified: true,
      evidence: cloneJson(request.evidence),
    },
    noApiRoute: cloneJson(request.noApiRoute),
    activatedProfile,
    previousProfile: cloneJson(request.previousProfile),
    selectedProfile: cloneJson(activatedProfile),
    rollbackTriggers: [...FORWARD_ROLLBACK_TRIGGERS],
    rollback: null,
    publish: false,
    promotion: false,
    deployment: false,
    upload: false,
  };
  assertForwardActivationPolicy(policy);
  return policy;
}

export function validateForwardActivationPolicy(value: unknown): string[] {
  const errors: string[] = [];
  if (!isRecord(value)) return ["policy: must be an object"];
  exactKeys(value, [
    "schema", "policyVersion", "activationId", "activatedAt", "status", "localOnly", "criteria",
    "noApiRoute", "activatedProfile", "previousProfile", "selectedProfile", "rollbackTriggers",
    "rollback", "publish", "promotion", "deployment", "upload",
  ], "policy", errors);
  if (value.schema !== FORWARD_ACTIVATION_SCHEMA) errors.push("policy.schema: invalid");
  if (value.policyVersion !== 1) errors.push("policy.policyVersion: must be 1");
  if (!isNonEmpty(value.activationId)) errors.push("policy.activationId: required");
  if (!isIsoTimestamp(value.activatedAt)) errors.push("policy.activatedAt: UTC ISO timestamp required");
  if (value.status !== "ACTIVE" && value.status !== "ROLLED_BACK") errors.push("policy.status: invalid");
  if (value.localOnly !== true) errors.push("policy.localOnly: must be true");
  for (const capability of ["publish", "promotion", "deployment", "upload"] as const) {
    if (value[capability] !== false) errors.push(`policy.${capability}: must be literal false`);
  }

  if (!isRecord(value.criteria)) {
    errors.push("policy.criteria: must be an object");
  } else {
    exactKeys(value.criteria, [
      "qualificationPassed", "pilotPassed", "goldBookPassed", "hardGateFailureCount",
      "hardGateFailures", "frozenRoleAssignmentHash", "noApiRouteVerified", "evidence",
    ], "policy.criteria", errors);
    if (value.criteria.qualificationPassed !== true) errors.push("policy.criteria.qualificationPassed: must be true");
    if (value.criteria.pilotPassed !== true) errors.push("policy.criteria.pilotPassed: must be true");
    if (value.criteria.goldBookPassed !== true) errors.push("policy.criteria.goldBookPassed: must be true");
    if (value.criteria.hardGateFailureCount !== 0) errors.push("policy.criteria.hardGateFailureCount: must be 0");
    if (!Array.isArray(value.criteria.hardGateFailures) || value.criteria.hardGateFailures.length !== 0) {
      errors.push("policy.criteria.hardGateFailures: must be empty");
    }
    validateHash(value.criteria.frozenRoleAssignmentHash, "policy.criteria.frozenRoleAssignmentHash", errors);
    if (value.criteria.noApiRouteVerified !== true) errors.push("policy.criteria.noApiRouteVerified: must be true");
    validateEvidence(value.criteria.evidence, "policy.criteria.evidence", errors);
  }

  validateNoApiRoute(value.noApiRoute, "policy.noApiRoute", errors);
  validateRouteProfile(value.activatedProfile, "policy.activatedProfile", errors);
  validateRouteProfile(value.previousProfile, "policy.previousProfile", errors);
  validateRouteProfile(value.selectedProfile, "policy.selectedProfile", errors);
  if (isRecord(value.activatedProfile)) {
    if (value.activatedProfile.profileId !== SOL_FORWARD_PROFILE_ID) errors.push("policy.activatedProfile.profileId: invalid");
    if (!isRecord(value.activatedProfile.writer) || value.activatedProfile.writer.model !== SOL_FORWARD_WRITER_MODEL || value.activatedProfile.writer.effort !== "high") {
      errors.push("policy.activatedProfile.writer: must pin gpt-5.6-sol@high");
    }
    if (!isRecord(value.activatedProfile.highRiskWriter) || value.activatedProfile.highRiskWriter.model !== SOL_FORWARD_WRITER_MODEL || value.activatedProfile.highRiskWriter.effort !== "xhigh") {
      errors.push("policy.activatedProfile.highRiskWriter: must pin gpt-5.6-sol@xhigh");
    }
    if (isRecord(value.criteria) && isRecord(value.activatedProfile.reviewers) &&
        value.criteria.frozenRoleAssignmentHash !== hashCanonical(value.activatedProfile.reviewers)) {
      errors.push("policy.criteria.frozenRoleAssignmentHash: reviewer assignment drift");
    }
  }
  if (isRecord(value.previousProfile) && value.previousProfile.profileId === SOL_FORWARD_PROFILE_ID) {
    errors.push("policy.previousProfile: must be a distinct rollback target");
  }

  if (!Array.isArray(value.rollbackTriggers) || canonicalJson(value.rollbackTriggers) !== canonicalJson(FORWARD_ROLLBACK_TRIGGERS)) {
    errors.push("policy.rollbackTriggers: must equal the frozen trigger set in order");
  }
  if (value.status === "ACTIVE") {
    if (value.rollback !== null) errors.push("policy.rollback: must be null while ACTIVE");
    if (canonicalJson(value.selectedProfile) !== canonicalJson(value.activatedProfile)) {
      errors.push("policy.selectedProfile: ACTIVE policy must select activatedProfile");
    }
  } else if (value.status === "ROLLED_BACK") {
    validateRollbackAudit(value.rollback, value, errors);
    if (canonicalJson(value.selectedProfile) !== canonicalJson(value.previousProfile)) {
      errors.push("policy.selectedProfile: rollback must restore previousProfile exactly");
    }
  }
  return errors;
}

export function assertForwardActivationPolicy(value: unknown): asserts value is ForwardActivationPolicyV1 {
  const errors = validateForwardActivationPolicy(value);
  if (errors.length) throw new ForwardActivationError(`invalid forward activation policy:\n- ${errors.join("\n- ")}`);
}

export function serializeForwardActivationPolicy(policy: ForwardActivationPolicyV1): string {
  assertForwardActivationPolicy(policy);
  return `${JSON.stringify(policy, null, 2)}\n`;
}

export function parseForwardActivationPolicy(text: string): ForwardActivationPolicyV1 {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch (error) {
    throw new ForwardActivationError(`forward activation policy is not JSON: ${(error as Error).message}`);
  }
  assertForwardActivationPolicy(value);
  return value;
}

export function activateForwardPolicy(
  policyPath: string,
  request: ForwardActivationRequestV1,
  io: ForwardActivationIO,
): ForwardActivationPolicyV1 {
  if (!isNonEmpty(policyPath)) throw new ForwardActivationError("policyPath is required; there is no ambient default path");
  if (io.readText(policyPath) !== null) {
    throw new ForwardActivationError(`forward activation policy already exists at ${policyPath}; refusing an implicit overwrite`);
  }
  const policy = buildForwardActivationPolicy(request);
  io.writeTextAtomic(policyPath, serializeForwardActivationPolicy(policy));
  return policy;
}

export function rollbackForwardPolicy(
  policyPath: string,
  request: ForwardRollbackRequestV1,
  io: ForwardActivationIO,
): ForwardActivationPolicyV1 {
  if (!isNonEmpty(policyPath)) throw new ForwardActivationError("policyPath is required; there is no ambient default path");
  const text = io.readText(policyPath);
  if (text === null) throw new ForwardActivationError(`no forward activation policy exists at ${policyPath}`);
  const current = parseForwardActivationPolicy(text);
  if (current.status !== "ACTIVE") throw new ForwardActivationError("forward activation is already rolled back; refusing a second rollback");
  if (!isNonEmpty(request.rollbackId)) throw new ForwardActivationError("rollbackId is required");
  if (!isIsoTimestamp(request.rolledBackAt)) throw new ForwardActivationError("rolledBackAt must be a UTC ISO timestamp");
  if (Date.parse(request.rolledBackAt) < Date.parse(current.activatedAt)) {
    throw new ForwardActivationError("rolledBackAt cannot precede activatedAt");
  }
  if (!FORWARD_ROLLBACK_TRIGGERS.includes(request.trigger)) throw new ForwardActivationError(`unknown rollback trigger "${String(request.trigger)}"`);
  if (!isNonEmpty(request.reason)) throw new ForwardActivationError("rollback reason is required");

  const rolledBack: ForwardActivationPolicyV1 = {
    ...cloneJson(current),
    status: "ROLLED_BACK",
    selectedProfile: cloneJson(current.previousProfile),
    rollback: {
      schema: FORWARD_ROLLBACK_AUDIT_SCHEMA,
      rollbackId: request.rollbackId,
      rolledBackAt: request.rolledBackAt,
      trigger: request.trigger,
      reason: request.reason,
      fromProfileId: SOL_FORWARD_PROFILE_ID,
      restoredProfileId: current.previousProfile.profileId,
      priorActivePolicyHash: hashCanonical(current),
    },
  };
  assertForwardActivationPolicy(rolledBack);
  io.writeTextAtomic(policyPath, serializeForwardActivationPolicy(rolledBack));
  return rolledBack;
}

/** Resolve only an explicitly named risk class. Unknown or malformed values are
 * refused; there is deliberately no `default`, `??`, or baseline fallback. */
export function resolveForwardWriterRoute(
  policy: ForwardActivationPolicyV1,
  riskClass: ForwardWriterRiskClassV1,
): ResolvedForwardWriterRouteV1 {
  assertForwardActivationPolicy(policy);
  let pin: ModelEffortPinV1;
  if (riskClass === "ordinary") pin = policy.selectedProfile.writer;
  else if (riskClass === "high-risk") pin = policy.selectedProfile.highRiskWriter;
  else throw new ForwardActivationError(`unknown writer risk class "${String(riskClass)}"; no silent fallback is allowed`);
  return {
    profileId: policy.selectedProfile.profileId,
    riskClass,
    model: pin.model,
    effort: pin.effort,
    source: FORWARD_ACTIVATION_SCHEMA,
  };
}
