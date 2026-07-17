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
import {
  TMP_DIR,
  STATE_CHAPTERS,
  STATE_INDEXES,
  makeChapter,
  writeCanonicalIndexFixture,
  writeFixtureBook,
} from "./helpers.js";
import {
  bookHasExistingState,
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

// ── WP-602b: fresh-vs-resume-vs-existing gate on the per-book checks ───────────
//
// The per-book EXISTING-STATE checks (dual-brief, chapter-numbers, canonical-set,
// TOC, sweep-history) presume the book already has authored/indexed state on disk
// — checkCanonicalChapterSet is FATAL for a book with no canonical index. A FRESH
// generate-book run (the primary use case) has none of that yet (the pipeline
// CREATES it), so runGeneratePreflightChecks must SKIP them for a genuinely new
// book while still fataling on a --resume over inconsistent state. These drive the
// REAL doctor against the REAL deterministic on-disk probe (fixtures written to and
// cleaned from the pipeline state dirs by explicit path — the SAME pattern
// generate-book-cli.test.ts uses), never a stub. Zero model/network calls.

const PER_BOOK_CHECKS = new Set([
  "dual-brief", "chapter-numbers", "chapter-parse", "canonical-chapter-set", "toc-contract", "sweep-history",
]);

test("bookHasExistingState: false for a nonexistent book; true once a canonical index is on disk (deterministic probe, no live call)", () => {
  const bookId = "zz-wp602b-probe";
  assert.equal(bookHasExistingState(bookId), false, "a book with no index/chapters is genuinely fresh");
  writeCanonicalIndexFixture(bookId, [{ chapterId: `${bookId}-ch01`, number: 1, title: "One" }]);
  const indexPath = resolve(STATE_INDEXES, `${bookId}.json`);
  try {
    assert.equal(bookHasExistingState(bookId), true, "an on-disk canonical index makes the probe true (expects existing state)");
  } finally {
    rmSync(indexPath, { force: true });
  }
});

test("runGeneratePreflightChecks: a FRESH new book (no state, not --resume) SKIPS the per-book existing-state checks — the run can start (WP-602b / L-33)", async () => {
  const bookId = "zz-wp602b-fresh-nonexistent";
  assert.equal(bookHasExistingState(bookId), false, "precondition: the fresh book has no canonical index/chapters on disk");
  const findings = await runGeneratePreflightChecks({ bookId });
  const perBookFatals = findings.filter((f) => f.level === "fatal" && PER_BOOK_CHECKS.has(f.check));
  assert.deepEqual(perBookFatals, [], "a fresh new book must NOT fatal on any per-book existing-state check (esp. canonical-chapter-set)");
  assert.equal(findings.find((f) => f.check === "canonical-chapter-set"), undefined, "the offending check is not even run on the fresh path");
  const skip = findings.find((f) => f.check === "per-book-existing-state");
  assert.ok(skip && skip.level === "ok", "the skip is emitted as an informational ok, never a fatal");
  assert.match(skip!.message, /not applicable/, "the skip explains WHY (the pipeline creates this state)");
});

test("runGeneratePreflightChecks: the GLOBAL checks still run (and can fatal) on the fresh path — an unsupported model is STILL fatal while the per-book checks are skipped (globals not weakened)", async () => {
  const bookId = "zz-wp602b-fresh-globals";
  const findings = await runGeneratePreflightChecks({ bookId, model: "gpt-5.5" });
  const model = findings.find((f) => f.check === "model-config-support")!;
  assert.equal(model.level, "fatal", "a global-tier WP-602 check still fatals on the fresh path");
  assert.equal(doctorExitCode(findings), 2, "the composed exit is still fatal (2) — the fresh gate did not weaken the global battery");
  // The fatal is the GLOBAL model check, never a per-book existing-state check.
  const perBookFatals = findings.filter((f) => f.level === "fatal" && PER_BOOK_CHECKS.has(f.check));
  assert.deepEqual(perBookFatals, []);
  // shadow-state-dir + untracked-imports (the always-on global battery) are present.
  const names = findings.map((f) => f.check);
  for (const g of ["shadow-state-dir", "untracked-imports"]) assert.ok(names.includes(g), `global check "${g}" still runs on the fresh path`);
});

test("runGeneratePreflightChecks: --resume over a book with MISSING canonical state is STILL fatal — a resume MUST verify its integrity, never skip (WP-602b)", async () => {
  const bookId = "zz-wp602b-resume-missing";
  assert.equal(bookHasExistingState(bookId), false, "precondition: nothing on disk");
  const findings = await runGeneratePreflightChecks({ bookId, resume: true });
  const canonical = findings.find((f) => f.check === "canonical-chapter-set");
  assert.ok(canonical, "--resume runs the per-book existing-state checks even with nothing on disk");
  assert.equal(canonical!.level, "fatal", "a resume over a missing canonical index must FATAL — the skip must never apply to a resume");
  assert.equal(doctorExitCode(findings), 2);
  assert.equal(findings.find((f) => f.check === "per-book-existing-state"), undefined, "the fresh-skip is NEVER emitted on a resume");
});

test("runGeneratePreflightChecks: a CONSISTENT existing book PASSES the per-book checks — under --resume AND on-disk-without-resume (interrupted mid-authoring) (WP-602b)", async () => {
  const bookId = "zz-wp602b-consistent";
  const ch1 = makeChapter(bookId, 1);
  const files = writeFixtureBook(STATE_CHAPTERS, [ch1]);
  writeCanonicalIndexFixture(bookId, [{ chapterId: ch1.chapterId, number: 1, title: ch1.title }]);
  const indexPath = resolve(STATE_INDEXES, `${bookId}.json`);
  try {
    assert.equal(bookHasExistingState(bookId), true, "precondition: the fixture book HAS canonical state on disk");

    // (c) --resume: the per-book checks run and pass over a consistent book.
    const resumed = await runGeneratePreflightChecks({ bookId, resume: true });
    const canonicalResume = resumed.find((f) => f.check === "canonical-chapter-set");
    assert.ok(canonicalResume && canonicalResume.level === "ok", `canonical-chapter-set must PASS for a consistent book on resume: ${canonicalResume?.message}`);
    assert.equal(resumed.find((f) => f.check === "per-book-existing-state"), undefined, "an existing book runs the REAL checks, not the fresh skip");
    assert.deepEqual(resumed.filter((f) => f.level === "fatal" && PER_BOOK_CHECKS.has(f.check)), []);

    // existing-state-on-disk WITHOUT --resume: the deterministic probe alone triggers the checks.
    const onDisk = await runGeneratePreflightChecks({ bookId, resume: false });
    const canonicalOnDisk = onDisk.find((f) => f.check === "canonical-chapter-set");
    assert.ok(canonicalOnDisk && canonicalOnDisk.level === "ok", "an interrupted-mid-authoring book (state on disk, not a resume) still runs the per-book checks and passes");
    assert.equal(onDisk.find((f) => f.check === "per-book-existing-state"), undefined, "a book with state on disk is not treated as fresh");
    assert.deepEqual(onDisk.filter((f) => f.level === "fatal" && PER_BOOK_CHECKS.has(f.check)), []);
  } finally {
    for (const f of files) rmSync(f, { force: true });
    rmSync(indexPath, { force: true });
  }
});

test("runGeneratePreflightChecks: the bookHasExistingStateOverride test seam forces the gate deterministically, independent of disk", async () => {
  const bookId = "zz-wp602b-override";
  // override=false, no resume → the fresh skip (per-book checks not run).
  const skipped = await runGeneratePreflightChecks({ bookId, bookHasExistingStateOverride: false });
  assert.ok(skipped.find((f) => f.check === "per-book-existing-state"), "override=false forces the fresh-skip path");
  assert.equal(skipped.find((f) => f.check === "canonical-chapter-set"), undefined);
  // override=true → the REAL per-book checks run (and, against a nonexistent book, canonical-set fatals).
  const ran = await runGeneratePreflightChecks({ bookId, bookHasExistingStateOverride: true });
  assert.equal(ran.find((f) => f.check === "per-book-existing-state"), undefined, "override=true forces the existing-state path");
  const canonical = ran.find((f) => f.check === "canonical-chapter-set");
  assert.ok(canonical && canonical.level === "fatal", "override=true runs the real per-book checks against disk");
});

test("doctor-preflight scratch tree is removed", () => {
  rmSync(ROOT, { recursive: true, force: true });
});
