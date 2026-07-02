import { existsSync, mkdirSync, readFileSync, readdirSync, unlinkSync, writeFileSync } from "fs";
import { randomBytes } from "crypto";
import { hostname } from "os";
import { dirname, resolve } from "path";

import { CANONICAL_STATE, normSlug } from "../lib/chapterPaths.js";
import { writeFileAtomic } from "../lib/atomicWrite.js";
import type { CompilerRunRecord, SectionKind } from "./artifactTypes.js";
import { V23_COMPILER_SCHEMA_VERSION } from "./artifactTypes.js";

export type CompilerStoreRoots = {
  stateRoot?: string;
};

const DEFAULT_RUN_ID = "v23-current";

// ── Same-book concurrency guard ─────────────────────────────────────────────
//
// The compiler pipeline assumes one run per book at a time: every artifact path funnels
// through ensureCompilerRun()'s DEFAULT_RUN_ID, so two concurrent, INDEPENDENT runs of the
// SAME book would silently write the same paths (last-writer-wins). Rather than build out
// real multi-run namespacing, fail loud: the compiler write entry point (doCompilerWrite in
// orchestrator/compilerRun.ts) takes an advisory lock in state/autopilot-locks/ (the same
// directory the autopilot conductor's per-book run lock lives in) EXACTLY ONCE, before it
// spawns any section work, and a second independent process for that book gets a clear error
// instead of silently clobbering the first run's output.
//
// Acquisition is deliberately NOT inside ensureCompilerRun()/artifactDir(): those two are
// called by every read AND by the read-only `validate-sections`/`assemble-sections` verbs the
// write entry point spawns as its own child processes (directly, and indirectly — a section
// writer's own agent session shells out to `validate-sections` itself per its task card). If
// ensureCompilerRun() tried to acquire on every call, the 2nd+ of those legitimate, INTRA-run
// concurrent children would throw against their own parent's lock. So ensureCompilerRun() only
// CHECKS: it no-ops for (a) this same process (the lock owner, tracked in heldCompilerRunLocks)
// and (b) any child process the owning run marked via COMPILER_RUN_OWNER_ENV (the write entry
// point sets it on every subprocess/agent env it spawns, so it inherits down through however
// many process generations separate it from the eventual `validate-sections` call). Anyone else
// hitting a live lock — i.e. a genuinely independent second run — still fails loud.

type CompilerRunLockRecord = { pid: number; host: string; at: string; owner: string };

/** Set by the compiler write entry point on every subprocess/agent env it spawns so those
 *  children (and anything THEY spawn) are recognized as part of the run that already holds
 *  the lock, instead of being treated as a competing independent run. */
export const COMPILER_RUN_OWNER_ENV = "CHAPTERFLOW_COMPILER_RUN_OWNER";

export function compilerRunLockPath(bookId: string, roots: CompilerStoreRoots = {}): string {
  return resolve(roots.stateRoot ?? CANONICAL_STATE, "autopilot-locks", `${normSlug(bookId)}.compiler-run.lock`);
}

function readCompilerRunLockRecord(path: string): CompilerRunLockRecord | null {
  try {
    return JSON.parse(readFileSync(path, "utf8")) as CompilerRunLockRecord;
  } catch {
    return null;
  }
}

/** Same-host liveness probe (kill(pid, 0): ESRCH = dead, EPERM = alive under another user).
 *  A cross-host or malformed record can't be probed, so it's treated as live — fail loud
 *  rather than risk a silent clobber of a run we can't actually verify is dead. */
function compilerRunLockOwnerIsLive(rec: CompilerRunLockRecord): boolean {
  if (rec.host !== hostname() || typeof rec.pid !== "number") return true;
  try {
    process.kill(rec.pid, 0);
    return true;
  } catch (err) {
    return (err as NodeJS.ErrnoException)?.code !== "ESRCH";
  }
}

function foreignCompilerRunLockError(bookId: string, held: CompilerRunLockRecord | null, path: string): Error {
  return new Error(
    `compiler artifact writes for book "${bookId}" are already in progress` +
      (held ? ` (lock held by pid ${held.pid}@${held.host} since ${held.at}).` : " (an unreadable lock is present).") +
      ` Concurrent compiler runs for the same book are not supported — refusing to write artifacts that could clobber the other run's output.` +
      ` If that run is dead, remove ${path} and retry.`,
  );
}

