/**
 * A2 — Research freshness: close the RESTORE hole in the research handoff contract.
 *
 * The autopilot's research phase verifies only the handoff POSTCONDITION (chapter
 * index exists + book-status reads write/generating). That contract was gamed by a
 * research codex session that RESTORED an archived research run byte-identical from
 * state/_regen-backups/ instead of doing live research (proven: `diff -rq` == 0
 * against the backup copy). The postcondition held, but no research happened.
 *
 * researchFreshnessViolation() is the deterministic post-pass check the conductor
 * runs AFTER researchProgressMade(): it inspects the newest research run's source
 * sidecars and reports a one-line violation when the run looks restored/stale
 * rather than freshly produced during the task. Pure fs logic — no spawning, no
 * writes — and every root is injectable so tests never touch canonical state.
 */

import { createHash } from "crypto";
import { existsSync, readdirSync, readFileSync, statSync } from "fs";
import { resolve } from "path";

import { CANONICAL_STATE, REPO_ROOT, normSlug } from "../lib/chapterPaths.js";

/** Same runs root sourceV2Gate.ts resolves (its RUNS_ROOT is module-private, so we
 *  resolve identically from the same REPO_ROOT rather than duplicating logic). */
const DEFAULT_RUNS_ROOT = resolve(REPO_ROOT, ".chapterflow/runs");
/** Where regen archives park old research runs — the proven restore source. */
const DEFAULT_BACKUPS_ROOT = resolve(CANONICAL_STATE, "_regen-backups");

export type ResearchFreshnessRoots = {
  runsRoot?: string;
  backupsRoot?: string;
};

function dirEntries(path: string): string[] {
  try {
    return readdirSync(path).filter((d) => {
      try {
        return statSync(resolve(path, d)).isDirectory();
      } catch {
        return false;
      }
    });
  } catch {
    return [];
  }
}

/** Book dirs under a runs root whose normSlug matches the bookId — the same two-way
 *  spelling tolerance runDirs.ts uses (raw ids and normalized slugs both exist on disk). */
function matchingBookDirs(runsRoot: string, bookId: string): string[] {
  const want = normSlug(bookId);
  return dirEntries(runsRoot).filter((d) => normSlug(d) === want);
}

/** Newest run dir across every matching book-dir spelling, by run-dir NAME descending —
 *  the same ordering runDirs.ts's runDirsNewestFirst uses (timestamped names sort
 *  correctly; zz- rework prefixes deliberately win the sort). */
function newestRunDir(runsRoot: string, bookId: string): { name: string; path: string } | null {
  const runs: Array<{ name: string; path: string }> = [];
  for (const bookDirName of matchingBookDirs(runsRoot, bookId)) {
    const bookDir = resolve(runsRoot, bookDirName);
    for (const runName of dirEntries(bookDir)) {
      runs.push({ name: runName, path: resolve(bookDir, runName) });
    }
  }
  if (runs.length === 0) return null;
  runs.sort((a, b) => (a.name < b.name ? 1 : a.name > b.name ? -1 : 0));
  return runs[0];
}

/** Source sidecar filenames (not paths) inside a run dir, sorted. */
function sidecarNames(runDir: string): string[] {
  const dir = resolve(runDir, "sidecars", "source");
  try {
    return readdirSync(dir)
      .filter((f) => f.endsWith(".source.json"))
      .filter((f) => {
        try {
          return statSync(resolve(dir, f)).isFile();
        } catch {
          return false;
        }
      })
      .sort();
  } catch {
    return [];
  }
}

function fileHash(path: string): string | null {
  try {
    return createHash("sha256").update(readFileSync(path)).digest("hex");
  } catch {
    return null;
  }
}

/** Backup copies of a same-named run's sidecars/source dir: every
 *  <backupsRoot>/<entry>/.chapterflow/runs/<bookId-spelling>/<runName>/sidecars/source
 *  that exists, across normSlug-equivalent bookId spellings. */
function backupSidecarDirs(backupsRoot: string, bookId: string, runName: string): string[] {
  const out: string[] = [];
  for (const backupEntry of dirEntries(backupsRoot)) {
    const backupRunsRoot = resolve(backupsRoot, backupEntry, ".chapterflow", "runs");
    for (const bookDirName of matchingBookDirs(backupRunsRoot, bookId)) {
      const candidate = resolve(backupRunsRoot, bookDirName, runName, "sidecars", "source");
      if (existsSync(candidate)) out.push(candidate);
    }
  }
  return out;
}

/**
 * Returns a one-line violation reason when the newest research run for `bookId`
 * does not look like FRESH live research produced during the task that started at
 * `taskStartedAtMs`, else null. Violations:
 *
 *  (a) no run dir at all, or the newest run has no sidecars/source/*.source.json;
 *  (b) every sidecar mtime <= taskStartedAtMs — nothing was written during the task
 *      (catches restores that preserve archived mtimes, e.g. cp -p / rsync -a);
 *  (c) a same-named run exists in a backup under `backupsRoot` and every sidecar in
 *      the live run has a same-named, content-hash-identical file in that backup —
 *      a byte-identical restore (catches restores with fresh copy mtimes). A run
 *      carrying ANY sidecar the backup lacks is not flagged: new content exists.
 */
export function researchFreshnessViolation(
  bookId: string,
  taskStartedAtMs: number,
  roots?: ResearchFreshnessRoots,
): string | null {
  const runsRoot = roots?.runsRoot ?? DEFAULT_RUNS_ROOT;
  const backupsRoot = roots?.backupsRoot ?? DEFAULT_BACKUPS_ROOT;

  // (a) — a research pass that satisfied the handoff contract must have produced a run with sidecars.
  const newest = newestRunDir(runsRoot, bookId);
  if (!newest) {
    return `no research run dir exists under ${runsRoot} for ${bookId} — the handoff contract was satisfied without a research run`;
  }
  const names = sidecarNames(newest.path);
  if (names.length === 0) {
    return `newest research run ${newest.name} has no sidecars/source/*.source.json — the handoff contract was satisfied without source research`;
  }

  // (b) — every sidecar predates the task: nothing was researched THIS pass.
  const sidecarDir = resolve(newest.path, "sidecars", "source");
  let newestMtimeMs = -Infinity;
  for (const name of names) {
    try {
      newestMtimeMs = Math.max(newestMtimeMs, statSync(resolve(sidecarDir, name)).mtimeMs);
    } catch {
      /* an unreadable sidecar contributes no fresh mtime */
    }
  }
  if (newestMtimeMs <= taskStartedAtMs) {
    return `no source sidecar in run ${newest.name} was written during the research task (newest sidecar mtime ${new Date(newestMtimeMs).toISOString()} <= task start ${new Date(taskStartedAtMs).toISOString()}) — the run predates the task`;
  }

  // (c) — byte-identical restore of an archived run (fresh mtimes don't save it).
  for (const backupDir of backupSidecarDirs(backupsRoot, bookId, newest.name)) {
    let allMatch = true;
    for (const name of names) {
      const liveHash = fileHash(resolve(sidecarDir, name));
      const backupHash = fileHash(resolve(backupDir, name));
      if (liveHash === null || backupHash === null || liveHash !== backupHash) {
        allMatch = false;
        break;
      }
    }
    if (allMatch) {
      return `newest research run ${newest.name} is a byte-identical restore of the archived backup at ${backupDir} (${names.length} sidecar(s), every content hash matches) — restoring an archived run is not research`;
    }
  }

  return null;
}
