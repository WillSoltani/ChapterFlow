import type { Result, UtcIso } from "../contracts/v4Core.js";
import type { AttemptOutcome, RunSnapshot, RunStore } from "../run-state/index.js";
import { assertFlagsSupported, CLAUDE_ROUTE_REQUIRED_FLAGS, CODEX_ROUTE_REQUIRED_FLAGS, qualifyClaudeCli, qualifyCodexCli } from "../exec/cliQualification.js";
import { CLAUDE_ROUTE_ID } from "./claudeRoute.js";
import {
  CODEX_ROUTE_ID,
  createDefaultModelRouteSelector,
  isPipelineRole,
  type ModelProcessRoute,
  type ModelRouteSelector,
  type RouteSelection,
} from "./codexRoute.js";
import { FORBIDDEN_ENV } from "./executionPolicy.js";
import type { ExecutionPolicy, ExecutionProfile, ResolvedExecutionPolicy } from "./executionPolicyTypes.js";
import { modelError, providerBlockKind, type ModelErrorCode } from "./modelErrors.js";
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
  /** A single route for every task (tests, ad-hoc wiring). Mutually exclusive
   *  with `routeSelector`, which is what production uses. */
  readonly route?: ModelProcessRoute;
  /** R-021: per-role route selection. When present the gateway resolves the
   *  route from each task's `role`, so a review seat runs at the review tier
   *  and research at the research tier. */
  readonly routeSelector?: ModelRouteSelector;
  readonly now?: () => UtcIso;
  /** Test-only override for the model-CLI preflight (`ensureModelCliPreflight`
   *  below). When supplied it replaces the default entirely — including its
   *  hermetic/route-id gating — so injected fakes never touch a real binary. */
  readonly modelCliPreflight?: () => Promise<void>;
}

function hermeticGuardActive(): boolean {
  return process.env.CHAPTERFLOW_NO_API_CODEX_QC === "1";
}

/** Cached once per process, PER ROUTE: the first non-hermetic execute() on a
 *  qualifiable route pays the qualification cost; every attempt after reuses the
 *  same settled promise (success or failure — a failed preflight stays
 *  fail-closed for the rest of the process; nothing should overwrite the
 *  installed CLI mid-run). */
const preflightPromises = new Map<string, Promise<void>>();

async function qualifyCodexRoutePreflight(): Promise<void> {
  const qual = await qualifyCodexCli({ bin: "codex" });
  assertFlagsSupported(qual, CODEX_ROUTE_REQUIRED_FLAGS);
}

async function qualifyClaudeRoutePreflight(): Promise<void> {
  const qual = await qualifyClaudeCli({ bin: "claude" });
  assertFlagsSupported(qual, CLAUDE_ROUTE_REQUIRED_FLAGS);
}

/** Route id → its CLI qualification. Task 7 generalized the preflight from
 *  codex-only to whichever route the per-role config selects; a route absent
 *  from this table spawns no real binary and needs no qualification. */
const ROUTE_PREFLIGHTS: ReadonlyMap<string, () => Promise<void>> = new Map([
  [CODEX_ROUTE_ID, qualifyCodexRoutePreflight],
  [CLAUDE_ROUTE_ID, qualifyClaudeRoutePreflight],
]);

/**
 * Model-CLI preflight (IMP-00 fail-closed rule, wired into the gateway so no
 * production attempt can spawn a process before the installed CLI is proven
 * to support the flags the route's build() emits).
 *  - Hermetic no-API operating mode (CHAPTERFLOW_NO_API_CODEX_QC=1): SKIP —
 *    tests/CI never spawn a real model CLI.
 *  - A route with no registered qualification (no real binary today): SKIP.
 *  - Otherwise: qualify once per process per route; a missing required flag
 *    throws `ExecPreflightError` (`policy_preflight_failure`), which the caller
 *    must surface as a hard failure — never run anyway with unproven flags.
 */
async function ensureModelCliPreflight(route: ModelProcessRoute): Promise<void> {
  if (hermeticGuardActive()) return;
  const qualify = ROUTE_PREFLIGHTS.get(route.id);
  if (qualify === undefined) return;
  let pending = preflightPromises.get(route.id);
  if (pending === undefined) {
    pending = qualify();
    preflightPromises.set(route.id, pending);
  }
  return pending;
}

