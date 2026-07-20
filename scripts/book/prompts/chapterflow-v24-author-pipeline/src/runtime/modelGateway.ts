import type { Result, UtcIso } from "../contracts/v4Core.js";
import type { AttemptOutcome, RunSnapshot, RunStore } from "../run-state/index.js";
import { createCodexRoute, type ModelProcessRoute } from "./codexRoute.js";
import type { ExecutionPolicy, ResolvedExecutionPolicy } from "./executionPolicyTypes.js";
import { modelError, type ModelErrorCode } from "./modelErrors.js";
import type { ModelTask } from "./modelRequest.js";
import type { ModelResult } from "./modelResult.js";
import type { ProcessOutcome, ProcessResult, ProcessSpec, ProcessSupervisor } from "./processTypes.js";
import { renderPrompt } from "./promptRenderer.js";

const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;
const ATTEMPT_TAILS = new Map<string, Promise<void>>();

export interface ModelGateway {
  execute(task: ModelTask): Promise<ModelResult>;
}

export interface ModelGatewayDependencies {
  readonly runStore: RunStore;
  readonly processSupervisor: ProcessSupervisor;
  readonly executionPolicy: ExecutionPolicy;
  readonly route?: ModelProcessRoute;
  readonly now?: () => UtcIso;
}

type PreparedTask = {
  readonly policy: ResolvedExecutionPolicy;
  readonly prompt: Uint8Array;
  readonly command: string;
  readonly args: readonly string[];
};

function result(attemptId: string, outcome: ModelResult["outcome"], code?: ModelErrorCode, message?: string): ModelResult {
  return {
    attemptId,
    outcome,
    ...(code !== undefined && message !== undefined ? { error: modelError(code, message) } : {}),
  };
}

function validId(value: unknown): value is string {
  return typeof value === "string" && SAFE_ID.test(value);
}

function validateTaskShape(task: ModelTask): string | null {
  if (task === null || typeof task !== "object" || Array.isArray(task)) return "model task must be an object";
  for (const [name, value] of [
    ["bookId", task.bookId],
    ["runId", task.runId],
    ["attemptId", task.attemptId],
    ["stageId", task.stageId],
    ["operationId", task.operationId],
    ["profileId", task.profileId],
  ] as const) {
    if (!validId(value)) return `${name} is not a safe identifier`;
  }
  if (typeof task.workDir !== "string" || task.workDir.length === 0 || task.workDir.includes("\0")) return "workDir is invalid";
  if (!(task.signal instanceof AbortSignal)) return "signal must be AbortSignal";
  return null;
}

function canonicalUtc(value: string): boolean {
  const millis = Date.parse(value);
  return Number.isFinite(millis) && new Date(millis).toISOString() === value;
}

function readClock(now: () => UtcIso): UtcIso | null {
  try {
    const value = now();
    return canonicalUtc(value) ? value : null;
  } catch {
    return null;
  }
}

async function serializeAttempt<T>(key: string, operation: () => Promise<T>): Promise<T> {
  const prior = ATTEMPT_TAILS.get(key) ?? Promise.resolve();
  let release!: () => void;
  const gate = new Promise<void>((done) => { release = done; });
  const tail = prior.then(() => gate);
  ATTEMPT_TAILS.set(key, tail);
  await prior;
  try {
    return await operation();
  } finally {
    release();
    if (ATTEMPT_TAILS.get(key) === tail) ATTEMPT_TAILS.delete(key);
  }
}

function prepareTask(
  task: ModelTask,
  executionPolicy: ExecutionPolicy,
  route: ModelProcessRoute,
): Result<PreparedTask> {
  const policy = executionPolicy.resolve(task.profileId, task.workDir);
  if (!policy.ok) return { ok: false, error: modelError("MODEL_PROFILE_INVALID", "execution profile or work directory rejected") };
  const prompt = renderPrompt(task.prompt);
  if (!prompt.ok) return { ok: false, error: modelError("MODEL_TASK_INVALID", "prompt request rejected") };
  try {
    const process = route.build(policy.value.profile);
    if (
      typeof process.command !== "string"
      || process.command.length === 0
      || process.command.includes("\0")
      || !Array.isArray(process.args)
      || process.args.some((arg) => typeof arg !== "string" || arg.includes("\0"))
    ) {
      return { ok: false, error: modelError("MODEL_PROFILE_INVALID", "fixed process route is invalid") };
    }
    return { ok: true, value: { policy: policy.value, prompt: prompt.value, command: process.command, args: process.args } };
  } catch {
    return { ok: false, error: modelError("MODEL_PROFILE_INVALID", "fixed process route could not resolve") };
  }
}

