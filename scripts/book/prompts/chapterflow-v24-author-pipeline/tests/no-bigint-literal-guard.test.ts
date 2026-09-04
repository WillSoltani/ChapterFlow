/**
 * Static guard: no BigInt literal syntax (`123n`) anywhere in the pipeline
 * source the repo-root TypeScript project compiles.
 *
 * The pipeline's own tsconfig targets ES2022 so a BigInt literal typechecks
 * fine here — but the repo-root `tsc -p tsconfig.book.json` (which pulls in
 * `scripts/book/**`) targets a lower ES version and fails hard on TS2737
 * ("BigInt literals are not available when targeting lower than ES2020").
 * That mismatch put `chosen.add(Number((seed + BigInt(i) * <literal>) %
 * modulus))` in catalogRubric.ts's selectSeededChapterIndexes — the
 * md5-seeded chapter-selection walk ported from score.py's select_idxs —
 * and turned the root "v21 Pipeline Typecheck + Tests" CI job red on main.
 *
 * `BigInt(2654435761)` is the identical BigInt value to the literal form and
 * works under any target, so the fix is always a rewrite, never a tsconfig
 * change. This test pins that.
 *
 * Scope: the guard mirrors tsconfig.book.json itself — it reads that file's
 * `include` extensions and `exclude` patterns and walks the whole pipeline
 * directory (src, tests, config, root-level `.mts` entrypoints), not just
 * `src/`, because the root compile does the same. Scanning only `src/` would
 * let the literal reappear in a test helper or a root `.mts` script and turn
 * CI red again.
 */

import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { extname, join, relative, resolve, sep } from "node:path";

import { test } from "./harness.js";
import { PIPELINE_DIR } from "./helpers.js";

const REPO_ROOT = resolve(PIPELINE_DIR, "..", "..", "..", "..");
const TSCONFIG_BOOK = join(REPO_ROOT, "tsconfig.book.json");

/** This file spells the offending syntax in prose, so it is the one file the
 *  scan skips. */
const SELF = join(PIPELINE_DIR, "tests", "no-bigint-literal-guard.test.ts");

type BookProject = { include?: string[]; exclude?: string[] };

function readBookProject(): BookProject {
  return JSON.parse(readFileSync(TSCONFIG_BOOK, "utf8")) as BookProject;
}

/** Extensions the root project compiles, derived from its `include` globs. */
function includedExtensions(project: BookProject): Set<string> {
  const exts = new Set<string>();
  for (const pattern of project.include ?? []) {
    const ext = extname(pattern);
    if (ext) exts.add(ext);
  }
  return exts;
}

/** Turn a tsconfig exclude entry into a regex over repo-relative POSIX
 *  paths. `**` spans directories, `*` stops at a separator, and a pattern
 *  with no wildcard also excludes everything beneath it (tsconfig
 *  semantics), which is how the bare `node_modules` entry works. */
function excludeMatchers(project: BookProject): RegExp[] {
  // Placeholders for the two-step glob translation; neither can occur in a path.
  const DOUBLE_STAR_SLASH = "\u0000";
  const DOUBLE_STAR = "\u0001";
  return (project.exclude ?? []).map((pattern) => {
    const escaped = pattern
      .replace(/[.+^${}()|[\]\\]/g, "\\$&")
      .replace(/\*\*\//g, DOUBLE_STAR_SLASH)
      .replace(/\*\*/g, DOUBLE_STAR)
      .replace(/\*/g, "[^/]*")
      .split(DOUBLE_STAR_SLASH)
      .join("(?:.*/)?")
      .split(DOUBLE_STAR)
      .join(".*");
    return new RegExp(`^${escaped}(?:/.*)?$`);
  });
}

function toRepoRelative(absolute: string): string {
  return relative(REPO_ROOT, absolute).split(sep).join("/");
}

function listCompiledFiles(dir: string, exts: Set<string>, excludes: RegExp[]): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const rel = toRepoRelative(full);
    if (entry === "node_modules" || excludes.some((re) => re.test(rel))) continue;
    const stat = statSync(full, { throwIfNoEntry: false });
    if (!stat) continue;
    if (stat.isDirectory()) {
      out.push(...listCompiledFiles(full, exts, excludes));
    } else if (exts.has(extname(entry)) && full !== SELF) {
      out.push(full);
    }
  }
  return out;
}

/** Strip block and line comments so the scan never flags a literal that only
 *  appears in prose. Not a full tokenizer — it doesn't special-case string
 *  contents — but the pipeline has no legitimate reason to spell a bare
 *  numeric BigInt suffix inside a string either, so a hit there is worth
 *  surfacing and rewriting by hand. */
function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .map((line) => line.replace(/\/\/.*$/, ""))
    .join("\n");
}

test("no BigInt literal syntax anywhere the root tsconfig.book.json compiles — that project targets below ES2020", () => {
  const project = readBookProject();
  const exts = includedExtensions(project);
  assert.ok(exts.has(".ts") && exts.has(".mts"), "tsconfig.book.json should include .ts and .mts sources");

  const files = listCompiledFiles(PIPELINE_DIR, exts, excludeMatchers(project));
  assert.ok(files.length > 500, `expected the pipeline scan to reach the whole tree, saw ${files.length} files`);

  const offenders: string[] = [];
  for (const file of files) {
    const matches = stripComments(readFileSync(file, "utf8")).match(/\b[0-9][0-9_]*n\b/g);
    if (matches) offenders.push(`${relative(PIPELINE_DIR, file)}: ${matches.join(", ")}`);
  }
  assert.deepEqual(
    offenders,
    [],
    `BigInt literal syntax found (use BigInt(...) instead — the repo-root tsc targets below ES2020):\n${offenders.join("\n")}`,
  );
});
