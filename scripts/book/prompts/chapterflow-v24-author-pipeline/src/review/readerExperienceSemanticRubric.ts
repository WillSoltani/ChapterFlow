/** Shared reader-experience semantics for file-based and inline review tasks. */

import { REVIEW_FACTORS, type ReviewFactor } from "../artifacts/artifactTypes.js";
import {
  READER_ADVISORY_CATEGORIES,
  READER_BLOCKING_CATEGORIES,
  READER_ESCALATION_CATEGORIES,
} from "../contracts/readerExperienceReview.js";
import { hashCanonical } from "../contracts/contractUtil.js";

export const READER_EXPERIENCE_SEMANTIC_RUBRIC_VERSION =
  "reader-experience-semantic-rubric-v2" as const;

export const READER_EXPERIENCE_FACTOR_DEFINITIONS: Readonly<Record<ReviewFactor, string>> = Object.freeze({
  retention: "will a reader remember the core move in a week through memorable lines, concrete images, and useful echoes",
  quizzes: "questions are fair and derivable from the prose, keys are sound, tells are absent, and distractors teach",
  transfer: "the lesson applies beyond the book's own examples through useful if-then plans and challenges",
  practical: "a real person could perform the actions because they are low-friction, concrete, and not theater",
  summaries: "fast, deep, and full reads are layered, accurate, and independently useful",
  tone: "plain confident language without corporate filler or template/scaffold smell",
  limits: "boundaries and failure modes are honest and the chapter does not oversell",
  insight: "the chapter explains why through mechanisms rather than merely naming actions",
  density: "paragraphs carry useful ideas without padding or repetition",
  beginner: "the material is approachable cold and avoids unexplained jargon",
});

export const READER_EXPERIENCE_SEMANTIC_PROJECTION = Object.freeze({
  version: READER_EXPERIENCE_SEMANTIC_RUBRIC_VERSION,
  scoreScale: "0-100",
  factors: READER_EXPERIENCE_FACTOR_DEFINITIONS,
  authority: Object.freeze({
    externalTruth: "forbidden",
    unclearSourceStatus: "origin_ambiguous_to_reader",
    finalDecision: "conductor_owned",
  }),
  findingBuckets: Object.freeze({
    blocking: READER_BLOCKING_CATEGORIES,
    escalation: READER_ESCALATION_CATEGORIES,
    advisory: READER_ADVISORY_CATEGORIES,
  }),
  quizDerivation: Object.freeze({
    answerEachQuestionFromProse: true,
    fields: Object.freeze(["answer", "mechanism", "confidence", "ambiguity", "tell"] as const),
    answerKeyVisible: false,
  }),
  evidence: Object.freeze({
    requiredForEveryJudgment: true,
    exactLocalEvidenceOnly: true,
    transportMayUse: Object.freeze(["verbatim_span", "packet_local_reference"] as const),
  }),
  recommendation: "advisory_only",
});

if (Object.keys(READER_EXPERIENCE_FACTOR_DEFINITIONS).sort().join("|")
  !== [...REVIEW_FACTORS].sort().join("|")) {
  throw new Error("reader semantic rubric factor definitions drifted from REVIEW_FACTORS");
}

export const READER_EXPERIENCE_SEMANTIC_SHA256 =
  hashCanonical(READER_EXPERIENCE_SEMANTIC_PROJECTION);

export function renderReaderExperienceSemanticRubric(): string {
  const factorLines = REVIEW_FACTORS.map((factor) =>
    `- ${factor}: ${READER_EXPERIENCE_FACTOR_DEFINITIONS[factor]}.`);
  return [
    `READER SEMANTIC RUBRIC ${READER_EXPERIENCE_SEMANTIC_RUBRIC_VERSION} (sha256 ${READER_EXPERIENCE_SEMANTIC_SHA256})`,
    "AUTHORITY: Judge only the complete key-free reader-facing chapter. You may not determine whether an external person, organization, event, quotation, date, number, study, or source claim is factually real or source-supported. External factual truth, source support, and source contradiction are outside reader authority. When a passage reads as factual but its status is unclear, use origin_ambiguous_to_reader; never turn that uncertainty into an external-truth blocker. The conductor owns the final decision.",
    "SCORE SCALE: Score every factor from 0-100. Do not use a 5-point or 10-point scale and do not rescale heuristically.",
    "FACTORS:",
    ...factorLines,
    "QUIZ DERIVATION: Answer every question yourself from the key-free prose. For each question give the answer, the mechanism in the prose that forces it, confidence, any second defensible answer or under-determination, and any answer tell. The derivation is review evidence, not a hidden answer key.",
    `BLOCKING FINDINGS: Only reader-visible, on-page-decidable defects may block. Allowed categories: ${READER_BLOCKING_CATEGORIES.join(", ")}.`,
    `ESCALATION SIGNALS: Source concerns the page cannot settle are annotations, never reader blockers. Allowed categories: ${READER_ESCALATION_CATEGORIES.join(", ")}.`,
    `ADVISORY FINDINGS: Non-blocking craft and learning weaknesses belong here. Allowed categories: ${READER_ADVISORY_CATEGORIES.join(", ")}.`,
    "EVIDENCE: Every finding, strongest/weakest judgment, and quiz derivation must cite exact local evidence. The transport may require verbatim spans or packet-local reference IDs; never fabricate, paraphrase as a quote, or cite unavailable material.",
    "RECOMMENDATION: SHIP, REVISE, or BLOCK is advisory only. It never determines the aggregate result by itself.",
  ].join("\n");
}
