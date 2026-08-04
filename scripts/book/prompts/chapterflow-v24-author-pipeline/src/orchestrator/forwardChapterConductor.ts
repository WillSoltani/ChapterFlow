/**
 * forwardChapterConductor — IMP-22 forward-only split-lane chapter acceptance.
 *
 * A PreparedAuthorCandidate remains inside its isolated attempt workspace while
 * this conductor runs the reader, source, and two-phase quiz lanes.  The only
 * canonical-state capability imported here is commitPreparedAuthorCandidate,
 * and it is invoked only after a fresh deterministic aggregate returns PASS.
 * Every other terminal path supersedes the pending attempt for forensics.
 *
 * Reviewer execution is injected.  This module has no model/provider fallback.
 * Before every execution it re-verifies the frozen role assignment, instrument
 * manifest, candidate bytes, and source lineage.  It then verifies the executor's
 * returned route receipt before allowing the output into a lane parser.
 */

import type { SourcePacketV1 } from "../artifacts/artifactTypes.js";
import { sourcePacketHash } from "../compiler/sourcePacket.js";
import { sourceUsePlanStale } from "../compiler/sourceUsePlanCompiler.js";
import { aggregateIsFresh, validateAggregatedChapterReview, type AggregatedChapterReviewV1 } from "../contracts/aggregateChapterReview.js";
import { hashCanonical, sha256Hex } from "../contracts/contractUtil.js";
import type { QuizIntegrityResultV1 } from "../contracts/quizIntegrityReview.js";
import type { ReaderExperienceReviewV1 } from "../contracts/readerExperienceReview.js";
import type { SourceIntegrityReviewV1 } from "../contracts/sourceIntegrityReview.js";
import { sourceUsePlanHash } from "../contracts/sourceUsePlan.js";
import { chapterContentHash } from "../critics/qcAttestation.js";
import { ensureTrailingNewline } from "../lib/atomicWrite.js";
import { semanticSourceHash } from "../source/sourceIntegrity.js";
import type { SourceAnchorForPrompt } from "../types.js";
import {
  FIXED_ROLE_ASSIGNMENT_SCHEMA,
  SPLIT_LANE_INSTRUMENT_MANIFEST_SCHEMA,
  type FixedRoleAssignmentV1,
  type RoleJudgeRefV1,
  type SplitLaneInstrumentManifestV1,
} from "../bakeoff/migration/reviewLaneTypes.js";
import { aggregateChapterReview, computeReaderComposite } from "../review/aggregateChapterReview.js";
import {
  QUIZ_INTEGRITY_ADJUDICATION_SCHEMA,
  buildQuizIntegrityAdjudicationTask,
  runQuizIntegrityLane,
} from "../review/quizIntegrityReview.js";
import {
  buildQuizDerivation,
  commitQuizDerivation,
  quizItemId,
  renderQuizPhase2Doc,
  type CommittedQuizDerivation,
} from "../review/quizDerivation.js";
import {
  READER_EXPERIENCE_RUBRIC_VERSION,
  readerExperienceDocHash,
  runReaderExperienceReview,
} from "../review/readerExperienceReview.js";
import { renderChapterReaderDocPhase1 } from "../review/renderReaderDoc.js";
import {
  SOURCE_INTEGRITY_RUBRIC_VERSION,
  assembleSourceReviewPacket,
  buildSourceIntegrityTask,
  computeRequiredSourceUnitIds,
  parseSourceIntegrityReview,
  runSourceIntegrityReview,
} from "../review/sourceIntegrityReview.js";
import { validateSourceIntegrityReview } from "../contracts/sourceIntegrityReview.js";
import {
  commitPreparedAuthorCandidate,
  readPreparedAuthorCompilerInputs,
  type AuthorWriteOneResult,
  type CommitPreparedAuthorCandidateDeps,
  type PreparedAuthorCandidate,
} from "./authorRun.js";
import { finalizeAttempt } from "./chapterTransaction.js";
import {
  assertForwardAssignmentIndependence,
  isInForwardReaderAuditSubset,
  validateForwardPanelReviewPolicy,
  type ForwardPanelReviewPolicyV1,
} from "./forwardReviewPolicy.js";

export const FORWARD_CHAPTER_CONDUCTOR_SCHEMA = "forward-chapter-conductor-result-v1" as const;
export const FORWARD_REVIEW_EXECUTION_REQUEST_SCHEMA = "forward-review-execution-request-v1" as const;
export const FORWARD_REVIEW_EXECUTION_RESULT_SCHEMA = "forward-review-execution-result-v1" as const;
export const FORWARD_REVIEW_ENVELOPE_SCHEMA = "forward-review-execution-envelope-v1" as const;
export const FORWARD_FROZEN_REVIEW_CONFIG_SCHEMA = "forward-frozen-review-config-v1" as const;

const AGGREGATION_VERSION = "aggregated-chapter-review-v1" as const;

export type ForwardReviewLane = "reader" | "source" | "quiz";
export type ForwardReviewerWorkspaceRole = "direct-reader" | "source-verifier" | "quiz-adjudication";

export type ForwardFrozenReviewConfigV1 = {
  schema: typeof FORWARD_FROZEN_REVIEW_CONFIG_SCHEMA;
  roleAssignment: FixedRoleAssignmentV1;
  roleAssignmentSha256: string;
  instrumentManifest: SplitLaneInstrumentManifestV1;
  instrumentManifestSha256: string;
  readerBar: number;
  /** Optional only for legacy fixtures. IMP-22 role-freeze output always carries
   * this exact, hash-bound panel policy and therefore activates backup reads. */
  panelPolicy?: ForwardPanelReviewPolicyV1;
  panelPolicySha256?: string;
};

export type ForwardPanelRole =
  | "readerPrimary"
  | "readerAudit"
  | "sourcePrimary"
  | "sourceAdjudicator"
  | "quizSemanticAdjudicator";

export type ForwardReviewArtifactV1 = {
  kind: "phase1-doc" | "source-evidence" | "source-plan" | "phase2-doc";
  relPath: string;
  content: string;
  sha256: string;
};

export type ForwardReviewExecutionRequestV1 = {
  schema: typeof FORWARD_REVIEW_EXECUTION_REQUEST_SCHEMA;
  lane: ForwardReviewLane;
  workspaceRole: ForwardReviewerWorkspaceRole;
  profileId: string;
  model: string;
  effort: RoleJudgeRefV1["effort"];
  schemaSha256: string;
  instrumentVersion: string;
  roleAssignmentSha256: string;
  instrumentManifestSha256: string;
  executionProfileHash: string;
  routePolicyVersion: string;
  task: string;
  artifacts: readonly ForwardReviewArtifactV1[];
};

/** The executor must return the route it actually used.  The conductor accepts
 * output only when every field is byte-for-byte equal to the frozen request. */
