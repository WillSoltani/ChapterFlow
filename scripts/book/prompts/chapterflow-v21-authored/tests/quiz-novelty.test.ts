/**
 * Quiz transfer & key-novelty (D4 / D6) — a quiz must test transfer to a NEW
 * situation, never recall of the chapter's own narrative.
 *
 * D4 = a prompt that asks the reader to RECALL a chapter character ("what did
 *      Deborah conclude…") instead of posing a fresh scenario. Implements catalog
 *      D4 (was prompt-only). MAJOR (shadow).
 * D6 = a keyed answer grounded in a same-chapter character the question never
 *      introduced ("the right answer is what Deborah did"). NEW id. MAJOR (shadow).
 *
 * This suite is the executable calibration contract (Shared Law §2 + §7):
 *  - TRUE POSITIVES fire (a gate that flags nothing is rejected), and
 *  - the GOLD corpus (daring-greatly + start-with-why — reference books a check must
 *    never flag) stays at ZERO. The naive form "the prompt/key names a chapter entity"
 *    fires on EVERY clean application question (gold gives each quiz question a named
 *    protagonist who also stars in an example, and keys reference those characters and
 *    the chapter's real cases constantly). The MUST-NOT-FIRE cases pin the discriminators
 *    that separate recall (the defect) from a fresh scenario that merely reuses a name.
 */

import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "fs";
import { resolve } from "path";

import { test, skip } from "./harness.js";
import { makeChapter, goldChapterFiles, STATE_CHAPTERS } from "./helpers.js";
import {
  recallFrameTargets,
  checkQuizScenarioNovelty,
  checkQuizKeyEntity,
} from "../src/critics/pedagogy.js";
import { runShipGate } from "../src/critics/finalGate.js";
import type { ChapterV21 } from "../src/types.js";

/** A chapter whose example cast contains "Deborah", with one recall-framed prompt
 *  (D4) and one fresh-scenario question whose KEY reaches back to that character (D6).
 *  Mirrors the reverted tiny-habits regen defect: ch5 asked "what did Deborah say" ×4
 *  and ch8 q07 keyed the answer to a chapter character. */
function plantedCastChapter(bookId = "zz-d4-plant"): ChapterV21 {
  const ch = makeChapter(bookId, 1);
  // Introduce a named character mid-sentence (the non-initial extractor sees her),
  // as a bare first name (not a full name) — the regen testimonial-character shape.
  ch.examples[0].scenario =
    "The team gathered after the review, and Deborah switched her morning cue. Watching Deborah track the relapse for a week reframed how the group thought about willpower.";
  // D4 — a recall-framed prompt about that character.
  ch.quiz.questions[0].prompt = "What did Deborah conclude about willpower after the week of tracking?";
  // D6 — a fresh-scenario prompt whose KEY reaches back to the chapter character.
  ch.quiz.questions[1].prompt = "A new shift lead faces a relapse after two clean weeks of a habit. Which move best protects the streak?";
  const k = ch.quiz.questions[1].correctIndex;
  ch.quiz.questions[1].choices[k] = "Copy what Deborah did and swap the cue before leaning on willpower again.";
  return ch;
}

// ── The pure recall-frame extractor (exhaustively unit-testable) ──────────────
test("D4: recallFrameTargets extracts the recalled name from each recall frame", () => {
  assert.deepEqual(recallFrameTargets("What did Deborah conclude about cues?"), ["Deborah"]);
  assert.ok(recallFrameTargets("According to Marcus, the rule holds.").includes("Marcus"));
  assert.ok(recallFrameTargets("In Sofia's story, the budget shifts overnight.").includes("Sofia"));
  assert.ok(recallFrameTargets("Helena's account shows the gap between words and deeds.").includes("Helena"));
  assert.ok(recallFrameTargets("Why did Tomas hesitate before the handoff?").includes("Tomas"));
  // A fresh application stem names nobody to recall.
  assert.deepEqual(recallFrameTargets("A museum curator weighs two pitches. What is her soundest next move?"), []);
  // A FULL NAME is a real cited entity, not an invented first-name character → rejected.
  assert.deepEqual(recallFrameTargets("What does Ben Comen illustrate about progress against self?"), []);
  assert.deepEqual(recallFrameTargets("According to Bill Gates, the model held."), []);
});

// ── True positives (the regen defect) ────────────────────────────────────────
test("D4: a recall-framed prompt about a chapter character fires (major)", () => {
  const ch = plantedCastChapter();
  const findings = checkQuizScenarioNovelty(ch);
  assert.ok(findings.some((f) => f.checkId === "D4.recycled_scenario"), "expected a D4 finding");
  assert.ok(findings.every((f) => f.severity === "major"), "D4 findings must be majors (shadow)");
});

