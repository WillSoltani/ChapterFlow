/**
 * Central local entrypoint for future ChapterFlow authoring.
 *
 * An absent policy preserves the explicit baseline author route. A valid
 * ROLLED_BACK policy restores its recorded previous writer profile. Only an
 * explicitly ACTIVE policy whose qualification, instruments, fixed reviewers,
 * no-API route, pilot, and gold evidence still match current local evidence can
 * enter the forward path:
 *
 *   explicit SOL writer -> prepared candidate -> fixed split lanes -> aggregate
 *   -> conductor-owned atomic commit
 *
 * This module owns no filesystem path, process environment, provider fallback,
 * publication, promotion, deployment, or upload capability. Storage and model
 * execution remain explicit injected dependencies.
 */

import { canonicalJson, hashCanonical } from "../contracts/contractUtil.js";
import {
  FORWARD_ACTIVATION_SCHEMA,
  ForwardActivationError,
  fixedReviewerProfilesHash,
  parseForwardActivationPolicy,
  resolveForwardWriterRoute,
  type FixedReviewerProfilesV1,
  type ForwardActivationEvidenceV1,
  type ForwardActivationPolicyV1,
  type QualifiedReviewerProfileV1,
  type ResolvedForwardWriterRouteV1,
  type VerifiedNoApiRouteV1,
} from "./forwardActivation.js";
import {
  assertForwardFrozenReviewConfig,
  runForwardChapterConductor,
  type ForwardChapterConductorInputV1,
  type ForwardChapterConductorResultV1,
  type ForwardReviewerExecutor,
} from "./forwardChapterConductor.js";
import type {
  BoundForwardFrozenReviewConfigV1,
  ForwardRoleAssignmentFreezeV1,
  ForwardRoleProfileBindingV1,
  ForwardRoleSlot,
} from "./forwardRoleAssignmentFreeze.js";
import type {
  BoundForwardFrozenReviewConfigV3,
  ForwardRoleAssignmentFreezeV3,
  ForwardRoleProfileBindingV3,
} from "./forwardRoleAssignmentFreezeV3.js";
import {
  authorWriteOneChapter,
  type AuthorWriteOneInvoker,
  type AuthorWriteOneOpts,
  type AuthorWriteOneResult,
  type PreparedAuthorCandidate,
} from "./authorRun.js";
import type { AutopilotDeps } from "./autopilot.js";
import { deriveComplaintScope, type RepairScope } from "./authorRepair.js";
import {
  NORMAL_PROFILE,
  ROUTE_POLICY_VERSION,
  classifyForwardAuthoringRisk,
  resolveRoute,
  type ForwardAuthoringRiskDecisionV1,
  type ForwardAuthoringRiskSignalsV1,
} from "./modelPolicy.js";

export const FORWARD_LOCAL_RUNTIME_BINDING_SCHEMA = "forward-local-author-runtime-binding-v1" as const;
export const FORWARD_LOCAL_RUNTIME_BINDING_V2_SCHEMA = "imp24-forward-local-author-runtime-binding-v2" as const;
export const FORWARD_LOCAL_RUNTIME_SCHEMA = "forward-local-author-runtime-v1" as const;

export const FORWARD_LOCAL_EXTERNAL_CAPABILITIES = Object.freeze({
  publish: false as const,
  promotion: false as const,
  deployment: false as const,
  upload: false as const,
  apiFallback: false as const,
});

const SHA256 = /^[a-f0-9]{64}$/;

export class ForwardAuthorRuntimeError extends Error {
  readonly classification = "policy_preflight_failure" as const;

  constructor(message: string) {
    super(message);
    this.name = "ForwardAuthorRuntimeError";
  }
}

export type ForwardLocalRuntimeBindingV1 = {
  schema: typeof FORWARD_LOCAL_RUNTIME_BINDING_SCHEMA | typeof FORWARD_LOCAL_RUNTIME_BINDING_V2_SCHEMA;
  localOnly: true;
  qualificationBundleSha256: string;
  roleAssignmentFreezeSha256: string;
  instrumentBindingSha256: string;
  reviewConfig: BoundForwardFrozenReviewConfigV1 | BoundForwardFrozenReviewConfigV3;
  reviewConfigSha256: string;
  roleProfileBindings: Record<ForwardRoleSlot, ForwardRoleProfileBindingV1 | ForwardRoleProfileBindingV3>;
  roleProfileBindingsSha256: string;
  executionProfileHash: string;
  routePolicyVersion: string;
  publish: false;
  promotion: false;
  deployment: false;
  upload: false;
  apiFallbackAllowed: false;
  bindingSha256: string;
};

export type ResolveForwardLocalRuntimeInputV1 = {
  /** Null means no local activation exists and the explicit baseline remains. */
  activationPolicyText: string | null;
  /** Required only for ACTIVE. It is produced from a post-qualification freeze. */
  runtimeBindingText?: string | null;
  /** Current evidence is explicit: runtime never discovers or guesses it. */
  currentEvidence?: ForwardActivationEvidenceV1;
  currentNoApiRoute?: VerifiedNoApiRouteV1;
  currentInstrumentBindingSha256?: string;
  currentReviewConfigSha256?: string;
  currentRoleAssignmentFreezeSha256?: string;
};

export type ForwardBaselineRuntimeV1 = {
  schema: typeof FORWARD_LOCAL_RUNTIME_SCHEMA;
  mode: "BASELINE";
  reason: "NO_POLICY" | "ROLLED_BACK";
  policy: ForwardActivationPolicyV1 | null;
  binding: null;
  externalCapabilities: typeof FORWARD_LOCAL_EXTERNAL_CAPABILITIES;
};

