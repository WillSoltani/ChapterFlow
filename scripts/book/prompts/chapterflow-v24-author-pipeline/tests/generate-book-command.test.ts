/**
 * WP-601 — the `generate-book` consolidated terminal command (master plan §8 WP-601).
 *
 * Every test is MODEL-FREE. The command's real author-first execution (which spawns
 * codex sessions) is driven through the injected `runConductor` seam — a fake conductor
 * that returns a scripted AutopilotOutcome and, where a test needs it, writes the exact
 * sidecars promoteBook (WP-401) would. Zero live model calls; a REAL book run is a
 * Phase-6+ owner-authorized action (ledger L-14/L-22). The conductor's own correctness
 * (resume-only-missing WP-103, D7 gate WP-401, ledger WP-503) is covered by author-arch /
 * chapter-transaction / d7-ship-gate / run-call-ledger; this file covers the ENTRY/ARGS/
 * EXIT WIRING that WP-601 owns.
 */

import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, statSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join, resolve } from "path";

import { test } from "./harness.js";
import {
  GENERATE_BOOK_EXIT,
  classifyOutcomeExit,
  defaultGenerateBookDeps,
  generateBookArchitecture,
  generateBookCommand,
  parseGenerateBookArgs,
  resolveGenerateBookConfig,
  type GenerateBookConfig,
  type GenerateBookDeps,
  type GenerateBookParsed,
} from "../src/orchestrator/generateBookCommand.js";
import { runAutopilot } from "../src/orchestrator/autopilot.js";
import { runGeneratePreflightChecks } from "../src/lifecycle/doctor.js";
import { d7ShipGateHaltPath, CHAPTERFLOW_REQUIRE_D7_SHIP_GATE_ENV } from "../src/critics/d7ShipGate.js";
import type { AutopilotOptions, AutopilotOutcome } from "../src/orchestrator/autopilot.js";
import type { DoctorFinding } from "../src/lifecycle/doctor.js";

const TMP = mkdtempSync(join(tmpdir(), "gen-book-"));

// ── test harness: injected deps ──────────────────────────────────────────────

type Harness = {
  deps: Partial<GenerateBookDeps>;
  logs: string[];
  env: Record<string, string | undefined>;
  conductorCalls: Array<{ opts: AutopilotOptions; envAtCall: Record<string, string | undefined> }>;
  out: string;
};

function mkHarness(opts: {
  outcome?: AutopilotOutcome | ((o: AutopilotOptions) => AutopilotOutcome | Promise<AutopilotOutcome>);
  preflight?: DoctorFinding[];
  config?: GenerateBookConfig;
  packageExists?: boolean;
  stateBooksDir?: string;
  runConductor?: GenerateBookDeps["runConductor"];
} = {}): Harness {
  const logs: string[] = [];
  const env: Record<string, string | undefined> = {};
  const conductorCalls: Harness["conductorCalls"] = [];
  const stateBooksDir = opts.stateBooksDir ?? mkdtempSync(join(TMP, "state-books-"));
  const bookRoot = mkdtempSync(join(TMP, "pkgs-"));
  const runConductor: GenerateBookDeps["runConductor"] =
    opts.runConductor ??
    (async (o: AutopilotOptions) => {
      conductorCalls.push({ opts: o, envAtCall: { ...env } });
      const outcome = opts.outcome ?? ({ status: "published", bookId: o.bookId, roundId: "r1", message: "PUBLISHED (fake)" } as AutopilotOutcome);
      return typeof outcome === "function" ? outcome(o) : outcome;
    });
  const deps: Partial<GenerateBookDeps> = {
    runConductor,
    runPreflight: async () => opts.preflight ?? [{ level: "ok", check: "stub", message: "all clear" }],
    loadConfigFile: () => opts.config ?? {},
    now: () => 1_000_000,
    log: (l) => logs.push(l),
    env,
    stateBooksDir,
    packagePath: (b) => resolve(bookRoot, `${b}.v21.json`),
    ledgerPaths: (b, runId) => ({
      jsonl: resolve(TMP, "ledger", b, `${runId}.jsonl`),
      summary: resolve(TMP, "ledger", b, `${runId}.summary.json`),
      bookRollup: resolve(TMP, "ledger", b, "book-rollup.json"),
    }),
  };
  if (opts.packageExists) {
    mkdirSync(bookRoot, { recursive: true });
    writeFileSync(deps.packagePath!("zz-book"), "{}", "utf8");
  }
  return {
    deps,
    logs,
    env,
    conductorCalls,
    get out() { return logs.join("\n"); },
  };
}

