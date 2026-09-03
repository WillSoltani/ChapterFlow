/**
 * The Franklin scar file's COMPOSITION, pinned.
 *
 * PR #538 rewrote config/book-scars/the-autobiography-of-benjamin-franklin.json
 * from 37 accreted prohibitions into a source-quoted set. Two adversarial reviews
 * rejected earlier cuts of it for the same reason: rules disappeared and nothing
 * in the suite recorded what had stopped being enforced. A content rewrite that
 * only the PR body describes is a rewrite the next trim can silently undo.
 *
 * So this file pins the PROPERTIES the rewrite is accountable for, not the prose:
 *
 *  1. The three SAFETY rules are byte-identical to origin/main's and BOOK-WIDE.
 *     Reader-safety text is the one class where narrowing a rule harms a reader,
 *     and two of the three carry a "(ch03)" label that the loader deliberately
 *     ignores (src/lib/bookScars.ts NEVER_SCOPED_LABEL). Pinning the bytes AND
 *     the scope means neither a reword nor a label edit can narrow them.
 *  2. The book-wide CRAFT rules are present by title and are book-wide. Each was
 *     a book-wide rule at origin/main; NO RUBRIC VOCABULARY and NO COMPARATIVE
 *     PADDING were restored in review round 3 because no gate, critic or contract
 *     line carries them (the blueprint still deals the literal strings
 *     "verb-led action tied to the required fact" and "transfer scenario in a
 *     fresh domain" into the writer prompt — src/compiler/chapterBlueprint.ts),
 *     and NO FALSE UNIVERSAL was un-scoped back to book-wide.
 *  3. Every FACT PIN is a chapter-scoped, quote-bearing, short rule: its label
 *     carries a PURE "(chNN)" marker (a provenance parenthesis would not scope
 *     it, so a fact about ch03 would render into all 13 chapters), it is at most
 *     60 words, and it quotes the Autobiography. A "pin" with no quote is an
 *     assertion about the source that nobody checked.
 *  4. No prohibition licenses repetition. The rewrite's whole premise was that
 *     the old cross-surface rule's "the same specific may appear in every unit
 *     citing its anchor" clause taught the token hammering readers flagged.
 *  5. The rendered per-chapter block stays inside a stated character budget.
 *
 * RED, observed against origin/main's file (3b82e31c3):
 *   git show origin/main:scripts/book/prompts/chapterflow-v24-author-pipeline/\
 *     config/book-scars/the-autobiography-of-benjamin-franklin.json > /tmp/f.json
 *   CF_FRANKLIN_SCARS_PATH=/tmp/f.json npx tsx tests/run.ts franklin-scars-structure
 * → pass 1 fail 4, one failure per property the rewrite is accountable for:
 *   - craft rules: `book-wide craft rule "CAST CONSISTENCY" is missing` (that file
 *     also lacks NO FALSE UNIVERSAL unscoped, and its NO RUBRIC VOCABULARY / NO
 *     COMPARATIVE PADDING are the two this branch had to restore);
 *   - fact pins: `FACT PIN (ch01) states a fact with no quoted span of 12+ chars`,
 *     naming the Silence Dogood/SIXTEEN pin — the pin PR #538 deleted because the
 *     Autobiography contains neither the name nor the age;
 *   - repetition licence: `CROSS-SURFACE CONSISTENCY` carries "the same specific
 *     may appear in every unit citing its anchor";
 *   - budget: `ch1 renders 14449 chars ... against a 9000-char budget`.
 * The SAFETY assertion PASSES on origin/main, by design: those three rules are
 * unchanged, and that test is the regression guard that keeps them so.
 *
 * The env override exists ONLY for that reproduction. With it unset — how the
 * suite runs — this file loads the shipped config through the real loader.
 */

import { readFileSync } from "node:fs";
import assert from "node:assert/strict";

import { test } from "./harness.js";
import { bookRuleChapters, loadBookScars, validateBookScars, type BookScars } from "../src/lib/bookScars.js";
import { renderBookScarsBlock } from "../src/sections/sectionTasks.js";

const BOOK_ID = "the-autobiography-of-benjamin-franklin";

/** The shipped file through the real loader, or the file named by
 *  CF_FRANKLIN_SCARS_PATH through the loader's own validator (RED reproduction). */
function franklinScars(): BookScars {
  const override = process.env.CF_FRANKLIN_SCARS_PATH;
  if (override) return validateBookScars(JSON.parse(readFileSync(override, "utf8")), BOOK_ID);
  const scars = loadBookScars(BOOK_ID);
  assert.ok(scars, `${BOOK_ID} must have a scar file`);
  return scars!;
}

// Byte-identical to origin/main (3b82e31c3) prohibitions 22, 23 and 26. Copied
// from that file, not from this branch's, so a reword on this branch fails here.
const SAFETY_RULES = [
  "SAFETY (ch03): never advise beginning work on shared or public property without permission — narrate Franklin's projects as historical account, about him, past tense. The transferable mechanism is the SUBSCRIPTION: gather written commitments, then take the funded proposal to whoever owns the property. Any modern example shows permission-and-funding ON THE PAGE and BEFORE any physical work in the scene's own order — a scene opening mid-work teaches the unsafe version regardless of caveats; prefer action steps that stop at the proposal.",
  "SAFETY (ch03): never apply the organize-and-fund-it-yourselves pattern to ARMED patrols, physical force, or safety-critical regulated functions in a modern analog. Prefer non-force analogs; if a safety-adjacent scenario is unavoidable, name legal authority, oversight, and professional standards as prerequisites on the page.",
  "SAFETY (panel blocker, round 11): never instruct a reader to personally guarantee, underwrite, co-sign or become liable for another person's financial or practical obligation. Franklin's subscription and mutual-aid models work by POOLING many small commitments and by written terms, not by one person standing surety for another. Any action step touching money others depend on must stay inside what the reader can lose alone, and must name the written terms rather than a personal promise.",
];

