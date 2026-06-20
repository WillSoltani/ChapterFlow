/**
 * Pedagogy critics — check that questions and cards test the right thing.
 * Quiz questions must test application of the idea, not recall of the text.
 * Review card fronts must pose retrieval prompts, not comprehension checks.
 */

import { CriticFinding, QuizQuestion, ReviewCard } from "../types.js";
import { finding, pickEvidence } from "./shared.js";

const QUIZ_FORBIDDEN_OPENERS = [
  /^\s*what does the (chapter|author|book)/i,
  /^\s*according to the (chapter|author|book)/i,
  /^\s*what is the main point of the (chapter|section)/i,
  /^\s*how does the (chapter|author|book) describe/i,
  /^\s*in this (chapter|section|book|law)/i,
  /^\s*(machiavelli|kahneman|clear|taleb|housel|tetlock|cialdini|greene|duhigg|eyal)\s+(argues|opens|says|writes|claims|describes)/i,
];

const QUIZ_APPLICATION_OPENERS = [
  /^\s*(a|an)\s+(manager|teacher|student|founder|parent|coach|director|vp|engineer|designer|writer|analyst)/i,
  /^\s*when a reader/i,
  /^\s*if you/i,
  /^\s*a team is/i,
  /^\s*a person who/i,
  /^\s*in which scenario/i,
  /^\s*which action/i,
  /^\s*which move/i,
  /^\s*which plan best/i,
  /^\s*you are/i,
  /^\s*someone\s/i,
];

// Mid-prompt question stems that mark an application/analysis item even when the
// prompt does not OPEN with a whitelisted subject (e.g. a scenario-first prompt
// that ends "…what should she infer first?"). Register-agnostic.
const QUIZ_APPLICATION_STEMS = [
  /\bwhat should\b/i,
  /\bwhat (would|will) (she|he|they|you)\b/i,
  /\bwhat is the (cleanest|best|first|right|smartest|wisest|safest)\b/i,
  /\bwhich (choice|action|move|plan|response|read|reading|step|option|inference)\b[^?]*\bbest\b/i,
  /\bbest (next )?(move|step|response|read|action|inference)\b/i,
  /\bwhat should (she|he|they|you) (infer|do|conclude|prioritize|notice|change|fix)\b/i,
];

export function checkQuizTestsApplication(q: QuizQuestion): CriticFinding[] {
  const findings: CriticFinding[] = [];
  const prompt = (q.prompt ?? "").trim();
  if (!prompt) {
    findings.push(
      finding(
        "pedagogy.quiz_tests_application",
        "blocker",
        "quiz question has empty prompt",
      ),
    );
    return findings;
  }

  for (const re of QUIZ_FORBIDDEN_OPENERS) {
    if (re.test(prompt)) {
      findings.push(
        finding(
          "pedagogy.quiz_tests_application",
          "major",
          "quiz prompt tests recall-about-text, not application of the idea",
          prompt,
        ),
      );
      return findings;
    }
  }

  // Minor hint: flag if none of the preferred application-style openers are present
  const hasAppOpener = QUIZ_APPLICATION_OPENERS.some((re) => re.test(prompt));
  const hasAppStem = QUIZ_APPLICATION_STEMS.some((re) => re.test(prompt));
  if (!hasAppOpener && !hasAppStem && prompt.length < 120) {
    findings.push(
      finding(
        "pedagogy.quiz_tests_application",
        "minor",
        "prompt is short and does not obviously test application — consider a scenario-based framing",
        prompt,
      ),
    );
  }
  return findings;
}

const CARD_FORBIDDEN_OPENERS = [
  /^\s*what does (the )?(chapter|book|author)/i,
  /^\s*according to (the )?(chapter|book|author)/i,
  /^\s*how does (the )?chapter/i,
  /^\s*what goes wrong (in|when) the chapter/i,
];

export function checkCardTestsRetrieval(rc: ReviewCard): CriticFinding[] {
  const findings: CriticFinding[] = [];
  const front = pickEvidence(rc.front);
  if (!front) {
    findings.push(
      finding(
        "pedagogy.card_tests_retrieval",
        "major",
        "review card front is empty",
      ),
    );
    return findings;
  }
  for (const re of CARD_FORBIDDEN_OPENERS) {
    if (re.test(front)) {
      findings.push(
        finding(
          "pedagogy.card_tests_retrieval",
          "minor",
          "card front is a comprehension check, not retrieval practice",
          front,
        ),
      );
      return findings;
    }
  }
  return findings;
}