function parse(args: string[], flags: Record<string, string | boolean>): GenerateBookParsed {
  const r = parseGenerateBookArgs(args, flags);
  assert.equal(r.ok, true, r.ok ? "" : r.message);
  if (!r.ok) throw new Error("unreachable");
  return r.parsed;
}

const OK_FLAGS = { title: "T", author: "A" } as const;

// ── parse / usage (exit 2) ────────────────────────────────────────────────────

test("parse: missing bookId → usage exit 2", () => {
  const r = parseGenerateBookArgs([], { ...OK_FLAGS });
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.code, GENERATE_BOOK_EXIT.USAGE);
});

test("parse: missing --title/--author → usage exit 2", () => {
  const a = parseGenerateBookArgs(["zz-book"], { author: "A" });
  const b = parseGenerateBookArgs(["zz-book"], { title: "T" });
  assert.equal(a.ok, false);
  assert.equal(b.ok, false);
  if (!a.ok) assert.equal(a.code, GENERATE_BOOK_EXIT.USAGE);
});

test("parse: architecture default is author; --compiler/--legacy opt in", () => {
  assert.equal(generateBookArchitecture({}), "author");
  assert.equal(generateBookArchitecture({ compiler: true }), "compiler");
  assert.equal(generateBookArchitecture({ legacy: true }), "legacy");
  // legacy wins over compiler (mirrors autopilot.architectureFromFlags precedence)
  assert.equal(generateBookArchitecture({ legacy: true, compiler: true }), "legacy");
});

// ── config precedence: explicit flag > --config file > default ─────────────────

test("config precedence: explicit flag beats config file beats default", () => {
  const p = parse(["zz-book"], { ...OK_FLAGS, effort: "high" }); // CLI --effort=high
  const resolved = resolveGenerateBookConfig(p, { effort: "medium", model: "gpt-5.6-sol", out: "/cfg/out" });
  assert.equal(resolved.effort, "high", "explicit --effort flag wins over the config file");
  assert.equal(resolved.sources.effort, "flag");
  assert.equal(resolved.model, "gpt-5.6-sol", "config-file model applies when no --model flag");
  assert.equal(resolved.sources.model, "config");
  assert.equal(resolved.out, "/cfg/out");
  assert.equal(resolved.sources.out, "config");
});

test("config precedence: defaults for requireD7/autoPublish; opt-out flags flip them", () => {
  const dflt = resolveGenerateBookConfig(parse(["zz-book"], { ...OK_FLAGS }), {});
  assert.equal(dflt.requireD7ShipGate, true, "D7 REQUIRE mode is on by default (S-tier terminal command)");
  assert.equal(dflt.autoPublish, true, "auto-publish on by default");
  assert.equal(dflt.sources.requireD7ShipGate, "default");

  const optOut = resolveGenerateBookConfig(parse(["zz-book"], { ...OK_FLAGS, "d7-advisory": true, "no-publish": true }), {});
  assert.equal(optOut.requireD7ShipGate, false, "--d7-advisory opts OUT of REQUIRE mode");
  assert.equal(optOut.autoPublish, false, "--no-publish opts OUT of auto-publish");
  assert.equal(optOut.sources.requireD7ShipGate, "flag");
});

