import { RunStateFault, type RunStoreErrorCode } from "./runStore.js";
import { normalizeSafeId, normalizeUtc } from "./runProjection.js";
import type { RunDefinition } from "./runTypes.js";
import type { ResumePlan, StageCheckpoint } from "./stageTypes.js";

type ValidationCode = Extract<RunStoreErrorCode, "INVALID_INPUT" | "STATE_CORRUPT">;
const DIGEST = /^(?:sha256:)?[0-9a-f]{64}$/;

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
    if (!Object.prototype.hasOwnProperty.call(value, key) || value[key] === undefined) fail(code, `${where}.${key} is required`);
  }
  for (const key of Object.keys(value)) {
    if (!allowed.has(key) || value[key] === undefined) fail(code, `${where}.${key} is not allowed`);
  }
}

export function normalizeStageCheckpoint(
  value: unknown,
  code: ValidationCode = "INVALID_INPUT",
): StageCheckpoint {
  const input = record(value, "stage checkpoint", code);
  exactKeys(
    input,
    ["schemaVersion", "bookId", "runId", "stageId", "status", "attemptIds", "completedAt"],
    ["candidate"],
    "stage checkpoint",
    code,
  );
  if (input.schemaVersion !== "1") fail(code, "stage checkpoint.schemaVersion must equal 1");
  if (input.status !== "COMPLETED" && input.status !== "FAILED" && input.status !== "CANCELLED") {
    fail(code, "stage checkpoint.status is invalid");
  }
  if (!Array.isArray(input.attemptIds)) fail(code, "stage checkpoint.attemptIds must be an array");
  const attemptIds = input.attemptIds.map((attemptId, index) => normalizeSafeId(attemptId, `stage checkpoint.attemptIds[${index}]`, code));
  if (new Set(attemptIds).size !== attemptIds.length) fail(code, "stage checkpoint.attemptIds must be unique");

  let candidate: StageCheckpoint["candidate"];
  if (input.candidate !== undefined) {
    const item = record(input.candidate, "stage checkpoint.candidate", code);
    exactKeys(item, ["candidateId", "manifestDigest"], [], "stage checkpoint.candidate", code);
    const manifestDigest = typeof item.manifestDigest === "string" ? item.manifestDigest : "";
    if (!DIGEST.test(manifestDigest)) fail(code, "stage checkpoint.candidate.manifestDigest must be a SHA-256 digest");
    candidate = {
      candidateId: normalizeSafeId(item.candidateId, "stage checkpoint.candidate.candidateId", code),
      manifestDigest,
    };
  }

  return {
    schemaVersion: "1",
    bookId: normalizeSafeId(input.bookId, "stage checkpoint.bookId", code),
    runId: normalizeSafeId(input.runId, "stage checkpoint.runId", code),
    stageId: normalizeSafeId(input.stageId, "stage checkpoint.stageId", code),
    status: input.status,
    attemptIds,
    ...(candidate !== undefined ? { candidate } : {}),
    completedAt: normalizeUtc(input.completedAt, "stage checkpoint.completedAt", code),
  };
}

export function projectResume(
  definition: RunDefinition,
  checkpoints: ReadonlyMap<string, StageCheckpoint>,
  cancelled: boolean,
): ResumePlan {
  if (!cancelled) {
    const stopped = definition.requiredStages.find((stageId) => {
      const status = checkpoints.get(stageId)?.status;
      return status === "FAILED" || status === "CANCELLED";
    });
    if (stopped !== undefined) throw new RunStateFault("TERMINAL", `stage ${stopped} has a terminal non-success checkpoint`);
  }
  const completedStages = definition.requiredStages.filter((stageId) => checkpoints.get(stageId)?.status === "COMPLETED");
  const pendingStages = definition.requiredStages.filter((stageId) => checkpoints.get(stageId)?.status !== "COMPLETED");
  return { runId: definition.runId, completedStages, pendingStages, cancelled };
}
