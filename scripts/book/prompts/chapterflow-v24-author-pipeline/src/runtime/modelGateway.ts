import type { Result, UtcIso } from "../contracts/v4Core.js";
import type { AttemptOutcome, RunSnapshot, RunStore } from "../run-state/index.js";
import { assertFlagsSupported, CODEX_ROUTE_REQUIRED_FLAGS, qualifyCodexCli } from "../exec/cliQualification.js";
import { CODEX_ROUTE_ID, createDefaultModelRoute, type ModelProcessRoute } from "./codexRoute.js";
import { FORBIDDEN_ENV } from "./executionPolicy.js";
import type { ExecutionPolicy, ExecutionProfile, ResolvedExecutionPolicy } from "./executionPolicyTypes.js";
import { modelError, type ModelErrorCode } from "./modelErrors.js";
import type { ModelTask } from "./modelRequest.js";
import type { ModelResult } from "./modelResult.js";
import type { ProcessOutcome, ProcessResult, ProcessSpec, ProcessSupervisor } from "./processTypes.js";
import type { PromptRequest } from "./promptRequest.js";
import { renderPrompt } from "./promptRenderer.js";

const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;
const INVALID_ATTEMPT_ID = "invalid-attempt";
const ATTEMPT_TAILS = new Map<string, Promise<void>>();
const SAFE_ENV_NAME = /^[A-Za-z_][A-Za-z0-9_]*$/;
const FORBIDDEN_ENV_SET: ReadonlySet<string> = new Set(FORBIDDEN_ENV);

/**
 * Merge a route's optional env (Task 7: claude's MAX_THINKING_TOKENS effort
 * tier) over the policy-built, already-stripped environment. Fail-closed by
 * construction: a route-supplied key is dropped unless it is a well-formed env
 * name AND not a forbidden provider key — so the executionPolicy env-strip
 * stays authoritative and a route can never reintroduce a stripped API key.
 * Returns the base unchanged when the route supplies no env.
 */
function mergeRouteEnv(
  base: Readonly<Record<string, string>>,
  route: ModelProcessRoute,
  profile: ExecutionProfile,
): Readonly<Record<string, string>> {
  if (typeof route.env !== "function") return base;
  let supplied: Readonly<Record<string, string>>;
  try {
    supplied = route.env(profile);
  } catch {
    return base;
  }
  if (supplied === null || typeof supplied !== "object" || Array.isArray(supplied)) return base;
  const merged: Record<string, string> = { ...base };
  for (const [name, value] of Object.entries(supplied)) {
    if (typeof value !== "string" || value.includes("\0")) continue;
    if (!SAFE_ENV_NAME.test(name) || FORBIDDEN_ENV_SET.has(name)) continue;
    merged[name] = value;
  }
  return Object.freeze(merged);
}

/**
 * Normalize a route's raw stdout to the inner-JSON contract validateOutput
 * expects (Task 7: unwrap claude's `--output-format json` envelope). Identity
 * when the route supplies no normalizer (codex) or when the normalizer throws.
 */
function normalizeRouteStdout(route: ModelProcessRoute, stdout: Uint8Array): Uint8Array {
  if (typeof route.normalizeStdout !== "function") return stdout;
  try {
    const normalized = route.normalizeStdout(stdout);
    return normalized instanceof Uint8Array ? normalized : stdout;
  } catch {
    return stdout;
  }
}

export interface ModelGateway {
  execute(task: ModelTask): Promise<ModelResult>;
}

export interface ModelGatewayDependencies {
  readonly runStore: RunStore;
  readonly processSupervisor: ProcessSupervisor;
  readonly executionPolicy: ExecutionPolicy;
  readonly route?: ModelProcessRoute;
  readonly now?: () => UtcIso;
  /** Test-only override for the model-CLI preflight (`ensureModelCliPreflight`
   *  below). When supplied it replaces the default entirely — including its
   *  hermetic/route-id gating — so injected fakes never touch a real binary. */
  readonly modelCliPreflight?: () => Promise<void>;
}

