/**
 * Misattribution writer-disposition lever (MA1) — surface every named authority
 * credited with a claim, for the writer to verify against the brief (the "Hardy
 * move": a name MENTIONED or COMPARED promoted to the CREDITED SOURCE of a claim).
 *
 * This is a LEVER, not a gate (the misattribution class is semantic — whether an
 * attribution is correct needs the brief), so the contract is: the detector SURFACES
 * the right candidates (recall), and ignores prose that credits no named authority.
 * It is wired into `evidence-audit` for write-time disposition; nothing blocks.
 */

import assert from "node:assert/strict";

import { test } from "./harness.js";
import { makeChapter } from "./helpers.js";
import { findAttributionClaims, auditChapterAttributions } from "../src/critics/misattribution.js";

const SURFACES: Array<[string, string, string]> = [
  ["the-slight-edge ch8 Hardy move (verb)", "Darren Hardy found that small actions compound over time.", "Darren Hardy"],
  ["possessive claim noun", "Mischel's experiment showed delay of gratification predicts outcomes.", "Mischel"],
  ["according-to form", "According to Dweck, the mindset you hold shapes effort.", "Dweck"],
  ["single-name verb", "Cialdini coined the principle of reciprocity in his work.", "Cialdini"],
];

const SILENT: Array<[string, string]> = [
  ["no named authority — generic 'research'", "Research shows that small habits compound into large outcomes over a year."],
  ["a 'the study' subject, no proper name", "The study found that delay of gratification predicts later success."],
  ["plain narrative, no attribution verb", "Coralie keeps a small ledger on her desk and checks it every morning."],
  ["mentioned, not credited (no finding verb)", "Her plan rhymes with the idea behind The Compound Effect on the shelf."],
];

test("MA1: findAttributionClaims surfaces every credited authority", () => {
  for (const [label, sentence, subject] of SURFACES) {
    const items = findAttributionClaims(sentence);
    assert.ok(items.some((i) => i.subject === subject), `expected to surface "${subject}" for ${label}: ${JSON.stringify(items)}`);
  }
});

test("MA1: findAttributionClaims stays silent when no named authority is credited", () => {
  for (const [label, sentence] of SILENT) {
    const items = findAttributionClaims(sentence);
    assert.equal(items.length, 0, `unexpected attribution surfaced for ${label}: "${sentence}" → ${JSON.stringify(items)}`);
  }
});

test("MA1: auditChapterAttributions surfaces a planted Hardy move; dedupes by subject", () => {
  const ch = makeChapter("zz-ma-plant", 1, {
    overrides: {
      breakdown: {
        fastRead: "A short clean opening tier with ordinary prose and no named source at all here.",
        deepRead: "Darren Hardy found that the small, unsexy actions are what compound over the long haul.",
        fullRead: "Later the tier repeats: Darren Hardy found the same, but the audit must list Hardy only once.",
      } as any,
    },
  });
  const items = auditChapterAttributions(ch);
  assert.ok(items.some((i) => i.subject === "Darren Hardy"), `expected a 'Darren Hardy' attribution candidate; got ${JSON.stringify(items)}`);
  assert.equal(items.filter((i) => i.subject === "Darren Hardy").length, 1, "the lever dedupes a repeated subject");
});

test("MA1: a plain makeChapter surfaces no attribution candidates (its filler credits no authority)", () => {
  assert.equal(auditChapterAttributions(makeChapter("zz-ma-clean", 2)).length, 0, "unplanted filler credits no named authority");
});
