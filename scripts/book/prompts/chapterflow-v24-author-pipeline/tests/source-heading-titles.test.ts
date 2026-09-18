/**
 * Chapter titles come from the SOURCE TEXT's own headings (Franklin, run
 * book-run-755fb671).
 *
 * The bibliography researcher recalled chapter titles instead of reading them.
 * Chapter 15 was listed as "Appointment as Deputy Postmaster General" while the
 * edition heads that chapter "QUARRELS WITH THE PROPRIETARY GOVERNORS", the
 * structural review then blocked the book ("Chapter 15's title … but no part of
 * the chapter discusses that appointment"), and the repair lane can never change
 * a title — chapter identity is frozen.
 *
 * The heading was inside the frozen text the whole time, printed at the start of
 * the span the chapter map resolves. These tests pin both halves of the fix:
 *
 *   (a) the extractor + title-caser, over span-start snippets copied verbatim
 *       from the pinned research run's frozen Gutenberg text (#20203);
 *   (b) the ONE reconciliation point in the research flow — the reconciled list
 *       is what the raw bibliography, toc.json, the manifest's expected chapters
 *       and expectedChaptersHash, the chapter map and the chapter researcher's
 *       own input all carry, so nothing downstream can see the recalled title.
 */

import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { resolve } from "path";

import { test } from "./harness.js";
import { researchBook, CHAPTER_MAP_REL_PATH } from "../src/researcher.js";
import { sourceChapterTitleAtSpanStart, sourceHeadingAtSpanStart, titleCaseSourceHeading } from "../src/source/chapterHeadingTitle.js";
import type { BibliographyResult } from "../src/agents/researcher-bibliography.js";
import type { ChapterResearchInput, ChapterResearchResult } from "../src/agents/researcher-chapter.js";
import { expectedChaptersHash, readResearchRunManifest } from "../src/lib/researchRunManifest.js";
import type { ChapterMapV1 } from "../src/source/chapterMap.js";

// ── (a) the extractor, over VERBATIM span starts of the frozen Gutenberg text ──

test("R-046 titles: a span start yields the edition's own heading, title-cased, or nothing", () => {
  // ch15 — a numeral line, then a heading wrapped over two lines.
  assert.equal(
    sourceChapterTitleAtSpanStart("XV\n\nQUARRELS WITH THE PROPRIETARY\nGOVERNORS\n\n\nIn my journey to Boston this year, I met at New York with our new\ngovernor, Mr. Morris, just arriv'd there from En"),
    "Quarrels with the Proprietary Governors",
  );
  // ch13 — no numeral, and a parenthesised date line printed under the heading.
  assert.equal(
    sourceChapterTitleAtSpanStart("PUBLIC SERVICES AND DUTIES\n\n(1749-1753)\n\n\nPeace being concluded, and the association business therefore at an\nend, I turn'd my thoughts again to the affair of e"),
    "Public Services and Duties",
  );
  // …and the same date line with no blank between it and the heading is still
  // not part of the title.
  assert.equal(
    sourceHeadingAtSpanStart("PUBLIC SERVICES AND DUTIES\n(1749-1753)\n\nPeace being concluded"),
    "PUBLIC SERVICES AND DUTIES",
  );
  // ch01 — the span opens on the letter to his son. No heading exists.
  assert.equal(
    sourceChapterTitleAtSpanStart("  Twyford,[3] at the Bishop of St. Asaph's, 1771.\n\nDear son: I have ever had pleasure in obtaining any little anecdotes\nof my ancestors."),
    null,
  );
  // A numeral followed straight by prose is not a heading either.
  assert.equal(sourceChapterTitleAtSpanStart("I\n\nFrom a child I was fond of reading, and all the little money"), null);
  // ch16 / ch10 / ch17 — apostrophes survive, small words go lowercase.
  assert.equal(sourceChapterTitleAtSpanStart("BRADDOCK'S EXPEDITION\n\n\nThe British government, not chusing to permit"), "Braddock's Expedition");
  assert.equal(
    sourceChapterTitleAtSpanStart("X\n\nPOOR RICHARD'S ALMANAC AND\nOTHER ACTIVITIES\n\n\nIn 1732 I first publish'd my Almanack"),
    "Poor Richard's Almanac and Other Activities",
  );
  assert.equal(
    sourceChapterTitleAtSpanStart("XVII\n\nFRANKLIN'S DEFENSE OF THE\nFRONTIER\n\n\nWhile the several companies in the city"),
    "Franklin's Defense of the Frontier",
  );
  // The caser alone, on the strings the table above turns on.
  assert.equal(titleCaseSourceHeading("QUARRELS WITH THE PROPRIETARY GOVERNORS"), "Quarrels with the Proprietary Governors");
  assert.equal(titleCaseSourceHeading("AGENT OF PENNSYLVANIA IN LONDON"), "Agent of Pennsylvania in London");
  assert.equal(titleCaseSourceHeading("BEGINNING LIFE AS A PRINTER"), "Beginning Life as a Printer");
});