// ── model config (WP-504, fail-closed BEFORE any work) ─────────────────────────

test("unsupported --model fails closed (UNSUPPORTED_MODEL_CONFIG, exit 2) before the conductor runs", async () => {
  const h = mkHarness();
  const r = await generateBookCommand(parse(["zz-book"], { ...OK_FLAGS, model: "gpt-4o" }), h.deps);
  assert.equal(r.code, GENERATE_BOOK_EXIT.USAGE);
  assert.equal(r.label, "UNSUPPORTED_MODEL_CONFIG");
  assert.equal(r.ranConductor, false, "no work may follow an unsupported model selection");
  assert.equal(h.conductorCalls.length, 0);
  assert.match(h.out, /UNSUPPORTED_MODEL_CONFIG/);
});

test("unsupported --effort fails closed (exit 2) before the conductor runs", async () => {
  const h = mkHarness();
  const r = await generateBookCommand(parse(["zz-book"], { ...OK_FLAGS, effort: "max" }), h.deps);
  assert.equal(r.code, GENERATE_BOOK_EXIT.USAGE);
  assert.equal(r.label, "UNSUPPORTED_MODEL_CONFIG");
  assert.equal(h.conductorCalls.length, 0);
});

test("a supported-but-non-baseline --model is REFUSED (no silent re-route), exit 2", async () => {
  // gpt-5.6-terra is a valid 5.6 candidate (passes WP-504) but is NOT the wired
  // production route — the command must refuse rather than print terra and run sol.
  const h = mkHarness();
  const r = await generateBookCommand(parse(["zz-book"], { ...OK_FLAGS, model: "gpt-5.6-terra" }), h.deps);
  assert.equal(r.code, GENERATE_BOOK_EXIT.USAGE);
  assert.equal(r.label, "UNSUPPORTED_MODEL_CONFIG");
  assert.equal(h.conductorCalls.length, 0, "no run may follow a non-baseline model selection");
  assert.match(h.out, /not the wired production route/i);
});

test("the wired baseline --model gpt-5.6-sol is accepted and runs", async () => {
  const h = mkHarness();
  const r = await generateBookCommand(parse(["zz-book"], { ...OK_FLAGS, model: "gpt-5.6-sol" }), h.deps);
  assert.equal(r.code, GENERATE_BOOK_EXIT.OK);
  assert.equal(h.conductorCalls.length, 1);
});

// ── --validate-only: preflight only, zero authoring, doctor 0/1/2 ──────────────

test("--validate-only runs preflight ONLY and exits with the doctor code (ok→0)", async () => {
  const h = mkHarness({ preflight: [{ level: "ok", check: "x", message: "ok" }] });
  const r = await generateBookCommand(parse(["zz-book"], { ...OK_FLAGS, "validate-only": true }), h.deps);
  assert.equal(r.code, 0);
  assert.equal(r.label, "VALIDATE_ONLY");
  assert.equal(r.ranConductor, false, "validate-only makes ZERO authoring calls");
  assert.equal(h.conductorCalls.length, 0);
});

test("--validate-only: a warn finding exits 1; a fatal finding exits 2", async () => {
  const warn = mkHarness({ preflight: [{ level: "warn", check: "worktree-clean", message: "dirty" }] });
  const rw = await generateBookCommand(parse(["zz-book"], { ...OK_FLAGS, "validate-only": true }), warn.deps);
  assert.equal(rw.code, 1);

  const fatal = mkHarness({ preflight: [{ level: "fatal", check: "base-sha-match", message: "mismatch" }] });
  const rf = await generateBookCommand(parse(["zz-book"], { ...OK_FLAGS, "validate-only": true }), fatal.deps);
  assert.equal(rf.code, 2);
  assert.equal(rf.ranConductor, false);
});

// ── run-path preflight: a FATAL finding blocks with exit 2 (no run) ────────────

