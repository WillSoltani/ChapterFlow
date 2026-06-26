/**
 * Prose-quality critics — catch the things that make reading boring even when
 * register critics pass. These are heuristics, not semantic checks; they err
 * toward flagging rather than missing.
 *
 * Design principle: every check should correspond to a concrete reading
 * experience complaint from the user. If I can't justify a flag as "this would
 * make a reader bounce", it doesn't belong here.
 */

import { CriticFinding } from "../types.js";
import { finding, truncate } from "./shared.js";
import { splitSentences } from "./textUtils.js";
import { contentLemmaSet } from "./intraBookFieldSimilarity.js";

/**
 * Concrete-opener ratio across paragraphs.
 *
 * Most common reader feedback on early v21 books was "wordy / hard to
 * follow" even though Flesch-Kincaid grade was low. The cause: too many
 * paragraphs open with abstract claims ("The practical test is cold",
 * "There is a limit", "Most people want…") rather than concrete moments.
 * HWF opens ~67% of paragraphs with a named person, time, or scene image.
 * Antifragile shipped at ~50%, which felt aphoristic to readers.
 *
 * This critic counts paragraphs opening with SCENIC vs ABSTRACT patterns.
 * Fires MAJOR when <40% are scenic OR >50% are abstract in a tier.
 */

// Patterns that signal an aphoristic/rule-stating opener — the
// "wordy / hard to follow" complaint pattern. Concrete openers (named
// people, second-person address, imperatives, time anchors, scenes) are
// hard to enumerate exhaustively, so we don't try; we only flag when too
// many openers match these abstract patterns.
const ABSTRACT_OPENERS = [
  // "The X is/was..." with a conceptual X
  /^The\s+(mechanism|move|rule|limit|answer|principle|point|practice|practical|antifragile|stronger|better|old|new|right|wrong|hard|simple|deeper|deepest|main|first|second|third|whole|same|other|only|key|truth|fact|test|trick|lesson|catch|trap|payoff|cost|risk|gain|loss|effect|cause|reason|problem|solution|reality|theory|model|system|approach|method|tactic|strategy|essential|essence|nature|function|purpose|pattern|structure|hierarchy)\b/i,
  // "There is/are/was/were"
  /^There\s+(is|are|was|were)\s+/i,
  // "Most + plural noun"
  /^Most\s+(?:[a-z]+\s)?(people|readers|leaders|teams|managers|workers|adults|things|days|moments|situations|cases|problems|decisions|choices)/i,
  // "This is/means/requires" without an explicit subject reference
  /^This\s+(is|means|requires|matters|works|fails|happens|points|reveals|gives|leads|forces|prevents|allows)\b/i,
  // "It is/matters/comes down" without subject
  /^It\s+(is|matters|works|comes|takes|fails|happens)\b/i,
  // "A rule/principle/etc. that..."
  /^A\s+(rule|wreck|fact|principle|forecast|model|theory|framework|method|tactic|policy|strategy)\s+(is|that)/i,
  // "Antifragility/Resilience/Optionality is" — bare abstract noun opener
  /^(Antifragility|Resilience|Optionality|Mastery|Discipline|Pressure|Instinct|Knowledge|Power|Strength|Wisdom|Authority|Trust|Truth|Reality|Time|Pressure|Performance)\s+(is|was|comes|begins|ends|works|fails|matters)\b/i,
  // Numbered rule list ("First, X. Second, Y.")
  /^(First|Second|Third|Fourth|Fifth|Last|Finally),\s+/i,
];

function isAbstractOpener(paragraph: string): boolean {
  const first = paragraph.trim().split(/(?<=[.!?])\s+/)[0]?.trim() ?? "";
  return ABSTRACT_OPENERS.some((re) => re.test(first));
}

