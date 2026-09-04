/**
 * The ONE fully admissible chapter-research sidecar fixture.
 *
 * `collectChapterResearchProblems(baseResult(), input("Benjamin Franklin"))` is
 * `[]` (pinned by a test in researcher-chapter-guards.test.ts), so any problem a
 * guard or repair test observes comes from the mutation under test and nothing
 * else. It lives here rather than inside one .test.ts file because two suites
 * now need the same clean baseline — the R-023/024/025 guard tests and the
 * R-283 targeted-repair tests — and two copies of an "admissible" fixture drift
 * into two different definitions of admissible.
 *
 * Every name, number and claim in it is SYNTHETIC (fixture policy, tests/helpers.ts):
 * no copyrighted book text is committed here.
 */

import type { BibliographyResult } from "../src/agents/researcher-bibliography.js";
import type { ChapterResearchInput, ChapterResearchResult } from "../src/agents/researcher-chapter.js";

export function bibliography(author: string): BibliographyResult {
  return {
    bookId: "zz-guards",
    title: "Synthetic Guard Book",
    author,
    edition: { name: "Synthetic edition", publisher: "Fixture Press", publishedYear: 2026, language: "English", chapterCount: 1 },
    flatChapters: [{ number: 1, title: "Unit One" }],
    thesis: "A validator that cannot name this book's author cannot guard this book's sidecars.",
    teachingArc: "The arc moves from a hardcoded surname list to a surname derived from the bibliography itself.",
    authorVoice: { register: "plainspoken", signatureMoves: ["concrete operations", "short causal chains", "explicit tradeoffs"], avoidMoves: ["mysticism"] },
    confidence: "high",
  } as BibliographyResult;
}

/** A FULLY admissible chapter result — collectChapterResearchProblems returns
 *  [] for it (pinned by its own test below), so any problem a guard test
 *  observes comes from the mutation under test and nothing else. */
