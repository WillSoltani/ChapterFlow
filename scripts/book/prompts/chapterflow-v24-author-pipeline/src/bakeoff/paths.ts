/**
 * Model bake-off — path conventions + hashing helpers.
 *
 * Everything a bake-off writes before promotion lives under ONE isolated root:
 *
 *   state/model-bakeoffs/<bookId>/<runId>/
 *     manifest.json                 — the run's single source of truth (resume)
 *     shared-inputs/                — immutable draft copy + frozen-input record
 *     work/<slot>/chapters/         — candidate generation slots (opaque w1/w2/w3;
 *                                     the ONLY candidate token an author prompt sees)
 *     work/<slot>/provenance/       — slot-local author provenance (never canonical)
 *     work/<slot>/lead-overrides/   — slot-local F-1 sidecars (never shared)
 *     candidates/<modelSlug>/       — generation + validation metadata
 *     v4-books/<bookId>/candidates/ — immutable CandidateStore content
 *     reviews/<label>/              — blinded review docs + persisted reviews
 *     selection/selection.json      — the global decision
 *     report.json / report.md       — the permanent comparison report
 *
 * Canonical trees, current pointer, book packages, and web registries are never
 * touched by this screening-only route.
 */

import { createHash } from "crypto";
import { readFileSync } from "fs";
import { relative, resolve } from "path";

import { normSlug } from "../lib/chapterPaths.js";

// state/ root shared with the rest of the pipeline (lib/chapterPaths.CANONICAL_STATE
// resolves the same way; recomputed here to avoid importing the shadow-guard side
// effects into pure path helpers).
const __dirnameLocal = new URL(".", import.meta.url).pathname;
export const PIPELINE_DIR = resolve(__dirnameLocal, "../..");

export function bakeoffBookRoot(bookId: string, stateRoot?: string): string {
  return resolve(stateRoot ?? resolve(PIPELINE_DIR, "state"), "model-bakeoffs", normSlug(bookId));
}

export function bakeoffRunRoot(bookId: string, runId: string, stateRoot?: string): string {
  return resolve(bakeoffBookRoot(bookId, stateRoot), runId);
}

export type BakeoffRoots = {
  runRoot: string;
  manifestPath: string;
  sharedInputsDir: string;
  workDir: string;
  candidatesDir: string;
  v4BooksRoot: string;
  reviewsDir: string;
  selectionDir: string;
  reportJsonPath: string;
  reportMdPath: string;
};

export function bakeoffRoots(bookId: string, runId: string, stateRoot?: string): BakeoffRoots {
  const runRoot = bakeoffRunRoot(bookId, runId, stateRoot);
  return {
    runRoot,
    manifestPath: resolve(runRoot, "manifest.json"),
    sharedInputsDir: resolve(runRoot, "shared-inputs"),
    workDir: resolve(runRoot, "work"),
    candidatesDir: resolve(runRoot, "candidates"),
    v4BooksRoot: resolve(runRoot, "v4-books"),
    reviewsDir: resolve(runRoot, "reviews"),
    selectionDir: resolve(runRoot, "selection"),
    reportJsonPath: resolve(runRoot, "report.json"),
    reportMdPath: resolve(runRoot, "report.md"),
  };
}

/** The opaque per-candidate generation slot dir (work/<slot>). */
export function slotDir(roots: BakeoffRoots, slot: string): string {
  return resolve(roots.workDir, slot);
}

export function slotChaptersDir(roots: BakeoffRoots, slot: string): string {
  return resolve(slotDir(roots, slot), "chapters");
}

/** The durable per-model candidate dir (candidates/<modelSlug>). */
export function candidateDir(roots: BakeoffRoots, modelSlug: string): string {
  return resolve(roots.candidatesDir, modelSlug);
}

/** Pipeline-relative path (forward slashes) — what goes into prompts/CLI args. */
export function pipelineRel(absPath: string): string {
  return relative(PIPELINE_DIR, absPath).split("\\").join("/");
}

/** Filesystem-safe slug for a model id ("gpt-5.6-sol" → "gpt-5-6-sol"). */
export function modelSlug(model: string): string {
  return model.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

// ── Hashing ───────────────────────────────────────────────────────────────────

export function sha256Hex(data: string | Buffer): string {
  return createHash("sha256").update(data).digest("hex");
}

export function sha256File(absPath: string): string {
  return sha256Hex(readFileSync(absPath));
}

/** Combined content identity over a list of (relPath, sha256) pairs — order-
 *  independent (sorted by relPath) so directory walk order can't change it. */
export function combineHashes(files: Array<{ relPath: string; sha256: string }>): string {
  const lines = files
    .slice()
    .sort((a, b) => a.relPath.localeCompare(b.relPath))
    .map((f) => `${f.relPath}\t${f.sha256}`);
  return sha256Hex(lines.join("\n"));
}