// Held for the lifetime of THIS process, keyed by the resolved lock file path (not bookId
// alone) so distinct roots for the same book id — as tests use — never collide. This makes
// re-acquiring our own lock a no-op instead of a filesystem hit for any in-process re-entry
// (e.g. the conductor reading bookRiskPath() after doCompilerWrite already holds the lock).
const heldCompilerRunLocks = new Map<string, string>();

// A SINGLE process-wide exit hook releases every held lock, rather than one `process.once`
// registration per acquire — a long-lived process (or a test run touching many books/roots)
// would otherwise pile up exit listeners past Node's default max and trip
// MaxListenersExceededWarning.
let exitHookRegistered = false;
function ensureExitHookRegistered(): void {
  if (exitHookRegistered) return;
  exitHookRegistered = true;
  process.once("exit", () => {
    for (const [path, owner] of heldCompilerRunLocks) {
      try {
        if (readCompilerRunLockRecord(path)?.owner === owner) unlinkSync(path);
      } catch {
        /* best-effort: a failed cleanup must never crash process exit */
      }
    }
  });
}

/** Acquire the exclusive compiler-write lock for `bookId`. Call this EXACTLY ONCE, at the
 *  single compiler write entry point (doCompilerWrite), before spawning any section work —
 *  never from ensureCompilerRun()/artifactDir(), which read-only CLI verbs and every artifact
 *  path resolution also funnel through. */
export function acquireCompilerWriteLock(bookId: string, roots: CompilerStoreRoots = {}): void {
  const normalized = normSlug(bookId);
  const path = compilerRunLockPath(normalized, roots);
  if (heldCompilerRunLocks.has(path)) return;
  mkdirSync(dirname(path), { recursive: true });
  const owner = `${process.pid}-${hostname()}-${randomBytes(6).toString("hex")}`;
  const record: CompilerRunLockRecord = { pid: process.pid, host: hostname(), at: new Date().toISOString(), owner };
  try {
    writeFileSync(path, JSON.stringify(record), { flag: "wx" });
  } catch (err) {
    if ((err as NodeJS.ErrnoException)?.code !== "EEXIST") throw err;
    const held = readCompilerRunLockRecord(path);
    if (!held || compilerRunLockOwnerIsLive(held)) throw foreignCompilerRunLockError(normalized, held, path);
    // Owner is provably dead (same host, ESRCH) — reclaim the stale lock.
    writeFileSync(path, JSON.stringify(record), "utf8");
  }
  heldCompilerRunLocks.set(path, owner);
  ensureExitHookRegistered();
}

/** Read-only guard used by ensureCompilerRun()/artifactDir(). No-ops for the process that
 *  holds the lock and for any process marked as part of that run via COMPILER_RUN_OWNER_ENV;
 *  throws only when a LIVE lock is held by someone else. Never acquires or writes anything. */
function assertCompilerRunAccessible(bookId: string, roots: CompilerStoreRoots): void {
  const path = compilerRunLockPath(bookId, roots);
  if (heldCompilerRunLocks.has(path)) return;
  if (process.env[COMPILER_RUN_OWNER_ENV] === bookId) return;
  const held = readCompilerRunLockRecord(path);
  if (!held || !compilerRunLockOwnerIsLive(held)) return;
  throw foreignCompilerRunLockError(bookId, held, path);
}

export function compilerBookRoot(bookId: string, roots: CompilerStoreRoots = {}): string {
  return resolve(roots.stateRoot ?? CANONICAL_STATE, "books", normSlug(bookId));
}

export function compilerCurrentRunPath(bookId: string, roots: CompilerStoreRoots = {}): string {
  return resolve(compilerBookRoot(bookId, roots), "current-run.json");
}

export function compilerRunRoot(bookId: string, runIdOrRoots?: string | CompilerStoreRoots, maybeRoots: CompilerStoreRoots = {}): string {
  const runId = typeof runIdOrRoots === "string" ? runIdOrRoots : currentRunId(bookId, runIdOrRoots ?? {});
  const roots = typeof runIdOrRoots === "string" ? maybeRoots : runIdOrRoots ?? {};
  return resolve(compilerBookRoot(bookId, roots), "runs", runId);
}