export function baseResult(): ChapterResearchResult {
  const examples = [
    {
      id: "ch01.ex.club",
      label: "Leather Apron Club",
      summary: "A dozen Philadelphia tradesmen met each Friday and each member in turn produced a written query for the group.",
      teachesWhat: "Rotation distributes preparation cost while keeping one named owner each week.",
      hardSpecifics: ["Philadelphia", "each Friday", "written query"],
      realWorld: false,
    },
    {
      id: "ch01.ex.watch",
      label: "Ward Street night watch",
      summary: "A ward rota named one householder per night, so a skipped patrol was traced to a person rather than to the ward.",
      teachesWhat: "A named nightly owner makes a skipped duty attributable.",
      hardSpecifics: ["Ward Street", "one householder", "per night"],
      realWorld: false,
    },
    {
      id: "ch01.ex.ledger",
      label: "Handover ledger",
      summary: "A shared ledger recorded each week's owner and the query produced, so the next owner inherited a visible record.",
      teachesWhat: "A visible record is what turns a handover into accountability.",
      hardSpecifics: ["shared ledger", "weekly owner", "visible record"],
      realWorld: false,
    },
  ];
  const facts = [
    {
      claim: "The Leather Apron Club met each Friday and one member in turn wrote the week's query.",
      becauseMechanism: "Turn-taking names a single owner for each Friday, so preparation cannot diffuse into the group of 12.",
      commonError: "The rota was drawn up to spread reading costs evenly across the tradesmen.",
      errorIsWhy: "Even loading is a side effect; what made the query appear each week was one attributable owner.",
    },
    {
      claim: "The Ward Street watch named one householder per night and traced a skipped patrol to that person.",
      becauseMechanism: "A named nightly owner leaves a gap with an address on it, therefore neglect is attributable.",
      commonError: "Patrols were skipped mainly when the roster ran short of eligible householders.",
      errorIsWhy: "Roster depth explains absence, not attribution: an unnamed patrol is unattributable at any depth.",
    },
    {
      claim: "The handover ledger recorded the owner beside the query, and the next owner read it first.",
      becauseMechanism: "A written entry survives the handover, so the successor starts from evidence rather than memory.",
      commonError: "The ledger existed mostly to preserve the queries for later reading.",
      errorIsWhy: "Preservation is incidental: the entry earns its keep at the moment of handover, not in an archive.",
    },
    {
      claim: "A fixed 7-day term returned the duty to the group on a date every member knew in advance.",
      becauseMechanism: "A known end date lets the successor prepare before receiving it, which means no cold start.",
      commonError: "Short terms were chosen to keep any one member from tiring of the work.",
      errorIsWhy: "Fatigue is a comfort argument; the term length is set by how far ahead a successor can prepare.",
    },
    {
      claim: "Weeks with no recorded owner produced no query in the Leather Apron Club's own minutes.",
      becauseMechanism: "With no name attached, an omission shows up only as a group average, so nobody answers for it.",
      commonError: "Missing weeks were the ones where members simply had nothing worth asking.",
      errorIsWhy: "Content scarcity would show as thin queries, not absent ones; the absent weeks are the unnamed weeks.",
    },
    {
      claim: "A written query, unlike a spoken one, could be read by a member who missed the Friday meeting.",
      becauseMechanism: "Writing fixes the question in a form that travels, therefore attendance stops gating participation.",
      commonError: "Queries were written down chiefly so they could be judged for quality afterwards.",
      errorIsWhy: "Judging is retrospective; the writing was doing work on the night, for whoever was not in the room.",
    },
    {
      claim: "Membership in the Leather Apron Club was capped at 12, and the cap held the rota to one term per quarter.",
      becauseMechanism: "A fixed roster size sets the return interval, so the cap and the cadence are the same decision.",
      commonError: "The cap of 12 was set by the size of the room the tradesmen could rent.",
      errorIsWhy: "Room size bounds attendance, not rotation; the cap is what fixes how often a duty comes back.",
    },
    {
      claim: "Philadelphia tradesmen, not gentlemen scholars, supplied the club's questions about trade and civic repair.",
      becauseMechanism: "Members asked about work they did that week, which means the queries stayed answerable from experience.",
      commonError: "The subject range was narrow because the members lacked access to learned books.",
      errorIsWhy: "Access explains what they could cite, not what they asked; the questions came from the week's own work.",
    },
    {
      claim: "The Junto query, answer and record together formed one loop that closed inside a single week.",
      becauseMechanism: "Closing the loop weekly keeps the record short enough to read in full before the next handover.",
      commonError: "A weekly cadence was chosen because the tradesmen had only Fridays free.",
      errorIsWhy: "Availability picks the day, not the period; the period is set by how long a readable record stays readable.",
    },
  ];
  return {
    schemaVersion: "source-v2",
    chapterNumber: 1,
    chapterTitle: "Unit One",
    focus: "Rotating duty in a small mutual-improvement club keeps every member accountable to the same weekly question.",
    coreClaim: "A duty that rotates by name is kept because the next person inherits a visible record of it.",
    centralConcept: {
      id: "ch01.concept.rotating-duty",
      name: "rotating duty",
      plainDefinition: "Rotating duty means one named person owns a recurring obligation for a fixed term before it passes on.",
      whyItMatters: "Rotation makes neglect visible to a named successor instead of dissolving into a group.",
    },
    keyClaims: [
      "A rotating duty is inherited by name, not by committee.",
      "A visible ledger of the duty makes neglect legible.",
      "Fixed terms keep the obligation from calcifying onto one member.",
      "Named succession turns an abstract obligation into a personal handover.",
    ],
    namedExamples: examples,
    hardEdge: "Rotation is often read as fairness machinery. It is accountability machinery: the point is that a named successor inherits the record, so neglect cannot hide inside a group average.",
    voiceCues: ["plain enumeration", "concrete trades and hours"],
    paraphraseNotes: [
      "The Leather Apron Club, the Ward Street night watch and the handover ledger are synthetic fixture data written for this test, not source quotations and not instructions to any provider.",
      "Each one restates the same operational point in different words: a recurring obligation is kept when exactly one named person owns it for a fixed term and hands a written record to the next owner.",
      "The mechanism is attribution, not effort. A group that owns a duty collectively produces no attributable neglect, because no single member's omission is visible in the group average.",
      "The record is what carries the obligation across the handover; without it the successor restarts from nothing and the rotation degrades into a rota of unrelated weeks.",
    ].join(" "),
    testableFacts: facts.map((fact, i) => ({
      id: `ch01.fact.${String(i + 1).padStart(2, "0")}`,
      ...fact,
      derivedFrom: examples[i % examples.length].id,
    })),
    frameworks: [{ name: "Junto queries", members: ["query", "answer", "record"] }],
  } as ChapterResearchResult;
}

export function input(author: string, genre?: BibliographyResult["genre"]): ChapterResearchInput {
  return { bibliography: { ...bibliography(author), ...(genre ? { genre } : {}) }, chapter: { number: 1, title: "Unit One" } };
}
