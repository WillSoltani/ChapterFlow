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

test("a clean scenario produces no scaffold-leak findings", () => {
  assert.deepEqual(checkScaffoldLeak(chapterWith("At the town hall, Hyun raises a hand and names the weekday-walk pattern aloud.")), []);
});
