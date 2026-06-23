import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { test } from "./harness.js";
import { TMP_DIR } from "./helpers.js";
import { ClaudeCliProvider } from "../src/providers/cli.js";
import { extractJson } from "../src/providers/types.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PIPELINE_DIR = resolve(__dirname, "..");
const PROVIDER_NODE_MODULES = resolve(PIPELINE_DIR, "src", "providers", "node_modules");
const FAKE_OPENAI_DIR = resolve(PROVIDER_NODE_MODULES, "openai");
const FAKE_ANTHROPIC_DIR = resolve(PROVIDER_NODE_MODULES, "@anthropic-ai", "sdk");

function resetTmp(): void {
  rmSync(resolve(TMP_DIR, "provider-contract"), { recursive: true, force: true });
  mkdirSync(resolve(TMP_DIR, "provider-contract"), { recursive: true });
}

function cleanupFakeSdks(): void {
  rmSync(FAKE_OPENAI_DIR, { recursive: true, force: true });
  rmSync(FAKE_ANTHROPIC_DIR, { recursive: true, force: true });
  rmSync(resolve(PROVIDER_NODE_MODULES, "@anthropic-ai"), { recursive: true, force: true });
  try {
    rmSync(PROVIDER_NODE_MODULES, { recursive: false });
  } catch {
    // Leave provider-local node_modules alone if another test ever adds content.
  }
}

function installFakeSdks(mode: "normal" | "throw-import" | "openai-hang" | "malformed-once" | "malformed-twice" = "normal"): void {
  cleanupFakeSdks();
  mkdirSync(FAKE_OPENAI_DIR, { recursive: true });
  mkdirSync(FAKE_ANTHROPIC_DIR, { recursive: true });
  writeFileSync(resolve(FAKE_OPENAI_DIR, "package.json"), JSON.stringify({ name: "openai", main: "index.cjs" }), "utf8");
  writeFileSync(resolve(FAKE_ANTHROPIC_DIR, "package.json"), JSON.stringify({ name: "@anthropic-ai/sdk", main: "index.cjs" }), "utf8");
  writeFileSync(
    resolve(FAKE_OPENAI_DIR, "index.cjs"),
    `
const fs = require("node:fs");
function marker(line) {
  if (process.env.CHAPTERFLOW_FAKE_SDK_MARKER) fs.appendFileSync(process.env.CHAPTERFLOW_FAKE_SDK_MARKER, line + "\\n");
}
function nextCall() {
  const p = process.env.CHAPTERFLOW_FAKE_SDK_CALLS;
  if (!p) return 1;
  let n = 0;
  try { n = Number(fs.readFileSync(p, "utf8")) || 0; } catch {}
  fs.writeFileSync(p, String(n + 1));
  return n + 1;
}
marker("openai:import");
if (process.env.CHAPTERFLOW_FAKE_SDK_MODE === "throw-import") throw new Error("openai sdk unavailable");
class OpenAI {
  constructor(options) {
    marker("openai:construct:" + JSON.stringify({ maxRetries: options && options.maxRetries }));
    this.chat = { completions: { create: (request, options = {}) => {
      const call = nextCall();
      marker("openai:create:" + JSON.stringify({ call, hasSignal: !!options.signal, responseFormat: request.response_format, messages: request.messages }));
      const mode = process.env.CHAPTERFLOW_FAKE_SDK_MODE;
      if (mode === "openai-hang") {
        return new Promise((_resolve, reject) => {
          if (options.signal) options.signal.addEventListener("abort", () => {
            marker("openai:aborted");
            const err = new Error("aborted by fake sdk");
            err.name = "AbortError";
            reject(err);
          }, { once: true });
        });
      }
      let content = "openai ok";
      if (mode === "malformed-once") content = call === 1 ? "first response { not valid json" : "repair prose {\\\"ok\\\":true}";
      if (mode === "malformed-twice") content = call === 1 ? "first response { not valid json" : "still broken { nope";
      return Promise.resolve({
        choices: [{ message: { content } }],
        usage: { prompt_tokens: 11, completion_tokens: 7 }
      });
    } } };
  }
}
module.exports = OpenAI;
module.exports.default = OpenAI;
`,
    "utf8",
  );
  writeFileSync(
    resolve(FAKE_ANTHROPIC_DIR, "index.cjs"),
    `
const fs = require("node:fs");
function marker(line) {
  if (process.env.CHAPTERFLOW_FAKE_SDK_MARKER) fs.appendFileSync(process.env.CHAPTERFLOW_FAKE_SDK_MARKER, line + "\\n");
}
marker("anthropic:import");
if (process.env.CHAPTERFLOW_FAKE_SDK_MODE === "throw-import") throw new Error("anthropic sdk unavailable");
class Anthropic {
  constructor(options) {
    marker("anthropic:construct:" + JSON.stringify({ maxRetries: options && options.maxRetries }));
    this.messages = { create: (request, options = {}) => {
      marker("anthropic:create:" + JSON.stringify({ hasSignal: !!options.signal, messages: request.messages, system: request.system }));
      return Promise.resolve({
        content: [{ type: "text", text: "anthropic ok" }],
        usage: { input_tokens: 13, output_tokens: 5, cache_read_input_tokens: 2, cache_creation_input_tokens: 3 }
      });
    } };
  }
}
module.exports = Anthropic;
module.exports.default = Anthropic;
`,
    "utf8",
  );
  process.env.CHAPTERFLOW_FAKE_SDK_MODE = mode;
}