test("R-046 titles: a structural LABEL line above the heading is a label, never the chapter's name", () => {
  // Franklin's edition prints a bare numeral ("XV"); most Gutenberg editions
  // print "CHAPTER II." / "PART ONE" on that same line instead. Both are the
  // chapter's LABEL. Taking one as the chapter's name discards the real title
  // and freezes a content-free identity no lane can repair — and a repeated
  // "PART ONE" label would give several chapters one identical title.
  assert.equal(
    sourceChapterTitleAtSpanStart("CHAPTER II.\n\nARRIVAL IN PHILADELPHIA\n\nI have been the more particular in this description of my journey"),
    "Arrival in Philadelphia",
  );
  assert.equal(
    sourceChapterTitleAtSpanStart("CHAPTER XV\nQUARRELS WITH THE PROPRIETARY\nGOVERNORS\n\nIn my journey to Boston this year"),
    "Quarrels with the Proprietary Governors",
  );
  assert.equal(
    sourceChapterTitleAtSpanStart("PART ONE\n\nBEGINNING LIFE AS A PRINTER\n\nMy elder brothers were all put apprentices"),
    "Beginning Life as a Printer",
  );
  assert.equal(
    sourceChapterTitleAtSpanStart("CHAPTER 3\n\nFIRST VISIT TO BOSTON\n\nI continued thus employed in my father's business"),
    "First Visit to Boston",
  );
  assert.equal(
    sourceChapterTitleAtSpanStart("BOOK I.\n\nSCIENTIFIC EXPERIMENTS\n\nIn 1746, being at Boston, I met there with a Dr. Spence"),
    "Scientific Experiments",
  );
  assert.equal(
    sourceChapterTitleAtSpanStart("SECTION 2\n\nALBANY PLAN OF UNION\n\nIn 1754, war with France being again apprehended"),
    "Albany Plan of Union",
  );
  assert.equal(
    sourceChapterTitleAtSpanStart("CHAPTER\n\nDEFENSE OF THE PROVINCE\n\nThe honour of the province was concerned"),
    "Defense of the Province",
  );
  // A label with NO heading under it names nothing: the bibliography title is
  // kept rather than replaced by "Chapter Xv" / "Part One".
  assert.equal(sourceChapterTitleAtSpanStart("CHAPTER XV\n\nIn my journey to Boston this year, I met at New York"), null);
  assert.equal(sourceChapterTitleAtSpanStart("PART ONE\n\n\nMy elder brothers were all put apprentices to different trades"), null);
  assert.equal(sourceChapterTitleAtSpanStart("LETTER I.\n\nDear son: I have ever had pleasure in obtaining any little anecdotes"), null);
  // …and a genuine heading that merely BEGINS with one of those words is a
  // heading, not a label: the label form is the word PLUS a numeral, nothing else.
  assert.equal(
    sourceChapterTitleAtSpanStart("LETTER TO HIS SON\n\nDear son: I have ever had pleasure in obtaining any little anecdotes"),
    "Letter to His Son",
  );
  assert.equal(
    sourceChapterTitleAtSpanStart("PART OF THE ART OF VIRTUE\n\nIt was about this time I conceiv'd the bold and arduous project"),
    "Part of the Art of Virtue",
  );
  assert.equal(
    sourceChapterTitleAtSpanStart("CHAPTERS OF A PRINTING HOUSE\n\nI now open'd a little stationer's shop"),
    "Chapters of a Printing House",
  );
  // A SPELLED-OUT or ORDINAL numeral is the same label. A 19th-century edition
  // prints "CHAPTER THE FIRST"; a long one counts past twenty. Reading either as
  // the chapter's name would discard the real heading printed one line below and
  // freeze "Chapter Twenty-one" as an identity no lane can repair.
  assert.equal(
    sourceChapterTitleAtSpanStart("CHAPTER THE FIRST\n\nARRIVAL IN PHILADELPHIA\n\nI have been the more particular in this description"),
    "Arrival in Philadelphia",
  );
  assert.equal(
    sourceChapterTitleAtSpanStart("CHAPTER FIRST\n\nFIRST VISIT TO BOSTON\n\nI continued thus employed in my father's business"),
    "First Visit to Boston",
  );
  assert.equal(
    sourceChapterTitleAtSpanStart("CHAPTER TWENTY-ONE\n\nSCIENTIFIC EXPERIMENTS\n\nIn 1746, being at Boston, I met there with a Dr. Spence"),
    "Scientific Experiments",
  );
  assert.equal(
    sourceChapterTitleAtSpanStart("CHAPTER THIRTY\n\nDEFENSE OF THE PROVINCE\n\nThe honour of the province was concerned"),
    "Defense of the Province",
  );
  assert.equal(
    sourceChapterTitleAtSpanStart("CHAPTER TWENTY-FIFTH\n\nALBANY PLAN OF UNION\n\nIn 1754, war with France being again apprehended"),
    "Albany Plan of Union",
  );
  // …and, as with every other label, one with no heading under it names nothing.
  assert.equal(sourceChapterTitleAtSpanStart("CHAPTER TWENTY-ONE\n\nIn my journey to Boston this year, I met at New York"), null);
  // A bare numeral line must be a WELL-FORMED roman numeral, not merely a word
  // spelled out of I/V/X/L/C/D/M: eating "CIVIL" as a numeral would take the
  // first line of a wrapped heading for a label and title the chapter after its
  // second line.
  assert.equal(
    sourceChapterTitleAtSpanStart("CIVIL\nDISOBEDIENCE\n\nI heartily accept the motto that the government is best which governs least"),
    "Civil Disobedience",
  );
  assert.equal(
    sourceChapterTitleAtSpanStart("VIVID\nMEMORIES\n\nThe account returns to what he saw in the printing house"),
    "Vivid Memories",
  );
  // A real roman numeral above the heading is, of course, still a label.
  assert.equal(
    sourceChapterTitleAtSpanStart("XIX\n\nAGENT OF PENNSYLVANIA IN\nLONDON\n\nIn 1757 the assembly sent me to England"),
    "Agent of Pennsylvania in London",
  );
});