/**
 * Flags a prose tier when more than 40% of paragraphs open with abstract
 * rule-stating patterns. This catches the "aphoristic stack" failure mode
 * where Flesch-Kincaid grade looks fine but readers find the prose hard
 * to follow because every paragraph starts with a generic claim instead
 * of a scene. Severity MAJOR (E4) — surfaced for the writer to fix but
 * doesn't block, since some legitimate stylistic choices may also trip
 * this and the call belongs to the operator.
 */
export function checkConcreteParagraphOpeners(text: string, unitLabel: string): CriticFinding[] {
  const paragraphs = text.split(/\n\s*\n/).map((p) => p.trim()).filter((p) => p.length >= 40);
  if (paragraphs.length < 3) return [];

  let abstract = 0;
  for (const p of paragraphs) {
    if (isAbstractOpener(p)) abstract += 1;
  }
  const total = paragraphs.length;
  const abstractPct = (abstract / total) * 100;

  if (abstractPct > 40) {
    return [finding(
      "register.no_meta_reference" as any,
      "major",
      `${unitLabel}: ${abstract}/${total} (${abstractPct.toFixed(0)}%) of paragraphs open with abstract claims ("The X is…", "There is…", "Most people…", numbered-rule lists). Open with scenes, named characters, or direct address to the reader instead.`,
    )];
  }
  return [];
}

/**
 * Opening concreteness: the first sentence should contain a concrete anchor —
 * a named person, a specific time, a concrete object, or a direct question.
 * Abstract definitional openers ("Cognitive ease is the feeling of...") are
 * boring.
 */
export function checkOpeningConcreteness(text: string, unitLabel: string): CriticFinding[] {
  const first = firstSentence(text);
  if (!first || first.length < 20) return [];

  // Definitional openers are the biggest offender.
  const definitionalStart = /^(?:[A-Z]\w+\s+)?(?:is|are|refers to|means|describes)\s+(?:the|a|an)\s+/i;
  if (definitionalStart.test(first)) {
    return [finding(
      "register.no_meta_reference" as any, // reuse an existing check id; this critic is advisory
      "minor",
      `${unitLabel}: opens with a definition — start with a scene, a specific image, or a direct question instead`,
      first,
    )];
  }
  // Generic abstract openers.
  const genericStart = /^(?:The (?:mind|brain|self|fast process|slow process|subconscious)|Most people|Everyone|We all)/;
  if (genericStart.test(first)) {
    return [finding(
      "register.no_meta_reference" as any,
      "minor",
      `${unitLabel}: opens with a generic abstraction — reach for a specific protagonist or moment`,
      first,
    )];
  }
  return [];
}

/**
 * Paragraph-start repetition: if multiple paragraphs in the same text start
 * with the same 2-word phrase (e.g., "The chapter…", "The mind…"), it signals
 * omniscient-instructor register.
 */
export function checkParagraphStartVariety(text: string, unitLabel: string): CriticFinding[] {
  const paragraphs = text.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  if (paragraphs.length < 2) return [];
  const starts = paragraphs.map((p) => p.split(/\s+/).slice(0, 2).join(" ").toLowerCase());
  const counts = new Map<string, number>();
  for (const s of starts) counts.set(s, (counts.get(s) ?? 0) + 1);
  const findings: CriticFinding[] = [];
  for (const [start, n] of counts.entries()) {
    if (n >= 2 && paragraphs.length >= 3) {
      findings.push(finding(
        "register.no_meta_reference" as any,
        "minor",
        `${unitLabel}: ${n} paragraphs open with "${start}" — vary paragraph openers`,
        start,
      ));
    }
  }
  return findings;
}

/**
 * Cadence variance: a run of 4+ sentences where every sentence is longer than
 * 25 words is a drone. Good prose breaks up long sentences with shorter ones.
 */
export function checkCadenceVariance(text: string, unitLabel: string): CriticFinding[] {
  const sentences = splitSentences(text);
  if (sentences.length < 4) return [];
  let longRun = 0;
  let maxRun = 0;
  for (const s of sentences) {
    const wc = s.split(/\s+/).length;
    if (wc >= 25) {
      longRun += 1;
      if (longRun > maxRun) maxRun = longRun;
    } else {
      longRun = 0;
    }
  }
  if (maxRun >= 4) {
    return [finding(
      "register.no_meta_reference" as any,
      "minor",
      `${unitLabel}: ${maxRun} long sentences (≥25 words) in a row — break up the cadence with a short sentence`,
    )];
  }
  return [];
}

