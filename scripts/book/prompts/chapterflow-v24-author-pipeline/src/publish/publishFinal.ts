/**
 * publish-final (v24 WS2 F1) — the ONE-VERB publish for the v24 author arch.
 *
 * Owner requirement (verbatim): "the publish stage should commit and push the
 * finalized package, nothing goes to s3 but after push, it should pull the main
 * and sync the local repo with the origin, as well as deleting all the debris and
 * all the files that were generated during the generation process."
 *
 * So publish-final is a single fail-closed chain:
 *   1. PREFLIGHT   — sandbox package exists + verifyProductionPackage (sidecar-aware)
 *                    passes; no FRESH (<2h heartbeat) autopilot lock for the book;
 *                    the outer root is a git worktree TOPLEVEL; `git fetch origin` OK.
 *   2. BRIDGE      — copy sandbox→outer + independent sha256 byte-compare (shared with
 *                    publishToLive; NOT duplicated).
 *   3. REGISTER    — probe the REAL registry (app/book/data/bookPackages.ts, the F1
 *                    probe-path fix); append-register if missing; ALWAYS regenerate the
 *                    outer booksCatalog.metadata.json; include it iff dirty.
 *   4. COMMIT      — pathspec commit of exactly {package, catalog-metadata-if-dirty,
 *                    registry-if-dirty} with the standard trailer; idempotent skip.
 *   5. PUSH        — MERGE loop (NOT rebase): push; on rejection fetch + merge --no-edit
 *                    origin/<branch> (never rebase, never force); a real conflict →
 *                    merge --abort + structured error; ≤3 attempts.
 *   6. SYNC        — fetch; ff-only pull if behind; then ASSERT
 *                    `git rev-list --left-right --count origin/<branch>...<branch>` == "0 0".
 *   7. CLEANUP     — invoke the debris engine, GATED on the step-6 proof object (a
 *                    pushed commit sha + the asserted 0/0). Skipped under --dry-run /
 *                    --keep-debris.
 *   8. REPORT      — package sha/size/overhead, commit sha, sync state, cleanup table.
 *
 * NO S3 / AWS anywhere in this module (a static test asserts it): content reaches
 * users via the repo push + a separate app deploy.
 *
 * ADDITIVE: reached via the `publish-final` CLI verb, the autopilot READY wiring
 * (author arch), and its tests. It never touches promote / publish-after-qc paths.
 */

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, realpathSync, statSync, writeFileSync } from "node:fs";
import { hostname } from "node:os";
import { resolve } from "node:path";

import { MONOREPO_ANCESTOR, REPO_ROOT, normSlug } from "../lib/chapterPaths.js";
import {
  COMMIT_TRAILER,
  OUTER_CATALOG_METADATA_REL,
  OUTER_REGISTRY_REL,
  bridgePackage,
  gitOutcome,
  probeRegistration,
  sha256File,
} from "./publishToLive.js";
import {
  applyCleanup,
  buildCleanupManifest,
  formatCleanupManifest,
  type CleanupManifest,
  type CleanupResult,
  type PublishProof,
} from "./cleanupBookDebris.js";

/** A step in the fail-closed chain, for the structured per-step report. */
export type PublishFinalStep = {
  step: string;
  ok: boolean;
  detail: string;
};

// ── Deploy sentinel (FINAL-HARDENING-PLAN 2026-07-04) ─────────────────────────
// publish-final ends at git push BY DESIGN (no-AWS invariant). Prod SERVER
// grading/ask/audio read the package from S3 (book-content/packages/<id>.v21.json),
// synced out-of-band by scripts/book/upload-book-packages-to-s3.ts, and served by
// a separate web deploy — none of which publish triggers. The sentinel is the
// tracked, machine-readable "deploy owed" flag: written INTO the publish commit so
// it can never be silently forgotten, and cleared by `npm run verify:live` once
// repo↔S3↔deployed-app parity is proven.

export const PENDING_DEPLOY_REL = "book-packages/.pending-deploy.json";
export const PENDING_DEPLOY_SCHEMA = "pending-deploy-v1";
/** The ordered manual steps every pending publish still owes. */
export const PENDING_DEPLOY_STEPS = ["upload-book-packages-to-s3", "deploy-workflow", "verify-live-sync"] as const;

