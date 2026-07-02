/**
 * readerBudgets — five deterministic reader-correlated checks (v24 B3).
 *
 * Panel readers rejected regenerated chapters for defects none of the existing
 * gates measure: hammering one source anchor's name a dozen times in a chapter,
 * ~40% length inflation, the same invented first names recurring across
 * chapters, scenario openers that share a frame, and practice/challenge lines
 * that share a format. This module makes all five DETERMINISTIC (no LLM) so a
 * conductor can wire them as a standalone check, presence-gated to the author
 * arch. It is NOT wired into any existing gate; nothing here changes
 * compiler/legacy behavior.
 *
 * Checks:
 *   CHB1.anchor_repetition  — a named case's distinctive token repeated more
 *                             than repCap (default 6) times in the chapter's
 *                             linear reading surface. BLOCKER when the case
 *                             labels come from source packets; ADVISORY when
 *                             they are derived from example titles (see tuning
 *                             decision #3).
 *   CHB2.length_budget      — estimated rendered chars outside budget*(1±tol)
 *                             (default 16000 ± 20%). Blocker.
 *   CHB3.cast_disjoint      — the same invented-person first name cast in the
 *                             examples of more than one chapter. Blocker.
 *   CHB4.opener_signature   — two chapters whose first-example scenarios share
 *                             >= 6 of their first 8 content tokens. Blocker.
 *   CHB5.practice_format    — an identical practice/challenge format signature
 *                             in more than 2 chapters. Blocker.
 *
 * ── ZERO-FP CALIBRATION (2026-07-02, the standing rule for new blockers) ──
 * Ran against 17 shipped packages spanning quality (170+ chapters; repo-root
 * book-packages/*.v21.json): atomic-habits, make-time, good-to-great,
 * deep-work, the-compound-effect, the-power-of-moments, the-effective-executive,
 * the-slight-edge, dopamine-nation, the-molecule-of-more, emotional-intelligence,
 * fooled-by-randomness, eat-that-frog, tiny-habits, blink, drive,
 * the-intelligent-investor. The packet path (the one the v24 conductor wires)
 * was calibrated with REAL compiled source packets for the-power-of-moments and
 * the-intelligent-investor; every other book exercised the title-fallback path.
 *
 * Final table (BLOCKER findings per check at default thresholds; CHB1a =
 * advisory CHB1 findings from the title-fallback path; [TP] marks firings that
 * were VERIFIED true positives by reading the flagged text — the zero-FP rule
 * is a zero-FALSE-positive rule, and these books shipped before the
 * variety/name-plan fixes):
 *
 *   book                          CHB1  CHB1a  CHB2*    CHB3    CHB4  CHB5
 *   atomic-habits                   0     0    20[TP]   4[TP]   0      0
 *   make-time                       0     0     0       0       0      0
 *   good-to-great                   0     0     0       0       0      0
 *   deep-work                       0     3     9[TP]   0       0     18[TP]
 *   the-compound-effect             0     1     0       0       0      0
 *   the-power-of-moments (pkts)     0     0     0       0       0      0
 *   the-effective-executive         0     1     0       0       0      0
 *   the-slight-edge                 0     2     0       0       0      0
 *   dopamine-nation                 0     1     0       0       0      0
 *   the-molecule-of-more            0     0     0       0       0      0
 *   emotional-intelligence          0     0     0       0       0      0
 *   fooled-by-randomness            0     1     0       0       0      0
 *   eat-that-frog                   0     7     0       0       0      0
 *   tiny-habits                     0     0     8[TP]   0       0      0
 *   blink                           0     0     0       0       0      0
 *   drive                           0     0     0       0       0      0
 *   the-intelligent-investor (pkts) 0     0     4[TP]   0       0      0
 *
 * Verified true positives (quoted at verification time):
 *   - atomic-habits CHB3: "Ines" is a different invented character in ch01
 *     (index-fund argument with Davit) and ch06 (bedroom fight with Bram);
 *     "Desmond" likewise ch04 (rehearsal walk-through) vs ch16 (reading
 *     chart) — exactly the cross-chapter first-name reuse the variety scout
 *     punished. Pre-name-plan book.
 *   - deep-work CHB5: every chapter's twentyFourHourChallenge is the IDENTICAL
 *     sentence ("Within the next day, choose one demanding task that has been
 *     getting leftover attention…") and every weeklyPractice is the identical
 *     "Each Friday, mark the hours…" — 9-chapter format stamping.
 *   - CHB2 [TP]: atomic-habits (~22k) / tiny-habits (~23k) / deep-work (up to
 *     ~19.6k) / the-intelligent-investor (up to ~20.6k) chapters genuinely
 *     exceed the 16000±20% default window — pre-budget books really are up to
 *     ~40% longer, which is the exact defect CHB2 prices. Under the CHB2
 *     calibration exception (shipped books DEFINE the budget), each book
 *     checked against its own median estimated-rendered chars passes by
 *     construction for 16 of 17 books; the-intelligent-investor still shows 3
 *     findings against its own median because its real intra-book spread
 *     (13.4k–20.6k) exceeds ±20% — a true length-inconsistency in the newest
 *     v23-produced book, kept as signal.
 *
 * CHB2 derived k (see PROSE_TO_RENDERED_K): median rendered/prose ratio 0.9408
 * over 158 shipped chapters (p05 0.8531, p95 0.9708, min 0.8378, max 0.9742).
 * Spread of book median estimated-rendered chars: ~14.8k (good-to-great) to
 * ~23k (tiny-habits); 13 of 17 books fit the default window entirely.
 *
 * Tuning decisions made during calibration (each was a live FP source):
 *   1. CHB1 counts the token over the chapter's LINEAR READING SURFACE
 *      (counterintuition, tryThisNow, keyTakeaway, breakdown.*), not every
 *      string field: at all-string-fields scope, 53 of 211 sampled shipped
 *      cases exceeded the cap (max 51 mentions — "craving" in atomic-habits
 *      ch08) because a case dealt to two examples plus quiz/cards/plan
 *      legitimately re-names its subject once per surface. Wide-and-shallow
 *      spread reads fine; what irritated panel readers is hammering inside the
 *      continuous prose the reader actually reads linearly. The hook is also
 *      excluded: an anchor named once in the hook is the chapter's framing
 *      device ("…it needed one denominator that told the truth"), not
 *      repetition.
 *   2. CHB1 candidacy is DOCUMENT-FREQUENCY-rare, not just "non-common": a
 *      candidate must appear in at most max(2, ceil(chapterCount/4)) chapters'
 *      full prose. A book-thematic word ("signing" appears across
 *      the-power-of-moments because Senior Signing Day is the book's marquee
 *      case) cannot carry a per-chapter cap; a case-distinctive token
 *      ("popsicle", "deere", "blakely") can. Also excluded: tokens < 5 chars,
 *      COMMON_LABEL_TOKENS (the SEC119 lesson — person names that are common
 *      English words, Grant/Chase/Brooks class, count unrelated verb uses),
 *      tokens of the chapter's own title (chapter concept vocabulary), and
 *      tokens whose capitalized form is in the invented-name bank (a
 *      protagonist re-named across her own example is CHB3's business, not
 *      CHB1's). For PACKET labels the token must additionally appear
 *      CAPITALIZED in the label (part of the case's name): concept-cases like
 *      "Bond interest coverage" (the-intelligent-investor ch11 — "coverage"
 *      is the ratio the chapter TEACHES, 8 legitimate reading-surface
 *      mentions) carry no capitalized >= 5-char token and are skipped, while
 *      "Popsicle Hotline" / "Emerson Electric" / "Kahneman cold-water study"
 *      keep their anchor tokens.
 *   3. CHB1 fallback labels (no packets → example titles) are ADVISORY, not
 *      blocker: measured on 16 shipped books, title-derived tokens are the
 *      chapter's concept vocabulary ("reward", "priority", "abstinence",
 *      "constraint"), which legitimately repeats 7–16x in good chapters —
 *      16 of 1052 sampled cases still fired after every candidacy tune,
 *      including on the owner's #1-scored book (the-compound-effect). Titles
 *      cannot be made a zero-FP blocker proxy for source anchors; packets can
 *      (0 firings across 32 packet-calibrated chapters, max reading-surface
 *      count 5 vs cap 6). The v24 conductor wires the packet path.
 *   4. CHB3 candidates are restricted to the config/name-bank.json first-name
 *      pool (the pool the pipeline actually deals invented cast from — the
 *      same filter catalogAudit uses). Raw extractNamesFromText output
 *      contains venues/brands/source figures ("York" from New York) which
 *      recur across chapters legitimately.
 *   5. CHB3 excludes protected real-source names: packet namedCases label
 *      person tokens + protectedSourceNames() + GLOBAL_RESERVED names. Without
 *      packets, a first name that also appears in the same chapter's
 *      breakdown prose is treated as a source figure, not dealt cast (invented
 *      cast exists only inside the example pack by design; deep-work's older
 *      house style names real study subjects in both surfaces).
 *   6. CHB4/CHB5 signatures drop pure function words BEFORE comparison;
 *      openers on the 17 shipped books share at most 3 of 8 stemmed tokens
 *      (threshold 6); practice signatures repeat at most twice on
 *      post-variety-fix books (threshold >2). deep-work's 18 CHB5 firings are
 *      verbatim-identical stamped text (see above), kept as true positives.
 */

