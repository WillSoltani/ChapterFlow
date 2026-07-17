/**
 * WP-E00 interface freeze / WP-E21 implementation — `ultraSession`: an
 * envelope-proven `codex exec` session at GPT-5.6 Sol with reasoning effort
 * "ultra", for the D7 operational reviewer and the canonical-evaluator
 * chapter-diagnostic workers.
 *
 * POLICY (owner assignment, docs/v25/CLAUDE_FABLE_5_ULTRACODE_V25_EVALUATOR_
 * IMPLEMENTATION_ORCHESTRATOR_PROMPT.md): D7 must route to GPT-5.6 Sol @ Ultra
 * through the real model-routing and execution envelope, and receipts/ledgers
 * must PROVE the selected route. No Claude-family model may rate a book or
 * chapter.
 *
 * DESIGN (frozen in Wave 0; see the execution plan §"D7 → Sol-Ultra"):
 *  - The pipeline's frozen `EffortLevelV1`/`ReasoningEffort` union (minimal…
 *    xhigh) is deliberately NOT extended: "ultra" exists only on this scoped
 *    route, requested via the codex config override the argv layer already
 *    supports (`-c model_reasoning_effort=<v>`, codexTransportConfig.ts). It
 *    therefore never funnels through `resolveRoute` (whose effort-union check
 *    would fail-close "ultra") — the route is decided by the ONE authority
 *    `resolveD7RaterRoute()` and carried as a plain string.
 *  - Envelope proof reuses the exported primitives (`buildIsolatedSession`,
 *    `hermeticExecArgv`, effective-context manifest persistence): the manifest
 *    records the full argv, so the sidecar itself proves the ultra override
 *    was on the spawn. Subscription OAuth is asserted; API keys refused.
 *  - Because "ultra" acceptance by the installed codex binary is statically
 *    evidenced (.codex/agents/*.toml) but not runtime-proven, every campaign
 *    MUST run `runUltraAcceptanceProbe` once before any rating spawn and
 *    fail closed if the CLI rejects the value.
 *
 * The process runner is an INJECTABLE dependency (repo spawn-injection idiom:
 * `codexAgent.CodexRunner`, `modelCapabilityProbe` deps) supplied through the
 * optional `deps` argument — the frozen request/result TYPES are unchanged and
 * a single-argument call is byte-compatible. Tests inject a double so no real
 * process ever launches.
 */

import { copyFileSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

import { hashCanonical, sha256Hex } from "../contracts/contractUtil.js";
import type { AgentRole } from "../contracts/executionProfile.js";
import type { EffectiveContextManifestV1 } from "../contracts/effectiveContext.js";
import type { ProviderOutcomeV1 } from "../contracts/routeContracts.js";
import { type CodexCliQualificationV1, qualifyCodexCli, syntheticQualification } from "./cliQualification.js";
import { codexTransportSchemaCompatibilityErrors } from "./codexTransportConfig.js";
import {
  assembleEffectiveContextManifest,
  buildHermeticEnv,
  buildIsolatedSession,
  defaultManifestSink,
  discoverInstructionChain,
  ExecPreflightError,
  hermeticExecArgv,
  persistEffectiveContextManifest,
  resolveExecutionProfile,
} from "./executionEnvelope.js";
import { classifyProviderOutcome, resolveD7RaterRoute } from "../orchestrator/modelPolicy.js";
import { type CodexRunner, CodexRunnerProcessError, defaultCodexRunner, findCodexBinary } from "../orchestrator/codexAgent.js";

export const ULTRA_EFFORT = "ultra" as const;

/** The single authority-approved D7/evaluator rater route (see
 *  modelPolicy.resolveD7RaterRoute(), added in WP-E21). */
export type UltraRouteV1 = {
  model: string;
  effort: typeof ULTRA_EFFORT;
};

export type UltraSessionRequestV1 = {
  /** Which rating role this session serves (primary/verification/adjudicator
   *  for evaluator workers; d7-rater/d7-adjudicator for the D7 instrument). */
  role: string;
  /** Absolute path of the rendered task prompt the worker reads. */
  promptPath: string;
  /** Optional absolute path of a JSON schema to bind via --output-schema. */
  outputSchemaPath?: string | null;
  /** Isolated working directory for the spawn (empty-cwd discipline). */
  cwd: string;
  timeoutMs: number;
  /** Stable tag folded into the session id / ledger stage label. */
  sessionTag: string;
  /** Book/run identifiers for ledger attribution. */
  bookId: string;
  runId: string;
};

export type UltraSessionResultV1 = {
  ok: boolean;
  /** The RESOLVED route actually spawned (from the effective-context manifest,
   *  not the request). */
  model: string;
  effort: string;
  sessionId: string;
  /** Absolute path + sha256 of the persisted effective-context manifest that
   *  proves argv (including the ultra override), env, and auth mode. */
  manifestPath: string;
  manifestSha256: string;
  /** Absolute path of the raw reply artifact (preserved on failure too). */
  replyPath: string | null;
  latencyMs: number;
  /** ProviderOutcomeV1 value (frozen taxonomy). */
  outcome: string;
  failure?: string;
};

/** Persisted once per campaign BEFORE any rating spawn; receipts reference its
 *  sha256. `accepted:false` fail-closes the campaign. */
export type UltraAcceptanceProbeV1 = {
  schemaVersion: "ultra-acceptance-probe-v1";
  probedAt: string;
  model: string;
  effort: typeof ULTRA_EFFORT;
  accepted: boolean;
  detail: string;
  /** Absolute path of the probe's own effective-context manifest. */
  manifestPath: string | null;
  sidecarPath: string;
  sidecarSha256: string;
};

export const ULTRA_SESSION_NOT_IMPLEMENTED =
  "ultraSession: WP-E21 implementation has not landed on this branch" as const;

/** Injectable dependencies (repo spawn-injection idiom). Omitting `deps` runs
 *  the REAL codex exec path; tests supply a runner double + tmp evidence dirs so
 *  no real process launches and nothing is written under a guarded root. */
export type UltraSessionDepsV1 = {
  /** The process runner. Default: the real `codex exec` runner
   *  (`defaultCodexRunner`). A double captures/answers argv without a process. */
  runner?: CodexRunner;
  /** Base dir for the per-spawn isolated session (isolated CODEX_HOME + capture
   *  file). Default os tmpdir. */
  execBaseDir?: string;
  /** Sink dir for the effective-context manifest + preserved reply. Default the
   *  gitignored logs/exec sink; tests bind a fresh tmp dir. */
  manifestSink?: string;
  /** Override the codex binary. Default `findCodexBinary()`. */
  bin?: string;
  /** Supply a CLI qualification instead of probing the binary (tests use the
   *  synthetic qualification; a runner-injected run defaults to synthetic). */
  qualification?: CodexCliQualificationV1;
  /** Override the auth source dir handed to `buildIsolatedSession` (tests). */
  authSourceDir?: string;
  /** Whether the isolated session must PROVE ChatGPT-subscription auth before
   *  spawn. Default: a REAL run (no injected runner) requires it; an injected
   *  double does not. A test sets it true (with a metered/absent auth source) to
   *  exercise the fail-closed refusal without ever reaching a process. */
  requireAuth?: boolean;
  /** Deterministic clock for evidence timestamps (tests). */
  clock?: () => Date;
};

/** EXECUTION role for every ultra spawn: a read-only judge profile (caller-cwd,
 *  read-only sandbox). This is the ENVELOPE role (picks the profile/sandbox);
 *  the request's `role` is the rating-role LABEL folded into the session id, a
 *  separate axis. Model + effort are overridden explicitly, so the profile's
 *  default model never leaks onto the ultra route. */
const ULTRA_EXECUTION_ROLE: AgentRole = "bakeoff-judge";

/** One-field strict-subset schema bound to `--output-schema` on the acceptance
 *  probe — a completed run proves BOTH the ultra effort override and the
 *  structured-output flag were accepted by the installed CLI. */
const ULTRA_PROBE_SCHEMA: Record<string, unknown> = {
  type: "object",
  additionalProperties: false,
  required: ["ok"],
  properties: { ok: { type: "boolean" } },
};
const ULTRA_PROBE_TASK =
  'Ultra acceptance probe (WP-E21). Return exactly this JSON and nothing else: {"ok":true}';

function slug(s: string): string {
  const cleaned = (s ?? "").replace(/[^a-zA-Z0-9._-]/g, "-").slice(0, 48);
  return cleaned.length > 0 ? cleaned : "x";
}

function lastNonEmptyLine(s: string): string {
  const lines = s.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  return lines.length ? lines[lines.length - 1] : s.trim();
}

/** A CLI rejection of the ultra token is a NON-ZERO exit whose stderr names the
 *  reasoning-effort config value. Returns the offending line (bounded) or null. */
function ultraRejectionSignal(stderr: string, code: number | null): string | null {
  if (code === 0) return null;
  const m = /([^\n]*\b(?:model_reasoning_effort|reasoning[ _-]?effort|effort|ultra)\b[^\n]*)/i.exec(stderr ?? "");
  return m ? m[1].trim().slice(0, 240) : null;
}

type UltraEnvelope = {
  ratingRole: string;
  sessionTag: string;
  bookId: string;
  runId: string;
  promptTask: string;
  cwd: string;
  outputSchemaPath?: string | null;
  timeoutMs: number;
};

type UltraEnvelopeOutcome = {
  manifestPath: string;
  manifestSha256: string;
  /** Read back FROM the persisted manifest bytes (never echoed from the request). */
  resolvedModel: string;
  resolvedEffort: string;
  sessionId: string;
  replyPath: string | null;
  finalMessage: string;
  latencyMs: number;
  /** null ⇒ the runner threw (spawn error / timeout) before returning. */
  code: number | null;
  stdout: string;
  stderr: string;
  thrown: Error | null;
  outcome: ProviderOutcomeV1;
};

/** Assemble + persist the effective-context manifest for one ultra spawn, run
 *  the (injected) runner, and preserve the reply. The ultra effort travels as a
 *  plain string through `hermeticExecArgv`/the manifest — the effort union is
 *  untouched. Auth is proven inside `buildIsolatedSession`; API-key env is
 *  stripped by the allowlist-built child env. */
async function spawnUltraEnvelope(env: UltraEnvelope, deps: UltraSessionDepsV1): Promise<UltraEnvelopeOutcome> {
  const route = resolveD7RaterRoute(); // the ONE authority: BASELINE_MODEL @ "ultra"
  const runnerInjected = deps.runner !== undefined;
  const runner = deps.runner ?? defaultCodexRunner;
  const bin = deps.bin ?? findCodexBinary();
  const requireAuth = deps.requireAuth ?? !runnerInjected;
  const clock = deps.clock ?? (() => new Date());

  const { profile, profileHash } = resolveExecutionProfile(ULTRA_EXECUTION_ROLE);
  const sinkDir = deps.manifestSink ?? defaultManifestSink();
  const qualification = deps.qualification
    ?? (runnerInjected ? syntheticQualification() : await qualifyCodexCli({ bin, cacheDir: sinkDir }));

  // §16 D1: a supplied output schema must EXIST and be a valid transport strict
  // subset — fail closed rather than spawn a schema-bound call without its schema.
  const outputSchemaPath = env.outputSchemaPath ?? undefined;
  if (outputSchemaPath !== undefined) {
    if (!existsSync(outputSchemaPath)) {
      throw new ExecPreflightError(`ultra session output schema not found: ${outputSchemaPath} — refusing to spawn a schema-bound call without its schema`);
    }
    const schemaErrors = codexTransportSchemaCompatibilityErrors(JSON.parse(readFileSync(outputSchemaPath, "utf8")));
    if (schemaErrors.length > 0) {
      throw new ExecPreflightError(`ultra session output schema is not a Codex transport strict subset: ${schemaErrors.join("; ")}`);
    }
  }

  // Distinct session identity: the rating-role LABEL + tag fold into the id so
  // finalize can REVISE-reject any author-grades-own-work collision; bookId/runId
  // disambiguate replicates.
  const sessionId = `ultra-${slug(env.ratingRole)}-${slug(env.sessionTag)}-${sha256Hex(
    `${env.bookId}|${env.runId}|${env.ratingRole}|${env.sessionTag}|${env.promptTask}`,
  ).slice(0, 12)}`;

  const session = buildIsolatedSession({
    baseDir: deps.execBaseDir ?? tmpdir(),
    requireAuth,
    ...(deps.authSourceDir !== undefined ? { authSourceDir: deps.authSourceDir } : {}),
  });
  try {
    const argv = hermeticExecArgv({
      profile,
      qualification,
      sandbox: "read-only",
      model: route.model,
      reasoningEffort: route.effort, // "ultra" — string-typed argv layer, NOT the frozen union
      writableRoots: [],
      skipGitRepoCheck: true, // the isolated rater cwd is not a git repo
      lastMessagePath: session.lastMessagePath,
      task: env.promptTask,
      ...(outputSchemaPath ? { outputSchemaPath } : {}),
    });
    const { env: childEnv, envKeys, callerEnvKeys, strictEnv } = buildHermeticEnv({
      profile,
      codexHomeDir: session.codexHomeDir,
      sessionId,
      // No callerEnv → metered-API/provider-redirect vars are stripped by the
      // allowlist (and fail-closed by FORBIDDEN_PROVIDER_ENV) — never forwarded.
    });
    const manifest = assembleEffectiveContextManifest({
      sessionId,
      role: ULTRA_EXECUTION_ROLE,
      profile,
      profileHash,
      binPath: bin,
      qualification,
      argv,
      cwd: env.cwd,
      envKeys,
      callerEnvKeys,
      strictEnv,
      codexHome: {
        dir: session.codexHomeDir,
        authMaterial: session.authMaterial,
        ...(session.authSourcePath ? { authSourcePath: session.authSourcePath } : {}),
      },
      instructionSources: discoverInstructionChain(env.cwd, profile.neutralizeProjectDocs),
      model: route.model,
      reasoningEffort: route.effort,
      sandbox: "read-only",
      timeoutMs: env.timeoutMs,
      task: env.promptTask,
    });
    const manifestPath = persistEffectiveContextManifest(manifest, sinkDir);

    // Read the RESOLVED model/effort back FROM the persisted manifest bytes: the
    // result must PROVE the sidecar carries the ultra override, never echo it
    // from the request. manifestSha256 is over the exact persisted bytes.
    const manifestBytes = readFileSync(manifestPath);
    const manifestSha256 = sha256Hex(manifestBytes);
    const persisted = JSON.parse(manifestBytes.toString("utf8")) as EffectiveContextManifestV1;
    const resolvedModel = persisted.model;
    const resolvedEffort = persisted.reasoningEffort;

    const startedAt = clock().getTime();
    let code: number | null = null;
    let stdout = "";
    let stderr = "";
    let thrown: Error | null = null;
    try {
      const out = await runner({ bin, argv, cwd: env.cwd, env: childEnv, timeoutMs: env.timeoutMs });
      stdout = out.stdout;
      stderr = out.stderr;
      code = out.code;
    } catch (err) {
      thrown = err as Error;
      if (err instanceof CodexRunnerProcessError) {
        stdout = err.stdout;
        stderr = err.stderr;
      }
    }
    const latencyMs = clock().getTime() - startedAt;

    // Preserve the reply (copied OUT of the soon-cleaned session dir) on BOTH
    // success and failure — a refusal/timeout still leaves inspectable evidence.
    let replyPath: string | null = null;
    let finalMessage = "";
    try {
      if (existsSync(session.lastMessagePath)) {
        finalMessage = readFileSync(session.lastMessagePath, "utf8").trim();
        replyPath = manifestPath.replace(/\.manifest\.json$/, ".reply.txt");
        copyFileSync(session.lastMessagePath, replyPath);
      }
    } catch {
      replyPath = null;
    }
    if (finalMessage === "" && stdout) finalMessage = lastNonEmptyLine(stdout);

    const outcome: ProviderOutcomeV1 = thrown
      ? classifyProviderOutcome({ completed: false, errorMessage: thrown.message })
      : classifyProviderOutcome({ completed: true, exitCode: code ?? undefined, stderr, finalMessage });

    return {
      manifestPath,
      manifestSha256,
      resolvedModel,
      resolvedEffort,
      sessionId,
      replyPath,
      finalMessage,
      latencyMs,
      code,
      stdout,
      stderr,
      thrown,
      outcome,
    };
  } finally {
    // ALWAYS remove the per-spawn session dir (copied auth material lives there);
    // the reply was already copied to the durable sink above.
    session.cleanup();
  }
}

function readPromptFile(promptPath: string): string {
  try {
    return readFileSync(promptPath, "utf8");
  } catch (err) {
    throw new ExecPreflightError(
      `ultra session prompt is missing or unreadable: ${promptPath} (${(err as Error).message.split("\n")[0]}) — refusing to spawn`,
    );
  }
}

export async function runUltraSession(
  req: UltraSessionRequestV1,
  deps: UltraSessionDepsV1 = {},
): Promise<UltraSessionResultV1> {
  const outcome = await spawnUltraEnvelope(
    {
      ratingRole: req.role,
      sessionTag: req.sessionTag,
      bookId: req.bookId,
      runId: req.runId,
      promptTask: readPromptFile(req.promptPath),
      cwd: req.cwd,
      outputSchemaPath: req.outputSchemaPath ?? null,
      timeoutMs: req.timeoutMs,
    },
    deps,
  );
  const ok = outcome.thrown === null && outcome.code === 0;
  return {
    ok,
    model: outcome.resolvedModel,
    effort: outcome.resolvedEffort,
    sessionId: outcome.sessionId,
    manifestPath: outcome.manifestPath,
    manifestSha256: outcome.manifestSha256,
    replyPath: outcome.replyPath,
    latencyMs: outcome.latencyMs,
    outcome: outcome.outcome,
    ...(outcome.thrown
      ? { failure: outcome.thrown.message.split("\n")[0] }
      : ok
        ? {}
        : { failure: `codex exec exited ${outcome.code} (outcome=${outcome.outcome})` }),
  };
}

/** Atomic sidecar publish: write a temp sibling then rename over the final path
 *  so a fail-closed campaign reader never observes a torn sidecar. */
function writeUltraProbeSidecar(
  probeDir: string,
  content: {
    schemaVersion: "ultra-acceptance-probe-v1";
    probedAt: string;
    model: string;
    effort: typeof ULTRA_EFFORT;
    accepted: boolean;
    detail: string;
    manifestPath: string | null;
  },
): UltraAcceptanceProbeV1 {
  const sidecarPath = join(probeDir, "ultra-acceptance-probe.json");
  // Content fingerprint over the SEMANTIC fields (excludes the path + self-hash
  // bookkeeping) so a receipt binds a stable id independent of the file path.
  const sidecarSha256 = hashCanonical(content);
  const full: UltraAcceptanceProbeV1 = { ...content, sidecarPath, sidecarSha256 };
  mkdirSync(probeDir, { recursive: true });
  const tmp = `${sidecarPath}.tmp-${process.pid}-${Date.now()}`;
  writeFileSync(tmp, `${JSON.stringify(full, null, 2)}\n`);
  renameSync(tmp, sidecarPath);
  return full;
}

export async function runUltraAcceptanceProbe(
  args: {
    route: UltraRouteV1;
    probeDir: string;
    timeoutMs?: number;
  },
  deps: UltraSessionDepsV1 = {},
): Promise<UltraAcceptanceProbeV1> {
  // The probe proves the INSTALLED binary accepts ultra at runtime. Its route
  // MUST be the single-authority ultra route — a caller cannot pass off a
  // different effort as ultra acceptance.
  if (args.route.effort !== ULTRA_EFFORT) {
    throw new ExecPreflightError(`ultra acceptance probe requires the ultra route (effort "${ULTRA_EFFORT}"); got "${String((args.route as { effort: string }).effort)}"`);
  }
  const authoritative = resolveD7RaterRoute();
  if (args.route.model !== authoritative.model || args.route.effort !== authoritative.effort) {
    throw new ExecPreflightError(
      `ultra acceptance probe route ${args.route.model}@${args.route.effort} does not match the single-authority D7 route ${authoritative.model}@${authoritative.effort}`,
    );
  }

  mkdirSync(args.probeDir, { recursive: true });
  const schemaErrors = codexTransportSchemaCompatibilityErrors(ULTRA_PROBE_SCHEMA);
  if (schemaErrors.length > 0) {
    throw new ExecPreflightError(`internal: ultra probe schema is not a valid Codex transport strict subset: ${schemaErrors.join("; ")}`);
  }
  const schemaPath = join(args.probeDir, "ultra-acceptance-probe.schema.json");
  writeFileSync(schemaPath, `${JSON.stringify(ULTRA_PROBE_SCHEMA, null, 2)}\n`);

  const timeoutMs = args.timeoutMs ?? 120_000;
  const probedAt = (deps.clock?.() ?? new Date()).toISOString();
  // The probe's own effective-context manifest lives beside its sidecar (never
  // the guarded default sink) unless the caller pins one.
  const probeDeps: UltraSessionDepsV1 = { ...deps, manifestSink: deps.manifestSink ?? join(args.probeDir, "logs") };

  let manifestPath: string | null = null;
  let accepted = false;
  let detail: string;
  try {
    const outcome = await spawnUltraEnvelope(
      {
        ratingRole: "d7-ultra-acceptance-probe",
        sessionTag: "ultra-acceptance",
        bookId: "ultra-probe",
        runId: probedAt,
        promptTask: ULTRA_PROBE_TASK,
        cwd: args.probeDir,
        outputSchemaPath: schemaPath,
        timeoutMs,
      },
      probeDeps,
    );
    manifestPath = outcome.manifestPath;
    if (outcome.thrown !== null) {
      accepted = false;
      detail = `ultra acceptance probe spawn failed before a usable response (${outcome.thrown.message.split("\n")[0]}); treating ultra as UNACCEPTED (fail closed)`;
    } else if (outcome.code === 0 && outcome.outcome === "content_completed") {
      accepted = true;
      detail = `codex exec accepted -c model_reasoning_effort=${ULTRA_EFFORT} with --output-schema and returned schema-bound authoritative output (exit 0)`;
    } else {
      accepted = false;
      const signal = ultraRejectionSignal(outcome.stderr, outcome.code);
      detail = signal !== null
        ? `codex exec rejected the ultra reasoning-effort token: ${signal}`
        : `codex exec did not accept ultra (exit=${outcome.code ?? "n/a"}, outcome=${outcome.outcome}); ultra acceptance unproven — fail closed`;
    }
  } catch (err) {
    // A preflight refusal (auth/schema/qualification) BEFORE any process is also
    // a fail-closed non-acceptance: the campaign must not run.
    accepted = false;
    detail = `ultra acceptance probe refused before spawn (${(err as Error).message.split("\n")[0]}); fail closed`;
  }

  return writeUltraProbeSidecar(args.probeDir, {
    schemaVersion: "ultra-acceptance-probe-v1",
    probedAt,
    model: args.route.model,
    effort: ULTRA_EFFORT,
    accepted,
    detail,
    manifestPath,
  });
}