test("run path: a FATAL preflight finding refuses the run with exit 2 (conductor never runs)", async () => {
  const h = mkHarness({ preflight: [{ level: "fatal", check: "model-config-support", message: "unsupported" }] });
  const r = await generateBookCommand(parse(["zz-book"], { ...OK_FLAGS }), h.deps);
  assert.equal(r.code, GENERATE_BOOK_EXIT.USAGE);
  assert.equal(r.label, "PREFLIGHT_FATAL");
  assert.equal(h.conductorCalls.length, 0);
});

test("run path: preflight WARNs are advisory — the run proceeds", async () => {
  const h = mkHarness({ preflight: [{ level: "warn", check: "worktree-clean", message: "dirty" }] });
  const r = await generateBookCommand(parse(["zz-book"], { ...OK_FLAGS }), h.deps);
  assert.equal(r.code, GENERATE_BOOK_EXIT.OK);
  assert.equal(h.conductorCalls.length, 1);
  assert.match(h.out, /advisory — run proceeds/);
});

// ── --dry-run: plan the run, zero model calls, zero mutations ──────────────────

test("--dry-run routes the conductor in plan mode (zero calls, zero mutations), exit 0", async () => {
  let sawPlan = false;
  const h = mkHarness({
    runConductor: async (o) => {
      sawPlan = o.plan === true;
      assert.equal(o.plan, true, "--dry-run must invoke the conductor with plan:true (no authoring)");
      return { status: "ready", bookId: o.bookId, message: "(plan only)" };
    },
  });
  const r = await generateBookCommand(parse(["zz-book"], { ...OK_FLAGS, "dry-run": true }), h.deps);
  assert.equal(r.code, GENERATE_BOOK_EXIT.OK);
  assert.equal(r.label, "DRY_RUN");
  assert.ok(sawPlan, "the conductor ran in plan mode");
});

// ── overwrite / refusal semantics ──────────────────────────────────────────────

test("refuse to clobber a shipped package without --resume/--overwrite (exit 2)", async () => {
  const h = mkHarness({ packageExists: true });
  const r = await generateBookCommand(parse(["zz-book"], { ...OK_FLAGS }), h.deps);
  assert.equal(r.code, GENERATE_BOOK_EXIT.USAGE);
  assert.equal(r.label, "REFUSED_CLOBBER");
  assert.equal(h.conductorCalls.length, 0, "a refusal never starts a run");
});

test("--resume proceeds over a shipped package with regen=false (resume-only-missing, WP-103)", async () => {
  const h = mkHarness({ packageExists: true });
  const r = await generateBookCommand(parse(["zz-book"], { ...OK_FLAGS, resume: true }), h.deps);
  assert.equal(r.code, GENERATE_BOOK_EXIT.OK);
  assert.equal(h.conductorCalls.length, 1);
  assert.equal(h.conductorCalls[0].opts.regen, false, "--resume does NOT set regen — the conductor authors only missing chapters");
  assert.equal(h.conductorCalls[0].opts.architecture, "author");
});

test("--overwrite regenerates a shipped package end-to-end (regen=true)", async () => {
  const h = mkHarness({ packageExists: true });
  const r = await generateBookCommand(parse(["zz-book"], { ...OK_FLAGS, overwrite: true }), h.deps);
  assert.equal(r.code, GENERATE_BOOK_EXIT.OK);
  assert.equal(h.conductorCalls[0].opts.regen, true, "--overwrite maps to the conductor's regen (re-run end-to-end)");
});

// ── end-to-end wiring: published → exit 0 + REQUIRE mode + artifact locations ──