function capacityAvailable(snapshot: RunSnapshot, stageId: string): boolean {
  if (snapshot.attempts.length >= snapshot.definition.attemptLimits.run) return false;
  const consumed = snapshot.attempts.filter((attempt) => attempt.admission.stageId === stageId).length;
  return consumed < snapshot.definition.attemptLimits.byStage[stageId];
}

function mappedOutcome(process: ProcessResult): ModelResult["outcome"] {
  if (process.outcome === "TIMED_OUT") return "TIMED_OUT";
  if (process.outcome === "CANCELLED") return "CANCELLED";
  if (process.outcome === "CLEANUP_FAILED") return "UNKNOWN";
  return "FAILED";
}

function attemptOutcome(outcome: ModelResult["outcome"]): AttemptOutcome {
  return outcome;
}

function processResultIsBounded(process: ProcessResult, policy: ResolvedExecutionPolicy): boolean {
  return process.stdout instanceof Uint8Array
    && process.stderr instanceof Uint8Array
    && process.stdout.byteLength <= policy.profile.maxStdoutBytes
    && process.stderr.byteLength <= policy.profile.maxStderrBytes
    && ["EXITED", "SPAWN_FAILED", "TIMED_OUT", "CANCELLED", "OUTPUT_LIMIT", "CLEANUP_FAILED"].includes(process.outcome);
}

function terminalDetail(process: ProcessResult | null, outcome: ModelResult["outcome"]): string {
  if (process === null) return `gateway=${outcome}; supervisor=rejected`;
  return [
    `gateway=${outcome}`,
    `process=${process.outcome}`,
    `exit=${process.exitCode ?? "none"}`,
    `stdoutBytes=${process.stdout.byteLength}`,
    `stderrBytes=${process.stderr.byteLength}`,
    `stdoutTruncated=${process.stdoutTruncated}`,
    `stderrTruncated=${process.stderrTruncated}`,
  ].join(";");
}

