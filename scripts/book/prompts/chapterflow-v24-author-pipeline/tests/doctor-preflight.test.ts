/**
 * WP-602 — the deterministic generate-book preflight (master plan §8 WP-602).
 *
 * Each new doctor check gets its pass AND fail path exercised here, plus the
 * exit-code mapping and the checklist formatter. Git-touching checks are
 * driven through an INJECTED fake runner (the same pattern
 * tests/publish-after-qc-git.test.ts already uses for `publishBranchError`/
 * `dirtyVsHead`) rather than a real git subprocess, so these tests are
 * hermetic and independent of THIS worktree's own (constantly changing,
 * mid-development) git state. Zero model/network calls anywhere in this file.
 */

import assert from "node:assert/strict";
import { mkdirSync, rmSync, writeFileSync } from "fs";
import { resolve } from "path";

import { test } from "./harness.js";
import { TMP_DIR } from "./helpers.js";
import {
  checkBaseShaMatch,
  checkBranchSanity,
  checkD7AuditToolingReachable,
  checkModelConfigSupport,
  checkNameBankConfig,
  checkSchemaFixtures,
  checkWorktreeClean,
  doctorExitCode,
  formatGeneratePreflightChecklist,
  runGeneratePreflightChecks,
  type DoctorFinding,
} from "../src/lifecycle/doctor.js";
import type { ContractManifest } from "../src/contracts/index.js";
import { driftedEmissionSample } from "../src/contracts/emissionPackage.js";

const ROOT = resolve(TMP_DIR, "doctor-preflight");

function freshDir(name: string): string {
  const dir = resolve(ROOT, name);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  return dir;
}

// ── worktree-clean ───────────────────────────────────────────────────────────

test("checkWorktreeClean: a clean tree reports ok", () => {
  const f = checkWorktreeClean({ runner: () => "" });
  assert.equal(f.check, "worktree-clean");
  assert.equal(f.level, "ok");
});

test("checkWorktreeClean: a dirty tree is a soft warn by default (not required)", () => {
  const f = checkWorktreeClean({ runner: () => " M src/cli.ts\n?? scratch.txt\n" });
  assert.equal(f.level, "warn");
  assert.match(f.message, /2 uncommitted change/);
});

test("checkWorktreeClean: a dirty tree is fatal when the run demands a clean worktree", () => {
  const f = checkWorktreeClean({ require: true, runner: () => " M src/cli.ts\n" });
  assert.equal(f.level, "fatal");
  assert.match(f.message, /demands a clean worktree/);
});

test("checkWorktreeClean: an undeterminable git failure warns, never a silent ok", () => {
  const f = checkWorktreeClean({ runner: () => { throw new Error("git not found"); } });
  assert.equal(f.level, "warn");
  assert.match(f.message, /could not determine worktree cleanliness/);
});

test("checkWorktreeClean: the real (default) git runner returns a well-formed finding", () => {
  // Smoke-tests the actual wiring against this real worktree without asserting
  // a specific cleanliness state (which varies during active development).
  const f = checkWorktreeClean();
  assert.equal(f.check, "worktree-clean");
  assert.ok(["ok", "warn", "fatal"].includes(f.level));
});

// ── base-sha-match ───────────────────────────────────────────────────────────

test("checkBaseShaMatch: no expected SHA configured is not applicable (ok)", () => {
  const f = checkBaseShaMatch(undefined, { runner: () => "deadbeef1234\n" });
  assert.equal(f.check, "base-sha-match");
  assert.equal(f.level, "ok");
  assert.match(f.message, /not applicable/);
});

test("checkBaseShaMatch: a too-short expected SHA warns instead of risking a prefix collision", () => {
  const f = checkBaseShaMatch("abc123", { runner: () => "abc1234567890\n" });
  assert.equal(f.level, "warn");
  assert.match(f.message, /too short/);
});

test("checkBaseShaMatch: matching HEAD (exact or prefix) is ok", () => {
  const exact = checkBaseShaMatch("deadbeef1234567890", { runner: () => "deadbeef1234567890\n" });
  assert.equal(exact.level, "ok");
  const prefix = checkBaseShaMatch("deadbeef123", { runner: () => "deadbeef1234567890abcdef\n" });
  assert.equal(prefix.level, "ok");
});

test("checkBaseShaMatch: a mismatched HEAD is fatal", () => {
  const f = checkBaseShaMatch("0000000000000000000000000000000000000000", { runner: () => "deadbeef1234567890abcdef\n" });
  assert.equal(f.level, "fatal");
  assert.match(f.message, /not based on the approved SHA/);
});

test("checkBaseShaMatch: an undeterminable git failure warns", () => {
  const f = checkBaseShaMatch("deadbeef1234567890", { runner: () => { throw new Error("no HEAD"); } });
  assert.equal(f.level, "warn");
  assert.match(f.message, /could not determine current HEAD SHA/);
});

// ── branch-sanity (reuses publishBranchError) ───────────────────────────────

