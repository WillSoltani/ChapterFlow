import assert from "node:assert/strict";
import { readFileSync, rmSync, writeFileSync } from "fs";
import { resolve } from "path";

import { test } from "./harness.js";
import { makeChapter, STATE_CHAPTERS, writeFixtureBook } from "./helpers.js";
import { appendFindingsFromSubmission, effectiveLedger } from "../src/qc/orchestrator/ledger.js";
import { orchestratorRoundDir } from "../src/qc/orchestrator/artifacts.js";
import { verifyRepair } from "../src/qc/orchestrator/index.js";
import type { ValidatedSweepSubmission } from "../src/qc/orchestrator/schemas.js";

const BOOK = "zz-fixture-verify-repair";
const ROUND = "r-verify";

function cleanup(): void {
  rmSync(resolve(STATE_CHAPTERS, `${BOOK}-ch01.v21-native.chapter.json`), { force: true });
  rmSync(orchestratorRoundDir(BOOK, ROUND), { recursive: true, force: true });
}

function setup(): void {
  cleanup();
  writeFixtureBook(STATE_CHAPTERS, [makeChapter(BOOK, 1)]);
  const submission: ValidatedSweepSubmission = {
    schemaVersion: "qc-sweep-submission-v1",
    bookId: BOOK,
    roundId: ROUND,
    role: "sweep",
    reviewer: "codex-qc:sweep",
    verdict: "REVISE",
    checkedFamilies: ["scene_skeleton", "persona_drift", "repeated_unit", "location_stamping"],
    findings: [{
      chapterNumber: 1,
      unitId: "examples[0]",
      repairClass: "example_coherence",
      severity: "blocker",
      quote: "The old scene quote that must be repaired.",
      problem: "The example is a semantic QC finding.",
      expectedFix: "Rewrite the example and then run a fresh QC round.",
      globalTheme: "examples",
    }],
  };
  appendFindingsFromSubmission({ bookId: BOOK, roundId: ROUND, role: "sweep", submissionFile: "sweep.json", submission });
}

test("verify repair marks unchanged findings still_open", () => {
  try {
    setup();
    verifyRepair(BOOK, ROUND);
    const finding = effectiveLedger(BOOK, ROUND)[0];
    assert.equal(finding.status, "still_open");
    assert.match(finding.statusReason ?? "", /has not changed/);
  } finally {
    cleanup();
  }
});

test("verify repair never closes semantic findings solely because text changed", () => {
  try {
    setup();
    const p = resolve(STATE_CHAPTERS, `${BOOK}-ch01.v21-native.chapter.json`);
    const ch = JSON.parse(readFileSync(p, "utf8"));
    ch.hook += " Edited repair text.";
    writeFileSync(p, JSON.stringify(ch, null, 2), "utf8");
    verifyRepair(BOOK, ROUND);
    const finding = effectiveLedger(BOOK, ROUND)[0];
    assert.notEqual(finding.status, "stale_after_repair");
  } finally {
    cleanup();
  }
});
