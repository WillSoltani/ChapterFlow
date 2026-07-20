/**
 * IMP-12 item 1 — the consolidated test-root abstraction.
 *
 * One disposable, parallel-safe temporary tree per test rig, with a typed slot
 * for every root the pipeline can be pointed at: canonical state (packets/
 * plans/briefs/chapters/indexes via CompilerStoreRoots.stateRoot), attempts,
 * evidence, exec logs, agent workspaces, a fake user home, bakeoff slots, and
 * reviews. Tests INJECT these explicitly (io seams / roots params); nothing
 * defaults to a production path.
 *
 * Naming is pid+sequence-unique so parallel suite processes and repeated rigs
 * inside one process can never collide on book/attempt ids (IMP-12 red-team:
 * "two tests collide on book/attempt IDs" — collide on IDS is fine, they live
 * under different roots).
 */

import { lstatSync, mkdtempSync, mkdirSync, readlinkSync, realpathSync, rmSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, sep } from "node:path";

export type TestRoots = {
  /** The whole disposable tree (everything below lives under it). */
  base: string;
  /** Candidate/book storage fixture root. */
  booksRoot: string;
  /** CompilerStoreRoots.stateRoot — indexes/, books/<id>/runs/<runId>/…, chapters/. */
  stateRoot: string;
  /** Test-owned structured/application logs. */
  logsRoot: string;
  /** mintChapterAttempt attemptsRoot. */
  attemptsRoot: string;
  /** IMP-10 evidence store root. */
  evidenceRoot: string;
  /** Effective-context / route sidecar sink (manifestSink / execBaseDir). */
  execLogRoot: string;
  /** Per-role agent workspaces. */
  workspacesRoot: string;
  /** Fake user home (hostile-context fixtures point HOME/CODEX_HOME here). */
  homeRoot: string;
  /** Bakeoff slot roots. */
  bakeoffRoot: string;
  /** Persisted review artifacts. */
  reviewsRoot: string;
  /** Miscellaneous test-owned temporary files. */
  tempRoot: string;
  /** Remove the whole tree (idempotent; safe under abrupt-termination tests —
   *  the OS tmpdir is the backstop for anything a killed process leaves). */
  dispose: () => void;
};

let seq = 0;

function safePrefix(prefix: string): string {
  const clean = prefix.replace(/[^A-Za-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
  return (clean || "cf-test").slice(0, 64);
}

function removeDisposableRoot(base: string, expectedRealPath: string): void {
  let stat;
  try {
    stat = lstatSync(base);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return;
    throw error;
  }

  // If an interrupted or hostile test replaced the disposable directory with a
  // symlink, remove the link itself. Never recurse through its outside target.
  if (stat.isSymbolicLink()) {
    readlinkSync(base); // fail closed if the entry raced between lstat and unlink
    unlinkSync(base);
    return;
  }

  const currentRealPath = realpathSync(base);
  if (currentRealPath !== expectedRealPath) {
    throw new Error(`refusing to clean replaced test root: ${base}`);
  }
  rmSync(base, { recursive: true, force: true, maxRetries: 2 });
}

export function createTestRoots(prefix = "cf-v25-test"): TestRoots {
  const osTemp = resolve(tmpdir());
  const osTempRealPath = realpathSync(osTemp);
  const base = mkdtempSync(join(osTemp, `${safePrefix(prefix)}-${process.pid}-${seq++}-`));
  const expectedRealPath = realpathSync(base);
  if (expectedRealPath !== osTempRealPath && !expectedRealPath.startsWith(`${osTempRealPath}${sep}`)) {
    rmSync(base, { recursive: true, force: true });
    throw new Error(`test root escaped OS temporary directory: ${expectedRealPath}`);
  }
  const roots: TestRoots = {
    base,
    booksRoot: join(base, "books"),
    stateRoot: join(base, "state"),
    logsRoot: join(base, "logs"),
    attemptsRoot: join(base, "attempts"),
    evidenceRoot: join(base, "evidence"),
    execLogRoot: join(base, "exec-logs"),
    workspacesRoot: join(base, "workspaces"),
    homeRoot: join(base, "home"),
    bakeoffRoot: join(base, "bakeoff"),
    reviewsRoot: join(base, "reviews"),
    tempRoot: join(base, "temp"),
    dispose: () => removeDisposableRoot(base, expectedRealPath),
  };
  for (const dir of [
    roots.booksRoot,
    roots.stateRoot,
    roots.logsRoot,
    roots.attemptsRoot,
    roots.evidenceRoot,
    roots.execLogRoot,
    roots.workspacesRoot,
    roots.homeRoot,
    roots.bakeoffRoot,
    roots.reviewsRoot,
    roots.tempRoot,
  ]) {
    mkdirSync(dir, { recursive: true });
  }
  return roots;
}

/** Backward-compatible name used by existing tests. */
export function mkTestRoots(prefix = "cf-test"): TestRoots {
  return createTestRoots(prefix);
}
