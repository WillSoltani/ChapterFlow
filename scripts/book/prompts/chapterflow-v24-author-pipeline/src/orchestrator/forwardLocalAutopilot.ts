/**
 * Filesystem adapter for the normal local authoring entrypoints.
 *
 * Both `book-autopilot` and `book-run` enter `runAutopilot`, which calls this
 * single factory.  The two standard files are intentionally absent until a
 * successful retained IMP-22 or IMP-24 activation:
 *
 *   state/forward-local/activation-policy.json
 *   state/forward-local/runtime-binding.json
 *
 * Absence keeps the explicit baseline. ROLLED_BACK restores the recorded prior
 * writer. ACTIVE is accepted only through forwardAuthorRuntime's strict local
 * validation and receives the real split-lane executor. Nothing here can
 * publish, promote, deploy, upload, or use an API fallback.
 */

import { existsSync, mkdirSync, readFileSync, readdirSync, realpathSync, rmSync } from "node:fs";
import { basename, dirname, isAbsolute, relative, resolve } from "node:path";

import { PIPELINE_DIR } from "../bakeoff/paths.js";
import {
  certifyImp24Instrument,
  validateImp24InstrumentCertificationBinding,
} from "../bakeoff/migration/imp24InstrumentCertification.js";
import {
  IMP24_ROLE_QUALIFICATION_RUNNER_SCHEMA,
  type InstrumentCertificationBindingV3,
  type RoleQualificationRunnerResultV3,
} from "../bakeoff/migration/roleQualificationRunnerV3.js";
import { canonicalJson, hashCanonical, sha256Hex } from "../contracts/contractUtil.js";
import { chapterContentHash } from "../critics/qcAttestation.js";
import { aggregateIsFresh, validateAggregatedChapterReview } from "../contracts/aggregateChapterReview.js";
import { loadBookChapters } from "../qc/manualKeyJudge.js";
import { loadSourceV2Sidecar } from "../qc/sourceV2Gate.js";
import { buildSourceAnchorCatalog } from "../source/sourceIntegrity.js";
import type { SourceSidecarV2 } from "../source/sidecarSchema.js";
import { resolveExecutionProfile } from "../exec/executionEnvelope.js";
import { READER_EXPERIENCE_RUBRIC_VERSION } from "../review/readerExperienceReview.js";
import { SOURCE_INTEGRITY_RUBRIC_VERSION } from "../review/sourceIntegrityReview.js";
import { QUIZ_INTEGRITY_ADJUDICATION_SCHEMA } from "../review/quizIntegrityReview.js";
import { SWEEP_FAMILIES } from "../qc/sweepSpec.js";
import { loadSweepRecord, REQUIRED_SWEEP_FAMILIES, type SweepRecord } from "../qc/sweep.js";
import { validateSubmission, type ValidatedSweepSubmission } from "../qc/orchestrator/schemas.js";
import { evidenceSourceId } from "../qc/orchestrator/evidenceSource.js";
import { writeFileAtomic } from "../lib/atomicWrite.js";
import { parseForwardActivationPolicy } from "./forwardActivation.js";
import type { VerifiedNoApiRouteV1 } from "./forwardActivation.js";
import {
  createForwardAuthorChapterWriter,
  FORWARD_LOCAL_RUNTIME_BINDING_V2_SCHEMA,
  parseForwardLocalRuntimeBinding,
  resolveForwardLocalRuntime,
  type ForwardReviewEvidenceV1,
  type ForwardTypedRepairProductionV1,
  type ResolvedForwardLocalRuntimeV1,
  type RunLocalAuthoringChapterDepsV1,
} from "./forwardAuthorRuntime.js";
import {
  FORWARD_PRODUCTION_REVIEW_PROTOCOL_V2,
  productionReviewEnvelopeSetSha256,
} from "../review/forwardProductionReviewV2.js";
import { createForwardReviewerExecutor } from "./forwardReviewerExecutor.js";
import { resolveAuthorIo, type AuthorWriteOneInvoker, type PreparedAuthorCandidate } from "./authorRun.js";
import { readPreparedAuthorCompilerInputs, type AuthorWriteOneResult } from "./authorRun.js";
import { resolveAuthorReviewIo, type AuthorReviewIo } from "./authorReview.js";
import type { AutopilotDeps } from "./autopilot.js";
import {
  PATCH_FILE_NAME,
  buildRepairCard,
  type RepairScope,
} from "./authorRepair.js";
import {
  applyChapterPatch,
  classifyRepairRoute,
  enumeratePatchablePaths,
  findingsFromComplaints,
  nonScopeDrift,
} from "./repairPatch.js";
import { mintChapterAttempt, unexpectedAttemptWrites, finalizeAttempt } from "./chapterTransaction.js";
import { sourcePacketHash } from "../compiler/sourcePacket.js";
import { sourceUsePlanHash } from "../contracts/sourceUsePlan.js";
import type { ChapterPatchV1 } from "../contracts/repairContracts.js";
import type { ChapterV21 } from "../types.js";
import type { ForwardChapterConductorResultV1, ForwardReviewerExecutor } from "./forwardChapterConductor.js";
import type { ForwardAuthoringRiskSignalsV1 } from "./modelPolicy.js";
import { ROUTE_POLICY_VERSION } from "./modelPolicy.js";
import type { ForwardQualificationInstrumentBindingV1 } from "./forwardRoleAssignmentFreeze.js";
import {
  FORWARD_ROLE_ASSIGNMENT_FREEZE_V3_SCHEMA,
  type ForwardRoleAssignmentFreezeV3,
} from "./forwardRoleAssignmentFreezeV3.js";
import {
  GOLD_ENVELOPE_EXPERIMENT_ID,
  PILOT_ENVELOPE_EXPERIMENT_ID,
  forwardV2SourceExecutionOrderProblems,
} from "./forwardValidationCampaign.js";

export const FORWARD_LOCAL_STATE_DIR = resolve(PIPELINE_DIR, "state", "forward-local");
export const FORWARD_LOCAL_ACTIVATION_POLICY_PATH = resolve(FORWARD_LOCAL_STATE_DIR, "activation-policy.json");
export const FORWARD_LOCAL_RUNTIME_BINDING_PATH = resolve(FORWARD_LOCAL_STATE_DIR, "runtime-binding.json");
export const FORWARD_LOCAL_BOOK_ACCEPTANCE_SCHEMA = "forward-local-book-acceptance-v1" as const;
export const FORWARD_LOCAL_CURRENT_EVIDENCE_SCHEMA = "forward-local-current-evidence-v1" as const;
export const FORWARD_LOCAL_RETAINED_CHAPTER_RESULT_V2_SCHEMA = "forward-local-retained-chapter-result-v2" as const;

export const FORWARD_LOCAL_CURRENT_PATHS = Object.freeze({
  qualification: "current/qualification-bundle.json",
  pilot: "current/pilot-evidence.json",
  gold: "current/gold-evidence.json",
  instrumentBinding: "current/instrument-binding.json",
  reviewConfig: "current/review-config.json",
  roleAssignmentFreeze: "current/role-assignment-freeze.json",
  noApiRoute: "current/no-api-route.json",
});

const SHA256 = /^[a-f0-9]{64}$/;

export type ForwardBookAcceptanceStatusV1 = {
  accepted: boolean;
  reason: string;
  artifactPath: string;
};

export type ForwardAutopilotControlV1 = {
  runtime: ResolvedForwardLocalRuntimeV1;
  writeOneChapter: AuthorWriteOneInvoker;
  readBookAcceptance: (bookId: string) => ForwardBookAcceptanceStatusV1;
  finalizeBookAcceptance?: (
    bookId: string,
    deps: AutopilotDeps,
    authorIo?: Partial<AuthorReviewIo>,
  ) => Promise<ForwardBookAcceptanceStatusV1>;
  claimGateCorrection?: (
    bookId: string,
    chapterNumber: number,
    complaints: string[],
  ) => { claimed: boolean; reason: string };
  activationPolicyPath: string;
  runtimeBindingPath: string;
};

export type ForwardLocalBookAcceptanceV1 = {
  schema: typeof FORWARD_LOCAL_BOOK_ACCEPTANCE_SCHEMA;
  bookId: string;
  accepted: true;
  activationPolicySha256: string;
  runtimeBindingSha256: string;
  chapterReviews: Array<{
    chapterNumber: number;
    chapterContentSha256: string;
    resultRelPath: string;
    executionEnvelopeSha256: string;
    retainedRecordSha256?: string;
  }>;
  bookSweep: {
    verdict: "PASS";
    artifactRelPath: string;
    evidenceSha256: string;
  };
  hardGateFailures: [];
  publish: false;
  promotion: false;
  deployment: false;
  upload: false;
  acceptanceSha256: string;
};

export type ForwardLocalBookSweepV1 = {
  schema: "forward-local-book-sweep-v1";
  bookId: string;
  verdict: "PASS";
  chapterContentHashes: Record<string, string>;
  checkedFamilies: string[];
  sourceSweep: SweepRecord;
  sourceSweepSha256: string;
  rawSweepSubmission: {
    path: string;
    sourceId: string;
    bytesSha256: string;
    contentSha256: string;
    reviewerSessionId: string;
  };
  hardGateFailures: [];
  sweepSha256: string;
};

export type ForwardLocalCurrentEvidenceV1 = {
  schema: typeof FORWARD_LOCAL_CURRENT_EVIDENCE_SCHEMA;
  kind: "pilot" | "gold";
  payload: unknown;
  payloadSha256: string;
  evidenceSha256: string;
};

export type ForwardLocalRetainedChapterResultV2 = {
  schema: typeof FORWARD_LOCAL_RETAINED_CHAPTER_RESULT_V2_SCHEMA;
  runtimeSha256: string;
  runtimeBindingSha256: string;
  reviewConfigSha256: string;
  roleAssignmentFreezeSha256: string;
  result: ForwardChapterConductorResultV1;
  resultSha256: string;
  recordSha256: string;
};

export type ResolveStandardForwardAutopilotDepsV1 = {
  stateDir?: string;
  readText?: (path: string) => string | null;
  riskSignalsFor?: (coordinate: { bookId: string; chapterNumber: number }) => ForwardAuthoringRiskSignalsV1;
  loadReviewEvidence?: (prepared: PreparedAuthorCandidate) => Promise<ForwardReviewEvidenceV1> | ForwardReviewEvidenceV1;
  reviewerExecutor?: ForwardReviewerExecutor;
  readBookAcceptance?: (bookId: string, runtime: ResolvedForwardLocalRuntimeV1, stateDir: string) => ForwardBookAcceptanceStatusV1;
  runtimeDeps?: RunLocalAuthoringChapterDepsV1;
  /** Hermetic test seam. Production always re-hashes the live source/schema
   * files named by the frozen qualification spec. */
  verifyCurrentInstrumentBinding?: (
    binding: ForwardQualificationInstrumentBindingV1 | InstrumentCertificationBindingV3,
    qualificationExperimentId: string,
  ) => string;
  loadChapters?: typeof loadBookChapters;
  runBookSweep?: (
    bookId: string,
    chapters: ChapterV21[],
    deps: AutopilotDeps,
    io: AuthorReviewIo,
  ) => Promise<SweepRecord>;
};

