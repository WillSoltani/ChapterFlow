/**
 * doctor — one preflight that catches the workspace traps this pipeline has hit
 * before, so they fail a check instead of a generation run:
 *   - the dual state/chapters shadow dir (canonical vs repo-root divergence)
 *   - dual brief shapes for one book (.brief.json AND .manual-brief.json)
 *   - chapter-number drift (dupes/gaps that make AS5–AS12 silently skip)
 *   - untracked src/*.ts imported by tracked code (the TS2307-on-origin trap)
 * Read-only. Exit 0 = healthy, 1 = warnings, 2 = a blocking trap.
 *
 * WP-602 extends this module with the deterministic GENERATE-BOOK preflight
 * (master plan §8 WP-602; the entry point WP-601 wires in before any book
 * work starts): worktree cleanliness, base-SHA match, branch sanity,
 * model-config support, schema-fixture validity, name-bank/config integrity,
 * and the D7 REQUIRE-mode audit-tooling-reachable check. Every added check is
 * filesystem/git/config only — ZERO model or network calls, matching the
 * existing checks' contract exactly (`ok` /
 * `warn` / `fatal`, the SAME `doctorExitCode` 0/1/2 mapping — no new exit
 * codes). See `runGeneratePreflightChecks` below.
 */

import { spawnSync } from "child_process";
import { existsSync, readFileSync, readdirSync } from "fs";
import { hostname } from "os";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

import { assertNoShadowStateDir } from "../lib/chapterPaths.js";
import { pendingDeployAgeHours, readPendingDeploy } from "../publish/publishFinal.js";
import { compareChapterSetToCanonical, formatChapterSetBlockers, readCanonicalChapterIndex } from "../lib/chapterSet.js";
import { findRunArtifact } from "../lib/runDirs.js";
import { formatTocIssues, parseTocFile } from "../lib/tocContract.js";
import { loadBookChapters } from "../qc/manualKeyJudge.js";
import { loadSweepHistory } from "../qc/sweep.js";
import { CANDIDATE_MODELS, NORMAL_PROFILE_MODEL } from "../orchestrator/modelPolicy.js";
import { contractFreezeDivergences, type ContractManifest } from "../contracts/index.js";
import { canonicalEmissionSample, validateEmissionParity } from "../contracts/emissionPackage.js";
import { loadBannedConnectives, loadNameBank } from "../librarian/namePlan.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PIPELINE_DIR = resolve(__dirname, "../..");
const REPO_ROOT = PIPELINE_DIR;
const STATE_DIR = resolve(PIPELINE_DIR, "state");
const SRC_DIR = resolve(PIPELINE_DIR, "src");
const RUNS_DIR = resolve(REPO_ROOT, ".chapterflow/runs");

export type DoctorFinding = { level: "ok" | "warn" | "fatal"; check: string; message: string };

function checkShadowStateDir(): DoctorFinding {
  try {
    assertNoShadowStateDir();
    return { level: "ok", check: "shadow-state-dir", message: "no repo-root state/chapters shadow" };
  } catch (e) {
    return { level: "fatal", check: "shadow-state-dir", message: (e as Error).message.split("\n")[0] };
  }
}

function checkDualBrief(bookId: string): DoctorFinding {
  const manual = existsSync(resolve(STATE_DIR, "briefs", `${bookId}.manual-brief.json`));
  const generated = existsSync(resolve(STATE_DIR, "briefs", `${bookId}.brief.json`));
  if (manual && generated) {
    return { level: "warn", check: "dual-brief", message: `${bookId} has BOTH .brief.json and .manual-brief.json — loadBrief reads .brief.json first; remove the stale one to avoid title/voice drift` };
  }
  return { level: "ok", check: "dual-brief", message: `${bookId} brief shape unambiguous` };
}

function checkChapterNumbers(bookId: string): DoctorFinding {
  let chapters;
  try {
    chapters = loadBookChapters(bookId);
  } catch (e) {
    return { level: "fatal", check: "chapter-parse", message: (e as Error).message };
  }
  if (chapters.length === 0) return { level: "ok", check: "chapter-numbers", message: `${bookId} has no chapters yet` };
  const seen = new Map<number, string>();
  const problems: string[] = [];
  for (const ch of chapters) {
    if (typeof ch.number !== "number" || !Number.isFinite(ch.number)) {
      problems.push(`${ch.chapterId}: number is ${JSON.stringify(ch.number)}`);
      continue;
    }
    const prior = seen.get(ch.number);
    if (prior) problems.push(`duplicate number ${ch.number} in ${prior} and ${ch.chapterId}`);
    else seen.set(ch.number, ch.chapterId);
  }
  if (problems.length > 0) {
    return { level: "fatal", check: "chapter-numbers", message: `${bookId}: ${problems.join("; ")} (intra-book checks would silently skip — run fix-chapter-ids)` };
  }
  return { level: "ok", check: "chapter-numbers", message: `${bookId}: ${chapters.length} chapters, numbers unique` };
}