function runNode(script: string, env: Record<string, string | undefined> = {}, timeoutMs = 2_000): string {
  const childEnv: Record<string, string | undefined> = {
    ...process.env,
    CHAPTERFLOW_NO_API_CODEX_QC: undefined,
    ...env,
  };
  for (const [key, value] of Object.entries(childEnv)) {
    if (value === undefined) delete childEnv[key];
  }
  return execFileSync(process.execPath, ["--import", "tsx", "-e", script], {
    cwd: PIPELINE_DIR,
    env: childEnv as NodeJS.ProcessEnv,
    encoding: "utf8",
    timeout: timeoutMs,
    stdio: ["ignore", "pipe", "pipe"],
  });
}

function writeFakeClaude(mode: "ok" | "hang-child" | "huge-error", recordPath: string): string {
  const dir = resolve(TMP_DIR, "provider-contract");
  mkdirSync(dir, { recursive: true });
  const bin = resolve(dir, `fake-claude-${mode}.cjs`);
  writeFileSync(
    bin,
    `#!/usr/bin/env node
const fs = require("node:fs");
const cp = require("node:child_process");
const recordPath = ${JSON.stringify(recordPath)};
let stdin = "";
fs.writeFileSync(recordPath, JSON.stringify({ argv: process.argv.slice(2), stdin, pid: process.pid }, null, 2));
process.stdin.setEncoding("utf8");
process.stdin.on("data", (d) => { stdin += d; });
process.stdin.on("end", () => {
  fs.writeFileSync(recordPath, JSON.stringify({ argv: process.argv.slice(2), stdin, pid: process.pid }, null, 2));
  if (${JSON.stringify(mode)} === "hang-child") {
    const child = cp.spawn(process.execPath, ["-e", "setInterval(() => {}, 1000)"], { stdio: "ignore" });
    fs.writeFileSync(recordPath, JSON.stringify({ argv: process.argv.slice(2), stdin, pid: process.pid, childPid: child.pid }, null, 2));
    setInterval(() => {}, 1000);
    return;
  }
  if (${JSON.stringify(mode)} === "huge-error") {
    process.stdout.write("S".repeat(4096));
    process.stderr.write("E".repeat(4096));
    process.exit(7);
  }
  process.stdout.write(JSON.stringify({ result: "cli ok", usage: { input_tokens: 3, output_tokens: 4 } }));
});
`,
    "utf8",
  );
  chmodSync(bin, 0o755);
  return bin;
}

function readLines(path: string): string[] {
  if (!existsSync(path)) return [];
  return readFileSync(path, "utf8").trim().split("\n").filter(Boolean);
}

