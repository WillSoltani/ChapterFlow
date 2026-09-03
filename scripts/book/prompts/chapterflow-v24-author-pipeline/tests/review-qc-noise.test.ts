/**
 * The review/QC channel must carry SIGNAL, not repetition.
 *
 * Every test here pins one measured noise source in the live Franklin round:
 *   - B5 (em dash) fired once per text-bearing UNIT, so 54-68 of a 96-blocker
 *     round were one typographic defect repeated (R-137). It stays a BLOCKER;
 *     it is reported once per chapter, naming every unit it touched.
 *   - a reader seat could return an EMPTY quiz derivation and still pass strict
 *     validation, so the panel's single strongest evidence channel was optional
 *     in practice (R-133).
 *   - the baseline reviewer invented its own issue codes, including positive
 *     attestations ("CONTENT_VERIFIED_CONSISTENT"), which then rode into the QC
 *     round as advisories the writer was asked to act on (R-152).
 */

import assert from "node:assert/strict";

import { test } from "./harness.js";
import { runShipGate } from "../src/critics/finalGate.js";
import { assembleReaderExperienceReview } from "../src/review/readerExperienceReview.js";
import { makeGateCleanChapter } from "./helpers.js";

// ── R-137: B5 is one blocker per CHAPTER, not one per unit ───────────────────

test("R-137: em dashes across many units produce ONE B5 blocker naming every unit", () => {
  const chapter = makeGateCleanChapter("emdash-book", 1);
  chapter.hook = `${chapter.hook} The signal arrives — and then it does not.`;
  chapter.counterintuition = `${chapter.counterintuition} The cost — measured honestly — is small.`;
  chapter.keyTakeaway = `${chapter.keyTakeaway} One owner — one trail.`;
  chapter.breakdown.fastRead = `${chapter.breakdown.fastRead} Check the source — then decide.`;

  const report = runShipGate(chapter);
  const b5 = report.blockers.filter((finding) => finding.catalogId === "B5");
  assert.equal(b5.length, 1, `B5 must report once per chapter, got ${b5.length}: ${JSON.stringify(b5, null, 2)}`);
  assert.equal(b5[0].severity, "blocker", "B5 stays blocking — the aggregation changes reporting, never the gate");
  // The single finding must still name every unit, or the writer loses the list.
  for (const unit of ["hook", "counterintuition", "keyTakeaway", "breakdown.fastRead"]) {
    assert.ok(b5[0].message.includes(unit), `aggregated B5 must name unit ${unit}: ${b5[0].message}`);
  }
  assert.match(b5[0].message, /4 unit/, b5[0].message);
});

test("R-137: a single em dash still blocks, and a clean chapter raises no B5", () => {
  const one = makeGateCleanChapter("emdash-book", 2);
  one.hook = `${one.hook} The signal arrives — and then it does not.`;
  const oneReport = runShipGate(one);
  const oneB5 = oneReport.blockers.filter((finding) => finding.catalogId === "B5");
  assert.equal(oneB5.length, 1, JSON.stringify(oneB5));
  assert.ok(oneB5[0].message.includes("hook"), oneB5[0].message);
  assert.equal(oneReport.passed, false, "one em dash still blocks the chapter");

  const clean = makeGateCleanChapter("emdash-book", 3);
  assert.equal(runShipGate(clean).blockers.some((finding) => finding.catalogId === "B5"), false);
});

// ── R-133: the quiz derivation must cover every question ─────────────────────

function readerOutput(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    schema: "reader-experience-review-v1",
    scores: {
      retention: 82, quizzes: 80, transfer: 78, practical: 81, summaries: 79,
      tone: 83, limits: 77, insight: 80, density: 76, beginner: 84,
    },
    quizDerivation: {
      answers: ["a", "b", "c"],
      mechanisms: ["m1", "m2", "m3"],
      confidence: ["high", "medium", "high"],
      ambiguities: ["", "", ""],
      tells: [],
    },
    recommendation: "SHIP",
    blockingFindings: [],
    escalationSignals: [],
    advisoryFindings: [],
    strongestEvidence: ["a strong verbatim line"],
    weakestEvidence: [],
    oneParagraphVerdict: "Solid on-page chapter.",
    ...over,
  };
}

const READER_BINDINGS = {
  chapterContentSha256: "c".repeat(64),
  readerDocumentSha256: "d".repeat(64),
  schemaSha256: "s".repeat(64),
  quizQuestionCount: 3,
};

test("R-133: a seat that skips or short-changes the quiz derivation is rejected", () => {
  // The derivation IS the reader lane's key evidence; an empty one passed strict
  // validation because [].every(...) is true and no rule tied it to the quiz.
  assert.throws(
    () => assembleReaderExperienceReview(
      readerOutput({ quizDerivation: { answers: [], mechanisms: [], confidence: [], ambiguities: [], tells: [] } }),
      READER_BINDINGS,
    ),
    /quizDerivation/,
    "an empty derivation must not pass strict validation",
  );
  // One derivation short of the chapter's question count is the same defect.
  assert.throws(
    () => assembleReaderExperienceReview(
      readerOutput({ quizDerivation: { answers: ["a", "b"], mechanisms: ["m1", "m2"], confidence: ["high", "high"], ambiguities: ["", ""], tells: [] } }),
      READER_BINDINGS,
    ),
    /quizDerivation/,
  );
  // Ragged positional arrays are rejected even when `answers` is the right length.
  assert.throws(
    () => assembleReaderExperienceReview(
      readerOutput({ quizDerivation: { answers: ["a", "b", "c"], mechanisms: ["m1"], confidence: ["high", "high", "low"], ambiguities: ["", "", ""], tells: [] } }),
      READER_BINDINGS,
    ),
    /quizDerivation/,
  );
  // The complete derivation still assembles.
  const record = assembleReaderExperienceReview(readerOutput(), READER_BINDINGS);
  assert.equal(record.quizDerivation.answers.length, 3);
});