/** Book-wide craft rules, by the title each one must keep. Every entry was
 *  book-wide at origin/main; the PR's disposition ledger names, for each rule
 *  NOT in this list, the merged PR and contract line that carries it. */
const BOOK_WIDE_CRAFT_TITLES = [
  "NO ANALOGY GRAFTS",
  "COUNTERFACTUALS STAY COUNTERFACTUAL",
  "CAST CONSISTENCY",
  "COUNT SELF-DESCRIPTION",
  "NO RUBRIC VOCABULARY",
  "NO COMPARATIVE PADDING",
  "NO FALSE UNIVERSAL",
];

/** Words per FACT PIN. Measured, not aspirational: the longest pin in the shipped
 *  file is 60 words (ch03's fire company and ch03's lottery). A pin that needs
 *  more than this is carrying two facts and should be two pins. */
const FACT_PIN_WORD_CAP = 60;

/** Characters of rendered rules per chapter. The binding chapter (ch03, 10 scoped
 *  rules + 10 book-wide) renders 8,627; origin/main's file rendered 16,138 there.
 *  Re-pin with a measured rationale, never by rounding up. */
const RENDERED_BLOCK_CHAR_BUDGET = 9_000;

test("franklin scars: the three SAFETY rules survive byte-identical and book-wide", () => {
  const scars = franklinScars();
  const safety = scars.prohibitions.filter((rule) => /^SAFETY\b/.test(rule.split(":", 1)[0]));
  assert.deepEqual(safety, SAFETY_RULES, "a SAFETY rule was reworded, reordered or dropped; these three are pinned to origin/main's bytes");
  for (const rule of safety) {
    assert.deepEqual(
      bookRuleChapters(rule),
      [],
      `a SAFETY rule must govern every chapter, whatever marker it carries: ${rule.split(":", 1)[0]}`,
    );
  }
});

test("franklin scars: every book-wide craft rule is present and unscoped", () => {
  const scars = franklinScars();
  for (const title of BOOK_WIDE_CRAFT_TITLES) {
    const rule = scars.prohibitions.find((r) => r.split(":", 1)[0].startsWith(title));
    assert.ok(rule, `book-wide craft rule "${title}" is missing; restore it or name its carrier in the PR's disposition ledger`);
    assert.deepEqual(
      bookRuleChapters(rule!),
      [],
      `"${title}" must stay book-wide; a chapter label narrows a craft rule to one chapter's prompts`,
    );
  }
});

test("franklin scars: every FACT PIN is chapter-scoped, quote-bearing and short", () => {
  const scars = franklinScars();
  const pins = scars.prohibitions.filter((rule) => rule.startsWith("FACT PIN"));
  for (const pin of pins) {
    const label = pin.split(":", 1)[0];
    assert.match(label, /^FACT PIN \(ch\d{2}\)$/, `a FACT PIN label must be exactly "FACT PIN (chNN)" — a provenance parenthesis does not scope: ${label}`);
    assert.deepEqual(bookRuleChapters(pin).length, 1, `a FACT PIN governs exactly one chapter: ${label}`);
    const words = pin.split(/\s+/).length;
    assert.ok(words <= FACT_PIN_WORD_CAP, `${label} is ${words} words against a ${FACT_PIN_WORD_CAP}-word cap; split it: ${pin.slice(0, 80)}…`);
    const quotes = [...pin.matchAll(/"([^"]+)"/g)].map((m) => m[1]).filter((q) => q.length >= 12);
    assert.ok(quotes.length >= 1, `${label} states a fact with no quoted span of 12+ chars; a pin without the source's own words is unchecked: ${pin.slice(0, 80)}…`);
  }
  // Checked last, so the per-pin assertions above run on whatever pins exist: a
  // count that fails first would hide which pin is actually malformed.
  assert.ok(pins.length >= 20, `expected the chapter fact pins to still be here, found ${pins.length}`);
});

test("franklin scars: no prohibition licenses repeating a specific in every unit", () => {
  const scars = franklinScars();
  for (const rule of [...scars.prohibitions, ...scars.notes]) {
    assert.doesNotMatch(
      rule,
      /may appear in every unit/i,
      `this licence is what taught the token hammering the rewrite removed: ${rule.split(":", 1)[0]}`,
    );
  }
});

test("franklin scars: the rendered per-chapter rule block stays inside its budget", () => {
  const scars = franklinScars();
  for (const chapterNumber of [1, 2, 3, 4, 5, 6, 7, 8]) {
    const rendered = renderBookScarsBlock(scars, chapterNumber);
    assert.ok(
      rendered.length <= RENDERED_BLOCK_CHAR_BUDGET,
      `ch${chapterNumber} renders ${rendered.length} chars of book rules against a ${RENDERED_BLOCK_CHAR_BUDGET}-char budget; re-pin only with a measured rationale`,
    );
  }
  // The budget must bind something: a file that renders nothing would pass above.
  assert.ok(renderBookScarsBlock(scars, 3).length > 4_000, "ch03 is the binding chapter and must actually carry its rules");
});
