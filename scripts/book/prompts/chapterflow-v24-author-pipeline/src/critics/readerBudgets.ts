/**
 * readerBudgets — nine deterministic reader-correlated checks (v24 B3 + W3).
 *
 * CHB1–CHB5 (B3) price the defects panel readers rejected on regenerated
 * chapters. CHB6–CHB9 (W3) are the write-time BACKSTOP for the content
 * residuals the published the-power-of-moments v24 still shipped (see
 * docs evidence: 10/12 same 24h-challenge skeleton, claim-opener 10/12,
 * fastRead-opener 11/12, "Pick…" tryThisNow 6/12, menu-ified practice 27%,
 * key-uniquely-shortest 51% / most-echoed 63% / case-anchored stems 43%). W4's
 * brief rotation is the PREVENTION; these budgets catch a book that shipped the
 * monoculture anyway. All nine are book-level, cross-chapter, DETERMINISTIC
 * (no LLM). Same enforcement discipline: blockers only where a zero-FALSE-
 * positive calibration against the top-owner-scored shipped books holds.
 *
 * ENFORCEMENT SPLIT (calibration table: docs/v24/CHB6-9-calibration.md — ran
 * against the top-5 owner-scored packages + the published POM v24). Only CHB7
 * is zero-FP across the top-5, so only CHB7 is a BLOCKER; CHB6/CHB8/CHB9 fire
 * on ≥1 top-5 owner-scored book (the monocultures are corpus-wide, exactly as
 * the forensics measured) and therefore ship as ADVISORY (shadow) — visible,
 * committed calibration, but never fail-closed until the corpus itself clears.
 *
 * W3 checks:
 *   CHB6.opener_class    — hook AND fastRead opening class (question/scene/
 *                          statistic/claim regex classifier): no class on more
 *                          than ceil(2/3·N) chapters. ADVISORY (shadow).
 *   CHB7.scaffold_family — normalized first-4-WORDS family of tryThisNow/
 *                          twentyFourHourChallenge/weeklyPractice: no family on
 *                          more than ceil(1/3·N) chapters. BLOCKER (zero-FP;
 *                          POM v24 fires 7/12 on the "in the next #" stem).
 *   CHB7.phrase_spread   — content 4-gram (stopword-filtered) in ≥4 chapters,
 *                          with a whitelist for the book's own terms of art.
 *                          BLOCKER (zero-FP across the top-5).
 *   CHB8.*_band          — book-level quiz tell distribution bands: key-
 *                          uniquely-shortest 20–45%, key-uniquely-longest ≤40%,
 *                          key strictly-most-prose-echoed ≤55%, case-name-
 *                          anchored stems ≤30%. ADVISORY (shadow; symmetric —
 *                          no one-sided cap that mints the next tell).
 *   CHB9.option_menu     — "a, b, or c" option-menu practice items ≤15% of
 *                          practice items. ADVISORY (shadow).
 *   CHB9.quoted_script   — ≥3 chapters carry an exact quoted say-aloud script
 *                          in a practice field. ADVISORY (shadow).
 *
 * Dual-shape: every W3 read goes through asText()/resolveDirect so a slim
 * v21-authored package (plain strings) and a legacy MaybeToned package
 * ({direct,…}) measure the SAME field. Case names + terms-of-art come from
 * source packets when present, else authoring fields, else text-derived proper
 * nouns / example titles (documented per check).
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

import { readFileSync } from "fs";
import type { ChapterV21 } from "../types.js";
import { resolveDirect } from "../types.js";
import { parseChapterId } from "../lib/chapterPaths.js";
import { chapterBriefPath } from "../artifacts/artifactStore.js";
import { DEFAULT_LENGTH_BUDGET_CHARS, LENGTH_BUDGET_TOLERANCE } from "../compiler/chapterBrief.js";
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
/** CHB1 calibration (CONVERGENCE-SAFE PASS, 2026-07-05): a packet-anchored case
 *  token repeated just over the cap on the linear reading surface is "minor
 *  repetition" (owner rubric → scored/advisory), not a reader-harming blocker.
 *  Only EGREGIOUS hammering — count ≥ repCap * this multiple (≥12 at cap 6),
 *  the band where SEAM2 and the blinded reader panel co-fire — stays a blocker.
 *  This stops CHB1 from routing an otherwise-passing chapter into a FULL
 *  re-author (the carry-churn root cause). The blinded reader panel remains the
 *  backstop for true hammering below the hard band. */
export const CHB1_HARD_ANCHOR_MULT = 2;
/** Single-sourced from the compiler's canonical constants (P6, FINAL-HARDENING-
 *  PLAN 2026-07-04): the brief STAMPS lengthBudget from DEFAULT_LENGTH_BUDGET_CHARS
 *  / LENGTH_BUDGET_TOLERANCE, so CHB2's default must be the SAME literals — two
 *  independent copies were a drift surface. No cycle: no compiler module imports
 *  this file. */
