/**
 * IMP-06 — exact / near-exact clone detection, calibrated on clean fixtures.
 *
 * Pins: exact hook clones and cross-chapter memorable-line dups fire; long
 * shared n-grams fire at the configured floor and not below; scenario shingle
 * overlap fires on copied wording and NOT on a structure-preserving noun swap
 * (that disguised clone is the FEATURE extractor's catch — cross-referenced in
 * diversity-telemetry.test.ts); opener stem families group; internal taxonomy
 * wording in prose is flagged; and a clean, varied cross-book-shaped fixture
 * set produces ZERO findings (the false-positive calibration the activation
 * contract's evidence requirement points at).
 */

import assert from "node:assert/strict";

import { test } from "./harness.js";
import { fxChapter } from "./migrationFixtures.js";
import { detectClones, normalizeForClone, shingleJaccard } from "../src/critics/cloneDetection.js";
import type { ChapterV21, ExampleV21 } from "../src/types.js";

/** Per-call `tag` varies the non-scenario fields — byte-identical whatToDo/
 *  whyItMatters across chapters would themselves be a REAL 12-word cross-chapter
 *  run (the detector caught exactly that in this fixture's first draft). */
function ex(scenario: string, tag = "the move"): ExampleV21 {
  return {
    exampleId: "ex-01",
    title: "Fixture",
    tags: ["fixture"],
    planSpec: { domain: "ops", audience: "pros", stakes: "medium", format: "narrative", requiredBeat: "resolution" },
    scenario,
    whatToDo: `Apply ${tag} at the next natural opening.`,
    whyItMatters: `It shows ${tag} holding up under a real constraint.`,
  };
}

function ch(n: number, over: Partial<ChapterV21>): ChapterV21 {
  return fxChapter({ number: n, chapterId: `zz-fixture-book-ch${String(n).padStart(2, "0")}`, ...over });
}

/** A clean three-chapter book — varied hooks, lines, scenarios. The FP fixture. */
function cleanBook(): ChapterV21[] {
  return [
    ch(1, {
      hook: "What does the fastest team in the building argue about?",
      examples: [ex("A shift lead inherits a stalled changeover with two weeks of runway and maps the one call that moves the date.", "the blocker map")],
      memorableLines: [{ text: "Name the blocker before you promise the date.", location: "hook", why: "w" }],
    }),
    ch(2, {
      hook: "Two teams shipped forty percent more after one change to their standup.",
      examples: [ex("An on-call engineer reads the runbook's first failure branch before touching a dashboard, so the next action is chosen, not guessed.", "the first branch")],
      memorableLines: [{ text: "A promise is a debt with a date.", location: "hook", why: "w" }],
    }),
    ch(3, {
      hook: "The count was wrong for a month and nobody said so in the meeting.",
      examples: [ex("A support manager audits one week of escalations and finds the same unowned handoff behind most of them.", "the audit")],
      memorableLines: [{ text: "Who owns the return?", location: "hook", why: "w" }],
    }),
  ];
}

test("IMP-06 clones: a clean varied book yields ZERO findings (false-positive calibration fixture)", () => {
  assert.deepEqual(detectClones(cleanBook()), []);
});

test("IMP-06 clones: byte-identical hooks (normalized) fire exact-clone; distinct hooks do not", () => {
  const book = cleanBook();
  book[2] = ch(3, { ...book[2], hook: 'What does the fastest team in the building argue about?' });
  const findings = detectClones(book);
  const hookClones = findings.filter((f) => f.kind === "hook-exact");
  assert.equal(hookClones.length, 1, JSON.stringify(findings));
  assert.deepEqual(hookClones[0].chapters, [1, 3]);
  assert.equal(hookClones[0].class, "exact-clone");
});

test("IMP-06 clones: the same memorable line in two chapters fires exact-clone", () => {
  const book = cleanBook();
  book[1] = ch(2, { ...book[1], memorableLines: [{ text: "Name the blocker before you promise the date.", location: "hook", why: "w" }] });
  const findings = detectClones(book).filter((f) => f.kind === "memorable-line-exact");
  assert.equal(findings.length, 1);
  assert.deepEqual(findings[0].chapters, [1, 2]);
});

