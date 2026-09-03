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
  REPAIR_BRIEF_BLOCKER_MAX_CHARS,
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
  assert.match(brief, /NO BLOCKING FINDING ON THIS CHAPTER/, brief);
  assert.match(brief, /the whole\n?\s*of the reader-quality signal/, brief);
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
  assert.doesNotMatch(named, /NO BLOCKING FINDING ON THIS CHAPTER/, named);
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

/**
 * CLASS 1 — a big-but-legitimate finding set must not be handed to the model as an
 * unbounded mandate.
 *
 * LIVE EVIDENCE (run book-run-910febe1). QC round
 * qc-29d119c59544a5d991c71c7c9fec04bb returned 96 blockers over four chapters —
 * ch01 13, ch02 29, ch03 35, ch04 19 — in five classes: 68 B5, 21 SC11.2, 4 BP15,
 * 2 A14, 1 BP24. The blocker section of the brief had no bound at all (only the
 * advisory tail did), so ch03's mandate ran to roughly 5.5k characters. ch03 is
 * the chapter whose repair attempt failed in BOTH `repair-r2` and `repair-r3`
 * (`gateway=FAILED;process=EXITED;exit=0;stdoutBytes=1979` and `…=8559`, against
 * ~49k on the chapters that succeeded), and each failure killed the whole repair
 * run with `model output failed source-controlled schema validation`. The model's
 * raw output is not persisted, so what happened INSIDE the model is not asserted
 * here; what is asserted is the property the brief must have either way.
 */
const LIVE_ROUND_CLASSES: ReadonlyArray<readonly [string, number]> = [
  ["B5", 68],
  ["SC11.2.anchor_specific_not_present", 21],
  ["BP15.quiz_strawman_distractor", 4],
  ["A14", 2],
  ["BP24.cross_tier_breakdown_verbatim", 1],
];

function liveRoundBlockers(): QcIssue[] {
  const out: QcIssue[] = [];
  for (const [code, count] of LIVE_ROUND_CLASSES) {
    for (let index = 0; index < count; index += 1) {
      out.push({
        code,
        severity: "BLOCKER",
        message: `${code} at unit ${index}: em dash present (use commas, periods, parens, or colons instead)`,
        location: `ch03/unit-${index}`,
      });
    }
  }
  return out;
}

requiredTest("CLASS 1: a 96-blocker round produces a BOUNDED mandate that still names every defect class", () => {
  const blockers = liveRoundBlockers();
  assert.equal(blockers.length, 96, "fixture must reproduce the live round's blocker count");

  const brief = buildRepairBrief({ chapterNumber: 3, blockers, advisories: [factorScores()] });

  // The mandate is bounded. The budget governs the blocker LINES (the part that
  // scales with the finding count); the section header and the omission notice are
  // fixed overhead and are excluded, exactly as REPAIR_BRIEF_MAX_CHARS reserves
  // room for its own notice.
  const mandate = brief.slice(brief.indexOf("## MANDATORY FIXES"), brief.indexOf("## READER-PANEL"));
  const blockerLines = mandate.split("\n").filter((line) => line.startsWith("- ["));
  const spent = blockerLines.reduce((total, line) => total + line.length + 1, 0);
  assert.ok(
    spent <= REPAIR_BRIEF_BLOCKER_MAX_CHARS,
    `blocker lines must respect the ${REPAIR_BRIEF_BLOCKER_MAX_CHARS}-char budget; got ${spent}`,
  );
  assert.ok(blockerLines.length < blockers.length, `the bound must actually bite; listed ${blockerLines.length}/${blockers.length}`);

  // ...and never at the cost of a whole defect class. A plain top-N would have
  // spent the budget on B5 repeats and never shown BP24 at all.
  for (const [code] of LIVE_ROUND_CLASSES) {
    assert.ok(mandate.includes(`[${code}]`), `every distinct blocker CODE must survive the bound; missing ${code}\n${mandate}`);
  }

  // Truncation is never silent about scale: the full count leads, and the omitted
  // remainder is counted AND named by class so the writer knows more exist.
  assert.match(brief, /MANDATORY FIXES — BLOCKERS \(96\)/, brief);
  assert.match(brief, /further blocker\(s\) of the classes above are not listed individually/, brief);
  assert.match(brief, /\d+ B5/, brief);
  assert.match(brief, /treat each one as an EXAMPLE OF ITS CLASS/, brief);

  // Nothing is claimed to be fixed that is not: the omitted blockers are stated to
  // still block, so the writer cannot read the bound as permission.
  assert.match(brief, /They are real and still block\./, brief);
});

