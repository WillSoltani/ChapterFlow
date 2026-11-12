import { after, afterEach, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { appendLedger, ledgerTotal, readLedger, type LedgerRow } from "../src/ledger";
import {
  BudgetError,
  CallFailedError,
  READ_ONLY_PROFILE,
  UsageLimitError,
  buildArgv,
  callModel,
  childEnv,
  type CallOptions,
} from "../src/call";

const FAKE = fileURLToPath(new URL("./fixtures/fake-claude.mjs", import.meta.url));
const MODEL = "claude-sonnet-5";

const tmpRoots: string[] = [];
function tmp(): string {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), "v26-call-"));
  tmpRoots.push(d);
  return d;
}
after(() => {
  for (const d of tmpRoots) fs.rmSync(d, { recursive: true, force: true });
});

function row(over: Partial<LedgerRow> = {}): LedgerRow {
  return {
    ts: "2026-01-01T00:00:00.000Z",
    chapter: "ch01",
    step: "write",
    model: MODEL,
    effort: "high",
    cost: 0.5,
    outTokens: 100,
    stopReason: "end_turn",
    seconds: 1,
    isError: false,
    ...over,
  };
}

describe("ledger", () => {
  it("missing file reads as empty and totals 0", () => {
    const p = path.join(tmp(), "nope", "ledger.jsonl");
    assert.deepEqual(readLedger(p), []);
    assert.equal(ledgerTotal(p), 0);
  });

  it("append creates the parent dir and rows round-trip; total sums cost", () => {
    const p = path.join(tmp(), "deep", "dir", "ledger.jsonl");
    appendLedger(p, row({ cost: 0.5 }));
    appendLedger(p, row({ cost: 1.25, step: "fix" }));
    const rows = readLedger(p);
    assert.equal(rows.length, 2);
    assert.equal(rows[1]!.step, "fix");
    assert.equal(ledgerTotal(p), 1.75);
  });
});

describe("buildArgv / childEnv", () => {
  it("read-only profile matches the spec", () => {
    assert.deepEqual(READ_ONLY_PROFILE, {
      id: "v26-read-only",
      workDirPolicy: "ATTEMPT_ROOT",
      mode: "READ_ONLY",
      outputSchemaId: "v26-json",
      timeoutMs: 900000,
      terminateGraceMs: 5000,
      maxStdoutBytes: 16777216,
      maxStderrBytes: 1048576,
    });
  });

  it("argv is restricted, tool-less, MCP-isolated and carries model + effort", () => {
    const argv = buildArgv(MODEL, "high");
    assert.ok(argv.includes("--restricted"));
    assert.ok(argv.includes("--strict-mcp-config"));
    const dis = argv.indexOf("--disallowedTools");
    assert.ok(dis >= 0);
    assert.equal(argv[dis + 1], "*");
    assert.equal(argv[argv.indexOf("--model") + 1], MODEL);
    assert.equal(argv[argv.indexOf("--effort") + 1], "high");
  });

  it("env drops API keys even when set, and carries the output-token ceiling", () => {
    const env = childEnv({ PATH: "/bin", OPENAI_API_KEY: "sk-x", ANTHROPIC_API_KEY: "sk-y", HOME: "/h" });
    assert.equal(env.OPENAI_API_KEY, undefined);
    assert.equal(env.ANTHROPIC_API_KEY, undefined);
    assert.equal(env.HOME, "/h");
    assert.ok(env.CLAUDE_CODE_MAX_OUTPUT_TOKENS);
  });

  it("env skips non-string values from the base", () => {
    const env = childEnv({ A: "1", B: undefined });
    assert.equal(env.A, "1");
    assert.ok(!("B" in env));
  });
});

