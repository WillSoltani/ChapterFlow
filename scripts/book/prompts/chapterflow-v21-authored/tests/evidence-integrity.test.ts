/**
 * Evidence-integrity gate (EI1 / EI2) — testimonials must never masquerade as research.
 *
 * EI1 = a first-name/initial-only subject's personal "report"/"account" dressed in
 *       the grammar of evidence ("Brad's report names the hinge"). BLOCKER.
 * EI2 = a quiz answer KEYED to such a testimonial. BLOCKER (the hard rule).
 *
 * This suite is the executable calibration contract:
 *  - TRUE POSITIVES fire (a gate that flags nothing is useless), and
 *  - the GOLD corpus (daring-greatly + start-with-why — reference-quality books a
 *    blocker must never flag) stays at ZERO, AND the specific real-world false-positive
 *    classes that were tuned out during calibration stay out (ownership-not-co-occurrence,
 *    real full names, companies, document props, real cited authors split at an initial).
 */

import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "fs";
import { resolve } from "path";

import { test, skip } from "./harness.js";
import { makeChapter, goldChapterFiles, STATE_CHAPTERS } from "./helpers.js";
import {
  findTestimonialEvidence,
  checkTestimonialEvidence,
  checkQuizKeyTestimonial,
} from "../src/critics/evidenceIntegrity.js";
import { runShipGate } from "../src/critics/finalGate.js";
import type { ChapterV21 } from "../src/types.js";

// ── The real defect (quoted from the tiny-habits regression) ──────────────────
const TRUE_POSITIVES: Array<[string, string]> = [
  ["given-name + report + names", "Brad's report names the hinge."],
  ["lone-initial + report + gives", "Candace P.'s report gives her the test: stop adding willpower."],
  ["given-name + modified report + makes", "John's Maui habit report makes the rule small enough to use."],
  ["lone-initial + report + points to", "Jean B.'s report points to another kind of growth."],
  ["ownerless success report + names", "The same success report names ketogenic diet adherence and daily journaling."],
  ["given-name + report + gives", "Brad's report gives the cleaner read."],
];

// ── Constructions a real source / clean book legitimately uses (must NOT fire) ──
const MUST_NOT_FIRE: Array<[string, string]> = [
  // Real cited sources: surname / full name + a research (documentary) noun.
  ["surname + case + shows", "Kosfeld's case shows trust in behavior, not a hack for control."],
  ["full name + result + makes", "Michael Kosfeld's trust-game result makes one part of the repair concrete."],
  ["surname + titles + made (research noun)", "Armstrong's titles made victory look like proof, until the 2012 USADA case pulled the control system into view."],
  ["full name + data + shows", "Brené Brown's data shows that vulnerability precedes courage."],
  ["company contrast + shows", "The Apple, Dell, and Creative contrast shows how expectation shapes trust."],
  ["company possessive + story (narrative noun)", "Enron's Houston success story made the future look rich, until the 2001 bankruptcy exposed the gap."],
  // Real cited author whose surname the sentence-splitter strips at the initial.
  ["real author, non-possessive initial", "Kyle briefs donors on a slide that names Alexander Graham Bell and Elmer R. Gates."],
  ["real author leads with a middle initial", "The leader points to Robert A. Caro for the definitive account."],
  // Ownership, not co-occurrence: the subject owns a NON-evidence noun; "report" is incidental.
  ["report is the subject, name is incidental", "A trend report shows Veronica's team reviewed risks during kickoff."],
  ["owner owns a tally, not the distant report", "Jenna's training tally shows six short gaps spent reopening one report."],
  ["owner owns a desk, report 3 words downstream", "A log on Hermine's desk shows three report pauses in ten minutes."],
  // Plain illustration: a person acts / files a document with no evidentiary claim verb.
  ["files a report as an action", "She files her incident report before the shift ends."],
  ["narrative mention, no insight verb", "Brad's report sat unopened on the corner of the desk."],
  ["weather report", "He checks the weather report and packs a coat."],
  ["report card", "Her report card came back with three A's."],
];

test("EI: findTestimonialEvidence fires on every true-positive testimonial", () => {
  for (const [label, sentence] of TRUE_POSITIVES) {
    const hits = findTestimonialEvidence(sentence);
    assert.ok(hits.length >= 1, `expected a hit for ${label}: "${sentence}"`);
  }
});

test("EI: findTestimonialEvidence stays silent on every clean / real-source construction", () => {
  for (const [label, sentence] of MUST_NOT_FIRE) {
    const hits = findTestimonialEvidence(sentence);
    assert.equal(hits.length, 0, `false positive on ${label}: "${sentence}" → ${JSON.stringify(hits)}`);
  }
});