test("checkBranchSanity: on main is ok", async () => {
  const onBranch = (branch: string) => (_cmd: string, a: string[]): string =>
    a.join(" ") === "rev-parse --abbrev-ref HEAD" ? `${branch}\n` : "";
  const f = await checkBranchSanity({ runner: onBranch("main") });
  assert.equal(f.check, "branch-sanity");
  assert.equal(f.level, "ok");
});

test("checkBranchSanity: off main is an advisory warn, not fatal (generation doesn't require main)", async () => {
  const onBranch = (branch: string) => (_cmd: string, a: string[]): string =>
    a.join(" ") === "rev-parse --abbrev-ref HEAD" ? `${branch}\n` : "";
  const f = await checkBranchSanity({ runner: onBranch("wp-602-preflight-doctor") });
  assert.equal(f.level, "warn");
  assert.match(f.message, /Refusing to publish off main/);
  assert.match(f.message, /wp-602-preflight-doctor/);
});

test("checkBranchSanity: CHAPTERFLOW_ALLOW_PUBLISH_BRANCH=1 overrides to ok", async () => {
  const onBranch = (branch: string) => (_cmd: string, a: string[]): string =>
    a.join(" ") === "rev-parse --abbrev-ref HEAD" ? `${branch}\n` : "";
  const prev = process.env.CHAPTERFLOW_ALLOW_PUBLISH_BRANCH;
  process.env.CHAPTERFLOW_ALLOW_PUBLISH_BRANCH = "1";
  try {
    const f = await checkBranchSanity({ runner: onBranch("feat/x") });
    assert.equal(f.level, "ok");
  } finally {
    if (prev === undefined) delete process.env.CHAPTERFLOW_ALLOW_PUBLISH_BRANCH;
    else process.env.CHAPTERFLOW_ALLOW_PUBLISH_BRANCH = prev;
  }
});

// ── model-config-support ────────────────────────────────────────────────────

test("checkModelConfigSupport: defaults (no explicit model/effort) resolve to the confirmed normal-profile model", () => {
  const f = checkModelConfigSupport();
  assert.equal(f.check, "model-config-support");
  assert.equal(f.level, "ok");
  assert.match(f.message, /confirmed 5\.6 candidate/);
});

test("checkModelConfigSupport: an unsupported model family is fatal", () => {
  const f = checkModelConfigSupport({ model: "gpt-5.5" });
  assert.equal(f.level, "fatal");
  assert.match(f.message, /not in the 5\.6 candidate set/);
});

test("checkModelConfigSupport: an unconfirmed 5.6 candidate (terra/luna) warns, not fatal", () => {
  const f = checkModelConfigSupport({ model: "gpt-5.6-terra" });
  assert.equal(f.level, "warn");
  assert.match(f.message, /not yet confirmed/);
});

test("checkModelConfigSupport: an unsupported effort is fatal even with a confirmed model", () => {
  const f = checkModelConfigSupport({ model: "gpt-5.6-sol", effort: "ultra" });
  assert.equal(f.level, "fatal");
  assert.match(f.message, /not a supported reasoning effort/);
});

test("checkModelConfigSupport: a confirmed model + supported effort is ok", () => {
  const f = checkModelConfigSupport({ model: "gpt-5.6-sol", effort: "xhigh" });
  assert.equal(f.level, "ok");
  assert.match(f.message, /effort "xhigh" is supported/);
});

// ── schema-fixtures ──────────────────────────────────────────────────────────

test("checkSchemaFixtures: the real committed manifest + canonical emission sample are valid (ok)", () => {
  const f = checkSchemaFixtures();
  assert.equal(f.check, "schema-fixtures");
  assert.equal(f.level, "ok", f.message);
});

test("checkSchemaFixtures: a malformed contract manifest fails closed", () => {
  const corrupt: ContractManifest = {
    schema: "contract-manifest-v1",
    frozenAtIso: "2020-01-01T00:00:00.000Z",
    contracts: [{ name: "bogus-contract-does-not-exist", version: 1, ownerPrompt: "x", hash: "0".repeat(64) }],
  };
  const f = checkSchemaFixtures({ manifest: corrupt });
  assert.equal(f.level, "fatal");
  assert.match(f.message, /schema-fixture issue/);
});

test("checkSchemaFixtures: a drifted emission fixture fails closed", () => {
  const f = checkSchemaFixtures({ emission: driftedEmissionSample() });
  assert.equal(f.level, "fatal");
});

// ── name-bank-config ─────────────────────────────────────────────────────────

test("checkNameBankConfig: the real committed config is present and non-corrupt (ok)", () => {
  const f = checkNameBankConfig();
  assert.equal(f.check, "name-bank-config");
  assert.equal(f.level, "ok", f.message);
});

