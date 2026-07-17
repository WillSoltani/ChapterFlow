/**
 * WP-601 — the `generate-book` consolidated terminal command.
 *
 * ONE documented entry that generates a book end-to-end through the AUTHOR-FIRST
 * architecture (WP-201 default), with truthful exit codes, resume, validate-only,
 * and dry-run modes. This module holds the command's testable core; `src/cli.ts`'s
 * `runGenerateBook` parses argv and calls `generateBookCommand` with production deps.
 *
 * The command is pure WIRING of pieces other WPs own (WP-601 out-of-scope forbids
 * re-implementing any of them):
 *   - WP-602 deterministic preflight   (runGeneratePreflightChecks)
 *   - WP-504 fail-closed model config   (preflightOperatorModelSelection → UnsupportedModelConfigError)
 *   - WP-201 author-first default       (runAutopilot, architecture "author")
 *   - WP-404 bounded repair (cap 2)     (inside the author path)
 *   - WP-401 D7 ship gate               (promote/publish under REQUIRE mode)
 *   - WP-503 unified run ledger         (CHAPTERFLOW_RUN_ID convention + per-book rollup)
 *
 * ── Exit-code table (aligned with tests/cli-contract.test.ts: 0/1/2/3) ──────────
 *   0  OK        — shipped / ready / published; or a clean --validate-only/--dry-run.
 *   1  HALT      — the author-first run halted for a generic reason (content / infra /
 *                  progress / governance / integrity) that is NOT a quality-bar block
 *                  or a lock refusal; or --validate-only surfaced a warn-level finding.
 *   2  USAGE     — bad args, a FATAL preflight finding, an UNSUPPORTED_MODEL_CONFIG
 *                  selection, or a refusal to clobber a shipped package.
 *   3  BLOCKED   — the D7 ship gate blocked on the quality bar (BLOCKED_QUALITY_BAR),
 *                  or a second concurrent run was lock-refused (the circuit-breaker class).
 *
 * NO LIVE MODEL CALLS run here. The real author-first execution (which spawns codex
 * sessions) is reachable only through the production path; tests drive it via injected
 * deps + a mock conductor / author IO. Running a REAL book is a Phase-6+ owner-authorized
 * action (ledger L-14/L-22 — no live calls in Phases 1-5).
 */

import { existsSync, readFileSync, statSync } from "fs";
import { resolve } from "path";

import { REPO_ROOT, CANONICAL_STATE, normSlug } from "../lib/chapterPaths.js";
import {
  runAutopilot,
  type AutopilotOptions,
  type AutopilotOutcome,
} from "./autopilot.js";
import {
  runGeneratePreflightChecks,
  formatDoctor,
  doctorExitCode,
  type DoctorFinding,
} from "../lifecycle/doctor.js";
import {
  preflightOperatorModelSelection,
  resolveRoute,
  NORMAL_PROFILE_MODEL,
  UnsupportedModelConfigError,
} from "./modelPolicy.js";
import {
  d7ShipGateHaltPath,
  D7_HALT_CATEGORY_QUALITY_BAR,
  CHAPTERFLOW_REQUIRE_D7_SHIP_GATE_ENV,
} from "../critics/d7ShipGate.js";
import { callLedgerPaths } from "../telemetry/runCallLedger.js";

const PIPELINE_DIR = resolve(REPO_ROOT);

/** Exit codes — the truthful operator contract (see the module header table). */
export const GENERATE_BOOK_EXIT = {
  OK: 0,
  HALT: 1,
  USAGE: 2,
  BLOCKED: 3,
} as const;

/** The `--config <file>` JSON schema. Every field is optional; a present value is
 *  the config-file tier of the precedence chain (explicit flag > config file >
 *  default). Unknown keys are ignored (forward-compatible). */
export type GenerateBookConfig = {
  model?: string;
  effort?: string;
  out?: string;
  /** Require a sealed D7 ship-gate receipt (WP-401 REQUIRE mode). Default true. */
  requireD7ShipGate?: boolean;
  /** Auto-publish on convergence (commit+push to main). Default true. */
  autoPublish?: boolean;
  /** The approved integration SHA this worktree must be based on (preflight). */
  expectedBaseSha?: string;
  /** Treat a dirty worktree as a FATAL preflight finding. Default false (advisory warn). */
  requireCleanWorktree?: boolean;
  maxParallel?: number;
  maxRepairRounds?: number;
};

