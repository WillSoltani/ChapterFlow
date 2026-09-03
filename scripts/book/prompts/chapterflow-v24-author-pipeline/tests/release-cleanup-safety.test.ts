/**
 * Cleanup safety rails the release audit found open (R-230, R-088/R-240/R-241).
 *
 * Fully sandboxed: every case builds a synthetic debris tree under a mkdtemp root
 * and, where git is involved, a THROWAWAY `git init` fixture repo — never the real
 * repo, never the real state tree.
 *
 * Locks in:
 *  - R-230 the git tracked-file query FAILING inside a real work tree is
 *    `trackedUnknown`, and applyCleanup refuses on it (it used to answer "no
 *    tracked files" and delete).
 *  - R-230 a root that is not a git work tree at all is NOT "unknown": nothing
 *    there can be tracked, so the ordinary no-git sandbox still cleans.
 *  - R-088 the pipeline's OWN tracked release outputs (the reader package + its
 *    production-manifest sidecar) are SKIPPED with a named reason instead of
 *    aborting the whole cleanup, while any other tracked path still aborts.
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

import { test } from "./harness.js";
import {
  applyCleanup,
  buildCleanupManifest,
  expectedTrackedReleaseOutputs,
  type CleanupRoots,
} from "../src/publish/cleanupBookDebris.js";

const BOOK = "zz-fixture-release-cleanup";
const PROOF = { pushedCommit: "abc1234", syncState: "0 0" };

function tmpRoot(label: string): string {
  return resolve(tmpdir(), `cf-v25-relcleanup-${label}-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`);
}

function git(cwd: string, args: string[]): string {
  const r = spawnSync("git", args, { cwd, encoding: "utf8" });
  assert.equal(r.status, 0, `fixture git ${args.join(" ")} failed: ${r.stderr}`);
  return (r.stdout ?? "").trim();
}

function write(path: string, content = "x"): string {
  mkdirSync(resolve(path, ".."), { recursive: true });
  writeFileSync(path, content);
  return path;
}

/** One repo that plays BOTH the pipeline root and the outer root — which is the
 *  real shape: the pipeline dir lives inside the live checkout, so `git ls-files`
 *  from either root sees the same tracked set. */
function makeRepoTree(label: string): {
  roots: Required<CleanupRoots>;
  paths: { pkg: string; sidecar: string; chapter: string; review: string };
  cleanup: () => void;
} {
  const root = tmpRoot(label);
  mkdirSync(root, { recursive: true });
  git(root, ["init", "-q"]);
  git(root, ["config", "user.name", "fx"]);
  git(root, ["config", "user.email", "fx@t"]);
  const stateRoot = resolve(root, "state");
  const paths = {
    pkg: write(resolve(root, "book-packages", `${BOOK}.v21.json`), "{}"),
    sidecar: write(resolve(stateRoot, "books", `${BOOK}.production-manifest.json`), "{}"),
    chapter: write(resolve(stateRoot, "chapters", `${BOOK}-ch01.v21-native.chapter.json`), "{}"),
    review: write(resolve(stateRoot, "reviews", BOOK, "r.json"), "{}"),
  };
  return {
    roots: { pipelineRoot: root, stateRoot, outerRoot: root },
    paths,
    cleanup: () => rmSync(root, { recursive: true, force: true }),
  };
}

test("R-230: a git tracked-query failure inside a real work tree is trackedUnknown and applyCleanup REFUSES", () => {
  const fx = makeRepoTree("unknown");
  try {
    git(fx.roots.outerRoot, ["add", "--", "state/chapters"]);
    git(fx.roots.outerRoot, ["commit", "-q", "-m", "track a chapter"]);
    // Corrupt the index so `git ls-files` fails while `rev-parse` still says
    // "this is a work tree" — the exact shape of an unanswerable safety query.
    writeFileSync(resolve(fx.roots.outerRoot, ".git", "index"), "NOT-A-GIT-INDEX");
    const m = buildCleanupManifest(BOOK, fx.roots);
    assert.equal(m.trackedUnknown, true, "an ls-files failure inside a work tree must be reported as UNKNOWN, never as 'nothing is tracked'");
    const r = applyCleanup(BOOK, PROOF, fx.roots);
    assert.equal(r.ok, false, "cleanup must refuse when it cannot learn which paths are tracked");
    assert.match(r.error ?? "", /could not determine which matched paths are git-tracked/);
    assert.equal(r.removed.length, 0, "nothing may be deleted on an unanswerable tracked query");
    assert.equal(existsSync(fx.paths.chapter), true, "the tracked chapter must survive");
    assert.equal(existsSync(fx.paths.review), true, "untracked debris must survive too — the whole cleanup is refused");
  } finally { fx.cleanup(); }
});