// ── (b) the reconciliation point ─────────────────────────────────────────────

/** The nineteen live rows: the title the bibliography returned, and the heading
 *  the edition prints at that chapter's span start (null = no heading). */
const ROWS: ReadonlyArray<{ number: number; bibliographyTitle: string; numeral: string | null; heading: string | null; dateLine?: string }> = [
  { number: 1, bibliographyTitle: "Ancestry and Boyhood in Boston", numeral: null, heading: null },
  { number: 2, bibliographyTitle: "Beginning Life as a Printer", numeral: null, heading: "BEGINNING LIFE AS A PRINTER" },
  { number: 3, bibliographyTitle: "Arrival in Philadelphia", numeral: null, heading: "ARRIVAL IN PHILADELPHIA" },
  { number: 4, bibliographyTitle: "First Visit to Boston", numeral: null, heading: "FIRST VISIT TO BOSTON" },
  { number: 5, bibliographyTitle: "Early Friends in Philadelphia", numeral: null, heading: "EARLY FRIENDS IN PHILADELPHIA" },
  { number: 6, bibliographyTitle: "First Visit to London", numeral: null, heading: "FIRST VISIT TO LONDON" },
  { number: 7, bibliographyTitle: "Return to Philadelphia and Early Business", numeral: "VII", heading: "BEGINNING BUSINESS IN\nPHILADELPHIA" },
  { number: 8, bibliographyTitle: "Founding the Library Company", numeral: "VIII", heading: "BUSINESS SUCCESS AND FIRST\nPUBLIC SERVICE" },
  { number: 9, bibliographyTitle: "The Project for Attaining Moral Perfection", numeral: "IX", heading: "PLAN FOR ATTAINING MORAL\nPERFECTION" },
  { number: 10, bibliographyTitle: "Religion, Marriage, and Poor Richard's Almanack", numeral: "X", heading: "POOR RICHARD'S ALMANAC AND\nOTHER ACTIVITIES" },
  { number: 11, bibliographyTitle: "Interest in Public Affairs", numeral: null, heading: "INTEREST IN PUBLIC AFFAIRS" },
  { number: 12, bibliographyTitle: "Defense of the Province", numeral: null, heading: "DEFENSE OF THE PROVINCE" },
  { number: 13, bibliographyTitle: "Public Services and Duties", numeral: null, heading: "PUBLIC SERVICES AND DUTIES", dateLine: "(1749-1753)" },
  { number: 14, bibliographyTitle: "Albany Plan of Union", numeral: null, heading: "ALBANY PLAN OF UNION" },
  { number: 15, bibliographyTitle: "Appointment as Deputy Postmaster General", numeral: "XV", heading: "QUARRELS WITH THE PROPRIETARY\nGOVERNORS" },
  { number: 16, bibliographyTitle: "Braddock's Expedition", numeral: null, heading: "BRADDOCK'S EXPEDITION" },
  { number: 17, bibliographyTitle: "Frontier Defense and the Militia", numeral: "XVII", heading: "FRANKLIN'S DEFENSE OF THE\nFRONTIER" },
  { number: 18, bibliographyTitle: "Scientific Experiments", numeral: null, heading: "SCIENTIFIC EXPERIMENTS" },
  { number: 19, bibliographyTitle: "Dispute with the Proprietors and Mission to England", numeral: "XIX", heading: "AGENT OF PENNSYLVANIA IN\nLONDON" },
];