export class ForwardLocalAutopilotError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ForwardLocalAutopilotError";
  }
}

async function prepareStandardForwardTypedRepair(args: {
  prepared: PreparedAuthorCandidate;
  complaints: string[];
  scopes: RepairScope[];
  route: { model: string; effort: "minimal" | "low" | "medium" | "high" | "xhigh" };
  authorDeps: AutopilotDeps;
}): Promise<ForwardTypedRepairProductionV1> {
  const { prepared, complaints, scopes, route, authorDeps } = args;
  const nn = String(prepared.chapterNumber).padStart(2, "0");
  const fresh = readPreparedAuthorCompilerInputs(prepared);
  if ("error" in fresh) return { ok: false, reason: `ch${nn}: typed repair refused stale compiler inputs (${fresh.error})`, failureDisposition: "INFRASTRUCTURE" };
  const findings = findingsFromComplaints(complaints, scopes);
  const decision = classifyRepairRoute(findings);
  if (decision.route !== "surgical" && decision.route !== "section") {
    return { ok: false, reason: `ch${nn}: typed repair is the wrong route (${decision.route}: ${decision.reason})`, failureDisposition: "WRONG_ROUTE" };
  }
  const menu = enumeratePatchablePaths(prepared.chapter, decision.route, scopes);
  if (menu.length === 0) return { ok: false, reason: `ch${nn}: typed repair has no patchable path; whole-chapter regeneration required`, failureDisposition: "WHOLE_CHAPTER_FAILURE" };
  const candidateName = basename(prepared.attempt.candidatePath);
  const card = buildRepairCard({
    bookId: prepared.bookId,
    chapter: prepared.chapter,
    brief: prepared.io.readBrief(prepared.bookId, prepared.chapterNumber) ?? undefined,
    complaints,
    scopes,
    relPath: candidateName,
    plan: fresh.sourcePlan,
    patchProtocol: {
      baseHash: sha256Hex(prepared.bytes),
      planHash: fresh.sourcePlanSha256,
      findingIds: findings.map((finding) => finding.findingId),
      route: decision.route,
      menu,
    },
  });
  const attempt = mintChapterAttempt({
    bookId: prepared.bookId,
    chapterNumber: prepared.chapterNumber,
    chapterId: prepared.chapterId,
    attemptKind: decision.route === "section" ? "section-repair" : "surgical-repair",
    attemptSequence: 1,
    promptSha256: sha256Hex(card),
    sourcePlanHash: fresh.sourcePlanSha256,
    inputHashes: { sourcePacket: fresh.sourcePacketSha256, sourceUsePlan: fresh.sourcePlanSha256 },
    io: prepared.io,
    seedBytes: prepared.bytes,
    attemptsRoot: prepared.io.attemptsRoot(),
  });
  const sessionId = authorDeps.mkSessionId(`forward-author-repair-ch${nn}`);
  try {
    const spawned = await authorDeps.spawn({
      task: card,
      role: "author-repair",
      sessionId,
      cwd: attempt.workspaceDir,
      sandbox: "workspace-write",
      skipGitRepoCheck: true,
      model: route.model,
      reasoningEffort: route.effort,
    });
    try { authorDeps.logSession(prepared.bookId, `forward-author-repair-ch${nn}`, spawned); } catch { /* telemetry only */ }
    if (!spawned.ok || spawned.exitCode !== 0) {
      finalizeAttempt(attempt, "validation_failed", `typed repair session exited ${spawned.exitCode}`);
      return { ok: false, reason: `ch${nn}: typed repair session exited ${spawned.exitCode}`, failureDisposition: "INFRASTRUCTURE" };
    }
  } catch (error) {
    finalizeAttempt(attempt, "infrastructure_failure", (error as Error).message);
    return { ok: false, reason: `ch${nn}: typed repair session failed (${(error as Error).message})`, failureDisposition: "INFRASTRUCTURE" };
  }
  const unexpected = unexpectedAttemptWrites(attempt, [PATCH_FILE_NAME]);
  if (unexpected.length > 0) {
    finalizeAttempt(attempt, "unexpected_write", `typed repair wrote unexpected files: ${unexpected.join(", ")}`);
    return { ok: false, reason: `ch${nn}: typed repair wrote unexpected files: ${unexpected.join(", ")}`, failureDisposition: "REPAIR_CONTENT_FAILURE" };
  }
  let patch: ChapterPatchV1;
  try { patch = JSON.parse(readFileSync(resolve(attempt.workspaceDir, PATCH_FILE_NAME), "utf8")) as ChapterPatchV1; }
  catch (error) {
    finalizeAttempt(attempt, "validation_failed", `typed repair patch missing/malformed: ${(error as Error).message}`);
    return { ok: false, reason: `ch${nn}: typed repair produced no valid ${PATCH_FILE_NAME}`, failureDisposition: "REPAIR_CONTENT_FAILURE" };
  }
  const applied = applyChapterPatch({
    originalBytes: prepared.bytes,
    original: prepared.chapter,
    patch,
    route: decision.route,
    plan: fresh.sourcePlan,
    issuedFindingIds: findings.map((finding) => finding.findingId),
  });
  if (!applied.ok) {
    finalizeAttempt(attempt, "validation_failed", applied.reason);
    return { ok: false, reason: `ch${nn}: typed repair patch rejected (${applied.reason})`, failureDisposition: "REPAIR_CONTENT_FAILURE" };
  }
  const drift = nonScopeDrift(prepared.chapter, applied.chapter, applied.touchedPaths);
  if (drift.length > 0) {
    finalizeAttempt(attempt, "validation_failed", `non-scope drift: ${drift.join(", ")}`);
    return { ok: false, reason: `ch${nn}: typed repair changed protected content`, failureDisposition: "REPAIR_CONTENT_FAILURE" };
  }
  const bytes = `${JSON.stringify(applied.chapter, null, 2)}\n`;
  writeFileAtomic(attempt.candidatePath, bytes);
  const canonicalPath = resolve(PIPELINE_DIR, "state", "chapters", candidateName);
  const gate = await prepared.io.gateCandidate(applied.chapter, canonicalPath, `forward-repair-${prepared.bookId}-ch${nn}`);
  if (gate.code !== 0 || !/Gate verdict: PASS/.test(`${gate.stdout}\n${gate.stderr}`)) {
    finalizeAttempt(attempt, "validation_failed", "typed repair candidate failed deterministic gate");
    return { ok: false, reason: `ch${nn}: typed repair candidate failed deterministic gate`, failureDisposition: "REPAIR_CONTENT_FAILURE" };
  }
  const rubric = await prepared.io.rubricWithCandidate(prepared.bookId, prepared.chapterNumber, applied.chapter);
  if (rubric.code !== 0 || `${rubric.stdout}\n${rubric.stderr}`.split("\n").some((line) => line.trim().startsWith(`ch${nn}:`) && line.includes("FAIL"))) {
    finalizeAttempt(attempt, "validation_failed", "typed repair candidate failed rubric preflight");
    return { ok: false, reason: `ch${nn}: typed repair candidate failed rubric preflight`, failureDisposition: "REPAIR_CONTENT_FAILURE" };
  }
  return {
    ok: true,
    sessionId,
    committed: false,
    pending: {
      bookId: prepared.bookId,
      chapterNumber: prepared.chapterNumber,
      chapterId: prepared.chapterId,
      sessionId,
      attempt,
      bytes,
      chapter: applied.chapter,
      plan: fresh.sourcePlan,
      pendingLeadOverride: null,
      io: prepared.io,
    },
  };
}

function defaultReadText(path: string): string | null {
  if (!existsSync(path)) return null;
  return readFileSync(path, "utf8");
}

function hashWithout(value: Record<string, unknown>, field: string): string {
  const draft = { ...value };
  delete draft[field];
  return hashCanonical(draft);
}

function readRequiredJson(
  stateDir: string,
  relPath: string,
  readText: (path: string) => string | null,
): { path: string; value: Record<string, unknown> } {
  const path = resolve(stateDir, relPath);
  const text = readText(path);
  if (text === null) throw new ForwardLocalAutopilotError(`ACTIVE forward runtime current artifact is missing: ${path}`);
  try {
    const value = JSON.parse(text) as unknown;
    if (value === null || typeof value !== "object" || Array.isArray(value)) throw new Error("expected a JSON object");
    return { path, value: value as Record<string, unknown> };
  } catch (error) {
    throw new ForwardLocalAutopilotError(`ACTIVE forward runtime current artifact is malformed (${path}): ${(error as Error).message}`);
  }
}

