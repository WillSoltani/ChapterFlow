/** Shared quiz-integrity semantics for file-based and inline review tasks. */

import { hashCanonical } from "../contracts/contractUtil.js";

export const QUIZ_INTEGRITY_SEMANTIC_RULES_VERSION =
  "quiz-integrity-semantic-rules-v2" as const;

export const QUIZ_INTEGRITY_SEMANTIC_PROJECTION = Object.freeze({
  version: QUIZ_INTEGRITY_SEMANTIC_RULES_VERSION,
  keyCorrect: Object.freeze({
    correct: "keyed answer is uniquely best supported",
    ambiguous: "two or more answers are defensible or wording underdetermines the answer",
    wrong: "keyed answer is not the best-supported choice",
  }),
  blindDerivation: "evidence_not_authority",
  defensibleAnswerIndices: "all genuinely defensible zero-based choice indices",
  keyedMechanismSupported: "whether the keyed mechanism is supported by the key-free chapter, question, and choices",
  evidence: "exact local evidence required",
});

export const QUIZ_INTEGRITY_SEMANTIC_SHA256 =
  hashCanonical(QUIZ_INTEGRITY_SEMANTIC_PROJECTION);

export function renderQuizIntegritySemanticRules(): string {
  return [
    `QUIZ SEMANTIC RULES ${QUIZ_INTEGRITY_SEMANTIC_RULES_VERSION} (sha256 ${QUIZ_INTEGRITY_SEMANTIC_SHA256})`,
    "KEY CORRECTNESS: correct means the keyed answer is uniquely best supported and no other choice is equally defensible; ambiguous means two or more choices are defensible or the wording under-determines the answer; wrong means the keyed answer is not the best-supported choice.",
    "BLIND DERIVATION: The committed blind derivation is EVIDENCE, not authority. Disagreement with a sound key does not make the key wrong, and agreement does not make an ambiguous key sound.",
    "DEFENSIBLE ANSWERS: defensibleAnswerIndices contains every 0-based choice index genuinely defensible from the question and choices. A uniquely correct key has exactly the keyed index; an ambiguous item has at least two indices.",
    "MECHANISM SUPPORT: keyedMechanismSupported is true only when the keyed answer's mechanism or causal justification is supported by the key-free chapter evidence plus the question and choices. It is true for an item that makes no mechanism or causal claim and false when the key asserts an unsupported mechanism or cause.",
    "EVIDENCE: Every judgment must cite exact local question, choice, chapter-mechanism, key, and explanation evidence using the transport's permitted evidence fields.",
  ].join("\n");
}