function checkCanonicalChapterSet(bookId: string): DoctorFinding {
  const canonical = readCanonicalChapterIndex(bookId);
  if (!canonical.ok) {
    return { level: "fatal", check: "canonical-chapter-set", message: formatChapterSetBlockers(canonical.blockers) };
  }
  let chapters;
  try {
    chapters = loadBookChapters(bookId);
  } catch (e) {
    return { level: "fatal", check: "canonical-chapter-set", message: (e as Error).message };
  }
  const comparison = compareChapterSetToCanonical({
    bookId,
    canonical: canonical.chapters,
    actual: chapters,
    actualLabel: "state chapter files",
  });
  if (!comparison.ok) {
    return { level: "fatal", check: "canonical-chapter-set", message: formatChapterSetBlockers(comparison.blockers) };
  }
  return { level: "ok", check: "canonical-chapter-set", message: `${bookId}: state chapters exactly match canonical index (${canonical.chapters.length})` };
}

function checkTocContract(bookId: string): DoctorFinding {
  const tocPath = findRunArtifact(RUNS_DIR, bookId, "source-freeze/toc.json", {
    allowedStatuses: ["running", "failed", "coherence_failed", "complete"],
  });
  if (!tocPath) return { level: "ok", check: "toc-contract", message: `${bookId}: no research TOC on disk yet` };
  const parsed = parseTocFile(tocPath, { bookId });
  if (!parsed.ok) return { level: "fatal", check: "toc-contract", message: formatTocIssues(parsed.issues) };
  if (parsed.migration.inputShape === "canonical" && !parsed.migration.changed) {
    return { level: "ok", check: "toc-contract", message: `${bookId}: canonical TOC (${parsed.chapters.length} chapters)` };
  }
  return { level: "warn", check: "toc-contract", message: `${bookId}: TOC uses ${parsed.migration.inputShape}; run toc-migrate ${bookId} --apply` };
}

function checkSweepHistory(bookId: string): DoctorFinding {
  try {
    loadSweepHistory(bookId);
    return { level: "ok", check: "sweep-history", message: `${bookId}: immutable sweep records are reconstructable` };
  } catch (e) {
    return { level: "fatal", check: "sweep-history", message: (e as Error).message.split("\n").join(" ") };
  }
}

