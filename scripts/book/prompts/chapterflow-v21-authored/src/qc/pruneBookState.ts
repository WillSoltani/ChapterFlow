/**
 * prune-book-state — sweep the large INTERMEDIATE working state a publish leaves on disk
 * for an already-PUBLISHED book, keeping only the essential parts.
 *
 * A publish commits the durable artifacts (book package, web registration, chapters,
 * index, per-chapter QC attestations, and the published round's evidence-matrix /
 * qc-summary / repair-ledger) and a targeted security cleanup strips live reviewer tokens.
 * But it does NOT sweep the generated working state — key-packs + blind derivations,
 * blind submissions, authoring cards, the prior QC rounds, and the source-sidecar evidence
 * cache. Those linger as hundreds of untracked files per book (~7 MB), make the worktree
 * "busy", and fed the index-collision / temp-clone friction the publishes hit.
 *
 * SAFE BY CONSTRUCTION: the plan only ever lists files that git reports as UNTRACKED under
 * the book's working-state dirs, so it can never remove a committed/essential artifact —
 * git is the source of truth for what is tracked. It additionally preserves the
 * source-verify record (a re-publish's preflight reads it). If git cannot enumerate tracked
 * files, the plan aborts (removes nothing) rather than risk deleting committed state.
 *
 * Note: a future re-QC of a pruned book would re-derive keys from scratch (the prior
 * key-packs are gone) — fine, because the published manual-keyjudge records are committed.
 */
import { execFileSync } from "child_process";
import { existsSync, readdirSync, rmSync, statSync } from "fs";
import { relative, resolve } from "path";

import { CANONICAL_STATE, REPO_ROOT } from "../lib/chapterPaths.js";
import { sourceVerifyRecordPath } from "../critics/sourceVerify.js";

const BOOK_PACKAGES_DIR = resolve(REPO_ROOT, "book-packages");
const RUNS_ROOT = resolve(REPO_ROOT, ".chapterflow/runs");

export type PruneBookStatePlan = {
  bookId: string;
  status: "ok" | "not-published" | "git-error";
  message: string;
  /** Absolute paths of untracked working-state files to delete. */
  remove: string[];
  /** Absolute paths preserved: git-tracked artifacts + the source-verify record. */
  keep: string[];
  bytes: number;
};

/** The book's working-state roots (everything a publish leaves behind, scoped to one book). */
function bookStateRoots(bookId: string): string[] {
  return [
    resolve(CANONICAL_STATE, "qc-packs", bookId),
    resolve(CANONICAL_STATE, "qc-orchestrator", bookId),
    resolve(CANONICAL_STATE, "authoring-cards", bookId),
    resolve(RUNS_ROOT, bookId),
  ];
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

/** Files git tracks under the given paths (absolute). Throws if git is unavailable. */
function gitTracked(absPaths: string[]): Set<string> {
  const existing = absPaths.filter((p) => existsSync(p)).map((p) => relative(REPO_ROOT, p));
  if (existing.length === 0) return new Set();
  const out = execFileSync("git", ["ls-files", "-z", "--", ...existing], { cwd: REPO_ROOT, encoding: "utf8" });
  return new Set(out.split("\0").filter(Boolean).map((p) => resolve(REPO_ROOT, p)));
}

export function pruneBookStatePlan(bookId: string): PruneBookStatePlan {
  const pkg = resolve(BOOK_PACKAGES_DIR, `${bookId}.v21.json`);
  let published: boolean;
  let tracked: Set<string>;
  try {
    published = gitTracked([pkg]).size > 0; // published == the package is COMMITTED
    tracked = published ? gitTracked(bookStateRoots(bookId)) : new Set();
  } catch (e) {
    return {
      bookId,
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
      status: "not-published",
      message: `${bookId} is not published: book-packages/${bookId}.v21.json is not committed. prune-book-state only runs on published books (so it never deletes an in-progress book's evidence).`,
      remove: [],
      keep: [],
      bytes: 0,
    };
  }

  const keepAlways = new Set<string>([resolve(sourceVerifyRecordPath(bookId))]);
  const remove: string[] = [];
  const keep: string[] = [];
  let bytes = 0;
  for (const f of bookStateRoots(bookId).flatMap((r) => walk(r))) {
    if (tracked.has(f) || keepAlways.has(f)) {
      keep.push(f);
      continue;
    }
    remove.push(f);
    try {
      bytes += statSync(f).size;
    } catch {
      /* file vanished mid-walk — ignore */
    }
  }
  for (const k of keepAlways) if (existsSync(k) && !keep.includes(k)) keep.push(k);
  return { bookId, status: "ok", message: "", remove: remove.sort(), keep: keep.sort(), bytes };
}

function removeEmptyDirs(dir: string): void {
  if (!existsSync(dir)) return;
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory()) removeEmptyDirs(resolve(dir, e.name));
  }
  try {
    if (readdirSync(dir).length === 0) rmSync(dir, { force: true, recursive: false });
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
  for (const root of bookStateRoots(plan.bookId)) removeEmptyDirs(root);
  return { removed, bytes: plan.bytes };
}

const MB = 1024 * 1024;

export function formatPruneBookState(plan: PruneBookStatePlan, applied = false): string {
  const L: string[] = [`prune-book-state — ${plan.bookId}`];
  if (plan.status !== "ok") {
    L.push(`  ${plan.status === "not-published" ? "SKIP" : "ABORT"}: ${plan.message}`);
    return L.join("\n");
  }
  // group the remove list by top-level category for a readable summary
  const cat = (p: string): string => {
    const rel = relative(REPO_ROOT, p);
    if (rel.includes("qc-packs/")) return "qc-packs (key-packs + blind derivations)";
    if (rel.includes("qc-orchestrator/")) return "qc-orchestrator (submissions, blind packs, prior rounds)";
    if (rel.includes("authoring-cards/")) return "authoring-cards";
    if (rel.includes(".chapterflow/runs/")) return "source-sidecar evidence cache";
    return "other";
  };
  const byCat = new Map<string, number>();
  for (const f of plan.remove) byCat.set(cat(f), (byCat.get(cat(f)) ?? 0) + 1);
  L.push(`  ${applied ? "removed" : "would remove"} ${plan.remove.length} untracked file(s)  (~${(plan.bytes / MB).toFixed(1)} MB):`);
  for (const [c, n] of [...byCat.entries()].sort()) L.push(`    ${String(n).padStart(4)}  ${c}`);
  L.push(`  keeping ${plan.keep.length} essential file(s): the committed package/chapters/QC attestations/round audit (git-tracked) + the source-verify record.`);
  if (!applied) L.push(`  (dry-run) pass --apply to delete. Nothing was removed.`);
  return L.join("\n");
}