function currentEvidenceHash(
  kind: "pilot" | "gold",
  artifact: { path: string; value: Record<string, unknown> },
  identity: "legacy-v1" | "imp24-v2-envelope" = "legacy-v1",
): string {
  const value = artifact.value as unknown as ForwardLocalCurrentEvidenceV1;
  if (value.schema !== FORWARD_LOCAL_CURRENT_EVIDENCE_SCHEMA || value.kind !== kind) {
    throw new ForwardLocalAutopilotError(`${artifact.path}: current ${kind} evidence schema/kind mismatch`);
  }
  if (!SHA256.test(value.payloadSha256 ?? "") || value.payloadSha256 !== hashCanonical(value.payload)) {
    throw new ForwardLocalAutopilotError(`${artifact.path}: current ${kind} payload hash drift`);
  }
  if (!SHA256.test(value.evidenceSha256 ?? "") || value.evidenceSha256 !== hashWithout(artifact.value, "evidenceSha256")) {
    throw new ForwardLocalAutopilotError(`${artifact.path}: current ${kind} evidence hash drift`);
  }
  const payload = value.payload as Record<string, unknown> | null;
  if (!payload || payload.schema !== "forward-validation-campaign-result-v1" || payload.kind !== kind
      || payload.accepted !== true || !Array.isArray(payload.hardFailures) || payload.hardFailures.length !== 0) {
    throw new ForwardLocalAutopilotError(`${artifact.path}: current ${kind} payload is not an accepted campaign result`);
  }
  if (identity === "imp24-v2-envelope") {
    const expectedExperimentId = kind === "pilot" ? PILOT_ENVELOPE_EXPERIMENT_ID : GOLD_ENVELOPE_EXPERIMENT_ID;
    if (payload.experimentId !== expectedExperimentId) {
      throw new ForwardLocalAutopilotError(`${artifact.path}: current ${kind} payload is not the fresh v2-envelope identity`);
    }
    if (!payload.capabilitiesUsed || !Object.values(payload.capabilitiesUsed as Record<string, unknown>).every((entry) => entry === false)) {
      throw new ForwardLocalAutopilotError(`${artifact.path}: current ${kind} payload used an external capability`);
    }
  }
  const accounting = payload.accounting as Record<string, unknown> | null;
  if (!accounting || accounting.finalPassRate !== 1 || typeof accounting.firstWritePassRate !== "number"
      || accounting.firstWritePassRate < 0.75 || accounting.finalSourceBlockers !== 0
      || accounting.finalQuizBlockers !== 0 || accounting.finalReaderHardBlockers !== 0
      || accounting.stateProvenanceSchemaFailures !== 0 || accounting.unexpectedWrites !== 0
      || accounting.staleEvidenceAccepted !== 0) {
    throw new ForwardLocalAutopilotError(`${artifact.path}: current ${kind} accounting does not meet forward acceptance`);
  }
  if (kind === "pilot" && accounting.totalChapters !== 8) {
    throw new ForwardLocalAutopilotError(`${artifact.path}: current pilot does not contain exactly eight chapters`);
  }
  if (identity === "imp24-v2-envelope" && kind === "gold" && accounting.totalChapters !== 13) {
    throw new ForwardLocalAutopilotError(`${artifact.path}: current envelope gold does not contain the complete thirteen-chapter book`);
  }
  if (identity === "imp24-v2-envelope") {
    for (const field of [
      "wrongQuizKeys", "unsupportedSourceBoundInventedDetails", "misleadingConstructedFraming",
      "genericHistoricalSpecificityLeaks", "repeatedOrUnboundedRepair",
    ] as const) {
      if (accounting[field] !== 0) {
        throw new ForwardLocalAutopilotError(`${artifact.path}: current ${kind} accounting has ${field}=${String(accounting[field])}`);
      }
    }
    const finals = payload.finalByChapter as Record<string, Record<string, unknown>> | null;
    if (!finals || Object.keys(finals).length !== accounting.totalChapters
        || Object.values(finals).some((entry) => {
          const aggregate = entry.aggregate as Record<string, unknown> | null;
          const envelope = entry.executionEnvelope as Record<string, unknown> | null;
          return entry.pass !== true || entry.finalStatus !== "PASS"
            || typeof aggregate?.readerComposite !== "number" || aggregate.readerComposite < 80
            || envelope?.finalStatus !== "PASS";
        })) {
      throw new ForwardLocalAutopilotError(`${artifact.path}: current ${kind} final chapter evidence is incomplete, stale, or below reader composite 80`);
    }
  }
  if (kind === "gold") {
    const evaluation = payload.goldEvaluation as Record<string, unknown> | null;
    const sweep = evaluation?.sweep as Record<string, unknown> | null;
    const hardGates = [
      "technicalCompleteness", "epistemicInstructionalSafety", "ethicsReaderAutonomy",
      "purposeAudienceDeclaration", "externalAccuracy",
    ];
    if (!evaluation || typeof evaluation.contentDesignScore !== "number" || evaluation.contentDesignScore < 80
        || hardGates.some((field) => evaluation[field] !== "PASS")
        || sweep?.verdict !== "PASS") {
      throw new ForwardLocalAutopilotError(`${artifact.path}: current gold evaluation/sweep does not meet acceptance`);
    }
    if (identity === "imp24-v2-envelope") {
      if (accounting.unsupportedHighSeverityCausalClaims !== 0
          || typeof accounting.fullRegenerations !== "number"
          || accounting.fullRegenerations / Number(accounting.totalChapters) > 0.25
          || typeof accounting.chaptersRequiringContentRepair !== "number"
          || accounting.chaptersRequiringContentRepair / Number(accounting.totalChapters) > 0.40) {
        throw new ForwardLocalAutopilotError(`${artifact.path}: current gold accounting violates the frozen repair/causal ceilings`);
      }
      const evidenceBinding = evaluation.evidenceBinding as Record<string, unknown> | null;
      const raters = evidenceBinding?.raters as Array<Record<string, unknown>> | undefined;
      if (!Array.isArray(raters) || raters.length !== 2
          || raters[0]?.actorId === raters[1]?.actorId
          || raters[0]?.executionId === raters[1]?.executionId) {
        throw new ForwardLocalAutopilotError(`${artifact.path}: current gold evidence lacks two distinct blind raters`);
      }
    }
  }
  return value.evidenceSha256;
}

function defaultVerifyCurrentInstrumentBinding(
  binding: ForwardQualificationInstrumentBindingV1 | InstrumentCertificationBindingV3,
  qualificationExperimentId: string,
): string {
  if (qualificationExperimentId === "s16-forward-role-qualification-v3-envelope") {
    const certification = binding as InstrumentCertificationBindingV3;
    const errors = validateImp24InstrumentCertificationBinding(certification);
    if (errors.length > 0) {
      throw new ForwardLocalAutopilotError(`current V3 instrument certification is invalid: ${errors.join("; ")}`);
    }
    const repositoryRoot = resolve(PIPELINE_DIR, "../../../..");
    const current = certifyImp24Instrument({ repositoryRoot }).report.binding;
    if (canonicalJson(current) !== canonicalJson(certification)) {
      throw new ForwardLocalAutopilotError("current V3 instrument/corpus/seal bytes differ from the activated model-free certification");
    }
    return certification.certificationSha256;
  }
  if (!/^s16-forward-role-qualification-v[1-9][0-9]*$/.test(qualificationExperimentId)) {
    throw new ForwardLocalAutopilotError(`qualification experiment identity is invalid: ${qualificationExperimentId}`);
  }
  const legacyBinding = binding as ForwardQualificationInstrumentBindingV1;
  const qualificationSpecPath = resolve(
    PIPELINE_DIR,
    "state/migration-experiments",
    qualificationExperimentId,
    "spec.json",
  );
  const specText = defaultReadText(qualificationSpecPath);
  if (specText === null) throw new ForwardLocalAutopilotError(`qualification spec is missing: ${qualificationSpecPath}`);
  const spec = JSON.parse(specText) as {
    experimentId?: string;
    instruments?: Record<string, { outputSchemaPath?: string; promptSourcePath?: string; sourcePath?: string }>;
  };
  if (spec.experimentId !== qualificationExperimentId) {
    throw new ForwardLocalAutopilotError("qualification spec identity differs from the activated qualification bundle");
  }
  const liveHash = (relPath: string | undefined, label: string): string => {
    if (!relPath || relPath.startsWith("/") || relPath.includes("..")) throw new ForwardLocalAutopilotError(`${label}: invalid frozen source path`);
    const abs = resolve(PIPELINE_DIR, relPath);
    const bytes = defaultReadText(abs);
    if (bytes === null) throw new ForwardLocalAutopilotError(`${label}: current source is missing: ${abs}`);
    return sha256Hex(bytes);
  };
  for (const role of ["reader", "source", "quiz"] as const) {
    const instrument = spec.instruments?.[role];
    if (!instrument) throw new ForwardLocalAutopilotError(`qualification spec lacks ${role} instrument paths`);
    if (liveHash(instrument.outputSchemaPath, `${role} schema`) !== legacyBinding.schemaHashes[role]) {
      throw new ForwardLocalAutopilotError(`${role} output schema changed after activation`);
    }
    if (liveHash(instrument.promptSourcePath, `${role} prompt source`) !== legacyBinding.promptSourceHashes[role]) {
      throw new ForwardLocalAutopilotError(`${role} prompt source changed after activation`);
    }
  }
  const aggregate = spec.instruments?.aggregator;
  if (liveHash(aggregate?.sourcePath, "aggregate source") !== legacyBinding.promptSourceHashes.aggregate) {
    throw new ForwardLocalAutopilotError("aggregate source changed after activation");
  }
  const { profileHash } = resolveExecutionProfile("chapter-reviewer");
  if (legacyBinding.executionRoute.executionProfileHash !== profileHash
      || legacyBinding.executionRoute.routePolicyVersion !== ROUTE_POLICY_VERSION) {
    throw new ForwardLocalAutopilotError("review execution profile or route policy changed after activation");
  }
  if (legacyBinding.instrumentVersions.reader !== READER_EXPERIENCE_RUBRIC_VERSION
      || legacyBinding.instrumentVersions.source !== SOURCE_INTEGRITY_RUBRIC_VERSION
      || legacyBinding.instrumentVersions.quiz !== QUIZ_INTEGRITY_ADJUDICATION_SCHEMA
      || legacyBinding.instrumentVersions.aggregate !== "aggregated-chapter-review-v1") {
    throw new ForwardLocalAutopilotError("review instrument version changed after activation");
  }
  return hashCanonical(legacyBinding);
}

