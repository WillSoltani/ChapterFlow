import { realpathSync, statSync } from "node:fs";
import { isAbsolute, resolve, sep } from "node:path";

import type { Result } from "../contracts/v4Core.js";
import type {
  ExecutionPolicy,
  ExecutionPolicyError,
  ExecutionProfile,
  ResolvedExecutionPolicy,
} from "./executionPolicyTypes.js";

// Task 7: no binary allowlist exists in this policy — the process command comes
// from the selected ModelProcessRoute (codex → "codex", claude → "claude") and
// is validated for shape only (nonempty, no NUL) in the gateway's prepareTask.
// So the claude binary is already permitted; the env-strip below still removes
// every provider API key. USER/LOGNAME/SHELL and HOME are kept because the
// claude route authenticates against the subscription credentials in the macOS
// login Keychain, which the CLI resolves by the login identity — a live Step-5
// smoke proved `claude -p` returns "Not logged in" when USER is stripped even
// with HOME present. These are non-secret identity vars (the sibling codex
// envelope's DEFAULT_ENV_ALLOWLIST already permits the same three); no provider
// key rides here (that set is FORBIDDEN_ENV below, checked after the copy).
const ENV_ALLOWLIST = ["PATH", "HOME", "USER", "LOGNAME", "SHELL", "TMPDIR", "TMP", "TEMP", "LANG", "LC_ALL", "LC_CTYPE", "TERM"] as const;
/** Exported (Task 7) as the single source of truth for the route-env merge
 *  guard in modelGateway: a route-supplied env may never carry any of these
 *  keys, so the env-strip stays authoritative. */
export const FORBIDDEN_ENV = [
  "OPENAI_API_KEY",
  "CODEX_API_KEY",
  "OPENAI_BASE_URL",
  "OPENAI_API_BASE",
  "OPENAI_ORGANIZATION",
  "OPENAI_PROJECT",
  "AZURE_OPENAI_API_KEY",
  "AZURE_OPENAI_ENDPOINT",
  "ANTHROPIC_API_KEY",
  "ANTHROPIC_BASE_URL",
  "CHAPTERFLOW_PROVIDER",
  "CHAPTERFLOW_WRITER_MODEL",
  "CHAPTERFLOW_RESEARCHER_MODEL",
  "CHAPTERFLOW_CRITIC_MODEL",
] as const;

function freezeProfile(profile: ExecutionProfile): ExecutionProfile {
  return Object.freeze({ ...profile });
}

