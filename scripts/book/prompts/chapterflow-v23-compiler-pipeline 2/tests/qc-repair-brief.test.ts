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
    // Scope boundary: a repair session edits chapter content ONLY — never pipeline
    // code/config. This is the guard against a repair agent editing src/cli.ts +
    // config/venue-palette.json (which it did when "fix at the source" had no bound).
    assert.match(md, /chapter JSON under .?state\/chapters/i);
    assert.match(md, /NEVER hand-edit pipeline code/i);
    assert.match(md, /STOP and report it to the operator/i);
    assert.match(md, /quiz.questions\[3\]/);
    assert.match(md, /Reverse the harbor check/);
    assert.match(md, /npx tsx src\/cli.ts author-check state\/chapters\/zz-fixture-brief-ch02/);
    assert.match(md, /npx tsx src\/cli.ts book-gate zz-fixture-brief/);
    const prompt = renderRepairPromptMarkdown(BOOK, ROUND);
    assert.match(prompt, /^You are a fresh Writer Codex repair session for ChapterFlow\./);
    assert.match(prompt, /chapter JSON under state\/chapters\//i);
    assert.match(prompt, /NEVER hand-edit pipeline code/i);
    assert.match(prompt, /STOP and report it to the operator/i);
    assert.match(prompt, /You are not a QC reviewer/);
    assert.match(prompt, /must not run qc-attest, qc-submit, sweep-attest, bar-attest/);
    assert.match(prompt, /affected chapters: ch02/);
    assert.match(prompt, /source roles: sweep/);
    assert.match(prompt, /npx tsx src\/cli.ts gate-chapter state\/chapters\/zz-fixture-brief-ch02/);
  } finally {
    cleanup();
  }
});

test("R2: repair prompt carries the constraint envelope + a C7/F1-safe rename pool", () => {
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
        chapterNumber: 5,
        unitId: "examples[2]",
        repairClass: "prose_coherence",
        severity: "major",
        quote: "The analyst's role flips mid-chapter.",
        problem: "Persona inconsistency — the same character holds two contradictory roles.",
        expectedFix: "Reconcile the persona: keep one consistent role, or rename the second actor.",
        globalTheme: "persona",
      }],
    };
    appendFindingsFromSubmission({ bookId: BOOK, roundId: ROUND, role: "sweep", submissionFile: "sweep.json", submission });
    const prompt = renderRepairPromptMarkdown(BOOK, ROUND);
    // The envelope tells the writer the guardrails a fix must not trip — the "no new issue" contract.
    assert.match(prompt, /CONSTRAINT ENVELOPE/);
    assert.match(prompt, /C7 \(blocker\)/);
    assert.match(prompt, /SP2 \(blocker\): NEVER change an example's planSpec\.format/);
    assert.match(prompt, /B1 \(blocker\)/);
    assert.match(prompt, /A13 \(major\)/);
    assert.match(prompt, /C23 \(major\)/);
    assert.match(prompt, /BP28\/BP29\/BP31/);
    // The safe-rename pool must EXCLUDE every C7-banned name (so a rename can't re-trip C7).
    const poolLine = prompt.split("\n").find((l) => l.includes("pick from:")) ?? "";
    assert.ok(poolLine, "a safe-rename pool line (with names) is rendered");
    const poolNames = poolLine.split("pick from:")[1] ?? "";
    assert.ok(poolNames.trim().length > 0, "the pool lists at least one name");
    for (const banned of ["Priya", "Marcus", "Tessa", "Naomi"]) {
      assert.doesNotMatch(poolNames, new RegExp(`\\b${banned}\\b`), `${banned} (C7-banned) must NOT be offered in the rename pool`);
    }
  } finally {
    cleanup();
  }
});

