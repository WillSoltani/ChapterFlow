/**
 * Example-register critic (C31) — Findings 3/5/13 (CF-B, 2026-07-08). An example
 * field that OPENS with a short evaluator question answered in the next clause
 * ("What changed? Separate expertise stopped passing as customer value.") reads as
 * an analyst card grading the scene rather than a scene narrated in its own voice.
 * HOM ch8 shipped eight such openers; ch7 uses imperative "Skip this and…" openers
 * and fires ZERO — proof the writer has a lived register available.
 *
 * This suite is the executable calibration contract: the ch8-style trio FIRES, the
 * ch7-style imperative fixture stays SILENT, a single opener stays under threshold,
 * a mid-field question is spared, and the gold corpus is pinned at its MEASURED count
 * (NOT zero — the tic leaked into start-with-why too; that is honest, and advisory).
 */

import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "fs";
import { resolve } from "path";

import { test, skip } from "./harness.js";
import { makeChapter, goldChapterFiles, labelCleanCorpusChapterFiles, STATE_CHAPTERS } from "./helpers.js";
import {
  opensWithAnsweredQuestion,
  findEvaluatorOpeners,
  checkExampleRegister,
} from "../src/critics/exampleRegister.js";
import { runShipGate } from "../src/critics/finalGate.js";
import type { ChapterV21, Example } from "../src/types.js";

function chapterWith(fields: Array<Partial<Pick<Example, "scenario" | "whatToDo" | "whyItMatters">>>): ChapterV21 {
  return {
    examples: fields.map((f, i) => ({
      exampleId: `ex${String(i + 1).padStart(2, "0")}`,
      title: "t",
      scenario: f.scenario ?? "A grounded scene where Dana rebuilds the plan around one named owner.",
      whatToDo: f.whatToDo ?? "Rebuild the plan around one named owner before the next handoff.",
      whyItMatters: f.whyItMatters ?? "A named owner is what keeps a slipped deadline from decaying into silence.",
    })) as unknown as Example[],
  } as unknown as ChapterV21;
}

// ── The pure detector ─────────────────────────────────────────────────────────

test("C31: opensWithAnsweredQuestion fires on a short evaluator opener answered next clause", () => {
  assert.equal(opensWithAnsweredQuestion("What changed? Separate expertise stopped passing as customer value."), true);
  assert.equal(opensWithAnsweredQuestion("Why does it work? The market answer travels through expertise first."), true);
  assert.equal(opensWithAnsweredQuestion("What nearly failed? Mission speed was about to pay twice for one skill."), true);
});

test("C31: opensWithAnsweredQuestion spares the non-tic constructions", () => {
  // (1) OPENING ONLY — a question mid-field never trips it.
  assert.equal(opensWithAnsweredQuestion("Dana rebuilt the plan. What changed? The deadline finally held."), false, "mid-field question is spared");
  // (2) ANSWERED — a hanging rhetorical question (nothing after) is a legitimate move.
  assert.equal(opensWithAnsweredQuestion("What changed?"), false, "unanswered rhetorical question is spared");
  assert.equal(opensWithAnsweredQuestion("What changed? And who noticed?"), false, "a question answered by another question is spared");
  // (3) SHORT — a long opening question is a real scene-setting beat, not the tic.
  assert.equal(opensWithAnsweredQuestion("What did the branch lead decide to do about the late demand signal that week? She escalated it."), false, "a >6-word opening question is a scene beat, not the tic");
  // Not even a question / not an interrogative opener.
  assert.equal(opensWithAnsweredQuestion("Skip this and a real branch signal becomes gossip."), false, "imperative opener");
  assert.equal(opensWithAnsweredQuestion("The answer is cost and sameness, so she attaches the local signal."), false, "declarative opener");
});

// ── The chapter-level critic ──────────────────────────────────────────────────

// Red-team fixture distilled from HOM ch8's example fields (copied snippets) — the
// eight evaluator openers across four examples' whatToDo/whyItMatters that MUST fire.
const HOM_CH8_FIELDS: Array<Partial<Pick<Example, "whatToDo" | "whyItMatters">>> = [
  { whatToDo: "Who needs the whole answer? Name the business answer before one function declares success.", whyItMatters: "What changed? Separate expertise stopped passing as customer value." },
  { whatToDo: "Where did capacity get copied? Keep the product aim, mark the duplicate resource, and send scarce expertise back.", whyItMatters: "What nearly failed? Mission speed was about to pay twice for one skill and lose professional depth." },
  { whatToDo: "What does skipping this cost? Delay hides inside polite agreement; name the decision, advice, and execution lines.", whyItMatters: "Where does the move break? If no one can answer at the check, hybrid strength has only moved the delay." },
  { whatToDo: "Why does it work? The market answer travels through expertise before it leaves; name the specialty that can veto speed.", whyItMatters: "What was paid? The old yes came back late, but the new answer no longer lets one function win alone." },
];

test("C31 fires ONCE on the HOM ch8-style evaluator-opener slate (≥3 fields)", () => {
  const findings = checkExampleRegister(chapterWith(HOM_CH8_FIELDS));
  assert.equal(findings.length, 1, "one advisory finding per chapter");
  assert.equal(findings[0].severity, "minor", "ADVISORY — never blocks");
  assert.equal(findEvaluatorOpeners(chapterWith(HOM_CH8_FIELDS)).length, 8, "all eight fields detected");
  assert.match(findings[0].message, /8 example field\(s\) open with a short evaluator question/);
  assert.match(findings[0].message, /analyst-card register/);
});