test("checkNameBankConfig: a corrupt name-bank.json fails closed (fatal), never crashes the preflight", () => {
  const dir = freshDir("corrupt-name-bank");
  const badBank = resolve(dir, "name-bank.json");
  writeFileSync(badBank, "{ this is not valid json", "utf8");
  const f = checkNameBankConfig({ nameBankPath: badBank });
  assert.equal(f.level, "fatal");
  assert.match(f.message, /name-bank\/config unreadable or corrupt/);
});

test("checkNameBankConfig: a corrupt banned-connectives.json also fails closed", () => {
  const dir = freshDir("corrupt-banned-connectives");
  const badConnectives = resolve(dir, "banned-connectives.json");
  writeFileSync(badConnectives, "not json at all", "utf8");
  const f = checkNameBankConfig({ bannedConnectivesPath: badConnectives });
  assert.equal(f.level, "fatal");
});

test("checkNameBankConfig: a valid-but-empty bank degrades to a warn, not a crash", () => {
  const dir = freshDir("empty-name-bank");
  const emptyBank = resolve(dir, "name-bank.json");
  writeFileSync(emptyBank, "{}", "utf8");
  const f = checkNameBankConfig({ nameBankPath: emptyBank });
  assert.equal(f.level, "warn");
  assert.match(f.message, /zero bankable names/);
});

// ── d7-audit-tooling ─────────────────────────────────────────────────────────

test("checkD7AuditToolingReachable: REQUIRE mode unset is a no-op ok", async () => {
  const f = await checkD7AuditToolingReachable(false);
  assert.equal(f.check, "d7-audit-tooling");
  assert.equal(f.level, "ok");
  assert.match(f.message, /is not set/);
});

test("checkD7AuditToolingReachable: REQUIRE mode set resolves the real rubric-audit dispatcher + resolver", async () => {
  const f = await checkD7AuditToolingReachable(true);
  assert.equal(f.level, "ok", f.message);
  assert.match(f.message, /reachable/);
});

// ── doctorExitCode mapping (extended battery) ───────────────────────────────

test("doctorExitCode: fatal -> 2, warn -> 1, all-ok -> 0, for the new checks too", () => {
  const ok: DoctorFinding = { level: "ok", check: "x", message: "" };
  const warn: DoctorFinding = { level: "warn", check: "x", message: "" };
  const fatal: DoctorFinding = { level: "fatal", check: "x", message: "" };
  assert.equal(doctorExitCode([ok]), 0);
  assert.equal(doctorExitCode([ok, warn]), 1);
  assert.equal(doctorExitCode([ok, warn, fatal]), 2);
  assert.equal(doctorExitCode([fatal, warn]), 2, "fatal always wins regardless of order");
});

// ── formatGeneratePreflightChecklist (reuses formatPreflightChecklist) ──────

test("formatGeneratePreflightChecklist: renders a definition-of-done checklist via the reused formatter", async () => {
  const findings: DoctorFinding[] = [
    { level: "ok", check: "worktree-clean", message: "clean" },
    { level: "fatal", check: "model-config-support", message: "model not in candidate set" },
  ];
  const out = await formatGeneratePreflightChecklist(findings);
  assert.match(out, /1\/2 checks passed/);
  assert.match(out, /✓ worktree-clean/);
  assert.match(out, /✗ model-config-support \(1 blocker\(s\)\)/);
});

// ── runGeneratePreflightChecks: the composed battery, all-clean end to end ─

test("runGeneratePreflightChecks: composes the existing doctor battery with every new WP-602 check", async () => {
  const findings = await runGeneratePreflightChecks({});
  const names = findings.map((f) => f.check);
  for (const expected of [
    "shadow-state-dir", "untracked-imports", // pre-existing doctor battery, reused verbatim
    "worktree-clean", "base-sha-match", "branch-sanity",
    "model-config-support", "schema-fixtures", "name-bank-config", "d7-audit-tooling",
  ]) {
    assert.ok(names.includes(expected), `expected "${expected}" among: ${names.join(", ")}`);
  }
  // Model-config-support and schema-fixtures and name-bank-config are all evaluated
  // against real, healthy production config/data on this checkout, so a bystander
  // call (no overrides) must not be fatal on any of THOSE specific checks.
  const alwaysCleanChecks = new Set(["model-config-support", "schema-fixtures", "name-bank-config", "d7-audit-tooling"]);
  const unexpectedFatals = findings.filter((f) => f.level === "fatal" && alwaysCleanChecks.has(f.check));
  assert.deepEqual(unexpectedFatals, []);
});

test("runGeneratePreflightChecks: an unsupported model makes the composed exit code fatal (2)", async () => {
  const findings = await runGeneratePreflightChecks({ model: "gpt-5.5" });
  assert.equal(doctorExitCode(findings), 2, "an unsupported model must fail closed with exit 2");
  const modelFinding = findings.find((f) => f.check === "model-config-support")!;
  assert.equal(modelFinding.level, "fatal");
});

test("doctor-preflight scratch tree is removed", () => {
  rmSync(ROOT, { recursive: true, force: true });
});
