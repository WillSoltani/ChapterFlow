/**
 * Deterministic build-input fingerprints for the production package manifest (v2).
 *
 * The v1 manifest recorded the prompt/config/code provenance as STATIC string
 * labels ("chapterflow-v21-authored-prompts-v1", …). A label proves nothing: it
 * never changes when the bytes it names change, so two packages produced from
 * materially different prompts, config, or code carried an identical label and
 * an identical identity. v2 replaces each label with a content fingerprint over
 * the ACTUAL files that fed the build, so the package's identity moves whenever
 * a real input moves.
 *
 * A fingerprint is the sha256 of the canonical JSON of a deterministically
 * SORTED list of `{ path, sha256(content) }` entries — one per input file. The
 * properties this gives:
 *
 *   - DETERMINISTIC: paths are sorted; the same files in any filesystem-read
 *     order produce the same bundle hash.
 *   - CHECKOUT-INDEPENDENT: every entry's `path` is a LOGICAL path with a fixed
 *     prefix (e.g. "src/promoteBook.ts", "config/name-bank.json",
 *     "package-lock.json"), never an absolute machine path. The same content in
 *     a different checkout directory hashes identically (requirement 10).
 *   - NO FORBIDDEN INPUTS: only tracked source/config/prompt bytes and package
 *     metadata enter the hash. No timestamps, no absolute paths, no secrets, no
 *     temporary files, and no generated state (state/, .chapterflow/runs,
 *     scratch/) are read (requirement 7).
 *
 * WHICH FILES ENTER EACH BUNDLE — the explicit, audited definition
 * (requirement 6; mirrored in docs/production-manifest-v2-fingerprints.md):
 *
 *   prompt bundle  — every *.md under agent-prompts/ (the live authoring "law")
 *                    and prompts/ (the modular system prompts), recursive.
 *   config bundle  — every *.json under config/ EXCEPT *.schema.json (validators,
 *                    not generation inputs) and source-reality-legacy-exemptions
 *                    .json (an operational registry already bound, per book, by
 *                    the source-reality evidence — binding it here too would make
 *                    every package's identity churn on an unrelated exemption edit).
 *   code fingerprint — every *.ts under src/ EXCEPT src/scratch/** (throwaway
 *                    experiments), plus the pipeline package.json and the
 *                    repo-root package-lock.json (the dependency lock).
 *
 * The file SET is part of the fingerprint: adding or removing a relevant file
 * changes the bundle hash, not only editing an existing one.
 */

import { createHash } from "crypto";
import { existsSync, readFileSync, readdirSync, statSync } from "fs";
import { basename, dirname, relative, resolve, sep } from "path";
import { fileURLToPath } from "url";

import { REPO_ROOT } from "./chapterPaths.js";
import { canonicalJsonSha256 } from "./canonicalJson.js";

const SRC_LIB_DIR = dirname(fileURLToPath(import.meta.url));
/** .../scripts/book/prompts/chapterflow-v21-authored */
const PIPELINE_DIR = resolve(SRC_LIB_DIR, "..", "..");

export const PIPELINE_FINGERPRINT_ALGORITHM = "pipeline-fingerprint-bundle-sha256-v1" as const;

export type FingerprintFileEntry = {
  /** Logical, checkout-independent path with a fixed prefix (e.g. "src/cli.ts"). */
  path: string;
  /** sha256 of the file's raw content bytes. */
  sha256: string;
};

export type PipelineFingerprint = {
  algorithm: typeof PIPELINE_FINGERPRINT_ALGORITHM;
  /** sha256 over the canonical JSON of the sorted `files` list. */
  bundleHash: string;
  fileCount: number;
  files: FingerprintFileEntry[];
};

export type FingerprintResult =
  | { ok: true; fingerprint: PipelineFingerprint }
  | { ok: false; error: string };

export type PipelineFingerprints = {
  promptBundle: PipelineFingerprint;
  configBundle: PipelineFingerprint;
  codeFingerprint: PipelineFingerprint;
};

export type PipelineFingerprintsResult =
  | { ok: true; fingerprints: PipelineFingerprints }
  | { ok: false; errors: string[] };

/**
 * Roots override — production passes nothing and the real pipeline dirs are
 * used. Tests point each bundle at a small fixture tree so a single mutated
 * file can be observed to move the bundle hash WITHOUT touching the real tree.
 * Logical path prefixes stay fixed regardless of the absolute override dir, so
 * fixtures still prove checkout-independence.
 */
