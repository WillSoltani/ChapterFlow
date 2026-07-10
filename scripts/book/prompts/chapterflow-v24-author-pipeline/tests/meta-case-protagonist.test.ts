/**
 * C32 — meta-case protagonist (CF-I-1). An example whose ACTOR is a pipeline artifact
 * ("The case stops…", "The late fix used…") rather than a person or real situation —
 * offstage machinery narration shipped to the reader (multipliers ch02, report §7.3.1).
 *
 * Calibration contract: the artifact-subject sentence FIRES, an object/modifier/prepositional
 * use is SPARED, a document-subject book is EXEMPT via the sidecar, the synthetic gold corpus
 * is ZERO, and the real gold corpus (start-with-why) is pinned at its MEASURED count ("The
 * source gives…" in ch07 — the same leak, honest and advisory).
 */

import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "fs";
import { resolve } from "path";

import { test, skip } from "./harness.js";
import { makeChapter, goldChapterFiles, labelCleanCorpusChapterFiles, STATE_CHAPTERS } from "./helpers.js";
import {
  fieldHasArtifactSubject,
  findArtifactSubjects,
  namedCasesAreArtifacts,
  checkMetaCaseProtagonist,
} from "../src/critics/metaCaseProtagonist.js";
import { runShipGate } from "../src/critics/finalGate.js";
import type { ChapterV21, Example } from "../src/types.js";

function chapterWith(fields: Array<Partial<Pick<Example, "scenario" | "whatToDo" | "whyItMatters">>>): ChapterV21 {
  return {
    examples: fields.map((f, i) => ({
      exampleId: `ex${String(i + 1).padStart(2, "0")}`,
      title: "t",
      scenario: f.scenario ?? "Dana rebuilds the plan around one named owner before the next handoff lands.",
      whatToDo: f.whatToDo ?? "Rebuild the plan around one named owner before the next handoff.",
      whyItMatters: f.whyItMatters ?? "A named owner keeps a slipped deadline from decaying into silence.",
    })) as unknown as Example[],
  } as unknown as ChapterV21;
}

// ── The pure detector ─────────────────────────────────────────────────────────

test("C32: fieldHasArtifactSubject fires on a machinery artifact acting as subject", () => {
  assert.equal(fieldHasArtifactSubject("The late fix used Nadella's 2014 CEO appointment as the concrete anchor."), true);
  assert.equal(fieldHasArtifactSubject("The case stops preserving history for its own sake."), true);
  assert.equal(fieldHasArtifactSubject("The case works when broad approval stops and the strength gets matched."), true);
  // multi-comma fronted clause: the subject sits after the LAST comma.
  assert.equal(fieldHasArtifactSubject("Had Reed, Patty, and the culture deck not been brought back, the case would rest on reputation."), true);
});

test("C32: fieldHasArtifactSubject spares object / modifier / prepositional / non-machinery uses", () => {
  assert.equal(fieldHasArtifactSubject("Name the case before you praise the result."), false, "object position");
  assert.equal(fieldHasArtifactSubject("The case for growth is clear enough to act on."), false, "prepositional 'the case for'");
  assert.equal(fieldHasArtifactSubject("The source note tells a different story than the report."), false, "compound noun (source modifies note)");
  assert.equal(fieldHasArtifactSubject("The team rebuilt the plan around one named owner."), false, "non-machinery subject");
  assert.equal(fieldHasArtifactSubject("Dana rebuilds the draft before the next handoff."), false, "artifact in object position");
});

// ── The chapter-level critic ──────────────────────────────────────────────────

// Distilled from multipliers ch02: two examples whose fields make the artifact the actor.
const META_CASE_FIELDS: Array<Partial<Pick<Example, "scenario" | "whatToDo" | "whyItMatters">>> = [
  { scenario: "The late fix used the 2014 appointment as the concrete anchor, then asked what capability should move.", whyItMatters: "The case stops preserving history for its own sake; it shows a before-to-after consequence." },
  { scenario: "The case works when broad approval stops and the specific strength gets matched to a real challenge." },
];

