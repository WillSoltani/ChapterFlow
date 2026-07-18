/**
 * Durable IMP-24 pilot/gold evidence verification for local activation.
 *
 * A campaign result is only a summary.  This verifier reconstructs its trust
 * from the explicit phase directory: frozen manifest/input denominator,
 * preflight, call budget, live call ledger, every request/receipt pair, every
 * persisted attempt and first-write snapshot, and (for gold) both blind-rater
 * artifacts, the adjudicator artifact, and the independent sweep artifact.
 *
 * The returned value carries a private in-process brand.  Local activation can
 * therefore accept only evidence that this verifier has just read and checked;
 * a caller-created/self-hashed JSON summary cannot stand in for a live run.
 */

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { relative, resolve } from "node:path";

import { canonicalJson, hashCanonical, sha256Hex } from "../contracts/contractUtil.js";
import { chapterContentHash } from "../critics/qcAttestation.js";
import type { ChapterV21 } from "../types.js";
import {
  canonicalReviewEvidenceEnvelope,
  validateReviewEvidenceEnvelope,
  type ReviewEvidenceEnvelopeV1,
} from "../contracts/reviewEvidenceEnvelope.js";
import { REQUIRED_SWEEP_FAMILIES } from "../qc/sweep.js";
import {
  FORWARD_PRODUCTION_REVIEW_PROTOCOL_V2,
  productionReviewEnvelopeSetSha256,
} from "../review/forwardProductionReviewV2.js";
import {
  assertForwardInputFreezeFresh,
  type ForwardInputFreezeV1,
} from "./forwardInputFreeze.js";
import {
  FORWARD_LIVE_CALL_CATEGORIES,
  FORWARD_LIVE_CALL_LEDGER_SCHEMA,
  FORWARD_LIVE_CALL_RECEIPT_SCHEMA,
  FORWARD_LIVE_MODEL_OPERATION_RECEIPT_SCHEMA,
  FORWARD_LIVE_PHASE_BUDGET_SCHEMA,
  buildForwardLivePhaseBudget,
  type ForwardLiveCallCategory,
  type ForwardLiveCallEntryV1,
  type ForwardLiveCallLedgerV1,
  type ForwardLiveCallStatus,
  type ForwardLivePhaseBudgetV1,
} from "./forwardLiveCallLedger.js";
import {
  FORWARD_LIVE_CAMPAIGN_PREFLIGHT_V3_SCHEMA,
  FORWARD_LIVE_CAMPAIGN_RESULT_V3_SCHEMA,
  buildForwardGoldAdjudicatorPreDispatchTask,
  buildForwardGoldEvaluatorBaseTask,
  buildForwardGoldSweepPreDispatchTask,
  buildForwardGoldWorkerDispatchBinding,
  validateForwardInputMaterializationArtifact,
  validateForwardGoldEvaluationArtifacts,
  type ForwardInputMaterializationProofV1,
  type ForwardLiveCampaignPreflightV3,
  type RunForwardLiveCampaignResultV3,
} from "./forwardLiveValidationDriver.js";
import {
  buildForwardGoldComponentInventory,
  buildForwardGoldEvaluatorInstrument,
  buildForwardGoldSourceAwareExternalAccuracyProof,
  materializeForwardGoldSweepOutputSchema,
  projectForwardGoldAdjudication,
  validateForwardGoldBlindRaterOutput,
  validateForwardGoldSweepOutputBinding,
  type ForwardGoldExpectedChapterIdentityV1,
  type ForwardGoldSourceLaneEvidenceV1,
} from "./forwardGoldEvaluatorInstrument.js";
import {
  FORWARD_ATTEMPT_RECORD_SCHEMA,
  FORWARD_FIRST_WRITE_SNAPSHOT_SCHEMA,
  FORWARD_GOLD_EVIDENCE_SCHEMA,
  FORWARD_PERSISTENCE_RECEIPT_SCHEMA,
  FORWARD_VALIDATION_RESULT_SCHEMA,
  GOLD_ENVELOPE_EXPERIMENT_ID,
  PILOT_ENVELOPE_EXPERIMENT_ID,
  assertManifest,
  forwardV2SourceExecutionOrderProblems,
  type ForwardAcceptanceAccountingV1,
  type ForwardGoldEvidenceArtifactV1,
  type ForwardGoldPersistedEvidenceRefV1,
  type ForwardPersistenceReceiptV1,
  type ForwardValidationAttemptRecordV1,
  type ForwardValidationCampaignResultV1,
  type ForwardValidationManifestV1,
  type FrozenForwardValidationManifestV1,
} from "./forwardValidationCampaign.js";
import type {
  ForwardChapterConductorResultV1,
  ForwardReviewExecutionEntryV1,
} from "./forwardChapterConductor.js";
import { type ForwardRoleAssignmentFreezeV3 } from "./forwardRoleAssignmentFreezeV3.js";
import { isInForwardReaderAuditSubset } from "./forwardReviewPolicy.js";
import { IMP22_FORWARD_INPUT_EXPECTED_HASHES } from "./forwardInputMaterialization.js";

export const IMP24_RETAINED_CAMPAIGN_EVIDENCE_PROOF_SCHEMA =
  "imp24-retained-forward-campaign-evidence-proof-v1" as const;

const SHA256 = /^[a-f0-9]{64}$/;
const CHAPTER_CONTENT_HASH = /^[a-f0-9]{16}$/;
const PILOT_CORRECTION_ID = /^s16-forward-sol-pilot-v2-envelope(?:-correction-[12])?$/;
const VERIFIED_RETAINED_CAMPAIGN = Symbol("verified-retained-forward-campaign-v3");

const ZERO_CAPABILITIES = Object.freeze({
  publish: false,
  promote: false,
  deploy: false,
  upload: false,
} as const);

export class ForwardRetainedCampaignEvidenceV3Error extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ForwardRetainedCampaignEvidenceV3Error";
  }
}

function requireCondition(condition: unknown, message: string): asserts condition {
  if (!condition) throw new ForwardRetainedCampaignEvidenceV3Error(message);
}

function requireSha(value: unknown, label: string): asserts value is string {
  requireCondition(typeof value === "string" && SHA256.test(value), `${label} must be a lowercase sha256`);
}

function requireChapterContentHash(value: unknown, label: string): asserts value is string {
  requireCondition(typeof value === "string" && CHAPTER_CONTENT_HASH.test(value),
    `${label} must be the canonical 16-hex ChapterV21 content hash`);
}

function parseJson<T>(path: string, label: string): T {
  try {
    return JSON.parse(readFileSync(path, "utf8")) as T;
  } catch (error) {
    throw new ForwardRetainedCampaignEvidenceV3Error(`${label} is not retained valid JSON at ${path}: ${(error as Error).message}`);
  }
}

function artifactBytesSha256(path: string, label: string): string {
  requireCondition(existsSync(path), `${label} is not retained at ${path}`);
  return sha256Hex(readFileSync(path));
}