export type GenerateBookArchitecture = "author" | "compiler" | "legacy";

/** The raw, pre-precedence parse of `generate-book <bookId> [flags]`. */
export type GenerateBookParsed = {
  bookId: string;
  title: string;
  author: string;
  architecture: GenerateBookArchitecture;
  /** CLI `--model` (undefined ⇒ fall to config/default). */
  model?: string;
  /** CLI `--effort` (undefined ⇒ fall to config/default). */
  effort?: string;
  configFile?: string;
  resume: boolean;
  validateOnly: boolean;
  dryRun: boolean;
  out?: string;
  verbose: boolean;
  /** `--overwrite`/`--force`: re-run end-to-end over a shipped package (regen). */
  overwrite: boolean;
  /** `--no-publish`: halt at ready-to-publish for manual review. */
  noPublish: boolean;
  /** `--d7-advisory`: run D7 as advisory (opt OUT of REQUIRE mode). */
  d7Advisory: boolean;
  /** `--expected-base-sha <sha>` (preflight base-SHA match). */
  expectedBaseSha?: string;
  /** `--require-clean-worktree` (preflight cleanliness → fatal). */
  requireCleanWorktree: boolean;
};

/** Injectable seams so the whole command is exercised model-free in tests. The
 *  defaults are the production pieces; a test overrides `runConductor`/`runPreflight`
 *  to drive the 12-step lifecycle without spawning a single codex session. */
export type GenerateBookDeps = {
  runConductor: (opts: AutopilotOptions) => Promise<AutopilotOutcome>;
  runPreflight: (opts: {
    bookId?: string;
    model?: string;
    effort?: string;
    expectedBaseSha?: string;
    requireCleanWorktree?: boolean;
    requireD7ShipGate?: boolean;
  }) => Promise<DoctorFinding[]>;
  loadConfigFile: (path: string) => GenerateBookConfig;
  now: () => number;
  log: (line: string) => void;
  /** Env surface so a run can set CHAPTERFLOW_RUN_ID / D7 REQUIRE without leaking
   *  into the parent process in tests. */
  env: Record<string, string | undefined>;
  /** Where the D7 ship-gate halt record + book sidecars live. */
  stateBooksDir: string;
  /** The final V21 package path for a book id. */
  packagePath: (bookId: string) => string;
  /** The run-ledger jsonl/summary/book-rollup paths for a run. */
  ledgerPaths: (bookId: string, runId: string) => { jsonl: string; summary: string; bookRollup: string };
};

function defaultLoadConfigFile(path: string): GenerateBookConfig {
  const raw = readFileSync(path, "utf8");
  const parsed = JSON.parse(raw) as unknown;
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error(`config file ${path} must be a JSON object`);
  }
  return parsed as GenerateBookConfig;
}

export function defaultGenerateBookDeps(): GenerateBookDeps {
  return {
    runConductor: runAutopilot,
    runPreflight: runGeneratePreflightChecks,
    loadConfigFile: defaultLoadConfigFile,
    now: () => Date.now(),
    log: (line) => console.log(line),
    env: process.env as Record<string, string | undefined>,
    stateBooksDir: resolve(CANONICAL_STATE, "books"),
    packagePath: (bookId) => resolve(PIPELINE_DIR, "book-packages", `${normSlug(bookId)}.v21.json`),
    ledgerPaths: (bookId, runId) => {
      const p = callLedgerPaths(PIPELINE_DIR, bookId, runId);
      return { jsonl: p.jsonl, summary: p.summary, bookRollup: p.bookRollup };
    },
  };
}

// ── arg parsing ────────────────────────────────────────────────────────────────

/** Which architecture the flags select. Mirrors autopilot.architectureFromFlags'
 *  precedence (legacy > compiler > author-default) so `generate-book` can never
 *  drift from `book-run`/`book-autopilot`. The default (no flag) is author-first. */
export function generateBookArchitecture(flags: Record<string, string | boolean>): GenerateBookArchitecture {
  if ("legacy-whole-chapter-writer" in flags || "legacy" in flags) return "legacy";
  if ("compiler" in flags) return "compiler";
  return "author";
}

export type ParseResult =
  | { ok: true; parsed: GenerateBookParsed }
  | { ok: false; code: number; message: string };

/** Presence-check a boolean flag (fail-safe): any appearance — even one the greedy
 *  arg parser bound a following token to — counts as set. */
