/**
 * IMP-00: Codex CLI qualification — parse fidelity against the REAL installed
 * help text shape, fail-closed on missing flags, and probe caching keyed to
 * binary identity (a CLI upgrade re-qualifies automatically).
 */

import assert from "node:assert/strict";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { test } from "./harness.js";
import { TMP_DIR } from "./helpers.js";
import {
  __clearQualificationMemo,
  assertFlagsSupported,
  CLAUDE_ROUTE_REQUIRED_FLAGS,
  ExecPreflightError,
  parseClaudeHelpForFlags,
  parseHelpForFlags,
  PROBED_FLAGS,
  qualificationCachePathFor,
  qualifyClaudeCli,
  qualifyCodexCli,
  syntheticQualification,
} from "../src/exec/cliQualification.js";

/** Shape captured from codex-cli 0.144.1 (`codex exec --help`, 2026-07-10). */
const REAL_HELP_SHAPE = `
Options:
  -c, --config <key=value>
          Override a configuration value that would otherwise be loaded from ~/.codex/config.toml
  -s, --sandbox <SANDBOX_MODE>
          [possible values: read-only, workspace-write, danger-full-access]
  -C, --cd <DIR>
          Tell the agent to use the specified directory as its working root
      --add-dir <DIR>
          Additional directories that should be writable alongside the primary workspace
      --skip-git-repo-check
          Allow running Codex outside a Git repository
      --ephemeral
          Run without persisting session files to disk
      --ignore-user-config
          Do not load $CODEX_HOME/config.toml; auth still uses CODEX_HOME
      --ignore-rules
          Do not load user or project execpolicy .rules files
      --output-schema <FILE>
          Path to a JSON Schema file describing the model's final response shape
      --json
          Print events to stdout as JSONL
  -o, --output-last-message <FILE>
          Specifies file where the last message from the agent should be written
`;

test("parseHelpForFlags: the real 0.144.1 help shape yields every probed flag as supported", () => {
  const flags = parseHelpForFlags(REAL_HELP_SHAPE);
  for (const f of PROBED_FLAGS) assert.equal(flags[f], true, `expected ${f} supported`);
});

test("parseHelpForFlags: a stripped CLI reports isolation flags unsupported", () => {
  const stripped = REAL_HELP_SHAPE
    .replace(/^\s*--ignore-user-config[\s\S]*?auth still uses CODEX_HOME\n/m, "")
    .replace(/^\s*--ignore-rules[\s\S]*?\.rules files\n/m, "");
  const flags = parseHelpForFlags(stripped);
  assert.equal(flags["--ignore-user-config"], false);
  assert.equal(flags["--ignore-rules"], false);
  assert.equal(flags["--sandbox"], true, "unrelated flags still parse");
});

test("assertFlagsSupported: missing required flags throw a preflight error naming them", () => {
  const qual = syntheticQualification();
  qual.flags["--ignore-rules"] = false;
  assert.throws(
    () => assertFlagsSupported(qual, ["--sandbox", "--ignore-rules"]),
    (err: Error) => err instanceof ExecPreflightError && err.message.includes("--ignore-rules"),
  );
  assertFlagsSupported(qual, ["--sandbox"]); // unaffected requirement still passes
});

test("qualifyCodexCli: probes once per binary identity and persists a disk cache", async () => {
  __clearQualificationMemo();
  const cacheDir = join(TMP_DIR, `exec-qual-${process.pid}-${Date.now().toString(36)}`);
  mkdirSync(cacheDir, { recursive: true });
  // A real on-disk "binary" gives the cache a stable (path,size,mtime) identity.
  const fakeBin = join(cacheDir, "codex-fake");
  writeFileSync(fakeBin, "#!/bin/sh\n");
  let probes = 0;
  const prober = async (_bin: string, args: string[]) => {
    probes++;
    return args[0] === "--version"
      ? { stdout: "codex-cli 9.9.9-fixture\n", stderr: "" }
      : { stdout: REAL_HELP_SHAPE, stderr: "" };
  };
  const q1 = await qualifyCodexCli({ bin: fakeBin, cacheDir, prober });
  assert.equal(q1.version, "codex-cli 9.9.9-fixture");
  assert.equal(q1.synthetic, false);
  assert.equal(probes, 2, "one --version probe + one --help probe");
  const q2 = await qualifyCodexCli({ bin: fakeBin, cacheDir, prober });
  assert.equal(probes, 2, "second call must hit the memo, not re-probe");
  assert.equal(q2.version, q1.version);
  const disk = JSON.parse(readFileSync(qualificationCachePathFor(cacheDir), "utf8"));
  assert.equal(disk.schema, "codex-cli-qualification-v1");
  assert.equal(disk.version, "codex-cli 9.9.9-fixture");
  // A fresh process (cleared memo) must reuse the disk cache without probing.
  __clearQualificationMemo();
  const q3 = await qualifyCodexCli({ bin: fakeBin, cacheDir, prober });
  assert.equal(probes, 2, "disk cache must satisfy a cold memo");
  assert.equal(q3.version, q1.version);
});

