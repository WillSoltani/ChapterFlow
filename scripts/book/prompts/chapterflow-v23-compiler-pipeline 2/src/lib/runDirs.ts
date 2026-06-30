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
 * findRunArtifact() walks manifest-valid run dirs newest-first across BOTH id
 * spellings and returns the first compatible run that actually contains the
 * requested artifact.
 */

import { existsSync, readdirSync, statSync } from "fs";
import { resolve } from "path";

import { normSlug } from "./chapterPaths.js";
import {
  readResearchRunManifest,
  type ResearchCompatibility,
  type ResearchRunManifest,
  type ResearchRunOverallStatus,
} from "./researchRunManifest.js";

export type RunResolutionRejection = {
  runDir: string;
  reason: string;
};

export type RunResolutionOptions = {
  requiredArtifactRelPath?: string;
  requiredArtifactRelPaths?: string[];
  allowedStatuses?: ResearchRunOverallStatus[];
  inputHash?: string;
  compatibility?: Partial<ResearchCompatibility>;
  expectedChaptersHash?: string;
};

export type RunResolutionResult =
  | {
      ok: true;
      runDir: string;
      manifest: ResearchRunManifest;
      artifacts: Record<string, string>;
      rejected: RunResolutionRejection[];
    }
  | {
      ok: false;
      rejected: RunResolutionRejection[];
    };

const READER_STATUSES: ResearchRunOverallStatus[] = ["complete"];
const WRITER_STATUSES: ResearchRunOverallStatus[] = ["running", "failed", "coherence_failed", "complete"];

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
function allRunDirs(runsRoot: string, bookId: string): Array<{ name: string; path: string }> {
  const runs: Array<{ name: string; path: string }> = [];
  for (const dirName of matchingBookDirs(runsRoot, bookId)) {
    for (const runPath of runDirsNewestFirst(runsRoot, dirName)) {
      runs.push({ name: runPath.split("/").pop() ?? "", path: runPath });
    }
  }
  return runs;
}

export function resolveResearchRun(
  runsRoot: string,
  bookId: string,
  options: RunResolutionOptions = {},
): RunResolutionResult {
  const rejected: RunResolutionRejection[] = [];
  const wantedBookId = normSlug(bookId);
  const requiredArtifacts = [
    ...(options.requiredArtifactRelPath ? [options.requiredArtifactRelPath] : []),
    ...(options.requiredArtifactRelPaths ?? []),
  ];
  const allowedStatuses = new Set(options.allowedStatuses ?? READER_STATUSES);

  const candidates = allRunDirs(runsRoot, wantedBookId)
    .map((candidate) => {
      const parsed = readResearchRunManifest(candidate.path);
      const createdAtMs = parsed.ok ? Date.parse(parsed.manifest.createdAt) : null;
      return {
        ...candidate,
        parsed,
        createdAtMs: Number.isFinite(createdAtMs) ? createdAtMs : null,
      };
    })
    .sort((a, b) => {
      const at = a.createdAtMs ?? -1;
      const bt = b.createdAtMs ?? -1;
      if (at !== bt) return bt - at;
      return a.name < b.name ? 1 : a.name > b.name ? -1 : 0;
    });

  for (const candidate of candidates) {
    if (!candidate.parsed.ok) {
      rejected.push({ runDir: candidate.path, reason: candidate.parsed.errors.join("; ") });
      continue;
    }
    const manifest = candidate.parsed.manifest;
    const reasons = runRejectionReasons(manifest, wantedBookId, allowedStatuses, options);
    if (reasons.length > 0) {
      rejected.push({ runDir: candidate.path, reason: reasons.join("; ") });
      continue;
    }
    const artifacts: Record<string, string> = {};
    const missing = requiredArtifacts.filter((relPath) => {
      const path = resolve(candidate.path, relPath);
      if (!existsSync(path)) return true;
      artifacts[relPath] = path;
      return false;
    });
    if (missing.length > 0) {
      rejected.push({ runDir: candidate.path, reason: `missing artifact(s): ${missing.join(", ")}` });
      continue;
    }
    return { ok: true, runDir: candidate.path, manifest, artifacts, rejected };
  }
  return { ok: false, rejected };
}

/** Absolute path of `relPath` inside the newest manifest-compatible run that
 *  contains it, across every normSlug-equivalent bookId dir spelling. Null
 *  when no compatible run has it. */
export function findRunArtifact(
  runsRoot: string,
  bookId: string,
  relPath: string,
  options: Omit<RunResolutionOptions, "requiredArtifactRelPath" | "requiredArtifactRelPaths"> = {},
): string | null {
  const result = resolveResearchRun(runsRoot, bookId, { ...options, requiredArtifactRelPath: relPath });
  return result.ok ? result.artifacts[relPath] : null;
}

/** The newest run dir regardless of contents — for writers/continuation
 *  (e.g. next-task appends artifacts to the run in progress). Still requires a
 *  valid manifest/bookId so raw directory names cannot define identity. Readers
 *  should use findRunArtifact instead. */
export function findLatestRunDir(
  runsRoot: string,
  bookId: string,
  options: Omit<RunResolutionOptions, "requiredArtifactRelPath" | "requiredArtifactRelPaths"> = {},
): string | null {
  const result = resolveResearchRun(runsRoot, bookId, {
    allowedStatuses: options.allowedStatuses ?? WRITER_STATUSES,
    inputHash: options.inputHash,
    compatibility: options.compatibility,
    expectedChaptersHash: options.expectedChaptersHash,
  });
  return result.ok ? result.runDir : null;
}

function runRejectionReasons(
  manifest: ResearchRunManifest,
  wantedBookId: string,
  allowedStatuses: Set<ResearchRunOverallStatus>,
  options: RunResolutionOptions,
): string[] {
  const reasons: string[] = [];
  if (normSlug(manifest.bookId) !== wantedBookId) reasons.push(`manifest bookId ${manifest.bookId} does not match ${wantedBookId}`);
  if (!allowedStatuses.has(manifest.overallStatus)) reasons.push(`status ${manifest.overallStatus} not allowed`);
  if (options.inputHash && manifest.input.hash !== options.inputHash) reasons.push("input hash changed");
  if (options.expectedChaptersHash && manifest.expectedChaptersHash !== options.expectedChaptersHash) reasons.push("expected chapter set changed");
  if (options.compatibility) {
    for (const key of ["codeVersion", "promptHash", "configHash", "provider", "model"] as const) {
      const expected = options.compatibility[key];
      if (expected !== undefined && manifest.compatibility[key] !== expected) reasons.push(`${key} changed`);
    }
  }
  return reasons;
}
