/**
 * prune-book-state — sweep the working state a publish leaves on disk for an already-PUBLISHED
 * book. Two scopes:
 *   - "all" (DEFAULT, package-only): remove EVERY untracked per-book file under state/ + the
 *     source-sidecar runs cache + stale quarantine reports. The committed package is the sole
 *     survivor; a later re-publish/re-QC of that book needs a full regen (the gates read
 *     state/chapters, which are gone). This is the owner's chosen post-publish policy (2026-06-25):
 *     the web app serves only book-packages/<book>.v21.json, so the local working state is pure
 *     dev-machine residue once a book is live.
 *   - "transient": the older slim sweep — only the heavy intermediate state (key-packs, blind
 *     submissions, authoring cards, prior rounds, the source-sidecar cache), preserving the
 *     authored chapters + QC attestations + the source-verify record for a re-publish without regen.
 *
 * SAFE BY CONSTRUCTION: the plan only ever lists files that git reports as UNTRACKED, so it can
 * never remove a committed/essential artifact — git is the source of truth for what is tracked
 * (the gold corpus, registries, and any --include-state book all stay). If git cannot enumerate
 * tracked files, the plan aborts (removes nothing). The per-book matcher is boundary-safe so a
 * sibling book ("the-willpower-instinct" vs "willpower") is never swept. Top-level shared ledgers
 * (library-state.json, gate-attempts.json, migration-roster.json) live directly in state/ and are
 * excluded by construction (the matcher requires a book-named subdir/sibling/stem).
 */
import { execFileSync } from "child_process";
import { existsSync, readdirSync, rmSync, statSync } from "fs";
import { dirname, relative, resolve } from "path";

import { CANONICAL_STATE, REPO_ROOT, normSlug } from "../lib/chapterPaths.js";
import { sourceVerifyRecordPath } from "../critics/sourceVerify.js";

const BOOK_PACKAGES_DIR = resolve(REPO_ROOT, "book-packages");
const RUNS_ROOT = resolve(REPO_ROOT, ".chapterflow/runs");

/** "all" = package-only (default); "transient" = the slim sweep that keeps chapters + QC + source-verify. */
export type PruneScope = "transient" | "all";

export type PruneBookStatePlan = {
  bookId: string;
  scope: PruneScope;
  status: "ok" | "not-published" | "git-error";
  message: string;
  /** Absolute paths of untracked working-state files to delete. */
  remove: string[];
  /** Absolute paths preserved: git-tracked artifacts (+ the source-verify record under "transient"). */
  keep: string[];
  bytes: number;
};

/** The heavy intermediate working-state roots swept by the "transient" scope. */
function bookStateRoots(bookId: string): string[] {
  return [
    resolve(CANONICAL_STATE, "qc-packs", bookId),
    resolve(CANONICAL_STATE, "qc-orchestrator", bookId),
    resolve(CANONICAL_STATE, "authoring-cards", bookId),
    resolve(RUNS_ROOT, bookId),
  ];
}

/** Stale promote QUARANTINE reports for THIS book (state/books/_blocked/<bookId>.<ts>.report.json).
 *  A blocked promote drops one; after a successful (re)publish it is misleading debris. Matched on
 *  the exact bookId (literal prefix + numeric stamp) so a sibling book's reports are never swept. */
function bookBlockedReports(bookId: string): string[] {
  const dir = resolve(CANONICAL_STATE, "books", "_blocked");
  if (!existsSync(dir)) return [];
  try {
    return readdirSync(dir)
      .filter((f) => {
        if (!f.startsWith(`${bookId}.`) || !f.endsWith(".report.json")) return false;
        return /^\d+$/.test(f.slice(bookId.length + 1, -".report.json".length));
      })
      .map((f) => resolve(dir, f));
  } catch {
    return [];
  }
}

