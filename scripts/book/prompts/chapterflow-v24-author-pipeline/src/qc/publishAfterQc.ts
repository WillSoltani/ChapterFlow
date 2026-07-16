import { execFileSync } from "child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync } from "fs";
import { dirname, relative, resolve } from "path";
import { fileURLToPath } from "url";

import { checkQcAttestation } from "../critics/qcAttestation.js";
import { runBookGate } from "../critics/bookGate.js";
import { runIntraBookChecks } from "../critics/intraBook.js";
import { runShipGate } from "../critics/finalGate.js";
import { checkKeyJudge } from "../critics/quizKeyGate.js";
import { deriveCategoriesAndTags } from "../agents/autoCategorize.js";
import { loadChapterIndex } from "../generateBook.js";
import { promoteBook } from "../promoteBook.js";
import { V21_SCHEMA_VERSION } from "../types.js";
import { CANONICAL_STATE, REPO_ROOT } from "../lib/chapterPaths.js";
import { compareChapterSetToCanonical, readCanonicalChapterIndex } from "../lib/chapterSet.js";
import { verifyProductionPackage } from "../verifyProductionPackage.js";
import {
  CHAPTERFLOW_REQUIRE_D7_SHIP_GATE_ENV,
  evaluateD7ShipGateForPreflight,
} from "../critics/d7ShipGate.js";
import { normalizeChapterProvenance } from "./normalizeProvenance.js";
import { checkManualKeyJudge, loadBookChapters } from "./manualKeyJudge.js";
import { unresolvedMajors } from "./majorDisposition.js";
import { qcRoundPath } from "./qcRound.js";
import { checkPlanEnforcement } from "./planEnforcement.js";
import { checkSourceV2Gate } from "./sourceV2Gate.js";
import { evaluateSourceRealityPolicy } from "./sourceRealityPolicy.js";
import { checkSweep } from "./sweep.js";
import { resolveBookIdentifier } from "./auto/resolveBook.js";
import { finalizeQcRound } from "./orchestrator/finalize.js";
import { effectiveLedgerResilient } from "./orchestrator/ledger.js";
import {
  evidenceMatrixPath,
  orchestratorRoundDir,
  qcSummaryPath,
  repairBriefPath,
  repairLedgerPath,
  repairPromptPath,
  roundRecordPath,
  submissionsDir,
  taskCardsDir,
} from "./orchestrator/artifacts.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PIPELINE_DIR = resolve(__dirname, "../..");
const BOOK_PACKAGES_DIR = resolve(REPO_ROOT, "book-packages");

const ROLE_TOKEN_PATTERNS = [
  "cfq-sweep-",
  "cfq-keyA-",
  "cfq-keyB-",
  "cfq-bar-",
  "cfq-confirm-",
  "cfq-major-",
  "cfq-attest-",
];

export type PublishAfterQcOptions = {
  input: string;
  roundId: string;
  title?: string;
  author?: string;
  commit?: boolean;
  push?: boolean;
  cleanup?: "transient" | "none" | "audit-unsafe";
  includeState?: boolean;
  dryRun?: boolean;
};

export type PublishAfterQcResult = {
  ok: boolean;
  bookId?: string;
  roundId?: string;
  packagePath?: string;
  registeredFiles?: string[];
  cleaned?: string[];
  preserved?: string[];
  staged?: string[];
  commitHash?: string;
  pushed?: boolean;
  errors: string[];
  warnings: string[];
  next?: string[];
  /** The publish-preflight definition-of-done checklist (which items passed). */
  checks?: PreflightCheck[];
};

/**
 * Whether a finished `publish-after-qc` should sweep the book's untracked working
 * state package-only (parity with the autopilot's post-publish prune). True ONLY
 * when the package was ACTUALLY committed + pushed (so the web app serves only the
 * committed package and the leftover chapters/QC/plans are debris), it is not a dry
 * run, and `--keep-state` was not requested. Gating on the real outcome
 * (`commitHash` + `pushed`) — not the flags — means a `--commit --push` whose push
 * FAILED never prunes. The prune itself is separately safe-by-construction
 * (untracked-only, committed-package-gated, book-scoped) in pruneBookState.ts.
 */
export function shouldPrunePostPublish(
  result: PublishAfterQcResult,
  opts: { dryRun: boolean; keepState: boolean },
): boolean {
  return result.ok === true
    && !!result.bookId
    && !!result.commitHash
    && result.pushed === true
    && opts.dryRun !== true
    && opts.keepState !== true;
}

type Metadata = { title?: string; author?: string; source?: string };

type Runner = (cmd: string, args: string[], options?: { cwd?: string; env?: NodeJS.ProcessEnv; timeoutMs?: number }) => string;

export type PublishAfterQcInternals = {
  runner?: Runner;
};

function readJson(path: string): any | null {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return null;
  }
}

function rel(path: string): string {
  const r = relative(REPO_ROOT, path);
  return r && !r.startsWith("..") ? r : path;
}

function isInside(path: string, dir: string): boolean {
  const r = relative(dir, path);
  return r === "" || (!!r && !r.startsWith("..") && !r.startsWith("/"));
}

function walkFiles(root: string): string[] {
  if (!existsSync(root)) return [];
  const st = statSync(root);
  if (!st.isDirectory()) return [root];
  const out: string[] = [];
  for (const name of readdirSync(root)) {
    const path = resolve(root, name);
    const child = statSync(path);
    if (child.isDirectory()) out.push(...walkFiles(path));
    else out.push(path);
  }
  return out;
}

function safeRm(path: string): boolean {
  if (!existsSync(path)) return false;
  rmSync(path, { recursive: true, force: true });
  return true;
}

function ledgerHasOpenFindings(bookId: string, roundId: string): boolean {
  return effectiveLedgerResilient(bookId, roundId).some((f) =>
    f.status === "open" || f.status === "still_open" || f.status === "needs_qc_rerun",
  );
}

