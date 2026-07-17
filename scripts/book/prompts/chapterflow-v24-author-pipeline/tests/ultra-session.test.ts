/**
 * WP-E21 — ultraSession: envelope-proven GPT-5.6 Sol @ ultra rater route.
 *
 * Every test is model-free: the `codex exec` path is exercised ONLY through an
 * injected runner double. Two doubles THROW if invoked (proving the refusal
 * paths never reach a process); the rest capture argv/env or answer with a
 * fixture reply. No real codex binary is ever spawned.
 *
 * Proven here:
 *  - resolveD7RaterRoute is the single authority (BASELINE_MODEL @ "ultra");
 *  - the manifest argv carries `-c model_reasoning_effort=ultra` (the effort
 *    union is NOT extended — it flows through the string argv layer);
 *  - the returned model/effort are read BACK from the persisted manifest bytes;
 *  - manifestSha256 is over those exact bytes; the reply is preserved on failure;
 *  - the acceptance probe accepts a clean run and fail-closes on a CLI rejection;
 *  - a metered/absent auth source refuses to spawn (the runner is never reached).
 */

import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { test } from "./harness.js";
import { sha256Hex } from "../src/contracts/contractUtil.js";
import { BASELINE_MODEL, resolveD7RaterRoute } from "../src/orchestrator/modelPolicy.js";
import type { CodexRunner, CodexRunnerArgs } from "../src/orchestrator/codexAgent.js";
import {
  ULTRA_EFFORT,
  runUltraAcceptanceProbe,
  runUltraSession,
  type UltraRouteV1,
  type UltraSessionRequestV1,
} from "../src/exec/ultraSession.js";

let seq = 0;
function freshDir(label: string): string {
  return mkdtempSync(join(tmpdir(), `ultra-session-${label}-${process.pid}-${seq++}-`));
}

function writeAuth(dir: string, contents: unknown): string {
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "auth.json"), typeof contents === "string" ? contents : JSON.stringify(contents));
  return dir;
}
function chatgptAuthDir(label: string): string {
  return writeAuth(freshDir(label), { auth_mode: "chatgpt", OPENAI_API_KEY: null, tokens: { id_token: "fixture" } });
}

function writePrompt(dir: string, text = "Rate this chapter. Return your score."): string {
  const p = join(dir, "prompt.txt");
  writeFileSync(p, text);
  return p;
}

function lastMessagePathOf(argv: string[]): string | null {
  const i = argv.indexOf("--output-last-message");
  return i >= 0 && i + 1 < argv.length ? argv[i + 1]! : null;
}

type Capture = { args: CodexRunnerArgs | null };

/** A runner double: captures argv/env, optionally writes the capture file the
 *  envelope points at (via --output-last-message), returns a fixed exit. */
function replyRunner(opts: { reply?: string; code?: number; stderr?: string; capture?: Capture }): CodexRunner {
  return async (args: CodexRunnerArgs) => {
    if (opts.capture) opts.capture.args = args;
    const lm = lastMessagePathOf(args.argv);
    if (opts.reply !== undefined && lm) writeFileSync(lm, opts.reply);
    return { stdout: opts.reply ?? "", stderr: opts.stderr ?? "", code: opts.code ?? 0 };
  };
}

/** A runner double that fails the test the instant it is invoked — proves a
 *  refusal path never reaches a process. */
const throwIfInvoked: CodexRunner = () => {
  throw new Error("MODEL CALL LEAK: the ultra session reached a runner it must not have");
};

function baseReq(dir: string, over: Partial<UltraSessionRequestV1> = {}): UltraSessionRequestV1 {
  return {
    role: "d7-rater",
    promptPath: writePrompt(dir),
    cwd: dir,
    timeoutMs: 60_000,
    sessionTag: "stage1-nudge-ch03",
    bookId: "chapterdiag--nudge",
    runId: "run-0001",
    ...over,
  };
}

// ── (1) resolveD7RaterRoute is the single authority ──────────────────────────

test("WP-E21 route: resolveD7RaterRoute returns BASELINE_MODEL @ ultra (the ONE authority)", () => {
  const route = resolveD7RaterRoute();
  assert.equal(route.model, BASELINE_MODEL, "D7 rater model tracks the provisional 5.6 default");
  assert.equal(route.effort, ULTRA_EFFORT, "effort is the ultra token");
  assert.equal(route.effort, "ultra");
});

// ── (2) manifest argv carries the ultra override; result reads it back ────────

