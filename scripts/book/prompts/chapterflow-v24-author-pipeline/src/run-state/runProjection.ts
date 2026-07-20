import { canonicalJson } from "../lib/canonicalJson.js";
import { RunStateFault, type RunStoreErrorCode } from "./runStore.js";
import type {
  AttemptAdmission,
  AttemptEventV1,
  AttemptFinishedEventV1,
  AttemptHistory,
  AttemptOutcome,
  AttemptSnapshot,
  PersistedRunV1,
  RunDefinition,
  RunSnapshot,
} from "./runTypes.js";

type ValidationCode = Extract<RunStoreErrorCode, "INVALID_INPUT" | "STATE_CORRUPT">;

const ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;
const GIT_SHA = /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/;
const MANIFEST_DIGEST = /^(?:sha256:)?[0-9a-f]{64}$/;
const OUTCOMES: readonly AttemptOutcome[] = [
  "SUCCEEDED",
  "FAILED",
  "TIMED_OUT",
  "CANCELLED",
  "UNKNOWN",
  "ABANDONED",
];
const RUN_STATUSES = ["RUNNING", "CANCEL_REQUESTED", "CANCELLED", "FAILED", "COMPLETED"] as const;

function fail(code: ValidationCode, message: string): never {
  throw new RunStateFault(code, message);
}

function record(value: unknown, where: string, code: ValidationCode): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) fail(code, `${where} must be an object`);
  return value as Record<string, unknown>;
}

function exactKeys(
  value: Record<string, unknown>,
  required: readonly string[],
  optional: readonly string[],
  where: string,
  code: ValidationCode,
): void {
  const allowed = new Set([...required, ...optional]);
  for (const key of required) {
    if (!Object.prototype.hasOwnProperty.call(value, key) || value[key] === undefined) {
      fail(code, `${where}.${key} is required`);
    }
  }
  for (const key of Object.keys(value)) {
    if (!allowed.has(key) || value[key] === undefined) fail(code, `${where}.${key} is not allowed`);
  }
}

function text(value: unknown, where: string, code: ValidationCode, max = 4096): string {
  if (typeof value !== "string" || value.length === 0 || value.length > max || value.includes("\0")) {
    fail(code, `${where} must be a non-empty string of at most ${max} bytes`);
  }
  return value;
}

export function normalizeSafeId(value: unknown, where: string, code: ValidationCode = "INVALID_INPUT"): string {
  const normalized = text(value, where, code, 128);
  if (!ID.test(normalized) || normalized === "." || normalized === "..") fail(code, `${where} is not a safe identifier`);
  return normalized;
}

export function normalizeUtc(value: unknown, where: string, code: ValidationCode = "INVALID_INPUT"): string {
  const normalized = text(value, where, code, 64);
  const millis = Date.parse(normalized);
  if (!Number.isFinite(millis) || new Date(millis).toISOString() !== normalized) {
    fail(code, `${where} must be canonical UTC ISO time`);
  }
  return normalized;
}

function nonNegativeInteger(value: unknown, where: string, code: ValidationCode): number {
  if (!Number.isSafeInteger(value) || (value as number) < 0) fail(code, `${where} must be a non-negative safe integer`);
  return value as number;
}

function logicalPath(value: unknown, where: string, code: ValidationCode): string {
  const normalized = text(value, where, code, 512);
  if (normalized.startsWith("/") || normalized.includes("\\") || /^[A-Za-z]:/.test(normalized)) {
    fail(code, `${where} must be a relative logical path`);
  }
  const segments = normalized.split("/");
  if (segments.some((segment) => segment.length === 0 || segment === "." || segment === "..")) {
    fail(code, `${where} contains an unsafe path segment`);
  }
  return normalized;
}

function candidate(value: unknown, where: string, code: ValidationCode) {
  const input = record(value, where, code);
  exactKeys(input, ["candidateId", "manifestDigest"], [], where, code);
  const candidateId = normalizeSafeId(input.candidateId, `${where}.candidateId`, code);
  const manifestDigest = text(input.manifestDigest, `${where}.manifestDigest`, code, 80);
  if (!MANIFEST_DIGEST.test(manifestDigest)) fail(code, `${where}.manifestDigest must be a SHA-256 digest`);
  return { candidateId, manifestDigest };
}