function loadCurrentRuntimeEvidence(
  stateDir: string,
  readText: (path: string) => string | null,
  verifyInstrumentBinding: (
    binding: ForwardQualificationInstrumentBindingV1 | InstrumentCertificationBindingV3,
    qualificationExperimentId: string,
  ) => string,
): {
  evidence: { qualificationEvidenceHash: string; pilotEvidenceHash: string; goldBookEvidenceHash: string };
  instrumentBindingSha256: string;
  reviewConfigSha256: string;
  roleAssignmentFreezeSha256: string;
  noApiRoute: VerifiedNoApiRouteV1;
} {
  const qualification = readRequiredJson(stateDir, FORWARD_LOCAL_CURRENT_PATHS.qualification, readText);
  const pilot = readRequiredJson(stateDir, FORWARD_LOCAL_CURRENT_PATHS.pilot, readText);
  const gold = readRequiredJson(stateDir, FORWARD_LOCAL_CURRENT_PATHS.gold, readText);
  const instrument = readRequiredJson(stateDir, FORWARD_LOCAL_CURRENT_PATHS.instrumentBinding, readText);
  const reviewConfig = readRequiredJson(stateDir, FORWARD_LOCAL_CURRENT_PATHS.reviewConfig, readText);
  const roleFreeze = readRequiredJson(stateDir, FORWARD_LOCAL_CURRENT_PATHS.roleAssignmentFreeze, readText);
  const noApiRoute = readRequiredJson(stateDir, FORWARD_LOCAL_CURRENT_PATHS.noApiRoute, readText);

  if (qualification.value.schema === IMP24_ROLE_QUALIFICATION_RUNNER_SCHEMA) {
    const result = qualification.value as unknown as RoleQualificationRunnerResultV3;
    if (result.experimentId !== "s16-forward-role-qualification-v3-envelope"
        || result.roleSetReady !== true || result.roleSetBlockedReason !== null) {
      throw new ForwardLocalAutopilotError(`${qualification.path}: current V3 qualification is not role-ready`);
    }
    if (!SHA256.test(result.freeze?.freezeSha256 ?? "")
        || result.freeze.freezeSha256 !== hashWithout(result.freeze as unknown as Record<string, unknown>, "freezeSha256")) {
      throw new ForwardLocalAutopilotError(`${qualification.path}: current V3 qualification freeze hash drift`);
    }
    const qualificationHash = hashCanonical(result);
    const certification = instrument.value as unknown as InstrumentCertificationBindingV3;
    const certificationErrors = validateImp24InstrumentCertificationBinding(certification);
    if (certificationErrors.length > 0) {
      throw new ForwardLocalAutopilotError(`${instrument.path}: current V3 instrument certification is invalid: ${certificationErrors.join("; ")}`);
    }
    const freeze = roleFreeze.value as unknown as ForwardRoleAssignmentFreezeV3;
    if (freeze.schema !== FORWARD_ROLE_ASSIGNMENT_FREEZE_V3_SCHEMA
        || !SHA256.test(freeze.freezeSha256 ?? "")
        || freeze.freezeSha256 !== hashWithout(roleFreeze.value, "freezeSha256")) {
      throw new ForwardLocalAutopilotError(`${roleFreeze.path}: current V3 role-assignment freeze hash drift`);
    }
    if (freeze.qualificationResultSha256 !== qualificationHash
        || freeze.qualificationFreezeSha256 !== result.freeze.freezeSha256
        || freeze.instrumentCertificationSha256 !== certification.certificationSha256
        || canonicalJson(freeze.instrumentCertification) !== canonicalJson(certification)
        || freeze.corpusBundleSha256 !== certification.corpusBundleSha256
        || freeze.productionInstrumentSealSha256 !== certification.productionInstrumentSealSha256) {
      throw new ForwardLocalAutopilotError(`${roleFreeze.path}: current V3 role freeze belongs to different qualification/certification evidence`);
    }
    if (freeze.reviewConfigSha256 !== hashCanonical(freeze.reviewConfig)
        || freeze.reviewConfigSha256 !== hashCanonical(reviewConfig.value)
        || freeze.reviewConfig.reviewProtocolVersion !== "imp24-review-v2") {
      throw new ForwardLocalAutopilotError(`${reviewConfig.path}: current V3 review config is stale or not envelope V2`);
    }
    const verifiedCertificationSha256 = verifyInstrumentBinding(certification, result.experimentId);
    if (verifiedCertificationSha256 !== certification.certificationSha256) {
      throw new ForwardLocalAutopilotError(`${instrument.path}: current V3 certification verifier returned another identity`);
    }
    return {
      evidence: {
        qualificationEvidenceHash: qualificationHash,
        pilotEvidenceHash: currentEvidenceHash("pilot", pilot, "imp24-v2-envelope"),
        goldBookEvidenceHash: currentEvidenceHash("gold", gold, "imp24-v2-envelope"),
      },
      instrumentBindingSha256: verifiedCertificationSha256,
      reviewConfigSha256: freeze.reviewConfigSha256,
      roleAssignmentFreezeSha256: freeze.freezeSha256,
      noApiRoute: noApiRoute.value as unknown as VerifiedNoApiRouteV1,
    };
  }

  const qualificationHash = qualification.value.bundleSha256;
  if (typeof qualificationHash !== "string" || !SHA256.test(qualificationHash)
      || hashWithout(qualification.value, "bundleSha256") !== qualificationHash) {
    throw new ForwardLocalAutopilotError(`${qualification.path}: current qualification bundle hash drift`);
  }
  const qualificationExperimentId = (qualification.value.seal as Record<string, unknown> | undefined)?.experimentId;
  if (typeof qualificationExperimentId !== "string" || qualificationExperimentId.length === 0) {
    throw new ForwardLocalAutopilotError(`${qualification.path}: current qualification experiment identity is missing`);
  }
  const roleFreezeHash = roleFreeze.value.freezeSha256;
  if (typeof roleFreezeHash !== "string" || !SHA256.test(roleFreezeHash)
      || hashWithout(roleFreeze.value, "freezeSha256") !== roleFreezeHash) {
    throw new ForwardLocalAutopilotError(`${roleFreeze.path}: current role-assignment freeze hash drift`);
  }
  return {
    evidence: {
      qualificationEvidenceHash: qualificationHash,
      pilotEvidenceHash: currentEvidenceHash("pilot", pilot),
      goldBookEvidenceHash: currentEvidenceHash("gold", gold),
    },
    instrumentBindingSha256: verifyInstrumentBinding(
      instrument.value as unknown as ForwardQualificationInstrumentBindingV1,
      qualificationExperimentId,
    ),
    reviewConfigSha256: hashCanonical(reviewConfig.value),
    roleAssignmentFreezeSha256: roleFreezeHash,
    noApiRoute: noApiRoute.value as unknown as VerifiedNoApiRouteV1,
  };
}

/** Conservative, deterministic pre-authoring classification from compiler-owned
 * packet/plan state. It reads no candidate output and uses no environment. */
export function deriveStandardForwardRiskSignals(
  coordinate: { bookId: string; chapterNumber: number },
): ForwardAuthoringRiskSignalsV1 {
  const io = resolveAuthorIo();
  const packet = io.readPacket(coordinate.bookId, coordinate.chapterNumber);
  const plan = io.readSourcePlan(coordinate.bookId, coordinate.chapterNumber);
  const sourceUnits = plan?.units.filter((unit) => unit.origin === "source_bound") ?? [];
  const namedSourceUnits = sourceUnits.filter((unit) => typeof unit.caseId === "string" && unit.caseId.length > 0);
  const evidenceRiskText = `${packet?.sourceQuality.status ?? "missing"} ${(packet?.sourceQuality.risks ?? []).join(" ")}`;
  return {
    sparseSourceDetail: !packet || packet.sourceQuality.status === "thin" || packet.sourceQuality.status === "blocked" || packet.facts.length < 3,
    sourceBoundNamedClaimCount: namedSourceUnits.length,
    disputedOrConflictingEvidence: (packet?.facts ?? []).some((fact) =>
      fact.replicationStatus === "mixed" || fact.replicationStatus === "contested" || fact.replicationStatus === "failed")
      || /disput|conflict|contested|mixed evidence/i.test(evidenceRiskText),
    causalTeachingClaims: (plan?.units ?? []).some((unit) => unit.claimStrength === "causal"),
    difficultAttribution: namedSourceUnits.some((unit) => unit.detailSufficiency !== "full"),
    difficultQuizDesign: (plan?.units ?? []).some((unit) => unit.claimStrength === "causal" || unit.detailSufficiency === "concept_only"),
    crossChapterDependency: (packet?.forbiddenLeakage.length ?? 0) > 0,
    priorConsecutiveFailures: 0,
    sourceIntegrityAdjudication: false,
    repeatedFailureDiagnosis: false,
    finalReleaseVerification: false,
  };
}

export function loadStandardForwardReviewEvidence(prepared: PreparedAuthorCandidate): ForwardReviewEvidenceV1 {
  const read = (): { sourceSidecar: SourceSidecarV2; anchorCatalog: ReturnType<typeof buildSourceAnchorCatalog> } => {
    const sidecar = loadSourceV2Sidecar(prepared.bookId, prepared.chapterNumber) as SourceSidecarV2 | null;
    if (!sidecar) throw new ForwardLocalAutopilotError(
      `${prepared.chapterId}: authoritative source-v2 sidecar is missing; refusing forward review`,
    );
    return { sourceSidecar: sidecar, anchorCatalog: buildSourceAnchorCatalog(sidecar) };
  };
  const sourcePacket = prepared.io.readPacket(prepared.bookId, prepared.chapterNumber);
  if (!sourcePacket) throw new ForwardLocalAutopilotError(`${prepared.chapterId}: authoritative source packet is missing`);
  const first = read();
  return {
    sourcePacket,
    sourceSidecar: first.sourceSidecar,
    anchorCatalog: first.anchorCatalog,
    rereadAuthoritativeSourceEvidence: read,
  };
}

function bookAcceptancePath(stateDir: string, bookId: string): string {
  return resolve(stateDir, "books", bookId, "acceptance.json");
}

function readAcceptanceArtifact(
  stateDir: string,
  bookId: string,
  relPath: string,
  readText: (path: string) => string | null,
): { path: string; value: Record<string, unknown> } | null {
  if (typeof relPath !== "string" || relPath.length === 0 || relPath.startsWith("/") || relPath.includes("..")) return null;
  const root = resolve(stateDir, "books", bookId);
  const path = resolve(root, relPath);
  if (!path.startsWith(`${root}/`)) return null;
  const text = readText(path);
  if (text === null) return null;
  try {
    const value = JSON.parse(text) as unknown;
    return value !== null && typeof value === "object" && !Array.isArray(value)
      ? { path, value: value as Record<string, unknown> }
      : null;
  } catch { return null; }
}

type ForwardActiveRuntime = Extract<ResolvedForwardLocalRuntimeV1, { mode: "FORWARD_ACTIVE" }>;

function isForwardActiveV2Runtime(runtime: ResolvedForwardLocalRuntimeV1 | undefined): runtime is ForwardActiveRuntime {
  return runtime?.mode === "FORWARD_ACTIVE"
    && runtime.binding.schema === FORWARD_LOCAL_RUNTIME_BINDING_V2_SCHEMA;
}

function hashOrNull(value: unknown | null | undefined): string | null {
  return value === null || value === undefined ? null : hashCanonical(value);
}

function currentJudgeForPanelRole(runtime: ForwardActiveRuntime, panelRole: string | undefined): unknown | null {
  const assignment = runtime.binding.reviewConfig.roleAssignment;
  if (panelRole === "readerPrimary") return assignment.readerPrimary;
  if (panelRole === "readerAudit") return assignment.readerBackup;
  if (panelRole === "sourcePrimary") return assignment.sourcePrimary;
  if (panelRole === "sourceAdjudicator") return assignment.sourceAdjudicator;
  if (panelRole === "quizSemanticAdjudicator") return assignment.quizAdjudicator;
  return null;
}

/** Re-derive every IMP-24 identity needed by local acceptance. Content equality
 * alone is deliberately insufficient: the exact envelope/result hashes and the
 * currently activated fixed config must still agree. */