test("EI: a v2 sidecar real entity exempts a same-spelled possessive owner", () => {
  // Without the sidecar, "Sawyer's report shows the lever" reads as a testimonial.
  assert.ok(findTestimonialEvidence("Sawyer's report shows the lever.").length >= 1);
  // With a v2 sidecar listing "Sawyer Logistics" as a real namedExample, the owner is
  // a real cited source → exempted (multi-word entity contributes the token "sawyer").
  const sidecar = {
    schemaVersion: "source-v2",
    namedExamples: [{ id: "ch01.ex.sawyer", label: "Sawyer Logistics depot trial", summary: "x", hardSpecifics: ["Sawyer Logistics", "2026"], realWorld: true }],
    testableFacts: [],
  };
  const realEntities = new Set<string>();
  // Mirror realEntityTokensFromSidecar's multi-word extraction without importing internals.
  for (const ex of sidecar.namedExamples) for (const s of [ex.label, ...ex.hardSpecifics]) {
    const toks = s.match(/[A-Za-z][A-Za-z'’-]+/g) ?? [];
    if (toks.length >= 2) for (const t of toks) realEntities.add(t.toLowerCase());
  }
  assert.equal(findTestimonialEvidence("Sawyer's report shows the lever.", realEntities).length, 0);
});

test("EI1: checkTestimonialEvidence flags a planted breakdown testimonial as a blocker", () => {
  const ch = makeChapter("zz-ei-plant", 1, {
    overrides: { breakdown: { fastRead: "Plain prose with no testimonial framing at all here.", deepRead: "Brad's report names the hinge as the cause of every relapse.", fullRead: "Neutral exposition continues across the longer tier without any named report." } as any },
  });
  const findings = checkTestimonialEvidence(ch);
  assert.ok(findings.some((f) => f.checkId === "EI1.testimonial_as_evidence"), "expected an EI1 finding");
  assert.ok(findings.every((f) => f.severity === "blocker"), "EI1 findings must be blockers");
});

test("EI2: a quiz answer keyed to a testimonial is a blocker; a clean key is not", () => {
  const base = makeChapter("zz-ei-quiz", 2);
  const q = base.quiz.questions[0];
  // Key the CORRECT answer to a testimonial.
  const keyed = "Candace P.'s report gives the rule its whole authority.";
  q.choices[q.correctIndex] = keyed;
  const flagged = checkQuizKeyTestimonial(base);
  assert.ok(flagged.some((f) => f.checkId === "EI2.quiz_key_testimonial"), "expected an EI2 finding for a testimonial-keyed answer");
  // Restore a clean, source-shaped key → no EI2.
  q.choices[q.correctIndex] = "Pause and compare the live entry against the signed note before acting.";
  assert.equal(checkQuizKeyTestimonial(base).length, 0, "a clean key must not trip EI2");
});

test("EI: an unplanted makeChapter is evidence-integrity clean (EI1+EI2)", () => {
  const ch = makeChapter("zz-ei-clean", 3);
  assert.equal(checkTestimonialEvidence(ch).length + checkQuizKeyTestimonial(ch).length, 0);
});

test("EI1: the ship gate surfaces a planted testimonial as a blocker (wiring + severity)", () => {
  const ch = makeChapter("zz-ei-gate", 4, {
    overrides: { breakdown: { fastRead: "A short clean opening tier with ordinary prose and no named report.", deepRead: "John's Maui habit report makes the rule small enough to use every morning.", fullRead: "The longest tier expands the idea with neutral exposition and zero testimonial framing throughout." } as any },
  });
  const report = runShipGate(ch);
  assert.ok(report.blockers.some((b) => b.catalogId === "EI1.testimonial_as_evidence"), `expected an EI1 ship-gate blocker; got ${report.blockers.map((b) => b.catalogId).join(", ")}`);
});

// ── Gold-corpus zero-FP calibration (the blocker-promotion gate) ──────────────

test("EI: synthetic gold corpus has ZERO EI findings", () => {
  for (const { bookId, files } of goldChapterFiles()) {
    for (const file of files) {
      const ch = JSON.parse(readFileSync(file, "utf8")) as ChapterV21;
      const hits = [...checkTestimonialEvidence(ch), ...checkQuizKeyTestimonial(ch)];
      assert.equal(hits.length, 0, `EI false positive on synthetic gold ${bookId} ${ch.chapterId}: ${hits.map((h) => h.message.slice(0, 100)).join(" | ")}`);
    }
  }
});

for (const bookId of ["daring-greatly", "start-with-why"]) {
  const files = existsSync(STATE_CHAPTERS)
    ? readdirSync(STATE_CHAPTERS).filter((f) => f.startsWith(`${bookId}-ch`) && f.endsWith(".v21-native.chapter.json"))
    : [];
  if (files.length === 0) {
    skip(`EI gold zero-FP: ${bookId}`, `no ${bookId} chapters in state/chapters/ on this machine`);
    continue;
  }
  test(`EI: real gold corpus ${bookId} (${files.length} ch) emits ZERO EI findings`, () => {
    const offenders: string[] = [];
    for (const f of files) {
      const ch = JSON.parse(readFileSync(resolve(STATE_CHAPTERS, f), "utf8")) as ChapterV21;
      for (const hit of [...checkTestimonialEvidence(ch), ...checkQuizKeyTestimonial(ch)]) {
        offenders.push(`${ch.chapterId}: ${hit.message.slice(0, 120)}`);
      }
    }
    assert.equal(offenders.length, 0, `EI blocker false-positives on reference-quality ${bookId} (miscalibrated):\n${offenders.join("\n")}`);
  });
}