import type { ChapterV21 } from "../types.js";
import type { SourcePacketV1 } from "../artifacts/artifactTypes.js";
import { extractNamesFromText } from "../librarian/libraryState.js";
import { loadNameBank } from "../librarian/namePlan.js";
import { GLOBAL_RESERVED_SOURCE_FIGURE_NAMES, protectedSourceNames } from "../compiler/sourceNames.js";

export type BudgetFinding = {
  checkId: string;
  severity: "blocker" | "advisory";
  chapterNumber: number;
  message: string;
};

export type ReaderBudgetOptions = {
  /** Source packets by chapter number. When present, CHB1 uses namedCases and
   *  CHB3 gains the packet-derived protected-source-name exclusions. */
  packets?: Map<number, SourcePacketV1>;
  /** CHB2 budget in RENDERED chars (default { renderedChars: 16000, tolerance: 0.2 }). */
  lengthBudget?: { renderedChars: number; tolerance: number };
  /** CHB1 per-chapter mention cap for a case's distinctive token (default 6). */
  repCap?: number;
};

export const DEFAULT_REP_CAP = 6;
export const DEFAULT_LENGTH_BUDGET = { renderedChars: 16000, tolerance: 0.2 } as const;

/** CHB2 calibration constant: renderedChars ≈ k * proseChars.
 *
 *  proseChars = every string field of the chapter, recursive walk, `authoring`
 *  subtree excluded (authoring is pipeline provenance, never rendered, and its
 *  size varies by pipeline version — including it would make the estimate
 *  depend on provenance bulk instead of reader content). renderedChars proxy =
 *  reader-visible fields only (hook/counterintuition/tryThisNow/keyTakeaway/
 *  title/breakdown/examples[title,scenario,whatToDo,whyItMatters,tags]/quiz
 *  [prompt,choices,explanation]/reviewCards[front,back]/implementationPlan/
 *  memorableLines[text]/experiencePlan).
 *
 *  MEASUREMENT (2026-07-02, 158 chapters across 14 shipped repo-root
 *  book-packages/*.v21.json — atomic-habits, make-time, good-to-great,
 *  deep-work, the-compound-effect, the-power-of-moments,
 *  the-effective-executive, the-slight-edge, dopamine-nation,
 *  the-molecule-of-more, emotional-intelligence, fooled-by-randomness,
 *  eat-that-frog, tiny-habits):
 *    rendered/prose ratio: median 0.9408, p05 0.8531, p95 0.9708,
 *    min 0.8378, max 0.9742.
 *  k is the median. Worst-case estimate error vs the proxy is ~±12%, well
 *  inside the default ±20% tolerance band. */
