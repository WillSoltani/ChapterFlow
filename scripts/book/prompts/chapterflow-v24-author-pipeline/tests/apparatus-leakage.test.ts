/**
 * C36 — source-guide apparatus leakage (CF-J, 2026-07-09) + the shared page-citation
 * mint-removal grammar.
 *
 * The radical-candor release-readiness review (§7) found the guide's own APPARATUS
 * narrated to the reader BELOW C31–C35 coverage: page citations in reader prose,
 * guide-structure narration, machinery vocabulary INSIDE quiz surfaces (ch6 q01
 * "accepting page references as proof"), and drafting-spec sentences printed
 * verbatim. This suite is the executable calibration contract:
 *   - each category fires on its review-quoted positive and stays SILENT on the
 *     curated negatives (legitimate source discussion, real dates, a page as a
 *     scene object, a distractor that names citing-sources as a wrong MOVE);
 *   - one finding per chapter per category, minor, gate-wired, never a blocker;
 *   - the strip half (stripPageCitationSpans / isPageCitationOnly) removes the
 *     citation span and tidies seams, and the SC11.2 tolerance cannot loosen
 *     beyond citation-shaped specifics;
 *   - the synthetic gold corpus is ZERO; the real corpora are pinned at their
 *     MEASURED counts (gold start-with-why / the-culture-code / HOM / multipliers
 *     all ZERO; radical-candor fires heavily — that is the point).
 */

import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "fs";
import { resolve } from "path";

import { test, skip } from "./harness.js";
import { makeChapter, goldChapterFiles, labelCleanCorpusChapterFiles, STATE_CHAPTERS, PIPELINE_DIR } from "./helpers.js";
import {
  PAGE_CITATION_RE,
  stripPageCitationSpans,
  isPageCitationOnly,
  findApparatusLeakage,
  checkApparatusLeakage,
} from "../src/critics/apparatusLeakage.js";
import { runShipGate } from "../src/critics/finalGate.js";
import type { ChapterV21 } from "../src/types.js";

const REPO_ROOT = resolve(PIPELINE_DIR, "../../../..");
const PKG_DIR = resolve(REPO_ROOT, "book-packages");

/** A minimal chapter carrying `text` in one reader-facing surface. */
function chapterWithFastRead(text: string, number = 1): ChapterV21 {
  return { number, breakdown: { fastRead: text, deepRead: "", fullRead: "" } } as unknown as ChapterV21;
}

// ── (a) page citations ─────────────────────────────────────────────────────────

test("C36 page_citation: fires on the review-quoted citation forms", () => {
  for (const text of [
    "The organization tied to SBI on Ch. 6 p. 138 built the model.",           // Ch+p compound
    "Career Conversations are documented at Ch. 7 pp. 177-182.",               // Ch+pp range
    "The glossary places the pair at Ch. 1 pp. 9 and 14.",                     // and-continuation
    "On page 33, Radical Candor names the danger of comfort.",                 // "on page N"
    "The two modes appear at pp. 49-50 as gradual and steep growth.",          // bare pp. range
    "Chapter 2, p. 33 defines Ruinous Empathy.",                               // Chapter-spelled variant
  ]) {
    const hits = findApparatusLeakage(chapterWithFastRead(text));
    assert.ok(hits.some((h) => h.category === "page_citation"), `must fire on: ${text}`);
  }
});

test("C36 page_citation: NEGATIVES — dates, scene-object pages, plain numbers, initials stay silent", () => {
  for (const text of [
    "In 1997 Steve Jobs returned to Apple, twelve years after leaving in 1985.", // real historical dates
    "She marked page 90 of the manuscript with a pencil and kept reading.",      // a book ABOUT pages: the page is a scene OBJECT, not a citation form
    "The manuscript ran to 212 pages; the margin note was hers.",                // page counts as content
    "The team shipped 47 units in p2 of the quarter.",                           // "p2" is not "p. 2"
    "Rowan P. signed the manifest at 9 p.m. before the handoff.",                // initials + clock time
  ]) {
    assert.deepEqual(
      findApparatusLeakage(chapterWithFastRead(text)).filter((h) => h.category === "page_citation"),
      [],
      `must stay silent on: ${text}`,
    );
  }
});

// ── (b) guide-structure narration ──────────────────────────────────────────────