/** What each chapter must be called once the source text has had its say. */
const EXPECTED_TITLES: Readonly<Record<number, string>> = {
  1: "Ancestry and Boyhood in Boston",
  2: "Beginning Life as a Printer",
  3: "Arrival in Philadelphia",
  4: "First Visit to Boston",
  5: "Early Friends in Philadelphia",
  6: "First Visit to London",
  7: "Beginning Business in Philadelphia",
  8: "Business Success and First Public Service",
  9: "Plan for Attaining Moral Perfection",
  10: "Poor Richard's Almanac and Other Activities",
  11: "Interest in Public Affairs",
  12: "Defense of the Province",
  13: "Public Services and Duties",
  14: "Albany Plan of Union",
  15: "Quarrels with the Proprietary Governors",
  16: "Braddock's Expedition",
  17: "Franklin's Defense of the Frontier",
  18: "Scientific Experiments",
  19: "Agent of Pennsylvania in London",
};

const WORDS = ["Philadelphia", "Boston", "London", "Junto", "Almanack", "assembly", "printing", "militia", "proprietary", "postmaster"];

/** One chapter's block of the fixture book: the span start exactly as the real
 *  edition prints it, then prose unique to that chapter. */
function blockFor(row: (typeof ROWS)[number]): string {
  const head: string[] = [];
  if (row.numeral !== null) head.push(row.numeral, "");
  if (row.heading !== null) {
    head.push(row.heading);
    head.push("");
    if (row.dateLine !== undefined) head.push(row.dateLine, "");
    head.push("");
  }
  const body = Array.from({ length: 14 }, (_, i) =>
    `In the ${WORDS[(row.number + i) % WORDS.length]} passage numbered ${row.number}.${i}, the account names a person, a place and a price, so a reader can check the sentence against the page rather than trusting a summary of it.`,
  ).join(" ");
  return `${head.join("\n")}${body} This closes unit ${row.number} of the fixture book, and nothing else in the text ends this way.`;
}

