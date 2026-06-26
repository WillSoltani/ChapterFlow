/**
 * Invented-witness critic (EW1) — a fictional character cast as a research subject
 * (the "Piper move") must never carry a documented finding.
 *
 * The dominant residual `factual_accuracy` CORRUPTION on the live
 * the-willpower-instinct run (6 instances across ch02/04/06/07/10): the writer
 * stages an invented person inside a REAL study to act out the result. EI1/EI2
 * deliberately punt this as semantic; EW1 catches the CASTING GRAMMAR the name
 * alone can't reveal.
 *
 * This suite is the executable calibration contract:
 *  - the 6 REAL Piper sentences fire (detector A = the gate-grade `participant
 *    <Name>` cast; detector B = the semantic "actor in a named study" shape, the
 *    evidence-audit checklist net),
 *  - real cited sources + anonymized subjects stay silent, AND
 *  - the GOLD corpus (synthetic + real daring-greatly/start-with-why) stays at
 *    ZERO EW1 findings (the gate critic is detector A only → blocker-promotable).
 */

import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "fs";
import { resolve } from "path";

import { test } from "./harness.js";
import { makeChapter, goldChapterFiles, STATE_CHAPTERS } from "./helpers.js";
import {
  findParticipantCasts,
  findWitnessCandidates,
  checkInventedWitness,
  auditChapterWitnesses,
} from "../src/critics/evidenceWitness.js";
import { runShipGate } from "../src/critics/finalGate.js";
import type { ChapterV21 } from "../src/types.js";

// ── The real defect (quoted / minimally reconstructed from the willpower QC round) ──
// Detector A — the gate-grade `participant/subject <GivenName>` cast.
const CAST_TRUE_POSITIVES: Array<[string, string]> = [
  ["participants <Name> and <Name>", "There is little time left in the campus lab, so participants Rachel and William mark the shortlist form under pressure."],
  ["Participant <Name> + action", "Participant Lawrence rubs the cup between both hands in Dianne Tice and Ellen Bratslavsky's emotional distress work."],
  ["Participant <Name> in a paradigm", "Participant Cyrus presses the buzzer in the same restrained-eating paradigm."],
];

// Detector B — the subtler "invented actor staged inside a named study" shape
// (checklist-only; needs the brief to confirm, so it is NOT a gate finding).
const ACTOR_TRUE_POSITIVES: Array<[string, string]> = [
  ["actor in <Researcher>'s room", "Brigitte's sleeve sticks to the vinyl chair as the plate lands in Walter Mischel's Stanford Bing Nursery School room."],
  ["actor after <Researcher>'s class", "Beau asks after Kelly McGonigal's class. Janelle closes the folder."],
  ["actor in the <Named> Test room", "In the Trier Social Stress Test room, public speaking is meant to make the body work. Adam whispers that he needs more adrenaline."],
];

// Real cited sources + anonymized subjects a clean book legitimately uses (must NOT fire).
const MUST_NOT_FIRE: Array<[string, string]> = [
  ["real researchers' paradigm, no cast actor", "Janet Polivy and C. Peter Herman's restrained-eating preload paradigm showed that dieters who believe they have already broken the rule eat more."],
  ["surname + result + found", "Michael Kosfeld's trust-game result found that oxytocin raised investment."],
  ["surname + study, no actor", "Walter Mischel's marshmallow study tracked delay of gratification across decades."],
  ["anonymized participants rated", "In the lab, the participants rated their cravings on a ten-point scale."],
  ["letter-anonymized subjects", "Participant A pressed the button while Participant B waited."],
  ["ordinary person in a plain setting", "Sarah closes the laptop and walks to the kitchen before the craving peaks."],
];

test("EW1: detector A fires on every `participant/subject <Name>` cast", () => {
  for (const [label, sentence] of CAST_TRUE_POSITIVES) {
    const hits = findParticipantCasts(sentence);
    assert.ok(hits.length >= 1, `expected a participant-cast hit for ${label}: "${sentence}"`);
    assert.ok(hits.every((h) => h.pattern === "participant_cast"));
  }
});

test("EW1: detector B (checklist) fires on every invented-actor-in-a-named-study shape", () => {
  for (const [label, sentence] of ACTOR_TRUE_POSITIVES) {
    const hits = findWitnessCandidates(sentence);
    assert.ok(hits.length >= 1, `expected a witness candidate for ${label}: "${sentence}"`);
  }
});

test("EW1: stays silent on real cited sources + anonymized subjects (no FP)", () => {
  for (const [label, sentence] of MUST_NOT_FIRE) {
    const hits = findWitnessCandidates(sentence);
    assert.equal(hits.length, 0, `false positive on ${label}: "${sentence}" → ${JSON.stringify(hits)}`);
  }
});