test("C32 fires ONCE when ≥2 fields across ≥2 examples make the artifact the actor", () => {
  const findings = checkMetaCaseProtagonist(chapterWith(META_CASE_FIELDS), null);
  assert.equal(findings.length, 1, "one advisory per chapter");
  assert.equal(findings[0].severity, "minor", "ADVISORY — never blocks");
  assert.match(findings[0].message, /pipeline artifact the acting subject/);
  const hits = findArtifactSubjects(chapterWith(META_CASE_FIELDS));
  assert.equal(hits.length, 3, "three artifact-subject fields detected");
  assert.equal(new Set(hits.map((h) => h.exampleId)).size, 2, "across two distinct examples");
});

test("C32 stays under threshold on a SINGLE artifact-subject field (one example)", () => {
  const ch = chapterWith([{ whyItMatters: "The case stops preserving history for its own sake." }, {}, {}]);
  assert.equal(findArtifactSubjects(ch).length, 1, "one field detected");
  assert.equal(checkMetaCaseProtagonist(ch, null).length, 0, "one artifact-subject field is a slip, not the tic");
});

test("C32 is EXEMPT when the source sidecar's named cases are themselves documents (red-team rule 1)", () => {
  const docSidecar = {
    namedExamples: [
      { label: "the 2009 Netflix culture deck", summary: "the deck's freedom-and-responsibility clauses" },
      { label: "the merger contract draft", summary: "the draft's indemnity section" },
    ],
  };
  assert.equal(namedCasesAreArtifacts(docSidecar), true);
  // Even a chapter full of artifact-subject fields is spared when the book is ABOUT documents.
  assert.equal(checkMetaCaseProtagonist(chapterWith(META_CASE_FIELDS), docSidecar).length, 0);
});

test("C32 over-breadth fix: a people-cased sidecar whose summaries use modal \"will\" does NOT exempt", () => {
  // Regression (CF-I): DOC_HEAD used to include the bare token "will" and matched it
  // anywhere in label+summary — so ordinary future-tense case summaries silently
  // disabled C32 for the whole chapter.
  const peopleSidecarWithModalWill = {
    namedExamples: [
      { label: "Microsoft under Satya Nadella", summary: "the new CEO will move the company toward cloud-first" },
      { label: "Pixar's Braintrust", summary: "peer review will surface the weak reel before release" },
    ],
  };
  assert.equal(namedCasesAreArtifacts(peopleSidecarWithModalWill), false, "modal 'will' in a summary is not a document head");
  assert.equal(checkMetaCaseProtagonist(chapterWith(META_CASE_FIELDS), peopleSidecarWithModalWill).length, 1, "C32 still fires — the exemption stays off");
});

test("C32 over-breadth fix: ambiguous doc nouns (brief/letter) exempt only as the case LABEL's head", () => {
  // Head position in the LABEL → a genuinely document-cased book still exempts.
  const docHeadLabels = {
    namedExamples: [
      { label: "the appellate brief", summary: "its jurisdictional argument" },
      { label: "the Birmingham letter", summary: "its response to the eight clergymen" },
    ],
  };
  assert.equal(namedCasesAreArtifacts(docHeadLabels), true, "brief/letter as the label head still exempts");
  // The same tokens anywhere ELSE (summary prose, mid-label) no longer exempt.
  const ambiguousInSummary = {
    namedExamples: [
      { label: "Reed Hastings at Netflix", summary: "a brief detour into DVDs before streaming" },
      { label: "Sherron Watkins at Enron", summary: "she sent a letter to Ken Lay about the accounting" },
    ],
  };
  assert.equal(namedCasesAreArtifacts(ambiguousInSummary), false, "'brief'/'letter' in summaries is not a document-cased book");
  assert.equal(checkMetaCaseProtagonist(chapterWith(META_CASE_FIELDS), ambiguousInSummary).length, 1, "C32 still fires under the people-cased sidecar");
});

