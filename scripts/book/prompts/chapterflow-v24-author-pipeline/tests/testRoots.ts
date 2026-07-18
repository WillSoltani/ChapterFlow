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

import { mkdtempSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

export type TestRoots = {
  /** The whole disposable tree (everything below lives under it). */
  base: string;
  /** CompilerStoreRoots.stateRoot — indexes/, books/<id>/runs/<runId>/…, chapters/. */
  stateRoot: string;
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
  /** Remove the whole tree (idempotent; safe under abrupt-termination tests —
   *  the OS tmpdir is the backstop for anything a killed process leaves). */
  dispose: () => void;
};

let seq = 0;

export function mkTestRoots(prefix = "cf-test"): TestRoots {
  const base = mkdtempSync(join(tmpdir(), `${prefix}-${process.pid}-${seq++}-`));
  const roots: TestRoots = {
    base,
    stateRoot: join(base, "state"),
    attemptsRoot: join(base, "attempts"),
    evidenceRoot: join(base, "evidence"),
    execLogRoot: join(base, "exec-logs"),
    workspacesRoot: join(base, "workspaces"),
    homeRoot: join(base, "home"),
    bakeoffRoot: join(base, "bakeoff"),
    reviewsRoot: join(base, "reviews"),
    // maxRetries/retryDelay: under full-suite parallel load, rmdir of a tree
    // whose files are still being finalized (git object dirs especially) can
    // race to ENOTEMPTY/EBUSY — the documented F-018-adjacent flake class that
    // has hit CI on baseline files. Node retries those codes natively; when a
    // background writer (e.g. a fixture repo's detached git maintenance)
    // outlasts the retries, residual debris is the OS tmpdir's problem per
    // this contract's backstop — cleanup success is not a test-correctness
    // property and must never fail a suite.
    dispose: () => {
      try {
        rmSync(base, { recursive: true, force: true, maxRetries: 8, retryDelay: 100 });
      } catch (error) {
        const code = (error as NodeJS.ErrnoException).code;
        if (code !== "ENOTEMPTY" && code !== "EBUSY" && code !== "EPERM") throw error;
        console.error(`[testRoots] dispose left residual tmp debris (${code}): ${base} — OS tmpdir backstop applies`);
      }
    },
  };
  for (const dir of [roots.stateRoot, roots.attemptsRoot, roots.evidenceRoot, roots.execLogRoot, roots.workspacesRoot, roots.homeRoot, roots.bakeoffRoot, roots.reviewsRoot]) {
    mkdirSync(dir, { recursive: true });
  }
  return roots;
}