export const DEFAULT_LENGTH_BUDGET = { renderedChars: DEFAULT_LENGTH_BUDGET_CHARS, tolerance: LENGTH_BUDGET_TOLERANCE } as const;

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
    // anchors; title-derived labels are the chapter's own concept vocabulary
    // (always advisory). Severity for a packet anchor is banded by COUNT below
    // (CHB1_HARD_ANCHOR_MULT) — a small overflow is advisory, egregious
    // hammering is a blocker.
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
        // Banded: a packet anchor is a blocker ONLY at egregious hammering
        // (count ≥ repCap * CHB1_HARD_ANCHOR_MULT); a small overflow, and any
        // title-derived label, is advisory. Prevents CHB1 from full-re-authoring
        // an otherwise-passing chapter over minor repetition.
        const severity: BudgetFinding["severity"] =
          packet && count >= repCap * CHB1_HARD_ANCHOR_MULT ? "blocker" : "advisory";
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
  // Publish calibration (2026-07-04, plan §B): severity BANDS instead of a hard
  // edge — a 1.6% overflow halted a 9×85+ book and cost 3 sessions to trim 309
  // chars. Within tolerance: pass. Out by <=10 percentage points beyond
  // tolerance (i.e. 20-30% off a 16k budget): ADVISORY — scored, listed, never
  // halts. Beyond that: BLOCKER with the existing repair routing ("readers
  // rejected ~40% inflation" stays comfortably protected at the 30% edge).
  const hardLo = budget.renderedChars * (1 - budget.tolerance - 0.1);
  const hardHi = budget.renderedChars * (1 + budget.tolerance + 0.1);
  for (const chapter of chapters) {
    const estimated = estimatedRenderedChars(chapter);
    if (estimated >= lo && estimated <= hi) continue;
    const direction = estimated > hi ? "over" : "under";
    const pct = Math.round(Math.abs(estimated / budget.renderedChars - 1) * 100);
    const severe = estimated >= hardHi || estimated <= hardLo;
    findings.push({
      checkId: "CHB2.length_budget",
      severity: severe ? "blocker" : "advisory",
      chapterNumber: chapter.number,
      message:
        `ch${String(chapter.number).padStart(2, "0")} estimated rendered length ${estimated} chars is ` +
        `${pct}% ${direction} the ${budget.renderedChars}-char budget (allowed window ` +
        `${Math.round(lo)}–${Math.round(hi)}${severe ? "" : "; within the advisory band — polish, not a halt"}); readers rejected ~40% inflation.`,
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

// ── shared dual-shape + n-gram utilities (CHB6–CHB9) ─────────────────────────

/** Coerce a MaybeToned<string> (slim v21-authored = plain string; legacy = {direct,…}) to a plain
 *  string — the dual-shape handling CHB6–CHB9 need to read the SAME field on both package shapes. */
export function asText(value: unknown): string {
  const direct = resolveDirect(value as never);
  return typeof direct === "string" ? direct : "";
}

const CEIL_TWO_THIRDS = (n: number): number => Math.ceil((2 * Math.max(1, n)) / 3);
const CEIL_ONE_THIRD = (n: number): number => Math.ceil(Math.max(1, n) / 3);

/** Content-word tokens: lowercase letter runs, function words dropped. Reused by CHB7's 4-gram
 *  spread and CHB8's prose-echo/stem-overlap measures. */
function contentTokens(text: string): string[] {
  return wordTokens(text).filter((t) => !FUNCTION_WORDS.has(t) && t.length >= 3);
}

// ── CHB6: opener-class budget ────────────────────────────────────────────────

export const OPENER_CLASSES = ["question", "scene", "statistic", "claim", "tension-thesis"] as const;
export type OpenerClass = (typeof OPENER_CLASSES)[number];

/** Classify an opening sentence into {question, scene, statistic, claim} lexically. The v4
 *  rotation also deals "tension-thesis", which is lexically a claim — the budget check below
 *  re-buckets a claim-classified chapter into "tension-thesis" when its BRIEF dealt that mode
 *  (deal-aware, same precedent as finalGate.dealtExampleFloor), so a deal-compliant book cannot
 *  overflow the claim budget by obeying its deal. Book-level heuristic (the calibration note is
 *  explicit that these regexes are safe as aggregate budgets, noisy as per-item gates). Order
 *  matters: question → statistic → scene → claim (default). */
export function classifyOpener(text: string): OpenerClass {
  const first = (text.match(/[^.!?]*[.!?]?/)?.[0] ?? text).trim();
  if (!first) return "claim";
  if (first.includes("?")) return "question";
  // statistic: a digit, a written cardinal, a percent, or a measured quantity up front.
  if (/\d/.test(first) || /\b(percent|%)\b/i.test(first)
    || /^\s*(one|two|three|four|five|six|seven|eight|nine|ten|dozens?|hundreds?|thousands?|millions?)\b/i.test(first)) {
    return "statistic";
  }
  // scene: opens on a place/time/person mid-moment — a leading prepositional/temporal frame, or a
  // capitalized proper-noun subject followed by a concrete action verb.
  if (/^\s*(at|in|on|inside|outside|during|before|after|when|as|by|near|beneath|above|across|along|behind)\b/i.test(first)) {
    return "scene";
  }
  if (/^\s*[A-Z][a-z]+\s+(sees|saw|walks|walked|stands|stood|sits|sat|steps|stepped|laces|opens|opened|watches|watched|notices|noticed|holds|held|leans|leaned|arrives|arrived|hears|heard|checks|checked|reaches|reached|picks|picked|turns|turned|freezes|froze|pauses|paused|stares|stared|waits|waited|grabs|grabbed|looks|looked|enters|entered|drops|dropped|closes|closed|scans|scanned)\b/.test(first)) {
    return "scene";
  }
  return "claim";
}

/** CHB6: over the whole book, the hook opening class AND the fastRead opening class each get a
 *  budget of ceil(2/3·N) chapters — no single class may open more than two-thirds of chapters
 *  (readers named the claim-opener monoculture directly). Dual-shape via asText. */
/** Dealt opener mode from the chapter's brief, or null when no valid v-rotation brief exists
 *  (legacy books, missing briefs — fail-open to pure lexical classification). */
function dealtOpenerType(chapter: ChapterV21): string | null {
  try {
    const parsed = parseChapterId(chapter.chapterId ?? "");
    if (!parsed) return null;
    const raw = readFileSync(chapterBriefPath(parsed.bookId, parsed.num), "utf8");
    const brief = JSON.parse(raw) as { rotationSchemaVersion?: unknown; openerType?: unknown };
    if (typeof brief?.rotationSchemaVersion === "string" && brief.rotationSchemaVersion.length > 0 &&
        typeof brief?.openerType === "string" && brief.openerType.length > 0) {
      return brief.openerType;
    }
  } catch { /* no readable brief → lexical class stands */ }
  return null;
}

function checkOpenerClassBudget(chapters: ChapterV21[]): BudgetFinding[] {
  const n = chapters.length;
  if (n === 0) return [];
  const cap = CEIL_TWO_THIRDS(n);
  const findings: BudgetFinding[] = [];
  const surfaces: Array<{ label: "hook" | "fastRead"; get: (c: ChapterV21) => string }> = [
    { label: "hook", get: (c) => asText(c.hook) },
    { label: "fastRead", get: (c) => asText(c.breakdown?.fastRead) },
  ];
  for (const surface of surfaces) {
    const byClass = new Map<OpenerClass, number[]>();
    for (const chapter of chapters) {
      const text = surface.get(chapter);
      if (!text.trim()) continue;
      let cls: OpenerClass = classifyOpener(text);
      // v4 deal-aware re-bucket: a dealt tension-thesis hook is lexically a claim; obeying
      // the deal must not overflow the claim budget (D8, FINAL-HARDENING-PLAN 2026-07-04).
      if (cls === "claim" && dealtOpenerType(chapter) === "tension-thesis") cls = "tension-thesis";
      const list = byClass.get(cls) ?? [];
      list.push(chapter.number);
      byClass.set(cls, list);
    }
    for (const cls of OPENER_CLASSES) {
      const nums = byClass.get(cls) ?? [];
      if (nums.length <= cap) continue;
      for (const chapterNumber of nums) {
        findings.push({
          checkId: "CHB6.opener_class",
          // SHADOW (advisory): fires on top-5 owner-scored books (claim-opener monoculture is
          // corpus-wide) → not zero-FP → cannot be a blocker per the standing calibration rule.
          severity: "advisory",
          chapterNumber,
          message:
            `${surface.label} opener class "${cls}" appears in ${nums.length} of ${n} chapters ` +
            `(${nums.map((x) => `ch${String(x).padStart(2, "0")}`).join(", ")}) — over the ceil(2/3·N)=${cap} ` +
            `opener-class budget; rotate ${surface.label} openers across question/scene/statistic/claim/tension-thesis.`,
        });
      }
    }
  }
  return findings;
}

// ── CHB7: scaffold-family + content-4-gram spread ────────────────────────────

/** Normalized first-4-WORDS family of a scaffold field. Uses the RAW opening words (function words
 *  KEPT — the scaffold stem is exactly the function/time-word run readers feel: "In the next 24
 *  hours,"), lowercased, punctuation stripped, and every digit run folded to "#" so "24"/"48"/"72
 *  hours" collapse to one family. Two lines opening "In the next 24 hours…" and "In the next 48
 *  hours…" share the family "in the next #". Returns null on an empty field. */
export function scaffoldFamily(text: string): string | null {
  const norm = text
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\b\d+\b/g, "#")
    .replace(/\s+/g, " ")
    .trim();
  if (!norm) return null;
  return norm.split(" ").filter(Boolean).slice(0, 4).join(" ");
}

/** Build a whitelist of the book's own terms of art: title tokens + (packet path) marquee case
 *  label tokens / quoted hardSpecifics. These are the concept vocabulary that legitimately recurs
 *  book-wide and must NOT count toward the 4-gram spread cap. Content tokens only, ≥3 chars. */
function bookTermWhitelist(chapters: ChapterV21[], packets: Map<number, SourcePacketV1> | undefined): Set<string> {
  const white = new Set<string>();
  const add = (text: string) => { for (const t of contentTokens(text)) white.add(t); };
  for (const chapter of chapters) add(chapter.title ?? "");
  if (packets) {
    for (const packet of packets.values()) {
      for (const namedCase of packet.namedCases ?? []) {
        add(namedCase.label ?? "");
        for (const spec of namedCase.hardSpecifics ?? []) add(spec);
      }
    }
  } else {
    // Loose-chapter fallback: the example titles are the book's own case names on this shape.
    for (const chapter of chapters) {
      for (const ex of chapter.examples ?? []) add(asText(ex.title));
    }
  }
  return white;
}

/** CHB7: two book-level spreads.
 *  (a) scaffold FAMILY spread — for each of tryThisNow / twentyFourHourChallenge / weeklyPractice,
 *      no first-4-words family may appear in more than ceil(1/3·N) chapters.
 *  (b) content 4-gram spread — no stopword-filtered content 4-gram may appear in ≥4 chapters,
 *      EXCEPT 4-grams built entirely from the book's own terms of art (whitelist). */
function checkScaffoldAndPhraseSpread(
  chapters: ChapterV21[],
  packets: Map<number, SourcePacketV1> | undefined,
): BudgetFinding[] {
  const n = chapters.length;
  if (n === 0) return [];
  const findings: BudgetFinding[] = [];

  // (a) scaffold family spread — cap ceil(1/3·N).
  const familyCap = CEIL_ONE_THIRD(n);
  const scaffoldFields: Array<{ label: string; get: (c: ChapterV21) => string }> = [
    { label: "tryThisNow", get: (c) => asText(c.tryThisNow) },
    { label: "twentyFourHourChallenge", get: (c) => asText(c.implementationPlan?.twentyFourHourChallenge) },
    { label: "weeklyPractice", get: (c) => asText(c.implementationPlan?.weeklyPractice) },
  ];
  for (const field of scaffoldFields) {
    const byFamily = new Map<string, number[]>();
    for (const chapter of chapters) {
      const fam = scaffoldFamily(field.get(chapter));
      if (!fam) continue;
      const list = byFamily.get(fam) ?? [];
      list.push(chapter.number);
      byFamily.set(fam, list);
    }
    for (const [fam, nums] of [...byFamily.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1))) {
      if (nums.length <= familyCap) continue;
      for (const chapterNumber of nums) {
        findings.push({
          checkId: "CHB7.scaffold_family",
          severity: "blocker",
          chapterNumber,
          message:
            `${field.label} opening family "${fam}" repeats across ${nums.length} of ${n} chapters ` +
            `(${nums.map((x) => `ch${String(x).padStart(2, "0")}`).join(", ")}) — over the ceil(1/3·N)=${familyCap} ` +
            `scaffold-family budget; reframe the opener in all but ${familyCap}.`,
        });
      }
    }
  }

  // (b) content 4-gram spread — no non-whitelist content 4-gram in ≥4 chapters.
  const PHRASE_SPREAD_CAP = 4; // "≥4 chapters" fires (strictly, count >= 4).
  const whitelist = bookTermWhitelist(chapters, packets);
  const gramChapters = new Map<string, Set<number>>();
  const scaffoldSurface = (c: ChapterV21): string =>
    scaffoldFields.map((f) => f.get(c)).join(" \n ");
  for (const chapter of chapters) {
    const tokens = contentTokens(scaffoldSurface(chapter));
    const seen = new Set<string>();
    for (let i = 0; i + 4 <= tokens.length; i++) {
      const gram4 = tokens.slice(i, i + 4);
      // whitelist: skip 4-grams whose tokens are ALL the book's own terms of art.
      if (gram4.every((t) => whitelist.has(t))) continue;
      const key = gram4.join(" ");
      if (seen.has(key)) continue; // count each gram once per chapter (document frequency)
      seen.add(key);
      const set = gramChapters.get(key) ?? new Set<number>();
      set.add(chapter.number);
      gramChapters.set(key, set);
    }
  }
  for (const [gram, set] of [...gramChapters.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1))) {
    if (set.size < PHRASE_SPREAD_CAP) continue;
    const nums = [...set].sort((a, b) => a - b);
    for (const chapterNumber of nums) {
      findings.push({
        checkId: "CHB7.phrase_spread",
        severity: "blocker",
        chapterNumber,
        message:
          `scaffold 4-gram "${gram}" appears in ${set.size} of ${n} chapters ` +
          `(${nums.map((x) => `ch${String(x).padStart(2, "0")}`).join(", ")}) — a book-wide scaffold phrase ` +
          `(cap: fewer than ${PHRASE_SPREAD_CAP} chapters); vary the wording. Whitelist the book's terms of art if this is concept vocabulary.`,
      });
    }
  }
  return findings;
}

