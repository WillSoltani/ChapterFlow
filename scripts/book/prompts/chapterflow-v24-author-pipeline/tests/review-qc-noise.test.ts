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
