import assert from "node:assert/strict";

import { test } from "./harness.js";
import { checkScaffoldLeak } from "../src/critics/scaffoldLeak.js";

function chapterWith(scenario: string, domain = "office desk argument"): any {
  return {
    chapterId: "zz-fixture-ch01",
    number: 1,
    hook: "A clean hook.",
    examples: [{ scenario, planSpec: { domain } }],
  };
}

// SL6 lives in quiz explanations (the leak surface) — build a chapter whose only reader
// text is a single quiz explanation so the assertion is scoped to that field.
function chapterWithExplanation(explanation: string): any {
  return {
    chapterId: "zz-fixture-ch01",
    number: 1,
    quiz: { questions: [{ explanation }] },
  };
}

test("SL1 blocks underscore format-tag tokens but not real English words", () => {
  const leak = checkScaffoldLeak(chapterWith("Mara opens with a coach_talk about the budget."));
  assert.ok(leak.some((f) => f.checkId === "SL1.format_tag_leak" && f.severity === "blocker"), JSON.stringify(leak));
  // Single-word formats are real English and must NOT fire.
  const clean = checkScaffoldLeak(chapterWith("She ran an audit, then the scene shifted to a tense dialogue."));
  assert.deepEqual(clean.filter((f) => f.checkId === "SL1.format_tag_leak"), []);
});

test("SL2 flags a Title-Case paste of the planSpec.domain", () => {
  const f = checkScaffoldLeak(chapterWith(
    "Jenna reviews Peyton's Teacher Setting Terms For grade-update calls before the meeting.",
    "teacher setting terms for grade-update calls",
  ));
  assert.ok(f.some((x) => x.checkId === "SL2.domain_label_leak" && x.severity === "major"), JSON.stringify(f));
});

test("SL3 flags source-notes glowing on a screen, not an incoming name/message", () => {
  const bad = checkScaffoldLeak(chapterWith("The town-hall notes about the dispute glow on his phone while he waits."));
  assert.ok(bad.some((x) => x.checkId === "SL3.spectator_prop"), JSON.stringify(bad));
  // Reverse word order ("phone glowed with the notes") must also fire.
  const reverse = checkScaffoldLeak(chapterWith("His phone glowed with the case notes about the dispute as he waited."));
  assert.ok(reverse.some((x) => x.checkId === "SL3.spectator_prop"), JSON.stringify(reverse));
  const ok = checkScaffoldLeak(chapterWith("His sister's name glows on the phone before the doctor calls."));
  assert.deepEqual(ok.filter((x) => x.checkId === "SL3.spectator_prop"), []);
});

test("SL4 flags a cited academic source staged as a physical prop (the-organized-mind ch06)", () => {
  // Citation (year + journal venue) attached to a projected visual aid.
  const slide = checkScaffoldLeak(chapterWith("Ryan hears the projector fan buzz under the 1974 Science slide, and the room waits."));
  assert.ok(slide.some((f) => f.checkId === "SL4.citation_prop" && f.severity === "major"), JSON.stringify(slide));
  // Citation + a handled source document (notes read-from).
  const notes = checkScaffoldLeak(chapterWith("Constance reads the matched-loss wording from the 1979 Econometrica notes and asks again."));
  assert.ok(notes.some((f) => f.checkId === "SL4.citation_prop"), JSON.stringify(notes));
});

test("SL4 does NOT fire on a finding cited with an abstract verb (precision)", () => {
  // These are the legitimate citations the-organized-mind also shipped — the source's
  // FINDING drives the sentence; nothing is handled. None may fire.
  const legit = [
    "The 2008 PNAS work by Sridharan, Levitin, and Menon puts the right fronto-insular cortex in this switching story.",
    "He calls Mark Granovetter's 1973 American Journal of Sociology weak-ties paper a reason to network harder.",
    "Walter Mischel's 1989 Science work on delay of gratification comes back to him: attention changes the pull.",
  ];
  for (const s of legit) {
    assert.deepEqual(
      checkScaffoldLeak(chapterWith(s)).filter((f) => f.checkId === "SL4.citation_prop"),
      [],
      `SL4 false-fired on a legit citation: ${s}`,
    );
  }
});

