/**
 * Scaffold-leak critic — catches authoring scaffolding that surfaced as literal
 * reader prose, the class the-book-of-boundaries shipped in 12/13 chapters:
 *
 *  SL1 (BLOCKER) format_tag_leak  — an internal scene-shape FORMAT id appears in
 *      reader prose (e.g. "coach_talk", "inner_monologue", "predict_reveal").
 *      Only the underscore_forms are matched — they cannot occur in natural
 *      English, so this is zero-false-positive by construction. (Single-word
 *      formats like "audit"/"scene"/"dialogue" are real words and are NOT matched.)
 *  SL2 (MAJOR)   domain_label_leak — the example's planSpec.domain (a lowercase
 *      descriptive phrase) was pasted into the scenario as a Title-Case proper-
 *      noun label, e.g. "Peyton's Teacher Setting Terms For grade-update calls".
 *  SL3 (MAJOR)   spectator_prop — the real source case is demoted to text/notes
 *      "glowing on a phone/screen" while an invented spectator watches, instead
 *      of the scene dramatizing the case directly.
 *  SL4 (MAJOR)   citation_prop — a cited ACADEMIC source is rendered as a physical
 *      visual-aid / handled desk document inside the dramatized scene (the source
 *      "parked as set-dressing" instead of its FINDING driving the action — the
 *      FIELD-PURPOSE-CONTRACTS §physical-form ban). the-organized-mind ch06 shipped
 *      "the 1974 Science slide" and "reads the wording from the 1979 Econometrica
 *      notes"; the model bar/confirm read was meant to flag these (example_coherence)
 *      but passed them, so SL4 makes the clearest form deterministic.
 *  SL5 (MAJOR)   publication_detail — publication metadata (a curated publisher name,
 *      a QUALIFIED "revised/Nth edition", or ISBN) surfaces inside reader prose and
 *      slows the sentence ("Donald Norman's 2013 revised edition from Basic Books").
 *      The reader cares about the FINDING; edition/publisher belong in the source
 *      layer. Distinct from SL4 (source-as-physical-prop). NO bare-year matching.
 *
 * Reader-facing fields are enumerated via authoringContract.readerFields().
 */

import { readerFields } from "./authoringContract.js";
import type { ChapterV21 } from "../types.js";
import { splitSentences } from "./textUtils.js";

export type ScaffoldLeakFinding = {
  checkId: "SL1.format_tag_leak" | "SL2.domain_label_leak" | "SL3.spectator_prop" | "SL4.citation_prop" | "SL5.publication_detail" | "SL6.source_numbering_leak";
  severity: "blocker" | "major";
  unit: string;
  message: string;
  evidence?: string;
};

// SL6 — source-numbering scaffold leak. The source sidecar feeds the author a NUMBERED
// catalog of anchors (testableFacts with ids "chNN.fact.N", etc.); the model sometimes
// cites the internal label verbatim instead of resolving it to reader content — e.g.
// "Fact 7 says repeated rescue can let overspending continue", "Fact 9 says fairness in
// family giving can conflict with self-support" — with no "Fact 7/9" anywhere on the
// reader-facing page. Shipped in 20+ chapters (eat-that-frog ch18/ch19, digital-minimalism
// ch06, the-millionaire-next-door ch06) — caught by NEITHER the deterministic gate NOR the
// semantic sweep. BLOCKER: the reader never sees internal anchor numbering, so it is a
// zero-false-positive scaffold tell (the SL1 lesson).
//
// PRECISION (the SL1/SL4 lesson — a false positive is worse than a missed weak case),
// in two patterns:
//   A — a CAPITALIZED internal-only anchor label ("Fact"/"Citation"/"Evidence"/"Anchor")
//       + a number, in any clause position, followed by ANY word. These terms are never a
//       natural capitalized sentence subject with a number in reader prose (measured: 0 on
//       the clean+gold corpus; 516 hits across 14 shipped books, ALL "Fact N"), so the
//       capital + number is the tell — it catches "Fact 7 supports/names/ties/separates/…"
//       with ANY verb, not just a whitelist. Case-SENSITIVE so a lowercase "in fact 7 out
//       of ten people relapse" can never match.
//   B — any-case label (incl. "Source"/"Reference", which DO have legit capitalized uses —
//       imperative "Source 3 widgets", cross-ref "Reference 3" — so they need the verb
//       anchor) + number + a REFERENCE VERB directly adjacent. Catches a lowercase
//       mid-sentence leak ("…as source 3 shows…") that Pattern A would miss.
const SL6_CAP_LABEL_RE = /\b(?:Fact|Citation|Evidence|Anchor)\s+#?\d+\b/;
const SL6_REF_VERB =
  "(?:says?|said|shows?|showed|states?|stated|notes?|noted|warns?|warned|finds?|found|explains?|explained|describes?|described|indicates?|indicated|suggests?|suggested|reports?|reported|confirms?|confirmed|establishes?|established|tells?|told|reveals?|revealed|demonstrates?|demonstrated|proves?|proved|teaches?|taught|argues?|argued|claims?|claimed|holds?|held|defines?|defined|lists?|listed|highlights?|highlighted|emphasi[sz]es?|emphasi[sz]ed|reminds?|reminded|covers?|covered|supports?|names?|ties?|links?|favors?|treats?|gives?|rejects?|draws?|allows?)";