function checkUntrackedImports(): DoctorFinding {
  // Untracked src/*.ts that tracked code imports compile locally (tsconfig globs
  // pick them up) but fail TS2307 on a fresh origin checkout. List untracked
  // source files so a partial commit can't ship the trap. Standalone zipped
  // artifacts do not include .git metadata, so this check is non-applicable and
  // should not turn a clean operator preflight yellow.
  if (!existsSync(resolve(PIPELINE_DIR, ".git"))) {
    return { level: "ok", check: "untracked-imports", message: "git metadata absent; standalone artifact check skipped" };
  }
  const r = spawnSync("git", ["ls-files", "--others", "--exclude-standard", "--", SRC_DIR], { encoding: "utf8", cwd: PIPELINE_DIR });
  if (r.status !== 0) return { level: "ok", check: "untracked-imports", message: "could not run git ls-files; standalone check skipped" };
  const untracked = (r.stdout ?? "").split(/\r?\n/).map((f) => f.trim()).filter((f) => f.endsWith(".ts"));
  if (untracked.length === 0) return { level: "ok", check: "untracked-imports", message: "no untracked src/*.ts" };
  // Is any untracked file imported by a tracked sibling? (the actual TS2307 trap)
  const trackedSrc = (spawnSync("git", ["ls-files", "--", SRC_DIR], { encoding: "utf8", cwd: PIPELINE_DIR }).stdout ?? "")
    .split(/\r?\n/).map((f) => f.trim()).filter((f) => f.endsWith(".ts"));
  // git ls-files run with cwd=PIPELINE_DIR returns paths relative to that dir.
  const trackedContents = trackedSrc
    .map((t) => { try { return readFileSync(resolve(PIPELINE_DIR, t), "utf8"); } catch { return ""; } })
    .join("\n");
  const imported = untracked.filter((u) => {
    const base = u.replace(/.*\//, "").replace(/\.ts$/, "");
    return trackedContents.includes(`/${base}.js"`) || trackedContents.includes(`/${base}.js'`);
  });
  if (imported.length > 0) {
    return { level: "fatal", check: "untracked-imports", message: `untracked source files are imported by tracked code (origin/CI will fail TS2307): ${imported.map((u) => u.replace(/.*\/src\//, "src/")).join(", ")} — git add them` };
  }
  return { level: "warn", check: "untracked-imports", message: `${untracked.length} untracked src/*.ts (not yet imported by tracked code)` };
}

/** Advisory lock record shape shared by autopilot-locks (autopilot run lock +
 *  compiler-run lock both write `{ pid, host, at, owner }`). */
type LockRecord = { pid?: number; host?: string; at?: string; owner?: string };

/**
 * Inspect one `state/autopilot-locks/*.lock`. DETECTION ONLY — it never signals,
 * kills, or removes anything; the pid probe is `kill(pid, 0)` (ESRCH = dead) and
 * the report carries the exact `rm` an operator can run by hand.
 *
 *  - foreign-host lock → liveness is UNVERIFIABLE from here (warn, no auto-claim).
 *  - same-host + dead pid (ESRCH) → STALE (warn + rm command).
 *  - same-host + live pid (or EPERM = alive under another user) → OK.
 *  - torn/malformed → warn (an operator should confirm no run is active, then rm).
 */
export function inspectAutopilotLock(path: string): DoctorFinding {
  const name = path.split(/[/\\]+/).pop() ?? path;
  const rm = `rm ${path}`;
  let rec: LockRecord;
  try {
    const parsed = JSON.parse(readFileSync(path, "utf8"));
    if (!parsed || typeof parsed !== "object") throw new Error("not an object");
    rec = parsed as LockRecord;
  } catch {
    return { level: "warn", check: "autopilot-locks", message: `${name}: unreadable/torn lock — if no run is active, clear with: ${rm}` };
  }
  if (rec.host && rec.host !== hostname()) {
    return { level: "warn", check: "autopilot-locks", message: `${name}: held by pid ${rec.pid}@${rec.host} (foreign host) since ${rec.at ?? "?"} — liveness UNVERIFIABLE from this host; if that host/run is gone, clear with: ${rm}` };
  }
  if (typeof rec.pid !== "number") {
    return { level: "warn", check: "autopilot-locks", message: `${name}: malformed lock (no pid) — if no run is active, clear with: ${rm}` };
  }
  // Same host: kill -0 liveness probe (ESRCH = dead, EPERM = alive under another user).
  let dead = false;
  try {
    process.kill(rec.pid, 0);
  } catch (err) {
    dead = (err as NodeJS.ErrnoException)?.code === "ESRCH";
  }
  if (dead) {
    return { level: "warn", check: "autopilot-locks", message: `${name}: STALE — owner pid ${rec.pid} is not alive (held since ${rec.at ?? "?"}); clear with: ${rm}` };
  }
  return { level: "ok", check: "autopilot-locks", message: `${name}: held by live pid ${rec.pid}` };
}

/** Report any lock under `state/autopilot-locks/` whose owner is provably dead
 *  (same host) or unverifiable (foreign host). Detection only — never removes. */
export function checkStaleLocks(lockDir = resolve(STATE_DIR, "autopilot-locks")): DoctorFinding[] {
  let names: string[];
  try {
    names = readdirSync(lockDir).filter((n) => n.endsWith(".lock"));
  } catch {
    return [{ level: "ok", check: "autopilot-locks", message: "no autopilot-locks dir" }];
  }
  if (names.length === 0) return [{ level: "ok", check: "autopilot-locks", message: "no held autopilot locks" }];
  return names.sort().map((n) => inspectAutopilotLock(resolve(lockDir, n)));
}

/**
 * PENDING DEPLOY — surface any un-served publish debt recorded in the outer
 * checkout's `.pending-deploy.json` (F-11). publish-final ends at `git push` by
 * design; the app only serves content after a separate S3 upload + web deploy,
 * so a "PUBLISHED" book can sit stale in prod indefinitely with only a JSON file
 * recording the debt. This makes it loud and aging. Strictly read-only — it never
 * writes, clears, or triggers a deploy. WARN at any age (never fatal: visibility,
 * not a block); escalated wording past 24h. A missing outer root reports UNKNOWN
 * (a warning), never a false "all clear"; a hand-mangled sentinel warns loudly
 * instead of crashing doctor. `now` is injectable for deterministic tests.
 */
export function checkPendingDeploy(outerRoot?: string, now: number = Date.now()): DoctorFinding[] {
  const report = readPendingDeploy(outerRoot);
  if (report.outcome === "outer-root-missing" || report.outcome === "malformed") {
    return [{ level: "warn", check: "pending-deploy", message: report.warning }];
  }
  if (report.outcome === "clean") {
    return [{ level: "ok", check: "pending-deploy", message: "no pending deploy debt (outer app is serving the published catalog)" }];
  }
  return report.entries.map((e) => {
    const ageH = pendingDeployAgeHours(e.publishedAt, now);
    const age = ageH == null ? `unknown age (publishedAt="${e.publishedAt}")` : `${ageH}h ago`;
    const steps = e.steps.length ? e.steps.join(" → ") : "(no steps recorded)";
    const stale = ageH != null && ageH >= 24;
    const message = stale
      ? `STALE >24h — ${e.bookId} has owed a deploy since ${age}; the app is serving OLD content. Deploy now: ${steps} (docs/v24/DEPLOY-RUNBOOK.md)`
      : `DEPLOY PENDING — ${e.bookId} published ${age}, not yet served by the app; ${e.steps.length} step(s) remaining: ${steps} (docs/v24/DEPLOY-RUNBOOK.md)`;
    return { level: "warn", check: "pending-deploy", message };
  });
}

// ── WP-602: generate-book preflight checks ──────────────────────────────────
//
// worktree-clean, base-sha-match, branch-sanity, model-config-support,
// schema-fixtures, name-bank-config, and d7-audit-tooling are the NEW
// deterministic findings this WP adds (master plan §8 WP-602). Each is
// independently exported/testable, and `runGeneratePreflightChecks` composes
// them with the existing `runDoctorChecks` battery for the entry point
// WP-601's `generate-book` command calls before any book work starts.

/** A git-invoking function, matching `Runner` in src/qc/publishAfterQc.ts
 *  structurally so the SAME injected fake can drive both — the pattern that
 *  module's own git-touching functions/tests already use (`dirtyVsHead`,
 *  `publishBranchError`, tests/publish-after-qc-git.test.ts). Real callers get
 *  `defaultGitRunner` (a real `git` subprocess); tests inject a fake that
 *  returns canned output for a specific arg vector — no real repo needed, no
 *  dependency on this ACTUAL worktree's current (constantly-changing, mid-
 *  development) git state. */
type GitRunner = (cmd: string, args: string[], options?: { cwd?: string; env?: NodeJS.ProcessEnv; timeoutMs?: number }) => string;

/** Throws on a non-zero exit (git failures are a THROW here, not an empty
 *  string) so every caller has one place to catch/report "could not run
 *  git" rather than silently misreading empty stdout as "clean"/"no HEAD". */
const defaultGitRunner: GitRunner = (cmd, args, options = {}) => {
  const r = spawnSync(cmd, args, { cwd: options.cwd ?? PIPELINE_DIR, env: options.env, encoding: "utf8", timeout: options.timeoutMs });
  if (r.status !== 0) {
    throw new Error((r.stderr ?? "").trim().slice(0, 200) || `${cmd} ${args.join(" ")} exited ${r.status}`);
  }
  return r.stdout ?? "";
};

/**
 * Worktree cleanliness (V25-14 / WP-104's branch-sensitivity concern). Runs
 * `git status --porcelain` from the pipeline dir — git walks up to the
 * enclosing repo, the SAME pattern `checkUntrackedImports` above and
 * `publishBranchError` (src/qc/publishAfterQc.ts) already rely on, so this
 * works identically whether the package carries its own `.git` or is nested
 * inside an outer checkout/worktree.
 *
 * A dirty tracked tree is `fatal` ONLY when the caller says this run DEMANDS
 * a clean worktree (`opts.require`) — an operator poking at the preflight
 * mid-edit is normal and must not be told to halt; `require` is what the
 * generate-book command sets before starting unattended work. Undeterminable
 * (git missing/erroring) reports `warn`, never a silent `ok` — a check that
 * cannot run must never claim to have passed (WP-602 stop condition).
 */
export function checkWorktreeClean(opts: { require?: boolean; runner?: GitRunner } = {}): DoctorFinding {
  const runner = opts.runner ?? defaultGitRunner;
  let output: string;
  try {
    output = runner("git", ["status", "--porcelain"]);
  } catch (err) {
    return { level: "warn", check: "worktree-clean", message: `could not determine worktree cleanliness: ${(err as Error).message}` };
  }
  const lines = output.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) {
    return { level: "ok", check: "worktree-clean", message: "worktree is clean (no uncommitted changes)" };
  }
  const sample = lines.slice(0, 5).join("; ");
  const tail = lines.length > 5 ? "; …" : "";
  return opts.require
    ? { level: "fatal", check: "worktree-clean", message: `worktree has ${lines.length} uncommitted change(s) (${sample}${tail}) — this run demands a clean worktree; commit or stash before proceeding.` }
    : { level: "warn", check: "worktree-clean", message: `worktree has ${lines.length} uncommitted change(s) (${sample}${tail})` };
}