export type PendingDeployEntry = {
  bookId: string;
  packageSha256: string;
  publishedAt: string;
  steps: string[];
};

/** Pure: merge one entry into the sentinel JSON text. Same-bookId entry is
 *  REPLACED; all other valid entries are PRESERVED; result is sorted by bookId
 *  and newline-terminated. A null/torn/foreign existing blob starts fresh but a
 *  well-formed one NEVER loses its other entries.
 *  IDEMPOTENT: when the existing same-book entry already carries the SAME
 *  packageSha256, it is kept VERBATIM (its publishedAt is not refreshed) — so a
 *  publish-final re-run over unchanged content produces byte-identical output and
 *  the commit-skip idempotency holds. */
export function mergePendingDeploy(existingRaw: string | null, entry: PendingDeployEntry): string {
  let pending: PendingDeployEntry[] = [];
  if (existingRaw) {
    try {
      const parsed = JSON.parse(existingRaw) as { pending?: unknown };
      if (parsed && Array.isArray(parsed.pending)) {
        pending = parsed.pending.filter(
          (e): e is PendingDeployEntry =>
            !!e && typeof (e as PendingDeployEntry).bookId === "string" && typeof (e as PendingDeployEntry).packageSha256 === "string",
        );
      }
    } catch { /* torn/foreign → start fresh (never throws away a parseable list) */ }
  }
  const prior = pending.find((e) => e.bookId === entry.bookId);
  const kept = prior && prior.packageSha256 === entry.packageSha256 ? prior : entry;
  const next = pending.filter((e) => e.bookId !== entry.bookId);
  next.push(kept);
  next.sort((a, b) => a.bookId.localeCompare(b.bookId));
  return JSON.stringify({ schemaVersion: PENDING_DEPLOY_SCHEMA, pending: next }, null, 2) + "\n";
}

/** The three commands a pending deploy still owes, for the loud report. */
export function deployRequiredHint(bookId: string): string[] {
  return [
    "⚠ DEPLOY REQUIRED — the app is NOT serving this content yet (publish only pushed the repo).",
    `  1. upload the package to S3:  BOOK_CONTENT_BUCKET=<bucket> AWS_REGION=us-east-1 npx tsx scripts/book/upload-book-packages-to-s3.ts`,
    `  2. deploy the web app:        gh workflow run deploy.yml -f environment=prod -f deploy_app=true`,
    `  3. verify the app serves it:  npm run verify:live`,
    `     (${bookId} is tracked in ${PENDING_DEPLOY_REL} until step 3 confirms repo↔S3↔deployed parity)`,
  ];
}

export type PublishFinalResult = {
  ok: boolean;
  bookId: string;
  dryRun: boolean;
  steps: PublishFinalStep[];
  /** the pushed commit sha (if a commit was created/adopted + pushed). */
  commitSha?: string;
  /** the asserted origin sync state ("0 0" on success). */
  syncState?: string;
  /** the cleanup outcome (only on a real, non-dry, non-keep-debris run). */
  cleanup?: CleanupResult;
  /** the cleanup manifest (always computed, for the dry-run plan). */
  cleanupManifest?: CleanupManifest;
  /** package sha256 / size / overhead. */
  packageSha?: string;
  packageBytes?: number;
  overheadPct?: number;
  durationMs?: number;
  error?: string;
  /** The deploy still owed after a successful push (sentinel written). Present on
   *  any successful non-dry publish so callers can print the DEPLOY REQUIRED hint. */
  deployRequired?: string[];
};

export type PublishFinalOptions = {
  dryRun?: boolean;
  keepDebris?: boolean;
  /** outer live checkout root; default MONOREPO_ANCESTOR. */
  outerRoot?: string;
  /** sandbox package path override (tests). */
  localPackagePath?: string;
  /** autopilot-locks dir override (tests). */
  lockDir?: string;
  /** verifier override (tests). Default: verifyProductionPackage (sidecar-aware). */
  verify?: (pkgPath: string) => Promise<boolean> | boolean;
  /** shell-out runner override (tests) for register-web / catalog regen. */
  runner?: (cmd: string, args: string[], cwd: string) => void;
  /** injectable registration writer (tests): append-register into the outer registry. */
  registerInOuter?: (outerRoot: string, bookId: string, packagePath: string) => void;
  /** the current git branch to publish to; default: the outer repo's HEAD branch. */
  branch?: string;
  /** TEST SEAM: fires exactly once after a successful push, BEFORE the post-push sync
   *  fetch/assert. Lets a test simulate a concurrent divergent commit landing on origin
   *  in that window, so the step-6 0/0 assert (or its ff-only pull) is exercised on a
   *  genuinely-out-of-sync tree. Not used in production. */
  __afterPushHook?: () => void;
};

