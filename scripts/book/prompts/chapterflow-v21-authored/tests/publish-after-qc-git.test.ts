import assert from "node:assert/strict";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "fs";
import { dirname, resolve } from "path";

import { test } from "./harness.js";
import { REPO_ROOT } from "../src/lib/chapterPaths.js";
import { stagingPlan } from "../src/qc/publishAfterQc.js";

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