export const PROSE_TO_RENDERED_K = 0.9408;

// ── shared text utilities ────────────────────────────────────────────────────

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Collect every string field of a value, recursively. Numbers/booleans are
 *  skipped by construction (only strings are pushed); keys in skipKeys are
 *  pruned subtree-wide. */
function collectStrings(value: unknown, out: string[], skipKeys: ReadonlySet<string>): void {
  if (typeof value === "string") {
    out.push(value);
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectStrings(item, out, skipKeys);
    return;
  }
  if (value && typeof value === "object") {
    for (const [key, item] of Object.entries(value)) {
      if (skipKeys.has(key)) continue;
      collectStrings(item, out, skipKeys);
    }
  }
}

const PROSE_SKIP_KEYS: ReadonlySet<string> = new Set(["authoring"]);

/** Full chapter prose: every string field (recursive), `authoring` excluded. */
export function chapterProse(chapter: ChapterV21): string {
  const out: string[] = [];
  collectStrings(chapter, out, PROSE_SKIP_KEYS);
  return out.join(" \n ");
}

/** Total length of every string field in the chapter (see chapterProse). */
export function chapterProseChars(chapter: ChapterV21): number {
  const out: string[] = [];
  collectStrings(chapter, out, PROSE_SKIP_KEYS);
  return out.reduce((sum, text) => sum + text.length, 0);
}