test("mock-model end-to-end: published → exit 0, D7 REQUIRE set during the run, artifact+ledger locations printed", async () => {
  const h = mkHarness({
    runConductor: async (o) => {
      // The conductor runs UNDER REQUIRE mode (the S-tier terminal command sets it).
      assert.equal(h.env[CHAPTERFLOW_REQUIRE_D7_SHIP_GATE_ENV], "1", "generate-book sets D7 REQUIRE for the run");
      assert.match(h.env["CHAPTERFLOW_RUN_ID"] ?? "", /^generate-book-zz-book-/, "a ledger run id (WP-503) is minted for the run");
      return { status: "published", bookId: o.bookId, roundId: "r1", message: "PUBLISHED" };
    },
  });
  const r = await generateBookCommand(parse(["zz-book"], { ...OK_FLAGS }), h.deps);
  assert.equal(r.code, GENERATE_BOOK_EXIT.OK);
  assert.equal(r.label, "PUBLISHED");
  assert.ok(r.runId && r.runId.startsWith("generate-book-zz-book-"), "the result carries the ledger run id");
  assert.match(h.out, /artifacts \+ evidence:/);
  assert.match(h.out, /package:/);
  assert.match(h.out, /D7 receipt:/);
  assert.match(h.out, /run ledger:/);
  // env is RESTORED after the run (no leak).
  assert.equal(h.env[CHAPTERFLOW_REQUIRE_D7_SHIP_GATE_ENV], undefined, "D7 REQUIRE env restored after the run");
  assert.equal(h.env["CHAPTERFLOW_RUN_ID"], undefined, "run-id env restored after the run");
});

test("--d7-advisory does NOT set REQUIRE mode for the run", async () => {
  let requireDuringRun: string | undefined = "unset";
  const h = mkHarness({
    runConductor: async (o) => {
      requireDuringRun = h.env[CHAPTERFLOW_REQUIRE_D7_SHIP_GATE_ENV];
      return { status: "published", bookId: o.bookId, roundId: "r1" };
    },
  });
  await generateBookCommand(parse(["zz-book"], { ...OK_FLAGS, "d7-advisory": true }), h.deps);
  assert.equal(requireDuringRun, undefined, "--d7-advisory leaves the D7 gate advisory (env not set)");
});

// ── exit-code mapping: halt classes ────────────────────────────────────────────

test("generic content halt → exit 1", async () => {
  const h = mkHarness({
    runConductor: async (o) => ({ status: "halt", bookId: o.bookId, phase: "write", reason: "chapters need work", category: "content" }),
  });
  const r = await generateBookCommand(parse(["zz-book"], { ...OK_FLAGS }), h.deps);
  assert.equal(r.code, GENERATE_BOOK_EXIT.HALT);
  assert.equal(r.label, "HALT");
});

test("duplicate concurrent run (lock refusal) → exit 3", async () => {
  const h = mkHarness({
    runConductor: async (o) => ({
      status: "halt", bookId: o.bookId, phase: "research", category: "infra",
      reason: `could not acquire the run lock for ${o.bookId} (pid 42@host).`,
    }),
  });
  const r = await generateBookCommand(parse(["zz-book"], { ...OK_FLAGS }), h.deps);
  assert.equal(r.code, GENERATE_BOOK_EXIT.BLOCKED, "a lock refusal is the circuit-breaker class (exit 3)");
  assert.equal(r.label, "LOCK_REFUSED");
});