export function forwardActiveV2EvidenceProblems(
  result: ForwardChapterConductorResultV1,
  expectedContentSha256: string,
  runtime: ForwardActiveRuntime,
): string[] {
  const problems: string[] = [];
  const envelope = result.executionEnvelope;
  const authoritative = result.authoritativeV2;
  const reviewConfig = runtime.binding.reviewConfig;

  if (!authoritative) {
    problems.push("authoritative V2 review evidence is missing");
    return problems;
  }
  if (authoritative.protocolVersion !== FORWARD_PRODUCTION_REVIEW_PROTOCOL_V2
      || envelope.reviewProtocolVersion !== FORWARD_PRODUCTION_REVIEW_PROTOCOL_V2) {
    problems.push("authoritative V2 review protocol is missing or stale");
  }
  if (envelope.frozenReviewConfigSha256 !== runtime.binding.reviewConfigSha256
      || envelope.frozenReviewConfigSha256 !== hashCanonical(reviewConfig)) {
    problems.push("retained V2 review config is not the current runtime config");
  }
  if (envelope.roleAssignmentSha256 !== reviewConfig.roleAssignmentSha256) {
    problems.push("retained V2 role assignment is not current");
  }
  if (envelope.instrumentManifestSha256 !== reviewConfig.instrumentManifestSha256) {
    problems.push("retained V2 instrument manifest is not current");
  }
  if (envelope.panelPolicySha256 !== (reviewConfig.panelPolicySha256 ?? null)) {
    problems.push("retained V2 panel policy is not current");
  }

  const readerEnvelopeSha256 = authoritative.readerEnvelopeSha256;
  const sourceEnvelopeSha256s = authoritative.sourceEnvelopeSha256s;
  const quizEnvelopeSha256 = authoritative.quizEnvelopeSha256;
  if (!SHA256.test(readerEnvelopeSha256 ?? "")
      || !Array.isArray(sourceEnvelopeSha256s) || sourceEnvelopeSha256s.length === 0
      || sourceEnvelopeSha256s.some((hash) => !SHA256.test(hash))
      || !SHA256.test(quizEnvelopeSha256 ?? "")) {
    problems.push("authoritative V2 envelope hashes are incomplete");
  } else {
    const envelopeSetSha256 = productionReviewEnvelopeSetSha256({
      readerEnvelopeSha256: readerEnvelopeSha256!,
      sourceEnvelopeSha256s,
      quizEnvelopeSha256: quizEnvelopeSha256!,
    });
    if (authoritative.envelopeSetSha256 !== envelopeSetSha256
        || envelope.evidenceEnvelopeSetSha256 !== envelopeSetSha256) {
      problems.push("authoritative V2 envelope-set hash drift");
    }
  }
  if (envelope.readerEvidenceEnvelopeSha256 !== readerEnvelopeSha256
      || hashCanonical(envelope.sourceEvidenceEnvelopeSha256s ?? []) !== hashCanonical(sourceEnvelopeSha256s)
      || envelope.quizEvidenceEnvelopeSha256 !== quizEnvelopeSha256) {
    problems.push("execution envelope carries stale V2 envelope hashes");
  }

  const reader = authoritative.reader;
  const readerAudit = authoritative.readerAudit;
  const source = authoritative.source;
  const sourceAdjudication = authoritative.sourceAdjudication;
  const quiz = authoritative.quiz;
  if (!reader || reader.chapterContentSha256 !== expectedContentSha256
      || reader.evidenceEnvelopeSha256 !== readerEnvelopeSha256) {
    problems.push("authoritative reader V2 result is missing or stale");
  }
  if (readerAudit && (readerAudit.chapterContentSha256 !== expectedContentSha256
      || readerAudit.evidenceEnvelopeSha256 !== readerEnvelopeSha256)) {
    problems.push("authoritative reader-audit V2 result is stale");
  }
  if (!source || source.chapterContentSha256 !== expectedContentSha256
      || hashCanonical(source.evidenceEnvelopeSha256s ?? []) !== hashCanonical(sourceEnvelopeSha256s)
      || source.evidenceEnvelopeSha256 !== hashCanonical(sourceEnvelopeSha256s)) {
    problems.push("authoritative source V2 result is missing or stale");
  }
  if (sourceAdjudication && (sourceAdjudication.chapterContentSha256 !== expectedContentSha256
      || hashCanonical(sourceAdjudication.evidenceEnvelopeSha256s ?? []) !== hashCanonical(sourceEnvelopeSha256s)
      || sourceAdjudication.evidenceEnvelopeSha256 !== hashCanonical(sourceEnvelopeSha256s))) {
    problems.push("authoritative source-adjudicator V2 result is stale");
  }
  if (!quiz || quiz.chapterContentSha256 !== expectedContentSha256
      || quiz.evidenceEnvelopeSha256 !== quizEnvelopeSha256) {
    problems.push("authoritative quiz V2 result is missing or stale");
  }
  if (envelope.readerV2ResultSha256 !== hashOrNull(reader)
      || envelope.readerAuditV2ResultSha256 !== hashOrNull(readerAudit)
      || envelope.sourceV2ResultSha256 !== hashOrNull(source)
      || envelope.sourceAdjudicatorV2ResultSha256 !== hashOrNull(sourceAdjudication)
      || envelope.quizV2ResultSha256 !== hashOrNull(quiz)) {
    problems.push("authoritative V2 result hash drift");
  }

  for (const execution of envelope.executions) {
    const expected = execution.expected;
    const received = execution.received;
    const label = execution.panelRole ?? execution.lane;
    if (expected.reviewProtocol !== "review-evidence-envelope-v1"
        || !SHA256.test(expected.evidenceEnvelopeSha256 ?? "")
        || !SHA256.test(expected.evidenceEnvelopeBytesSha256 ?? "")) {
      problems.push(`${label}: exact evidence-envelope binding is missing`);
    }
    if ((execution.lane === "reader" && expected.evidenceEnvelopeSha256 !== readerEnvelopeSha256)
        || (execution.lane === "source" && !sourceEnvelopeSha256s.includes(expected.evidenceEnvelopeSha256 ?? ""))
        || (execution.lane === "quiz" && expected.evidenceEnvelopeSha256 !== quizEnvelopeSha256)) {
      problems.push(`${label}: execution used an envelope outside the authoritative V2 set`);
    }
    if (expected.roleAssignmentSha256 !== reviewConfig.roleAssignmentSha256
        || expected.instrumentManifestSha256 !== reviewConfig.instrumentManifestSha256
        || expected.executionProfileHash !== runtime.binding.executionProfileHash
        || expected.routePolicyVersion !== runtime.binding.routePolicyVersion) {
      problems.push(`${label}: retained execution route/config is stale`);
    }
    const judge = currentJudgeForPanelRole(runtime, execution.panelRole);
    if (!judge || execution.roleProfileSha256 !== hashCanonical({
      judge,
      executionProfileHash: runtime.binding.executionProfileHash,
      routePolicyVersion: runtime.binding.routePolicyVersion,
    })) {
      problems.push(`${label}: retained role profile is not current`);
    }
    if (execution.status === "VERIFIED" && !received) {
      problems.push(`${label}: retained VERIFIED V2 execution receipt is missing`);
    }
    if (received && (received.reviewProtocol !== expected.reviewProtocol
        || received.evidenceEnvelopeSha256 !== expected.evidenceEnvelopeSha256
        || received.evidenceEnvelopeBytesSha256 !== expected.evidenceEnvelopeBytesSha256
        || received.reviewOperationKey !== expected.reviewOperationKey
        || received.roleAssignmentSha256 !== expected.roleAssignmentSha256
        || received.instrumentManifestSha256 !== expected.instrumentManifestSha256
        || received.executionProfileHash !== expected.executionProfileHash
        || received.routePolicyVersion !== expected.routePolicyVersion)) {
      problems.push(`${label}: retained V2 receipt hash/config drift`);
    }
  }
  const sourceAdjudicationTriggered = sourceAdjudication !== null;
  const expectedPanelRoles = [
    "readerPrimary",
    ...(readerAudit !== null ? ["readerAudit"] : []),
    ...Array.from({ length: sourceEnvelopeSha256s.length }, () => "sourcePrimary"),
    ...(sourceAdjudicationTriggered
      ? Array.from({ length: sourceEnvelopeSha256s.length }, () => "sourceAdjudicator")
      : []),
    "quizSemanticAdjudicator",
  ];
  const expectedLanes = expectedPanelRoles.map((panelRole) =>
    panelRole.startsWith("reader") ? "reader" : panelRole.startsWith("source") ? "source" : "quiz");
  if (envelope.executions.map((execution) => execution.panelRole ?? "missing").join(",")
      !== expectedPanelRoles.join(",")) {
    problems.push("retained V2 result does not preserve the exact authoritative panel order");
  }
  if (envelope.executions.map((execution) => execution.lane).join(",") !== expectedLanes.join(",")) {
    problems.push("retained V2 panel roles do not match their split lanes");
  }
  problems.push(...forwardV2SourceExecutionOrderProblems({
    executions: envelope.executions,
    sourceEnvelopeSha256s,
    sourceAdjudicationTriggered,
  }));
  const readerExecutions = envelope.executions.filter((execution) => execution.lane === "reader");
  const quizExecutions = envelope.executions.filter((execution) => execution.lane === "quiz");
  if (readerExecutions.some((execution) => execution.reviewOperationKey !== "reader")
      || quizExecutions.some((execution) => execution.reviewOperationKey !== "quiz")) {
    problems.push("retained V2 reader/quiz operation keys differ from the fixed conductor identities");
  }
  const executionIds = envelope.executions.map((execution) => execution.received?.executionId ?? "");
  if (executionIds.some((executionId) => !executionId)
      || new Set(executionIds).size !== executionIds.length) {
    problems.push("retained V2 result lacks independent receipts for the complete authoritative panel");
  }
  return problems;
}