/**
 * Base-SHA match — the worktree is (or is not) built on the approved
 * integration SHA the caller expects. Absent an `expectedSha` this check has
 * nothing to compare and reports `ok` (not applicable), never a guessed pass
 * or fail. A short/malformed `expectedSha` (<7 chars) can't be compared
 * reliably against an abbreviated `git rev-parse` output, so it warns rather
 * than risking a prefix-collision false match.
 */
export function checkBaseShaMatch(expectedSha?: string, opts: { runner?: GitRunner } = {}): DoctorFinding {
  if (!expectedSha || !expectedSha.trim()) {
    return { level: "ok", check: "base-sha-match", message: "no expected base SHA configured — check not applicable" };
  }
  const expected = expectedSha.trim();
  if (expected.length < 7) {
    return { level: "warn", check: "base-sha-match", message: `expected SHA "${expected}" is too short (<7 chars) to compare reliably` };
  }
  const runner = opts.runner ?? defaultGitRunner;
  let current: string;
  try {
    current = runner("git", ["rev-parse", "HEAD"]).trim();
  } catch (err) {
    return { level: "warn", check: "base-sha-match", message: `could not determine current HEAD SHA: ${(err as Error).message}` };
  }
  const matches = current === expected || current.startsWith(expected) || expected.startsWith(current);
  if (!matches) {
    return { level: "fatal", check: "base-sha-match", message: `HEAD is ${current.slice(0, 12)} but the expected integration SHA is ${expected.slice(0, 12)} — this worktree is not based on the approved SHA.` };
  }
  return { level: "ok", check: "base-sha-match", message: `HEAD ${current.slice(0, 12)} matches the expected base SHA` };
}

