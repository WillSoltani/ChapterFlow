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
import { finding } from "./shared.js";
import { splitSentences } from "./textUtils.js";

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