/**
 * D3 — keyTakeaway distillability (ADVISORY / minor). The "one-sentence test":
 * a reader should be able to repeat the chapter's keyTakeaway as one concrete,
 * repeatable move. A takeaway that stays fully at arm's length — a pileup of
 * nominalized concept-nouns ("cultivation", "motivation", "recognition") and NO
 * concrete anchor — reads abstract, and a tired beginner cannot carry it.
 *
 * This NEVER blocks. Word choice is contextual and a conceptual book may state
 * an abstract truth legitimately, so a false positive must cost nothing; it only
 * nudges the writer to name the move. It is conservative ON PURPOSE — calibrated
 * against the 1,606 shipped keyTakeaways so it fires on ~4.5% (the genuinely
 * arm's-length ones a beginner can't carry, e.g. "Vulnerability with boundaries
 * means risking exposure for love, creativity, and integrity"), not on the many
 * good imperative takeaways ("Keep reserves that…", "Trade weak signals for…")
 * that simply carry abstract nouns, nor on directives embedded after a clause
 * break ("…, so check the base rate"). A finding
 * fires only when the takeaway is abstraction-heavy (≥3 distinct nominalizations)
 * AND offers the reader no move to grab: not an imperative directive, no
 * second-person, no number, no named entity, no "X, not Y" contrast. It is
 * deliberately NOT a length check — A14 (integrity.length_cap) already caps the
 * word count; this is about whether the sentence names a move.
 */
// A nominalized abstract noun: ≥4 letters of stem before an abstraction suffix
// (so "motion"/"comment"/"city" — stem <4 — do not match, but "cultivation",
// "movement", "quality", "representativeness" do).
const NOMINALIZATION_RE = /\b[a-z]{4,}(?:tions?|ments?|ness|ities|ity|isms?|ances?|ences?|izations?|isations?)\b/gi;
// Imperative-verb openers — a takeaway that OPENS with one of these is itself a
// directive (it names the move), so it is concrete by construction. Closed list
// drawn from the verbs that actually open shipped imperative takeaways. It is a
// pragmatic proxy, not exhaustive: a NEW book whose imperative takeaway opens with
// an unlisted verb may draw a spurious advisory — acceptable for a minor nudge
// (a model-backed check would judge "names a move?" precisely; this is the cheap,
// never-gating stand-in). Bias is toward UNDER-firing; over-fires are bounded noise.
const IMPERATIVE_VERBS = new Set([
  "keep", "welcome", "prefer", "respect", "run", "build", "trade", "ground", "begin",
  "treat", "use", "ask", "pick", "choose", "hold", "name", "check", "spot", "notice",
  "start", "stop", "make", "give", "take", "turn", "try", "avoid", "protect", "grow",
  "drop", "watch", "find", "set", "tie", "place", "put", "bring", "carry", "lead",
  "look", "reach", "separate", "compare", "explore", "evaluate", "learn", "trace",
  "map", "frame", "aim", "default", "resist", "replace", "swap", "cut", "limit",
  "guard", "plan", "test", "measure", "decide", "commit", "practice", "rehearse",
  "favor", "favour", "anchor", "expect", "let", "do", "design", "write", "say",
  // openers seen on shipped imperative takeaways the v1 calibration missed
  "match", "honor", "honour", "manage", "interpret", "translate", "become", "divide",
  "overcome", "prioritize", "prioritise", "defend", "restore", "repair", "schedule",
  "pause", "exploit", "convert", "count", "renew", "audit", "install", "slow",
]);

// Leading conjunctions/adverbs that can sit in front of an embedded directive
// ("…, SO check the base rate"; "…, THEN restore it") without changing that the
// clause issues an imperative.
const CLAUSE_LEAD = /^(?:so|then|and|but|or|yet|thus|therefore|hence|now)\b\s*/i;

/** Does a clause issue an imperative (optionally behind a leading conjunction)? */
function clauseIsImperative(clause: string): boolean {
  const stripped = clause.trim().replace(CLAUSE_LEAD, "");
  const first = (stripped.match(/^[A-Za-z']+/)?.[0] ?? "").toLowerCase();
  return IMPERATIVE_VERBS.has(first);
}

export function checkTakeawayDistillable(text: string | undefined, fieldLabel: string): CriticFinding[] {
  if (!text || !text.trim()) return [];
  const distinct = new Set((text.match(NOMINALIZATION_RE) ?? []).map((m) => m.toLowerCase()));
  if (distinct.size < 3) return [];                                    // not abstraction-heavy
  // A directive anywhere is a move the reader can grab — whether it OPENS the
  // takeaway ("Keep reserves that…") or is embedded after a clause break
  // ("…, so check the base rate"; "…steadiness: ask better questions, hold tension").
  if (text.split(/[,;:]/).some(clauseIsImperative)) return [];
  // Other concrete anchors. The named-entity check looks only PAST the first word
  // so a sentence-initial capital never counts as a proper noun.
  const pastFirst = text.replace(/^\s*[A-Za-z']+/, "");
  const anchored = /\b(?:you|your|you're|yourself|yourselves)\b/i.test(text)
    || /\d/.test(text)
    || /,\s*not\b/i.test(text)
    || /\bnot\b[^,.]{0,40}\bbut\b/i.test(text)
    || /[\s,:(]\b[A-Z][a-z]{2,}/.test(pastFirst);                     // a named entity grounds it
  if (anchored) return [];
  return [
    finding(
      "pedagogy.takeaway_distillable",
      "minor",
      `${fieldLabel} reads abstract (${distinct.size} concept-nouns, no move to grab) — name the one repeatable move a reader could act on today`,
      text,
    ),
  ];
}