/** Fresh-lock window: a lock whose heartbeat `at` is younger than this is "held".
 *  Matches the conductor's LOCK_FALLBACK_STALE_MS (2h). */
const FRESH_LOCK_MS = 2 * 60 * 60 * 1000;

type LockRecord = { pid?: number; host?: string; at?: string; owner?: string };

/** Is there a FRESH (held) autopilot lock for the book? A lock is fresh iff its
 *  owner process is alive (same host) OR its heartbeat `at` is within the window
 *  (cross host / can't-probe). A stale/dead lock does NOT block. */
export function hasFreshLock(lockDir: string, bookId: string, now = Date.now()): boolean {
  const path = resolve(lockDir, `${bookId}.lock`);
  if (!existsSync(path)) return false;
  let rec: LockRecord | null;
  try { rec = JSON.parse(readFileSync(path, "utf8")) as LockRecord; } catch { rec = null; }
  if (!rec || !rec.owner) return false; // malformed/torn → not a valid held lock
  if (rec.host === hostname() && typeof rec.pid === "number") {
    // same host: PID liveness is authoritative.
    try { process.kill(rec.pid, 0); return true; } catch (err) {
      // ESRCH → dead → not fresh; EPERM → alive under another user → fresh.
      return (err as NodeJS.ErrnoException)?.code !== "ESRCH";
    }
  }
  // cross host / no pid: heartbeat-age fallback.
  const ageMs = rec.at ? now - Date.parse(rec.at) : NaN;
  return Number.isFinite(ageMs) && ageMs < FRESH_LOCK_MS;
}

async function defaultVerify(pkgPath: string): Promise<boolean> {
  const { verifyProductionPackage } = await import("../verifyProductionPackage.js");
  return verifyProductionPackage({ packagePath: pkgPath }).ok;
}

function defaultRunner(cmd: string, args: string[], cwd: string): void {
  execFileSync(cmd, args, { cwd, stdio: ["ignore", "pipe", "pipe"], encoding: "utf8" });
}

/** Append-register a book into the OUTER app/book/data/bookPackages.ts, adapting the
 *  register-web writer (cli.ts) to target the outer path. Idempotent: a no-op if the
 *  book is already imported. Additive-only (one import + one self-contained block). */
export function registerInOuterRegistry(outerRoot: string, bookId: string, _packagePath: string): void {
  const registryPath = resolve(outerRoot, OUTER_REGISTRY_REL);
  if (!existsSync(registryPath)) {
    throw new Error(`outer registry not found at ${registryPath} — is app/ present in the outer checkout?`);
  }
  let src = readFileSync(registryPath, "utf8");
  if (src.includes(`from "@/book-packages/${bookId}.v21.json"`)) return; // already registered
  const ident = `auto_${bookId.replace(/[^a-zA-Z0-9]/g, "_")}_Json`;
  const lines = src.split("\n");
  let lastImport = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('from "@/book-packages/') && lines[i].includes(".v21.json")) lastImport = i;
  }
  if (lastImport === -1) {
    throw new Error("could not find the book-packages import block in the outer bookPackages.ts to anchor the new import");
  }
  lines.splice(lastImport + 1, 0, `import ${ident} from "@/book-packages/${bookId}.v21.json";`);
  src = lines.join("\n");
  const block =
    `\n// --- auto-registered by \`publish-final\` for "${bookId}" (do not edit by hand) ---\n` +
    `{\n` +
    `  const __autoPkg = normalizeAnyPackage(${ident}, "direct");\n` +
    `  BOOK_PACKAGES.push(__autoPkg);\n` +
    `  BOOK_PACKAGE_TONE_GETTERS["${bookId}"] = (tone) => normalizeAnyPackage(${ident}, tone);\n` +
    `}\n`;
  src = src.replace(/\s*$/, "\n") + block;
  writeFileSync(registryPath, src);
}