/** Naive stemmer used by CHB4/CHB5 signatures: strip -ing / -ed / plural -s. */
export function naiveStem(token: string): string {
  if (token.length > 5 && token.endsWith("ing")) return token.slice(0, -3);
  if (token.length > 4 && token.endsWith("ed")) return token.slice(0, -2);
  if (token.length > 3 && token.endsWith("s") && !token.endsWith("ss")) return token.slice(0, -1);
  return token;
}

/** Lowercase word tokens (letters only). */
function wordTokens(text: string): string[] {
  return (text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").match(/[a-z]+/g) ?? []);
}

/** Pure function/filler words — dropped from CHB4 opener signatures and from
 *  CHB5 salient-noun selection, and skipped when locating CHB5's verb. */
const FUNCTION_WORDS: ReadonlySet<string> = new Set([
  "a", "an", "the", "and", "or", "but", "nor", "so", "yet", "if", "then", "than", "as", "of", "to",
  "in", "on", "at", "by", "for", "from", "with", "without", "into", "onto", "over", "under", "up",
  "down", "out", "off", "about", "after", "before", "between", "through", "during", "while", "once",
  "again", "still", "just", "only", "not", "no", "is", "are", "was", "were", "be", "been", "being",
  "am", "do", "does", "did", "done", "have", "has", "had", "will", "would", "can", "could", "should",
  "shall", "may", "might", "must", "it", "its", "he", "she", "his", "her", "him", "they", "them",
  "their", "theirs", "you", "your", "yours", "we", "us", "our", "ours", "i", "me", "my", "mine",
  "who", "whom", "whose", "which", "what", "when", "where", "why", "how", "that", "this", "these",
  "those", "there", "here", "one", "two", "three", "each", "every", "some", "any", "all", "both",
  "few", "more", "most", "other", "another", "such", "own", "same", "too", "very", "also", "now",
  "today", "tomorrow", "yesterday", "week", "day", "hour", "minute", "morning", "evening",
]);

// ── CHB1: anchor repetition ──────────────────────────────────────────────────

/** Label tokens NEVER eligible as a case's distinctive token. Lowercase; only
 *  tokens >= 5 chars matter (shorter ones are already length-filtered). Two
 *  families: (a) generic English/business words that show up in case labels
 *  and count unrelated uses; (b) the SEC119 lesson — person names that are
 *  also common English words (Grant/Chase/Brooks class), which count verb/noun
 *  uses ("grant access", "chase the metric") instead of case mentions. */
const COMMON_LABEL_TOKENS: ReadonlySet<string> = new Set([
  // (a) generic label vocabulary
  "about", "above", "after", "again", "against", "before", "begin", "beginning", "behind", "being",
  "better", "between", "board", "building", "business", "change", "changes", "check", "checking",
  "choice", "choices", "class", "company", "could", "customer", "customers", "daily", "decision",
  "decisions", "design", "doing", "double", "during", "early", "effect", "effort", "email", "every",
  "experiment", "field", "first", "focus", "getting", "great", "group", "habit", "habits", "hidden",
  "hours", "improvement", "inside", "leader", "leaders", "learning", "lesson", "lessons", "level",
  "little", "manager", "meeting", "meetings", "member", "method", "minute", "minutes", "moment",
  "moments", "money", "month", "months", "morning", "night", "number", "numbers", "office", "other",
  "people", "performance", "person", "phone", "point", "power", "practice", "pressure", "principle",
  "problem", "problems", "process", "product", "project", "quality", "question", "questions", "quiet",
  "report", "response", "result", "results", "review", "right", "rule", "rules", "school", "second",
  "session", "shift", "should", "simple", "small", "start", "starting", "story", "study", "studies",
  "system", "systems", "table", "team", "teams", "test", "their", "there", "these", "thing", "things",
  "think", "thinking", "third", "thought", "three", "time", "times", "today", "under", "until",
  "value", "wanted", "watch", "water", "weekly", "where", "which", "while", "whole", "without",
  "words", "work", "working", "world", "would", "wrong", "years", "young",
  // (b) SEC119-class person-name/common-word collisions
  "baker", "banks", "bishop", "brook", "brooks", "carter", "chase", "chance", "cooper", "daisy",
  "frank", "grace", "grant", "hazel", "house", "hunter", "mason", "north", "olive", "paige", "pearl",
  "penny", "piper", "reed", "river", "robin", "sunny", "stone", "summer", "victor", "west", "white",
]);

/** Choose the distinctive token of a case label (calibration decision #2):
 *  tokens >= 5 chars; not a common English word; not the chapter's own title
 *  vocabulary; not an invented-name-bank / reserved first name; and rare
 *  across the book — document frequency over the chapters' full prose at most
 *  max(2, ceil(chapterCount/4)). Among survivors prefer the LOWEST document
 *  frequency, tie-broken by longer token, then alphabetical. Returns null when
 *  the label has no eligible token (the FP-safe outcome — the case is
 *  skipped). */
export function distinctiveLabelToken(
  label: string,
  chapterProses: string[],
  excludeTokens: ReadonlySet<string> = new Set(),
  opts: { requireCapitalizedInLabel?: boolean } = {},
): string | null {
  const bank = inventedNameBank();
  const seen = new Set<string>();
  const candidates: string[] = [];
  for (const token of wordTokens(label)) {
    if (token.length < 5) continue;
    if (COMMON_LABEL_TOKENS.has(token) || FUNCTION_WORDS.has(token)) continue;
    if (excludeTokens.has(token)) continue;
    const capitalized = token[0].toUpperCase() + token.slice(1);
    if (bank.has(capitalized) || (GLOBAL_RESERVED_SOURCE_FIGURE_NAMES as readonly string[]).includes(capitalized)) continue;
    // Calibration decision #2b (packet path): the distinctive token must be
    // part of the case's NAME — i.e. appear capitalized inside the label.
    // Curated packet labels case proper nouns ("Popsicle Hotline", "Emerson
    // Electric"); concept-cases ("Bond interest coverage", "Municipal bonds")
    // carry no capitalized token >= 5 chars and are skipped, because their
    // vocabulary is what the chapter TEACHES and legitimately repeats.
    if (opts.requireCapitalizedInLabel && !new RegExp(`(?:^|[^A-Za-z])${capitalized[0]}${escapeRegex(token.slice(1))}(?![a-z])`).test(label)) continue;
    if (seen.has(token)) continue;
    seen.add(token);
    candidates.push(token);
  }
  if (candidates.length === 0) return null;
  const dfCap = Math.max(2, Math.ceil(chapterProses.length / 4));
  const df = new Map<string, number>();
  for (const token of candidates) {
    const re = new RegExp(`\\b${escapeRegex(token)}\\b`, "i");
    df.set(token, chapterProses.reduce((n, prose) => n + (re.test(prose) ? 1 : 0), 0));
  }
  const rare = candidates.filter((token) => df.get(token)! <= dfCap);
  if (rare.length === 0) return null;
  rare.sort((a, b) =>
    (df.get(a)! - df.get(b)!) || (b.length - a.length) || (a < b ? -1 : a > b ? 1 : 0));
  return rare[0];
}

/** Occurrences of a token in prose (word-boundary, case-insensitive, plural
 *  and possessive forms included). */
export function countTokenMentions(token: string, prose: string): number {
  const re = new RegExp(`\\b${escapeRegex(token)}(?:'s|s)?\\b`, "gi");
  return (prose.match(re) ?? []).length;
}

/** The chapter's linear reading surface — the continuous prose a reader reads
 *  top-to-bottom (calibration decision #1). The hook is deliberately excluded
 *  (a single framing mention is by design); examples/quiz/cards/plan are
 *  excluded because a case dealt to those surfaces legitimately re-names its
 *  subject once per surface. */
export function chapterReadingSurface(chapter: ChapterV21): string {
  return [
    chapter.counterintuition ?? "",
    chapter.tryThisNow ?? "",
    chapter.keyTakeaway ?? "",
    chapter.breakdown?.fastRead ?? "",
    chapter.breakdown?.deepRead ?? "",
    chapter.breakdown?.fullRead ?? "",
  ].join(" \n ");
}

function checkAnchorRepetition(
  chapters: ChapterV21[],
  lowerProses: string[],
  packets: Map<number, SourcePacketV1> | undefined,
  repCap: number,
): BudgetFinding[] {
  const findings: BudgetFinding[] = [];
  chapters.forEach((chapter, idx) => {
    const packet = packets?.get(chapter.number);
    // Calibration decision #3: packet namedCases labels are real source
    // anchors → blocker; title-derived labels are the chapter's own concept
    // vocabulary → advisory only.
    const severity: BudgetFinding["severity"] = packet ? "blocker" : "advisory";
    const labels = packet
      ? packet.namedCases.map((c) => c.label)
      : (chapter.examples ?? []).map((ex) => ex.title ?? "").filter(Boolean);
    const titleTokens = new Set(wordTokens(chapter.title ?? ""));
    const surface = chapterReadingSurface(chapter).toLowerCase();
    const flagged = new Set<string>();
    for (const label of labels) {
      const token = distinctiveLabelToken(label, lowerProses, titleTokens, { requireCapitalizedInLabel: !!packet });
      if (!token || flagged.has(token)) continue;
      const count = countTokenMentions(token, surface);
      if (count > repCap) {
        flagged.add(token);
        findings.push({
          checkId: "CHB1.anchor_repetition",
          severity,
          chapterNumber: chapter.number,
          message:
            `ch${String(chapter.number).padStart(2, "0")} reading surface mentions "${token}" (distinctive ` +
            `token of case "${label}") ${count} times — over the per-chapter cap of ${repCap}; readers ` +
            `flagged anchor hammering. Vary the reference or cut mentions.`,
        });
      }
    }
  });
  return findings;
}

// ── CHB2: length budget ──────────────────────────────────────────────────────

/** Estimated rendered chars for a chapter: PROSE_TO_RENDERED_K * proseChars. */
export function estimatedRenderedChars(chapter: ChapterV21): number {
  return Math.round(PROSE_TO_RENDERED_K * chapterProseChars(chapter));
}

function checkLengthBudget(
  chapters: ChapterV21[],
  budget: { renderedChars: number; tolerance: number },
): BudgetFinding[] {
  const findings: BudgetFinding[] = [];
  const lo = budget.renderedChars * (1 - budget.tolerance);
  const hi = budget.renderedChars * (1 + budget.tolerance);
  for (const chapter of chapters) {
    const estimated = estimatedRenderedChars(chapter);
    if (estimated >= lo && estimated <= hi) continue;
    const direction = estimated > hi ? "over" : "under";
    const pct = Math.round(Math.abs(estimated / budget.renderedChars - 1) * 100);
    findings.push({
      checkId: "CHB2.length_budget",
      severity: "blocker",
      chapterNumber: chapter.number,
      message:
        `ch${String(chapter.number).padStart(2, "0")} estimated rendered length ${estimated} chars is ` +
        `${pct}% ${direction} the ${budget.renderedChars}-char budget (allowed window ` +
        `${Math.round(lo)}–${Math.round(hi)}); readers rejected ~40% inflation.`,
    });
  }
  return findings;
}

// ── CHB3: cast disjointness ──────────────────────────────────────────────────

let cachedNameBank: Set<string> | null = null;

/** The invented-first-name pool the pipeline deals cast from. Missing/corrupt
 *  config degrades to an empty set (CHB3 becomes a no-op) rather than
 *  throwing — a standalone reporting verb must not crash on config drift. */
function inventedNameBank(): Set<string> {
  if (cachedNameBank) return cachedNameBank;
  try {
    cachedNameBank = new Set(loadNameBank());
  } catch (err) {
    console.warn(`readerBudgets: name-bank unavailable (${(err as Error).message}); CHB3 disabled for this run.`);
    cachedNameBank = new Set();
  }
  return cachedNameBank;
}

function protectedNamesFor(
  chapters: ChapterV21[],
  packets: Map<number, SourcePacketV1> | undefined,
  bank: Set<string>,
): Set<string> {
  const excluded = new Set<string>(GLOBAL_RESERVED_SOURCE_FIGURE_NAMES);
  if (packets) {
    for (const packet of packets.values()) {
      for (const name of protectedSourceNames(packet, [...bank])) excluded.add(name);
      for (const namedCase of packet.namedCases) {
        for (const token of extractNamesFromText(namedCase.label)) excluded.add(token);
      }
    }
  }
  return excluded;
}

function checkCastDisjoint(
  chapters: ChapterV21[],
  packets: Map<number, SourcePacketV1> | undefined,
): BudgetFinding[] {
  const bank = inventedNameBank();
  if (bank.size === 0) return [];
  const excluded = protectedNamesFor(chapters, packets, bank);
  const chaptersByName = new Map<string, number[]>();
  for (const chapter of chapters) {
    const text = (chapter.examples ?? [])
      .flatMap((ex) => [String(ex.scenario ?? ""), String(ex.whatToDo ?? "")])
      .join(" \n ");
    // Calibration decision #5: without packets, a first name that also appears
    // in the chapter's own breakdown prose is a real source figure (invented
    // cast exists only inside the example pack by design), not dealt cast.
    const breakdownNames = packets
      ? new Set<string>()
      : new Set(extractNamesFromText(
          [chapter.breakdown?.fastRead ?? "", chapter.breakdown?.deepRead ?? "", chapter.breakdown?.fullRead ?? ""].join(" \n "),
        ));
    const cast = new Set(
      extractNamesFromText(text).filter((name) => bank.has(name) && !excluded.has(name) && !breakdownNames.has(name)),
    );
    for (const name of cast) {
      const list = chaptersByName.get(name) ?? [];
      list.push(chapter.number);
      chaptersByName.set(name, list);
    }
  }
  const findings: BudgetFinding[] = [];
  for (const [name, numbers] of [...chaptersByName.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1))) {
    if (numbers.length <= 1) continue;
    for (const chapterNumber of numbers) {
      findings.push({
        checkId: "CHB3.cast_disjoint",
        severity: "blocker",
        chapterNumber,
        message:
          `invented first name "${name}" is cast in ${numbers.length} chapters ` +
          `(${numbers.map((n) => `ch${String(n).padStart(2, "0")}`).join(", ")}); each chapter's example cast ` +
          `must be disjoint — rename this character in all but one chapter.`,
      });
    }
  }
  return findings;
}