// ── CHB8: quiz tell-distribution bands (book-level) ──────────────────────────

export type QuizChoiceView = { prompt: string; choices: string[]; correctIndex: number };

/** Read a chapter's quiz questions on BOTH package shapes (slim = plain strings; legacy = MaybeToned
 *  choices). Skips malformed questions (missing choices / out-of-range key) — a reporting verb must
 *  never throw on a bad package. */
export function quizViews(chapter: ChapterV21): QuizChoiceView[] {
  const questions = (chapter.quiz?.questions ?? []) as Array<{ prompt?: unknown; choices?: unknown; correctIndex?: unknown }>;
  const out: QuizChoiceView[] = [];
  for (const q of questions) {
    const choicesRaw = Array.isArray(q.choices) ? q.choices : [];
    const choices = choicesRaw.map((c) => asText(c)).filter((c) => c.length > 0);
    const key = typeof q.correctIndex === "number" ? q.correctIndex : -1;
    if (choices.length < 2 || key < 0 || key >= choicesRaw.length) continue;
    out.push({ prompt: asText(q.prompt), choices, correctIndex: key });
  }
  return out;
}

/** Longest contiguous content-token n-gram of `needle` also present in `haystackTokens` (as a
 *  contiguous run). Used to measure a choice's prose echo. */
function longestSharedContentRun(needle: string, haystackJoined: string): number {
  const nt = contentTokens(needle);
  if (nt.length === 0) return 0;
  let best = 0;
  for (let i = 0; i < nt.length; i++) {
    for (let len = nt.length - i; len > best; len--) {
      const phrase = nt.slice(i, i + len).join(" ");
      if (haystackJoined.includes(phrase)) { best = Math.max(best, len); break; }
    }
  }
  return best;
}

/** The reader-visible prose surface a distractor-tell measures against (calibration note (b): the
 *  surface MUST include reviewCards + implementationPlan, not just breakdown + scenarios). Excludes
 *  the quiz itself. Returned as a joined content-token string for run matching. */
function chapterEchoSurface(chapter: ChapterV21): string {
  const parts: string[] = [
    asText(chapter.hook), asText(chapter.counterintuition), asText(chapter.tryThisNow), asText(chapter.keyTakeaway),
    asText(chapter.breakdown?.fastRead), asText(chapter.breakdown?.deepRead), asText(chapter.breakdown?.fullRead),
  ];
  for (const ex of chapter.examples ?? []) {
    parts.push(asText(ex.title), asText(ex.scenario), asText(ex.whatToDo), asText(ex.whyItMatters));
  }
  for (const card of chapter.reviewCards ?? []) {
    parts.push(asText((card as { front?: unknown }).front), asText((card as { back?: unknown }).back));
  }
  const ip = chapter.implementationPlan;
  if (ip) {
    parts.push(asText(ip.coreSkill), asText(ip.twentyFourHourChallenge), asText(ip.weeklyPractice));
    for (const plan of ip.ifThenPlans ?? []) parts.push(asText((plan as { context?: unknown }).context), asText((plan as { plan?: unknown }).plan));
  }
  for (const ml of chapter.memorableLines ?? []) parts.push(asText((ml as { text?: unknown }).text));
  return contentTokens(parts.join(" \n ")).join(" ");
}

/** Case names for CHB8's stem-anchoring measure: packet namedCases label proper-noun tokens when
 *  packets are present; else authoring fields on the chapter if present; else text-derived
 *  capitalized multi-word proper nouns from the chapter's example titles + scenarios. */
function chapterCaseNames(chapter: ChapterV21, packet: SourcePacketV1 | undefined): Set<string> {
  const names = new Set<string>();
  const addTokens = (label: string) => {
    for (const m of label.match(/\b[A-Z][a-zA-Z]{2,}\b/g) ?? []) {
      if (!COMMON_LABEL_TOKENS.has(m.toLowerCase())) names.add(m.toLowerCase());
    }
  };
  if (packet) {
    for (const namedCase of packet.namedCases ?? []) addTokens(namedCase.label ?? "");
    return names;
  }
  // Loose shape: authoring.namedCases if the pipeline stamped them, else example titles + scenarios.
  const authoring = (chapter as { authoring?: { namedCases?: Array<{ label?: unknown }> } }).authoring;
  if (authoring?.namedCases?.length) {
    for (const c of authoring.namedCases) addTokens(asText(c.label));
    return names;
  }
  for (const ex of chapter.examples ?? []) {
    addTokens(asText(ex.title));
    addTokens(asText(ex.scenario));
  }
  return names;
}

/** CHB8: four book-level distribution bands over ALL questions (readers detect one-sided tells;
 *  symmetric bands stop the whack-a-mole where fixing one tell mints the next). A band violation
 *  is reported once, on the book's first chapter, because it is a whole-book property. */
