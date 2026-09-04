import { isPageCitationOnly } from "../critics/apparatusLeakage.js";
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
    // CF-J Task 4, applied to the chapter-level rule: a hardSpecific that IS a page
    // citation ("Ch. 6 p. 138") is the source guide's internal locator coordinate, and
    // the writer projection WITHHOLDS it (sourcePacketProjection strips citation spans).
    // An internal coordinate can never be REQUIRED reader-visible text, so it counts as
    // satisfied by construction — the same rule SC11.2 has applied since that
    // investigation. Without it a sidecar whose specifics are all citations makes
    // SEC14/SEC128/SC11.7 unsatisfiable by construction.
    if (isPageCitationOnly(value)) { present += 1; continue; }
    // ONE predicate (specificDerivable), so this count and SEC120's own reject can
    // never answer "is it on the page?" differently.
    if (specificDerivable(value, normalizedProse)) present += 1;
  }
  return present;
}

/** The ONE predicate every SEC120 comparison and every writer-facing list runs a
 *  packet specific through: is this string on the chapter's page? `normalizedProse`
 *  must already be normalizeDerivabilityText'd. A specific shorter than the 3-char
 *  floor is never "on the page" — the gate skips it, so nothing may claim it is.
 *  Extracted so the GATE (sectionGate.learningProseDerivabilityFindings) and the
 *  WRITER CARD (sectionTasks) can never answer this question differently. */
export function specificDerivable(specific: string, normalizedProse: string): boolean {
  const normalized = normalizeDerivabilityText(specific);
  if (normalized.length < 3) return false;
  return normalizedProse.includes(normalized)
    || qualifiedNameDerivable(normalized, normalizedProse)
    || clippedPhraseDerivable(normalized, normalizedProse);
}

/** A 4-digit NUMBER in 1500-2099 — the band where a figure is most likely to be a
 *  year a reader must reason about (old-style dating, a founding date, a study year).
 *  The band is the whole rule, not a semantic test: a quantity that happens to land
 *  inside it ("1,800 dollars", "2,000 steps") is checked exactly like a year, which is
 *  correct — the requirement is only that the FIGURE appears on the page, and
 *  digit-group separators are collapsed on both sides so formatting never decides it.
 *  Below 1500 and above 2099 the check stays silent by design (a bare "1200
 *  employees" is out of band), so it under-fires rather than over-fires.
 *  Digit boundaries, not \b: "1751" inside "1751st" is the same number, while "1751"
 *  inside "11751" is not — and the same regex form is used on both sides.
 *
 *  MOVED here from sectionGate (Task 11ao): the writer card now lists the year-band
 *  figures the prose cannot support, and a second copy of this band in a second file
 *  is exactly the drift this module exists to prevent. */
const PROSE_YEAR_RE = /(?<!\d)(?:1[5-9]\d{2}|20\d{2})(?!\d)/g;

/** Every year-band figure in an ALREADY-NORMALIZED string, in order of appearance. */
export function proseYearBandFigures(normalized: string): string[] {
  return normalized.match(PROSE_YEAR_RE) ?? [];
}

/** Whether a year-band figure appears in an already-normalized haystack, on the same
 *  digit boundaries the extractor used. */
export function yearOnThePage(year: string, normalizedProse: string): boolean {
  return new RegExp(`(?<!\\d)${year}(?!\\d)`).test(normalizedProse);
}

// ---------------------------------------------------------------------------
// TASK 11ao — THE COMPUTED DERIVABILITY SPLIT (writer-facing).
//
// The live Franklin canary failed ch01's learning pack three attempts running on
// the same three strings ("Peter Folger", "Sherburne town", "1555"). The card
// already showed the drafted prose and already stated the derivable-from-the-prose
// rule; what it never did was SAY WHICH of the packet's own specifics the prose
// fails to support. Worse, a separate block (sectionTasks' quiz-specifics preflight)
// listed "Peter Folger" | "1675" | "Sherburne town" to the writer as the strings q2
// must carry VERBATIM — so the card compelled two of the three strings SEC120 then
// rejected, and the retry card repeated the compulsion beside the rejection.
//
// This computes the split deterministically, at task-build time, from the SAME
// predicate the gate uses, so the "do not use" list and the blocker can never
// disagree. It mirrors SEC120's two rules exactly, INCLUDING the Task 11an
// stand-down carve: when NONE of an anchor's specifics reached the page the gate
// stands down (SEC58 compels one and the pair would otherwise be unsatisfiable), so
// those specifics are listed as forbidden by nothing here either.
// ---------------------------------------------------------------------------

/** One classified string plus the packet member it came from (the writer needs to
 *  know WHICH case it may not name, not just that some string is off-limits). */
export type ProseSpecific = Readonly<{ value: string; source: string }>;