export function forwardLocalConductorAcceptanceProblems(
  result: ForwardChapterConductorResultV1,
  expectedContentSha256: string,
  expectedEnvelopeSha256: string,
  runtime?: ResolvedForwardLocalRuntimeV1,
): string[] {
  const problems: string[] = [];
  if (result.disposition !== "COMMITTED" || result.finalStatus !== "PASS") problems.push("conductor result is not a committed PASS");
  if (result.executionEnvelopeSha256 !== expectedEnvelopeSha256
      || hashCanonical(result.executionEnvelope) !== result.executionEnvelopeSha256) problems.push("execution envelope hash drift");
  if (result.executionEnvelope.candidateContentSha256 !== expectedContentSha256
      || result.executionEnvelope.disposition !== "COMMITTED" || result.executionEnvelope.finalStatus !== "PASS") problems.push("execution envelope is stale/non-PASS");
  if (!result.commitResult?.ok || !("committed" in result.commitResult) || result.commitResult.committed !== true) problems.push("canonical commit is unconfirmed");
  if (!result.reader || result.reader.blockingFindings.length !== 0) problems.push("reader hard blocker or missing reader result");
  if (!result.source || result.source.result !== "PASS" || result.source.blockingFindingIds.length !== 0) problems.push("source blocker or missing source result");
  if (!result.quiz || result.quiz.result !== "PASS"
      || result.quiz.questions.some((question) => !question.keyCorrect || !question.uniqueAnswer || !question.mechanismSupported)) problems.push("quiz blocker/wrong key or missing quiz result");
  if (!result.aggregate || result.aggregate.finalStatus !== "PASS") problems.push("aggregate is missing/non-PASS");
  else {
    const errors = validateAggregatedChapterReview(result.aggregate);
    if (errors.length > 0) problems.push(`aggregate contract invalid: ${errors.join("; ")}`);
    if (result.reader && result.source && result.quiz && result.executionEnvelope.deterministicCriticBundleSha256
        && !aggregateIsFresh(result.aggregate, {
          chapterContentSha256: expectedContentSha256,
          readerResultSha256: hashCanonical(result.reader),
          sourceResultSha256: hashCanonical(result.source),
          quizResultSha256: hashCanonical(result.quiz),
          deterministicCriticBundleSha256: result.executionEnvelope.deterministicCriticBundleSha256,
        })) problems.push("aggregate evidence is stale");
  }
  const lanes = new Set(result.executionEnvelope.executions
    .filter((execution) => execution.status === "VERIFIED")
    .map((execution) => execution.lane));
  if (result.executionEnvelope.executions.some((execution) => execution.status !== "VERIFIED")
      || !lanes.has("reader") || !lanes.has("source") || !lanes.has("quiz")) problems.push("split-lane execution receipts are incomplete/unverified");
  if (isForwardActiveV2Runtime(runtime)) {
    problems.push(...forwardActiveV2EvidenceProblems(result, expectedContentSha256, runtime));
  }
  return problems;
}

function writeJsonAtomicReadBack(path: string, value: unknown, createOnce = false): void {
  mkdirSync(dirname(path), { recursive: true });
  if (createOnce && existsSync(path)) {
    const prior = JSON.parse(readFileSync(path, "utf8")) as unknown;
    if (hashCanonical(prior) !== hashCanonical(value)) {
      throw new ForwardLocalAutopilotError(`create-once forward artifact already exists with different content: ${path}`);
    }
  } else {
    writeFileAtomic(path, `${JSON.stringify(value, null, 2)}\n`);
  }
  const readBack = JSON.parse(readFileSync(path, "utf8")) as unknown;
  if (hashCanonical(readBack) !== hashCanonical(value)) {
    throw new ForwardLocalAutopilotError(`forward artifact read-back hash mismatch: ${path}`);
  }
}

function buildForwardLocalRetainedChapterResultV2(
  result: ForwardChapterConductorResultV1,
  runtime: ForwardActiveRuntime,
): ForwardLocalRetainedChapterResultV2 {
  const draft = {
    schema: FORWARD_LOCAL_RETAINED_CHAPTER_RESULT_V2_SCHEMA,
    runtimeSha256: runtime.runtimeSha256,
    runtimeBindingSha256: runtime.binding.bindingSha256,
    reviewConfigSha256: runtime.binding.reviewConfigSha256,
    roleAssignmentFreezeSha256: runtime.binding.roleAssignmentFreezeSha256,
    result,
    resultSha256: hashCanonical(result),
  };
  return { ...draft, recordSha256: hashCanonical(draft) };
}

type RetainedChapterResultInspection = {
  result: ForwardChapterConductorResultV1 | null;
  recordSha256: string | null;
  problems: string[];
};

function inspectForwardLocalRetainedChapterResult(
  value: unknown,
  runtime: ResolvedForwardLocalRuntimeV1,
  expectedRecordSha256?: string,
): RetainedChapterResultInspection {
  if (!isForwardActiveV2Runtime(runtime)) {
    return {
      result: value && typeof value === "object" && !Array.isArray(value)
        ? value as ForwardChapterConductorResultV1
        : null,
      recordSha256: null,
      problems: [],
    };
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { result: null, recordSha256: null, problems: ["retained V2 result record is malformed"] };
  }
  const record = value as unknown as ForwardLocalRetainedChapterResultV2;
  if (record.schema !== FORWARD_LOCAL_RETAINED_CHAPTER_RESULT_V2_SCHEMA) {
    return {
      result: value as ForwardChapterConductorResultV1,
      recordSha256: null,
      problems: ["retained result lacks the current V2 runtime/config/role-freeze binding"],
    };
  }
  const problems: string[] = [];
  if (!SHA256.test(record.recordSha256 ?? "")
      || hashWithout(record as unknown as Record<string, unknown>, "recordSha256") !== record.recordSha256) {
    problems.push("retained V2 result record hash drift");
  }
  if (expectedRecordSha256 !== undefined && record.recordSha256 !== expectedRecordSha256) {
    problems.push("acceptance carries another retained V2 result record hash");
  }
  if (record.runtimeSha256 !== runtime.runtimeSha256
      || record.runtimeBindingSha256 !== runtime.binding.bindingSha256) {
    problems.push("retained V2 result belongs to another active runtime");
  }
  if (record.reviewConfigSha256 !== runtime.binding.reviewConfigSha256) {
    problems.push("retained V2 result belongs to another review config");
  }
  if (record.roleAssignmentFreezeSha256 !== runtime.binding.roleAssignmentFreezeSha256) {
    problems.push("retained V2 result belongs to another role freeze");
  }
  if (!record.result || record.resultSha256 !== hashCanonical(record.result)) {
    problems.push("retained V2 conductor-result hash drift");
  }
  return {
    result: record.result ?? null,
    recordSha256: SHA256.test(record.recordSha256 ?? "") ? record.recordSha256 : null,
    problems,
  };
}

export function forwardLocalRetainedChapterResultProblems(
  value: unknown,
  runtime: ResolvedForwardLocalRuntimeV1,
  expectedRecordSha256?: string,
): string[] {
  return inspectForwardLocalRetainedChapterResult(value, runtime, expectedRecordSha256).problems;
}

function retainStandardForwardChapterResult(
  stateDir: string,
  loadChapters: typeof loadBookChapters,
  runtime: ResolvedForwardLocalRuntimeV1,
  args: { bookId: string; chapterNumber: number; result: ForwardChapterConductorResultV1 },
): () => void {
  const chapter = loadChapters(args.bookId).find((candidate) => candidate.number === args.chapterNumber);
  if (!chapter) throw new ForwardLocalAutopilotError(`cannot retain ch${args.chapterNumber}: canonical chapter is missing after commit`);
  const contentSha256 = chapterContentHash(chapter);
  const problems = forwardLocalConductorAcceptanceProblems(
    args.result,
    contentSha256,
    args.result.executionEnvelopeSha256,
    runtime,
  );
  if (problems.length > 0) throw new ForwardLocalAutopilotError(`cannot retain ch${args.chapterNumber} conductor result: ${problems.join("; ")}`);
  const nn = String(args.chapterNumber).padStart(2, "0");
  const file = `ch${nn}.${contentSha256}.${args.result.executionEnvelopeSha256}.result.json`;
  const path = resolve(stateDir, "books", args.bookId, "chapters", file);
  const existed = existsSync(path);
  const retained = isForwardActiveV2Runtime(runtime)
    ? buildForwardLocalRetainedChapterResultV2(args.result, runtime)
    : args.result;
  try { writeJsonAtomicReadBack(path, retained, true); }
  catch (error) {
    if (!existed) rmSync(path, { force: true });
    throw error;
  }
  return existed ? (() => undefined) : (() => rmSync(path, { force: true }));
}

function currentRetainedChapterReview(
  stateDir: string,
  bookId: string,
  chapter: ChapterV21,
  runtime: ResolvedForwardLocalRuntimeV1,
): ForwardLocalBookAcceptanceV1["chapterReviews"][number] {
  const dir = resolve(stateDir, "books", bookId, "chapters");
  const contentSha256 = chapterContentHash(chapter);
  const prefix = `ch${String(chapter.number).padStart(2, "0")}.${contentSha256}.`;
  const matches = existsSync(dir) ? readdirSync(dir).filter((file) => file.startsWith(prefix) && file.endsWith(".result.json")).sort() : [];
  const valid: Array<{ file: string; result: ForwardChapterConductorResultV1; recordSha256: string | null }> = [];
  for (const file of matches) {
    try {
      const value = JSON.parse(readFileSync(resolve(dir, file), "utf8")) as unknown;
      const inspected = inspectForwardLocalRetainedChapterResult(value, runtime);
      const result = inspected.result;
      if (result && inspected.problems.length === 0
          && forwardLocalConductorAcceptanceProblems(
            result,
            contentSha256,
            result.executionEnvelopeSha256,
            runtime,
          ).length === 0) {
        valid.push({ file, result, recordSha256: inspected.recordSha256 });
      }
    } catch { /* malformed/stale retained evidence is never selected */ }
  }
  if (valid.length !== 1) {
    throw new ForwardLocalAutopilotError(`ch${String(chapter.number).padStart(2, "0")}: expected exactly one retained current committed PASS result, found ${valid.length}`);
  }
  return {
    chapterNumber: chapter.number,
    chapterContentSha256: contentSha256,
    resultRelPath: `chapters/${valid[0].file}`,
    executionEnvelopeSha256: valid[0].result.executionEnvelopeSha256,
    ...(valid[0].recordSha256 ? { retainedRecordSha256: valid[0].recordSha256 } : {}),
  };
}

type RawSweepSubmissionBindingV1 = ForwardLocalBookSweepV1["rawSweepSubmission"];

function isContainedPath(root: string, child: string): boolean {
  const rel = relative(root, child);
  return rel.length > 0 && rel !== ".." && !rel.startsWith(`..${process.platform === "win32" ? "\\" : "/"}`) && !isAbsolute(rel);
}

