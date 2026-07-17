/**
 * Model bake-off report — truthfulness (WP-E34; V25-AUD-07).
 *
 * Proves:
 *   - a run with all-null primary composites (no eligible candidate) leads
 *     with a prominent "NO VALID COMPARISON" banner and prints NO numeric
 *     scoreboard;
 *   - a PROVISIONAL selection (WP-E00 terminal gating) gets the same
 *     treatment even when a winner/scores exist in the record — a provisional
 *     mint is never presented as a decided comparison;
 *   - a real (non-provisional, non-null) comparison still prints its
 *     scoreboard, and labels the evaluator chapter-diagnostic ONLY as
 *     "CHAPTER DIAGNOSTIC — NOT A BOOK SCORE" and the D7 record ONLY as
 *     "OPERATIONAL REVIEWER (SECONDARY)";
 *   - measure-only readability advisories render as measurements under their
 *     own section and never leak into the disqualification/loser text.
 */

import assert from "node:assert/strict";

import { test } from "./harness.js";
import { buildReportJson, buildReportMd, type ReportInputs } from "../src/bakeoff/report.js";
import type {
  BakeoffManifestV1,
  CandidateScorecardV1,
  CandidateSpec,
  CandidateStateV1,
  CandidateValidationV1,
  SelectionV1,
} from "../src/bakeoff/types.js";

function spec(model: string, slot: string): CandidateSpec {
  return { model, slug: model.replace(/[^a-z0-9]+/gi, "-"), slot, effort: "xhigh" };
}

function manifest(over?: Partial<BakeoffManifestV1>): BakeoffManifestV1 {
  return {
    schemaVersion: "model-bakeoff-manifest-v1",
    runId: "run-1",
    bookId: "the-report-book",
    createdAt: "2026-07-17T00:00:00.000Z",
    updatedAt: "2026-07-17T00:00:00.000Z",
    candidates: [spec("gpt-5.6-sol", "w1"), spec("gpt-5.6-terra", "w2")],
    judge: { model: "gpt-5.6-luna", effort: "xhigh" },
    maxParallel: 2,
    publish: false,
    blindMap: { A: "gpt-5.6-sol", B: "gpt-5.6-terra" },
    completedPhases: [],
    ...over,
  } as BakeoffManifestV1;
}

const ROOTS = {
  runRoot: "state/model-bakeoffs/the-report-book/run-1",
  manifestPath: "state/model-bakeoffs/the-report-book/run-1/manifest.json",
  sharedInputsDir: "state/model-bakeoffs/the-report-book/run-1/shared-inputs",
  workDir: "state/model-bakeoffs/the-report-book/run-1/work",
  candidatesDir: "state/model-bakeoffs/the-report-book/run-1/candidates",
  reviewsDir: "state/model-bakeoffs/the-report-book/run-1/reviews",
  selectionDir: "state/model-bakeoffs/the-report-book/run-1/selection",
  reportJsonPath: "state/model-bakeoffs/the-report-book/run-1/report.json",
  reportMdPath: "state/model-bakeoffs/the-report-book/run-1/report.md",
};

function scorecard(over: Partial<CandidateScorecardV1> & { model: string; label: CandidateScorecardV1["label"] }): CandidateScorecardV1 {
  return {
    eligible: true,
    disqualifications: [],
    d7Composite: null,
    d7CoreDomainMins: null,
    d7GatesPass: null,
    d7LayerIndependencePass: null,
    d7Min: null,
    d7Verdict: null,
    bookComposite: null,
    bookGate: null,
    churn: "?",
    meanChapterComposite: null,
    minChapterComposite: null,
    chapterPassRate: null,
    firstAttemptPasses: 0,
    totalRetries: 0,
    totalDurationMs: 0,
    ...over,
  };
}