const SL6_VERB_RE = new RegExp(`\\b(?:Fact|Source|Reference|Anchor|Citation|Evidence)\\s+#?\\d+(?:'s)?\\s+${SL6_REF_VERB}\\b`, "i");

/** Scene-shape FORMAT ids that contain an underscore — these are the ones that
 *  cannot occur in natural prose, so matching them is safe. Union of
 *  config/scene-shapes.json ids + freeform format tokens observed in authored
 *  books. (Single-word formats are deliberately excluded: they're real English.) */
const UNDERSCORE_FORMAT_TAGS = [
  "before_after", "mistake_recovery", "predict_reveal", "decision_memo", "text_thread",
  "inner_monologue", "reset_moment", "planning_choice", "coach_talk", "school_case",
  "data_first", "object_first", "margin_note_revision", "receiving_aftermath",
  "dialogue_led", "business_case", "decision_point",
];
const FORMAT_TAG_RE = new RegExp(`\\b(${UNDERSCORE_FORMAT_TAGS.join("|")})\\b`, "i");

// SL3 fires only when SOURCE MATERIAL (notes/case/report/…) — not a name or an
// incoming message — is what glows on a screen. "His sister's name glows on the
// phone" (a real incoming call) is legitimate and must NOT fire; "town-hall notes
// about <the real case> glow on his phone" (the case demoted to a prop) must.
const SOURCE_PROP_NOUN = /\b(notes?|the case|case file|casefile|report|transcript|summary|dossier|record|memo|write-?up|account|brief)\b/i;
const GLOW = "(?:glow\\w*|lit up|lights? up|light\\w* up)";
const DEVICE = "(?:phone|screen|laptop|tablet|monitor)";
// Match either word order: "notes glow on his phone" OR "his phone glowed with the notes".
const SCREEN_GLOW_RE = new RegExp(`\\b${GLOW}\\b[^.?!]{0,40}\\b${DEVICE}\\b|\\b${DEVICE}\\b[^.?!]{0,40}\\b${GLOW}\\b`, "i");