function readAndValidateRawSweepSubmission(
  stateDir: string,
  bookId: string,
  sweep: SweepRecord,
): RawSweepSubmissionBindingV1 {
  if (sweep.rawEvidenceSourceKind !== "raw_submission" || typeof sweep.rawSubmissionFile !== "string" || !sweep.rawSubmissionFile) {
    throw new ForwardLocalAutopilotError("current book sweep is not backed by a raw_submission file");
  }
  const path = sweep.rawSubmissionFile;
  if (!isAbsolute(path) || resolve(path) !== path) {
    throw new ForwardLocalAutopilotError("current book sweep raw submission path is not normalized absolute");
  }
  let realPath: string;
  try { realPath = realpathSync(path); }
  catch (error) { throw new ForwardLocalAutopilotError(`current book sweep raw submission is missing/unreadable: ${(error as Error).message}`); }
  const allowedRoots = [resolve(PIPELINE_DIR, "state"), resolve(stateDir)]
    .filter((root, index, all) => all.indexOf(root) === index && existsSync(root))
    .map((root) => realpathSync(root));
  if (!allowedRoots.some((root) => isContainedPath(root, realPath))) {
    throw new ForwardLocalAutopilotError(`current book sweep raw submission escapes allowed local state roots: ${path}`);
  }
  const bytes = readFileSync(path, "utf8");
  let raw: unknown;
  try { raw = JSON.parse(bytes) as unknown; }
  catch (error) { throw new ForwardLocalAutopilotError(`current book sweep raw submission is malformed JSON: ${(error as Error).message}`); }
  const validated = validateSubmission(bookId, sweep.roundId, "sweep", raw);
  if (!validated.ok) {
    throw new ForwardLocalAutopilotError(`current book sweep raw submission fails the real validator: ${validated.errors.join("; ")}`);
  }
  const submission = validated.submission as ValidatedSweepSubmission;
  if (typeof submission.reviewerSessionId !== "string" || !submission.reviewerSessionId) {
    throw new ForwardLocalAutopilotError("current book sweep raw submission lacks a reviewer session identity");
  }
  if (submission.reviewer !== sweep.reviewer || submission.reviewerSessionId !== sweep.reviewerSessionId
      || submission.verdict !== sweep.verdict
      || hashCanonical([...submission.checkedFamilies].sort()) !== hashCanonical([...sweep.checkedFamilies].sort())) {
    throw new ForwardLocalAutopilotError("current book sweep raw submission identity/verdict/families differ from its SweepRecord");
  }
  const sourceId = evidenceSourceId({
    bookId,
    roundId: sweep.roundId,
    sourceRole: "sweep",
    submissionFile: path,
    sourceKind: "raw_submission",
  });
  if (sweep.rawEvidenceSourceId !== sourceId) {
    throw new ForwardLocalAutopilotError("current book sweep raw evidence source identity is stale/tampered");
  }
  return {
    path,
    sourceId,
    bytesSha256: sha256Hex(bytes),
    contentSha256: hashCanonical(raw),
    reviewerSessionId: submission.reviewerSessionId,
  };
}

function assertCurrentSweep(
  stateDir: string,
  bookId: string,
  chapters: ChapterV21[],
  sweep: SweepRecord,
  expectedRawSubmission?: RawSweepSubmissionBindingV1,
): RawSweepSubmissionBindingV1 {
  if (sweep.schemaVersion !== "sweep-attest-v1" || sweep.bookId !== bookId || sweep.verdict !== "PASS") {
    throw new ForwardLocalAutopilotError("current book sweep is not a real PASS sweep-attest-v1 record");
  }
  for (const family of REQUIRED_SWEEP_FAMILIES) {
    if (!sweep.checkedFamilies.includes(family)) throw new ForwardLocalAutopilotError(`current book sweep omitted ${family}`);
  }
  for (const chapter of chapters) {
    if (sweep.contentHashes[String(chapter.number)] !== chapterContentHash(chapter)) {
      throw new ForwardLocalAutopilotError(`current book sweep is stale for ch${String(chapter.number).padStart(2, "0")}`);
    }
  }
  if (!sweep.reviewerSessionId) {
    throw new ForwardLocalAutopilotError("current book sweep lacks an independent reviewer session");
  }
  const raw = readAndValidateRawSweepSubmission(stateDir, bookId, sweep);
  if (expectedRawSubmission && hashCanonical(raw) !== hashCanonical(expectedRawSubmission)) {
    throw new ForwardLocalAutopilotError("current book sweep raw submission bytes/path binding changed after acceptance");
  }
  return raw;
}

async function defaultRunBookSweep(
  bookId: string,
  chapters: ChapterV21[],
  deps: AutopilotDeps,
  io: AuthorReviewIo,
): Promise<SweepRecord> {
  const opened = io.acceptance.openRound(bookId);
  const produced = await io.evidence.runSweep(bookId, chapters, deps, io, opened);
  if (!produced.ok) throw new ForwardLocalAutopilotError(`forward book sweep failed: ${produced.reason}`);
  const sweep = loadSweepRecord(bookId);
  if (!sweep) throw new ForwardLocalAutopilotError("forward book sweep reported success but no current SweepRecord exists");
  return sweep;
}

async function finalizeStandardForwardBookAcceptance(args: {
  bookId: string;
  runtime: ResolvedForwardLocalRuntimeV1;
  stateDir: string;
  deps: AutopilotDeps;
  authorIo?: Partial<AuthorReviewIo>;
  loadChapters: typeof loadBookChapters;
  runBookSweep: NonNullable<ResolveStandardForwardAutopilotDepsV1["runBookSweep"]>;
}): Promise<ForwardBookAcceptanceStatusV1> {
  const artifactPath = bookAcceptancePath(args.stateDir, args.bookId);
  if (args.runtime.mode !== "FORWARD_ACTIVE") return { accepted: false, reason: "forward activation is not ACTIVE", artifactPath };
  try {
    const chapters = [...args.loadChapters(args.bookId)].sort((a, b) => a.number - b.number);
    if (chapters.length === 0) throw new ForwardLocalAutopilotError("cannot finalize an empty book");
    const chapterReviews = chapters.map((chapter) => currentRetainedChapterReview(
      args.stateDir,
      args.bookId,
      chapter,
      args.runtime,
    ));
    const io = resolveAuthorReviewIo(args.authorIo);
    const sourceSweep = await args.runBookSweep(args.bookId, chapters, args.deps, io);
    const rawSweepSubmission = assertCurrentSweep(args.stateDir, args.bookId, chapters, sourceSweep);
    const sourceSweepSha256 = hashCanonical(sourceSweep);
    const sweepDraft = {
      schema: "forward-local-book-sweep-v1" as const,
      bookId: args.bookId,
      verdict: "PASS" as const,
      chapterContentHashes: Object.fromEntries(chapters.map((chapter) => [String(chapter.number), chapterContentHash(chapter)])),
      checkedFamilies: [...REQUIRED_SWEEP_FAMILIES],
      sourceSweep,
      sourceSweepSha256,
      rawSweepSubmission,
      hardGateFailures: [] as [],
    };
    const sweep: ForwardLocalBookSweepV1 = { ...sweepDraft, sweepSha256: hashCanonical(sweepDraft) };
    const sweepFile = `sweep/${sourceSweep.roundId}.${sweep.sweepSha256}.json`;
    writeJsonAtomicReadBack(resolve(args.stateDir, "books", args.bookId, sweepFile), sweep, true);
    const acceptanceDraft = {
      schema: FORWARD_LOCAL_BOOK_ACCEPTANCE_SCHEMA,
      bookId: args.bookId,
      accepted: true as const,
      activationPolicySha256: hashCanonical(args.runtime.policy),
      runtimeBindingSha256: args.runtime.binding.bindingSha256,
      chapterReviews,
      bookSweep: { verdict: "PASS" as const, artifactRelPath: sweepFile, evidenceSha256: sweep.sweepSha256 },
      hardGateFailures: [] as [],
      publish: false as const,
      promotion: false as const,
      deployment: false as const,
      upload: false as const,
    };
    const acceptance: ForwardLocalBookAcceptanceV1 = { ...acceptanceDraft, acceptanceSha256: hashCanonical(acceptanceDraft) };
    // Acceptance is deliberately last: no partial result/sweep write can make
    // the book READY. Atomic write + full read-back validation is the commit.
    writeJsonAtomicReadBack(artifactPath, acceptance, false);
    return defaultReadBookAcceptance(args.bookId, args.runtime, args.stateDir, defaultReadText, args.loadChapters);
  } catch (error) {
    return { accepted: false, reason: `forward book acceptance finalization refused: ${(error as Error).message}`, artifactPath };
  }
}

function claimStandardForwardGateCorrection(args: {
  stateDir: string;
  runtime: ResolvedForwardLocalRuntimeV1;
  bookId: string;
  chapterNumber: number;
  complaints: string[];
  loadChapters: typeof loadBookChapters;
}): { claimed: boolean; reason: string } {
  if (args.runtime.mode !== "FORWARD_ACTIVE") return { claimed: false, reason: "forward activation is not ACTIVE" };
  const nn = String(args.chapterNumber).padStart(2, "0");
  const path = resolve(args.stateDir, "books", args.bookId, "gate-corrections", `ch${nn}.${args.runtime.binding.bindingSha256}.json`);
  if (existsSync(path)) return { claimed: false, reason: `ch${nn}: ACTIVE gate correction budget already consumed for this runtime binding` };
  const chapter = args.loadChapters(args.bookId).find((candidate) => candidate.number === args.chapterNumber);
  if (!chapter) return { claimed: false, reason: `ch${nn}: canonical chapter is missing` };
  const record = {
    schema: "forward-local-gate-correction-claim-v1",
    bookId: args.bookId,
    chapterNumber: args.chapterNumber,
    chapterContentSha256Before: chapterContentHash(chapter),
    runtimeBindingSha256: args.runtime.binding.bindingSha256,
    complaints: [...args.complaints],
    complaintsSha256: hashCanonical(args.complaints),
  };
  try { writeJsonAtomicReadBack(path, record, true); }
  catch (error) { return { claimed: false, reason: `ch${nn}: gate-correction claim failed: ${(error as Error).message}` }; }
  return { claimed: true, reason: `ch${nn}: claimed the one ACTIVE gate-correction regeneration` };
}

