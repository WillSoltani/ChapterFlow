/**
 * Role workspaces (IMP-00 item 3) — temporary directories containing ONLY the
 * files a role is authorized to see, with a hashed manifest and crash-safe
 * bounded cleanup.
 *
 * This is the MECHANISM package: IMP-00 ships and tests it; IMP-01 (isolated
 * writer fallback) and IMP-08 (technically blind reviewers) wire their roles
 * onto it. Nothing here reads pipeline state — callers pass explicit file
 * contents or source paths, and every path is containment-checked so a
 * workspace can never alias back into the repository via symlink/`..`/absolute
 * tricks (IMP-00 red-team items).
 */

import { chmodSync, copyFileSync, lstatSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { dirname, isAbsolute, join, normalize, resolve, sep } from "path";

import { sha256Hex } from "../contracts/contractUtil.js";
import type { WorkspaceFileV1 } from "../contracts/effectiveContext.js";

export type WorkspaceInputFile = {
  /** Path INSIDE the workspace. Relative, no `..`, no absolute, no null bytes. */
  relPath: string;
  /** Exactly one of content/sourcePath. */
  content?: string | Buffer;
  /** Copy from this path; symlinks are REJECTED (lstat, not stat). */
  sourcePath?: string;
};

export type RoleWorkspace = {
  dir: string;
  files: WorkspaceFileV1[];
  cleanup: () => void;
};

const WORKSPACE_PREFIX = "cf-exec-";

export function assertSafeRelPath(relPath: string): void {
  if (relPath.length === 0) throw new Error("workspace file: empty relPath");
  if (relPath.includes("\0")) throw new Error(`workspace file: null byte in relPath`);
  if (isAbsolute(relPath)) throw new Error(`workspace file: absolute relPath rejected: ${relPath}`);
  const norm = normalize(relPath);
  if (norm === ".." || norm.startsWith(`..${sep}`) || norm.split(sep).includes("..")) {
    throw new Error(`workspace file: parent-escape relPath rejected: ${relPath}`);
  }
}

/** Build one role workspace under `baseDir` (default os tmpdir). 0700 dir. */
export function buildRoleWorkspace(opts: {
  label: string;
  files: WorkspaceInputFile[];
  baseDir?: string;
}): RoleWorkspace {
  const base = opts.baseDir ?? tmpdir();
  mkdirSync(base, { recursive: true });
  const dir = mkdtempSync(join(base, `${WORKSPACE_PREFIX}${opts.label.replace(/[^a-zA-Z0-9._-]/g, "_")}-`));
  chmodSync(dir, 0o700);
  const manifest: WorkspaceFileV1[] = [];
  try {
    for (const f of opts.files) {
      assertSafeRelPath(f.relPath);
      if ((f.content === undefined) === (f.sourcePath === undefined)) {
        throw new Error(`workspace file ${f.relPath}: exactly one of content/sourcePath required`);
      }
      const dest = resolve(dir, f.relPath);
      if (!dest.startsWith(dir + sep)) throw new Error(`workspace file ${f.relPath}: resolved outside the workspace`);
      mkdirSync(dirname(dest), { recursive: true });
      if (f.sourcePath !== undefined) {
        const st = lstatSync(f.sourcePath);
        if (st.isSymbolicLink()) throw new Error(`workspace file ${f.relPath}: symlink source rejected (${f.sourcePath})`);
        if (!st.isFile()) throw new Error(`workspace file ${f.relPath}: source is not a regular file (${f.sourcePath})`);
        copyFileSync(f.sourcePath, dest);
      } else {
        writeFileSync(dest, f.content as string | Buffer);
      }
      const bytes = statSync(dest).size;
      manifest.push({ relPath: f.relPath, sha256: sha256Hex(readFileSync(dest)), bytes });
    }
  } catch (err) {
    // Partial build must not leave debris behind.
    try { rmSync(dir, { recursive: true, force: true }); } catch { /* best-effort */ }
    throw err;
  }
  // Byte-wise ordering, NOT localeCompare: manifests must serialize identically
  // on every machine regardless of the host locale (reproducibility evidence).
  manifest.sort((a, b) => (a.relPath < b.relPath ? -1 : a.relPath > b.relPath ? 1 : 0));
  return {
    dir,
    files: manifest,
    cleanup: () => { try { rmSync(dir, { recursive: true, force: true }); } catch { /* best-effort */ } },
  };
}

/** Walk a workspace and return any entry that is not in the expected set —
 *  used at spawn time ("an unexpected nested instruction file appears after
 *  workspace construction" red-team case) and post-run for read-only roles. */
export function unexpectedWorkspaceEntries(dir: string, expectedRelPaths: readonly string[]): string[] {
  const expected = new Set(expectedRelPaths.map((p) => normalize(p)));
  const found: string[] = [];
  const walk = (rel: string): void => {
    for (const entry of readdirSync(join(dir, rel), { withFileTypes: true })) {
      const relPath = rel === "" ? entry.name : join(rel, entry.name);
      if (entry.isDirectory()) {
        walk(relPath);
      } else if (!expected.has(normalize(relPath))) {
        found.push(relPath);
      }
    }
  };
  walk("");
  return found.sort();
}

/** Bounded crash-safe cleanup: remove stale cf-exec-* dirs older than the
 *  threshold. Runs opportunistically (next spawn) and via the operator verb —
 *  a crashed conductor can therefore never grow tmp unboundedly, and copied
 *  auth material never outlives the sweep threshold (IMP-00 item 14). */
export function sweepStaleExecDirs(opts: { baseDir?: string; olderThanMs?: number; now?: number }): string[] {
  const base = opts.baseDir ?? tmpdir();
  const threshold = opts.olderThanMs ?? 6 * 60 * 60 * 1000; // 6h default
  const now = opts.now ?? Date.now();
  const removed: string[] = [];
  let entries: string[] = [];
  try { entries = readdirSync(base); } catch { return removed; }
  for (const name of entries) {
    if (!name.startsWith(WORKSPACE_PREFIX)) continue;
    const full = join(base, name);
    try {
      const st = lstatSync(full);
      if (!st.isDirectory()) continue;
      if (now - st.mtimeMs < threshold) continue;
      rmSync(full, { recursive: true, force: true });
      removed.push(full);
    } catch { /* contended/gone — skip */ }
  }
  return removed;
}