export function transientCleanupPlan(bookId: string, roundId: string): { remove: string[]; preserve: string[] } {
  const roundDir = orchestratorRoundDir(bookId, roundId);
  const packDir = resolve(CANONICAL_STATE, "qc-packs", bookId, roundId);
  const remove = new Set<string>();
  const preserve = new Set<string>([
    evidenceMatrixPath(bookId, roundId),
    qcSummaryPath(bookId, roundId),
    repairLedgerPath(bookId, roundId),
  ]);

  const cards = taskCardsDir(bookId, roundId);
  if (existsSync(cards)) remove.add(cards);
  const workflow = resolve(roundDir, "qc-auto.workflow.js");
  if (existsSync(workflow)) remove.add(workflow);
  // REVIEW-PACKET.md carries the round's LIVE plaintext role tokens (operators copy the
  // bar/confirm tokens from it — the round itself persists only salted hashes). Remove it on
  // publish so live tokens don't linger on disk after the round is done.
  const reviewPacket = resolve(roundDir, "REVIEW-PACKET.md");
  if (existsSync(reviewPacket)) remove.add(reviewPacket);

  if (!ledgerHasOpenFindings(bookId, roundId)) {
    for (const p of [repairPromptPath(bookId, roundId), repairBriefPath(bookId, roundId)]) {
      if (existsSync(p)) remove.add(p);
    }
  } else {
    preserve.add(repairPromptPath(bookId, roundId));
    preserve.add(repairBriefPath(bookId, roundId));
  }

  for (const p of [...walkFiles(packDir), ...walkFiles(submissionsDir(bookId, roundId))]) {
    const base = p.split("/").pop() ?? "";
    if (base.endsWith(".input.json")) remove.add(p);
    if (base.toLowerCase().includes("token") && (isInside(p, packDir) || isInside(p, roundDir))) remove.add(p);
  }

  return {
    remove: [...remove].sort(),
    preserve: [...preserve].filter((p) => existsSync(p)).sort(),
  };
}

function defaultRunner(cmd: string, args: string[], options: { cwd?: string; env?: NodeJS.ProcessEnv; timeoutMs?: number } = {}): string {
  return execFileSync(cmd, args, {
    cwd: options.cwd ?? REPO_ROOT,
    env: options.env ?? process.env,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    // A bounded ceiling so a hung child (e.g. a wedged test) becomes a LOUD timeout
    // failure instead of hanging an unattended publish forever. 0/undefined = no limit.
    timeout: options.timeoutMs,
  }) as string;
}

function git(args: string[], runner: Runner): string {
  return runner("git", args, { cwd: REPO_ROOT });
}

/**
 * Branch guard for publishing. The convention is to commit + push the v21 package
 * DIRECTLY to main, and auto-publish (book-run/book-autopilot, default-on) runs this
 * UNATTENDED — where `git push` (push.default=simple) silently pushes whatever branch is
 * checked out. A run from a feature branch would therefore publish THERE and falsely
 * report "pushed to main". This guard returns an error string when HEAD is not `main`
 * (so the caller fails LOUD and the conductor HALTs with a clear reason instead of
 * silently mis-targeting), or null when it is safe to commit. Override for tests / edge
 * ops with CHAPTERFLOW_ALLOW_PUBLISH_BRANCH=1.
 */
export function publishBranchError(runner: Runner): string | null {
  if (process.env.CHAPTERFLOW_ALLOW_PUBLISH_BRANCH === "1") return null;
  let branch = "";
  try {
    branch = git(["rev-parse", "--abbrev-ref", "HEAD"], runner).trim();
  } catch {
    branch = "";
  }
  if (branch === "main") return null;
  return `Refusing to publish off main: HEAD is on "${branch || "(unknown)"}". Publishing commits + pushes the package directly to main — check out main, or set CHAPTERFLOW_ALLOW_PUBLISH_BRANCH=1 to override.`;
}

function cachedFiles(runner: Runner): string[] {
  return git(["diff", "--cached", "--name-only"], runner)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => resolve(REPO_ROOT, line));
}

/**
 * Uncommitted tracked SOURCE files outside the publish plan. The pre-commit tsc +
 * tests/run.ts validate the whole working tree, but `git commit` only includes the staged
 * plan — so an unrelated dirty source file (a) silently changes what got validated vs
 * committed, and (b) can fail the pre-commit checks for a reason unrelated to the book,
 * halting an otherwise-converged unattended publish. We only look at the surfaces tsc/tests
 * actually compile/run (src/tests/config/agent-prompts) — generated state/, book-packages/,
 * and scratch churn freely during a run and must be ignored. Override with
 * CHAPTERFLOW_ALLOW_DIRTY_PUBLISH=1.
 */
export function dirtySourceOutsidePlan(runner: Runner, plan: string[]): string[] {
  const allowed = new Set(plan.map((p) => resolve(p)));
  const sourceRoots = ["src", "tests", "config", "agent-prompts"].map((p) => resolve(REPO_ROOT, p));
  let status = "";
  try {
    status = git(["status", "--porcelain", "--untracked-files=no"], runner);
  } catch {
    return [];
  }
  const dirty: string[] = [];
  for (const line of status.split(/\r?\n/)) {
    if (!line.trim()) continue;
    let path = line.slice(3).trim(); // porcelain: "XY <path>"
    const arrow = path.indexOf(" -> ");
    if (arrow !== -1) path = path.slice(arrow + 4).trim(); // renamed → take the destination
    const abs = resolve(REPO_ROOT, path);
    if (!sourceRoots.some((root) => isInside(abs, root))) continue;
    if (allowed.has(abs)) continue;
    dirty.push(path);
  }
  return dirty;
}

function runPublishTests(runner: Runner): void {
  runner("npx", ["tsc", "-p", ".", "--noEmit"], { cwd: PIPELINE_DIR, timeoutMs: 300_000 });
  // The self-test validates the pipeline CODE on synthetic fixtures, so it must run in a HERMETIC env.
  // Strip EVERY CHAPTERFLOW_* operator flag (REQUIRE_SOURCE_VERIFY / ENFORCE_SESSION_INDEPENDENCE /
  // REQUIRE_KEYJUDGE / ENFORCE_MAJORS / STATE_DIR / SESSION_ID / …): each imposes a REAL-book
  // requirement on a fixture that doesn't carry it and can nondeterministically block an
  // otherwise-converged publish (the REQUIRE_SOURCE_VERIFY ordeal the old two-var strip only partly
  // patched; REQUIRE_KEYJUDGE is the same class — a green fixture writes no keyjudge record). An
  // allowlist beats the old denylist: a future strict var can't reopen the leak, and we stop fighting
  // ENFORCE_SESSION_INDEPENDENCE which the autopilot itself force-sets. Tests that need a strict flag
  // set it themselves; only no-api mode is forced on. Non-CHAPTERFLOW env (PATH/HOME/…) is preserved so
  // npx/tsx still run.
  runner("npx", ["tsx", "tests/run.ts", "qc-orchestrator", "qc-finalize", "no-api-promote", "qc-auto", "qc-submission", "publish-after-qc"], {
    cwd: PIPELINE_DIR,
    env: hermeticSelfTestEnv(),
    timeoutMs: 600_000,
  });
}

/** Build the HERMETIC child env for the self-test slice: strip EVERY CHAPTERFLOW_* operator flag (an
 *  allowlist beats the old delete-two-vars denylist — a future strict var can't reopen the leak) and
 *  force only CHAPTERFLOW_NO_API_CODEX_QC=1, preserving all non-CHAPTERFLOW env (PATH/HOME/…) so npx/tsx
 *  still run. Exported so the regression test can assert the strip without spawning the slice. */
export function hermeticSelfTestEnv(base: NodeJS.ProcessEnv = process.env): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { ...base };
  for (const k of Object.keys(env)) if (k.startsWith("CHAPTERFLOW_")) delete env[k];
  env.CHAPTERFLOW_NO_API_CODEX_QC = "1";
  return env;
}

