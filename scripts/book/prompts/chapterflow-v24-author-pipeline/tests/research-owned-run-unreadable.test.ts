/**
 * Round-3 MINOR — `findOwnedResearchRun`'s UNREADABLE classification.
 *
 * Identity in this module comes from the MANIFEST, never from the directory
 * name (createResearchRun mkdirs under the raw `bibliography.bookId` while
 * discovery matches on `normSlug`, so the two can legitimately disagree). The
 * UNREADABLE branch, however, keyed on the DIRECTORY name alone: an own run
 * whose manifest is corrupt AND whose directory is not named for its manifest
 * runId was reported NOT_ON_DISK — "there is no such run" — when the truth is
 * "the run may well be right there and cannot be read". Both fail closed, so
 * the defect is entirely in the reason code the operator is handed; that reason
 * code is what tells them whether to look for a corrupt file or to accept the
 * run is gone.
 *
 * A corrupt manifest cannot always claim an id, so classification is layered:
 * an id recovered from the raw JSON (or a directory named for the run) makes it
 * OUR unreadable run; a manifest too broken to yield any id is unattributable
 * and still reported UNREADABLE, naming the directory, because it cannot be
 * ruled out. Only a book directory with no unreadable manifest at all is
 * NOT_ON_DISK.
 */

import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join, resolve } from "path";

import { test } from "./harness.js";
import { RESEARCH_RUN_MANIFEST_FILE, findOwnedResearchRun, type ResearchCompatibility } from "../src/lib/researchRunManifest.js";

const BOOK = "zz-owned-run-unreadable";
const RUN_ID = "20260904T101112000Z-deadbee1";

const COMPATIBILITY: ResearchCompatibility = {
  codeVersion: "code-v1",
  promptHash: "prompt-v1",
  configHash: "config-v1",
  provider: "test-provider",
  model: "test-model",
};

function withRunsRoot(fn: (runsRoot: string) => void): void {
  const root = mkdtempSync(join(tmpdir(), "cf-owned-run-"));
  try {
    fn(resolve(root, "research-runs"));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

function writeManifestRaw(runsRoot: string, dirName: string, body: string): string {
  const runDir = resolve(runsRoot, BOOK, dirName);
  mkdirSync(runDir, { recursive: true });
  writeFileSync(resolve(runDir, RESEARCH_RUN_MANIFEST_FILE), body, "utf8");
  return runDir;
}

function lookup(runsRoot: string) {
  return findOwnedResearchRun({
    runsRoot,
    bookIdHint: BOOK,
    runId: RUN_ID,
    inputHash: "input-hash-1",
    compatibility: COMPATIBILITY,
  });
}

test("an own run whose manifest is corrupt reports UNREADABLE even when its directory name is not the run id", () => {
  withRunsRoot((runsRoot) => {
    // Schema-invalid but still JSON: the runId survives in the raw object, so
    // this directory is provably OUR run — and unreadable.
    const runDir = writeManifestRaw(runsRoot, "renamed-by-createResearchRun", JSON.stringify({ runId: RUN_ID }));
    const result = lookup(runsRoot);
    assert.equal(result.ok, false);
    assert.equal(result.ok === false && result.code, "UNREADABLE");
    assert.match(result.ok === false ? result.reasons.join(" ") : "", /renamed-by-createResearchRun/);
    assert.ok(runDir.endsWith("renamed-by-createResearchRun"));
  });
});

test("a manifest too corrupt to yield any id is still UNREADABLE, naming the directory", () => {
  withRunsRoot((runsRoot) => {
    writeManifestRaw(runsRoot, "truncated-run", "{\"runId\": \"20260");
    const result = lookup(runsRoot);
    assert.equal(result.ok, false);
    assert.equal(result.ok === false && result.code, "UNREADABLE");
    assert.match(result.ok === false ? result.reasons.join(" ") : "", /truncated-run/);
  });
});

test("a corrupt manifest that provably belongs to ANOTHER run does not mask a genuinely absent own run", () => {
  withRunsRoot((runsRoot) => {
    writeManifestRaw(runsRoot, "someone-elses-run", JSON.stringify({ runId: "20260904T000000000Z-other001" }));
    const result = lookup(runsRoot);
    assert.equal(result.ok, false);
    assert.equal(result.ok === false && result.code, "NOT_ON_DISK");
  });
});

test("a directory named for the run id keeps reporting UNREADABLE", () => {
  withRunsRoot((runsRoot) => {
    writeManifestRaw(runsRoot, RUN_ID, "not json at all");
    const result = lookup(runsRoot);
    assert.equal(result.ok, false);
    assert.equal(result.ok === false && result.code, "UNREADABLE");
  });
});

test("a book directory with only readable, unrelated manifests is NOT_ON_DISK", () => {
  withRunsRoot((runsRoot) => {
    mkdirSync(resolve(runsRoot, BOOK), { recursive: true });
    const result = lookup(runsRoot);
    assert.equal(result.ok, false);
    assert.equal(result.ok === false && result.code, "NOT_ON_DISK");
  });
});