test("WP-E21 manifest: argv contains -c model_reasoning_effort=ultra and resolved model/effort come FROM the manifest", async () => {
  const dir = freshDir("argv");
  const capture: Capture = { args: null };
  const result = await runUltraSession(baseReq(dir), {
    runner: replyRunner({ reply: "SCORE: 84", capture }),
    execBaseDir: freshDir("argv-base"),
    manifestSink: freshDir("argv-sink"),
    authSourceDir: chatgptAuthDir("argv-auth"),
  });

  assert.ok(capture.args, "the injected runner (a double) was the spawn path — no real process");
  const argv = capture.args!.argv;
  const effIdx = argv.indexOf("model_reasoning_effort=ultra");
  assert.ok(effIdx > 0, "argv carries model_reasoning_effort=ultra");
  assert.equal(argv[effIdx - 1], "-c", "the ultra effort is a `-c` config override, not a native flag");
  assert.ok(argv.includes(`model=${BASELINE_MODEL}`), "argv pins the resolved model via -c model=");

  // The result's model/effort are READ BACK from the persisted manifest bytes.
  assert.equal(result.effort, "ultra");
  assert.equal(result.model, BASELINE_MODEL);
  const manifestBytes = readFileSync(result.manifestPath);
  assert.equal(result.manifestSha256, sha256Hex(manifestBytes), "manifestSha256 is over the exact persisted bytes");
  const manifest = JSON.parse(manifestBytes.toString("utf8"));
  assert.equal(manifest.reasoningEffort, "ultra", "the manifest itself records the ultra effort");
  assert.equal(manifest.model, BASELINE_MODEL);
  assert.equal(result.model, manifest.model, "result.model is the manifest value, not the request");
  assert.equal(result.effort, manifest.reasoningEffort);
  // argv is recorded in the manifest with the task hash-replaced (never inlined).
  assert.ok((manifest.argv as string[]).includes("model_reasoning_effort=ultra"), "the persisted manifest argv proves the ultra override");
  assert.ok(result.ok, "exit 0 → ok");
  assert.equal(result.outcome, "content_completed");

  // Requirement 4: API-key env is stripped; the child env is the isolated home.
  assert.equal(capture.args!.env.OPENAI_API_KEY, undefined, "no metered-API key reaches the child env");
  assert.ok(String(capture.args!.env.CODEX_HOME).includes("codex-home"), "child uses the isolated per-spawn CODEX_HOME");
});

// ── (3) reply preserved on failure too ───────────────────────────────────────

test("WP-E21 reply: a non-zero exit still preserves the reply artifact and classifies fail (not ok)", async () => {
  const dir = freshDir("fail");
  const result = await runUltraSession(baseReq(dir, { role: "d7-adjudicator" }), {
    runner: replyRunner({ reply: "partial verdict before crash", code: 1, stderr: "boom" }),
    execBaseDir: freshDir("fail-base"),
    manifestSink: freshDir("fail-sink"),
    authSourceDir: chatgptAuthDir("fail-auth"),
  });
  assert.equal(result.ok, false, "non-zero exit is not ok");
  assert.ok(result.replyPath, "the reply is preserved on failure too");
  assert.ok(existsSync(result.replyPath!), "the preserved reply file exists on disk");
  assert.equal(readFileSync(result.replyPath!, "utf8"), "partial verdict before crash");
  assert.ok(result.failure && /exited 1/.test(result.failure), "failure detail names the exit");
  // exit != 0 with no rate markers → infrastructure_failure (frozen taxonomy).
  assert.equal(result.outcome, "infrastructure_failure");
});

// ── (4) injected double proves NO real spawn (a throwing runner surfaces) ─────

test("WP-E21 injection: the injected runner IS the only spawn path (its error surfaces, no real codex)", async () => {
  const dir = freshDir("inject");
  const sentinel: CodexRunner = () => {
    throw new Error("SENTINEL: injected runner used — no real codex was spawned");
  };
  const result = await runUltraSession(baseReq(dir), {
    runner: sentinel,
    execBaseDir: freshDir("inject-base"),
    manifestSink: freshDir("inject-sink"),
    authSourceDir: chatgptAuthDir("inject-auth"),
  });
  assert.equal(result.ok, false);
  assert.ok(result.failure && /SENTINEL/.test(result.failure), "the runner double's error is what surfaced");
  assert.equal(result.outcome, "infrastructure_failure");
  // The manifest was still persisted BEFORE the (double) spawn — proof survives a throw.
  assert.ok(existsSync(result.manifestPath), "the effective-context manifest persists even when the runner throws");
});

// ── (5) auth refusal — a metered/absent auth source refuses BEFORE any spawn ──

test("WP-E21 auth: a metered API-key auth source refuses to spawn (the runner is never reached)", async () => {
  const dir = freshDir("auth-apikey");
  const badAuth = writeAuth(freshDir("apikey-src"), { auth_mode: "apikey", OPENAI_API_KEY: "sk-should-never-run" });
  await assert.rejects(
    () => runUltraSession(baseReq(dir), {
      runner: throwIfInvoked, // never reached: auth is proven inside buildIsolatedSession
      requireAuth: true,
      execBaseDir: freshDir("auth-apikey-base"),
      manifestSink: freshDir("auth-apikey-sink"),
      authSourceDir: badAuth,
    }),
    (e: unknown) => e instanceof Error && /auth_mode|ChatGPT-subscription|refusing to spawn/i.test((e as Error).message),
    "metered-key auth material must fail closed before any process",
  );
});