export type ForwardReviewExecutionResultV1 = {
  schema: typeof FORWARD_REVIEW_EXECUTION_RESULT_SCHEMA;
  executionId: string;
  lane: ForwardReviewLane;
  workspaceRole: ForwardReviewerWorkspaceRole;
  profileId: string;
  model: string;
  effort: RoleJudgeRefV1["effort"];
  schemaSha256: string;
  instrumentVersion: string;
  roleAssignmentSha256: string;
  instrumentManifestSha256: string;
  executionProfileHash: string;
  routePolicyVersion: string;
  output: string;
};

export type ForwardReviewerExecutor = (
  request: ForwardReviewExecutionRequestV1,
) => Promise<ForwardReviewExecutionResultV1>;

type ReceiptProjection = Omit<ForwardReviewExecutionResultV1, "output">;

export type ForwardReviewExecutionEntryV1 = {
  lane: ForwardReviewLane;
  panelRole?: ForwardPanelRole;
  roleProfileSha256?: string;
  expected: Omit<ForwardReviewExecutionRequestV1, "task" | "artifacts">;
  taskSha256: string;
  artifactHashes: Array<{ kind: ForwardReviewArtifactV1["kind"]; relPath: string; sha256: string }>;
  status: "REQUESTED" | "VERIFIED" | "REJECTED";
  received: ReceiptProjection | null;
  outputSha256: string | null;
  failureReason: string | null;
};

export type ForwardReviewExecutionEnvelopeV1 = {
  schema: typeof FORWARD_REVIEW_ENVELOPE_SCHEMA;
  attemptId: string;
  candidateContentSha256: string;
  candidateBytesSha256: string;
  sourceUsePlanSha256: string;
  sourcePacketSha256: string;
  sidecarSha256: string;
  anchorCatalogSha256: string;
  frozenReviewConfigSha256: string;
  roleAssignmentSha256: string;
  instrumentManifestSha256: string;
  panelPolicySha256?: string | null;
  executions: ForwardReviewExecutionEntryV1[];
  derivationSha256: string | null;
  deterministicCriticBundleSha256: string | null;
  readerResultSha256: string | null;
  readerPrimaryCategory?: ForwardReaderDecisionCategory | null;
  readerAuditSelected?: boolean;
  readerAuditProfileId?: string | null;
  readerAuditResultSha256?: string | null;
  readerAuditCategory?: ForwardReaderDecisionCategory | null;
  readerAuditDisagreement?: boolean;
  sourceResultSha256: string | null;
  sourceAdjudicationTriggered?: boolean;
  sourceAdjudicatorProfileId?: string | null;
  sourceAdjudicatorResultSha256?: string | null;
  sourceAdjudicationAgreement?: boolean | null;
  quizResultSha256: string | null;
  aggregateSha256: string | null;
  panelAdjustmentReasons?: string[];
  finalStatus: AggregatedChapterReviewV1["finalStatus"];
  disposition: "COMMITTED" | "SUPERSEDED" | "COMMIT_FAILED";
  failureReason: string | null;
};

export type ForwardChapterConductorResultV1 = {
  schema: typeof FORWARD_CHAPTER_CONDUCTOR_SCHEMA;
  disposition: ForwardReviewExecutionEnvelopeV1["disposition"];
  finalStatus: AggregatedChapterReviewV1["finalStatus"];
  reason: string;
  reader: ReaderExperienceReviewV1 | null;
  readerAudit?: ReaderExperienceReviewV1 | null;
  source: SourceIntegrityReviewV1 | null;
  sourceAdjudication?: SourceIntegrityReviewV1 | null;
  quiz: QuizIntegrityResultV1 | null;
  aggregate: AggregatedChapterReviewV1 | null;
  committedDerivation: CommittedQuizDerivation | null;
  commitResult: AuthorWriteOneResult | null;
  executionEnvelope: Readonly<ForwardReviewExecutionEnvelopeV1>;
  executionEnvelopeSha256: string;
};

export type ForwardChapterConductorInputV1 = {
  prepared: PreparedAuthorCandidate;
  sourcePacket: SourcePacketV1;
  sourceSidecar: unknown;
  anchorCatalog: SourceAnchorForPrompt[];
  /** Authoritative archive re-read. In-memory object rehashing cannot detect a
   * sidecar/anchor file replaced while split-lane review is running, so the
   * conductor invokes this at preflight and immediately before commit. */
  rereadAuthoritativeSourceEvidence: () => Promise<{
    sourceSidecar: unknown;
    anchorCatalog: SourceAnchorForPrompt[];
  }> | {
    sourceSidecar: unknown;
    anchorCatalog: SourceAnchorForPrompt[];
  };
  frozen: ForwardFrozenReviewConfigV1;
};

export type ForwardChapterConductorDeps = {
  executor: ForwardReviewerExecutor;
  commitPreparedCandidate?: (
    prepared: PreparedAuthorCandidate,
    deps: CommitPreparedAuthorCandidateDeps,
  ) => AuthorWriteOneResult;
  /** Required by the standard ACTIVE path. The default commit helper invokes
   * this inside its canonical required-evidence bracket and rolls back both
   * chapter/provenance and this artifact if persistence/finalization fails. */
  persistCommittedResult?: (result: ForwardChapterConductorResultV1) => void | (() => void);
  finalizePendingAttempt?: typeof finalizeAttempt;
  log?: (line: string) => void;
};

export class ForwardChapterConductorError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ForwardChapterConductorError";
  }
}

type BoundHashes = {
  candidateContentSha256: string;
  candidateBytesSha256: string;
  candidateObjectSha256: string;
  sourceUsePlanSha256: string;
  sourcePacketSha256: string;
  sidecarSha256: string;
  anchorCatalogSha256: string;
  frozenReviewConfigSha256: string;
};

type LaneBinding = {
  workspaceRole: ForwardReviewerWorkspaceRole;
  profile: RoleJudgeRefV1;
  schemaSha256: string;
  instrumentVersion: string;
};

export type ForwardReaderDecisionCategory = "PASS" | "REVISE" | "BLOCK";

type PanelReviewState = {
  readerAuditSelected: boolean;
  readerPrimaryCategory: ForwardReaderDecisionCategory | null;
  readerAudit: ReaderExperienceReviewV1 | null;
  readerAuditCategory: ForwardReaderDecisionCategory | null;
  readerAuditDisagreement: boolean;
  sourceAdjudicationTriggered: boolean;
  sourceAdjudication: SourceIntegrityReviewV1 | null;
  sourceAdjudicationAgreement: boolean | null;
  adjustmentReasons: string[];
};

function requireCondition(condition: unknown, message: string): asserts condition {
  if (!condition) throw new ForwardChapterConductorError(message);
}