function checkTellDistribution(
  chapters: ChapterV21[],
  packets: Map<number, SourcePacketV1> | undefined,
): BudgetFinding[] {
  const findings: BudgetFinding[] = [];
  let total = 0;
  let keyUniquelyShortest = 0;
  let keyUniquelyLongest = 0;
  let keyMostEchoed = 0;
  let caseAnchoredStems = 0;

  for (const chapter of chapters) {
    const surface = chapterEchoSurface(chapter);
    const caseNames = chapterCaseNames(chapter, packets?.get(chapter.number));
    for (const q of quizViews(chapter)) {
      total++;
      const lens = q.choices.map((c) => c.length);
      const keyLen = lens[q.correctIndex];
      const minLen = Math.min(...lens);
      const maxLen = Math.max(...lens);
      if (keyLen === minLen && lens.filter((l) => l === minLen).length === 1) keyUniquelyShortest++;
      if (keyLen === maxLen && lens.filter((l) => l === maxLen).length === 1) keyUniquelyLongest++;

      const echoes = q.choices.map((c) => longestSharedContentRun(c, surface));
      const keyEcho = echoes[q.correctIndex];
      if (keyEcho > 0 && echoes.filter((e) => e === keyEcho).length === 1 && keyEcho === Math.max(...echoes)) keyMostEchoed++;

      const stemTokens = new Set(contentTokens(q.prompt));
      if ([...caseNames].some((name) => stemTokens.has(name))) caseAnchoredStems++;
    }
  }
  if (total === 0) return findings;

  const pct = (x: number) => x / total;
  const anchor = chapters[0]?.number ?? 1;
  // SHADOW (advisory): every CHB8 band fires on ≥1 top-5 owner-scored book (the length/echo/case-
  // anchor tells are corpus-wide, exactly as the forensics doc measured) → not zero-FP → advisory.
  const push = (checkId: string, message: string) =>
    findings.push({ checkId, severity: "advisory", chapterNumber: anchor, message });

  const shortestPct = pct(keyUniquelyShortest);
  if (shortestPct < 0.20 || shortestPct > 0.45) {
    push("CHB8.shortest_band",
      `key is the UNIQUELY shortest choice in ${Math.round(shortestPct * 100)}% of ${total} questions — outside the 20–45% band; ` +
      `${shortestPct > 0.45 ? "readers can win by picking the tersest choice" : "the length signal is inverted"}. Balance choice lengths.`);
  }
  const longestPct = pct(keyUniquelyLongest);
  if (longestPct > 0.40) {
    push("CHB8.longest_band",
      `key is the UNIQUELY longest choice in ${Math.round(longestPct * 100)}% of ${total} questions — over the 40% cap; ` +
      `readers can win by picking the wordiest choice. Shorten some keys / lengthen some distractors.`);
  }
  const echoPct = pct(keyMostEchoed);
  if (echoPct > 0.55) {
    push("CHB8.echo_band",
      `key is strictly the MOST prose-echoed choice in ${Math.round(echoPct * 100)}% of ${total} questions — over the 55% cap; ` +
      `readers can win by matching chapter wording. Paraphrase keys / plant echoes in distractors.`);
  }
  const stemPct = pct(caseAnchoredStems);
  if (stemPct > 0.30) {
    push("CHB8.case_stem_band",
      `${Math.round(stemPct * 100)}% of ${total} stems name a chapter case/entity verbatim — over the 30% cap; ` +
      `case-name anchoring telegraphs the taught case. Rebuild some stems as novel-scenario transfer.`);
  }
  return findings;
}

// ── CHB9: practice budgets ───────────────────────────────────────────────────

/** An "a, b, or c" option menu — three+ comma-separated alternatives closed by "or"/"or a". The
 *  calibration note flags menu-ification (27% in POM v24) as the reader-felt practice regression.
 *  Book-level only (moderate per-item FP on legitimate enumerations). */
export function hasOptionMenu(text: string): boolean {
  // …A, B, or C  — at least two commas before an "or", i.e. a 3+ item alternation.
  return /\w[^.?!]*,[^.?!]*,\s*(?:or|and)\b[^.?!]*/i.test(text) && /,\s*(?:or)\b/i.test(text);
}

/** An exact quoted say-aloud script: a quoted imperative sentence inside a practice field. Matches
 *  straight or curly double quotes wrapping a clause of at least a few words. */
