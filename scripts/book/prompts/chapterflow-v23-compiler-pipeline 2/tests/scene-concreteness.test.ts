/**
 * Scene-concreteness critic (C26) — an example scene must be staged in a lived
 * human moment, not on an abstract system surface.
 *
 * THE DEFECT (reverted tiny-habits regen, ch4): every example scenario plays out
 * on a UI/process surface — an email prompt, a green sign-in button, a review
 * screen, a worksheet — with no clock-time, place, physical object, body, or
 * sensory beat. The form is the protagonist. (REGRESSIONS.f7.)
 *
 * THE DISCRIMINATOR. C26 fires only when BOTH hold: (1) the stage is an abstract
 * system (≥2 distinct UI/form/process tokens) AND (2) the scene carries ZERO
 * concrete grounding. Condition (2) is the false-positive guard — the gold scenes
 * are saturated with clock-times, named places, and physical objects, so a screen
 * or email appearing inside one never trips C26, and a grounded MODERN digital
 * scene (the phone-notification venues STEP-2 R6 encourages) stays silent too.
 *
 * C26 is MINOR (advisory): a STRENGTHEN density signal that surfaces as QC debt;
 * the gating judgment stays with the semantic `example_coherence` bar axis. This
 * suite is the executable calibration contract — true positives FIRE, and the
 * gold corpus (a blocker-grade pin even for an advisory, given the high FP risk)
 * stays at ZERO.
 */

import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "fs";
import { resolve } from "path";

import { test, skip } from "./harness.js";
import { makeChapter, goldChapterFiles, STATE_CHAPTERS } from "./helpers.js";
import { REGRESSIONS } from "./fixtures/regressions.js";
import { detectSceneAbstraction, groundingCue, checkSceneConcreteness } from "../src/critics/sceneConcreteness.js";
import { runShipGate } from "../src/critics/finalGate.js";
import type { ChapterV21 } from "../src/types.js";

// ── The real defect (verbatim from the tiny-habits regen ch4) ─────────────────
const TRUE_POSITIVES: Array<[string, string]> = REGRESSIONS.f7.map(
  (s) => [s.source, s.span] as [string, string],
);

// ── Grounded constructions a clean book legitimately uses (must NOT fire) ─────
// Several DO touch a system surface (email/screen/notification/calendar) but are
// grounded in a moment — exactly the case condition (2) must spare.
const MUST_NOT_FIRE: Array<[string, string]> = [
  // The owner's reference scenes: a sensory object, a material, a clock-time.
  ["a quilt stitched in 1974 (object + year)", "Across the table, Theo unfolds the quilt his wife stitched in 1974 and decides which square his grandson should keep."],
  ["valve oil and floor wax (materials/smell)", "The repair shop smells of valve oil and floor wax while Dimitri lifts the trumpet his father left him and weighs whether to sell it."],
  ["11:42 on a Tuesday (clock + day)", "At 11:42 on a Tuesday, Priya reads the late-bus sign at the corner and decides whether to wait or walk the last mile."],
  // Grounded MODERN digital scenes — system tokens present, but a clock + a place
  // + a body ground them. C26 must NOT punish the phone/notification venues R6 wants.
  ["phone + email + notification, but grounded", "At 8:15 on the bus, Dev's phone lights up with an email and a calendar notification, and his thumb hovers over the screen as his stop approaches."],
  ["email + screen, but clock + named place", "Juliana freezes at 4:22 p.m. in a Toronto agency when her angry email reply lands on the client's screen instead of her partner's."],
  // A grounded scene with no system surface at all (the <2-token path).
  ["soup in a diner (no system token)", "Petra stands at 6:37 p.m. in a crowded diner after her son knocks soup into her lap and strangers turn to stare."],
];

test("C26: detectSceneAbstraction fires on every abstract-system scene (true positives)", () => {
  for (const [label, scenario] of TRUE_POSITIVES) {
    const hit = detectSceneAbstraction(scenario);
    assert.ok(hit, `expected a C26 hit for ${label}: "${scenario.slice(0, 70)}…"`);
    assert.ok(hit!.tokens.length >= 2, `${label}: expected ≥2 system tokens, got ${hit!.tokens.join(",")}`);
    assert.equal(groundingCue(scenario), null, `${label}: a true-positive must carry no grounding cue`);
  }
});