test("EW1: the GATE critic (detector A only) leaves the detector-B actor shape alone", () => {
  // A real cited study with an actor is detector-B territory (checklist), and must
  // NEVER be a gate finding — only the unambiguous `participant <Name>` cast is.
  for (const [, sentence] of ACTOR_TRUE_POSITIVES) {
    assert.equal(findParticipantCasts(sentence).length, 0, `detector A must not fire on the semantic actor shape: "${sentence}"`);
  }
});

test("EW1: checkInventedWitness flags a planted participant cast as a MAJOR; a clean chapter is silent", () => {
  const ch = makeChapter("zz-ew-plant", 1, {
    overrides: { breakdown: { fastRead: "An ordinary opening tier with plain prose and no cast subject at all.", deepRead: "Participant Lawrence rubs the cup between both hands and reports the craving fading.", fullRead: "The longest tier expands the idea with neutral exposition and zero research-subject framing throughout." } as any },
  });
  const findings = checkInventedWitness(ch);
  assert.ok(findings.some((f) => f.checkId === "EW1.invented_witness"), "expected an EW1 finding");
  assert.ok(findings.every((f) => f.severity === "major"), "EW1 findings are shadow-major");

  const clean = makeChapter("zz-ew-clean", 2);
  assert.equal(checkInventedWitness(clean).length, 0, "an unplanted makeChapter must be EW1-clean");
});

test("EW1: the ship gate surfaces a planted cast as a MAJOR (shadow wiring — not a blocker)", () => {
  const ch = makeChapter("zz-ew-gate", 3, {
    overrides: { breakdown: { fastRead: "A short clean opening tier with ordinary prose and no named subject.", deepRead: "Across the room, participants Rachel and William mark the shortlist form under time pressure.", fullRead: "The longest tier expands the idea with neutral exposition and zero research-subject framing throughout." } as any },
  });
  const report = runShipGate(ch);
  assert.ok(
    report.majors.some((m) => m.catalogId === "EW1.invented_witness"),
    `expected an EW1 ship-gate major; got majors: ${report.majors.map((m) => m.catalogId).join(", ")}`,
  );
  assert.ok(
    !report.blockers.some((b) => b.catalogId === "EW1.invented_witness"),
    "EW1 is SHADOW — it must never be a blocker (cannot brick a ship)",
  );
});

test("EW1: auditChapterWitnesses composes detector A + B over reader fields", () => {
  const ch = makeChapter("zz-ew-audit", 4, {
    overrides: {
      breakdown: { fastRead: "Participant Lawrence rubs the cup and reports the craving fading.", deepRead: "Neutral exposition with no cast subject across this middle tier of the chapter.", fullRead: "The longest tier expands the idea with neutral exposition throughout the section." } as any,
      examples: [{ title: "x", scenario: "Brigitte's sleeve sticks to the vinyl chair as the plate lands in Walter Mischel's Stanford Bing Nursery School room.", whatToDo: "Pause before reaching.", whyItMatters: "It builds the delay.", domain: "general" } as any],
    },
  });
  const items = auditChapterWitnesses(ch);
  assert.ok(items.some((i) => i.pattern === "participant_cast" && i.subject === "Lawrence"), "expected the Lawrence cast");
  assert.ok(items.some((i) => i.pattern === "actor_in_named_study" && i.subject === "Brigitte"), "expected the Brigitte actor-in-study");
});

// ── Gold-corpus zero-FP calibration (the blocker-promotion gate) ──────────────

test("EW1: synthetic gold corpus has ZERO EW1 findings", () => {
  for (const { bookId, files } of goldChapterFiles()) {
    for (const file of files) {
      const ch = JSON.parse(readFileSync(file, "utf8")) as ChapterV21;
      const hits = checkInventedWitness(ch);
      assert.equal(hits.length, 0, `EW1 false positive on synthetic gold ${bookId} ${ch.chapterId}: ${hits.map((h) => h.message.slice(0, 100)).join(" | ")}`);
    }
  }
});

test("EW1: real gold chapters (daring-greatly + start-with-why) have ZERO EW1 findings", () => {
  if (!existsSync(STATE_CHAPTERS)) return; // committed gold absent in this checkout — skip
  const files = readdirSync(STATE_CHAPTERS).filter(
    (f) => /^(daring-greatly|start-with-why)-ch\d+\.v21-native\.chapter\.json$/.test(f),
  );
  assert.ok(files.length > 0, "expected real gold chapters on disk");
  for (const f of files) {
    const ch = JSON.parse(readFileSync(resolve(STATE_CHAPTERS, f), "utf8")) as ChapterV21;
    const hits = checkInventedWitness(ch);
    assert.equal(hits.length, 0, `EW1 false positive on real gold ${ch.chapterId}: ${hits.map((h) => h.message.slice(0, 120)).join(" | ")}`);
  }
});
