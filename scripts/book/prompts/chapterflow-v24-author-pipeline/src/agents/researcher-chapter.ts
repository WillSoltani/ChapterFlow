/**
 * Researcher — chapter source notes.
 *
 * Given a book and one chapter (number + title), produces dense source notes
 * that the downstream editor-in-chief / curriculum-planner / breakdown writer
 * ground on. This is the highest-leverage stage in the pipeline because the
 * downstream agents never see the actual book text — they see ONLY this output.
 *
 * For famous books the model's training knowledge is strong. The prompt asks
 * for specifics (named examples, real numbers, concrete claims) and refuses
 * vague "this chapter is about…" summaries.
 *
 * Multiple chapters can be researched in parallel — each call is independent.
 * The orchestrator (researcher.ts) handles the parallelism.
 */

import { readFileSync } from "fs";
import { isUnretryableProviderMessage } from "../runtime/modelErrors.js";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

import { MODEL_TASK_OUTPUT_INVALID, renderUntrustedSourceBlock, runJsonModelTask, type ModelCallerExecution } from "../app/modelTaskRunner.js";
import { evaluateSourceV2Integrity, isResearchRouteBlockingFinding } from "../source/sourceIntegrity.js";
import type {
  DroppedSourceItem,
  HardSpecificEvidence,
  NamedFramework,
  SourceQuotation,
  SourceTextProvenanceLabel,
  TestableFact,
} from "../source/sidecarSchema.js";
import { spanExcerptForPrompt } from "../source/chapterMap.js";
import {
  collectSourceQuoteProblems,
  dropUngroundedItems,
  researchFloorsForSpan,
} from "../source/sourceQuoteGrounding.js";
import { BibliographyResult } from "./researcher-bibliography.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROMPTS_DIR = resolve(__dirname, "../../prompts");

export type ChapterResearchResult = {
  schemaVersion?: "source-v2";
  chapterNumber: number;
  chapterTitle: string;
  focus: string;
  coreClaim: string;
  centralConcept: {
    id?: string;
    name: string;
    plainDefinition: string;
    whyItMatters: string;
  };
  keyClaims: string[];
  namedExamples: Array<{
    id?: string;
    label: string;
    summary: string;
    teachesWhat: string;
    hardSpecifics?: string[];
    realWorld?: boolean;
    /** R-046: verbatim source run supporting `summary` (source-text runs only). */
    sourceQuote?: string | null;
    /** R-056: one entry per hardSpecific (source-text runs only). */
    hardSpecificEvidence?: HardSpecificEvidence[];
  }>;
  hardEdge: string;
  voiceCues: string[];
  forbiddenLeakage?: string[];
  paraphraseNotes: string;
  testableFacts?: TestableFact[];
  frameworks?: NamedFramework[];
  /** R-282: clause-shaped source lines (maxims, prayers, proverbs) with a
   *  ready-made attribution frame. Only emitted on a source-text run. */
  quotations?: SourceQuotation[];
  /** R-046: stamped by the researcher, never by the model — "source-text" when
   *  this chapter was researched against the book's own bytes, "model-memory"
   *  when it was not. */
  sourceProvenance?: SourceTextProvenanceLabel;
  /** sha256 of the frozen source text the quotes were checked against. */
  sourceTextSha256?: string;
  /** R-052: items dropped rather than fabricated. */
  droppedItems?: DroppedSourceItem[];
  /** R-283: present ONLY when a bounded lexical repair rewrote sentences in this
   *  sidecar and the repaired sidecar then passed the same validator. Stamped by
   *  the researcher, never by the model. */
  metaRepair?: ChapterResearchMetaRepair;
};

/**
 * Provenance for the bounded lexical repair (R-283): which attempt paid for it
 * and exactly which sentences it was asked to rewrite. Written into the sidecar
 * JSON so a reviewer of a shipped book can see that a sentence was repaired
 * rather than drafted, and deliberately NOT rendered into the .txt sidecar the
 * downstream writers read — it is provenance, not source material.
 */
export type ChapterResearchMetaRepair = {
  readonly attempt: number;
  readonly offenses: readonly {
    readonly rule: LexicalOffenseRule;
    readonly match: string;
    readonly path: string;
    readonly sentence: string;
  }[];
};

/**
 * R-046 — one chapter's slice of the frozen source text.
 *
 * `text` is the WHOLE span and is the validation authority for every
 * `sourceQuote`; `spanExcerptForPrompt` decides how much of it the model sees.
 */
export type ChapterSourceSpan = {
  readonly startOffset: number;
  readonly endOffset: number;
  readonly text: string;
};

/** R-057 — what an earlier chapter of THIS book already claimed, so this one
 *  does not re-mint the same organizing template. */
export type PriorChapterDigest = {
  readonly chapterNumber: number;
  readonly title: string;
  readonly focus: string;
  readonly caseLabels: readonly string[];
};

export type ChapterResearchInput = {
  bibliography: BibliographyResult;
  chapter: { number: number; title: string };
  /** Optional: list of chapter titles already researched in this book, so the
   *  researcher can avoid leaking concepts from later chapters back into this
   *  one. */
  priorChapterTitles?: string[];
  /** R-046: this chapter's slice of the frozen source text. Present ⇒ every
   *  checkable item must carry a verbatim `sourceQuote` from it. Absent ⇒ the
   *  model-memory path, byte-for-byte as before. */
  sourceSpan?: ChapterSourceSpan;
  /** sha256 of the frozen text `sourceSpan` was cut from (provenance only). */
  sourceTextSha256?: string;
  /** R-057: focus lines + case labels of already-researched chapters. */
  priorChapterDigests?: readonly PriorChapterDigest[];
  /** R-277: the book's fact pins, so a known-wrong fact is corrected AT BIRTH
   *  rather than one layer downstream in the writer prompt. */
  factPins?: readonly string[];
};

/**
 * References to the SOURCE DOCUMENT rather than to the world.
 *
 * R-024: the chapter/book/author patterns below only catch wording that names
 * the artifact outright. The released Franklin sidecar's `ch04.fact.09` claim —
 * "Franklin dies in 1790 with the Penn estate tax negotiation still unresolved
 * in his writing" — and the book scar pinned from it — "No resolution is
 * reached; the manuscript breaks off" — name none of those words, so both are
 * statements about a document that passed the guard and reached the writers.
 * The shipped chapter then ended on "the fight is still open", which the source
 * refutes: the law was finally allowed to pass.
 *
 * The possessive/definite framing ("the manuscript", "in his writing") is what
 * makes these meta rather than worldly, so the patterns require it: "a
 * narrative of weekly queries" or "he set the writing in type" are ordinary
 * facts and must stay admissible.
 */
const MANUSCRIPT_META_REGEXES: RegExp[] = [
  /\b(?:the|his|her|their|its) (?:life story|manuscript|memoir|narrative)\b/i,
  /\bin (?:his|her|their|the) (?:writing|writings|text|telling|manuscript)\b/i,
  /\b(?:unrecorded|breaks off|never finished)\b/i,
];

/** Meta-reference patterns shared with SC4/SC5 in critics/sourceCoherence.ts,
 *  which used to keep its own copy of this list and drifted from it (R-023/024). */
export const META_REGEXES: RegExp[] = [
  /\bthis chapter\b/i,
  /\bthe chapter\b/i,
  /\bthe author\b/i,
  /\bthe book\b/i,
  /\bchapter\s+\d+\b/i,
  /\bin this (chapter|section|book)\b/i,
  ...MANUSCRIPT_META_REGEXES,
];

/**
 * Verbs that turn a surname into a statement ABOUT a text ("Franklin argues…")
 * rather than a standalone fact about the world.
 *
 * REVIEW ROUND 3 (minor: prompt/validator drift). This was a regex alternation
 * string, and the prompt restated it — as EIGHT verbs, for every genre, while the
 * validator rejected ten on every non-memoir book. A non-memoir sidecar writing
 * "Clear opens with a story" was rejected by a rule the prompt did not state,
 * costing a retry the model had no way to anticipate. There is now ONE list, and
 * `authorVerbContractLines` renders the genre's own slice of it into the user
 * message — the same discipline `chapterMapContractLines` applies: the contract is
 * stated in the place that enforces it.
 */
export const AUTHOR_VERBS = ["argues", "says", "opens", "notes", "introduces", "explains", "writes", "claims", "points out", "observes"] as const;

/** The two verbs the memoir carve-out drops. See {@link MEMOIR_AUTHOR_VERBS}. */
export const MEMOIR_EXEMPT_AUTHOR_VERBS = ["opens", "introduces"] as const;

/**
 * R-053 — the memoir alternation.
 *
 * In a memoir or autobiography the author is not the SPEAKER of the text, he is
 * its SUBJECT: "Franklin organized the Union Fire Company" is the fact, and the
 * only alternative the researcher has if the surname is banned outright is an
 * agentless passive ("a fire company is organized"). The released Franklin
 * sidecars show the cost — ch03's paraphraseNotes is fully agentless ("pooling
 * money is proposed") and the shipped ch3 contains zero occurrences of
 * "Franklin".
 *
 * So for that genre the guard narrows to verbs that can ONLY be text
 * attribution. Two verbs leave the list: "opens" and "introduces", because both
 * have an ordinary worldly reading with a person as actor ("Franklin opens a
 * printing house", "Franklin introduces the lightning rod") and on a memoir that
 * reading is the common one. WHAT IT STILL CATCHES: "Franklin argues",
 * "Franklin writes", "Franklin claims", "Franklin notes", "Franklin observes",
 * "Franklin says", "Franklin explains", "Franklin points out" — every form that
 * makes the sidecar a statement about a document. WHAT IT STOPS BLOCKING: the
 * two worldly readings above, on memoir-classified books only. Every other genre
 * keeps the full list byte-for-byte.
 */
export const MEMOIR_AUTHOR_VERBS = AUTHOR_VERBS.filter(
  (verb) => !(MEMOIR_EXEMPT_AUTHOR_VERBS as readonly string[]).includes(verb),
);

/** The verbs the author-verb guard rejects for one book. The ONE source of truth
 *  for both the regexes below and the contract lines the prompt renders. */
export function authorVerbsFor(genre?: BibliographyResult["genre"]): readonly string[] {
  return genre === "memoir" ? MEMOIR_AUTHOR_VERBS : AUTHOR_VERBS;
}

/** The user-message lines that state rule 9 for THIS book, rendered from the same
 *  list the validator enforces so the two cannot drift. */
export function authorVerbContractLines(bibliography: SourceAuthorGuardInput): string[] {
  const banned = authorVerbsFor(bibliography?.genre).map((verb) => `"<Surname> ${verb}"`).join(", ");
  const lines = [
    `# Never make the author the SPEAKER of the text`,
    `Do not write ${banned}. State the claim directly instead. These are the exact constructions the validator rejects for this book.`,
  ];
  if (bibliography?.genre === "memoir") {
    lines.push(
      `This book is a MEMOIR, so the author is the SUBJECT of it: name him as the ACTOR of what he did — ${MEMOIR_EXEMPT_AUTHOR_VERBS.map((verb) => `"<Surname> ${verb} …"`).join(" and ")} are ALLOWED here, and an agentless passive ("a fire company was organized") is a defect, not a safe default.`,
    );
  }
  return lines;
}