test("C36 guide_structure: fires on guide-layout narration; spares real source discussion", () => {
  for (const text of [
    "The official guide puts Results in Part 2, the tools-and-techniques part.",
    "The source guide's practice questions for this unit cover the same ground.",
    "The official guide marks the Bonus Chapter as optional. That placement matters.",
    "The discussion prompts ask who pays first.",
  ]) {
    const hits = findApparatusLeakage(chapterWithFastRead(text));
    assert.ok(hits.some((h) => h.category === "guide_structure"), `must fire on: ${text}`);
  }
  for (const text of [
    "Kim Scott describes the two axes as care and challenge.",                       // legitimate author attribution
    "The Center for Creative Leadership's SBI model separates situation from impact.", // legitimate framework citation
    "Part of the answer is timing; the other part is trust.",                        // ordinary "part" usage
  ]) {
    assert.deepEqual(
      findApparatusLeakage(chapterWithFastRead(text)).filter((h) => h.category === "guide_structure"),
      [],
      `must stay silent on: ${text}`,
    );
  }
});

// ── (c) machinery vocabulary — the TERM discriminates, not the position ───────

test("C36 machinery_term: the ch6-q01-class machinery FIRES inside quiz surfaces", () => {
  // Distilled from radical-candor ch6 q01 (the review's HIGH finding): the
  // distractor and explanation teach PIPELINE vocabulary. It must fire even
  // though it sits in a distractor — the machinery TERMS discriminate.
  const ch = {
    number: 6,
    quiz: {
      questions: [{
        questionId: "q01",
        prompt: "A trainer turns the checklist into a broad culture slogan. What is wrong with that?",
        choices: [
          "The trainer is applying it too late, after feedback has lost its context.",
          "The trainer is using a delivery checklist as if it were a general culture label.",
          "The trainer is accepting page references as proof that all feedback tools do the same job.",
        ],
        correctIndex: 1,
        explanation: "The page span points to delivery, so treating it as a wide slogan stretches the tool.",
      }],
    },
  } as unknown as ChapterV21;
  const hits = findApparatusLeakage(ch).filter((h) => h.category === "machinery_term");
  assert.equal(hits.length, 2, `choice + explanation both carry machinery; got ${JSON.stringify(hits)}`);
  assert.ok(hits.some((h) => h.unit === "quiz.q01.choice[2]"), "the machinery distractor is attributed");
  assert.ok(hits.some((h) => h.unit === "quiz.q01.explanation"), "the machinery explanation is attributed");
});

test("C36 machinery_term: a distractor naming citing-sources as a wrong MOVE stays silent", () => {
  // The negative twin: mentioning citation-as-behavior is legitimate quiz content;
  // only the machinery TERMS (page references / page span / source packet / …) fire.
  const ch = {
    number: 1,
    quiz: {
      questions: [{
        questionId: "q01",
        prompt: "A teammate keeps deflecting hard feedback. What is the WRONG move?",
        choices: [
          "Cite the original source in the meeting instead of acting on the feedback.",
          "Name the behavior you observed and its impact.",
          "Ask for criticism of your own work first.",
        ],
        correctIndex: 1,
        explanation: "Quoting an authority dodges the conversation; the move is to name the behavior.",
      }],
    },
  } as unknown as ChapterV21;
  assert.deepEqual(findApparatusLeakage(ch), [], "citing-sources-as-a-wrong-move carries no machinery term");
});

test("C36 machinery_term: fires on the machinery lexicon in prose", () => {
  for (const term of ["source packet", "sidecar", "planSpec", "page anchor", "case label", "evidence slot", "source lineage"]) {
    const hits = findApparatusLeakage(chapterWithFastRead(`The ${term} carries the rest of the story.`));
    assert.ok(hits.some((h) => h.category === "machinery_term"), `must fire on the term: ${term}`);
  }
});

// ── (d) spec-narration sentences ───────────────────────────────────────────────

test("C36 spec_narration: the review-quoted spec sentences fire; natural narration is spared", () => {
  for (const text of [
    "The outcome is not claimed here. The proof is earlier: directness is not free-standing.", // ch2 ex01
    "The blue calendar block is the only hard detail in the room.",                            // ch4 ex02
    "One object was left from the earlier exchange. A cold mug sat beside him.",               // ch5 ex01
  ]) {
    const hits = findApparatusLeakage(chapterWithFastRead(text));
    assert.ok(hits.some((h) => h.category === "spec_narration"), `must fire on: ${text}`);
  }
  assert.deepEqual(
    findApparatusLeakage(chapterWithFastRead(
      "A cold mug sat beside him from the earlier exchange; the calendar block still held the hour.",
    )),
    [],
    "the same props narrated naturally carry no spec-narration pattern",
  );
});

// ── One finding per chapter per category + gate wiring ─────────────────────────

