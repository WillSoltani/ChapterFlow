/**
 * Named-enumeration completeness critic (NE1) — a named fixed-size set enumerated
 * with the wrong number of items.
 *
 * THE DEFECT (the-slight-edge ch13, a live-run factual_accuracy CORRUPTION): "the
 * seven habits … : show up, be consistent, pay the price" — a 3-item excerpt framed
 * as the complete seven. NE1 shifts that to a deterministic gate.
 *
 * The calibration contract: the real TP fires; a colon-EXPLANATION (the-compound-
 * effect "the two losses: clear them and waste money, or …"), partial framing, an
 * illustrative list, a complete list, and a colon belonging to a DIFFERENT noun
 * (the-5-am-club "the ten tactics … scarce resources: …") all stay silent; and the
 * gold corpus is ZERO.
 */

import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "fs";
import { resolve } from "path";

import { test } from "./harness.js";
import { makeChapter, goldChapterFiles, STATE_CHAPTERS } from "./helpers.js";
import { findEnumerationMismatch, checkNamedEnumeration } from "../src/critics/namedEnumeration.js";
import { runShipGate, ENFORCED_MAJOR } from "../src/critics/finalGate.js";
import type { ChapterV21 } from "../src/types.js";

const TRUE_POSITIVES: Array<[string, string]> = [
  ["the-slight-edge ch13 (claims 7, lists 3)", "Coralie reads the seven habits from a small printed list: show up, be consistent, pay the price."],
  ["direct colon, set-noun (claims 3, lists 2)", "Remember the three rules: breathe, pause."],
  ["claims 4, lists 3", "She teaches the four pillars: trust, candor, repair."],
];

const MUST_NOT_FIRE: Array<[string, string]> = [
  ["colon-explanation, compound items (the 'two losses' FP)", "He weighs the two losses: clear them and waste money, or keep them and let the eating-better setup slip."],
  ["colon belongs to a different noun (5am-club FP)", "The ten tactics make him audit scarce resources: attention, learning time, recovery, and focus."],
  ["partial framing", "Three of the seven habits matter most: show up, be consistent, pay the price."],
  ["illustrative softener", "She names the five stages, such as: denial, anger, bargaining."],
  ["complete list (7 = 7)", "She named the seven habits: show up, be consistent, keep a positive outlook, commit for the long haul, hold burning desire, pay the price, and practice integrity."],
  ["no colon enumeration", "The seven habits take years to build, and most people quit early."],
  ["long compound items, not a clean list", "the three options: stay in the role and absorb the cost, or leave now and lose the bonus, or wait one quarter and reassess."],
];

test("NE1: findEnumerationMismatch fires on every named-set count mismatch", () => {
  for (const [label, sentence] of TRUE_POSITIVES) {
    const hits = findEnumerationMismatch(sentence);
    assert.ok(hits.length >= 1, `expected a hit for ${label}: "${sentence}"`);
  }
});

test("NE1: stays silent on explanations / partial / illustrative / complete / different-noun lists", () => {
  for (const [label, sentence] of MUST_NOT_FIRE) {
    const hits = findEnumerationMismatch(sentence);
    assert.equal(hits.length, 0, `false positive on ${label}: "${sentence}" → ${JSON.stringify(hits)}`);
  }
});

test("NE1: checkNamedEnumeration flags a planted mismatch as a MAJOR; a clean chapter is silent", () => {
  const ch = makeChapter("zz-ne-plant", 1, {
    overrides: { breakdown: { fastRead: "A clean opening tier with ordinary prose and no named set at all.", deepRead: "Coralie reads the seven habits from a small printed list: show up, be consistent, pay the price.", fullRead: "The longest tier expands the idea with neutral exposition throughout the section." } as any },
  });
  const findings = checkNamedEnumeration(ch);
  assert.ok(findings.some((f) => f.checkId === "NE1.named_enumeration_mismatch"), "expected an NE1 finding");
  assert.ok(findings.every((f) => f.severity === "major"), "NE1 findings are shadow-major");

  assert.equal(checkNamedEnumeration(makeChapter("zz-ne-clean", 2)).length, 0, "an unplanted makeChapter must be NE1-clean");
});

test("NE1: the ship gate surfaces a planted mismatch as a MAJOR (SHADOW — not enforced, not a blocker)", () => {
  const ch = makeChapter("zz-ne-gate", 3, {
    overrides: { breakdown: { fastRead: "A short clean opening tier with ordinary prose.", deepRead: "Remember the four pillars: trust, candor, repair.", fullRead: "The longest tier expands the idea with neutral exposition throughout the section here." } as any },
  });
  const report = runShipGate(ch);
  assert.ok(
    report.majors.some((m) => m.catalogId === "NE1.named_enumeration_mismatch"),
    `expected an NE1 ship-gate major; got: ${report.majors.map((m) => m.catalogId).join(", ")}`,
  );
  // NE1 stays SHADOW until it earns a 2nd true positive (only 1 so far: the-slight-edge ch13) —
  // the registry's >=2-TP rung-4 bar. So it must NOT be enforced and must never be a blocker.
  assert.ok(!ENFORCED_MAJOR.has("NE1.named_enumeration_mismatch"), "NE1 is SHADOW (1 TP < the >=2-TP bar) — not yet enforced");
  assert.ok(!report.blockers.some((b) => b.catalogId === "NE1.named_enumeration_mismatch"), "NE1 is SHADOW — never a blocker");
});

test("NE1: synthetic gold corpus has ZERO NE1 findings", () => {
  for (const { bookId, files } of goldChapterFiles()) {
    for (const file of files) {
      const ch = JSON.parse(readFileSync(file, "utf8")) as ChapterV21;
      assert.equal(checkNamedEnumeration(ch).length, 0, `NE1 false positive on synthetic gold ${bookId} ${ch.chapterId}`);
    }
  }
});

test("NE1: real gold chapters (daring-greatly + start-with-why) have ZERO NE1 findings", () => {
  if (!existsSync(STATE_CHAPTERS)) return;
  const files = readdirSync(STATE_CHAPTERS).filter((f) => /^(daring-greatly|start-with-why)-ch\d+\.v21-native\.chapter\.json$/.test(f));
  assert.ok(files.length > 0, "expected real gold chapters on disk");
  for (const f of files) {
    const ch = JSON.parse(readFileSync(resolve(STATE_CHAPTERS, f), "utf8")) as ChapterV21;
    assert.equal(checkNamedEnumeration(ch).length, 0, `NE1 false positive on real gold ${ch.chapterId}`);
  }
});
