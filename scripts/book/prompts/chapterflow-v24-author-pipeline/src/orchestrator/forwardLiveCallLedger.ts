/**
 * Crash-safe live-call accounting for the IMP-22 pilot and gold campaigns.
 *
 * This module never calls a provider on its own.  It freezes a phase budget,
 * records every attempted model operation before and after execution, reuses
 * only exact persisted request/receipt pairs, and permits one replay solely for
 * timeout/capacity/transient infrastructure outcomes.  No API route or fallback
 * can be represented by the ledger contract.
 */

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { hashCanonical, sha256Hex } from "../contracts/contractUtil.js";
import { canonicalJson } from "../lib/canonicalJson.js";
import { writeFileAtomic } from "../lib/atomicWrite.js";
import type {
  ForwardPanelRole,
  ForwardReviewExecutionRequestV1,
  ForwardReviewExecutionResultV1,
  ForwardReviewerExecutor,
} from "./forwardChapterConductor.js";
import {
  ForwardReviewerExecutorError,
  type ForwardReviewerFailureCode,
} from "./forwardReviewerExecutor.js";
import {
  isInForwardReaderAuditSubset,
  validateForwardPanelReviewPolicy,
  type ForwardPanelReviewPolicyV1,
} from "./forwardReviewPolicy.js";
import type {
  ForwardCandidateStage,
  FrozenForwardValidationManifestV1,
} from "./forwardValidationCampaign.js";

export const FORWARD_LIVE_PHASE_BUDGET_SCHEMA = "forward-live-phase-budget-v1" as const;
export const FORWARD_LIVE_CALL_LEDGER_SCHEMA = "forward-live-call-ledger-v1" as const;
export const FORWARD_LIVE_CALL_RECEIPT_SCHEMA = "forward-live-call-receipt-v1" as const;
export const FORWARD_LIVE_MODEL_OPERATION_RECEIPT_SCHEMA = "forward-live-model-operation-receipt-v1" as const;

export const FORWARD_LIVE_CALL_CATEGORIES = [
  "pilot-author-first-write",
  "pilot-author-repair",
  "pilot-author-regeneration",
  "pilot-reader-primary",
  "pilot-reader-audit",
  "pilot-source-primary",
  "pilot-source-adjudicator",
  "pilot-quiz-adjudicator",
  "gold-author-first-write",
  "gold-author-repair",
  "gold-author-regeneration",
  "gold-reader-primary",
  "gold-reader-audit",
  "gold-source-primary",
  "gold-source-adjudicator",
  "gold-quiz-adjudicator",
  "gold-book-evaluator",
] as const;

export type ForwardLiveCallCategory = (typeof FORWARD_LIVE_CALL_CATEGORIES)[number];
export type ForwardLiveCampaignKind = "pilot" | "gold";
export type ForwardLiveCallStatus = "completed" | ForwardReviewerFailureCode;

export type ForwardLivePhaseBudgetV1 = {
  schema: typeof FORWARD_LIVE_PHASE_BUDGET_SCHEMA;
  experimentId: string;
  kind: ForwardLiveCampaignKind;
  manifestSha256: string;
  panelPolicySha256: string;
  targetCount: number;
  auditTargetCount: number;
  expectedCalls: Record<ForwardLiveCallCategory, number>;
  maximumCallsBeforeInfrastructureReplays: Record<ForwardLiveCallCategory, number>;
  maximumInfrastructureReplays: Record<ForwardLiveCallCategory, number>;
  expectedTotalCalls: number;
  maximumTotalCallsBeforeInfrastructureReplays: number;
  hardMaximumCalls: number;
  maximumIsNotATarget: true;
  outputInformedBonusCalls: false;
  apiCallsAllowed: 0;
  apiFallbackAllowed: false;
  budgetSha256: string;
};

export type ForwardLiveCallContextV1 = {
  category: ForwardLiveCallCategory;
  bookId: string;
  chapterNumber: number | null;
  stage: ForwardCandidateStage | "book-evaluation";
  logicalOperationId: string;
};