export type ProseDerivability = Readonly<{
  /** False when the gate itself would no-op (no prose, or no drafted read tiers).
   *  Every renderer treats it as "say nothing", so the card stays byte-identical. */
  available: boolean;
  /** The normalized haystack, so a caller can re-use `specificDerivable` without
   *  rebuilding it (and can never build a DIFFERENT one). */
  normalizedProse: string;
  /** GATE-BACKED. Packet specifics the prose DOES support — anchor hardSpecifics and
   *  year-band figures a unit may carry, because SEC120 measures exactly these. */
  derivable: readonly ProseSpecific[];
  /** GATE-BACKED. The same two classes where the prose does NOT support them: every
   *  string here is one SEC120 rejects outright. */
  notDerivable: readonly ProseSpecific[];
  /** ADVISORY, never gate-backed. Names a cited case carries that the chapter's prose
   *  never prints. SEC120 does not sweep proper nouns (deliberately — see its header),
   *  so these are listed under their own, weaker claim: a reader cannot derive a name
   *  the page never shows, even though no validator will say so. */
  unprintedNames: readonly ProseSpecific[];
  /** Anchor/case ids where the prose shows NONE of the specifics: SEC120 stands
   *  down (Task 11an), so those strings are neither allowed nor forbidden here. */
  standDownIds: ReadonlySet<string>;
}>;

/** How many entries EACH rendered list may carry, and the longest single entry.
 *  The card's length is pinned in absolute characters (tests/contract-refactor.test.ts),
 *  so an unbounded list would make that pin a hope. Over-long "specifics" are
 *  telegraphic research notes; they are DROPPED rather than truncated, because a
 *  truncated string is one a writer might paste. */
export const DERIVABILITY_LIST_MAX_ENTRIES = 24;
export const DERIVABILITY_ENTRY_MAX_CHARS = 90;
/** Per-entry scaffold: the bullet, the quotes, the " (source)" tail and the newline.
 *  The source label is an anchor/case id, which comes from a model-authored sidecar and
 *  is therefore unbounded at the type level — it is clipped to DERIVABILITY_SOURCE_MAX_CHARS
 *  so this scaffold is a real bound and not an assumption about researcher output. */
const DERIVABILITY_SOURCE_MAX_CHARS = 48;
const DERIVABILITY_ENTRY_SCAFFOLD = DERIVABILITY_SOURCE_MAX_CHARS + 16;
/** The most the three computed lists can ever add to the learning card — the constant
 *  the prompt-length pins are measured against, exactly like CHAPTER_PROSE_CARD_BUDGET. */
export const DERIVABILITY_LIST_BUDGET: number =
  3 * DERIVABILITY_LIST_MAX_ENTRIES * (DERIVABILITY_ENTRY_MAX_CHARS + DERIVABILITY_ENTRY_SCAFFOLD);

/** The packet shape this reads. Structural, so a test fixture need not build a whole
 *  SourcePacketV1 to exercise the split. */
export type DerivabilityPacket = Readonly<{
  allowedAnchors?: readonly Readonly<{ id?: unknown; hardSpecifics?: readonly unknown[] }>[];
  namedCases?: readonly Readonly<{ id?: unknown; label?: unknown; summary?: unknown; hardSpecifics?: readonly unknown[] }>[];
  allowedEntities?: readonly unknown[];
}>;

const EMPTY_DERIVABILITY: ProseDerivability = Object.freeze({
  available: false,
  normalizedProse: "",
  derivable: Object.freeze([]),
  notDerivable: Object.freeze([]),
  unprintedNames: Object.freeze([]),
  standDownIds: new Set<string>(),
});

/** Whole-token containment over already-normalized text: "there" must not match
 *  inside "gathered". Both sides are space-normalized, so padding is enough. */
function containsToken(haystack: string, needle: string): boolean {
  return ` ${haystack} `.includes(` ${needle} `);
}

function specificStrings(values: readonly unknown[] | undefined): string[] {
  return (values ?? []).map((value) => (typeof value === "string" ? value.trim() : "")).filter((value) => value.length > 0);
}

/**
 * Split the packet's own specifics into what THIS chapter's standalone prose can and
 * cannot support. Rules, one-for-one with SEC120:
 *
 *  1. ANCHOR SPECIFICS — every `allowedAnchors[].hardSpecifics[]`, measured with
 *     `specificDerivable`. An anchor with NO specific on the page is recorded in
 *     `standDownIds` and contributes to neither list (SEC120 stands down for it).
 *  2. YEAR-BAND FIGURES — every 1500-2099 figure anywhere in the packet, measured on
 *     the same digit boundaries. SEC120's year rule is UNCONDITIONAL (no stand-down),
 *     so an off-page year here is exactly what the gate will reject.
 *  3. NAMED-CASE ENTITIES (`unprintedNames`, ADVISORY) — the packet's own
 *     `allowedEntities` a cited case actually uses, kept ONLY when the prose never
 *     prints them. SEC120 does not sweep proper nouns, so these are rendered under a
 *     weaker claim and never as a gate prediction; mixing them into `notDerivable`
 *     would put a false "the validator rejects this" over a string it never checks.
 *     Cases in `standDownIds` are skipped, so the advice never contradicts SEC58.
 *
 * Returns `available: false` — every list empty — wherever SEC120 itself no-ops, so a
 * card built without drafted prose renders exactly what it rendered before.
 */
