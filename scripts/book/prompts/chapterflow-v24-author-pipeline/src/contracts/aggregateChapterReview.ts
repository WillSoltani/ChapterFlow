/**
 * Deterministic aggregation contract (frozen by IMP-20 §D / WP-A1).
 *
 * The conductor-owned composition of the three independent lanes (reader,
 * source, quiz) plus the deterministic critic bundle into a single final status.
 * The model's `recommendation` is EVIDENCE, not the gate: `finalStatus` is
 * computed deterministically by the WP-B4 runtime from lane results + freshness,
 * never read off the reader's ship preference.
 *
 * This module also freezes the two Wave-A HELPER types the runtime consumes:
 *  - `AggregateChapterReviewInputV1` — the exact input the aggregator takes
 *    (binds the three typed lane results, the lean deterministic summary, the
 *    reader bar, and every freshness expectation + required-source-unit set);
 *  - `DeterministicCriticSummaryV1` — the lean projection of the source lane's
 *    full `DeterministicCriticBundleV1` (the full CriticFinding[] bundle is a
 *    migration-side type owned by WP-A2).
 * Freezing both here means WP-B4 (producer) and WP-B10 (consumer) compile against
 * one shape and no reconciliation edit lands in a completed Wave-B file.
 */

import { ContractDescriptor, expectFields, isNonEmptyString, isStringArray } from "./contractUtil.js";
import type { ReaderExperienceReviewV1 } from "./readerExperienceReview.js";
import type { SourceIntegrityReviewV1 } from "./sourceIntegrityReview.js";
import type { QuizIntegrityResultV1 } from "./quizIntegrityReview.js";

/** Lean summary of the source lane's deterministic critic bundle — the only
 *  deterministic surface the aggregator needs (the full CriticFinding[] bundle
 *  lives migration-side in WP-A2's DeterministicCriticBundleV1). */
export type DeterministicCriticSummaryV1 = {
  bundleSha256: string;
  hasBlocker: boolean;
  blockerCheckIds: string[];
};

export type AggregatedChapterReviewV1 = {
  schema: "aggregated-chapter-review-v1";
  chapterContentSha256: string;
  readerResultSha256: string;
  sourceResultSha256: string;
  quizResultSha256: string;
  deterministicCriticBundleSha256: string;
  readerComposite: number;
  readerBar: number;
  finalStatus: "PASS" | "REVISE" | "BLOCK" | "INCONCLUSIVE";
  blockingReasons: string[];
  revisionReasons: string[];
  escalationReasons: string[];
};

/** The exact input the WP-B4 aggregator consumes. Binds the three typed lane
 *  results + the deterministic summary + the reader bar + every freshness
 *  expectation (so a stale bound hash forces INCONCLUSIVE, never a silent pass)
 *  + the deterministically-derived required-source-unit set. FROZEN Wave A. */
export type AggregateChapterReviewInputV1 = {
  reader: ReaderExperienceReviewV1;
  source: SourceIntegrityReviewV1;
  quiz: QuizIntegrityResultV1;
  deterministic: DeterministicCriticSummaryV1;
  readerBar: number;
  chapterContentSha256: string;
  expectedChapterContentSha256: string;
  expectedReaderDocumentSha256: string;
  expectedSourceUsePlanSha256: string;
  expectedSourcePacketSha256: string;
  expectedSidecarSha256: string;
  expectedReaderSchemaSha256: string;
  expectedSourceSchemaSha256: string;
  expectedQuizSchemaSha256: string;
  /** unitIds a source result MUST resolve (source_bound + anchored); an
   *  INCONCLUSIVE source verdict on one of these forces BLOCK, not REVISE. */
  requiredSourceUnitIds: string[];
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

const TOP_KEYS = [
  "schema", "chapterContentSha256", "readerResultSha256", "sourceResultSha256", "quizResultSha256",
  "deterministicCriticBundleSha256", "readerComposite", "readerBar", "finalStatus",
  "blockingReasons", "revisionReasons", "escalationReasons",
] as const;

export function validateAggregatedChapterReview(r: unknown): string[] {
  const errors: string[] = [];
  if (r === null || typeof r !== "object") return ["aggregate: not an object"];
  const v = r as Record<string, unknown>;
  expectFields(v, TOP_KEYS as unknown as string[], errors, "aggregate");
  noUnknownKeys(v, TOP_KEYS as unknown as string[], errors, "aggregate");
  if (v.schema !== "aggregated-chapter-review-v1") errors.push("aggregate: wrong schema tag");
  for (const f of ["chapterContentSha256", "readerResultSha256", "sourceResultSha256", "quizResultSha256", "deterministicCriticBundleSha256"] as const) {
    if (!isNonEmptyString(v[f])) errors.push(`aggregate: ${f} must be a non-empty string`);
  }
  if (typeof v.readerComposite !== "number" || !Number.isFinite(v.readerComposite)) errors.push("aggregate: readerComposite must be a finite number");
  if (typeof v.readerBar !== "number" || !Number.isFinite(v.readerBar)) errors.push("aggregate: readerBar must be a finite number");
  if (!isEnum(v.finalStatus, ["PASS", "REVISE", "BLOCK", "INCONCLUSIVE"])) errors.push("aggregate: finalStatus must be PASS|REVISE|BLOCK|INCONCLUSIVE");
  if (!isStringArray(v.blockingReasons)) errors.push("aggregate: blockingReasons must be string[]");
  if (!isStringArray(v.revisionReasons)) errors.push("aggregate: revisionReasons must be string[]");
  if (!isStringArray(v.escalationReasons)) errors.push("aggregate: escalationReasons must be string[]");
  return errors;
}

/** True iff the aggregate binds the CURRENT chapter + the CURRENT lane results
 *  and deterministic bundle. Any drift stales the aggregate (never a silent pass). */
export function aggregateIsFresh(
  a: AggregatedChapterReviewV1,
  expected: {
    chapterContentSha256: string;
    readerResultSha256: string;
    sourceResultSha256: string;
    quizResultSha256: string;
    deterministicCriticBundleSha256: string;
  },
): boolean {
  return (
    a.schema === "aggregated-chapter-review-v1" &&
    a.chapterContentSha256 === expected.chapterContentSha256 &&
    a.readerResultSha256 === expected.readerResultSha256 &&
    a.sourceResultSha256 === expected.sourceResultSha256 &&
    a.quizResultSha256 === expected.quizResultSha256 &&
    a.deterministicCriticBundleSha256 === expected.deterministicCriticBundleSha256
  );
}

export const AGGREGATED_CHAPTER_REVIEW_CONTRACT: ContractDescriptor = {
  name: "aggregated-chapter-review",
  version: 1,
  ownerPrompt: "IMP-20",
  description:
    "Conductor-owned aggregation of the reader, source, and quiz lanes plus the deterministic critic bundle into a single deterministic finalStatus (PASS|REVISE|BLOCK|INCONCLUSIVE); binds every lane result sha + the chapter content sha so any drift stales the verdict, and the model recommendation is evidence, never the gate.",
  fields: {
    AggregatedChapterReviewV1: {
      schema: "\"aggregated-chapter-review-v1\"",
      chapterContentSha256: "string", readerResultSha256: "string", sourceResultSha256: "string",
      quizResultSha256: "string", deterministicCriticBundleSha256: "string",
      readerComposite: "number", readerBar: "number",
      finalStatus: "\"PASS\"|\"REVISE\"|\"BLOCK\"|\"INCONCLUSIVE\"",
      blockingReasons: "string[]", revisionReasons: "string[]", escalationReasons: "string[]",
    },
  },
};
