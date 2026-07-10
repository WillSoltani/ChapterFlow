import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { resolve } from "path";

import {
  archiveBlockedReports,
  archiveDirName,
  blockedReportsForBook,
  listBlockedReports,
  pruneBlockedReports,
} from "../src/publish/blockedReportRetention.js";
import { buildCleanupManifest } from "../src/publish/cleanupBookDebris.js";
import { TMP_DIR } from "./helpers.js";
import { test } from "./harness.js";

const ROOT = resolve(TMP_DIR, "blocked-retention");

/** Fixed clock so the archive dir name is deterministic (no real Date in asserts). */
const FIXED = new Date("2026-07-08T12:00:00.000Z");
const now = () => FIXED;

function freshBlockedDir(name: string): string {
  const dir = resolve(ROOT, name, "_blocked");
  rmSync(resolve(ROOT, name), { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  return dir;
}

/** Write a <book>.<epoch>.report.json with trivial content. */
function writeReport(dir: string, book: string, epoch: number): string {
  const p = resolve(dir, `${book}.${epoch}.report.json`);
  writeFileSync(p, JSON.stringify({ book, epoch }) + "\n", "utf8");
  return p;
}

test("pruneBlockedReports keeps the newest 5 and MOVES the rest into a dated archive (never deletes)", () => {
  const dir = freshBlockedDir("prune-to-5");
  // 7 reports for one book (epochs 1..7); newest = 7.
  for (let e = 1; e <= 7; e++) writeReport(dir, "execution", e);

  const res = pruneBlockedReports({ dir, bookId: "execution", keep: 5, now });

  // 5 live reports remain, newest-first (epochs 7..3).
  assert.equal(res.kept.length, 5);
  assert.deepEqual(res.kept.map((f) => f.epoch), [7, 6, 5, 4, 3]);
  const live = blockedReportsForBook(dir, "execution");
  assert.equal(live.length, 5);
  assert.deepEqual(live.map((f) => f.epoch).sort((a, b) => a - b), [3, 4, 5, 6, 7]);

  // The 2 oldest (epochs 1,2) were MOVED into _archive-<date>/, not deleted.
  const archiveDir = resolve(dir, archiveDirName(FIXED));
  assert.equal(res.archiveDir, archiveDir);
  assert.equal(res.archived.length, 2);
  assert.deepEqual(res.archived.map((m) => m.epoch).sort((a, b) => a - b), [1, 2]);
  for (const m of res.archived) assert.ok(existsSync(m.to), `archived report present: ${m.to}`);
  assert.ok(!existsSync(resolve(dir, "execution.1.report.json")), "moved out of live dir");
  assert.ok(!existsSync(resolve(dir, "execution.2.report.json")), "moved out of live dir");

  // Manifest lists exactly what moved, one JSONL line per file.
  assert.ok(res.manifestPath && existsSync(res.manifestPath));
  const lines = readFileSync(res.manifestPath!, "utf8").trim().split("\n").map((l) => JSON.parse(l));
  assert.equal(lines.length, 2);
  for (const l of lines) {
    assert.equal(l.bookId, "execution");
    assert.equal(l.reason, "retention:keep-newest-5");
    assert.ok(l.from && l.to && l.archivedAt);
  }
});

test("pruneBlockedReports is a no-op at or below the keep threshold", () => {
  const dir = freshBlockedDir("prune-noop");
  for (let e = 1; e <= 5; e++) writeReport(dir, "execution", e);
  const res = pruneBlockedReports({ dir, bookId: "execution", keep: 5, now });
  assert.equal(res.archived.length, 0);
  assert.equal(res.archiveDir, null);
  assert.ok(!existsSync(resolve(dir, archiveDirName(FIXED))), "no archive dir created");
  assert.equal(listBlockedReports(dir).length, 5);
});

test("retention keys on the EXACT stem — 'execution' never prunes 'execution-2' (epoch-split, not prefix)", () => {
  const dir = freshBlockedDir("collision");
  for (let e = 1; e <= 7; e++) writeReport(dir, "execution", e);
  for (let e = 1; e <= 7; e++) writeReport(dir, "execution-2", e);

  pruneBlockedReports({ dir, bookId: "execution", keep: 5, now });

  // execution pruned to 5; execution-2 fully intact (7).
  assert.equal(blockedReportsForBook(dir, "execution").length, 5);
  assert.equal(blockedReportsForBook(dir, "execution-2").length, 7);
});

test("archiveBlockedReports moves an explicit set (the one-time sweep primitive) with a labeled manifest", () => {
  const dir = freshBlockedDir("sweep");
  for (let e = 1; e <= 3; e++) writeReport(dir, "zz-fixture-source-integrity-promote", e);
  writeReport(dir, "execution", 99); // a real report that must NOT be swept

  const fixtures = listBlockedReports(dir).filter((f) => f.bookId.startsWith("zz-fixture"));
  const res = archiveBlockedReports({ dir, files: fixtures, now, reason: "one-time-fixture-sweep" });

  assert.equal(res.archived.length, 3);
  assert.equal(blockedReportsForBook(dir, "zz-fixture-source-integrity-promote").length, 0);
  assert.equal(blockedReportsForBook(dir, "execution").length, 1, "real report untouched");
  const lines = readFileSync(res.manifestPath!, "utf8").trim().split("\n").map((l) => JSON.parse(l));
  assert.equal(lines.length, 3);
  assert.ok(lines.every((l) => l.reason === "one-time-fixture-sweep"));
});

test("cleanupBookDebris manifest includes a published book's _blocked reports (F-14 gap closed)", () => {
  // Fake state root must live OUTSIDE any `tests/`/`src/`/`config/` segment —
  // cleanupBookDebris structurally excludes those (they protect the package's own
  // source tree). Use the OS temp dir so the path is neutral.
  const base = resolve(tmpdir(), "chapterflow-f14-cleanup");
  rmSync(base, { recursive: true, force: true });
  const stateRoot = resolve(base, "state");
  const blockedDir = resolve(stateRoot, "books", "_blocked");
  mkdirSync(blockedDir, { recursive: true });
  const mine1 = writeReport(blockedDir, "the-target-book", 111);
  const mine2 = writeReport(blockedDir, "the-target-book", 222);
  const other = writeReport(blockedDir, "some-other-book", 333);
  // An archived report must be left alone (gitignored evidence, not per-publish debris).
  const archiveDir = resolve(blockedDir, "_archive-2026-07-01");
  mkdirSync(archiveDir, { recursive: true });
  const archived = writeReport(archiveDir, "the-target-book", 100);

  const manifest = buildCleanupManifest("the-target-book", {
    pipelineRoot: base,
    stateRoot,
    outerRoot: base,
  });
  const paths = new Set(manifest.rows.map((r) => r.path));
  assert.ok(paths.has(mine1), "target book blocked report 1 in manifest");
  assert.ok(paths.has(mine2), "target book blocked report 2 in manifest");
  assert.ok(!paths.has(other), "another book's blocked report is NOT swept");
  assert.ok(!paths.has(archived), "archived reports are NOT swept");
  rmSync(base, { recursive: true, force: true });
});

// House-keeping: drop the scratch tree so it never leaks into git status.
test("blocked-retention scratch tree is removed", () => {
  rmSync(ROOT, { recursive: true, force: true });
  assert.ok(!existsSync(ROOT));
});