requiredTest("CLASS 1: a small blocker set is listed in full and says nothing about omissions", () => {
  // The bound must be invisible on the ordinary case — ch01 of the same live round
  // (13 blockers) is well inside budget and must read exactly as it did before.
  const blockers = liveRoundBlockers().slice(0, 13);
  const brief = buildRepairBrief({ chapterNumber: 1, blockers, advisories: [] });
  assert.match(brief, /MANDATORY FIXES — BLOCKERS \(13\)/, brief);
  assert.match(brief, /Every blocker below MUST be fixed\./, brief);
  assert.doesNotMatch(brief, /not listed individually/, brief);
  for (const blocker of blockers) assert.ok(brief.includes(blocker.message.slice(0, 40)), brief);
});

requiredTest("CLASS 1: the bounded blocker list keeps the caller's provenance order", () => {
  // The coverage pass reorders internally; the rendered list must not. The caller
  // owns provenance order, this module owns framing.
  const blockers = liveRoundBlockers();
  const brief = buildRepairBrief({ chapterNumber: 3, blockers, advisories: [] });
  const mandate = brief.slice(brief.indexOf("## MANDATORY FIXES"));
  const positions = blockers
    .map((blocker) => mandate.indexOf(`(${blocker.location}) ${blocker.message}`))
    .filter((index) => index >= 0);
  assert.ok(positions.length >= LIVE_ROUND_CLASSES.length, `expected at least one line per class, got ${positions.length}`);
  assert.deepEqual([...positions].sort((a, b) => a - b), positions, "rendered blockers must stay in provenance order");
});

requiredTest("a floor-only failure with no advisory at all admits the silence instead of inventing a task", () => {
  const brief = buildRepairBrief({ chapterNumber: 3, blockers: [floorBlocker()], advisories: [] });
  assert.match(brief, /SCORE FLOOR ONLY/, brief);
  assert.match(brief, /none recorded/i, brief);
  assert.ok(brief.length <= REPAIR_BRIEF_MAX_CHARS, brief);
});

/**
 * R-153 — the advisory tail was a plain top-N: it filled the budget in
 * provenance order and then said only how many it dropped. Measured on round
 * qc-9722fb9…, per-chapter advisory text ran 11.4k-14.5k characters against an
 * 8000-character brief, so roughly half of each chapter's advisories were
 * dropped — and unlike the blocker list, which guarantees one line per distinct
 * code and names the remainder by class, the writer was never told which CLASSES
 * of advisory existed beyond the ones printed.
 */
requiredTest("R-153: the advisory tail is coverage-first and names the classes it omitted", () => {
  // One noisy class that would eat the whole budget in provenance order, plus
  // four rarer classes that a plain top-N never reaches.
  const advisories: QcIssue[] = [
    ...Array.from({ length: 200 }, (_value, index) => advisory(index, "repetition")),
    { code: "REVIEW.READER.ADVISORY.quiz_cue", severity: "WARN", message: "the longest choice is the key in q4", location: "ch01/seat-1/quiz" },
    { code: "REVIEW.READER.ADVISORY.pacing", severity: "WARN", message: "the deep read stalls before the decision", location: "ch01/seat-2/deep read" },
    { code: "REVIEW.READER.ADVISORY.density", severity: "WARN", message: "three paragraphs restate one idea", location: "ch01/seat-0/full read" },
    { code: "E7.long_sentence", severity: "WARN", message: "12 occurrences in this chapter (advisory)", location: "ch01" },
  ];
  const brief = buildRepairBrief({ chapterNumber: 1, blockers: [floorBlocker()], advisories });

  assert.ok(brief.length <= REPAIR_BRIEF_MAX_CHARS, `brief must respect its budget; got ${brief.length}`);
  // Coverage first: every distinct advisory CODE reaches the writer.
  for (const code of [
    "REVIEW.READER.ADVISORY.repetition",
    "REVIEW.READER.ADVISORY.quiz_cue",
    "REVIEW.READER.ADVISORY.pacing",
    "REVIEW.READER.ADVISORY.density",
    "E7.long_sentence",
  ]) {
    assert.ok(brief.includes(`[${code}]`), `every distinct advisory class must survive the bound; missing ${code}\n${brief}`);
  }
  // …and the omitted remainder is named by class with counts, not just counted.
  assert.match(brief, /further advisories/, brief);
  assert.match(brief, /\d+ REVIEW\.READER\.ADVISORY\.repetition/, brief);
});

requiredTest("R-153: a small advisory set is still listed in full, with no omission notice", () => {
  const brief = buildRepairBrief({
    chapterNumber: 1,
    blockers: [floorBlocker()],
    advisories: [factorScores(), advisory(1), advisory(2, "quiz_cue")],
  });
  assert.match(brief, /advisory 1:/, brief);
  assert.match(brief, /advisory 2:/, brief);
  assert.doesNotMatch(brief, /further advisories/, brief);
});

finishV25Tests().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