function flagPresent(flags: Record<string, string | boolean>, key: string): boolean {
  return key in flags;
}

function stringFlag(flags: Record<string, string | boolean>, key: string): string | undefined {
  const v = flags[key];
  return typeof v === "string" ? v : undefined;
}

export function parseGenerateBookArgs(
  args: string[],
  flags: Record<string, string | boolean>,
): ParseResult {
  const bookId = args[0];
  if (!bookId) {
    return {
      ok: false,
      code: GENERATE_BOOK_EXIT.USAGE,
      message:
        "Usage: generate-book <bookId> --title X --author Y [--model M] [--effort E] [--config file]\n" +
        "                    [--resume] [--validate-only] [--dry-run] [--out dir] [--overwrite] [--no-publish] [--verbose]\n" +
        "                    [--compiler]   (opt in to the retired v23 per-chapter compiler; default is v24 author-first)",
    };
  }
  const title = stringFlag(flags, "title");
  const author = stringFlag(flags, "author");
  if (!title || !author) {
    return {
      ok: false,
      code: GENERATE_BOOK_EXIT.USAGE,
      message: "Both --title and --author are required (the book's declared identity, recorded in the run ledger).",
    };
  }
  return {
    ok: true,
    parsed: {
      bookId,
      title,
      author,
      architecture: generateBookArchitecture(flags),
      model: stringFlag(flags, "model"),
      effort: stringFlag(flags, "effort"),
      configFile: stringFlag(flags, "config"),
      resume: flagPresent(flags, "resume"),
      validateOnly: flagPresent(flags, "validate-only"),
      dryRun: flagPresent(flags, "dry-run") || flagPresent(flags, "plan"),
      out: stringFlag(flags, "out"),
      verbose: flagPresent(flags, "verbose"),
      overwrite: flagPresent(flags, "overwrite") || flagPresent(flags, "force"),
      noPublish: flagPresent(flags, "no-publish"),
      d7Advisory: flagPresent(flags, "d7-advisory"),
      expectedBaseSha: stringFlag(flags, "expected-base-sha"),
      requireCleanWorktree: flagPresent(flags, "require-clean-worktree"),
    },
  };
}

// ── config precedence ────────────────────────────────────────────────────────────

export type ResolvedGenerateBookConfig = {
  model?: string;
  effort?: string;
  out?: string;
  requireD7ShipGate: boolean;
  autoPublish: boolean;
  expectedBaseSha?: string;
  requireCleanWorktree: boolean;
  maxParallel?: number;
  maxRepairRounds?: number;
  /** Human-readable source of each resolved value, for the truthful startup print. */
  sources: Record<string, "flag" | "config" | "default">;
};

/** Resolve the effective config with the documented precedence: explicit CLI flag >
 *  `--config` file > policy default. Records the source of each field so the command
 *  can print HOW every value was chosen (red-team: no silent routing to a non-selected
 *  value). Boolean flags are one-directional opt-outs/opt-ins by design:
 *    - `--no-publish` opts OUT of the auto-publish default (true).
 *    - `--d7-advisory` opts OUT of the D7 REQUIRE default (true).
 *    - `--require-clean-worktree` opts IN to the fatal-on-dirty default (false). */
export function resolveGenerateBookConfig(
  parsed: GenerateBookParsed,
  config: GenerateBookConfig,
): ResolvedGenerateBookConfig {
  const sources: Record<string, "flag" | "config" | "default"> = {};
  const pick = <T>(field: string, flagVal: T | undefined, cfgVal: T | undefined, dflt: T): T => {
    if (flagVal !== undefined) { sources[field] = "flag"; return flagVal; }
    if (cfgVal !== undefined) { sources[field] = "config"; return cfgVal; }
    sources[field] = "default";
    return dflt;
  };
  // requireD7: flag opt-out (--d7-advisory) > config > default true.
  const requireD7 = parsed.d7Advisory
    ? (sources.requireD7ShipGate = "flag", false)
    : pick("requireD7ShipGate", undefined, config.requireD7ShipGate, true);
  // autoPublish: flag opt-out (--no-publish) > config > default true.
  const autoPublish = parsed.noPublish
    ? (sources.autoPublish = "flag", false)
    : pick("autoPublish", undefined, config.autoPublish, true);
  // requireCleanWorktree: flag opt-in > config > default false.
  const requireCleanWorktree = parsed.requireCleanWorktree
    ? (sources.requireCleanWorktree = "flag", true)
    : pick("requireCleanWorktree", undefined, config.requireCleanWorktree, false);
  return {
    model: pick("model", parsed.model, config.model, undefined),
    effort: pick("effort", parsed.effort, config.effort, undefined),
    out: pick("out", parsed.out, config.out, undefined),
    requireD7ShipGate: requireD7,
    autoPublish,
    expectedBaseSha: pick("expectedBaseSha", parsed.expectedBaseSha, config.expectedBaseSha, undefined),
    requireCleanWorktree,
    maxParallel: pick("maxParallel", undefined, config.maxParallel, undefined),
    maxRepairRounds: pick("maxRepairRounds", undefined, config.maxRepairRounds, undefined),
    sources,
  };
}

