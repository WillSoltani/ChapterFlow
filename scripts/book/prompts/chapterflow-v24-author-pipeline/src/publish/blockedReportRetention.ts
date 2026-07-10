/**
 * Blocked-report retention (F-14 / Prompt 12).
 *
 * Every BLOCKED promotion writes `state/books/_blocked/<bookId>.<epoch>.report.json`
 * (promoteBook.ts). Nothing ever deleted these, so they grew unbounded — +1 per
 * `npm test` run (the source-integrity fixture leak), 61+ files and climbing.
 *
 * This module bounds them WITHOUT deleting evidence (the gold-corpus discipline is
 * real): on each write it keeps the newest N reports PER bookId and MOVES the rest
 * into `_blocked/_archive-<date>/`, appending an audit line to that archive's
 * manifest. Archive dirs are gitignored; the live reports are NOT (a real book's
 * blocked history is legitimate evidence an operator may want to commit).
 *
 * Boundary-safety: a report file name is `<stem>.<epoch>.report.json`; retention
 * keys on the EXACT captured stem, never a prefix — so book "execution" never
 * captures "execution-2"'s reports (the epoch pattern splits them). Sibling
 * directories (`_archive-*`, `_transactions`, `_quarantined`) never match the
 * report regex and are ignored.
 */

import { appendFileSync, existsSync, mkdirSync, readdirSync, renameSync } from "fs";
import { resolve } from "path";

/** `<stem>.<epoch>.report.json` — stem in group 1, epoch (ms) in group 2. */
export const BLOCKED_REPORT_RE = /^(.+)\.(\d+)\.report\.json$/;

export type BlockedReportFile = { name: string; bookId: string; epoch: number; path: string };

/** Every blocked report in `dir` (any book), newest-epoch first. Non-report
 *  entries and subdirectories are skipped (they can't match the regex). */
export function listBlockedReports(dir: string): BlockedReportFile[] {
  let names: string[];
  try { names = readdirSync(dir); } catch { return []; }
  const out: BlockedReportFile[] = [];
  for (const name of names) {
    const m = name.match(BLOCKED_REPORT_RE);
    if (!m) continue;
    out.push({ name, bookId: m[1], epoch: Number(m[2]), path: resolve(dir, name) });
  }
  return out.sort((a, b) => b.epoch - a.epoch);
}

/** Blocked reports in `dir` for EXACTLY `bookId` (exact stem match — collision-safe
 *  against a sibling whose id extends this one), newest-epoch first. */
export function blockedReportsForBook(dir: string, bookId: string): BlockedReportFile[] {
  return listBlockedReports(dir).filter((f) => f.bookId === bookId);
}

/** The archive dir name for a given day: `_archive-YYYY-MM-DD` (one per run-day). */
export function archiveDirName(now: Date): string {
  return `_archive-${now.toISOString().slice(0, 10)}`;
}

export type ArchiveMove = { from: string; to: string; name: string; epoch: number };

export type BlockedRetentionResult = {
  /** reports left live in `dir` for this book (newest-first, ≤ keep). */
  kept: BlockedReportFile[];
  /** reports moved into the archive. */
  archived: ArchiveMove[];
  /** absolute archive dir, or null if nothing was archived. */
  archiveDir: string | null;
  /** absolute archive manifest path, or null if nothing was archived. */
  manifestPath: string | null;
};

/**
 * Enforce retention for one bookId's blocked reports in `dir`: keep the newest
 * `keep` (default 5), MOVE the rest into `_archive-<date>/`, and append one JSONL
 * audit line per move to that archive's `archive-manifest.jsonl`. Never deletes.
 * Idempotent-safe (a re-run with nothing to prune is a no-op).
 */
export function pruneBlockedReports(args: {
  dir: string;
  bookId: string;
  keep?: number;
  now: () => Date;
  reason?: string;
}): BlockedRetentionResult {
  const keep = args.keep ?? 5;
  const all = blockedReportsForBook(args.dir, args.bookId); // newest-first
  if (all.length <= keep) {
    return { kept: all, archived: [], archiveDir: null, manifestPath: null };
  }
  const toArchive = all.slice(keep);
  const archived = archiveBlockedReports({
    dir: args.dir,
    files: toArchive,
    now: args.now,
    reason: args.reason ?? `retention:keep-newest-${keep}`,
  });
  // archiveBlockedReports reports kept:[] (it only knows what it moved); the kept
  // set is the newest `keep` that stayed live.
  return { ...archived, kept: all.slice(0, keep) };
}

/**
 * Move a specific set of blocked-report files into `_blocked/_archive-<date>/`,
 * appending an audit line per move. Shared by retention (prune-to-N) and the
 * one-time fixture sweep. Never deletes — a failed move leaves the file in place.
 */
export function archiveBlockedReports(args: {
  dir: string;
  files: BlockedReportFile[];
  now: () => Date;
  reason: string;
}): BlockedRetentionResult {
  if (args.files.length === 0) {
    return { kept: [], archived: [], archiveDir: null, manifestPath: null };
  }
  const stamp = args.now();
  const archiveDir = resolve(args.dir, archiveDirName(stamp));
  mkdirSync(archiveDir, { recursive: true });
  const manifestPath = resolve(archiveDir, "archive-manifest.jsonl");
  const archived: ArchiveMove[] = [];
  for (const f of args.files) {
    const dest = resolve(archiveDir, f.name);
    try {
      renameSync(f.path, dest);
    } catch {
      continue; // best-effort; a vanished/locked file is left alone (never deleted)
    }
    archived.push({ from: f.path, to: dest, name: f.name, epoch: f.epoch });
    appendFileSync(
      manifestPath,
      JSON.stringify({
        bookId: f.bookId,
        name: f.name,
        epoch: f.epoch,
        from: f.path,
        to: dest,
        archivedAt: stamp.toISOString(),
        reason: args.reason,
      }) + "\n",
    );
  }
  return { kept: [], archived, archiveDir, manifestPath };
}

/** True iff `dir` exists (used by callers that want to skip work on a fresh tree). */
export function blockedDirExists(dir: string): boolean {
  return existsSync(dir);
}
