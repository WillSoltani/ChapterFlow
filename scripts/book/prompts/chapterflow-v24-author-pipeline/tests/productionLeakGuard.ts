/**
 * IMP-12 item 2 — the production-root leak detector.
 *
 * The suite's hermeticity is ENFORCED, not asserted: tests/run.ts snapshots
 * every production root before any test file loads and re-walks them after the
 * last result — any added, removed, or modified entry fails the run with the
 * exact paths. The manifest is a fast stat walk (path → size:mtimeMs for
 * files, "dir" for directories), so a full guard cycle over the ~5k-file gold
 * corpus costs ~1s and never reads file bodies (the user's ~/.codex contents
 * are stat'd, never opened).
 *
 * Guarded roots:
 *   - <pipeline>/state          — the tracked gold corpus + gitignored state
 *   - <pipeline>/logs           — exec/session logs
 *   - <pipeline>/.attempts      — production attempt workspaces (IMP-01)
 *   - <repo-root>/state         — the FORBIDDEN shadow state dir
 *   - $HOME/.codex              — the user's real Codex home (tests may READ
 *                                 auth for envelope copies; never write)
 *
 * Reads are invisible to the manifest (mtime moves on writes only) — that is
 * deliberate: read-only use of the gold corpus (xenv tests) is legitimate.
 */

import { readdirSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PIPELINE_DIR = resolve(__dirname, "..");
// scripts/book/prompts/chapterflow-v24-author-pipeline → four levels up.
const REPO_ROOT = resolve(PIPELINE_DIR, "..", "..", "..", "..");

export type RootManifest = Record<string, string>;
export type LeakReport = { root: string; added: string[]; removed: string[]; changed: string[] };

/** Every root the pipeline can write — enumerated for documentation and the
 *  guard's own tests. `diffable: false` roots are NOT diffed by the runner: the
 *  user's ~/.codex legitimately churns from any live Codex session and reads for
 *  envelope auth-copies are expected, so a before/after diff there is inherently
 *  environment-flaky; the auth-copy safety invariant is pinned by
 *  tests/exec-envelope.test.ts instead. */
export function guardedProductionRoots(): Array<{ name: string; path: string; diffable: boolean }> {
  return [
    { name: "pipeline-state", path: join(PIPELINE_DIR, "state"), diffable: true },
    { name: "pipeline-logs", path: join(PIPELINE_DIR, "logs"), diffable: true },
    { name: "pipeline-attempts", path: join(PIPELINE_DIR, ".attempts"), diffable: true },
    { name: "repo-root-state (forbidden shadow)", path: join(REPO_ROOT, "state"), diffable: true },
    { name: "user-codex-home", path: join(homedir(), ".codex"), diffable: false },
  ];
}

/** Stat-walk one root into a manifest. A missing root is an empty manifest
 *  (its later APPEARANCE is then a reported leak). */
export function walkRootManifest(root: string): RootManifest {
  const out: RootManifest = {};
  const walk = (dir: string, rel: string): void => {
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return; // root (or subdir) absent/unreadable — recorded as empty
    }
    for (const entry of entries) {
      const abs = join(dir, entry.name);
      const relPath = rel ? `${rel}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        out[relPath] = "dir";
        walk(abs, relPath);
      } else if (entry.isFile()) {
        try {
          const s = statSync(abs);
          out[relPath] = `${s.size}:${Math.round(s.mtimeMs)}`;
        } catch { /* raced deletion — treated as absent in this snapshot */ }
      }
    }
  };
  walk(root, "");
  return out;
}

export function diffRootManifests(before: RootManifest, after: RootManifest): { added: string[]; removed: string[]; changed: string[] } {
  const added: string[] = [];
  const removed: string[] = [];
  const changed: string[] = [];
  for (const key of Object.keys(after)) {
    if (!(key in before)) added.push(key);
    else if (before[key] !== after[key]) changed.push(key);
  }
  for (const key of Object.keys(before)) {
    if (!(key in after)) removed.push(key);
  }
  return { added: added.sort(), removed: removed.sort(), changed: changed.sort() };
}

export type LeakGuardSnapshot = Array<{ name: string; path: string; manifest: RootManifest }>;

/** Snapshot only the DIFFABLE roots (excludes the noisy user codex home) — this
 *  is what the runner's full guard uses. */
export function snapshotProductionRoots(): LeakGuardSnapshot {
  return guardedProductionRoots().filter((r) => r.diffable).map((r) => ({ name: r.name, path: r.path, manifest: walkRootManifest(r.path) }));
}

/** Re-walk and diff. Empty array = hermetic. */
export function verifyProductionRoots(snapshot: LeakGuardSnapshot): LeakReport[] {
  const reports: LeakReport[] = [];
  for (const { name, path, manifest } of snapshot) {
    const { added, removed, changed } = diffRootManifests(manifest, walkRootManifest(path));
    if (added.length + removed.length + changed.length > 0) {
      reports.push({ root: `${name} (${path})`, added, removed, changed });
    }
  }
  return reports;
}

export function formatLeakReports(reports: LeakReport[]): string {
  const lines: string[] = [];
  for (const r of reports) {
    lines.push(`PRODUCTION-ROOT MUTATION: ${r.root}`);
    for (const p of r.added.slice(0, 20)) lines.push(`  + ${p}`);
    for (const p of r.removed.slice(0, 20)) lines.push(`  - ${p}`);
    for (const p of r.changed.slice(0, 20)) lines.push(`  ~ ${p}`);
    const shown = Math.min(r.added.length, 20) + Math.min(r.removed.length, 20) + Math.min(r.changed.length, 20);
    const total = r.added.length + r.removed.length + r.changed.length;
    if (total > shown) lines.push(`  … and ${total - shown} more`);
  }
  return lines.join("\n");
}