export type ForwardLiveCallEntryV1 = ForwardLiveCallContextV1 & {
  attemptId: string;
  attemptNumber: 1 | 2;
  requestSha256: string;
  receiptSha256: string | null;
  status: "REQUESTED" | ForwardLiveCallStatus;
  executionId: string | null;
  cached: boolean;
  recordedAt: string;
};

export type ForwardLiveCallLedgerV1 = {
  schema: typeof FORWARD_LIVE_CALL_LEDGER_SCHEMA;
  experimentId: string;
  kind: ForwardLiveCampaignKind;
  manifestSha256: string;
  budgetSha256: string;
  executionRoute: "codex_exec_chatgpt_subscription";
  authMode: "chatgpt";
  apiKeyPresent: false;
  apiCallsMade: 0;
  apiFallbackAllowed: false;
  entries: ForwardLiveCallEntryV1[];
  codexExecInvocations: number;
  cachedReceipts: number;
  infrastructureReplays: number;
  maxPlanCapacityEvents: number;
  safeguardsOrRefusals: number;
};

type PersistedForwardLiveCallReceiptV1 = {
  schema: typeof FORWARD_LIVE_CALL_RECEIPT_SCHEMA;
  status: ForwardLiveCallStatus;
  executionId: string | null;
  result: ForwardReviewExecutionResultV1 | null;
  /** Generic author/evaluator operations bind their separately persisted full
   * TResult through this digest. Reviewer receipts may leave it null because
   * their full typed result is already present above. */
  resultSha256?: string | null;
  failureMessage: string | null;
};

export type ForwardLiveModelOperationReceiptV1<TResult> = {
  schema: typeof FORWARD_LIVE_MODEL_OPERATION_RECEIPT_SCHEMA;
  status: ForwardLiveCallStatus;
  executionId: string | null;
  result: TResult | null;
  failureMessage: string | null;
};

export class ForwardLiveCallLedgerError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ForwardLiveCallLedgerError";
  }
}

function requireCondition(condition: unknown, message: string): asserts condition {
  if (!condition) throw new ForwardLiveCallLedgerError(message);
}

function blankCounts(): Record<ForwardLiveCallCategory, number> {
  return Object.fromEntries(FORWARD_LIVE_CALL_CATEGORIES.map((category) => [category, 0])) as Record<ForwardLiveCallCategory, number>;
}

function sumCounts(counts: Record<ForwardLiveCallCategory, number>): number {
  return Object.values(counts).reduce((total, count) => total + count, 0);
}

/**
 * Freeze a conservative phase ceiling.  Expected calls describe a clean
 * first-write pass.  The pre-replay maximum covers, for every chapter, the
 * first attempt plus one typed repair plus the narrowly allowed regeneration,
 * with all conditional audit/adjudication reads.  The hard maximum adds at
 * most one infrastructure replay to each permitted call and is never a target.
 */
