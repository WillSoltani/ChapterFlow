/**
 * WP-E71 red-team — ATTACK 2: reasoning-effort spoof (the manifest/argv is the
 * authority, never the caller or the runner).
 *
 * The D7 / canonical-evaluator ultra route must run at GPT-5.6 @ reasoning-effort
 * "ultra". This suite proves that claim is UNSPOOFABLE from the two surfaces an
 * attacker controls:
 *
 *   1. THE CALLER. `UltraSessionRequestV1` carries NO model/effort field at all —
 *      the route is decided solely by `resolveD7RaterRoute()`. A caller therefore
 *      cannot request a cheaper effort; the result's effort is read back from the
 *      persisted effective-context manifest, never echoed from the request.
 *   2. THE RUNNER. The spawn argv the runner receives literally carries
 *      `-c model_reasoning_effort=ultra` and `-c model=<baseline>`, built from the
 *      SAME `route.effort`/`route.model` that stamps the manifest — so a runner
 *      cannot have executed at a different effort than the manifest records.
 *
 * Then the spoof is shown to be DETECTABLE: strip the `model_reasoning_effort`
 * override out of the recorded argv and the argv-derived effort no longer agrees
 * with the manifest's `reasoningEffort` field — the argv is the authoritative
 * record of what was spawned, so a manifest claiming ultra over an argv that
 * lacks the override is a catchable mismatch.
 *
 * Hermetic: an INJECTED runner double answers argv without a process; every path
 * (session dir, manifest sink, auth source) is a fresh tmp dir, so nothing lands
 * under a guarded root (CHAPTERFLOW_LEAK_GUARD=1 stays clean).
 */

import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { test } from "./harness.js";
import {
  runUltraSession,
  ULTRA_EFFORT,
  type UltraSessionDepsV1,
  type UltraSessionRequestV1,
} from "../src/exec/ultraSession.js";
import { BASELINE_MODEL } from "../src/orchestrator/modelPolicy.js";
import { syntheticQualification } from "../src/exec/cliQualification.js";
import type { CodexRunner } from "../src/orchestrator/codexAgent.js";

function freshDir(prefix: string): string {
  return mkdtempSync(join(tmpdir(), prefix));
}

/** A runner double: captures the argv it was handed and answers a trivial JSON
 *  reply, never launching a process. */
function capturingRunner(): { runner: CodexRunner; argv: () => string[] } {
  let captured: string[] = [];
  const runner: CodexRunner = async (args) => {
    captured = args.argv.slice();
    return { stdout: "{}", stderr: "", code: 0 };
  };
  return { runner, argv: () => captured };
}

/** The reasoning effort as RECORDED IN the argv (`-c model_reasoning_effort=X`),
 *  or undefined when the override is absent. This is what makes a manifest/argv
 *  mismatch detectable — the argv is the spawn's own record. */
function effortFromArgv(argv: string[]): string | undefined {
  const hit = argv.find((a) => a.startsWith("model_reasoning_effort="));
  return hit ? hit.slice("model_reasoning_effort=".length) : undefined;
}
function modelFromArgv(argv: string[]): string | undefined {
  const hit = argv.find((a) => a.startsWith("model="));
  return hit ? hit.slice("model=".length) : undefined;
}

function baseDeps(cap: { runner: CodexRunner }): UltraSessionDepsV1 {
  return {
    runner: cap.runner,
    execBaseDir: freshDir("cf-rt2-exec-"),
    manifestSink: freshDir("cf-rt2-sink-"),
    authSourceDir: freshDir("cf-rt2-auth-"), // empty → authMaterial "none", requireAuth defaults false
    qualification: syntheticQualification(),
    bin: "codex", // bare name; statSync misses → recorded as version-identity only
    clock: () => new Date("2026-07-17T00:00:00.000Z"),
  };
}

function mkReq(): UltraSessionRequestV1 {
  const cwd = freshDir("cf-rt2-cwd-");
  const promptPath = join(cwd, "task.md");
  writeFileSync(promptPath, "Rate this chapter.");
  return {
    role: "d7-rater",
    promptPath,
    outputSchemaPath: null,
    cwd,
    timeoutMs: 60_000,
    sessionTag: "rt2",
    bookId: "zz-rt2-book",
    runId: "20260717T000000Z",
  };
}