test("D7 quality-bar block (sealed halt sidecar) → exit 3 BLOCKED_QUALITY_BAR", async () => {
  const stateBooksDir = mkdtempSync(join(TMP, "d7-block-"));
  const h = mkHarness({
    stateBooksDir,
    runConductor: async (o) => {
      // Emulate promoteBook (WP-401): a quality-bar FAIL writes the halt sidecar.
      writeFileSync(
        d7ShipGateHaltPath(o.bookId, stateBooksDir),
        JSON.stringify({
          schema_version: "d7-ship-gate-halt-v1",
          artifact_type: "d7-ship-gate-halt",
          halt_category: "BLOCKED_QUALITY_BAR",
          book_id: o.bookId,
          audit_id: "aud-1",
          verdict: "BLOCK",
          round: 2,
          failing_chapters: [{ unit: "ch03", chapter_number: 3, chapter_diagnostic: 69 }],
          re_author_directive: { allowed_reauthors: 0, round: 2, terminal: true },
          binding_sha256: "deadbeef",
        }, null, 2) + "\n",
        "utf8",
      );
      return { status: "halt", bookId: o.bookId, phase: "ready", category: "infra", reason: "publish-final failed (exit 1): D7 ship gate BLOCK" };
    },
  });
  const r = await generateBookCommand(parse(["zz-book"], { ...OK_FLAGS }), h.deps);
  assert.equal(r.code, GENERATE_BOOK_EXIT.BLOCKED);
  assert.equal(r.label, "BLOCKED_QUALITY_BAR");
  assert.match(h.out, /D7 halt:/, "the D7 halt sidecar path is printed on a quality-bar block");
});

// ── classifyOutcomeExit unit: freshness guard on the D7 sidecar ────────────────

test("classifyOutcomeExit: a STALE D7 halt record (older than run start) is ignored → generic halt (exit 1)", () => {
  const stateBooksDir = mkdtempSync(join(TMP, "d7-stale-"));
  const bookId = "zz-book";
  const path = d7ShipGateHaltPath(bookId, stateBooksDir);
  writeFileSync(path, JSON.stringify({ halt_category: "BLOCKED_QUALITY_BAR", verdict: "BLOCK", failing_chapters: [] }) + "\n", "utf8");
  const recordMtime = statSync(path).mtimeMs;
  const halt: AutopilotOutcome = { status: "halt", bookId, phase: "ready", category: "infra", reason: "some infra failure" };

  // run started AFTER the record was written → the record is stale → NOT a D7 block.
  const stale = classifyOutcomeExit(halt, { bookId, stateBooksDir, runStartMs: recordMtime + 10_000 });
  assert.equal(stale.code, GENERATE_BOOK_EXIT.HALT, "a stale record from a prior run must not be read as this run's D7 block");

  // run started BEFORE (or at) the record → fresh → D7 block.
  const fresh = classifyOutcomeExit(halt, { bookId, stateBooksDir, runStartMs: recordMtime - 10_000 });
  assert.equal(fresh.code, GENERATE_BOOK_EXIT.BLOCKED);
  assert.equal(fresh.label, "BLOCKED_QUALITY_BAR");
});

test("classifyOutcomeExit: shipped/ready/published are exit 0", () => {
  const base = { bookId: "zz-book", stateBooksDir: TMP, runStartMs: 0 };
  for (const status of ["shipped", "ready", "published"] as const) {
    const outcome = { status, bookId: "zz-book", roundId: "r1", message: "ok" } as AutopilotOutcome;
    assert.equal(classifyOutcomeExit(outcome, base).code, 0, `${status} → exit 0`);
  }
});

// ── production wiring: the default deps bind the REAL pieces ────────────────────

test("defaultGenerateBookDeps binds the REAL author-first conductor + WP-602 preflight", () => {
  const d = defaultGenerateBookDeps();
  assert.equal(d.runConductor, runAutopilot, "the production run path IS the author-first conductor (WP-201)");
  assert.equal(d.runPreflight, runGeneratePreflightChecks, "the production preflight IS the WP-602 doctor battery");
  // the ledger path convention matches WP-503 (state/run-ledger/<book>/<runId>.jsonl)
  const lp = d.ledgerPaths("zz-book", "generate-book-zz-book-1");
  assert.match(lp.jsonl, /state\/run-ledger\/zz-book\/generate-book-zz-book-1\.jsonl$/);
  assert.match(lp.bookRollup, /state\/run-ledger\/zz-book\/book-rollup\.json$/);
});

// ── cleanup ────────────────────────────────────────────────────────────────────

test("zz cleanup: remove the generate-book tmp root", () => {
  rmSync(TMP, { recursive: true, force: true });
});