export function currentRunId(bookId: string, roots: CompilerStoreRoots = {}): string {
  const p = compilerCurrentRunPath(bookId, roots);
  if (existsSync(p)) {
    try {
      const rec = JSON.parse(readFileSync(p, "utf8")) as Partial<CompilerRunRecord>;
      if (rec?.runId) return rec.runId;
      console.warn(
        `artifactStore: current-run.json at ${p} has no runId; falling back to the default run id "${DEFAULT_RUN_ID}" — artifacts under a different historical run (if any) will appear orphaned.`,
      );
    } catch (err) {
      console.warn(
        `artifactStore: current-run.json at ${p} is corrupt/unreadable (${(err as Error)?.message ?? String(err)}); falling back to the default run id "${DEFAULT_RUN_ID}" — artifacts under a different historical run (if any) will appear orphaned.`,
      );
    }
  }
  return DEFAULT_RUN_ID;
}

export function ensureCompilerRun(bookId: string, roots: CompilerStoreRoots = {}): CompilerRunRecord {
  const normalized = normSlug(bookId);
  assertCompilerRunAccessible(normalized, roots);
  const currentPath = compilerCurrentRunPath(normalized, roots);
  mkdirSync(dirname(currentPath), { recursive: true });
  let rec: CompilerRunRecord | null = null;
  if (existsSync(currentPath)) {
    try {
      const parsed = JSON.parse(readFileSync(currentPath, "utf8"));
      if (parsed?.schemaVersion === V23_COMPILER_SCHEMA_VERSION && parsed?.bookId === normalized && parsed?.runId) {
        rec = parsed as CompilerRunRecord;
      }
    } catch {
      rec = null;
    }
  }
  if (!rec) {
    rec = {
      schemaVersion: V23_COMPILER_SCHEMA_VERSION,
      bookId: normalized,
      runId: DEFAULT_RUN_ID,
      createdAt: new Date().toISOString(),
      architecture: "compiler",
      finalChapterSchema: "chapterflow-v21-authored",
    };
    writeFileAtomic(currentPath, JSON.stringify(rec, null, 2) + "\n");
  }
  mkdirSync(compilerRunRoot(normalized, rec.runId, roots), { recursive: true });
  return rec;
}

export function artifactDir(bookId: string, stage: string, roots: CompilerStoreRoots = {}): string {
  const rec = ensureCompilerRun(bookId, roots);
  const dir = resolve(compilerRunRoot(bookId, rec.runId, roots), stage);
  mkdirSync(dir, { recursive: true });
  return dir;
}

export function sourcePacketPath(bookId: string, chapterNumber: number, roots: CompilerStoreRoots = {}): string {
  return resolve(artifactDir(bookId, "source-packets", roots), `ch${String(chapterNumber).padStart(2, "0")}.source-packet.json`);
}

export function blueprintPath(bookId: string, chapterNumber: number, roots: CompilerStoreRoots = {}): string {
  return resolve(artifactDir(bookId, "blueprints", roots), `ch${String(chapterNumber).padStart(2, "0")}.blueprint.json`);
}

/** v24 chapter brief (B1) — the machine-readable one-page reservation sheet. Lives inside the
 *  compiler run (runs/<runId>/briefs/) like blueprints: briefs are per-run compiled artifacts. */
export function chapterBriefPath(bookId: string, chapterNumber: number, roots: CompilerStoreRoots = {}): string {
  return resolve(artifactDir(bookId, "briefs", roots), `ch${String(chapterNumber).padStart(2, "0")}.brief.json`);
}

/** The rendered human/writer-facing page for a chapter brief (embedded in the writer card). */
export function chapterBriefMdPath(bookId: string, chapterNumber: number, roots: CompilerStoreRoots = {}): string {
  return resolve(artifactDir(bookId, "briefs", roots), `ch${String(chapterNumber).padStart(2, "0")}.brief.md`);
}

