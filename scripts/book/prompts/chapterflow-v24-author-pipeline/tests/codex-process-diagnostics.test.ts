import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { sha256Hex } from "../src/contracts/contractUtil.js";
import {
  CODEX_RUNNER_POST_KILL_GRACE_MS,
  CodexRunnerProcessError,
  defaultCodexRunner,
  spawnCodexAgent,
} from "../src/orchestrator/codexAgent.js";
import {
  CODEX_PROCESS_DIAGNOSTICS_HEAD_BYTES,
  CODEX_PROCESS_DIAGNOSTICS_MAX_RETAINED_BYTES,
  CODEX_PROCESS_DIAGNOSTICS_TAIL_BYTES,
  buildCodexProcessDiagnosticsV1,
  retainBoundedCodexProcessStream,
  validateCodexProcessDiagnosticsV1,
} from "../src/orchestrator/codexProcessDiagnostics.js";
import { test } from "./harness.js";

const REQUEST_SHA = "a".repeat(64);

function nodeRunner(script: string, timeoutMs = 2_000) {
  return defaultCodexRunner({
    bin: process.execPath,
    argv: ["-e", script],
    cwd: process.cwd(),
    env: process.env,
    timeoutMs,
  });
}

test("default Codex runner returns exact stdout/stderr for a nonzero process", async () => {
  const result = await nodeRunner(
    "process.stdout.write('diagnostic stdout'); process.stderr.write('diagnostic stderr'); process.exit(7)",
  );
  assert.deepEqual(result, {
    stdout: "diagnostic stdout",
    stderr: "diagnostic stderr",
    code: 7,
  });
});

test("default Codex runner decodes UTF-8 code points split across process chunks exactly once", async () => {
  const result = await nodeRunner(
    "process.stdout.write(Buffer.from([0xF0,0x9F])); setTimeout(() => process.stdout.write(Buffer.from([0x99,0x82])), 50)",
  );
  assert.equal(result.stdout, "🙂");
  assert.equal(Buffer.byteLength(result.stdout), 4);
});

test("default Codex runner timeout retains partial stdout and stderr before termination", async () => {
  let observed: CodexRunnerProcessError | null = null;
  try {
    await nodeRunner(
      "process.stdout.write('partial stdout before timeout'); process.stderr.write('partial stderr before timeout'); setInterval(() => {}, 1000)",
      500,
    );
    assert.fail("the child must time out");
  } catch (error) {
    assert.ok(error instanceof CodexRunnerProcessError);
    observed = error;
  }
  assert.equal(observed!.failureKind, "timeout");
  assert.equal(observed!.errorName, "TimeoutError");
  assert.match(observed!.errorMessage, /timed out after 500ms/);
  assert.equal(observed!.timedOut, true);
  assert.equal(observed!.stdout, "partial stdout before timeout");
  assert.equal(observed!.stderr, "partial stderr before timeout");
});

test("default Codex runner timeout is bounded when a descendant keeps inherited pipes open", async () => {
  // Leave enough startup headroom for this child to write both streams even
  // when the complete suite is exercising the host concurrently. The bound
  // under test is the post-kill grace period, not Node process startup speed.
  const timeoutMs = 1_000;
  const startedAt = Date.now();
  let observed: CodexRunnerProcessError | null = null;
  try {
    await nodeRunner([
      "const { spawn } = require('node:child_process')",
      `spawn(process.execPath, ['-e', 'setTimeout(() => process.exit(0), ${CODEX_RUNNER_POST_KILL_GRACE_MS * 3})'], { stdio: ['ignore', 'inherit', 'inherit'] })`,
      "process.stdout.write('stdout before bounded kill')",
      "process.stderr.write('stderr before bounded kill')",
      "setInterval(() => {}, 1000)",
    ].join(";"), timeoutMs);
    assert.fail("the child must time out");
  } catch (error) {
    assert.ok(error instanceof CodexRunnerProcessError);
    observed = error;
  }
  assert.equal(observed!.failureKind, "timeout");
  assert.equal(observed!.stdout, "stdout before bounded kill");
  assert.equal(observed!.stderr, "stderr before bounded kill");
  assert.ok(Date.now() - startedAt < timeoutMs + CODEX_RUNNER_POST_KILL_GRACE_MS * 2 + 500,
    "timeout diagnostics must not wait indefinitely for inherited pipes to close");
});