// ── outcome → exit code ────────────────────────────────────────────────────────

export type ExitClassification = { code: number; label: string; reason: string };

/** Map an AutopilotOutcome to a truthful exit code + label. A D7 quality-bar block
 *  and a lock refusal are the exit-3 (BLOCKED / circuit-breaker) class; every other
 *  halt is a generic exit-1. Shipped/ready/published are exit-0.
 *
 *  The D7 block is detected by the AUTHORITATIVE sidecar promoteBook (WP-401) writes
 *  on a quality-bar FAIL — `<bookId>.d7-ship-gate-halt.json` with
 *  `halt_category === "BLOCKED_QUALITY_BAR"` — freshly written at or after this run's
 *  start (so a stale record from a prior run is never mistaken for this one). */
export function classifyOutcomeExit(
  outcome: AutopilotOutcome,
  ctx: { bookId: string; stateBooksDir: string; runStartMs: number },
): ExitClassification {
  if (outcome.status === "shipped" || outcome.status === "ready" || outcome.status === "published") {
    return { code: GENERATE_BOOK_EXIT.OK, label: outcome.status.toUpperCase(), reason: formatOutcomeReason(outcome) };
  }
  // status === "halt"
  const reason = outcome.reason;
  if (/could not acquire the run lock|lost the run lock/i.test(reason)) {
    return { code: GENERATE_BOOK_EXIT.BLOCKED, label: "LOCK_REFUSED", reason };
  }
  const d7 = readFreshD7Halt(ctx.bookId, ctx.stateBooksDir, ctx.runStartMs);
  if (d7) {
    return {
      code: GENERATE_BOOK_EXIT.BLOCKED,
      label: D7_HALT_CATEGORY_QUALITY_BAR,
      reason: `D7 ship gate ${d7.verdict}: ${d7.failing_chapters.length} failing chapter(s) below the quality bar — ${reason}`,
    };
  }
  return { code: GENERATE_BOOK_EXIT.HALT, label: "HALT", reason };
}

function formatOutcomeReason(outcome: AutopilotOutcome): string {
  if (outcome.status === "halt") return outcome.reason;
  if ("message" in outcome && outcome.message) return outcome.message;
  return outcome.status;
}

type D7HaltLite = { verdict: string; failing_chapters: unknown[]; halt_category: string };

/** Read the D7 ship-gate halt sidecar IFF it exists AND was written at/after the run
 *  start (fresh to THIS run) AND carries the quality-bar category. Never throws. */
function readFreshD7Halt(bookId: string, stateBooksDir: string, runStartMs: number): D7HaltLite | null {
  try {
    const path = d7ShipGateHaltPath(bookId, stateBooksDir);
    if (!existsSync(path)) return null;
    // Allow a small clock skew: a record written in the same millisecond the run
    // started still belongs to this run.
    if (statSync(path).mtimeMs + 2 < runStartMs) return null;
    const rec = JSON.parse(readFileSync(path, "utf8")) as D7HaltLite;
    if (rec.halt_category !== D7_HALT_CATEGORY_QUALITY_BAR) return null;
    return { verdict: String((rec as { verdict?: unknown }).verdict ?? "BLOCK"), failing_chapters: Array.isArray(rec.failing_chapters) ? rec.failing_chapters : [], halt_category: rec.halt_category };
  } catch {
    return null;
  }
}

// ── the command ────────────────────────────────────────────────────────────────