export function hasQuotedScript(text: string): boolean {
  const m = text.match(/[“"]([^“”"]{6,})[”"]/);
  if (!m) return false;
  // require it to read as words to say (contains a space and a letter), not a bare label.
  return /[A-Za-z]/.test(m[1]) && /\s/.test(m[1].trim());
}

/** CHB9: two book-level practice budgets.
 *  (a) option-menu items ≤ 15% of practice items (tryThisNow + 24hChallenge + weeklyPractice +
 *      each ifThen plan).
 *  (b) ≥ 3 chapters contain an exact quoted say-aloud script in a practice field. */
function checkPracticeBudgets(chapters: ChapterV21[]): BudgetFinding[] {
  const findings: BudgetFinding[] = [];
  const anchor = chapters[0]?.number ?? 1;
  let items = 0;
  let menuItems = 0;
  let chaptersWithScript = 0;

  for (const chapter of chapters) {
    const practiceTexts: string[] = [
      asText(chapter.tryThisNow),
      asText(chapter.implementationPlan?.twentyFourHourChallenge),
      asText(chapter.implementationPlan?.weeklyPractice),
    ];
    for (const plan of chapter.implementationPlan?.ifThenPlans ?? []) {
      practiceTexts.push(asText((plan as { plan?: unknown }).plan));
    }
    let chapterHasScript = false;
    for (const text of practiceTexts) {
      if (!text.trim()) continue;
      items++;
      if (hasOptionMenu(text)) menuItems++;
      if (hasQuotedScript(text)) chapterHasScript = true;
    }
    if (chapterHasScript) chaptersWithScript++;
  }
  if (items === 0) return findings;

  // SHADOW (advisory): CHB9's menu-rate and quoted-script floor both fire on top-5 owner-scored
  // books (menu-ification and zero-script practice are corpus-wide) → not zero-FP → advisory.
  const menuPct = menuItems / items;
  if (menuPct > 0.15) {
    findings.push({
      checkId: "CHB9.option_menu",
      severity: "advisory",
      chapterNumber: anchor,
      message:
        `${Math.round(menuPct * 100)}% of ${items} practice items are "a, b, or c" option menus — over the 15% cap; ` +
        `menu-ification reads as template. Give ONE concrete action per practice item.`,
    });
  }
  const SCRIPT_FLOOR = 3;
  if (chapters.length >= SCRIPT_FLOOR && chaptersWithScript < SCRIPT_FLOOR) {
    findings.push({
      checkId: "CHB9.quoted_script",
      severity: "advisory",
      chapterNumber: anchor,
      message:
        `only ${chaptersWithScript} chapter(s) contain an exact quoted say-aloud script in a practice field — ` +
        `below the floor of ${SCRIPT_FLOOR}; at least ${SCRIPT_FLOOR} chapters must give the reader the exact words to say.`,
    });
  }
  return findings;
}

// ── CHB10–CHB13: S-tier cross-chapter checks (plan docs/v24/STIER-PLAN-2026-07-03.md) ──
//
// The halted `execution` run passed CHB1–CHB9 with one advisory while three
// blinded acceptance readers ×2 rounds unanimously called it "one template
// stamped repeatedly". The sameness lived one level below these checks: lexical
// saturation (zero repeated 6-grams — echo-blind), one example dramaturgy in
// 54/54 examples, and tone-rejectable strawman distractors. CHB10–CHB13 measure
// exactly those three surfaces.
//
// CALIBRATION (2026-07-03, measured this campaign; table in
// docs/v24/CHB10-13-calibration.md): top-5 owner-scored books
// (games-people-play / crucial-conversations / atomic-habits 85.3,
// thinking-in-bets 85.2, difficult-conversations 84.9):
//   CHB10 band words (≥12 uses/ch AND ≥85% chapter spread): top-5 carry 0–2;
//     halted execution 10 ('review' 27.3/ch). Hottest single top-5 word:
//     'evidence' 20.6/ch (title concepts legitimately run hot). Catalog scan
//     (135 books): 24 exceed band>3 — clustered on the known-templated
//     execution-genre regen candidates (playing-to-win 13, extreme-ownership
//     10). → two-tier: ADVISORY at band>3, BLOCKER at band>6 or any word
//     >24/ch (top-5 zero-FP with ≥3× band / 17% ceiling headroom).
//   CHB12 strawman rate: top-5 0.5–4.8%; halted execution 12.3%; 9/135 catalog
//     books >7%. → BLOCKER at >7% (zero-FP on top-5 with 45% headroom).
//   CHB11/CHB13 are heuristic classifiers (scene anatomy, verb families) →
//     ADVISORY permanently unless a later spotless calibration promotes them.
//
// SURFACE NOTE: CHB10/CHB12 measure the FULL reader-visible surface (hook,
// breakdown tiers, examples, quiz, cards, plan, memorable lines) — the same
// surface the calibration script measured — NOT chapterReadingSurface (which
// deliberately excludes examples/quiz for CHB1's anchor-repetition semantics).
// The thresholds are only valid on the calibration surface.

/** Every reader-visible string of a chapter, joined. Mirrors the calibration
 *  script byte-for-byte in field coverage; keep the two in sync. */
function fullReaderSurface(chapter: ChapterV21): string {
  const parts: Array<string | undefined> = [
    asText(chapter.hook),
    asText(chapter.breakdown?.fastRead),
    asText(chapter.breakdown?.deepRead),
    asText(chapter.breakdown?.fullRead),
    asText(chapter.keyTakeaway),
    asText(chapter.tryThisNow),
  ];
  for (const e of chapter.examples ?? []) {
    parts.push(asText(e.title), asText(e.scenario), asText(e.whatToDo), asText(e.whyItMatters));
  }
  for (const q of chapter.quiz?.questions ?? []) {
    parts.push(asText(q.prompt), asText(q.explanation));
    for (const c of q.choices ?? []) parts.push(asText(c));
  }
  for (const c of chapter.reviewCards ?? []) parts.push(asText(c.front), asText(c.back));
  const plan = chapter.implementationPlan;
  if (plan) {
    parts.push(asText(plan.title), asText(plan.coreSkill), asText(plan.twentyFourHourChallenge), asText(plan.weeklyPractice));
    for (const it of plan.ifThenPlans ?? []) parts.push(asText(it.context), asText(it.plan));
  }
  for (const m of chapter.memorableLines ?? []) parts.push(asText((m as { text?: unknown }).text ?? m));
  return parts.filter((s): s is string => !!s).join("\n");
}

/** The calibration tokenizer: lowercase, letters/apostrophes/hyphens only, length>3,
 *  stopword-dropped. The CHB10 thresholds were measured with EXACTLY this set —
 *  do not swap in FUNCTION_WORDS/contentTokens (different list → different counts). */
const SATURATION_STOP = new Set(("the a an and or but if then else when while of to in on at by for with from as is are was " +
  "were be been being do does did done have has had having it its this that these those you your yours we our us they them " +
  "their he she his her not no yes so than too very can could will would should may might must one two three first second " +
  "third more most less least much many few each every all any some other another same new old good bad big small into over " +
  "under out up down off about after before during between through against because where which who whom whose what why how " +
  "there here also just only even still yet again once twice never always often sometimes usually").split(/\s+/));

function saturationTokens(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z'\s-]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 3 && !SATURATION_STOP.has(w));
}

export const CHB10_BAND_DENSITY = 12; // uses per chapter
export const CHB10_BAND_SPREAD = 0.85; // fraction of chapters
export const CHB10_BAND_ADVISORY = 3; // band words > this → advisory
export const CHB10_BAND_BLOCKER = 6; // band words > this → blocker
export const CHB10_WORD_CEILING = 24; // any single band word above this density → blocker

/** CHB10.lexical_saturation — the book teaches through one saturated vocabulary. */
function checkLexicalSaturation(chapters: ChapterV21[]): BudgetFinding[] {
  const findings: BudgetFinding[] = [];
  const N = chapters.length;
  if (N < 4) return findings; // spread math is meaningless on tiny books
  const freq = new Map<string, number>();
  const spread = new Map<string, Set<number>>();
  const perChapter = new Map<string, Map<number, number>>();
  chapters.forEach((chapter) => {
    for (const w of saturationTokens(fullReaderSurface(chapter))) {
      freq.set(w, (freq.get(w) ?? 0) + 1);
      if (!spread.has(w)) spread.set(w, new Set());
      spread.get(w)!.add(chapter.number);
      if (!perChapter.has(w)) perChapter.set(w, new Map());
      const pc = perChapter.get(w)!;
      pc.set(chapter.number, (pc.get(chapter.number) ?? 0) + 1);
    }
  });
  const band = [...freq.entries()]
    .filter(([w, n]) => n / N >= CHB10_BAND_DENSITY && (spread.get(w)?.size ?? 0) >= CHB10_BAND_SPREAD * N)
    .map(([w, n]) => ({ w, n }))
    .sort((a, b) => b.n - a.n || (a.w < b.w ? -1 : 1));
  if (band.length === 0) return findings;
  // Anchor findings on the chapter that uses the hottest band word most (tie → lowest number).
  const hot = band[0];
  const anchor = [...(perChapter.get(hot.w) ?? new Map<number, number>()).entries()]
    .sort((a, b) => b[1] - a[1] || a[0] - b[0])[0]?.[0] ?? chapters[0].number;
  const describe = band.slice(0, 8).map((b) => `'${b.w}' ${(b.n / N).toFixed(1)}/ch`).join(", ");
  const over = band.filter((b) => b.n / N > CHB10_WORD_CEILING);
  if (band.length > CHB10_BAND_BLOCKER || over.length > 0) {
    findings.push({
      checkId: "CHB10.lexical_saturation",
      severity: "blocker",
      chapterNumber: anchor,
      message:
        `${band.length} content word(s) saturate the book (≥${CHB10_BAND_DENSITY} uses/chapter across ≥${Math.round(CHB10_BAND_SPREAD * 100)}% of chapters)` +
        `${over.length > 0 ? `, ${over.length} above the ${CHB10_WORD_CEILING}/ch ceiling` : ""} — top-5 owner books carry at most 2: ${describe}. ` +
        `The framework is being re-taught at full strength in every chapter; teach through each chapter's case-concrete referents instead.`,
    });
  } else if (band.length > CHB10_BAND_ADVISORY) {
    findings.push({
      checkId: "CHB10.lexical_saturation",
      severity: "advisory",
      chapterNumber: anchor,
      message:
        `${band.length} content word(s) saturate the book (≥${CHB10_BAND_DENSITY}/ch across ≥${Math.round(CHB10_BAND_SPREAD * 100)}% of chapters): ${describe} — ` +
        `above the top-5 profile (≤2, advisory >${CHB10_BAND_ADVISORY}); watch the framework-vocabulary budget.`,
    });
  }
  return findings;
}

/** Sentence starters that mean the scenario did NOT open on a bare actor name. */
const NON_ACTOR_OPENERS = new Set([
  "the", "a", "an", "in", "at", "on", "when", "during", "after", "before", "what", "which",
  "why", "how", "who", "it", "if", "one", "two", "three", "for", "from", "by", "with", "every",
  "each", "some", "most", "this", "that", "there", "imagine", "picture", "consider", "suppose",
]);

export const CHB11_ACTOR_OPENER_CAP = 0.75; // fraction of all examples

/** CHB11.scene_class — one dramaturgy (actor-opener scene) owns the book's examples.
 *  Heuristic classifier → ADVISORY permanently unless a spotless calibration promotes it. */
function checkSceneClassSpread(chapters: ChapterV21[]): BudgetFinding[] {
  const findings: BudgetFinding[] = [];
  let examples = 0;
  let actorOpeners = 0;
  let anchor = chapters[0]?.number ?? 1;
  let anchorMax = -1;
  for (const chapter of chapters) {
    let chapterActor = 0;
    for (const e of chapter.examples ?? []) {
      const scenario = asText(e.scenario).trim();
      if (!scenario) continue;
      examples++;
      const first = (scenario.split(/\s+/)[0] ?? "").replace(/[^A-Za-z'-]/g, "");
      const isActor = /^[A-Z]/.test(first) && !NON_ACTOR_OPENERS.has(first.toLowerCase());
      if (isActor) { actorOpeners++; chapterActor++; }
    }
    if (chapterActor > anchorMax) { anchorMax = chapterActor; anchor = chapter.number; }
  }
  if (examples < 8) return findings;
  const rate = actorOpeners / examples;
  if (rate > CHB11_ACTOR_OPENER_CAP) {
    findings.push({
      checkId: "CHB11.scene_class",
      severity: "advisory",
      chapterNumber: anchor,
      message:
        `${actorOpeners}/${examples} (${Math.round(rate * 100)}%) example scenarios open on a bare actor name — ` +
        `one dramaturgy class is carrying the book (cap ${Math.round(CHB11_ACTOR_OPENER_CAP * 100)}%). ` +
        `Cover the dealt example lenses: ledgers, postmortems, walkthroughs, dialogue, counterfactuals.`,
    });
  }
  return findings;
}

/** The strawman giveaway lexicon — distractors rejectable by TONE without reading the
 *  chapter. Mirrors the calibration regex exactly. */
const STRAWMAN_LEXICON =
  /\b(announce|announcement|slide|slides|deck|polish|polished|morale|optics|sound sharper|look impressive|louder|prettier|fancier|inspir\w*|motivat\w*|slogan|poster)\b/i;

export const CHB12_STRAWMAN_RATE_CAP = 0.07;

/** CHB12.strawman_rate — tone-rejectable distractors above the calibrated book rate. */
function checkStrawmanRate(chapters: ChapterV21[]): BudgetFinding[] {
  const findings: BudgetFinding[] = [];
  let total = 0;
  let straw = 0;
  const samples: string[] = [];
  let anchor = chapters[0]?.number ?? 1;
  let anchorMax = -1;
  for (const chapter of chapters) {
    let chapterStraw = 0;
    for (const q of chapter.quiz?.questions ?? []) {
      const choices = (q.choices ?? []).map((c) => asText(c));
      const k = q.correctIndex;
      const keyShares = typeof k === "number" && choices[k] ? STRAWMAN_LEXICON.test(choices[k]) : false;
      choices.forEach((c, i) => {
        if (i === k || !c) return;
        total++;
        if (!keyShares && STRAWMAN_LEXICON.test(c)) {
          straw++;
          chapterStraw++;
          if (samples.length < 3) samples.push(`ch${String(chapter.number).padStart(2, "0")}: "${c.slice(0, 70)}"`);
        }
      });
    }
    if (chapterStraw > anchorMax) { anchorMax = chapterStraw; anchor = chapter.number; }
  }
  if (total < 30) return findings; // too few distractors for a stable rate
  const rate = straw / total;
  if (rate > CHB12_STRAWMAN_RATE_CAP) {
    findings.push({
      checkId: "CHB12.strawman_rate",
      severity: "blocker",
      chapterNumber: anchor,
      message:
        `${straw}/${total} (${(rate * 100).toFixed(1)}%) distractors are tone-giveaway strawmen (cap ${Math.round(CHB12_STRAWMAN_RATE_CAP * 100)}%; ` +
        `top-5 owner books run 0.5–4.8%): e.g. ${samples.join("; ")}. ` +
        `Build wrong answers from the packet's commonError material — operational alternatives a practitioner would defend.`,
    });
  }
  return findings;
}

/** Words that LEAD a practice clause without being its action verb — temporal
 *  adverbs, quantifiers, and connective glue the clause-walker must step past
 *  (calibration: "once"/"within"/"tonight" firing as verbs on top-5 books). */
const PRACTICE_NON_VERBS = new Set([
  "your", "you", "then", "and", "todays", "today", "tonight", "tomorrow", "once", "twice",
  "within", "until", "while", "over", "next", "first", "last", "later", "now", "right",
  "just", "whenever", "wherever", "anytime", "sometime", "morning", "evening",
]);

/** First imperative-ish verb of a practice field. A clause whose LEAD word is a
 *  subordinator/temporal ("When…", "Before…", "Within the next 24 hours…",
 *  "Once you sit down…") is skipped WHOLE — walking into it returns its subject
 *  noun, not a verb (calibration bug: "once"/"within"/"tonight" fired as verbs). */
function practiceLeadVerb(text: string): string | null {
  const cleaned = asText(text).trim();
  if (!cleaned) return null;
  const clauses = cleaned.split(/[,:;—]\s*/);
  for (const clause of clauses) {
    const first = (clause.trim().split(/\s+/)[0] ?? "").toLowerCase().replace(/[^a-z-]/g, "");
    if (!first) continue;
    if (NON_ACTOR_OPENERS.has(first) || PRACTICE_NON_VERBS.has(first) || /^\d/.test(clause.trim())) continue;
    return first;
  }
  return null;
}

export const CHB13_VERB_FAMILY_CAP_FRACTION = 3; // family cap = ceil(N/3)

/** CHB13.practice_verb_family — one physical-action verb saturating practice items
 *  book-wide ("touch the…" ×5/9 in the halted run — invisible to CHB7's
 *  first-4-words family because the tic sits mid-sentence). ADVISORY (uncalibrated
 *  heuristic; P4's dealt verb registers are the prevention). */
function checkPracticeVerbFamily(chapters: ChapterV21[]): BudgetFinding[] {
  const findings: BudgetFinding[] = [];
  const N = chapters.length;
  if (N < 4) return findings;
  const cap = Math.ceil(N / CHB13_VERB_FAMILY_CAP_FRACTION);
  const byVerb = new Map<string, Set<number>>();
  for (const chapter of chapters) {
    const fields = [chapter.tryThisNow, chapter.implementationPlan?.twentyFourHourChallenge, chapter.implementationPlan?.weeklyPractice];
    for (const f of fields) {
      const verb = practiceLeadVerb(asText(f));
      if (!verb) continue;
      if (!byVerb.has(verb)) byVerb.set(verb, new Set());
      byVerb.get(verb)!.add(chapter.number);
    }
  }
  for (const [verb, chapterSet] of [...byVerb.entries()].sort()) {
    if (chapterSet.size > cap) {
      const nums = [...chapterSet].sort((a, b) => a - b);
      findings.push({
        checkId: "CHB13.practice_verb_family",
        severity: "advisory",
        chapterNumber: nums[0],
        message:
          `practice items lead with "${verb}" in ${chapterSet.size}/${N} chapters (cap ${cap}) — ` +
          `a shared action verb is a book-wide tic; use each chapter's dealt practice verb register.`,
      });
    }
  }
  return findings;
}

// ── CHB14–CHB17: STIER-2 quiz-tell + voice checks (plan docs/v24/STIER2-PLAN-2026-07-03.md §B D-lane) ──
//
// RC2 evidence: ALL FIVE flip-tiebreak events on the halted execution run led with a
// quiz-tell must-fix; ~50% of its 81 questions were keyword-guessable; the stem
// opener mold "A/An <role> <verb>…" covered 26/81 stems; preflight tellRate was 78%
// of all first-pass failures. CHB14/15 are the deterministic backstops behind the
// card's TRANSFORM recipe. Enforcement tiers follow the standing calibration rule
// (zero-FP on the top-5 owner books AND above the deal's own worst-case mint, else
// ADVISORY) — measured in docs/v24 STIER-2 calibration; see the constants below.

/** CHB14: per-chapter signature vocabulary = the top-K saturation tokens of the
 *  chapter's own reader surface (computable, tokenizer-pinned like CHB10). */
export const CHB14_SIGNATURE_TOP_K = 12;
/** A tell = the KEY uniquely carries ≥ this many more signature tokens than the
 *  strongest distractor (unique tokens, key-shares-neutralized). */
export const CHB14_TELL_MARGIN = 2;
/** TELEMETRY-ONLY parameters. Calibration 2026-07-03 found this metric INVERTED
 *  (top-5 books 14.3–23.5% vs halted execution 11.1%) — no gate uses these caps;
 *  they exist so future recalibrations measure against a fixed definition. */
export const CHB14_CHAPTER_RATE_CAP = 0.34;
export const CHB14_BOOK_RATE_CAP = 0.2;

/** Raw CHB14 measurement — exported for the calibration harness (tiers are set from
 *  measured top-5 vs halted rates, never promised; plan §B principle 2). */
export function measureQuizKeyEcho(chapters: ChapterV21[]): {
  bookTells: number;
  bookQuestions: number;
  bookRate: number;
  perChapter: Array<{ n: number; tells: number; qs: number; rate: number }>;
  samples: string[];
} {
  let bookTells = 0;
  let bookQuestions = 0;
  const perChapter: Array<{ n: number; tells: number; qs: number; rate: number }> = [];
  const samples: string[] = [];
  for (const chapter of chapters) {
    const counts = new Map<string, number>();
    for (const w of saturationTokens(fullReaderSurface(chapter))) counts.set(w, (counts.get(w) ?? 0) + 1);
    const signature = new Set(
      [...counts.entries()]
        .sort((a, b) => (b[1] - a[1]) || (a[0] < b[0] ? -1 : 1))
        .slice(0, CHB14_SIGNATURE_TOP_K)
        .map(([w]) => w),
    );
    let tells = 0;
    let qs = 0;
    for (const q of chapter.quiz?.questions ?? []) {
      const choices = (q.choices ?? []).map((c) => asText(c));
      const k = q.correctIndex;
      if (typeof k !== "number" || !choices[k] || choices.length < 3) continue;
      qs++;
      const hitSets = choices.map((c) => {
        const set = new Set<string>();
        for (const w of saturationTokens(c)) if (signature.has(w)) set.add(w);
        return set;
      });
      // Shares exception: a signature token present in ≥ half the choices is the
      // question's TOPIC, not a tell — neutralize it for every choice.
      const shared = new Set<string>();
      for (const w of signature) {
        const holders = hitSets.filter((s) => s.has(w)).length;
        if (holders * 2 >= choices.length) shared.add(w);
      }
      const scores = hitSets.map((s) => [...s].filter((w) => !shared.has(w)).length);
      const keyScore = scores[k];
      const maxDistractor = Math.max(...scores.filter((_, i) => i !== k));
      if (keyScore >= maxDistractor + CHB14_TELL_MARGIN) {
        tells++;
        if (samples.length < 3) samples.push(`ch${String(chapter.number).padStart(2, "0")} ${q.questionId ?? `q${qs}`}: key carries ${keyScore} signature word(s), best distractor ${maxDistractor}`);
      }
    }
    bookTells += tells;
    bookQuestions += qs;
    perChapter.push({ n: chapter.number, tells, qs, rate: qs > 0 ? tells / qs : 0 });
  }
  return { bookTells, bookQuestions, bookRate: bookQuestions > 0 ? bookTells / bookQuestions : 0, perChapter, samples };
}

// NOTE: there is deliberately NO checkQuizKeyEcho gate. Calibration (2026-07-03)
// measured this metric INVERTED — top-5 owner books 14.3–23.5% vs halted 11.1% —
// so a gate here would block exactly the books the owner scored highest. The
// measurement stays (above) for telemetry and future recalibration only.

/** CHB15: stem-opener WORDING mold — first-3-token signature with function words kept
 *  literal and content words classed as W ("A manager is looking…" → "a W is"). The
 *  halted run put one mold on 32% of stems; the dealt stem SHAPES cannot mint a
 *  wording mold (wording repetition is banned separately), so the deal-detector
 *  invariant holds by construction. */
/** TELEMETRY-ONLY (same calibration verdict as CHB14 — the "a W W" mold is the
 *  genre-standard stem: 32–81% of TOP-5 stems). No gate uses this cap. */
export const CHB15_MOLD_SHARE_CAP = 0.3;
const CHB15_FUNCTION_WORDS = new Set([
  "a", "an", "the", "your", "you", "when", "while", "during", "after", "before", "in",
  "at", "on", "for", "to", "of", "is", "are", "was", "has", "have", "suppose", "imagine",
  "consider", "which", "what", "who", "how", "why", "if", "two", "one",
]);

function stemOpenerSignature(prompt: string): string | null {
  const words = prompt.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter(Boolean);
  if (words.length < 3) return null;
  return words.slice(0, 3).map((w) => (CHB15_FUNCTION_WORDS.has(w) ? w : "W")).join(" ");
}

/** Raw CHB15 measurement — exported for the calibration harness. */
export function measureStemOpenerMolds(chapters: ChapterV21[]): {
  total: number;
  molds: Array<{ sig: string; count: number; share: number; chapterCount: number; sample: string }>;
} {
  const bySig = new Map<string, { count: number; chapters: Set<number>; sample: string }>();
  let total = 0;
  for (const chapter of chapters) {
    for (const q of chapter.quiz?.questions ?? []) {
      const prompt = asText(q.prompt);
      const sig = stemOpenerSignature(prompt);
      if (!sig) continue;
      total++;
      const rec = bySig.get(sig) ?? { count: 0, chapters: new Set<number>(), sample: prompt.slice(0, 60) };
      rec.count++;
      rec.chapters.add(chapter.number);
      bySig.set(sig, rec);
    }
  }
  const molds = [...bySig.entries()]
    .map(([sig, rec]) => ({ sig, count: rec.count, share: total > 0 ? rec.count / total : 0, chapterCount: rec.chapters.size, sample: rec.sample }))
    .sort((a, b) => b.share - a.share);
  return { total, molds };
}

// NOTE: there is deliberately NO checkStemOpenerMold gate and NO CHB17 abstract-opener
// gate. Calibration (2026-07-03): the "a W W" stem mold covers 32–81% of TOP-5 stems vs
// 47% of halted stems (inverted — the mold is the genre-standard stem), and abstract-
// opener runs fire on 3/5 top-5 books. Stem/voice variety is carried by the DEALT stem
// shapes + the wording self-check + the VOICE card block, judged by the blinded readers.

/** C2: the deterministic churn-evidence report the acceptance-reject repair
 *  round hands to targeted writers — the CHB10–13 measurements over the CURRENT
 *  bytes, formatted as complaint lines. Cross-chapter context is deliberately
 *  allowed HERE (and only here): this is the post-acceptance repair round, and
 *  the leak IS the repair signal (plan §Round-2 #22). */
export function buildChurnEvidenceReport(chapters: ChapterV21[]): string[] {
  const ordered = [...chapters].sort((a, b) => a.number - b.number);
  const findings = [
    ...checkLexicalSaturation(ordered),
    ...checkSceneClassSpread(ordered),
    ...checkStrawmanRate(ordered),
    ...checkPracticeVerbFamily(ordered),
    // CHB14/15/17 deliberately absent: calibration showed the top-5 books measure
    // WORSE on them than the halted bytes — evidence built on those meters would
    // push writers AWAY from what owner-scored books look like.
  ];
  if (findings.length === 0) return ["measured churn evidence: none of the deterministic cross-chapter meters fire — the sameness the readers named is in surfaces the meters cannot see; diverge on rhetoric, scene texture, and sentence rhythm."];
  return findings.map((f) => `measured (${f.checkId}): ${f.message}`);
}

/** C2/#21: rank chapters by their contribution to the book's lexical saturation
 *  (per-chapter usage of the book's band words; ties → lower chapter number).
 *  Used to pick evidence-driven regen targets among the sampled chapters. */
export function rankSaturationContributors(chapters: ChapterV21[]): number[] {
  const ordered = [...chapters].sort((a, b) => a.number - b.number);
  const N = ordered.length;
  if (N === 0) return [];
  const freq = new Map<string, number>();
  const spread = new Map<string, Set<number>>();
  const perChapterTokens = new Map<number, string[]>();
  for (const chapter of ordered) {
    const tokens = saturationTokens(fullReaderSurface(chapter));
    perChapterTokens.set(chapter.number, tokens);
    for (const w of tokens) {
      freq.set(w, (freq.get(w) ?? 0) + 1);
      if (!spread.has(w)) spread.set(w, new Set());
      spread.get(w)!.add(chapter.number);
    }
  }
  const band = new Set(
    [...freq.entries()]
      .filter(([w, n]) => n / N >= CHB10_BAND_DENSITY && (spread.get(w)?.size ?? 0) >= CHB10_BAND_SPREAD * N)
      .map(([w]) => w),
  );
  const score = new Map<number, number>();
  for (const chapter of ordered) {
    score.set(chapter.number, (perChapterTokens.get(chapter.number) ?? []).filter((w) => band.has(w)).length);
  }
  return ordered
    .map((c) => c.number)
    .sort((a, b) => (score.get(b)! - score.get(a)!) || (a - b));
}

/** Budget-repair complaint builder (live-added 2026-07-03 after the first S-tier
 *  run BLOCKED at the write-phase budgets): per-chapter, evidence-specific
 *  complaints for the ONE bounded repair round. Only the two blocking checks
 *  route repairs — advisories never spend writers. Each complaint names the
 *  chapter's OWN offenders (its band-word counts, its strawman hits verbatim)
 *  so nine parallel repair writers don't get one identical pack (C2's #21). */
export function buildBudgetRepairComplaints(chapters: ChapterV21[], blockers: BudgetFinding[]): Map<number, string[]> {
  const ordered = [...chapters].sort((a, b) => a.number - b.number);
  const N = ordered.length;
  const out = new Map<number, string[]>();
  const add = (n: number, line: string): void => {
    const list = out.get(n) ?? [];
    list.push(line);
    out.set(n, list);
  };
  const blocked = (id: string): boolean => blockers.some((f) => f.checkId === id);

  // CHB2 length findings carry a structured chapterNumber and the exact window —
  // route them as targeted trim/expand complaints (STIER-3 live-caught: a chapter
  // regenned in the REVIEW phase skips the write-exit length check until the NEXT
  // conductor entry, which then halted "no repair-routable evidence" over a 1.6%
  // overflow on an 87-scoring chapter).
  for (const f of blockers) {
    if (f.checkId !== "CHB2.length_budget" || !Number.isInteger(f.chapterNumber)) continue;
    const est = /length (\d+) chars/.exec(f.message);
    const win = /allowed window (\d+)[–-](\d+)/.exec(f.message);
    if (!est || !win) continue;
    const estimated = parseInt(est[1], 10);
    const lo = parseInt(win[1], 10);
    const hi = parseInt(win[2], 10);
    if (![estimated, lo, hi].every(Number.isInteger)) continue;
    if (estimated > hi) {
      // Live-tuned (B18 round 2): "cut ~N" got minimal compliance — a 509-char ask
      // returned a 199-char cut and the re-check halted 110 over. State the LANDING
      // ZONE, not the delta, and demand overshoot.
      // B18c: the writer has NO local instrument for length (gate + preflight both
      // pass), so a session can believe it is done without editing — one left the
      // chapter byte-identical. Ship the measurement command IN the complaint.
      const chapterId = ordered.find((c) => c.number === f.chapterNumber)?.chapterId ?? "";
      const relPath = `state/chapters/${chapterId}.v21-native.chapter.json`;
      add(f.chapterNumber as number, `length budget: this chapter renders ~${estimated} chars; the HARD ceiling is ${hi} and a re-check above it halts the whole book. You MUST edit the file — returning it unchanged fails the round. Land the chapter at ${hi - 800}–${hi - 300} chars: delete whole sentences that restate a point already made, starting with the longest breakdown tier; never compress into fragments, never touch the quiz keys or the dealt structure. VERIFY before you finish (the number must print between ${hi - 800} and ${hi - 300}): npx tsx -e "const{estimatedRenderedChars}=require('./src/critics/readerBudgets.ts');console.log(estimatedRenderedChars(JSON.parse(require('fs').readFileSync('${relPath}','utf8'))))"`);
    } else if (estimated < lo) {
      add(f.chapterNumber as number, `length budget: this chapter renders ~${estimated} chars against a floor of ${lo} — add ~${lo - estimated + 200} chars of TEACHING (a concrete beat inside an existing example or breakdown tier), never filler or restatement.`);
    }
  }

  // CHB1 anchor-hammering (FINAL-HARDENING-PLAN 2026-07-04): a case's distinctive
  // token repeated over the per-chapter cap. Fully routable — the finding carries
  // the chapter, the exact token, its count, and the cap. Without this the block
  // hard-halts with "no repair-routable evidence" and no automated recovery (the
  // gap start-with-why hit: 9 CHB1 blockers across 5 chapters). Per-chapter,
  // evidence-first (the proven repair pattern), and mechanically checkable.
  for (const f of blockers) {
    if (f.checkId !== "CHB1.anchor_repetition" || !Number.isInteger(f.chapterNumber)) continue;
    const m = /mentions "([^"]+)" \(distinctive token of case "([^"]+)"\) (\d+) times — over the per-chapter cap of (\d+)/.exec(f.message);
    if (!m) continue;
    const [, token, label, countStr, capStr] = m;
    const count = parseInt(countStr, 10);
    const cap = parseInt(capStr, 10);
    if (!Number.isInteger(count) || !Number.isInteger(cap)) continue;
    add(f.chapterNumber as number,
      `anchor hammering (CHB1): the reading surface (counterintuition, tryThisNow, keyTakeaway, breakdown tiers) names "${token}" ${count} times for the case "${label}" — the per-chapter ceiling is ${cap} and a re-check above it halts the whole book. Cut it to AT MOST ${cap}: after the first full naming, refer to it with a pronoun, its role, or a shorter alias, and delete mentions that merely repeat what a sentence already established. Keep every fact, actor, number, and the case's substance — change only how often you REPEAT the distinctive word. Do not touch the quiz keys or the dealt structure.`);
  }

  if (blocked("CHB10.lexical_saturation") && N >= 4) {
    const freq = new Map<string, number>();
    const spread = new Map<string, Set<number>>();
    const perChapter = new Map<number, Map<string, number>>();
    for (const chapter of ordered) {
      const pc = new Map<string, number>();
      for (const w of saturationTokens(fullReaderSurface(chapter))) {
        freq.set(w, (freq.get(w) ?? 0) + 1);
        if (!spread.has(w)) spread.set(w, new Set());
        spread.get(w)!.add(chapter.number);
        pc.set(w, (pc.get(w) ?? 0) + 1);
      }
      perChapter.set(chapter.number, pc);
    }
    const band = [...freq.entries()]
      .filter(([w, n]) => n / N >= CHB10_BAND_DENSITY && (spread.get(w)?.size ?? 0) >= CHB10_BAND_SPREAD * N)
      .map(([w]) => w);
    for (const chapter of ordered) {
      const counts = band
        .map((w): [string, number] => [w, perChapter.get(chapter.number)?.get(w) ?? 0])
        .filter(([, c]) => c >= CHB10_BAND_DENSITY)
        .sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1));
      if (counts.length === 0) continue;
      add(chapter.number,
        `budget repair (CHB10.lexical_saturation): the BOOK is blocked because the same words saturate every chapter. ` +
        `YOUR chapter uses ${counts.map(([w, c]) => `'${w}' ${c}×`).join(", ")}. Rewrite with a HARD ceiling of 8 uses for each listed word — this repair ceiling OVERRIDES your brief's vocabulary budget for the listed words only (the book is saturated; the brief's per-chapter allowance no longer applies to them) — ` +
        `replace the overflow with this chapter's case-concrete referents (the named person, the named artifact, the number), never a stilted synonym. ` +
        `Keep the teaching identical; change only the telling.`);
    }
  }

  if (blocked("CHB12.strawman_rate")) {
    for (const chapter of ordered) {
      const hits: string[] = [];
      for (const q of chapter.quiz?.questions ?? []) {
        const choices = (q.choices ?? []).map((c) => asText(c));
        const k = q.correctIndex;
        const keyShares = typeof k === "number" && choices[k] ? STRAWMAN_LEXICON.test(choices[k]) : false;
        choices.forEach((c, i) => {
          if (i === k || !c || keyShares) return;
          if (STRAWMAN_LEXICON.test(c)) hits.push(c.slice(0, 90));
        });
      }
      if (hits.length === 0) continue;
      add(chapter.number,
        `budget repair (CHB12.strawman_rate): the BOOK is blocked because too many distractors are tone-giveaway strawmen. ` +
        `These are YOURS — rebuild each from the source packet's commonError material into an operational alternative a practitioner would defend: ` +
        `${hits.slice(0, 4).map((h) => `"${h}"`).join("; ")}${hits.length > 4 ? ` (+${hits.length - 4} more — scan all 18 distractors)` : ""}.`);
    }
  }

  // CHB14/15 repair blocks deliberately absent — those meters never gate (see the
  // calibration verdict at the CHB14/15 measure functions above).
  return out;
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
    ...checkOpenerClassBudget(ordered),
    ...checkScaffoldAndPhraseSpread(ordered, opts?.packets),
    ...checkTellDistribution(ordered, opts?.packets),
    ...checkPracticeBudgets(ordered),
    ...checkLexicalSaturation(ordered),
    ...checkSceneClassSpread(ordered),
    ...checkStrawmanRate(ordered),
    ...checkPracticeVerbFamily(ordered),
    // STIER-2 D-lane calibration VERDICT (2026-07-03): CHB14 (quiz key echo) and
    // CHB15 (stem opener mold) measured INVERTED on the corpus — the top-5
    // owner-scored books run HIGHER on both metrics than the halted execution
    // bytes (CHB14 book rate: top-5 14.3–23.5% vs halted 11.1%; CHB15 "a W W"
    // mold: top-5 32–81% vs halted 47%). No separating threshold exists, so per
    // the standing rule NO gate ships — the reviewer-flagged quiz tells are
    // SEMANTIC (most-specific / only-operational choice), not lexical. The
    // measure functions stay exported for telemetry; the quiz lever lives in the
    // card's TRANSFORM recipe + dealt stem shapes + the blinded reviewers (who
    // catch these — all 5 halted-run tiebreaks led with quiz-tell must-fixes).
    // CHB17 (abstract-opener runs) also fired on 3/5 top-5 books → same verdict.
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
