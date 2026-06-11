/**
 * Run-directory resolution for .chapterflow/runs/<bookId>/<runId>/ artifacts.
 *
 * Replaces three near-identical private findLatestRun() copies (next-task,
 * sourceGrounding, source-loader) that all took the lexicographic LAST run
 * dir and then looked for the artifact only there. Two verified failure
 * modes (2026-06-09 review):
 *
 *   1. "Latest" is not "has the artifact": rework/zz-v2-validation sorts
 *      after every timestamped run but contains no ch01–ch08 sidecars, so
 *      those chapters' sources were permanently hidden from the gates —
 *      SC9/SC11 silently skipped. (zz- prefixes are sometimes used
 *      DELIBERATELY to win the sort for rework runs, so "prefer timestamps"
 *      would break that; artifact-aware fallthrough handles both.)
 *
 *   2. Raw-vs-normalized bookId split: half the pipeline resolved run dirs
 *      with the raw id, half with normSlug — both spellings exist on disk.
 *
 * findRunArtifact() walks run dirs newest-first across BOTH id spellings and
 * returns the first run that actually contains the requested artifact.
 */

import { existsSync, readdirSync, statSync } from "fs";
import { resolve } from "path";

import { normSlug } from "./chapterPaths.js";

function runDirsNewestFirst(runsRoot: string, bookDirName: string): string[] {
  const bookDir = resolve(runsRoot, bookDirName);
  if (!existsSync(bookDir)) return [];
  return readdirSync(bookDir)
    .filter((d) => {
      try {
        return statSync(resolve(bookDir, d)).isDirectory();
      } catch {
        return false;
      }
    })
    .sort()
    .reverse()
    .map((d) => resolve(bookDir, d));
}

/** Every book dir under runsRoot whose normSlug equals the bookId's normSlug.
 *  Two-way tolerant: a normalized caller finds raw-spelled dirs ("the hard
 *  thing about hard things", capital-letter slugs) and vice versa — the old
 *  one-way [raw, norm] candidate list left normalized callers blind to
 *  raw-spelled dirs, producing false "no source run" findings. */
function matchingBookDirs(runsRoot: string, bookId: string): string[] {
  const want = normSlug(bookId);
  let entries: string[] = [];
  try {
    entries = readdirSync(runsRoot);
  } catch {
    return [];
  }
  return entries.filter((d) => {
    if (normSlug(d) !== want) return false;
    try {
      return statSync(resolve(runsRoot, d)).isDirectory();
    } catch {
      return false;
    }
  });
}

/** All run dirs across every matching book-dir spelling, sorted globally
 *  newest-first by run-dir NAME (not per-spelling — an older run in one
 *  spelling must not beat a strictly newer run in another). */
function allRunDirsNewestFirst(runsRoot: string, bookId: string): string[] {
  const runs: Array<{ name: string; path: string }> = [];
  for (const dirName of matchingBookDirs(runsRoot, bookId)) {
    for (const runPath of runDirsNewestFirst(runsRoot, dirName)) {
      runs.push({ name: runPath.split("/").pop() ?? "", path: runPath });
    }
  }
  return runs.sort((a, b) => (a.name < b.name ? 1 : a.name > b.name ? -1 : 0)).map((r) => r.path);
}

/** Absolute path of `relPath` inside the NEWEST run that contains it, across
 *  every normSlug-equivalent bookId dir spelling. Null when no run has it. */
export function findRunArtifact(runsRoot: string, bookId: string, relPath: string): string | null {
  for (const runDir of allRunDirsNewestFirst(runsRoot, bookId)) {
    const p = resolve(runDir, relPath);
    if (existsSync(p)) return p;
  }
  return null;
}

/** The newest run dir regardless of contents — for writers/continuation
 *  (e.g. next-task appends artifacts to the run in progress). Readers should
 *  use findRunArtifact instead. */
export function findLatestRunDir(runsRoot: string, bookId: string): string | null {
  const dirs = allRunDirsNewestFirst(runsRoot, bookId);
  return dirs.length > 0 ? dirs[0] : null;
}
