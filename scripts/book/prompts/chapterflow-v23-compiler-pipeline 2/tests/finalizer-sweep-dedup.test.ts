/**
 * F6b regression: a cross-chapter sweep finding must (a) collapse to ONE ledger
 * finding (not N), and (b) NOT be dropped on a partial/subset round or when its
 * lowest spanned chapter is STALE. findingsFromEvidenceDecision runs once per
 * processed chapter; it must emit the finding on EVERY spanned chapter it sees
 * (keyed by the chapters span, no per-chapter chapterNumber → the ledger dedups),
 * never only on min(chapters) — which an earlier fix did, dropping the finding
 * whenever the min chapter wasn't processed.
 */

import assert from "node:assert/strict";

import { test } from "./harness.js";
import { findingsFromEvidenceDecision } from "../src/qc/orchestrator/finalizerFindings.js";

const sweepRecord = {
  verdict: "REVISE",
  findings: [
    {
      chapters: [2, 4, 6],
      unitId: "tryThisNow.timer-calendar-anchor",
      family: "location_stamping",
      quote: "Ch2/Ch4/Ch6 all reuse the timer container.",
      problem: "The action reuses one scheduling container across chapters.",
      expectedFix: "Vary the action mechanism per chapter.",
    },
  ],
} as any;

function rawFor(): any {
  return {
    source: { findings: [] },
    authorFindings: [],
    shipGate: { blockers: [], majors: [], minors: [] },
    intraFindings: [],
    bookGate: { findings: [] },
    sweepRecord,
    keyJudge: null,
    bar: null,
    confirm: null,
    confirmAccepted: false,
  };
}

function decisionFor(n: number): any {
  return {
    chapterNumber: n,
    chapterId: `zz-ch${n}`,
    contentHash: "h",
    checks: {
      sourceV2: "PASS",
      shipGate: "PASS",
      authorCheck: "PASS",
      intraBook: "PASS",
      bookGate: "PASS",
      sweep: "FAIL",
      manualKeyJudge: "PASS",
      barRead: "GREEN",
      confirmRead: "PUBLISHABLE",
      repairLedger: "NO_OPEN_BLOCKERS",
      majors: "PASS",
    },
    majorStatus: { status: "PASS", chapter: [], book: [] },
  };
}

const sweepOf = (fs: any[]) => fs.filter((f) => f.repairClass === "location_stamping");

test("F6b: a cross-chapter sweep finding emits on EVERY spanned chapter (so partial/STALE rounds don't drop it)", () => {
  // The lowest spanned chapter (2) is NOT in this partial round {4, 6}.
  for (const n of [4, 6]) {
    const emitted = sweepOf(findingsFromEvidenceDecision(decisionFor(n), rawFor()));
    assert.equal(emitted.length, 1, `sweep finding must emit while processing ch${n} (a non-min spanned chapter)`);
  }
  // And it still emits on the min chapter.
  assert.equal(sweepOf(findingsFromEvidenceDecision(decisionFor(2), rawFor())).length, 1);
});

test("F6b: the sweep emission is book-level (no per-chapter chapterNumber) so the ledger dedups to one", () => {
  const emitted = sweepOf(findingsFromEvidenceDecision(decisionFor(4), rawFor()));
  assert.equal(emitted[0].chapterNumber, undefined, "no per-chapter chapterNumber (would mint N distinct ledger ids)");
  assert.deepEqual(emitted[0].chapters, [2, 4, 6], "carries the full chapters span for re-dispatch");
});