function selection(over: Partial<SelectionV1> & { scorecards: CandidateScorecardV1[] }): SelectionV1 {
  return {
    schemaVersion: "model-bakeoff-selection-v1",
    selectedAt: "2026-07-17T01:00:00.000Z",
    // F3: selectWinner stamps a genuine final provisional:false; mirror that
    // default here so absent no longer masquerades as final. Cases that mean to
    // exercise the provisional/legacy path override this explicitly.
    provisional: false,
    winner: null,
    runnerUp: null,
    decidedByTieBreak: false,
    tieBand: 2.0,
    reasons: [],
    perChapterWinners: [],
    ...over,
  };
}

function candidateInput(model: string, label: string, validation: CandidateValidationV1 | null = null): ReportInputs["candidates"][number] {
  return {
    model,
    label,
    generation: null,
    validation,
    review: null,
    d7: null,
  };
}

function baseInputs(over: Partial<ReportInputs>): ReportInputs {
  return {
    manifest: manifest(),
    roots: ROOTS,
    candidates: [candidateInput("gpt-5.6-sol", "A"), candidateInput("gpt-5.6-terra", "B")],
    selection: null,
    qcOutcome: null,
    publishOutcome: null,
    codexVersion: "codex-1.0",
    ...over,
  };
}

// ── AUD-07: all-null primary composites → banner, no scoreboard ──────────────

test("all-null primary composites: banner leads the report, no numeric scoreboard is printed", () => {
  const sel = selection({
    scorecards: [
      scorecard({ model: "gpt-5.6-sol", label: "A", eligible: false, disqualifications: ["no D7 composite — the Claude-side rubric-audit judge did not produce a score (never a codex fallback)"] }),
      scorecard({ model: "gpt-5.6-terra", label: "B", eligible: false, disqualifications: ["no D7 composite — the Claude-side rubric-audit judge did not produce a score (never a codex fallback)"] }),
    ],
    reasons: ["gpt-5.6-sol is INELIGIBLE: no D7 composite", "gpt-5.6-terra is INELIGIBLE: no D7 composite"],
  });
  const md = buildReportMd(baseInputs({ selection: sel }));

  // Banner leads (appears before the first "## " section heading).
  assert.match(md, /NO VALID COMPARISON/);
  const bannerIdx = md.indexOf("NO VALID COMPARISON");
  const firstSectionIdx = md.indexOf("\n## ");
  assert.ok(bannerIdx > -1 && bannerIdx < firstSectionIdx, "banner must appear before the first section heading");

  // No numeric scoreboard: the scoreboard table (pipe-delimited header row with
  // a composite column) must not appear anywhere in the document.
  assert.ok(!/\|\s*\*\*.*(D7|CHAPTER DIAGNOSTIC).*\*\*\s*\|/.test(md), "no scoreboard table header should render");
  assert.match(md, /\*\*NO VALID COMPARISON\*\*/); // scoreboard section replacement text

  // Winner is withheld, never named as a decided fact.
  assert.match(md, /WITHHELD/);

  // JSON mirrors the same verdict for machine consumers.
  const json = buildReportJson(baseInputs({ selection: sel })) as any;
  assert.equal(json.comparisonValidity.noValidComparison, true);
  assert.ok(typeof json.comparisonValidity.reason === "string");
});

test("provisional selection: banner + suppressed scoreboard even though scores/winner exist in the record", () => {
  const sel = selection({
    provisional: true,
    winner: "gpt-5.6-sol",
    scorecards: [
      scorecard({ model: "gpt-5.6-sol", label: "A", d7Composite: 92.8, d7Min: 90, d7GatesPass: true, d7LayerIndependencePass: true, d7Verdict: "PASS" }),
      scorecard({ model: "gpt-5.6-terra", label: "B", eligible: false, disqualifications: ["deterministic validation never ran"] }),
    ],
    reasons: ["gpt-5.6-sol wins on the D7 chapter-diagnostic composite (92.80)."],
  });
  const md = buildReportMd(baseInputs({ selection: sel }));

  assert.match(md, /NO VALID COMPARISON/);
  assert.match(md, /provisional/i);
  assert.ok(!md.includes("92.8"), "no candidate composite number should leak into a provisional-suppressed report");
  assert.match(md, /WITHHELD/);

  const json = buildReportJson(baseInputs({ selection: sel })) as any;
  assert.equal(json.comparisonValidity.noValidComparison, true);
  assert.match(json.comparisonValidity.reason, /provisional/);
  // The raw selection record is still retained as evidence in the JSON (never
  // deleted), just flagged — a resumed run re-derives it from here.
  assert.equal(json.selection.provisional, true);
});