// SL4 — a cited ACADEMIC source staged as a physical prop. PRECISION (the SL1/SL3
// lesson — a false positive is worse than a missed weak case): a CITATION must
// DIRECTLY label the prop ("1974 Science slide", "Econometrica notes"), not merely
// co-occur with it in the sentence. That adjacency is the discriminator: it lets a
// finding be CITED freely with an abstract verb — "the 2008 PNAS work PUTS the
// cortex in the story", "CALLS Granovetter's 1973 paper a reason", "the 1989 Science
// work COMES BACK to him" — none fire (no prop is bound to the citation), and it
// rejects the false-positive class an adversarial review found: a capitalized
// common-word venue used as a brand / place / surname / subject near any year —
// "Science Museum … slides", "2016 Nature documentary … projector", "Nature Valley
// invoice", "Mr. Lancet … 2021 worksheet". A capitalized compound word (Museum,
// Valley, Block, Cafe, Conservancy, Reviews) sitting between the venue and the prop
// breaks the bind, so those don't fire; the match is case-sensitive so a lowercase
// "science slide" (a slide about science, not the journal) also passes.
//
// Common-word venues (Science/Nature/Cell/…) only count as a citation when BOUND to
// an adjacent year; unambiguous venues (PNAS, "Journal of X") count on their own.
// Scope: a per-sentence scan — a citation split across two sentences is not bound
// (precision over recall, as with SL1/SL3).
const SL4_HARD_VENUE = "(?:PNAS|JAMA|NEJM|BMJ|Psychological Science|American Economic Review|Annual Review of [A-Z][a-z]+)";
// A generic "Journal of X" is ambiguous (a travel/finance journal-as-magazine, a personal
// journal — not only a cited academic venue), so — like the common-word venues — it counts
// only when BOUND to an adjacent year. The unambiguous abbreviations/titles above stay
// year-free. (Kills "the Journal of Travel notes" / "the Journal of Finance handout" FPs.)
const SL4_GENERIC_JOURNAL = "(?:[A-Z][a-z]+ )?Journal of [A-Z][a-z]+";
const SL4_COMMON_VENUE = "(?:Science|Nature|Econometrica|Neuron|Cell|Lancet|Cognition)";
const SL4_YEAR = "(?:19|20)\\d{2}";
// A year-bound venue: a common-word venue OR a generic journal, adjacent to a year.
const SL4_YEARLY_VENUE = `(?:${SL4_COMMON_VENUE}|${SL4_GENERIC_JOURNAL})`;
// A citation token: a hard venue (year-free), OR a year-bound venue with an adjacent year.
const SL4_CITATION = `(?:${SL4_HARD_VENUE}|${SL4_YEAR}\\s+${SL4_YEARLY_VENUE}|${SL4_YEARLY_VENUE}\\s+\\(?${SL4_YEAR})`;
// Inherently-physical visual aids — a citation rendered directly AS one is staging.
const SL4_VISUAL = "(?:slides?|transparenc(?:y|ies)|overheads?|projector|posters?|worksheets?|handouts?|printouts?|photocop(?:y|ies)|figures?|graphs?|diagrams?)";
// Ambiguous source documents — staging only under a handling verb in the sentence.
const SL4_DOC = "(?:notes?|chart)";
// Case-SENSITIVE (no /i): a capitalized journal directly labeling a (lowercase) prop.
const SL4_VISUAL_RE = new RegExp(`\\b${SL4_CITATION}\\s+${SL4_VISUAL}\\b`);
const SL4_DOC_RE = new RegExp(`\\b${SL4_CITATION}\\s+${SL4_DOC}\\b`);
const SL4_HANDLE_RE = /\b(?:reads?|reading|slid\w*|sliding|pull\w*|hand(?:s|ed|ing)?|pins?|pinned|tuck\w*|taps?|tapped|projects?|holds? up|unfolds?|from the|off the|across the (?:table|desk))\b/i;

// SL5 — publication metadata in reader prose (the source's edition/publisher, not its
// finding). PRECISION: an EDITION marker must be QUALIFIED ("revised edition", "3rd
// edition") — never the bare word "edition", which is common; a curated PUBLISHER name
// only counts when a year / "edition" / "published" cue sits in the SAME sentence (so
// "she worked at Penguin" — a setting — does not fire). NO bare-year matching (the SL4
// false-positive lesson). Case-sensitive publisher names (proper nouns).
// Curated, UNAMBIGUOUS publisher proper-nouns only — common-word / place / person-name
// imprints are deliberately excluded because they false-fire on ordinary prose: Crown,
// Vintage, Portfolio, Currency, Bloomsbury (words / a London neighborhood), AND the
// single-token names that collide with a person or place + a cue word — Harper (a common
// given name: "Harper published her first poem"), Riverhead (a town: "the Riverhead diner
// published its menu"), Scribner (a surname). HarperCollins (unambiguous company) stays.
const SL5_PUBLISHER_RE =
  /\b(?:Basic Books|Penguin(?: Random House| Press| Books)?|Random House|Harvard University Press|Princeton University Press|Oxford University Press|Cambridge University Press|Yale University Press|MIT Press|University of Chicago Press|Simon (?:&|and) Schuster|Farrar, Straus(?: and Giroux)?|HarperCollins|W\.?\s?W\.?\s?Norton|Little, Brown|Houghton Mifflin(?: Harcourt)?|Doubleday|Knopf|McGraw-Hill)\b/;