/**
 * Branch sanity — REUSES the existing publish-time branch guard
 * (`publishBranchError`, src/qc/publishAfterQc.ts) so "which branch is this
 * worktree on" is answered by the SAME logic, not a second copy. Generation
 * itself does not require `main` (every S-tier work package in this program
 * is authored off `main`, in its own worktree/branch), so an off-main branch
 * is `warn` here — visible context, not a false requirement; `publish` still
 * enforces its own on-main rule unconditionally when the book actually ships.
 * Dynamically imported so this module's default (static) import graph does
 * not grow by publishAfterQc.ts's much heavier transitive dependencies
 * (promoteBook/generateBook/the deterministic floor/quiz-key gate/…) — the
 * cost is paid only when this specific check actually runs.
 */
export async function checkBranchSanity(opts: { runner?: GitRunner } = {}): Promise<DoctorFinding> {
  const { publishBranchError } = await import("../qc/publishAfterQc.js");
  const runner = opts.runner ?? defaultGitRunner;
  let error: string | null;
  try {
    error = publishBranchError(runner);
  } catch (err) {
    return { level: "warn", check: "branch-sanity", message: `could not determine the current branch: ${(err as Error).message}` };
  }
  if (error) {
    return { level: "warn", check: "branch-sanity", message: `${error} (advisory for generation — publish enforces this unconditionally when the book ships)` };
  }
  return { level: "ok", check: "branch-sanity", message: "on main (or CHAPTERFLOW_ALLOW_PUBLISH_BRANCH=1 is set) — publish will not be branch-blocked" };
}

/**
 * Name-bank / config-file integrity — REUSES `loadNameBank()`
 * (src/librarian/namePlan.ts), the SAME function `name-plan`/CHB3 depend on,
 * which reads+parses `config/name-bank.json` and THROWS on unreadable/corrupt
 * JSON. `name-plan` calls it uncaught (a corrupt bank already fails that
 * command closed); this surfaces the SAME failure here, before any authoring
 * work starts, rather than a second bespoke validator. `config/banned-
 * connectives.json` (`loadBannedConnectives()`, same module) is checked the
 * same way. A bank that parses but yields zero bankable names degrades
 * CHB3/name-plan to a silent no-op (readerBudgets.ts's own documented
 * fallback) — visible here as `warn`, not a crash. `opts` path overrides are
 * test-only (point at a fixture instead of the real committed config).
 */
