/**
 * The repair BRIEF — the instruction the repair prompt carries beside the raw
 * findings.
 *
 * Before this file, the repair prompt carried the blocking findings and nothing
 * else: every WARN advisory and every per-factor score the canonical review
 * produced was dropped on the floor. That is survivable when a blocker names a
 * defect ("quiz key wrong at ch03/q2"), and fatal when the ONLY blocker is a
 * composite score below the bar — repair was handed one number naming nothing,
 * and every repair round re-rolled the same chapter blind.
 *
 * These tests pin the four properties that make the brief worth carrying:
 *   1. a FLOOR-ONLY failure says so in words and leads with the weakest factors
 *      and the advisories clustered on that chapter;
 *   2. a NAMED-blocker failure still leads with the blockers (advisories never
 *      outrank a mandatory fix);
 *   3. the LIVE shape — gate blockers with a passing panel's scores attached —
 *      says the panel named no defect here, so the writer reads the factor line
 *      as the quality diagnosis rather than as a second mandate;
 *   4. the brief stays inside its recorded character budget no matter how many
 *      advisories the panel raised — and says how many it dropped.
 */

import assert from "node:assert/strict";

import {
  REPAIR_BRIEF_ITEM_MAX_CHARS,
  REPAIR_BRIEF_MAX_CHARS,
  buildRepairBrief,
} from "../../src/app/candidateRepairBrief.js";
import type { QcIssue } from "../../src/qc/qcTypes.js";
import {
  READER_PANEL_BELOW_FLOOR_CODE,
  READER_PANEL_FACTOR_SCORES_CODE,
} from "../../src/review/readerPanelIssueCodes.js";
import { finishV25Tests, requiredTest } from "./harness.js";

function floorBlocker(): QcIssue {
  return {
    code: `REVIEW.${READER_PANEL_BELOW_FLOOR_CODE}`,
    severity: "BLOCKER",
    message: "reader-panel median composite 67.4 < chapter bar 70 (seat composites 65.1, 67.4, 71.2)",
    location: "ch01",
  };
}

function factorScores(): QcIssue {
  return {
    code: `REVIEW.${READER_PANEL_FACTOR_SCORES_CODE}`,
    severity: "WARN",
    message: "reader-panel median composite 67.4; factor medians weakest-first: transfer 52, practical 58, retention 63, quizzes 70, summaries 71, tone 72, limits 74, insight 75, density 76, beginner 80",
    location: "ch01",
  };
}

function advisory(index: number, category = "thin_example"): QcIssue {
  return {
    code: `REVIEW.READER.ADVISORY.${category}`,
    severity: "WARN",
    message: `advisory ${index}: the worked example stops before the reader sees the decision being made`,
    location: `ch01/seat-${index % 3}/unit-${index}`,
  };
}

requiredTest("a floor-only failure produces a brief that names the floor, the weakest factors, and the advisories", () => {
  const brief = buildRepairBrief({
    chapterNumber: 1,
    blockers: [floorBlocker()],
    advisories: [factorScores(), advisory(1), advisory(2, "quiz_cue")],
  });
  // It must SAY that nothing is named — the single most important line, because
  // a repair told only "67.4 < 70" cannot know it is not being asked to fix a defect.
  assert.match(brief, /SCORE FLOOR ONLY/, brief);
  assert.match(brief, /NO blocking defect/i, brief);
  assert.match(brief, /67\.4 < chapter bar 70/, brief);
  // The weakest factors must LEAD the diagnosis, ahead of the advisory list.
  const factorAt = brief.indexOf("WEAKEST FACTORS");
  const advisoryAt = brief.indexOf("ADVISORIES");
  assert.ok(factorAt > 0, `brief must carry a weakest-factor section:\n${brief}`);
  assert.ok(advisoryAt > factorAt, `weakest factors must precede advisories:\n${brief}`);
  assert.match(brief, /transfer 52, practical 58/, brief);
  // Every advisory clustered on the chapter must be present.
  assert.match(brief, /advisory 1:/, brief);
  assert.match(brief, /advisory 2:/, brief);
  assert.match(brief, /READER\.ADVISORY\.quiz_cue/, brief);
  // The factor line is a diagnosis, not a duplicated advisory bullet.
  assert.equal(brief.split("factor medians weakest-first").length - 1, 1, brief);
});

