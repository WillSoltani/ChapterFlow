/**
 * Plain-language critic (E7) tests — simple vocabulary + short sentences across
 * all reader-facing fields. Guards two things at once: that it CATCHES jargon
 * and run-ons, and that it does NOT false-positive on legitimate domain
 * vocabulary or normal-length sentences (the calibration that lets it ship as a
 * non-noisy gate).
 */

import assert from "node:assert/strict";

import { checkPlainLanguage, checkPlainVocabulary, checkSentenceLength } from "../src/critics/plainLanguage.js";
import type { ChapterV21 } from "../src/types.js";
import { test } from "./harness.js";

test("E7 flags a needlessly-complex word and names the plain swap", () => {
  const f = checkPlainVocabulary("We utilize the framework to facilitate the rollout.", "fastRead");
  assert.ok(f.some((x) => /utiliz/i.test(x.message) && /→ use/.test(x.message)), JSON.stringify(f.map((x) => x.message)));
  assert.ok(f.some((x) => /facilitat/i.test(x.message)), "should also catch 'facilitate'");
  assert.ok(f.every((x) => x.severity === "minor"), "vocab swaps are advisory minors");
});

test("E7 does NOT flag clean plain prose or legitimate domain terms (no false positives)", () => {
  assert.deepEqual(checkPlainVocabulary("She picked one task and did it before lunch.", "hook"), []);
  // Domain vocabulary that must be left alone — these are not in the swap list.
  const domain = "The stakeholder reviewed governance, the dependency, and intrinsic motivation.";
  assert.deepEqual(checkPlainVocabulary(domain, "deepRead"), [], "domain terms must not be flagged");
});

test("E7 swaps the curated coined academic NOUN-PHRASE labels (editorial review)", () => {
  const cases: Array<[string, RegExp]> = [
    ["She is externalizing household cognition with the bowl.", /externali/i],
    ["This is bounded group management in action.", /bounded group/i],
    ["He never learned the channel norms for the team.", /channel norms/i],
    ["The denominator test challenges the leap from description to prescription.", /description to prescription/i],
  ];
  for (const [text, re] of cases) {
    const f = checkPlainVocabulary(text, "deepRead");
    assert.ok(f.some((x) => re.test(x.message) && x.severity === "minor"), `should swap in: ${text}\n${JSON.stringify(f.map((x) => x.message))}`);
  }
});

test("E7 does NOT flag the plain rephrasings or unrelated common words", () => {
  // The swap targets are specific coined compounds, not their plain components.
  assert.deepEqual(checkPlainVocabulary("She uses her space to remember for her.", "deepRead"), []);
  assert.deepEqual(checkPlainVocabulary("The group met to manage the schedule.", "deepRead"), []);
});

test("E7 flags a run-on prose sentence as a major and lets a short one pass", () => {
  const runOn =
    "When the team decided to protect the public date they also escalated the interface risk, added a new reviewer to every vendor call, and moved acceptance testing ahead of the demo rehearsal because nobody wanted surprises.";
  const f = checkSentenceLength(runOn, "breakdown.fullRead");
  assert.ok(f.some((x) => x.severity === "major" && /word sentence/.test(x.message)), JSON.stringify(f));
  assert.deepEqual(checkSentenceLength("She wrote the plan. He read it twice.", "breakdown.fullRead"), []);
});

test("E7 holds one-liner fields to a tighter cap than prose", () => {
  // 26 words — fine as prose (≤34), too dense for a one-liner headline (>24).
  const line = "The point here is simply that you should always try hard to write the kind of sentence a tired reader can finish without ever stopping once.";
  assert.deepEqual(checkSentenceLength(line, "hook"), [], "26 words is under the prose cap");
  const head = checkSentenceLength(line, "hook", { headline: true });
  assert.ok(head.some((x) => x.severity === "major" && /one-liner/.test(x.message)), JSON.stringify(head));
});

test("checkPlainLanguage scans across fields (quiz/cards/examples), not just breakdown", () => {
  const chapter = {
    hook: "Start small.",
    keyTakeaway: "Do the smallest version today.",
    breakdown: { fastRead: "A clean line.", deepRead: "Another clean line.", fullRead: "A third clean line." },
    examples: [{ title: "Maya ships the fix", scenario: "We utilize a checklist.", whatToDo: "Use it.", whyItMatters: "It helps." }],
    quiz: { questions: [{ prompt: "What should you do?", choices: ["Leverage the plan", "Wait", "Stop"], explanation: "Pick the first." }] },
    reviewCards: [{ front: "What is the rule?", back: "Do the small version." }],
    implementationPlan: { ifThenPlans: [{ plan: "If stuck, then start." }], twentyFourHourChallenge: "Try once.", weeklyPractice: "Repeat." },
  } as unknown as ChapterV21;
  const f = checkPlainLanguage(chapter);
  assert.ok(f.some((x) => /examples\[0\]\.scenario/.test(x.message) && /utiliz/i.test(x.message)), "scans example scenario");
  assert.ok(f.some((x) => /quiz\[0\]\.choices/.test(x.message) && /leverag/i.test(x.message)), "scans quiz choices");
});