test("default Codex runner spawn error is typed and retains the captured stream fields", async () => {
  let observed: CodexRunnerProcessError | null = null;
  try {
    await defaultCodexRunner({
      bin: join(tmpdir(), `definitely-missing-codex-${process.pid}`),
      argv: [],
      cwd: process.cwd(),
      env: process.env,
      timeoutMs: 2_000,
    });
    assert.fail("the missing binary must fail to spawn");
  } catch (error) {
    assert.ok(error instanceof CodexRunnerProcessError);
    observed = error;
  }
  assert.equal(observed!.failureKind, "spawn_error");
  assert.equal(observed!.timedOut, false);
  assert.equal(observed!.exitCode, null);
  assert.equal(observed!.stdout, "");
  assert.equal(observed!.stderr, "");
  assert.match(observed!.errorMessage, /ENOENT|spawn/i);
});

test("spawnCodexAgent rethrows the typed runner process observation unchanged", async () => {
  const root = mkdtempSync(join(tmpdir(), "cf-codex-runner-error-propagation-"));
  const retained = new CodexRunnerProcessError({
    failureKind: "timeout",
    errorName: "TimeoutError",
    errorMessage: "codex exec timed out after 50ms",
    timedOut: true,
    exitCode: null,
    stdout: "partial agent stdout",
    stderr: "partial agent stderr",
  });
  let observed: unknown;
  try {
    await spawnCodexAgent({
      task: "MODEL-FREE TEST RUNNER — no real Codex process",
      sessionId: "typed-runner-error-session",
      cwd: process.cwd(),
      sandbox: "read-only",
      role: "chapter-reviewer",
      manifestSink: join(root, "logs"),
      execBaseDir: join(root, "sessions"),
      runner: async () => { throw retained; },
    });
    assert.fail("the typed runner error must propagate");
  } catch (error) {
    observed = error;
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
  assert.equal(observed, retained);
});

test("process diagnostics retain successful and returned-nonzero process observations", () => {
  const success = buildCodexProcessDiagnosticsV1({
    attemptId: "success-a1",
    requestSha256: REQUEST_SHA,
    sessionId: "success-session",
    invocation: "RUNNER_RETURNED",
    classification: "completed",
    result: { stdout: "success stdout", stderr: "", exitCode: 0 },
  });
  assert.equal(success.failureKind, null);
  assert.equal(success.exitCode, 0);
  assert.equal(success.stdoutRetained, "success stdout");
  assert.equal(success.errorName, null);
  validateCodexProcessDiagnosticsV1(success, {
    attemptId: "success-a1",
    requestSha256: REQUEST_SHA,
    sessionId: "success-session",
    invocation: "RUNNER_RETURNED",
    classification: "completed",
  });

  const nonzero = buildCodexProcessDiagnosticsV1({
    attemptId: "nonzero-a1",
    requestSha256: REQUEST_SHA,
    sessionId: "nonzero-session",
    invocation: "RUNNER_RETURNED",
    classification: "integrity_failure",
    result: { stdout: "", stderr: "schema flag rejected by provider", exitCode: 1 },
    error: new Error("reviewer classified returned exit 1"),
  });
  assert.equal(nonzero.failureKind, "returned_nonzero");
  assert.equal(nonzero.exitCode, 1);
  assert.equal(nonzero.stderrRetained, "schema flag rejected by provider");
  assert.equal(nonzero.errorName, "Error");
  assert.equal(nonzero.errorMessage, "reviewer classified returned exit 1");
});

test("process diagnostics preserve typed timeout streams and empty preflight observations", () => {
  const timeout = new CodexRunnerProcessError({
    failureKind: "timeout",
    errorName: "TimeoutError",
    errorMessage: "codex exec timed out",
    timedOut: true,
    exitCode: null,
    stdout: "partial out",
    stderr: "partial err",
  });
  const thrown = buildCodexProcessDiagnosticsV1({
    attemptId: "timeout-a1",
    requestSha256: REQUEST_SHA,
    sessionId: "timeout-session",
    invocation: "RUNNER_THROWN",
    classification: "timeout",
    error: timeout,
  });
  assert.equal(thrown.failureKind, "timeout");
  assert.equal(thrown.timedOut, true);
  assert.equal(thrown.stdoutRetained, "partial out");
  assert.equal(thrown.stderrRetained, "partial err");

  const preflight = buildCodexProcessDiagnosticsV1({
    attemptId: "preflight-a1",
    requestSha256: REQUEST_SHA,
    sessionId: null,
    invocation: "NOT_INVOKED",
    classification: "policy_failure",
    error: new Error("schema path is missing"),
  });
  assert.equal(preflight.failureKind, "preflight_error");
  assert.equal(preflight.exitCode, null);
  assert.equal(preflight.stdoutBytes, 0);
  assert.equal(preflight.stderrBytes, 0);
  assert.equal(preflight.stdoutSha256, sha256Hex(""));
  assert.equal(preflight.stderrSha256, sha256Hex(""));
});

test("bounded stream retention is deterministic and hashes the full stream before truncation", () => {
  const full = `${"A".repeat(9_000)}${"M".repeat(10_000)}${"Z".repeat(25_000)}`;
  const projection = retainBoundedCodexProcessStream(full);
  assert.equal(projection.truncated, true);
  assert.equal(projection.bytes, Buffer.byteLength(full));
  assert.equal(projection.sha256, sha256Hex(full));
  assert.equal(
    projection.retained,
    `${"A".repeat(CODEX_PROCESS_DIAGNOSTICS_HEAD_BYTES)}${"Z".repeat(CODEX_PROCESS_DIAGNOSTICS_TAIL_BYTES)}`,
  );
  assert.equal(Buffer.byteLength(projection.retained), CODEX_PROCESS_DIAGNOSTICS_MAX_RETAINED_BYTES);

  const unicode = retainBoundedCodexProcessStream("🙂".repeat(10_000));
  assert.equal(unicode.truncated, true);
  assert.ok(Buffer.byteLength(unicode.retained) <= CODEX_PROCESS_DIAGNOSTICS_MAX_RETAINED_BYTES);
  assert.equal(unicode.retained.includes("�"), false, "UTF-8 projection must not split a code point");
});

test("persisted diagnostics redact credential shapes while ordinary Codex errors remain readable", () => {
  const secretApiKey = `sk-proj-${"x".repeat(24)}`;
  const secretJwt = `eyJ${"a".repeat(12)}.${"b".repeat(12)}.${"c".repeat(12)}`;
  const secretClient = "oauth-client-secret-value";
  const stderr = [
    "Authorization: Bearer bearer-secret-value",
    `OPENAI_API_KEY=${secretApiKey}`,
    `{"access_token":"${secretJwt}"}`,
    `{"client_secret":"${secretClient}"}`,
    `--api-key=${secretApiKey}`,
    "Cookie: session=private-cookie-value",
    "Authorization: ChatGPT login required; run codex login",
    "codex exec failed: model=gpt-5.6-sol effort=high --output-schema /tmp/reader.schema.json exitCode=1 provider status=429 token limit reached",
  ].join("\n");
  const diagnostics = buildCodexProcessDiagnosticsV1({
    attemptId: "redaction-a1",
    requestSha256: REQUEST_SHA,
    sessionId: "redaction-session",
    invocation: "RUNNER_RETURNED",
    classification: "provider_capacity",
    result: { stdout: "", stderr, exitCode: 1 },
    error: new Error(`refresh_token=${secretJwt}`),
  });
  for (const secret of ["bearer-secret-value", secretApiKey, secretJwt, secretClient, "private-cookie-value"]) {
    assert.equal(diagnostics.stderrRetained.includes(secret), false);
    assert.equal(diagnostics.errorMessage?.includes(secret), false);
  }
  assert.match(diagnostics.stderrRetained, /Authorization: \[REDACTED\]/);
  assert.match(diagnostics.stderrRetained, /OPENAI_API_KEY=\[REDACTED\]/);
  assert.match(diagnostics.stderrRetained, /Authorization: ChatGPT login required; run codex login/);
  assert.match(diagnostics.stderrRetained, /model=gpt-5\.6-sol effort=high/);
  assert.match(diagnostics.stderrRetained, /--output-schema \/tmp\/reader\.schema\.json/);
  assert.match(diagnostics.stderrRetained, /exitCode=1 provider status=429 token limit reached/);
  assert.equal(diagnostics.stderrSha256, sha256Hex(stderr), "raw full-stream hash precedes redaction");
});

test("persisted diagnostics redact camelCase and hyphenated auth payload fields", () => {
  const secrets = [
    "FAKE_ACCESS_SECRET_123456789",
    "FAKE_REFRESH_SECRET_123456789",
    "FAKE_API_SECRET_123456789",
    "FAKE_CLIENT_SECRET_123456789",
    "FAKE_PROVIDER_SECRET_123456789",
  ];
  const retained = retainBoundedCodexProcessStream([
    JSON.stringify({
      accessToken: secrets[0],
      "refresh-token": secrets[1],
      apiKey: secrets[2],
      clientSecret: secrets[3],
    }),
    `OPENAI_API_KEY=${secrets[4]}`,
    `ANTHROPIC_API_KEY=${secrets[4]}`,
    `CODEX_API_KEY=${secrets[4]}`,
  ].join("\n")).retained;
  for (const secret of secrets) assert.equal(retained.includes(secret), false);
  assert.match(retained, /\[REDACTED\]/);
});

test("an oversized raw credential stream that redacts below the cap is retained once without overlap", () => {
  const raw = `OPENAI_API_KEY=${"opaque-secret".repeat(4_000)}`;
  const projection = retainBoundedCodexProcessStream(raw);
  assert.equal(projection.truncated, true);
  assert.equal(projection.bytes, Buffer.byteLength(raw));
  assert.equal(projection.sha256, sha256Hex(raw));
  assert.equal(projection.retained, "OPENAI_API_KEY=[REDACTED]");
});

test("redaction expansion cannot exceed the absolute 32 KiB persisted-stream ceiling", () => {
  const raw = "API_KEY=x\n".repeat(3_000);
  assert.ok(Buffer.byteLength(raw) < CODEX_PROCESS_DIAGNOSTICS_MAX_RETAINED_BYTES,
    "fixture must exercise redaction expansion rather than a raw oversized stream");
  const projection = retainBoundedCodexProcessStream(raw);
  assert.equal(projection.bytes, Buffer.byteLength(raw));
  assert.equal(projection.sha256, sha256Hex(raw));
  assert.equal(projection.truncated, true);
  assert.ok(Buffer.byteLength(projection.retained) <= CODEX_PROCESS_DIAGNOSTICS_MAX_RETAINED_BYTES);
  assert.equal(projection.retained.includes("API_KEY=x"), false);

  const diagnostics = buildCodexProcessDiagnosticsV1({
    attemptId: "redaction-expansion-a1",
    requestSha256: REQUEST_SHA,
    sessionId: "redaction-expansion-session",
    invocation: "RUNNER_RETURNED",
    classification: "integrity_failure",
    result: { stdout: "", stderr: raw, exitCode: 1 },
  });
  validateCodexProcessDiagnosticsV1(diagnostics);
  assert.equal(diagnostics.stderrBytes, Buffer.byteLength(raw));
  assert.equal(diagnostics.stderrSha256, sha256Hex(raw));
  assert.equal(diagnostics.stderrTruncated, true);
});

test("modified diagnostics fail their self-hash validation", () => {
  const diagnostics = buildCodexProcessDiagnosticsV1({
    attemptId: "tamper-a1",
    requestSha256: REQUEST_SHA,
    sessionId: "tamper-session",
    invocation: "RUNNER_RETURNED",
    classification: "completed",
    result: { stdout: "ok", stderr: "", exitCode: 0 },
  });
  const tampered = { ...diagnostics, stdoutRetained: "changed" };
  assert.throws(
    () => validateCodexProcessDiagnosticsV1(tampered),
    /self hash drift/,
  );
});