test("C36: one advisory per chapter per CATEGORY, listing the offenders", () => {
  const ch = {
    number: 3,
    breakdown: {
      fastRead: "Growth Management is documented at Ch. 3 pp. 47-48 as supporting the trajectory.",
      deepRead: "On page 49, the two modes split into gradual and steep growth.",
      fullRead: "The official guide shelves the tool in Part 2.",
    },
  } as unknown as ChapterV21;
  const findings = checkApparatusLeakage(ch);
  assert.equal(findings.length, 2, "two categories present → exactly two findings");
  const pageCite = findings.find((f) => String(f.checkId) === "C36.apparatus_page_citation");
  assert.ok(pageCite, "page-citation finding present");
  assert.match(pageCite!.message, /2 reader-facing unit\(s\)/, "both citation units are counted in ONE finding");
  assert.match(pageCite!.message, /breakdown\.fastRead/);
  assert.match(pageCite!.message, /breakdown\.deepRead/);
  assert.match(pageCite!.message, /internal coordinates/i, "the fix directive rides the message");
  const structure = findings.find((f) => String(f.checkId) === "C36.apparatus_guide_structure");
  assert.ok(structure, "guide-structure finding present");
  assert.ok(findings.every((f) => f.severity === "minor"), "C36 is ADVISORY — every finding minor");
});

test("C36: ship-gate wiring — planted apparatus surfaces as minors, never blockers, and passed stays true when only C36 trips", () => {
  const ch = makeChapter("zz-c36-gate", 4);
  ch.breakdown.fullRead += " The official guide places this drill at Ch. 4 pp. 82-86 for reference.";
  const report = runShipGate(ch);
  const c36Minors = report.minors.filter((m) => m.catalogId.startsWith("C36."));
  assert.ok(c36Minors.length >= 2, `expected C36 page-citation + guide-structure minors; got ${report.minors.map((m) => m.catalogId).join(", ")}`);
  assert.ok(!report.blockers.some((b) => b.catalogId.startsWith("C36.")), "C36 must never be a blocker");
  // The unplanted twin passes; the planted one must not FAIL BECAUSE of C36 —
  // compare against the same chapter without the plant.
  const clean = makeChapter("zz-c36-gate", 4);
  const cleanReport = runShipGate(clean);
  assert.equal(report.passed, cleanReport.passed, "C36 minors change no pass/fail predicate");
});

test("C36: an unplanted makeChapter is apparatus-clean", () => {
  assert.deepEqual(findApparatusLeakage(makeChapter("zz-c36-clean", 3)), []);
});

// ── The strip half (mint-removal grammar) ──────────────────────────────────────

test("stripPageCitationSpans removes the citation span and tidies the seams (real packet sentences)", () => {
  const cases: Array<[string, string]> = [
    [
      "Growth Management is documented at Ch. 3 pp. 47-48 as supporting each person's trajectory.",
      "Growth Management is documented as supporting each person's trajectory.",
    ],
    ["HHIPP is documented at Ch. 6 pp. 137-141 and 152.", "HHIPP is documented."],
    [
      "SBI is tied to the Center for Creative Leadership and Ch. 6 p. 138.",
      "SBI is tied to the Center for Creative Leadership.",
    ],
    [
      "The official glossary places HHIPP at Ch. 6 pp. 137-141 and 152, with members Humble and Helpful.",
      "The official glossary places HHIPP, with members Humble and Helpful.",
    ],
    [
      "On page 33, Radical Candor names the danger of comfort without direct challenge.",
      "Radical Candor names the danger of comfort without direct challenge.",
    ],
    ["Ruinous Empathy appears at Ch. 2 p. 33 as care without direct challenge.", "Ruinous Empathy appears as care without direct challenge."],
  ];
  for (const [input, expected] of cases) {
    assert.equal(stripPageCitationSpans(input), expected, `strip drifted on: ${input}`);
  }
});

test("stripPageCitationSpans is a NO-OP on citation-free text; isPageCitationOnly classifies bare locators", () => {
  for (const text of [
    "In 1997 Steve Jobs returned to Apple.",
    "She marked page 90 of the manuscript with a pencil.",
    "The team shipped 47 units in p2 of the quarter.",
  ]) {
    assert.equal(stripPageCitationSpans(text), text, `no-op expected on: ${text}`);
    assert.equal(isPageCitationOnly(text), false);
  }
  for (const locator of ["Ch. 6 p. 138", "Ch. 1 pp. 9 and 14", "pp. 47-48", "Ch. 4 pp. 82-109"]) {
    assert.equal(isPageCitationOnly(locator), true, `bare locator must classify citation-only: ${locator}`);
    assert.equal(stripPageCitationSpans(locator), "", `bare locator must strip to empty: ${locator}`);
  }
});

