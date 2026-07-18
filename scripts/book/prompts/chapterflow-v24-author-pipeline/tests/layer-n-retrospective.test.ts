/**
 * IMP-20 §L / WP-B9 — static Layer-N v2 retrospective.
 *
 * Two always-runnable PURE tests over injected synthetic evidence (the four
 * separated views + the diagnostic-only / never-qualify invariant + the frozen
 * FAB_RE vocabulary), plus one `xenv`-guarded test over the REAL preserved run
 * dirs (absent on a bare checkout → reported as xenv, never a false green).
 *
 * No model call, no write from the generator, no qualification anywhere.
 */

import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

import { test, xenv } from "./harness.js";
import { PIPELINE_DIR } from "../src/bakeoff/paths.js";
import type { ChapterReviewV1 } from "../src/artifacts/artifactTypes.js";
import {
  buildLayerNRetrospective,
  generateLayerNRetrospective,
  FAB_RE,
  DISPUTED_SOL_GOLD_STATUS,
  NON_DISPUTED_GOLD_STATUS,
  LAYER_N_RETROSPECTIVE_SCHEMA,
  RETROSPECTIVE_SHIP_BAR_FALLBACK,
  type LoadedReviewEvidence,
} from "../src/bakeoff/migration/layerNRetrospective.js";

/** Minimal ChapterReviewV1 stub — only the fields the retrospective reads. */
function review(partial: {
  composite?: number;
  ship84?: boolean;
  pass?: boolean;
  valid?: boolean;
  bar?: number;
  complaints?: Array<{ unit: string; problem: string; mustFix: boolean }>;
  structuralClaimsScanned?: number;
  quiz?: {
    status: "adjudicated" | "unavailable" | "skipped-no-quiz" | "skipped-extra-read";
    items?: Array<{ itemId: string; keyCorrect: "correct" | "ambiguous" | "wrong" }>;
  };
}): ChapterReviewV1 {
  return {
    composite: partial.composite ?? 90,
    ship84: partial.ship84 ?? true,
    pass: partial.pass ?? true,
    valid: partial.valid ?? true,
    bar: partial.bar,
    complaints: (partial.complaints ?? []).map((c) => ({ ...c })),
    structuralScreen:
      partial.structuralClaimsScanned === undefined
        ? { claimsScanned: 0, decisions: [] }
        : { claimsScanned: partial.structuralClaimsScanned, decisions: [] },
    quizAdjudication: partial.quiz
      ? {
          status: partial.quiz.status,
          items: (partial.quiz.items ?? []).map((i) => ({
            itemId: i.itemId,
            keyedAnswerIndex: 0,
            derivedAnswerIndex: 0,
            agreement: true,
            keyCorrect: i.keyCorrect,
            rationale: "r",
          })),
        }
      : undefined,
  } as unknown as ChapterReviewV1;
}

function ev(
  runDirSlug: string,
  judgeId: string,
  caseId: string,
  r: ChapterReviewV1 | null,
  kind: string | null = "clean-pass",
): LoadedReviewEvidence {
  const family = judgeId.startsWith("gpt-5.6-sol") ? "gpt-5.6-sol" : "gpt-5.5";
  return { runDirSlug, judgeId, judgeFamily: family, caseId, kind, review: r };
}

const MAIN_RUN = "layer-n-v2-qualification";

// ── PURE test 1: diagnostic-only; the module can NEVER emit a qualification ──

test("WP-B9: retrospective is diagnostic-only and can never emit a JudgeCapabilityQualificationV1", () => {
  const { report, json, markdown } = buildLayerNRetrospective([
    ev(MAIN_RUN, "gpt-5.5@high", "LNV2-CLEAN-x-ch01", review({ composite: 90, ship84: true })),
  ]);

  // Hard invariant fields.
  assert.equal(report.diagnosticOnly, true);
  assert.equal(report.producesQualification, false);
  assert.equal(report.schema, LAYER_N_RETROSPECTIVE_SCHEMA);
  assert.notEqual(report.schema, "judge-capability-qualification-v1");

  // The rendered artifacts never carry a qualification schema id, status, or
  // any per-role QUALIFIED/NOT_QUALIFIED verdict — this is a retrospective only.
  for (const blob of [json, markdown]) {
    assert.ok(!blob.includes("judge-capability-qualification"), "no qualification schema in output");
    assert.ok(!/\bNOT_QUALIFIED\b/.test(blob), "no NOT_QUALIFIED verdict emitted");
    assert.ok(!/"readerExperience"\s*:\s*"QUALIFIED"/.test(blob), "no role qualification verdict emitted");
  }
  // Diagnostic re-analysis consumes zero calls; the ledger is stated honestly.
  assert.equal(report.campaignCallLedger.campaignTotalConsumed, 711);
  assert.equal(report.campaignCallLedger.totalLiveCallsEverIncludingLayerNv1, 811);
});