export function checkNameBankConfig(opts: { nameBankPath?: string; bannedConnectivesPath?: string } = {}): DoctorFinding {
  try {
    const bank = opts.nameBankPath !== undefined ? loadNameBank(opts.nameBankPath) : loadNameBank();
    if (opts.bannedConnectivesPath !== undefined) loadBannedConnectives(opts.bannedConnectivesPath);
    else loadBannedConnectives();
    if (bank.length === 0) {
      return { level: "warn", check: "name-bank-config", message: "config/name-bank.json parsed but yielded zero bankable names — CHB3/name-plan will silently degrade to a no-op" };
    }
    return { level: "ok", check: "name-bank-config", message: `config/name-bank.json + config/banned-connectives.json present and valid (${bank.length} bankable name(s))` };
  } catch (err) {
    return { level: "fatal", check: "name-bank-config", message: `name-bank/config unreadable or corrupt: ${(err as Error).message}` };
  }
}

/** Reasoning-effort union this pipeline routes locally (mirrors the private
 *  `EFFORTS` list in `../orchestrator/modelPolicy.ts`, which is not exported —
 *  API-only "max" is deliberately excluded, matching `resolveRoute`). */
const SUPPORTED_EFFORTS: readonly string[] = ["minimal", "low", "medium", "high", "xhigh"];

/**
 * Model-config support — REPORTS (never enforces; that is WP-504/the
 * command's job) whether a requested model is in the 5.6 candidate set and a
 * requested effort is one this pipeline routes. No live/network call: family
 * membership is looked up in `CANDIDATE_MODELS` (data), never probed against
 * a provider. Omitted `model`/`effort` default to the central normal-profile
 * model (`NORMAL_PROFILE_MODEL.model`, always a confirmed candidate by
 * construction) and "not specified" respectively, so a bystander call to this
 * check without an explicit `--model`/`--effort` still reports something
 * meaningful. An unknown model family is `fatal` (directive-1: no silent
 * fallback to an unsupported model); a candidate whose capability is not yet
 * `confirmed` (terra/luna, pending WP-502) is `warn` — visible, not a hard
 * block, since it is legitimate bakeoff data, just not yet production-routed.
 */
export function checkModelConfigSupport(opts: { model?: string; effort?: string } = {}): DoctorFinding {
  const model = opts.model ?? NORMAL_PROFILE_MODEL.model;
  const known = CANDIDATE_MODELS.find((c) => c.family === model);
  const parts: string[] = [];
  const levels: DoctorFinding["level"][] = [];

  if (!known) {
    levels.push("fatal");
    parts.push(`model "${model}" is not in the 5.6 candidate set (${CANDIDATE_MODELS.map((c) => c.family).join(", ")})`);
  } else if (known.capability !== "confirmed") {
    levels.push("warn");
    parts.push(`model "${model}" is a 5.6 candidate but its capability is "${known.capability}" — not yet confirmed for production routing`);
  } else {
    levels.push("ok");
    parts.push(`model "${model}" is a confirmed 5.6 candidate`);
  }

  if (opts.effort !== undefined) {
    if (!SUPPORTED_EFFORTS.includes(opts.effort)) {
      levels.push("fatal");
      parts.push(`effort "${opts.effort}" is not a supported reasoning effort (allowed: ${SUPPORTED_EFFORTS.join(", ")})`);
    } else {
      levels.push("ok");
      parts.push(`effort "${opts.effort}" is supported`);
    }
  }

  const level: DoctorFinding["level"] = levels.includes("fatal") ? "fatal" : levels.includes("warn") ? "warn" : "ok";
  return { level, check: "model-config-support", message: parts.join("; ") };
}

/**
 * Schema-fixture validity — the frozen contract manifest still matches the
 * live contract descriptors (`contractFreezeDivergences`, IMP-12) AND the
 * canonical emission sample still satisfies the frozen consumer-parity
 * contract (`validateEmissionParity`, WP-102). Both are the SAME deterministic
 * functions `contract-validate` runs (src/cli.ts), called in-process here
 * rather than by spawning the CLI. `manifest`/`emission` are injectable so a
 * test can hand this a deliberately corrupt fixture without touching the real
 * committed manifest.
 */
export function checkSchemaFixtures(opts: { manifest?: ContractManifest; emission?: unknown } = {}): DoctorFinding {
  let divergences: string[];
  try {
    divergences = opts.manifest ? contractFreezeDivergences(opts.manifest) : contractFreezeDivergences();
  } catch (err) {
    return { level: "fatal", check: "schema-fixtures", message: `contract manifest unreadable/corrupt: ${(err as Error).message}` };
  }
  let parityErrors: string[];
  try {
    parityErrors = validateEmissionParity(opts.emission ?? canonicalEmissionSample());
  } catch (err) {
    return { level: "fatal", check: "schema-fixtures", message: `emission-parity fixture unreadable/corrupt: ${(err as Error).message}` };
  }
  const problems = [...divergences, ...parityErrors];
  if (problems.length > 0) {
    const tail = problems.length > 5 ? "; …" : "";
    return { level: "fatal", check: "schema-fixtures", message: `${problems.length} schema-fixture issue(s): ${problems.slice(0, 5).join("; ")}${tail}` };
  }
  return { level: "ok", check: "schema-fixtures", message: "contract manifest + emission-parity fixtures are valid" };
}