function roundExists(bookId: string, roundId: string): boolean {
  return existsSync(roundRecordPath(bookId, roundId)) || existsSync(qcRoundPath(bookId, roundId));
}

function packageMetadata(bookId: string): Metadata {
  const path = resolve(BOOK_PACKAGES_DIR, `${bookId}.v21.json`);
  const pkg = readJson(path);
  return {
    title: typeof pkg?.book?.title === "string" ? pkg.book.title : undefined,
    author: typeof pkg?.book?.author === "string" ? pkg.book.author : undefined,
    source: existsSync(path) ? path : undefined,
  };
}

function briefMetadata(bookId: string): Metadata {
  const path = resolve(CANONICAL_STATE, "briefs", `${bookId}.manual-brief.json`);
  const brief = readJson(path);
  return {
    title: typeof brief?.title === "string" ? brief.title : undefined,
    author: typeof brief?.author === "string" ? brief.author : undefined,
    source: existsSync(path) ? path : undefined,
  };
}

function catalogMetadata(bookId: string): Metadata {
  const path = resolve(REPO_ROOT, "app/book/data/booksCatalog.metadata.json");
  const raw = readJson(path);
  const rows = Array.isArray(raw) ? raw : Array.isArray(raw?.books) ? raw.books : Array.isArray(raw?.items) ? raw.items : [];
  const entry = rows.find((row: any) => row?.bookId === bookId || row?.id === bookId);
  return {
    title: typeof entry?.title === "string" ? entry.title : typeof entry?.book?.title === "string" ? entry.book.title : undefined,
    author: typeof entry?.author === "string" ? entry.author : typeof entry?.book?.author === "string" ? entry.book.author : undefined,
    source: entry ? path : undefined,
  };
}

function resolveMetadata(bookId: string, opts: Pick<PublishAfterQcOptions, "title" | "author">): { title?: string; author?: string; sources: string[] } {
  const sources: string[] = [];
  const candidates = [packageMetadata(bookId), briefMetadata(bookId), catalogMetadata(bookId)];
  let title = opts.title;
  let author = opts.author;
  for (const c of candidates) {
    if (c.source) sources.push(c.source);
    if (!title && c.title) title = c.title;
    if (!author && c.author) author = c.author;
  }
  return { title, author, sources };
}

function chapterSpecs(bookId: string) {
  try {
    return loadChapterIndex(bookId);
  } catch {
    return loadBookChapters(bookId)
      .sort((a, b) => a.number - b.number)
      .map((ch) => ({ chapterId: ch.chapterId, chapterNumber: ch.number, chapterTitle: ch.title }));
  }
}

export type PreflightCheck = { check: string; blockers: string[]; decision?: string };

/** The publish-preflight as a STRUCTURED per-check battery — every check appears whether it
 *  passed (empty blockers) or failed, so publish-after-qc can print a "definition of done"
 *  checklist of which items passed. noApiPreflightBlockers derives the flat list from this, so
 *  the gating behaviour is byte-identical to before. */
function noApiPreflightChecks(bookId: string): PreflightCheck[] {
  const chapters = loadBookChapters(bookId).sort((a, b) => a.number - b.number);
  const canonical = readCanonicalChapterIndex(bookId);
  const canonicalBlockers = canonical.ok
    ? compareChapterSetToCanonical({ bookId, canonical: canonical.chapters, actual: chapters, actualLabel: "state chapter files" }).blockers
    : canonical.blockers;
  // H5 defense: a malformed authored chapter (codex writes JSON directly, no schema coercion) could
  // make ANY critic throw. That must surface as a publish BLOCKER, never an unhandled crash that
  // aborts the whole preflight (noApiPreflightChecks is called WITHOUT a try/catch). `safe` turns a
  // throw into a single GATE_CRASH blocker for that check so the publish fails closed with an
  // actionable message instead of a raw stack trace.
  const safe = (label: string, fn: () => string[]): string[] => {
    try { return fn(); } catch (err) { return [`${label} GATE_CRASH: a critic threw on a malformed chapter — ${(err as Error)?.message ?? String(err)}`]; }
  };
  const ship: string[] = [], intra: string[] = [], qcStatus: string[] = [], quizKey: string[] = [], manualKey: string[] = [];
  for (const ch of chapters) {
    // Wrap the WHOLE per-chapter critic group (every one of these can throw on a malformed chapter).
    try {
      ship.push(...runShipGate(ch).blockers.map((f) => `ship ch${ch.number} ${f.catalogId}: ${f.message}`));
      intra.push(...runIntraBookChecks(ch, chapters.filter((other) => other.number < ch.number)).filter((f) => f.severity === "blocker").map((f) => `intra ch${ch.number} ${f.checkId}: ${f.message}`));
      qcStatus.push(...checkQcAttestation(ch, true).map((f) => `qc-status ch${ch.number} ${f.checkId}: ${f.message}`));
      quizKey.push(...checkKeyJudge(ch, true, process.env.CHAPTERFLOW_REQUIRE_KEYJUDGE === "1").map((f) => `quiz-key ch${ch.number} ${f.checkId}: ${f.message}`));
      manualKey.push(...checkManualKeyJudge(ch, true).map((f) => `manual-keyjudge ch${ch.number} ${f.checkId}: ${f.message}`));
    } catch (err) {
      ship.push(`ship ch${ch.number} GATE_CRASH: a critic threw on a malformed chapter — ${(err as Error)?.message ?? String(err)}`);
    }
  }
  // WS-4 source-REALITY policy — the SAME central evaluator promoteBook runs, so the preflight
  // verdict matches the actual promote. A newly produced source-v2 book MUST carry a valid VERIFIED
  // record before publish; absence blocks unless a content-bound legacy exemption covers it; a
  // present-but-bad record always blocks. CHAPTERFLOW_REQUIRE_SOURCE_VERIFY=1 only strengthens.
  let srDecision = "invalid";
  let srBlockers: string[] = [];
  try {
    const r = evaluateSourceRealityPolicy({ bookId, env: process.env });
    srDecision = r.decision;
    srBlockers = r.blocking
      ? r.findings.map((f) => `source-reality ${r.decision} ${f.checkId}${f.chapterNumber ? ` ch${f.chapterNumber}` : ""}: ${f.message}`)
      : [];
  } catch (err) {
    srBlockers = [`source-reality GATE_CRASH: ${(err as Error)?.message ?? String(err)}`];
  }
  return [
    { check: "canonical-chapter-set", blockers: canonicalBlockers.map((f) => `${f.checkId}: ${f.message}`) },
    { check: "ship-gate", blockers: ship },
    { check: "intra-book", blockers: intra },
    { check: "qc-status", blockers: qcStatus },
    { check: "quiz-key", blockers: quizKey },
    { check: "manual-keyjudge", blockers: manualKey },
    { check: "book-gate", blockers: safe("book-gate", () => runBookGate(bookId, chapters).findings.filter((f) => f.severity === "blocker").map((f) => `book-gate ${f.catalogId}: ${f.message}`)) },
    { check: "source-v2", blockers: safe("source-v2", () => checkSourceV2Gate(bookId).findings.filter((f) => f.severity === "blocker").map((f) => `source-v2 ch${f.chapterNumber} ${f.checkId}: ${f.message}`)) },
    { check: "plan-enforcement", blockers: safe("plan-enforcement", () => checkPlanEnforcement(bookId, chapters).map((f) => `plan ch${f.chapterNumber} ${f.checkId}: ${f.message}`)) },
    { check: "sweep", blockers: safe("sweep", () => checkSweep(chapters, true).map((f) => `sweep ${f.checkId}: ${f.message}`)) },
    { check: "majors", blockers: safe("majors", () => unresolvedMajors(bookId, chapters, true).map((f) => `major ${f.id} ${f.scope} ${f.checkId}: ${f.message}`)) },
    { check: "source-reality", blockers: srBlockers, decision: srDecision },
    // WP-401 D7 rubric-audit ship gate (defense-in-depth; promoteBook is the
    // authority + also runs the byte-identity exemption). A PRESENT receipt must
    // be a fresh PASS bound to the current bytes; a MISSING one blocks only under
    // CHAPTERFLOW_REQUIRE_D7_SHIP_GATE=1.
    (() => {
      const d7 = safe("d7-ship-gate", () => evaluateD7ShipGateForPreflight({
        bookId,
        stateBooksDir: resolve(PIPELINE_DIR, "state", "books"),
        repositoryRoot: resolve(PIPELINE_DIR, "../../../.."),
        require: process.env[CHAPTERFLOW_REQUIRE_D7_SHIP_GATE_ENV] === "1",
      }).blockers.map((b) => `d7-ship-gate ${b}`));
      return { check: "d7-ship-gate", blockers: d7 };
    })(),
  ];
}

