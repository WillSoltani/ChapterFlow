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

import { renderUntrustedSourceBlock, runJsonModelTask, type ModelCallerExecution } from "../app/modelTaskRunner.js";
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

/** Every distinct match of `patterns` in `text`, in first-seen order, deduped
 *  case-insensitively and capped at {@link MAX_REPORTED_META_HITS}. */
function distinctMatches(text: string, patterns: readonly RegExp[]): string[] {
  const seen = new Set<string>();
  const hits: string[] = [];
  for (const pattern of patterns) {
    const global = pattern.global ? pattern : new RegExp(pattern.source, `${pattern.flags}g`);
    global.lastIndex = 0;
    for (const match of text.matchAll(global)) {
      const key = match[0].toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      hits.push(match[0]);
      if (hits.length >= MAX_REPORTED_META_HITS) return hits;
    }
  }
  return hits;
}

/**
 * The retry card for a meta-reference hit.
 *
 * Two things this must not do, both learned from a live Franklin run that died
 * here 3/3 on `"the author"`:
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
 */
function metaReferenceProblem(match: string, author: string): string {
  const named = author.trim();
  const remedy = named.length > 0
    ? `Name the person or thing instead — for this book, write "${named}" rather than "the author".`
    : "Name the person or thing instead of referring to the text.";
  return `meta-reference "${match}" found. A sidecar states standalone facts about the world, never facts about a text: drop "this chapter", "the chapter", "this book", "the book", "the author", and chapter/section numbers. ${remedy} Rewrite the sentence so it would read correctly to someone who has never seen the book.`;
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

/** Injectable dependencies for {@link runResearcherChapter}. The `sleep` hook
 *  is faked to resolve instantly in tests so the backoff schedule is asserted
 *  deterministically without a real wall-clock wait. Production uses setTimeout. */
export interface ChapterResearchRetryOptions {
  readonly sleep?: (ms: number) => Promise<void>;
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

export async function runResearcherChapter(
  input: ChapterResearchInput,
  execution?: ModelCallerExecution,
  options?: ChapterResearchRetryOptions,
): Promise<ChapterResearchResult> {
  const systemPrompt = readFileSync(resolve(PROMPTS_DIR, "researcher-chapter.system.md"), "utf8");
  const baseUserPrompt = buildUserPrompt(input);
  const sleep = options?.sleep ?? defaultSleep;
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

    const problems = [
      ...collectChapterResearchProblems(candidate, input),
      ...(lastAttempt ? [] : grounding.map((problem) => problem.message)),
    ];
    if (problems.length === 0) return stampProvenance(candidate, provenance, input);

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
  }
  parts.push(
    input.sourceSpan
      ? `Return the ChapterResearchResult JSON. Be specific: named examples, real numbers, concrete claims — all of them quoted from the source text above. Paraphrase in the prose fields; quote in \`sourceQuote\`. No meta-references.`
      : `Return the ChapterResearchResult JSON. Be specific: named examples, real numbers, concrete claims. Paraphrase only — no verbatim text from the book. No meta-references.`,
  );
  return parts.join("\n");
}

/** Gather every validator + content-guard + source-v2-integrity problem with a
 *  rejected chapter-research output. Returns [] when the output is admissible.
 *  Kept separate from the throwing wrapper so the retry loop can feed the exact
 *  error lines back to the model. */
export function collectChapterResearchProblems(r: ChapterResearchResult, input: ChapterResearchInput): string[] {
  const problems: string[] = [];
  if (!r || typeof r !== "object") return ["chapter researcher returned a non-object output"];

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

  // Meta-reference checks across every NARRATIVE field the sidecar carries
  // downstream. R-024: testableFacts, example labels/hardSpecifics and the
  // concept name were all absent from this list, and testableFacts is the field
  // the source packet compiles the writers' facts from — the released Franklin
  // book shipped `"Franklin dies in 1790 with the Penn estate tax negotiation
  // still unresolved in his writing"`, a statement about the manuscript rather
  // than the world, straight through this guard. voiceCues stay OUT on purpose:
  // a voice cue legitimately describes authorial technique ("opens each chapter
  // with an anecdote"), so scanning it would reject correct output.
  const allText = [
    r.focus,
    r.coreClaim,
    r.centralConcept?.name ?? "",
    r.centralConcept?.plainDefinition ?? "",
    r.centralConcept?.whyItMatters ?? "",
    ...(r.keyClaims ?? []),
    ...(r.namedExamples ?? []).flatMap((ex) => [
      ex?.label,
      ex?.summary,
      ex?.teachesWhat,
      ...(Array.isArray(ex?.hardSpecifics) ? ex.hardSpecifics : []),
    ]),
    ...(r.testableFacts ?? []).flatMap((f) => [f?.claim, f?.becauseMechanism, f?.commonError, f?.errorIsWhy]),
    r.hardEdge,
    r.paraphraseNotes,
  ].filter((value): value is string => typeof value === "string").join(" \n ");

  // R-025: report EVERY distinct hit for this attempt. Reporting only the first
  // meant a sidecar carrying three meta-references needed three attempts — the
  // whole MAX_CHAPTER_RESEARCH_ATTEMPTS budget — and aborted the book instead.
  for (const hit of distinctMatches(allText, META_REGEXES)) {
    problems.push(metaReferenceProblem(hit, input.bibliography.author));
  }
  for (const hit of distinctMatches(allText, authorVerbRegexes(input.bibliography))) {
    problems.push(`author-surname-verb construction "${hit}" found — state the claim directly`);
  }

  // Title match (loose — capitalization-insensitive)
  if (typeof r.chapterTitle === "string" && input.chapter.title) {
    if (r.chapterTitle.toLowerCase() !== input.chapter.title.toLowerCase()) {
      // not a blocker; some agents normalize case, but warn
    }
  }

  return problems;
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