/** The env var REQUIRE-mode name the D7 ship gate owns (mirrors
 *  `CHAPTERFLOW_REQUIRE_D7_SHIP_GATE_ENV` in `../critics/d7ShipGate.ts`, kept
 *  as a literal here rather than a static import so this module's default
 *  import graph stays light — see the dynamic imports below). */
const CHAPTERFLOW_REQUIRE_D7_SHIP_GATE_ENV = "CHAPTERFLOW_REQUIRE_D7_SHIP_GATE";

/**
 * D7 REQUIRE-mode prerequisite — when the caller has (or the environment has)
 * `CHAPTERFLOW_REQUIRE_D7_SHIP_GATE=1` set, the rubric-audit tooling the D7
 * gate's REQUIRE path depends on (the `migration-bakeoff rubric-audit-*`
 * dispatcher + its path resolver) must actually be reachable — a broken
 * import there would only surface later, mid-audit, wasting a live run.
 * Dynamic `import()` proves REACHABILITY (the whole transitive module graph
 * resolves), not just file presence, and is still deterministic/network-free:
 * module resolution touches only the local filesystem. When REQUIRE mode is
 * not set, this is a no-op `ok` (the D7 gate runs in advisory mode and never
 * needs this tooling).
 */
export async function checkD7AuditToolingReachable(require: boolean): Promise<DoctorFinding> {
  if (!require) {
    return { level: "ok", check: "d7-audit-tooling", message: `${CHAPTERFLOW_REQUIRE_D7_SHIP_GATE_ENV} is not set — audit-tooling reachability check skipped` };
  }
  try {
    const dispatcher = await import("../bakeoff/migration/cli.js");
    if (typeof dispatcher.runMigrationBakeoffCli !== "function") {
      return { level: "fatal", check: "d7-audit-tooling", message: `${CHAPTERFLOW_REQUIRE_D7_SHIP_GATE_ENV}=1: migration/cli.js loaded but runMigrationBakeoffCli is not exported — the rubric-audit dispatcher is broken` };
    }
    const instrument = await import("../bakeoff/migration/rubricAuditInstrument.js");
    if (typeof instrument.rubricAuditDirRelPath !== "function") {
      return { level: "fatal", check: "d7-audit-tooling", message: `${CHAPTERFLOW_REQUIRE_D7_SHIP_GATE_ENV}=1: rubricAuditInstrument.js loaded but rubricAuditDirRelPath is not exported — the rubric-audit path resolver is broken` };
    }
    return { level: "ok", check: "d7-audit-tooling", message: `${CHAPTERFLOW_REQUIRE_D7_SHIP_GATE_ENV}=1: rubric-audit dispatcher + path resolver are reachable` };
  } catch (err) {
    return { level: "fatal", check: "d7-audit-tooling", message: `${CHAPTERFLOW_REQUIRE_D7_SHIP_GATE_ENV}=1 but the rubric-audit tooling is UNREACHABLE: ${(err as Error).message}` };
  }
}

export function runDoctorChecks(bookId?: string): DoctorFinding[] {
  const findings: DoctorFinding[] = [checkShadowStateDir(), checkUntrackedImports(), ...checkStaleLocks(), ...checkPendingDeploy()];
  if (bookId) {
    findings.push(checkDualBrief(bookId), checkChapterNumbers(bookId), checkCanonicalChapterSet(bookId), checkTocContract(bookId), checkSweepHistory(bookId));
  } else {
    // sweep every book's chapter-number integrity
    try {
      const books = new Set(
        readdirSync(resolve(STATE_DIR, "chapters"))
          .map((f) => f.match(/^(.+)-ch\d+\.v21-native\.chapter\.json$/i)?.[1])
          .filter((b): b is string => !!b),
      );
      for (const b of [...books].sort()) findings.push(checkChapterNumbers(b));
    } catch { /* no chapters dir */ }
  }
  return findings;
}