test("C32: a company/people sidecar does NOT exempt (the multipliers case)", () => {
  const peopleSidecar = {
    namedExamples: [
      { label: "Microsoft under Satya Nadella", summary: "the 2014 CEO transition" },
      { label: "Pixar's Braintrust", summary: "Ed Catmull's peer-review practice" },
    ],
  };
  assert.equal(namedCasesAreArtifacts(peopleSidecar), false);
  assert.equal(checkMetaCaseProtagonist(chapterWith(META_CASE_FIELDS), peopleSidecar).length, 1);
});

// ── Ship-gate wiring + severity ───────────────────────────────────────────────

test("C32: the ship gate surfaces the meta-case slate as a minor (wiring + severity)", () => {
  const ch = makeChapter("zz-c32-gate", 4);
  ch.examples[0].scenario = "The late fix used the earliest divergent record as the concrete anchor, then re-ran the voltage check before the shift continued past its mark.";
  ch.examples[0].whyItMatters = "The case stops preserving the drift for its own sake; it shows a before-to-after consequence the next owner can actually repeat under pressure.";
  ch.examples[1].scenario = "The case works when the rushed comparison stops and the specific resistor reading gets matched to yesterday's note before anyone signs off on the totals.";
  const report = runShipGate(ch);
  assert.ok(report.minors.some((m) => m.catalogId === "C32.meta_case_protagonist"), `expected a C32 minor; got ${report.minors.map((m) => m.catalogId).join(", ")}`);
  assert.ok(!report.blockers.some((b) => b.catalogId === "C32.meta_case_protagonist"), "C32 must never be a blocker");
});

test("C32: an unplanted makeChapter (person-subject scenes) is clean", () => {
  assert.equal(checkMetaCaseProtagonist(makeChapter("zz-c32-clean", 3), null).length, 0);
});

// ── Gold-corpus calibration pins ──────────────────────────────────────────────

test("C32: synthetic gold corpus has ZERO meta-case findings", () => {
  for (const { bookId, files } of [...goldChapterFiles(), ...labelCleanCorpusChapterFiles()]) {
    for (const file of files) {
      const ch = JSON.parse(readFileSync(file, "utf8")) as ChapterV21;
      const hits = checkMetaCaseProtagonist(ch, null);
      assert.equal(hits.length, 0, `C32 false positive on synthetic gold ${bookId} ${ch.chapterId}: ${hits.map((h) => h.message.slice(0, 90)).join(" | ")}`);
    }
  }
});

// The real gold corpus is NOT zero: start-with-why ch07 narrates "The source gives…" (the
// same source-packet-as-protagonist leak, one chapter). The pin records the MEASURED count
// so a NEW gold chapter adopting the tic is caught, while faithfully recording the pre-existing
// leak. Uses sidecarOverride=null so the pin is disk-independent (no exemption path).
{
  const bookId = "start-with-why";
  const files = existsSync(STATE_CHAPTERS)
    ? readdirSync(STATE_CHAPTERS).filter((f) => f.startsWith(`${bookId}-ch`) && f.endsWith(".v21-native.chapter.json"))
    : [];
  if (files.length === 0) {
    skip(`C32 gold pin: ${bookId}`, `no ${bookId} chapters in state/chapters/ on this machine`);
  } else {
    test(`C32: real gold corpus ${bookId} (${files.length} ch) emits its MEASURED count`, () => {
      const firing: string[] = [];
      for (const f of files) {
        const ch = JSON.parse(readFileSync(resolve(STATE_CHAPTERS, f), "utf8")) as ChapterV21;
        if (checkMetaCaseProtagonist(ch, null).length > 0) firing.push(ch.chapterId);
      }
      assert.equal(firing.length, 1, `C32 gold-corpus pin drifted (expected 1 firing chapter — start-with-why ch07 "The source gives…"; got ${firing.length}: ${firing.join(", ")})`);
    });
  }
}