/** Test hook: forget the process-cached preflight results so the next
 *  non-hermetic execute() re-probes from scratch. */
export function __resetModelCliPreflightForTests(): void {
  preflightPromises.clear();
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

/**
 * R-201: mint the ModelResult, recording the provider-block verdict on the
 * error's `retryable` field when — and only when — the message classifies as
 * one.
 *
 * The message stays the source of truth (it is the only place the provider's
 * own words live, and R-001 is what got them here); this is the same answer
 * written on the typed field, so a consumer that has the result does not have
 * to re-derive it. That typed field is in-memory only: `result()` runs after
 * `executeOnce` has already called `runStore.finishAttempt` (which takes no
 * error/retryable field), so the durable attempt record never carries the
 * verdict — only the message text does, journaled separately by
 * `terminalDetail`. Any other failure leaves `retryable` ABSENT rather than
 * claiming a verdict the gateway does not have — a rate-limit blip and a
 * weekly cap both arrive as FAILED/MODEL_PROCESS_FAILED, and only the
 * provider's wording separates them.
 */
function result(attemptId: string, outcome: ModelResult["outcome"], code?: ModelErrorCode, message?: string): ModelResult {
  if (code === undefined || message === undefined) return { attemptId, outcome };
  const blocked = providerBlockKind(message) !== null;
  return { attemptId, outcome, error: modelError(code, message, blocked ? false : undefined) };
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
  // Fail closed on a role the routing config cannot express: silently running
  // it at the default tier is exactly the R-021 failure this change removes.
  if (task.role !== undefined && !isPipelineRole(task.role)) return "role is not a known pipeline role";
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
      // R-223: this whitelist is the ONLY path a ModelTask field takes into the
      // gateway; anything missing here is dropped with no error. Adding a field
      // to ModelTask means adding it here too (guarded by the
      // v4-role-routing-provenance whitelist test).
      ...(source.role === undefined ? {} : { role: source.role as ModelTask["role"] }),
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

/** Max characters of a failed process's stdout/stderr copied into the durable
 *  attempt detail. Long enough for a provider error envelope (rate-limit /
 *  overload / auth message) to be diagnosable, short enough to stay well inside
 *  the run-state 8 KiB detail cap even with both streams present. */
const DIAGNOSTIC_HEAD_CHARS = 400;

/** Sanitize a stream head for the single-line, control-char-free attempt detail:
 *  decode a bounded byte prefix (up to 4 bytes/UTF-8 char), collapse every ASCII
 *  control char (newlines, tabs, NUL) to a single space, and cap the length.
 *  Never throws; returns "" for an empty or all-control stream. */
function sanitizedStreamHead(bytes: Uint8Array): string {
  const prefix = bytes.subarray(0, DIAGNOSTIC_HEAD_CHARS * 4);
  return new TextDecoder().decode(prefix)
    .replace(/[\u0000-\u001f]+/g, " ")
    .slice(0, DIAGNOSTIC_HEAD_CHARS)
    .trim();
}

/** The generic sentence for a bounded process that did not succeed. Kept as the
 *  PREFIX of every non-zero-exit message so nothing that matched it before
 *  stops matching. */
const PROCESS_FAILURE_MESSAGE = "bounded model process did not succeed";

/** A route's own envelope classification of stdout, guarded: null when the route
 *  supplies no classifier (codex) or the classifier throws. */
function classifyRouteStdout(
  route: ModelProcessRoute,
  stdout: Uint8Array,
): { errorCode: "MODEL_PROCESS_FAILED"; message: string } | null {
  if (typeof route.classifyStdout !== "function") return null;
  try {
    return route.classifyStdout(stdout) ?? null;
  } catch {
    return null;
  }
}

/**
 * R-001: the error message for a bounded process that exited NON-ZERO.
 *
 * Task 11x classified the provider's error envelope only on the exit-0 path, so
 * a provider that printed its envelope AND exited non-zero — the live 2026-08-28
 * shape, `{"is_error":true,"api_error_status":429,"result":"You've hit your
 * weekly limit \u00b7 resets Sep 1 at 8pm"}` with exit 1 — reached the callers as
 * the opaque `PROCESS_FAILURE_MESSAGE` alone. Every downstream classifier
 * (`isUnretryableProviderMessage` in the compiler section loop, the two research
 * lanes and the reader lane) reads the MESSAGE, so discarding it turned a
 * durable quota block into three retries per section and nineteen operator
 * rounds.
 *
 * Preference order mirrors what the durable attempt detail already journals for
 * this exact class: the route's envelope classification, else a sanitized capped
 * head of stdout, else of stderr (CLIs that print their fatal error there and
 * nothing to stdout). That parity holds for FAILED/MODEL_PROCESS_FAILED — but
 * this function's caller reaches here for EVERY non-exit-0 process outcome,
 * TIMED_OUT and CANCELLED included (see `mappedOutcome`), while `terminalDetail`
 * only adds stream heads when `outcome === "FAILED" && errorCode ===
 * "MODEL_PROCESS_FAILED"`. So for TIMED_OUT/CANCELLED the in-memory
 * `error.message` now carries a sanitized head of up to `DIAGNOSTIC_HEAD_CHARS`
 * (400) chars that the durable journal omits. The exit-0 path is untouched.
 *
 * Also note: this message is exactly what `isQuotaExhaustedMessage` /
 * `isCredentialFailureMessage` (modelErrors.ts) classify. On any non-zero exit
 * that means up to `DIAGNOSTIC_HEAD_CHARS` chars of ARBITRARY sanitized
 * stdout/stderr — not only a recognized provider envelope — can feed those
 * regexes. A false positive there routes the attempt onto the durable,
 * non-operator-retryable quota/credential path instead of an ordinary retry:
 * fail-closed (a retryable failure wrongly treated as durable), never fail-open
 * (a real block silently retried), and accepted deliberately.
 */
function providerFailureMessage(route: ModelProcessRoute, process: ProcessResult): string {
  const classified = classifyRouteStdout(route, process.stdout);
  if (classified !== null) return classified.message;
  const head = sanitizedStreamHead(process.stdout) || sanitizedStreamHead(process.stderr);
  return head === "" ? PROCESS_FAILURE_MESSAGE : `${PROCESS_FAILURE_MESSAGE}: ${head}`;
}

/** Characters a provenance value may contribute to the single-line attempt
 *  detail. Model ids, route ids, tiers and role names are all drawn from this
 *  alphabet; anything else is replaced so the detail can never gain a
 *  separator, a newline or a NUL. */
function provenanceValue(value: string): string {
  return value.replace(/[^A-Za-z0-9._:-]/g, "_").slice(0, 64);
}

/**
 * R-207: WHICH instrument produced this attempt. Before this, run.json and
 * attempts.jsonl carried no model, route or effort at all, so a completed book
 * could not be attributed or reproduced and no before/after comparison could
 * claim both sides used the same instrument.
 *
 * Journaled additively as `;route=…;model=…;effort=…;role=…;routing=…` on the
 * existing attempt-finish `detail` string (a durable, schema-stable field
 * already carried by every finished attempt) so no run-state schema, fixture
 * or projection changes. `model`/`effort` are absent for a directly-injected
 * route that came from no config; `role` is absent when the task declared
 * none; `routing` is the first 12 hex of the sha256 of the exact
 * model-routing.json bytes the selector loaded.
 */
function routeProvenance(selection: RouteSelection): string {
  const fields = [`route=${provenanceValue(selection.route.id)}`];
  if (selection.roleRoute !== undefined) {
    fields.push(`model=${provenanceValue(selection.roleRoute.model)}`);
    fields.push(`effort=${provenanceValue(selection.roleRoute.effort)}`);
  }
  fields.push(`role=${selection.role === undefined ? "none" : provenanceValue(selection.role)}`);
  if (selection.configDigest !== undefined) fields.push(`routing=${provenanceValue(selection.configDigest.slice(0, 12))}`);
  return fields.join(";");
}

/** Durable one-line terminal detail for an attempt. For a bounded process that
 *  FAILED with MODEL_PROCESS_FAILED (a non-zero-exit provider subprocess — the
 *  rate-limit/overload shape) it additionally carries a sanitized, capped head
 *  of stdout (and stderr when non-empty) so an operator can see WHY the process
 *  failed instead of inferring from byte counts alone. The head is NOT added for
 *  a schema-invalid exit-0 output (MODEL_OUTPUT_INVALID — that stdout is raw
 *  model output the security tests require kept out of the journal), a SUCCEEDED
 *  attempt, or an uncertain teardown. */
function terminalDetail(
  process: ProcessResult | null,
  outcome: ModelResult["outcome"],
  errorCode: ModelErrorCode,
  provenance: string,
): string {
  if (process === null) return `gateway=${outcome}; supervisor=rejected;${provenance}`;
  const fields = [
    `gateway=${outcome}`,
    `process=${process.outcome}`,
    `exit=${process.exitCode ?? "none"}`,
    `stdoutBytes=${process.stdout.byteLength}`,
    `stderrBytes=${process.stderr.byteLength}`,
    `stdoutTruncated=${process.stdoutTruncated}`,
    `stderrTruncated=${process.stderrTruncated}`,
  ];
  const captureInvalid = outcome === "FAILED" && errorCode === "MODEL_OUTPUT_INVALID"
    && globalThis.process?.env?.CHAPTERFLOW_CAPTURE_INVALID_OUTPUT === "1";
  if ((outcome === "FAILED" && errorCode === "MODEL_PROCESS_FAILED") || captureInvalid) {
    const stdoutHead = sanitizedStreamHead(process.stdout);
    if (stdoutHead) fields.push(`stdoutHead=${stdoutHead}`);
    const stderrHead = sanitizedStreamHead(process.stderr);
    if (stderrHead) fields.push(`stderrHead=${stderrHead}`);
  }
  fields.push(provenance);
  return fields.join(";");
}

export function createModelGateway(dependencies: ModelGatewayDependencies): ModelGateway {
  // Callers without an explicit `route`/`routeSelector` (e.g. src/cli.ts's
  // ad-hoc wiring) fall back to the config-driven per-role selector from
  // config/model-routing.json — no model literal may live here (model-policy
  // static scan). An explicitly injected single `route` keeps its old
  // behavior: one route for every task, and provenance that names only it.
  const constantSelection: RouteSelection | null = dependencies.route === undefined
    ? null
    : Object.freeze({ route: dependencies.route });
  const routeSelector: ModelRouteSelector = dependencies.routeSelector
    ?? (constantSelection === null
      ? createDefaultModelRouteSelector()
      : { select: () => constantSelection });
  const now = dependencies.now ?? (() => new Date().toISOString());

  const executeOnce = async (task: ModelTaskSnapshot): Promise<ModelResult> => {
    if (task.signal.aborted) return result(task.attemptId, "CANCELLED", "MODEL_TASK_INVALID", "task cancelled before admission");

    // R-021: the task's role picks the route (model + effort tier). Resolved
    // once per attempt, before any side effect, so a selector that throws on a
    // bad config fails the attempt rather than half-running it.
    let selection: RouteSelection;
    try {
      selection = routeSelector.select(task.role);
    } catch {
      return result(task.attemptId, "FAILED", "MODEL_PROFILE_INVALID", "model route could not be resolved for task role");
    }
    const route = selection.route;
    const provenance = routeProvenance(selection);

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
        // Task 11x: an API-side error envelope (is_error=true — rate limit,
        // content filter, 4xx/5xx) is a process-class failure, not model
        // output; classify BEFORE schema validation so the real message
        // surfaces and the transient-retry machinery owns it.
        const apiError = classifyRouteStdout(route, process.stdout);
        const normalizedStdout = apiError ? process.stdout : normalizeRouteStdout(route, process.stdout);
        const validated = apiError
          ? { ok: false as const, error: { code: "MODEL_PROCESS_FAILED", message: apiError.message } }
          : dependencies.executionPolicy.validateOutput(prepared.value.policy.profile.outputSchemaId, normalizedStdout);
        if (validated.ok) {
          outcome = "SUCCEEDED";
          output = validated.value;
          errorCode = "MODEL_PROCESS_FAILED";
          errorMessage = "";
        } else {
          outcome = "FAILED";
          errorCode = apiError ? "MODEL_PROCESS_FAILED" : "MODEL_OUTPUT_INVALID";
          errorMessage = apiError
            ? apiError.message
            : "model output failed source-controlled schema validation";
        }
      } else {
        outcome = mappedOutcome(process);
        errorCode = outcome === "UNKNOWN" ? "MODEL_EXECUTION_UNCERTAIN" : "MODEL_PROCESS_FAILED";
        errorMessage = outcome === "UNKNOWN"
          ? "process-tree cleanup failed after admission"
          : providerFailureMessage(route, process);
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
        detail: terminalDetail(process, outcome, errorCode, provenance),
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