function nonEmpty(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function assertJudge(label: string, judge: RoleJudgeRefV1): void {
  requireCondition(judge && typeof judge === "object", `${label}: missing frozen judge`);
  requireCondition(nonEmpty(judge.profileId), `${label}: empty profileId`);
  requireCondition(nonEmpty(judge.model), `${label}: empty model`);
  requireCondition(!judge.profileId.startsWith("pending-") && judge.model !== "pending", `${label}: pending/unqualified judge cannot execute`);
  requireCondition(["minimal", "low", "medium", "high", "xhigh"].includes(judge.effort), `${label}: invalid effort ${String(judge.effort)}`);
}

/** Recomputed immediately before every reviewer execution and again before
 * commit.  Mutation of either frozen object invalidates the run in place. */
function assertFrozenConfig(frozen: ForwardFrozenReviewConfigV1): void {
  requireCondition(frozen?.schema === FORWARD_FROZEN_REVIEW_CONFIG_SCHEMA, "forward review: wrong frozen-config schema");
  requireCondition(frozen.roleAssignment?.schema === FIXED_ROLE_ASSIGNMENT_SCHEMA, "forward review: wrong role-assignment schema");
  requireCondition(hashCanonical(frozen.roleAssignment) === frozen.roleAssignmentSha256, "forward review: stale/tampered role-assignment hash");
  requireCondition(frozen.instrumentManifest?.schema === SPLIT_LANE_INSTRUMENT_MANIFEST_SCHEMA, "forward review: wrong instrument-manifest schema");
  requireCondition(hashCanonical(frozen.instrumentManifest) === frozen.instrumentManifestSha256, "forward review: stale/tampered instrument-manifest hash");
  requireCondition(frozen.instrumentManifest.fixedRoleAssignmentSha256 === frozen.roleAssignmentSha256, "forward review: instrument manifest is bound to a different role assignment");
  requireCondition(frozen.instrumentManifest.readerRubricVersion === READER_EXPERIENCE_RUBRIC_VERSION, "forward review: stale reader instrument version");
  requireCondition(frozen.instrumentManifest.sourceRubricVersion === SOURCE_INTEGRITY_RUBRIC_VERSION, "forward review: stale source instrument version");
  requireCondition(frozen.instrumentManifest.quizPhase2Version === QUIZ_INTEGRITY_ADJUDICATION_SCHEMA, "forward review: stale quiz adjudication instrument version");
  requireCondition(frozen.instrumentManifest.aggregationVersion === AGGREGATION_VERSION, "forward review: stale aggregation version");
  for (const [name, value] of Object.entries({
    readerSchemaSha256: frozen.instrumentManifest.readerSchemaSha256,
    sourceSchemaSha256: frozen.instrumentManifest.sourceSchemaSha256,
    quizAdjudicationSchemaSha256: frozen.instrumentManifest.quizAdjudicationSchemaSha256,
    executionProfileHash: frozen.instrumentManifest.executionProfileHash,
    routePolicyVersion: frozen.instrumentManifest.routePolicyVersion,
  })) {
    requireCondition(nonEmpty(value), `forward review: empty frozen ${name}`);
  }
  requireCondition(Number.isFinite(frozen.readerBar) && frozen.readerBar >= 0 && frozen.readerBar <= 100, "forward review: readerBar must be in [0,100]");
  assertJudge("readerPrimary", frozen.roleAssignment.readerPrimary);
  assertJudge("sourcePrimary", frozen.roleAssignment.sourcePrimary);
  assertJudge("quizAdjudicator", frozen.roleAssignment.quizAdjudicator);
  const hasPanelPolicy = frozen.panelPolicy !== undefined || frozen.panelPolicySha256 !== undefined;
  if (hasPanelPolicy) {
    requireCondition(frozen.panelPolicy !== undefined && frozen.panelPolicySha256 !== undefined, "forward review: incomplete panel-policy binding");
    try {
      validateForwardPanelReviewPolicy(frozen.panelPolicy);
      assertForwardAssignmentIndependence(frozen.roleAssignment, frozen.panelPolicy.disagreement);
    } catch (error) {
      throw new ForwardChapterConductorError(`forward review: invalid panel policy (${(error as Error).message})`);
    }
    requireCondition(hashCanonical(frozen.panelPolicy) === frozen.panelPolicySha256, "forward review: stale/tampered panel-policy hash");
    assertJudge("readerBackup", frozen.roleAssignment.readerBackup);
    assertJudge("sourceAdjudicator", frozen.roleAssignment.sourceAdjudicator);
  }
}

/** Public pre-spawn validation seam used by the central local author runtime.
 * The conductor repeats this check before every lane and before commit; exposing
 * the same validator lets an ACTIVE policy fail before the writer spends a call
 * when its fixed review stack is already malformed or stale. */
export function assertForwardFrozenReviewConfig(frozen: ForwardFrozenReviewConfigV1): void {
  assertFrozenConfig(frozen);
}

function laneBinding(frozen: ForwardFrozenReviewConfigV1, panelRole: ForwardPanelRole): LaneBinding {
  if (panelRole === "readerPrimary" || panelRole === "readerAudit") {
    return {
      workspaceRole: "direct-reader",
      profile: panelRole === "readerPrimary" ? frozen.roleAssignment.readerPrimary : frozen.roleAssignment.readerBackup,
      schemaSha256: frozen.instrumentManifest.readerSchemaSha256,
      instrumentVersion: frozen.instrumentManifest.readerRubricVersion,
    };
  }
  if (panelRole === "sourcePrimary" || panelRole === "sourceAdjudicator") {
    return {
      workspaceRole: "source-verifier",
      profile: panelRole === "sourcePrimary" ? frozen.roleAssignment.sourcePrimary : frozen.roleAssignment.sourceAdjudicator,
      schemaSha256: frozen.instrumentManifest.sourceSchemaSha256,
      instrumentVersion: frozen.instrumentManifest.sourceRubricVersion,
    };
  }
  return {
    workspaceRole: "quiz-adjudication",
    profile: frozen.roleAssignment.quizAdjudicator,
    schemaSha256: frozen.instrumentManifest.quizAdjudicationSchemaSha256,
    instrumentVersion: frozen.instrumentManifest.quizPhase2Version,
  };
}

/** Categorical reader contribution to the deterministic aggregate. The model's
 * advisory recommendation is intentionally excluded, and reader findings never
 * acquire source-truth authority. */
export function forwardReaderDecisionCategory(
  review: ReaderExperienceReviewV1,
  readerBar: number,
): ForwardReaderDecisionCategory {
  if (review.blockingFindings.length > 0) return "BLOCK";
  if (
    computeReaderComposite(review.scores) < readerBar
    || review.advisoryFindings.length > 0
    || review.escalationSignals.some((finding) => finding.category === "origin_ambiguous_to_reader")
  ) return "REVISE";
  return "PASS";
}

function sourceHasHighSeverityFinding(review: SourceIntegrityReviewV1): boolean {
  return review.units.some((unit) => unit.findings.some((finding) => finding.severity === "blocker" || finding.severity === "major"));
}

/** Compare source judgments structurally, excluding prose rationale/evidence
 * wording and generated finding ids. This prevents cosmetic differences from
 * manufacturing a disagreement while preserving every gate-bearing decision. */
function sourceDecisionSha256(review: SourceIntegrityReviewV1): string {
  const units = review.units.map((unit) => ({
    unitId: unit.unitId,
    expectedOrigin: unit.expectedOrigin,
    expectedForm: unit.expectedForm,
    claimStrengthExpected: unit.claimStrengthExpected,
    visibleRegister: unit.visibleRegister,
    supportStatus: unit.supportStatus,
    framingAdequate: unit.framingAdequate,
    claimStrengthFit: unit.claimStrengthFit,
    namedSpecificityAllowed: unit.namedSpecificityAllowed,
    findings: unit.findings
      .map((finding) => ({ category: finding.category, severity: finding.severity }))
      .sort((a, b) => `${a.category}:${a.severity}`.localeCompare(`${b.category}:${b.severity}`)),
  })).sort((a, b) => a.unitId.localeCompare(b.unitId));
  return hashCanonical({ result: review.result, units });
}

function computeBoundHashes(input: ForwardChapterConductorInputV1): BoundHashes {
  const { prepared } = input;
  requireCondition(prepared && typeof prepared === "object", "forward review: missing prepared candidate");
  requireCondition(prepared.plan && typeof prepared.plan === "object", "forward review: source-use plan is required");
  requireCondition(input.sourcePacket && typeof input.sourcePacket === "object", "forward review: source packet is required");
  requireCondition(input.sourceSidecar !== null && input.sourceSidecar !== undefined, "forward review: source sidecar is required");
  requireCondition(Array.isArray(input.anchorCatalog), "forward review: anchor catalog is required");

  let bytesObject: unknown;
  try {
    bytesObject = JSON.parse(prepared.bytes);
  } catch (error) {
    throw new ForwardChapterConductorError(`forward review: prepared candidate bytes are not JSON (${(error as Error).message})`);
  }
  requireCondition(bytesObject !== null && typeof bytesObject === "object" && !Array.isArray(bytesObject), "forward review: prepared candidate bytes are not a chapter object");
  const candidateObjectSha256 = hashCanonical(prepared.chapter);
  requireCondition(hashCanonical(bytesObject) === candidateObjectSha256, "forward review: prepared bytes do not match the reviewed candidate object");
  requireCondition(prepared.chapter.chapterId === prepared.chapterId, "forward review: prepared chapterId does not match candidate");
  requireCondition(prepared.chapter.number === prepared.chapterNumber, "forward review: prepared chapter number does not match candidate");
  requireCondition(prepared.attempt.identity.bookId === prepared.bookId, "forward review: attempt bookId does not match prepared candidate");
  requireCondition(prepared.attempt.identity.chapterNumber === prepared.chapterNumber, "forward review: attempt chapter number does not match prepared candidate");
  requireCondition(input.sourcePacket.bookId === prepared.bookId, "forward review: source packet bookId does not match prepared candidate");
  requireCondition(input.sourcePacket.chapterNumber === prepared.chapterNumber, "forward review: source packet chapter number does not match prepared candidate");
  requireCondition(input.sourcePacket.chapterId === prepared.chapterId, "forward review: source packet chapterId does not match prepared candidate");

  const sourceUsePlanSha256 = sourceUsePlanHash(prepared.plan);
  const sourcePacketSha256 = sourcePacketHash(input.sourcePacket);
  requireCondition(prepared.attempt.identity.sourcePlanHash === sourceUsePlanSha256, "forward review: attempt is not bound to the current source-use plan");
  requireCondition(prepared.attempt.identity.inputHashes.sourceUsePlan === sourceUsePlanSha256, "forward review: attempt source-use-plan input hash is stale");
  requireCondition(prepared.attempt.identity.inputHashes.sourcePacket === sourcePacketSha256, "forward review: attempt source-packet input hash is stale");
  requireCondition(sourceUsePlanStale(prepared.plan, input.sourcePacket) === null, "forward review: source-use plan is stale against the source packet");
  requireCondition(hashCanonical(input.anchorCatalog) === hashCanonical(input.sourcePacket.allowedAnchors), "forward review: anchor catalog is stale against the source packet");
  const availableAnchorIds = new Set(input.anchorCatalog.map((anchor) => anchor.id));
  const missingAnchorIds = prepared.plan.units
    .flatMap((unit) => unit.anchorIds ?? [])
    .filter((anchorId) => !availableAnchorIds.has(anchorId));
  requireCondition(missingAnchorIds.length === 0, `forward review: source plan references missing anchor(s): ${[...new Set(missingAnchorIds)].join(", ")}`);

  return {
    candidateContentSha256: chapterContentHash(prepared.chapter),
    candidateBytesSha256: sha256Hex(prepared.bytes),
    candidateObjectSha256,
    sourceUsePlanSha256,
    sourcePacketSha256,
    sidecarSha256: semanticSourceHash(input.sourceSidecar),
    anchorCatalogSha256: hashCanonical(input.anchorCatalog),
    frozenReviewConfigSha256: hashCanonical(input.frozen),
  };
}

function assertInputsFresh(input: ForwardChapterConductorInputV1, expected: BoundHashes): void {
  const current = computeBoundHashes(input);
  for (const key of Object.keys(expected) as Array<keyof BoundHashes>) {
    requireCondition(current[key] === expected[key], `forward review: stale ${key}`);
  }
}

async function assertAuthoritativeSourceEvidenceFresh(
  input: ForwardChapterConductorInputV1,
  expected: Pick<BoundHashes, "sidecarSha256" | "anchorCatalogSha256">,
): Promise<void> {
  requireCondition(typeof input.rereadAuthoritativeSourceEvidence === "function", "forward review: authoritative source-evidence re-read hook is required");
  const current = await input.rereadAuthoritativeSourceEvidence();
  requireCondition(current?.sourceSidecar !== null && current?.sourceSidecar !== undefined,
    "forward review: authoritative source sidecar is unavailable");
  requireCondition(Array.isArray(current?.anchorCatalog), "forward review: authoritative anchor catalog is unavailable");
  requireCondition(semanticSourceHash(current.sourceSidecar) === expected.sidecarSha256,
    "forward review: authoritative source sidecar changed during review");
  requireCondition(hashCanonical(current.anchorCatalog) === expected.anchorCatalogSha256,
    "forward review: authoritative anchor catalog changed during review");
}

/** The source packet and source-use plan are compiler-owned mutable files, not
 * merely in-memory review inputs. Re-read both through the prepared candidate's
 * bound IO immediately before commit and compare them to the exact hashes the
 * split lanes reviewed. */
function assertAuthoritativeCompilerInputsFresh(
  input: ForwardChapterConductorInputV1,
  expected: Pick<BoundHashes, "sourcePacketSha256" | "sourceUsePlanSha256">,
): void {
  const current = readPreparedAuthorCompilerInputs(input.prepared);
  requireCondition(!("error" in current), `forward review: authoritative compiler input changed during review (${"error" in current ? current.error : "unknown"})`);
  if ("error" in current) return;
  requireCondition(current.sourcePacketSha256 === expected.sourcePacketSha256,
    "forward review: authoritative source packet changed during review");
  requireCondition(current.sourcePlanSha256 === expected.sourceUsePlanSha256,
    "forward review: authoritative source-use plan changed during review");
}

function artifact(kind: ForwardReviewArtifactV1["kind"], relPath: string, content: string): ForwardReviewArtifactV1 {
  return Object.freeze({ kind, relPath, content, sha256: sha256Hex(content) });
}

function projectReceipt(result: ForwardReviewExecutionResultV1): ReceiptProjection {
  const { output: _output, ...receipt } = result;
  return receipt;
}

function receiptMismatches(request: ForwardReviewExecutionRequestV1, result: ForwardReviewExecutionResultV1): string[] {
  const mismatches: string[] = [];
  const expected: Record<string, unknown> = {
    schema: FORWARD_REVIEW_EXECUTION_RESULT_SCHEMA,
    lane: request.lane,
    workspaceRole: request.workspaceRole,
    profileId: request.profileId,
    model: request.model,
    effort: request.effort,
    schemaSha256: request.schemaSha256,
    instrumentVersion: request.instrumentVersion,
    roleAssignmentSha256: request.roleAssignmentSha256,
    instrumentManifestSha256: request.instrumentManifestSha256,
    executionProfileHash: request.executionProfileHash,
    routePolicyVersion: request.routePolicyVersion,
  };
  for (const [field, value] of Object.entries(expected)) {
    if ((result as unknown as Record<string, unknown>)?.[field] !== value) mismatches.push(field);
  }
  if (!nonEmpty(result?.executionId)) mismatches.push("executionId");
  if (typeof result?.output !== "string") mismatches.push("output");
  return [...new Set(mismatches)];
}

function freezeEnvelope(envelope: ForwardReviewExecutionEnvelopeV1): Readonly<ForwardReviewExecutionEnvelopeV1> {
  for (const entry of envelope.executions) {
    Object.freeze(entry.artifactHashes);
    if (entry.received) Object.freeze(entry.received);
    Object.freeze(entry.expected);
    Object.freeze(entry);
  }
  Object.freeze(envelope.executions);
  Object.freeze(envelope.panelAdjustmentReasons);
  return Object.freeze(envelope);
}

function makeResult(args: {
  disposition: ForwardReviewExecutionEnvelopeV1["disposition"];
  finalStatus: AggregatedChapterReviewV1["finalStatus"];
  reason: string;
  input: ForwardChapterConductorInputV1;
  hashes: BoundHashes;
  executions: ForwardReviewExecutionEntryV1[];
  reader: ReaderExperienceReviewV1 | null;
  panel: PanelReviewState;
  source: SourceIntegrityReviewV1 | null;
  quiz: QuizIntegrityResultV1 | null;
  aggregate: AggregatedChapterReviewV1 | null;
  committedDerivation: CommittedQuizDerivation | null;
  deterministicCriticBundleSha256: string | null;
  commitResult: AuthorWriteOneResult | null;
}): ForwardChapterConductorResultV1 {
  const envelope = freezeEnvelope({
    schema: FORWARD_REVIEW_ENVELOPE_SCHEMA,
    attemptId: args.input.prepared.attempt.identity.attemptId,
    candidateContentSha256: args.hashes.candidateContentSha256,
    candidateBytesSha256: args.hashes.candidateBytesSha256,
    sourceUsePlanSha256: args.hashes.sourceUsePlanSha256,
    sourcePacketSha256: args.hashes.sourcePacketSha256,
    sidecarSha256: args.hashes.sidecarSha256,
    anchorCatalogSha256: args.hashes.anchorCatalogSha256,
    frozenReviewConfigSha256: args.hashes.frozenReviewConfigSha256,
    roleAssignmentSha256: args.input.frozen.roleAssignmentSha256,
    instrumentManifestSha256: args.input.frozen.instrumentManifestSha256,
    panelPolicySha256: args.input.frozen.panelPolicySha256 ?? null,
    executions: args.executions,
    derivationSha256: args.committedDerivation?.sha256 ?? null,
    deterministicCriticBundleSha256: args.deterministicCriticBundleSha256,
    readerResultSha256: args.reader ? hashCanonical(args.reader) : null,
    readerPrimaryCategory: args.panel.readerPrimaryCategory,
    readerAuditSelected: args.panel.readerAuditSelected,
    readerAuditProfileId: args.panel.readerAuditSelected ? args.input.frozen.roleAssignment.readerBackup.profileId : null,
    readerAuditResultSha256: args.panel.readerAudit ? hashCanonical(args.panel.readerAudit) : null,
    readerAuditCategory: args.panel.readerAuditCategory,
    readerAuditDisagreement: args.panel.readerAuditDisagreement,
    sourceResultSha256: args.source ? hashCanonical(args.source) : null,
    sourceAdjudicationTriggered: args.panel.sourceAdjudicationTriggered,
    sourceAdjudicatorProfileId: args.panel.sourceAdjudicationTriggered ? args.input.frozen.roleAssignment.sourceAdjudicator.profileId : null,
    sourceAdjudicatorResultSha256: args.panel.sourceAdjudication ? hashCanonical(args.panel.sourceAdjudication) : null,
    sourceAdjudicationAgreement: args.panel.sourceAdjudicationAgreement,
    quizResultSha256: args.quiz ? hashCanonical(args.quiz) : null,
    aggregateSha256: args.aggregate ? hashCanonical(args.aggregate) : null,
    panelAdjustmentReasons: [...args.panel.adjustmentReasons],
    finalStatus: args.finalStatus,
    disposition: args.disposition,
    failureReason: args.disposition === "COMMITTED" ? null : args.reason,
  });
  return {
    schema: FORWARD_CHAPTER_CONDUCTOR_SCHEMA,
    disposition: args.disposition,
    finalStatus: args.finalStatus,
    reason: args.reason,
    reader: args.reader,
    readerAudit: args.panel.readerAudit,
    source: args.source,
    sourceAdjudication: args.panel.sourceAdjudication,
    quiz: args.quiz,
    aggregate: args.aggregate,
    committedDerivation: args.committedDerivation,
    commitResult: args.commitResult,
    executionEnvelope: envelope,
    executionEnvelopeSha256: hashCanonical(envelope),
  };
}

/** Run one already-prepared candidate through the forward-only review path. */
export async function runForwardChapterConductor(
  input: ForwardChapterConductorInputV1,
  deps: ForwardChapterConductorDeps,
): Promise<ForwardChapterConductorResultV1> {
  requireCondition(deps && typeof deps.executor === "function", "forward review requires an injected reviewer executor");
  const finalize = deps.finalizePendingAttempt ?? finalizeAttempt;
  const commit = deps.commitPreparedCandidate ?? commitPreparedAuthorCandidate;
  const executions: ForwardReviewExecutionEntryV1[] = [];
  const seenExecutionIds = new Set<string>();
  let reader: ReaderExperienceReviewV1 | null = null;
  let source: SourceIntegrityReviewV1 | null = null;
  let quiz: QuizIntegrityResultV1 | null = null;
  let aggregate: AggregatedChapterReviewV1 | null = null;
  let committedDerivation: CommittedQuizDerivation | null = null;
  let deterministicCriticBundleSha256: string | null = null;
  const panel: PanelReviewState = {
    readerAuditSelected: false,
    readerPrimaryCategory: null,
    readerAudit: null,
    readerAuditCategory: null,
    readerAuditDisagreement: false,
    sourceAdjudicationTriggered: false,
    sourceAdjudication: null,
    sourceAdjudicationAgreement: null,
    adjustmentReasons: [],
  };
  let hashes: BoundHashes;

  try {
    assertFrozenConfig(input.frozen);
    // Membership is frozen from chapter coordinates before any reviewer output
    // exists. It is never selected after observing primary quality.
    panel.readerAuditSelected = input.frozen.panelPolicy
      ? isInForwardReaderAuditSubset(input.frozen.panelPolicy.auditSubset, {
          bookId: input.prepared.bookId,
          chapterNumber: input.prepared.chapterNumber,
        })
      : false;
    hashes = computeBoundHashes(input);
    await assertAuthoritativeSourceEvidenceFresh(input, hashes);
  } catch (error) {
    // A malformed preflight still needs a complete envelope.  Hash what can be
    // represented without trusting the malformed fields.
    hashes = {
      candidateContentSha256: input?.prepared?.chapter ? chapterContentHash(input.prepared.chapter) : "unavailable",
      candidateBytesSha256: typeof input?.prepared?.bytes === "string" ? sha256Hex(input.prepared.bytes) : "unavailable",
      candidateObjectSha256: input?.prepared?.chapter ? hashCanonical(input.prepared.chapter) : "unavailable",
      sourceUsePlanSha256: input?.prepared?.plan ? sourceUsePlanHash(input.prepared.plan) : "unavailable",
      sourcePacketSha256: input?.sourcePacket ? sourcePacketHash(input.sourcePacket) : "unavailable",
      sidecarSha256: input?.sourceSidecar !== undefined && input?.sourceSidecar !== null ? semanticSourceHash(input.sourceSidecar) : "unavailable",
      anchorCatalogSha256: Array.isArray(input?.anchorCatalog) ? hashCanonical(input.anchorCatalog) : "unavailable",
      frozenReviewConfigSha256: input?.frozen ? hashCanonical(input.frozen) : "unavailable",
    };
    const reason = `forward review failed closed during preflight: ${(error as Error).message}`;
    finalize(input.prepared.attempt, "superseded", reason);
    return makeResult({
      disposition: "SUPERSEDED", finalStatus: "INCONCLUSIVE", reason, input, hashes, executions,
      reader, panel, source, quiz, aggregate, committedDerivation, deterministicCriticBundleSha256, commitResult: null,
    });
  }

  const executeBound = async (
    lane: ForwardReviewLane,
    panelRole: ForwardPanelRole,
    task: string,
    artifacts: ForwardReviewArtifactV1[],
  ): Promise<{ output: string; executionId: string }> => {
    assertFrozenConfig(input.frozen);
    assertInputsFresh(input, hashes);
    const binding = laneBinding(input.frozen, panelRole);
    const request: ForwardReviewExecutionRequestV1 = Object.freeze({
      schema: FORWARD_REVIEW_EXECUTION_REQUEST_SCHEMA,
      lane,
      workspaceRole: binding.workspaceRole,
      profileId: binding.profile.profileId,
      model: binding.profile.model,
      effort: binding.profile.effort,
      schemaSha256: binding.schemaSha256,
      instrumentVersion: binding.instrumentVersion,
      roleAssignmentSha256: input.frozen.roleAssignmentSha256,
      instrumentManifestSha256: input.frozen.instrumentManifestSha256,
      executionProfileHash: input.frozen.instrumentManifest.executionProfileHash,
      routePolicyVersion: input.frozen.instrumentManifest.routePolicyVersion,
      task,
      artifacts: Object.freeze([...artifacts]),
    });
    const { task: _task, artifacts: _artifacts, ...expected } = request;
    const entry: ForwardReviewExecutionEntryV1 = {
      lane,
      panelRole,
      roleProfileSha256: hashCanonical({
        judge: binding.profile,
        executionProfileHash: input.frozen.instrumentManifest.executionProfileHash,
        routePolicyVersion: input.frozen.instrumentManifest.routePolicyVersion,
      }),
      expected,
      taskSha256: sha256Hex(task),
      artifactHashes: request.artifacts.map((a) => ({ kind: a.kind, relPath: a.relPath, sha256: a.sha256 })),
      status: "REQUESTED",
      received: null,
      outputSha256: null,
      failureReason: null,
    };
    executions.push(entry);

    let result: ForwardReviewExecutionResultV1;
    try {
      result = await deps.executor(request);
    } catch (error) {
      entry.status = "REJECTED";
      entry.failureReason = `executor threw: ${(error as Error).message}`;
      throw new ForwardChapterConductorError(`${panelRole} executor failed: ${(error as Error).message}`);
    }
    entry.received = result && typeof result === "object" ? projectReceipt(result) : null;
    const mismatches = receiptMismatches(request, result);
    if (nonEmpty(result?.executionId) && seenExecutionIds.has(result.executionId)) mismatches.push("executionId(reused)");
    if (mismatches.length > 0) {
      entry.status = "REJECTED";
      entry.failureReason = `route receipt mismatch: ${[...new Set(mismatches)].join(", ")}`;
      throw new ForwardChapterConductorError(`${panelRole} reviewer used the wrong frozen role/route (${entry.failureReason})`);
    }
    seenExecutionIds.add(result.executionId);
    entry.status = "VERIFIED";
    entry.outputSha256 = sha256Hex(result.output);
    return { output: result.output, executionId: result.executionId };
  };

  try {
    const phase1Document = ensureTrailingNewline(renderChapterReaderDocPhase1(input.prepared.chapter));
    const readerDocSha256 = readerExperienceDocHash(input.prepared.chapter);
    const runBoundReader = async (panelRole: "readerPrimary" | "readerAudit"): Promise<{ review: ReaderExperienceReviewV1; executionId: string }> => {
      let executionId = "";
      const review = await runReaderExperienceReview(
        {
          docRelPath: "candidate.phase1.md",
          chapterContentSha256: hashes.candidateContentSha256,
          readerDocumentSha256: readerDocSha256,
          schemaSha256: input.frozen.instrumentManifest.readerSchemaSha256,
        },
        {
          reviewFn: async (task) => {
            const executed = await executeBound("reader", panelRole, task, [artifact("phase1-doc", "candidate.phase1.md", phase1Document)]);
            executionId = executed.executionId;
            return executed.output;
          },
        },
      );
      requireCondition(nonEmpty(executionId), `forward review: ${panelRole} execution did not yield an independent session id`);
      return { review, executionId };
    };

    const primaryReader = await runBoundReader("readerPrimary");
    reader = primaryReader.review;
    const readerExecutionId = primaryReader.executionId;
    requireCondition(nonEmpty(readerExecutionId), "forward review: reader execution did not yield an independent session id");
    panel.readerPrimaryCategory = forwardReaderDecisionCategory(reader, input.frozen.readerBar);

    if (panel.readerAuditSelected) {
      assertFrozenConfig(input.frozen);
      assertInputsFresh(input, hashes);
      const audit = await runBoundReader("readerAudit");
      panel.readerAudit = audit.review;
      panel.readerAuditCategory = forwardReaderDecisionCategory(audit.review, input.frozen.readerBar);
      panel.readerAuditDisagreement = panel.readerAuditCategory !== panel.readerPrimaryCategory;
      if (panel.readerAuditDisagreement) {
        panel.adjustmentReasons.push(
          `reader primary/audit categorical disagreement (${panel.readerPrimaryCategory} vs ${panel.readerAuditCategory}) requires REVISE`,
        );
      }
    }

    assertInputsFresh(input, hashes);
    const runBoundSource = async (panelRole: "sourcePrimary" | "sourceAdjudicator") => runSourceIntegrityReview(
        {
          chapter: input.prepared.chapter,
          plan: input.prepared.plan!,
          packet: input.sourcePacket,
          sidecar: input.sourceSidecar,
          anchorCatalog: input.anchorCatalog,
          schemaSha256: input.frozen.instrumentManifest.sourceSchemaSha256,
        },
        {
          spawn: async (task, reviewPacket) => {
            const evidence = JSON.stringify({
              sourcePacket: reviewPacket.sourcePacket,
              sourceSidecar: reviewPacket.sourceSidecar,
              anchorCatalog: reviewPacket.anchorCatalog,
            }, null, 2);
            const executed = await executeBound("source", panelRole, task.task, [
              artifact("phase1-doc", "candidate.phase1.md", reviewPacket.chapterDocument),
              artifact("source-evidence", "source-evidence.json", evidence),
              artifact("source-plan", "source-plan.txt", reviewPacket.sourcePlanLicense.join("\n")),
            ]);
            return { finalMessage: executed.output };
          },
        },
      );
    /** Deterministic blockers normally short-circuit before a model read. The
     * panel still executes its fixed adjudicator when the escalation policy is
     * active, but the semantic read cannot overturn the deterministic blocker. */
    const runDeterministicBlockerAdjudication = async (): Promise<SourceIntegrityReviewV1> => {
      const reviewPacket = assembleSourceReviewPacket(
        input.prepared.chapter,
        input.prepared.plan!,
        input.sourcePacket,
        input.sourceSidecar,
        input.anchorCatalog,
      );
      const task = buildSourceIntegrityTask(reviewPacket, {
        outputSchemaRelPath: "state/migration-experiments/contracts/schemas/source-integrity-review.schema.json",
        schemaSha256: input.frozen.instrumentManifest.sourceSchemaSha256,
      });
      const evidence = JSON.stringify({
        sourcePacket: reviewPacket.sourcePacket,
        sourceSidecar: reviewPacket.sourceSidecar,
        anchorCatalog: reviewPacket.anchorCatalog,
      }, null, 2);
      const executed = await executeBound("source", "sourceAdjudicator", task.task, [
        artifact("phase1-doc", "candidate.phase1.md", reviewPacket.chapterDocument),
        artifact("source-evidence", "source-evidence.json", evidence),
        artifact("source-plan", "source-plan.txt", reviewPacket.sourcePlanLicense.join("\n")),
      ]);
      const parsed = parseSourceIntegrityReview(executed.output);
      requireCondition(parsed !== null, "forward review: deterministic-blocker source adjudicator output did not parse");
      const semanticBlockers = parsed.units.flatMap((unit, unitIndex) => unit.findings
        .map((finding, findingIndex) => ({ finding, findingIndex }))
        .filter(({ finding }) => finding.severity === "blocker")
        .map(({ finding, findingIndex }) => `${unit.unitId || unitIndex}::${finding.category}#${findingIndex}`));
      const review: SourceIntegrityReviewV1 = {
        ...parsed,
        reviewerRole: "source-integrity",
        chapterContentSha256: hashes.candidateContentSha256,
        sourceUsePlanSha256: hashes.sourceUsePlanSha256,
        sourcePacketSha256: hashes.sourcePacketSha256,
        sidecarSha256: hashes.sidecarSha256,
        schemaSha256: input.frozen.instrumentManifest.sourceSchemaSha256,
        // A semantic adjudicator never re-votes deterministic blockers.
        result: "BLOCK",
        blockingFindingIds: [...new Set([...sourceLane.summary.blockerCheckIds, ...semanticBlockers])],
      };
      const errors = validateSourceIntegrityReview(review);
      requireCondition(errors.length === 0, `forward review: invalid deterministic-blocker adjudication (${errors.join("; ")})`);
      return review;
    };
    const sourceLane = await runBoundSource("sourcePrimary");
    source = sourceLane.review;
    deterministicCriticBundleSha256 = sourceLane.bundle.bundleSha256;

    const sourceHasHighSeverity = sourceHasHighSeverityFinding(source)
      || sourceLane.bundle.checks.some((finding) => finding.severity === "blocker" || finding.severity === "major");
    if (input.frozen.panelPolicy && (source.result !== "PASS" || sourceHasHighSeverity)) {
      panel.sourceAdjudicationTriggered = true;
      assertFrozenConfig(input.frozen);
      assertInputsFresh(input, hashes);
      let adjudicated: Awaited<ReturnType<typeof runBoundSource>>;
      try {
        if (sourceLane.summary.hasBlocker) {
          const review = await runDeterministicBlockerAdjudication();
          adjudicated = { review, bundle: sourceLane.bundle, summary: sourceLane.summary, result: review.result };
        } else {
          adjudicated = await runBoundSource("sourceAdjudicator");
        }
      } catch (error) {
        panel.adjustmentReasons.push(`source adjudicator operational failure requires INCONCLUSIVE: ${(error as Error).message}`);
        throw error;
      }
      panel.sourceAdjudication = adjudicated.review;
      panel.sourceAdjudicationAgreement = adjudicated.bundle.bundleSha256 === sourceLane.bundle.bundleSha256
        && (sourceLane.summary.hasBlocker
          ? adjudicated.review.result === source.result
          : sourceDecisionSha256(adjudicated.review) === sourceDecisionSha256(source));
      if (!panel.sourceAdjudicationAgreement) {
        panel.adjustmentReasons.push("source primary/adjudicator structural disagreement requires INCONCLUSIVE");
      }
    }

    assertInputsFresh(input, hashes);
    const derivation = buildQuizDerivation(
      input.prepared.chapter,
      {
        answers: reader.quizDerivation.answers,
        mechanisms: reader.quizDerivation.mechanisms,
        confidence: reader.quizDerivation.confidence,
        ambiguities: reader.quizDerivation.ambiguities,
      },
      readerDocSha256,
      readerExecutionId,
    );
    const questions = input.prepared.chapter.quiz?.questions ?? [];
    committedDerivation = commitQuizDerivation(derivation, {
      documentSha256: readerDocSha256,
      questionCount: questions.length,
      itemIds: questions.map((_q, i) => quizItemId(input.prepared.chapter, i)),
    });
    const phase2Document = renderQuizPhase2Doc(input.prepared.chapter, committedDerivation);
    const quizTask = buildQuizIntegrityAdjudicationTask("candidate.phase2.md");
    const quizExecution = await executeBound("quiz", "quizSemanticAdjudicator", quizTask, [artifact("phase2-doc", "candidate.phase2.md", phase2Document)]);
    quiz = runQuizIntegrityLane(input.prepared.chapter, committedDerivation, quizExecution.output, {
      chapterContentSha256: hashes.candidateContentSha256,
    });

    assertFrozenConfig(input.frozen);
    assertInputsFresh(input, hashes);
    aggregate = aggregateChapterReview({
      reader,
      source,
      quiz,
      deterministic: sourceLane.summary,
      readerBar: input.frozen.readerBar,
      chapterContentSha256: hashes.candidateContentSha256,
      expectedChapterContentSha256: hashes.candidateContentSha256,
      expectedReaderDocumentSha256: readerDocSha256,
      expectedSourceUsePlanSha256: hashes.sourceUsePlanSha256,
      expectedSourcePacketSha256: hashes.sourcePacketSha256,
      expectedSidecarSha256: hashes.sidecarSha256,
      expectedReaderSchemaSha256: input.frozen.instrumentManifest.readerSchemaSha256,
      expectedSourceSchemaSha256: input.frozen.instrumentManifest.sourceSchemaSha256,
      expectedQuizSchemaSha256: input.frozen.instrumentManifest.quizAdjudicationSchemaSha256,
      requiredSourceUnitIds: computeRequiredSourceUnitIds(input.prepared.plan!),
    });
    const aggregateErrors = validateAggregatedChapterReview(aggregate);
    requireCondition(aggregateErrors.length === 0, `forward review: invalid aggregate (${aggregateErrors.join("; ")})`);
    requireCondition(aggregateIsFresh(aggregate, {
      chapterContentSha256: hashes.candidateContentSha256,
      readerResultSha256: hashCanonical(reader),
      sourceResultSha256: hashCanonical(source),
      quizResultSha256: hashCanonical(quiz),
      deterministicCriticBundleSha256: sourceLane.bundle.bundleSha256,
    }), "forward review: aggregate is stale against its lane evidence");

    let panelAdjustedStatus: AggregatedChapterReviewV1["finalStatus"] = aggregate.finalStatus;
    if (panel.sourceAdjudicationTriggered && panel.sourceAdjudicationAgreement !== true) {
      panelAdjustedStatus = "INCONCLUSIVE";
      if (!panel.adjustmentReasons.some((reason) => reason.includes("source primary/adjudicator"))) {
        panel.adjustmentReasons.push("source adjudication did not produce a structurally agreeing verdict; status is INCONCLUSIVE");
      }
    } else if (panel.readerAuditDisagreement && (panelAdjustedStatus === "PASS" || panelAdjustedStatus === "REVISE")) {
      panelAdjustedStatus = "REVISE";
    }

    if (panelAdjustedStatus !== "PASS") {
      const reason = `forward review ${panelAdjustedStatus}: panel-adjusted candidate superseded without canonical commit`;
      finalize(input.prepared.attempt, "superseded", reason);
      deps.log?.(`[forward-review] ${input.prepared.chapterId}: ${reason}`);
      return makeResult({
        disposition: "SUPERSEDED", finalStatus: panelAdjustedStatus, reason, input, hashes, executions,
        reader, panel, source, quiz, aggregate, committedDerivation, deterministicCriticBundleSha256, commitResult: null,
      });
    }

    // The review may be long. Recheck every mutable input and frozen binding after
    // aggregation, immediately before crossing the sole canonical commit seam.
    assertFrozenConfig(input.frozen);
    assertInputsFresh(input, hashes);
    await assertAuthoritativeSourceEvidenceFresh(input, hashes);
    assertAuthoritativeCompilerInputsFresh(input, hashes);
    requireCondition(panelAdjustedStatus === "PASS", "forward review: only panel-adjusted PASS may commit");
    const committedReason = "forward review PASS: fresh aggregate committed prepared candidate atomically";
    const expectedCommitResult: AuthorWriteOneResult = {
      ok: true,
      sessionId: input.prepared.sessionId,
      committed: true,
    };
    const provisionalCommittedResult = makeResult({
      disposition: "COMMITTED", finalStatus: "PASS", reason: committedReason, input, hashes, executions,
      reader, panel, source, quiz, aggregate, committedDerivation, deterministicCriticBundleSha256,
      commitResult: expectedCommitResult,
    });
    let commitResult: AuthorWriteOneResult;
    try {
      commitResult = commit(input.prepared, {
        log: deps.log ?? (() => undefined),
        ...(deps.persistCommittedResult ? {
          forwardReviewEvidence: {
            resultSha256: hashCanonical(provisionalCommittedResult),
            persistAndReadBack: () => deps.persistCommittedResult!(provisionalCommittedResult),
          },
        } : {}),
      });
    } catch (error) {
      // A commit implementation can fail after entering its atomic bracket. Do
      // not mislabel or re-finalize the attempt as superseded here; recovery owns
      // reconciliation of an exceptional commit path.
      const reason = `forward review PASS, but prepared-candidate commit threw and requires reconciliation: ${(error as Error).message}`;
      return makeResult({
        disposition: "COMMIT_FAILED", finalStatus: "INCONCLUSIVE", reason, input, hashes, executions,
        reader, panel, source, quiz, aggregate, committedDerivation, deterministicCriticBundleSha256, commitResult: null,
      });
    }
    if (!commitResult.ok || !("committed" in commitResult) || commitResult.committed !== true) {
      const reason = commitResult.ok
        ? "forward review PASS, but prepared-candidate commit did not confirm committed=true"
        : `forward review PASS, but prepared-candidate commit failed: ${commitResult.reason}`;
      return makeResult({
        disposition: "COMMIT_FAILED", finalStatus: "INCONCLUSIVE", reason, input, hashes, executions,
        reader, panel, source, quiz, aggregate, committedDerivation, deterministicCriticBundleSha256, commitResult,
      });
    }
    return makeResult({
      disposition: "COMMITTED", finalStatus: "PASS", reason: committedReason, input, hashes, executions,
      reader, panel, source, quiz, aggregate, committedDerivation, deterministicCriticBundleSha256, commitResult,
    });
  } catch (error) {
    const reason = `forward review failed closed: ${(error as Error).message}`;
    finalize(input.prepared.attempt, "superseded", reason);
    deps.log?.(`[forward-review] ${input.prepared.chapterId}: ${reason}`);
    return makeResult({
      disposition: "SUPERSEDED", finalStatus: "INCONCLUSIVE", reason, input, hashes, executions,
      reader, panel, source, quiz, aggregate, committedDerivation, deterministicCriticBundleSha256, commitResult: null,
    });
  }
}