function noApiPreflightBlockers(bookId: string): string[] {
  return noApiPreflightChecks(bookId).flatMap((c) => c.blockers);
}

/** Render the publish-preflight checklist — which definition-of-done items passed. */
export function formatPreflightChecklist(checks: PreflightCheck[]): string {
  const passed = checks.filter((c) => c.blockers.length === 0).length;
  const lines = [`publish preflight — ${passed}/${checks.length} checks passed:`];
  for (const c of checks) {
    const tag = c.decision ? ` [${c.decision}]` : "";
    lines.push(c.blockers.length === 0 ? `  ✓ ${c.check}${tag}` : `  ✗ ${c.check}${tag} (${c.blockers.length} blocker(s))`);
  }
  return lines.join("\n");
}

function packageLooksV21(path: string): boolean {
  const pkg = readJson(path);
  return pkg?.schemaVersion === V21_SCHEMA_VERSION && Array.isArray(pkg?.chapters) && typeof pkg?.book?.bookId === "string";
}

function registryFiles(): string[] {
  return [
    resolve(REPO_ROOT, "app/book/data/bookPackages.ts"),
    resolve(REPO_ROOT, "app/book/data/booksCatalog.metadata.json"),
    // The pipeline INPUT registry (the {id,title,author} the operator adds to run a book).
    // Including it means: (1) the registration is COMMITTED with the publish, so it persists for
    // re-runs (it kept getting orphaned/reverted before); and (2) a pre-staged/dirty books.json is
    // now IN-PLAN, so it no longer trips the "pre-existing staged file outside publish plan" guard
    // and halts an unattended publish (the behave halt). Only included when actually dirty (see
    // dirtyVsHead) — a no-op when no new registration is pending.
    resolve(PIPELINE_DIR, "books.json"),
  ];
}

/** Of `paths`, the ones that DIFFER FROM HEAD (modified or untracked) per `git status`. Used to
 *  pick which registry/registration files to promote: not just what THIS publish's register-web
 *  call changed, but anything a PRIOR partial run (or the operator's books.json edit) already left
 *  dirty. The old before/after-content diff missed those — register-web saw "no change this call"
 *  and dropped the file, orphaning the catalog wiring (the behave incident). Best-effort: a git
 *  failure yields [] (publish then stages only the package, as before). */
export function dirtyVsHead(paths: string[], runner: Runner): string[] {
  if (paths.length === 0) return [];
  let status = "";
  try {
    status = git(["status", "--porcelain", "--", ...paths], runner);
  } catch {
    return [];
  }
  const dirty = new Set<string>();
  for (const line of status.split(/\r?\n/)) {
    if (!line.trim()) continue;
    let p = line.slice(3).trim(); // porcelain: "XY <path>"
    const arrow = p.indexOf(" -> ");
    if (arrow !== -1) p = p.slice(arrow + 4).trim(); // renamed → destination
    dirty.add(resolve(REPO_ROOT, p));
  }
  return paths.filter((p) => dirty.has(resolve(p)));
}

function durableStateFiles(bookId: string, roundId: string): string[] {
  const out: string[] = [];
  const chaptersDir = resolve(CANONICAL_STATE, "chapters");
  if (existsSync(chaptersDir)) {
    out.push(...readdirSync(chaptersDir)
      .filter((f) => f.startsWith(`${bookId}-ch`) && f.endsWith(".v21-native.chapter.json"))
      .map((f) => resolve(chaptersDir, f)));
  }
  const index = resolve(CANONICAL_STATE, "indexes", `${bookId}.json`);
  if (existsSync(index)) out.push(index);
  const qcDir = resolve(CANONICAL_STATE, "qc");
  if (existsSync(qcDir)) {
    out.push(...readdirSync(qcDir)
      .filter((f) => f.startsWith(`${bookId}-`) || f === `${bookId}.sweep.json`)
      .filter((f) => f.endsWith(".qc.json") || f.endsWith(".manual-keyjudge.json") || f.endsWith(".sweep.json"))
      .map((f) => resolve(qcDir, f)));
  }
  for (const p of [evidenceMatrixPath(bookId, roundId), qcSummaryPath(bookId, roundId), repairLedgerPath(bookId, roundId)]) {
    if (existsSync(p)) out.push(p);
  }
  return [...new Set(out)].sort();
}

export function stagingPlan(bookId: string, roundId: string, opts: { includeState?: boolean; registeredFiles?: string[] } = {}): string[] {
  const out = [
    resolve(BOOK_PACKAGES_DIR, `${bookId}.v21.json`),
    ...(opts.registeredFiles ?? registryFiles()).filter((p) => existsSync(p)),
  ];
  if (opts.includeState) out.push(...durableStateFiles(bookId, roundId));
  return [...new Set(out)].filter((p) => existsSync(p)).sort();
}

