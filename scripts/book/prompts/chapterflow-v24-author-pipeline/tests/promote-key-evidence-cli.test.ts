/**
 * R5(b): the operator-facing promote CLI print surfaces the PER-CHAPTER quiz
 * answer-key EVIDENCE lines, not just the one-line summary folded into `reason`.
 *
 * `formatPromotionResult` previously printed only `r.reason` (whose key-evidence
 * summary appears ONLY when a chapter is UNVERIFIED) plus the per-gate blocker
 * counts. An operator could not see WHICH chapters carried judge/reader/no
 * evidence. This pins that the per-chapter lines now print, that an UNVERIFIED
 * chapter's line is shown, and that the DEFAULT path (a result carrying no
 * quizKeyEvidence — the pre-gate fail-closed returns) is byte-identical to the
 * prior format. Advisory: the section never reflects a block.
 */

import assert from "node:assert/strict";

import { test } from "./harness.js";
import { formatPromotionResult, type PromotionResult } from "../src/promoteBook.js";

/** A minimal promoted result; callers override just the fields under test. */
function baseResult(over: Partial<PromotionResult> = {}): PromotionResult {
  return {
    promoted: true,
    bookId: "zz-fixture-keyevidence-cli",
    packagePath: "/tmp/pkg.json",
    reportPath: "/tmp/report.json",
    shipGateBlockerCount: 0,
    bookGateBlockerCount: 0,
    intraBookBlockerCount: 0,
    keyJudgeBlockerCount: 0,
    noApiBlockerCount: 0,
    majorBlockerCount: 0,
    sourceIntegrityBlockerCount: 0,
    sourceRealityBlockerCount: 0,
    sourceRealityDecision: "legacy-exempt",
    generationDebtBlockerCount: 0,
    generationDebtAdvisoryCount: 0,
    productionManifestBlockerCount: 0,
    d7ShipGateBlockerCount: 0,
    d7ShipGateDecision: "advisory-skip",
    canonicalBlockerCount: 0,
    shipGateMajorCount: 0,
    bookGateMajorCount: 0,
    reason: "PROMOTED: 2 chapter(s) shipped.",
    ...over,
  };
}

test("formatPromotionResult prints the per-chapter key-evidence lines, incl. an UNVERIFIED one", () => {
  const out = formatPromotionResult(
    baseResult({
      quizKeyEvidence: {
        summary: "⚠ KEY EVIDENCE UNVERIFIED for 1/2 chapter(s): ch02.",
        counts: { judgeVerified: 1, readerVerified: 0, unverified: 1 },
        unverifiedChapters: [2],
        lines: [
          "ch01: judge-verified (fresh) — 9 question(s) judged",
          "ch02: UNVERIFIED — no fresh key-judge result and no reader review that re-derived all 9 key(s) at the current content",
        ],
      },
    }),
  );
  // The header + BOTH per-chapter lines appear, not merely the summary in reason.
  assert.match(out, /Quiz key evidence: 1 judge, 0 reader, 1 unverified/);
  assert.match(out, /ch01: judge-verified \(fresh\)/);
  assert.match(out, /ch02: UNVERIFIED — no fresh key-judge result/, "the UNVERIFIED chapter's per-chapter line must be visible");
});

test("formatPromotionResult DEFAULT path (no quizKeyEvidence) is byte-identical to the prior format", () => {
  // A pre-gate fail-closed return carries no key evidence → no key-evidence
  // section, and the rest of the output is exactly the pre-R5 layout.
  const r = baseResult({ promoted: false, packagePath: undefined, reason: "BLOCKED: canonical chapter set incomplete." });
  const expected = [
    `✗ BLOCKED: ${r.bookId}`,
    `  ${r.reason}`,
    `  Report: ${r.reportPath}`,
    `  Ship gate: 0 blockers, 0 majors`,
    `  Intra-book (AS5–AS12): 0 blockers`,
    `  Canonical chapter set: 0 blockers`,
    `  Quiz answer-key judge: 0 blockers`,
    `  No-api Codex QC: 0 blockers`,
    `  Source integrity: 0 blockers`,
    `  Source reality: legacy-exempt (0 blockers)`,
    `  Generation debt: 0 blockers, 0 advisories`,
    `  Major policy: 0 blockers`,
    `  Production manifest: 0 blockers`,
    `  D7 ship gate: advisory-skip (0 blockers)`,
    `  Book gate: 0 blockers, 0 majors`,
  ].join("\n");
  assert.equal(formatPromotionResult(r), expected);
});