test("qualifyCodexCli: a probe failure is a fail-closed preflight error", async () => {
  __clearQualificationMemo();
  const prober = async () => { throw new Error("ENOENT: no codex here"); };
  await assert.rejects(
    qualifyCodexCli({ bin: "/nonexistent/codex", prober }),
    (err: Error) => err instanceof ExecPreflightError && /qualification probe failed/.test(err.message),
  );
});

/** Shape captured from `claude --help` (Claude Code 2.1.197, 2026-07-22) — the
 *  option lines the claude route's required flags parse against. */
const REAL_CLAUDE_HELP_SHAPE = `
Options:
  --add-dir <directories...>            Additional directories to allow tool access to
  --allowedTools, --allowed-tools <tools...>
  --disallowedTools, --disallowed-tools <tools...>
  --effort <level>                      Effort level for the current session (low, medium, high, xhigh, max)
  --model <model>                       Model for the current session.
  --output-format <format>              Output format (only works with --print): "text" (default), "json"
  --permission-mode <mode>              Permission mode to use for the session
  -p, --print                           Print response and exit
`;

test("parseClaudeHelpForFlags: the real 2.1.197 help shape yields every claude route flag as supported", () => {
  const flags = parseClaudeHelpForFlags(REAL_CLAUDE_HELP_SHAPE);
  for (const f of CLAUDE_ROUTE_REQUIRED_FLAGS) assert.equal(flags[f], true, `expected ${f} supported`);
});

test("parseClaudeHelpForFlags: a CLI missing --effort reports it unsupported (fail-closed qualification)", () => {
  const stripped = REAL_CLAUDE_HELP_SHAPE.replace(/^\s*--effort[\s\S]*?max\)\n/m, "");
  const flags = parseClaudeHelpForFlags(stripped);
  assert.equal(flags["--effort"], false);
  assert.equal(flags["--model"], true, "unrelated flags still parse");
});

test("qualifyClaudeCli: probes `claude --version` + `claude --help` and persists a distinct disk cache", async () => {
  __clearQualificationMemo();
  const cacheDir = join(TMP_DIR, `claude-qual-${process.pid}-${Date.now().toString(36)}`);
  mkdirSync(cacheDir, { recursive: true });
  const fakeBin = join(cacheDir, "claude-fake");
  writeFileSync(fakeBin, "#!/bin/sh\n");
  const probeArgs: string[][] = [];
  const prober = async (_bin: string, args: string[]) => {
    probeArgs.push(args);
    return args[0] === "--version"
      ? { stdout: "2.1.197 (Claude Code)\n", stderr: "" }
      : { stdout: REAL_CLAUDE_HELP_SHAPE, stderr: "" };
  };
  const qual = await qualifyClaudeCli({ bin: fakeBin, cacheDir, prober });
  assert.equal(qual.version, "2.1.197 (Claude Code)");
  assert.equal(qual.schema, "claude-cli-qualification-v1");
  assert.deepEqual(probeArgs, [["--version"], ["--help"]], "claude probes --version then bare --help (no `exec` subcommand)");
  assertFlagsSupported(qual, CLAUDE_ROUTE_REQUIRED_FLAGS);
  const disk = JSON.parse(readFileSync(join(cacheDir, "claude-cli-qualification.json"), "utf8"));
  assert.equal(disk.schema, "claude-cli-qualification-v1");
});
