/**
 * IMP-00: hermetic execution envelope — hostile-context proofs.
 *
 * Every test drives the REAL spawn path (`spawnCodexAgent` with a declared
 * role) through an injected runner that captures exactly what would reach the
 * codex process: argv, env, cwd. The hostile fixtures mirror the F-019 world:
 * a personal config that changes the model, secrets in the parent env, a
 * hostile CODEX_HOME, and the stale v21 AGENTS.md files at the repo/pipeline
 * roots. The envelope must neutralize all of it — and RECORD it as evidence.
 */

import assert from "node:assert/strict";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

import { test } from "./harness.js";
import { PIPELINE_DIR, TMP_DIR } from "./helpers.js";
import { spawnCodexAgent, type CodexRunnerArgs } from "../src/orchestrator/codexAgent.js";
import { AGENT_ROLES } from "../src/contracts/executionProfile.js";
import { validateEffectiveContextManifest, type EffectiveContextManifestV1 } from "../src/contracts/effectiveContext.js";
import {
  BASELINE_MODEL,
  buildHermeticEnv,
  buildIsolatedSession,
  discoverInstructionChain,
  EXECUTION_PROFILES,
  ExecPreflightError,
  resolveExecutionProfile,
} from "../src/exec/executionEnvelope.js";

let seq = 0;
function freshDir(label: string): string {
  const dir = join(TMP_DIR, `exec-envelope-${label}-${process.pid}-${seq++}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

type Captured = { args: CodexRunnerArgs | null };

function captureRunner(captured: Captured, stdout = "agent says done") {
  return async (args: CodexRunnerArgs) => {
    captured.args = args;
    return { stdout, stderr: "", code: 0 };
  };
}

async function hermeticSpawn(overrides: Partial<Parameters<typeof spawnCodexAgent>[0]> = {}, captured: Captured = { args: null }) {
  const sink = freshDir("sink");
  const result = await spawnCodexAgent({
    task: "FIXTURE TASK — do the work",
    sessionId: `exec-env-test-${seq}`,
    cwd: PIPELINE_DIR,
    sandbox: "read-only",
    role: "chapter-reviewer",
    runner: captureRunner(captured),
    manifestSink: sink,
    execBaseDir: freshDir("base"),
    ...overrides,
  });
  return { result, captured, sink };
}

test("every declared role resolves to a valid profile with an explicit baseline model", () => {
  for (const role of AGENT_ROLES) {
    const { profile, profileHash } = resolveExecutionProfile(role);
    assert.equal(profile.role, role);
    assert.equal(profile.defaultModel, BASELINE_MODEL, `${role} must pin the qualified baseline, never ambient`);
    assert.equal(profileHash.length, 64);
  }
  assert.equal(EXECUTION_PROFILES["author-writer"].defaultReasoningEffort, "xhigh");
  assert.deepEqual([...EXECUTION_PROFILES["chapter-reviewer"].allowedSandboxes], ["read-only"]);
  assert.equal(EXECUTION_PROFILES["qc-reviewer"].workingDir, "isolated-workspace");
  // IMP-08: every review-family role runs in built role workspaces outside the
  // repo — the recorded policy states that truth (the F-015 exposure is gone).
  for (const role of ["chapter-reviewer", "book-acceptance-reader", "shipped-control", "eval-reader", "eval-book"] as const) {
    assert.equal(EXECUTION_PROFILES[role].workingDir, "isolated-workspace", `${role} is workspace-isolated post-IMP-08`);
  }
});

test("hermetic argv carries isolation, neutralization, explicit model/effort, and output capture", async () => {
  const { captured } = await hermeticSpawn();
  const argv = captured.args!.argv;
  assert.ok(argv.includes("--ignore-user-config"), "personal config.toml must never load");
  assert.ok(argv.includes("--ignore-rules"), "user/project .rules must never load");
  const cIdx = argv.reduce<number[]>((acc, a, i) => (a === "-c" ? [...acc, i] : acc), []);
  const cValues = cIdx.map((i) => argv[i + 1]);
  assert.ok(cValues.includes("project_doc_max_bytes=0"), "project AGENTS.md discovery must be neutralized");
  assert.ok(cValues.includes(`model=${BASELINE_MODEL}`), "model must be explicit on EVERY call (no ambient)");
  assert.ok(cValues.includes("model_reasoning_effort=high"), "reviewer profile default effort must apply");
  const oIdx = argv.indexOf("--output-last-message");
  assert.ok(oIdx > 0, "final message must be captured via -o, not last-stdout-line parsing");
  assert.equal(argv[argv.length - 1], "FIXTURE TASK — do the work", "task stays the last positional arg");
});

test("explicit call-site model/effort override the profile default and are recorded", async () => {
  const { captured, sink } = await hermeticSpawn({ role: "author-writer", sandbox: "workspace-write", model: "gpt-5.5", reasoningEffort: "xhigh" });
  const argv = captured.args!.argv;
  assert.ok(argv.join(" ").includes("model=gpt-5.5"));
  assert.ok(argv.join(" ").includes("model_reasoning_effort=xhigh"));
  const manifest = readManifest(sink);
  assert.equal(manifest.model, "gpt-5.5");
  assert.equal(manifest.reasoningEffort, "xhigh");
});

test("hostile parent environment is dropped; the child sees the allowlist + strict invariants only", async () => {
  const hostile: Record<string, string> = {
    CODEX_HOME: "/hostile/personal-codex",
    OPENAI_API_KEY: "sk-secret-must-not-leak",
    AWS_SECRET_ACCESS_KEY: "aws-secret-must-not-leak",
    CHAPTERFLOW_AMBIENT_SMUGGLE: "nope",
  };
  const saved: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(hostile)) { saved[k] = process.env[k]; process.env[k] = v; }
  try {
    const { captured } = await hermeticSpawn({ env: { CHAPTERFLOW_CALLER_INTENT: "yes" } });
    const env = captured.args!.env;
    assert.notEqual(env.CODEX_HOME, "/hostile/personal-codex", "CODEX_HOME must be the isolated per-spawn home");
    assert.ok(String(env.CODEX_HOME).includes("codex-home"), "isolated home dir expected");
    assert.equal(env.OPENAI_API_KEY, undefined, "secrets must not pass through");
    assert.equal(env.AWS_SECRET_ACCESS_KEY, undefined, "secrets must not pass through");
    assert.equal(env.CHAPTERFLOW_AMBIENT_SMUGGLE, undefined, "ambient CHAPTERFLOW_* must not pass implicitly");
    assert.equal(env.CHAPTERFLOW_CALLER_INTENT, "yes", "caller-explicit env passes and is recorded");
    assert.equal(env.CHAPTERFLOW_NO_API_CODEX_QC, "1", "strict invariants always present");
    assert.equal(env.CHAPTERFLOW_ENFORCE_SESSION_INDEPENDENCE, "1");
    assert.ok(env.PATH, "PATH is allowlisted through");
  } finally {
    for (const [k, v] of Object.entries(saved)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; }
  }
});

test("a real spawn without a role fails closed (no ambient role-less execution)", async () => {
  await assert.rejects(
    spawnCodexAgent({ task: "x", sessionId: "no-role", cwd: PIPELINE_DIR }),
    (err: Error) => err instanceof ExecPreflightError && /requires a declared agent role/.test(err.message),
  );
});

test("manifest persistence cannot be suppressed for a real spawn (unprovable envelope)", async () => {
  await assert.rejects(
    spawnCodexAgent({ task: "x", sessionId: "no-sink", cwd: PIPELINE_DIR, role: "chapter-reviewer", manifestSink: null }),
    (err: Error) => err instanceof ExecPreflightError && /unprovable envelope/.test(err.message),
  );
});

test("a sandbox outside the role profile fails closed", async () => {
  await assert.rejects(
    hermeticSpawn({ sandbox: "workspace-write" }), // chapter-reviewer allows read-only only
    (err: Error) => err instanceof ExecPreflightError && /does not allow sandbox/.test(err.message),
  );
});

test("a CLI missing a required isolation flag fails closed before any process", async () => {
  const captured: Captured = { args: null };
  const badQual = {
    schema: "codex-cli-qualification-v1" as const,
    binPath: "codex", binSize: 0, binMtimeMs: 0, version: "0.1-stripped",
    flags: { "--sandbox": true, "-c": true, "--ignore-user-config": false, "--ignore-rules": true, "--output-last-message": true },
    probedAtIso: new Date().toISOString(), synthetic: true,
  };
  await assert.rejects(
    hermeticSpawn({ qualification: badQual }, captured),
    (err: Error) => err instanceof ExecPreflightError && /--ignore-user-config/.test(err.message),
  );
  assert.equal(captured.args, null, "the runner must never have been invoked");
});

function readManifest(sink: string): EffectiveContextManifestV1 {
  const file = readdirSync(sink).find((f) => f.endsWith(".manifest.json"));
  assert.ok(file, "manifest must be persisted before spawn");
  return JSON.parse(readFileSync(join(sink, file!), "utf8")) as EffectiveContextManifestV1;
}

test("the effective-context manifest is persisted, schema-valid, task-redacted, and secret-free", async () => {
  const { sink } = await hermeticSpawn({ env: { CHAPTERFLOW_CALLER_INTENT: "yes" } });
  const manifest = readManifest(sink);
  assert.deepEqual(validateEffectiveContextManifest(manifest), []);
  assert.equal(manifest.role, "chapter-reviewer");
  assert.ok(manifest.argv[manifest.argv.length - 1].startsWith("<task-sha256:"), "task bytes never inlined in the manifest argv");
  assert.ok(manifest.envKeys.includes("CHAPTERFLOW_SESSION_ID"));
  assert.deepEqual(manifest.callerEnvKeys, ["CHAPTERFLOW_CALLER_INTENT"]);
  assert.equal(JSON.stringify(manifest).includes("sk-secret"), false, "no secret values anywhere in the manifest");
  assert.equal(manifest.qualification.synthetic, true, "injected-runner qualification is marked synthetic");
  // The stale v21 instruction chain is RECORDED as evidence and marked neutralized.
  const pipelineAgentsMd = resolve(PIPELINE_DIR, "AGENTS.md");
  const recorded = manifest.instructionSources.find((s) => s.path === pipelineAgentsMd);
  assert.ok(recorded, "pipeline AGENTS.md must be recorded in the instruction chain");
  assert.equal(recorded!.neutralized, true);
  assert.equal(recorded!.sha256.length, 64);
  // Result sidecar exists and names the finalMessage channel.
  const resultFile = readdirSync(sink).find((f) => f.endsWith(".result.json"));
  assert.ok(resultFile, "result sidecar must be written after the run");
  const result = JSON.parse(readFileSync(join(sink, resultFile!), "utf8"));
  assert.equal(result.schema, "exec-result-v1");
  assert.equal(result.finalMessageSource, "stdout-fallback");
});

test("the per-spawn isolated home is removed after the run (auth material never lingers)", async () => {
  const captured: Captured = { args: null };
  await hermeticSpawn({}, captured);
  const home = String(captured.args!.env.CODEX_HOME);
  assert.ok(home.length > 0);
  assert.equal(existsSync(home), false, "isolated CODEX_HOME must be cleaned up after the spawn");
});

test("identical inputs produce an identical envelope (reproducibility modulo per-spawn paths)", async () => {
  const a = await hermeticSpawn();
  const b = await hermeticSpawn();
  const ma = readManifest(a.sink);
  const mb = readManifest(b.sink);
  assert.equal(ma.profileHash, mb.profileHash);
  assert.equal(ma.taskSha256, mb.taskSha256);
  const norm = (m: EffectiveContextManifestV1) => m.argv.map((x, i) => (m.argv[i - 1] === "--output-last-message" ? "<capture>" : x));
  assert.deepEqual(norm(ma), norm(mb));
  assert.deepEqual(ma.envKeys, mb.envKeys);
});

test("buildIsolatedSession copies auth material when present and fails closed when required-but-missing", () => {
  const withAuth = freshDir("auth-src");
  mkdirSync(withAuth, { recursive: true });
  writeFileSync(join(withAuth, "auth.json"), JSON.stringify({ auth_mode: "chatgpt", OPENAI_API_KEY: null, tokens: { id_token: "fixture" } }));
  const s = buildIsolatedSession({ baseDir: freshDir("auth-base"), requireAuth: true, authSourceDir: withAuth });
  assert.equal(s.authMaterial, "auth.json");
  assert.ok(existsSync(join(s.codexHomeDir, "auth.json")));
  assert.deepEqual(s.authProof, { authMode: "chatgpt", apiKeyPresent: false, source: "auth.json" }, "a real session carries the subscription-auth proof");
  s.cleanup();
  assert.equal(existsSync(s.sessionDir), false);

  const empty = freshDir("auth-empty");
  assert.throws(
    () => buildIsolatedSession({ baseDir: freshDir("auth-base2"), requireAuth: true, authSourceDir: empty }),
    (err: Error) => err instanceof ExecPreflightError && /auth material/.test(err.message),
  );
});

// §16 route-invariant directive (2026-07-11): only ChatGPT-subscription OAuth
// may execute model work. API-key auth material, a missing auth mode, or a
// usable key beside chatgpt mode must all fail BEFORE any process starts —
// and the failure must clean up the session dir that held the copied material.
test("buildIsolatedSession fails closed on non-ChatGPT auth material (metered API is unrepresentable)", () => {
  const attempt = (contents: string, label: string): void => {
    const src = freshDir(`auth-bad-src-${label}`);
    mkdirSync(src, { recursive: true });
    writeFileSync(join(src, "auth.json"), contents);
    const base = freshDir(`auth-bad-base-${label}`);
    assert.throws(
      () => buildIsolatedSession({ baseDir: base, requireAuth: true, authSourceDir: src }),
      (err: Error) => err instanceof ExecPreflightError,
      `${label} must throw ExecPreflightError`,
    );
    assert.equal(readdirSync(base).length, 0, `${label}: the rejected session dir (holding copied auth material) must be removed`);
  };
  attempt(JSON.stringify({ auth_mode: "apikey", OPENAI_API_KEY: "sk-fixture" }), "api-key-mode");
  attempt(JSON.stringify({ tokens: { id_token: "fixture" } }), "missing-auth-mode");
  attempt(JSON.stringify({ auth_mode: "chatgpt", OPENAI_API_KEY: "sk-fixture", tokens: { id_token: "x" } }), "key-beside-chatgpt");
  attempt(JSON.stringify({ auth_mode: "chatgpt", OPENAI_API_KEY: null }), "no-oauth-tokens");
  attempt("not json", "unparseable");

  // The injected-runner test seam (requireAuth: false) still accepts arbitrary
  // fixtures — it never reaches a provider, and it carries NO auth proof.
  const src = freshDir("auth-legacy-fixture");
  mkdirSync(src, { recursive: true });
  writeFileSync(join(src, "auth.json"), "{\"token\":\"fixture\"}");
  const s = buildIsolatedSession({ baseDir: freshDir("auth-legacy-base"), requireAuth: false, authSourceDir: src });
  assert.equal(s.authProof, undefined);
  s.cleanup();
});

test("buildHermeticEnv refuses forbidden provider variables even when caller-injected", () => {
  const { profile } = resolveExecutionProfile("chapter-reviewer");
  for (const name of ["OPENAI_API_KEY", "CODEX_API_KEY", "OPENAI_BASE_URL", "ANTHROPIC_API_KEY"]) {
    assert.throws(
      () => buildHermeticEnv({ profile, codexHomeDir: "/iso/home", sessionId: "sid-x", callerEnv: { [name]: "v" }, baseEnv: { PATH: "/bin" } }),
      (err: Error) => err instanceof ExecPreflightError && err.message.includes(name),
      `${name} must be refused at the caller-env seam`,
    );
  }
  // …and none of them pass through from the parent env either (not allowlisted).
  const { env } = buildHermeticEnv({
    profile, codexHomeDir: "/iso/home", sessionId: "sid-y",
    baseEnv: { PATH: "/bin", OPENAI_API_KEY: "sk-parent", OPENAI_BASE_URL: "https://elsewhere" },
  });
  assert.equal(env.OPENAI_API_KEY, undefined);
  assert.equal(env.OPENAI_BASE_URL, undefined);
});

test("buildHermeticEnv starts from an empty base — nothing outside the allowlist survives", () => {
  const { profile } = resolveExecutionProfile("chapter-reviewer");
  const { env, envKeys, callerEnvKeys } = buildHermeticEnv({
    profile,
    codexHomeDir: "/iso/home",
    sessionId: "sid-1",
    callerEnv: { CHAPTERFLOW_X: "1" },
    baseEnv: { PATH: "/bin", SECRET_TOKEN: "leak-me", HOME: "/Users/nobody" },
  });
  assert.equal(env.SECRET_TOKEN, undefined);
  assert.equal(env.PATH, "/bin");
  assert.equal(env.HOME, "/Users/nobody");
  assert.equal(env.CODEX_HOME, "/iso/home");
  assert.equal(env.CHAPTERFLOW_SESSION_ID, "sid-1");
  assert.deepEqual(callerEnvKeys, ["CHAPTERFLOW_X"]);
  assert.ok(envKeys.includes("CHAPTERFLOW_NO_API_CODEX_QC"));
});

test("discoverInstructionChain records the stale AGENTS.md chain for the pipeline cwd", () => {
  const chain = discoverInstructionChain(PIPELINE_DIR, true);
  assert.ok(chain.length >= 1, "the pipeline AGENTS.md must be discovered");
  for (const src of chain) {
    assert.equal(src.neutralized, true);
    assert.equal(src.sha256.length, 64);
    assert.ok(src.path.endsWith("AGENTS.md"));
  }
});