// The ch7-style imperative slate (copied from HOM ch7) that MUST NOT fire.
const HOM_CH7_FIELDS: Array<Partial<Pick<Example, "whatToDo" | "whyItMatters">>> = [
  { whatToDo: "Skip this and a real branch signal becomes gossip. State where central buying must answer.", whyItMatters: "Lose the branch signal and national scale acts blind. The answer slot stops the miss from staying invisible." },
  { whatToDo: "Skip the hard trade and local speed quietly beats common quality. Ask which buying choice saves cost.", whyItMatters: "Pay no cost here and savings become the only proof. The branch signal keeps shared buying honest." },
  { whatToDo: "Skip the interface and named roles become a gap. Say who sends branch data and where escalation goes.", whyItMatters: "Ignore the handoff and the customer feels the miss first. Write rules, data flow, and escalation first." },
];

test("C31 stays SILENT on the ch7-style imperative slate (better register, zero fire)", () => {
  assert.equal(checkExampleRegister(chapterWith(HOM_CH7_FIELDS)).length, 0);
});

test("C31 stays under threshold on a SINGLE evaluator opener", () => {
  const ch = chapterWith([
    { whatToDo: "What changed? The deadline finally held after Dana named an owner." },
    {}, {},
  ]);
  assert.equal(findEvaluatorOpeners(ch).length, 1, "one opener detected");
  assert.equal(checkExampleRegister(ch).length, 0, "one opener is a stylistic choice, not a template");
});

test("C31 does NOT fire on mid-field questions (opening position only)", () => {
  const ch = chapterWith([
    { whatToDo: "Dana rebuilt the plan. What changed? The deadline held." },
    { whyItMatters: "The team shipped late. Why? No one owned the date." },
    { scenario: "She reviewed the log. Was it drift? The numbers said yes, so she reset." },
  ]);
  assert.equal(checkExampleRegister(ch).length, 0, "mid-field questions are not the opening-position tic");
});

// ── Ship-gate wiring + severity ───────────────────────────────────────────────

test("C31: the ship gate surfaces the evaluator-register slate as a minor (wiring + severity)", () => {
  const ch = makeChapter("zz-c31-gate", 4);
  ch.examples[0].whatToDo = "What changed here? Pause the circuit work, re-run the voltage check, and compare it against yesterday's note before you continue the shift.";
  ch.examples[0].whyItMatters = "Why does it hold? Skipping the resistor comparison is how small signal drift becomes an expensive rework cycle that costs a full day later.";
  ch.examples[1].whatToDo = "What nearly failed? Stop the relay work, re-check the earliest divergent record, and confirm the totals with the prior owner before moving on.";
  const report = runShipGate(ch);
  assert.ok(
    report.minors.some((m) => m.catalogId === "C31.example_evaluator_register"),
    `expected a C31 ship-gate minor; got minors ${report.minors.map((m) => m.catalogId).join(", ")}`,
  );
  assert.ok(!report.blockers.some((b) => b.catalogId === "C31.example_evaluator_register"), "C31 must never be a blocker");
});

test("C31: an unplanted makeChapter (declarative example fields) is register-clean", () => {
  assert.equal(checkExampleRegister(makeChapter("zz-c31-clean", 3)).length, 0);
});

// ── Gold-corpus calibration pin (measured, not zero) ──────────────────────────

test("C31: synthetic gold corpus has ZERO evaluator-register findings", () => {
  for (const { bookId, files } of [...goldChapterFiles(), ...labelCleanCorpusChapterFiles()]) {
    for (const file of files) {
      const ch = JSON.parse(readFileSync(file, "utf8")) as ChapterV21;
      const hits = checkExampleRegister(ch);
      assert.equal(hits.length, 0, `C31 false positive on synthetic gold ${bookId} ${ch.chapterId}: ${hits.map((h) => h.message.slice(0, 110)).join(" | ")}`);
    }
  }
});

// The tracked v21 gold corpus is NOT zero: the evaluator-opener tic leaked into
// start-with-why (ch6 + ch12, eight fields each; ch8 has one field, below the
// 3-field threshold). This pin asserts the MEASURED count so a NEW gold chapter
// that adopts the tic is caught as a regression, while faithfully recording that
// the pattern predates HOM. daring-greatly is not present on every checkout (its
// state/chapters files are absent here), so it is skipped rather than guessed.
{
  const bookId = "start-with-why";
  const files = existsSync(STATE_CHAPTERS)
    ? readdirSync(STATE_CHAPTERS).filter((f) => f.startsWith(`${bookId}-ch`) && f.endsWith(".v21-native.chapter.json"))
    : [];
  if (files.length === 0) {
    skip(`C31 gold pin: ${bookId}`, `no ${bookId} chapters in state/chapters/ on this machine`);
  } else {
    test(`C31: real gold corpus ${bookId} (${files.length} ch) emits its MEASURED finding count`, () => {
      const firing: string[] = [];
      for (const f of files) {
        const ch = JSON.parse(readFileSync(resolve(STATE_CHAPTERS, f), "utf8")) as ChapterV21;
        if (checkExampleRegister(ch).length > 0) firing.push(ch.chapterId);
      }
      assert.equal(
        firing.length,
        2,
        `C31 gold-corpus pin drifted (expected 2 firing chapters — the pre-existing start-with-why tic; got ${firing.length}: ${firing.join(", ")})`,
      );
    });
  }
}