function hashWithout(value: Record<string, unknown>, field: string): string {
  const copy = { ...value };
  delete copy[field];
  return hashCanonical(copy);
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

function filesBelow(root: string): string[] {
  if (!existsSync(root)) return [];
  const files: string[] = [];
  const walk = (path: string): void => {
    for (const name of readdirSync(path)) {
      const child = resolve(path, name);
      if (statSync(child).isDirectory()) walk(child);
      else files.push(relative(root, child));
    }
  };
  walk(root);
  return files.sort((left, right) => left.localeCompare(right));
}

function allFalse(value: unknown): boolean {
  return value !== null
    && typeof value === "object"
    && !Array.isArray(value)
    && Object.values(value as Record<string, unknown>).every((entry) => entry === false);
}

function chapterKey(value: { bookId: string; chapterNumber: number }): string {
  return `${value.bookId}/ch${String(value.chapterNumber).padStart(2, "0")}`;
}

function expectedTargets(
  kind: "pilot" | "gold",
  freeze: ForwardInputFreezeV1,
): ForwardInputFreezeV1["pilot"][number]["chapters"] {
  return kind === "pilot" ? freeze.pilot.flatMap((book) => book.chapters) : freeze.gold.chapters;
}

function validateExactDenominator(
  kind: "pilot" | "gold",
  manifest: ForwardValidationManifestV1,
  freeze: ForwardInputFreezeV1,
): void {
  assertForwardInputFreezeFresh(freeze);
  requireCondition(freeze.freezeSha256 === IMP22_FORWARD_INPUT_EXPECTED_HASHES.freezeSha256,
    `${kind} input freeze is not the exact frozen IMP-24 denominator`);
  requireCondition(
    freeze.sets.pilotBookIds.length === 2
      && freeze.sets.pilotBookIds.includes("radical-candor")
      && freeze.sets.pilotBookIds.includes("start-with-why"),
    "pilot input freeze does not contain the exact two frozen books",
  );
  requireCondition(
    freeze.sets.goldBookIds.length === 1
      && freeze.sets.goldBookIds[0] === "the-gifts-of-imperfection",
    "gold input freeze does not contain the exact frozen full book",
  );

  const expected = expectedTargets(kind, freeze);
  requireCondition(manifest.targets.length === expected.length,
    `${kind} manifest denominator ${manifest.targets.length} differs from frozen ${expected.length}`);
  const byKey = new Map(expected.map((target) => [chapterKey(target), target]));
  const frozenFields = [
    "bookId", "chapterNumber", "chapterId", "stratum", "sourceArchiveId", "sourceComplete", "evidenceFresh",
    "sourcePacketSha256", "sourceUsePlanSha256", "sidecarSha256", "anchorCatalogSha256",
  ] as const;
  for (const target of manifest.targets) {
    const frozen = byKey.get(chapterKey(target));
    requireCondition(frozen !== undefined, `${chapterKey(target)} is outside the exact frozen ${kind} denominator`);
    for (const field of frozenFields) {
      requireCondition(target[field] === frozen[field], `${chapterKey(target)} ${field} differs from the frozen input`);
    }
    requireCondition(hashCanonical(target.riskSignals) === hashCanonical(frozen.riskSignals),
      `${chapterKey(target)} risk signals differ from the frozen input`);
  }
  requireCondition(new Set(manifest.targets.map(chapterKey)).size === expected.length,
    `${kind} manifest contains duplicate chapter coordinates`);
}

function sourceCategoryCount(record: ForwardValidationAttemptRecordV1, category: string): number {
  return record.source?.units
    .flatMap((unit) => unit.findings)
    .filter((finding) => finding.category === category && (finding.severity === "blocker" || finding.severity === "major"))
    .length ?? 0;
}

function deriveAccounting(
  first: readonly ForwardValidationAttemptRecordV1[],
  attempts: readonly ForwardValidationAttemptRecordV1[],
  finals: readonly ForwardValidationAttemptRecordV1[],
): ForwardAcceptanceAccountingV1 {
  const firstWritePassCount = first.filter((entry) => entry.pass).length;
  const finalPassCount = finals.filter((entry) => entry.pass).length;
  const repairedKeys = new Set(attempts.filter((entry) => entry.stage !== "first-write").map((entry) => entry.chapterKey));
  const repairRecords = attempts.filter((entry) => entry.stage === "repair");
  const hardFailureReasons = attempts.flatMap((entry) => entry.failureReasons);
  return {
    totalChapters: first.length,
    firstWritePassCount,
    firstWritePassRate: first.length === 0 ? 0 : firstWritePassCount / first.length,
    finalPassCount,
    finalPassRate: first.length === 0 ? 0 : finalPassCount / first.length,
    finalSourceBlockers: finals.reduce((count, entry) => count + (entry.source?.blockingFindingIds.length ?? 0), 0),
    finalQuizBlockers: finals.reduce((count, entry) => count + (entry.quiz?.result === "BLOCK" ? 1 : 0), 0),
    finalReaderHardBlockers: finals.reduce((count, entry) => count + (entry.reader?.blockingFindings.length ?? 0), 0),
    wrongQuizKeys: finals.reduce((count, entry) => count + (entry.quiz?.questions.filter((question) => !question.keyCorrect).length ?? 0), 0),
    unsupportedSourceBoundInventedDetails: finals.reduce((count, entry) => count + sourceCategoryCount(entry, "invented_detail"), 0),
    misleadingConstructedFraming: finals.reduce((count, entry) => count + sourceCategoryCount(entry, "missing_visible_framing"), 0),
    genericHistoricalSpecificityLeaks: finals.reduce((count, entry) => count + sourceCategoryCount(entry, "generic_specificity_leak"), 0),
    unsupportedHighSeverityCausalClaims: finals.reduce((count, entry) => count + (entry.source?.units.filter((unit) =>
      unit.claimStrengthExpected === "causal"
        && unit.claimStrengthFit === false
        && unit.findings.some((finding) => finding.severity === "blocker" || finding.severity === "major")).length ?? 0), 0),
    repairAttempts: repairRecords.length,
    fullRegenerations: attempts.filter((entry) => entry.stage === "regeneration").length,
    chaptersRequiringContentRepair: repairedKeys.size,
    repeatedOrUnboundedRepair: Math.max(0, repairRecords.length - new Set(repairRecords.map((entry) => entry.chapterKey)).size),
    stateProvenanceSchemaFailures: attempts.filter((entry) => entry.failureClassification === "STATE_OR_PROVENANCE").length,
    unexpectedWrites: hardFailureReasons.filter((reason) => /unexpected workspace write/i.test(reason)).length,
    staleEvidenceAccepted: 0,
  };
}

function validateAuthoritativeV2(
  attempt: ForwardValidationAttemptRecordV1,
  result: ForwardChapterConductorResultV1,
): void {
  const authoritative = result.authoritativeV2;
  const envelope = result.executionEnvelope;
  requireCondition(authoritative !== null && authoritative !== undefined
      && authoritative.protocolVersion === FORWARD_PRODUCTION_REVIEW_PROTOCOL_V2,
    `${attempt.chapterKey}/${attempt.stage}: retained conductor result is not authoritative production V2`);
  requireCondition(authoritative.reader !== null
      && authoritative.source !== null
      && authoritative.quiz !== null,
    `${attempt.chapterKey}/${attempt.stage}: authoritative V2 result is missing a required lane`);
  requireSha(authoritative.readerEnvelopeSha256, `${attempt.chapterKey} reader envelope hash`);
  requireSha(authoritative.quizEnvelopeSha256, `${attempt.chapterKey} quiz envelope hash`);
  requireCondition(Array.isArray(authoritative.sourceEnvelopeSha256s)
      && authoritative.sourceEnvelopeSha256s.length > 0,
    `${attempt.chapterKey}/${attempt.stage}: authoritative V2 result has no source envelope order`);
  for (const hash of authoritative.sourceEnvelopeSha256s) requireSha(hash, `${attempt.chapterKey} source envelope hash`);
  requireCondition(authoritative.envelopeSetSha256 === productionReviewEnvelopeSetSha256({
    readerEnvelopeSha256: authoritative.readerEnvelopeSha256,
    sourceEnvelopeSha256s: authoritative.sourceEnvelopeSha256s,
    quizEnvelopeSha256: authoritative.quizEnvelopeSha256,
  }), `${attempt.chapterKey}/${attempt.stage}: authoritative V2 envelope-set hash drift`);
  requireCondition(envelope.reviewProtocolVersion === FORWARD_PRODUCTION_REVIEW_PROTOCOL_V2
      && envelope.readerEvidenceEnvelopeSha256 === authoritative.readerEnvelopeSha256
      && hashCanonical(envelope.sourceEvidenceEnvelopeSha256s) === hashCanonical(authoritative.sourceEnvelopeSha256s)
      && envelope.quizEvidenceEnvelopeSha256 === authoritative.quizEnvelopeSha256
      && envelope.evidenceEnvelopeSetSha256 === authoritative.envelopeSetSha256,
    `${attempt.chapterKey}/${attempt.stage}: conductor execution envelope differs from authoritative V2 envelope order`);
  requireCondition(envelope.readerV2ResultSha256 === hashCanonical(authoritative.reader)
      && envelope.sourceV2ResultSha256 === hashCanonical(authoritative.source)
      && envelope.quizV2ResultSha256 === hashCanonical(authoritative.quiz)
      && envelope.readerAuditV2ResultSha256 === (authoritative.readerAudit ? hashCanonical(authoritative.readerAudit) : null)
      && envelope.sourceAdjudicatorV2ResultSha256 === (authoritative.sourceAdjudication ? hashCanonical(authoritative.sourceAdjudication) : null),
    `${attempt.chapterKey}/${attempt.stage}: conductor execution envelope carries stale authoritative V2 results`);
  requireCondition(envelope.sourceAdjudicationTriggered === (authoritative.sourceAdjudication !== null),
    `${attempt.chapterKey}/${attempt.stage}: conductor source-adjudication trigger differs from authoritative V2 state`);
  const sourceOrderProblems = forwardV2SourceExecutionOrderProblems({
    executions: envelope.executions,
    sourceEnvelopeSha256s: authoritative.sourceEnvelopeSha256s,
    sourceAdjudicationTriggered: authoritative.sourceAdjudication !== null,
  });
  requireCondition(sourceOrderProblems.length === 0,
    `${attempt.chapterKey}/${attempt.stage}: ${sourceOrderProblems.join("; ")}`);
}

function validateAttempts(
  phaseDir: string,
  manifest: ForwardValidationManifestV1,
  campaign: ForwardValidationCampaignResultV1,
): void {
  const targetKeys = manifest.targets.map(chapterKey);
  const targetSet = new Set(targetKeys);
  requireCondition(campaign.attempts.length >= targetKeys.length,
    `${campaign.kind} retained result has fewer attempts than its frozen first-write denominator`);
  const byChapter = new Map<string, ForwardValidationAttemptRecordV1[]>();
  for (const attempt of campaign.attempts) {
    requireCondition(attempt.schema === FORWARD_ATTEMPT_RECORD_SCHEMA, `${attempt.chapterKey}: retained attempt schema mismatch`);
    requireCondition(targetSet.has(attempt.chapterKey), `${attempt.chapterKey}: retained attempt is outside the frozen manifest`);
    requireCondition(typeof attempt.attemptId === "string" && attempt.attemptId.length > 0,
      `${attempt.chapterKey}/${attempt.stage}: retained accepted campaign attempt has no attempt id`);
    requireSha(attempt.candidateBytesSha256, `${attempt.chapterKey}/${attempt.stage} candidate bytes hash`);
    requireChapterContentHash(attempt.candidateContentSha256,
      `${attempt.chapterKey}/${attempt.stage} candidate content hash`);
    if (attempt.executionEnvelope !== null) {
      requireSha(attempt.executionEnvelopeSha256, `${attempt.chapterKey}/${attempt.stage} execution-envelope hash`);
      requireCondition(attempt.executionEnvelopeSha256 === hashCanonical(attempt.executionEnvelope),
        `${attempt.chapterKey}/${attempt.stage} execution-envelope hash drift`);
    }
    requireCondition(attempt.conductorResult !== null && attempt.conductorResult !== undefined,
      `${attempt.chapterKey}/${attempt.stage}: retained V3 attempt has no complete conductor result`);
    requireSha(attempt.conductorResultSha256,
      `${attempt.chapterKey}/${attempt.stage} complete conductor-result hash`);
    requireCondition(attempt.conductorResultSha256 === hashCanonical(attempt.conductorResult),
      `${attempt.chapterKey}/${attempt.stage}: complete conductor-result hash drift`);
    const conductor = attempt.conductorResult;
    requireCondition(hashCanonical(attempt.reader) === hashCanonical(conductor.reader)
        && hashCanonical(attempt.source) === hashCanonical(conductor.source)
        && hashCanonical(attempt.quiz) === hashCanonical(conductor.quiz)
        && hashCanonical(attempt.aggregate) === hashCanonical(conductor.aggregate)
        && hashCanonical(attempt.executionEnvelope) === hashCanonical(conductor.executionEnvelope)
        && attempt.executionEnvelopeSha256 === conductor.executionEnvelopeSha256
        && attempt.disposition === conductor.disposition
        && attempt.finalStatus === conductor.finalStatus,
      `${attempt.chapterKey}/${attempt.stage}: campaign attempt is not an exact projection of its conductor result`);
    validateAuthoritativeV2(attempt, conductor);
    if (attempt.disposition === "COMMITTED") {
      requireCondition(typeof attempt.attemptDir === "string" && attempt.attemptDir.length > 0,
        `${attempt.chapterKey}/${attempt.stage}: committed attempt has no retained attempt directory`);
      const attemptDir = resolve(attempt.attemptDir);
      requireCondition(attemptDir.startsWith(`${resolve(phaseDir)}/`),
        `${attempt.chapterKey}/${attempt.stage}: committed attempt directory escapes the explicit phase`);
      const retainedPath = resolve(attemptDir, "forward-review-result.json");
      const retained = parseJson<ForwardChapterConductorResultV1>(retainedPath,
        `${attempt.chapterKey}/${attempt.stage} committed forward review result`);
      requireCondition(hashCanonical(retained) === attempt.conductorResultSha256
          && hashCanonical(retained) === hashCanonical(conductor),
        `${attempt.chapterKey}/${attempt.stage}: committed forward-review-result read-back differs from the campaign record`);
    }
    const records = byChapter.get(attempt.chapterKey) ?? [];
    records.push(attempt);
    byChapter.set(attempt.chapterKey, records);
  }

  for (const key of targetKeys) {
    const records = byChapter.get(key) ?? [];
    requireCondition(records.length >= 1 && records[0].stage === "first-write",
      `${key}: retained campaign has no first-write attempt`);
    requireCondition(records.filter((entry) => entry.stage === "first-write").length === 1,
      `${key}: retained campaign has duplicate first writes`);
    requireCondition(records.filter((entry) => entry.stage === "repair").length <= 1
      && records.filter((entry) => entry.stage === "regeneration").length <= 1,
    `${key}: retained campaign exceeds bounded repair/regeneration`);
    const stages = records.map((entry) => entry.stage).join(",");
    requireCondition(
      stages === "first-write"
        || stages === "first-write,repair"
        || stages === "first-write,regeneration"
        || stages === "first-write,repair,regeneration",
      `${key}: retained campaign stage order is unbounded or invalid (${stages})`,
    );
    const final = campaign.finalByChapter[key];
    requireCondition(final !== undefined && hashCanonical(final) === hashCanonical(records.at(-1)),
      `${key}: retained final is not the last bounded attempt`);
    requireCondition(final.disposition === "COMMITTED",
      `${key}: accepted retained final is not a committed conductor result`);
  }
  requireCondition(Object.keys(campaign.finalByChapter).length === targetKeys.length
    && Object.keys(campaign.finalByChapter).every((key) => targetSet.has(key)),
  `${campaign.kind} retained final set differs from the frozen manifest`);

  const first = targetKeys.map((key) => byChapter.get(key)![0]);
  const firstWriteSnapshot = {
    schema: FORWARD_FIRST_WRITE_SNAPSHOT_SCHEMA,
    experimentId: manifest.experimentId,
    manifestSha256: campaign.manifestSha256,
    totalChapters: first.length,
    passCount: first.filter((entry) => entry.pass).length,
    passRate: first.length === 0 ? 0 : first.filter((entry) => entry.pass).length / first.length,
    entries: first.map((entry) => ({
      chapterKey: entry.chapterKey,
      attemptId: entry.attemptId,
      candidateBytesSha256: entry.candidateBytesSha256,
      executionEnvelopeSha256: entry.executionEnvelopeSha256,
      finalStatus: entry.finalStatus,
      pass: entry.pass,
    })),
  };
  requireCondition(campaign.firstWriteSnapshotSha256 === hashCanonical(campaign.firstWriteSnapshot),
    `${campaign.kind} first-write snapshot self hash drift`);
  requireCondition(hashCanonical(campaign.firstWriteSnapshot) === hashCanonical(firstWriteSnapshot),
    `${campaign.kind} first-write snapshot differs from the retained attempts`);

  const finals = targetKeys.map((key) => campaign.finalByChapter[key]);
  requireCondition(hashCanonical(campaign.accounting) === hashCanonical(deriveAccounting(first, campaign.attempts, finals)),
    `${campaign.kind} accounting is not the deterministic projection of retained attempts/finals`);
}

function safeEvidencePath(phaseDir: string, storageId: string): string {
  requireCondition(typeof storageId === "string" && storageId.length > 0, "retained persistence receipt has no storage id");
  const root = resolve(phaseDir);
  const path = resolve(root, storageId);
  requireCondition(path.startsWith(`${root}/`), `retained evidence storage id escapes the explicit phase: ${storageId}`);
  return path;
}

function receiptKey(receipt: ForwardPersistenceReceiptV1): string {
  return `${receipt.kind}\0${receipt.storageId}\0${receipt.contentSha256}`;
}

function validatePersistence(
  phaseDir: string,
  campaign: ForwardValidationCampaignResultV1,
): Map<string, unknown> {
  const receipts = campaign.persistenceReceipts;
  requireCondition(Array.isArray(receipts) && receipts.length > 0,
    `${campaign.kind} campaign has no retained persistence receipts`);
  requireCondition(new Set(receipts.map((receipt) => receipt.storageId)).size === receipts.length,
    `${campaign.kind} campaign reuses a durable evidence storage id`);
  const values = new Map<string, unknown>();
  for (const receipt of receipts) {
    requireCondition(receipt.schema === FORWARD_PERSISTENCE_RECEIPT_SCHEMA, `${receipt.storageId}: persistence receipt schema mismatch`);
    requireSha(receipt.contentSha256, `${receipt.storageId} persistence content hash`);
    const path = safeEvidencePath(phaseDir, receipt.storageId);
    const value = parseJson<unknown>(path, `${receipt.kind} evidence`);
    requireCondition(hashCanonical(value) === receipt.contentSha256,
      `${receipt.storageId}: durable evidence read-back hash mismatch`);
    values.set(receiptKey(receipt), value);
  }

  const attemptHashes = new Set(campaign.attempts.map((attempt) => hashCanonical(attempt)));
  const retainedAttemptHashes = receipts.filter((receipt) => receipt.kind === "attempt").map((receipt) => receipt.contentSha256);
  requireCondition(retainedAttemptHashes.length === campaign.attempts.length
    && new Set(retainedAttemptHashes).size === campaign.attempts.length
    && retainedAttemptHashes.every((hash) => attemptHashes.has(hash)),
  `${campaign.kind} attempt receipts do not bind every retained attempt exactly once`);
  const firstReceipts = receipts.filter((receipt) => receipt.kind === "first-write-snapshot");
  requireCondition(firstReceipts.length === 1
    && firstReceipts[0].contentSha256 === campaign.firstWriteSnapshotSha256,
  `${campaign.kind} campaign lacks the exact durable first-write snapshot receipt`);
  return values;
}

type RetainedCallArtifacts = {
  request: Record<string, unknown>;
  receipt: Record<string, unknown>;
  result: unknown;
};

function replayable(status: ForwardLiveCallStatus | "REQUESTED"): boolean {
  return status === "timeout" || status === "provider_capacity" || status === "transient_execution_failure";
}

function asRecord(value: unknown, label: string): Record<string, unknown> {
  requireCondition(value !== null && typeof value === "object" && !Array.isArray(value), `${label} must be an object`);
  return value as Record<string, unknown>;
}

function reviewerPanelRole(category: ForwardLiveCallCategory): NonNullable<ForwardReviewExecutionEntryV1["panelRole"]> | null {
  if (category.endsWith("-reader-primary")) return "readerPrimary";
  if (category.endsWith("-reader-audit")) return "readerAudit";
  if (category.endsWith("-source-primary")) return "sourcePrimary";
  if (category.endsWith("-source-adjudicator")) return "sourceAdjudicator";
  if (category.endsWith("-quiz-adjudicator")) return "quizSemanticAdjudicator";
  return null;
}

function expectedAuthoritativeEnvelopeSha256(
  conductor: ForwardChapterConductorResultV1,
  execution: ForwardReviewExecutionEntryV1,
): string {
  const authoritative = conductor.authoritativeV2!;
  if (execution.panelRole === "readerPrimary" || execution.panelRole === "readerAudit") {
    return authoritative.readerEnvelopeSha256!;
  }
  if (execution.panelRole === "quizSemanticAdjudicator") return authoritative.quizEnvelopeSha256!;
  const sameRole = conductor.executionEnvelope.executions.filter((candidate) => candidate.panelRole === execution.panelRole);
  const index = sameRole.indexOf(execution);
  requireCondition(index >= 0 && index < authoritative.sourceEnvelopeSha256s.length,
    `${execution.panelRole}/${execution.reviewOperationKey}: reviewer execution is outside authoritative source-envelope order`);
  return authoritative.sourceEnvelopeSha256s[index];
}

function validateReviewerCall(args: {
  entry: ForwardLiveCallEntryV1;
  requestEnvelope: Record<string, unknown>;
  resultValue: unknown;
  campaign: ForwardValidationCampaignResultV1;
  roleFreeze: ForwardRoleAssignmentFreezeV3;
}): void {
  const panelRole = reviewerPanelRole(args.entry.category);
  if (panelRole === null) return;
  requireCondition(args.entry.chapterNumber !== null,
    `${args.entry.logicalOperationId}: reviewer call has no chapter coordinate`);
  const key = chapterKey({ bookId: args.entry.bookId, chapterNumber: args.entry.chapterNumber });
  const attempts = args.campaign.attempts.filter((attempt) => attempt.chapterKey === key && attempt.stage === args.entry.stage);
  requireCondition(attempts.length === 1 && attempts[0].conductorResult,
    `${args.entry.logicalOperationId}: reviewer call does not resolve to one complete conductor result`);
  const conductor = attempts[0].conductorResult!;
  const request = asRecord(args.requestEnvelope.request,
    `${args.entry.logicalOperationId} retained reviewer request projection`);
  const task = asRecord(request.task, `${args.entry.logicalOperationId} retained reviewer task`);
  requireCondition(typeof task.content === "string"
      && task.sha256 === sha256Hex(task.content)
      && task.bytes === Buffer.byteLength(task.content),
    `${args.entry.logicalOperationId}: retained inline task bytes/hash drift`);
  requireCondition(Array.isArray(request.artifacts),
    `${args.entry.logicalOperationId}: retained reviewer artifacts are not an array`);
  const artifacts = request.artifacts.map((value, index) => {
    const artifact = asRecord(value, `${args.entry.logicalOperationId} artifact ${index + 1}`);
    requireCondition(typeof artifact.kind === "string"
        && typeof artifact.relPath === "string"
        && typeof artifact.content === "string"
        && artifact.sha256 === sha256Hex(artifact.content)
        && artifact.bytes === Buffer.byteLength(artifact.content),
      `${args.entry.logicalOperationId}: retained artifact ${index + 1} bytes/hash drift`);
    return artifact;
  });
  const envelopes = artifacts.filter((artifact) => artifact.kind === "evidence-envelope");
  requireCondition(request.reviewProtocol === "review-evidence-envelope-v1" && envelopes.length === 1,
    `${args.entry.logicalOperationId}: reviewer request does not retain exactly one canonical evidence envelope`);
  const envelopeArtifact = envelopes[0];
  let envelope: ReviewEvidenceEnvelopeV1;
  try {
    envelope = JSON.parse(String(envelopeArtifact.content)) as ReviewEvidenceEnvelopeV1;
  } catch (error) {
    throw new ForwardRetainedCampaignEvidenceV3Error(
      `${args.entry.logicalOperationId}: retained evidence envelope is invalid JSON: ${(error as Error).message}`,
    );
  }
  const envelopeErrors = validateReviewEvidenceEnvelope(envelope);
  requireCondition(envelopeErrors.length === 0,
    `${args.entry.logicalOperationId}: retained evidence envelope is invalid: ${envelopeErrors.join("; ")}`);
  requireCondition(envelopeArtifact.content === canonicalReviewEvidenceEnvelope(envelope)
      && envelopeArtifact.sha256 === request.evidenceEnvelopeBytesSha256
      && envelope.envelopeSha256 === request.evidenceEnvelopeSha256
      && task.content.includes(String(envelopeArtifact.content)),
    `${args.entry.logicalOperationId}: envelope bytes/semantic hash are not exactly inline and request-bound`);

  const originalArtifacts = artifacts.map((artifact) => ({
    kind: artifact.kind,
    relPath: artifact.relPath,
    content: artifact.content,
    sha256: artifact.sha256,
  }));
  const originalRequest = { ...request, task: task.content, artifacts: originalArtifacts };
  requireCondition(args.entry.requestSha256 === hashCanonical(originalRequest),
    `${args.entry.logicalOperationId}: exact retained reviewer request hash drift`);
  const { task: _task, artifacts: _artifacts, ...expectedRequest } = originalRequest;
  const frozenBinding = args.roleFreeze.roleProfileBindings[panelRole];
  requireCondition(frozenBinding !== undefined
      && request.profileId === frozenBinding.judge.profileId
      && request.model === frozenBinding.judge.model
      && request.effort === frozenBinding.judge.effort
      && request.schemaSha256 === frozenBinding.schemaSha256
      && request.roleAssignmentSha256 === args.roleFreeze.roleAssignmentSha256
      && request.instrumentManifestSha256 === args.roleFreeze.reviewConfig.instrumentManifestSha256
      && request.executionProfileHash === args.roleFreeze.routeBinding.executionProfileHash
      && request.routePolicyVersion === args.roleFreeze.routeBinding.routePolicyVersion,
    `${args.entry.logicalOperationId}: reviewer request differs from its fixed V3 role/profile/route binding`);
  const expectedRoleProfileSha256 = hashCanonical({
    judge: frozenBinding.judge,
    executionProfileHash: args.roleFreeze.routeBinding.executionProfileHash,
    routePolicyVersion: args.roleFreeze.routeBinding.routePolicyVersion,
  });
  const executionMatches = conductor.executionEnvelope.executions.filter((execution) =>
    execution.panelRole === panelRole
      && execution.reviewOperationKey === request.reviewOperationKey
      && execution.roleProfileSha256 === expectedRoleProfileSha256
      && hashCanonical(execution.expected) === hashCanonical(expectedRequest)
      && execution.taskSha256 === task.sha256
      && hashCanonical(execution.artifactHashes)
        === hashCanonical(originalArtifacts.map(({ content: _content, ...artifact }) => artifact)));
  requireCondition(executionMatches.length === 1,
    `${args.entry.logicalOperationId}: reviewer request is not uniquely bound to its fixed-role conductor execution`);
  const execution = executionMatches[0];
  const authoritativeEnvelopeSha256 = expectedAuthoritativeEnvelopeSha256(conductor, execution);
  requireCondition(request.evidenceEnvelopeSha256 === authoritativeEnvelopeSha256
      && execution.expected.evidenceEnvelopeSha256 === authoritativeEnvelopeSha256
      && execution.expected.evidenceEnvelopeBytesSha256 === envelopeArtifact.sha256,
    `${args.entry.logicalOperationId}: reviewer request does not match authoritative V2 envelope order`);
  if (args.entry.status !== "completed") {
    requireCondition(replayable(args.entry.status) && args.resultValue === null,
      `${args.entry.logicalOperationId}: failed reviewer evidence is not one replayable request-only attempt`);
    return;
  }
  const modelResult = asRecord(args.resultValue, `${args.entry.logicalOperationId} reviewer result`);
  requireCondition(typeof modelResult.output === "string", `${args.entry.logicalOperationId}: reviewer result has no raw output`);
  const { output, ...receivedProjection } = modelResult;
  requireCondition(execution.received?.executionId === args.entry.executionId
      && hashCanonical(receivedProjection) === hashCanonical(execution.received)
      && execution.outputSha256 === sha256Hex(output),
    `${args.entry.logicalOperationId}: reviewer result differs from its conductor receipt/output hash`);
  requireCondition(execution.received?.evidenceEnvelopeSha256 === authoritativeEnvelopeSha256
      && execution.received?.evidenceEnvelopeBytesSha256 === envelopeArtifact.sha256,
    `${args.entry.logicalOperationId}: reviewer receipt does not match authoritative V2 envelope order`);
}

function validateCallLedger(
  liveDir: string,
  manifest: FrozenForwardValidationManifestV1,
  roleFreeze: ForwardRoleAssignmentFreezeV3,
  result: RunForwardLiveCampaignResultV3,
  materializationProof: ForwardInputMaterializationProofV1,
): { budget: ForwardLivePhaseBudgetV1; ledger: ForwardLiveCallLedgerV1; calls: Map<string, RetainedCallArtifacts> } {
  const budgetPath = resolve(liveDir, "call-budget.json");
  const ledgerPath = resolve(liveDir, "call-ledger.json");
  const budget = parseJson<ForwardLivePhaseBudgetV1>(budgetPath, "live call budget");
  const ledger = parseJson<ForwardLiveCallLedgerV1>(ledgerPath, "live call ledger");
  requireCondition(budget.schema === FORWARD_LIVE_PHASE_BUDGET_SCHEMA, "live call budget schema mismatch");
  const recomposed = buildForwardLivePhaseBudget({
    manifest,
    panelPolicy: roleFreeze.panelPolicy,
    sourcePartitionCountByChapter: budget.sourcePartitionCountByChapter,
    ...(manifest.manifest.kind === "gold"
      ? { goldBookEvaluatorExpectedCalls: 4, goldBookEvaluatorMaximumCallsBeforeReplay: 4 }
      : {}),
  });
  requireCondition(hashCanonical(budget) === hashCanonical(recomposed),
    "retained live call budget differs from the deterministic frozen budget");
  requireCondition(Object.keys(budget.sourcePartitionCountByChapter).length === manifest.manifest.targets.length
      && Object.values(budget.sourcePartitionCountByChapter).reduce((total, count) => total + count, 0)
        === budget.sourcePartitionCountTotal
      && hashCanonical(budget.sourcePartitionCountByChapter)
        === hashCanonical(materializationProof.sourcePartitionCountByChapter),
    "retained live call budget source-partition total/denominator differs from hash-verified materialized source plans");
  requireCondition(result.budgetSha256 === budget.budgetSha256, "campaign result is bound to another call budget");
  requireCondition(ledger.schema === FORWARD_LIVE_CALL_LEDGER_SCHEMA
      && ledger.experimentId === manifest.manifest.experimentId
      && ledger.kind === manifest.manifest.kind
      && ledger.manifestSha256 === manifest.manifestSha256
      && ledger.budgetSha256 === budget.budgetSha256,
    "live call ledger identity/budget binding mismatch");
  requireCondition(ledger.executionRoute === "codex_exec_chatgpt_subscription"
      && ledger.authMode === "chatgpt"
      && ledger.apiKeyPresent === false
      && ledger.apiCallsMade === 0
      && ledger.apiFallbackAllowed === false,
    "live call ledger records a prohibited non-ChatGPT/API route");
  requireCondition(ledger.entries.length === ledger.codexExecInvocations,
    "live call ledger invocation counter differs from its durable entries");
  requireCondition(ledger.codexExecInvocations <= budget.hardMaximumCalls,
    "live call ledger exceeds the frozen hard maximum call budget");
  requireCondition(new Set(ledger.entries.map((entry) => entry.attemptId)).size === ledger.entries.length,
    "live call ledger contains duplicate attempt ids");
  const completedExecutionIds = ledger.entries
    .filter((entry) => entry.status === "completed")
    .map((entry) => entry.executionId);
  requireCondition(completedExecutionIds.every((executionId) => typeof executionId === "string" && executionId.length > 0)
      && new Set(completedExecutionIds).size === completedExecutionIds.length,
    "retained completed live calls reuse or omit a ChatGPT execution identity");

  const calls = new Map<string, RetainedCallArtifacts>();
  const expectedModelCallFiles = new Set<string>();
  for (const entry of ledger.entries) {
    requireCondition(FORWARD_LIVE_CALL_CATEGORIES.includes(entry.category), `live call ledger has unknown category ${entry.category}`);
    requireCondition(entry.attemptNumber === 1 || entry.attemptNumber === 2,
      `${entry.logicalOperationId}: live call exceeds the single authorized infrastructure replay`);
    requireCondition(entry.status !== "REQUESTED", `${entry.logicalOperationId}: live call is left REQUESTED`);
    const expectedAttemptId = sha256Hex(`${entry.logicalOperationId}\0${entry.attemptNumber}\0${entry.requestSha256}`);
    requireCondition(entry.attemptId === expectedAttemptId, `${entry.logicalOperationId}: live call attempt id drift`);
    const callDir = resolve(liveDir, "model-calls", sha256Hex(entry.logicalOperationId), `attempt-${entry.attemptNumber}`);
    const callRelDir = `${sha256Hex(entry.logicalOperationId)}/attempt-${entry.attemptNumber}`;
    expectedModelCallFiles.add(`${callRelDir}/request.json`);
    expectedModelCallFiles.add(`${callRelDir}/receipt.json`);
    const request = asRecord(parseJson<unknown>(resolve(callDir, "request.json"), "live model request"), "live model request");
    const receipt = asRecord(parseJson<unknown>(resolve(callDir, "receipt.json"), "live model receipt"), "live model receipt");
    requireCondition(request.requestSha256 === entry.requestSha256,
      `${entry.logicalOperationId}: retained request hash differs from the ledger`);
    requireCondition(request.request !== undefined
        && request.requestProjectionSha256 === hashCanonical(request.request),
      `${entry.logicalOperationId}: retained request projection hash drift`);
    if (entry.category.includes("-author-") || entry.category === "gold-book-evaluator") {
      requireCondition(request.requestSha256 === hashCanonical(request.request),
        `${entry.logicalOperationId}: exact model-operation request hash drift`);
    }
    let projectedReceipt: Record<string, unknown>;
    let resultValue: unknown = null;
    if (receipt.schema === FORWARD_LIVE_CALL_RECEIPT_SCHEMA) {
      projectedReceipt = receipt;
      resultValue = receipt.result;
    } else {
      requireCondition(receipt.schema === FORWARD_LIVE_MODEL_OPERATION_RECEIPT_SCHEMA,
        `${entry.logicalOperationId}: retained receipt schema is unknown`);
      resultValue = receipt.result;
      projectedReceipt = {
        schema: FORWARD_LIVE_CALL_RECEIPT_SCHEMA,
        status: receipt.status,
        executionId: receipt.executionId,
        result: null,
        resultSha256: resultValue === null ? null : hashCanonical(resultValue),
        failureMessage: receipt.failureMessage,
      };
    }
    requireCondition(entry.receiptSha256 === hashCanonical(projectedReceipt),
      `${entry.logicalOperationId}: retained receipt hash differs from the ledger`);
    requireCondition(entry.status === receipt.status && entry.executionId === receipt.executionId,
      `${entry.logicalOperationId}: ledger status/execution differs from the retained receipt`);
    requireCondition(entry.status !== "completed" || resultValue !== null,
      `${entry.logicalOperationId}: completed retained model call has no result evidence`);
    validateReviewerCall({
      entry,
      requestEnvelope: request,
      resultValue,
      campaign: result.campaign,
      roleFreeze,
    });
    calls.set(entry.attemptId, { request, receipt, result: resultValue });
  }
  const modelCallRoot = resolve(liveDir, "model-calls");
  const actualModelCallFiles = filesBelow(modelCallRoot);
  requireCondition(actualModelCallFiles.length === expectedModelCallFiles.size
      && actualModelCallFiles.every((path) => expectedModelCallFiles.has(path)),
    "retained model-call directory contains missing, extra, or unledgered request/receipt files");

  for (const entry of ledger.entries.filter((candidate) => candidate.attemptNumber === 2)) {
    const prior = ledger.entries.find((candidate) => candidate.logicalOperationId === entry.logicalOperationId
      && candidate.attemptNumber === 1 && candidate.requestSha256 === entry.requestSha256);
    requireCondition(prior !== undefined && replayable(prior.status),
      `${entry.logicalOperationId}: second call is not the single authorized infrastructure replay`);
  }
  const entriesByLogicalOperation = new Map<string, typeof ledger.entries>();
  for (const entry of ledger.entries) {
    const entries = entriesByLogicalOperation.get(entry.logicalOperationId) ?? [];
    entries.push(entry);
    entriesByLogicalOperation.set(entry.logicalOperationId, entries);
  }
  for (const [logicalOperationId, entries] of entriesByLogicalOperation) {
    const ordered = [...entries].sort((left, right) => left.attemptNumber - right.attemptNumber);
    requireCondition(ordered.length <= 2
        && ordered[0]?.attemptNumber === 1
        && (ordered.length === 1 || ordered[1]?.attemptNumber === 2)
        && new Set(ordered.map((entry) => entry.requestSha256)).size === 1,
      `${logicalOperationId}: retained call attempts are not one exact request plus at most one replay`);
    requireCondition(ordered.at(-1)?.status === "completed",
      `${logicalOperationId}: accepted campaign retains an orphaned or terminal failed model call`);
  }
  requireCondition(ledger.infrastructureReplays === ledger.entries.filter((entry) => entry.attemptNumber === 2).length,
    "live call ledger infrastructure replay counter drift");
  requireCondition(ledger.maxPlanCapacityEvents === ledger.entries.filter((entry) => entry.status === "provider_capacity").length,
    "live call ledger capacity-event counter drift");
  requireCondition(ledger.safeguardsOrRefusals === ledger.entries.filter((entry) => entry.status === "refusal").length,
    "live call ledger safeguard/refusal counter drift");
  requireCondition(result.codexExecInvocations === ledger.codexExecInvocations
      && result.cachedReceipts === ledger.cachedReceipts
      && result.infrastructureReplays === ledger.infrastructureReplays
      && result.maxPlanCapacityEvents === ledger.maxPlanCapacityEvents
      && result.safeguardsOrRefusals === ledger.safeguardsOrRefusals,
    "campaign result call/replay counters differ from the exact retained live ledger");

  for (const category of FORWARD_LIVE_CALL_CATEGORIES) {
    const categoryEntries = ledger.entries.filter((entry) => entry.category === category);
    const categoryReplays = categoryEntries.filter((entry) => entry.attemptNumber === 2).length;
    requireCondition(categoryReplays <= budget.maximumInfrastructureReplays[category]
        && categoryEntries.length <= budget.maximumCallsBeforeInfrastructureReplays[category]
          + budget.maximumInfrastructureReplays[category],
      `${category}: retained calls exceed the frozen base/replay budget`);
  }

  const completedByCategory = Object.fromEntries(FORWARD_LIVE_CALL_CATEGORIES.map((category) => [category, 0])) as Record<ForwardLiveCallCategory, number>;
  for (const entry of ledger.entries) if (entry.status === "completed") completedByCategory[entry.category] += 1;
  const attemptCount = result.campaign.attempts.length;
  const stageCounts = {
    "first-write": result.campaign.attempts.filter((attempt) => attempt.stage === "first-write").length,
    repair: result.campaign.attempts.filter((attempt) => attempt.stage === "repair").length,
    regeneration: result.campaign.attempts.filter((attempt) => attempt.stage === "regeneration").length,
  };
  const kind = manifest.manifest.kind;
  requireCondition(completedByCategory[`${kind}-author-first-write`] === stageCounts["first-write"]
      && completedByCategory[`${kind}-author-repair`] === stageCounts.repair
      && completedByCategory[`${kind}-author-regeneration`] === stageCounts.regeneration,
    "completed author calls do not match retained first-write/repair/regeneration attempts");
  const sourcePartitionAttemptCount = result.campaign.attempts.reduce((total, attempt) =>
    total + (budget.sourcePartitionCountByChapter[attempt.chapterKey] ?? 0), 0);
  requireCondition(completedByCategory[`${kind}-reader-primary`] === attemptCount
      && completedByCategory[`${kind}-source-primary`] === sourcePartitionAttemptCount
      && completedByCategory[`${kind}-quiz-adjudicator`] === attemptCount,
    "completed primary reviewer calls do not match every retained candidate/partition attempt");
  const auditAttempts = result.campaign.attempts.filter((attempt) => {
    const target = manifest.manifest.targets.find((candidate) => chapterKey(candidate) === attempt.chapterKey)!;
    return isInForwardReaderAuditSubset(roleFreeze.panelPolicy.auditSubset, target);
  }).length;
  requireCondition(completedByCategory[`${kind}-reader-audit`] === auditAttempts,
    "completed reader-audit calls differ from the frozen audit subset across retained attempts");
  const sourceAdjudicatorPartitionCount = result.campaign.attempts.reduce((total, attempt) =>
    total + (attempt.conductorResult?.authoritativeV2?.sourceAdjudication !== null
        && attempt.conductorResult?.authoritativeV2?.sourceAdjudication !== undefined
      ? (budget.sourcePartitionCountByChapter[attempt.chapterKey] ?? 0)
      : 0), 0);
  requireCondition(completedByCategory[`${kind}-source-adjudicator`] === sourceAdjudicatorPartitionCount,
    "completed source-adjudicator calls do not exactly cover every retained triggered partition and only those partitions");
  requireCondition(kind === "pilot" ? completedByCategory["gold-book-evaluator"] === 0
    : completedByCategory["gold-book-evaluator"] === 4,
  "gold evaluator/rater/adjudicator/sweep call denominator is not exactly four");
  return { budget, ledger, calls };
}

function validateGoldEvidence(
  phaseDir: string,
  manifest: FrozenForwardValidationManifestV1,
  materializationProof: ForwardInputMaterializationProofV1,
  roleFreeze: ForwardRoleAssignmentFreezeV3,
  campaign: ForwardValidationCampaignResultV1,
  persisted: Map<string, unknown>,
  ledger: ForwardLiveCallLedgerV1,
  calls: Map<string, RetainedCallArtifacts>,
): void {
  const goldManifest = manifest.manifest;
  requireCondition(goldManifest.kind === "gold", "gold evidence verifier received a non-gold manifest");
  const fixedInstrument = buildForwardGoldEvaluatorInstrument();
  requireCondition(fixedInstrument.instrumentSha256 === goldManifest.goldEvaluatorInstrumentSha256,
    "retained gold manifest is not bound to the built-in fixed evaluator instrument");
  const evaluation = campaign.goldEvaluation;
  requireCondition(evaluation !== null, "accepted retained gold campaign has no gold evaluation");
  const binding = evaluation.evidenceBinding;
  requireCondition(binding !== null && binding !== undefined, "retained gold evaluation has no durable evidence binding");
  const finalContentHashes = Object.fromEntries(Object.entries(campaign.finalByChapter)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, record]) => {
      requireCondition(typeof record.candidateContentSha256 === "string",
        `${key}: retained gold final content hash is missing`);
      return [String(Number(key.match(/ch(\d+)$/)?.[1] ?? "0")), record.candidateContentSha256];
    }));
  requireCondition(hashCanonical(binding.finalChapterContentHashes) === hashCanonical(finalContentHashes),
    "retained gold evidence binding is stale against final chapter content hashes");

  const bookId = manifest.manifest.targets[0]?.bookId;
  requireCondition(typeof bookId === "string" && bookId.length > 0
      && manifest.manifest.targets.every((target) => target.bookId === bookId),
    "retained gold manifest does not contain exactly one complete book identity");
  const finalChapters: ChapterV21[] = [];
  const expectedChapters: ForwardGoldExpectedChapterIdentityV1[] = [];
  const expectedSourceLaneEvidence: ForwardGoldSourceLaneEvidenceV1[] = [];
  const sourceInventoryEntries: Array<{
    chapterIndex: number;
    chapterId: string;
    title: string;
    candidateContentSha256: string;
    bytesSha256: string;
  }> = [];
  for (const target of [...manifest.manifest.targets].sort((left, right) => left.chapterNumber - right.chapterNumber)) {
    const key = chapterKey(target);
    const final = campaign.finalByChapter[key];
    requireCondition(final?.pass === true && typeof final.candidateContentSha256 === "string"
        && final.executionEnvelope !== null && final.executionEnvelopeSha256 !== null && final.source !== null,
      `${key}: retained gold source context lacks a final PASS/source/execution envelope`);
    requireCondition(final.executionEnvelopeSha256 === hashCanonical(final.executionEnvelope),
      `${key}: retained gold source context has a stale execution envelope`);
    const outputPath = resolve(phaseDir, "live-campaign", "outputs", target.outputRunId, "chapters",
      `${target.chapterId}.v21-native.chapter.json`);
    const bytes = readFileSync(outputPath);
    const chapter = parseJson<ChapterV21>(outputPath, `${key} final gold chapter`);
    requireCondition(chapter.chapterId === target.chapterId
        && chapter.number === target.chapterNumber
        && chapterContentHash(chapter) === final.candidateContentSha256,
      `${key}: final gold chapter bytes/identity differ from the retained PASS`);
    const expectedChapter = {
      chapterIndex: target.chapterNumber,
      chapterId: target.chapterId,
      title: chapter.title,
      packagePath: `chapters/ch${String(target.chapterNumber).padStart(2, "0")}.chapter.json`,
    };
    const source = asRecord(final.source, `${key} retained final source result`);
    requireCondition(Array.isArray(source.blockingFindingIds), `${key}: retained source blocker inventory is malformed`);
    const evidenceFresh = source.chapterContentSha256 === final.candidateContentSha256
      && source.sourceUsePlanSha256 === target.sourceUsePlanSha256
      && source.sourcePacketSha256 === target.sourcePacketSha256
      && source.sidecarSha256 === target.sidecarSha256;
    const sourceStatus = source.result === "PASS" ? "PASS" as const
      : source.result === "BLOCK" ? "REVISE" as const
        : "INCONCLUSIVE" as const;
    finalChapters.push(chapter);
    expectedChapters.push(expectedChapter);
    expectedSourceLaneEvidence.push({
      ...expectedChapter,
      candidateContentSha256: final.candidateContentSha256,
      sourceResultSha256: hashCanonical(final.source),
      executionEnvelopeSha256: final.executionEnvelopeSha256,
      sourceStatus,
      sourceBlockerCount: source.blockingFindingIds.length,
      evidenceFresh,
    });
    sourceInventoryEntries.push({
      chapterIndex: target.chapterNumber,
      chapterId: target.chapterId,
      title: chapter.title,
      candidateContentSha256: final.candidateContentSha256,
      bytesSha256: sha256Hex(bytes),
    });
  }
  const sourceHash = hashCanonical({
    schema: "forward-gold-authoritative-source-inventory-v1",
    bookId,
    instrumentSha256: goldManifest.goldEvaluatorInstrumentSha256,
    materializedInputFiles: Object.entries(materializationProof.bookFileInventory[bookId] ?? {})
      .map(([relativePath, bytesSha256]) => ({ relativePath, bytesSha256 }))
      .sort((left, right) => left.relativePath.localeCompare(right.relativePath)),
    finalChapters: sourceInventoryEntries,
  });
  const sourceAwareExternalAccuracy = buildForwardGoldSourceAwareExternalAccuracyProof({
    bookId,
    sourceHash,
    chapters: expectedSourceLaneEvidence,
  });
  const expectedComponentInventory = buildForwardGoldComponentInventory(finalChapters);

  const inspectionSha256 = hashCanonical({
    sourceHash,
    expectedChapters,
    expectedComponentInventory,
    sourceAwareExternalAccuracyProofSha256: sourceAwareExternalAccuracy.proofSha256,
  });
  const scope = {
    schema: "forward-gold-blind-evaluation-scope-v1",
    bookId,
    sourceHash,
    inspectionSha256,
    instrumentSha256: fixedInstrument.instrumentSha256,
    productionInstrumentSealSha256: roleFreeze.productionInstrumentSealSha256,
    chapters: expectedChapters,
    sourceBoundEvaluationRequired: true,
    priorReviewVerdictsIncluded: false,
  };
  const commonArtifacts = new Map<string, string>([
    ["evaluation-scope.json", sha256Hex(`${canonicalJson(scope)}\n`)],
  ]);
  const materializedSweepSchema = materializeForwardGoldSweepOutputSchema({ expectedChapters });
  for (const asset of fixedInstrument.referenceAssets) {
    commonArtifacts.set(asset.materializedRelPath, asset.role === "sweep-output-schema"
      ? materializedSweepSchema.bytesSha256
      : asset.bytesSha256);
  }
  const addCopiedArtifact = (relativePath: string, sourcePath: string, label: string): void => {
    commonArtifacts.set(relativePath, artifactBytesSha256(sourcePath, label));
  };
  addCopiedArtifact(`book/${bookId}.index.json`,
    resolve(phaseDir, "inputs", bookId, "indexes", `${bookId}.json`), `${bookId} materialized gold index`);
  addCopiedArtifact(`book/${bookId}.manual-brief.json`,
    resolve(phaseDir, "inputs", bookId, "briefs", `${bookId}.manual-brief.json`), `${bookId} materialized gold brief`);
  for (const target of [...goldManifest.targets].sort((left, right) => left.chapterNumber - right.chapterNumber)) {
    const nn = String(target.chapterNumber).padStart(2, "0");
    addCopiedArtifact(`chapters/ch${nn}.chapter.json`,
      resolve(phaseDir, "live-campaign", "outputs", target.outputRunId, "chapters",
        `${target.chapterId}.v21-native.chapter.json`), `${chapterKey(target)} final evaluator chapter`);
    addCopiedArtifact(`source/ch${nn}.source.json`,
      resolve(phaseDir, "inputs", target.bookId, "source-archive", target.bookId, `ch${nn}.source.json`),
      `${chapterKey(target)} evaluator source`);
    addCopiedArtifact(`source/ch${nn}.anchors.json`,
      resolve(phaseDir, "inputs", target.bookId, "source-archive", target.bookId, `ch${nn}.anchors.json`),
      `${chapterKey(target)} evaluator anchors`);
    addCopiedArtifact(`source/ch${nn}.source-packet.json`,
      resolve(phaseDir, "inputs", target.bookId, "books", target.bookId, "runs", "imp22-inputs-v1",
        "source-packets", `ch${nn}.source-packet.json`), `${chapterKey(target)} evaluator source packet`);
    addCopiedArtifact(`source/ch${nn}.plan.json`,
      resolve(phaseDir, "inputs", target.bookId, "books", target.bookId, "runs", "imp22-inputs-v1",
        "source-plans", `ch${nn}.plan.json`), `${chapterKey(target)} evaluator source plan`);
  }

  const evaluatorProjection = {
    technicalCompleteness: evaluation.technicalCompleteness,
    epistemicInstructionalSafety: evaluation.epistemicInstructionalSafety,
    ethicsReaderAutonomy: evaluation.ethicsReaderAutonomy,
    purposeAudienceDeclaration: evaluation.purposeAudienceDeclaration,
    externalAccuracy: evaluation.externalAccuracy,
    contentDesignScore: evaluation.contentDesignScore,
  };
  const evaluatorPayload = hashCanonical(evaluatorProjection);
  const refs: Array<{ kind: "gold-evaluator" | "gold-rater" | "gold-sweep"; ref: ForwardGoldPersistedEvidenceRefV1; expectedPayload: string }> = [
    { kind: "gold-evaluator", ref: binding.evaluator, expectedPayload: evaluatorPayload },
    ...binding.raters.map((ref) => ({ kind: "gold-rater" as const, ref, expectedPayload: ref.payloadSha256 })),
    { kind: "gold-sweep", ref: binding.sweep, expectedPayload: hashCanonical(evaluation.sweep) },
  ];
  requireCondition(binding.raters.length === 2 && refs.length === 4,
    "gold evidence does not contain two blind raters, one adjudicator, and one sweep");
  requireCondition(new Set(refs.map(({ ref }) => ref.actorId)).size === 4
      && new Set(refs.map(({ ref }) => ref.executionId)).size === 4
      && new Set(refs.map(({ ref }) => ref.artifactSha256)).size === 4
      && new Set(refs.map(({ ref }) => ref.receipt.storageId)).size === 4,
    "gold rater/adjudicator/sweep evidence identities are not independent");
  for (const { kind, ref, expectedPayload } of refs) {
    requireCondition(ref.receipt.kind === kind
        && ref.receipt.contentSha256 === ref.artifactSha256
        && ref.payloadSha256 === expectedPayload,
      `${kind}: durable evidence reference/receipt/payload mismatch`);
    const retained = persisted.get(receiptKey(ref.receipt)) as ForwardGoldEvidenceArtifactV1 | undefined;
    requireCondition(retained !== undefined
        && retained.schema === FORWARD_GOLD_EVIDENCE_SCHEMA
        && retained.kind === kind
        && retained.actorId === ref.actorId
        && retained.executionId === ref.executionId
        && retained.payloadSha256 === expectedPayload
        && hashCanonical(retained.finalChapterContentHashes) === hashCanonical(finalContentHashes),
      `${kind}: durable evidence read-back differs from the exact final gold result`);
  }

  type CompletedGoldCall = {
    entry: ForwardLiveCallEntryV1;
    request: Record<string, unknown>;
    result: Record<string, unknown>;
    output: unknown;
    dispatchReceiptSha256: string;
  };
  const goldAttemptEntries = ledger.entries.filter((entry) => entry.category === "gold-book-evaluator");
  const expectedLogicalOperationIds = fixedInstrument.calls.map((call) =>
    `${bookId}/book-evaluation/${call.callId}`);
  const firstOccurrenceOrder = goldAttemptEntries.reduce<string[]>((ordered, entry) => {
    if (!ordered.includes(entry.logicalOperationId)) ordered.push(entry.logicalOperationId);
    return ordered;
  }, []);
  requireCondition(hashCanonical(firstOccurrenceOrder) === hashCanonical(expectedLogicalOperationIds),
    "retained gold attempts are not first-dispatched in built-in fixed-instrument order");
  for (const entry of goldAttemptEntries) {
    requireCondition(expectedLogicalOperationIds.includes(entry.logicalOperationId)
        && entry.bookId === bookId
        && entry.chapterNumber === null
        && entry.stage === "book-evaluation",
      `${entry.logicalOperationId}: retained gold attempt has a non-fixed operation/route coordinate`);
  }
  const completedEntries = goldAttemptEntries.filter((entry) => entry.status === "completed");
  requireCondition(completedEntries.length === fixedInstrument.calls.length,
    "retained gold call denominator differs from the four built-in fixed-instrument calls");
  const completed: CompletedGoldCall[] = [];
  for (let index = 0; index < fixedInstrument.calls.length; index++) {
    const entry = completedEntries[index];
    const fixedCall = fixedInstrument.calls[index];
    const expectedLogicalOperationId = `${bookId}/book-evaluation/${fixedCall.callId}`;
    requireCondition(entry.logicalOperationId === expectedLogicalOperationId
        && entry.category === "gold-book-evaluator"
        && entry.bookId === bookId
        && entry.chapterNumber === null
        && entry.stage === "book-evaluation",
      `${entry.logicalOperationId}: retained gold attempt is not the fixed ${fixedCall.callId} operation/route`);
    const call = calls.get(entry.attemptId);
    requireCondition(call !== undefined, `${expectedLogicalOperationId}: retained completed call artifacts are missing`);
    const request = asRecord(call.request.request, `${entry.logicalOperationId} retained request`);
    const result = asRecord(call.result, `${entry.logicalOperationId} retained evaluator result`);

    const expectedWithoutReceipt = new Map(commonArtifacts);
    const outputSchemaAsset = fixedInstrument.referenceAssets.find((asset) =>
      asset.repositoryRelPath === fixedCall.outputSchemaRelPath);
    const expectedOutputSchemaSha256 = outputSchemaAsset === undefined
      ? ""
      : expectedWithoutReceipt.get(outputSchemaAsset.materializedRelPath);
    requireCondition(outputSchemaAsset !== undefined
        && outputSchemaAsset.bytesSha256 === fixedCall.outputSchemaSha256
        && typeof expectedOutputSchemaSha256 === "string",
      `${fixedCall.callId}: built-in output schema is not present at its exact fixed workspace path`);
    let preDispatchTask = buildForwardGoldEvaluatorBaseTask(fixedCall.prompt);
    if (fixedCall.evaluationRole === "adjudicator") {
      requireCondition(completed.length === 2,
        `${fixedCall.callId}: adjudicator is not preceded by the exact two fixed blind raters`);
      const blindRaterResults = {
        schema: "forward-gold-blind-rater-results-v1",
        raters: completed.map((prior) => ({
          actorId: prior.result.actorId,
          executionId: prior.result.executionId,
          output: prior.result.output,
          outputSha256: prior.result.outputSha256,
        })),
      };
      expectedWithoutReceipt.set("blind-rater-results.json",
        sha256Hex(`${canonicalJson(blindRaterResults)}\n`));
      preDispatchTask = buildForwardGoldAdjudicatorPreDispatchTask(preDispatchTask);
    } else if (fixedCall.evaluationRole === "book-sweep") {
      requireCondition(completed.length === 3,
        `${fixedCall.callId}: book sweep is not preceded by the exact fixed adjudicator`);
      const adjudicator = completed[2];
      const adjudicatedBinding = {
        schema: "forward-gold-adjudicated-result-binding-v1",
        actorId: adjudicator.result.actorId,
        executionId: adjudicator.result.executionId,
        outputSha256: adjudicator.result.outputSha256,
        sourceHash,
        dispatchReceiptSha256: adjudicator.dispatchReceiptSha256,
      };
      expectedWithoutReceipt.set("adjudicated-result-binding.json",
        sha256Hex(`${canonicalJson(adjudicatedBinding)}\n`));
      preDispatchTask = buildForwardGoldSweepPreDispatchTask(preDispatchTask);
    }
    const artifactsWithoutReceipt = [...expectedWithoutReceipt]
      .map(([relativePath, bytesSha256]) => ({ relativePath, bytesSha256 }))
      .sort((left, right) => left.relativePath.localeCompare(right.relativePath));
    const dispatchBinding = buildForwardGoldWorkerDispatchBinding({
      call: {
        callId: fixedCall.callId,
        actorId: fixedCall.actorId,
        evaluationRole: fixedCall.evaluationRole,
        instrumentSha256: fixedInstrument.instrumentSha256,
        productionInstrumentSealSha256: roleFreeze.productionInstrumentSealSha256,
        sourceHash,
        expectedChapters,
        expectedComponentInventory,
        sourceAwareExternalAccuracy,
        task: preDispatchTask,
      },
      artifacts: artifactsWithoutReceipt,
    });
    const dispatchReceiptBytes = `${canonicalJson(dispatchBinding.receipt)}\n`;
    const expectedArtifacts = [
      ...artifactsWithoutReceipt,
      {
        relativePath: "worker-dispatch-receipt.json",
        bytesSha256: sha256Hex(dispatchReceiptBytes),
      },
    ].sort((left, right) => left.relativePath.localeCompare(right.relativePath));
    const expectedRequest = {
      actorId: fixedCall.actorId,
      evaluationRole: fixedCall.evaluationRole,
      taskSha256: sha256Hex(dispatchBinding.task),
      model: fixedCall.model,
      effort: fixedCall.effort,
      outputSchemaSha256: expectedOutputSchemaSha256,
      instrumentSha256: fixedInstrument.instrumentSha256,
      productionInstrumentSealSha256: roleFreeze.productionInstrumentSealSha256,
      sourceHash,
      dispatchReceiptSha256: dispatchBinding.receipt.dispatchReceiptSha256,
      expectedChaptersSha256: hashCanonical(expectedChapters),
      expectedComponentInventorySha256: hashCanonical(expectedComponentInventory),
      sourceAwareExternalAccuracyProofSha256: sourceAwareExternalAccuracy.proofSha256,
      artifacts: expectedArtifacts,
    };
    requireCondition(hashCanonical(request) === hashCanonical(expectedRequest)
        && entry.requestSha256 === hashCanonical(expectedRequest),
      `${entry.logicalOperationId}: retained gold request differs from its exact built-in fixed call/task/route binding`);

    const workspace = resolve(phaseDir, "live-campaign", "evaluator-workspaces", fixedCall.callId);
    const actualFiles = filesBelow(workspace);
    requireCondition(actualFiles.length === expectedArtifacts.length
        && actualFiles.every((path, position) => path === expectedArtifacts[position].relativePath),
      `${entry.logicalOperationId}: retained gold workspace differs from the complete fixed artifact inventory`);
    for (const artifact of expectedArtifacts) {
      requireCondition(artifactBytesSha256(resolve(workspace, artifact.relativePath),
        `${entry.logicalOperationId} ${artifact.relativePath}`) === artifact.bytesSha256,
      `${entry.logicalOperationId}: retained fixed gold artifact bytes drift (${artifact.relativePath})`);
    }
    requireCondition(readFileSync(resolve(workspace, "worker-dispatch-receipt.json"), "utf8") === dispatchReceiptBytes,
      `${entry.logicalOperationId}: retained worker dispatch receipt bytes differ from the reconstructed fixed task`);
    requireCondition(result.actorId === fixedCall.actorId
        && result.executionId === entry.executionId
        && entry.executionId === `imp22-gold-${fixedCall.callId}-attempt-${entry.attemptNumber}`
        && result.outputSha256 === hashCanonical(result.output),
      `${entry.logicalOperationId}: retained gold result/execution identity differs from its fixed call attempt`);
    completed.push({
      entry,
      request,
      result,
      output: result.output,
      dispatchReceiptSha256: dispatchBinding.receipt.dispatchReceiptSha256,
    });
  }
  const dispatch = completed.map(({ dispatchReceiptSha256 }) => dispatchReceiptSha256);
  requireCondition(new Set(dispatch).size === 4,
    "retained gold calls reuse a worker dispatch receipt across independent roles");
  validateForwardGoldBlindRaterOutput(completed[0].output, {
    expectedBookId: bookId,
    expectedSourceHash: sourceHash,
    expectedChapters,
    expectedComponentInventory,
    expectedRaterRole: "primary",
    expectedDispatchReceiptSha256: dispatch[0],
  });
  validateForwardGoldBlindRaterOutput(completed[1].output, {
    expectedBookId: bookId,
    expectedSourceHash: sourceHash,
    expectedChapters,
    expectedComponentInventory,
    expectedRaterRole: "verification",
    expectedDispatchReceiptSha256: dispatch[1],
  });
  const projectedEvaluation = projectForwardGoldAdjudication(completed[2].output, {
    expectedBookId: bookId,
    expectedSourceHash: sourceHash,
    expectedChapters,
    expectedComponentInventory,
    sourceAwareExternalAccuracy,
    expectedSourceLaneEvidence,
    blindRaters: {
      primary: { output: completed[0].output, expectedDispatchReceiptSha256: dispatch[0] },
      verification: { output: completed[1].output, expectedDispatchReceiptSha256: dispatch[1] },
    },
  });
  validateForwardGoldSweepOutputBinding(completed[3].output, {
    expectedBookId: bookId,
    expectedSourceHash: sourceHash,
    expectedDispatchReceiptSha256: dispatch[3],
    expectedChapters,
  });
  const validatedGold = validateForwardGoldEvaluationArtifacts({
    bookId,
    finalChapters,
    finalChapterContentHashes: finalContentHashes,
    adjudicatorOutput: { evaluation: projectedEvaluation },
    sweepOutput: completed[3].output,
  });
  requireCondition(hashCanonical(projectedEvaluation) === evaluatorPayload
      && hashCanonical(validatedGold.evaluation) === evaluatorPayload
      && hashCanonical(validatedGold.sweep) === hashCanonical(evaluation.sweep),
    "retained gold evaluation/sweep are not deterministic projections of exact model outputs and final chapter bytes");
  const resultByActor = new Map(completed.map((item) => [String(item.result.actorId), item]));
  for (const rater of binding.raters) {
    const retained = resultByActor.get(rater.actorId);
    requireCondition(retained?.entry.executionId === rater.executionId
        && retained.result.outputSha256 === rater.payloadSha256,
      `gold blind-rater ${rater.actorId} evidence is not bound to its exact model result`);
  }
  const evaluatorActor = resultByActor.get(binding.evaluator.actorId);
  const sweepActor = resultByActor.get(binding.sweep.actorId);
  requireCondition(evaluatorActor?.entry.executionId === binding.evaluator.executionId
      && binding.evaluator.payloadSha256 === hashCanonical(projectedEvaluation),
    "gold evaluator evidence is not bound to the exact adjudicator output projection");
  requireCondition(sweepActor?.entry.executionId === binding.sweep.executionId
      && binding.sweep.payloadSha256 === hashCanonical(validatedGold.sweep)
      && hashCanonical(asRecord(sweepActor.output, "retained gold sweep output").sweep) === binding.sweep.payloadSha256,
    "gold sweep evidence is not bound to the exact retained sweep output projection");

  const sweep = evaluation.sweep;
  requireCondition(sweep.schemaVersion === "sweep-attest-v1" && sweep.verdict === "PASS",
    "retained independent gold sweep is not PASS");
  for (const family of REQUIRED_SWEEP_FAMILIES) {
    requireCondition(sweep.checkedFamilies.includes(family), `retained gold sweep omitted ${family}`);
  }
  requireCondition(hashCanonical(sweep.contentHashes) === hashCanonical(finalContentHashes),
    "retained gold sweep content hashes are stale against final chapters");
}