function hermeticGuardActive(): boolean {
  return process.env.CHAPTERFLOW_NO_API_CODEX_QC === "1";
}

/** Cached once per process: the first non-hermetic execute() on the live
 *  codex route pays the qualification cost; every attempt after reuses the
 *  same settled promise (success or failure — a failed preflight stays
 *  fail-closed for the rest of the process; nothing should overwrite the
 *  installed CLI mid-run). */
let codexPreflightPromise: Promise<void> | null = null;

async function qualifyCodexRoutePreflight(): Promise<void> {
  const qual = await qualifyCodexCli({ bin: "codex" });
  assertFlagsSupported(qual, CODEX_ROUTE_REQUIRED_FLAGS);
}

/**
 * Model-CLI preflight (IMP-00 fail-closed rule, wired into the gateway so no
 * production attempt can spawn a process before the installed CLI is proven
 * to support the flags the route's build() emits).
 *  - Hermetic no-API operating mode (CHAPTERFLOW_NO_API_CODEX_QC=1): SKIP —
 *    tests/CI never spawn a real model CLI.
 *  - Any route other than the live codex route: SKIP — nothing else spawns a
 *    real binary today (Task 6/7 generalizes this to whichever route the
 *    per-role config selects).
 *  - Otherwise: qualify once per process; a missing required flag throws
 *    `ExecPreflightError` (`policy_preflight_failure`), which the caller must
 *    surface as a hard failure — never run anyway with unproven flags.
 */
async function ensureModelCliPreflight(route: ModelProcessRoute): Promise<void> {
  if (hermeticGuardActive()) return;
  if (route.id !== CODEX_ROUTE_ID) return;
  if (!codexPreflightPromise) codexPreflightPromise = qualifyCodexRoutePreflight();
  return codexPreflightPromise;
}

/** Test hook: forget the process-cached preflight result so the next
 *  non-hermetic execute() re-probes from scratch. */
export function __resetModelCliPreflightForTests(): void {
  codexPreflightPromise = null;
}

type PreparedTask = {
  readonly policy: ResolvedExecutionPolicy;
  readonly prompt: Uint8Array;
  readonly command: string;
  readonly args: readonly string[];
};

interface ModelTaskSnapshot extends ModelTask {
  readonly renderedPrompt: Uint8Array;
}

type ModelTaskSnapshotResult =
  | { readonly ok: true; readonly value: ModelTaskSnapshot }
  | { readonly ok: false; readonly attemptId: string; readonly message: string };

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

