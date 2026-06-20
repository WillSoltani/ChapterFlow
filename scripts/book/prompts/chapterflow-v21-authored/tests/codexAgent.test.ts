import assert from "node:assert/strict";

import { test } from "./harness.js";
import { codexExecArgv } from "../src/orchestrator/codexAgent.js";

test("codexExecArgv: workspace-write adds --add-dir writable roots BEFORE the positional prompt", () => {
  const argv = codexExecArgv("DO THE WORK", "workspace-write", ["/repo/.chapterflow", "/other"]);
  assert.deepEqual(argv, ["exec", "--sandbox", "workspace-write", "--add-dir", "/repo/.chapterflow", "--add-dir", "/other", "DO THE WORK"]);
  // The prompt is positional and codex reads it LAST — a writable root appearing after it
  // would be parsed as (part of) the prompt, so order is load-bearing.
  assert.equal(argv[argv.length - 1], "DO THE WORK", "the prompt MUST be the final arg");
});

test("codexExecArgv: read-only NEVER widens the sandbox with --add-dir (a reviewer writes nothing)", () => {
  const argv = codexExecArgv("REVIEW", "read-only", ["/repo/.chapterflow"]);
  assert.deepEqual(argv, ["exec", "--sandbox", "read-only", "REVIEW"]);
});

test("codexExecArgv: no writable roots → bare exec (unchanged default)", () => {
  assert.deepEqual(codexExecArgv("T", "workspace-write"), ["exec", "--sandbox", "workspace-write", "T"]);
});

test("codexExecArgv: --skip-git-repo-check is emitted (before the prompt) when set — a blind reviewer cwd isn't a git repo", () => {
  // A read-only reviewer runs in a tmpdir blind workspace; without this flag codex exec
  // refuses ("Not inside a trusted directory").
  const argv = codexExecArgv("REVIEW", "read-only", [], true);
  assert.deepEqual(argv, ["exec", "--sandbox", "read-only", "--skip-git-repo-check", "REVIEW"]);
  assert.equal(argv[argv.length - 1], "REVIEW", "the prompt is still the final positional arg");
  // default stays off
  assert.ok(!codexExecArgv("X", "read-only").includes("--skip-git-repo-check"));
});

test("codexExecArgv: reasoningEffort binds `-c model_reasoning_effort=<level>` before the prompt", () => {
  const argv = codexExecArgv("REVIEW", "read-only", [], true, "high");
  assert.deepEqual(argv, ["exec", "--sandbox", "read-only", "--skip-git-repo-check", "-c", "model_reasoning_effort=high", "REVIEW"]);
  assert.equal(argv[argv.length - 1], "REVIEW", "the prompt is still the final positional arg");
  // omitted → no flag (codex default), unchanged behaviour
  assert.ok(!codexExecArgv("X", "read-only").join(" ").includes("model_reasoning_effort"));
});