export function buildForwardLivePhaseBudget(args: {
  manifest: FrozenForwardValidationManifestV1;
  panelPolicy: ForwardPanelReviewPolicyV1;
  /** Must be frozen before a gold phase; the IMP-22 production composition uses
   * two blind raters, one adjudicator, and one independent book-sweep call. */
  goldBookEvaluatorExpectedCalls?: number;
  goldBookEvaluatorMaximumCallsBeforeReplay?: number;
}): ForwardLivePhaseBudgetV1 {
  const manifest = args.manifest.manifest;
  requireCondition(hashCanonical(manifest) === args.manifest.manifestSha256, "live-call budget: stale validation manifest");
  validateForwardPanelReviewPolicy(args.panelPolicy);
  requireCondition(manifest.kind === "pilot" || manifest.kind === "gold", "live-call budget: invalid campaign kind");
  requireCondition(manifest.targets.length > 0, "live-call budget: empty target denominator");

  const kind = manifest.kind;
  const targetCount = manifest.targets.length;
  const auditTargetCount = manifest.targets.filter((target) => isInForwardReaderAuditSubset(
    args.panelPolicy.auditSubset,
    { bookId: target.bookId, chapterNumber: target.chapterNumber },
  )).length;
  const evaluatorExpected = kind === "gold" ? args.goldBookEvaluatorExpectedCalls : 0;
  const evaluatorMaximum = kind === "gold" ? args.goldBookEvaluatorMaximumCallsBeforeReplay : 0;
  if (kind === "gold") {
    requireCondition(Number.isSafeInteger(evaluatorExpected) && evaluatorExpected! >= 2, "gold live-call budget requires at least two frozen independent evaluator calls");
    requireCondition(Number.isSafeInteger(evaluatorMaximum) && evaluatorMaximum! >= evaluatorExpected!, "gold evaluator maximum is below its expected calls");
  }

  const expectedCalls = blankCounts();
  expectedCalls[`${kind}-author-first-write`] = targetCount;
  expectedCalls[`${kind}-reader-primary`] = targetCount;
  expectedCalls[`${kind}-reader-audit`] = auditTargetCount;
  expectedCalls[`${kind}-source-primary`] = targetCount;
  expectedCalls[`${kind}-quiz-adjudicator`] = targetCount;
  if (kind === "gold") expectedCalls["gold-book-evaluator"] = evaluatorExpected!;

  const maximumCallsBeforeInfrastructureReplays = blankCounts();
  maximumCallsBeforeInfrastructureReplays[`${kind}-author-first-write`] = targetCount;
  maximumCallsBeforeInfrastructureReplays[`${kind}-author-repair`] = targetCount;
  maximumCallsBeforeInfrastructureReplays[`${kind}-author-regeneration`] = targetCount;
  // Three reviewed states is the absolute repair -> permitted-regeneration
  // envelope.  Every state gets all mandatory lanes, every audit-selected
  // coordinate gets the frozen audit, and every source read may adjudicate.
  maximumCallsBeforeInfrastructureReplays[`${kind}-reader-primary`] = targetCount * 3;
  maximumCallsBeforeInfrastructureReplays[`${kind}-reader-audit`] = auditTargetCount * 3;
  maximumCallsBeforeInfrastructureReplays[`${kind}-source-primary`] = targetCount * 3;
  maximumCallsBeforeInfrastructureReplays[`${kind}-source-adjudicator`] = targetCount * 3;
  maximumCallsBeforeInfrastructureReplays[`${kind}-quiz-adjudicator`] = targetCount * 3;
  if (kind === "gold") maximumCallsBeforeInfrastructureReplays["gold-book-evaluator"] = evaluatorMaximum!;

  const maximumInfrastructureReplays = { ...maximumCallsBeforeInfrastructureReplays };
  const base = {
    schema: FORWARD_LIVE_PHASE_BUDGET_SCHEMA,
    experimentId: manifest.experimentId,
    kind,
    manifestSha256: args.manifest.manifestSha256,
    panelPolicySha256: args.panelPolicy.policySha256,
    targetCount,
    auditTargetCount,
    expectedCalls,
    maximumCallsBeforeInfrastructureReplays,
    maximumInfrastructureReplays,
    expectedTotalCalls: sumCounts(expectedCalls),
    maximumTotalCallsBeforeInfrastructureReplays: sumCounts(maximumCallsBeforeInfrastructureReplays),
    hardMaximumCalls: sumCounts(maximumCallsBeforeInfrastructureReplays) + sumCounts(maximumInfrastructureReplays),
    maximumIsNotATarget: true as const,
    outputInformedBonusCalls: false as const,
    apiCallsAllowed: 0 as const,
    apiFallbackAllowed: false as const,
  };
  return { ...base, budgetSha256: hashCanonical(base) };
}

function stableJson(value: unknown): string {
  return `${canonicalJson(value)}\n`;
}

function writeJson(path: string, value: unknown): void {
  writeFileAtomic(path, stableJson(value));
}

function readJson<T>(path: string): T {
  try {
    return JSON.parse(readFileSync(path, "utf8")) as T;
  } catch (error) {
    throw new ForwardLiveCallLedgerError(`cannot read persisted live-call artifact ${path}: ${(error as Error).message}`);
  }
}

