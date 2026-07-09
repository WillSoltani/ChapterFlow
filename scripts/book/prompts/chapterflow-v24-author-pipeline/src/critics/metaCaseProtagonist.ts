/**
 * C32 — meta-case protagonist (advisory, CF-I-1 2026-07-09). An example whose
 * ACTOR is a pipeline artifact — "the case", "the draft", "the weak version", "the
 * (late) fix" — instead of a person or a real situation. On the fresh `multipliers`
 * run the offstage narrator's inspection language leaked into reader examples: ch02
 * shipped "The case stops preserving history for its own sake…" and (report §7.3.1)
 * "The late fix used Nadella's 2014 CEO appointment as the concrete anchor" — editor-
 * facing process talk with the artifact as grammatical subject. The "one template
 * filled with different nouns" disease migrated from the opening layer into the
 * example layer as machinery narration.
 *
 * THE DISCRIMINATOR. A field trips when it has an internal-artifact noun in SUBJECT
 * position: sentence-initial (or immediately after a fronted comma clause) determiner
 * (+ optional beat adjective) + a machinery noun + a finite verb — the artifact
 * literally ACTING ("The case stops…", "The late fix used…"). Three guards keep it
 * narrow (the standing CHB14/15/17 lesson that lexical gates measure INVERTED is why
 * this is advisory + shape-based, never a gate):
 *   (1) SUBJECT POSITION ONLY — the artifact noun must be the sentence subject head; a
 *       machinery noun as an object ("name the case", "use the anchor") or a modifier
 *       ("the source note", "the case study") never trips it.
 *   (2) ACTING — a finite verb must follow (optionally through one adverb). "The case
 *       for growth is clear" (prepositional) does not fire; "The case shows…" does.
 *   (3) DENSITY — ≥2 such fields across ≥2 DIFFERENT examples. One artifact-subject
 *       sentence is a stylistic slip; the pattern across the slate is the machinery tic.
 *
 * EXEMPTION (red-team rule 1). A book genuinely ABOUT documents/drafts/cases (a
 * writing or legal book) legitimately makes an artifact the actor. When the chapter's
 * source sidecar `namedExamples` are THEMSELVES documents/artifacts (their labels head
 * on draft/deck/memo/edition/contract/…), C32 skips the chapter entirely. Absent
 * sidecar → run (advisory; a missing packet is not a licence).
 *
 * SEVERITY: MINOR (advisory). Example voice gates on the example_coherence bar axis +
 * the blinded reader; C32 surfaces the mechanical floor and never blocks (not in
 * ENFORCED_MAJOR, not wired to any gate/contract predicate). See
 * tests/meta-case-protagonist.test.ts.
 */

import { ChapterV21, CriticFinding } from "../types.js";
import { finding, pickEvidence, truncate } from "./shared.js";
import { loadChapterSidecar } from "./sourceGrounding.js";