function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function restoreEnv(snapshot: Record<string, string | undefined>): void {
  for (const [key, value] of Object.entries(snapshot)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

test("deterministic CLI commands do not load optional SDK packages", () => {
  resetTmp();
  installFakeSdks("throw-import");
  try {
    const out = execFileSync(process.execPath, ["--import", "tsx", "src/cli.ts", "book-status", "zz-provider-contract"], {
      cwd: PIPELINE_DIR,
      env: { ...process.env, CHAPTERFLOW_FAKE_SDK_MODE: "throw-import" },
      encoding: "utf8",
      timeout: 2_000,
      stdio: ["ignore", "pipe", "pipe"],
    });
    assert.match(out, /BOOK STATUS/);
  } finally {
    cleanupFakeSdks();
  }
});

test("provider selection imports only the selected adapter", () => {
  resetTmp();
  installFakeSdks("normal");
  const marker = resolve(TMP_DIR, "provider-contract", "sdk-marker.log");
  const calls = resolve(TMP_DIR, "provider-contract", "sdk-calls.txt");
  const cliRecord = resolve(TMP_DIR, "provider-contract", "cli-record.json");
  const fakeClaude = writeFakeClaude("ok", cliRecord);
  const baseEnv = {
    CHAPTERFLOW_FAKE_SDK_MARKER: marker,
    CHAPTERFLOW_FAKE_SDK_CALLS: calls,
    OPENAI_API_KEY: "sk-test",
    ANTHROPIC_API_KEY: "sk-ant-test",
    CHAPTERFLOW_CLAUDE_BIN: fakeClaude,
    CHAPTERFLOW_CLAUDE_SKIP_AUTH_CHECK: "1",
  };
  try {
    rmSync(marker, { force: true });
    runNode(`const m = await import("./src/providers/router.ts"); const { callModel } = m.callModel ? m : m.default; await callModel({ provider: "openai-api", tier: "critic", system: "s", user: "u", maxTokens: 8, timeoutMs: 1000 });`, baseEnv);
    assert.deepEqual(readLines(marker).filter((l) => l.endsWith(":import")), ["openai:import"]);

    rmSync(marker, { force: true });
    runNode(`const m = await import("./src/providers/router.ts"); const { callModel } = m.callModel ? m : m.default; await callModel({ provider: "anthropic-api", tier: "critic", system: "s", user: "u", maxTokens: 8, timeoutMs: 1000 });`, baseEnv);
    assert.deepEqual(readLines(marker).filter((l) => l.endsWith(":import")), ["anthropic:import"]);

    rmSync(marker, { force: true });
    runNode(`const m = await import("./src/providers/router.ts"); const { callModel } = m.callModel ? m : m.default; await callModel({ provider: "anthropic-cli", tier: "critic", system: "s", user: "u", maxTokens: 8, timeoutMs: 1000 });`, baseEnv);
    assert.deepEqual(readLines(marker).filter((l) => l.endsWith(":import")), []);
  } finally {
    cleanupFakeSdks();
  }
});

test("API provider timeout aborts the SDK request", () => {
  resetTmp();
  installFakeSdks("openai-hang");
  const marker = resolve(TMP_DIR, "provider-contract", "sdk-marker.log");
  const calls = resolve(TMP_DIR, "provider-contract", "sdk-calls.txt");
  try {
    const out = runNode(
      `
const m = await import("./src/providers/router.ts");
const { callModel } = m.callModel ? m : m.default;
try {
  await callModel({ provider: "openai-api", tier: "critic", system: "s", user: "u", maxTokens: 8, timeoutMs: 50 });
  throw new Error("call unexpectedly completed");
} catch (err) {
  console.log(String(err && err.message || err));
}
`,
      { CHAPTERFLOW_FAKE_SDK_MARKER: marker, CHAPTERFLOW_FAKE_SDK_CALLS: calls, OPENAI_API_KEY: "sk-test" },
      800,
    );
    assert.match(out, /timed out after 50ms/);
    assert.ok(readLines(marker).includes("openai:aborted"), "AbortSignal must be passed to and abort the SDK request");
  } finally {
    cleanupFakeSdks();
  }
});

test("CLI provider timeout terminates the child process group", async () => {
  resetTmp();
  const snapshot = {
    CHAPTERFLOW_CLAUDE_BIN: process.env.CHAPTERFLOW_CLAUDE_BIN,
    CHAPTERFLOW_PROVIDER_OUTPUT_LIMIT_BYTES: process.env.CHAPTERFLOW_PROVIDER_OUTPUT_LIMIT_BYTES,
  };
  const recordPath = resolve(TMP_DIR, "provider-contract", "cli-hang-record.json");
  const fakeClaude = writeFakeClaude("hang-child", recordPath);
  process.env.CHAPTERFLOW_CLAUDE_BIN = fakeClaude;
  try {
    await assert.rejects(
      () => ClaudeCliProvider.call({ tier: "critic", system: "s", user: "u", model: "claude-test", timeoutMs: 600 }),
      /timed out after 600ms/,
    );
    await new Promise((resolve) => setTimeout(resolve, 120));
    const record = JSON.parse(readFileSync(recordPath, "utf8")) as { childPid: number };
    const alive = isProcessAlive(record.childPid);
    if (alive) {
      try {
        process.kill(record.childPid, "SIGKILL");
      } catch {}
    }
    assert.equal(alive, false, "timeout cleanup must kill descendants, not only the direct child");
  } finally {
    restoreEnv(snapshot);
  }
});

test("balanced JSON extraction handles objects, arrays, prose, and braces in strings", () => {
  const objectText = `Lead note {not json}. Actual answer: {"text":"keep { and } inside strings","n":1} trailing.`;
  assert.deepEqual(JSON.parse(extractJson(objectText)), { text: "keep { and } inside strings", n: 1 });

  const arrayText = `Lead note. [{"text":"array item with {braces}","ok":true}] trailing.`;
  assert.deepEqual(JSON.parse(extractJson(arrayText)), [{ text: "array item with {braces}", ok: true }]);
});

test("jsonMode performs exactly one bounded repair attempt", () => {
  resetTmp();
  installFakeSdks("malformed-once");
  const marker = resolve(TMP_DIR, "provider-contract", "sdk-marker.log");
  const calls = resolve(TMP_DIR, "provider-contract", "sdk-calls.txt");
  try {
    const out = runNode(
      `
const m = await import("./src/providers/router.ts");
const { callModel } = m.callModel ? m : m.default;
const result = await callModel({ provider: "openai-api", tier: "critic", system: "s", user: "u", jsonMode: true, maxTokens: 32, timeoutMs: 1000 });
console.log(JSON.stringify({ content: result.content, attempts: result.attempts }));
`,
      { CHAPTERFLOW_FAKE_SDK_MARKER: marker, CHAPTERFLOW_FAKE_SDK_CALLS: calls, OPENAI_API_KEY: "sk-test" },
    );
    assert.deepEqual(JSON.parse(out), { content: { ok: true }, attempts: 2 });
    assert.equal(readFileSync(calls, "utf8"), "2");
  } finally {
    cleanupFakeSdks();
  }
});

test("jsonMode fails after the single repair attempt", () => {
  resetTmp();
  installFakeSdks("malformed-twice");
  const marker = resolve(TMP_DIR, "provider-contract", "sdk-marker.log");
  const calls = resolve(TMP_DIR, "provider-contract", "sdk-calls.txt");
  try {
    const out = runNode(
      `
const m = await import("./src/providers/router.ts");
const { callModel } = m.callModel ? m : m.default;
try {
  await callModel({ provider: "openai-api", tier: "critic", system: "s", user: "u", jsonMode: true, maxTokens: 32, timeoutMs: 1000 });
  throw new Error("unexpected success");
} catch (err) {
  console.log(String(err && err.message || err));
}
`,
      { CHAPTERFLOW_FAKE_SDK_MARKER: marker, CHAPTERFLOW_FAKE_SDK_CALLS: calls, OPENAI_API_KEY: "sk-test" },
    );
    assert.match(out, /failed after 1 repair attempt/);
    assert.equal(readFileSync(calls, "utf8"), "2");
  } finally {
    cleanupFakeSdks();
  }
});

test("CLI stdout and stderr capture is bounded with deterministic diagnostics", async () => {
  resetTmp();
  const snapshot = {
    CHAPTERFLOW_CLAUDE_BIN: process.env.CHAPTERFLOW_CLAUDE_BIN,
    CHAPTERFLOW_PROVIDER_OUTPUT_LIMIT_BYTES: process.env.CHAPTERFLOW_PROVIDER_OUTPUT_LIMIT_BYTES,
  };
  const recordPath = resolve(TMP_DIR, "provider-contract", "cli-huge-record.json");
  const fakeClaude = writeFakeClaude("huge-error", recordPath);
  process.env.CHAPTERFLOW_CLAUDE_BIN = fakeClaude;
  process.env.CHAPTERFLOW_PROVIDER_OUTPUT_LIMIT_BYTES = "128";
  try {
    await assert.rejects(
      () => ClaudeCliProvider.call({ tier: "critic", system: "s", user: "u", model: "claude-test", timeoutMs: 1000 }),
      (err: unknown) => {
        const message = String((err as Error).message);
        assert.ok(message.length < 1200, `error message should be bounded, got ${message.length} chars`);
        assert.match(message, /stdout truncated after 128 bytes/);
        assert.match(message, /stderr truncated after 128 bytes/);
        return true;
      },
    );
  } finally {
    restoreEnv(snapshot);
  }
});

test("CLI isConfigured is false when the binary is absent", () => {
  resetTmp();
  const snapshot = {
    CHAPTERFLOW_CLAUDE_BIN: process.env.CHAPTERFLOW_CLAUDE_BIN,
    CHAPTERFLOW_CLAUDE_SKIP_AUTH_CHECK: process.env.CHAPTERFLOW_CLAUDE_SKIP_AUTH_CHECK,
    HOME: process.env.HOME,
    PATH: process.env.PATH,
  };
  try {
    delete process.env.CHAPTERFLOW_CLAUDE_BIN;
    delete process.env.CHAPTERFLOW_CLAUDE_SKIP_AUTH_CHECK;
    process.env.HOME = resolve(TMP_DIR, "provider-contract", "empty-home");
    process.env.PATH = resolve(TMP_DIR, "provider-contract", "empty-path");
    mkdirSync(process.env.HOME, { recursive: true });
    mkdirSync(process.env.PATH, { recursive: true });
    assert.equal(ClaudeCliProvider.isConfigured(), false);
  } finally {
    restoreEnv(snapshot);
  }
});

test("CLI preserves turns and passes no-tools as separated arguments", async () => {
  resetTmp();
  const snapshot = {
    CHAPTERFLOW_CLAUDE_BIN: process.env.CHAPTERFLOW_CLAUDE_BIN,
  };
  const recordPath = resolve(TMP_DIR, "provider-contract", "cli-turns-record.json");
  const fakeClaude = writeFakeClaude("ok", recordPath);
  process.env.CHAPTERFLOW_CLAUDE_BIN = fakeClaude;
  try {
    await ClaudeCliProvider.call({
      tier: "critic",
      system: "main system --not-a-flag",
      model: "claude-test",
      priorTurns: [
        { role: "system", content: "prior system" },
        { role: "user", content: "first user" },
        { role: "assistant", content: "first assistant" },
      ] as any,
      user: "final user",
      timeoutMs: 1000,
    });
    const record = JSON.parse(readFileSync(recordPath, "utf8")) as { argv: string[]; stdin: string };
    const disallowed = record.argv.slice(record.argv.indexOf("--disallowedTools") + 1);
    assert.ok(disallowed.includes("Bash"));
    assert.ok(disallowed.includes("Write"));
    assert.ok(!disallowed.includes("Bash Edit Write Read Glob Grep WebFetch WebSearch Agent"));
    const payload = JSON.parse(record.stdin) as { messages: Array<{ role: string; content: string }> };
    assert.deepEqual(payload.messages, [
      { role: "system", content: "main system --not-a-flag" },
      { role: "system", content: "prior system" },
      { role: "user", content: "first user" },
      { role: "assistant", content: "first assistant" },
      { role: "user", content: "final user" },
    ]);
  } finally {
    restoreEnv(snapshot);
  }
});
