/**
 * qc-attest trust guards (Phase 1).
 *
 * The verified failure mode (rich-dad redo loop, 2026-06): a reviewer records
 * REVISE, the authoring agent re-runs qc-attest PUBLISHABLE on the UNCHANGED
 * chapter, silently overwriting the human verdict. The guard refuses a
 * PUBLISHABLE flip over a non-PUBLISHABLE attestation when the content hash
 * is unchanged, requires --supersede "<reason>" to override, and preserves
 * every overwritten attestation in history.
 */

import assert from "node:assert/strict";
import { readFileSync, rmSync, writeFileSync, mkdirSync } from "fs";
import { resolve } from "path";

import { attestationPath } from "../src/critics/qcAttestation.js";
import { test } from "./harness.js";
import { cleanTmp, makeChapter, runCli, TMP_DIR } from "./helpers.js";

const BOOK = "zz-fixture-attest";
const LEGACY_QC_ENV = { CHAPTERFLOW_NO_API_CODEX_QC: undefined };

function withFixture(fn: (chapterFile: string) => void): void {
  mkdirSync(TMP_DIR, { recursive: true });
  const ch = makeChapter(BOOK, 1);
  const file = resolve(TMP_DIR, `${ch.chapterId}.v21-native.chapter.json`);
  writeFileSync(file, JSON.stringify(ch, null, 2), "utf8");
  try {
    fn(file);
  } finally {
    rmSync(attestationPath(BOOK, 1), { force: true });
    cleanTmp();
  }
}

test("qc-attest refuses a PUBLISHABLE flip over REVISE on UNCHANGED content (self-attest replay)", () => {
  withFixture((file) => {
    const revise = runCli(["qc-attest", file, "--verdict", "REVISE", "--reviewer", "human:reviewer-a"], LEGACY_QC_ENV);
    assert.equal(revise.status, 0, revise.out.slice(-500));

    const flip = runCli(["qc-attest", file, "--verdict", "PUBLISHABLE", "--reviewer", "codex:writer"], LEGACY_QC_ENV);
    assert.equal(flip.status, 1, `unchanged-content flip must be refused\n${flip.out.slice(-500)}`);
    assert.match(flip.out, /REFUSED/);

    // The REVISE verdict must have survived the attempt.
    const att = JSON.parse(readFileSync(attestationPath(BOOK, 1), "utf8"));
    assert.equal(att.verdict, "REVISE");
    assert.equal(att.reviewer, "human:reviewer-a");
  });
});

test("qc-attest allows the flip after the content actually changed, and keeps history", () => {
  withFixture((file) => {
    const revise = runCli(["qc-attest", file, "--verdict", "REVISE", "--reviewer", "human:reviewer-a"], LEGACY_QC_ENV);
    assert.equal(revise.status, 0, revise.out.slice(-500));

    // The redo loop did real work: the chapter changed.
    const ch = JSON.parse(readFileSync(file, "utf8"));
    ch.hook = ch.hook + " Rewritten after review.";
    writeFileSync(file, JSON.stringify(ch, null, 2), "utf8");

    const flip = runCli(["qc-attest", file, "--verdict", "PUBLISHABLE", "--reviewer", "human:reviewer-b"], LEGACY_QC_ENV);
    assert.equal(flip.status, 0, `changed-content flip is the legitimate redo path\n${flip.out.slice(-500)}`);

    const att = JSON.parse(readFileSync(attestationPath(BOOK, 1), "utf8"));
    assert.equal(att.verdict, "PUBLISHABLE");
    assert.equal(att.hashVersion, "v2");
    assert.equal(att.history?.length, 1, "the overwritten REVISE must be preserved in history");
    assert.equal(att.history[0].verdict, "REVISE");
    assert.equal(att.history[0].reviewer, "human:reviewer-a");
  });
});

test("qc-attest --supersede overrides the guard and records the reason", () => {
  withFixture((file) => {
    runCli(["qc-attest", file, "--verdict", "REVISE", "--reviewer", "human:reviewer-a"], LEGACY_QC_ENV);
    const flip = runCli([
      "qc-attest", file,
      "--verdict", "PUBLISHABLE",
      "--reviewer", "human:reviewer-b",
      "--supersede", "prior REVISE was based on a misread of the source sidecar",
    ], LEGACY_QC_ENV);
    assert.equal(flip.status, 0, flip.out.slice(-500));
    const att = JSON.parse(readFileSync(attestationPath(BOOK, 1), "utf8"));
    assert.equal(att.verdict, "PUBLISHABLE");
    assert.match(att.supersededReason, /misread/);
    assert.equal(att.history?.length, 1);
  });
});