function assertBudget(budget: ForwardLivePhaseBudgetV1): void {
  const { budgetSha256, ...base } = budget;
  requireCondition(hashCanonical(base) === budgetSha256, "live-call budget hash drift");
  requireCondition(budget.maximumIsNotATarget === true && budget.outputInformedBonusCalls === false, "live-call budget permits output-informed bonus work");
  requireCondition(budget.apiCallsAllowed === 0 && budget.apiFallbackAllowed === false, "live-call budget permits an API route");
}

function emptyLedger(budget: ForwardLivePhaseBudgetV1): ForwardLiveCallLedgerV1 {
  return {
    schema: FORWARD_LIVE_CALL_LEDGER_SCHEMA,
    experimentId: budget.experimentId,
    kind: budget.kind,
    manifestSha256: budget.manifestSha256,
    budgetSha256: budget.budgetSha256,
    executionRoute: "codex_exec_chatgpt_subscription",
    authMode: "chatgpt",
    apiKeyPresent: false,
    apiCallsMade: 0,
    apiFallbackAllowed: false,
    entries: [],
    codexExecInvocations: 0,
    cachedReceipts: 0,
    infrastructureReplays: 0,
    maxPlanCapacityEvents: 0,
    safeguardsOrRefusals: 0,
  };
}

function failureCode(error: unknown): ForwardReviewerFailureCode {
  if (error instanceof ForwardReviewerExecutorError) return error.code;
  return "integrity_failure";
}

function replayable(status: ForwardLiveCallStatus): boolean {
  return status === "timeout" || status === "provider_capacity" || status === "transient_execution_failure";
}

export type ForwardLiveCallLedgerController = {
  budget: ForwardLivePhaseBudgetV1;
  ledger: ForwardLiveCallLedgerV1;
  ledgerPath: string;
  begin: (args: {
    context: ForwardLiveCallContextV1;
    attemptNumber: 1 | 2;
    requestSha256: string;
  }) => string;
  complete: (args: {
    attemptId: string;
    requestSha256: string;
    receipt: PersistedForwardLiveCallReceiptV1;
  }) => void;
  noteCached: (args: {
    context: ForwardLiveCallContextV1;
    attemptNumber: 1 | 2;
    requestSha256: string;
    receipt: PersistedForwardLiveCallReceiptV1;
  }) => void;
};