test("strip ⊇ detector on the compound/abbreviation forms: anything the detector flags as a Ch./p./pp. span, the strip removes", () => {
  for (const text of [
    "documented at Ch. 3 pp. 47-48 as supporting",
    "the pair at Ch. 1 pp. 9 and 14.",
    "at pp. 49-50 as gradual growth",
    "On page 33, the danger is named.",
  ]) {
    assert.ok(PAGE_CITATION_RE.test(text), `precondition: detector fires on ${text}`);
    assert.ok(!PAGE_CITATION_RE.test(stripPageCitationSpans(text)), `strip must remove every detectable span from: ${text}`);
  }
});

// ── Synthetic gold corpus: ZERO ────────────────────────────────────────────────

test("C36: synthetic gold corpus has ZERO apparatus findings (all four categories)", () => {
  for (const { bookId, files } of [...goldChapterFiles(), ...labelCleanCorpusChapterFiles()]) {
    for (const file of files) {
      const ch = JSON.parse(readFileSync(file, "utf8")) as ChapterV21;
      const hits = checkApparatusLeakage(ch);
      assert.deepEqual(hits, [], `C36 false positive on synthetic gold ${bookId} ${ch.chapterId}: ${hits.map((h) => h.message.slice(0, 120)).join(" | ")}`);
    }
  }
});

// ── Real-corpus pins (measured 2026-07-09; skip when a corpus is absent) ───────

function stateBookChapters(bookId: string): ChapterV21[] {
  if (!existsSync(STATE_CHAPTERS)) return [];
  return readdirSync(STATE_CHAPTERS)
    .filter((f) => f.startsWith(`${bookId}-ch`) && f.endsWith(".v21-native.chapter.json"))
    .sort()
    .map((f) => JSON.parse(readFileSync(resolve(STATE_CHAPTERS, f), "utf8")) as ChapterV21);
}

function packageChapters(bookId: string): ChapterV21[] {
  const p = resolve(PKG_DIR, `${bookId}.v21.json`);
  if (!existsSync(p)) return [];
  return (JSON.parse(readFileSync(p, "utf8")) as { chapters: ChapterV21[] }).chapters;
}

/** Chapter numbers firing per category, for pinning. */
function firingByCategory(chapters: ChapterV21[]): Record<string, number[]> {
  const out: Record<string, number[]> = { page_citation: [], guide_structure: [], machinery_term: [], spec_narration: [] };
  for (const ch of chapters) {
    const cats = new Set(findApparatusLeakage(ch).map((h) => h.category));
    for (const c of cats) out[c].push(ch.number);
  }
  return out;
}

// Clean corpora — pinned ZERO across all four categories.
for (const [label, chapters] of [
  ["gold start-with-why (state)", stateBookChapters("start-with-why")],
  ["the-culture-code (state)", stateBookChapters("the-culture-code")],
  ["high-output-management (package)", packageChapters("high-output-management")],
  ["multipliers (package)", packageChapters("multipliers")],
] as Array<[string, ChapterV21[]]>) {
  if (chapters.length === 0) {
    skip(`C36 clean-corpus pin: ${label}`, `${label} not present on this machine`);
  } else {
    test(`C36: ${label} (${chapters.length} ch) is apparatus-clean (measured ZERO, all categories)`, () => {
      const firing = firingByCategory(chapters);
      for (const [cat, chs] of Object.entries(firing)) {
        assert.deepEqual(chs, [], `C36 ${cat} pin drifted on ${label}: fires on ch${chs.join(", ch")}`);
      }
    });
  }
}

// The former defect corpus — radical-candor WAS the review's §7 inventory
// (page_citation ch1/2/3/4/6/7, guide_structure ch3/4/7/8/9, machinery ch1/6 incl.
// the ch6 q01 quiz units, spec_narration ch2/4/5). The CF-J content repair
// (2026-07-09) stripped/naturalized every occurrence — DELIBERATE pin change to
// the repaired measurement: ZERO across all four categories, same as the clean
// corpora above. Any re-fire is a regression in the book, not calibration drift.
{
  const chapters = stateBookChapters("radical-candor");
  if (chapters.length === 0) {
    skip("C36 repaired-corpus pin: radical-candor", "radical-candor chapters not in state/chapters/ on this machine");
  } else {
    test(`C36: radical-candor (${chapters.length} ch) is apparatus-clean after the CF-J content repair (measured ZERO, all categories)`, () => {
      const firing = firingByCategory(chapters);
      for (const [cat, chs] of Object.entries(firing)) {
        assert.deepEqual(chs, [], `C36 ${cat} pin drifted on radical-candor: fires on ch${chs.join(", ch")}`);
      }
    });
  }
}