requiredTest("a named-blocker failure still leads with the blockers, with advisories demoted to context", () => {
  const named: QcIssue = {
    code: "QUIZ_KEY_WRONG",
    severity: "BLOCKER",
    message: "question 2 answer key does not match the stated mechanism",
    location: "ch01/quiz/q2",
  };
  const brief = buildRepairBrief({
    chapterNumber: 1,
    blockers: [named, floorBlocker()],
    advisories: [factorScores(), advisory(1)],
  });
  assert.match(brief, /MANDATORY FIXES — BLOCKERS \(2\)/, brief);
  assert.doesNotMatch(brief, /SCORE FLOOR ONLY/, brief);
  const blockerAt = brief.indexOf("MANDATORY FIXES");
  const factorAt = brief.indexOf("factor medians weakest-first");
  const advisoryAt = brief.indexOf("ADVISORIES CLUSTERED");
  assert.ok(blockerAt >= 0 && blockerAt < factorAt && factorAt < advisoryAt, brief);
  assert.match(brief, /QUIZ_KEY_WRONG/, brief);
  assert.match(brief, /ch01\/quiz\/q2/, brief);
});

/**
 * The LIVE shape. A QC round only exists behind a PASSING canonical review, so a
 * reader BLOCKER can never be on it: the blockers are deterministic gates and
 * every reader signal is a WARN. The brief must say so, or the writer reads a
 * factor line with no idea whether it is describing a defect someone named.
 */
requiredTest("when the panel named no defect on this chapter, the factor line is labelled as the whole reader diagnosis", () => {
  const gateBlocker: QcIssue = {
    code: "CHAPTER_GATE_HOOK",
    severity: "BLOCKER",
    message: "the hook does not name the visible signal",
    location: "ch01",
  };
  const brief = buildRepairBrief({
    chapterNumber: 1,
    blockers: [gateBlocker],
    advisories: [factorScores(), advisory(1)],
  });
  assert.match(brief, /MANDATORY FIXES — BLOCKERS \(1\)/, brief);
  assert.match(brief, /THE PANEL NAMED NO DEFECT ON THIS CHAPTER/, brief);
  assert.match(brief, /only\n?\s*reader-quality signal/, brief);
  assert.match(brief, /transfer 52, practical 58/, brief);
  // It is diagnosis, not a second mandate — the brief must say so in words.
  assert.match(brief, /Context, not a mandate/, brief);
  assert.doesNotMatch(brief, /SCORE FLOOR ONLY/, brief);

  // The claim is decided on the findings, never assumed: hand it a reader
  // blocking finding and it stops claiming the panel named nothing.
  const named = buildRepairBrief({
    chapterNumber: 1,
    blockers: [gateBlocker, { code: "REVIEW.READER.BLOCKING.internal_contradiction", severity: "BLOCKER", message: "claims A then not-A", location: "ch01/seat-0/deep read" }],
    advisories: [factorScores()],
  });
  assert.doesNotMatch(named, /THE PANEL NAMED NO DEFECT/, named);
  assert.match(named, /FACTOR SCORES \(context, not a mandate\)/, named);
});

requiredTest("the brief stays inside its recorded budget and says what it dropped", () => {
  const advisories = [factorScores(), ...Array.from({ length: 400 }, (_value, index) => advisory(index))];
  const brief = buildRepairBrief({ chapterNumber: 1, blockers: [floorBlocker()], advisories });
  assert.ok(
    brief.length <= REPAIR_BRIEF_MAX_CHARS,
    `brief must respect its ${REPAIR_BRIEF_MAX_CHARS}-char budget; got ${brief.length}`,
  );
  assert.match(brief, /further advisories omitted/, brief);
  // Truncation is never silent about scale: the full count is stated.
  assert.match(brief, /ADVISORIES CLUSTERED ON THIS CHAPTER \(400\)/, brief);
  // A single pathological advisory is clamped rather than allowed to eat the budget.
  const long = buildRepairBrief({
    chapterNumber: 2,
    blockers: [floorBlocker()],
    advisories: [{ code: "REVIEW.READER.ADVISORY.tone", severity: "WARN", message: "x".repeat(5000), location: "ch02/seat-0/unit" }],
  });
  assert.ok(long.length <= REPAIR_BRIEF_MAX_CHARS, `clamped brief length ${long.length}`);
  assert.match(long, /…\[truncated\]/, long);
  assert.equal(long.includes("x".repeat(REPAIR_BRIEF_ITEM_MAX_CHARS + 1)), false, "per-item clamp must bite");
});

requiredTest("a floor-only failure with no advisory at all admits the silence instead of inventing a task", () => {
  const brief = buildRepairBrief({ chapterNumber: 3, blockers: [floorBlocker()], advisories: [] });
  assert.match(brief, /SCORE FLOOR ONLY/, brief);
  assert.match(brief, /none recorded/i, brief);
  assert.ok(brief.length <= REPAIR_BRIEF_MAX_CHARS, brief);
});

finishV25Tests().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