test("R-230: a root that is not a git work tree is NOT unknown — nothing there can be tracked, so cleanup proceeds", () => {
  const root = tmpRoot("nogit");
  const stateRoot = resolve(root, "state");
  const roots: Required<CleanupRoots> = { pipelineRoot: root, stateRoot, outerRoot: root };
  const review = write(resolve(stateRoot, "reviews", BOOK, "r.json"), "{}");
  try {
    const m = buildCleanupManifest(BOOK, roots);
    assert.equal(m.trackedUnknown, false, "an absent repo is a KNOWN answer: no file can be tracked");
    const r = applyCleanup(BOOK, PROOF, roots);
    assert.equal(r.ok, true, `cleanup must still run outside a repo: ${r.error}`);
    assert.equal(existsSync(review), false, "untracked debris is removed");
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("R-088: the pipeline's OWN tracked release pair is SKIPPED with a named reason, not an abort", () => {
  const fx = makeRepoTree("expected");
  try {
    git(fx.roots.outerRoot, ["add", "--", "book-packages", "state/books"]);
    git(fx.roots.outerRoot, ["commit", "-q", "-m", "track the released pair"]);
    const expected = expectedTrackedReleaseOutputs(BOOK, fx.roots);
    assert.deepEqual([...expected].sort(), [fx.paths.pkg, fx.paths.sidecar].sort(), "the expected pair is exactly the reader package and its sidecar");

    const m = buildCleanupManifest(BOOK, fx.roots);
    assert.deepEqual(m.trackedMatches, [], "the pipeline's own released pair is not an unexpected tracked match");
    assert.deepEqual(m.skippedTracked.map((s) => s.path).sort(), [fx.paths.pkg, fx.paths.sidecar].sort());
    for (const s of m.skippedTracked) assert.match(s.reason, /released pair/i, "the skip carries a named reason");
    assert.ok(!m.rows.some((row) => row.path === fx.paths.pkg || row.path === fx.paths.sidecar), "a skipped path is not in the delete set");

    const r = applyCleanup(BOOK, PROOF, fx.roots);
    assert.equal(r.ok, true, `cleanup must SUCCEED over the pipeline's own tracked release outputs: ${r.error}`);
    assert.equal(existsSync(fx.paths.pkg), true, "the tracked reader package survives");
    assert.equal(existsSync(fx.paths.sidecar), true, "the tracked sidecar survives");
    assert.equal(existsSync(fx.paths.review), false, "ordinary debris is still swept");
  } finally { fx.cleanup(); }
});

test("R-088: a tracked path that is NOT the released pair still aborts the whole cleanup", () => {
  const fx = makeRepoTree("still-aborts");
  try {
    git(fx.roots.outerRoot, ["add", "--", "book-packages", "state/books", "state/chapters"]);
    git(fx.roots.outerRoot, ["commit", "-q", "-m", "track the pair AND a chapter"]);
    const m = buildCleanupManifest(BOOK, fx.roots);
    assert.deepEqual(m.trackedMatches, [fx.paths.chapter], "a tracked chapter is still an unexpected tracked match");
    const r = applyCleanup(BOOK, PROOF, fx.roots);
    assert.equal(r.ok, false, "an unexpected tracked path still aborts");
    assert.match(r.error ?? "", /git-tracked/);
    assert.equal(existsSync(fx.paths.review), true, "nothing is deleted on an abort");
  } finally { fx.cleanup(); }
});
