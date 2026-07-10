/**
 * IMP-00: role-workspace mechanism — containment, manifest fidelity, smuggled
 * files, and bounded crash-safe cleanup. (IMP-01/IMP-08 wire writer/reviewer
 * roles onto this; the mechanism ships and is pinned here.)
 */

import assert from "node:assert/strict";
import { existsSync, mkdirSync, readdirSync, readFileSync, symlinkSync, utimesSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { test } from "./harness.js";
import { TMP_DIR } from "./helpers.js";
import { buildRoleWorkspace, sweepStaleExecDirs, unexpectedWorkspaceEntries } from "../src/exec/roleWorkspace.js";

let seq = 0;
function freshBase(label: string): string {
  const dir = join(TMP_DIR, `exec-ws-${label}-${process.pid}-${seq++}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

test("workspace: files land with hashed sorted manifest; cleanup removes everything", () => {
  const ws = buildRoleWorkspace({
    label: "direct-reader",
    baseDir: freshBase("ok"),
    files: [
      { relPath: "docs/chapter.md", content: "# rendered chapter" },
      { relPath: "REVIEW-TASK.md", content: "read only the document" },
    ],
  });
  assert.deepEqual(ws.files.map((f) => f.relPath), ["REVIEW-TASK.md", "docs/chapter.md"]);
  for (const f of ws.files) assert.equal(f.sha256.length, 64);
  assert.equal(readFileSync(join(ws.dir, "docs/chapter.md"), "utf8"), "# rendered chapter");
  ws.cleanup();
  assert.equal(existsSync(ws.dir), false);
});

test("workspace: parent-escape, absolute, and null-byte relPaths are rejected", () => {
  for (const relPath of ["../escape.md", "/abs.md", "a/../../b.md", "nul\0l.md"]) {
    assert.throws(
      () => buildRoleWorkspace({ label: "bad", baseDir: freshBase("bad"), files: [{ relPath, content: "x" }] }),
      /rejected|empty|null/i,
    );
  }
});

test("workspace: symlink sources are rejected (no aliasing back into the repository)", () => {
  const base = freshBase("symlink");
  const real = join(base, "real.txt");
  writeFileSync(real, "real");
  const link = join(base, "link.txt");
  symlinkSync(real, link);
  assert.throws(
    () => buildRoleWorkspace({ label: "sym", baseDir: base, files: [{ relPath: "doc.txt", sourcePath: link }] }),
    /symlink/i,
  );
});

test("workspace: a partial build never leaves debris", () => {
  const base = freshBase("partial");
  let dirBefore: string[] = [];
  try {
    buildRoleWorkspace({
      label: "partial",
      baseDir: base,
      files: [
        { relPath: "ok.md", content: "fine" },
        { relPath: "boom.md", sourcePath: join(base, "does-not-exist.txt") },
      ],
    });
    assert.fail("expected the second file to fail the build");
  } catch {
    dirBefore = [];
  }
  const survivors = (existsSync(base) ? readdirSync(base) : []).filter((n) => n.startsWith("cf-exec-"));
  assert.deepEqual(survivors, dirBefore, "failed build must remove its own directory");
});

test("workspace: smuggled files are detected against the expected manifest", () => {
  const ws = buildRoleWorkspace({
    label: "smuggle",
    baseDir: freshBase("smuggle"),
    files: [{ relPath: "doc.md", content: "intended" }],
  });
  writeFileSync(join(ws.dir, "AGENTS.md"), "hostile late-arriving instructions");
  const unexpected = unexpectedWorkspaceEntries(ws.dir, ws.files.map((f) => f.relPath));
  assert.deepEqual(unexpected, ["AGENTS.md"]);
  ws.cleanup();
});

test("sweep: removes only stale cf-exec-* dirs, leaves fresh and foreign entries", () => {
  const base = freshBase("sweep");
  const stale = join(base, "cf-exec-old-run");
  const fresh = join(base, "cf-exec-live-run");
  const foreign = join(base, "user-data");
  for (const d of [stale, fresh, foreign]) mkdirSync(d, { recursive: true });
  writeFileSync(join(stale, "codex-home-auth.json"), "{}");
  const old = new Date(Date.now() - 24 * 60 * 60 * 1000);
  utimesSync(stale, old, old);
  const removed = sweepStaleExecDirs({ baseDir: base, olderThanMs: 6 * 60 * 60 * 1000 });
  assert.deepEqual(removed, [stale]);
  assert.equal(existsSync(stale), false, "stale exec dir (with auth debris) must be removed");
  assert.equal(existsSync(fresh), true, "fresh exec dir must survive");
  assert.equal(existsSync(foreign), true, "non-exec dirs are never touched");
});
