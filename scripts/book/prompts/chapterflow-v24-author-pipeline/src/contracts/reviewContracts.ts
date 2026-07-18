/**
 * Review contracts (frozen by IMP-00; IMPLEMENTED by IMP-08).
 *
 * Master plan §8.11 / F-022: reviewer blindness becomes TECHNICAL — role-specific
 * workspaces plus a two-phase quiz protocol where phase one (derivation) runs in
 * a workspace that physically lacks the answer key, the conductor hashes and
 * commits the derivation, and only then does phase two (adjudication) see the
 * key. These shapes are the cross-package interface; rubric semantics stay in
 * IMP-08's package.
 */

import { ContractDescriptor, expectFields, isNonEmptyString } from "./contractUtil.js";

export type ReviewerRoleV1 =
  | "direct-reader"
  | "quiz-derivation"
  | "quiz-adjudication"
  | "source-verifier"
  | "causal-verifier"
  | "tiebreak"
  | "acceptance-reader";

export type ReviewOutputV1 = {
  schema: "review-output-v1";
  reviewerRole: ReviewerRoleV1;
  reviewerSessionId: string;
  /** Hash of the exact rendered document the reviewer saw. */
  documentSha256: string;
  rubricVersion: string;
  executionProfileHash: string;
  /** Role-specific verdict payload (scores/ship/etc.) — shaped by IMP-08. */
  verdict: Record<string, unknown>;
  /** Structured findings; free reviewer prose is untrusted attached evidence. */
  findings: unknown[];
  evidenceQuotesVerified: boolean;
};

export type QuizDerivationItemV1 = {
  itemId: string;
  derivedAnswerIndex: number;
  mechanism: string;
  confidence: "low" | "medium" | "high";
  ambiguityFlags: string[];
  evidenceQuotes: string[];
};

/** Phase one — produced WITHOUT key access; conductor hashes + commits it. */
export type QuizDerivationV1 = {
  schema: "quiz-derivation-v1";
  documentSha256: string;
  reviewerSessionId: string;
  items: QuizDerivationItemV1[];
};

export type QuizAdjudicationItemV1 = {
  itemId: string;
  keyedAnswerIndex: number;
  derivedAnswerIndex: number;
  agreement: boolean;
  keyCorrect: "correct" | "ambiguous" | "wrong";
  rationale: string;
};

/** Phase two — sees the committed derivation (by hash) plus the answer key. */
export type QuizAdjudicationV1 = {
  schema: "quiz-adjudication-v1";
  derivationSha256: string;
  documentSha256: string;
  reviewerSessionId: string;
  items: QuizAdjudicationItemV1[];
};

export function validateReviewOutput(r: unknown): string[] {
  const errors: string[] = [];
  if (r === null || typeof r !== "object") return ["review: not an object"];
  const v = r as Record<string, unknown>;
  expectFields(v, [
    "schema", "reviewerRole", "reviewerSessionId", "documentSha256", "rubricVersion",
    "executionProfileHash", "verdict", "findings", "evidenceQuotesVerified",
  ], errors, "review");
  if (v.schema !== "review-output-v1") errors.push("review: wrong schema tag");
  if (!isNonEmptyString(v.documentSha256)) errors.push("review: documentSha256 required (hash-bound reviews only)");
  return errors;
}

export function validateQuizDerivation(d: unknown): string[] {
  const errors: string[] = [];
  if (d === null || typeof d !== "object") return ["derivation: not an object"];
  const v = d as Record<string, unknown>;
  expectFields(v, ["schema", "documentSha256", "reviewerSessionId", "items"], errors, "derivation");
  if (v.schema !== "quiz-derivation-v1") errors.push("derivation: wrong schema tag");
  if (!Array.isArray(v.items)) errors.push("derivation: items must be an array");
  return errors;
}

export const REVIEW_CONTRACT: ContractDescriptor = {
  name: "review-output",
  version: 1,
  ownerPrompt: "IMP-08",
  description: "Hash-bound reviewer outputs plus the two-phase quiz protocol (key-blind derivation committed before key-visible adjudication).",
  fields: {
    ReviewOutputV1: {
      schema: "\"review-output-v1\"",
      reviewerRole: "\"direct-reader\"|\"quiz-derivation\"|\"quiz-adjudication\"|\"source-verifier\"|\"causal-verifier\"|\"tiebreak\"|\"acceptance-reader\"",
      reviewerSessionId: "string", documentSha256: "string", rubricVersion: "string",
      executionProfileHash: "string", verdict: "Record<string,unknown>",
      findings: "RepairFindingV1[]", evidenceQuotesVerified: "boolean",
    },
    QuizDerivationV1: {
      schema: "\"quiz-derivation-v1\"", documentSha256: "string", reviewerSessionId: "string",
      items: "{ itemId, derivedAnswerIndex, mechanism, confidence, ambiguityFlags, evidenceQuotes }[]",
    },
    QuizAdjudicationV1: {
      schema: "\"quiz-adjudication-v1\"", derivationSha256: "string", documentSha256: "string",
      reviewerSessionId: "string",
      items: "{ itemId, keyedAnswerIndex, derivedAnswerIndex, agreement, keyCorrect, rationale }[]",
    },
  },
};
