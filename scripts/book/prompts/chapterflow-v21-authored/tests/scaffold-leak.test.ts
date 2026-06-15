import assert from "node:assert/strict";

import { test } from "./harness.js";
import { checkScaffoldLeak } from "../src/critics/scaffoldLeak.js";

function chapterWith(scenario: string, domain = "office desk argument"): any {
  return {
    chapterId: "zz-fixture-ch01",
    number: 1,
    hook: "A clean hook.",
    examples: [{ scenario, planSpec: { domain } }],
  };
}

test("SL1 blocks underscore format-tag tokens but not real English words", () => {
  const leak = checkScaffoldLeak(chapterWith("Mara opens with a coach_talk about the budget."));
  assert.ok(leak.some((f) => f.checkId === "SL1.format_tag_leak" && f.severity === "blocker"), JSON.stringify(leak));
  // Single-word formats are real English and must NOT fire.
  const clean = checkScaffoldLeak(chapterWith("She ran an audit, then the scene shifted to a tense dialogue."));
  assert.deepEqual(clean.filter((f) => f.checkId === "SL1.format_tag_leak"), []);
});

test("SL2 flags a Title-Case paste of the planSpec.domain", () => {
  const f = checkScaffoldLeak(chapterWith(
    "Jenna reviews Peyton's Teacher Setting Terms For grade-update calls before the meeting.",
    "teacher setting terms for grade-update calls",
  ));
  assert.ok(f.some((x) => x.checkId === "SL2.domain_label_leak" && x.severity === "major"), JSON.stringify(f));
});

test("SL3 flags source-notes glowing on a screen, not an incoming name/message", () => {
  const bad = checkScaffoldLeak(chapterWith("The town-hall notes about the dispute glow on his phone while he waits."));
  assert.ok(bad.some((x) => x.checkId === "SL3.spectator_prop"), JSON.stringify(bad));
  // Reverse word order ("phone glowed with the notes") must also fire.
  const reverse = checkScaffoldLeak(chapterWith("His phone glowed with the case notes about the dispute as he waited."));
  assert.ok(reverse.some((x) => x.checkId === "SL3.spectator_prop"), JSON.stringify(reverse));
  const ok = checkScaffoldLeak(chapterWith("His sister's name glows on the phone before the doctor calls."));
  assert.deepEqual(ok.filter((x) => x.checkId === "SL3.spectator_prop"), []);
});

test("a clean scenario produces no scaffold-leak findings", () => {
  assert.deepEqual(checkScaffoldLeak(chapterWith("At the town hall, Hyun raises a hand and names the weekday-walk pattern aloud.")), []);
});