function defaultReadBookAcceptance(
  bookId: string,
  runtime: ResolvedForwardLocalRuntimeV1,
  stateDir: string,
  readText: (path: string) => string | null,
  loadChapters: typeof loadBookChapters,
): ForwardBookAcceptanceStatusV1 {
  const artifactPath = bookAcceptancePath(stateDir, bookId);
  if (runtime.mode !== "FORWARD_ACTIVE") return { accepted: false, reason: "forward activation is not ACTIVE", artifactPath };
  const text = readText(artifactPath);
  if (text === null) return {
    accepted: false,
    reason: `forward book acceptance is pending (${artifactPath}); legacy ship84 review is not eligible`,
    artifactPath,
  };
  let value: ForwardLocalBookAcceptanceV1;
  try { value = JSON.parse(text) as ForwardLocalBookAcceptanceV1; }
  catch (error) { return { accepted: false, reason: `forward book acceptance is malformed: ${(error as Error).message}`, artifactPath }; }
  const { acceptanceSha256: _acceptanceSha256, ...draft } = value;
  const failures: string[] = [];
  if (value.schema !== FORWARD_LOCAL_BOOK_ACCEPTANCE_SCHEMA || value.bookId !== bookId || value.accepted !== true) failures.push("schema/book/accepted mismatch");
  if (!SHA256.test(value.acceptanceSha256 ?? "") || hashCanonical(draft) !== value.acceptanceSha256) failures.push("acceptance hash drift");
  if (value.activationPolicySha256 !== hashCanonical(runtime.policy)) failures.push("activation policy drift");
  if (value.runtimeBindingSha256 !== runtime.binding.bindingSha256) failures.push("runtime binding drift");
  if (value.bookSweep?.verdict !== "PASS" || !SHA256.test(value.bookSweep?.evidenceSha256 ?? "")) failures.push("book sweep is not a bound PASS");
  if (!Array.isArray(value.hardGateFailures) || value.hardGateFailures.length !== 0) failures.push("hard-gate failures remain");
  if (value.publish !== false || value.promotion !== false || value.deployment !== false || value.upload !== false) failures.push("external capability enabled");
  let chapters: ReturnType<typeof loadBookChapters> = [];
  try { chapters = loadChapters(bookId); }
  catch (error) { failures.push(`canonical chapters unreadable: ${(error as Error).message}`); }
  if (!Array.isArray(value.chapterReviews) || value.chapterReviews.length !== chapters.length || chapters.length === 0) {
    failures.push("chapter review set is incomplete");
  } else {
    const byNumber = new Map(value.chapterReviews.map((review) => [review.chapterNumber, review]));
    for (const chapter of chapters) {
      const review = byNumber.get(chapter.number);
      const contentSha256 = chapterContentHash(chapter);
      const retained = review
        ? readAcceptanceArtifact(stateDir, bookId, review.resultRelPath, readText)
        : null;
      const inspected = retained && review
        ? inspectForwardLocalRetainedChapterResult(retained.value, runtime, review.retainedRecordSha256)
        : null;
      const result = inspected?.result ?? null;
      if (isForwardActiveV2Runtime(runtime) && !SHA256.test(review?.retainedRecordSha256 ?? "")) {
        failures.push(`ch${String(chapter.number).padStart(2, "0")}: acceptance lacks the retained V2 record hash`);
      }
      if (!review || review.chapterContentSha256 !== contentSha256 || !SHA256.test(review.executionEnvelopeSha256 ?? "") || !result) {
        failures.push(`ch${String(chapter.number).padStart(2, "0")} review is missing or stale`);
      } else {
        try {
          failures.push(...(inspected?.problems ?? [])
            .map((problem) => `ch${String(chapter.number).padStart(2, "0")}: ${problem}`));
          failures.push(...forwardLocalConductorAcceptanceProblems(
            result,
            contentSha256,
            review.executionEnvelopeSha256,
            runtime,
          )
            .map((problem) => `ch${String(chapter.number).padStart(2, "0")}: ${problem}`));
        } catch (error) {
          failures.push(`ch${String(chapter.number).padStart(2, "0")}: malformed conductor result (${(error as Error).message})`);
        }
      }
    }
  }
  const retainedSweep = value.bookSweep
    ? readAcceptanceArtifact(stateDir, bookId, value.bookSweep.artifactRelPath, readText)
    : null;
  const sweep = retainedSweep?.value as unknown as ForwardLocalBookSweepV1 | undefined;
  if (!sweep) failures.push("book sweep artifact is missing/unreadable");
  else {
    const { sweepSha256: _sweepSha256, ...sweepDraft } = sweep;
    if (sweep.schema !== "forward-local-book-sweep-v1" || sweep.bookId !== bookId || sweep.verdict !== "PASS"
        || !SHA256.test(sweep.sweepSha256 ?? "") || hashCanonical(sweepDraft) !== sweep.sweepSha256
        || sweep.sweepSha256 !== value.bookSweep.evidenceSha256) failures.push("book sweep artifact hash/verdict drift");
    if (!sweep.sourceSweep || sweep.sourceSweepSha256 !== hashCanonical(sweep.sourceSweep)) {
      failures.push("book sweep lacks its real source SweepRecord binding");
    } else if (!sweep.rawSweepSubmission
        || typeof sweep.rawSweepSubmission.path !== "string"
        || !SHA256.test(sweep.rawSweepSubmission.bytesSha256 ?? "")
        || !SHA256.test(sweep.rawSweepSubmission.contentSha256 ?? "")
        || typeof sweep.rawSweepSubmission.sourceId !== "string"
        || typeof sweep.rawSweepSubmission.reviewerSessionId !== "string") {
      failures.push("book sweep lacks its raw submission bytes/path binding");
    } else {
      try { assertCurrentSweep(stateDir, bookId, chapters, sweep.sourceSweep, sweep.rawSweepSubmission); }
      catch (error) { failures.push((error as Error).message); }
    }
    if (!Array.isArray(sweep.hardGateFailures) || sweep.hardGateFailures.length !== 0) failures.push("book sweep carries hard-gate failures");
    for (const family of SWEEP_FAMILIES) if (!sweep.checkedFamilies?.includes(family)) failures.push(`book sweep omitted ${family}`);
    for (const chapter of chapters) {
      if (sweep.chapterContentHashes?.[String(chapter.number)] !== chapterContentHash(chapter)) {
        failures.push(`book sweep is stale for ch${String(chapter.number).padStart(2, "0")}`);
      }
    }
  }
  return failures.length === 0
    ? { accepted: true, reason: "fresh forward split-lane chapter evidence and book sweep PASS", artifactPath }
    : { accepted: false, reason: `forward book acceptance refused: ${failures.join("; ")}`, artifactPath };
}

/** Resolve the exact normal-path control. This function reads only local files;
 * the real reviewer executor is constructed but cannot spawn until a chapter is
 * actually authored under an ACTIVE policy. */
export function resolveStandardForwardAutopilotControl(
  deps: ResolveStandardForwardAutopilotDepsV1 = {},
): ForwardAutopilotControlV1 {
  const stateDir = deps.stateDir ?? FORWARD_LOCAL_STATE_DIR;
  const activationPolicyPath = resolve(stateDir, "activation-policy.json");
  const runtimeBindingPath = resolve(stateDir, "runtime-binding.json");
  const readText = deps.readText ?? defaultReadText;
  const activationPolicyText = readText(activationPolicyPath);

  let runtime: ResolvedForwardLocalRuntimeV1;
  if (activationPolicyText === null) {
    runtime = resolveForwardLocalRuntime({ activationPolicyText: null });
  } else {
    const policy = parseForwardActivationPolicy(activationPolicyText);
    if (policy.status === "ROLLED_BACK") {
      runtime = resolveForwardLocalRuntime({ activationPolicyText });
    } else {
      const runtimeBindingText = readText(runtimeBindingPath);
      if (runtimeBindingText === null) throw new ForwardLocalAutopilotError(
        `ACTIVE forward policy exists but runtime binding is missing: ${runtimeBindingPath}`,
      );
      const binding = parseForwardLocalRuntimeBinding(runtimeBindingText);
      const current = loadCurrentRuntimeEvidence(
        stateDir,
        readText,
        deps.verifyCurrentInstrumentBinding ?? defaultVerifyCurrentInstrumentBinding,
      );
      runtime = resolveForwardLocalRuntime({
        activationPolicyText,
        runtimeBindingText,
        currentEvidence: current.evidence,
        currentNoApiRoute: current.noApiRoute,
        currentInstrumentBindingSha256: current.instrumentBindingSha256,
        currentReviewConfigSha256: current.reviewConfigSha256,
        currentRoleAssignmentFreezeSha256: current.roleAssignmentFreezeSha256,
      });
    }
  }

  const riskSignalsFor = deps.riskSignalsFor ?? deriveStandardForwardRiskSignals;
  const reviewerExecutor = runtime.mode === "FORWARD_ACTIVE"
    ? (deps.reviewerExecutor ?? createForwardReviewerExecutor())
    : undefined;
  const loadReviewEvidence = runtime.mode === "FORWARD_ACTIVE"
    ? (deps.loadReviewEvidence ?? loadStandardForwardReviewEvidence)
    : undefined;
  const writeOneChapter = createForwardAuthorChapterWriter({
    runtime,
    riskSignalsFor,
    loadReviewEvidence,
    reviewerExecutor,
    retainCommittedResult: runtime.mode === "FORWARD_ACTIVE"
      ? (args) => retainStandardForwardChapterResult(
          stateDir,
          deps.loadChapters ?? loadBookChapters,
          runtime,
          args,
        )
      : undefined,
  }, {
    ...deps.runtimeDeps,
    prepareTypedRepair: deps.runtimeDeps?.prepareTypedRepair ?? (runtime.mode === "FORWARD_ACTIVE"
      ? (request) => prepareStandardForwardTypedRepair(request)
      : undefined),
  });
  const readBookAcceptance = deps.readBookAcceptance
    ? (bookId: string) => deps.readBookAcceptance!(bookId, runtime, stateDir)
    : (bookId: string) => defaultReadBookAcceptance(bookId, runtime, stateDir, readText, deps.loadChapters ?? loadBookChapters);
  const finalizeBookAcceptance = runtime.mode === "FORWARD_ACTIVE"
    ? (bookId: string, autopilotDeps: AutopilotDeps, authorIo?: Partial<AuthorReviewIo>) => finalizeStandardForwardBookAcceptance({
        bookId,
        runtime,
        stateDir,
        deps: autopilotDeps,
        authorIo,
        loadChapters: deps.loadChapters ?? loadBookChapters,
        runBookSweep: deps.runBookSweep ?? defaultRunBookSweep,
      })
    : undefined;
  const claimGateCorrection = runtime.mode === "FORWARD_ACTIVE"
    ? (bookId: string, chapterNumber: number, complaints: string[]) => claimStandardForwardGateCorrection({
        stateDir,
        runtime,
        bookId,
        chapterNumber,
        complaints,
        loadChapters: deps.loadChapters ?? loadBookChapters,
      })
    : undefined;
  return {
    runtime,
    writeOneChapter,
    readBookAcceptance,
    finalizeBookAcceptance,
    claimGateCorrection,
    activationPolicyPath,
    runtimeBindingPath,
  };
}
