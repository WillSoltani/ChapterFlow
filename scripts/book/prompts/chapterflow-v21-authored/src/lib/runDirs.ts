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

function candidateBookDirs(bookId: string): string[] {
  const norm = normSlug(bookId);
  return norm === bookId ? [bookId] : [bookId, norm];
}

/** Absolute path of `relPath` inside the NEWEST run that contains it, across
 *  both raw and normalized bookId dir spellings. Null when no run has it. */
export function findRunArtifact(runsRoot: string, bookId: string, relPath: string): string | null {
  for (const dirName of candidateBookDirs(bookId)) {
    for (const runDir of runDirsNewestFirst(runsRoot, dirName)) {
      const p = resolve(runDir, relPath);
      if (existsSync(p)) return p;
    }
  }
  return null;
}

/** The newest run dir regardless of contents — for writers/continuation
 *  (e.g. next-task appends artifacts to the run in progress). Readers should
 *  use findRunArtifact instead. */
export function findLatestRunDir(runsRoot: string, bookId: string): string | null {
  for (const dirName of candidateBookDirs(bookId)) {
    const dirs = runDirsNewestFirst(runsRoot, dirName);
    if (dirs.length > 0) return dirs[0];
  }
  return null;
}