function walk(dir: string, out: string[] = []): string[] {
  if (!existsSync(dir)) return out;
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = resolve(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

/** Conservative, boundary-safe: does an absolute path under state/ belong to bookId? Matches a
 *  book-named directory segment (qc-orchestrator/<book>/…), a <book>-ch<NN> sidecar (chapters/,
 *  per-chapter qc/provenance), or a <book>.<ext> file (name-plans/<book>.json, <book>.sweep.json).
 *  Excludes top-level shared files (a file directly in state/) — those are shared ledgers. Exported
 *  for the collision-safety test. */
export function belongsToBook(absPath: string, bookId: string): boolean {
  const rel = relative(CANONICAL_STATE, absPath);
  if (rel === "" || rel.startsWith("..")) return false; // not under state/
  const segs = rel.split(/[/\\]+/);
  if (segs.length === 1) return false; // a file directly in state/ — a shared ledger, never per-book
  const slug = normSlug(bookId);
  // a directory named after the book anywhere in the path
  for (let i = 0; i < segs.length - 1; i++) if (normSlug(segs[i]) === slug) return true;
  const file = segs[segs.length - 1];
  // a chapter-scoped sidecar: <book>-ch<NN> followed by a separator (covers .v21-native.chapter.json,
  // .manual-keyjudge.json, provenance, etc.). Lazy prefix so "the-X-ch01" never matches book "X".
  const ch = file.match(/^(.+?)-ch\d{1,3}(?=[._-]|$)/i);
  if (ch && normSlug(ch[1]) === slug) return true;
  // a book-named file: the stem up to the first "." equals the book.
  if (normSlug(file.split(".")[0]) === slug) return true;
  return false;
}

/** The candidate file set for a scope (before the untracked filter). */
function candidateFiles(bookId: string, scope: PruneScope): string[] {
  if (scope === "transient") {
    return [...bookStateRoots(bookId).flatMap((r) => walk(r)), ...bookBlockedReports(bookId)];
  }
  // "all": every per-book file under state/, plus the runs cache + stale quarantine reports.
  const all: string[] = [];
  for (const f of walk(CANONICAL_STATE)) if (belongsToBook(f, bookId)) all.push(f);
  all.push(...walk(resolve(RUNS_ROOT, bookId)));
  all.push(...bookBlockedReports(bookId));
  return [...new Set(all)];
}

/** Files git tracks among the given paths (absolute). Throws if git is unavailable. */
function gitTracked(absPaths: string[]): Set<string> {
  const existing = absPaths.filter((p) => existsSync(p)).map((p) => relative(REPO_ROOT, p));
  if (existing.length === 0) return new Set();
  const out = execFileSync("git", ["ls-files", "-z", "--", ...existing], { cwd: REPO_ROOT, encoding: "utf8" });
  return new Set(out.split("\0").filter(Boolean).map((p) => resolve(REPO_ROOT, p)));
}

export function pruneBookStatePlan(bookId: string, scope: PruneScope = "all"): PruneBookStatePlan {
  const pkg = resolve(BOOK_PACKAGES_DIR, `${bookId}.v21.json`);
  let published: boolean;
  let candidates: string[];
  let tracked: Set<string>;
  try {
    published = gitTracked([pkg]).size > 0; // published == the package is COMMITTED
    candidates = published ? candidateFiles(bookId, scope) : [];
    tracked = published ? gitTracked(candidates) : new Set();
  } catch (e) {
    return {
      bookId,
      scope,
      status: "git-error",
      message: `git could not enumerate tracked files (${(e as Error).message}) — aborting to avoid deleting committed state.`,
      remove: [],
      keep: [],
      bytes: 0,
    };
  }
  if (!published) {
    return {
      bookId,
      scope,
      status: "not-published",
      message: `${bookId} is not published: book-packages/${bookId}.v21.json is not committed. prune-book-state only runs on published books (so it never deletes an in-progress book's evidence).`,
      remove: [],
      keep: [],
      bytes: 0,
    };
  }

  // "all" (package-only) keeps NOTHING untracked. "transient" preserves the source-verify record
  // so a re-publish preflight can read it.
  const keepAlways = scope === "all" ? new Set<string>() : new Set<string>([resolve(sourceVerifyRecordPath(bookId))]);
  const remove: string[] = [];
  const keep: string[] = [];
  let bytes = 0;
  for (const f of candidates) {
    if (tracked.has(f) || keepAlways.has(f)) {
      keep.push(f);
      continue;
    }
    remove.push(f);
    try {
      bytes += statSync(f).size;
    } catch {
      /* file vanished mid-scan — ignore */
    }
  }
  for (const k of keepAlways) if (existsSync(k) && !keep.includes(k)) keep.push(k);
  return { bookId, scope, status: "ok", message: "", remove: remove.sort(), keep: keep.sort(), bytes };
}

function removeEmptyDirs(dir: string): void {
  if (!existsSync(dir)) return;
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory()) removeEmptyDirs(resolve(dir, e.name));
  }
  try {
    // recursive:true is required to remove a directory (even an empty one); we only call it once the
    // dir is empty, so this never deletes a kept (e.g. tracked-audit, or another book's) subtree.
    if (readdirSync(dir).length === 0) rmSync(dir, { force: true, recursive: true });
  } catch {
    /* not empty / race — leave it */
  }
}

