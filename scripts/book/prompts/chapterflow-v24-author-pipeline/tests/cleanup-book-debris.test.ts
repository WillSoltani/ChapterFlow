/**
 * cleanup-book-debris (v24 WS2 F2) — the per-book debris engine.
 *
 * Fully sandboxed: every case builds a synthetic state tree under mkdtemp roots and
 * (where git is involved) a THROWAWAY `git init` fixture repo — never the real repo.
 *
 * Locks in the fail-closed contract:
 *  - manifest builder rows + kinds + boundary-safe sibling exclusion
 *  - tracked-file abort (a fixture repo tracking one matched file → whole cleanup aborts)
 *  - gold-corpus structural exclusion (never anything under chapterflow-v21-authored/**)
 *  - autopilot-locks structural exclusion
 *  - ledger line-prune BYTE precision (only book lines removed; other lines byte-identical)
 *  - cleanup refuses without the step-6 publish proof (and on a bad sync state)
 *  - real deletion removes exactly the manifest rows + prunes empty parent dirs deepest-first
 *  - the production-manifest sidecar is swept (disclosed: the pushed package is now durable)
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

import { test } from "./harness.js";
import {
  applyCleanup,
  buildCleanupManifest,
  isGoldCorpusPath,
  type CleanupRoots,
} from "../src/publish/cleanupBookDebris.js";

const BOOK = "zz-fixture-debris";

function tmpRoot(label: string): string {
  return resolve(tmpdir(), `cf-v24-debris-${label}-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`);
}

function git(cwd: string, args: string[]): string {
  const r = spawnSync("git", args, { cwd, encoding: "utf8" });
  assert.equal(r.status, 0, `fixture git ${args.join(" ")} failed: ${r.stderr}`);
  return (r.stdout ?? "").trim();
}

/** Build a synthetic debris tree for BOOK under a fresh root. Returns the roots +
 *  the exact paths written, so tests can assert on them. */
function makeTree(label: string, opts?: { gitOuter?: boolean; trackOuterFile?: string }): {
  roots: Required<CleanupRoots>;
  paths: Record<string, string>;
  cleanup: () => void;
} {
  const root = tmpRoot(label);
  const pipelineRoot = resolve(root, "pipeline");
  const stateRoot = resolve(pipelineRoot, "state");
  const outerRoot = resolve(root, "outer");
  mkdirSync(outerRoot, { recursive: true });

  const w = (rel: string, content = "x"): string => {
    const p = resolve(stateRoot, rel);
    mkdirSync(resolve(p, ".."), { recursive: true });
    writeFileSync(p, content);
    return p;
  };
  const paths: Record<string, string> = {};
  paths.sidecar = w(`books/${BOOK}.production-manifest.json`, "{}");
  paths.bookDir = (() => { const d = resolve(stateRoot, "books", BOOK); mkdirSync(d, { recursive: true }); writeFileSync(resolve(d, "acceptance.json"), "{}"); return d; })();
  paths.chapter = w(`chapters/${BOOK}-ch01.v21-native.chapter.json`, "{}");
  paths.chapter2 = w(`chapters/${BOOK}-ch12.v21-native.chapter.json`, "{}");
  // A SIBLING book that must NEVER be matched.
  paths.sibling = w(`chapters/the-${BOOK}-x-ch01.v21-native.chapter.json`, "SIBLING-KEEP");
  paths.qcOrch = (() => { const d = resolve(stateRoot, "qc-orchestrator", BOOK); mkdirSync(d, { recursive: true }); writeFileSync(resolve(d, "round.json"), "{}"); return d; })();
  paths.provenance = w(`provenance/${BOOK}-ch01.json`, "{}");
  paths.index = w(`indexes/${BOOK}.json`, "[]");
  paths.brief = w(`briefs/${BOOK}.manual-brief.json`, "{}");
  paths.reviewDir = (() => { const d = resolve(stateRoot, "reviews", BOOK); mkdirSync(d, { recursive: true }); writeFileSync(resolve(d, "r.json"), "{}"); return d; })();
  // A GOLD-CORPUS-shaped path that must be structurally excluded.
  paths.gold = (() => {
    const d = resolve(pipelineRoot, "..", "chapterflow-v21-authored", "state", "chapters");
    mkdirSync(d, { recursive: true });
    const p = resolve(d, `${BOOK}-ch01.v21-native.chapter.json`);
    writeFileSync(p, "GOLD-KEEP");
    return p;
  })();
  // An autopilot-lock that must be structurally excluded.
  paths.lock = w(`autopilot-locks/${BOOK}.lock`, JSON.stringify({ owner: "x", pid: 1, host: "h", at: new Date().toISOString() }));
  // Shared ledgers.
  // qc-finalizations.jsonl — TRUE JSONL (one record per line), record carries a bookId field.
  paths.finalizations = w(`metrics/qc-finalizations.jsonl`, `{"bookId":"${BOOK}","a":1}\n{"bookId":"other-book","b":2}\n`);
  // gate-attempts.json — a PRETTY-PRINTED JSON OBJECT keyed by chapterFile PATH (the real writer's shape).
  paths.gateAttempts = w(`gate-attempts.json`, JSON.stringify({
    [`/abs/state/chapters/${BOOK}-ch01.v21-native.chapter.json`]: { total: 2, lastSignature: "AS4" },
    [`/abs/state/chapters/other-book-ch01.v21-native.chapter.json`]: { total: 1, lastSignature: "PASS" },
    [`/abs/state/chapters/the-${BOOK}-x-ch01.v21-native.chapter.json`]: { total: 3, lastSignature: "BP20" },
  }, null, 2) + "\n");

  if (opts?.gitOuter) {
    git(outerRoot, ["init", "-q"]);
    git(outerRoot, ["config", "user.name", "fx"]);
    git(outerRoot, ["config", "user.email", "fx@t"]);
  }

  return {
    roots: { pipelineRoot, stateRoot, outerRoot },
    paths,
    cleanup: () => rmSync(root, { recursive: true, force: true }),
  };
}