export function unsafePublishFiles(files: string[], opts: { allGreen?: boolean } = {}): string[] {
  const unsafe: string[] = [];
  for (const p of files) {
    const normalized = p.replace(/\\/g, "/");
    const base = normalized.split("/").pop() ?? "";
    if (normalized.includes("/task-cards/")) unsafe.push(p);
    if (base === "qc-auto.workflow.js") unsafe.push(p);
    if (opts.allGreen && base === "repair-prompt.md") unsafe.push(p);
    if (existsSync(p)) {
      const text = readFileSync(p, "utf8");
      if (ROLE_TOKEN_PATTERNS.some((pattern) => text.includes(pattern))) unsafe.push(p);
    }
  }
  return [...new Set(unsafe)].sort();
}

/**
 * Push the current branch, RECONCILING with an advanced remote. A bare `git push` fails
 * non-fast-forward whenever origin/<branch> moved during the run — and for an UNATTENDED
 * auto-publish that can take >1h, the remote moving (another PR or book publish landing on
 * main meanwhile) is the COMMON case, not the exception. A bare push there strands the publish
 * commit locally and HALTs the run for a reason unrelated to the book.
 *
 * The publish commit touches only the promote-set files (the new package + the two web-registry
 * files, both append-only), so rebasing it onto the advanced remote is virtually always
 * conflict-free. On a REAL conflict (e.g. two book publishes racing on the catalog) we ABORT the
 * rebase and surface the error — NEVER force-push, never auto-resolve. `--autostash` keeps benign
 * run-churn (e.g. a dirty state/gate-attempts.json) from blocking the rebase. Bounded retries
 * cover a second advance landing between fetch and push. Returns pushed=false + an error string
 * (the caller then reports the commit-exists-locally recovery) only when reconciliation can't make
 * the push fast-forward.
 */
export function pushWithRebase(runner: Runner, attempts = 3): { pushed: boolean; error?: string } {
  let lastErr: string | undefined;
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      git(["push"], runner);
      return { pushed: true };
    } catch (err) {
      lastErr = (err as Error).message;
    }
    // Push rejected — almost always "remote moved". Reconcile by rebasing our commit(s) onto the
    // freshly-fetched remote tip, then retry the push on the next loop.
    const branch = git(["rev-parse", "--abbrev-ref", "HEAD"], runner).trim();
    if (!branch || branch === "HEAD") {
      return { pushed: false, error: `push rejected and cannot auto-rebase a detached HEAD: ${lastErr}` };
    }
    try {
      git(["fetch", "origin", branch], runner);
      git(["rebase", "--autostash", `origin/${branch}`], runner);
    } catch (rebaseErr) {
      try { git(["rebase", "--abort"], runner); } catch { /* nothing in progress to abort */ }
      return {
        pushed: false,
        error: `push rejected; auto-rebase onto origin/${branch} failed (likely a real content conflict — resolve manually, do NOT force-push): ${(rebaseErr as Error).message}`,
      };
    }
    // `git rebase --autostash` has TWO conflict modes. A COMMIT-replay conflict throws (caught
    // above). But re-applying the autostashed working-tree run-churn (e.g. the shared, tracked
    // state/gate-attempts.json that another book's publish also appended to) onto the advanced
    // remote can conflict while rebase still exits 0 — leaving UU conflict markers in the tree +
    // an orphaned autostash. Our PUBLISH commit replayed clean (that is what we push); the churn is
    // throwaway generated state. Resolve deterministically: take the rebased (HEAD) version of any
    // unmerged file and drop the leftover stash, so we never push from — or leave behind — a
    // marker-laden tree (which would later crash JSON.parse and silently wipe gate-attempt history).
    const unmerged = git(["diff", "--name-only", "--diff-filter=U"], runner).trim();
    if (unmerged) {
      for (const f of unmerged.split(/\r?\n/).filter(Boolean)) {
        try { git(["checkout", "HEAD", "--", f], runner); } catch { /* best-effort cleanup */ }
      }
      try { git(["stash", "drop"], runner); } catch { /* no autostash entry left to drop */ }
    }
  }
  return { pushed: false, error: lastErr };
}