test("F3: a legacy selection with provisional ABSENT is treated as NO VALID COMPARISON (never final)", () => {
  // A record predating terminal gating: provisional is ABSENT (not false). Per
  // SelectionV1's frozen contract that must read as provisional — a scoreboard
  // must never be printed as if the run were a decided comparison.
  const sel = selection({
    winner: "gpt-5.6-sol",
    scorecards: [
      scorecard({ model: "gpt-5.6-sol", label: "A", d7Composite: 92.8, d7Min: 90, d7GatesPass: true, d7LayerIndependencePass: true, d7Verdict: "PASS" }),
      scorecard({ model: "gpt-5.6-terra", label: "B", d7Composite: 70, d7Min: 65, d7GatesPass: true, d7LayerIndependencePass: true, d7Verdict: "PASS" }),
    ],
    reasons: ["gpt-5.6-sol wins on the D7 chapter-diagnostic composite (92.80)."],
  });
  delete (sel as { provisional?: boolean }).provisional; // simulate a pre-terminal-gating record

  const md = buildReportMd(baseInputs({ selection: sel }));
  assert.match(md, /NO VALID COMPARISON/);
  assert.ok(!md.includes("92.8"), "an absent-provisional record must not print a scoreboard as if final");
  assert.match(md, /WITHHELD/);

  const json = buildReportJson(baseInputs({ selection: sel })) as any;
  assert.equal(json.comparisonValidity.noValidComparison, true);
  assert.match(json.comparisonValidity.reason, /provisional/);
});

// ── Label truthfulness: evaluator diagnostic vs D7 ────────────────────────────

test("a real comparison prints the scoreboard, and labels evalDiagnostic/D7 correctly (evaluator-primary)", () => {
  const sel = selection({
    winner: "gpt-5.6-sol",
    scorecards: [
      scorecard({
        model: "gpt-5.6-sol",
        label: "A",
        evalDiagnostic: 88.4,
        evalGatesPass: true,
        evalConfidence: "high",
        evalTerminalState: "judged",
        d7Composite: 92.8,
        d7Min: 90,
      } as Partial<CandidateScorecardV1> as any),
      scorecard({
        model: "gpt-5.6-terra",
        label: "B",
        evalDiagnostic: 80.1,
        evalGatesPass: true,
        evalConfidence: "medium",
        evalTerminalState: "judged",
        d7Composite: 70,
        d7Min: 65,
      } as Partial<CandidateScorecardV1> as any),
    ],
    reasons: ["gpt-5.6-sol wins on the evaluator chapter-diagnostic composite (88.40)."],
  });
  const md = buildReportMd(baseInputs({ selection: sel }));

  assert.ok(!md.includes("NO VALID COMPARISON"), "a real comparison must not show the suppression banner");
  assert.match(md, /\*\*CHAPTER DIAGNOSTIC — NOT A BOOK SCORE\*\*/);
  assert.match(md, /D7 \(OPERATIONAL REVIEWER \(SECONDARY\)\)/);
  // The scoreboard table renders real numbers.
  assert.match(md, /88\.40/);
  assert.match(md, /\*\*`gpt-5\.6-sol`\*\*/); // winner named
});