test("WP-E21 auth: an absent auth source refuses to spawn when auth is required", async () => {
  const dir = freshDir("auth-absent");
  await assert.rejects(
    () => runUltraSession(baseReq(dir), {
      runner: throwIfInvoked,
      requireAuth: true,
      execBaseDir: freshDir("auth-absent-base"),
      manifestSink: freshDir("auth-absent-sink"),
      authSourceDir: freshDir("auth-absent-src"), // exists but empty (no auth.json)
    }),
    (e: unknown) => e instanceof Error && /no codex auth material|refusing/i.test((e as Error).message),
  );
});

// ── (6) acceptance probe — accepted path ─────────────────────────────────────

test("WP-E21 probe: a clean schema-bound run → accepted:true; sidecar persisted with a content sha", async () => {
  const probeDir = freshDir("probe-ok");
  const probe = await runUltraAcceptanceProbe(
    { route: resolveD7RaterRoute(), probeDir },
    {
      runner: replyRunner({ reply: '{"ok":true}', code: 0 }),
      execBaseDir: freshDir("probe-ok-base"),
      authSourceDir: chatgptAuthDir("probe-ok-auth"),
    },
  );
  assert.equal(probe.accepted, true, probe.detail);
  assert.equal(probe.effort, "ultra");
  assert.equal(probe.model, BASELINE_MODEL);
  assert.match(probe.detail, /model_reasoning_effort=ultra/);
  assert.ok(probe.manifestPath && existsSync(probe.manifestPath), "the probe's own manifest is persisted");
  assert.ok(existsSync(probe.sidecarPath), "the sidecar is persisted atomically");
  const onDisk = JSON.parse(readFileSync(probe.sidecarPath, "utf8"));
  assert.equal(onDisk.accepted, true);
  assert.equal(onDisk.sidecarSha256, probe.sidecarSha256, "the persisted sidecar carries the content fingerprint");
});

// ── (7) acceptance probe — rejected path fails closed (parse stderr/exit) ─────

test("WP-E21 probe: a CLI rejection of the ultra token → accepted:false (fail closed), sidecar still written", async () => {
  const probeDir = freshDir("probe-reject");
  const probe = await runUltraAcceptanceProbe(
    { route: resolveD7RaterRoute(), probeDir },
    {
      runner: replyRunner({
        reply: "",
        code: 2,
        stderr: "error: invalid value 'ultra' for '-c model_reasoning_effort=<VALUE>'",
      }),
      execBaseDir: freshDir("probe-reject-base"),
      authSourceDir: chatgptAuthDir("probe-reject-auth"),
    },
  );
  assert.equal(probe.accepted, false, "any non-acceptance fails closed");
  assert.match(probe.detail, /rejected the ultra reasoning-effort token|ultra/i);
  assert.ok(existsSync(probe.sidecarPath), "the sidecar is written even on rejection (campaign reads accepted:false)");
});

test("WP-E21 probe: a preflight auth refusal → accepted:false with a manifestless sidecar", async () => {
  const probeDir = freshDir("probe-auth");
  const badAuth = writeAuth(freshDir("probe-auth-src"), { auth_mode: "apikey", OPENAI_API_KEY: "sk-x" });
  const probe = await runUltraAcceptanceProbe(
    { route: resolveD7RaterRoute(), probeDir },
    {
      runner: throwIfInvoked,
      requireAuth: true,
      execBaseDir: freshDir("probe-auth-base"),
      authSourceDir: badAuth,
    },
  );
  assert.equal(probe.accepted, false);
  assert.equal(probe.manifestPath, null, "no spawn happened → no manifest");
  assert.match(probe.detail, /refused before spawn/);
  assert.ok(existsSync(probe.sidecarPath));
});

// ── (8) probe refuses a non-authority route ──────────────────────────────────

test("WP-E21 probe: refuses a non-ultra route (cannot pass off another effort as ultra acceptance)", async () => {
  const probeDir = freshDir("probe-badroute");
  const notUltra = { model: BASELINE_MODEL, effort: "high" } as unknown as UltraRouteV1;
  await assert.rejects(
    () => runUltraAcceptanceProbe({ route: notUltra, probeDir }, { runner: throwIfInvoked, authSourceDir: chatgptAuthDir("probe-badroute-auth") }),
    (e: unknown) => e instanceof Error && /requires the ultra route/i.test((e as Error).message),
  );
});
