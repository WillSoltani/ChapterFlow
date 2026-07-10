/**
 * C34 — citation-date doorway (advisory, CF-I-1 2026-07-09). CF-A requires the fastRead
 * to open on CONCRETENESS. On the fresh `multipliers` run several ledes satisfied that
 * beat with a bare DATE or PUBLICATION CITATION used as provenance instead of a scene —
 * "1986 is the number product lead Janelle writes…", "Harvard Business Review (a May 2010
 * management article venue) gives the early mark…", "Anders Ericsson is tied here to a
 * 1993 Psychological Review article." (report §7.3.4). The concrete beat is real
 * metadata, but it games the rule: a year is not a scene.
 *
 * THE DISCRIMINATOR. Fire when the fastRead's OPENING WINDOW delivers its first
 * concreteness through a date/citation AND no person ACTS in a scene there:
 *   (1) a YEAR (18xx/19xx/20xx) appears in the opening window (first 4 sentences); and
 *   (2) NO clause in the window up to and including that year is a PERSON SCENE — a
 *       clause-initial human name followed by a SCENE-ACTION verb.
 *
 * EXEMPTION (red-team rule 2). A DATED SCENE passes: "…Kennedy stood before the United
 * States Congress…" and "Roger Fisher keeps the useful answer alive…" both open on a
 * named person doing something, so they never fire even though a year sits nearby. The
 * exemption verb must be a scene ACTION — a copula/provenance verb ("Ericsson IS TIED
 * to a 1993 article") is exactly the doorway, so it does NOT earn the exemption. Named
 * ORGANIZATIONS/PUBLICATIONS acting abstractly ("Microsoft turns talent into a culture
 * test", "Harvard Business Review gives the early mark") are not a person scene and do
 * not exempt.
 *
 * SEVERITY: MINOR (advisory). CF-A's concreteness is graded semantically; C34 surfaces
 * the mechanical doorway floor and never blocks. The person-scene exemption is
 * deliberately GENEROUS (protecting a legitimate dated scene matters more than catching
 * every doorway) — the pin records the MEASURED count. See tests/citation-date-doorway.test.ts.
 */

import { ChapterV21, CriticFinding } from "../types.js";
import { finding, truncate } from "./shared.js";

const YEAR_RE = /\b(1[89]\d\d|20\d\d)\b/;
// Copula / provenance verbs that do NOT count as a scene action (a name followed by one
// of these is provenance, not a scene — "Ericsson is tied to…", "the frame linked with…").
const PROVENANCE_VERBS = new Set([
  "is", "was", "are", "were", "be", "been", "being", "tied", "linked", "associated",
  "named", "cited", "quoted", "known", "described", "remembered", "credited", "attributed",
  "referenced", "listed", "mentioned", "appears", "sits", "belongs",
]);
// Capitalized tokens that are ORGANISATIONS/PUBLICATIONS, not people — they never earn
// the person-scene exemption. Small curated set of the obvious institutional heads; the
// detector is advisory so an unseen org just means a (harmless) missed exemption.
const ORG_PUB_HEADS = new Set([
  "harvard", "business", "review", "microsoft", "google", "netflix", "apple", "amazon",
  "pixar", "toyota", "gore", "space", "shuttle", "getting", "yes", "psychological",
  "the", "project", "commission", "congress", "fbi", "hbr", "inc", "corp", "company",
]);

function looksLikeSceneVerb(word: string): boolean {
  const w = word.toLowerCase().replace(/[^a-z]/g, "");
  if (!w || w.length < 3) return false;
  if (PROVENANCE_VERBS.has(w)) return false;
  // A finite verb shape: curated common scene verbs + a morphological -s/-ed fallback.
  const SCENE = new Set([
    "stood", "stands", "keeps", "kept", "asks", "asked", "writes", "wrote", "walks",
    "walked", "said", "says", "argued", "argues", "built", "builds", "ran", "runs",
    "made", "makes", "held", "holds", "took", "takes", "gave", "gives", "pushed",
    "pushes", "called", "calls", "turned", "turns", "moved", "moves", "sent", "sends",
    "faced", "faces", "chose", "chooses", "began", "begins", "started", "starts",
    "decided", "decides", "answered", "answers", "brought", "brings", "spoke", "speaks",
  ]);
  if (SCENE.has(w)) return true;
  if (/^[a-z]{3,}(ed|es|s)$/.test(w) && !w.endsWith("ss") && !w.endsWith("ous") && !w.endsWith("less")) {
    return true;
  }
  return false;
}