// ── Monotone SHORT-sentence rhythm (E8) — the short-side twin of checkCadenceVariance ──
//
// checkCadenceVariance (above) catches the long-drone failure: a run of ≥25-word
// sentences. The OPPOSITE failure — choppy/listy prose where every sentence is the
// same short length — has no detector. New v21 books read listy precisely here
// ("Defaults handle small repeat calls. Routines keep daily choices from reopening.
// Option limits stop search loops…"): a stack of ~5-6-word declaratives with no long
// flowing sentence to break them up.
//
// CALIBRATION NOTE (load-bearing — deviates from the original Finding #6 spec, and
// calibrated against the labeled regression corpus in tests/fixtures/regressions.ts).
//
// (1) The finding proposed a coefficient-of-variation floor (CoefVar < 0.50), on the
// premise that the gold books "sit ~0.58-0.61". Measured against the ACTUAL gold
// corpus (real daring-greatly + start-with-why, 66 tiers) that premise is false:
// gold tiers sit anywhere from CoefVar 0.157 (start-with-why fastReads are short and
// uniform by design) to 0.62. A 0.50 floor fires on the MAJORITY of gold tiers — the
// exact "fires harder on the clean book" trap the calibration law warns about. So the
// CoefVar arm is dropped. What separates the defect cleanly is SHORTNESS *and* tight
// UNIFORMITY together: the defect is a run of short sentences all the same short
// length, whereas gold's low-variance passages are uniform at a HEALTHY length (mean
// ~12-15) and gold's genuine staccato (e.g. daring-greatly ch04 fastRead) varies the
// short-sentence lengths within the run. A run of ≥MIN_RUN consecutive sentences each
// ≤SHORT_MAX words AND within a ≤BAND-word spread tops out at 6 across the whole gold
// corpus, so MIN_RUN=7 is zero-FP on gold.
//
// (2) MEAN floor — excludes deliberate telegraphic action-sequences. Run against the
// defect corpus (willpower / atomic-habits / the tiny-habits regen), the run rule above
// also fires on atomic-habits-ch12's intentional cello-routine staccato ("Door opens,
// 6:40. Coat off, shoes off. Case in the hall closet. Unzip, kneeling…") — a vivid,
// reference-quality device, not the dull-exposition defect. That passage's run MEAN is
// ~3.2 words/sentence; the genuine monotone-EXPOSITORY defects (willpower-ch07,
// tiny-habits-regen ch01/ch06) all sit at ~6.0-6.5. A run-mean floor of 4.5 keeps every
// real defect and drops the telegraphic device, scoping the critic to the documented
// failure (uniform short *declaratives*, not punchy action fragments).
const E8_SHORT_MAX = 9;   // a "short" sentence: ≤9 words
const E8_BAND = 3;        // tightly uniform: max−min length across the run ≤3 words
const E8_MIN_RUN = 7;     // ≥7 such sentences back-to-back reads as a list, not prose
const E8_MEAN_MIN = 4.5;  // run mean ≥4.5 words — excludes telegraphic action-sequences
const E8_FIX =
  "Vary the rhythm: break the run with at least one long (>20-word) flowing sentence, " +
  "and let the lengths differ. Uniform short declaratives read like a list, not prose.";

export type MonotoneShortRun = {
  /** Index of the first sentence in the longest qualifying run. */
  start: number;
  /** Number of consecutive sentences in the run (≥ E8_MIN_RUN when it fires). */
  length: number;
  /** The run's sentences, in order, for evidence. */
  sentences: string[];
};

/**
 * Pure detector: the longest run of consecutive sentences that are ALL short
 * (≤E8_SHORT_MAX words) AND tightly uniform (length spread ≤E8_BAND), or null when
 * no run reaches E8_MIN_RUN. Exhaustively unit-testable (text → run | null).
 */
