/**
 * flaggedChapterNumbers — the repair phase reads the round's evidence matrix to learn which
 * chapters did NOT pass (finalVerdict !== PUBLISHABLE). That set drives (a) which dealt
 * authoring cards are re-attached to the repair writer (so it restages onto the dealt
 * shape/venue/opener slots instead of re-homogenizing) and (b) the collateral-edit guard
 * (a repair that edits a PUBLISHABLE chapter invalidates its passing review → regression).
 */

import assert from "node:assert/strict";
import { existsSync, mkdirSync, readdirSync, rmdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

import { test } from "./harness.js";
import { flaggedChapterNumbers } from "../src/orchestrator/autopilot.js";
import { evidenceMatrixPath, orchestratorRoundDir } from "../src/qc/orchestrator/artifacts.js";

const BOOK = "zz-fixture-flagged";
const ROUND = "r-flagged-test";
const QC_ORCHESTRATOR_BOOK_DIR = dirname(orchestratorRoundDir(BOOK, ROUND));
const QC_ORCHESTRATOR_DIR = dirname(QC_ORCHESTRATOR_BOOK_DIR);
const QC_ORCHESTRATOR_DIR_EXISTED = existsSync(QC_ORCHESTRATOR_DIR);

function cleanup(): void {
  rmSync(QC_ORCHESTRATOR_BOOK_DIR, { recursive: true, force: true });
  if (!QC_ORCHESTRATOR_DIR_EXISTED && existsSync(QC_ORCHESTRATOR_DIR) && readdirSync(QC_ORCHESTRATOR_DIR).length === 0) rmdirSync(QC_ORCHESTRATOR_DIR);
}

function writeMatrix(chapters: Array<{ chapterNumber: number; finalVerdict: string }>): void {
  mkdirSync(orchestratorRoundDir(BOOK, ROUND), { recursive: true });
  writeFileSync(evidenceMatrixPath(BOOK, ROUND), JSON.stringify({ schemaVersion: "qc-evidence-matrix-v1", chapters }), "utf8");
}

test("flaggedChapterNumbers: returns every non-PUBLISHABLE chapter; PUBLISHABLE ones are protected", () => {
  try {
    writeMatrix([
      { chapterNumber: 1, finalVerdict: "PUBLISHABLE" },
      { chapterNumber: 2, finalVerdict: "REVISE" },
      { chapterNumber: 3, finalVerdict: "CORRUPTION" },
      { chapterNumber: 4, finalVerdict: "NEEDS_MORE_QC" },
      { chapterNumber: 5, finalVerdict: "PUBLISHABLE" },
    ]);
    const flagged = flaggedChapterNumbers(BOOK, ROUND);
    assert.deepEqual([...flagged].sort((a, b) => a - b), [2, 3, 4], "all non-publishable chapters are flagged");
    assert.ok(!flagged.has(1) && !flagged.has(5), "PUBLISHABLE chapters are NOT flagged (the collateral guard protects them)");
  } finally {
    cleanup();
  }
});

test("flaggedChapterNumbers: a missing/unreadable matrix yields an empty set (guard then no-ops, never false-warns)", () => {
  cleanup();
  assert.equal(flaggedChapterNumbers(BOOK, ROUND).size, 0);
});