/** Locate the outer repo's catalog-metadata generator script + regenerate it, matching
 *  how register-web invokes it (npx tsx <script>, cwd = outer). Returns whether it ran. */
function regenerateOuterCatalog(outerRoot: string, runner: NonNullable<PublishFinalOptions["runner"]>): { ran: boolean; detail: string } {
  const genScript = resolve(outerRoot, "scripts/book/generate-catalog-metadata.ts");
  if (!existsSync(genScript)) return { ran: false, detail: `catalog generator not found at ${genScript}` };
  try {
    runner("npx", ["tsx", genScript], outerRoot);
    return { ran: true, detail: "regenerated booksCatalog.metadata.json" };
  } catch (err) {
    throw new Error(`catalog regeneration failed: ${(err as Error).message}`);
  }
}

function git(outerRoot: string, args: string[]): { status: number; stdout: string; stderr: string } {
  return gitOutcome(outerRoot, args);
}

/** dirty (modified or untracked) among `relPaths`. We test each path individually —
 *  `git status --porcelain -- <path>` prints ANY output iff that path is dirty — so
 *  we never column-slice the porcelain prefix (whose leading status-space is fragile:
 *  a trimming git wrapper would shift the offset and mangle the path). This keeps the
 *  exact set of relPaths that are dirty, order-preserved. */
function dirtyPaths(outerRoot: string, relPaths: string[]): string[] {
  const dirty: string[] = [];
  for (const p of relPaths) {
    const r = git(outerRoot, ["status", "--porcelain", "--", p]);
    if (r.status === 0 && r.stdout !== "") dirty.push(p);
  }
  return dirty;
}

/** Estimate package "overhead" = non-chapter (metadata) bytes as a % of file size —
 *  the owner's "many lines on top" metric. Chapters are the payload; everything else
 *  (schema/book/manifest) is overhead. Best-effort; 0 on a parse failure. */
function packageOverheadPct(pkgPath: string): { bytes: number; overheadPct: number } {
  let bytes = 0;
  try { bytes = statSync(pkgPath).size; } catch { return { bytes: 0, overheadPct: 0 }; }
  try {
    const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
    const chaptersBytes = Buffer.byteLength(JSON.stringify(pkg?.chapters ?? []), "utf8");
    const overhead = Math.max(0, bytes - chaptersBytes);
    return { bytes, overheadPct: bytes > 0 ? Math.round((overhead / bytes) * 1000) / 10 : 0 };
  } catch {
    return { bytes, overheadPct: 0 };
  }
}

