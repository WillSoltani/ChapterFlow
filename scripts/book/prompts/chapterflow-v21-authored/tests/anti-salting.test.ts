/**
 * Anti-salting blocker calibration (AS1/AS2/AS4). These are BLOCKER gates against the
 * May 2026 salting incident, so each test asserts BOTH that real salt still fires (the
 * threat model is adversarial — don't open a false-negative hole) AND that the domain-prose
 * false-positive class that hard-halted unattended publishes no longer fires.
 */

import assert from "node:assert/strict";

import { test } from "./harness.js";
import {
  checkChapterIdentifierTokens,
  checkChapterJammedNouns,
  checkBookQuizPromptTemplates,
} from "../src/critics/antiSalting.js";

const chWith = (fields: Record<string, unknown>): any => ({ chapterId: "zz-ch01", number: 1, ...fields });
const has = (findings: Array<{ checkId?: string }>, code: string): boolean =>
  findings.some((f) => String(f.checkId).startsWith(code));
const onlyAS = (findings: Array<{ checkId?: string }>, code: string) =>
  findings.filter((f) => String(f.checkId).startsWith(code));

// ── AS1 — identifier-token injection ─────────────────────────────────────────
test("AS1 fires on lowercase q salt, and on ex/card/chapter ids in ANY case", () => {
  assert.ok(has(checkChapterIdentifierTokens(chWith({ hook: "map q7 person map studio critique wants the safe sketch." })), "AS1"));
  assert.ok(has(checkChapterIdentifierTokens(chWith({ hook: "The ex1 example and card2 note got jammed into the line." })), "AS1"));
  // ex / card / chapter have no domain collision, so an uppercased leak is caught too.
  assert.ok(has(checkChapterIdentifierTokens(chWith({ hook: "Notice how the EX1 line reframes the scene." })), "AS1"));
  assert.ok(has(checkChapterIdentifierTokens(chWith({ hook: "Keep the CARD2 note handy when you practice." })), "AS1"));
});

test("AS1 does NOT fire on uppercase domain tokens (the calibration: quarters, vertebrae, Audi Q7, p53)", () => {
  for (const hook of [
    "He fractured his C3 vertebra in the fall.",
    "Q3 earnings beat the forecast by a wide margin.",
    "He test-drove the Audi Q7 last weekend.",
    "The P50 latency dropped after a week of training.",
    "They closed a Series C2 round that spring.",
    "The p53 gene suppresses tumor growth.",
    "Spot P3 on the EEG marks the surprise.",
  ]) {
    assert.deepEqual(onlyAS(checkChapterIdentifierTokens(chWith({ hook })), "AS1"), [], `AS1 false-fired on: ${hook}`);
  }
});

// ── AS2 — jammed proper nouns ────────────────────────────────────────────────
test("AS2 still fires on jammed INVENTED proper nouns — including 3+-hump jams (regex-hole fix)", () => {
  assert.ok(has(checkChapterJammedNouns(chWith({ hook: "MaplefieldBridgeton was quiet at ten." })), "AS2"));
  assert.ok(has(checkChapterJammedNouns(chWith({ hook: "She wrote HarborlineNorthwell on the form." })), "AS2"));
  // Three jammed humps used to evade (trailing \b failed after the 2nd hump) — must fire now.
  assert.ok(has(checkChapterJammedNouns(chWith({ hook: "He scrawled MaplefieldBridgetonHarborline across the top." })), "AS2"), "3+-hump jam must fire");
});

test("AS2 does NOT fire on real CamelCase brands; a real jam alongside a brand still fires", () => {
  for (const hook of [
    "She built the PowerPoint deck overnight.",
    "They moved every doc to SharePoint last quarter.",
    "The OpenTable reservation held through the rush.",
    "He charges a LandRover in the driveway.",
    "Her team migrated to SalesForce last quarter.",
    "The BlackBerry keyboard defined an era.",
    "AstraZeneca filed the patent in spring.",
  ]) {
    assert.deepEqual(onlyAS(checkChapterJammedNouns(chWith({ hook })), "AS2"), [], `AS2 false-fired on brand: ${hook}`);
  }
  // A brand FIRST, then a genuine salt artifact in the same field — must still fire.
  assert.ok(has(checkChapterJammedNouns(chWith({ hook: "She opened PowerPoint, then typed HarborlineNorthwell by mistake." })), "AS2"));
});

// ── AS4 — positional quiz template substitution ──────────────────────────────
const quizCh = (n: number, prompt: string): any => ({ chapterId: `zz-ch0${n}`, number: n, quiz: { questions: [{ questionId: "q01", prompt }] } });

test("AS4 still fires on a long shared skeleton with substituted markers (Covey class)", () => {
  const skeleton = (tok: string) => `If the ${tok} family calendar rewards push through fatigue which plan best serves ${tok} balance today`;
  const chapters = [quizCh(1, skeleton("map")), quizCh(2, skeleton("goose")), quizCh(3, skeleton("mission"))];
  assert.ok(has(checkBookQuizPromptTemplates(chapters), "AS4"));
});

test("AS4 fires on a SHORT single-marker skeleton at the floor (7 shared words — the probe's evasion)", () => {
  // "After <name>'s setback which step best restores momentum?" shares 7 words; floor 7
  // catches it (floor 8 had let it through). No downstream backstop covers quiz-prompt text.
  const p = (name: string) => `After ${name}'s setback which step best restores momentum?`;
  const chapters = [quizCh(1, p("Reyes")), quizCh(2, p("Patel")), quizCh(3, p("Nguyen"))];
  assert.ok(has(checkBookQuizPromptTemplates(chapters), "AS4"), "a 7-shared marker skeleton must fire at floor 7");
});

test("AS4 does NOT fire on a short distinct-concept recall stem repeated across chapters", () => {
  const concepts = ["anchoring", "framing", "priming", "discounting", "nudging"];
  const chapters = concepts.map((c, i) => quizCh(i + 1, `What is the main idea behind ${c}?`));
  assert.deepEqual(onlyAS(checkBookQuizPromptTemplates(chapters), "AS4"), [], "AS4 false-fired on distinct-concept stems");
});
