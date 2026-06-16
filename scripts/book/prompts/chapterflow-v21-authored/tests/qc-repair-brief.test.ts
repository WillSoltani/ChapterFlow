import assert from "node:assert/strict";
import { mkdirSync, rmSync, writeFileSync } from "fs";
import { dirname } from "path";

import { test } from "./harness.js";
import { appendFindingsFromSubmission } from "../src/qc/orchestrator/ledger.js";
import { evidenceMatrixPath, orchestratorRoundDir } from "../src/qc/orchestrator/artifacts.js";
import { renderRepairBriefMarkdown, renderRepairPromptMarkdown } from "../src/qc/orchestrator/repairBrief.js";
import type { ValidatedSweepSubmission } from "../src/qc/orchestrator/schemas.js";

const BOOK = "zz-fixture-brief";
const ROUND = "r-brief";

function cleanup(): void {
  rmSync(orchestratorRoundDir(BOOK, ROUND), { recursive: true, force: true });
}

test("repair brief renders rules, exact finding details, and validation commands", () => {
  try {
    cleanup();
    const submission: ValidatedSweepSubmission = {
      schemaVersion: "qc-sweep-submission-v1",
      bookId: BOOK,
      roundId: ROUND,
      role: "sweep",
      reviewer: "codex-qc:sweep",
      verdict: "REVISE",
      checkedFamilies: ["scene_skeleton", "persona_drift", "repeated_unit", "location_stamping"],
      findings: [{
        chapterNumber: 2,
        unitId: "quiz.questions[3]",
        repairClass: "quiz_distractor_quality",
        severity: "major",
        quote: "Reverse the harbor check instead of doing the harbor check.",
        problem: "The distractor is the key with a junk prefix.",
        expectedFix: "Replace it with a plausible misconception a reader could actually choose.",
        globalTheme: "quiz craft",
      }],
    };
    appendFindingsFromSubmission({ bookId: BOOK, roundId: ROUND, role: "sweep", submissionFile: "sweep.json", submission });
    const md = renderRepairBriefMarkdown(BOOK, ROUND);
    assert.match(md, /Do not run `qc-attest`/);
    assert.match(md, /Final publishability always requires a fresh QC round/);
    assert.match(md, /quiz.questions\[3\]/);
    assert.match(md, /Reverse the harbor check/);
    assert.match(md, /npx tsx src\/cli.ts author-check state\/chapters\/zz-fixture-brief-ch02/);
    assert.match(md, /npx tsx src\/cli.ts book-gate zz-fixture-brief/);
    const prompt = renderRepairPromptMarkdown(BOOK, ROUND);
    assert.match(prompt, /^You are a fresh Writer Codex repair session for ChapterFlow\./);
    assert.match(prompt, /You are not a QC reviewer/);
    assert.match(prompt, /must not run qc-attest, qc-submit, sweep-attest, bar-attest/);
    assert.match(prompt, /affected chapters: ch02/);
    assert.match(prompt, /source roles: sweep/);
    assert.match(prompt, /npx tsx src\/cli.ts gate-chapter state\/chapters\/zz-fixture-brief-ch02/);
  } finally {
    cleanup();
  }
});

test("P1.3: repair prompt names a non-PUBLISHABLE matrix chapter that has NO ledger finding", () => {
  try {
    cleanup();
    // ch02 has a real ledger finding; ch03 is REVISE in the matrix purely from a
    // book-wide major (no per-chapter finding); ch07 is PUBLISHABLE.
    const submission: ValidatedSweepSubmission = {
      schemaVersion: "qc-sweep-submission-v1",
      bookId: BOOK,
      roundId: ROUND,
      role: "sweep",
      reviewer: "codex-qc:sweep",
      verdict: "REVISE",
      checkedFamilies: ["scene_skeleton", "persona_drift", "repeated_unit", "location_stamping"],
      findings: [{
        chapterNumber: 2,
        unitId: "quiz.questions[1]",
        repairClass: "quiz_distractor_quality",
        severity: "major",
        quote: "A labelled choice.",
        problem: "Uniform labels.",
        expectedFix: "Strip the labels.",
        globalTheme: "quiz craft",
      }],
    };
    appendFindingsFromSubmission({ bookId: BOOK, roundId: ROUND, role: "sweep", submissionFile: "sweep.json", submission });
    const matrixPath = evidenceMatrixPath(BOOK, ROUND);
    mkdirSync(dirname(matrixPath), { recursive: true });
    writeFileSync(matrixPath, JSON.stringify({
      schemaVersion: "qc-evidence-matrix-v1",
      bookId: BOOK,
      roundId: ROUND,
      chapters: [
        { chapterNumber: 2, finalVerdict: "REVISE", reason: "quiz", checks: { barRead: "YELLOW" }, majorStatus: { book: [], chapter: [] } },
        { chapterNumber: 3, finalVerdict: "REVISE", reason: "one or more current major findings are unresolved", checks: { majors: "FAIL" }, majorStatus: { book: [], chapter: [] } },
        { chapterNumber: 7, finalVerdict: "PUBLISHABLE", reason: "ok", checks: {}, majorStatus: { book: [], chapter: [] } },
      ],
    }, null, 2), "utf8");
    const prompt = renderRepairPromptMarkdown(BOOK, ROUND);
    const affected = prompt.split("\n").find((l) => l.startsWith("affected chapters:")) ?? "";
    assert.match(affected, /ch02/, affected);
    assert.match(affected, /ch03/, `matrix-only REVISE chapter must be named: ${affected}`);
    assert.doesNotMatch(affected, /ch07/, `PUBLISHABLE chapter must NOT be named: ${affected}`);
    assert.match(prompt, /gate-chapter state\/chapters\/zz-fixture-brief-ch03/, "ch03 must get validation commands");
  } finally {
    cleanup();
  }
});