export type FingerprintRoots = {
  /** Replace the default prompt dirs entirely. */
  promptDirs?: Array<{ prefix: string; dir: string; match?: RegExp }>;
  /** Replace the default config dir. */
  configDir?: string;
  /** Replace the default `src/` dir. */
  codeSrcDir?: string;
  /** Replace the default pipeline package.json path. */
  packageJsonPath?: string;
  /** Replace the default repo-root package-lock.json path. */
  lockfilePath?: string;
};

type ResolvedInputFile = { logicalPath: string; absPath: string };

const DEFAULT_PROMPT_DIRS: Array<{ prefix: string; dir: string; match: RegExp }> = [
  { prefix: "agent-prompts", dir: resolve(PIPELINE_DIR, "agent-prompts"), match: /\.md$/i },
  { prefix: "prompts", dir: resolve(PIPELINE_DIR, "prompts"), match: /\.md$/i },
];
const DEFAULT_CONFIG_DIR = resolve(PIPELINE_DIR, "config");
const DEFAULT_CODE_SRC_DIR = resolve(PIPELINE_DIR, "src");
const DEFAULT_PACKAGE_JSON = resolve(PIPELINE_DIR, "package.json");
const DEFAULT_LOCKFILE = resolve(REPO_ROOT, "package-lock.json");

const CONFIG_MATCH = /\.json$/i;
const CODE_MATCH = /\.ts$/i;

/** Config files that are NOT generation inputs and are excluded from the config bundle. */
function isExcludedConfigFile(name: string): boolean {
  return /\.schema\.json$/i.test(name) || name === "source-reality-legacy-exemptions.json";
}

function toLogical(prefix: string, baseDir: string, absPath: string): string {
  const rel = relative(baseDir, absPath).split(sep).join("/");
  return prefix ? `${prefix}/${rel}` : rel;
}

function walkFiles(
  rootDir: string,
  opts: { match: RegExp; skipDirRel?: (relDir: string) => boolean },
): string[] {
  const out: string[] = [];
  const visit = (absDir: string, relDir: string): void => {
    let names: string[];
    try {
      names = readdirSync(absDir);
    } catch {
      return;
    }
    for (const name of names) {
      const abs = resolve(absDir, name);
      const rel = relDir ? `${relDir}/${name}` : name;
      let st: ReturnType<typeof statSync>;
      try {
        st = statSync(abs);
      } catch {
        continue;
      }
      if (st.isDirectory()) {
        if (opts.skipDirRel && opts.skipDirRel(rel)) continue;
        visit(abs, rel);
      } else if (st.isFile() && opts.match.test(name)) {
        out.push(abs);
      }
    }
  };
  visit(rootDir, "");
  return out;
}

export function resolvePromptBundleFiles(roots: FingerprintRoots = {}): ResolvedInputFile[] {
  const dirs = roots.promptDirs ?? DEFAULT_PROMPT_DIRS;
  const files: ResolvedInputFile[] = [];
  for (const d of dirs) {
    const match = d.match ?? /\.md$/i;
    for (const abs of walkFiles(d.dir, { match })) {
      files.push({ logicalPath: toLogical(d.prefix, d.dir, abs), absPath: abs });
    }
  }
  return files;
}

export function resolveConfigBundleFiles(roots: FingerprintRoots = {}): ResolvedInputFile[] {
  const dir = roots.configDir ?? DEFAULT_CONFIG_DIR;
  const files: ResolvedInputFile[] = [];
  for (const abs of walkFiles(dir, { match: CONFIG_MATCH })) {
    if (isExcludedConfigFile(basename(abs))) continue;
    files.push({ logicalPath: toLogical("config", dir, abs), absPath: abs });
  }
  return files;
}

export function resolveCodeFingerprintFiles(roots: FingerprintRoots = {}): ResolvedInputFile[] {
  const srcDir = roots.codeSrcDir ?? DEFAULT_CODE_SRC_DIR;
  const pkgPath = roots.packageJsonPath ?? DEFAULT_PACKAGE_JSON;
  const lockPath = roots.lockfilePath ?? DEFAULT_LOCKFILE;
  const files: ResolvedInputFile[] = [];
  for (const abs of walkFiles(srcDir, {
    match: CODE_MATCH,
    skipDirRel: (rel) => rel === "scratch" || rel.startsWith("scratch/"),
  })) {
    files.push({ logicalPath: toLogical("src", srcDir, abs), absPath: abs });
  }
  files.push({ logicalPath: "package.json", absPath: pkgPath });
  files.push({ logicalPath: "package-lock.json", absPath: lockPath });
  return files;
}