function stageAndMaybeCommit(args: {
  bookId: string;
  roundId: string;
  cleanup: string;
  registeredFiles: string[];
  includeState?: boolean;
  commit: boolean;
  push: boolean;
  runner: Runner;
  warnings: string[];
}): { staged: string[]; commitHash?: string; pushed?: boolean; pushError?: string; alreadyCommitted?: boolean; errors: string[] } {
  const staged = stagingPlan(args.bookId, args.roundId, { includeState: args.includeState, registeredFiles: args.registeredFiles });
  const allowed = new Set(staged.map((p) => resolve(p)));
  const unsafe = unsafePublishFiles(staged, { allGreen: true });
  if (unsafe.length) {
    for (const p of unsafe) {
      try { git(["restore", "--staged", "--", p], args.runner); } catch {}
    }
    return { staged, errors: unsafe.map((p) => `Refusing to stage unsafe publish artifact: ${rel(p)}`) };
  }
  if (!args.commit) return { staged, errors: [] };

  // Refuse to write publish history off main — fail loud rather than let an unattended
  // auto-publish silently commit + push to the wrong (current) branch.
  const branchErr = publishBranchError(args.runner);
  if (branchErr) return { staged, errors: [branchErr] };

  // Refuse to publish from a dirty source tree — an unrelated uncommitted source edit
  // would be validated by the pre-commit tsc/tests but not committed, and can halt an
  // otherwise-converged unattended publish for a reason unrelated to the book.
  if (process.env.CHAPTERFLOW_ALLOW_DIRTY_PUBLISH !== "1") {
    const dirty = dirtySourceOutsidePlan(args.runner, staged);
    if (dirty.length) {
      const shown = dirty.slice(0, 5).join(", ") + (dirty.length > 5 ? `, +${dirty.length - 5} more` : "");
      return {
        staged,
        errors: [
          `Refusing to publish from a dirty source tree: ${dirty.length} uncommitted tracked source file(s) outside the publish plan (${shown}). Commit or stash them first, or set CHAPTERFLOW_ALLOW_DIRTY_PUBLISH=1 to override.`,
        ],
      };
    }
  }

  if (staged.length === 0) return { staged, errors: ["No production files were available to stage."] };
  const preExistingStaged = cachedFiles(args.runner);
  const unsafePreExisting = unsafePublishFiles(preExistingStaged, { allGreen: true });
  if (unsafePreExisting.length) {
    for (const p of unsafePreExisting) {
      try { git(["restore", "--staged", "--", p], args.runner); } catch {}
    }
    return { staged, errors: unsafePreExisting.map((p) => `Refusing to commit unsafe pre-staged artifact: ${rel(p)}`) };
  }
  const unexpectedPreExisting = preExistingStaged.filter((p) => !allowed.has(resolve(p)));
  if (unexpectedPreExisting.length) {
    return {
      staged,
      errors: unexpectedPreExisting.map((p) => `Refusing to commit with pre-existing staged file outside publish plan: ${rel(p)}`),
    };
  }
  git(["add", "--", ...staged], args.runner);
  const cached = cachedFiles(args.runner);
  const unsafeCached = unsafePublishFiles(cached, { allGreen: true });
  if (unsafeCached.length) {
    for (const p of unsafeCached) {
      try { git(["restore", "--staged", "--", p], args.runner); } catch {}
    }
    return { staged, errors: unsafeCached.map((p) => `Refusing to commit unsafe staged artifact: ${rel(p)}`) };
  }
  const unexpectedCached = cached.filter((p) => !allowed.has(resolve(p)));
  if (unexpectedCached.length) {
    return {
      staged,
      errors: unexpectedCached.map((p) => `Refusing to commit staged file outside publish plan: ${rel(p)}`),
    };
  }
  // IDEMPOTENCY: with a deterministic package (promoteBook now preserves
  // packageId/createdAt) a re-run over unchanged content stages NOTHING new — the
  // `git add` above leaves an empty index. That means the publish commit already
  // exists (typically: a prior run committed, then its push failed). Do NOT create
  // a second/duplicate commit — adopt the existing HEAD and go straight to push.
  if (cached.length === 0) {
    let head = git(["rev-parse", "HEAD"], args.runner).trim();
    const headSubject = git(["log", "-1", "--format=%s"], args.runner).trim();
    let pushedExisting = false;
    let pushErr: string | undefined;
    if (args.push) {
      const r = pushWithRebase(args.runner);
      pushedExisting = r.pushed; pushErr = r.error;
      head = git(["rev-parse", "HEAD"], args.runner).trim(); // a reconcile-rebase may have rewritten HEAD
    }
    // Only assert "this IS the publish commit (skipped a duplicate)" when HEAD's subject
    // says so; otherwise the tree merely already contains identical content (e.g. an
    // unrelated later commit) — still safe to push, but don't mislabel HEAD.
    const isPublishCommit = headSubject === `Publish ${args.bookId} v21 package`;
    return { staged, commitHash: head, pushed: pushedExisting, pushError: pushErr, alreadyCommitted: isPublishCommit, errors: [] };
  }
  git(["diff", "--check"], args.runner);
  git(["diff", "--cached", "--check"], args.runner);
  // (The self-test gate now runs UP FRONT in publishAfterQc, before promote/register/cleanup mutate
  // anything — see the "Gate BEFORE any on-disk mutation" block — so a gate failure can no longer
  // leave a half-published working tree.)
  const msg = [
    `Publish ${args.bookId} v21 package`,
    "",
    `QC round: ${args.roundId}`,
    `Package: book-packages/${args.bookId}.v21.json`,
    `Cleanup: ${args.cleanup}`,
  ].join("\n");
  git(["commit", "-m", msg], args.runner);
  let commitHash = git(["rev-parse", "HEAD"], args.runner).trim();
  // The commit SUCCEEDED above. Push is a separate, retryable step that RECONCILES with an
  // advanced remote (pushWithRebase): for an unattended run the remote commonly moves mid-run, so
  // a bare push would strand this commit and halt for an unrelated reason. A push failure that even
  // reconciliation can't fix (a real conflict) must NOT erase the fact that the commit exists, or
  // the caller wrongly reports "no commit performed" and an operator re-runs into a duplicate.
  let pushed = false;
  let pushError: string | undefined;
  if (args.push) {
    const r = pushWithRebase(args.runner);
    pushed = r.pushed; pushError = r.error;
    commitHash = git(["rev-parse", "HEAD"], args.runner).trim(); // a reconcile-rebase may have rewritten HEAD
  }
  return { staged, commitHash, pushed, pushError, errors: [] };
}

function applyCleanup(bookId: string, roundId: string, cleanup: PublishAfterQcOptions["cleanup"], dryRun: boolean): { cleaned: string[]; preserved: string[]; warnings: string[] } {
  if (cleanup === "none") {
    const plan = transientCleanupPlan(bookId, roundId);
    return { cleaned: [], preserved: plan.preserve, warnings: [] };
  }
  const warnings = cleanup === "audit-unsafe" ? ["cleanup=audit-unsafe requested; durable final package, attestations, and registered app files are still preserved."] : [];
  const plan = transientCleanupPlan(bookId, roundId);
  const cleaned: string[] = [];
  for (const p of plan.remove) {
    if (dryRun || existsSync(p)) cleaned.push(p);
    if (!dryRun) safeRm(p);
  }
  return { cleaned, preserved: plan.preserve, warnings };
}

