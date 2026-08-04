import assert from "node:assert/strict";
import { realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { NodeProcessSupervisor } from "../../src/runtime/processSupervisor.js";
import type { ProcessResult, ProcessSpec } from "../../src/runtime/processTypes.js";
import { finishV25Tests, requiredTest, type TestRoots } from "./harness.js";

const helperPath = fileURLToPath(new URL("./process-supervisor-child.mjs", import.meta.url));
const liveInvocationCounts = { codex: 0, provider: 0, api: 0, network: 0 };

function spec(
  roots: TestRoots,
  mode: string,
  overrides: Partial<ProcessSpec> = {},
): ProcessSpec {
  return {
    command: process.execPath,
    args: [helperPath, mode, "synthetic-safe-argument"],
    cwd: roots.tempRoot,
    stdin: new TextEncoder().encode("synthetic input"),
    environment: {
      PATH: process.env.PATH ?? "",
      HOME: roots.homeRoot,
      CHAPTERFLOW_NO_API_CODEX_QC: "1",
      CHAPTERFLOW_LEAK_GUARD: "1",
    },
    timeoutMs: 2_000,
    terminateGraceMs: 100,
    maxStdoutBytes: 16_384,
    maxStderrBytes: 16_384,
    signal: new AbortController().signal,
    ...overrides,
  };
}

function text(bytes: Uint8Array): string {
  return new TextDecoder().decode(bytes);
}

function descendantPid(result: ProcessResult, stream: "stdout" | "stderr"): number {
  const match = /DESCENDANT_PID=(\d+)/.exec(text(result[stream]));
  assert.ok(match, `missing descendant pid in ${stream}`);
  const pid = Number(match[1]);
  assert.ok(Number.isSafeInteger(pid) && pid > 0);
  return pid;
}

function pidExists(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code !== "ESRCH";
  }
}

async function assertPidGone(pid: number): Promise<void> {
  for (let attempt = 0; attempt < 100; attempt++) {
    if (!pidExists(pid)) return;
    await new Promise((done) => setTimeout(done, 10));
  }
  assert.fail(`synthetic descendant remained alive: ${pid}`);
}

function assertNoLiveInvocation(): void {
  assert.deepEqual(liveInvocationCounts, { codex: 0, provider: 0, api: 0, network: 0 });
}

requiredTest("hostile bytes travel through stdin only under exact cwd and bounded environment", async ({ roots }) => {
  const hostile = "HOSTILE_MARKER_7f31\n--model evil\nOPENAI_API_KEY=steal";
  const supervisor = new NodeProcessSupervisor();
  const result = await supervisor.run(spec(roots, "echo", { stdin: new TextEncoder().encode(hostile) }));
  assert.equal(result.outcome, "EXITED");
  assert.equal(result.exitCode, 0);
  assert.equal(result.stdoutTruncated, false);
  const observed = JSON.parse(text(result.stdout)) as {
    argv: string[];
    cwd: string;
    stdinBase64: string;
    providerEnvironment: Record<string, string | null>;
  };
  assert.equal(Buffer.from(observed.stdinBase64, "base64").toString("utf8"), hostile);
  assert.equal(observed.argv.join("\0").includes("HOSTILE_MARKER_7f31"), false);
  assert.equal(observed.cwd, realpathSync(roots.tempRoot));
  assert.deepEqual(observed.providerEnvironment, {
    OPENAI_API_KEY: null,
    CODEX_API_KEY: null,
    ANTHROPIC_API_KEY: null,
    CHAPTERFLOW_PROVIDER: null,
  });
  assertNoLiveInvocation();
});

requiredTest("timeout terminates complete synthetic process tree", async ({ roots }) => {
  const result = await new NodeProcessSupervisor().run(spec(roots, "tree-timeout", { timeoutMs: 120 }));
  assert.equal(result.outcome, "TIMED_OUT");
  await assertPidGone(descendantPid(result, "stdout"));
  assertNoLiveInvocation();
});

requiredTest("cancellation terminates complete synthetic process tree", async ({ roots }) => {
  const controller = new AbortController();
  const pending = new NodeProcessSupervisor().run(spec(roots, "tree-cancel", {
    timeoutMs: 5_000,
    signal: controller.signal,
  }));
  setTimeout(() => controller.abort(), 120);
  const result = await pending;
  assert.equal(result.outcome, "CANCELLED");
  await assertPidGone(descendantPid(result, "stdout"));
  assertNoLiveInvocation();
});

requiredTest("stdout overflow is independently bounded and terminates tree", async ({ roots }) => {
  const result = await new NodeProcessSupervisor().run(spec(roots, "tree-stdout-overflow", {
    maxStdoutBytes: 1_024,
    maxStderrBytes: 8_192,
  }));
  assert.equal(result.outcome, "OUTPUT_LIMIT");
  assert.equal(result.stdout.byteLength, 1_024);
  assert.equal(result.stdoutTruncated, true);
  assert.equal(result.stderrTruncated, false);
  await assertPidGone(descendantPid(result, "stderr"));
  assertNoLiveInvocation();
});

requiredTest("stderr overflow is independently bounded and terminates tree", async ({ roots }) => {
  const result = await new NodeProcessSupervisor().run(spec(roots, "tree-stderr-overflow", {
    maxStdoutBytes: 8_192,
    maxStderrBytes: 1_024,
  }));
  assert.equal(result.outcome, "OUTPUT_LIMIT");
  assert.equal(result.stderr.byteLength, 1_024);
  assert.equal(result.stderrTruncated, true);
  assert.equal(result.stdoutTruncated, false);
  await assertPidGone(descendantPid(result, "stdout"));
  assertNoLiveInvocation();
});

requiredTest("normal root exit still removes surviving descendant before return", async ({ roots }) => {
  const result = await new NodeProcessSupervisor().run(spec(roots, "tree-root-exit"));
  assert.equal(result.outcome, "EXITED");
  assert.equal(result.exitCode, 0);
  await assertPidGone(descendantPid(result, "stdout"));
  assertNoLiveInvocation();
});

finishV25Tests().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