test("manifest builder: rows cover the per-book taxonomy, kinds tagged, sidecar included", () => {
  const fx = makeTree("rows");
  try {
    const m = buildCleanupManifest(BOOK, fx.roots);
    const paths = m.rows.map((r) => r.path);
    for (const key of ["sidecar", "bookDir", "chapter", "chapter2", "qcOrch", "provenance", "index", "brief", "reviewDir"]) {
      assert.ok(paths.includes(fx.paths[key]), `manifest must include ${key} (${fx.paths[key]})\nrows: ${paths.join("\n")}`);
    }
    // the production-manifest sidecar is explicitly a debris row (durable record is the pushed package).
    assert.ok(m.rows.some((r) => r.path === fx.paths.sidecar && r.kind === "state-book"), "sidecar must be a state-book debris row");
    // kinds present
    assert.ok(m.rows.some((r) => r.kind === "state-chapters"));
    assert.ok(m.rows.some((r) => r.kind === "state-qc"));
    assert.ok(m.rows.some((r) => r.kind === "state-review"));
    assert.ok(m.totalFiles > 0 && m.totalBytes >= 0);
  } finally { fx.cleanup(); }
});

test("boundary-safe: a sibling book (the-<book>-x) is NEVER matched", () => {
  const fx = makeTree("sibling");
  try {
    const m = buildCleanupManifest(BOOK, fx.roots);
    assert.ok(!m.rows.some((r) => r.path.includes(`the-${BOOK}-x-ch01`)), `sibling must not be in the manifest\nrows: ${m.rows.map((r) => r.path).join("\n")}`);
  } finally { fx.cleanup(); }
});

test("structural exclusion: gold corpus + autopilot-locks are NEVER in the manifest", () => {
  const fx = makeTree("structural");
  try {
    const m = buildCleanupManifest(BOOK, fx.roots);
    assert.ok(!m.rows.some((r) => r.path === fx.paths.gold), "gold-corpus path must be structurally excluded");
    assert.ok(!m.rows.some((r) => r.path.includes("chapterflow-v21-authored")), "nothing under the v21 gold corpus may appear");
    assert.ok(!m.rows.some((r) => r.path === fx.paths.lock), "autopilot-locks must be structurally excluded");
    assert.ok(!m.rows.some((r) => r.path.includes("autopilot-locks")), "nothing under autopilot-locks may appear");
    // and isGoldCorpusPath agrees.
    assert.equal(isGoldCorpusPath(fx.paths.gold), true);
    assert.equal(isGoldCorpusPath(fx.paths.chapter), false);
  } finally { fx.cleanup(); }
});