export function normalizeRunDefinition(
  value: unknown,
  code: ValidationCode = "INVALID_INPUT",
): RunDefinition {
  const input = record(value, "run definition", code);
  exactKeys(
    input,
    [
      "schemaVersion",
      "bookId",
      "runId",
      "commandId",
      "sourceGitSha",
      "requiredStages",
      "requiredInventory",
      "attemptLimits",
      "createdAt",
    ],
    ["inputCandidate"],
    "run definition",
    code,
  );
  if (input.schemaVersion !== "1") fail(code, "run definition.schemaVersion must equal 1");
  const bookId = normalizeSafeId(input.bookId, "run definition.bookId", code);
  const runId = normalizeSafeId(input.runId, "run definition.runId", code);
  const commandId = normalizeSafeId(input.commandId, "run definition.commandId", code);
  const sourceGitSha = text(input.sourceGitSha, "run definition.sourceGitSha", code, 64);
  if (!GIT_SHA.test(sourceGitSha)) fail(code, "run definition.sourceGitSha must be a full lowercase Git SHA");

  if (!Array.isArray(input.requiredStages) || input.requiredStages.length === 0) {
    fail(code, "run definition.requiredStages must be a non-empty array");
  }
  const requiredStages = input.requiredStages.map((stage, index) =>
    normalizeSafeId(stage, `run definition.requiredStages[${index}]`, code));
  if (new Set(requiredStages).size !== requiredStages.length) fail(code, "run definition.requiredStages must be unique");

  if (!Array.isArray(input.requiredInventory)) fail(code, "run definition.requiredInventory must be an array");
  const requiredInventory = input.requiredInventory.map((entry, index) => {
    const item = record(entry, `run definition.requiredInventory[${index}]`, code);
    exactKeys(item, ["kind", "logicalPath", "mediaType"], [], `run definition.requiredInventory[${index}]`, code);
    const kind = item.kind;
    if (kind !== "CHAPTER" && kind !== "PROVENANCE" && kind !== "SIDECAR") {
      fail(code, `run definition.requiredInventory[${index}].kind is invalid`);
    }
    const mediaType = item.mediaType;
    if (mediaType !== "text/plain" && mediaType !== "text/markdown" && mediaType !== "application/json") {
      fail(code, `run definition.requiredInventory[${index}].mediaType is invalid`);
    }
    return {
      kind,
      logicalPath: logicalPath(item.logicalPath, `run definition.requiredInventory[${index}].logicalPath`, code),
      mediaType,
    } as const;
  });
  const inventoryPaths = requiredInventory.map((entry) => entry.logicalPath);
  if (new Set(inventoryPaths).size !== inventoryPaths.length) fail(code, "run definition.requiredInventory paths must be unique");

  const limits = record(input.attemptLimits, "run definition.attemptLimits", code);
  exactKeys(limits, ["run", "byStage"], [], "run definition.attemptLimits", code);
  const byStageInput = record(limits.byStage, "run definition.attemptLimits.byStage", code);
  const limitKeys = Object.keys(byStageInput);
  if (limitKeys.length !== requiredStages.length || requiredStages.some((stage) => !limitKeys.includes(stage))) {
    fail(code, "run definition.attemptLimits.byStage must contain exactly requiredStages");
  }
  const byStage: Record<string, number> = {};
  for (const stage of requiredStages) {
    byStage[stage] = nonNegativeInteger(byStageInput[stage], `run definition.attemptLimits.byStage.${stage}`, code);
  }

  return {
    schemaVersion: "1",
    bookId,
    runId,
    commandId,
    sourceGitSha,
    requiredStages,
    requiredInventory,
    ...(input.inputCandidate !== undefined ? { inputCandidate: candidate(input.inputCandidate, "run definition.inputCandidate", code) } : {}),
    attemptLimits: { run: nonNegativeInteger(limits.run, "run definition.attemptLimits.run", code), byStage },
    createdAt: normalizeUtc(input.createdAt, "run definition.createdAt", code),
  };
}

export function normalizeAttemptAdmission(
  value: unknown,
  code: ValidationCode = "INVALID_INPUT",
): AttemptAdmission {
  const input = record(value, "attempt admission", code);
  exactKeys(input, ["bookId", "runId", "attemptId", "stageId", "operationId", "admittedAt", "staleAt"], [], "attempt admission", code);
  const admittedAt = normalizeUtc(input.admittedAt, "attempt admission.admittedAt", code);
  const staleAt = normalizeUtc(input.staleAt, "attempt admission.staleAt", code);
  if (Date.parse(staleAt) <= Date.parse(admittedAt)) fail(code, "attempt admission.staleAt must follow admittedAt");
  return {
    bookId: normalizeSafeId(input.bookId, "attempt admission.bookId", code),
    runId: normalizeSafeId(input.runId, "attempt admission.runId", code),
    attemptId: normalizeSafeId(input.attemptId, "attempt admission.attemptId", code),
    stageId: normalizeSafeId(input.stageId, "attempt admission.stageId", code),
    operationId: normalizeSafeId(input.operationId, "attempt admission.operationId", code),
    admittedAt,
    staleAt,
  };
}