// ── PURE test 2: the four separated views project correctly ──────────────────

test("WP-B9: the four separated views split reader / source / quiz / legacy ship-bit signals", () => {
  const evidence: LoadedReviewEvidence[] = [
    // (A) mixed: one reader-decidable blocker + one FAB-class blocker → failure
    //     does NOT depend only on source (a real reader blocker remains).
    ev(
      MAIN_RUN,
      "gpt-5.5@high",
      "case-mixed",
      review({
        composite: 70,
        ship84: false,
        pass: false,
        complaints: [
          { unit: "deep read", problem: "the chapter contradicts its own earlier claim", mustFix: true },
          { unit: "example 3", problem: "this example is fabricated and did not happen", mustFix: true },
          { unit: "quiz", problem: "answers slightly cued", mustFix: false },
        ],
      }),
      "reader-visible-hard-blocker",
    ),
    // (B) source-only: the ONLY blocking mustFix is FAB-class → failure depended
    //     entirely on unavailable source evidence.
    ev(
      MAIN_RUN,
      "gpt-5.5@high",
      "case-source-only",
      review({
        composite: 82,
        ship84: false,
        pass: false,
        complaints: [{ unit: "example 1", problem: "invents a named person that appears invented", mustFix: true }],
      }),
    ),
    // (C) pure ship-bit artifact: composite >= bar, zero mustFix, ship84 false.
    ev(
      MAIN_RUN,
      "gpt-5.5@high",
      "case-shipbit",
      review({ composite: 85.8, bar: 80, ship84: false, pass: false, complaints: [] }),
    ),
    // (D) quiz block: a wrong key.
    ev(
      MAIN_RUN,
      "gpt-5.5@high",
      "case-quizwrong",
      review({
        quiz: {
          status: "adjudicated",
          items: [
            { itemId: "q1", keyCorrect: "wrong" },
            { itemId: "q2", keyCorrect: "correct" },
          ],
        },
      }),
      "quiz-key-mismatch",
    ),
    // (E) quiz pass: all correct.
    ev(
      MAIN_RUN,
      "gpt-5.5@high",
      "case-quizok",
      review({ quiz: { status: "adjudicated", items: [{ itemId: "q1", keyCorrect: "correct" }] } }),
    ),
  ];

  const { report } = buildLayerNRetrospective(evidence);
  const byCase = new Map(report.cases.map((c) => [c.caseId, c]));

  const mixed = byCase.get("case-mixed")!;
  assert.equal(mixed.readerOnly.blockersExcludingSourceTruthClaims.length, 1);
  assert.equal(mixed.readerOnly.blockersExcludingSourceTruthClaims[0].unit, "deep read");
  assert.equal(mixed.sourceRelated.escalationSignals.length, 1);
  assert.equal(mixed.sourceRelated.escalationSignals[0].note, "ungrounded: no source evidence");
  assert.equal(mixed.readerOnly.nonBlockingCraftFindings.length, 1);
  assert.equal(mixed.failureDependedOnUnavailableSourceEvidence, false, "a real reader blocker remains");

  const srcOnly = byCase.get("case-source-only")!;
  assert.equal(srcOnly.readerOnly.blockersExcludingSourceTruthClaims.length, 0);
  assert.equal(srcOnly.sourceRelated.escalationSignals.length, 1);
  assert.equal(srcOnly.failureDependedOnUnavailableSourceEvidence, true);

  const shipbit = byCase.get("case-shipbit")!;
  assert.equal(shipbit.ship84Effect.classification, "pure-ship-bit-artifact");
  assert.equal(shipbit.failureDependedOnUnavailableSourceEvidence, false, "no mustFix at all");

  const quizWrong = byCase.get("case-quizwrong")!;
  assert.equal(quizWrong.quiz.result, "BLOCK");
  assert.equal(quizWrong.quiz.keyWrongCount, 1);

  const quizOk = byCase.get("case-quizok")!;
  assert.equal(quizOk.quiz.result, "PASS");

  // structuralClaimsScanned surfaced (always 0 in the real corpus).
  assert.equal(mixed.sourceRelated.structuralClaimsScanned, 0);
});

// ── PURE test 3: disputed sol cases stay UNADJUDICATED, never true/false ─────