export type GenerateBookResult = {
  code: number;
  /** The classification label (OK / HALT / USAGE / BLOCKED_QUALITY_BAR / LOCK_REFUSED
   *  / UNSUPPORTED_MODEL_CONFIG / PREFLIGHT_FATAL / REFUSED_CLOBBER / VALIDATE_ONLY / DRY_RUN). */
  label: string;
  /** True once the author-first conductor was invoked (false for pre-work exits). */
  ranConductor: boolean;
  /** The run id used for the ledger (undefined for pre-work exits). */
  runId?: string;
};

/**
 * The 12-step lifecycle (master plan §5) — every step honest and bounded:
 *   1. validate prerequisites (WP-602 preflight; a FATAL finding → exit 2)
 *   2. load + resolve config (explicit flag > --config file > default)
 *   3. confirm the model is supported (WP-504; unsupported → exit 2 before any work)
 *   4. init or resume the run (mint CHAPTERFLOW_RUN_ID; WP-103 resume-only-missing)
 *   5. execute the author-first pipeline (WP-201; bounded repairs WP-404)
 *   6. persist intermediate state per stage (the conductor's CAS commits)
 *   7. run the consolidated floor then the D7 ship gate (WP-205/WP-401)
 *   8. produce V21-compatible output (assemble → strip → verify×2 → publish, D7-gated)
 *   9. run final validation (the conductor's publish-preflight)
 *  10. return a TRUTHFUL success/failure status (classifyOutcomeExit)
 *  11. print artifact + evidence locations (package / D7 receipt / run-ledger)
 *  12. meaningful exit codes (0/1/2/3)
 * Steps 5-9 are the conductor's (runAutopilot) internals; this function OWNS 1-4 and
 * 10-12 and wires the conductor in between (WP-601 scope = entry/args/exit wiring).
 */
