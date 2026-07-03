/**
 * prune-book-state sweeps a PUBLISHED book's untracked working-state debris (key-packs,
 * blind submissions, authoring cards, prior rounds, the source-sidecar cache) while keeping
 * the git-tracked artifacts + the source-verify record. SAFETY is the whole point: it must
 * REFUSE to prune a book whose package is not committed (so it can never delete an
 * in-progress book's evidence), and a non-ok plan must delete nothing. The "removes only
 * untracked files" guarantee is structural (git ls-files decides) and verified on real data.
 */

import assert from "node:assert/strict";

import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "path";

import { test } from "./harness.js";
import { CANONICAL_STATE } from "../src/lib/chapterPaths.js";
import { applyPruneBookState, belongsToBook, formatPruneBookState, outerPackageCommitted, pruneBookStatePlan } from "../src/qc/pruneBookState.js";

const NOT_A_BOOK = "zz-fixture-prune-not-a-real-book";

test("prune-book-state REFUSES an unpublished book (never prune in-progress evidence)", () => {
  const plan = pruneBookStatePlan(NOT_A_BOOK);
  assert.equal(plan.status, "not-published");
  assert.deepEqual(plan.remove, []);
  assert.deepEqual(plan.keep, []);
  assert.match(plan.message, /not published/i);
});

test("applyPruneBookState deletes NOTHING on a non-ok plan", () => {
  assert.equal(applyPruneBookState(pruneBookStatePlan(NOT_A_BOOK)).removed, 0);
});

test("formatPruneBookState renders SKIP for not-published and a dry-run summary for an ok plan", () => {
  const skip = formatPruneBookState(pruneBookStatePlan(NOT_A_BOOK));
  assert.match(skip, /SKIP/);
  assert.match(skip, /not published/i);

  const ok = formatPruneBookState(
    {
      bookId: "zz",
      scope: "transient",
      status: "ok",
      message: "",
      remove: ["/repo/scripts/book/prompts/chapterflow-v21-authored/state/qc-packs/zz/keyA.answers.json"],
      keep: ["/repo/x.source-verify.md"],
      bytes: 1024 * 1024,
    },
    false,
  );
  assert.match(ok, /would remove 1 untracked file/);
  assert.match(ok, /qc-packs/);
  assert.match(ok, /keeping 1 essential/);
  assert.match(ok, /dry-run/);
});

test("belongsToBook is boundary-safe: matches a book's per-book state, never a sibling book or shared ledger", () => {
  const S = (rel: string) => resolve(CANONICAL_STATE, rel);
  // belongs to "willpower"
  assert.equal(belongsToBook(S("chapters/willpower-ch05.v21-native.chapter.json"), "willpower"), true);
  assert.equal(belongsToBook(S("qc/willpower-ch05.manual-keyjudge.json"), "willpower"), true);
  assert.equal(belongsToBook(S("qc/willpower.sweep.json"), "willpower"), true);
  assert.equal(belongsToBook(S("name-plans/willpower.json"), "willpower"), true);
  assert.equal(belongsToBook(S("qc-orchestrator/willpower/r123/evidence-matrix.json"), "willpower"), true);
  assert.equal(belongsToBook(S("autopilot-logs/willpower/broker.jsonl"), "willpower"), true);
  // does NOT belong: a sibling book that merely shares a prefix, or another book entirely
  assert.equal(belongsToBook(S("chapters/the-willpower-instinct-ch01.v21-native.chapter.json"), "willpower"), false);
  assert.equal(belongsToBook(S("qc/the-willpower-instinct.sweep.json"), "willpower"), false);
  assert.equal(belongsToBook(S("chapters/the-molecule-of-more-ch03.v21-native.chapter.json"), "willpower"), false);
  // never a top-level shared ledger
  assert.equal(belongsToBook(S("library-state.json"), "willpower"), false);
  assert.equal(belongsToBook(S("gate-attempts.json"), "willpower"), false);
});

test("prune bugfix: a book's HELD autopilot lock is structurally excluded (never prune-eligible)", () => {
  const S = (rel: string) => resolve(CANONICAL_STATE, rel);
  // Before the fix, the book-named-stem rule matched autopilot-locks/<book>.lock,
  // so a scope-"all" prune would delete a live lock mid-run and let two
  // conductors race the same book. The exclusion is structural (segment-level),
  // not a naming convention.
  assert.equal(belongsToBook(S("autopilot-locks/willpower.lock"), "willpower"), false, "the book's OWN lock is never prune-eligible");
  assert.equal(belongsToBook(S("autopilot-locks/the-willpower-instinct.lock"), "the-willpower-instinct"), false);
  // A sibling book's lock is likewise excluded (nothing under autopilot-locks/ prunes).
  assert.equal(belongsToBook(S("autopilot-locks/willpower.lock"), "some-other-book"), false);
  // Sanity: autopilot-LOGS (a different dir) still belong to the book — logs are debris, locks are not.
  assert.equal(belongsToBook(S("autopilot-logs/willpower/sessions.jsonl"), "willpower"), true);
});

test("published-gate extension (v24 F2): an OUTER-root committed package counts as published", () => {
  // A THROWAWAY fixture outer repo tracking book-packages/<book>.v21.json — this is the
  // publish-final shape (the outer live catalog holds the committed package; the sandbox
  // nested copy is never committed). outerPackageCommitted must recognize it as published.
  const root = mkdtempSync(resolve(tmpdir(), "cf-v24-prune-outer-"));
  const BOOK = "zz-fixture-outer-published";
  const git = (args: string[]) => {
    const r = spawnSync("git", args, { cwd: root, encoding: "utf8" });
    assert.equal(r.status, 0, `git ${args.join(" ")}: ${r.stderr}`);
  };
  try {
    git(["init", "-q"]);
    git(["config", "user.name", "fx"]);
    git(["config", "user.email", "fx@t"]);
    mkdirSync(resolve(root, "book-packages"), { recursive: true });
    const pkg = resolve(root, "book-packages", `${BOOK}.v21.json`);
    // Uncommitted (present but not tracked) → NOT published.
    writeFileSync(pkg, "{}");
    assert.equal(outerPackageCommitted(BOOK, root), false, "an untracked outer package is not proof of publication");
    // Commit it → published.
    git(["add", "--", `book-packages/${BOOK}.v21.json`]);
    git(["commit", "-q", "-m", "publish outer package"]);
    assert.equal(outerPackageCommitted(BOOK, root), true, "a committed outer package IS proof of publication");
    // A sibling book is never matched.
    assert.equal(outerPackageCommitted("the-" + BOOK + "-x", root), false, "a sibling book's absence is not published");
    // A non-repo outer root is a safe false (falls back to the sandbox gate).
    assert.equal(outerPackageCommitted(BOOK, resolve(root, "does-not-exist")), false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