// Internal pipeline artifacts — the nouns that name a UNIT OF WORK, not a person or a
// real-world thing in the scene. "case" covers the report's central offender; the rest
// are the adjacent machinery vocabulary (a draft/version/fix/anchor/packet is never a
// legitimate reader-facing protagonist in a management/self-help book).
const MACHINERY_NOUNS = [
  "case",
  "draft",
  "version",
  "source",
  "anchor",
  "chapter",
  "example",
  "packet",
  "repair",
  "fix",
  "edit",
  "rewrite",
];
// Beat/quality adjectives the deal attaches to those artifacts ("the LATE fix", "the
// WEAK version") — allowed between the determiner and the noun without breaking the
// subject read.
const BEAT_ADJECTIVES = "late|weak|early|concrete|missing|wrong|real|whole|first|next|old|new|final|good|bad|strong|sharper|skipped|quiet|blank";
// A finite verb that makes the artifact an ACTOR. Curated core + a morphological
// fallback (3rd-person -s / past -ed) applied only after the noun, so "the case STOPS",
// "the fix USED", "the case WOULD rest" all read as the artifact acting. Modals let a
// base verb follow.
const CORE_VERBS = new Set([
  "is", "was", "are", "were", "has", "have", "had", "does", "did", "will", "would",
  "can", "could", "should", "must", "may", "might", "shows", "showed", "stops", "stopped",
  "costs", "cost", "rests", "rested", "uses", "used", "moves", "moved", "teaches", "taught",
  "wins", "won", "holds", "held", "needs", "needed", "keeps", "kept", "loses", "lost",
  "becomes", "became", "comes", "came", "goes", "went", "gives", "gave", "gets", "got",
  "turns", "turned", "makes", "made", "tells", "told", "asks", "asked", "lets", "let",
  "works", "worked", "breaks", "broke", "hides", "hid", "preserves", "preserved",
  "sits", "sat", "stays", "stayed", "leaves", "left", "wants", "wanted", "answers", "answered",
  "owns", "owned", "carries", "carried", "points", "pointed", "matters", "mattered",
  "explains", "explained", "proves", "proved", "reads", "read", "sounds", "sounded",
  "does not", "cannot",
]);
// Words that, following the machinery noun, mark it as a MODIFIER (compound noun) or a
// PREPOSITIONAL phrase head — not the acting subject. Guard against these.
const NON_VERB_FOLLOWERS = new Set([
  "for", "of", "in", "on", "at", "to", "with", "note", "notes", "study", "studies",
  "file", "files", "material", "team", "line", "page", "data", "record", "records",
  "and", "or", "but", "that", "which", "who", "here", "itself",
]);

function looksLikeVerb(word: string): boolean {
  const w = word.toLowerCase().replace(/[^a-z]/g, "");
  if (!w) return false;
  if (CORE_VERBS.has(w)) return true;
  if (NON_VERB_FOLLOWERS.has(w)) return false;
  // Morphological fallback: a 3rd-person -s or past -ed form, min length 4, that is not
  // a common plural/known non-verb. Conservative — the curated set carries the load.
  if (/^[a-z]{3,}(ed|es|s)$/.test(w) && !w.endsWith("ss") && !w.endsWith("ous") && !w.endsWith("less")) {
    // exclude obvious plurals of the machinery/scene nouns
    return true;
  }
  return false;
}

const DETERMINER = "the|a|an|this|that|his|her|its|their";
const MACHINERY_ALT = MACHINERY_NOUNS.join("|");
// sentence-initial (or after a fronted comma clause): Det (+adj) + machinery noun + word
const SUBJECT_ARTIFACT_RE = new RegExp(
  `^(?:${DETERMINER})\\s+(?:(?:${BEAT_ADJECTIVES})\\s+)?(${MACHINERY_ALT})\\s+(?:(?:just|now|then|still|only|already|barely)\\s+)?([a-z']+)`,
  "i",
);

/** Split a field into sentences, then yield the sentence AND every comma-delimited tail
 *  segment, so a subject sitting after a fronted clause is seen at its clause head —
 *  including a MULTI-comma fronted clause ("Had A, B, and C not been brought back, the
 *  case would rest…" → "the case would rest…"). Pure. */
function subjectClauses(text: string): string[] {
  const sentences = text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const out: string[] = [];
  for (const s of sentences) {
    out.push(s);
    // every comma tail: a determiner+artifact+verb at the head of any comma segment is a
    // subject read the leading adjunct was hiding.
    let idx = s.indexOf(",");
    while (idx > 0 && idx < s.length - 1) {
      out.push(s.slice(idx + 1).trim());
      idx = s.indexOf(",", idx + 1);
    }
  }
  return out;
}

/** Does any clause in this field OPEN with a machinery artifact acting as subject? Pure. */
export function fieldHasArtifactSubject(text: string): boolean {
  if (typeof text !== "string" || !text) return false;
  for (const clause of subjectClauses(text)) {
    const m = clause.match(SUBJECT_ARTIFACT_RE);
    if (!m) continue;
    const follower = m[2];
    if (looksLikeVerb(follower)) return true;
  }
  return false;
}

/** Document nouns whose NAME is unambiguous — safe to match anywhere in the case
 *  label or summary (nobody writes "the merger contract draft" about a person). */
const DOC_HEAD_ANYWHERE =
  /\b(draft|deck|memo|edition|article|contract|filing|transcript|manuscript|report|paper|document|clause|statute|opinion|ruling|essay|dossier)\b/i;