export async function generateBookCommand(
  parsed: GenerateBookParsed,
  depsOverride?: Partial<GenerateBookDeps>,
): Promise<GenerateBookResult> {
  const deps: GenerateBookDeps = { ...defaultGenerateBookDeps(), ...depsOverride };
  const log = deps.log;
  const bookId = parsed.bookId;

  // ── step 2 (early): load the --config file (needed to resolve model precedence
  //    before the WP-504 model check) ──
  let config: GenerateBookConfig = {};
  if (parsed.configFile) {
    try {
      config = deps.loadConfigFile(parsed.configFile);
    } catch (err) {
      log(`generate-book: could not load --config ${parsed.configFile}: ${(err as Error).message}`);
      return { code: GENERATE_BOOK_EXIT.USAGE, label: "USAGE", ranConductor: false };
    }
  }
  const resolved = resolveGenerateBookConfig(parsed, config);

  // ── legacy opt-in: the retired v23 compiler / v22 legacy paths stay reachable
  //    (WP-207 owns their deletion; WP-601 must not remove them). Delegated to the
  //    caller (cli.ts) via a distinct label so the operator sees which path ran. ──
  if (parsed.architecture !== "author") {
    log(`generate-book: --${parsed.architecture === "compiler" ? "compiler" : "legacy"} selected — routing to the retired ${parsed.architecture === "compiler" ? "v23 per-chapter compiler" : "v22 legacy whole-chapter"} path (kept reachable for the WP-207 regression harness; default is v24 author-first).`);
    return { code: GENERATE_BOOK_EXIT.OK, label: `DELEGATE_${parsed.architecture.toUpperCase()}`, ranConductor: false };
  }

  // ── step 3: confirm the model is supported (WP-504) BEFORE any work. An explicit
  //    --model/--effort that is not a 5.6 candidate / supported effort fails closed
  //    with UNSUPPORTED_MODEL_CONFIG and NO silent fallback. ──
  if (resolved.model !== undefined || resolved.effort !== undefined) {
    try {
      preflightOperatorModelSelection({ model: resolved.model, effort: resolved.effort });
    } catch (err) {
      if (err instanceof UnsupportedModelConfigError) {
        log(`generate-book: ${err.message}`);
        return { code: GENERATE_BOOK_EXIT.USAGE, label: "UNSUPPORTED_MODEL_CONFIG", ranConductor: false };
      }
      log(`generate-book: model/effort selection rejected: ${(err as Error).message}`);
      return { code: GENERATE_BOOK_EXIT.USAGE, label: "USAGE", ranConductor: false };
    }
  }
  // The wired production route (what the conductor ACTUALLY writes with). An explicit
  // supported-but-different candidate is NOT silently honored — the author route is
  // policy-owned (the author writer omits per-call model/effort; WP-301) and per-run
  // model override beyond the provisional baseline is gated on WP-705. Refuse rather
  // than print one model and run another (red-team: no silent non-selected routing).
  const wired = resolveRoute({ role: "author-writer", requireSupportedModel: true });
  if (resolved.model !== undefined && resolved.model !== wired.model) {
    log(
      `generate-book: --model "${resolved.model}" is a valid 5.6 candidate but is NOT the wired production route "${wired.model}" ` +
      `(${NORMAL_PROFILE_MODEL.status}). Per-run model override beyond the provisional baseline is gated on WP-705's concrete matrix — ` +
      `refusing to run a model other than the one selected (no silent re-route).`,
    );
    return { code: GENERATE_BOOK_EXIT.USAGE, label: "UNSUPPORTED_MODEL_CONFIG", ranConductor: false };
  }

  // ── truthful startup print: HOW every value resolved ──
  log(`generate-book — ${bookId}`);
  log(`  title:   ${parsed.title} · author: ${parsed.author}`);
  log(`  model:   ${wired.model} (route "${wired.profileName}", ${NORMAL_PROFILE_MODEL.status}); write effort ${wired.effort} [source: ${resolved.sources.model ?? "default"}]`);
  log(`  config:  ${parsed.configFile ? `${parsed.configFile}` : "(none)"} · precedence: explicit flag > --config file > policy default`);
  log(`  publish: ${resolved.autoPublish ? "AUTO on convergence (promote gate → commit+push to main)" : "OFF (--no-publish: halt at ready)"} [source: ${resolved.sources.autoPublish}]`);
  log(`  D7 gate: ${resolved.requireD7ShipGate ? "REQUIRE (a sealed PASS receipt bound to the shipped bytes is mandatory)" : "advisory (--d7-advisory)"} [source: ${resolved.sources.requireD7ShipGate}]`);
  if (resolved.out) log(`  out:     ${resolved.out}`);

  // ── step 1: deterministic preflight (WP-602). Read-only, zero model/network calls. ──
  const findings = await deps.runPreflight({
    bookId,
    model: resolved.model,
    effort: resolved.effort,
    expectedBaseSha: resolved.expectedBaseSha,
    requireCleanWorktree: resolved.requireCleanWorktree,
    requireD7ShipGate: resolved.requireD7ShipGate,
  });

  // --validate-only: preflight ONLY, then exit with the doctor 0/1/2 contract. ZERO
  // authoring calls. (fatal → 2, warn → 1, ok → 0.)
  if (parsed.validateOnly) {
    log(formatDoctor(findings));
    const code = doctorExitCode(findings);
    log(`generate-book --validate-only: ${code === 0 ? "READY" : code === 1 ? "READY WITH WARNINGS" : "BLOCKED — a fatal preflight finding must be fixed before a run"} (exit ${code}).`);
    return { code, label: "VALIDATE_ONLY", ranConductor: false };
  }

  // On the RUN path a FATAL preflight finding blocks with exit 2 (no run created);
  // warns are advisory and the run proceeds.
  const fatal = findings.filter((f) => f.level === "fatal");
  if (fatal.length > 0) {
    log(formatDoctor(findings));
    log(`generate-book: ${fatal.length} FATAL preflight finding(s) — refusing to start a run (exit 2). Fix them (or run \`generate-preflight ${bookId}\`) and retry.`);
    return { code: GENERATE_BOOK_EXIT.USAGE, label: "PREFLIGHT_FATAL", ranConductor: false };
  }
  const warns = findings.filter((f) => f.level === "warn");
  if (warns.length > 0) log(`generate-book: ${warns.length} preflight warning(s) (advisory — run proceeds): ${warns.map((w) => w.check).join(", ")}`);

  // ── overwrite/refusal semantics: never clobber a shipped package silently. --resume
  //    (continue a crashed run) and --overwrite/--force (regen end-to-end) are the two
  //    sanctioned ways past a shipped package. ──
  const pkgPath = deps.packagePath(bookId);
  const pkgExists = existsSync(pkgPath);
  if (pkgExists && !parsed.resume && !parsed.overwrite) {
    log(`generate-book: ${bookId} already has a shipped package at ${pkgPath}.`);
    log(`  Refusing to clobber it. Re-run with --resume (continue an interrupted run without re-doing finished chapters) or --overwrite (regenerate end-to-end).`);
    return { code: GENERATE_BOOK_EXIT.USAGE, label: "REFUSED_CLOBBER", ranConductor: false };
  }

  // ── step 4: init/resume the run — mint the ledger run id (WP-503 CHAPTERFLOW_RUN_ID
  //    convention) so the exact ledger path is known and printable at run end. ──
  const runStartMs = deps.now();
  const runId = `generate-book-${bookId}-${runStartMs}`;

  // --dry-run: plan the run (the conductor's planOnly), zero mutations + zero model
  // calls. We still route through the conductor so the plan reflects the REAL phase
  // logic — planOnly takes no lock and writes no chapters.
  const savedRunId = deps.env["CHAPTERFLOW_RUN_ID"];
  const savedRequireD7 = deps.env[CHAPTERFLOW_REQUIRE_D7_SHIP_GATE_ENV];
  deps.env["CHAPTERFLOW_RUN_ID"] = runId;
  if (resolved.requireD7ShipGate) deps.env[CHAPTERFLOW_REQUIRE_D7_SHIP_GATE_ENV] = "1";

  try {
    if (parsed.dryRun) {
      log(`generate-book --dry-run: planning ${bookId} (zero model calls, zero mutations).`);
      const outcome = await deps.runConductor(conductorOptions(parsed, resolved, { plan: true }));
      log(`generate-book --dry-run: plan complete (${outcome.status}).`);
      return { code: GENERATE_BOOK_EXIT.OK, label: "DRY_RUN", ranConductor: true, runId };
    }

    // ── steps 5-9: execute the author-first pipeline end-to-end ──
    log(`generate-book: starting the author-first run for ${bookId} (run ${runId})…`);
    const outcome = await deps.runConductor(conductorOptions(parsed, resolved, { plan: false }));

    // ── step 10: truthful status ──
    const cls = classifyOutcomeExit(outcome, { bookId, stateBooksDir: deps.stateBooksDir, runStartMs });

    // ── step 11: print artifact + evidence locations (always — even on halt paths;
    //    the WP-503 ledger flushes on every terminal, so its path is meaningful). ──
    const ledger = deps.ledgerPaths(bookId, runId);
    log("");
    log(`generate-book: ${cls.label} — ${cls.reason}`);
    log("  artifacts + evidence:");
    log(`    package:      ${pkgPath}${existsSync(pkgPath) ? "" : " (not produced)"}`);
    const d7ReceiptDir = deps.stateBooksDir;
    log(`    D7 receipt:   ${resolve(d7ReceiptDir, `${normSlug(bookId)}.d7-ship-gate.json`)}`);
    if (cls.label === D7_HALT_CATEGORY_QUALITY_BAR) {
      log(`    D7 halt:      ${d7ShipGateHaltPath(bookId, d7ReceiptDir)}`);
    }
    log(`    run ledger:   ${ledger.jsonl}`);
    log(`    run summary:  ${ledger.summary}`);
    log(`    book rollup:  ${ledger.bookRollup}`);

    // ── step 12: exit code ──
    return { code: cls.code, label: cls.label, ranConductor: true, runId };
  } finally {
    // Restore the env we borrowed (no leak into the parent process / other tests).
    if (savedRunId === undefined) delete deps.env["CHAPTERFLOW_RUN_ID"]; else deps.env["CHAPTERFLOW_RUN_ID"] = savedRunId;
    if (savedRequireD7 === undefined) delete deps.env[CHAPTERFLOW_REQUIRE_D7_SHIP_GATE_ENV]; else deps.env[CHAPTERFLOW_REQUIRE_D7_SHIP_GATE_ENV] = savedRequireD7;
  }
}

/** Build the conductor options for the author-first path. `--overwrite` maps to the
 *  conductor's `regen` (re-run end-to-end over a shipped package); `--resume` needs no
 *  flag — the conductor is resume-by-construction (it authors only MISSING chapters and
 *  reuses durable acceptance; WP-103). */
function conductorOptions(
  parsed: GenerateBookParsed,
  resolved: ResolvedGenerateBookConfig,
  o: { plan: boolean },
): AutopilotOptions {
  return {
    bookId: parsed.bookId,
    architecture: "author",
    autoPublish: resolved.autoPublish,
    regen: parsed.overwrite,
    plan: o.plan,
    ...(resolved.maxParallel !== undefined ? { maxParallel: resolved.maxParallel } : {}),
    ...(resolved.maxRepairRounds !== undefined ? { maxRepairRounds: resolved.maxRepairRounds } : {}),
  };
}