export type Imp24RetainedCampaignEvidenceProofV1 = {
  schema: typeof IMP24_RETAINED_CAMPAIGN_EVIDENCE_PROOF_SCHEMA;
  kind: "pilot" | "gold";
  experimentId: string;
  inputFreezeSha256: string;
  inputMaterializationProofSha256: string;
  manifestSha256: string;
  preflightSha256: string;
  budgetSha256: string;
  ledgerSha256: string;
  campaignResultSha256: string;
  firstWriteSnapshotSha256: string;
  attemptCount: number;
  persistenceReceiptCount: number;
  codexExecInvocations: number;
  infrastructureReplays: number;
  artifactBytesSha256: {
    inputFreeze: string;
    inputMaterialization: string;
    manifest: string;
    preflight: string;
    budget: string;
    ledger: string;
    campaignResult: string;
  };
  externalCapabilities: typeof ZERO_CAPABILITIES;
  proofSha256: string;
};

export type VerifyForwardRetainedCampaignEvidenceV3Args = {
  kind: "pilot" | "gold";
  phaseDir: string;
  inputFreezePath: string;
  roleAssignmentFreeze: ForwardRoleAssignmentFreezeV3;
};

export type VerifiedForwardRetainedCampaignEvidenceV3 = {
  proof: Readonly<Imp24RetainedCampaignEvidenceProofV1>;
  result: Readonly<RunForwardLiveCampaignResultV3>;
  manifest: Readonly<FrozenForwardValidationManifestV1>;
  inputFreeze: Readonly<ForwardInputFreezeV1>;
  readonly [VERIFIED_RETAINED_CAMPAIGN]: true;
};