export function publishAfterQc(options: PublishAfterQcOptions, internals: PublishAfterQcInternals = {}): PublishAfterQcResult {
  const runner = internals.runner ?? defaultRunner;
  const cleanup = options.cleanup ?? "transient";
  const errors: string[] = [];
  const warnings: string[] = [];
  const next: string[] = [];
  const roundId = options.roundId;

  if (process.env.CHAPTERFLOW_NO_API_CODEX_QC !== "1") {
    return {
      ok: false,
      roundId,
      errors: [
        "publish-after-qc requires CHAPTERFLOW_NO_API_CODEX_QC=1.",
        `Run: CHAPTERFLOW_NO_API_CODEX_QC=1 npx tsx src/cli.ts publish-after-qc ${JSON.stringify(options.input)} --round ${roundId || "<roundId>"} --dry-run`,
      ],
      warnings,
      next,
    };
  }
  if (!options.input.trim() || !roundId) {
    return { ok: false, roundId, errors: ["Usage: publish-after-qc \"<book name or id>\" --round <roundId>"], warnings, next };
  }
  if (options.push === true && options.commit !== true && options.dryRun !== true) {
    return { ok: false, roundId, errors: ["--push requires --commit."], warnings, next };
  }

  const resolved = resolveBookIdentifier(options.input);
  if (resolved.ok === false) {
    const details = resolved.reason === "ambiguous" && resolved.candidates?.length
      ? ` Candidates: ${resolved.candidates.map((c) => `${c.bookId}${c.title ? ` (${c.title})` : ""}`).join(", ")}`
      : "";
    return { ok: false, roundId, errors: [`${resolved.message}${details}`], warnings, next };
  }
  const bookId = resolved.bookId;
  const repairPrompt = repairPromptPath(bookId, roundId);

  if (!roundExists(bookId, roundId)) {
    return {
      ok: false,
      bookId,
      roundId,
      errors: [`Missing QC round for ${bookId}/${roundId}. Expected ${roundRecordPath(bookId, roundId)} or ${qcRoundPath(bookId, roundId)}.`],
      warnings,
      next: [`CHAPTERFLOW_NO_API_CODEX_QC=1 npx tsx src/cli.ts qc-auto ${JSON.stringify(bookId)} --pass --round ${roundId}`],
    };
  }

  let finalized;
  // The non-dry-run re-finalize stamps attestations (attest=true), which REQUIRES a
  // CHAPTERFLOW_SESSION_ID or finalize SKIPS the write and pushes an error → ok:false below (the I1
  // wedge: the conductor's publish subprocess — and a bare `publish-after-qc` CLI run — inherit no
  // session id). Self-supply a DISTINCT finalizer id when none is set so the (re-)attest lands;
  // author≠reviewer still holds (this id ≠ any author/reviewer id). Restore so we never leak it.
  const priorPublishSession = process.env.CHAPTERFLOW_SESSION_ID;
  if (!options.dryRun && !priorPublishSession) {
    process.env.CHAPTERFLOW_SESSION_ID = `publish-finalize:${bookId}-${roundId}`;
  }
  try {
    // A --dry-run preflight must be READ-ONLY: compute the verdict from current
    // QC state without re-finalizing/re-attesting (which would overwrite a fresh
    // PUBLISHABLE attestation with REVISE before the early-return below).
    finalized = finalizeQcRound(bookId, roundId, { attest: !options.dryRun, dryRun: options.dryRun });
  } catch (err) {
    return { ok: false, bookId, roundId, errors: [`QC finalization failed: ${(err as Error).message}`], warnings, next: [repairPrompt] };
  } finally {
    if (!options.dryRun && !priorPublishSession) delete process.env.CHAPTERFLOW_SESSION_ID;
  }
  if (finalized.errors.length) errors.push(...finalized.errors.map((e) => `finalize: ${e}`));
  if (!finalized.allPublishable || finalized.incomplete || finalized.repairRequired) {
    errors.push(`QC is not all-green: allPublishable=${finalized.allPublishable} incomplete=${finalized.incomplete} repairRequired=${finalized.repairRequired}.`);
    for (const d of finalized.chapters.filter((ch) => ch.finalVerdict !== "PUBLISHABLE").slice(0, 8)) {
      errors.push(`ch${String(d.chapterNumber).padStart(2, "0")} ${d.finalVerdict}: ${d.reason}`);
    }
  }
  const preflightChecks = noApiPreflightChecks(bookId);
  const blockers = preflightChecks.flatMap((c) => c.blockers);
  if (blockers.length) errors.push(...blockers.slice(0, 20));
  if (errors.length) {
    return {
      ok: false,
      bookId,
      roundId,
      errors,
      warnings,
      checks: preflightChecks,
      next: [
        `repair prompt: ${repairPrompt}`,
        `resume: CHAPTERFLOW_NO_API_CODEX_QC=1 npx tsx src/cli.ts qc-auto ${JSON.stringify(bookId)} --pass --round ${roundId}`,
      ],
    };
  }

  const meta = resolveMetadata(bookId, options);
  if (!meta.title || !meta.author) {
    return {
      ok: false,
      bookId,
      roundId,
      errors: [
        `Title/author could not be resolved for ${bookId}. Pass ${!meta.title ? "--title" : ""}${!meta.title && !meta.author ? " and " : ""}${!meta.author ? "--author" : ""}.`,
      ],
      warnings,
      next: [`CHAPTERFLOW_NO_API_CODEX_QC=1 npx tsx src/cli.ts publish-after-qc ${JSON.stringify(bookId)} --round ${roundId} --title "..." --author "..." --dry-run`],
    };
  }

  const packagePath = resolve(BOOK_PACKAGES_DIR, `${bookId}.v21.json`);
  let registeredFiles: string[] = [];
  let cleaned: string[] = [];
  let preserved: string[] = [];
  let staged: string[] = [];
  let commitHash: string | undefined;
  let pushed = false;

  if (options.dryRun) {
    const plan = applyCleanup(bookId, roundId, cleanup, true);
    warnings.push(...plan.warnings);
    cleaned = plan.cleaned;
    preserved = plan.preserved;
    staged = stagingPlan(bookId, roundId, { includeState: options.includeState });
    next.push(`would promote/register ${bookId} with title ${JSON.stringify(meta.title)} and author ${JSON.stringify(meta.author)}`);
    next.push(`would cleanup ${cleaned.length} transient artifact(s) using cleanup=${cleanup}`);
    next.push(`would stage ${staged.length} safe production artifact(s)${options.includeState ? " plus durable state" : ""}`);
    next.push(`would commit: ${options.commit === true ? "yes" : "no"}`);
    next.push(`would push: ${options.push === true ? "yes, after commit" : "no"}`);
    next.push(`publish: CHAPTERFLOW_NO_API_CODEX_QC=1 npx tsx src/cli.ts publish-after-qc ${JSON.stringify(bookId)} --round ${roundId} --title ${JSON.stringify(meta.title)} --author ${JSON.stringify(meta.author)}`);
    if (options.commit || options.push) next.push("add --commit --push after reviewing the dry run");
    return { ok: true, bookId, roundId, packagePath, registeredFiles, cleaned, preserved, staged, pushed: false, errors, warnings, checks: preflightChecks, next };
  }

  // Gate BEFORE any on-disk mutation: run the self-test (tsc + the publish test slice) up front so a
  // failure aborts with the working tree UNTOUCHED — instead of after promote/register/cleanup have
  // already half-published (new package, regenerated registries, deleted round artifacts) with no
  // rollback. Only when actually committing (a dry-run already returned; a no-commit generate doesn't
  // gate). This also avoids the prior flake where the slice ran AGAINST the just-written package/catalog.
  if (options.commit === true) {
    try {
      runPublishTests(runner);
    } catch (err) {
      return { ok: false, bookId, roundId, errors: [`pre-publish self-test failed (no mutation performed): ${(err as Error).message}`], warnings, next };
    }
  }

  // Self-heal a repair-mislabeled provenance schemaVersion BEFORE the production-manifest gate
  // (inside promoteBook) does its exact-string compare. A CORRUPTION-tier surgical repair can stamp
  // a same-family variant ("source-anchor-map-v1") on an otherwise-valid source-anchor map; without
  // this, that fail-closes publish (PPKG.authoring_provenance_missing) DESPITE QC PASS — the willpower
  // wedge. This corrects the label on a structurally-valid block; it never fabricates a missing one
  // (those still — correctly — block). Runs only on the real publish: a --dry-run already returned
  // above, and this sits AFTER the self-test gate so that gate still sees an untouched tree.
  const provFixed = normalizeChapterProvenance(bookId);
  if (provFixed.length) {
    warnings.push(`normalized source-anchor provenance (repair drift) on ${provFixed.map((p) => p.kind === "reconstruct" ? `ch${p.chapterNumber} (reconstructed from effectiveAnchors)` : `ch${p.chapterNumber} (${p.from}→canonical)`).join(", ")} before promote`);
  }

  try {
    const cats = deriveCategoriesAndTags(bookId, { title: meta.title, chapterTitles: chapterSpecs(bookId).map((c) => c.chapterTitle) });
    const promotion = promoteBook({
      bookId,
      title: meta.title,
      author: meta.author,
      chapters: chapterSpecs(bookId),
      categories: cats.categories,
      tags: cats.tags,
    });
    if (!promotion.promoted || !promotion.packagePath) {
      return { ok: false, bookId, roundId, errors: [`Promotion failed: ${promotion.reason}`], warnings, next: [`repair prompt: ${repairPrompt}`] };
    }
  } catch (err) {
    return { ok: false, bookId, roundId, errors: [`Promotion failed: ${(err as Error).message}`], warnings, next: [`repair prompt: ${repairPrompt}`] };
  }
  if (!existsSync(packagePath) || !packageLooksV21(packagePath)) {
    return { ok: false, bookId, roundId, packagePath, errors: [`Promoted package missing or not ${V21_SCHEMA_VERSION}: ${packagePath}`], warnings, next };
  }
  const packageVerification = verifyProductionPackage({ packagePath, compareLooseState: true });
  if (!packageVerification.ok) {
    return {
      ok: false,
      bookId,
      roundId,
      packagePath,
      errors: [`Promoted package failed verification before registry update: ${packageVerification.findings.slice(0, 5).map((f) => f.message).join("; ")}`],
      warnings,
      next,
    };
  }

  const registry = registryFiles();
  try {
    runner("npx", ["tsx", "src/cli.ts", "register-web", bookId, "--skip-ingest"], {
      cwd: PIPELINE_DIR,
      env: { ...process.env, CHAPTERFLOW_NO_API_CODEX_QC: "1" },
    });
    // Promote every registry/registration file that DIFFERS FROM HEAD — register-web's output for
    // THIS book PLUS anything a prior partial run or the operator's books.json edit left dirty —
    // instead of only what this register-web call changed (which orphaned the wiring on a re-run).
    registeredFiles = dirtyVsHead(registry, runner);
  } catch (err) {
    return { ok: false, bookId, roundId, packagePath, errors: [`register-web failed: ${(err as Error).message}`], warnings, next };
  }

  const cleanupResult = applyCleanup(bookId, roundId, cleanup, false);
  warnings.push(...cleanupResult.warnings);
  cleaned = cleanupResult.cleaned;
  preserved = cleanupResult.preserved;

  let pushError: string | undefined;
  let alreadyCommitted = false;
  try {
    const gitResult = stageAndMaybeCommit({
      bookId,
      roundId,
      cleanup,
      registeredFiles,
      includeState: options.includeState,
      commit: options.commit === true,
      push: options.push === true,
      runner,
      warnings,
    });
    staged = gitResult.staged;
    commitHash = gitResult.commitHash;
    pushed = gitResult.pushed ?? false;
    pushError = gitResult.pushError;
    alreadyCommitted = gitResult.alreadyCommitted ?? false;
    if (gitResult.errors.length) return { ok: false, bookId, roundId, packagePath, registeredFiles, cleaned, preserved, staged, errors: gitResult.errors, warnings, next };
  } catch (err) {
    // A throw here happens BEFORE the commit (push is now non-throwing), so commitHash
    // is genuinely undefined and "no commit performed" is accurate.
    return { ok: false, bookId, roundId, packagePath, registeredFiles, cleaned, preserved, staged, commitHash, pushed, errors: [`git/validation failed: ${(err as Error).message}`], warnings, next };
  }

  if (alreadyCommitted && commitHash) {
    warnings.push(`Publish content already committed at ${commitHash}; skipped a duplicate commit (idempotent re-run).`);
  }

  if (commitHash && pushError) {
    // The commit SUCCEEDED; only the push failed (almost always "remote moved").
    // Report it ACCURATELY — the commit EXISTS locally — so the operator reconciles
    // and re-pushes instead of re-promoting into a duplicate commit.
    return {
      ok: false, bookId, roundId, packagePath, registeredFiles, cleaned, preserved, staged,
      commitHash, pushed: false,
      errors: [`Publish commit ${commitHash} was created locally, but git push FAILED: ${pushError}`],
      warnings,
      next: [
        `the publish commit ${commitHash} IS on your local branch — do NOT re-promote from scratch`,
        `reconcile with the remote (git pull --rebase, or rebase your single publish commit onto origin/<branch>), then: git push`,
        `or re-run this exact publish-after-qc --commit --push: it detects the existing commit and only pushes`,
      ],
    };
  }

  next.push("verify production route / app catalog");
  return { ok: true, bookId, roundId, packagePath, registeredFiles, cleaned, preserved, staged, commitHash, pushed, errors, warnings, checks: preflightChecks, next };
}