function snapshotTask(task: ModelTask): ModelTaskSnapshotResult {
  let attemptIdForResult = INVALID_ATTEMPT_ID;
  try {
    if (task === null || typeof task !== "object" || Array.isArray(task)) {
      return { ok: false, attemptId: attemptIdForResult, message: "model task must be an object" };
    }
    const source = task as unknown as Record<string, unknown>;
    const attemptId = source.attemptId;
    if (validId(attemptId)) attemptIdForResult = attemptId;
    const shallow: ModelTask = {
      bookId: source.bookId as string,
      runId: source.runId as string,
      attemptId: attemptId as string,
      stageId: source.stageId as string,
      operationId: source.operationId as string,
      profileId: source.profileId as string,
      workDir: source.workDir as string,
      prompt: source.prompt as PromptRequest,
      signal: source.signal as AbortSignal,
    };
    const shapeError = validateTaskShape(shallow);
    if (shapeError !== null) return { ok: false, attemptId: attemptIdForResult, message: shapeError };

    const promptSource = shallow.prompt;
    if (promptSource === null || typeof promptSource !== "object" || Array.isArray(promptSource)) {
      return { ok: false, attemptId: attemptIdForResult, message: "prompt request rejected" };
    }
    const templateId = (promptSource as unknown as Record<string, unknown>).templateId;
    const sourceInputs = (promptSource as unknown as Record<string, unknown>).inputs;
    if (typeof templateId !== "string" || !Array.isArray(sourceInputs)) {
      return { ok: false, attemptId: attemptIdForResult, message: "prompt request rejected" };
    }
    const inputs: Array<PromptRequest["inputs"][number]> = [];
    for (const sourceInput of sourceInputs) {
      if (sourceInput === null || typeof sourceInput !== "object" || Array.isArray(sourceInput)) {
        return { ok: false, attemptId: attemptIdForResult, message: "prompt request rejected" };
      }
      const input = sourceInput as Record<string, unknown>;
      if (typeof input.name !== "string" || typeof input.mediaType !== "string" || !(input.bytes instanceof Uint8Array)) {
        return { ok: false, attemptId: attemptIdForResult, message: "prompt request rejected" };
      }
      inputs.push(Object.freeze({
        name: input.name,
        mediaType: input.mediaType as PromptRequest["inputs"][number]["mediaType"],
        bytes: new Uint8Array(input.bytes),
      }));
    }
    const prompt = Object.freeze({
      templateId,
      inputs: Object.freeze(inputs),
    });
    const rendered = renderPrompt(prompt);
    if (!rendered.ok) return { ok: false, attemptId: attemptIdForResult, message: "prompt request rejected" };
    return {
      ok: true,
      value: Object.freeze({
        ...shallow,
        prompt,
        renderedPrompt: new Uint8Array(rendered.value),
      }),
    };
  } catch {
    return { ok: false, attemptId: attemptIdForResult, message: "model task could not be snapshotted" };
  }
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
  task: ModelTaskSnapshot,
  executionPolicy: ExecutionPolicy,
  route: ModelProcessRoute,
): Result<PreparedTask> {
  const policy = executionPolicy.resolve(task.profileId, task.workDir);
  if (!policy.ok) return { ok: false, error: modelError("MODEL_PROFILE_INVALID", "execution profile or work directory rejected") };
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
    return {
      ok: true,
      value: { policy: policy.value, prompt: task.renderedPrompt, command: process.command, args: process.args },
    };
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
  // Callers without an explicit `route` (e.g. src/cli.ts's ad-hoc wiring)
  // fall back to the config-driven default from config/model-routing.json —
  // no model literal may live here (model-policy static scan).
  const route = dependencies.route ?? createDefaultModelRoute();
  const now = dependencies.now ?? (() => new Date().toISOString());

  const executeOnce = async (task: ModelTaskSnapshot): Promise<ModelResult> => {
    if (task.signal.aborted) return result(task.attemptId, "CANCELLED", "MODEL_TASK_INVALID", "task cancelled before admission");

    const prepared = prepareTask(task, dependencies.executionPolicy, route);
    if (!prepared.ok) return { attemptId: task.attemptId, outcome: "FAILED", error: prepared.error };

    // Model-CLI preflight — before any run-state/admission side effect, so a
    // fail-closed qualification failure never consumes attempt capacity.
    try {
      await (dependencies.modelCliPreflight ?? (() => ensureModelCliPreflight(route)))();
    } catch (err) {
      const message = err instanceof Error ? err.message : "model CLI preflight failed";
      return result(task.attemptId, "FAILED", "MODEL_CLI_UNQUALIFIED", message);
    }

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
      environment: mergeRouteEnv(prepared.value.policy.environment, route, prepared.value.policy.profile),
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
        const normalizedStdout = normalizeRouteStdout(route, process.stdout);
        const validated = dependencies.executionPolicy.validateOutput(prepared.value.policy.profile.outputSchemaId, normalizedStdout);
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
      const snapshot = snapshotTask(task);
      if (!snapshot.ok) {
        return Promise.resolve(result(snapshot.attemptId, "FAILED", "MODEL_TASK_INVALID", snapshot.message));
      }
      if (snapshot.value.signal.aborted) {
        return Promise.resolve(result(
          snapshot.value.attemptId,
          "CANCELLED",
          "MODEL_TASK_INVALID",
          "task cancelled before admission",
        ));
      }
      const key = `${snapshot.value.bookId}\0${snapshot.value.runId}\0${snapshot.value.attemptId}`;
      return serializeAttempt(key, () => executeOnce(snapshot.value));
    },
  };
}