export function assertVerifiedForwardRetainedCampaignEvidenceV3(
  value: VerifiedForwardRetainedCampaignEvidenceV3,
  kind: "pilot" | "gold",
): void {
  requireCondition(value?.[VERIFIED_RETAINED_CAMPAIGN] === true,
    `${kind} activation evidence was not produced by the retained campaign verifier`);
  requireCondition(value.proof.kind === kind, `${kind} activation received another campaign kind`);
  const { proofSha256, ...core } = value.proof;
  requireCondition(proofSha256 === hashCanonical(core), `${kind} retained campaign proof hash drift`);
  requireCondition(value.proof.campaignResultSha256 === hashCanonical(value.result)
      && value.proof.manifestSha256 === value.manifest.manifestSha256
      && value.manifest.manifestSha256 === hashCanonical(value.manifest.manifest)
      && value.proof.inputFreezeSha256 === value.inputFreeze.freezeSha256,
    `${kind} retained campaign value was mutated after verification`);
}

export function verifyForwardRetainedCampaignEvidenceV3(
  args: VerifyForwardRetainedCampaignEvidenceV3Args,
): VerifiedForwardRetainedCampaignEvidenceV3 {
  const phaseDir = resolve(args.phaseDir);
  const liveDir = resolve(phaseDir, "live-campaign");
  const paths = {
    inputFreeze: resolve(args.inputFreezePath),
    inputMaterialization: resolve(phaseDir, "input-materialization.json"),
    manifest: resolve(liveDir, "validation-manifest.json"),
    preflight: resolve(liveDir, "live-preflight.json"),
    budget: resolve(liveDir, "call-budget.json"),
    ledger: resolve(liveDir, "call-ledger.json"),
    campaignResult: resolve(liveDir, "campaign-result.json"),
  };
  requireCondition(paths.inputFreeze === resolve(phaseDir, "input-freeze.json"),
    `${args.kind} retained input freeze is outside the exact phase directory`);
  const inputFreeze = parseJson<ForwardInputFreezeV1>(paths.inputFreeze, `${args.kind} input freeze`);
  const manifest = parseJson<FrozenForwardValidationManifestV1>(paths.manifest, `${args.kind} validation manifest`);
  const preflight = parseJson<ForwardLiveCampaignPreflightV3>(paths.preflight, `${args.kind} live preflight`);
  const result = parseJson<RunForwardLiveCampaignResultV3>(paths.campaignResult, `${args.kind} campaign result`);

  assertManifest(manifest.manifest);
  requireCondition(hashCanonical(manifest.manifest) === manifest.manifestSha256,
    `${args.kind} retained manifest self hash drift`);
  requireCondition(manifest.manifest.kind === args.kind, `${args.kind} retained manifest kind mismatch`);
  requireCondition(args.kind === "pilot"
    ? PILOT_CORRECTION_ID.test(manifest.manifest.experimentId)
    : manifest.manifest.experimentId === GOLD_ENVELOPE_EXPERIMENT_ID,
  `${args.kind} retained manifest has the wrong fresh envelope identity`);
  validateExactDenominator(args.kind, manifest.manifest, inputFreeze);
  const materializationProof = validateForwardInputMaterializationArtifact({
    phaseDir,
    artifactPath: paths.inputMaterialization,
    manifest,
    inputFreeze,
  });
  const { proofSha256: materializationProofSha256, ...materializationProofCore } = materializationProof;
  requireCondition(materializationProof.artifactPath === paths.inputMaterialization
      && materializationProofSha256 === hashCanonical(materializationProofCore)
      && materializationProof.artifactBytesSha256 === manifest.manifest.inputMaterializationSha256,
    `${args.kind} retained input-materialization proof is stale or bound to another artifact`);

  requireCondition(result.schema === FORWARD_LIVE_CAMPAIGN_RESULT_V3_SCHEMA
      && result.campaign.schema === FORWARD_VALIDATION_RESULT_SCHEMA
      && result.campaign.kind === args.kind
      && result.campaign.experimentId === manifest.manifest.experimentId
      && result.campaign.manifestSha256 === manifest.manifestSha256,
    `${args.kind} retained result does not belong to the exact manifest`);
  requireCondition(result.apiCallsMade === 0 && result.publish === false && result.promote === false
      && result.deploy === false && result.upload === false && allFalse(result.campaign.capabilitiesUsed),
    `${args.kind} retained result records an API/external capability`);
  requireCondition(result.campaign.accepted === true && result.campaign.hardFailures.length === 0,
    `${args.kind} retained campaign is not accepted`);

  requireCondition(preflight.schema === FORWARD_LIVE_CAMPAIGN_PREFLIGHT_V3_SCHEMA
      && preflight.kind === args.kind
      && preflight.experimentId === manifest.manifest.experimentId,
    `${args.kind} retained live preflight identity mismatch`);
  requireCondition(preflight.preflightSha256 === hashWithout(preflight as unknown as Record<string, unknown>, "preflightSha256"),
    `${args.kind} retained live preflight self hash drift`);
  requireCondition(hashCanonical(result.preflight) === hashCanonical(preflight),
    `${args.kind} campaign result embeds another live preflight`);
  requireCondition(preflight.manifestSha256 === manifest.manifestSha256
      && preflight.inputFreezeSha256 === inputFreeze.freezeSha256
      && preflight.inputMaterializationSha256 === manifest.manifest.inputMaterializationSha256
      && preflight.roleAssignmentFreezeSha256 === args.roleAssignmentFreeze.freezeSha256
      && preflight.roleAssignmentSha256 === args.roleAssignmentFreeze.roleAssignmentSha256
      && preflight.productionInstrumentSealSha256 === args.roleAssignmentFreeze.productionInstrumentSealSha256,
    `${args.kind} retained preflight differs from the denominator/manifest/fixed roles/seal`);
  requireCondition(preflight.executionRoute === "codex_exec_chatgpt_subscription"
      && preflight.authMode === "chatgpt"
      && preflight.apiKeyPresent === false
      && preflight.apiFallbackAllowed === false
      && preflight.directHttpOrSdkAllowed === false
      && preflight.apiCallsMade === 0
      && preflight.forbiddenProviderEnvKeysPresent.length === 0
      && preflight.maxParallel === 2
      && allFalse(preflight.externalCapabilities),
    `${args.kind} retained preflight is not the frozen key-free ChatGPT route`);
  if (manifest.manifest.kind === "gold") {
    requireCondition(preflight.goldEvaluatorInstrumentSha256 === manifest.manifest.goldEvaluatorInstrumentSha256,
      "gold retained preflight differs from the fixed evaluator instrument");
  } else {
    requireCondition(preflight.goldEvaluatorInstrumentSha256 === null,
      "pilot retained preflight unexpectedly carries a gold evaluator instrument");
  }

  validateAttempts(phaseDir, manifest.manifest, result.campaign);
  const persisted = validatePersistence(phaseDir, result.campaign);
  const { budget, ledger, calls } = validateCallLedger(
    liveDir,
    manifest,
    args.roleAssignmentFreeze,
    result,
    materializationProof,
  );
  if (args.kind === "gold") validateGoldEvidence(
    phaseDir,
    manifest,
    materializationProof,
    args.roleAssignmentFreeze,
    result.campaign,
    persisted,
    ledger,
    calls,
  );
  else {
    requireCondition(result.campaign.goldEvaluation === null
      && result.campaign.persistenceReceipts.every((receipt) => receipt.kind !== "gold-evaluator" && receipt.kind !== "gold-rater" && receipt.kind !== "gold-sweep"),
    "pilot retained evidence contains gold-only artifacts");
  }

  const finalMaterializationProof = validateForwardInputMaterializationArtifact({
    phaseDir,
    artifactPath: paths.inputMaterialization,
    manifest,
    inputFreeze,
  });
  requireCondition(hashCanonical(finalMaterializationProof) === hashCanonical(materializationProof),
    `${args.kind} input materialization changed during retained-evidence verification`);

  const artifactBytes = {
    inputFreeze: artifactBytesSha256(paths.inputFreeze, `${args.kind} input freeze`),
    inputMaterialization: artifactBytesSha256(paths.inputMaterialization, `${args.kind} input materialization`),
    manifest: artifactBytesSha256(paths.manifest, `${args.kind} manifest`),
    preflight: artifactBytesSha256(paths.preflight, `${args.kind} preflight`),
    budget: artifactBytesSha256(paths.budget, `${args.kind} budget`),
    ledger: artifactBytesSha256(paths.ledger, `${args.kind} ledger`),
    campaignResult: artifactBytesSha256(paths.campaignResult, `${args.kind} campaign result`),
  };
  const core = {
    schema: IMP24_RETAINED_CAMPAIGN_EVIDENCE_PROOF_SCHEMA,
    kind: args.kind,
    experimentId: manifest.manifest.experimentId,
    inputFreezeSha256: inputFreeze.freezeSha256,
    inputMaterializationProofSha256: materializationProof.proofSha256,
    manifestSha256: manifest.manifestSha256,
    preflightSha256: preflight.preflightSha256,
    budgetSha256: budget.budgetSha256,
    ledgerSha256: hashCanonical(ledger),
    campaignResultSha256: hashCanonical(result),
    firstWriteSnapshotSha256: result.campaign.firstWriteSnapshotSha256,
    attemptCount: result.campaign.attempts.length,
    persistenceReceiptCount: result.campaign.persistenceReceipts.length,
    codexExecInvocations: ledger.codexExecInvocations,
    infrastructureReplays: ledger.infrastructureReplays,
    artifactBytesSha256: artifactBytes,
    externalCapabilities: ZERO_CAPABILITIES,
  };
  const proof = Object.freeze({ ...core, proofSha256: hashCanonical(core) });
  const verified = {
    proof,
    result: deepFreeze(result),
    manifest: deepFreeze(manifest),
    inputFreeze: deepFreeze(inputFreeze),
  } as VerifiedForwardRetainedCampaignEvidenceV3;
  Object.defineProperty(verified, VERIFIED_RETAINED_CAMPAIGN, { value: true, enumerable: false });
  return Object.freeze(verified);
}