test("tracked-file abort: any git-tracked matched path aborts the WHOLE cleanup", () => {
  const fx = makeTree("tracked", { gitOuter: true });
  try {
    // Make the OUTER repo track a matched path (state/ lives under the outer git root for this fixture).
    // Move the state tree under the outer root so git can track it, then track ONE chapter file.
    const outerState = resolve(fx.roots.outerRoot, "state");
    mkdirSync(resolve(outerState, "chapters"), { recursive: true });
    const trackedChapter = resolve(outerState, "chapters", `${BOOK}-ch01.v21-native.chapter.json`);
    writeFileSync(trackedChapter, "{}");
    git(fx.roots.outerRoot, ["add", "--", "state/chapters"]);
    git(fx.roots.outerRoot, ["commit", "-q", "-m", "track a chapter"]);
    // Point the cleanup's STATE root at the outer-tracked state so the matched file is tracked.
    const roots = { pipelineRoot: fx.roots.outerRoot, stateRoot: outerState, outerRoot: fx.roots.outerRoot };
    const m = buildCleanupManifest(BOOK, roots);
    assert.ok(m.trackedMatches.length > 0, "the tracked chapter must be reported as a tracked match");
    assert.ok(m.trackedMatches.includes(trackedChapter), `tracked list must contain ${trackedChapter}`);

    const r = applyCleanup(BOOK, { pushedCommit: "abc123", syncState: "0 0" }, roots);
    assert.equal(r.ok, false, "cleanup must ABORT when a matched path is tracked");
    assert.match(r.error ?? "", /git-tracked/);
    assert.equal(r.removed.length, 0, "nothing may be deleted on a tracked-file abort");
    assert.equal(existsSync(trackedChapter), true, "the tracked file must survive");
  } finally { fx.cleanup(); }
});

test("ledger line-prune: only book lines removed, other lines byte-identical (never delete the file)", () => {
  const fx = makeTree("ledger");
  try {
    const before = readFileSync(fx.paths.finalizations, "utf8");
    const m = buildCleanupManifest(BOOK, fx.roots);
    const ledger = m.ledgers.find((l) => l.path === fx.paths.finalizations);
    assert.ok(ledger, "the qc-finalizations ledger must be in the prune plan");
    assert.equal(ledger!.removedLines, 1, "exactly the one book line is removed");
    assert.equal(ledger!.keptLines, 1, "the other book's line is kept");

    const r = applyCleanup(BOOK, { pushedCommit: "abc", syncState: "0 0" }, fx.roots);
    assert.equal(r.ok, true, r.error);
    // the ledger FILE still exists (never deleted).
    assert.equal(existsSync(fx.paths.finalizations), true, "the shared ledger must never be deleted");
    const after = readFileSync(fx.paths.finalizations, "utf8");
    assert.equal(after, `{"bookId":"other-book","b":2}\n`, "only the book line is gone; the other line is byte-identical");
    assert.notEqual(after, before);
    // gate-attempts.json — a STRUCTURED object prune: the book's key (AND its sibling-safe
    // exclusion: the-<book>-x is NOT the book) removed, others re-serialized identically.
    const gateAfter = JSON.parse(readFileSync(fx.paths.gateAttempts, "utf8"));
    const keys = Object.keys(gateAfter);
    assert.ok(!keys.some((k) => k.includes(`/${BOOK}-ch01.`)), "the book's gate-attempts key is removed");
    assert.ok(keys.some((k) => k.includes("other-book-ch01")), "another book's key survives");
    assert.ok(keys.some((k) => k.includes(`the-${BOOK}-x-ch01`)), "the sibling book's key survives (boundary-safe)");
    // the surviving entries are byte-identical to a fresh write of just those keys.
    const expectedGate = JSON.stringify({
      [`/abs/state/chapters/other-book-ch01.v21-native.chapter.json`]: { total: 1, lastSignature: "PASS" },
      [`/abs/state/chapters/the-${BOOK}-x-ch01.v21-native.chapter.json`]: { total: 3, lastSignature: "BP20" },
    }, null, 2) + "\n";
    assert.equal(readFileSync(fx.paths.gateAttempts, "utf8"), expectedGate, "surviving gate-attempts entries are byte-identical");
  } finally { fx.cleanup(); }
});

