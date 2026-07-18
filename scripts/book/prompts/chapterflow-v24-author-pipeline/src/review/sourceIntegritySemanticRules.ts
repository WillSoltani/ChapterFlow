/** Shared source-integrity semantics for file-based and inline review tasks. */

import { hashCanonical } from "../contracts/contractUtil.js";
import { SOURCE_PRIMARY_CATEGORY_PRECEDENCE_V2 } from "../contracts/reviewModelOutputV2.js";
import {
  ANALOGY_DETAIL_ALLOWED,
  ANALOGY_DETAIL_FORBIDDEN,
  CASE_DETAIL_ALLOWED,
  CASE_DETAIL_FORBIDDEN,
  COMPILER_MAX_CLAIM_STRENGTH,
  CONSTRUCTED_DETAIL_ALLOWED,
  CONSTRUCTED_DETAIL_FORBIDDEN,
  EXPLANATION_DETAIL_ALLOWED,
  EXPLANATION_DETAIL_FORBIDDEN,
  GENERIC_DETAIL_ALLOWED,
  GENERIC_DETAIL_FORBIDDEN,
} from "../compiler/sourceUsePlanCompiler.js";

export const SOURCE_INTEGRITY_SEMANTIC_RULES_VERSION =
  "source-integrity-semantic-rules-v2" as const;

export const SOURCE_INTEGRITY_SEMANTIC_PROJECTION = Object.freeze({
  version: SOURCE_INTEGRITY_SEMANTIC_RULES_VERSION,
  authority: Object.freeze({ externalTruth: "source_lane_only", outsideKnowledge: "forbidden" }),
  permissions: Object.freeze({
    sourceBoundCase: Object.freeze({ allowed: CASE_DETAIL_ALLOWED, forbidden: CASE_DETAIL_FORBIDDEN }),
    sourceBoundExplanation: Object.freeze({ allowed: EXPLANATION_DETAIL_ALLOWED, forbidden: EXPLANATION_DETAIL_FORBIDDEN }),
    constructed: Object.freeze({ allowed: CONSTRUCTED_DETAIL_ALLOWED, forbidden: CONSTRUCTED_DETAIL_FORBIDDEN }),
    generic: Object.freeze({ allowed: GENERIC_DETAIL_ALLOWED, forbidden: GENERIC_DETAIL_FORBIDDEN }),
    analogy: Object.freeze({ allowed: ANALOGY_DETAIL_ALLOWED, forbidden: ANALOGY_DETAIL_FORBIDDEN }),
  }),
  claimStrength: Object.freeze({ compilerOwned: true, maximumMinted: COMPILER_MAX_CLAIM_STRENGTH, upgradesForbidden: true }),
  missingEvidence: "INCONCLUSIVE",
  primaryCategoryPrecedence: SOURCE_PRIMARY_CATEGORY_PRECEDENCE_V2,
  outcomes: Object.freeze({
    PASS: "all required targets resolved within their licenses and no blocking defect",
    BLOCK: "source evidence supports at least one blocker in the governing primary category",
    INCONCLUSIVE: "required evidence or target resolution is missing",
    advisoryAdapter: "a conductor may derive a non-blocking revision state without changing these semantic judgments",
  }),
  evidence: Object.freeze({ chapterAndSourceRequired: true, exactLocalEvidenceOnly: true }),
});

export const SOURCE_INTEGRITY_SEMANTIC_SHA256 =
  hashCanonical(SOURCE_INTEGRITY_SEMANTIC_PROJECTION);

function list(values: readonly string[]): string {
  return values.join(", ");
}

export function renderSourceIntegritySemanticRules(): string {
  return [
    `SOURCE SEMANTIC RULES ${SOURCE_INTEGRITY_SEMANTIC_RULES_VERSION} (sha256 ${SOURCE_INTEGRITY_SEMANTIC_SHA256})`,
    "AUTHORITY: This is the only review lane allowed to judge external factual truth and source support. Judge only against the supplied source evidence and compiler-owned plan, never outside knowledge. Origin, form, claim strength, sufficiency, and permissions are compiler-owned and may not be relabeled by the reviewer.",
    `SOURCE-BOUND CASE: valid anchors are required and every named specific must be supported. Allowed detail kinds: ${list(CASE_DETAIL_ALLOWED)}. Forbidden detail kinds: ${list(CASE_DETAIL_FORBIDDEN)}.`,
    `SOURCE-BOUND EXPLANATION: teach the supported claim or mechanism expository. Allowed detail kinds: ${list(EXPLANATION_DETAIL_ALLOWED)}. Forbidden detail kinds: ${list(EXPLANATION_DETAIL_FORBIDDEN)}.`,
    `CONSTRUCTED APPLICATION: frame it visibly as hypothetical at first entry; never merge a real person or organization into an invented event; illustrative consequences are not reported history. Allowed detail kinds: ${list(CONSTRUCTED_DETAIL_ALLOWED)}. Forbidden detail kinds: ${list(CONSTRUCTED_DETAIL_FORBIDDEN)}.`,
    `GENERIC OPERATIONAL SCENARIO: use role labels and observable operations only; include no historical specificity and never claim the event occurred. Allowed detail kinds: ${list(GENERIC_DETAIL_ALLOWED)}. Forbidden detail kinds: ${list(GENERIC_DETAIL_FORBIDDEN)}.`,
    `ANALOGY: frame it clearly as non-literal. Allowed detail kinds: ${list(ANALOGY_DETAIL_ALLOWED)}. Forbidden detail kinds: ${list(ANALOGY_DETAIL_FORBIDDEN)}.`,
    `CLAIM STRENGTH: compare the prose with the compiler-owned expected strength. Do not upgrade description or association into mechanism or causation; the compiler ceiling is ${COMPILER_MAX_CLAIM_STRENGTH}.`,
    `PRIMARY CATEGORY PRECEDENCE: ${SOURCE_PRIMARY_CATEGORY_PRECEDENCE_V2.join(" > ")}. When more than one category applies, the earliest category controls.`,
    "OUTCOMES: PASS requires every required target to be resolved within its license with no blocker. BLOCK requires source evidence that supports at least one blocker in the governing primary category. INCONCLUSIVE is mandatory when required evidence or target resolution is missing. A conductor may separately derive a non-blocking revision state from the same judgments; the reviewer does not change the underlying semantics.",
    "EVIDENCE: Every support, register, claim-strength, framing, specificity, and finding judgment must cite exact local chapter and source evidence. Use the transport's verbatim-span or packet-local-reference fields and never invent evidence.",
  ].join("\n");
}