export type ForwardActiveRuntimeV1 = {
  schema: typeof FORWARD_LOCAL_RUNTIME_SCHEMA;
  mode: "FORWARD_ACTIVE";
  reason: "ACTIVE_POLICY_VALIDATED";
  policy: Extract<ForwardActivationPolicyV1, { status: "ACTIVE" }>;
  binding: ForwardLocalRuntimeBindingV1;
  externalCapabilities: typeof FORWARD_LOCAL_EXTERNAL_CAPABILITIES;
  runtimeSha256: string;
};

export type ResolvedForwardLocalRuntimeV1 = ForwardBaselineRuntimeV1 | ForwardActiveRuntimeV1;

export type ForwardReviewEvidenceV1 = Omit<ForwardChapterConductorInputV1, "prepared" | "frozen">;

export type RunLocalAuthoringChapterInputV1 = {
  runtime: ResolvedForwardLocalRuntimeV1;
  bookId: string;
  chapterNumber: number;
  riskSignals: ForwardAuthoringRiskSignalsV1;
  authorDeps: AutopilotDeps;
  authorOptions?: Omit<AuthorWriteOneOpts, "model" | "effort" | "deferCommit">;
  /** ACTIVE-only authoritative source/anchor loader. */
  loadReviewEvidence?: (prepared: PreparedAuthorCandidate) => Promise<ForwardReviewEvidenceV1> | ForwardReviewEvidenceV1;
  /** ACTIVE-only explicit ChatGPT-subscription executor; there is no fallback. */
  reviewerExecutor?: ForwardReviewerExecutor;
  persistCommittedResult?: (args: {
    bookId: string;
    chapterNumber: number;
    result: ForwardChapterConductorResultV1;
  }) => void | (() => void);
};

export type RunLocalAuthoringChapterDepsV1 = {
  writeCandidate?: typeof authorWriteOneChapter;
  conductReview?: typeof runForwardChapterConductor;
  /** ACTIVE-only bounded typed-patch producer. It must return a deferred
   * candidate; the fixed conductor still owns the only commit. */
  prepareTypedRepair?: (request: ForwardTypedRepairRequestV1) => Promise<ForwardTypedRepairProductionV1>;
};

export type ForwardTypedRepairProductionV1 =
  | Extract<AuthorWriteOneResult, { ok: true; committed: false }>
  | {
      ok: false;
      reason: string;
      failureDisposition: "WRONG_ROUTE" | "WHOLE_CHAPTER_FAILURE" | "REPAIR_CONTENT_FAILURE" | "INFRASTRUCTURE";
    };

export type ForwardTypedRepairRequestV1 = {
  prepared: PreparedAuthorCandidate;
  reviewResult: ForwardChapterConductorResultV1;
  complaints: string[];
  scopes: RepairScope[];
  route: ForwardLocalWriterRouteV1;
  authorDeps: AutopilotDeps;
};

export type CreateForwardAuthorChapterWriterInputV1 = {
  runtime: ResolvedForwardLocalRuntimeV1;
  riskSignalsFor: (coordinate: { bookId: string; chapterNumber: number }) => ForwardAuthoringRiskSignalsV1;
  /** Required only when runtime.mode is FORWARD_ACTIVE. */
  loadReviewEvidence?: (prepared: PreparedAuthorCandidate) => Promise<ForwardReviewEvidenceV1> | ForwardReviewEvidenceV1;
  /** Required only when runtime.mode is FORWARD_ACTIVE. */
  reviewerExecutor?: ForwardReviewerExecutor;
  /** Standard filesystem adapter persists only conductor-committed PASS
   * results, atomically and with read-back, before the book phase advances. */
  retainCommittedResult?: (args: {
    bookId: string;
    chapterNumber: number;
    result: ForwardChapterConductorResultV1;
  }) => void | (() => void);
};

export type ForwardLocalWriterRouteV1 = Omit<ResolvedForwardWriterRouteV1, "source"> & {
  source: typeof FORWARD_ACTIVATION_SCHEMA | "central-model-policy";
  riskPolicy: ForwardAuthoringRiskDecisionV1;
};

export type LocalAuthoringChapterResultV1 =
  | {
      mode: "BASELINE";
      route: ForwardLocalWriterRouteV1;
      writeResult: AuthorWriteOneResult;
      reviewResult: null;
      externalCapabilities: typeof FORWARD_LOCAL_EXTERNAL_CAPABILITIES;
    }
  | {
      mode: "FORWARD_ACTIVE";
      status: "WRITE_FAILED" | "REVIEWED";
      route: ForwardLocalWriterRouteV1;
      writeResult: AuthorWriteOneResult;
      reviewResult: ForwardChapterConductorResultV1 | null;
      externalCapabilities: typeof FORWARD_LOCAL_EXTERNAL_CAPABILITIES;
    };

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function requireCondition(condition: unknown, message: string): asserts condition {
  if (!condition) throw new ForwardAuthorRuntimeError(message);
}