export function findMonotoneShortRun(text: string): MonotoneShortRun | null {
  const sentences = splitSentences(text);
  if (sentences.length < E8_MIN_RUN) return null;
  const lens = sentences.map((s) => s.split(/\s+/).filter(Boolean).length);

  let best: MonotoneShortRun | null = null;
  for (let i = 0; i < lens.length; i++) {
    let mn = Infinity;
    let mx = -Infinity;
    let sum = 0;
    for (let j = i; j < lens.length; j++) {
      if (lens[j] > E8_SHORT_MAX) break;
      mn = Math.min(mn, lens[j]);
      mx = Math.max(mx, lens[j]);
      if (mx - mn > E8_BAND) break;
      sum += lens[j];
      const length = j - i + 1;
      // A run fires only when it is long enough, tightly uniform, AND its sentences
      // average ≥E8_MEAN_MIN words — the last clause excludes telegraphic action
      // staccato (mean ~3) while keeping monotone exposition (mean ~6).
      if (length >= E8_MIN_RUN && sum / length >= E8_MEAN_MIN && (!best || length > best.length)) {
        best = { start: i, length, sentences: sentences.slice(i, j + 1) };
      }
    }
  }
  return best;
}

/**
 * Monotone short-sentence rhythm (E8). Fires when a tier contains a run of short,
 * same-length sentences long enough to read as a list rather than prose. The
 * short-side twin of checkCadenceVariance's long-drone arm. Shadow MAJOR — surfaces
 * as QC debt; calibrated zero-FP on the gold corpus (see CALIBRATION NOTE above).
 */
export function checkSentenceLengthVariance(text: string, unitLabel: string): CriticFinding[] {
  const run = findMonotoneShortRun(text);
  if (!run) return [];
  return [finding(
    "E8.monotone_cadence" as any,
    "major",
    `${unitLabel}: ${run.length} short, same-length sentences in a row — "${truncate(run.sentences.join(" "), 60)}" reads as a list (monotone cadence). ${E8_FIX}`,
    truncate(run.sentences.join(" "), 200),
  )];
}