export function createModelGateway(dependencies: ModelGatewayDependencies): ModelGateway {
  const route = dependencies.route ?? createCodexRoute();
  const now = dependencies.now ?? (() => new Date().toISOString());

  const executeOnce = async (task: ModelTask): Promise<ModelResult> => {
    const shapeError = validateTaskShape(task);
    if (shapeError !== null) return result(task?.attemptId ?? "invalid-attempt", "FAILED", "MODEL_TASK_INVALID", shapeError);
    if (task.signal.aborted) return result(task.attemptId, "CANCELLED", "MODEL_TASK_INVALID", "task cancelled before admission");

    const prepared = prepareTask(task, dependencies.executionPolicy, route);
    if (!prepared.ok) return { attemptId: task.attemptId, outcome: "FAILED", error: prepared.error };

    const admittedAt = readClock(now);
    if (admittedAt === null) return result(task.attemptId, "FAILED", "MODEL_TASK_INVALID", "gateway clock returned invalid UTC time");
    let run;
    try {
      run = await dependencies.runStore.readRun(task.bookId, task.runId, admittedAt);
    } catch {
      return result(task.attemptId, "FAILED", "MODEL_RUN_UNAVAILABLE", "run state is unavailable or corrupt");
    }
    if (!run.ok) return result(task.attemptId, "FAILED", "MODEL_RUN_UNAVAILABLE", "run state is unavailable or corrupt");
    if (run.value.status === "CANCEL_REQUESTED" || run.value.status === "CANCELLED") {
      return result(task.attemptId, "CANCELLED", "MODEL_RUN_CANCELLED", "run does not admit new model work");
    }
    if (run.value.status !== "RUNNING") return result(task.attemptId, "FAILED", "MODEL_RUN_UNAVAILABLE", "run is terminal");
    if (!run.value.definition.requiredStages.includes(task.stageId)) {
      return result(task.attemptId, "FAILED", "MODEL_TASK_INVALID", "task stage is not required by run");
    }
    if (run.value.attempts.some((attempt) => attempt.admission.attemptId === task.attemptId)) {
      return result(task.attemptId, "UNKNOWN", "MODEL_ATTEMPT_EXISTS", "attempt is already admitted and cannot spawn again");
    }
    if (!capacityAvailable(run.value, task.stageId)) {
      return result(task.attemptId, "FAILED", "MODEL_CAPACITY_EXHAUSTED", "run or stage attempt capacity is exhausted");
    }
    if (task.signal.aborted) return result(task.attemptId, "CANCELLED", "MODEL_TASK_INVALID", "task cancelled before admission");

    const staleAt = new Date(
      Date.parse(admittedAt) + prepared.value.policy.profile.timeoutMs + prepared.value.policy.profile.terminateGraceMs + 1_000,
    ).toISOString();
    let admission;
    try {
      admission = await dependencies.runStore.admitAttempt({
        bookId: task.bookId,
        runId: task.runId,
        attemptId: task.attemptId,
        stageId: task.stageId,
        operationId: task.operationId,
        admittedAt,
        staleAt,
      });
    } catch {
      return result(task.attemptId, "UNKNOWN", "MODEL_EXECUTION_UNCERTAIN", "attempt admission result is uncertain; no process was started");
    }
    if (!admission.ok) {
      const cancelled = admission.error.code === "CANCELLED";
      return result(
        task.attemptId,
        cancelled ? "CANCELLED" : "FAILED",
        cancelled ? "MODEL_RUN_CANCELLED" : "MODEL_ADMISSION_DENIED",
        "attempt admission was denied",
      );
    }

    const spec: ProcessSpec = {
      command: prepared.value.command,
      args: [...prepared.value.args],
      cwd: prepared.value.policy.workDir,
      stdin: prepared.value.prompt,
      environment: prepared.value.policy.environment,
      timeoutMs: prepared.value.policy.profile.timeoutMs,
      terminateGraceMs: prepared.value.policy.profile.terminateGraceMs,
      maxStdoutBytes: prepared.value.policy.profile.maxStdoutBytes,
      maxStderrBytes: prepared.value.policy.profile.maxStderrBytes,
      signal: task.signal,
    };

    let process: ProcessResult | null = null;
    let outcome: ModelResult["outcome"] = "UNKNOWN";
    let output: unknown;
    let errorCode: ModelErrorCode = "MODEL_EXECUTION_UNCERTAIN";
    let errorMessage = "model execution became uncertain after admission";
    try {
      process = await dependencies.processSupervisor.run(spec);
      if (!processResultIsBounded(process, prepared.value.policy)) {
        outcome = "UNKNOWN";
      } else if (process.outcome === "EXITED" && process.exitCode === 0) {
        const validated = dependencies.executionPolicy.validateOutput(prepared.value.policy.profile.outputSchemaId, process.stdout);
        if (validated.ok) {
          outcome = "SUCCEEDED";
          output = validated.value;
          errorCode = "MODEL_PROCESS_FAILED";
          errorMessage = "";
        } else {
          outcome = "FAILED";
          errorCode = "MODEL_OUTPUT_INVALID";
          errorMessage = "model output failed source-controlled schema validation";
        }
      } else {
        outcome = mappedOutcome(process);
        errorCode = outcome === "UNKNOWN" ? "MODEL_EXECUTION_UNCERTAIN" : "MODEL_PROCESS_FAILED";
        errorMessage = outcome === "UNKNOWN" ? "process-tree cleanup failed after admission" : "bounded model process did not succeed";
      }
    } catch {
      outcome = "UNKNOWN";
      errorCode = "MODEL_EXECUTION_UNCERTAIN";
      errorMessage = "process supervisor rejected after admission";
    }

    const observedFinishedAt = readClock(now);
    const finishedAt = observedFinishedAt ?? admittedAt;
    if (observedFinishedAt === null) {
      outcome = "UNKNOWN";
      output = undefined;
      errorCode = "MODEL_TERMINAL_RECORD_FAILED";
      errorMessage = "gateway clock failed after admission";
    }
    let terminal;
    try {
      terminal = await dependencies.runStore.finishAttempt({
        bookId: task.bookId,
        runId: task.runId,
        attemptId: task.attemptId,
        outcome: attemptOutcome(outcome),
        finishedAt,
        detail: terminalDetail(process, outcome),
      });
    } catch {
      return result(task.attemptId, "UNKNOWN", "MODEL_TERMINAL_RECORD_FAILED", "attempt terminal state could not be recorded");
    }
    if (!terminal.ok) return result(task.attemptId, "UNKNOWN", "MODEL_TERMINAL_RECORD_FAILED", "attempt terminal state could not be recorded");
    if (outcome === "SUCCEEDED") return { attemptId: task.attemptId, outcome, output };
    return result(task.attemptId, outcome, errorCode, errorMessage);
  };

  return {
    execute(task: ModelTask): Promise<ModelResult> {
      const key = `${task?.bookId ?? "invalid"}\0${task?.runId ?? "invalid"}\0${task?.attemptId ?? "invalid"}`;
      return serializeAttempt(key, () => executeOnce(task));
    },
  };
}
