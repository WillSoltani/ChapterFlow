/**
 * Guards the v21 "dual state/chapters dirs" trap against silently reappearing in
 * this standalone v23 package. `assertNoShadowStateDir` must watch the outer
 * checkout root (where this package happens to be nested), not this package's
 * own REPO_ROOT — REPO_ROOT is, by construction, always the same directory as
 * CANONICAL_STATE's parent, so pointing the shadow check at it makes the check
 * permanently dead code no matter what actually exists on disk.
 */

import assert from "node:assert/strict";
import { mkdirSync, rmSync, rmdirSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "path";

import { assertNoShadowStateDir, CHAPTERS_DIR, FORBIDDEN_STATE, REPO_ROOT } from "../src/lib/chapterPaths.js";
import { test } from "./harness.js";

const shadowChaptersDir = resolve(FORBIDDEN_STATE, "chapters");
const fixtureFile = resolve(shadowChaptersDir, "zz-fixture-shadow-state-dir-ch01.v21-native.chapter.json");

function cleanup(): void {
  try {
    rmSync(fixtureFile, { force: true });
  } catch {
    /* ignore */
  }
}

test("FORBIDDEN_STATE is not REPO_ROOT/state (the check must not be structurally moot)", () => {
  // Before the fix, FORBIDDEN_STATE was derived from REPO_ROOT, and REPO_ROOT was
  // computed with the exact same formula as CANONICAL_STATE's parent — making
  // `shadow === CHAPTERS_DIR` a tautology and assertNoShadowStateDir() a permanent
  // no-op regardless of what actually exists on disk.
  assert.notEqual(resolve(FORBIDDEN_STATE, "chapters"), CHAPTERS_DIR);
  assert.notEqual(FORBIDDEN_STATE, resolve(REPO_ROOT, "state"));
});

test("assertNoShadowStateDir throws when the outer-checkout shadow dir holds a chapter file", () => {
  // Hard safety precondition: never write a fixture into CHAPTERS_DIR itself.
  // Pre-fix, shadowChaptersDir WAS CHAPTERS_DIR (the tautology this fix removes) —
  // refuse to run the destructive part of this test against that layout.
  assert.notEqual(shadowChaptersDir, CHAPTERS_DIR, "refusing to write a fixture into the real canonical chapters dir");
  cleanup();
  mkdirSync(shadowChaptersDir, { recursive: true });
  writeFileSync(fixtureFile, "{}");
  try {
    assert.throws(() => assertNoShadowStateDir(), /FATAL: shadow state dir holds/);
  } finally {
    cleanup();
    // Only remove the directory itself if the fixture left it empty — never touch
    // a shadow dir that might (still) hold real content.
    if (existsSync(shadowChaptersDir)) {
      try {
        rmdirSync(shadowChaptersDir);
      } catch {
        /* not empty — leave it, it predates this test */
      }
    }
  }
});