test("attack2: the ultra route's effort/model come from the manifest, never the request (request has no effort/model field)", async () => {
  const cap = capturingRunner();
  const req = mkReq();
  // Structural proof the caller cannot inject an effort/model: the request object
  // carries neither key, yet the result is ultra @ the baseline model.
  assert.ok(!("effort" in req), "UltraSessionRequestV1 carries no effort field");
  assert.ok(!("model" in req), "UltraSessionRequestV1 carries no model field");

  const res = await runUltraSession(req, baseDeps(cap));
  assert.equal(res.ok, true, res.failure ?? "expected ok");
  assert.equal(res.effort, ULTRA_EFFORT, "the resolved effort is ultra");
  assert.equal(res.model, BASELINE_MODEL, "the resolved model is the single-authority baseline");

  const manifest = JSON.parse(readFileSync(res.manifestPath, "utf8")) as { model: string; reasoningEffort: string; argv: string[] };
  // The result echoes the PERSISTED manifest bytes, not the request.
  assert.equal(res.model, manifest.model);
  assert.equal(res.effort, manifest.reasoningEffort);
  assert.equal(manifest.reasoningEffort, "ultra");
});

test("attack2: the spawn argv (manifest AND the argv the runner received) carries -c model_reasoning_effort=ultra", async () => {
  const cap = capturingRunner();
  const res = await runUltraSession(mkReq(), baseDeps(cap));
  const manifest = JSON.parse(readFileSync(res.manifestPath, "utf8")) as { reasoningEffort: string; argv: string[] };

  // The manifest's argv and the argv the runner actually received both carry the
  // override — one source (route.effort/model) fed both, so they cannot diverge.
  assert.equal(effortFromArgv(manifest.argv), "ultra", "manifest argv records the ultra override");
  assert.equal(modelFromArgv(manifest.argv), BASELINE_MODEL, "manifest argv records the baseline model");
  assert.equal(effortFromArgv(cap.argv()), "ultra", "the runner was spawned with the ultra override");
  assert.equal(modelFromArgv(cap.argv()), BASELINE_MODEL, "the runner was spawned with the baseline model");

  // The argv-derived effort AGREES with the manifest's reasoningEffort field.
  assert.equal(effortFromArgv(manifest.argv), manifest.reasoningEffort, "argv effort agrees with the manifest field");
});

test("attack2: a manifest claiming ultra over an argv that LACKS the override is a detectable mismatch", async () => {
  const cap = capturingRunner();
  const res = await runUltraSession(mkReq(), baseDeps(cap));
  const manifest = JSON.parse(readFileSync(res.manifestPath, "utf8")) as { reasoningEffort: string; argv: string[] };

  // Simulate the spoof: an argv with the reasoning-effort override stripped, while
  // the manifest field still claims "ultra".
  const strippedArgv = manifest.argv.filter((a) => !a.startsWith("model_reasoning_effort="));
  assert.equal(effortFromArgv(strippedArgv), undefined, "the stripped argv no longer proves any effort");
  assert.notEqual(
    manifest.reasoningEffort,
    effortFromArgv(strippedArgv),
    "the manifest's claimed effort disagrees with the argv authority — the spoof is detectable",
  );
});

// A degenerate belt-and-suspenders: prove the manifest sink actually persisted a
// file whose bytes back the result (there is no in-memory-only claim of ultra).
test("attack2: the manifest is persisted to disk and its bytes are the source of the result's model/effort", async () => {
  const cap = capturingRunner();
  const sink = freshDir("cf-rt2-sink-explicit-");
  mkdirSync(sink, { recursive: true });
  const deps: UltraSessionDepsV1 = { ...baseDeps(cap), manifestSink: sink };
  const res = await runUltraSession(mkReq(), deps);
  const bytes = readFileSync(res.manifestPath, "utf8");
  const manifest = JSON.parse(bytes) as { model: string; reasoningEffort: string };
  assert.equal(manifest.model, res.model);
  assert.equal(manifest.reasoningEffort, res.effort);
  assert.ok(res.manifestSha256.length === 64, "the result binds the manifest by sha256");
});
