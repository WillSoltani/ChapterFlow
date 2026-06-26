/**
 * Outcome-variety critic (C28) — a chapter whose every example resolves in clean,
 * instant success reads as survivorship gloss.
 *
 * THE DEFECT (#14, deterministic half). Across a chapter's example slate, every
 * scene wins on the first try — the manager "approves that afternoon", the deal
 * "closes on Friday", the habit "sticks within a week". No scene shows a failed
 * first attempt, a relapse, a setback, or a cost, and no outcome stays partial. A
 * reader whose own first attempt does NOT succeed is left feeling like the failure.
 *
 * THE DISCRIMINATOR. C28 fires on a CHAPTER only when (1) it carries ≥3 examples
 * and (2) ZERO of them carry any outcome friction — no friction-bearing format
 * (mistake_recovery/postmortem) and no failure/relapse/setback/cost/conflict/
 * partial cue in any scenario or whyItMatters. Condition (2) is the gold false-
 * positive guard (mirrors C26's grounding guard): the reference books and the
 * synthetic gold are saturated with friction vocabulary, so they never trip C28.
 *
 * C28 is MINOR (advisory, shadow): a STRENGTHEN signal that surfaces as QC debt;
 * the gating judgment on outcome realism stays with the semantic bar (WT-E). This
 * suite is the executable calibration contract — the all-success true positive
 * FIRES, and the gold corpus stays at ZERO.
 *
 * Finding #14 has no single verbatim bad SPAN: the defect is the ABSENCE of
 * friction across the whole slate (REGRESSIONS.f14 is an empty SEED). So the true
 * positives here are constructed all-success chapters, not lifted lines.
 */

import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "fs";
import { resolve } from "path";

import { test, skip } from "./harness.js";
import { makeChapter, goldChapterFiles, STATE_CHAPTERS } from "./helpers.js";
import {
  exampleFrictionReason,
  detectUniformSuccess,
  checkOutcomeVariety,
} from "../src/critics/outcomeVariety.js";
import { runShipGate } from "../src/critics/finalGate.js";
import type { ChapterV21, ExampleV21 } from "../src/types.js";

// ── All-success example slate (the true-positive defect) ──────────────────────
// Six scenes, every one a frictionless instant win. Each scenario AND whyItMatters
// is scrubbed of failure/cost/conflict vocabulary, and every format is a non-
// friction format. This is the "survivorship gloss" chapter C28 must catch.
const SUCCESS_FORMATS = ["decision_point", "vignette", "predict_reveal", "vignette", "decision_memo", "scene"];
const SUCCESS_SCENES: Array<{ scenario: string; whyItMatters: string }> = [
  {
    scenario:
      "On Tuesday morning Carol emails her manager about the new schedule, and he approves it that same afternoon. By Friday the whole team has adopted it, and everyone is delighted with how the week now flows.",
    whyItMatters: "A quick yes early in the week lets the team settle into the new rhythm right away.",
  },
  {
    scenario:
      "David opens the budgeting app on Sunday evening and sets his savings goal. Within a month he has hit it exactly, and the celebration dinner is already booked for the family.",
    whyItMatters: "Naming a clear number makes the goal feel reachable from the very first day.",
  },
  {
    scenario:
      "Lena pitches the idea in Monday's meeting, and the room agrees instantly. The project ships two weeks later to glowing reviews from every reader who tries it.",
    whyItMatters: "When the framing lands cleanly, a good idea carries the room on its own.",
  },
  {
    scenario:
      "Marcus starts the morning run on the first day and keeps it up effortlessly. A month on, it is simply part of who he is, and his friends ask how he made it look so easy.",
    whyItMatters: "An easy start makes the new routine feel automatic almost immediately.",
  },
  {
    scenario:
      "Priya sends the proposal Thursday and the client signs by lunch. The deal closes the very next week, and the whole office gathers to toast the win.",
    whyItMatters: "A clean proposal earns a fast yes and frees everyone to move forward together.",
  },
  {
    scenario:
      "Theo plants the garden in spring and every seed sprouts. By summer the beds are full, the harvest is plentiful, and the neighbors stop to admire the rows.",
    whyItMatters: "A good first planting rewards the gardener with a generous and abundant season.",
  },
];

/** makeChapter, but with the six all-success scenes swapped in (and the default
 *  friction-bearing whyItMatters/format overwritten so the slate is uniform). */
function allSuccessChapter(bookId: string, n: number): ChapterV21 {
  const ch = makeChapter(bookId, n);
  ch.examples = ch.examples.slice(0, 6).map((ex, i) => ({
    ...ex,
    planSpec: { ...ex.planSpec, format: SUCCESS_FORMATS[i] },
    scenario: SUCCESS_SCENES[i].scenario,
    whyItMatters: SUCCESS_SCENES[i].whyItMatters,
    whatToDo: "Make the ask plainly and follow through on the very next step.",
  }));
  return ch;
}

// ── Unit: per-example friction reason (pure detector) ─────────────────────────

test("C28: exampleFrictionReason grounds an example by friction-bearing format", () => {
  const base = allSuccessChapter("zz-c28-fmt", 1).examples[0];
  for (const format of ["mistake_recovery", "postmortem"]) {
    const reason = exampleFrictionReason({ ...base, planSpec: { ...base.planSpec, format } });
    assert.ok(reason?.startsWith("format:"), `expected a format-friction reason for ${format}, got ${reason}`);
  }
});

test("C28: exampleFrictionReason grounds an example by failure/cost prose (before_after-with-cost)", () => {
  const base = allSuccessChapter("zz-c28-prose", 1).examples[0];
  const withCost: ExampleV21 = {
    ...base,
    planSpec: { ...base.planSpec, format: "before_after" },
    scenario: "Her first attempt failed and the launch slipped a week before it finally landed.",
  };
  const reason = exampleFrictionReason(withCost);
  assert.ok(reason?.startsWith("cost:"), `expected a cost reason, got ${reason}`);
});