test("SL4 does NOT fire on a capitalized common-word venue used non-academically (adversarial-review FP class)", () => {
  // Confirmed false positives from the SL4 adversarial review: a brand / place / surname /
  // subject (Science Museum, Nature documentary, Nature Valley, Cell Block, Mr. Lancet,
  // Neuron Cafe, Nature Conservancy) near any year + a visual-aid word. The citation must
  // DIRECTLY label the prop, so none of these may fire.
  const cleanFPs = [
    "At the Science Museum in 2017 he buys slides for the old projector in the attic as a gag gift.",
    "The 1994 riot in Cell Block C still hangs as a poster in the warden's office, a warning he ignores.",
    "She slides the 2022 Nature Valley invoice across the desk and asks why the granola order doubled.",
    "The 2016 Nature documentary plays off the projector while the kids eat dinner.",
    "A faded 2010 Nature Conservancy poster hangs over the worksheet bin in the classroom.",
    "The Science teacher hands out the lab worksheet, due 2023, before the bell rings.",
    "Mr. Lancet hands out the 2021 worksheet and tells them to start.",
    "The 2020 Neuron Cafe poster still advertises the open-mic that never happened.",
    "He reads his 2015 Nature trip notes from the journal, smiling at the bird list.",
  ];
  for (const s of cleanFPs) {
    assert.deepEqual(
      checkScaffoldLeak(chapterWith(s)).filter((f) => f.checkId === "SL4.citation_prop"),
      [],
      `SL4 false-fired on a non-academic capitalized venue: ${s}`,
    );
  }
});

test("SL4 needs BOTH a real citation and a prop — neither alone fires", () => {
  // A capitalized common-word venue with no year is not a citation ("Nature reserve").
  assert.deepEqual(
    checkScaffoldLeak(chapterWith("She points at the Nature reserve slide before the hike.")).filter((f) => f.checkId === "SL4.citation_prop"),
    [],
  );
  // A bare prop with no cited source is just a scene object, not citation-as-prop.
  assert.deepEqual(
    checkScaffoldLeak(chapterWith("She pulls up the slide and starts the standup.")).filter((f) => f.checkId === "SL4.citation_prop"),
    [],
  );
});

test("SL4 treats a generic 'Journal of X' as a citation only when bound to a year (FP class)", () => {
  // Without a year, "Journal of X" is ambiguous (a travel/finance journal-as-magazine, a
  // personal journal) — staging it with a prop must NOT fire.
  for (const s of [
    "She flips open the Journal of Travel notes and reads the bird list aloud.",
    "He grabs the Journal of Finance handout from the rack by the cafe door.",
  ]) {
    assert.deepEqual(
      checkScaffoldLeak(chapterWith(s)).filter((f) => f.checkId === "SL4.citation_prop"),
      [],
      `SL4 false-fired on a year-free generic journal: ${s}`,
    );
  }
  // Bound to a year it IS a citation — staging it as a visual aid still fires.
  const cited = checkScaffoldLeak(chapterWith("Maya pins the 2019 Journal of Neuroscience figure to the board and points."));
  assert.ok(cited.some((f) => f.checkId === "SL4.citation_prop"), JSON.stringify(cited));
});

test("SL5 flags publication metadata in reader prose (edition/publisher), not a finding citation", () => {
  // The #12 feedback case: "Donald Norman's 2013 revised edition from Basic Books".
  const edition = checkScaffoldLeak(chapterWith("Donald Norman's 2013 revised edition from Basic Books makes the point about doors."));
  assert.ok(edition.some((f) => f.checkId === "SL5.publication_detail" && f.severity === "major"), JSON.stringify(edition));
  const publisherCited = checkScaffoldLeak(chapterWith("Penguin published the 2011 study that Mara keeps quoting."));
  assert.ok(publisherCited.some((f) => f.checkId === "SL5.publication_detail"), JSON.stringify(publisherCited));
});