/** Name particles and honorifics that are never the surname to guard on. */
const AUTHOR_NAME_NOISE = /^(jr|sr|ii|iii|iv|phd|md|dr|prof|professor|sir|dame)$/i;

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Surname(s) of the book's author, lowercased and deduped, derived from the
 * bibliography's own `author` string.
 *
 * R-023: this replaces a hardcoded sixteen-surname list. That list could only
 * fire for the sixteen books whose authors happened to be in it — on every
 * other book (Franklin included) the author-verb guard was a silent no-op, and
 * the file's own comment at the retry card already recorded the same failure
 * class for `"allen"`. Deriving the surname from the input makes the guard work
 * for EVERY book and stops it firing on third-party attributions ("Kahneman
 * argues…" in a book Kahneman did not write is a citation, not a meta-reference
 * to this text).
 *
 * Co-authors are split on comma / semicolon / "and" / "&"; the surname is the
 * last name-shaped token of each part, after dropping suffixes and honorifics.
 */
export function authorSurnames(author: string): string[] {
  const surnames: string[] = [];
  for (const part of String(author ?? "").split(/\s*(?:,|;|&|\band\b)\s*/i)) {
    const tokens = part
      .trim()
      .split(/\s+/)
      .map((token) => token.replace(/[.]/g, ""))
      .filter((token) => token.length > 0 && !AUTHOR_NAME_NOISE.test(token));
    const last = tokens[tokens.length - 1];
    if (!last || last.length < 3) continue;
    if (!/^[\p{L}][\p{L}'\u2019-]*$/u.test(last)) continue;
    surnames.push(last.toLowerCase());
  }
  return [...new Set(surnames)];
}

/**
 * Author-verb guards for one book, built from {@link authorSurnames}. Empty
 * when the author string yields no usable surname — the guard is then simply
 * absent rather than firing on someone else's name.
 *
 * REVIEW ROUND 3 (blocking finding). This used to take `(author, genre?)`, and
 * the optional second argument is exactly what went wrong: the researcher's own
 * validator passed the genre, `critics/sourceCoherence.ts` did not, and the
 * memoir carve-out below therefore applied on one of the two routes a sidecar
 * travels. A memoir sidecar that names its subject as an actor passed research
 * validation and then aborted the whole research stage in the coherence critic,
 * AFTER every chapter had been paid for.
 *
 * The parameter is now the bibliography record itself, so the genre cannot be
 * dropped by forgetting an argument: a call site that has a book has its genre.
 * `SourceAuthorGuardInput` is the narrowest shape both call sites already hold.
 */
export type SourceAuthorGuardInput = Pick<BibliographyResult, "author"> & Partial<Pick<BibliographyResult, "genre">>;

export function authorVerbRegexes(bibliography: SourceAuthorGuardInput): RegExp[] {
  const alternation = authorVerbsFor(bibliography?.genre).join("|");
  return authorSurnames(bibliography?.author ?? "").map(
    (surname) => new RegExp(`\\b${escapeRegExp(surname)}\\s+(?:${alternation})\\b`, "gi"),
  );
}

/** Distinct meta-reference / author-verb hits reported per attempt. Reporting
 *  ONE hit per attempt (R-025) meant a sidecar with three of them consumed all
 *  three MAX_CHAPTER_RESEARCH_ATTEMPTS attempts and aborted the book — the live
 *  Franklin failure. The cap keeps the retry feedback readable. */
export const MAX_REPORTED_META_HITS = 5;

/** Which lexical rule a {@link LexicalOffense} broke. */
export type LexicalOffenseRule = "meta-reference" | "author-verb";

/**
 * One meta-reference / author-verb hit, LOCATED.
 *
 * R-283. The guard used to report the matched PHRASE and nothing else —
 * `meta-reference "the book" found` — against a 20 KB sidecar. The live Franklin
 * run (2026-09-04) died 3/3 on exactly that message: the model was told which
 * words were illegal and left to find them, and the only remedy on offer was a
 * whole fresh draft. Reporting the FIELD and the offending SENTENCE is what makes
 * a targeted rewrite possible, for the model and for the operator reading the log.
 */
export type LexicalOffense = {
  readonly rule: LexicalOffenseRule;
  /** The matched phrase, in the case the draft actually used. */
  readonly match: string;
  /** Field path inside the sidecar, e.g. `keyClaims[1]`. */
  readonly path: string;
  /** The offending sentence, verbatim. */
  readonly sentence: string;
  /**
   * True when `path` is a PROSE field the bounded repair is allowed to rewrite.
   * A `hardSpecifics` token is a verbatim source token whose whole value is that
   * it is the source's own characters — "rewriting" one would manufacture a
   * quotation, so a hit there is not repairable and the chapter re-drafts.
   */
  readonly repairable: boolean;
};

/** One narrative field of a sidecar, with its path and whether the bounded
 *  repair may rewrite it. */
type NarrativeSegment = {
  readonly path: string;
  readonly text: string;
  readonly repairable: boolean;
};

/**
 * Every NARRATIVE field the sidecar carries downstream, in a stable order.
 *
 * R-024: testableFacts, example labels/hardSpecifics and the concept name were
 * all absent from the scanned set, and testableFacts is the field the source
 * packet compiles the writers' facts from — the released Franklin book shipped
 * `"Franklin dies in 1790 with the Penn estate tax negotiation still unresolved
 * in his writing"`, a statement about the manuscript rather than the world,
 * straight through this guard. voiceCues stay OUT on purpose: a voice cue
 * legitimately describes authorial technique ("opens each chapter with an
 * anecdote"), so scanning it would reject correct output.
 *
 * The set and its order are byte-identical to the single joined string this
 * replaced; splitting it per field is what lets a hit name its own location.
 */
function narrativeSegments(r: ChapterResearchResult): NarrativeSegment[] {
  const segments: NarrativeSegment[] = [];
  const push = (path: string, value: unknown, repairable: boolean): void => {
    if (typeof value === "string" && value.length > 0) segments.push({ path, text: value, repairable });
  };
  push("focus", r.focus, true);
  push("coreClaim", r.coreClaim, true);
  push("centralConcept.name", r.centralConcept?.name, true);
  push("centralConcept.plainDefinition", r.centralConcept?.plainDefinition, true);
  push("centralConcept.whyItMatters", r.centralConcept?.whyItMatters, true);
  (r.keyClaims ?? []).forEach((claim, index) => push(`keyClaims[${index}]`, claim, true));
  (r.namedExamples ?? []).forEach((example, index) => {
    push(`namedExamples[${index}].label`, example?.label, true);
    push(`namedExamples[${index}].summary`, example?.summary, true);
    push(`namedExamples[${index}].teachesWhat`, example?.teachesWhat, true);
    (Array.isArray(example?.hardSpecifics) ? example.hardSpecifics : []).forEach((specific, specificIndex) => {
      push(`namedExamples[${index}].hardSpecifics[${specificIndex}]`, specific, false);
    });
  });
  (r.testableFacts ?? []).forEach((fact, index) => {
    push(`testableFacts[${index}].claim`, fact?.claim, true);
    push(`testableFacts[${index}].becauseMechanism`, fact?.becauseMechanism, true);
    push(`testableFacts[${index}].commonError`, fact?.commonError, true);
    push(`testableFacts[${index}].errorIsWhy`, fact?.errorIsWhy, true);
  });
  push("hardEdge", r.hardEdge, true);
  push("paraphraseNotes", r.paraphraseNotes, true);
  return segments;
}

/**
 * Longest offending sentence quoted back in a problem line.
 *
 * The line is copied into the run manifest's error list, the operator log and
 * the repair prompt, and up to ten of them can be reported for one attempt, so
 * an unbounded quote would let one 2 KB paraphraseNotes sentence dominate all
 * three. A truncated quote still locates the sentence — the repair prompt also
 * carries the whole draft — and 300 characters clears any ordinary sentence.
 */
export const MAX_QUOTED_SENTENCE_CHARS = 300;

/** Sentence boundary: a terminator, any closing quotes/brackets, then space. */
const SENTENCE_BOUNDARY = /[.!?]["'\u2019\u201d)\]]*\s+/g;

/**
 * The sentence of `text` containing [index, index+length).
 *
 * Deliberately a boundary scan and not a parser: a mis-split on "Dr." costs a
 * slightly short quotation in a feedback line, which is still incomparably more
 * useful than the phrase alone, whereas a parser here would be a new dependency
 * on the one path that must never be the reason a chapter fails.
 */
function sentenceAround(text: string, index: number, length: number): string {
  let start = 0;
  const before = new RegExp(SENTENCE_BOUNDARY.source, "g");
  let match: RegExpExecArray | null;
  while ((match = before.exec(text)) !== null) {
    if (match.index >= index) break;
    start = match.index + match[0].length;
  }
  const after = new RegExp(SENTENCE_BOUNDARY.source, "g");
  after.lastIndex = index + length;
  const next = after.exec(text);
  const end = next === null ? text.length : next.index + next[0].trimEnd().length;
  const sentence = text.slice(start, end).trim();
  return sentence.length <= MAX_QUOTED_SENTENCE_CHARS
    ? sentence
    : `${sentence.slice(0, MAX_QUOTED_SENTENCE_CHARS)}…`;
}

/**
 * Every distinct match of `patterns` across `segments`, in first-seen order,
 * deduped case-insensitively and capped at {@link MAX_REPORTED_META_HITS} —
 * the same dedupe and cap the phrase-only scanner applied, now carrying the
 * location and the sentence with each hit.
 */
function collectOffenses(
  segments: readonly NarrativeSegment[],
  patterns: readonly RegExp[],
  rule: LexicalOffenseRule,
): LexicalOffense[] {
  const seen = new Set<string>();
  const offenses: LexicalOffense[] = [];
  for (const pattern of patterns) {
    const global = pattern.global ? pattern : new RegExp(pattern.source, `${pattern.flags}g`);
    for (const segment of segments) {
      global.lastIndex = 0;
      for (const match of segment.text.matchAll(global)) {
        const key = match[0].toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        offenses.push({
          rule,
          match: match[0],
          path: segment.path,
          sentence: sentenceAround(segment.text, match.index ?? 0, match[0].length),
          repairable: segment.repairable,
        });
        if (offenses.length >= MAX_REPORTED_META_HITS) return offenses;
      }
    }
  }
  return offenses;
}

/**
 * The retry card for a meta-reference hit.
 *
 * Three things this must not do, all learned from live Franklin runs that died
 * here 3/3 on `"the author"` and `"the book"`:
 *
 * 1. It must not carry ANOTHER book's vocabulary. The old text enumerated
 *    `"Allen writes"` and told the model to state facts "about
 *    people/thought/circumstances" — As a Man Thinketh's thesis, baked into the
 *    universal researcher contract. On a book about an eighteenth-century printer
 *    that guidance is actively misdirecting, and it is exactly the leak bookScars
 *    exists to prevent ("one book's scar tissue became a house-voice force in
 *    every OTHER book"). The section writers were migrated to that mechanism; the
 *    researcher never was. Note the old text was stale on its own terms too: the
 *    author-verb guard was a hardcoded surname list with no `allen` entry, so the
 *    example it cited could not fire. R-023 replaced that list with authorSurnames().
 *
 * 2. It must say what to DO, not just what is banned. Finding 11ad already
 *    established that enumerating banned forms raises the degenerate-response
 *    rate. `"the author"` is the sharp case: in an autobiography the author IS
 *    the subject, so a model told only "don't say the author" has no legal move
 *    for a sentence that is genuinely about that person. Naming them resolves it —
 *    "Franklin left Boston", never "the author left Boston" — and the fix
 *    generalises, because every book has an author to name.
 *
 * 3. R-283: it must say WHERE. The phrase alone ("the book") is a needle the
 *    model has to find in its own 20 KB draft, and the 2026-09-04 run shows what
 *    that costs — ch01 went 4 hits → 1 hit → 1 hit + a new author-verb across
 *    three full re-drafts and never reached zero. The field path and the verbatim
 *    sentence turn the same message into a rewrite instruction.
 */
function metaReferenceProblem(offense: LexicalOffense, author: string): string {
  const named = author.trim();
  const remedy = named.length > 0
    ? `Name the person or thing instead — for this book, write "${named}" rather than "the author".`
    : "Name the person or thing instead of referring to the text.";
  return `meta-reference "${offense.match}" found in \`${offense.path}\`: ${JSON.stringify(offense.sentence)} — A sidecar states standalone facts about the world, never facts about a text: drop "this chapter", "the chapter", "this book", "the book", "the author", and chapter/section numbers. ${remedy} Rewrite THAT sentence so it would read correctly to someone who has never seen the book; if it states nothing about the world, delete the sentence.`;
}

/** The retry card for an author-surname-verb hit, located the same way. */
function authorVerbProblem(offense: LexicalOffense): string {
  return `author-surname-verb construction "${offense.match}" found in \`${offense.path}\`: ${JSON.stringify(offense.sentence)} — state the claim directly.`;
}

/** The problem line one offense produces. One offense is exactly one line, which
 *  is what lets the repair gate below decide eligibility by counting. */
function offenseProblem(offense: LexicalOffense, author: string): string {
  return offense.rule === "meta-reference" ? metaReferenceProblem(offense, author) : authorVerbProblem(offense);
}

/**
 * Max words in a single hardSpecific. A hardSpecific is a SHORT verbatim source
 * TOKEN — a proper name, number, measurement, or striking phrase — not a
 * sentence or clause. The floor exists because downstream composition gates
 * embed a case's hardSpecifics VERBATIM inside word-budgeted units: SEC16
 * requires a memorable line (8-14 words) to contain >=2 of its cited case's
 * hardSpecifics verbatim, and SEC14/33 embed them in equally tight budgets. Two
 * clause-length specifics ("neglected plot of ground, with no idle middle
 * option" = 8 words) cannot compose into a 14-word line, making SEC16
 * structurally unsatisfiable. Capping each specific at 5 words keeps the
 * downstream budgets satisfiable while leaving the >=2-per-case floor
 * (SV2.hard_specifics_floor / SV2.named_examples) intact — short specifics make
 * that floor easy to satisfy, not harder.
 */
export const MAX_HARD_SPECIFIC_WORDS = 5;

function hardSpecificWordCount(text: string): number {
  return text.trim().split(/\s+/).filter((word) => word.length > 0).length;
}

/**
 * Per-specific word-cap check: reject any NON-EMPTY hardSpecific longer than
 * {@link MAX_HARD_SPECIFIC_WORDS} words. Returns [] when every specific is a
 * short token (or empty). Empty / whitespace-only specifics are deliberately NOT
 * flagged here — they are left to the >=2-non-empty-per-case floor
 * (SV2.hard_specifics_floor), so empty/duplicate behavior is unchanged. Exported
 * and shared by BOTH the researcher-chapter validator (so a fresh clause-length
 * output is rejected and the retry loop feeds the violation back to the model)
 * AND the durable-sidecar reuse hook (so a STALE clause-specific sidecar is
 * rejected on reuse and falls through to re-research) — a single source of truth
 * for the short-token research contract.
 */
export function collectHardSpecificLengthProblems(
  namedExamples: ChapterResearchResult["namedExamples"] | undefined,
): string[] {
  const problems: string[] = [];
  if (!Array.isArray(namedExamples)) return problems;
  for (const example of namedExamples) {
    const specifics = Array.isArray(example?.hardSpecifics) ? example.hardSpecifics : [];
    for (const specific of specifics) {
      if (typeof specific !== "string") continue;
      const trimmed = specific.trim();
      if (trimmed.length === 0) continue;
      const words = hardSpecificWordCount(trimmed);
      if (words > MAX_HARD_SPECIFIC_WORDS) {
        problems.push(
          `hardSpecific too long (${words} words) in namedExamples "${example?.label ?? ""}": ${JSON.stringify(trimmed)} — give a short verbatim token (a name, number, phrase of <=${MAX_HARD_SPECIFIC_WORDS} words), not a sentence or clause`,
        );
      }
    }
  }
  return problems;
}

/**
 * R-051 / R-282 — SHAPE rejection for hardSpecifics.
 *
 * The five-word cap was the only filter, so a clause survived as long as it was
 * short: `"speckled Ax is best"` (a clause with a finite verb, and not even the
 * source's words — the Autobiography reads "I think I like a speckled ax best")
 * was stitched raw into ten shipped surfaces, including "The speckled-axe story
 * about a speckled Ax is best only explains". A hardSpecific has to compose as a
 * NOUN PHRASE inside a word-budgeted line; a predicate cannot.
 *
 * The verb list is CLOSED and deliberately conservative. There is no parser here,
 * and a false positive costs a retry and can cost the specific altogether, so
 * every token that is commonly a noun in a book's own vocabulary — set, cost,
 * run, will, can, may, means, left, put, does, lost — is deliberately absent even
 * though each is also a finite verb. False negatives (a fragment that slips
 * through) are acceptable; false positives on ordinary noun phrases are not.
 */
const FINITE_VERB_TOKENS: ReadonlySet<string> = new Set([
  "is", "are", "was", "were", "am", "isn't", "aren't", "wasn't", "weren't",
  "has", "have", "had", "hasn't", "haven't", "hadn't",
  "did", "didn't", "don't", "doesn't",
  "would", "should", "could", "must", "shall", "won't", "can't", "couldn't", "wouldn't", "shouldn't",
  "said", "says", "took", "takes", "gave", "gives", "went", "goes", "came", "comes",
  "saw", "sees", "got", "gets", "ran", "won", "found", "kept", "keeps", "told", "tells",
  "thought", "thinks", "knew", "knows", "became", "becomes", "began", "begins",
  "brought", "brings", "bought", "buys", "built", "held", "meant", "met", "meets",
  "paid", "pays", "sold", "sells", "sent", "sat", "stood", "taught", "wrote", "writes",
  "wore", "drove", "spent", "refused", "agreed", "proposed", "wanted", "needed",
]);

/** Straight-and-curly double-quote characters, folded for the balance check. */
const DOUBLE_QUOTE_CHARS = /["\u201c\u201d\u201e\u201f]/g;

/** The finite verb inside a candidate hardSpecific, or null. */
function finiteVerbIn(text: string): string | null {
  for (const raw of text.split(/[\s]+/)) {
    const token = raw.replace(/^[^\p{L}\p{N}']+|[^\p{L}\p{N}']+$/gu, "").toLowerCase();
    if (token.length > 0 && FINITE_VERB_TOKENS.has(token)) return token;
  }
  return null;
}

/**
 * Reject any hardSpecific that is a predicate fragment or opens a quotation it
 * does not close. Exported and shared by the fresh-research validator AND the
 * durable-sidecar reuse hook, exactly like the word-cap rule, so a stale sidecar
 * carrying `"speckled Ax is best"` is re-researched rather than reused.
 */
export function collectHardSpecificShapeProblems(
  namedExamples: ChapterResearchResult["namedExamples"] | undefined,
): string[] {
  const problems: string[] = [];
  if (!Array.isArray(namedExamples)) return problems;
  for (const example of namedExamples) {
    const specifics = Array.isArray(example?.hardSpecifics) ? example.hardSpecifics : [];
    for (const specific of specifics) {
      if (typeof specific !== "string") continue;
      const trimmed = specific.trim();
      if (trimmed.length === 0) continue;
      const label = `in namedExamples ${JSON.stringify(example?.label ?? "")}`;
      const verb = finiteVerbIn(trimmed);
      if (verb !== null) {
        problems.push(
          `hardSpecific ${JSON.stringify(trimmed)} ${label} is a clause, not a token — it contains the finite verb "${verb}". Give a name, number, place or noun phrase instead. If the LINE itself is what the chapter turns on (a maxim, a proverb, a prayer), put it in \`quotations\` with an attributionFrame that contains it, so a writer has a grammatical slot for it.`,
        );
        continue;
      }
      const quoteCount = (trimmed.match(DOUBLE_QUOTE_CHARS) ?? []).length;
      if (quoteCount % 2 === 1) {
        problems.push(
          `hardSpecific ${JSON.stringify(trimmed)} ${label} opens a quotation it never closes — a half-quote cannot be embedded verbatim in a sentence. Use the quoted words as a plain noun phrase, or move the whole line into \`quotations\` with an attributionFrame.`,
        );
      }
    }
  }
  return problems;
}

/** Total chapter-research attempts (initial + retries). Sonnet occasionally
 *  returns a model-minted schema or trips the meta-reference content guard on
 *  the first try; a bounded retry that hands the validator's own error list
 *  back to the model recovers those cases without a route/envelope change. */
export const MAX_CHAPTER_RESEARCH_ATTEMPTS = 3;

/** Feedback line handed back to the model when the GATEWAY (not the in-process
 *  validator) rejected the previous output against its source-controlled schema.
 *  The raw invalid output never leaves the gateway, so — unlike an in-process
 *  rejection — there is no prior-output echo to include. */
const GATEWAY_SCHEMA_REJECTION_FEEDBACK = "gateway schema validation rejected the previous output";

/** Aggregate-error line for an attempt lost to a transient model process
 *  failure (rate-limit / overload / abrupt subprocess exit). No output ever
 *  reached this process, so there is nothing to echo — only the transient
 *  cause is reported. */
const TRANSIENT_PROCESS_FAILURE_FEEDBACK = "a transient model process failure occurred before any output was produced";

/** Aggregate-error line for an attempt killed at the profile timeout horizon
 *  (Task 11k, outcome TIMED_OUT). No output ever reached this process — a
 *  timeout says nothing about progress (claude -p buffers all stdout until
 *  completion) — so nothing is echoed; only the timeout cause is reported. */
const TIMED_OUT_FEEDBACK = "the previous attempt timed out before any output was produced";

/**
 * In-loop backoff schedule (ms) between transient-process-failure retries,
 * indexed by (attempt − 1): the wait BEFORE attempt 2 is index 0, before
 * attempt 3 is index 1, clamping to the last entry for any higher attempt cap.
 * A provider rate-limit/overload incident clears on a short delay far more often
 * than on an immediate re-spawn, so a bounded escalating backoff turns a single
 * transient subprocess failure into a recovered chapter rather than a dead stage.
 */
export const TRANSIENT_RETRY_BACKOFF_MS: readonly number[] = Object.freeze([2000, 8000]);

/**
 * One rejected chapter-research draft, handed to the caller so it can be
 * PERSISTED (see researcher.ts / REJECTED_DRAFTS_DIR).
 *
 * Before this existed, a live rejection left nothing behind: only passing
 * sidecars are written, `attempts.jsonl` carries gateway metadata with no model
 * output in it, and the aggregate error string lists problem lines with the
 * draft they came from gone. The Franklin run of 2026-09-04 could not be
 * diagnosed after the fact for exactly that reason.
 */
export interface RejectedChapterDraft {
  readonly chapterNumber: number;
  /** 1-based attempt index within MAX_CHAPTER_RESEARCH_ATTEMPTS. */
  readonly attempt: number;
  /** The RAW model output for this attempt, exactly as the model returned it. */
  readonly draft: unknown;
  /** The validator + grounding lines that rejected it. */
  readonly problems: readonly string[];
  /** Present ONLY when the bounded meta repair ran on this attempt. */
  readonly repair?: {
    /** The raw repair response, or null when the repair call did not complete. */
    readonly response: unknown;
    /** Whether applyMetaRepair produced a merged object at all. */
    readonly merged: boolean;
    /** Why the merged result was still rejected ([] when the merge was refused). */
    readonly problems: readonly string[];
  };
}

/** Diagnostics sink for {@link RejectedChapterDraft}. It is called for effect
 *  only; anything it throws is swallowed (see the call site) so an observability
 *  failure can never change what research does. */
export type RejectedChapterDraftSink = (record: RejectedChapterDraft) => void;

/** Injectable dependencies for {@link runResearcherChapter}. The `sleep` hook
 *  is faked to resolve instantly in tests so the backoff schedule is asserted
 *  deterministically without a real wall-clock wait. Production uses setTimeout. */
export interface ChapterResearchRetryOptions {
  readonly sleep?: (ms: number) => Promise<void>;
  readonly onRejectedDraft?: RejectedChapterDraftSink;
}

const defaultSleep = (ms: number): Promise<void> => new Promise((done) => setTimeout(done, ms));

function backoffMsForAttempt(attempt: number): number {
  const index = Math.min(Math.max(attempt - 1, 0), TRANSIENT_RETRY_BACKOFF_MS.length - 1);
  return TRANSIENT_RETRY_BACKOFF_MS[index];
}

/** Per-attempt failure record. Drives both the next attempt's retry feedback
 *  and the final fail-closed aggregate message. */
type AttemptFailure =
  | { readonly kind: "validator"; readonly problems: string[]; readonly output: unknown }
  | { readonly kind: "gateway-schema" }
  | { readonly kind: "transient-process" }
  | { readonly kind: "quota-exhausted"; readonly message: string }
  | { readonly kind: "timed-out" };

function failureProblems(failure: AttemptFailure): string[] {
  if (failure.kind === "validator") return failure.problems;
  if (failure.kind === "gateway-schema") return [GATEWAY_SCHEMA_REJECTION_FEEDBACK];
  if (failure.kind === "timed-out") return [TIMED_OUT_FEEDBACK];
  // Task 11af: a durable quota cap is reported in the provider's own words —
  // the operator needs the reset horizon, not a "transient" euphemism.
  if (failure.kind === "quota-exhausted") return [failure.message];
  return [TRANSIENT_PROCESS_FAILURE_FEEDBACK];
}

function describeFailure(failure: AttemptFailure): string {
  return failureProblems(failure).join("; ");
}

/**
 * Classify a thrown `runJsonModelTask` error as a gateway-level schema
 * rejection (validator-class, retryable) versus genuine model infrastructure
 * (cancellation, capacity, admission collision — propagate immediately).
 *
 * `runJsonModelTask` throws `MODEL_TASK_${outcome}:${errorCode}:${message}`. The
 * gateway emits `MODEL_OUTPUT_INVALID` (with outcome FAILED) ONLY when a bounded,
 * exit-0 model process produced output that failed the route's output schema —
 * exactly the same variance class the in-process validator catches, just caught
 * one layer out. Every other `MODEL_TASK_*` code (MODEL_RUN_CANCELLED,
 * MODEL_ATTEMPT_EXISTS, MODEL_CAPACITY_EXHAUSTED, MODEL_EXECUTION_UNCERTAIN, …)
 * is real infrastructure and must NOT burn a retry.
 */
function isGatewaySchemaRejection(message: string): boolean {
  return /^MODEL_TASK_FAILED:MODEL_OUTPUT_INVALID(:|$)/.test(message);
}

/**
 * Classify a thrown error as a TRANSIENT model-process failure: a bounded,
 * exit-nonzero subprocess (`outcome=FAILED`, `MODEL_PROCESS_FAILED`) — the shape
 * a rate-limited / overloaded provider CLI returns when it writes a small error
 * envelope and exits 1. Unlike a cancellation, capacity, or admission-collision
 * code (real, non-retryable infrastructure state), a transient process failure
 * routinely clears on a short backoff, so it is retried with a fresh attempt.
 * Scoped to `outcome=FAILED` only: TIMED_OUT / UNKNOWN teardown carry the same
 * error code but a different outcome and stay fail-closed.
 */
function isTransientProcessFailure(message: string): boolean {
  return /^MODEL_TASK_FAILED:MODEL_PROCESS_FAILED(:|$)/.test(message);
}

/**
 * Classify a thrown error as a TIMEOUT (Task 11k): a bounded process killed at
 * the profile timeout horizon surfaces as `outcome=TIMED_OUT` (the gateway
 * stamps code MODEL_PROCESS_FAILED, but this matches ANY code on the TIMED_OUT
 * outcome). Because `claude -p` buffers all stdout until completion, a timeout
 * reveals nothing about progress, and a fresh re-spawn against the same bounded
 * budget routinely completes — so it is a transient class retried after a
 * bounded backoff. Scoped to `outcome=TIMED_OUT` only: CANCELLED (operator
 * intent) and UNKNOWN (uncertain teardown) carry different outcomes and stay
 * fail-closed.
 */
function isTimedOut(message: string): boolean {
  return /^MODEL_TASK_TIMED_OUT(:|$)/.test(message);
}

/**
 * R-283 — bounded lexical repairs per chapter-research attempt.
 *
 * ONE. The whole argument for the repair is that it is cheaper and likelier to
 * converge than a full regeneration; a repair loop would be neither. When a
 * repair does not land, the attempt falls through to the ordinary retry, and
 * MAX_CHAPTER_RESEARCH_ATTEMPTS remains the outer bound on the chapter.
 */
export const MAX_META_REPAIRS_PER_ATTEMPT = 1;

/** The most model calls one chapter can cost: every attempt may spend a draft
 *  and at most one repair. The run-state attempt cap is derived from THIS, not
 *  from the attempt count, or a long book exhausts its admission capacity
 *  mid-stage. */
export const MAX_CHAPTER_RESEARCH_MODEL_CALLS =
  MAX_CHAPTER_RESEARCH_ATTEMPTS * (1 + MAX_META_REPAIRS_PER_ATTEMPT);

/**
 * Is this rejection one the bounded repair can honestly fix?
 *
 * TWO conditions, both necessary:
 *  - EVERY problem line is a lexical offense (each offense produces exactly one
 *    line, so equal counts prove there is nothing else wrong — no floor, no
 *    ungrounded quote, no clause-shaped hardSpecific, no SV2 finding);
 *  - EVERY offense sits in a PROSE field. A hit inside `hardSpecifics` is a hit
 *    on a verbatim source token, and a rewritten "verbatim" token is a
 *    manufactured quotation — that chapter re-drafts instead.
 */
function isMetaRepairEligible(problems: readonly string[], offenses: readonly LexicalOffense[]): boolean {
  if (offenses.length === 0) return false;
  if (problems.length !== offenses.length) return false;
  return offenses.every((offense) => offense.repairable);
}

/**
 * The bounded repair user message.
 *
 * It carries the offending sentences VERBATIM (the thing the phrase-only feedback
 * never did), the draft to repair, and a closed list of what may change. It does
 * NOT carry the source span: the repair may not add a claim, so it has no use for
 * the text, and leaving it out is most of why this call is cheap.
 *
 * Exported so the contract is pinned by test rather than only by a live run.
 */
export function buildMetaRepairPrompt(
  input: ChapterResearchInput,
  offenses: readonly LexicalOffense[],
  draft: ChapterResearchResult,
): string {
  const author = input.bibliography.author.trim();
  const named = author.length > 0 ? author : "the person the book is about";
  const floors = researchFloorsForSpan(input.sourceSpan?.text.length ?? null);
  const parts: string[] = [];
  parts.push(`# Repair task — rewrite ONLY the sentences listed below`);
  parts.push("");
  parts.push(`You produced the ChapterResearchResult JSON at the end of this message for chapter ${input.chapter.number} of "${input.bibliography.title}". It is correct except for ${offenses.length} sentence(s) that talk ABOUT the text instead of stating a fact about the world.`);
  parts.push("");
  parts.push(`A sidecar is read by people who will never see this book. Every sentence in it must be a fact about ${named} and the world: who did what, where, when, and with what result. A sentence about "this chapter", "the book", "the memoir", "the author" or "in his writing" states nothing a reader could check, so it is rejected.`);
  parts.push("");
  parts.push(`Rejected: "The book opens with a letter to <person>, and the author explains why he is setting down <what>."`);
  parts.push(`Accepted: "${named} set down <what> for <person> in <year>, at <place>."`);
  parts.push("");
  // Only the REPORTED offenses are listed (MAX_REPORTED_META_HITS caps them). A
  // draft carrying more than the cap therefore cannot be fully repaired in one
  // call — the merged result still trips the guard, the repair is discarded and
  // the chapter re-drafts. That is the fail-closed direction on purpose.
  parts.push(`## The sentences to fix`);
  offenses.forEach((offense, index) => {
    parts.push(`${index + 1}. ${offenseProblem(offense, input.bibliography.author)}`);
  });
  parts.push("");
  parts.push(`## What you may change`);
  parts.push(`- Rewrite each listed sentence IN PLACE, as a fact about ${named} and the world.`);
  parts.push(`- If a listed sentence sits in a PROSE field (\`focus\`, \`coreClaim\`, \`centralConcept\`, \`hardEdge\`, \`paraphraseNotes\`) and carries no fact about the world at all — it only describes the passage — DELETE that sentence and keep the rest of its field. Never leave a required field empty: if the whole field is narration, rewrite it instead of emptying it.`);
  parts.push(`- \`keyClaims\` is an UNKEYED list, so rewrite a listed claim IN PLACE and return exactly the same ${draft.keyClaims.length} claims in the same order. NEVER delete a key claim, never add one, never re-order them. If a listed claim states no fact about the world at all, rewrite it as a different world fact this draft already states elsewhere (a \`namedExamples\` summary, a \`testableFacts\` claim) — invent nothing, and do not leave it as narration.`);
  parts.push(`- A \`keyClaims\` list of any other length, or one that repeats a claim, or one that loses a claim you were not asked to rewrite, is REFUSED WHOLE: the merge throws your entire repair away and the chapter keeps its original rejection. The merge reads your list position by position and cannot tell where a deleted claim used to sit, so it refuses rather than guess.`);
  parts.push(`- If a listed sentence IS a whole entry of \`namedExamples\` or \`testableFacts\` and it carries no fact about the world, drop that entry rather than inventing a replacement — but this chapter still needs at least ${floors.namedExamples} named examples and ${floors.testableFacts} testable facts, and a drop that breaks one of those floors throws the whole repair away.`);
  parts.push(`- Change NOTHING else. Every other sentence, every id, every \`sourceQuote\`, every \`hardSpecifics\` token and every number stays exactly as it is.`);
  parts.push(`- Invent nothing. If the draft does not already contain a fact, do not add one; you cannot see the source text on this call and an unquotable claim is worse than a missing one.`);
  parts.push("");
  parts.push(`## Your draft`);
  parts.push(safeJson(draft));
  parts.push("");
  parts.push(`Return the complete corrected ChapterResearchResult JSON object — the whole object, not a patch. Output MUST be a single JSON object whose schemaVersion is exactly "source-v2". Emit no prose before or after it.`);
  return parts.join("\n");
}

function repairedString(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim().length > 0 ? value : fallback;
}

/**
 * Merge a repair response onto the draft it repaired — the reason the repair
 * cannot corrupt a sidecar even when the model ignores every instruction above.
 *
 * ONLY the prose fields listed here are taken from the response. Ids,
 * `sourceQuote`s, `hardSpecifics`, `hardSpecificEvidence`, `quotations`,
 * `frameworks`, `realWorld`, `forbiddenLeakage`, `chapterNumber` and
 * `schemaVersion` come from the DRAFT, byte for byte, so a repair can never mint
 * a quotation or re-anchor a fact.
 *
 * It can never ADD one either, and the two list shapes need different machinery
 * to guarantee that (round-2 review finding). `namedExamples`/`testableFacts` are
 * id-keyed, so a response entry matching no draft entry is simply ignored
 * (mergeById). `keyClaims` is a bare string list with no ids and no
 * `sourceQuote` — nothing downstream can tell an appended claim from a repaired
 * one, and the repair call is deliberately not shown the source span — so it is
 * merged POSITIONALLY: index i is replaced only by a non-empty string at index i.
 *
 * A positional merge is add-proof but it is NOT drop-proof or re-order-proof
 * (round-3 review finding, and the reason `mergeKeyClaims` exists): a response
 * that DELETES the flagged claim and returns the rest slides every later claim
 * one place up, so the flagged claim disappears, the survivors change position
 * and the last one is duplicated to fill the length — and no validator catches
 * that, because `keyClaims` is checked by a count floor with no duplicate check.
 * The merge cannot know where a deleted claim was meant to sit, so instead of
 * guessing it FAILS THE REPAIR CLOSED: the whole response is refused, this
 * function returns null and the draft's own rejection stands, exactly as it would
 * have with no repair at all. It refuses when the response's `keyClaims` is a
 * different length than the draft's, when the merged list would repeat a claim
 * (compared on normalized text), or when any index the repair was NOT asked to
 * rewrite no longer carries the draft's own claim (`offenses` names the flagged
 * indices; a re-ordering is refused by that same rule). What the merge GUARANTEES
 * is therefore narrower than "a claim cannot move": a repair either returns the
 * draft's own claims with the flagged ones rewritten in place, or it is thrown
 * away whole.
 *
 * A repair CAN still drop an id-keyed item (an entry the response omits by id is
 * dropped) — that is the honest move for pure narration — and the merged object
 * is then re-validated against the same floors, so a drop that breaks a floor
 * rejects the repair.
 *
 * Returns null when the response is not a usable object, or when its `keyClaims`
 * is refused as above; the caller then keeps the draft's own rejection.
 */
export function applyMetaRepair(
  draft: ChapterResearchResult,
  repaired: unknown,
  /** The offenses this repair was asked to fix. Only the `keyClaims[i]` paths in
   *  it are read: a claim at any other index may not be replaced. Defaults to
   *  "nothing was flagged", which is the strictest reading, never a looser one. */
  offenses: readonly LexicalOffense[] = [],
): ChapterResearchResult | null {
  if (!repaired || typeof repaired !== "object" || Array.isArray(repaired)) return null;
  const patch = repaired as Partial<ChapterResearchResult>;
  const keyClaims = mergeKeyClaims(draft.keyClaims, patch.keyClaims, flaggedKeyClaimIndices(offenses));
  // A keyClaims list that added, dropped, duplicated or re-ordered a claim fails
  // the WHOLE repair closed — never a partial merge onto a shifted list.
  if (keyClaims === null) return null;
  const merged: ChapterResearchResult = {
    ...draft,
    focus: repairedString(patch.focus, draft.focus),
    coreClaim: repairedString(patch.coreClaim, draft.coreClaim),
    hardEdge: repairedString(patch.hardEdge, draft.hardEdge),
    paraphraseNotes: repairedString(patch.paraphraseNotes, draft.paraphraseNotes),
    centralConcept: {
      ...draft.centralConcept,
      name: repairedString(patch.centralConcept?.name, draft.centralConcept?.name),
      plainDefinition: repairedString(patch.centralConcept?.plainDefinition, draft.centralConcept?.plainDefinition),
      whyItMatters: repairedString(patch.centralConcept?.whyItMatters, draft.centralConcept?.whyItMatters),
    },
    keyClaims,
    namedExamples: mergeById(draft.namedExamples, patch.namedExamples, ["label", "summary", "teachesWhat"]),
    testableFacts: draft.testableFacts === undefined
      ? draft.testableFacts
      : mergeById(draft.testableFacts, patch.testableFacts, ["claim", "becauseMechanism", "commonError", "errorIsWhy"]),
  };
  return merged;
}

/** Identity of a key claim for comparison ONLY: whitespace and case carry no
 *  meaning in a claim, so a re-cased copy of a claim is still that claim and must
 *  not read as a second, different one. */
function claimIdentity(claim: string): string {
  return claim.trim().replace(/\s+/g, " ").toLowerCase();
}

/** Which `keyClaims` indices the repair was actually asked to rewrite, read off
 *  the offense paths (`keyClaims[2]`). Everything else must survive untouched. */
function flaggedKeyClaimIndices(offenses: readonly LexicalOffense[]): Set<number> {
  const flagged = new Set<number>();
  for (const offense of offenses) {
    const match = /^keyClaims\[(\d+)\]$/.exec(offense.path);
    if (match !== null) flagged.add(Number(match[1]));
  }
  return flagged;
}

/**
 * Merge the UNKEYED `keyClaims` list positionally, or REFUSE the repair.
 *
 * Index i is replaced only by a non-empty string at index i, so an in-place
 * rewrite is the only edit that can land. Everything else returns null, which
 * fails the whole repair closed (applyMetaRepair):
 *
 *  - a different length: the response added or dropped a claim, and a positional
 *    merge cannot tell which claim went where (round-3 finding: a dropped claim
 *    used to shift the survivors up and duplicate the last one);
 *  - a repeated claim in the merged list, compared on normalized text;
 *  - an index the repair was not asked to rewrite whose claim is no longer the
 *    draft's own (compared the same way) — "change NOTHING else" is the repair
 *    contract, a silent overwrite of an unflagged claim is a deletion wearing a
 *    rewrite's clothes, and holding every unflagged index to its own draft entry
 *    is also what rules out a pure re-ordering of the list.
 *
 * A response that carries no `keyClaims` at all changed nothing there, so the
 * draft's own list stands.
 */
function mergeKeyClaims(
  draft: readonly string[] | undefined,
  patch: unknown,
  flagged: ReadonlySet<number>,
): string[] | null {
  const entries = Array.isArray(draft) ? [...draft] : [];
  if (!Array.isArray(patch)) return entries;
  if (patch.length !== entries.length) return null;
  const merged = entries.map((entry, index) => {
    const replacement = patch[index];
    return typeof replacement === "string" && replacement.trim().length > 0 ? replacement : entry;
  });
  const identities = new Set<string>();
  for (const claim of merged) {
    const identity = claimIdentity(claim);
    if (identities.has(identity)) return null;
    identities.add(identity);
  }
  for (const [index, entry] of entries.entries()) {
    if (flagged.has(index)) continue;
    if (claimIdentity(merged[index]) !== claimIdentity(entry)) return null;
  }
  return merged;
}

/**
 * Take `fields` from the repair response onto each draft entry.
 *
 * Matching is by `id` first — the anchor the whole source-v2 graph is keyed on —
 * and falls back to POSITION only when the two lists are the same length, so a
 * response that scrambled or dropped its ids still repairs the right entry
 * instead of silently emptying the list. An entry the response omits under both
 * rules is DROPPED; a response entry that matches no draft entry is IGNORED (the
 * repair may never add an item).
 */
function mergeById<T extends { id?: string }>(
  draft: readonly T[] | undefined,
  patch: unknown,
  fields: readonly (keyof T & string)[],
): T[] {
  const entries = Array.isArray(draft) ? draft : [];
  if (!Array.isArray(patch)) return [...entries];
  const byId = new Map<string, Record<string, unknown>>();
  for (const candidate of patch) {
    if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) continue;
    const id = (candidate as { id?: unknown }).id;
    if (typeof id === "string" && id.length > 0) byId.set(id, candidate as Record<string, unknown>);
  }
  const sameLength = patch.length === entries.length;
  const merged: T[] = [];
  entries.forEach((entry, index) => {
    const positional = sameLength && patch[index] && typeof patch[index] === "object" && !Array.isArray(patch[index])
      ? (patch[index] as Record<string, unknown>)
      : undefined;
    const source = (typeof entry.id === "string" ? byId.get(entry.id) : undefined) ?? positional;
    if (source === undefined) return; // omitted by the repair: dropped on purpose
    const next = { ...entry } as Record<string, unknown>;
    for (const field of fields) {
      // A field the DRAFT does not carry as a string is not repairable: the
      // offending sentence came out of the draft, so every listed field exists
      // there. Writing one here would either mint prose the draft never had or —
      // the round-2 review's minor — coerce an absent optional field (a
      // testableFact with no `commonError`) into `""`, silently changing the
      // shape of the persisted chNN.source.json. Absent stays absent.
      if (typeof entry[field] !== "string") continue;
      const replacement = source[field];
      if (typeof replacement === "string" && replacement.trim().length > 0) next[field] = replacement;
    }
    merged.push(next as T);
  });
  return merged;
}

export async function runResearcherChapter(
  input: ChapterResearchInput,
  execution?: ModelCallerExecution,
  options?: ChapterResearchRetryOptions,
): Promise<ChapterResearchResult> {
  const systemPrompt = readFileSync(resolve(PROMPTS_DIR, "researcher-chapter.system.md"), "utf8");
  const baseUserPrompt = buildUserPrompt(input);
  const sleep = options?.sleep ?? defaultSleep;
  /** Hand a rejected draft to the caller's diagnostics sink. A sink that throws
   *  is a broken disk or a broken logger, never a reason to fail a chapter that
   *  the validator has already judged on its own terms — so the throw is
   *  swallowed here and the retry loop continues exactly as it would have. */
  const recordRejection = (record: RejectedChapterDraft): void => {
    if (!options?.onRejectedDraft) return;
    try {
      options.onRejectedDraft(record);
    } catch {
      // deliberately ignored: diagnostics never gate research
    }
  };
  // The WHOLE span is the validation authority for every quote, even when only
  // an excerpt of it reached the prompt (spanExcerptForPrompt).
  const spanText = input.sourceSpan?.text ?? null;
  const provenance: SourceTextProvenanceLabel = spanText === null ? "model-memory" : "source-text";
  /** itemKey -> how many attempts that item has failed grounding on. */
  const itemFailures = new Map<string, number>();

  const attemptFailures: AttemptFailure[] = [];

  for (let attempt = 1; attempt <= MAX_CHAPTER_RESEARCH_ATTEMPTS; attempt++) {
    const userPrompt = attempt === 1
      ? baseUserPrompt
      : `${baseUserPrompt}\n\n${buildRetryFeedback(attemptFailures[attemptFailures.length - 1])}`;

    // A model-infrastructure failure (cancellation = operator intent, admission
    // collision, capacity, UNKNOWN uncertain teardown) throws out of
    // runJsonModelTask and is NOT retried — let it propagate immediately. Three
    // thrown classes ARE retried:
    //  - GATEWAY-level schema rejection (MODEL_OUTPUT_INVALID): the model
    //    produced output that failed the route's source-controlled schema one
    //    layer out from the in-process validator — the same variance class the
    //    retry loop exists for — retried with schema-reminder feedback (the raw
    //    invalid output is unavailable from the gateway, so there is no echo).
    //  - TRANSIENT process failure (MODEL_PROCESS_FAILED, outcome FAILED): a
    //    rate-limited/overloaded subprocess that exited nonzero. Retried after a
    //    bounded in-loop backoff so one provider blip does not kill the stage.
    //  - TIMED_OUT (Task 11k, any code): killed at the profile horizon before any
    //    output. claude -p buffers all stdout until completion, so a timeout says
    //    nothing about progress; retried after the same bounded backoff.
    let output: ChapterResearchResult;
    try {
      output = await runJsonModelTask<ChapterResearchResult>(execution, "researcher-chapter", systemPrompt, userPrompt);
    } catch (error) {
      const message = (error as Error).message;
      if (isGatewaySchemaRejection(message)) {
        attemptFailures.push({ kind: "gateway-schema" });
        continue;
      }
      if (isTransientProcessFailure(message)) {
        // Task 11af: fail FAST on a durable quota cap — retrying inside the
        // same exhausted window cannot succeed and hides the reset horizon.
        if (isUnretryableProviderMessage(message)) {
          attemptFailures.push({ kind: "quota-exhausted", message });
          break;
        }
        attemptFailures.push({ kind: "transient-process" });
        if (attempt < MAX_CHAPTER_RESEARCH_ATTEMPTS) await sleep(backoffMsForAttempt(attempt));
        continue;
      }
      // TIMED_OUT (Task 11k): same transient class as a process failure — the
      // attempt was killed at the profile horizon before any output. Retry after
      // the same bounded backoff with a timeout-specific note.
      if (isTimedOut(message)) {
        attemptFailures.push({ kind: "timed-out" });
        if (attempt < MAX_CHAPTER_RESEARCH_ATTEMPTS) await sleep(backoffMsForAttempt(attempt));
        continue;
      }
      throw error;
    }

    // R-046/R-052 — source grounding. With no span this is [] and everything
    // below collapses to the previous behaviour exactly.
    const grounding = collectSourceQuoteProblems(output, spanText);
    for (const problem of grounding) {
      itemFailures.set(problem.itemKey, (itemFailures.get(problem.itemKey) ?? 0) + 1);
    }

    // While attempts remain, an ungrounded item is FEEDBACK: it is named, and the
    // model gets to quote it properly. On the last attempt there is no further
    // chance to buy, so the item is DROPPED rather than admitted unquoted or
    // padded into existence (R-052). The drop record carries the real per-item
    // failure count.
    const lastAttempt = attempt === MAX_CHAPTER_RESEARCH_ATTEMPTS;
    let candidate = output;
    let dropped: DroppedSourceItem[] = [];
    if (grounding.length > 0 && lastAttempt) {
      const pruned = dropUngroundedItems(output, grounding, itemFailures);
      candidate = pruned.result;
      dropped = pruned.dropped;
    }

    const report = collectChapterResearchReport(candidate, input);
    const problems = [
      ...report.problems,
      ...(lastAttempt ? [] : grounding.map((problem) => problem.message)),
    ];
    if (problems.length === 0) return stampProvenance(candidate, provenance, input);

    // R-283 — TARGETED REPAIR. When the ONLY thing wrong is wording in a prose
    // field, one bounded call that receives the offending sentences verbatim is
    // both cheaper and likelier to converge than re-drafting a 20 KB sidecar:
    // the live 2026-09-04 Franklin run spent three full drafts per chapter and
    // still ended with one clause carrying "the book". The repair is merged onto
    // this draft (applyMetaRepair — ids, quotes and tokens cannot move) and then
    // re-validated by the SAME validator and the SAME grounding check, so it
    // cannot admit anything a fresh draft could not. If it does not come back
    // clean, the draft's ORIGINAL rejection stands and the attempt retries as
    // before: the repair can only ever save a chapter, never pass one.
    let repairRecord: RejectedChapterDraft["repair"] | undefined;
    if (isMetaRepairEligible(problems, report.offenses)) {
      let repaired: ChapterResearchResult | null = null;
      try {
        repaired = await runJsonModelTask<ChapterResearchResult>(
          execution,
          "researcher-chapter",
          systemPrompt,
          buildMetaRepairPrompt(input, report.offenses, candidate),
        );
      } catch (error) {
        const message = (error as Error).message;
        // A durable quota cap cannot clear inside this window — report the
        // provider's own words and stop, exactly as the draft call does.
        if (isTransientProcessFailure(message) && isUnretryableProviderMessage(message)) {
          // The loop ends here, so this is the LAST place the draft that
          // triggered the repair can be persisted. Do it before breaking out.
          recordRejection({
            chapterNumber: input.chapter.number,
            attempt,
            draft: output,
            problems,
            repair: { response: null, merged: false, problems: [message] },
          });
          attemptFailures.push({ kind: "quota-exhausted", message });
          break;
        }
        // Gateway-schema / transient / timeout / a non-object response: the
        // repair simply did not complete. It is NOT retried — one repair per
        // attempt is the whole budget — and it NEVER manufactures a pass: the
        // attempt falls through to the draft's own rejection below. A repair
        // that cannot be had must leave the chapter exactly where the draft
        // left it, never worse.
        const incomplete = isGatewaySchemaRejection(message)
          || isTransientProcessFailure(message)
          || isTimedOut(message)
          || message === MODEL_TASK_OUTPUT_INVALID;
        if (!incomplete) {
          // Real model infrastructure (cancellation, capacity, admission
          // collision, uncertain teardown). Propagate it as the ERROR it is
          // rather than reporting a content defect that was never proven.
          throw error;
        }
        repaired = null;
      }
      const merged = repaired === null ? null : applyMetaRepair(candidate, repaired, report.offenses);
      repairRecord = {
        response: repaired,
        merged: merged !== null,
        // A response that arrived and was still refused says WHY in the record —
        // "no repair was made" and "the repair was thrown away" are different
        // post-mortems, and round 2 is the finding that the run directory has to
        // be able to tell them apart.
        problems: repaired !== null && merged === null
          ? ["the repair response was refused by the merge: it was not a usable object, or its keyClaims added, dropped, duplicated or re-ordered a claim"]
          : [],
      };
      if (merged !== null) {
        const mergedProblems = [
          ...collectChapterResearchProblems(merged, input),
          ...collectSourceQuoteProblems(merged, spanText).map((problem) => problem.message),
        ];
        repairRecord = { response: repaired, merged: true, problems: mergedProblems };
        if (mergedProblems.length === 0) {
          const provenanceStamp: ChapterResearchMetaRepair = {
            attempt,
            offenses: report.offenses.map(({ rule, match, path, sentence }) => ({ rule, match, path, sentence })),
          };
          return stampProvenance({ ...merged, metaRepair: provenanceStamp }, provenance, input);
        }
      }
    }

    // The attempt is lost. Persist WHAT the model wrote and WHY it was refused
    // before the loop moves on — every path below this line either throws or
    // discards the draft, and a rejection nobody can read afterwards is how the
    // 2026-09-04 Franklin failure cost three live runs to understand.
    recordRejection({
      chapterNumber: input.chapter.number,
      attempt,
      draft: output,
      problems,
      ...(repairRecord === undefined ? {} : { repair: repairRecord }),
    });

    // R-052 — abstention, stated honestly. Every item that could not be quoted is
    // gone and the ONLY thing left wrong is a floor: that is a SOURCE problem, and
    // saying so beats the generic "invalid after 3 attempts" that used to send an
    // operator hunting for a schema bug. Scoped to floor-only failures on purpose
    // — a draft that also carries a meta-reference or a clause-shaped specific is
    // not a source-insufficiency case, and mislabelling it would be a new lie.
    const floorProblems = problems.filter((problem) => /_floor|keyClaims needs/.test(problem));
    if (lastAttempt && dropped.length > 0 && floorProblems.length === problems.length) {
      const detail = dropped.map((item) => `${item.kind} ${item.id} (${item.attempts} attempt(s))`).join(", ");
      throw new Error(
        `RESEARCH_SOURCE_INSUFFICIENT:chapter ${input.chapter.number} dropped ${dropped.length} item(s) that could not be quoted from its source span [${detail}], and what survived does not meet the research floor: ${problems.join("; ")}. The span does not honestly support this unit — re-map or split the chapter; do not pad it.`,
      );
    }

    attemptFailures.push({ kind: "validator", problems, output });
  }

  const accumulated = attemptFailures
    .map((failure, index) => `attempt ${index + 1}: ${describeFailure(failure)}`)
    .join(" | ");
  throw new Error(`chapter research invalid after ${MAX_CHAPTER_RESEARCH_ATTEMPTS} attempts: ${accumulated}`);
}

/**
 * R-046 — stamp the run's own provenance onto the sidecar. The MODEL never
 * supplies these fields: "the model said it read the book" is not evidence. A
 * run with no text is stamped `model-memory`, which is the honest label every
 * sidecar written before ingestion existed silently carried.
 */
function stampProvenance(
  result: ChapterResearchResult,
  provenance: SourceTextProvenanceLabel,
  input: ChapterResearchInput,
): ChapterResearchResult {
  const stamped: ChapterResearchResult = { ...result, sourceProvenance: provenance };
  if (provenance === "source-text" && typeof input.sourceTextSha256 === "string") {
    stamped.sourceTextSha256 = input.sourceTextSha256;
  }
  return stamped;
}

/**
 * True when a rejected model output carries NO repairable content: a bare `{}`,
 * a non-object (null / array / string), or an object in which every core field
 * is empty/blank (the finding-40 canary7 shape — the model returned `{}` on the
 * retry, and the all-empty "chapterflow-analysis-v1" canary before it). A
 * substantive-but-wrong draft (one real focus/claim/example, even if it trips
 * the meta guard) is repairable and NOT degenerate.
 *
 * Exported for direct classification tests. The retry loop uses it to decide the
 * retry framing: echoing a degenerate `{}` back as "your previous draft — repair
 * it" is worthless AND entrenching — it hands the model a skeleton to mimic with
 * nothing to build from, which is exactly why finding-40 went empty→empty (2/2)
 * across attempts 2 and 3 instead of recovering. When the prior output is
 * degenerate, the loop drops the echo and demands a COMPLETE object instead.
 */
export function isDegenerateChapterResearchOutput(output: unknown): boolean {
  if (!output || typeof output !== "object" || Array.isArray(output)) return true;
  const r = output as Record<string, unknown>;
  const nonEmptyString = (value: unknown): boolean => typeof value === "string" && value.trim().length > 0;
  const nonEmptyArray = (value: unknown): boolean => Array.isArray(value) && value.length > 0;
  for (const key of ["chapterTitle", "focus", "coreClaim", "hardEdge", "paraphraseNotes"]) {
    if (nonEmptyString(r[key])) return false;
  }
  for (const key of ["keyClaims", "namedExamples", "voiceCues", "testableFacts"]) {
    if (nonEmptyArray(r[key])) return false;
  }
  if (r.centralConcept && typeof r.centralConcept === "object" && !Array.isArray(r.centralConcept)) {
    const concept = r.centralConcept as Record<string, unknown>;
    for (const key of ["name", "plainDefinition", "whyItMatters"]) {
      if (nonEmptyString(concept[key])) return false;
    }
  }
  return true;
}

/** Build the retry block appended to the user prompt after a failed attempt.
 *  For a validator/gateway rejection it names the exact errors (and, for a
 *  repairable in-process rejection, echoes the prior output as REFERENCE) so the
 *  model repairs precisely what failed. Two finding-40 (canary7) hardenings:
 *   1. The block LEADS with a task restatement, not the accusation. The prior
 *      accusatory "fix exactly these" + newly-enumerated banned-form list
 *      measurably raised the model's degenerate-empty rate on the retry (live
 *      A/B: the old short meta note produced substantive retries, the enumerated
 *      list went empty). Leading with the task and framing the prior draft as
 *      reference lowers that pressure while keeping the banned list intact.
 *   2. A DEGENERATE prior output (bare `{}` / all-empty) is NOT echoed — the
 *      echo is worthless and entrenches the emptiness; instead the block states
 *      the prior attempt was almost-empty and demands a complete object.
 *  For a transient process failure / timeout there is nothing wrong with the
 *  model's content and no output to echo — the note simply asks for a correct
 *  result. */
function buildRetryFeedback(failure: AttemptFailure): string {
  const lines: string[] = [];
  if (failure.kind === "transient-process" || failure.kind === "timed-out") {
    // Both are non-completions with no output to echo: nothing was wrong with the
    // model's content, so the note names the cause (transient error vs timeout)
    // and simply asks for a correct result this time.
    const cause = failure.kind === "timed-out"
      ? "it timed out before any output was produced"
      : "a transient model process error occurred before any output was produced";
    lines.push(`PREVIOUS ATTEMPT DID NOT COMPLETE — ${cause}. Nothing was wrong with your content; simply produce a correct result this time.`);
    lines.push("");
  } else {
    // Task-first lead: restate the goal before the correction list so the retry
    // reads as "keep going, refine" rather than an accusation that pushes the
    // model toward a degenerate empty response.
    lines.push("Continue the SAME task: produce ONE complete ChapterResearchResult JSON object. Keep everything that was already correct and change ONLY the items listed below.");
    lines.push("");
    lines.push("PREVIOUS ATTEMPT WAS REJECTED — fix exactly these:");
    for (const problem of failureProblems(failure)) lines.push(`- ${problem}`);
    lines.push("");
    if (failure.kind === "validator") {
      if (isDegenerateChapterResearchOutput(failure.output)) {
        // Degenerate prior output: echoing an empty/skeleton object back is
        // worthless and entrenches the emptiness (finding-40: 2/2 empty across
        // retries). Demand a complete object instead of handing back the void.
        lines.push("Your previous attempt returned an almost-empty object with the required fields missing or blank. Do NOT return an empty or skeleton object — populate EVERY required field with substantive, specific content this time.");
      } else {
        // Repairable draft: echo it as REFERENCE to fix, not an accusation.
        lines.push("For reference, here is your previous attempt — repair it, do not restart from scratch, and do not reproduce the problems listed above:");
        lines.push(safeJson(failure.output));
      }
    } else {
      // Gateway-level schema rejection: the raw invalid output stays inside the
      // gateway and is not available to echo back. Do not fabricate one.
      lines.push("Your previous output was rejected by the output-schema gate before it reached this process, so it cannot be echoed back here.");
    }
    lines.push("");
  }
  lines.push('Return a corrected ChapterResearchResult JSON. Output MUST be a single JSON object whose schemaVersion is exactly "source-v2". Never invent a different schemaVersion.');
  return lines.join("\n");
}

function safeJson(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

/**
 * The source-text route's standalone-facts contract, rendered for one book.
 *
 * Exported so the wording is pinned by test rather than only by a live run, and
 * kept beside {@link authorVerbContractLines} because it is the same discipline:
 * a per-book contract belongs in the message that knows the book, not in the one
 * system prompt every book shares.
 */
export function standaloneFactContractLines(author: string): string[] {
  const named = author.trim().length > 0 ? author.trim() : "the person the book is about";
  return [
    `# Every fact is about ${named} and the world, never about the text`,
    `The passage above is EVIDENCE, not the subject. A \`sourceQuote\` proves a fact about the world; it is not a licence to describe the passage. Whoever reads your notes has never seen this book and never will.`,
    ``,
    `Rejected: "The book opens with a letter to <person>, and the author explains why he is setting down <what>."`,
    `Accepted: "${named} set down <what> for <person> in <year>, at <place>."`,
    ``,
    `Strip the narration from the rejected line and nothing is left: it reports the passage's table of contents, and no reader can check it against anything. The accepted line names an actor, a time and a place, so it can be checked by someone holding no book — and the quote you copied into \`sourceQuote\` is what proves it.`,
    ``,
    `When the passage's OWN subject is the act of writing — a preface, a dedication, a letter, a note on sources — that is still a world fact: say who wrote what, to whom, where and when. It is never a reason to fall back on "this chapter", "the chapter", "this book", "the book", "the memoir", "the author", "in his writing", or a chapter number. Each of those is rejected and costs this chapter an attempt.`,
  ];
}

/** The chapter researcher's user prompt. Exported so the contract it states —
 *  the source block, the quoting rules, the taken-framings digest and the fact
 *  pins — is pinned by test rather than only by a live run. */
export function buildUserPrompt(input: ChapterResearchInput): string {
  const parts: string[] = [];
  parts.push(`# Book context`);
  parts.push(`Title: ${input.bibliography.title}`);
  parts.push(`Author: ${input.bibliography.author}`);
  parts.push(`Thesis: ${input.bibliography.thesis}`);
  parts.push(`Teaching arc: ${input.bibliography.teachingArc}`);
  parts.push("");
  parts.push(`# Chapter to research`);
  parts.push(`Chapter ${input.chapter.number}: ${input.chapter.title}`);
  parts.push("");
  if (input.priorChapterTitles && input.priorChapterTitles.length > 0) {
    parts.push(`# Prior chapter titles in this book (for context, not for content leakage)`);
    for (const t of input.priorChapterTitles) parts.push(`- ${t}`);
    parts.push("");
  }
  // R-057 — what earlier chapters of THIS book already claimed. Research was
  // per-chapter and context-free, so every chapter re-minted the same organizing
  // template and the only remedies (SP14, SC8) fired after every chapter had
  // been paid for. A few hundred tokens buys the researcher the one thing it
  // needs to differ: knowing what is already taken.
  if (input.priorChapterDigests && input.priorChapterDigests.length > 0) {
    parts.push(`# Already researched in this book — these framings and cases are TAKEN`);
    parts.push(`Choose different organizing moves and different cases. If this chapter genuinely must revisit one of them, say why in \`focus\`.`);
    for (const prior of input.priorChapterDigests) {
      parts.push(`- Ch${prior.chapterNumber} "${prior.title}": ${prior.focus}`);
      if (prior.caseLabels.length > 0) parts.push(`  cases already used: ${prior.caseLabels.join("; ")}`);
    }
    parts.push("");
  }
  // R-277 — fact pins reached the section writers and the repair port but never
  // the researcher that mints the error, so a pinned correction was applied one
  // layer downstream of where the fact was decided and the rev-6 sidecars still
  // carried every pinned error. Correct the sidecar at birth.
  if (input.factPins && input.factPins.length > 0) {
    parts.push(`# Corrections already established for this book — treat as authoritative`);
    parts.push(`These were written from verified defects in an earlier run of this book. Obey them. If this chapter's source text CONTRADICTS one of them, quote the contradicting passage in the relevant \`sourceQuote\` and follow the text — the source is the authority and the pin is then a defect to report, not a rule to obey.`);
    for (const pin of input.factPins) parts.push(`- ${pin}`);
    parts.push("");
  }
  // Rule 9, stated for THIS book from the list the validator actually enforces
  // (review round 3). The system prompt states the rule's REASON and defers here
  // for the verbs, because the set depends on the genre and only this message
  // knows it.
  for (const line of authorVerbContractLines(input.bibliography)) parts.push(line);
  parts.push("");
  if (input.sourceSpan) {
    const excerpt = spanExcerptForPrompt(input.sourceSpan.text);
    const floors = researchFloorsForSpan(input.sourceSpan.text.length);
    parts.push(`# THIS CHAPTER'S SOURCE TEXT`);
    parts.push(
      excerpt.excerpted
        ? `The passages below are this chapter's own text, sampled across the whole chapter (${excerpt.omittedChars} characters are elided and marked as such). They are the book itself, not notes about it.`
        : `The passage below is this chapter's own text, complete. It is the book itself, not notes about it.`,
    );
    parts.push("");
    parts.push(renderUntrustedSourceBlock(`Source text — chapter ${input.chapter.number}`, excerpt.text));
    parts.push("");
    parts.push(`## Quoting rules for this call`);
    parts.push(`- Every \`testableFacts[]\` entry, every \`namedExamples[]\` entry, every \`hardSpecificEvidence[]\` entry and every \`quotations[]\` entry MUST carry a \`sourceQuote\`: 20-240 characters copied EXACTLY from the passage above, including its spelling, capitalization and punctuation.`);
    parts.push(`- The quote is checked character by character against the text. A remembered paraphrase will be rejected. If you cannot find the words, the claim is not in this chapter — leave the item out.`);
    parts.push(`- Every \`hardSpecifics\` token must itself appear in the passage, exactly as you write it.`);
    parts.push(`- Prose fields (focus, coreClaim, keyClaims, summary, paraphraseNotes, hardEdge) stay in YOUR OWN WORDS. The verbatim source belongs only in \`sourceQuote\`, \`hardSpecifics\` and \`quotations[].quote\`.`);
    parts.push(`- This chapter covers ${input.sourceSpan.text.length} characters of the book, so it needs at least ${floors.testableFacts} testable facts, ${floors.namedExamples} named examples and ${floors.keyClaims} key claims — drawn from across the WHOLE passage, not just its opening.`);
    parts.push("");
    // R-283 — the standalone-facts contract, stated ONLY on the source-text
    // route because that is the route that breaks it. Shown the chapter's own
    // bytes and asked for verbatim quotes, the model narrates the bytes: the
    // first live run of the finished pipeline (Franklin, 2026-09-04) lost all
    // four dispatched chapters to the meta guard on attempt 1, and two of them
    // outright. The system prompt states the RULE for every book; this block
    // states, for THIS book, what to write instead — which is the half the
    // model was missing. It names the author (the only legal replacement for
    // "the author" in an autobiography) and leaves every other slot in angle
    // brackets, so one book's cast cannot install itself as the house default
    // in the next book's prompt.
    for (const line of standaloneFactContractLines(input.bibliography.author)) parts.push(line);
    parts.push("");
  }
  parts.push(
    input.sourceSpan
      ? `Return the ChapterResearchResult JSON. Be specific: named examples, real numbers, concrete claims — all of them quoted from the source text above. Paraphrase in the prose fields; quote in \`sourceQuote\`. No meta-references.`
      : `Return the ChapterResearchResult JSON. Be specific: named examples, real numbers, concrete claims. Paraphrase only — no verbatim text from the book. No meta-references.`,
  );
  return parts.join("\n");
}

/**
 * Everything wrong with a rejected chapter-research output: the problem lines
 * the retry loop feeds back to the model, PLUS the located lexical offenses
 * (R-283) the bounded repair needs.
 *
 * Each offense contributes EXACTLY ONE problem line, so
 * `problems.length === offenses.length` is a sound test for "the only thing wrong
 * here is wording" — the gate the repair opens on. The test is a COUNT and is
 * therefore order-independent: it does not matter where in `problems` the lexical
 * lines sit, and a later check appended after them (the chapterTitle block below
 * already sits there) would be caught by the count alone.
 */
export type ChapterResearchReport = {
  readonly problems: string[];
  readonly offenses: readonly LexicalOffense[];
};

/** Gather every validator + content-guard + source-v2-integrity problem with a
 *  rejected chapter-research output. Returns [] when the output is admissible.
 *  Kept separate from the throwing wrapper so the retry loop can feed the exact
 *  error lines back to the model. */
export function collectChapterResearchProblems(r: ChapterResearchResult, input: ChapterResearchInput): string[] {
  return collectChapterResearchReport(r, input).problems;
}

export function collectChapterResearchReport(r: ChapterResearchResult, input: ChapterResearchInput): ChapterResearchReport {
  const problems: string[] = [];
  if (!r || typeof r !== "object") return { problems: ["chapter researcher returned a non-object output"], offenses: [] };

  if (r.chapterNumber !== input.chapter.number) {
    problems.push(`chapterNumber mismatch: got ${r.chapterNumber}, expected ${input.chapter.number}`);
  }

  // Length floors
  if (typeof r.focus !== "string" || r.focus.length < 50) {
    problems.push(`focus too short (${r.focus?.length ?? 0} chars) — write 1-2 specific sentences`);
  }
  if (typeof r.coreClaim !== "string" || r.coreClaim.length < 30) {
    problems.push(`coreClaim too short — write 1 specific sentence`);
  }
  if (!r.centralConcept || typeof r.centralConcept !== "object") {
    problems.push("centralConcept missing");
  } else {
    if (typeof r.centralConcept.name !== "string" || !r.centralConcept.name.trim()) {
      problems.push("centralConcept.name missing");
    }
    if (typeof r.centralConcept.plainDefinition !== "string" || r.centralConcept.plainDefinition.length < 40) {
      problems.push("centralConcept.plainDefinition too short");
    }
    if (typeof r.centralConcept.whyItMatters !== "string" || r.centralConcept.whyItMatters.length < 30) {
      problems.push("centralConcept.whyItMatters too short");
    }
  }
  // R-058: with a source span, the floors are sized to the SPAN rather than to
  // the word "chapter". Without one they are today's floors exactly.
  const floors = researchFloorsForSpan(input.sourceSpan?.text.length ?? null);
  if (!Array.isArray(r.keyClaims) || r.keyClaims.length < floors.keyClaims) {
    problems.push(`keyClaims needs ${floors.keyClaims}-8 items (got ${r.keyClaims?.length ?? 0})`);
  }
  if (!Array.isArray(r.namedExamples) || r.namedExamples.length < 1) {
    problems.push(`namedExamples needs 1-5 items (got ${r.namedExamples?.length ?? 0})`);
  } else {
    for (const ex of r.namedExamples) {
      if (typeof ex.label !== "string" || !ex.label) problems.push("namedExamples item missing label");
      if (typeof ex.summary !== "string" || ex.summary.length < 30) problems.push(`namedExamples "${ex.label}" summary too short`);
      if (typeof ex.teachesWhat !== "string" || !ex.teachesWhat) problems.push(`namedExamples "${ex.label}" teachesWhat missing`);
    }
  }

  // Short-token policy: each hardSpecific must be a SHORT verbatim source token
  // (<=5 words), never a sentence or clause, so it can compose verbatim into the
  // word-budgeted downstream units (SEC14/16/33). Runs regardless of the floor
  // branch above; the retry loop feeds any violation back to the model.
  problems.push(...collectHardSpecificLengthProblems(r.namedExamples));
  // R-051/R-282: a five-word cap admits a five-word CLAUSE. Shape is checked in
  // the same place and shared with the durable-sidecar reuse hook.
  problems.push(...collectHardSpecificShapeProblems(r.namedExamples));
  if (typeof r.hardEdge !== "string" || r.hardEdge.length < 80) {
    problems.push(`hardEdge too short (${r.hardEdge?.length ?? 0}) — write 2-3 sentences about typical misreadings`);
  }
  if (!Array.isArray(r.voiceCues) || r.voiceCues.length < 2) {
    problems.push("voiceCues needs 2-4 items");
  }
  if (typeof r.paraphraseNotes !== "string" || r.paraphraseNotes.length < 600 || r.paraphraseNotes.length > 3000) {
    problems.push(`paraphraseNotes length ${r.paraphraseNotes?.length ?? 0} outside 600-3000 char range (target 200-400 words ≈ 1200-2400 chars)`);
  }

  const sourceV2 = evaluateSourceV2Integrity(r, {
    chapterNumber: input.chapter.number,
    chapterTitle: input.chapter.title,
    floors,
    ...(input.bibliography?.genre === undefined ? {} : { genre: input.bibliography.genre }),
    authorSurnames: authorSurnames(input.bibliography?.author ?? ""),
  });
  // Admission MUST mirror the port's route-blocking decision (requireSourceV2),
  // not a subset of it — otherwise a structurally-complete but fabricated
  // sidecar (SV2.realness_fabricated_sidecar, advisory severity) is admitted on
  // attempt 1 with zero retries and then hard-rejected by the port, aborting the
  // whole research stage. Sharing isResearchRouteBlockingFinding keeps them in lockstep.
  for (const finding of sourceV2.findings) {
    if (isResearchRouteBlockingFinding(finding)) problems.push(`${finding.checkId}: ${finding.message}`);
  }

  // Meta-reference / author-verb checks across every NARRATIVE field the sidecar
  // carries downstream. See narrativeSegments() for which fields are scanned and
  // why voiceCues are deliberately not.
  //
  // R-025: report EVERY distinct hit for this attempt. Reporting only the first
  // meant a sidecar carrying three meta-references needed three attempts — the
  // whole MAX_CHAPTER_RESEARCH_ATTEMPTS budget — and aborted the book instead.
  // R-283: each hit now carries its field path and its own sentence.
  const segments = narrativeSegments(r);
  const offenses = [
    ...collectOffenses(segments, META_REGEXES, "meta-reference"),
    ...collectOffenses(segments, authorVerbRegexes(input.bibliography), "author-verb"),
  ];
  for (const offense of offenses) problems.push(offenseProblem(offense, input.bibliography.author));

  // Title match (loose — capitalization-insensitive)
  if (typeof r.chapterTitle === "string" && input.chapter.title) {
    if (r.chapterTitle.toLowerCase() !== input.chapter.title.toLowerCase()) {
      // not a blocker; some agents normalize case, but warn
    }
  }

  return { problems, offenses };
}

/** Render a ChapterResearchResult to the plain-text sidecar shape that
 *  source-loader.ts reads. Mirrors the existing atomic-habits sidecar shape:
 *  focus line + bulleted claim list + paraphrase notes. Stripped of any
 *  meta-references by the validator above. */
export function renderChapterSidecar(r: ChapterResearchResult): string {
  const lines: string[] = [];
  lines.push(`Chapter ${r.chapterNumber} focus: ${r.focus}`);
  lines.push("");
  lines.push(`Core claim: ${r.coreClaim}`);
  lines.push("");
  lines.push(`Central concept (${r.centralConcept.name}):`);
  lines.push(`  ${r.centralConcept.plainDefinition}`);
  lines.push(`  Why it matters: ${r.centralConcept.whyItMatters}`);
  lines.push("");
  lines.push(`Key claims:`);
  for (const claim of r.keyClaims) lines.push(`- ${claim}`);
  lines.push("");
  lines.push(`Named examples:`);
  for (const ex of r.namedExamples) {
    lines.push(`- ${ex.label}: ${ex.summary} (teaches: ${ex.teachesWhat})`);
    // R-034: hardSpecifics are the checkable tokens (a name, number, place) the
    // section gates require verbatim. They were dropped here, so the .txt the
    // loader returns — and the BP6 pattern audit compares chapters against —
    // could not detect drift on any of them.
    const specifics = (ex.hardSpecifics ?? []).map((sp) => String(sp ?? "").trim()).filter(Boolean);
    if (specifics.length > 0) lines.push(`  Hard specifics: ${specifics.join("; ")}`);
  }
  lines.push("");
  lines.push(`Hard edge / typical misreading:`);
  lines.push(`  ${r.hardEdge}`);
  lines.push("");
  lines.push(`Voice cues observed in this chapter:`);
  for (const cue of r.voiceCues) lines.push(`- ${cue}`);
  if (r.forbiddenLeakage && r.forbiddenLeakage.length > 0) {
    lines.push("");
    lines.push(`Forbidden leakage (concepts that belong to later chapters):`);
    for (const c of r.forbiddenLeakage) lines.push(`- ${c}`);
  }
  if (r.frameworks && r.frameworks.length > 0) {
    lines.push("");
    lines.push(`Named frameworks:`);
    for (const fw of r.frameworks) lines.push(`- ${fw.name}: ${(fw.members ?? []).join(", ")}`);
  }
  // R-034: testableFacts are what the source packet compiles the writers' facts
  // (and the whole quiz) from. Omitting them from the .txt meant a chapter could
  // contradict every keyed fact and still "align" with its source notes.
  if (r.testableFacts && r.testableFacts.length > 0) {
    lines.push("");
    lines.push(`Testable facts:`);
    for (const fact of r.testableFacts) {
      lines.push(`- ${fact.claim}`);
      if (fact.becauseMechanism) lines.push(`  Because: ${fact.becauseMechanism}`);
      if (fact.commonError) lines.push(`  Common error: ${fact.commonError}`);
      if (fact.errorIsWhy) lines.push(`  Why that is wrong: ${fact.errorIsWhy}`);
    }
  }
  lines.push("");
  lines.push(`Paraphrase notes:`);
  lines.push(r.paraphraseNotes);
  return lines.join("\n");
}