// Capitalized sentence-initial words that are NOT person names — pronouns, quantifiers,
// question/relative words, determiners, adverbial openers. A clause opening on one of
// these ("Everyone agreed…", "What breaks first…", "Without feedback…") is not a person
// scene, so it must not earn the exemption. (Abstract common nouns like "Admiration" are
// NOT enumerable and are left to earn a — harmless, FP-safe — over-generous exemption.)
const NON_NAME_INITIAL = new Set([
  "everyone", "everybody", "someone", "somebody", "anyone", "anybody", "nobody", "no",
  "none", "you", "we", "they", "it", "this", "that", "these", "those", "the", "a", "an",
  "what", "when", "where", "who", "whom", "whose", "which", "how", "why", "then", "there",
  "here", "without", "with", "before", "after", "during", "once", "still", "now", "and",
  "but", "or", "so", "if", "because", "while", "each", "every", "most", "some", "many",
]);

/** A clause that OPENS on a human name doing a scene action. Strips one leading fronted
 *  adjunct ("On May 25, 1961, …" / "In 2014, …") so the true subject is seen. Pure. */
function isPersonSceneClause(sentence: string): boolean {
  let s = sentence.trim();
  // strip a leading date/adverbial adjunct if it starts with a preposition/temporal word,
  // consuming an internal ", YYYY" so "On May 25, 1961, Kennedy…" leaves "Kennedy…" (not
  // "1961, Kennedy…"). The optional group swallows the year clause.
  const frontAdjunct = s.match(/^(?:on|in|by|at|after|before|during|when|then)\b[^,]*(?:,\s*\d{4}(?:s)?)?,\s*/i);
  if (frontAdjunct) s = s.slice(frontAdjunct[0].length);
  // first token must be a Capitalized word (a name) — not a question word / year / lower.
  const m = s.match(/^([A-Z][a-zA-Z.'-]+)(?:\s+([A-Z][a-zA-Z.'-]+))?\s+(?:\([^)]*\)\s+)?([a-z][a-z']*)/);
  if (!m) return false;
  const first = m[1].toLowerCase().replace(/[^a-z]/g, "");
  if (ORG_PUB_HEADS.has(first)) return false;            // org/publication, not a person
  if (NON_NAME_INITIAL.has(first)) return false;         // pronoun/quantifier/question word
  // the verb candidate is m[3] (word after the name, skipping a parenthetical).
  return looksLikeSceneVerb(m[3]);
}

const WINDOW_SENTENCES = 4;

/** Pure detector: does this fastRead open on a citation-date doorway (a date/citation
 *  carrying the opening concreteness with no person scene)? (text → boolean). */
export function opensOnCitationDate(fastRead: string): boolean {
  if (typeof fastRead !== "string" || !fastRead.trim()) return false;
  const sentences = fastRead
    .trim()
    .split(/(?<=[.?!])\s+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, WINDOW_SENTENCES);
  // find the first sentence in the window bearing a year.
  const yearIdx = sentences.findIndex((s) => YEAR_RE.test(s));
  if (yearIdx === -1) return false;                       // no dated concreteness in the opener
  // exemption: any clause in the window up to (and including) the year sentence is a
  // person scene.
  for (let i = 0; i <= yearIdx; i++) {
    if (isPersonSceneClause(sentences[i])) return false;
  }
  return true;
}

/**
 * C34 — one advisory when the fastRead opens on a citation-date doorway. MINOR; never blocks.
 */
export function checkCitationDateDoorway(chapter: ChapterV21): CriticFinding[] {
  const fastRead = chapter.breakdown?.fastRead ?? "";
  if (!opensOnCitationDate(fastRead)) return [];
  const opener = fastRead.trim().split(/(?<=[.?!])\s+/).slice(0, WINDOW_SENTENCES).join(" ");
  return [
    finding(
      "C34.citation_date_doorway" as any,
      "minor",
      `the fastRead opens on a date/citation carrying the concreteness beat, with no person acting in a scene — provenance metadata standing in for an opening scene. Re-open on a person doing something (the date/source can stay as support in a later sentence); a year is not a scene.`,
      truncate(opener, 160),
    ),
  ];
}