// ── CHB4: opener signature ───────────────────────────────────────────────────

export const OPENER_SIGNATURE_SIZE = 8;
export const OPENER_SHARED_THRESHOLD = 6;

/** Opener signature: the first example's scenario, first 8 content tokens
 *  after function-word removal, lowercased + naively stemmed. */
export function openerSignature(chapter: ChapterV21): string[] {
  const scenario = String(chapter.examples?.[0]?.scenario ?? "");
  const tokens: string[] = [];
  for (const token of wordTokens(scenario)) {
    if (FUNCTION_WORDS.has(token)) continue;
    tokens.push(naiveStem(token));
    if (tokens.length >= OPENER_SIGNATURE_SIZE) break;
  }
  return tokens;
}

function checkOpenerSignature(chapters: ChapterV21[]): BudgetFinding[] {
  const findings: BudgetFinding[] = [];
  const signatures = chapters.map((chapter) => ({ chapter, sig: new Set(openerSignature(chapter)) }));
  for (let j = 1; j < signatures.length; j++) {
    for (let i = 0; i < j; i++) {
      const a = signatures[i];
      const b = signatures[j];
      if (a.sig.size === 0 || b.sig.size === 0) continue;
      let shared = 0;
      for (const token of b.sig) if (a.sig.has(token)) shared++;
      if (shared >= OPENER_SHARED_THRESHOLD) {
        findings.push({
          checkId: "CHB4.opener_signature",
          severity: "blocker",
          chapterNumber: b.chapter.number,
          message:
            `ch${String(b.chapter.number).padStart(2, "0")} first-example opener shares ${shared} of its first ` +
            `${OPENER_SIGNATURE_SIZE} content tokens with ch${String(a.chapter.number).padStart(2, "0")} — a ` +
            `shared scenario opener frame; rebuild one opener from a different frame.`,
        });
      }
    }
  }
  return findings;
}