test("a real comparison in legacy D7-only mode still labels D7 as OPERATIONAL REVIEWER (SECONDARY), never 'primary judge'", () => {
  const sel = selection({
    winner: "gpt-5.6-sol",
    scorecards: [
      scorecard({ model: "gpt-5.6-sol", label: "A", d7Composite: 92.8, d7Min: 90, d7GatesPass: true, d7LayerIndependencePass: true, d7Verdict: "PASS" }),
      scorecard({ model: "gpt-5.6-terra", label: "B", d7Composite: 70, d7Min: 65, d7GatesPass: true, d7LayerIndependencePass: true, d7Verdict: "PASS" }),
    ],
    reasons: ["gpt-5.6-sol wins on the D7 chapter-diagnostic composite (92.80)."],
  });
  const md = buildReportMd(baseInputs({ selection: sel }));

  assert.ok(!md.includes("NO VALID COMPARISON"));
  assert.match(md, /OPERATIONAL REVIEWER \(SECONDARY\)/);
  assert.ok(!/primary judge/i.test(md), "D7 must never be presented as 'the primary judge'");
});

// ── Readability measure-only: measurement, never a disqualification ─────────

test("measure-only readability advisories render as measurements, and never appear as a disqualification", () => {
  const readabilityLine = "readability(measure-only) ch03: tier target grade 8; assembled ease 52.1 (floor 55) → FLOOR FAILED";
  const validation: CandidateValidationV1 = {
    schemaVersion: "model-bakeoff-candidate-validation-v1",
    model: "gpt-5.6-sol",
    validatedAt: "2026-07-17T02:00:00.000Z",
    complete: true,
    hardFailures: [], // measure-only ⇒ never a hard failure
    advisories: [readabilityLine],
    bookGatePassed: true,
    rubricVerdict: "warn",
    readerBudgetBlockers: 0,
    shipGateBlockers: 0,
  };
  const sel = selection({
    winner: "gpt-5.6-sol",
    scorecards: [
      scorecard({ model: "gpt-5.6-sol", label: "A", d7Composite: 92.8, d7Min: 90, d7GatesPass: true, d7LayerIndependencePass: true, d7Verdict: "PASS" }),
      scorecard({ model: "gpt-5.6-terra", label: "B", d7Composite: 70, d7Min: 65, d7GatesPass: true, d7LayerIndependencePass: true, d7Verdict: "PASS" }),
    ],
    reasons: ["gpt-5.6-sol wins on the D7 chapter-diagnostic composite (92.80)."],
  });
  const inputs = baseInputs({
    selection: sel,
    candidates: [candidateInput("gpt-5.6-sol", "A", validation), candidateInput("gpt-5.6-terra", "B")],
  });
  const md = buildReportMd(inputs);

  // Rendered as a measurement, under its own labeled section.
  assert.match(md, /Readability \(measure-only — a recorded measurement, never a disqualification\)/);
  assert.ok(md.includes(readabilityLine), "the raw measurement line should render verbatim");

  // The winner (sol) is eligible, so it never appears in "Why the others lost"
  // at all; and the measurement text never shows up under a disqualification
  // ("ineligible —") line for ANY candidate.
  const disqualLines = md.split("\n").filter((l) => l.includes("ineligible —"));
  for (const l of disqualLines) assert.ok(!l.includes("readability"), `disqualification line must not carry a readability measurement: ${l}`);
});

test("selection never run: banner shown, no scoreboard, no crash", () => {
  const md = buildReportMd(baseInputs({ selection: null }));
  assert.match(md, /NO VALID COMPARISON/);
  assert.match(md, /Selection has not run/);
  assert.ok(!md.includes("| `gpt-5.6-sol` |"), "no candidate row should render without a selection");

  const json = buildReportJson(baseInputs({ selection: null })) as any;
  assert.equal(json.comparisonValidity.noValidComparison, true);
  assert.equal(json.selection, null);
});