export const SOURCE_CONTROLLED_EXECUTION_PROFILES: Readonly<Record<string, ExecutionProfile>> = Object.freeze({
  "pipeline-read-text-v1": freezeProfile({
    id: "pipeline-read-text-v1",
    workDirPolicy: "PIPELINE_ROOT",
    mode: "READ_ONLY",
    outputSchemaId: "text.v1",
    timeoutMs: 300_000,
    terminateGraceMs: 2_000,
    maxStdoutBytes: 1_048_576,
    maxStderrBytes: 262_144,
  }),
  "pipeline-read-json-v1": freezeProfile({
    id: "pipeline-read-json-v1",
    workDirPolicy: "PIPELINE_ROOT",
    mode: "READ_ONLY",
    outputSchemaId: "json.object.v1",
    timeoutMs: 300_000,
    terminateGraceMs: 2_000,
    maxStdoutBytes: 1_048_576,
    maxStderrBytes: 262_144,
  }),
  "attempt-read-json-v1": freezeProfile({
    id: "attempt-read-json-v1",
    workDirPolicy: "ATTEMPT_ROOT",
    mode: "READ_ONLY",
    outputSchemaId: "json.object.v1",
    // Task 11k — timeout calibration. This is the profile every compile-section
    // draft runs on (CompilerApplicationPort.COMPILER_SECTION_PROFILE_ID), plus
    // candidate-repair and research-candidate intake. Section drafting is a
    // Sonnet@high whole-artifact call whose live-measured latency is comparable
    // to a research chapter (150–407s observed), and a bounded retry replays a
    // LARGER card (prior blockers / schema reminder folded in), so 300_000 (5 min)
    // clipped genuinely-progressing drafts at the horizon — the finding-14 canary
    // died BOOK_RUN_COMPILER_FAILED:MODEL_TASK_TIMED_OUT with stdoutBytes=0, which
    // (claude -p buffers all stdout until completion) says nothing about progress.
    // Raised to 600_000 (10 min), matching the attempt-write-json-v1 precedent
    // below. The gateway's stale-attempt horizon (modelGateway.ts: timeoutMs +
    // terminateGraceMs + 1s) is derived from this field, so it scales in lockstep.
    // Review/QC probe profiles (pipeline-read-json-v1/-text-v1) are short-call and
    // are NOT touched — sections do not use them.
    //
    // Raised again 1_800_000 (30 min) on the Franklin canary: ch01 learning-pack
    // burned a full compile round with three consecutive 900s timeouts, every one
    // stdoutBytes=0 — the same says-nothing-about-progress signature 11k already
    // documented (claude -p buffers all stdout until completion). learning-pack is
    // the largest section prompt (chapter prose + per-slot verbatim specifics), and
    // its siblings (summary/example) fit the old budget; tripling headroom converts
    // a possible slow-but-progressing draft from a guaranteed strike-3 death into a
    // stored pack, and costs nothing when the call finishes early. NOTE: none of
    // this helps if the HOST sleeps — node timers freeze and wall-clock stretches
    // arbitrarily — so live runs must be launched under `caffeinate -i`.
    timeoutMs: 1_800_000,
    terminateGraceMs: 2_000,
    maxStdoutBytes: 1_048_576,
    maxStderrBytes: 262_144,
  }),
  "attempt-write-json-v1": freezeProfile({
    id: "attempt-write-json-v1",
    workDirPolicy: "ATTEMPT_ROOT",
    mode: "WORKSPACE_WRITE",
    outputSchemaId: "json.object.v1",
    timeoutMs: 600_000,
    terminateGraceMs: 2_000,
    maxStdoutBytes: 1_048_576,
    maxStderrBytes: 262_144,
  }),
});

function failure<T>(code: ExecutionPolicyError["code"], message: string): Result<T, ExecutionPolicyError> {
  return { ok: false, error: { code, message } };
}

function positiveSafeInteger(value: unknown): boolean {
  return Number.isSafeInteger(value) && (value as number) > 0;
}

export function validateExecutionProfile(profile: unknown): Result<ExecutionProfile, ExecutionPolicyError> {
  if (profile === null || typeof profile !== "object" || Array.isArray(profile)) return failure("PROFILE_INVALID", "profile must be an object");
  const value = profile as Record<string, unknown>;
  const expected = [
    "id", "workDirPolicy", "mode", "outputSchemaId", "timeoutMs", "terminateGraceMs", "maxStdoutBytes", "maxStderrBytes",
  ];
  if (Object.keys(value).length !== expected.length || expected.some((key) => value[key] === undefined)) {
    return failure("PROFILE_INVALID", "profile fields are incomplete or unknown");
  }
  if (typeof value.id !== "string" || !/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(value.id)) return failure("PROFILE_INVALID", "profile id is invalid");
  if (value.workDirPolicy !== "PIPELINE_ROOT" && value.workDirPolicy !== "ATTEMPT_ROOT") return failure("PROFILE_INVALID", "profile workDirPolicy is invalid");
  if (value.mode !== "READ_ONLY" && value.mode !== "WORKSPACE_WRITE") return failure("PROFILE_INVALID", "profile mode is invalid");
  if (typeof value.outputSchemaId !== "string" || !["text.v1", "json.object.v1"].includes(value.outputSchemaId)) {
    return failure("PROFILE_INVALID", "profile outputSchemaId is invalid");
  }
  for (const key of ["timeoutMs", "terminateGraceMs", "maxStdoutBytes", "maxStderrBytes"] as const) {
    if (!positiveSafeInteger(value[key])) return failure("PROFILE_INVALID", `profile ${key} must be a positive safe integer`);
  }
  return { ok: true, value: profile as ExecutionProfile };
}