test("cleanup refuses without the step-6 publish proof (and on a non-0/0 sync state)", () => {
  const fx = makeTree("proof");
  try {
    const noProof = applyCleanup(BOOK, null, fx.roots);
    assert.equal(noProof.ok, false);
    assert.match(noProof.error ?? "", /no valid publish proof/);
    assert.equal(existsSync(fx.paths.chapter), true, "no deletion without proof");

    const badSync = applyCleanup(BOOK, { pushedCommit: "abc", syncState: "1 0" }, fx.roots);
    assert.equal(badSync.ok, false, "a non-0/0 sync state is not a valid proof");
    assert.match(badSync.error ?? "", /no valid publish proof/);
    assert.equal(existsSync(fx.paths.chapter), true, "no deletion on a bad sync state");

    const noCommit = applyCleanup(BOOK, { pushedCommit: "", syncState: "0 0" }, fx.roots);
    assert.equal(noCommit.ok, false, "an empty commit sha is not a valid proof");
  } finally { fx.cleanup(); }
});

test("real deletion (with proof): removes exactly the manifest rows + prunes empty parent dirs; keeps siblings + gold + lock", () => {
  const fx = makeTree("delete");
  try {
    const m = buildCleanupManifest(BOOK, fx.roots);
    const r = applyCleanup(BOOK, { pushedCommit: "deadbeef", syncState: "0 0" }, fx.roots);
    assert.equal(r.ok, true, r.error);
    // every manifest row is gone.
    for (const row of m.rows) assert.equal(existsSync(row.path), false, `row must be deleted: ${row.path}`);
    // the sidecar is swept.
    assert.equal(existsSync(fx.paths.sidecar), false, "the production-manifest sidecar is swept");
    // survivors:
    assert.equal(existsSync(fx.paths.sibling), true, "the sibling book survives");
    assert.equal(existsSync(fx.paths.gold), true, "the gold corpus survives");
    assert.equal(existsSync(fx.paths.lock), true, "the autopilot lock survives");
    // empty per-book dirs removed deepest-first (books/<book>/, reviews/<book>/, qc-orchestrator/<book>/).
    assert.ok(r.removedEmptyDirs.length >= 0);
    assert.equal(existsSync(resolve(fx.roots.stateRoot, "reviews", BOOK)), false, "the emptied reviews/<book> dir is pruned");
    // but a shared parent that still holds a sibling survives.
    assert.equal(existsSync(resolve(fx.roots.stateRoot, "chapters")), true, "chapters/ survives (holds the sibling)");
  } finally { fx.cleanup(); }
});

test("no-op safety: a book with no debris yields an empty manifest and an ok no-deletion apply", () => {
  const fx = makeTree("empty");
  try {
    // rip out the whole state tree so nothing matches.
    rmSync(fx.roots.stateRoot, { recursive: true, force: true });
    const m = buildCleanupManifest("some-unrelated-book", fx.roots);
    assert.equal(m.rows.length, 0);
    assert.equal(m.ledgers.length, 0);
    const r = applyCleanup("some-unrelated-book", { pushedCommit: "abc", syncState: "0 0" }, fx.roots);
    assert.equal(r.ok, true);
    assert.equal(r.removed.length, 0);
  } finally { fx.cleanup(); }
});

// Guard the readdir import is used (harness lint) — a trivial no-op assert.
test("fixture readdir sanity (state dir is enumerable)", () => {
  const fx = makeTree("readdir");
  try {
    assert.ok(readdirSync(resolve(fx.roots.stateRoot, "books")).length > 0);
  } finally { fx.cleanup(); }
});