export function sectionDir(bookId: string, chapterNumber: number, roots: CompilerStoreRoots = {}): string {
  const dir = resolve(artifactDir(bookId, "sections", roots), `ch${String(chapterNumber).padStart(2, "0")}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

export function sectionPath(bookId: string, chapterNumber: number, kind: SectionKind, roots: CompilerStoreRoots = {}): string {
  return resolve(sectionDir(bookId, chapterNumber, roots), `${kind}.json`);
}

export function sectionTaskDir(bookId: string, roots: CompilerStoreRoots = {}): string {
  const dir = resolve(artifactDir(bookId, "tasks", roots), "sections");
  mkdirSync(dir, { recursive: true });
  return dir;
}

export function sectionTaskPath(bookId: string, chapterNumber: number, kind: SectionKind, roots: CompilerStoreRoots = {}): string {
  return resolve(sectionTaskDir(bookId, roots), `ch${String(chapterNumber).padStart(2, "0")}.${kind}.md`);
}

export function evidenceMapPath(bookId: string, chapterNumber: number, roots: CompilerStoreRoots = {}): string {
  return resolve(artifactDir(bookId, "evidence", roots), `ch${String(chapterNumber).padStart(2, "0")}.evidence-map.json`);
}

export function riskScorePath(bookId: string, chapterNumber: number, roots: CompilerStoreRoots = {}): string {
  return resolve(artifactDir(bookId, "risk", roots), `ch${String(chapterNumber).padStart(2, "0")}.risk.json`);
}

export function bookRiskPath(bookId: string, roots: CompilerStoreRoots = {}): string {
  return resolve(artifactDir(bookId, "risk", roots), `book-risk.json`);
}

/** Book-level rubric pre-flight artifact (P04). A sibling FILE of the per-book
 *  compiler dir, not inside a run — the deterministic rubric report is keyed by
 *  book, not by compiler run, and downstream (risk, operators) reads it by book. */
export function rubricMetricsPath(bookId: string, roots: CompilerStoreRoots = {}): string {
  return resolve(roots.stateRoot ?? CANONICAL_STATE, "books", `${normSlug(bookId)}.rubric-metrics.json`);
}

export function assemblyInputPath(bookId: string, chapterNumber: number, roots: CompilerStoreRoots = {}): string {
  return resolve(artifactDir(bookId, "assembly", roots), `ch${String(chapterNumber).padStart(2, "0")}.assemble-input.json`);
}

/** The repair-routing decision ledger (P10). A book-level JSONL — one appended line per routing
 *  decision (finding → lever → salt bumped → outcome) so a walk-away operator can audit exactly
 *  which findings were re-dealt vs edited vs escalated in each QC round. */
export function repairRoutingLedgerPath(bookId: string, roots: CompilerStoreRoots = {}): string {
  return resolve(roots.stateRoot ?? CANONICAL_STATE, "books", `${normSlug(bookId)}.repair-routing.jsonl`);
}

/** The repair-owned slot-salts sidecar (P10). A book-level FILE (not inside a compiler run,
 *  like rubricMetricsPath), holding the per-chapter salt bumps QC repair uses to RE-DEAL a
 *  blueprint's example/venue/quiz/name slots. `compileChapterBlueprint` reads it and mixes each
 *  salt into ONLY the matching deal's index math, so an ABSENT file (or an all-zero salt) yields
 *  byte-identical blueprints to today. NOTHING but the repair router (redealAndRegenerate) may
 *  write it — the compiler treats it as read-only input. */
export function slotSaltsPath(bookId: string, roots: CompilerStoreRoots = {}): string {
  return resolve(roots.stateRoot ?? CANONICAL_STATE, "book-design", `${normSlug(bookId)}.slot-salts.json`);
}

/** The per-book design artifact (P14). A book-level FILE alongside the slot-salts sidecar in
 *  state/book-design/ (not inside a compiler run — the design is keyed by book, not run, like
 *  rubricMetricsPath/slotSaltsPath). Holds the compiled, hash-pinned variety pools the blueprint
 *  draws from. An ABSENT file ⇒ the blueprint falls back to genre pools, then the legacy in-code
 *  constants (byte-identical to the pre-P14 world). Written only by `compile-book-design`. */
export function bookDesignPath(bookId: string, roots: CompilerStoreRoots = {}): string {
  return resolve(roots.stateRoot ?? CANONICAL_STATE, "book-design", `${normSlug(bookId)}.design.json`);
}

export function readJsonFile<T = unknown>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

export function writeJsonFile(path: string, value: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileAtomic(path, JSON.stringify(value, null, 2) + "\n");
}

export function existingSectionTaskPaths(bookId: string, roots: CompilerStoreRoots = {}): string[] {
  const dir = sectionTaskDir(bookId, roots);
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((f) => f.endsWith(".md")).sort().map((f) => resolve(dir, f));
}

export function writeTextFile(path: string, text: string): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, text.endsWith("\n") ? text : `${text}\n`, "utf8");
}
