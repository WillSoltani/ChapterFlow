/**
 * Quiz-integrity result contract (frozen by IMP-20 §C / WP-A1).
 *
 * The quiz lane OWNS quiz correctness — keyed-answer correctness, unique-answer
 * requirement, ambiguity, causal-mechanism match, distractor validity, and
 * answer-length/wording tells. A general reader's holistic ship preference must
 * NEVER decide quiz correctness. The runtime (WP-B3) populates this shape via the
 * existing two-phase blindness protocol (key-free derivation committed by hash
 * BEFORE the key-visible adjudication) plus a deterministic tell heuristic.
 *
 * Result composition (enforced by the WP-B3 runtime, not this shape): any wrong
 * key or genuine ambiguity or unsupported mechanism → BLOCK; `tellDetected` is
 * advisory only (a craft signal to the aggregator).
 */

import { ContractDescriptor, expectFields, isNonEmptyString, isStringArray } from "./contractUtil.js";

export type QuizIntegrityQuestionV1 = {
  itemId: string;
  derivedAnswer: "a" | "b" | "c";
  keyedAnswer: "a" | "b" | "c";
  keyCorrect: boolean;
  uniqueAnswer: boolean;
  defensibleAlternatives: Array<"a" | "b" | "c">;
  mechanismSupported: boolean;
  tellDetected: boolean;
  explanation: string;
  evidenceSpans: string[];
};

export type QuizIntegrityResultV1 = {
  schema: "quiz-integrity-result-v1";
  chapterContentSha256: string;
  /** sha256 of the committed phase-1 derivation the phase-2 adjudication bound to. */
  derivationSha256: string;
  questions: QuizIntegrityQuestionV1[];
  result: "PASS" | "BLOCK" | "INCONCLUSIVE";
};

// ── validation ─────────────────────────────────────────────────────────────

function isEnum(v: unknown, allowed: readonly string[]): boolean {
  return typeof v === "string" && allowed.includes(v);
}

function noUnknownKeys(v: Record<string, unknown>, allowed: readonly string[], errors: string[], where: string): void {
  for (const k of Object.keys(v)) {
    if (!allowed.includes(k)) errors.push(`${where}: unknown key "${k}"`);
  }
}

const ABC = ["a", "b", "c"] as const;
const QUESTION_KEYS = [
  "itemId", "derivedAnswer", "keyedAnswer", "keyCorrect", "uniqueAnswer",
  "defensibleAlternatives", "mechanismSupported", "tellDetected", "explanation", "evidenceSpans",
] as const;
const TOP_KEYS = ["schema", "chapterContentSha256", "derivationSha256", "questions", "result"] as const;

function validateQuestion(q: unknown, errors: string[], where: string): void {
  if (q === null || typeof q !== "object") { errors.push(`${where}: not an object`); return; }
  const u = q as Record<string, unknown>;
  expectFields(u, QUESTION_KEYS as unknown as string[], errors, where);
  noUnknownKeys(u, QUESTION_KEYS as unknown as string[], errors, where);
  if (!isNonEmptyString(u.itemId)) errors.push(`${where}: itemId must be a non-empty string`);
  if (!isEnum(u.derivedAnswer, ABC)) errors.push(`${where}: derivedAnswer must be "a"|"b"|"c"`);
  if (!isEnum(u.keyedAnswer, ABC)) errors.push(`${where}: keyedAnswer must be "a"|"b"|"c"`);
  for (const f of ["keyCorrect", "uniqueAnswer", "mechanismSupported", "tellDetected"] as const) {
    if (typeof u[f] !== "boolean") errors.push(`${where}: ${f} must be boolean`);
  }
  if (!Array.isArray(u.defensibleAlternatives) || !u.defensibleAlternatives.every((a) => isEnum(a, ABC))) {
    errors.push(`${where}: defensibleAlternatives must be an array of "a"|"b"|"c"`);
  }
  if (typeof u.explanation !== "string") errors.push(`${where}: explanation must be a string`);
  if (!isStringArray(u.evidenceSpans)) errors.push(`${where}: evidenceSpans must be string[]`);
}

export function validateQuizIntegrityResult(r: unknown): string[] {
  const errors: string[] = [];
  if (r === null || typeof r !== "object") return ["quiz-result: not an object"];
  const v = r as Record<string, unknown>;
  expectFields(v, TOP_KEYS as unknown as string[], errors, "quiz-result");
  noUnknownKeys(v, TOP_KEYS as unknown as string[], errors, "quiz-result");
  if (v.schema !== "quiz-integrity-result-v1") errors.push("quiz-result: wrong schema tag");
  if (!isNonEmptyString(v.chapterContentSha256)) errors.push("quiz-result: chapterContentSha256 must be a non-empty string");
  if (!isNonEmptyString(v.derivationSha256)) errors.push("quiz-result: derivationSha256 must be a non-empty string");
  if (!isEnum(v.result, ["PASS", "BLOCK", "INCONCLUSIVE"])) errors.push("quiz-result: result must be PASS|BLOCK|INCONCLUSIVE");
  if (!Array.isArray(v.questions)) errors.push("quiz-result: questions must be an array");
  else v.questions.forEach((q, i) => validateQuestion(q, errors, `quiz-result.questions[${i}]`));
  return errors;
}

export const QUIZ_INTEGRITY_RESULT_CONTRACT: ContractDescriptor = {
  name: "quiz-integrity-result",
  version: 1,
  ownerPrompt: "IMP-20",
  description:
    "Quiz lane result over the two-phase blindness protocol: per-item derived vs keyed answer, key correctness, unique-answer/ambiguity, defensible alternatives, causal-mechanism match, deterministic answer-tell detection, and PASS|BLOCK|INCONCLUSIVE; quiz correctness is never decided by a reader's ship preference.",
  fields: {
    QuizIntegrityResultV1: {
      schema: "\"quiz-integrity-result-v1\"",
      chapterContentSha256: "string", derivationSha256: "string",
      questions: "QuizIntegrityQuestionV1[]",
      result: "\"PASS\"|\"BLOCK\"|\"INCONCLUSIVE\"",
    },
    QuizIntegrityQuestionV1: {
      itemId: "string",
      derivedAnswer: "\"a\"|\"b\"|\"c\"", keyedAnswer: "\"a\"|\"b\"|\"c\"",
      keyCorrect: "boolean", uniqueAnswer: "boolean",
      defensibleAlternatives: "(\"a\"|\"b\"|\"c\")[]",
      mechanismSupported: "boolean", tellDetected: "boolean",
      explanation: "string", evidenceSpans: "string[]",
    },
  },
};
