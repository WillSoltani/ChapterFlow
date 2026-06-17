/**
 * prune-book-state sweeps a PUBLISHED book's untracked working-state debris (key-packs,
 * blind submissions, authoring cards, prior rounds, the source-sidecar cache) while keeping
 * the git-tracked artifacts + the source-verify record. SAFETY is the whole point: it must
 * REFUSE to prune a book whose package is not committed (so it can never delete an
 * in-progress book's evidence), and a non-ok plan must delete nothing. The "removes only
 * untracked files" guarantee is structural (git ls-files decides) and verified on real data.
 */

import assert from "node:assert/strict";

import { test } from "./harness.js";
import { applyPruneBookState, formatPruneBookState, pruneBookStatePlan } from "../src/qc/pruneBookState.js";

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