function canonicalDirectory(path: string): string | null {
  if (typeof path !== "string" || path.length === 0 || path.includes("\0") || !isAbsolute(path)) return null;
  try {
    const canonical = realpathSync(resolve(path));
    return statSync(canonical).isDirectory() ? canonical : null;
  } catch {
    return null;
  }
}

function buildEnvironment(base: NodeJS.ProcessEnv): Result<Readonly<Record<string, string>>, ExecutionPolicyError> {
  const environment: Record<string, string> = {};
  for (const name of ENV_ALLOWLIST) {
    const value = base[name];
    if (value === undefined) continue;
    if (value.includes("\0")) return failure("ENVIRONMENT_INVALID", `allowed environment value is invalid: ${name}`);
    environment[name] = value;
  }
  environment.CHAPTERFLOW_NO_API_CODEX_QC = "1";
  environment.CHAPTERFLOW_V4_MODEL_GATEWAY = "1";
  for (const name of FORBIDDEN_ENV) {
    if (environment[name] !== undefined) return failure("ENVIRONMENT_INVALID", `forbidden provider environment reached policy: ${name}`);
  }
  return { ok: true, value: Object.freeze(environment) };
}

function validateOutput(outputSchemaId: string, bytes: Uint8Array): Result<unknown> {
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return failure("OUTPUT_INVALID", "model output is not valid UTF-8");
  }
  if (text.trim().length === 0) return failure("OUTPUT_INVALID", "model output is empty");
  if (outputSchemaId === "text.v1") return { ok: true, value: text };
  if (outputSchemaId === "json.object.v1") {
    try {
      const parsed = JSON.parse(text) as unknown;
      if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
        return failure("OUTPUT_INVALID", "model output must be a JSON object");
      }
      return { ok: true, value: parsed };
    } catch {
      return failure("OUTPUT_INVALID", "model output is not valid JSON");
    }
  }
  return failure("OUTPUT_INVALID", "output schema is not registered");
}

export function createExecutionPolicy(options: Readonly<{
  pipelineRoot: string;
  attemptRoot: string;
  baseEnvironment?: NodeJS.ProcessEnv;
}>): ExecutionPolicy {
  const pipelineRoot = canonicalDirectory(options.pipelineRoot);
  const attemptRoot = canonicalDirectory(options.attemptRoot);
  if (pipelineRoot === null || attemptRoot === null) throw new TypeError("execution policy roots must be existing absolute directories");
  const environment = buildEnvironment(options.baseEnvironment ?? process.env);

  return {
    resolve(profileId: string, workDir: string): Result<ResolvedExecutionPolicy> {
      const profile = SOURCE_CONTROLLED_EXECUTION_PROFILES[profileId];
      if (profile === undefined) return failure("PROFILE_NOT_FOUND", `unknown source-controlled execution profile: ${profileId}`);
      const valid = validateExecutionProfile(profile);
      if (!valid.ok) return valid;
      if (!environment.ok) return environment;
      const canonicalWorkDir = canonicalDirectory(workDir);
      if (canonicalWorkDir === null) return failure("WORKDIR_INVALID", "task workDir must be an existing canonicalizable absolute directory");
      if (profile.workDirPolicy === "PIPELINE_ROOT" && canonicalWorkDir !== pipelineRoot) {
        return failure("WORKDIR_POLICY_VIOLATION", "task workDir is not exact pipeline root");
      }
      if (
        profile.workDirPolicy === "ATTEMPT_ROOT"
        && (canonicalWorkDir === attemptRoot || !canonicalWorkDir.startsWith(`${attemptRoot}${sep}`))
      ) {
        return failure("WORKDIR_POLICY_VIOLATION", "task workDir is outside isolated attempt root");
      }
      return { ok: true, value: { profile, workDir: canonicalWorkDir, environment: environment.value } };
    },
    validateOutput,
  };
}