function requireSha(value: unknown, message: string): asserts value is string {
  requireCondition(typeof value === "string" && SHA256.test(value), message);
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

function clone<T>(value: T): T {
  return JSON.parse(canonicalJson(value)) as T;
}

function hashWithout<T extends Record<string, unknown>>(value: T, field: keyof T): string {
  const draft = { ...value };
  delete draft[field];
  return hashCanonical(draft);
}

function exactKeys(value: Record<string, unknown>, expected: readonly string[], where: string): void {
  const expectedSet = new Set(expected);
  const missing = expected.filter((key) => !(key in value));
  const extra = Object.keys(value).filter((key) => !expectedSet.has(key));
  requireCondition(missing.length === 0 && extra.length === 0,
    `${where} fields drift (missing: ${missing.join(", ") || "none"}; unexpected: ${extra.join(", ") || "none"})`);
}

function assertRoleBinding(
  binding: ForwardRoleProfileBindingV1 | ForwardRoleProfileBindingV3,
  slot: ForwardRoleSlot,
  lane: "reader" | "source" | "quiz",
  expectedJudge: { profileId: string; model: string; effort: string },
  runtime: ForwardLocalRuntimeBindingV1,
): void {
  const v3 = runtime.schema === FORWARD_LOCAL_RUNTIME_BINDING_V2_SCHEMA;
  requireCondition(binding?.schema === (v3
    ? "imp24-forward-role-profile-binding-v3"
    : "imp22-forward-role-profile-binding-v1"), `${slot}: role-profile binding schema mismatch`);
  requireCondition(binding.slot === slot && binding.lane === lane, `${slot}: role-profile slot/lane drift`);
  requireCondition(canonicalJson(binding.judge) === canonicalJson(expectedJudge), `${slot}: role-profile judge drift`);
  requireSha(binding.promptSourceSha256, `${slot}: prompt source hash missing`);
  requireSha(binding.schemaSha256, `${slot}: schema hash missing`);
  requireCondition(binding.executionProfileHash === runtime.executionProfileHash, `${slot}: execution profile drift`);
  requireCondition(binding.routePolicyVersion === runtime.routePolicyVersion, `${slot}: route policy drift`);
  if (binding.schema === "imp24-forward-role-profile-binding-v3") {
    for (const [label, value] of Object.entries({
      qualificationResultSha256: binding.qualificationResultSha256,
      profileRoleResultSha256: binding.profileRoleResultSha256,
      canaryAttemptsSha256: binding.canaryAttemptsSha256,
      holdoutAttemptsSha256: binding.holdoutAttemptsSha256,
      envelopeCompilerSha256: binding.envelopeCompilerSha256,
      envelopeContractSha256: binding.envelopeContractSha256,
      modelOutputContractsSha256: binding.modelOutputContractsSha256,
      productionQualificationParitySha256: binding.productionQualificationParitySha256,
      thresholdsSha256: binding.thresholdsSha256,
      productionInstrumentSealSha256: binding.productionInstrumentSealSha256,
    })) requireSha(value, `${slot}: ${label} missing`);
  } else {
    requireSha(binding.qualificationRecordSha256, `${slot}: qualification record hash missing`);
    requireSha(binding.qualificationPromptBundleSha256, `${slot}: qualification prompt hash missing`);
    requireCondition(binding.profileSha256 === hashCanonical({
      judge: binding.judge,
      executionProfileHash: binding.executionProfileHash,
      routePolicyVersion: binding.routePolicyVersion,
    }), `${slot}: profile hash drift`);
  }
}

export function validateForwardLocalRuntimeBinding(value: unknown): string[] {
  try {
    requireCondition(isRecord(value), "runtime binding must be an object");
    exactKeys(value, [
      "schema", "localOnly", "qualificationBundleSha256", "roleAssignmentFreezeSha256",
      "instrumentBindingSha256", "reviewConfig", "reviewConfigSha256", "roleProfileBindings",
      "roleProfileBindingsSha256", "executionProfileHash", "routePolicyVersion", "publish",
      "promotion", "deployment", "upload", "apiFallbackAllowed", "bindingSha256",
    ], "runtime binding");
    const runtime = value as unknown as ForwardLocalRuntimeBindingV1;
    requireCondition(runtime.schema === FORWARD_LOCAL_RUNTIME_BINDING_SCHEMA
      || runtime.schema === FORWARD_LOCAL_RUNTIME_BINDING_V2_SCHEMA,
    "runtime binding schema mismatch");
    requireCondition(runtime.localOnly === true, "runtime binding must be local-only");
    for (const [name, field] of Object.entries({
      qualificationBundleSha256: runtime.qualificationBundleSha256,
      roleAssignmentFreezeSha256: runtime.roleAssignmentFreezeSha256,
      instrumentBindingSha256: runtime.instrumentBindingSha256,
      reviewConfigSha256: runtime.reviewConfigSha256,
      roleProfileBindingsSha256: runtime.roleProfileBindingsSha256,
      executionProfileHash: runtime.executionProfileHash,
      bindingSha256: runtime.bindingSha256,
    })) requireSha(field, `runtime binding ${name} must be lowercase sha256`);
    requireCondition(typeof runtime.routePolicyVersion === "string" && runtime.routePolicyVersion.length > 0,
      "runtime binding route policy version is missing");
    requireCondition(runtime.publish === false && runtime.promotion === false && runtime.deployment === false && runtime.upload === false,
      "runtime binding cannot enable an external capability");
    requireCondition(runtime.apiFallbackAllowed === false, "runtime binding cannot enable API fallback");
    requireCondition(hashWithout(value, "bindingSha256") === runtime.bindingSha256, "runtime binding hash drift");
    requireCondition(hashCanonical(runtime.reviewConfig) === runtime.reviewConfigSha256, "runtime review-config hash drift");
    requireCondition(hashCanonical(runtime.roleProfileBindings) === runtime.roleProfileBindingsSha256, "runtime role-profile binding hash drift");
    assertForwardFrozenReviewConfig(runtime.reviewConfig);
    if (runtime.schema === FORWARD_LOCAL_RUNTIME_BINDING_V2_SCHEMA) {
      const reviewConfig = runtime.reviewConfig as BoundForwardFrozenReviewConfigV3;
      requireCondition(reviewConfig.qualificationExperimentId === "s16-forward-role-qualification-v3-envelope"
        && reviewConfig.qualificationResultSha256 === runtime.qualificationBundleSha256,
      "runtime V2 review config is bound to another V3 qualification result");
      requireCondition(reviewConfig.instrumentCertificationSha256 === runtime.instrumentBindingSha256,
        "runtime V2 review config is bound to another instrument certification");
      requireCondition(reviewConfig.reviewProtocolVersion === "imp24-review-v2",
        "runtime V2 review config does not require the envelope protocol");
    } else {
      const reviewConfig = runtime.reviewConfig as BoundForwardFrozenReviewConfigV1;
      requireCondition(reviewConfig.qualificationBundleSha256 === runtime.qualificationBundleSha256,
        "runtime review config is bound to another qualification bundle");
      requireCondition(reviewConfig.instrumentBindingSha256 === runtime.instrumentBindingSha256,
        "runtime review config is bound to another instrument binding");
    }
    requireCondition(runtime.reviewConfig.roleProfileBindingsSha256 === runtime.roleProfileBindingsSha256,
      "runtime review config is bound to another role-profile set");
    requireCondition(runtime.reviewConfig.instrumentManifest.executionProfileHash === runtime.executionProfileHash,
      "runtime execution profile drift");
    requireCondition(runtime.reviewConfig.instrumentManifest.routePolicyVersion === runtime.routePolicyVersion,
      "runtime route policy drift");

    const assignment = runtime.reviewConfig.roleAssignment;
    const slots: Array<[ForwardRoleSlot, "reader" | "source" | "quiz", typeof assignment.readerPrimary]> = [
      ["readerPrimary", "reader", assignment.readerPrimary],
      ["readerAudit", "reader", assignment.readerBackup],
      ["sourcePrimary", "source", assignment.sourcePrimary],
      ["sourceAdjudicator", "source", assignment.sourceAdjudicator],
      ["quizSemanticAdjudicator", "quiz", assignment.quizAdjudicator],
    ];
    for (const [slot, lane, judge] of slots) {
      const roleBinding = runtime.roleProfileBindings?.[slot];
      assertRoleBinding(roleBinding, slot, lane, judge, runtime);
      const expectedSchema = lane === "reader"
        ? runtime.reviewConfig.instrumentManifest.readerSchemaSha256
        : lane === "source"
          ? runtime.reviewConfig.instrumentManifest.sourceSchemaSha256
          : runtime.reviewConfig.instrumentManifest.quizAdjudicationSchemaSha256;
      requireCondition(roleBinding.schemaSha256 === expectedSchema, `${slot}: schema binding drift`);
      if (roleBinding.schema === "imp24-forward-role-profile-binding-v3") {
        requireCondition(roleBinding.productionQualificationParitySha256
            === (runtime.reviewConfig as BoundForwardFrozenReviewConfigV3).productionQualificationParitySha256,
          `${slot}: production/qualification parity binding drift`);
      }
    }
    return [];
  } catch (error) {
    return [(error as Error).message];
  }
}

export function assertForwardLocalRuntimeBinding(value: unknown): asserts value is ForwardLocalRuntimeBindingV1 {
  const errors = validateForwardLocalRuntimeBinding(value);
  if (errors.length > 0) throw new ForwardAuthorRuntimeError(`invalid forward local runtime binding: ${errors.join("; ")}`);
}

/** Build the minimum production runtime projection from the larger qualification
 * freeze. The freeze's own content hash is checked before any field is copied. */
export function buildForwardLocalRuntimeBinding(freeze: ForwardRoleAssignmentFreezeV1): ForwardLocalRuntimeBindingV1 {
  requireCondition(freeze?.schema === "imp22-forward-role-assignment-freeze-v1", "forward role-assignment freeze schema mismatch");
  requireSha(freeze.freezeSha256, "forward role-assignment freeze hash is missing");
  requireCondition(hashWithout(freeze as unknown as Record<string, unknown>, "freezeSha256") === freeze.freezeSha256,
    "forward role-assignment freeze hash drift");
  requireCondition(freeze.reviewConfigSha256 === hashCanonical(freeze.reviewConfig), "forward role-assignment review config drift");
  requireCondition(freeze.roleProfileBindingsSha256 === hashCanonical(freeze.roleProfileBindings), "forward role-profile bindings drift");
  requireCondition(freeze.instrumentBindingSha256 === hashCanonical(freeze.instrumentBinding), "forward instrument binding drift");

  const draft = {
    schema: FORWARD_LOCAL_RUNTIME_BINDING_SCHEMA,
    localOnly: true as const,
    qualificationBundleSha256: freeze.qualificationBundleSha256,
    roleAssignmentFreezeSha256: freeze.freezeSha256,
    instrumentBindingSha256: freeze.instrumentBindingSha256,
    reviewConfig: clone(freeze.reviewConfig),
    reviewConfigSha256: freeze.reviewConfigSha256,
    roleProfileBindings: clone(freeze.roleProfileBindings),
    roleProfileBindingsSha256: freeze.roleProfileBindingsSha256,
    executionProfileHash: freeze.instrumentBinding.executionRoute.executionProfileHash,
    routePolicyVersion: freeze.instrumentBinding.executionRoute.routePolicyVersion,
    publish: false as const,
    promotion: false as const,
    deployment: false as const,
    upload: false as const,
    apiFallbackAllowed: false as const,
  };
  const binding: ForwardLocalRuntimeBindingV1 = { ...draft, bindingSha256: hashCanonical(draft) };
  assertForwardLocalRuntimeBinding(binding);
  return deepFreeze(binding);
}

/** IMP-24 runtime projection. The compatibility field names are retained so
 * the activation resolver has one narrow surface, but the new schema changes
 * their meaning explicitly: qualificationBundleSha256 carries the exact V3
 * result hash and instrumentBindingSha256 carries the model-free certificate. */
export function buildForwardLocalRuntimeBindingV2(
  freeze: ForwardRoleAssignmentFreezeV3,
): ForwardLocalRuntimeBindingV1 {
  requireCondition(freeze?.schema === "imp24-forward-role-assignment-freeze-v3",
    "forward V2 runtime requires the IMP-24 role-assignment freeze");
  requireSha(freeze.freezeSha256, "forward V3 role-assignment freeze hash is missing");
  requireCondition(hashWithout(freeze as unknown as Record<string, unknown>, "freezeSha256") === freeze.freezeSha256,
    "forward V3 role-assignment freeze hash drift");
  requireCondition(freeze.reviewConfigSha256 === hashCanonical(freeze.reviewConfig),
    "forward V3 role-assignment review config drift");
  requireCondition(freeze.roleProfileBindingsSha256 === hashCanonical(freeze.roleProfileBindings),
    "forward V3 role-profile bindings drift");
  requireCondition(freeze.instrumentCertificationSha256 === freeze.instrumentCertification.certificationSha256,
    "forward V3 instrument certification drift");

  const draft = {
    schema: FORWARD_LOCAL_RUNTIME_BINDING_V2_SCHEMA,
    localOnly: true as const,
    qualificationBundleSha256: freeze.qualificationResultSha256,
    roleAssignmentFreezeSha256: freeze.freezeSha256,
    instrumentBindingSha256: freeze.instrumentCertificationSha256,
    reviewConfig: clone(freeze.reviewConfig),
    reviewConfigSha256: freeze.reviewConfigSha256,
    roleProfileBindings: clone(freeze.roleProfileBindings),
    roleProfileBindingsSha256: freeze.roleProfileBindingsSha256,
    executionProfileHash: freeze.routeBinding.executionProfileHash,
    routePolicyVersion: freeze.routeBinding.routePolicyVersion,
    publish: false as const,
    promotion: false as const,
    deployment: false as const,
    upload: false as const,
    apiFallbackAllowed: false as const,
  };
  const binding: ForwardLocalRuntimeBindingV1 = { ...draft, bindingSha256: hashCanonical(draft) };
  assertForwardLocalRuntimeBinding(binding);
  return deepFreeze(binding);
}

export function serializeForwardLocalRuntimeBinding(binding: ForwardLocalRuntimeBindingV1): string {
  assertForwardLocalRuntimeBinding(binding);
  return `${JSON.stringify(binding, null, 2)}\n`;
}

export function parseForwardLocalRuntimeBinding(text: string): ForwardLocalRuntimeBindingV1 {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch (error) {
    throw new ForwardAuthorRuntimeError(`forward local runtime binding is not JSON: ${(error as Error).message}`);
  }
  assertForwardLocalRuntimeBinding(value);
  return deepFreeze(value);
}

export function fixedReviewersFromRuntimeBinding(binding: ForwardLocalRuntimeBindingV1): FixedReviewerProfilesV1 {
  assertForwardLocalRuntimeBinding(binding);
  const assignment = binding.reviewConfig.roleAssignment;
  const profile = (judge: { profileId: string; model: string; effort: QualifiedReviewerProfileV1["effort"] }, slot: ForwardRoleSlot): QualifiedReviewerProfileV1 => {
    const roleBinding = binding.roleProfileBindings[slot];
    return {
      profileId: judge.profileId,
      model: judge.model,
      effort: judge.effort,
      qualificationHash: roleBinding.schema === "imp24-forward-role-profile-binding-v3"
        ? roleBinding.profileRoleResultSha256
        : roleBinding.qualificationRecordSha256,
    };
  };
  return {
    readerPrimary: profile(assignment.readerPrimary, "readerPrimary"),
    readerBackup: profile(assignment.readerBackup, "readerAudit"),
    sourcePrimary: profile(assignment.sourcePrimary, "sourcePrimary"),
    sourceAdjudicator: profile(assignment.sourceAdjudicator, "sourceAdjudicator"),
    quizAdjudicator: profile(assignment.quizAdjudicator, "quizSemanticAdjudicator"),
    quizChecker: clone(assignment.quizChecker),
  };
}

function requireActiveCurrentEvidence(
  input: ResolveForwardLocalRuntimeInputV1,
  policy: Extract<ForwardActivationPolicyV1, { status: "ACTIVE" }>,
  binding: ForwardLocalRuntimeBindingV1,
): void {
  requireCondition(input.currentEvidence !== undefined, "ACTIVE policy requires current qualification, pilot, and gold evidence hashes");
  requireCondition(input.currentNoApiRoute !== undefined, "ACTIVE policy requires a current no-API route proof");
  requireSha(input.currentInstrumentBindingSha256, "ACTIVE policy requires the current instrument-binding hash");
  requireSha(input.currentReviewConfigSha256, "ACTIVE policy requires the current review-config hash");
  requireSha(input.currentRoleAssignmentFreezeSha256, "ACTIVE policy requires the current role-assignment-freeze hash");

  requireCondition(canonicalJson(policy.criteria.evidence) === canonicalJson(input.currentEvidence),
    "ACTIVE policy evidence is stale against current qualification/pilot/gold evidence");
  requireCondition(policy.criteria.evidence.qualificationEvidenceHash === binding.qualificationBundleSha256,
    "ACTIVE policy qualification evidence is not the bound qualification bundle");
  requireCondition(binding.instrumentBindingSha256 === input.currentInstrumentBindingSha256,
    "ACTIVE policy instrument binding is stale");
  requireCondition(binding.reviewConfigSha256 === input.currentReviewConfigSha256,
    "ACTIVE policy review config is stale");
  requireCondition(binding.roleAssignmentFreezeSha256 === input.currentRoleAssignmentFreezeSha256,
    "ACTIVE policy role-assignment freeze is stale");
  requireCondition(policy.noApiRoute.routePolicyVersion === ROUTE_POLICY_VERSION,
    "ACTIVE policy route-policy version is stale against the central policy");
  requireCondition(binding.routePolicyVersion === policy.noApiRoute.routePolicyVersion,
    "ACTIVE policy route version is stale against the review binding");
  requireCondition(binding.executionProfileHash === policy.noApiRoute.executionProfileHash,
    "ACTIVE policy execution profile is stale against the review binding");
  requireCondition(canonicalJson(policy.noApiRoute) === canonicalJson(input.currentNoApiRoute),
    "ACTIVE policy no-API route proof is stale");

  const expectedReviewers = fixedReviewersFromRuntimeBinding(binding);
  requireCondition(canonicalJson(policy.activatedProfile.reviewers) === canonicalJson(expectedReviewers),
    "ACTIVE policy fixed reviewer stack is stale against the qualified role freeze");
  requireCondition(policy.criteria.frozenRoleAssignmentHash === fixedReviewerProfilesHash(expectedReviewers),
    "ACTIVE policy fixed reviewer assignment hash is stale");
}

/** Resolve once at the local process boundary. No policy is a deliberate
 * baseline result; malformed ACTIVE state is never silently downgraded. */
export function resolveForwardLocalRuntime(input: ResolveForwardLocalRuntimeInputV1): ResolvedForwardLocalRuntimeV1 {
  if (input.activationPolicyText === null) {
    return deepFreeze({
      schema: FORWARD_LOCAL_RUNTIME_SCHEMA,
      mode: "BASELINE",
      reason: "NO_POLICY",
      policy: null,
      binding: null,
      externalCapabilities: FORWARD_LOCAL_EXTERNAL_CAPABILITIES,
    });
  }

  let policy: ForwardActivationPolicyV1;
  try {
    policy = parseForwardActivationPolicy(input.activationPolicyText);
  } catch (error) {
    if (error instanceof ForwardActivationError) throw new ForwardAuthorRuntimeError(error.message);
    throw error;
  }
  if (policy.status === "ROLLED_BACK") {
    return deepFreeze({
      schema: FORWARD_LOCAL_RUNTIME_SCHEMA,
      mode: "BASELINE",
      reason: "ROLLED_BACK",
      policy: clone(policy),
      binding: null,
      externalCapabilities: FORWARD_LOCAL_EXTERNAL_CAPABILITIES,
    });
  }

  requireCondition(typeof input.runtimeBindingText === "string" && input.runtimeBindingText.length > 0,
    "ACTIVE policy requires an explicit local runtime binding");
  const binding = parseForwardLocalRuntimeBinding(input.runtimeBindingText);
  requireActiveCurrentEvidence(input, policy, binding);
  const runtimeCore = {
    schema: FORWARD_LOCAL_RUNTIME_SCHEMA,
    mode: "FORWARD_ACTIVE" as const,
    reason: "ACTIVE_POLICY_VALIDATED" as const,
    activationPolicySha256: hashCanonical(policy),
    runtimeBindingSha256: binding.bindingSha256,
    externalCapabilities: FORWARD_LOCAL_EXTERNAL_CAPABILITIES,
  };
  return deepFreeze({
    schema: FORWARD_LOCAL_RUNTIME_SCHEMA,
    mode: "FORWARD_ACTIVE",
    reason: "ACTIVE_POLICY_VALIDATED",
    policy: clone(policy) as Extract<ForwardActivationPolicyV1, { status: "ACTIVE" }>,
    binding,
    externalCapabilities: FORWARD_LOCAL_EXTERNAL_CAPABILITIES,
    runtimeSha256: hashCanonical(runtimeCore),
  });
}

function resolvedWriterRoute(
  runtime: ResolvedForwardLocalRuntimeV1,
  riskPolicy: ForwardAuthoringRiskDecisionV1,
): ForwardLocalWriterRouteV1 {
  if (runtime.policy !== null) {
    return { ...resolveForwardWriterRoute(runtime.policy, riskPolicy.riskClass), riskPolicy };
  }
  const baseline = resolveRoute({ role: "author-writer" });
  return {
    profileId: NORMAL_PROFILE,
    riskClass: riskPolicy.riskClass,
    model: baseline.model,
    effort: baseline.effort,
    source: "central-model-policy",
    riskPolicy,
  };
}

function isPending(result: AuthorWriteOneResult): result is Extract<AuthorWriteOneResult, { ok: true; committed: false }> {
  return result.ok === true && "committed" in result && result.committed === false && "pending" in result;
}

function isCommittedPass(result: ForwardChapterConductorResultV1 | null): boolean {
  return result?.disposition === "COMMITTED"
    && result.finalStatus === "PASS"
    && result.commitResult?.ok === true
    && "committed" in result.commitResult
    && result.commitResult.committed === true;
}

function correctionEvidence(result: ForwardChapterConductorResultV1): {
  complaints: string[];
  scopes: RepairScope[];
  route: "repair" | "regeneration";
} {
  const complaints = [
    ...(result.reader?.blockingFindings ?? []).map((finding) => `${finding.unit}: ${finding.problem}`),
    ...(result.reader?.advisoryFindings ?? []).map((finding) => `${finding.unit}: ${finding.problem}`),
    ...(result.source?.units ?? []).flatMap((unit) => unit.findings
      .filter((finding) => finding.severity === "blocker" || finding.severity === "major")
      .map((finding) => `source ${unit.unitId} ${finding.category}: ${finding.explanation}`)),
    ...(result.quiz?.questions ?? []).filter((question) => !question.keyCorrect || !question.uniqueAnswer || !question.mechanismSupported)
      .map((question, index) => `quiz question ${index + 1}: key/uniqueness/mechanism adjudication failed`),
  ].filter((line, index, all) => line.trim().length > 0 && all.indexOf(line) === index);
  if (complaints.length === 0) complaints.push(result.reason || `forward review returned ${result.finalStatus}`);
  const scopes: RepairScope[] = [];
  let patchable = result.finalStatus === "REVISE";
  for (const complaint of complaints) {
    const scope = deriveComplaintScope(complaint);
    if (scope === null || scope === "VETO") { patchable = false; continue; }
    if (!scopes.includes(scope)) scopes.push(scope);
  }
  return { complaints, scopes, route: patchable && scopes.length > 0 ? "repair" : "regeneration" };
}

async function reviewPreparedCandidate(args: {
  prepared: PreparedAuthorCandidate;
  runtime: ForwardActiveRuntimeV1;
  loadReviewEvidence: NonNullable<RunLocalAuthoringChapterInputV1["loadReviewEvidence"]>;
  reviewerExecutor: ForwardReviewerExecutor;
  authorDeps: AutopilotDeps;
  conductReview: typeof runForwardChapterConductor;
  persistCommittedResult?: RunLocalAuthoringChapterInputV1["persistCommittedResult"];
}): Promise<ForwardChapterConductorResultV1> {
  const evidence = await args.loadReviewEvidence(args.prepared);
  return args.conductReview({
    prepared: args.prepared,
    sourcePacket: evidence.sourcePacket,
    sourceSidecar: evidence.sourceSidecar,
    anchorCatalog: evidence.anchorCatalog,
    rereadAuthoritativeSourceEvidence: evidence.rereadAuthoritativeSourceEvidence,
    frozen: args.runtime.binding.reviewConfig,
  }, {
    executor: args.reviewerExecutor,
    log: args.authorDeps.log,
    ...(args.persistCommittedResult ? {
      persistCommittedResult: (result) => args.persistCommittedResult!({
        bookId: args.prepared.bookId,
        chapterNumber: args.prepared.chapterNumber,
        result,
      }),
    } : {}),
  });
}

/**
 * The chapter-level normal future-authoring entrypoint. ACTIVE cannot call the
 * old direct-commit writer path: deferCommit is forced true and only the real
 * forward conductor receives the pending candidate. Baseline/rollback force an
 * explicit writer route and never require a reviewer executor.
 */
export async function runLocalAuthoringChapter(
  input: RunLocalAuthoringChapterInputV1,
  deps: RunLocalAuthoringChapterDepsV1 = {},
): Promise<LocalAuthoringChapterResultV1> {
  requireCondition(input.runtime?.schema === FORWARD_LOCAL_RUNTIME_SCHEMA, "local authoring runtime was not resolved");
  requireCondition(Number.isSafeInteger(input.chapterNumber) && input.chapterNumber > 0, "chapterNumber must be a positive integer");
  const riskPolicy = classifyForwardAuthoringRisk(input.riskSignals);
  const route = resolvedWriterRoute(input.runtime, riskPolicy);
  const writeCandidate = deps.writeCandidate ?? authorWriteOneChapter;
  const conductReview = deps.conductReview ?? runForwardChapterConductor;
  let loadReviewEvidence: RunLocalAuthoringChapterInputV1["loadReviewEvidence"];
  let reviewerExecutor: ForwardReviewerExecutor | undefined;
  if (input.runtime.mode === "FORWARD_ACTIVE") {
    requireCondition(typeof input.loadReviewEvidence === "function", "ACTIVE authoring requires an authoritative review-evidence loader");
    requireCondition(typeof input.reviewerExecutor === "function", "ACTIVE authoring requires the explicit fixed-lane reviewer executor");
    assertForwardLocalRuntimeBinding(input.runtime.binding);
    loadReviewEvidence = input.loadReviewEvidence;
    reviewerExecutor = input.reviewerExecutor;
  }
  const writeResult = await writeCandidate(input.bookId, input.chapterNumber, input.authorDeps, {
    ...(input.authorOptions ?? {}),
    model: route.model,
    effort: route.effort,
    deferCommit: input.runtime.mode === "FORWARD_ACTIVE",
  });

  if (input.runtime.mode === "BASELINE") {
    requireCondition(!isPending(writeResult), "baseline writer unexpectedly returned an uncommitted candidate");
    return {
      mode: "BASELINE",
      route,
      writeResult,
      reviewResult: null,
      externalCapabilities: FORWARD_LOCAL_EXTERNAL_CAPABILITIES,
    };
  }

  if (!writeResult.ok) {
    return {
      mode: "FORWARD_ACTIVE",
      status: "WRITE_FAILED",
      route,
      writeResult,
      reviewResult: null,
      externalCapabilities: FORWARD_LOCAL_EXTERNAL_CAPABILITIES,
    };
  }
  requireCondition(isPending(writeResult), "ACTIVE writer crossed the direct-commit boundary; refusing to continue");
  requireCondition(typeof loadReviewEvidence === "function" && typeof reviewerExecutor === "function",
    "ACTIVE review dependencies became unavailable after writer preparation");
  const reviewResult = await reviewPreparedCandidate({
    prepared: writeResult.pending,
    runtime: input.runtime,
    loadReviewEvidence,
    reviewerExecutor,
    authorDeps: input.authorDeps,
    conductReview,
    persistCommittedResult: input.persistCommittedResult,
  });
  return {
    mode: "FORWARD_ACTIVE",
    status: "REVIEWED",
    route,
    writeResult,
    reviewResult,
    externalCapabilities: FORWARD_LOCAL_EXTERNAL_CAPABILITIES,
  };
}

/**
 * Adapt the central chapter runtime to doAuthorWrite's book-level seam. This is
 * the only adapter the normal author phase needs: absent/rollback returns the
 * baseline writer result, while ACTIVE returns success only when the split-lane
 * conductor actually committed a fresh PASS.
 */
export function createForwardAuthorChapterWriter(
  config: CreateForwardAuthorChapterWriterInputV1,
  deps: RunLocalAuthoringChapterDepsV1 = {},
): AuthorWriteOneInvoker {
  requireCondition(config?.runtime?.schema === FORWARD_LOCAL_RUNTIME_SCHEMA, "forward book writer requires a resolved local runtime");
  requireCondition(typeof config.riskSignalsFor === "function", "forward book writer requires a pre-authoring risk provider");
  if (config.runtime.mode === "FORWARD_ACTIVE") {
    requireCondition(typeof config.loadReviewEvidence === "function", "forward book writer requires an authoritative review-evidence loader");
    requireCondition(typeof config.reviewerExecutor === "function", "forward book writer requires the fixed-lane reviewer executor");
  }
  return async (bookId, chapterNumber, authorDeps, authorOptions) => {
    const outcome = await runLocalAuthoringChapter({
      runtime: config.runtime,
      bookId,
      chapterNumber,
      riskSignals: config.riskSignalsFor({ bookId, chapterNumber }),
      authorDeps,
      authorOptions,
      loadReviewEvidence: config.loadReviewEvidence,
      reviewerExecutor: config.reviewerExecutor,
      persistCommittedResult: config.retainCommittedResult,
    }, deps);
    if (outcome.mode === "BASELINE" || outcome.status === "WRITE_FAILED") return outcome.writeResult;
    let reviewed = outcome.reviewResult;
    if (isCommittedPass(reviewed)) {
      return reviewed!.commitResult!;
    }

    // Phase-4 correction budget: at most one typed repair and, only when that
    // route proves wrong/whole-chapter, one full regeneration. Every candidate
    // is deferred and must pass the same fixed split-lane conductor.
    if (reviewed?.finalStatus === "REVISE") {
      const firstPrepared = isPending(outcome.writeResult) ? outcome.writeResult.pending : null;
      const correction = correctionEvidence(reviewed);
      let correctionKind: "repair" | "regeneration" = correction.route;
      let correctedWrite: AuthorWriteOneResult | null = null;
      if (correctionKind === "repair" && firstPrepared && deps.prepareTypedRepair) {
        const repairProduction = await deps.prepareTypedRepair({
          prepared: firstPrepared,
          reviewResult: reviewed,
          complaints: correction.complaints,
          scopes: correction.scopes,
          route: outcome.route,
          authorDeps,
        });
        correctedWrite = repairProduction;
        if (!repairProduction.ok) {
          if (repairProduction.failureDisposition === "WRONG_ROUTE" || repairProduction.failureDisposition === "WHOLE_CHAPTER_FAILURE") {
            correctionKind = "regeneration";
          } else {
            return { ok: false, reason: repairProduction.reason };
          }
        }
      } else {
        correctionKind = "regeneration";
      }

      const reviewCorrection = async (write: AuthorWriteOneResult): Promise<ForwardChapterConductorResultV1 | null> => {
        if (!isPending(write)) return null;
        return reviewPreparedCandidate({
          prepared: write.pending,
          runtime: config.runtime as ForwardActiveRuntimeV1,
          loadReviewEvidence: config.loadReviewEvidence!,
          reviewerExecutor: config.reviewerExecutor!,
          authorDeps,
          conductReview: deps.conductReview ?? runForwardChapterConductor,
          persistCommittedResult: config.retainCommittedResult,
        });
      };

      if (correctionKind === "repair" && correctedWrite?.ok) {
        reviewed = await reviewCorrection(correctedWrite);
        if (isCommittedPass(reviewed)) {
          return reviewed!.commitResult!;
        }
        // Only an independently observed whole-chapter/wrong-route result may
        // spend the regeneration slot; a still-patchable failure stops here.
        if (!reviewed || reviewed.finalStatus !== "REVISE" || correctionEvidence(reviewed).route !== "regeneration") {
          return { ok: false, reason: reviewed?.reason ?? "bounded forward typed repair did not return a committed PASS" };
        }
        correctionKind = "regeneration";
      }

      if (correctionKind === "regeneration") {
        correctedWrite = await (deps.writeCandidate ?? authorWriteOneChapter)(bookId, chapterNumber, authorDeps, {
          ...(authorOptions ?? {}),
          complaints: correction.complaints,
          firstWriteOnly: true,
          model: outcome.route.model,
          effort: outcome.route.effort,
          deferCommit: true,
        });
        reviewed = await reviewCorrection(correctedWrite);
        if (isCommittedPass(reviewed)) {
          return reviewed!.commitResult!;
        }
      }
    }
    return {
      ok: false,
      reason: reviewed?.reason ?? "forward split-lane review did not return a committed PASS",
    };
  };
}