// ── CHB5: practice format ────────────────────────────────────────────────────

export const PRACTICE_MAX_CHAPTERS_PER_SIGNATURE = 2;

/** Practice-format signature: first verb lemma (first non-function-word token,
 *  stemmed) + up to 3 salient nouns (tokens >= 5 chars, non-function-word,
 *  stemmed, deduped, in order of appearance). */
export function practiceSignature(text: string): string | null {
  const tokens = wordTokens(text);
  let verb: string | null = null;
  let verbIndex = -1;
  for (let i = 0; i < tokens.length; i++) {
    if (FUNCTION_WORDS.has(tokens[i])) continue;
    verb = naiveStem(tokens[i]);
    verbIndex = i;
    break;
  }
  if (!verb) return null;
  const nouns: string[] = [];
  for (let i = verbIndex + 1; i < tokens.length && nouns.length < 3; i++) {
    const token = tokens[i];
    if (token.length < 5 || FUNCTION_WORDS.has(token)) continue;
    const stemmed = naiveStem(token);
    if (stemmed === verb || nouns.includes(stemmed)) continue;
    nouns.push(stemmed);
  }
  return `${verb}|${nouns.join("+")}`;
}

function checkPracticeFormat(chapters: ChapterV21[]): BudgetFinding[] {
  const findings: BudgetFinding[] = [];
  const fields: Array<{ key: "twentyFourHourChallenge" | "weeklyPractice"; label: string }> = [
    { key: "twentyFourHourChallenge", label: "twentyFourHourChallenge" },
    { key: "weeklyPractice", label: "weeklyPractice" },
  ];
  for (const field of fields) {
    const bySignature = new Map<string, number[]>();
    for (const chapter of chapters) {
      const text = String(chapter.implementationPlan?.[field.key] ?? "");
      const signature = practiceSignature(text);
      if (!signature) continue;
      const list = bySignature.get(signature) ?? [];
      list.push(chapter.number);
      bySignature.set(signature, list);
    }
    for (const [signature, numbers] of [...bySignature.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1))) {
      if (numbers.length <= PRACTICE_MAX_CHAPTERS_PER_SIGNATURE) continue;
      for (const chapterNumber of numbers) {
        findings.push({
          checkId: "CHB5.practice_format",
          severity: "blocker",
          chapterNumber,
          message:
            `implementationPlan.${field.label} format signature "${signature}" repeats across ${numbers.length} ` +
            `chapters (${numbers.map((n) => `ch${String(n).padStart(2, "0")}`).join(", ")}); more than ` +
            `${PRACTICE_MAX_CHAPTERS_PER_SIGNATURE} chapters sharing one practice format reads templated — ` +
            `redesign the practice in all but two.`,
        });
      }
    }
  }
  return findings;
}

