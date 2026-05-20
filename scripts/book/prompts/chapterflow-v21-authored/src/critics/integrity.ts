/**
 * Integrity critics — surface-level invariants that any human editor would catch
 * on a first read, but the existing critics did not check:
 *
 *   - capitalization: hooks, keyTakeaways, scenarios, etc. must begin with an
 *     uppercase letter. Indistractable shipped with 29/30 lowercase hooks and
 *     25 lowercase example scenarios; the ship gate said PASS.
 *   - sentence sanity: comma-orphans like "Audrey, owners gather staff with no
 *     agenda" and missing-connective fragments like "needs to choose the sous-
 *     chef refuses the meeting" are unparseable; we cannot let them ship.
 *   - max length on display-critical fields (keyTakeaway): 38-word run-ons are
 *     painful to read and routinely came out of the writer agent.
 *
 * Catalog IDs introduced here:
 *   A12 — capitalization on display field (BLOCKER)
 *   A13 — sentence-parse sanity on display field (MAJOR)
 *   A14 — keyTakeaway exceeds maximum word count (MAJOR)
 */

import { CriticFinding } from "../types.js";
import { finding } from "./shared.js";

/**
 * A12 — every reader-facing text field must begin with an uppercase letter
 * (after stripping any leading quote / whitespace). We only check the first
 * non-whitespace, non-quote, non-bracket character. We exclude purely numeric
 * starts (e.g., "1990s were…" is fine).
 */
