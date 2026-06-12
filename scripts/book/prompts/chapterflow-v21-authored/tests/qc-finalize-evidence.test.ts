import assert from "node:assert/strict";
import { existsSync, readFileSync, rmSync } from "fs";
import { resolve } from "path";

import { test } from "./harness.js";
import { STATE_CHAPTERS, makeChapter, writeFixtureBook } from "./helpers.js";
import { attestationPath } from "../src/critics/qcAttestation.js";
import { evidenceMatrixPath, orchestratorRoundDir } from "../src/qc/orchestrator/artifacts.js";
import { finalizeQcRound } from "../src/qc/orchestrator/finalize.js";
import { keyPackDir, manualKeyJudgePath } from "../src/qc/manualKeyJudge.js";

const BOOK = "zz-fixture-finalize-evidence";
const ROUND = "r-finalize";

function cleanup(): void {
  rmSync(resolve(STATE_CHAPTERS, `${BOOK}-ch01.v21-native.chapter.json`), { force: true });
  rmSync(orchestratorRoundDir(BOOK, ROUND), { recursive: true, force: true });
  rmSync(keyPackDir(BOOK, ROUND), { recursive: true, force: true });
  rmSync(attestationPath(BOOK, 1), { force: true });
  rmSync(manualKeyJudgePath(BOOK, 1), { force: true });
}

test("finalize marks missing evidence NEEDS_MORE_QC and writes no PUBLISHABLE attestation", () => {
  try {
    cleanup();
    writeFixtureBook(STATE_CHAPTERS, [makeChapter(BOOK, 1)]);
    const result = finalizeQcRound(BOOK, ROUND, { chapters: [1] });
    assert.equal(result.incomplete, true);
    assert.equal(result.chapters[0].finalVerdict, "NEEDS_MORE_QC");
    assert.equal(result.attestationsWritten, 0);
    assert.equal(existsSync(attestationPath(BOOK, 1)), false);
    assert.ok(existsSync(evidenceMatrixPath(BOOK, ROUND)));
    const matrix = JSON.parse(readFileSync(evidenceMatrixPath(BOOK, ROUND), "utf8"));
    assert.equal(matrix.chapters[0].finalVerdict, "NEEDS_MORE_QC");
  } finally {
    cleanup();
  }
});