// ── Idea density (E9 / #12) — the OVER-LENGTH / low-idea-density measure, and ──
//    why NO deterministic gate ships ───────────────────────────────────────────
//
// THE DEFECT (#12, catalogued as `MB4.low_idea_density`). One idea stretched across
// many paragraphs to hit the A15 char floor: words accrue, the reader learns nothing
// new. A15 floors tier length from BELOW; nothing caps it from above, and "padding" has
// no lexical signature a counter can see.
//
// REFUTED ON THE GOLD CORPUS (calibration law, non-negotiable). The finding proposed
// firing "below a distinct-content-lemma-per-1000-chars floor". Measured against the REAL
// gold (daring-greatly 21 tiers + start-with-why 42 tiers) the premise is FALSE on every
// formulation tried — the reference books sit AT or BELOW the only available defect source
// (the reverted tiny-habits regen, 24 tiers; willpower/atomic-habits packages are CI-absent):
//
//   formulation                          regen defect         real gold              separates?
//   distinct lemmas / 1000 chars         min 57.7  p50 69.7   min 59.4 (sww-ch11)    NO  (gold lower)
//   type-token ratio                     min 0.688            min 0.663 (dg-ch01)    NO  (gold lower)
//   stale-sentence fraction              max 0.075            max 0.167 (sww-ch13)   NO  (gold higher)
//   structural skeleton-repeat           max 0.095            max 0.083 (dg, a 3× frame)  NO (overlap)
//   intra-tier repeated content-trigram  distinctRep 2        distinctRep 1          artifact*
//
//   * the lone "separation" is the Fogg formula "behavior = motivation + ability + prompt"
//     stated twice (regen) vs "celery rice milk" / the celery test (gold) — both legitimate
//     CONCEPT-NAME repetition, a one-count margin, not padding. True paraphrase-padding
//     produces no verbatim n-gram repeat by construction (that is why B15 uses Jaccard, not
//     n-grams). So it measures the wrong thing on a coin-flip margin.
//
// There is no floor that fires on the defect without firing HARDER on the reference books —
// the exact "fires on the clean book" trap the law warns about (cf. the dropped E8 CoefVar
// arm, the reverted SC9 blocker, the empty ENFORCED_MAJOR). So NO E9 gate is registered —
// not even shadow-minor: a check that fires on gold is rejected (Law 2), and a check that
// fires on nothing is also rejected; #12 has NEITHER a clean true-positive NOR a zero-FP
// threshold at the lexical level. The defect is genuinely semantic (does this paragraph
// ADVANCE the argument?), which a lemma counter cannot judge.
//
// WHAT SHIPS INSTEAD. (1) PREVENTION — the write-time rule that actually buys first-pass
// quality (STEP-2 `R11` + Step 5 / writer-breakdown "length follows substance"). (2) The
// JUDGMENT — owned by the semantic `prose_coherence` bar axis (FAILURE-MODES `MB4`, the
// WT-E clause), which reads whether a paragraph earns its length where a counter cannot.
// `measureIdeaDensity` is exposed ONLY so the calibration test (tests/idea-density.test.ts)
// can PIN this refutation and stop a future engineer re-deriving the gate.
export type IdeaDensity = {
  /** Distinct content lemmas per 1000 chars — the spec's proposed "idea density". */
  lemmaDensityPerKchar: number;
  /** Distinct content lemmas / total content tokens (length-normalized richness). */
  typeTokenRatio: number;
  /** Fraction of sentences (after the first two) that add ZERO new content lemma — the
   *  closest lexical proxy for "restating one idea to pad length". */
  staleSentenceFraction: number;
};

/**
 * Pure lexical idea-density measure (text → {density, ttr, stale}). NOT a gate — see the
 * note above for why a floor over any of these fields fires harder on the gold corpus than
 * on the defect. Exposed for the calibration/refutation test only.
 */
export function measureIdeaDensity(text: string): IdeaDensity {
  // Ordered content-lemma stream (duplicates preserved) — contentLemmaSet dedups, so build
  // the stream token-by-token to keep total-token counts honest for the type-token ratio.
  const ordered: string[] = [];
  for (const tok of text.split(/[^a-zA-Z]+/)) {
    for (const l of contentLemmaSet(tok)) ordered.push(l);
  }
  const distinct = new Set(ordered).size;
  const lemmaDensityPerKchar = text.length > 0 ? distinct / (text.length / 1000) : 0;
  const typeTokenRatio = ordered.length > 0 ? distinct / ordered.length : 1;

  const sentences = splitSentences(text).filter((s) => s.split(/\s+/).filter(Boolean).length >= 4);
  const seen = new Set<string>();
  let stale = 0;
  let counted = 0;
  sentences.forEach((s, i) => {
    const lemmas = [...contentLemmaSet(s)];
    const addsNew = lemmas.some((l) => !seen.has(l));
    for (const l of lemmas) seen.add(l);
    if (i >= 2) {
      counted += 1;
      if (!addsNew) stale += 1;
    }
  });
  const staleSentenceFraction = counted > 0 ? stale / counted : 0;
  return { lemmaDensityPerKchar, typeTokenRatio, staleSentenceFraction };
}

/**
 * First-sentence identity check between multiple tier texts: if two tiers
 * open with the same sentence, the tiers are not progressive.
 */
export function checkTiersProgressive(
  tiers: Record<string, string>,
  unitLabel: string,
): CriticFinding[] {
  const firsts: Array<[string, string]> = Object.entries(tiers).map(
    ([tier, text]) => [tier, firstSentence(text)],
  );
  const findings: CriticFinding[] = [];
  for (let i = 0; i < firsts.length; i++) {
    for (let j = i + 1; j < firsts.length; j++) {
      if (firsts[i][1] && firsts[j][1] && firsts[i][1] === firsts[j][1]) {
        findings.push(finding(
          "register.no_meta_reference" as any,
          "major",
          `${unitLabel}: tiers "${firsts[i][0]}" and "${firsts[j][0]}" open with identical sentence — tiers must progress`,
          firsts[i][1],
        ));
      }
    }
  }
  return findings;
}

