import assert from "node:assert/strict";
import { existsSync, mkdirSync, readdirSync, rmdirSync, rmSync, writeFileSync } from "fs";
import { dirname, resolve } from "path";

import { openQcRound, qcRoundPath } from "../src/qc/qcRound.js";
import { chapterClearsPath, checkSweep, sweepHistoryPath, sweepRecordPath, sweepTextureAdvisories, writeSweepAttestation } from "../src/qc/sweep.js";
import { QC_ORCHESTRATOR_DIR } from "../src/qc/orchestrator/artifacts.js";
import { keyPackDir } from "../src/qc/manualKeyJudge.js";
import { test } from "./harness.js";
import { makeChapter, STATE_CHAPTERS, TMP_DIR, writeFixtureBook } from "./helpers.js";

const BOOK = "zz-fixture-sweep-file";
const ROUND = "r-sweep-file";
const SHARED_QC_DIRS = [QC_ORCHESTRATOR_DIR, resolve(QC_ORCHESTRATOR_DIR, "..", "qc-packs"), resolve(QC_ORCHESTRATOR_DIR, "..", "qc-rounds")]
  .map((path) => ({ path, existed: existsSync(path) }));

function cleanup(): void {
  for (const n of [1, 2]) rmSync(resolve(STATE_CHAPTERS, `${BOOK}-ch${String(n).padStart(2, "0")}.v21-native.chapter.json`), { force: true });
  rmSync(sweepRecordPath(BOOK), { force: true });
  rmSync(sweepHistoryPath(BOOK), { force: true });
  rmSync(chapterClearsPath(BOOK), { force: true });
  rmSync(resolve(QC_ORCHESTRATOR_DIR, BOOK), { recursive: true, force: true });
  rmSync(qcRoundPath(BOOK, ROUND), { force: true });
  rmSync(keyPackDir(BOOK, ROUND), { recursive: true, force: true });
  rmSync(dirname(keyPackDir(BOOK, ROUND)), { recursive: true, force: true });
  rmSync(resolve(TMP_DIR, `${BOOK}.sweep.json`), { force: true });
  for (const dir of SHARED_QC_DIRS) {
    if (!dir.existed && existsSync(dir.path) && readdirSync(dir.path).length === 0) rmdirSync(dir.path);
  }
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

test("checkSweep (publish gate): an all-advisory/minor REVISE does NOT block; a blocker REVISE does (bug #2 parity)", () => {
  const FAMILIES = ["scene_skeleton", "persona_drift", "repeated_unit", "location_stamping"];
  const chapters = () => [makeChapter(BOOK, 1), makeChapter(BOOK, 2)];
  // The blocker case must use a DISTINCTIVE (>= 20-char) quote so it genuinely gates: a
  // repeated_unit/scene_skeleton finding anchored on a non-distinctive common phrase is
  // surfaced but non-gating (nondistinctiveRepetitionQuote), which is a separate rule from
  // the advisory-vs-blocker parity this test exercises.
  const writeFindings = (file: string, severity: "minor" | "blocker") => writeFileSync(file, JSON.stringify({
    checkedFamilies: FAMILIES,
    findings: [{ family: "persona_drift", severity, chapters: [1], unitId: "u", quote: "she sees the error halfway through the meeting", problem: "p", expectedFix: "f" }] // publish calibration: texture families are gate-advisory; this pin uses a COHERENCE family,
  }, null, 2), "utf8");
  try {
    // An all-advisory/minor REVISE must NOT block publish — the publish gate agrees with the
    // per-chapter sweep gate (sweep ≤ publish decision).
    let s = setup();
    writeFindings(s.findingsFile, "minor");
    assert.ok(writeSweepAttestation(BOOK, ROUND, s.token, "REVISE", "codex-qc:sweep-test", s.findingsFile).path);
    assert.deepEqual(checkSweep(chapters(), true), [], "an all-advisory/minor REVISE must not block publish");
    // A blocker finding still blocks (majors map to blocker at write, so majors still block too).
    s = setup();
    writeFindings(s.findingsFile, "blocker");
    assert.ok(writeSweepAttestation(BOOK, ROUND, s.token, "REVISE", "codex-qc:sweep-test", s.findingsFile).path);
    assert.equal(checkSweep(chapters(), true)[0]?.checkId, "QC3.sweep_not_pass", "a blocker REVISE still blocks publish");
  } finally {
    cleanup();
  }
});

test("P5: sweepTextureAdvisories surfaces demoted texture families WITHOUT feeding the gate", () => {
  const chapters = () => [makeChapter(BOOK, 1), makeChapter(BOOK, 2)];
  try {
    const s = setup();
    // A scene_skeleton (texture) blocker: demoted at the gate, but must be VISIBLE.
    writeFileSync(s.findingsFile, JSON.stringify({
      checkedFamilies: ["scene_skeleton", "persona_drift", "repeated_unit", "location_stamping"],
      findings: [{ family: "scene_skeleton", severity: "blocker", chapters: [1, 2], unitId: "u", quote: "after the review ends, the lead traces backward through the numbers", problem: "every example opens on the same retrospective skeleton", expectedFix: "f" }],
    }, null, 2), "utf8");
    assert.ok(writeSweepAttestation(BOOK, ROUND, s.token, "REVISE", "codex-qc:sweep-test", s.findingsFile).path);
    // The gate CLEARS (texture demoted) — proving visibility is a separate channel.
    assert.deepEqual(checkSweep(chapters(), true), [], "texture family is demoted at the gate");
    const advisories = sweepTextureAdvisories(BOOK);
    assert.equal(advisories.length, 1, "the demoted texture finding is surfaced for the log");
    assert.match(advisories[0], /texture\[scene_skeleton\] ch 1, 2/);
    assert.match(advisories[0], /not blocked/);
  } finally {
    cleanup();
  }
});
