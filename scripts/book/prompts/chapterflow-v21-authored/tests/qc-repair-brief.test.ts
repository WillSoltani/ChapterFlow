import assert from "node:assert/strict";
import { rmSync } from "fs";

import { test } from "./harness.js";
import { appendFindingsFromSubmission } from "../src/qc/orchestrator/ledger.js";
import { orchestratorRoundDir } from "../src/qc/orchestrator/artifacts.js";
import { renderRepairBriefMarkdown } from "../src/qc/orchestrator/repairBrief.js";
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
  } finally {
    cleanup();
  }
});