function normalizeFinishedEvent(value: unknown, code: ValidationCode): AttemptFinishedEventV1 {
  const input = record(value, "attempt finish event", code);
  exactKeys(input, ["schemaVersion", "type", "bookId", "runId", "attemptId", "outcome", "finishedAt"], ["detail"], "attempt finish event", code);
  if (input.schemaVersion !== "1" || input.type !== "ATTEMPT_FINISHED") fail(code, "attempt finish event discriminator is invalid");
  if (!OUTCOMES.includes(input.outcome as AttemptOutcome)) fail(code, "attempt finish event outcome is invalid");
  if (input.detail !== undefined && (typeof input.detail !== "string" || input.detail.length > 8192 || input.detail.includes("\0"))) {
    fail(code, "attempt finish event detail is invalid");
  }
  return {
    schemaVersion: "1",
    type: "ATTEMPT_FINISHED",
    bookId: normalizeSafeId(input.bookId, "attempt finish event.bookId", code),
    runId: normalizeSafeId(input.runId, "attempt finish event.runId", code),
    attemptId: normalizeSafeId(input.attemptId, "attempt finish event.attemptId", code),
    outcome: input.outcome as AttemptOutcome,
    finishedAt: normalizeUtc(input.finishedAt, "attempt finish event.finishedAt", code),
    ...(input.detail !== undefined ? { detail: input.detail } : {}),
  };
}

export function normalizeAttemptEvent(value: unknown, code: ValidationCode = "STATE_CORRUPT"): AttemptEventV1 {
  const input = record(value, "attempt event", code);
  if (input.type === "ATTEMPT_ADMITTED") {
    exactKeys(input, ["schemaVersion", "type", "admission"], [], "attempt admitted event", code);
    if (input.schemaVersion !== "1") fail(code, "attempt admitted event schemaVersion is invalid");
    return { schemaVersion: "1", type: "ATTEMPT_ADMITTED", admission: normalizeAttemptAdmission(input.admission, code) };
  }
  if (input.type === "ATTEMPT_FINISHED") return normalizeFinishedEvent(input, code);
  fail(code, "attempt event type is invalid");
}

export function normalizePersistedRun(value: unknown, expectedBookId: string, expectedRunId: string): PersistedRunV1 {
  const code: ValidationCode = "STATE_CORRUPT";
  const input = record(value, "persisted run", code);
  exactKeys(input, ["schemaVersion", "definition", "status"], ["cancellation", "terminal"], "persisted run", code);
  if (input.schemaVersion !== "1" || !RUN_STATUSES.includes(input.status as never)) fail(code, "persisted run discriminator is invalid");
  const definition = normalizeRunDefinition(input.definition, code);
  if (definition.bookId !== expectedBookId || definition.runId !== expectedRunId) fail(code, "persisted run identity does not match path");

  let cancellation: PersistedRunV1["cancellation"];
  if (input.cancellation !== undefined) {
    const item = record(input.cancellation, "persisted run.cancellation", code);
    exactKeys(item, ["reason", "requestedAt"], [], "persisted run.cancellation", code);
    cancellation = {
      reason: text(item.reason, "persisted run.cancellation.reason", code),
      requestedAt: normalizeUtc(item.requestedAt, "persisted run.cancellation.requestedAt", code),
    };
    if (Date.parse(cancellation.requestedAt) < Date.parse(definition.createdAt)) fail(code, "cancellation precedes run creation");
  }

  let terminal: PersistedRunV1["terminal"];
  if (input.terminal !== undefined) {
    const item = record(input.terminal, "persisted run.terminal", code);
    exactKeys(item, ["status", "finishedAt"], ["reason"], "persisted run.terminal", code);
    if (item.status !== "CANCELLED" && item.status !== "FAILED" && item.status !== "COMPLETED") fail(code, "persisted run.terminal.status is invalid");
    if (item.reason !== undefined) text(item.reason, "persisted run.terminal.reason", code);
    terminal = {
      status: item.status,
      finishedAt: normalizeUtc(item.finishedAt, "persisted run.terminal.finishedAt", code),
      ...(item.reason !== undefined ? { reason: item.reason as string } : {}),
    };
    if (Date.parse(terminal.finishedAt) < Date.parse(definition.createdAt)) fail(code, "terminal time precedes run creation");
  }

  const status = input.status as PersistedRunV1["status"];
  if (status === "RUNNING" && (cancellation !== undefined || terminal !== undefined)) fail(code, "running run contains terminal lifecycle data");
  if (status === "CANCEL_REQUESTED" && (cancellation === undefined || terminal !== undefined)) fail(code, "cancel-requested run lifecycle data is incomplete");
  if (status === "CANCELLED" || status === "FAILED" || status === "COMPLETED") {
    if (terminal === undefined || terminal.status !== status) fail(code, "terminal run lifecycle data is incomplete");
    if (status === "CANCELLED" && cancellation === undefined) fail(code, "cancelled run lacks cancellation request");
    if (status === "FAILED" && terminal.reason === undefined) fail(code, "failed run lacks terminal reason");
    if (status === "COMPLETED" && cancellation !== undefined) fail(code, "completed run contains cancellation data");
  }

  return {
    schemaVersion: "1",
    definition,
    status,
    ...(cancellation !== undefined ? { cancellation } : {}),
    ...(terminal !== undefined ? { terminal } : {}),
  };
}