test("C28: exampleFrictionReason returns null for a clean instant-success example", () => {
  const clean = allSuccessChapter("zz-c28-clean", 1).examples[0];
  assert.equal(exampleFrictionReason(clean), null);
});

test("C28: a before_after example WITHOUT any cost prose is not grounded by format alone", () => {
  // before_after only counts WITH a cost; a frictionless before/after is still a clean win.
  const base = allSuccessChapter("zz-c28-ba", 1).examples[0];
  const reason = exampleFrictionReason({ ...base, planSpec: { ...base.planSpec, format: "before_after" } });
  assert.equal(reason, null, `before_after with no cost prose must not ground, got ${reason}`);
});

// ── Unit: chapter-level detector ──────────────────────────────────────────────

test("C28: detectUniformSuccess fires on an all-success chapter", () => {
  const hit = detectUniformSuccess(allSuccessChapter("zz-c28-tp", 2).examples);
  assert.ok(hit, "expected a uniform-success hit");
  assert.equal(hit!.exampleCount, 6);
});

test("C28: detectUniformSuccess stays silent when ONE scene carries friction", () => {
  const ch = allSuccessChapter("zz-c28-one", 3);
  ch.examples[2].planSpec.format = "mistake_recovery"; // one friction-bearing format is enough
  assert.equal(detectUniformSuccess(ch.examples), null);
});

test("C28: detectUniformSuccess does not fire on a too-small slate (<3 examples)", () => {
  const ch = allSuccessChapter("zz-c28-small", 4);
  ch.examples = ch.examples.slice(0, 2); // 2 all-success scenes — too few to expect variety
  assert.equal(detectUniformSuccess(ch.examples), null);
});

// ── Critic + ship-gate wiring ─────────────────────────────────────────────────

test("C28: checkOutcomeVariety flags an all-success chapter as a single minor", () => {
  const findings = checkOutcomeVariety(allSuccessChapter("zz-c28-critic", 5));
  assert.equal(findings.length, 1, "expected exactly one chapter-level finding");
  assert.equal(findings[0].checkId, "C28.uniform_success");
  assert.equal(findings[0].severity, "minor", "C28 must be a minor (advisory)");
});

test("C28: an unplanted makeChapter is outcome-variety clean", () => {
  // makeChapter's whyItMatters names an "expensive rework cycle" — a cost cue —
  // so its slate carries outcome friction and C28 stays silent.
  assert.equal(checkOutcomeVariety(makeChapter("zz-c28-base", 3)).length, 0);
});

test("C28: a chapter with a single mistake_recovery scene does not fire (MUST NOT)", () => {
  const ch = allSuccessChapter("zz-c28-mnf-fmt", 6);
  ch.examples[0].planSpec.format = "mistake_recovery";
  assert.equal(checkOutcomeVariety(ch).length, 0);
});

test("C28: a chapter with one failed-first-attempt scene does not fire (MUST NOT)", () => {
  const ch = allSuccessChapter("zz-c28-mnf-prose", 7);
  ch.examples[1].scenario =
    "Nadia's first pitch failed and the client rejected the deck, so she reworked it and won the account on her next try.";
  assert.equal(checkOutcomeVariety(ch).length, 0);
});

test("C28: the ship gate surfaces an all-success chapter as a minor (wiring + severity)", () => {
  const ch = allSuccessChapter("zz-c28-gate", 8);
  const report = runShipGate(ch);
  assert.ok(
    report.minors.some((m) => m.catalogId === "C28.uniform_success"),
    `expected a C28 ship-gate minor; got minors ${report.minors.map((m) => m.catalogId).join(", ")}`,
  );
  // Advisory: a C28 minor must never flip the gate or land among the blockers.
  assert.ok(!report.blockers.some((b) => b.catalogId === "C28.uniform_success"), "C28 must not be a blocker");
});

// ── Gold-corpus zero-FP calibration ───────────────────────────────────────────

test("C28: synthetic gold corpus has ZERO uniform-success findings", () => {
  for (const { bookId, files } of goldChapterFiles()) {
    for (const file of files) {
      const ch = JSON.parse(readFileSync(file, "utf8")) as ChapterV21;
      const hits = checkOutcomeVariety(ch);
      assert.equal(
        hits.length,
        0,
        `C28 false positive on synthetic gold ${bookId} ${ch.chapterId}: ${hits.map((h) => h.message.slice(0, 110)).join(" | ")}`,
      );
    }
  }
});

for (const bookId of ["daring-greatly", "start-with-why"]) {
  const files = existsSync(STATE_CHAPTERS)
    ? readdirSync(STATE_CHAPTERS).filter((f) => f.startsWith(`${bookId}-ch`) && f.endsWith(".v21-native.chapter.json"))
    : [];
  if (files.length === 0) {
    skip(`C28 gold zero-FP: ${bookId}`, `no ${bookId} chapters in state/chapters/ on this machine`);
    continue;
  }
  test(`C28: real gold corpus ${bookId} (${files.length} ch) emits ZERO uniform-success findings`, () => {
    const offenders: string[] = [];
    for (const f of files) {
      const ch = JSON.parse(readFileSync(resolve(STATE_CHAPTERS, f), "utf8")) as ChapterV21;
      for (const hit of checkOutcomeVariety(ch)) {
        offenders.push(`${ch.chapterId}: ${hit.message.slice(0, 120)}`);
      }
    }
    assert.equal(offenders.length, 0, `C28 advisory false-positives on reference-quality ${bookId} (miscalibrated):\n${offenders.join("\n")}`);
  });
}