export async function publishFinal(bookId: string, opts: PublishFinalOptions = {}): Promise<PublishFinalResult> {
  const started = Date.now();
  const steps: PublishFinalStep[] = [];
  const id = normSlug(bookId);
  const dryRun = opts.dryRun === true;
  const keepDebris = opts.keepDebris === true;
  const outerRoot = opts.outerRoot ?? MONOREPO_ANCESTOR;
  const runner = opts.runner ?? defaultRunner;
  const registerFn = opts.registerInOuter ?? registerInOuterRegistry;

  const finish = (ok: boolean, error?: string): PublishFinalResult => ({
    ok, bookId: id, dryRun, steps, error, durationMs: Date.now() - started,
  });
  const push = (step: string, ok: boolean, detail: string): boolean => {
    steps.push({ step, ok, detail });
    return ok;
  };

  if (!id) return finish(false, `invalid bookId: "${bookId}"`);

  // ── 1. PREFLIGHT ──────────────────────────────────────────────────────────
  const localPath = opts.localPackagePath ?? resolve(REPO_ROOT, "book-packages", `${id}.v21.json`);
  if (!push("preflight:package-exists", existsSync(localPath), existsSync(localPath) ? localPath : `missing sandbox package: ${localPath} — run promote first`)) {
    return finish(false, `sandbox package missing: ${localPath}`);
  }

  const verify = opts.verify ?? defaultVerify;
  let verified = false;
  try { verified = await verify(localPath); } catch (err) {
    push("preflight:verify", false, `verify threw: ${(err as Error).message}`);
    return finish(false, `verify threw: ${(err as Error).message}`);
  }
  if (!push("preflight:verify", verified, verified ? "verifyProductionPackage PASS (sidecar-aware)" : "verifyProductionPackage FAIL — nothing copied")) {
    return finish(false, "production verifier rejected the sandbox package");
  }

  const lockDir = opts.lockDir ?? resolve(REPO_ROOT, "state", "autopilot-locks");
  const freshLock = hasFreshLock(lockDir, id);
  if (!push("preflight:no-fresh-lock", !freshLock, freshLock ? `a FRESH autopilot lock for ${id} is held (<2h heartbeat) — refusing to publish under an active conductor` : "no fresh conductor lock")) {
    return finish(false, `a fresh autopilot lock for ${id} is held`);
  }

  // outer root must be a git worktree TOPLEVEL (never commit into an enclosing repo).
  const inside = git(outerRoot, ["rev-parse", "--is-inside-work-tree"]);
  const outerIsGit = inside.status === 0 && inside.stdout === "true";
  if (!outerIsGit) {
    push("preflight:outer-git", false, `outer root is not a git work tree: ${outerRoot}`);
    return finish(false, `outer root is not a git work tree: ${outerRoot}`);
  }
  const toplevel = git(outerRoot, ["rev-parse", "--show-toplevel"]);
  const isToplevel = toplevel.status === 0 && sameRealPath(toplevel.stdout, outerRoot);
  if (!push("preflight:outer-toplevel", isToplevel, isToplevel ? `outer toplevel: ${outerRoot}` : `outer root is not the git toplevel (toplevel=${toplevel.stdout || "?"}) — refusing to commit into an enclosing repo`)) {
    return finish(false, "outer root is not the git toplevel");
  }

  const branch = opts.branch ?? (git(outerRoot, ["rev-parse", "--abbrev-ref", "HEAD"]).stdout || "main");
  const fetch = git(outerRoot, ["fetch", "origin"]);
  if (!push("preflight:fetch", fetch.status === 0, fetch.status === 0 ? "git fetch origin OK" : `git fetch origin failed: ${fetch.stderr || fetch.stdout}`)) {
    return finish(false, `git fetch origin failed: ${fetch.stderr || fetch.stdout}`);
  }

  // ── package sha / size / overhead (for the report) ──
  const pkgSha = sha256File(localPath);
  const { bytes: pkgBytes, overheadPct } = packageOverheadPct(localPath);

  // ── DRY-RUN: print the complete plan INCLUDING the cleanup manifest — zero mutations ──
  if (dryRun) {
    const bridgeRel = `book-packages/${id}.v21.json`;
    const probe = probeRegistration(outerRoot, id);
    push("plan:bridge", true, `would copy ${localPath} → ${resolve(outerRoot, bridgeRel)} + byte-compare (sha256 ${pkgSha.slice(0, 12)}…)`);
    push("plan:register", true, `registration probe: ${probe.state}${probe.state === "not-found" ? " → would append-register into the outer registry" : ""}; would regenerate ${OUTER_CATALOG_METADATA_REL}`);
    push("plan:deploy-sentinel", true, `would record deploy debt for ${id} in ${PENDING_DEPLOY_REL} (cleared by npm run verify:live)`);
    push("plan:commit", true, `would pathspec-commit {${bridgeRel}, ${PENDING_DEPLOY_REL}${probe.state === "not-found" ? `, ${OUTER_REGISTRY_REL}` : ""}, ${OUTER_CATALOG_METADATA_REL} (if dirty)} on ${branch}`);
    push("plan:push", true, `would push ${branch} with a MERGE loop (never rebase/force)`);
    push("plan:sync", true, `would fetch + ff-only pull + assert origin/${branch}...${branch} == "0 0"`);
    const manifest = buildCleanupManifest(id, { outerRoot });
    push("plan:cleanup", true, keepDebris ? "cleanup SKIPPED (--keep-debris)" : formatCleanupManifest(manifest));
    return {
      ...finish(true),
      packageSha: pkgSha, packageBytes: pkgBytes, overheadPct,
      cleanupManifest: manifest,
    };
  }

  // ── 2. BRIDGE ─────────────────────────────────────────────────────────────
  const bridge = bridgePackage(id, localPath, outerRoot);
  if (!bridge.ok) {
    push("bridge", false, bridge.error);
    return finish(false, bridge.error);
  }
  push("bridge", true, `copied → ${bridge.destPath}; sha256 MATCH (${bridge.srcHash.slice(0, 12)}…)`);

  // ── 3. REGISTRATION ───────────────────────────────────────────────────────
  const probe = probeRegistration(outerRoot, id);
  let registered = probe.state === "found";
  if (probe.state === "not-found") {
    try {
      registerFn(outerRoot, id, bridge.destPath);
      registered = true;
      push("register:append", true, `append-registered ${id} into ${OUTER_REGISTRY_REL}`);
    } catch (err) {
      push("register:append", false, `append-register failed: ${(err as Error).message}`);
      return finish(false, `append-register failed: ${(err as Error).message}`);
    }
  } else if (probe.state === "unknown") {
    push("register:probe", false, `outer registry not found at ${probe.registryPath} — outer root may not be a ChapterFlow checkout`);
    return finish(false, `outer registry not found at ${probe.registryPath}`);
  } else {
    push("register:probe", true, `already registered in ${OUTER_REGISTRY_REL}`);
  }

  // ALWAYS regenerate the outer catalog metadata; include it iff dirty.
  try {
    const gen = regenerateOuterCatalog(outerRoot, runner);
    push("register:catalog", true, gen.detail);
  } catch (err) {
    push("register:catalog", false, (err as Error).message);
    return finish(false, (err as Error).message);
  }

  // ── 3b. DEPLOY SENTINEL ───────────────────────────────────────────────────
  // Write the "deploy owed" flag and stage it INTO the publish commit, so a
  // pushed publish can never be silently un-served. Reuses the pkgSha already
  // computed for the byte-compare. Best-effort READ of the existing sentinel
  // (a torn blob starts fresh via mergePendingDeploy without dropping valid
  // entries); the write itself is fail-closed (a publish that cannot record the
  // deploy debt must not silently succeed).
  const sentinelAbs = resolve(outerRoot, PENDING_DEPLOY_REL);
  const deployHint = deployRequiredHint(id);
  try {
    const existing = existsSync(sentinelAbs) ? readFileSync(sentinelAbs, "utf8") : null;
    const merged = mergePendingDeploy(existing, {
      bookId: id,
      packageSha256: pkgSha,
      publishedAt: new Date().toISOString(),
      steps: [...PENDING_DEPLOY_STEPS],
    });
    writeFileSync(sentinelAbs, merged);
    push("deploy-sentinel", true, `recorded deploy debt for ${id} in ${PENDING_DEPLOY_REL} (clear with: npm run verify:live)`);
  } catch (err) {
    push("deploy-sentinel", false, `could not write ${PENDING_DEPLOY_REL}: ${(err as Error).message}`);
    return finish(false, `deploy-sentinel write failed: ${(err as Error).message}`);
  }

  // ── 4. COMMIT ─────────────────────────────────────────────────────────────
  const bridgeRel = `book-packages/${id}.v21.json`;
  const pathspec = [bridgeRel, PENDING_DEPLOY_REL];
  const dirtyRegistryCatalog = dirtyPaths(outerRoot, [OUTER_REGISTRY_REL, OUTER_CATALOG_METADATA_REL]);
  for (const p of dirtyRegistryCatalog) if (!pathspec.includes(p)) pathspec.push(p);

  // Only stage paths that are actually dirty (a re-run over unchanged content stages nothing).
  const dirtyPathspec = dirtyPaths(outerRoot, pathspec);
  let commitSha: string | undefined;
  if (dirtyPathspec.length === 0) {
    // IDEMPOTENT: nothing new to commit — adopt HEAD (a prior run already committed).
    commitSha = git(outerRoot, ["rev-parse", "HEAD"]).stdout;
    push("commit", true, `SKIPPED (content already committed) — HEAD ${commitSha.slice(0, 12)}`);
  } else {
    const add = git(outerRoot, ["add", "--", ...dirtyPathspec]);
    if (add.status !== 0) { push("commit", false, `git add failed: ${add.stderr || add.stdout}`); return finish(false, `git add failed: ${add.stderr || add.stdout}`); }
    const commit = git(outerRoot, [
      "commit",
      "-m", `chore(books): publish ${id} package to live catalog`,
      "-m", COMMIT_TRAILER,
      "--", ...dirtyPathspec,
    ]);
    if (commit.status !== 0) { push("commit", false, `git commit failed: ${commit.stderr || commit.stdout}`); return finish(false, `git commit failed: ${commit.stderr || commit.stdout}`); }
    commitSha = git(outerRoot, ["rev-parse", "HEAD"]).stdout;
    push("commit", true, `committed ${dirtyPathspec.length} file(s) — ${commitSha.slice(0, 12)}`);
  }

  // ── 5. PUSH (MERGE loop — NEVER rebase/force) ─────────────────────────────
  const pushResult = pushWithMerge(outerRoot, branch, 3);
  if (!push("push", pushResult.pushed, pushResult.pushed ? `pushed ${branch}${pushResult.merged ? " (merged an advanced origin — merge commit, NOT rebase)" : ""}` : `push failed: ${pushResult.error}`)) {
    return { ...finish(false, `push failed: ${pushResult.error}`), commitSha };
  }
  commitSha = git(outerRoot, ["rev-parse", "HEAD"]).stdout; // a merge may have advanced HEAD

  // TEST SEAM: simulate a concurrent divergent commit landing on origin in the
  // post-push→pre-sync window, so the step-6 assert is exercised out-of-sync.
  if (opts.__afterPushHook) opts.__afterPushHook();

  // ── 6. POST-PUSH SYNC (owner requirement) ─────────────────────────────────
  const syncFetch = git(outerRoot, ["fetch", "origin"]);
  if (syncFetch.status !== 0) { push("sync", false, `post-push fetch failed: ${syncFetch.stderr || syncFetch.stdout}`); return { ...finish(false, "post-push fetch failed"), commitSha }; }
  // If behind, ff-only pull.
  const countBefore = git(outerRoot, ["rev-list", "--left-right", "--count", `origin/${branch}...${branch}`]);
  const [aheadOfLocalStr] = countBefore.stdout.split(/\s+/); // left = origin ahead of local
  if (Number(aheadOfLocalStr) > 0) {
    const pull = git(outerRoot, ["pull", "--ff-only", "origin", branch]);
    if (pull.status !== 0) { push("sync", false, `git pull --ff-only failed: ${pull.stderr || pull.stdout}`); return { ...finish(false, "ff-only pull failed"), commitSha }; }
  }
  const count = git(outerRoot, ["rev-list", "--left-right", "--count", `origin/${branch}...${branch}`]);
  const syncState = count.stdout.replace(/\s+/g, " ").trim();
  if (!push("sync", syncState === "0 0", syncState === "0 0" ? `origin/${branch}...${branch} == 0 0 (in sync)` : `origin/${branch}...${branch} == "${syncState}" (NOT 0 0)`)) {
    return { ...finish(false, `post-push sync mismatch: origin/${branch}...${branch} == "${syncState}"`), commitSha, syncState };
  }

  // ── 7. CLEANUP (owner requirement) — gated on the step-6 proof ─────────────
  let cleanup: CleanupResult | undefined;
  let cleanupManifest: CleanupManifest | undefined;
  if (keepDebris) {
    cleanupManifest = buildCleanupManifest(id, { outerRoot });
    push("cleanup", true, "SKIPPED (--keep-debris) — debris left on disk");
  } else {
    const proof: PublishProof = { pushedCommit: commitSha!, syncState };
    cleanup = applyCleanup(id, proof, { outerRoot });
    cleanupManifest = cleanup.manifest;
    if (!cleanup.ok) {
      // A cleanup abort (tracked file) is a HARD failure — but the publish already
      // succeeded (committed + pushed + synced), so surface it without unshipping.
      push("cleanup", false, cleanup.error ?? "cleanup failed");
      return {
        ...finish(false, `publish succeeded but cleanup ABORTED: ${cleanup.error}`),
        commitSha, syncState, cleanup, cleanupManifest,
        packageSha: pkgSha, packageBytes: pkgBytes, overheadPct,
        deployRequired: deployHint,
      };
    }
    const ledgerNote = cleanup.prunedLedgers.length ? `; line-pruned ${cleanup.prunedLedgers.length} ledger(s)` : "";
    push("cleanup", true, `removed ${cleanup.removed.length} path(s) / ${cleanup.removedFiles} file(s) (~${(cleanup.removedBytes / (1024 * 1024)).toFixed(2)} MB)${ledgerNote}`);
  }

  return {
    ...finish(true),
    commitSha, syncState, cleanup, cleanupManifest,
    packageSha: pkgSha, packageBytes: pkgBytes, overheadPct,
    deployRequired: deployHint,
  };
}