test("SL5 does NOT fire on a bare 'edition'/year, a publisher-as-setting, or a book-as-object", () => {
  const cases = [
    "The 2013 edition we studied had fourteen chapters worth reading.", // bare "edition" + year, no qualifier
    "She worked at Penguin for years and learned to wait out a bad draft.", // publisher as a workplace setting, no citation cue
    "A worn paperback sat open on the windowsill while the kettle boiled.", // a book as a physical object, not metadata
    "He drove down Edition Avenue past the old press building.", // "Edition" as a place name (edition not preceded by a qualifier)
    // Publisher-as-biography NEAR a year must NOT fire (the bare-year FP class an
    // adversarial review caught: a publisher name + any year alone was tripping it).
    "She joined Penguin in 2011 as a junior editor and rose fast.",
    "He started at Random House in 1998 sorting mail in the basement.",
    "By 2016 she ran the whole marketing team at HarperCollins.",
    // Single-token imprints that are really a PERSON or PLACE + a cue word — pruned from
    // the publisher list so they no longer false-fire (the SL5 name/place-collision class).
    "Harper published her first poem at nine, in the school magazine.",
    "The Riverhead diner published its weekend menu every Friday.",
    // A physical book as a scene PROP — a qualified edition with no publication cue nearby.
    "She kept the first edition on the shelf for luck, next to the dried flowers.",
  ];
  for (const s of cases) {
    assert.deepEqual(
      checkScaffoldLeak(chapterWith(s)).filter((f) => f.checkId === "SL5.publication_detail"),
      [],
      `SL5 false-fired on: ${s}`,
    );
  }
});

test("SL6 blocks internal source-anchor numbering cited as reader prose ('Fact 7 says…')", () => {
  // The exact shipped leak (the-millionaire-next-door / eat-that-frog / 12 more books): the
  // numbered source catalog (anchor id "chNN.fact.N") rendered as "Fact N says…" in a quiz
  // explanation, with no "Fact N" anywhere on the reader page.
  const leak = checkScaffoldLeak(chapterWithExplanation("Fact 7 says repeated rescue can let overspending continue. The waiting choice treats size as a reason to wait."));
  assert.ok(leak.some((f) => f.checkId === "SL6.source_numbering_leak" && f.severity === "blocker"), JSON.stringify(leak));
  // The other unambiguous internal-anchor labels + a reference verb also fire.
  for (const s of ["Source 3 shows the rule still holds.", "Reference 2 notes the hidden cost.", "Evidence 9 warns against the shortcut.", "Fact 8 warns that startup friction is not failure."]) {
    assert.ok(checkScaffoldLeak(chapterWithExplanation(s)).some((f) => f.checkId === "SL6.source_numbering_leak"), `SL6 missed: ${s}`);
  }
  // Spelled-out numbers behind the same reference-verb anchor (the exact power-of-moments leak).
  for (const s of ["Fact five favors purpose framing over more information.", "Fact six says progress needs a nameable marker.", "Fact seven says generic service language is weaker."]) {
    assert.ok(checkScaffoldLeak(chapterWithExplanation(s)).some((f) => f.checkId === "SL6.source_numbering_leak"), `SL6 missed spelled-out: ${s}`);
  }
});

test("SL6 does NOT fire on ordinary prose (no adjacent reference verb; excluded enumerators)", () => {
  const clean = [
    "In fact 7 out of 10 people relapse within a week of starting.",      // "fact 7" but the next word is "out", not a verb
    "The fact that 3 colleagues left did not change her plan.",           // "fact that", no number directly after the label
    "Point 3 shows the trade-off, and step 1 is simply to breathe.",      // Point / step are excluded common enumerators
    "Finding 2 ways to rest, she tried both that weekend.",               // Finding is an excluded enumerator
    "Source the parts locally and the cost drops by half.",              // "Source" with no number
    "Fact-check the figure before you quote it to the team.",            // hyphenated, no number
    "The fact five hospitals shared one nurse did not surprise the board.", // spelled-out, next word is a noun, not a reference verb
    "In fact five teams shipped early that quarter.",                     // "fact five" but "shipped" trails "teams", not the label
  ];
  for (const s of clean) {
    assert.deepEqual(
      checkScaffoldLeak(chapterWithExplanation(s)).filter((f) => f.checkId === "SL6.source_numbering_leak"),
      [],
      `SL6 false-fired on: ${s}`,
    );
  }
});

test("a clean scenario produces no scaffold-leak findings", () => {
  assert.deepEqual(checkScaffoldLeak(chapterWith("At the town hall, Hyun raises a hand and names the weekday-walk pattern aloud.")), []);
});