export type GeneratePreflightOptions = {
  /** Present ⇒ per-book checks (dual-brief, chapter-numbers, canonical-set,
   *  TOC, sweep-history) run in addition to the global ones; absent ⇒ the
   *  global-only sweep, same as bare `runDoctorChecks()`. */
  bookId?: string;
  /** The requested model for this run; defaults to the central normal-profile
   *  model (`NORMAL_PROFILE_MODEL.model`) when omitted. */
  model?: string;
  /** The requested reasoning effort; unchecked when omitted. */
  effort?: string;
  /** The approved integration SHA this worktree must be based on; the check
   *  is not-applicable (`ok`) when omitted. */
  expectedBaseSha?: string;
  /** True ⇒ a dirty worktree is `fatal`, not a soft `warn` (this run demands
   *  a clean tree before starting unattended book work). */
  requireCleanWorktree?: boolean;
  /** True ⇒ verify the D7 rubric-audit tooling is reachable; defaults to
   *  reading `CHAPTERFLOW_REQUIRE_D7_SHIP_GATE` from the environment. */
  requireD7ShipGate?: boolean;
};

/**
 * The deterministic preflight for the generate-book command (WP-602; WP-601
 * wires this in before any book work starts — see master plan §8 WP-602).
 * Combines the existing workspace `runDoctorChecks` battery (shadow-state
 * dir, dual-brief, chapter numbers, canonical set, TOC contract, sweep
 * history, untracked imports, stale locks, pending deploy) with the checks
 * this WP adds: worktree cleanliness, base-SHA match, branch sanity,
 * model-config support, schema-fixture validity, name-bank/config integrity,
 * and the D7 REQUIRE-mode audit-tooling-reachable check. Every check is
 * deterministic — filesystem/git/config reads only,
 * ZERO model or network calls — and reports through the SAME `DoctorFinding`
 * `ok`/`warn`/`fatal` levels `doctorExitCode` already maps to 0/1/2 (no new
 * exit codes). This function only REPORTS; enforcing a halt on a fatal
 * finding is the calling command's job (WP-504/WP-601), not this module's.
 */
export async function runGeneratePreflightChecks(opts: GeneratePreflightOptions = {}): Promise<DoctorFinding[]> {
  const requireD7 = opts.requireD7ShipGate ?? process.env[CHAPTERFLOW_REQUIRE_D7_SHIP_GATE_ENV] === "1";
  return [
    ...runDoctorChecks(opts.bookId),
    checkWorktreeClean({ require: opts.requireCleanWorktree }),
    checkBaseShaMatch(opts.expectedBaseSha),
    await checkBranchSanity(),
    checkModelConfigSupport({ model: opts.model, effort: opts.effort }),
    checkSchemaFixtures(),
    checkNameBankConfig(),
    await checkD7AuditToolingReachable(requireD7),
  ];
}

/**
 * Render `findings` as the publish-preflight "definition of done" checklist —
 * reusing the ALREADY-EXISTING `formatPreflightChecklist` (src/qc/publishAfterQc.ts)
 * verbatim rather than re-implementing a second checklist renderer. Imported
 * dynamically so this module's (and every static `doctor.ts` importer's,
 * e.g. optimizedPipeline.ts) default import graph stays exactly as light as
 * before — the cost of publishAfterQc.ts's much heavier import graph is paid
 * only by a caller that actually asks for this rendering.
 */
export async function formatGeneratePreflightChecklist(findings: DoctorFinding[]): Promise<string> {
  const { formatPreflightChecklist } = await import("../qc/publishAfterQc.js");
  const checks = findings.map((f) => ({
    check: f.check,
    blockers: f.level === "ok" ? [] : [`[${f.level}] ${f.message}`],
  }));
  return formatPreflightChecklist(checks);
}

export function formatDoctor(findings: DoctorFinding[]): string {
  const icon = (l: DoctorFinding["level"]) => (l === "ok" ? "✓" : l === "warn" ? "⚠" : "✗");
  const fatal = findings.filter((f) => f.level === "fatal").length;
  const warn = findings.filter((f) => f.level === "warn").length;
  const L: string[] = [`DOCTOR — ${fatal} fatal, ${warn} warning(s)`];
  // Show fatals + warnings first, then a compact ok summary.
  for (const f of findings.filter((f) => f.level !== "ok")) L.push(`  ${icon(f.level)} [${f.check}] ${f.message}`);
  const oks = findings.filter((f) => f.level === "ok");
  if (oks.length) L.push(`  ✓ ${oks.length} check(s) passed`);
  return L.join("\n");
}

export function doctorExitCode(findings: DoctorFinding[]): number {
  if (findings.some((f) => f.level === "fatal")) return 2;
  if (findings.some((f) => f.level === "warn")) return 1;
  return 0;
}
