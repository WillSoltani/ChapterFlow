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