/** realpath compare (macOS /tmp symlink safety). */
function sameRealPath(a: string, b: string): boolean {
  try {
    return realpathSync(a) === realpathSync(b);
  } catch {
    return resolve(a) === resolve(b);
  }
}

export type PushMergeResult = { pushed: boolean; merged: boolean; error?: string };

/**
 * Push <branch> to origin, reconciling an ADVANCED remote by MERGE (never rebase,
 * never force). This repo's local main carries merge topology and a parallel
 * session pushes frequently — a rebase would flatten that history, so on rejection
 * we `git fetch` + `git merge --no-edit origin/<branch>` and retry (≤`attempts`).
 * A GENUINE merge conflict → `git merge --abort` + a structured error (never a
 * force-push, never an auto-resolve).
 */
export function pushWithMerge(outerRoot: string, branch: string, attempts = 3): PushMergeResult {
  let merged = false;
  let lastErr = "";
  for (let attempt = 0; attempt < attempts; attempt++) {
    const p = git(outerRoot, ["push", "origin", branch]);
    if (p.status === 0) return { pushed: true, merged };
    lastErr = p.stderr || p.stdout;
    // rejected — reconcile by MERGE.
    const fetch = git(outerRoot, ["fetch", "origin", branch]);
    if (fetch.status !== 0) return { pushed: false, merged, error: `push rejected and fetch failed: ${fetch.stderr || fetch.stdout}` };
    const merge = git(outerRoot, ["merge", "--no-edit", `origin/${branch}`]);
    if (merge.status !== 0) {
      // genuine conflict — abort, never force.
      git(outerRoot, ["merge", "--abort"]);
      return { pushed: false, merged, error: `push rejected; merge origin/${branch} conflicted (aborted — resolve manually, do NOT force-push): ${merge.stderr || merge.stdout}` };
    }
    merged = true; // a merge happened (or was a no-op fast-forward that still counts as reconciled)
  }
  return { pushed: false, merged, error: lastErr || "push failed after retries" };
}