function fixtureBook(): { text: string; spans: Array<{ chapterNumber: number; startAnchor: string; endAnchor: string }> } {
  const FRONT = "The Project Gutenberg eBook of a fixture edition, prepared for a test that never calls a model.\n\nCONTENTS\n\n";
  let text = FRONT;
  const spans: Array<{ chapterNumber: number; startAnchor: string; endAnchor: string }> = [];
  for (const row of ROWS) {
    const block = blockFor(row);
    text += block;
    spans.push({ chapterNumber: row.number, startAnchor: block.slice(0, 70), endAnchor: block.slice(-70) });
    text += "\n\n";
  }
  return { text, spans };
}

function bibliographyFixture(spans: ReturnType<typeof fixtureBook>["spans"]): BibliographyResult {
  return {
    bookId: "zz-franklin-heading-titles",
    title: "Autobiography of Benjamin Franklin",
    author: "Benjamin Franklin",
    edition: { chapterCount: ROWS.length, language: "English" },
    flatChapters: ROWS.map((row) => ({ number: row.number, title: row.bibliographyTitle })),
    thesis: "A tradesman's account of how deliberate habits and civic organisation built a public life.",
    teachingArc: "The account runs from the family trade through the printing house to the province's public business.",
    authorVoice: { register: "plainspoken", signatureMoves: ["first-person recollection", "plain trade detail"], avoidMoves: ["abstraction"] },
    confidence: "high",
    genre: "memoir",
    chapterMap: spans,
  };
}

function chapterFixture(input: ChapterResearchInput): ChapterResearchResult {
  const n = input.chapter.number;
  return {
    schemaVersion: "source-v2",
    chapterNumber: n,
    chapterTitle: input.chapter.title,
    focus: `Unit ${n} sets out the people, places and prices the account gives, in the order the page gives them.`,
    coreClaim: `Unit ${n} is stated concretely enough to be checked against the page.`,
    centralConcept: {
      id: `ch${n}.concept.a`,
      name: "the tradesman's record",
      plainDefinition: "A first-person record written with names, places and dates a reader can check.",
      whyItMatters: "A reader can test the claim against the account rather than trusting a summary of it.",
    },
    keyClaims: [`Unit ${n} names the people it turns on.`, `Unit ${n} dates what it recounts.`],
    namedExamples: [],
    hardEdge: `A reader usually takes unit ${n} for a moral fable; it is a ledger of names, places and prices.`,
    voiceCues: ["first-person recollection"],
    paraphraseNotes: `Unit ${n} of the fixture book, paraphrased for the test without quoting it.`,
    testableFacts: [],
  };
}

