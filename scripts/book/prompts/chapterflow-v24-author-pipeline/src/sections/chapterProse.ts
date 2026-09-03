import type { SummaryPackV1 } from "../artifacts/artifactTypes.js";

/**
 * Task 11ai — THIS chapter's own reader-visible prose, shared by the learning-pack
 * WRITER card (sectionTasks.buildSectionTaskMarkdown) and the SEC120 derivability
 * GATE (sectionGate.learningProseDerivabilityFindings) so the two can never drift.
 *
 * Finding 45: the four section packs are drafted INDEPENDENTLY from one source
 * packet, so the learning writer sees every allowed fact/anchor rather than the
 * SUBSET the summary writer actually put on the page. The blind 3-seat reader panel
 * failed every canary chapter on that one class — quiz stems and review cards naming
 * "Dr. Thomas Bond", "1751", "Temperance" that appear nowhere in the Fast/Deep/Full
 * read. The compile order is summary → example → learning → action, so by the time
 * the learning pack is drafted this prose EXISTS: it can be shown to the writer and
 * checked by the gate.
 *
 * The prose is the reader-visible summary-pack surface only: hook (+ its
 * counterintuition, which the reader also sees), all three read tiers, and the
 * keyTakeaway. Examples/actions are deliberately excluded — a quiz must be derivable
 * from what the READER READS as the chapter, not from a fictional scene.
 */
export type ChapterProseSource = Readonly<{
  hook?: unknown;
  breakdown?: unknown;
  keyTakeaway?: unknown;
}>;

export type ChapterProseFields = Readonly<{
  hook: string;
  counterintuition: string;
  fastRead: string;
  deepRead: string;
  fullRead: string;
  keyTakeaway: string;
}>;