export function createForwardLiveCallLedger(args: {
  budget: ForwardLivePhaseBudgetV1;
  phaseDir: string;
}): ForwardLiveCallLedgerController {
  assertBudget(args.budget);
  const ledgerPath = resolve(args.phaseDir, "call-ledger.json");
  const ledger = existsSync(ledgerPath) ? readJson<ForwardLiveCallLedgerV1>(ledgerPath) : emptyLedger(args.budget);
  requireCondition(ledger.schema === FORWARD_LIVE_CALL_LEDGER_SCHEMA, "live-call ledger schema drift");
  requireCondition(ledger.experimentId === args.budget.experimentId, "live-call ledger experiment drift");
  requireCondition(ledger.manifestSha256 === args.budget.manifestSha256, "live-call ledger manifest drift");
  requireCondition(ledger.budgetSha256 === args.budget.budgetSha256, "live-call ledger budget drift");
  requireCondition(ledger.apiCallsMade === 0 && ledger.apiFallbackAllowed === false, "live-call ledger records a prohibited API route");

  const begin: ForwardLiveCallLedgerController["begin"] = ({ context, attemptNumber, requestSha256 }) => {
    requireCondition(FORWARD_LIVE_CALL_CATEGORIES.includes(context.category), `unknown live-call category ${context.category}`);
    const attemptId = sha256Hex(`${context.logicalOperationId}\0${attemptNumber}\0${requestSha256}`);
    const existing = ledger.entries.find((entry) => entry.attemptId === attemptId);
    requireCondition(existing === undefined, `live-call attempt ${attemptId} already exists; use the exact persisted receipt path`);
    const categoryEntries = ledger.entries.filter((entry) => entry.category === context.category && entry.cached === false);
    const firstAttempts = categoryEntries.filter((entry) => entry.attemptNumber === 1).length;
    const replayAttempts = categoryEntries.filter((entry) => entry.attemptNumber === 2).length;
    if (attemptNumber === 1) {
      requireCondition(
        firstAttempts < args.budget.maximumCallsBeforeInfrastructureReplays[context.category],
        `${context.category}: frozen pre-replay maximum exhausted`,
      );
    } else {
      requireCondition(replayAttempts < args.budget.maximumInfrastructureReplays[context.category], `${context.category}: frozen replay maximum exhausted`);
      ledger.infrastructureReplays += 1;
    }
    requireCondition(ledger.codexExecInvocations < args.budget.hardMaximumCalls, "live-call hard maximum exhausted");
    ledger.codexExecInvocations += 1;
    ledger.entries.push({
      ...context,
      attemptId,
      attemptNumber,
      requestSha256,
      receiptSha256: null,
      status: "REQUESTED",
      executionId: null,
      cached: false,
      recordedAt: new Date().toISOString(),
    });
    writeJson(ledgerPath, ledger);
    return attemptId;
  };

  const complete: ForwardLiveCallLedgerController["complete"] = ({ attemptId, requestSha256, receipt }) => {
    const entry = ledger.entries.find((candidate) => candidate.attemptId === attemptId);
    requireCondition(entry !== undefined, `live-call attempt ${attemptId} was not reserved before completion`);
    requireCondition(entry.requestSha256 === requestSha256, `live-call attempt ${attemptId} request hash drift`);
    const receiptSha256 = hashCanonical(receipt);
    if (entry.status !== "REQUESTED") {
      requireCondition(entry.receiptSha256 === receiptSha256 && entry.status === receipt.status, `live-call attempt ${attemptId} receipt drift`);
      return;
    }
    entry.receiptSha256 = receiptSha256;
    entry.status = receipt.status;
    entry.executionId = receipt.executionId;
    if (receipt.status === "provider_capacity") ledger.maxPlanCapacityEvents += 1;
    if (receipt.status === "refusal") ledger.safeguardsOrRefusals += 1;
    writeJson(ledgerPath, ledger);
  };

  const noteCached: ForwardLiveCallLedgerController["noteCached"] = ({ context, attemptNumber, requestSha256, receipt }) => {
    const attemptId = sha256Hex(`${context.logicalOperationId}\0${attemptNumber}\0${requestSha256}`);
    const entry = ledger.entries.find((candidate) => candidate.attemptId === attemptId);
    requireCondition(entry !== undefined, `cached live-call receipt ${attemptId} has no durable ledger reservation`);
    complete({ attemptId, requestSha256, receipt });
    ledger.cachedReceipts += 1;
    writeJson(ledgerPath, ledger);
  };
  writeJson(resolve(args.phaseDir, "call-budget.json"), args.budget);
  writeJson(ledgerPath, ledger);
  return { budget: args.budget, ledger, ledgerPath, begin, complete, noteCached };
}

function receiptPath(phaseDir: string, logicalId: string, attemptNumber: 1 | 2): { request: string; receipt: string } {
  const dir = resolve(phaseDir, "model-calls", sha256Hex(logicalId), `attempt-${attemptNumber}`);
  return { request: resolve(dir, "request.json"), receipt: resolve(dir, "receipt.json") };
}

/**
 * Crash-safe accounting for non-reviewer model operations (author writes and
 * full-book evaluator/rater reads).  The exact request projection is persisted
 * and a REQUESTED ledger entry is durable before `execute` may reach a model.
 * A retained exact receipt is reused without execution.  Only the same three
 * typed infrastructure outcomes may receive the single second attempt.
 *
 * `restoreCached` is intentionally explicit: an author receipt can carry the
 * generated candidate bytes and restore them into a newly minted isolated
 * attempt workspace before deterministic validation resumes.
 */