const SL5_EDITION_RE =
  /\b(?:revised|reprint|first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth|\d+(?:st|nd|rd|th))\s+edition\b/i;
// A qualified edition only counts as a publication leak inside a clear PUBLICATION context
// (a book/title/author/publish cue, or a curated publisher) — so a physical book as a scene
// prop ("she kept the first edition on the shelf for luck") does not fire. "edition" itself
// is excluded from the cue (it is the trigger, so including it would be circular).
const SL5_EDITION_CUE_RE = /\b(?:book|books|title|novel|memoir|textbook|author|authored|wrote|writer|publish(?:ed|er|ing)?|publication|hardcover|paperback)\b/i;
const SL5_ISBN_RE = /\bISBN\b/;
// A publisher name only counts as a citation when an explicit publication cue sits in
// the same sentence. NO bare-year alternation — a year alone fires on ordinary
// biography/company-history prose ("She joined Penguin in 2011"), the SL4 lesson.
const SL5_CITE_CUE_RE = /\bedition\b|\bpublished\b|\bpublisher\b|\breprint\b/i;

const STOP = new Set(["the", "a", "an", "and", "or", "but", "of", "to", "in", "on", "for", "with", "at", "by", "about", "during", "after", "before", "their", "his", "her", "a's"]);

function domainContentTokens(domain: string): Set<string> {
  return new Set(
    domain
      .toLowerCase()
      .split(/[^a-z]+/)
      .filter((t) => t.length >= 3 && !STOP.has(t)),
  );
}