function str(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

/** The drafted prose fields, each "" when unavailable. Tolerates a partially-drafted
 *  or loosely-typed summary pack (the compiler holds it as raw model output). */
export function chapterProseFields(source: ChapterProseSource | SummaryPackV1 | null | undefined): ChapterProseFields {
  const hook = record((source as ChapterProseSource | null | undefined)?.hook);
  const breakdown = record((source as ChapterProseSource | null | undefined)?.breakdown);
  return Object.freeze({
    hook: str(hook.hook),
    counterintuition: str(hook.counterintuition),
    fastRead: str(breakdown.fastRead),
    deepRead: str(breakdown.deepRead),
    fullRead: str(breakdown.fullRead),
    keyTakeaway: str((source as ChapterProseSource | null | undefined)?.keyTakeaway),
  });
}

/** Every drafted passage joined into one haystack; "" when nothing was drafted (the
 *  signal every consumer treats as "no prose available" and no-ops on). */
export function chapterProseText(source: ChapterProseSource | SummaryPackV1 | null | undefined): string {
  const fields = chapterProseFields(source);
  return [fields.hook, fields.counterintuition, fields.fastRead, fields.deepRead, fields.fullRead, fields.keyTakeaway]
    .filter((passage) => passage.length > 0)
    .join("\n");
}

/** Task 11ak: the STANDALONE haystack — everything a reader has seen by the end
 *  of the Deep read, i.e. the full prose MINUS fullRead.
 *
 *  The tiers are a progressive-depth promise: a reader who stops after Deep has
 *  finished a coherent chapter. The blind panel enforces that promise and has
 *  now blocked two separate rounds on the same shape — "Fast read and Deep read
 *  never mention Governor William Keith ... that material exists only in Full
 *  read, yet Examples 5 and 6, Quiz Q4 and Q6, and Review Cards 2, 6 and 7 all
 *  turn on it." Derivability for the TESTED units (quiz, cards) is therefore
 *  measured against what the Deep-read reader was actually shown.
 *
 *  Note the ordering this relies on: summary drafts before learning, so the
 *  constraint lands on the writer that can satisfy it. The reverse rule — asking
 *  the summary writer to anticipate what the quiz will later test — is not
 *  enforceable, which is why an earlier scar phrased that way did not hold. */
export function standaloneProseText(source: ChapterProseSource | SummaryPackV1 | null | undefined): string {
  const fields = chapterProseFields(source);
  return [fields.hook, fields.counterintuition, fields.fastRead, fields.deepRead, fields.keyTakeaway]
    .filter((passage) => passage.length > 0)
    .join("\n");
}

/** True once the chapter's reader-visible BODY exists — all three read tiers drafted.
 *  A pack carrying only a hook (a stub, or a draft that would fail its own gate; the
 *  reporting CLI reads whatever is on disk) is not the chapter a reader sees, and
 *  every derivability consumer treats it as "no prose available". */
export function hasDraftedReadTiers(source: ChapterProseSource | SummaryPackV1 | null | undefined): boolean {
  const fields = chapterProseFields(source);
  return fields.fastRead.length > 0 && fields.deepRead.length > 0 && fields.fullRead.length > 0;
}

/** Case/punctuation-insensitive normalisation, so "Dr. Thomas Bond" matches
 *  "Dr Thomas Bond" (or a curly-quoted / hyphenated variant). Note it maps EVERY
 *  non-alphanumeric to a space, which splits "$1,800" into "1 800" — use
 *  normalizeDerivabilityText, not this, whenever numbers are compared. */
export function normalizeProseText(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

/** Digit-group separators carry no meaning for derivability — "$1,800", "1 800"
 *  (thin/non-breaking space) and "1'800" are all the figure 1800, and the reader saw
 *  the figure. Collapsed BEFORE normalisation so the separator does not survive as a
 *  word break. Only separators BETWEEN digit groups are touched; "3.141" and a
 *  possessive apostrophe after a letter are left alone. */
export function collapseDigitGroupSeparators(value: string): string {
  return value.replace(/(\d)[,\u2009\u202f\u00a0'\u2019](?=\d{3}(?!\d))/g, "$1");
}

/** Standalone number WORDS folded to digits — "thirteen virtues" and
 *  "13 virtues" are the same fact. Applied AFTER lowercasing/punct-stripping so
 *  the map only needs lowercase bare words; hyphenated compounds ("twenty-one")
 *  arrive as separate tokens ("twenty one" → "20 1"), which is imperfect but
 *  SYMMETRIC, and symmetry is all a comparison normalisation needs. Added on the
 *  Franklin canary: SEC56 (and the book's own FACT PIN scar) force
 *  "thirteen virtues" verbatim into quiz units while the independently-drafted
 *  summary prose may render "13 virtues" — without this fold the two verbatim
 *  requirements are UNSATISFIABLE TOGETHER and the learning pack blocks on
 *  every draft (SEC120's message asks for the very wording SEC56 rejects). */
const NUMBER_WORDS: ReadonlyMap<string, string> = new Map(Object.entries({
  zero: "0", one: "1", two: "2", three: "3", four: "4", five: "5", six: "6",
  seven: "7", eight: "8", nine: "9", ten: "10", eleven: "11", twelve: "12",
  thirteen: "13", fourteen: "14", fifteen: "15", sixteen: "16", seventeen: "17",
  eighteen: "18", nineteen: "19", twenty: "20", thirty: "30", forty: "40",
  fifty: "50", sixty: "60", seventy: "70", eighty: "80", ninety: "90",
}));

function foldNumberWords(normalized: string): string {
  return normalized.split(" ").map((w) => NUMBER_WORDS.get(w) ?? w).join(" ");
}

/** The ONE normalisation applied to BOTH sides of every SEC120 comparison — case,
 *  punctuation, digit-group separators, and number words — so a difference in
 *  formatting can never be read as a difference in fact. */
export function normalizeDerivabilityText(value: string): string {
  return foldNumberWords(normalizeProseText(collapseDigitGroupSeparators(value)));
}

/**
 * Per-passage ceilings for the WRITER's card only (never for the gate haystack, which
 * always sees the whole chapter). SEC6.breakdown_length enforces tier FLOORS and the
 * aim bands are prompt guidance, so nothing stops a model from returning a runaway
 * fullRead; without a clamp one overshooting chapter would silently blow the pinned
 * task-card length bound. Each cap sits well above the top of its contract aim band
 * (fastRead 600 / deepRead 1600 / fullRead 3400 — sectionTasks.universalCore), so
 * conformant prose is never touched and only pathological output is trimmed.
 */
export const CHAPTER_PROSE_CARD_CAPS = Object.freeze({
  hook: 500,
  counterintuition: 500,
  fastRead: 900,
  deepRead: 2200,
  // Task 11ak: fullRead is CONTEXT ONLY on the learning card — SEC120 measures
  // derivability against the standalone tiers, so the writer needs it to stay
  // consistent with the chapter, not to mine detail from it. Trimmed 4400 ->
  // 3400, the top of fullRead's own aim band: a conformant chapter still renders
  // whole (the clamp must never touch in-band prose), only genuine overruns cut.
  fullRead: 3400,
  keyTakeaway: 300,
} as const satisfies Record<keyof ChapterProseFields, number>);

/** The most chapter text the card can ever carry (the caps summed) — the constant the
 *  prompt-length pin is measured against. */
export const CHAPTER_PROSE_CARD_BUDGET: number = Object.values(CHAPTER_PROSE_CARD_CAPS).reduce((total, cap) => total + cap, 0);

/** Clamp one passage to its cap at a word boundary, saying so when it trims — the
 *  writer must know the tail exists rather than assume the prose ended there. */
export function clampProsePassage(value: string, cap: number): string {
  if (value.length <= cap) return value;
  const head = value.slice(0, cap);
  const cut = head.lastIndexOf(" ");
  return `${(cut > cap * 0.5 ? head.slice(0, cut) : head).trimEnd()} […prose truncated]`;
}

// ---------------------------------------------------------------------------
// SPECIFIC-PRESENCE FOLDING. Moved here from sectionGate so the SHIP-time grounding
// critic (critics/sourceGrounding.ts, SC11.7) can measure "the chapter's prose shows
// this specific" with exactly the same tolerance the write-time gate applies
// (SEC14/SEC120/SEC128). A ship check that folds LESS than the write check blocks
// what compile passed, which is the write/ship disagreement class this codebase has
// already been burned by twice.
// ---------------------------------------------------------------------------

/** Qualified-name folding (Franklin pincer, round 2 of the class the number-word
 *  folding above fixed): source sidecars carry formal names ("Library Company of
 *  Philadelphia") while the readability ceilings push prose toward the natural
 *  short form ("the Library Company"), and SEC56/SEC58 force the formal specific
 *  verbatim into the unit. A reader who has seen BOTH the head name and the
 *  qualifier on this chapter's page can derive the qualified form, so a specific
 *  "X of/in/at Y" is derivable when the prose shows X and Y independently. Both
 *  halves must clear the same ≥3-char floor exact inclusion uses, and a missing
 *  half still blocks — "First Bank of England" stays underivable when the prose
 *  never says England. Applied ONLY on the prose side (SEC120), never to the
 *  unit-side must-include checks (SEC56/SEC58). Operates on normalized text. */
const QUALIFIED_NAME_PREPOSITION_RE = /\s(?:of|in|at)\s/g;
export function qualifiedNameDerivable(normalized: string, haystack: string): boolean {
  for (const match of normalized.matchAll(QUALIFIED_NAME_PREPOSITION_RE)) {
    const head = normalized.slice(0, match.index).trim();
    const tail = normalized.slice(match.index + match[0].length).trim();
    if (head.length >= 3 && tail.length >= 3 && haystack.includes(head) && haystack.includes(tail)) return true;
  }
  return false;
}

/** Clipped-phrase folding (Franklin pincer, round 3 of this class): sidecar
 *  hardSpecifics are telegraphic research notes ("slipped under door",
 *  "compared to original") while the naturalize-into-sentences scar rule makes
 *  the prose write them out ("slipped his essays under the printing-house
 *  door"), and SEC58 forces the clipped form verbatim into the unit. A reader
 *  who saw every word of the clipped phrase, in order, within one local span
 *  can derive it — so a multi-word specific is derivable when its tokens appear
 *  in the haystack IN ORDER with at most SUBSEQUENCE_GAP_TOKENS interleaved
 *  words between consecutive tokens. The gap bound keeps the match inside
 *  roughly one sentence: "slipped" and "door" pages apart stay underivable.
 *  Prose-side (SEC120) only, like the two foldings above. */
const SUBSEQUENCE_GAP_TOKENS = 8;
export function clippedPhraseDerivable(normalized: string, haystack: string): boolean {
  const needle = normalized.split(/\s+/).filter((token) => token.length > 0);
  if (needle.length < 2) return false;
  const words = haystack.split(/\s+/);
  // Try the in-order match anchored at every occurrence of the first token —
  // an early island ("slipped" in an unrelated sentence) must not mask a real
  // match later in the prose.
  for (let start = 0; start < words.length; start += 1) {
    if (words[start] !== needle[0]) continue;
    let position = start + 1;
    let matched = true;
    for (let index = 1; index < needle.length; index += 1) {
      const limit = Math.min(words.length, position + SUBSEQUENCE_GAP_TOKENS + 1);
      let found = -1;
      for (let cursor = position; cursor < limit; cursor += 1) {
        if (words[cursor] === needle[index]) { found = cursor; break; }
      }
      if (found === -1) { matched = false; break; }
      position = found + 1;
    }
    if (matched) return true;
  }
  return false;
}


/** How many of an anchor's hardSpecifics the supplied (already normalized) prose
 *  shows, under the three foldings above. One helper, both gates. */
export function countSpecificsInProse(specifics: readonly unknown[], normalizedProse: string): number {
  let present = 0;
  for (const specific of specifics) {
    const value = typeof specific === "string" ? specific : "";
    const normalized = normalizeDerivabilityText(value);
    if (normalized.length < 3) continue;
    if (normalizedProse.includes(normalized)
      || qualifiedNameDerivable(normalized, normalizedProse)
      || clippedPhraseDerivable(normalized, normalizedProse)) present += 1;
  }
  return present;
}
