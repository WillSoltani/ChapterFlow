import assert from "node:assert/strict";
import { mkdirSync, rmSync, writeFileSync } from "fs";
import { dirname, resolve } from "path";

import { test } from "./harness.js";
import { STATE_CHAPTERS, makeChapter, writeFixtureBook } from "./helpers.js";
import { collectQcRound } from "../src/qc/orchestrator/index.js";
import { appendFindingsFromSubmission, effectiveLedger } from "../src/qc/orchestrator/ledger.js";
import { orchestratorRoundDir, submissionsDir } from "../src/qc/orchestrator/artifacts.js";
import { sweepRecordPath } from "../src/qc/sweep.js";
import type { ValidatedSweepSubmission } from "../src/qc/orchestrator/schemas.js";

const BOOK = "zz-fixture-ledger";
const ROUND = "r-ledger";

function cleanup(): void {
  rmSync(orchestratorRoundDir(BOOK, ROUND), { recursive: true, force: true });
  rmSync(resolve(STATE_CHAPTERS, `${BOOK}-ch01.v21-native.chapter.json`), { force: true });
  rmSync(sweepRecordPath(BOOK), { force: true });
}

function sweepSubmission(problem = "The same scene skeleton repeats across chapters."): ValidatedSweepSubmission {
  return {
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
      repairClass: "scene_skeleton",
      severity: "blocker",
      quote: "Mira checks the ledger at 8:05 and must decide whether to wait or act.",
      problem,
      expectedFix: "Rewrite the scene with a different structure and concrete source logic.",
      globalTheme: "scene skeleton",
    }],
  };
}

test("repair ledger appends new findings with stable ids", () => {
  try {
    cleanup();
    const result = appendFindingsFromSubmission({ bookId: BOOK, roundId: ROUND, role: "sweep", submissionFile: "sweep-a.json", submission: sweepSubmission() });
    assert.equal(result.appended, 1);
    const findings = effectiveLedger(BOOK, ROUND);
    assert.equal(findings.length, 1);
    assert.match(findings[0].findingId, /^qcf-/);
    assert.equal(findings[0].status, "open");
  } finally {
    cleanup();
  }
});

test("repair ledger dedupes equivalent findings but preserves multiple sources", () => {
  try {
    cleanup();
    appendFindingsFromSubmission({ bookId: BOOK, roundId: ROUND, role: "sweep", submissionFile: "sweep-a.json", submission: sweepSubmission("First wording.") });
    const dup = appendFindingsFromSubmission({ bookId: BOOK, roundId: ROUND, role: "bar", submissionFile: "bar-a.json", submission: sweepSubmission("Second wording from another reader.") as any });
    assert.equal(dup.appended, 0);
    assert.equal(dup.duplicates, 1);
    const findings = effectiveLedger(BOOK, ROUND);
    assert.equal(findings.length, 1);
    assert.equal(findings[0].sources.length, 2);
    assert.deepEqual(findings[0].sources.map((s) => s.sourceRole).sort(), ["bar", "sweep"]);
  } finally {
    cleanup();
  }
});

test("collectQcRound stores raw sweep evidence without creating a semantic blocking ledger entry", () => {
  try {
    cleanup();
    const chapter = makeChapter(BOOK, 1);
    writeFixtureBook(STATE_CHAPTERS, [chapter]);
    const quote = String(chapter.examples[0].scenario).slice(0, 90);
    const path = resolve(submissionsDir(BOOK, ROUND, "sweep"), "sweep-revise.json");
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, JSON.stringify({
      schemaVersion: "qc-sweep-submission-v1",
      bookId: BOOK,
      roundId: ROUND,
      role: "sweep",
      reviewer: "codex-qc:sweep",
      verdict: "REVISE",
      checkedFamilies: ["scene_skeleton", "persona_drift", "repeated_unit", "location_stamping"],
      findings: [{
        family: "scene_skeleton",
        chapters: [1],
        unitId: "examples[0]",
        repairClass: "scene_skeleton",
        severity: "major",
        quote,
        problem: "Raw sweep evidence should not become a blocking repair finding during collection.",
        expectedFix: "Let finalization decide whether this effective sweep finding is actionable.",
      }],
    }, null, 2) + "\n", "utf8");

    const result = collectQcRound(BOOK, ROUND);
    assert.equal(result.ok, true, result.errors.join("\n"));
    assert.equal(effectiveLedger(BOOK, ROUND).length, 0, "raw collection must not author semantic repair-ledger findings");
  } finally {
    cleanup();
  }
});