test("D6: a keyed answer grounded in a chapter character (absent from the prompt) fires (major)", () => {
  const ch = plantedCastChapter();
  const findings = checkQuizKeyEntity(ch);
  assert.ok(findings.some((f) => f.checkId === "D6.key_references_chapter_entity"), "expected a D6 finding");
  assert.ok(findings.every((f) => f.severity === "major"), "D6 findings must be majors (shadow)");
});

// ── Must NOT fire (clean constructions a real book legitimately uses) ─────────
test("D4/D6: an unplanted makeChapter is transfer-clean", () => {
  const ch = makeChapter("zz-d-clean", 3);
  assert.equal(checkQuizScenarioNovelty(ch).length + checkQuizKeyEntity(ch).length, 0);
});

test("D4/D6: reusing a cast NAME as the actor of a FRESH scenario is clean (no recall frame)", () => {
  const ch = makeChapter("zz-d-transfer", 2);
  ch.examples[0].scenario = "The studio cleared out by six. Sofia rebuilt the failing rehearsal plan from the missing cue.";
  // A fresh application scenario that REUSES the name Sofia as the actor — the
  // gold pattern: a named protagonist applied to a NEW situation, not recalled.
  ch.quiz.questions[0].prompt = "Sofia inherits a stalled project with a skeptical team. Which first move best rebuilds trust?";
  const k = ch.quiz.questions[0].correctIndex;
  ch.quiz.questions[0].choices[k] = "Name the hardest unknown aloud and invite the team to test it before committing.";
  assert.equal(checkQuizScenarioNovelty(ch).length, 0, "a fresh scenario reusing a name must not trip D4");
  assert.equal(checkQuizKeyEntity(ch).length, 0, "a key about the prompt's own actor must not trip D6");
});

test("D4/D6: a transfer question with a brand-new actor the chapter never introduced is clean (48-Laws-ch16 style)", () => {
  const ch = makeChapter("zz-d-fresh", 4);
  ch.examples[0].scenario = "The court emptied after dusk. Tariq weighed whether to reveal the plan or hold it back one more day.";
  ch.quiz.questions[0].prompt = "A negotiator named Priya senses her counterpart is stalling for leverage. What is her soundest next move?";
  const k = ch.quiz.questions[0].correctIndex;
  ch.quiz.questions[0].choices[k] = "Withhold the final concession until the counterpart commits to a deadline she can verify.";
  assert.equal(checkQuizScenarioNovelty(ch).length + checkQuizKeyEntity(ch).length, 0);
});

// ── Wiring + severity through the real ship gate ──────────────────────────────
test("D4/D6: the ship gate surfaces planted recall + key-reference as majors (wiring + severity)", () => {
  const report = runShipGate(plantedCastChapter("zz-d-gate"));
  assert.ok(
    report.majors.some((m) => m.catalogId === "D4.recycled_scenario"),
    `expected a D4 ship-gate major; got majors: ${report.majors.map((m) => m.catalogId).join(", ")}`,
  );
  assert.ok(
    report.majors.some((m) => m.catalogId === "D6.key_references_chapter_entity"),
    `expected a D6 ship-gate major; got majors: ${report.majors.map((m) => m.catalogId).join(", ")}`,
  );
});

// ── Gold-corpus zero-FP calibration (Shared Law §2) ───────────────────────────
test("D4/D6: synthetic gold corpus has ZERO findings", () => {
  for (const { bookId, files } of goldChapterFiles()) {
    for (const file of files) {
      const ch = JSON.parse(readFileSync(file, "utf8")) as ChapterV21;
      const hits = [...checkQuizScenarioNovelty(ch), ...checkQuizKeyEntity(ch)];
      assert.equal(hits.length, 0, `D4/D6 false positive on synthetic gold ${bookId} ${ch.chapterId}: ${hits.map((h) => h.message.slice(0, 100)).join(" | ")}`);
    }
  }
});

for (const bookId of ["daring-greatly", "start-with-why"]) {
  const files = existsSync(STATE_CHAPTERS)
    ? readdirSync(STATE_CHAPTERS).filter((f) => f.startsWith(`${bookId}-ch`) && f.endsWith(".v21-native.chapter.json"))
    : [];
  if (files.length === 0) {
    skip(`D4/D6 gold zero-FP: ${bookId}`, `no ${bookId} chapters in state/chapters/ on this machine`);
    continue;
  }
  test(`D4/D6: real gold corpus ${bookId} (${files.length} ch) emits ZERO findings`, () => {
    const offenders: string[] = [];
    for (const f of files) {
      const ch = JSON.parse(readFileSync(resolve(STATE_CHAPTERS, f), "utf8")) as ChapterV21;
      for (const hit of [...checkQuizScenarioNovelty(ch), ...checkQuizKeyEntity(ch)]) {
        offenders.push(`${ch.chapterId}: ${hit.checkId} ${hit.message.slice(0, 110)}`);
      }
    }
    assert.equal(offenders.length, 0, `D4/D6 false-positives on reference-quality ${bookId} (miscalibrated):\n${offenders.join("\n")}`);
  });
}
