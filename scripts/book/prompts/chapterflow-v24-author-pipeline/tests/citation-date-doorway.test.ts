/**
 * C34 — citation-date doorway (CF-I-1). The fastRead opens on a date/publication citation
 * carrying CF-A's concreteness beat with no person acting — provenance metadata standing in
 * for an opening scene (multipliers, report §7.3.4). A DATED SCENE (a named person acting near
 * the date) is EXEMPT (red-team rule 2).
 *
 * Calibration contract: a year-as-subject / bare-citation lede FIRES; a dated SCENE
 * ("Kennedy stood before Congress…") and a person-acts lede are SPARED; a no-date lede is
 * SPARED; the synthetic gold corpus is ZERO; the real gold corpus is pinned at its MEASURED count.
 */

import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "fs";
import { resolve } from "path";

import { test, skip } from "./harness.js";
import { makeChapter, goldChapterFiles, labelCleanCorpusChapterFiles, STATE_CHAPTERS } from "./helpers.js";
import { opensOnCitationDate, checkCitationDateDoorway } from "../src/critics/citationDateDoorway.js";
import { runShipGate } from "../src/critics/finalGate.js";
import type { ChapterV21 } from "../src/types.js";

function chapterWithFastRead(fastRead: string): ChapterV21 {
  return { number: 1, breakdown: { fastRead, deepRead: "", fullRead: "" } } as unknown as ChapterV21;
}

// ── The pure detector ─────────────────────────────────────────────────────────

test("C34: opensOnCitationDate fires on a date/citation carrying the opening concreteness", () => {
  // year as the grammatical subject (multipliers ch05 shape)
  assert.equal(opensOnCitationDate("1986 is the number the team recorded before anyone stated a preference. The pattern set in then."), true);
  // publication citation as the concrete anchor, no person acting (multipliers ch01 shape)
  assert.equal(opensOnCitationDate("A wrong reading teaches the wrong lesson. Everyone agreed, but no one moved. Harvard Business Review (a May 2010 article venue) gives the early mark on the contrast."), true);
  // org-as-abstract-subject with a person in a provenance appositive (multipliers ch02 shape)
  assert.equal(opensOnCitationDate("What breaks first when Acme, the firm Dana began leading as CEO in 2014, turns talent into a culture test?"), true);
});

test("C34: opensOnCitationDate SPARES a dated SCENE where a person acts (red-team rule 2)", () => {
  assert.equal(opensOnCitationDate("On May 25, 1961, Kennedy stood before the United States Congress and asked for the Moon."), false, "dated scene: person acts");
  assert.equal(opensOnCitationDate("Roger Fisher keeps the useful answer alive in 2017 by shifting the exchange from position to interest."), false, "person acts near the date");
});

test("C34: opensOnCitationDate SPARES a lede whose opener carries no date at all", () => {
  assert.equal(opensOnCitationDate("Freedom sounds generous. Everyone agrees. Then the hard choice comes back to the person with the title."), false);
  assert.equal(opensOnCitationDate("Project lead Holly asks for one risk, gets a row of yeses, and feels the miss keep moving."), false);
});

test("C34: a pronoun/quantifier opener is not a person scene (does not earn the exemption)", () => {
  // "Everyone agreed" must NOT exempt — the concreteness is still the citation.
  assert.equal(opensOnCitationDate("Everyone agreed on the plan. No one moved. A 1994 study gives the only concrete mark."), true);
});

// ── The chapter-level critic ──────────────────────────────────────────────────

test("C34 fires ONCE on a doorway lede (chapter level)", () => {
  const findings = checkCitationDateDoorway(chapterWithFastRead("1986 is the number the team recorded before anyone stated a preference. The pattern set in then."));
  assert.equal(findings.length, 1);
  assert.equal(findings[0].severity, "minor", "ADVISORY — never blocks");
  assert.match(findings[0].message, /date\/citation carrying the concreteness beat/);
});

test("C34 is silent on a dated scene chapter", () => {
  assert.equal(checkCitationDateDoorway(chapterWithFastRead("On May 25, 1961, Kennedy stood before the United States Congress and asked for the Moon. The stakes were public.")).length, 0);
});

// ── Ship-gate wiring + severity ───────────────────────────────────────────────

test("C34: the ship gate surfaces the doorway as a minor (wiring + severity)", () => {
  const ch = makeChapter("zz-c34-gate", 4);
  ch.breakdown.fastRead =
    "1994 is the number the shift team recorded before anyone stated a preference about the resistor drift. The pattern set in then, and the review kept slipping past its mark, so the count never settled and the whole week's work stalled behind it.";
  const report = runShipGate(ch);
  assert.ok(report.minors.some((m) => m.catalogId === "C34.citation_date_doorway"), `expected a C34 minor; got ${report.minors.map((m) => m.catalogId).join(", ")}`);
  assert.ok(!report.blockers.some((b) => b.catalogId === "C34.citation_date_doorway"), "C34 must never be a blocker");
});

test("C34: an unplanted makeChapter (no dated opener) is clean", () => {
  assert.equal(checkCitationDateDoorway(makeChapter("zz-c34-clean", 3)).length, 0);
});

// ── Gold-corpus calibration pins ──────────────────────────────────────────────

test("C34: synthetic gold corpus has ZERO doorway findings", () => {
  for (const { bookId, files } of [...goldChapterFiles(), ...labelCleanCorpusChapterFiles()]) {
    for (const file of files) {
      const ch = JSON.parse(readFileSync(file, "utf8")) as ChapterV21;
      const hits = checkCitationDateDoorway(ch);
      assert.equal(hits.length, 0, `C34 false positive on synthetic gold ${bookId} ${ch.chapterId}: ${hits.map((h) => h.evidence).join(" | ")}`);
    }
  }
});

// The real gold corpus is NOT zero: start-with-why opens ch08 on "1975 is the first hard
// mark." (year-as-subject) and ch12 on an "Apple, the company Steve Jobs left in 1985…"
// provenance appositive — the same doorway shape. The pin records the MEASURED count.
{
  const bookId = "start-with-why";
  const files = existsSync(STATE_CHAPTERS)
    ? readdirSync(STATE_CHAPTERS).filter((f) => f.startsWith(`${bookId}-ch`) && f.endsWith(".v21-native.chapter.json"))
    : [];
  if (files.length === 0) {
    skip(`C34 gold pin: ${bookId}`, `no ${bookId} chapters in state/chapters/ on this machine`);
  } else {
    test(`C34: real gold corpus ${bookId} (${files.length} ch) emits its MEASURED count`, () => {
      const firing: string[] = [];
      for (const f of files) {
        const ch = JSON.parse(readFileSync(resolve(STATE_CHAPTERS, f), "utf8")) as ChapterV21;
        if (checkCitationDateDoorway(ch).length > 0) firing.push(ch.chapterId);
      }
      assert.equal(firing.length, 2, `C34 gold-corpus pin drifted (expected 2 — start-with-why ch08 + ch12; got ${firing.length}: ${firing.join(", ")})`);
    });
  }
}