test("C26: detectSceneAbstraction stays silent on every grounded construction", () => {
  for (const [label, scenario] of MUST_NOT_FIRE) {
    const hit = detectSceneAbstraction(scenario);
    assert.equal(hit, null, `false positive on ${label}: "${scenario.slice(0, 70)}…" → tokens ${hit?.tokens.join(",")}`);
  }
});

test("C26: checkSceneConcreteness flags a planted abstract scene as a minor", () => {
  const ch = makeChapter("zz-c26-plant", 1);
  ch.examples[0].scenario = TRUE_POSITIVES[0][1];
  const findings = checkSceneConcreteness(ch);
  assert.ok(findings.some((f) => f.checkId === "C26.scene_abstraction"), "expected a C26 finding");
  assert.ok(findings.every((f) => f.severity === "minor"), "C26 findings must be minors (advisory)");
});

test("C26: an unplanted makeChapter is scene-concreteness clean", () => {
  // makeChapter scenarios reference a "morning report" — a time-of-day grounding —
  // and carry no abstract-system stage, so the critic stays silent.
  const ch = makeChapter("zz-c26-clean", 3);
  assert.equal(checkSceneConcreteness(ch).length, 0);
});

test("C26: the ship gate surfaces a planted abstract scene as a minor (wiring + severity)", () => {
  const ch = makeChapter("zz-c26-gate", 4);
  // The FULL regen ex0 scenario (334 chars, within the 280–520 schema bound) so the
  // schema validator does not short-circuit the gate before C26 runs.
  ch.examples[0].scenario =
    "The send window is closing, and product designer Lorraine is still in the draft for the BJ-Demo account. Her email prompt says, Come back and get involved, with a green sign-in button below it. The words snag. She notices her own error before the batch goes out: the prompt can ask someone to sign in, not become involved in one leap.";
  const report = runShipGate(ch);
  assert.ok(
    report.minors.some((m) => m.catalogId === "C26.scene_abstraction"),
    `expected a C26 ship-gate minor; got minors ${report.minors.map((m) => m.catalogId).join(", ")}`,
  );
  // Advisory: a C26 minor must never flip the gate or land among the blockers.
  assert.ok(!report.blockers.some((b) => b.catalogId === "C26.scene_abstraction"), "C26 must not be a blocker");
});

// ── Gold-corpus zero-FP calibration (the high-FP-risk pin) ────────────────────

test("C26: synthetic gold corpus has ZERO scene-abstraction findings", () => {
  for (const { bookId, files } of goldChapterFiles()) {
    for (const file of files) {
      const ch = JSON.parse(readFileSync(file, "utf8")) as ChapterV21;
      const hits = checkSceneConcreteness(ch);
      assert.equal(hits.length, 0, `C26 false positive on synthetic gold ${bookId} ${ch.chapterId}: ${hits.map((h) => h.message.slice(0, 110)).join(" | ")}`);
    }
  }
});

for (const bookId of ["daring-greatly", "start-with-why"]) {
  const files = existsSync(STATE_CHAPTERS)
    ? readdirSync(STATE_CHAPTERS).filter((f) => f.startsWith(`${bookId}-ch`) && f.endsWith(".v21-native.chapter.json"))
    : [];
  if (files.length === 0) {
    skip(`C26 gold zero-FP: ${bookId}`, `no ${bookId} chapters in state/chapters/ on this machine`);
    continue;
  }
  test(`C26: real gold corpus ${bookId} (${files.length} ch) emits ZERO scene-abstraction findings`, () => {
    const offenders: string[] = [];
    for (const f of files) {
      const ch = JSON.parse(readFileSync(resolve(STATE_CHAPTERS, f), "utf8")) as ChapterV21;
      for (const hit of checkSceneConcreteness(ch)) {
        offenders.push(`${ch.chapterId}: ${hit.message.slice(0, 120)}`);
      }
    }
    assert.equal(offenders.length, 0, `C26 advisory false-positives on reference-quality ${bookId} (miscalibrated):\n${offenders.join("\n")}`);
  });
}