function sha256OfFileContent(absPath: string): string {
  return `sha256:${createHash("sha256").update(readFileSync(absPath)).digest("hex")}`;
}

/** Hash a resolved file set into one bundle fingerprint. Fails closed when a
 *  declared input is missing or a logical path collides — a fingerprint that
 *  silently dropped a missing input would be a false identity. */
export function computeFingerprintFromFiles(files: ResolvedInputFile[], bundleLabel: string): FingerprintResult {
  const entries: FingerprintFileEntry[] = [];
  const seen = new Set<string>();
  for (const f of files) {
    if (seen.has(f.logicalPath)) {
      return { ok: false, error: `${bundleLabel}: duplicate logical path "${f.logicalPath}".` };
    }
    seen.add(f.logicalPath);
    if (!existsSync(f.absPath)) {
      return { ok: false, error: `${bundleLabel}: declared input file is missing (${f.logicalPath}).` };
    }
    let sha256: string;
    try {
      sha256 = sha256OfFileContent(f.absPath);
    } catch (err) {
      return { ok: false, error: `${bundleLabel}: cannot read input file ${f.logicalPath}: ${(err as Error).message}` };
    }
    entries.push({ path: f.logicalPath, sha256 });
  }
  if (entries.length === 0) {
    return { ok: false, error: `${bundleLabel}: no input files matched — refusing to fingerprint an empty set.` };
  }
  entries.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  const bundleHash = canonicalJsonSha256({ algorithm: PIPELINE_FINGERPRINT_ALGORITHM, files: entries });
  return {
    ok: true,
    fingerprint: { algorithm: PIPELINE_FINGERPRINT_ALGORITHM, bundleHash, fileCount: entries.length, files: entries },
  };
}

export function buildPromptBundleFingerprint(roots: FingerprintRoots = {}): FingerprintResult {
  return computeFingerprintFromFiles(resolvePromptBundleFiles(roots), "prompt bundle");
}

export function buildConfigBundleFingerprint(roots: FingerprintRoots = {}): FingerprintResult {
  return computeFingerprintFromFiles(resolveConfigBundleFiles(roots), "config bundle");
}

export function buildCodeFingerprint(roots: FingerprintRoots = {}): FingerprintResult {
  return computeFingerprintFromFiles(resolveCodeFingerprintFiles(roots), "code fingerprint");
}

/** Compute all three build-input fingerprints; fails closed if any is unbuildable. */
export function buildPipelineFingerprints(roots: FingerprintRoots = {}): PipelineFingerprintsResult {
  const prompt = buildPromptBundleFingerprint(roots);
  const config = buildConfigBundleFingerprint(roots);
  const code = buildCodeFingerprint(roots);
  const errors: string[] = [];
  if (!prompt.ok) errors.push(prompt.error);
  if (!config.ok) errors.push(config.error);
  if (!code.ok) errors.push(code.error);
  if (errors.length > 0) return { ok: false, errors };
  return {
    ok: true,
    fingerprints: {
      promptBundle: (prompt as { ok: true; fingerprint: PipelineFingerprint }).fingerprint,
      configBundle: (config as { ok: true; fingerprint: PipelineFingerprint }).fingerprint,
      codeFingerprint: (code as { ok: true; fingerprint: PipelineFingerprint }).fingerprint,
    },
  };
}

/** First logical path whose content hash differs between two fingerprints, for
 *  precise verifier diagnostics ("which file moved"). Null when identical. */
export function firstFingerprintFileDelta(
  expected: PipelineFingerprint,
  actual: PipelineFingerprint,
): { path: string; reason: "added" | "removed" | "changed" } | null {
  const expByPath = new Map(expected.files.map((f) => [f.path, f.sha256]));
  const actByPath = new Map(actual.files.map((f) => [f.path, f.sha256]));
  const allPaths = [...new Set([...expByPath.keys(), ...actByPath.keys()])].sort();
  for (const path of allPaths) {
    const e = expByPath.get(path);
    const a = actByPath.get(path);
    if (e === undefined) return { path, reason: "added" };
    if (a === undefined) return { path, reason: "removed" };
    if (e !== a) return { path, reason: "changed" };
  }
  return null;
}
