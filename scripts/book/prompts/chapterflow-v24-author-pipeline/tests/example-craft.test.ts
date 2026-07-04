/**
 * C29 — example-craft (thin / manufactured example) critic (Phase 5, 2026-07-04).
 *
 * The start-with-why gold run halted in part on chapters whose examples read as
 * slot-fillers: a vague unnamed blob with no cause→effect movement, restating
 * the lesson instead of dramatizing a decision. C29 is the DETERMINISTIC,
 * repair-routable signal orthogonal to the semantic reader judgment. It fires
 * ONLY when a scenario has BOTH no concrete specificity (no proper noun / number
 * / clock-time) AND no causal-movement connective — the both-absent guard keeps
 * it ADVISORY and zero-FP on the shipped corpus (measured: 11,119 examples, 0
 * hits). These tests pin the discriminator and the corpus cleanliness.
 */

import assert from "node:assert/strict";
import { readFileSync } from "fs";

import { test } from "./harness.js";
import { labelCleanCorpusChapterFiles } from "./helpers.js";
import { checkExampleCraft } from "../src/critics/exampleCraft.js";
import type { ChapterV21, Example } from "../src/types.js";

function chapterWith(...scenarios: string[]): ChapterV21 {
  return {
    examples: scenarios.map((scenario, i) => ({
      exampleId: `ex${String(i + 1).padStart(2, "0")}`,
      title: "t",
      scenario,
    })) as unknown as Example[],
  } as ChapterV21;
}

test("C29 fires on a thin blob — no name, no number, no movement, only the lesson restated", () => {
  const ch = chapterWith(
    "A leader wants the team to care about the mission and tries to communicate the purpose clearly to everyone involved.",
  );
  const findings = checkExampleCraft(ch);
  assert.equal(findings.length, 1, "the nameless, numberless, movement-free blob is flagged");
  assert.equal(findings[0].severity, "minor", "ADVISORY — never blocks");
  assert.match(findings[0].message, /slot-filler placeholder/i);
});

test("C29 does NOT fire when the scenario names a specific actor (even at sentence start)", () => {
  const ch = chapterWith(
    "Aravind watches his patient grip the dynamometer, and the leader beside him wants the team to care about the shared goal.",
  );
  assert.equal(checkExampleCraft(ch).length, 0, "a named protagonist is concrete grounding — including one that opens the sentence");
});

test("C29 does NOT fire when the scenario carries a number or a spelled-out count", () => {
  assert.equal(checkExampleCraft(chapterWith("The team missed the target for three quarters and finally reset the plan.")).length, 0, "spelled cardinal counts");
  assert.equal(checkExampleCraft(chapterWith("The team missed the target for 3 quarters running.")).length, 0, "a digit counts");
});

test("C29 does NOT fire when the scenario shows cause→effect movement", () => {
  const ch = chapterWith(
    "The handoff named no owner, so each follow-up decayed until the review collapsed.",
  );
  assert.equal(checkExampleCraft(ch).length, 0, "a decision-and-consequence (so/until) is real teaching movement");
});

test("C29 flags each thin example independently and skips grounded siblings", () => {
  const ch = chapterWith(
    "A manager hopes the group will simply want the outcome and states it plainly.", // thin
    "Because the deadline slipped twice, Dana rebuilt the plan around one named owner.", // grounded + movement
    "The idea matters and people should embrace it wholeheartedly for real change.", // thin
  );
  const ids = checkExampleCraft(ch).map((f) => f.message.split(" ")[0]);
  assert.deepEqual(ids.sort(), ["ex01", "ex03"], "only the two thin scenarios flag; the grounded one is clean");
});

test("C29 zero-FP pin on the clean gold corpus chapters", () => {
  let checked = 0;
  for (const fixture of labelCleanCorpusChapterFiles()) {
    for (const file of fixture.files) {
      const chapter = JSON.parse(readFileSync(file, "utf8")) as ChapterV21;
      if (!chapter?.examples?.length) continue;
      checked++;
      const findings = checkExampleCraft(chapter);
      assert.equal(findings.length, 0, `${file}: C29 must stay zero-FP on the clean corpus (${findings.map((f) => f.evidence).join(" | ")})`);
    }
  }
  assert.ok(checked > 0, "the clean-corpus fixture set resolved to at least one chapter");
});