export function foldAttemptEvents(definition: RunDefinition, events: readonly AttemptEventV1[]): AttemptHistory[] {
  const histories: AttemptHistory[] = [];
  const byId = new Map<string, AttemptHistory>();
  for (const event of events) {
    if (event.type === "ATTEMPT_ADMITTED") {
      const admission = event.admission;
      if (admission.bookId !== definition.bookId || admission.runId !== definition.runId) {
        throw new RunStateFault("STATE_CORRUPT", "attempt admission identity does not match run");
      }
      if (!definition.requiredStages.includes(admission.stageId)) throw new RunStateFault("STATE_CORRUPT", "attempt admission stage is not required by run");
      if (Date.parse(admission.admittedAt) < Date.parse(definition.createdAt)) throw new RunStateFault("STATE_CORRUPT", "attempt admission precedes run creation");
      if (byId.has(admission.attemptId)) throw new RunStateFault("STATE_CORRUPT", `duplicate attempt admission ${admission.attemptId}`);
      const history = { admission };
      histories.push(history);
      byId.set(admission.attemptId, history);
      continue;
    }
    if (event.bookId !== definition.bookId || event.runId !== definition.runId) {
      throw new RunStateFault("STATE_CORRUPT", "attempt finish identity does not match run");
    }
    const existing = byId.get(event.attemptId);
    if (existing === undefined) throw new RunStateFault("STATE_CORRUPT", `attempt finish has no admission ${event.attemptId}`);
    if (existing.finish !== undefined) throw new RunStateFault("STATE_CORRUPT", `duplicate attempt finish ${event.attemptId}`);
    if (Date.parse(event.finishedAt) < Date.parse(existing.admission.admittedAt)) {
      throw new RunStateFault("STATE_CORRUPT", `attempt finish precedes admission ${event.attemptId}`);
    }
    const completed: AttemptHistory = { admission: existing.admission, finish: event };
    const index = histories.indexOf(existing);
    histories[index] = completed;
    byId.set(event.attemptId, completed);
  }
  return histories;
}

export function assertLifecycleConsistent(recordValue: PersistedRunV1, histories: readonly AttemptHistory[]): void {
  if (recordValue.terminal !== undefined && histories.some((history) => history.finish === undefined)) {
    throw new RunStateFault("STATE_CORRUPT", "terminal run contains unsettled admitted attempt");
  }
  if (recordValue.terminal !== undefined) {
    const latestFinish = histories.reduce(
      (latest, history) => Math.max(latest, history.finish === undefined ? 0 : Date.parse(history.finish.finishedAt)),
      0,
    );
    if (Date.parse(recordValue.terminal.finishedAt) < latestFinish) {
      throw new RunStateFault("STATE_CORRUPT", "run terminal time precedes attempt completion");
    }
  }
}

export function attemptSnapshot(history: AttemptHistory, observedAt: string): AttemptSnapshot {
  if (history.finish !== undefined) {
    return { admission: history.admission, outcome: history.finish.outcome, status: history.finish.outcome };
  }
  return {
    admission: history.admission,
    status: Date.parse(observedAt) < Date.parse(history.admission.staleAt) ? "ACTIVE" : "STALE",
  };
}

export function projectRun(recordValue: PersistedRunV1, histories: readonly AttemptHistory[], observedAt: string): RunSnapshot {
  normalizeUtc(observedAt, "observedAt");
  return {
    definition: recordValue.definition,
    status: recordValue.status,
    attempts: histories.map((history) => attemptSnapshot(history, observedAt)),
    ...(recordValue.cancellation !== undefined ? { cancellationReason: recordValue.cancellation.reason } : {}),
    ...(recordValue.terminal?.reason !== undefined ? { terminalReason: recordValue.terminal.reason } : {}),
  };
}

export function sameValue(left: unknown, right: unknown): boolean {
  return canonicalJson(left) === canonicalJson(right);
}