test("WP-B9: disputed sol source-register cases are marked UNADJUDICATED and never labeled true/false", () => {
  // A disputed case: sol raises a FAB mustFix; a gpt-5.5 judge (present) does not.
  const disputed = "LNV2-CLEAN-disputed-ch01";
  const clean = "LNV2-CLEAN-agreed-ch01";
  const evidence: LoadedReviewEvidence[] = [
    ev(MAIN_RUN, "gpt-5.6-sol@high", disputed, review({ complaints: [{ unit: "example 2", problem: "this is fabricated", mustFix: true }] })),
    ev(MAIN_RUN, "gpt-5.5@high", disputed, review({ complaints: [] })),
    ev(MAIN_RUN, "gpt-5.5@xhigh", disputed, review({ complaints: [] })),
    // A case where BOTH sol and gpt-5.5 flag it → not disputed (agreement).
    ev(MAIN_RUN, "gpt-5.6-sol@high", clean, review({ complaints: [{ unit: "example 1", problem: "fabricated detail", mustFix: true }] })),
    ev(MAIN_RUN, "gpt-5.5@high", clean, review({ complaints: [{ unit: "example 1", problem: "invents a person", mustFix: true }] })),
  ];

  const { report } = buildLayerNRetrospective(evidence);
  const primary = report.disputedSolSourceRegisterCases;
  assert.equal(primary.goldStatus, DISPUTED_SOL_GOLD_STATUS);
  assert.equal(primary.primaryRunCount, 1);
  assert.deepEqual(primary.perRunDir.find((d) => d.runDirSlug === MAIN_RUN)!.caseIds, [disputed]);

  // Every view of the disputed case is UNADJUDICATED; the agreed case is neutral.
  for (const c of report.cases.filter((x) => x.caseId === disputed)) {
    assert.equal(c.caseGoldValidity, DISPUTED_SOL_GOLD_STATUS);
  }
  for (const c of report.cases.filter((x) => x.caseId === clean)) {
    assert.equal(c.caseGoldValidity, NON_DISPUTED_GOLD_STATUS);
  }
  // The gold-validity VALUE is only ever one of the two neutral labels — never a
  // boolean/true/false verdict on any case, disputed or not.
  const allowed = new Set<string>([DISPUTED_SOL_GOLD_STATUS, NON_DISPUTED_GOLD_STATUS]);
  for (const c of report.cases) {
    assert.equal(typeof c.caseGoldValidity, "string");
    assert.ok(allowed.has(c.caseGoldValidity), `caseGoldValidity must be a neutral label, got ${c.caseGoldValidity}`);
  }
});

// ── PURE test 4: the FAB_RE vocabulary is frozen verbatim ────────────────────

test("WP-B9: FAB_RE matches the frozen gen-sol-divergence source-truth vocabulary verbatim", () => {
  assert.equal(
    FAB_RE.source,
    "fabricat|invent|misleading|presented as factual|hypothetical|did not happen|not established|fictional|as if (real|it happened)|appears? invented",
  );
  assert.ok(FAB_RE.flags.includes("i"));
  assert.equal(RETROSPECTIVE_SHIP_BAR_FALLBACK, 80);
});

// ── xenv test: over the REAL preserved run dirs ──────────────────────────────

const REAL_MAIN_DIR = resolve(PIPELINE_DIR, "state", "migration-experiments", MAIN_RUN, "native-review-v2");

xenv(
  "WP-B9: over the real preserved run dirs, the FINAL run yields 14 disputed cases and never qualifies",
  "preserved Layer-N v2 run dirs absent on a bare checkout",
  () => existsSync(REAL_MAIN_DIR),
  () => {
    const { report } = generateLayerNRetrospective();
    // Never a qualification.
    assert.equal(report.producesQualification, false);
    // The FINAL run's 14 disputed sol source-register cases.
    assert.equal(report.disputedSolSourceRegisterCases.primaryRunCount, 14);
    assert.equal(report.disputedSolSourceRegisterCases.primaryRunDirSlug, MAIN_RUN);
    // Every disputed marking is the frozen owner-gate label, never true/false.
    for (const c of report.cases) {
      assert.ok(
        c.caseGoldValidity === DISPUTED_SOL_GOLD_STATUS || c.caseGoldValidity === NON_DISPUTED_GOLD_STATUS,
        "case gold is one of the two neutral labels — never a truth verdict",
      );
    }
    // structuralScreen.claimsScanned is 0 across the whole preserved corpus.
    for (const c of report.cases) {
      assert.equal(c.sourceRelated.structuralClaimsScanned, 0, `${c.caseId} structural claims scanned must be 0`);
    }
    // Views exist for all three run dirs.
    assert.ok(report.summary.totalCaseJudgeViews > 100, "many case×judge views loaded");
    assert.ok(report.runDirs.every((r) => r.present), "all three preserved run dirs present");
  },
);