test("IMP-06 clones: a copied 12-word run between chapters fires long-ngram; an 8-word echo does not", () => {
  const copied = "the single most expensive habit on any team is the unowned promise nobody checks";
  const book = cleanBook();
  book[0] = ch(1, { ...book[0], breakdown: { fastRead: `Start here. ${copied}.`, deepRead: "d", fullRead: "f" } });
  book[1] = ch(2, { ...book[1], breakdown: { fastRead: `Different opening, then ${copied}.`, deepRead: "e", fullRead: "g" } });
  const findings = detectClones(book).filter((f) => f.kind === "long-ngram");
  assert.equal(findings.length, 1, JSON.stringify(detectClones(book)));
  assert.deepEqual(findings[0].chapters, [1, 2]);

  const shortEcho = cleanBook();
  shortEcho[0] = ch(1, { ...shortEcho[0], breakdown: { fastRead: "Every promise needs one named owner today.", deepRead: "d", fullRead: "f" } });
  shortEcho[1] = ch(2, { ...shortEcho[1], breakdown: { fastRead: "And every promise needs one named owner to survive.", deepRead: "e", fullRead: "g" } });
  assert.deepEqual(detectClones(shortEcho).filter((f) => f.kind === "long-ngram"), [], "below the 12-word floor is not an exact clone");
});

test("IMP-06 clones: copied scenario wording fires near-clone overlap; a structure-preserving NOUN SWAP does not (the feature ledger owns that)", () => {
  const scenario = "A shift lead inherits a stalled changeover with two weeks of runway. She maps which of the four open calls actually moves the date, defers the rest to a written parking lot, and walks the crew through the single tradeoff that matters before anyone opens a laptop.";
  const copied = cleanBook();
  copied[0] = ch(1, { ...copied[0], examples: [ex(scenario)] });
  copied[1] = ch(2, { ...copied[1], examples: [ex(scenario.replace("laptop", "terminal"))] });
  const near = detectClones(copied).filter((f) => f.kind === "scenario-overlap");
  assert.equal(near.length, 1, JSON.stringify(detectClones(copied)));
  assert.equal(near[0].class, "near-clone");
  assert.ok(near[0].measure >= 0.82);

  const swapped = cleanBook();
  swapped[0] = ch(1, { ...swapped[0], examples: [ex(scenario)] });
  swapped[1] = ch(2, {
    ...swapped[1],
    examples: [ex("A project manager inherits a stalled rollout with three weeks of budget. He maps which of the five open questions actually moves the launch, defers the rest to a shared backlog, and walks the squad through the single decision that matters before anyone opens a slide.")],
  });
  assert.deepEqual(
    detectClones(swapped).filter((f) => f.kind === "scenario-overlap"),
    [],
    "vocabulary-varied structure is NOT a lexical clone — the diversity features catch it instead",
  );
});

test("IMP-06 clones: two hooks sharing their first four words group into an opener stem family", () => {
  const book = cleanBook();
  book[0] = ch(1, { ...book[0], hook: "The fastest team in the plant argues about one decision." });
  book[1] = ch(2, { ...book[1], hook: "The fastest team in the office ships before the meeting ends." });
  const fams = detectClones(book).filter((f) => f.kind === "opener-stem-family");
  assert.equal(fams.length, 1);
  assert.deepEqual(fams[0].chapters, [1, 2]);
  assert.equal(fams[0].class, "near-clone", "stem families are broad similarity — shadow-first");
});

test("IMP-06 clones: internal taxonomy wording in reader prose is flagged (red-team: writer reproduces a feature label)", () => {
  const book = cleanBook();
  book[0] = ch(1, { ...book[0], breakdown: { fastRead: "This opens as a prop-tableau, then the ledger closes.", deepRead: "d", fullRead: "f" } });
  const leaks = detectClones(book).filter((f) => f.kind === "taxonomy-wording");
  assert.equal(leaks.length, 1);
  assert.equal(leaks[0].evidence, "prop-tableau");
  assert.deepEqual(leaks[0].chapters, [1]);
});

test("IMP-06 clones: normalization + shingle Jaccard behave (case/punct-insensitive; disjoint texts score 0)", () => {
  assert.equal(normalizeForClone('  "The COUNT—was wrong!"  '), "the count was wrong");
  assert.equal(shingleJaccard("alpha beta gamma delta", "alpha beta gamma delta"), 1);
  assert.equal(shingleJaccard("alpha beta gamma delta", "zeta eta theta iota"), 0);
});
