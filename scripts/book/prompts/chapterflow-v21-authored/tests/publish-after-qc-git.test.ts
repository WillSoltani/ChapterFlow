import assert from "node:assert/strict";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "fs";
import { dirname, resolve } from "path";

import { test } from "./harness.js";
import { REPO_ROOT } from "../src/lib/chapterPaths.js";
import { stagingPlan, formatPublishAfterQcResult, type PublishAfterQcResult } from "../src/qc/publishAfterQc.js";

const BOOK = "zz-fixture-publish-git";
const ROUND = "r-git";
const PACKAGE = resolve(REPO_ROOT, "book-packages", `${BOOK}.v21.json`);
const REGISTRY = resolve(REPO_ROOT, "app/book/data/bookPackages.ts");

function cleanup(): void {
  rmSync(PACKAGE, { force: true });
}

test("publish-after-qc staging plan includes only package unless register-web changed files", () => {
  cleanup();
  try {
    mkdirSync(dirname(PACKAGE), { recursive: true });
    writeFileSync(PACKAGE, JSON.stringify({ schemaVersion: "chapterflow-book-v21", book: { bookId: BOOK }, chapters: [] }) + "\n", "utf8");
    assert.ok(existsSync(REGISTRY), "fixture expects the web registry file to exist");

    const withoutRegistry = stagingPlan(BOOK, ROUND, { registeredFiles: [] });
    assert.deepEqual(withoutRegistry, [PACKAGE]);

    const withRegistry = stagingPlan(BOOK, ROUND, { registeredFiles: [REGISTRY] });
    assert.deepEqual(withRegistry, [REGISTRY, PACKAGE].sort());
  } finally {
    cleanup();
  }
});

test("formatPublishAfterQcResult: a commit that SUCCEEDED but failed to PUSH is reported accurately (not 'no commit performed')", () => {
  // The mis-report bug: a failed push after a successful commit advanced HEAD, yet the
  // formatter printed "no publish/commit/push performed" — luring a re-run into a
  // DUPLICATE publish commit.
  const result: PublishAfterQcResult = {
    ok: false,
    bookId: BOOK,
    roundId: ROUND,
    commitHash: "abc1234",
    pushed: false,
    staged: [PACKAGE],
    errors: ["Publish commit abc1234 was created locally, but git push FAILED: remote moved"],
    warnings: [],
    next: ["the publish commit abc1234 IS on your local branch — do NOT re-promote from scratch"],
  };
  const out = formatPublishAfterQcResult(result);
  assert.match(out, /commit: abc1234/);
  assert.match(out, /push: FAILED/);
  assert.match(out, /EXISTS locally/);
  assert.doesNotMatch(out, /no publish\/commit\/push performed/, "must NOT claim nothing was committed when a commit exists");
});

test("formatPublishAfterQcResult: a genuine PRE-commit failure still says 'no commit performed'", () => {
  const result: PublishAfterQcResult = {
    ok: false,
    bookId: BOOK,
    roundId: ROUND,
    pushed: false,
    errors: ["QC is not all-green: allPublishable=false incomplete=false repairRequired=true."],
    warnings: [],
  };
  const out = formatPublishAfterQcResult(result);
  assert.match(out, /no publish\/commit\/push performed/);
  assert.doesNotMatch(out, /EXISTS locally/);
});