export async function runLedgeredForwardModelOperation<TRequest, TResult>(args: {
  controller: ForwardLiveCallLedgerController;
  phaseDir: string;
  context: ForwardLiveCallContextV1;
  request: TRequest;
  execute: (attemptNumber: 1 | 2) => Promise<{ executionId: string; result: TResult }>;
  restoreCached?: (result: TResult) => Promise<void> | void;
  classifyError?: (error: unknown) => ForwardReviewerFailureCode;
}): Promise<TResult> {
  const requestSha256 = hashCanonical(args.request);
  for (const attemptNumber of [1, 2] as const) {
    const paths = receiptPath(args.phaseDir, args.context.logicalOperationId, attemptNumber);
    let receipt: ForwardLiveModelOperationReceiptV1<TResult>;
    let cached = false;
    if (existsSync(paths.request) || existsSync(paths.receipt)) {
      requireCondition(existsSync(paths.request) && existsSync(paths.receipt), `${args.context.logicalOperationId}: partial persisted request/receipt pair`);
      const priorRequest = readJson<{ requestSha256?: string }>(paths.request);
      requireCondition(priorRequest.requestSha256 === requestSha256, `${args.context.logicalOperationId}: request changed on resume`);
      receipt = readJson<ForwardLiveModelOperationReceiptV1<TResult>>(paths.receipt);
      cached = true;
    } else {
      writeJson(paths.request, { requestSha256, request: args.request });
      const attemptId = args.controller.begin({ context: args.context, attemptNumber, requestSha256 });
      try {
        const completed = await args.execute(attemptNumber);
        receipt = {
          schema: FORWARD_LIVE_MODEL_OPERATION_RECEIPT_SCHEMA,
          status: "completed",
          executionId: completed.executionId,
          result: completed.result,
          failureMessage: null,
        };
      } catch (error) {
        receipt = {
          schema: FORWARD_LIVE_MODEL_OPERATION_RECEIPT_SCHEMA,
          status: args.classifyError?.(error) ?? failureCode(error),
          executionId: null,
          result: null,
          failureMessage: (error as Error).message.slice(0, 4_000),
        };
      }
      writeJson(paths.receipt, receipt);
      args.controller.complete({
        attemptId,
        requestSha256,
        receipt: {
          schema: FORWARD_LIVE_CALL_RECEIPT_SCHEMA,
          status: receipt.status,
          executionId: receipt.executionId,
          result: null,
          resultSha256: receipt.result === null ? null : hashCanonical(receipt.result),
          failureMessage: receipt.failureMessage,
        },
      });
    }
    requireCondition(receipt.schema === FORWARD_LIVE_MODEL_OPERATION_RECEIPT_SCHEMA, `${args.context.logicalOperationId}: model-operation receipt schema drift`);
    if (cached) {
      args.controller.noteCached({
        context: args.context,
        attemptNumber,
        requestSha256,
        receipt: {
          schema: FORWARD_LIVE_CALL_RECEIPT_SCHEMA,
          status: receipt.status,
          executionId: receipt.executionId,
          result: null,
          resultSha256: receipt.result === null ? null : hashCanonical(receipt.result),
          failureMessage: receipt.failureMessage,
        },
      });
    }
    if (receipt.status === "completed") {
      requireCondition(receipt.result !== null, `${args.context.logicalOperationId}: completed model-operation receipt has no result`);
      if (cached) await args.restoreCached?.(receipt.result);
      return receipt.result;
    }
    if (attemptNumber === 1 && replayable(receipt.status)) continue;
    throw new ForwardReviewerExecutorError(
      receipt.failureMessage ?? `${args.context.logicalOperationId}: model operation failed with ${receipt.status}`,
      receipt.status,
    );
  }
  throw new ForwardLiveCallLedgerError(`${args.context.logicalOperationId}: unreachable model-operation replay state`);
}

/**
 * Wrap a real reviewer executor with exact resume and bounded infra replay.
 * The category resolver binds panel role to the frozen assignment; it must not
 * inspect reviewer output.
 */