export function checkCapitalization(text: string | undefined, fieldLabel: string): CriticFinding[] {
  if (!text) return [];
  const trimmed = text.replace(/^[\s"'“‘«\[\(]+/, "");
  if (!trimmed) return [];
  const first = trimmed.charAt(0);
  if (/[a-z]/.test(first)) {
    return [
      finding(
        "integrity.capitalization",
        "blocker",
        `${fieldLabel} starts with a lowercase letter — display field must begin with an uppercase character`,
        text.slice(0, 120),
      ),
    ];
  }
  return [];
}

/**
 * A13 — sentence parse sanity. Catches grammatically broken display text that
 * a normal reader would stumble over. We rely on a small set of high-precision
 * patterns rather than full grammar parsing.
 *
 * Patterns flagged:
 *   1. Doubled terminal punctuation: ".." or "..." used as a period (not as
 *      an ellipsis — we let "…" pass).
 *   2. Apposition orphan with verb conflict: "<Name>, <plural noun> verb" — e.g.,
 *      "Audrey, owners gather staff" — a leading proper noun followed by a comma
 *      followed by a subject phrase that takes its own verb, leaving the
 *      original subject dangling.
 *   3. Missing-connective fragment in decision cues: "needs to choose <noun
 *      phrase> <verb>" or "has to decide <noun phrase> <verb>" — two finite
 *      clauses jammed together without "whether" / "if" / "that".
 *   4. Three or more commas in the first 80 chars of a scenario: very rare in
 *      clean prose, common in syntactically broken openers.
 */
export function checkSentenceSanity(text: string | undefined, fieldLabel: string): CriticFinding[] {
  if (!text) return [];
  const findings: CriticFinding[] = [];

  // (1) Doubled period (".." as a period — we keep "…" U+2026 valid).
  if (/(?<!\.)\.\.(?!\.)/.test(text) || /\.\.\.\./.test(text)) {
    findings.push(
      finding(
        "integrity.sentence_sanity",
        "major",
        `${fieldLabel} contains doubled periods — likely a sentence-boundary error`,
        text.slice(0, 160),
      ),
    );
  }

  // (2) Apposition orphan: "<Capitalized Name>, <noun> <verb>s" where the comma
  // is in the first ~40 chars. Match shapes like:
  //   "Audrey, owners gather staff…"  →  "Audrey" (subject), "owners" (new subject), "gather" (verb)
  // We require: a capitalized first word ending at the comma; a second word that
  // is a common lowercase plural-or-collective noun; a third word that is a
  // present-tense plural verb. This is a heuristic but high-precision.
  const appOrphan = text.match(/^([A-Z][a-z]+),\s+([a-z]+)\s+([a-z]+s?)\b/);
  if (appOrphan) {
    const subject = appOrphan[1];
    const possibleNoun = appOrphan[2];
    const possibleVerb = appOrphan[3];
    // If the candidate noun looks like an appositive role ("the famine regent",
    // "the head nurse"), that is acceptable. So we skip if the noun is the
    // start of a "<role>" appositive (no verb directly after).
    // Common plural-noun-and-verb patterns: "owners gather", "managers decide",
    // "students try", "engineers ship", "people argue".
    if (looksLikePluralVerb(possibleVerb) && !COMMON_APPOSITIVE_LEADS.has(possibleNoun)) {
      findings.push(
        finding(
          "integrity.sentence_sanity",
          "major",
          `${fieldLabel} opens with "${subject}, ${possibleNoun} ${possibleVerb}…" — appositive orphan leaving "${subject}" without a verb of their own`,
          text.slice(0, 160),
        ),
      );
    }
  }

  // (3) Missing-connective fragment in decision cues.
  //   "needs to choose <verb-phrase>"   — should be "needs to choose <whether|if|to>…"
  //   "has to decide <verb-phrase>"     — same
  //   "must decide <verb-phrase>"       — same
  // We flag when the word after "choose|decide" is a noun followed within 4
  // words by a finite verb (heuristic: third or fourth token ends in "s" or is
  // in a small verb set).
  const decisionFrag = text.match(
    /\b(?:needs to choose|has to decide|must decide|has to choose|needs to decide)\s+(?:the\s+)?[a-z]+(?:-[a-z]+)?\s+([a-z]+)\b/i,
  );
  if (decisionFrag) {
    const followingVerb = decisionFrag[1].toLowerCase();
    if (FINITE_VERB_TELLS.has(followingVerb)) {
      findings.push(
        finding(
          "integrity.sentence_sanity",
          "major",
          `${fieldLabel} contains a missing-connective fragment near "${decisionFrag[0]}" — needs "whether", "if", or "to" before the embedded clause`,
          text.slice(0, 200),
        ),
      );
    }
  }

  // (4) Three+ commas in the first 80 chars — diagnostic for run-on opener.
  const opener = text.slice(0, 80);
  const commas = (opener.match(/,/g) ?? []).length;
  if (commas >= 3) {
    findings.push(
      finding(
        "integrity.sentence_sanity",
        "minor",
        `${fieldLabel} opens with ${commas} commas in the first 80 characters — likely a run-on opener`,
        opener,
      ),
    );
  }

  return findings;
}

/** Common appositive leads ("the X", "owner X") that legitimately follow "<Name>, …". */
const COMMON_APPOSITIVE_LEADS = new Set([
  "the", "a", "an", "her", "his", "their", "owner", "founder", "manager", "head",
  "director", "president", "chair", "lead", "senior", "junior", "chief",
]);

/** Tokens that, in isolation, are almost certainly finite verbs after a noun. */
const FINITE_VERB_TELLS = new Set([
  "refuses", "agrees", "decides", "leaves", "stays", "asks", "answers",
  "tells", "says", "writes", "calls", "moves", "starts", "stops", "tries",
  "wants", "needs", "takes", "gives", "sends", "keeps", "drops", "picks",
  "buys", "sells", "signs", "votes", "submits", "approves",
]);

function looksLikePluralVerb(token: string): boolean {
  // Very narrow: present-tense plural verbs we've seen in the wild ("gather",
  // "decide", "argue", "discuss", "wait", "look", "try", "move", "leave",
  // "ask", "answer"). We accept either bare form ("gather") or -s form
  // ("gathers", "decides") just to be safe even though singular-subject -s
  // would not be a bug.
  const bare = token.replace(/s$/, "");
  return PLURAL_VERB_LEXICON.has(bare);
}

const PLURAL_VERB_LEXICON = new Set([
  "gather", "decide", "argue", "discuss", "wait", "look", "try", "move",
  "leave", "ask", "answer", "shout", "huddle", "scramble", "drift", "ignore",
  "approve", "vote", "stand", "sit", "step", "rush", "push", "pull", "send",
  "fight", "agree", "disagree", "begin", "start", "stop", "finish",
]);

/**
 * A14 — keyTakeaway must not exceed a maximum word count. Long takeaways are
 * unreadable in a card and routinely came out of the writer agent at 35+ words.
 * Default cap 30 words; tunable for future use.
 */
export function checkMaxWordCount(text: string | undefined, fieldLabel: string, maxWords: number): CriticFinding[] {
  if (!text) return [];
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length > maxWords) {
    return [
      finding(
        "integrity.length_cap",
        "major",
        `${fieldLabel} is ${words.length} words (cap ${maxWords}) — too long to scan as a single takeaway`,
        text.slice(0, 200),
      ),
    ];
  }
  return [];
}

/**
 * C10 — example-title verb shell. Indistractable Ch15 had:
 *   Samantha handles shipyard safety review
 *   Grant handles university admissions committee
 *   Audrey handles restaurant menu rollout
 *   Terence handles clinic quality board
 *   Dana handles indie game bug triage
 *   Russell handles public housing repair council
 * All six titles match the shell "<Name> handles <domain>". The existing C8
 * title check uses 3-word substrings, which all of these have unique. The
 * verb shell needs only one shared word (the second token, the verb).
 *
 * Fires when 4 or more of the chapter's example titles share the same second
 * word (case-insensitive, alphabetic only).
 */
export function checkExampleTitleVerbShell(
  examples: Array<{ title?: string }>,
): CriticFinding[] {
  if (examples.length < 4) return [];
  const secondTokens: string[] = [];
  for (const ex of examples) {
    const tokens = (ex.title ?? "").trim().split(/\s+/);
    if (tokens.length < 2) {
      secondTokens.push("");
      continue;
    }
    const second = tokens[1].toLowerCase().replace(/[^a-z]/g, "");
    secondTokens.push(second);
  }
  const counts = new Map<string, number>();
  for (const t of secondTokens) {
    if (!t || t.length < 3) continue;
    counts.set(t, (counts.get(t) ?? 0) + 1);
  }
  for (const [token, count] of counts) {
    if (count >= 4) {
      return [
        finding(
          "integrity.example_title_verb_shell",
          "blocker",
          `${count} of ${examples.length} example titles share the same verb "${token}" in second position — titles follow a "<Name> ${token} <domain>" shell; rewrite to use distinct title shapes`,
          token,
        ),
      ];
    }
  }
  return [];
}
