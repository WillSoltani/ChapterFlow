/**
 * experiencePlan gate coverage (EXP1/EXP2/EXP3 chapter-level + EXP10/EXP11 book-
 * level). The calibration claim is structural: every EXP check runs only when
 * chapter.experiencePlan is present, so a chapter/book without the field emits
 * zero EXP findings. The positive cases prove each check fires on a real defect.
 */

import assert from "node:assert/strict";

import { test } from "./harness.js";
import { makeChapter } from "./helpers.js";
import { runShipGate, type GateFinding } from "../src/critics/finalGate.js";
import { runBookGate } from "../src/critics/bookGate.js";
import type { ExperiencePlanV21 } from "../src/types.js";

/** A clean, gate-passing experiencePlan. `seed` varies the wording so two
 *  chapters built from it do NOT collide on the convergence check. */
function validPlan(seed: string): ExperiencePlanV21 {
  return {
    failureRecovery: {
      normalizingLine: `Reaching for the ${seed} feed is your focus trading a hard task for a quicker, surer reward.`,
      cueQuestion: `What pressure pushed you toward the ${seed} just now?`,
      options: [
        `Move the ${seed} an arm's length away before the next work block begins.`,
        `Say the task out loud, then write its very first line.`,
      ],
      repairLine: `Close the ${seed}, set a short timer, and reopen the work where you left it before the pull took over.`,
    },
    transferPrompt: {
      prompt: `Where else does trading a hard ${seed} task for a quick reward quietly cost you over a week?`,
      contexts: [
        "Choosing which overdue bill to open first",
        "Deciding when to start a hard conversation at home",
      ],
    },
  };
}

function allFindings(report: ReturnType<typeof runShipGate>): GateFinding[] {
  return [...report.blockers, ...report.majors, ...report.minors];
}
function expFindings(report: ReturnType<typeof runShipGate>): GateFinding[] {
  return allFindings(report).filter((f) => f.unit === "experiencePlan");
}

test("absent experiencePlan emits zero experiencePlan findings (calibration)", () => {
  const report = runShipGate(makeChapter("zz-exp-absent", 1));
  assert.deepEqual(expFindings(report), [], "a chapter without the field must not surface any experiencePlan finding");
});

test("a valid experiencePlan emits zero experiencePlan findings", () => {
  const report = runShipGate(makeChapter("zz-exp-valid", 1, { overrides: { experiencePlan: validPlan("phone") } }));
  assert.deepEqual(
    expFindings(report),
    [],
    `valid plan should be clean; got: ${expFindings(report).map((f) => `${f.catalogId}:${f.message}`).join(" | ")}`,
  );
});

test("EXP1 blocks bad cardinality (options must be 2-4)", () => {
  const plan = validPlan("inbox");
  plan.failureRecovery!.options = ["only a single repair move, which is too few"];
  const report = runShipGate(makeChapter("zz-exp-card", 1, { overrides: { experiencePlan: plan } }));
  assert.ok(
    report.blockers.some((f) => f.catalogId === "EXP1.structure"),
    "options.length === 1 must raise an EXP1.structure blocker",
  );
});

test("EXP1 blocks an empty required subfield", () => {
  const plan = validPlan("inbox");
  plan.transferPrompt!.prompt = "   ";
  const report = runShipGate(makeChapter("zz-exp-empty", 1, { overrides: { experiencePlan: plan } }));
  assert.ok(report.blockers.some((f) => f.catalogId === "EXP1.structure"), "empty transferPrompt.prompt must block");
});

test("EXP3 flags a self-compassion cliché in normalizingLine", () => {
  const plan = validPlan("phone");
  plan.failureRecovery!.normalizingLine = "Honestly, you're not broken, this just happens to all of us when the day gets long.";
  const report = runShipGate(makeChapter("zz-exp-cliche", 1, { overrides: { experiencePlan: plan } }));
  assert.ok(
    report.majors.some((f) => f.catalogId === "EXP3.normalizing_cliche"),
    "\"you're not broken\" must raise EXP3",
  );
});

test("EXP2 flags an out-of-bounds subfield length (minor)", () => {
  const plan = validPlan("phone");
  plan.failureRecovery!.normalizingLine = "Too short."; // non-empty (so not EXP1) but < 60 chars
  const report = runShipGate(makeChapter("zz-exp-len", 1, { overrides: { experiencePlan: plan } }));
  assert.ok(report.minors.some((f) => f.catalogId === "EXP2.length"), "a 10-char normalizingLine must raise EXP2");
});

test("shared register hygiene runs on experiencePlan strings (em dash → B5)", () => {
  const plan = validPlan("phone");
  plan.transferPrompt!.prompt = "Where else does this cost you — at home, at work, everywhere you rush through the day?";
  const report = runShipGate(makeChapter("zz-exp-emdash", 1, { overrides: { experiencePlan: plan } }));
  assert.ok(
    report.blockers.some((f) => f.catalogId === "B5" && f.unit === "experiencePlan"),
    "an em dash inside an experiencePlan string must be caught by the shared register check",
  );
});

test("EXP10/EXP11: identical lines across chapters converge (book gate)", () => {
  const shared = validPlan("phone"); // same object → identical normalizingLine + prompt in both chapters
  const ch1 = makeChapter("zz-exp-conv", 1, { overrides: { experiencePlan: shared } });
  const ch2 = makeChapter("zz-exp-conv", 2, { overrides: { experiencePlan: shared } });
  const report = runBookGate("zz-exp-conv", [ch1, ch2]);
  assert.ok(
    report.findings.some((f) => f.catalogId === "EXP10.normalizing_line_convergence"),
    "identical normalizingLine across 2 chapters must raise EXP10",
  );
  assert.ok(
    report.findings.some((f) => f.catalogId === "EXP11.transfer_prompt_convergence"),
    "identical transferPrompt.prompt across 2 chapters must raise EXP11",
  );
});

test("EXP10/EXP11 do not fire on distinct lines, and not at all without the field", () => {
  const distinct = [
    makeChapter("zz-exp-distinct", 1, { overrides: { experiencePlan: validPlan("phone") } }),
    makeChapter("zz-exp-distinct", 2, { overrides: { experiencePlan: validPlan("ledger") } }),
  ];
  const distinctReport = runBookGate("zz-exp-distinct", distinct);
  assert.ok(
    !distinctReport.findings.some((f) => f.catalogId.startsWith("EXP1")),
    "distinct lines must not converge",
  );

  const plain = [makeChapter("zz-exp-plain", 1), makeChapter("zz-exp-plain", 2)];
  const plainReport = runBookGate("zz-exp-plain", plain);
  assert.ok(
    !plainReport.findings.some((f) => f.catalogId.startsWith("EXP")),
    "a book without experiencePlan must emit zero EXP findings",
  );
});