export function checkScaffoldLeak(chapter: ChapterV21): ScaffoldLeakFinding[] {
  const findings: ScaffoldLeakFinding[] = [];

  // SL1 — format-tag tokens in any reader-facing field.
  for (const f of readerFields(chapter)) {
    const m = f.text.match(FORMAT_TAG_RE);
    if (m) {
      findings.push({
        checkId: "SL1.format_tag_leak",
        severity: "blocker",
        unit: f.unit,
        message: `${f.unit}.${f.field} contains the internal scene-shape format tag "${m[1]}" as literal prose. Format ids are authoring scaffolding — never write them into reader-facing text.`,
        evidence: m[1],
      });
    }
  }

  // SL6 — source-numbering scaffold leak ("Fact 7 says…") in any reader field.
  for (const f of readerFields(chapter)) {
    const m = f.text.match(SL6_CAP_LABEL_RE) ?? f.text.match(SL6_VERB_RE);
    if (m) {
      findings.push({
        checkId: "SL6.source_numbering_leak",
        severity: "blocker",
        unit: f.unit,
        message: `${f.unit}.${f.field} cites an internal source-anchor label ("${m[0]}") as reader prose. The numbered source catalog ("Fact 1", "Source 3") is authoring scaffolding invisible to the reader — state the claim directly (drop the "Fact N says" prefix), never reference the source by its catalog number.`,
        evidence: m[0],
      });
      break; // one finding per chapter is enough to drive the fix
    }
  }

  // SL5 — publication metadata in reader prose (see header). Per-sentence over every
  // reader field so it catches breakdown and example prose alike.
  for (const f of readerFields(chapter)) {
    for (const sentence of splitSentences(f.text)) {
      const isbn = sentence.match(SL5_ISBN_RE);
      const publisher = sentence.match(SL5_PUBLISHER_RE);
      const editionMatch = sentence.match(SL5_EDITION_RE);
      // An edition marker counts only in a clear publication context (a book/author/publish
      // cue or a named publisher) — not a physical book as a scene prop.
      const edition = editionMatch && (SL5_EDITION_CUE_RE.test(sentence) || publisher) ? editionMatch : null;
      const hit = edition ?? isbn ?? (publisher && SL5_CITE_CUE_RE.test(sentence) ? publisher : null);
      if (hit) {
        findings.push({
          checkId: "SL5.publication_detail",
          severity: "major",
          unit: f.unit,
          message: `${f.unit}.${f.field} carries publication metadata ("${hit[0]}") in reader prose — cite the FINDING, not the edition/publisher; publication details belong in the source layer.`,
          evidence: hit[0],
        });
        break;
      }
    }
  }

  // Legit recurring proper nouns (a real framework/place/person that IS the subject)
  // show up in the chapter's own title/keyTakeaway — exempt runs that appear there so
  // SL2 doesn't false-fire on "New York City Council"-style names.
  const allowlist = `${chapter.title ?? ""} ${chapter.keyTakeaway ?? ""}`.toLowerCase();

  // SL2 / SL3 — per example scenario.
  (chapter.examples ?? []).forEach((ex: any, i: number) => {
    const scenario: string = typeof ex?.scenario === "string" ? ex.scenario : "";
    if (!scenario) return;

    // SL2 — Title-Case run of >=3 words that re-states the (lowercase) planSpec.domain.
    const domain: string = typeof ex?.planSpec?.domain === "string" ? ex.planSpec.domain : "";
    if (domain) {
      const domainTokens = domainContentTokens(domain);
      if (domainTokens.size >= 3) {
        const runs = scenario.match(/\b[A-Z][a-z']+(?:\s+[A-Z][a-z']+){2,}\b/g) ?? [];
        for (const run of runs) {
          if (allowlist.includes(run.toLowerCase())) continue; // a legit proper noun, not a domain-label paste
          const runTokens = run.toLowerCase().split(/\s+/).filter((t) => !STOP.has(t));
          const overlap = runTokens.filter((t) => domainTokens.has(t)).length;
          if (overlap >= 3) {
            findings.push({
              checkId: "SL2.domain_label_leak",
              severity: "major",
              unit: `example[${i}]`,
              message: `example[${i}] scenario pastes the planSpec.domain ("${domain}") into the prose as a Title-Case label ("${run}"). The domain is a planning note, not a proper noun — dramatize the named source case instead.`,
              evidence: run,
            });
            break;
          }
        }
      }
    }

    // SL3 — the real case demoted to source notes glowing on a screen. Require
    // BOTH a source-material noun AND a screen-glow within the SAME sentence.
    for (const sentence of splitSentences(scenario)) {
      const glow = sentence.match(SCREEN_GLOW_RE);
      if (glow && SOURCE_PROP_NOUN.test(sentence)) {
        findings.push({
          checkId: "SL3.spectator_prop",
          severity: "major",
          unit: `example[${i}]`,
          message: `example[${i}] demotes the source case to notes glowing on a screen ("${glow[0]}") — an invented onlooker reading the real case off a device. Stage the named source case directly; don't make it a prop.`,
          evidence: glow[0],
        });
        break;
      }
    }

    // SL4 — a cited academic source rendered as a physical prop. Fire when a CITATION
    // DIRECTLY labels a visual aid ("1974 Science slide"), or directly labels a source
    // document ("1979 Econometrica notes") that is also physically handled in the
    // sentence. Adjacency keeps abstract-verb finding-citations clean (see header).
    for (const sentence of splitSentences(scenario)) {
      const visual = sentence.match(SL4_VISUAL_RE);
      const doc = sentence.match(SL4_DOC_RE);
      const hit = visual ?? (doc && SL4_HANDLE_RE.test(sentence) ? doc : null);
      if (hit) {
        findings.push({
          checkId: "SL4.citation_prop",
          severity: "major",
          unit: `example[${i}]`,
          message: `example[${i}] stages a cited source as a physical prop ("${hit[0]}") — a study parked as set-dressing. Cite the FINDING so it drives the person's action; don't render the source as a handled slide/notes/worksheet.`,
          evidence: hit[0],
        });
        break;
      }
    }
  });

  return findings;
}
