/**
 * doctor — one preflight that catches the workspace traps this pipeline has hit
 * before, so they fail a check instead of a generation run:
 *   - the dual state/chapters shadow dir (canonical vs repo-root divergence)
 *   - dual brief shapes for one book (.brief.json AND .manual-brief.json)
 *   - chapter-number drift (dupes/gaps that make AS5–AS12 silently skip)
 *   - untracked src/*.ts imported by tracked code (the TS2307-on-origin trap)
 * Read-only. Exit 0 = healthy, 1 = warnings, 2 = a blocking trap.
 */

import { spawnSync } from "child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "fs";
import { hostname, tmpdir } from "os";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

import { assertNoShadowStateDir } from "../lib/chapterPaths.js";
import { pendingDeployAgeHours, readPendingDeploy } from "../publish/publishFinal.js";
import { compareChapterSetToCanonical, formatChapterSetBlockers, readCanonicalChapterIndex } from "../lib/chapterSet.js";
import { findRunArtifact } from "../lib/runDirs.js";
import { formatTocIssues, parseTocFile } from "../lib/tocContract.js";
import { loadBookChapters } from "../qc/manualKeyJudge.js";
import { loadSweepHistory } from "../qc/sweep.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PIPELINE_DIR = resolve(__dirname, "../..");
const REPO_ROOT = PIPELINE_DIR;
const STATE_DIR = resolve(PIPELINE_DIR, "state");
const SRC_DIR = resolve(PIPELINE_DIR, "src");
const RUNS_DIR = resolve(REPO_ROOT, ".chapterflow/runs");

export type DoctorFinding = { level: "ok" | "warn" | "fatal" | "skip"; check: string; message: string };

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

/**
 * V4 ROUTE — the doctor must see the live V4 production path (the audit's
 * "doctor is blind to the V4 route" gap): the configured model CLI is
 * qualified BEFORE any model work, the v25 root the CLI writes candidates/run
 * state into is actually writable, and `createProductionBookRunComposition`
 * (the real production wiring `book-run`/`book-autopilot` use) constructs
 * without throwing. Read/probe-only: never runs a book, never spawns a real
 * model call — `model-cli` degrades to SKIP under the hermetic no-API
 * operating mode (CHAPTERFLOW_NO_API_CODEX_QC=1) so a doctor run inside the
 * test/CI harness can never trigger a billed spawn.
 */
const V4_ROUTE_PROBE_ROOT = resolve(tmpdir(), "chapterflow-doctor-v4-route-probe");

async function checkModelCli(): Promise<DoctorFinding> {
  if (process.env.CHAPTERFLOW_NO_API_CODEX_QC === "1") {
    return {
      level: "skip",
      check: "v4-route:model-cli",
      message: "hermetic mode (CHAPTERFLOW_NO_API_CODEX_QC=1) — model CLI preflight skipped; no real spawn in this mode",
    };
  }
  try {
    const { qualifyCodexCli, assertFlagsSupported, CODEX_ROUTE_REQUIRED_FLAGS } = await import("../exec/cliQualification.js");
    const qual = await qualifyCodexCli({ bin: "codex" });
    assertFlagsSupported(qual, CODEX_ROUTE_REQUIRED_FLAGS);
    return {
      level: "ok",
      check: "v4-route:model-cli",
      message: `codex CLI qualified (version ${qual.version || "unknown"}); required flags present: ${CODEX_ROUTE_REQUIRED_FLAGS.join(", ")}`,
    };
  } catch (e) {
    return { level: "fatal", check: "v4-route:model-cli", message: `model CLI preflight failed: ${(e as Error).message}` };
  }
}

async function checkV25RootWritable(v25Root: string): Promise<DoctorFinding> {
  try {
    mkdirSync(v25Root, { recursive: true });
    const probe = resolve(v25Root, `.doctor-write-probe-${process.pid}-${Date.now()}`);
    writeFileSync(probe, "ok", "utf8");
    rmSync(probe, { force: true });
    return { level: "ok", check: "v4-route:v25-root-writable", message: `v25 root is writable: ${v25Root}` };
  } catch (e) {
    return { level: "fatal", check: "v4-route:v25-root-writable", message: `v25 root is not writable: ${v25Root} — ${(e as Error).message}` };
  }
}

async function checkCompositionConstructs(input: { pipelineRoot: string; v25Root: string; attemptRoot: string }): Promise<DoctorFinding> {
  try {
    const { createProductionBookRunComposition } = await import("../app/bookRunComposition.js");
    await createProductionBookRunComposition({
      bookId: "doctor-v4-route-probe",
      pipelineRoot: input.pipelineRoot,
      v25Root: input.v25Root,
      attemptRoot: input.attemptRoot,
    });
    return {
      level: "ok",
      check: "v4-route:composition-constructs",
      message: "createProductionBookRunComposition (the book-run/book-autopilot wiring) constructs without throwing",
    };
  } catch (e) {
    return { level: "fatal", check: "v4-route:composition-constructs", message: `production composition failed to construct: ${(e as Error).message}` };
  }
}

/** Run the 3 V4-route checks (`model-cli`, `v25-root-writable`,
 *  `composition-constructs`). Every override is optional; callers without a
 *  real v25/attempt root (a bare `doctor` invocation) get an isolated probe
 *  root under the OS temp dir so the probe never touches production state. */
export async function checkV4Route(opts: {
  pipelineRoot?: string;
  v25Root?: string;
  attemptRoot?: string;
} = {}): Promise<DoctorFinding[]> {
  const pipelineRoot = opts.pipelineRoot ?? PIPELINE_DIR;
  const v25Root = opts.v25Root ?? resolve(V4_ROUTE_PROBE_ROOT, "v25");
  const attemptRoot = opts.attemptRoot ?? resolve(V4_ROUTE_PROBE_ROOT, "attempts");
  return [
    await checkModelCli(),
    await checkV25RootWritable(v25Root),
    await checkCompositionConstructs({ pipelineRoot, v25Root, attemptRoot }),
  ];
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

export function formatDoctor(findings: DoctorFinding[]): string {
  const icon = (l: DoctorFinding["level"]) => (l === "ok" ? "✓" : l === "warn" ? "⚠" : l === "skip" ? "○" : "✗");
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