export function formatPublishAfterQcResult(result: PublishAfterQcResult): string {
  const book = result.bookId ?? "<unresolved>";
  const lines: string[] = [];
  lines.push(result.ok ? `PUBLISH AFTER QC PASS - ${book}` : `PUBLISH AFTER QC BLOCKED - ${book}`);
  if (result.roundId) lines.push(`round: ${result.roundId}`);
  if (result.checks?.length) lines.push(formatPreflightChecklist(result.checks));
  if (result.packagePath) lines.push(`package: ${result.packagePath}`);
  if (result.registeredFiles?.length) {
    lines.push("registered:");
    for (const p of result.registeredFiles) lines.push(`  ${rel(p)}`);
  } else if (result.ok) {
    lines.push("registered: none changed");
  }
  if (result.cleaned) lines.push(`cleaned transient artifacts: ${result.cleaned.length}`);
  if (result.preserved) lines.push(`preserved audit artifacts: ${result.preserved.length}`);
  if (result.staged) {
    lines.push("staged plan:");
    for (const p of result.staged) lines.push(`  ${rel(p)}`);
  }
  lines.push(`commit: ${result.commitHash ?? "skipped"}`);
  lines.push(`push: ${result.pushed ? "success" : result.commitHash && !result.ok ? "FAILED (commit exists locally)" : "skipped"}`);
  for (const w of result.warnings) lines.push(`warning: ${w}`);
  if (!result.ok && result.errors.length) {
    lines.push(`reason: ${result.errors[0]}`);
    if (result.next?.some((n) => n.startsWith("repair prompt:"))) lines.push(result.next.find((n) => n.startsWith("repair prompt:"))!);
    // Only claim "nothing committed" when that is TRUE. A push that failed AFTER a
    // successful commit advanced HEAD — printing "no commit performed" there is the
    // exact mis-report that lured a re-run into a duplicate publish commit.
    if (!result.commitHash) lines.push("no publish/commit/push performed");
    else lines.push(`commit ${result.commitHash} EXISTS locally; reconcile + push (or re-run publish — it will only push, not re-commit)`);
  }
  if (result.next?.length) {
    lines.push("next:");
    for (const n of result.next) lines.push(`  ${n}`);
  }
  return lines.join("\n");
}
