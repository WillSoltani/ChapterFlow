import assert from "node:assert/strict";
import { mkdirSync, rmSync, writeFileSync } from "fs";
import { resolve } from "path";

import { openQcRound, qcRoundPath } from "../src/qc/qcRound.js";
import { checkSweep, sweepRecordPath, writeSweepAttestation } from "../src/qc/sweep.js";
import { keyPackDir } from "../src/qc/manualKeyJudge.js";
import { test } from "./harness.js";
import { makeChapter, STATE_CHAPTERS, TMP_DIR, writeFixtureBook } from "./helpers.js";

const BOOK = "zz-fixture-sweep-file";
const ROUND = "r-sweep-file";

function cleanup(): void {
  for (const n of [1, 2]) rmSync(resolve(STATE_CHAPTERS, `${BOOK}-ch${String(n).padStart(2, "0")}.v21-native.chapter.json`), { force: true });
  rmSync(sweepRecordPath(BOOK), { force: true });
  rmSync(qcRoundPath(BOOK, ROUND), { force: true });
  rmSync(keyPackDir(BOOK, ROUND), { recursive: true, force: true });
  rmSync(resolve(TMP_DIR, `${BOOK}.sweep.json`), { force: true });
}

function setup(): { token: string; findingsFile: string } {
  cleanup();
  mkdirSync(TMP_DIR, { recursive: true });
  writeFixtureBook(STATE_CHAPTERS, [makeChapter(BOOK, 1), makeChapter(BOOK, 2)]);
  const token = openQcRound(BOOK, ROUND).tokens.sweep;
  const findingsFile = resolve(TMP_DIR, `${BOOK}.sweep.json`);
  writeFileSync(findingsFile, JSON.stringify({
    checkedFamilies: ["scene_skeleton", "persona_drift", "repeated_unit", "location_stamping"],
    findings: [],
  }, null, 2), "utf8");
  return { token, findingsFile };
}

test("sweep-attest requires a findings file", () => {
  try {
    const { token } = setup();
    const result = writeSweepAttestation(BOOK, ROUND, token, "PASS", "codex-qc:sweep-test", "");
    assert.match(result.error ?? "", /findings-file/);
  } finally {
    cleanup();
  }
});

test("sweep PASS requires all structural families checked", () => {
  try {
    const { token, findingsFile } = setup();
    writeFileSync(findingsFile, JSON.stringify({
      checkedFamilies: ["scene_skeleton", "persona_drift"],
      findings: [],
    }, null, 2), "utf8");
    const result = writeSweepAttestation(BOOK, ROUND, token, "PASS", "codex-qc:sweep-test", findingsFile);
    assert.match(result.error ?? "", /location_stamping/);
  } finally {
    cleanup();
  }
});

test("sweep stores checked families and findings and passes freshness check", () => {
  try {
    const { token, findingsFile } = setup();
    const result = writeSweepAttestation(BOOK, ROUND, token, "PASS", "codex-qc:sweep-test", findingsFile);
    assert.ok(result.path, result.error);
    const chapters = [makeChapter(BOOK, 1), makeChapter(BOOK, 2)];
    assert.deepEqual(checkSweep(chapters, true), []);
  } finally {
    cleanup();
  }
});