test("A5: repeated same-class findings on sibling units render ONE class-level banner", () => {
  try {
    cleanup();
    // The-daily-stoic ch3 shape: plan_actionability fires on ifThenPlans[1] AND [2] AND [3].
    // A flat per-instance list invites whack-a-mole (the writer fixes the quoted units and
    // leaves the siblings); a CLASS DEFECT banner tells it to fix the whole container.
    const mk = (i: number) => ({
      chapterNumber: 3,
      unitId: `implementationPlan.ifThenPlans[${i}]`,
      repairClass: "plan_actionability",
      severity: "major" as const,
      quote: `Plan ${i} routes the reader to a source-specific test instead of the named tool.`,
      problem: "Uses a source-specific named test, not the chapter's one Awareness Audit.",
      expectedFix: "Route the plan through the Awareness Audit.",
      globalTheme: "plan_actionability",
    });
    const submission: ValidatedSweepSubmission = {
      schemaVersion: "qc-sweep-submission-v1",
      bookId: BOOK,
      roundId: ROUND,
      role: "sweep",
      reviewer: "codex-qc:sweep",
      verdict: "REVISE",
      checkedFamilies: ["scene_skeleton", "persona_drift", "repeated_unit", "location_stamping"],
      findings: [mk(1), mk(2), mk(3)],
    };
    appendFindingsFromSubmission({ bookId: BOOK, roundId: ROUND, role: "sweep", submissionFile: "sweep.json", submission });
    const prompt = renderRepairPromptMarkdown(BOOK, ROUND);
    assert.match(prompt, /CLASS DEFECT: plan_actionability × 3 on `implementationPlan\.ifThenPlans`/, prompt);
    assert.match(prompt, /fix ALL instances of this pattern at the source/);
    // The individual findings are still listed as evidence beneath the banner.
    assert.match(prompt, /implementationPlan\.ifThenPlans\[1\]/);
    assert.match(prompt, /implementationPlan\.ifThenPlans\[3\]/);
  } finally {
    cleanup();
  }
});

test("A5: a single finding (no siblings) gets NO class banner", () => {
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
        chapterNumber: 4,
        unitId: "implementationPlan.ifThenPlans[0]",
        repairClass: "plan_actionability",
        severity: "major",
        quote: "One plan only.",
        problem: "Single instance.",
        expectedFix: "Fix it.",
        globalTheme: "plan_actionability",
      }],
    };
    appendFindingsFromSubmission({ bookId: BOOK, roundId: ROUND, role: "sweep", submissionFile: "sweep.json", submission });
    assert.doesNotMatch(renderRepairPromptMarkdown(BOOK, ROUND), /CLASS DEFECT/, "a lone finding must not get a class banner");
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
        { chapterNumber: 5, finalVerdict: "NEEDS_MORE_QC", reason: "missing evidence", checks: { barRead: "MISSING" }, majorStatus: { book: [], chapter: [] } },
        { chapterNumber: 7, finalVerdict: "PUBLISHABLE", reason: "ok", checks: {}, majorStatus: { book: [], chapter: [] } },
      ],
    }, null, 2), "utf8");
    const prompt = renderRepairPromptMarkdown(BOOK, ROUND);
    const affected = prompt.split("\n").find((l) => l.startsWith("affected chapters:")) ?? "";
    // Bucketed by why: direct finding → [edit]; matrix-only REVISE → [book-wide];
    // NEEDS_MORE_QC → [re-QC only]; PUBLISHABLE never named.
    assert.match(affected, /ch02 \[edit\]/, `direct-finding chapter must be marked [edit]: ${affected}`);
    assert.match(affected, /ch03 \[book-wide/, `matrix-only REVISE chapter must be marked [book-wide]: ${affected}`);
    assert.match(affected, /ch05 \[re-QC only/, `NEEDS_MORE_QC chapter must be marked [re-QC only]: ${affected}`);
    assert.doesNotMatch(affected, /ch07/, `PUBLISHABLE chapter must NOT be named: ${affected}`);
    assert.match(prompt, /gate-chapter state\/chapters\/zz-fixture-brief-ch03/, "ch03 must get validation commands");
  } finally {
    cleanup();
  }
});