/** Render the publish-final result as a human-readable report. */
export function formatPublishFinalResult(r: PublishFinalResult): string {
  const L: string[] = [];
  L.push(r.ok ? `PUBLISH-FINAL ${r.dryRun ? "PLAN" : "OK"} — ${r.bookId}` : `PUBLISH-FINAL BLOCKED — ${r.bookId}`);
  for (const s of r.steps) L.push(`  ${s.ok ? "✓" : "✗"} ${s.step}: ${s.detail}`);
  if (r.packageSha) L.push(`  package: sha256 ${r.packageSha.slice(0, 12)}…  ${(r.packageBytes ?? 0)} B  overhead ${r.overheadPct ?? 0}%`);
  if (r.commitSha) L.push(`  commit: ${r.commitSha.slice(0, 12)}`);
  if (r.syncState) L.push(`  sync: origin == ${r.syncState}`);
  if (r.cleanup && !r.dryRun) {
    L.push(`  cleanup: removed ${r.cleanup.removed.length} path(s) / ${r.cleanup.removedFiles} file(s) (~${(r.cleanup.removedBytes / (1024 * 1024)).toFixed(2)} MB)`);
    L.push(`           NOTE: the git-committed package is now the durable record (the production-manifest sidecar was swept with the rest of the state).`);
  }
  if (r.durationMs != null) L.push(`  duration: ${(r.durationMs / 1000).toFixed(1)}s`);
  if (!r.ok && r.error) L.push(`  reason: ${r.error}`);
  // Loud DEPLOY REQUIRED block whenever a publish landed (the sentinel is owed).
  if (r.deployRequired && r.deployRequired.length > 0 && !r.dryRun) {
    L.push("");
    for (const line of r.deployRequired) L.push(line);
  }
  return L.join("\n");
}