// ── entry point ──────────────────────────────────────────────────────────────

export function checkReaderBudgets(chapters: ChapterV21[], opts?: ReaderBudgetOptions): BudgetFinding[] {
  const ordered = [...chapters].sort((a, b) => a.number - b.number);
  const repCap = opts?.repCap ?? DEFAULT_REP_CAP;
  const budget = opts?.lengthBudget ?? DEFAULT_LENGTH_BUDGET;
  const lowerProses = ordered.map((chapter) => chapterProse(chapter).toLowerCase());
  return [
    ...checkAnchorRepetition(ordered, lowerProses, opts?.packets, repCap),
    ...checkLengthBudget(ordered, budget),
    ...checkCastDisjoint(ordered, opts?.packets),
    ...checkOpenerSignature(ordered),
    ...checkPracticeFormat(ordered),
  ];
}

/** Pretty-print findings for the CLI verb. */
export function formatBudgetFindings(findings: BudgetFinding[]): string {
  if (findings.length === 0) return "reader-budget-check: PASS (0 findings)";
  const lines = findings.map(
    (f) => `  [${f.severity.toUpperCase()}] ${f.checkId} ch${String(f.chapterNumber).padStart(2, "0")}: ${f.message}`,
  );
  const blockers = findings.filter((f) => f.severity === "blocker").length;
  return `reader-budget-check: ${blockers > 0 ? "BLOCK" : "WARN"} (${findings.length} finding(s), ${blockers} blocker(s))\n${lines.join("\n")}`;
}