/**
 * Closing-line genericism: the last sentence of each tier should land. Generic
 * imperatives like "be careful", "think carefully", "stay vigilant" are signs
 * the writer defaulted to a stock closer.
 */
const GENERIC_CLOSING_PATTERNS = [
  /\bbe careful\.?$/i,
  /\bthink carefully\.?$/i,
  /\bbe (mindful|aware|vigilant)\.?$/i,
  /\bstay (alert|aware|vigilant)\.?$/i,
  /\bproceed with caution\.?$/i,
  /\bmake sure to\b/i,
  /\bdon't forget to\b/i,
];

export function checkClosingLineLandings(text: string, unitLabel: string): CriticFinding[] {
  const sentences = splitSentences(text);
  if (sentences.length < 2) return [];
  const last = sentences[sentences.length - 1];
  for (const re of GENERIC_CLOSING_PATTERNS) {
    if (re.test(last)) {
      return [finding(
        "register.no_meta_reference" as any,
        "minor",
        `${unitLabel}: closing line is generic ("${last.slice(-60)}") — rewrite to a specific, quotable line`,
        last,
      )];
    }
  }
  // Also flag if the last sentence is very short and ends in a platitude-shaped word
  const lastLower = last.toLowerCase();
  if (last.split(/\s+/).length <= 6 && /\b(important|crucial|key|essential|vital|matters)\b\.?$/i.test(last)) {
    return [finding(
      "register.no_meta_reference" as any,
      "minor",
      `${unitLabel}: closing line reads as platitude ("${last}") — write a specific payoff line`,
      last,
    )];
  }
  return [];
}

/**
 * Cross-tier phrase uniqueness: if a 4+-word phrase appears verbatim in two
 * tiers (except the chapter concept name), it's recycled writing. One
 * instance is flagged per pair.
 */
export function checkCrossTierPhraseUniqueness(
  tiers: Record<string, string>,
  conceptAllowlist: string[],
  unitLabel: string,
): CriticFinding[] {
  const findings: CriticFinding[] = [];
  const entries = Object.entries(tiers);
  const windowSize = 4;
  for (let i = 0; i < entries.length; i++) {
    for (let j = i + 1; j < entries.length; j++) {
      const [nameA, textA] = entries[i];
      const [nameB, textB] = entries[j];
      const wordsA = textA.split(/\s+/).map((w) => w.toLowerCase().replace(/[^a-z0-9]/g, ""));
      const wordsB = textB.split(/\s+/).map((w) => w.toLowerCase().replace(/[^a-z0-9]/g, ""));
      const setB = new Set<string>();
      for (let k = 0; k + windowSize <= wordsB.length; k++) {
        setB.add(wordsB.slice(k, k + windowSize).join(" "));
      }
      for (let k = 0; k + windowSize <= wordsA.length; k++) {
        const phrase = wordsA.slice(k, k + windowSize).join(" ");
        if (!phrase || phrase.length < 12) continue;
        if (conceptAllowlist.some((c) => phrase.includes(c.toLowerCase()))) continue;
        if (setB.has(phrase)) {
          findings.push(finding(
            "register.no_meta_reference" as any,
            "minor",
            `${unitLabel}: "${phrase}" appears in both ${nameA} and ${nameB} — vary one of them`,
            phrase,
          ));
          return findings; // one is enough to flag
        }
      }
    }
  }
  return findings;
}

// ── helpers ─────────────────────────────────────────────────────────────────

function firstSentence(text: string): string {
  const m = text.match(/^[^.!?]+[.!?]/);
  return m ? m[0].trim() : text.slice(0, 120).trim();
}