test("R-046 titles: the reconciled chapter list is the ONE list the run, the manifest, the map and the researcher all see", async () => {
  const { text, spans } = fixtureBook();
  const root = mkdtempSync(resolve(tmpdir(), "cf-heading-titles-"));
  const sourcePath = resolve(root, "fixture-source.txt");
  writeFileSync(sourcePath, text, "utf8");
  const calls: ChapterResearchInput[] = [];
  const logLines: string[] = [];
  try {
    const result = await researchBook("Autobiography of Benjamin Franklin", "Benjamin Franklin", {
      bookId: "zz-franklin-heading-titles",
      runsRoot: resolve(root, "runs"),
      stateRoot: resolve(root, "state"),
      chapterConcurrency: 1,
      failOnCoherenceBlockers: false,
      sourceTextPath: sourcePath,
      logger: (m: string) => { logLines.push(m); },
      deps: {
        runBibliography: async () => bibliographyFixture(spans),
        runChapter: async (input: ChapterResearchInput) => {
          calls.push(input);
          return chapterFixture(input);
        },
      },
    });

    const reconciled = ROWS.map((row) => ({ number: row.number, title: EXPECTED_TITLES[row.number] }));

    // THE CHAPTER RESEARCHER'S OWN INPUT — the title it is told to research.
    // The live wall first: chapter 15, the title the structural review blocked.
    assert.equal(
      calls.find((entry) => entry.chapter.number === 15)!.chapter.title,
      "Quarrels with the Proprietary Governors",
      "chapter 15 researcher input title",
    );
    // A chapter whose span has no heading keeps what the bibliography gave it.
    assert.equal(calls.find((entry) => entry.chapter.number === 1)!.chapter.title, "Ancestry and Boyhood in Boston");
    for (const row of ROWS) {
      const call = calls.find((entry) => entry.chapter.number === row.number);
      assert.ok(call, `chapter ${row.number} must have been researched`);
      assert.equal(call!.chapter.title, EXPECTED_TITLES[row.number], `chapter ${row.number} researcher input title`);
    }

    // THE RAW BIBLIOGRAPHY written into the run.
    const raw = JSON.parse(readFileSync(resolve(result.bundlePath, "source-freeze/bibliography.raw.json"), "utf8")) as BibliographyResult;
    assert.deepEqual(raw.flatChapters, reconciled.map((ch) => ({ number: ch.number, title: ch.title })));

    // toc.json.
    const toc = JSON.parse(readFileSync(resolve(result.bundlePath, "source-freeze/toc.json"), "utf8")) as { flatChapters: Array<{ number: number; title: string }> };
    assert.deepEqual(toc.flatChapters.map((ch) => ({ number: ch.number, title: ch.title })), reconciled);

    // THE MANIFEST — expected chapters, their hash, and the per-chapter entries.
    const parsed = readResearchRunManifest(result.bundlePath);
    assert.ok(parsed.ok, parsed.ok ? "" : parsed.errors.join("; "));
    const manifest = parsed.manifest;
    assert.deepEqual(manifest.expectedChapters.map((ch) => ({ number: ch.number, title: ch.title })), reconciled);
    assert.equal(manifest.expectedChaptersHash, expectedChaptersHash(reconciled), "expectedChaptersHash must be computed from the RECONCILED list");
    assert.equal(manifest.chapters["15"].chapterTitle, "Quarrels with the Proprietary Governors");

    // THE CHAPTER MAP on disk.
    const map = JSON.parse(readFileSync(resolve(result.bundlePath, CHAPTER_MAP_REL_PATH), "utf8")) as ChapterMapV1;
    assert.deepEqual(map.spans.map((span) => ({ number: span.chapterNumber, title: span.chapterTitle })), reconciled);

    // AND THE RETURNED BUNDLE.
    assert.deepEqual(result.chapters.map((ch) => ({ number: ch.chapterNumber, title: ch.chapterTitle })), reconciled);

    // One line per CHANGED chapter, and one summary line.
    const changed = ROWS.filter((row) => row.bibliographyTitle !== EXPECTED_TITLES[row.number]).map((row) => row.number);
    assert.deepEqual(changed, [7, 8, 9, 10, 15, 17, 19]);
    const perChapter = logLines.filter((line) => /^\[research\] title-reconcile ch\d+ /.test(line));
    assert.equal(perChapter.length, changed.length, perChapter.join("\n"));
    assert.equal(logLines.filter((line) => /^\[research\] title-reconcile \d+ of \d+ /.test(line)).length, 1);
    assert.ok(
      perChapter.some((line) => line.includes("ch15") && line.includes("Appointment as Deputy Postmaster General") && line.includes("Quarrels with the Proprietary Governors") && line.includes("action=SOURCE_HEADING")),
      perChapter.join("\n"),
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