export function packetProseDerivability(
  packet: DerivabilityPacket | null | undefined,
  prose: ChapterProseSource | SummaryPackV1 | null | undefined,
): ProseDerivability {
  if (!packet) return EMPTY_DERIVABILITY;
  const normalizedProse = normalizeDerivabilityText(standaloneProseText(prose));
  if (normalizedProse.length === 0 || !hasDraftedReadTiers(prose)) return EMPTY_DERIVABILITY;

  const derivable: ProseSpecific[] = [];
  const notDerivable: ProseSpecific[] = [];
  const unprintedNames: ProseSpecific[] = [];
  const standDownIds = new Set<string>();
  const seen = new Set<string>();
  const add = (list: ProseSpecific[], value: string, source: string): void => {
    const key = normalizeDerivabilityText(value);
    if (key.length < 3 || seen.has(key)) return;
    seen.add(key);
    list.push(Object.freeze({ value, source }));
  };

  // 1. anchor hardSpecifics — SEC120 rule 1, stand-down carve and all.
  for (const anchor of packet.allowedAnchors ?? []) {
    const id = typeof anchor.id === "string" ? anchor.id : "";
    const specifics = specificStrings(anchor.hardSpecifics);
    if (specifics.length === 0) continue;
    const onPage = specifics.filter((value) => specificDerivable(value, normalizedProse));
    if (onPage.length === 0) { if (id) standDownIds.add(id); continue; }
    for (const value of specifics) add(onPage.includes(value) ? derivable : notDerivable, value, id || "source packet");
  }

  // 2. year-band figures anywhere in the packet — SEC120 rule 2, unconditional.
  for (const year of proseYearBandFigures(normalizeDerivabilityText(JSON.stringify(packet)))) {
    add(yearOnThePage(year, normalizedProse) ? derivable : notDerivable, year, "year-band figure");
  }

  // 3. ADVISORY — names a cited case carries that the page never prints. Whole-token
  //    matching (never substring), and a case's own catalogue LABEL is excluded: it is
  //    the researcher's index entry, not a name the chapter could print.
  const caseLabels = new Set((packet.namedCases ?? [])
    .map((namedCase) => normalizeDerivabilityText(typeof namedCase.label === "string" ? namedCase.label : ""))
    .filter((label) => label.length > 0));
  const entities = specificStrings(packet.allowedEntities);
  for (const namedCase of packet.namedCases ?? []) {
    const id = typeof namedCase.id === "string" ? namedCase.id : "";
    if (id && standDownIds.has(id)) continue;
    const caseSpecifics = specificStrings(namedCase.hardSpecifics);
    if (caseSpecifics.length > 0 && !caseSpecifics.some((value) => specificDerivable(value, normalizedProse))) {
      if (id) standDownIds.add(id);
      continue;
    }
    const caseText = normalizeDerivabilityText([namedCase.label, namedCase.summary].map((v) => (typeof v === "string" ? v : "")).join(" "));
    for (const entity of entities) {
      const normalized = normalizeDerivabilityText(entity);
      if (normalized.length < 3 || caseLabels.has(normalized) || !containsToken(caseText, normalized)) continue;
      // Only the ABSENT names are worth the card's space: a name the prose prints is
      // already visible in the prose block above, and SEC120 never checks names anyway.
      if (specificDerivable(entity, normalizedProse)) continue;
      add(unprintedNames, entity, id || "named case");
    }
  }

  return Object.freeze({
    available: true,
    normalizedProse,
    derivable: Object.freeze(derivable),
    notDerivable: Object.freeze(notDerivable),
    unprintedNames: Object.freeze(unprintedNames),
    standDownIds,
  });
}

/** Render one classified list as bullets, bounded by the two constants above. Entries
 *  past the cap are counted, never silently dropped: the rule applies to them too. */
export function renderProseSpecificList(entries: readonly ProseSpecific[]): string {
  const usable = entries.filter((entry) => entry.value.length <= DERIVABILITY_ENTRY_MAX_CHARS);
  const shown = usable.slice(0, DERIVABILITY_LIST_MAX_ENTRIES);
  const omitted = entries.length - shown.length;
  const lines = shown.map((entry) => `  • "${entry.value}" (${entry.source.slice(0, DERIVABILITY_SOURCE_MAX_CHARS)})`);
  if (omitted > 0) lines.push(`  • …and ${omitted} more; the same rule applies to every one of them.`);
  return lines.join("\n");
}