export function createLedgeredForwardReviewerExecutor(args: {
  controller: ForwardLiveCallLedgerController;
  phaseDir: string;
  executor: ForwardReviewerExecutor;
  contextFor: (request: Readonly<ForwardReviewExecutionRequestV1>) => Omit<ForwardLiveCallContextV1, "category">;
  categoryFor: (request: Readonly<ForwardReviewExecutionRequestV1>) => ForwardLiveCallCategory;
  /** Revalidate immutable campaign inputs/instruments immediately before each
   * cached or fresh reviewer attempt, including an infrastructure replay. */
  beforeCall?: (request: Readonly<ForwardReviewExecutionRequestV1>) => Promise<void> | void;
}): ForwardReviewerExecutor {
  return async (request) => {
    const category = args.categoryFor(request);
    const context: ForwardLiveCallContextV1 = { ...args.contextFor(request), category };
    const requestSha256 = hashCanonical(request);
    for (const attemptNumber of [1, 2] as const) {
      await args.beforeCall?.(request);
      const paths = receiptPath(args.phaseDir, context.logicalOperationId, attemptNumber);
      let receipt: PersistedForwardLiveCallReceiptV1;
      let cached = false;
      if (existsSync(paths.request) || existsSync(paths.receipt)) {
        requireCondition(existsSync(paths.request) && existsSync(paths.receipt), `${context.logicalOperationId}: partial persisted request/receipt pair`);
        const priorRequest = readJson<{ requestSha256?: string }>(paths.request);
        requireCondition(priorRequest.requestSha256 === requestSha256, `${context.logicalOperationId}: request changed on resume`);
        receipt = readJson<PersistedForwardLiveCallReceiptV1>(paths.receipt);
        cached = true;
      } else {
        writeJson(paths.request, {
          requestSha256,
          request: {
            ...request,
            task: { sha256: sha256Hex(request.task), bytes: Buffer.byteLength(request.task) },
            artifacts: request.artifacts.map((artifact) => ({
              kind: artifact.kind,
              relPath: artifact.relPath,
              sha256: artifact.sha256,
              bytes: Buffer.byteLength(artifact.content),
            })),
          },
        });
        const attemptId = args.controller.begin({ context, attemptNumber, requestSha256 });
        try {
          const result = await args.executor(request);
          receipt = {
            schema: FORWARD_LIVE_CALL_RECEIPT_SCHEMA,
            status: "completed",
            executionId: result.executionId,
            result,
            failureMessage: null,
          };
        } catch (error) {
          receipt = {
            schema: FORWARD_LIVE_CALL_RECEIPT_SCHEMA,
            status: failureCode(error),
            executionId: null,
            result: null,
            failureMessage: (error as Error).message.slice(0, 4_000),
          };
        }
        writeJson(paths.receipt, receipt);
        args.controller.complete({ attemptId, requestSha256, receipt });
      }
      requireCondition(receipt.schema === FORWARD_LIVE_CALL_RECEIPT_SCHEMA, `${context.logicalOperationId}: receipt schema drift`);
      if (cached) args.controller.noteCached({ context, attemptNumber, requestSha256, receipt });
      if (receipt.status === "completed") {
        requireCondition(receipt.result !== null, `${context.logicalOperationId}: completed receipt has no result`);
        return receipt.result;
      }
      if (attemptNumber === 1 && replayable(receipt.status)) continue;
      throw new ForwardReviewerExecutorError(
        receipt.failureMessage ?? `${context.logicalOperationId}: reviewer failed with ${receipt.status}`,
        receipt.status,
      );
    }
    throw new ForwardLiveCallLedgerError(`${context.logicalOperationId}: unreachable reviewer replay state`);
  };
}

/** Map a frozen conductor panel role to a ledger category without inspecting output. */
export function categoryForForwardPanelRole(kind: ForwardLiveCampaignKind, role: ForwardPanelRole): ForwardLiveCallCategory {
  const suffix: Record<ForwardPanelRole, string> = {
    readerPrimary: "reader-primary",
    readerAudit: "reader-audit",
    sourcePrimary: "source-primary",
    sourceAdjudicator: "source-adjudicator",
    quizSemanticAdjudicator: "quiz-adjudicator",
  };
  return `${kind}-${suffix[role]}` as ForwardLiveCallCategory;
}