/** Document nouns that are AMBIGUOUS in running text — "brief" (adjective), "letter"
 *  ("letter of the law", a letter grade). These count ONLY when the token is the case
 *  LABEL's head noun (its final word — "the appellate brief", "the Birmingham
 *  letter"), never anywhere in the summary. CF-I over-breadth fix: modal "will" was
 *  in this set's predecessor and matched anywhere in the SUMMARY, so a people-cased
 *  sidecar whose case summaries said "X will do Y" silently disabled C32 for the
 *  whole chapter; "will" is dropped entirely (a testamentary-will book still exempts
 *  via document co-vocabulary — estate/probate cases name clauses, filings, rulings). */
const DOC_HEAD_LABEL_ONLY = new Set(["brief", "briefs", "letter", "letters"]);

/** The head noun of a case label — its final word, lowercased, punctuation-stripped. */
function labelHeadToken(label: unknown): string {
  if (typeof label !== "string") return "";
  const words = label.toLowerCase().replace(/[^a-z\s'-]/g, " ").trim().split(/\s+/);
  return words.length > 0 ? words[words.length - 1] : "";
}

/** True iff the chapter's source sidecar's named cases are THEMSELVES documents/
 *  artifacts (a book about drafts/cases legitimately makes the artifact the actor). */
export function namedCasesAreArtifacts(sidecar: unknown): boolean {
  const named = (sidecar as any)?.namedExamples;
  if (!Array.isArray(named) || named.length === 0) return false;
  let docCount = 0;
  for (const ex of named) {
    const combined = `${(ex as any)?.label ?? ""} ${(ex as any)?.summary ?? ""}`;
    if (DOC_HEAD_ANYWHERE.test(combined) || DOC_HEAD_LABEL_ONLY.has(labelHeadToken((ex as any)?.label))) docCount++;
  }
  return docCount >= Math.ceil(named.length / 2);
}

export type ArtifactSubjectHit = { exampleId: string; field: string };

/** Every example field whose text opens on a machinery artifact acting as subject. */
export function findArtifactSubjects(chapter: ChapterV21): ArtifactSubjectHit[] {
  const hits: ArtifactSubjectHit[] = [];
  (chapter.examples ?? []).forEach((ex: any, i) => {
    for (const field of ["scenario", "whatToDo", "whyItMatters"]) {
      if (fieldHasArtifactSubject(pickEvidence(ex?.[field]))) {
        hits.push({ exampleId: ex?.exampleId ?? `example[${i}]`, field });
      }
    }
  });
  return hits;
}

const MIN_FIELDS = 2;
const MIN_EXAMPLES = 2;

/**
 * C32 — one advisory when ≥2 example fields across ≥2 examples make a pipeline artifact
 * the acting subject. Exempts document/artifact-subject books via the sidecar. MINOR.
 * `sidecarOverride` injects a sidecar so a test drives the check without disk.
 */
export function checkMetaCaseProtagonist(chapter: ChapterV21, sidecarOverride?: unknown): CriticFinding[] {
  const sidecar = sidecarOverride ?? (chapter.chapterId ? loadChapterSidecar(chapter.chapterId) : null);
  if (namedCasesAreArtifacts(sidecar)) return [];

  const hits = findArtifactSubjects(chapter);
  const distinctExamples = new Set(hits.map((h) => h.exampleId));
  if (hits.length < MIN_FIELDS || distinctExamples.size < MIN_EXAMPLES) return [];

  const listed = hits.slice(0, 4).map((h) => `${h.exampleId}.${h.field}`).join("; ");
  return [
    finding(
      "C32.meta_case_protagonist" as any,
      "minor",
      `${hits.length} example field(s) across ${distinctExamples.size} examples make a pipeline artifact the acting subject ("The case…", "The late fix…"): ${listed}. This is offstage machinery narration — the reader meets the case/draft/fix inspecting itself instead of a person or situation in the scene. Rewrite each so a person acts and the artifact is the thing they work ON, not the protagonist.`,
      truncate(listed, 120),
    ),
  ];
}