describe("callModel (fake claude)", () => {
  let dir: string;
  let logPath: string;
  const saved: Record<string, string | undefined> = {};
  const touched = ["FAKE_CLAUDE_LOG", "FAKE_CLAUDE_STATE", "OPENAI_API_KEY", "ANTHROPIC_API_KEY"];

  beforeEach(() => {
    dir = tmp();
    logPath = path.join(dir, "fake.log");
    for (const k of touched) saved[k] = process.env[k];
    process.env.FAKE_CLAUDE_LOG = logPath;
    process.env.FAKE_CLAUDE_STATE = path.join(dir, "fake.state");
    process.env.OPENAI_API_KEY = "sk-should-not-leak";
    process.env.ANTHROPIC_API_KEY = "sk-should-not-leak-either";
  });
  afterEach(() => {
    for (const k of touched) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  });

  const invocations = (): { argv: string[]; envKeys: string[]; cwd: string }[] =>
    fs.existsSync(logPath)
      ? fs.readFileSync(logPath, "utf8").trim().split("\n").filter(Boolean).map((l) => JSON.parse(l))
      : [];

  function opts(scenario: string, over: Partial<CallOptions> = {}): CallOptions {
    return {
      role: { bin: FAKE, model: MODEL, effort: "high" },
      prompt: `SCENARIO ${scenario}\nthe rest of the prompt`,
      step: "write",
      chapter: "ch01",
      kind: "write",
      ledgerPath: path.join(dir, "ledger.jsonl"),
      budgetUsd: 100,
      cwd: path.join(dir, "work"),
      timeoutMs: 20000,
      ...over,
    };
  }

  it("ok: parses fenced json, writes a ledger row, writes out files, runs in cwd with a clean env", async () => {
    const o = opts("ok", { outPrefix: path.join(dir, "out", "ch01") });
    const r = await callModel(o);
    assert.deepEqual(r.json, { hello: 1 });
    assert.equal(r.text, '{"hello":1}');
    assert.equal(r.cost, 0.25);
    assert.equal(r.effortUsed, "high");
    assert.equal(r.envelope.stop_reason, "end_turn");

    const rows = readLedger(o.ledgerPath);
    assert.equal(rows.length, 1);
    assert.equal(rows[0]!.step, "write");
    assert.equal(rows[0]!.chapter, "ch01");
    assert.equal(rows[0]!.model, MODEL);
    assert.equal(rows[0]!.effort, "high");
    assert.equal(rows[0]!.cost, 0.25);
    assert.equal(rows[0]!.outTokens, 10);
    assert.equal(rows[0]!.stopReason, "end_turn");
    assert.equal(rows[0]!.isError, false);

    assert.equal(JSON.parse(fs.readFileSync(path.join(dir, "out", "ch01.envelope.json"), "utf8")).type, "result");
    assert.equal(fs.readFileSync(path.join(dir, "out", "ch01.result.txt"), "utf8"), '{"hello":1}');
    assert.deepEqual(JSON.parse(fs.readFileSync(path.join(dir, "out", "ch01.json"), "utf8")), { hello: 1 });

    const calls = invocations();
    assert.equal(calls.length, 1);
    assert.equal(fs.realpathSync(calls[0]!.cwd), fs.realpathSync(o.cwd));
    assert.ok(calls[0]!.argv.includes("--strict-mcp-config"));
    assert.ok(!calls[0]!.envKeys.includes("OPENAI_API_KEY"));
    assert.ok(!calls[0]!.envKeys.includes("ANTHROPIC_API_KEY"));
    assert.ok(calls[0]!.envKeys.includes("CLAUDE_CODE_MAX_OUTPUT_TOKENS"));
    assert.ok(calls[0]!.envKeys.includes("FAKE_CLAUDE_LOG"));
  });

  it("usage limit: UsageLimitError (exit 3), exactly one invocation, no retry", async () => {
    const o = opts("usage");
    await assert.rejects(callModel(o), (e: unknown) => {
      assert.ok(e instanceof UsageLimitError);
      assert.equal((e as UsageLimitError).exitCode, 3);
      return true;
    });
    assert.equal(invocations().length, 1);
    const rows = readLedger(o.ledgerPath);
    assert.equal(rows.length, 1);
    assert.equal(rows[0]!.isError, true);
  });

  it("budget stop: BudgetError (exit 4) before anything is spawned", async () => {
    const o = opts("ok", { budgetUsd: 10 });
    appendLedger(o.ledgerPath, row({ cost: 8.5 })); // 8.5 + 2 > 10 for a write
    await assert.rejects(callModel(o), (e: unknown) => {
      assert.ok(e instanceof BudgetError);
      assert.equal((e as BudgetError).exitCode, 4);
      assert.match((e as Error).message, /^BUDGET_STOP/);
      return true;
    });
    assert.equal(invocations().length, 0);
    assert.ok(!fs.existsSync(o.cwd), "cwd not even created");
  });

  it("budget: kind other reserves only $1", async () => {
    const o = opts("ok", { budgetUsd: 10, kind: "other" });
    appendLedger(o.ledgerPath, row({ cost: 8.5 })); // 8.5 + 1 <= 10
    const r = await callModel(o);
    assert.deepEqual(r.json, { hello: 1 });
    assert.equal(invocations().length, 1);
  });

  it("max_tokens: retries once at the next lower effort", async () => {
    const o = opts("maxtokens");
    const r = await callModel(o);
    assert.equal(r.effortUsed, "medium");
    assert.deepEqual(r.json, { hello: 1 });
    const calls = invocations();
    assert.equal(calls.length, 2);
    assert.equal(calls[0]!.argv[calls[0]!.argv.indexOf("--effort") + 1], "high");
    assert.equal(calls[1]!.argv[calls[1]!.argv.indexOf("--effort") + 1], "medium");
    const rows = readLedger(o.ledgerPath);
    assert.equal(rows.length, 2);
    assert.equal(rows[0]!.effort, "high");
    assert.equal(rows[0]!.stopReason, "max_tokens");
    assert.equal(rows[0]!.step, "write");
    assert.equal(rows[1]!.effort, "medium");
    assert.equal(rows[1]!.step, "write:retry");
  });

  it("max_tokens at effort low: CallFailedError, no retry", async () => {
    const o = opts("maxtokens-always", { role: { bin: FAKE, model: MODEL, effort: "low" } });
    await assert.rejects(callModel(o), CallFailedError);
    assert.equal(invocations().length, 1);
  });

  it("max_tokens twice: the one retry is spent, CallFailedError", async () => {
    const o = opts("maxtokens-always");
    await assert.rejects(callModel(o), CallFailedError);
    assert.equal(invocations().length, 2);
  });

  it("garbage then ok: succeeds after exactly one retry at the same effort", async () => {
    const o = opts("garbage-once");
    const r = await callModel(o);
    assert.deepEqual(r.json, { hello: 1 });
    assert.equal(r.effortUsed, "high");
    const calls = invocations();
    assert.equal(calls.length, 2);
    assert.equal(calls[1]!.argv[calls[1]!.argv.indexOf("--effort") + 1], "high");
    const rows = readLedger(o.ledgerPath);
    assert.equal(rows.length, 2);
    assert.equal(rows[0]!.isError, true);
    assert.equal(rows[1]!.step, "write:retry");
  });

  it("garbage always: CallFailedError after exactly two invocations", async () => {
    const o = opts("garbage");
    await assert.rejects(callModel(o), (e: unknown) => {
      assert.ok(e instanceof CallFailedError);
      assert.ok(!(e instanceof UsageLimitError));
      assert.ok(!(e instanceof BudgetError));
      assert.match((e as Error).message, /not json/);
      return true;
    });
    assert.equal(invocations().length, 2);
    assert.equal(readLedger(o.ledgerPath).length, 2);
  });

  it("timeout: kills the child and fails after the single retry", async () => {
    const o = opts("hang", { timeoutMs: 300 });
    await assert.rejects(callModel(o), CallFailedError);
    assert.equal(invocations().length, 2);
  });
});