/** Delete the plan's files (only call on a status:"ok" plan). Idempotent. */
export function applyPruneBookState(plan: PruneBookStatePlan): { removed: number; bytes: number } {
  if (plan.status !== "ok") return { removed: 0, bytes: 0 };
  let removed = 0;
  for (const f of plan.remove) {
    try {
      if (existsSync(f)) {
        rmSync(f, { force: true });
        removed++;
      }
    } catch {
      /* ignore individual failures */
    }
  }
  // Clean any directory the prune emptied (a book-named subdir), deepest first. A shared dir that
  // still holds another book's files survives — removeEmptyDirs only deletes a dir once it is empty.
  const dirs = new Set<string>(plan.remove.map((f) => dirname(f)));
  for (const root of bookStateRoots(plan.bookId)) dirs.add(root);
  for (const d of [...dirs].sort((a, b) => b.length - a.length)) removeEmptyDirs(d);
  return { removed, bytes: plan.bytes };
}

const MB = 1024 * 1024;

export function formatPruneBookState(plan: PruneBookStatePlan, applied = false): string {
  const L: string[] = [`prune-book-state — ${plan.bookId}  [${(plan.scope ?? "transient") === "all" ? "package-only" : "transient"}]`];
  if (plan.status !== "ok") {
    L.push(`  ${plan.status === "not-published" ? "SKIP" : "ABORT"}: ${plan.message}`);
    return L.join("\n");
  }
  // group the remove list by category for a readable summary
  const cat = (p: string): string => {
    const rel = relative(REPO_ROOT, p);
    if (rel.includes("qc-packs/")) return "qc-packs (key-packs + blind derivations)";
    if (rel.includes("qc-orchestrator/")) return "qc-orchestrator (submissions, blind packs, prior rounds)";
    if (rel.includes("authoring-cards/")) return "authoring-cards";
    if (rel.includes(".chapterflow/runs/")) return "source-sidecar evidence cache";
    if (rel.includes("books/_blocked/")) return "stale quarantine report(s)";
    if (rel.includes("/state/chapters/")) return "authored chapters";
    if (rel.includes("/state/qc/") || rel.includes("qc-rounds/")) return "QC attestations + round records";
    if (rel.includes("provenance/")) return "author provenance";
    if (rel.includes("autopilot-logs/")) return "run logs";
    if (rel.includes("-plans/") || rel.includes("/plans/") || rel.includes("/indexes/") || rel.includes("/briefs/")) return "planning artifacts";
    return "other working state";
  };
  const byCat = new Map<string, number>();
  for (const f of plan.remove) byCat.set(cat(f), (byCat.get(cat(f)) ?? 0) + 1);
  L.push(`  ${applied ? "removed" : "would remove"} ${plan.remove.length} untracked file(s)  (~${(plan.bytes / MB).toFixed(1)} MB):`);
  for (const [c, n] of [...byCat.entries()].sort()) L.push(`    ${String(n).padStart(4)}  ${c}`);
  if ((plan.scope ?? "transient") === "all") {
    L.push(`  keeping ${plan.keep.length} file(s): the committed package + any git-tracked artifacts (ALL untracked working state removed — re-publish needs a regen).`);
  } else {
    L.push(`  keeping ${plan.keep.length} essential file(s): the committed package/chapters/QC attestations/round audit (git-tracked) + the source-verify record.`);
  }
  if (!applied) L.push(`  (dry-run) pass --apply to delete. Nothing was removed.`);
  return L.join("\n");
}
