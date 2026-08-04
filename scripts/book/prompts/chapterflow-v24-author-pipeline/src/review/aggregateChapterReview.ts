/**
 * Deterministic chapter-review aggregator (IMP-20 §D / WP-B4 runtime).
 *
 * Composes the three INDEPENDENT split lanes — reader-experience, source-and-
 * claim-integrity, quiz-integrity — plus the source lane's deterministic critic
 * bundle into a single, conductor-owned `finalStatus`. The model's advisory
 * `recommendation` is EVIDENCE, never the gate: `finalStatus` is computed here
 * from lane results + freshness alone and can never be read off the reader's ship
 * preference (IMP-20 verification #7; tests 17/18/19/20).
 *
 * Policy realised EXACTLY per §D (no gate weakening, no silent fallback):
 *
 *   BLOCK        ⟸ deterministic.hasBlocker
 *                OR ANY reader.blockingFindings (ANY category — presence, not a
 *                   hand-listed subset)
 *                OR source.result === "BLOCK"
 *                OR source.result === "INCONCLUSIVE" on a REQUIRED source unit
 *                   (unitId ∈ requiredSourceUnitIds, supportStatus INCONCLUSIVE)
 *                OR quiz.result === "BLOCK".
 *   INCONCLUSIVE ⟸ any stale bound hash (chapter/reader/source/quiz not fresh)
 *                OR quiz.result === "INCONCLUSIVE"
 *                OR source.result === "INCONCLUSIVE" that cannot be pinned to any
 *                   unit (evidence insufficient to certify). INCONCLUSIVE never
 *                   passes; a stale hash never passes.
 *   REVISE       ⟸ reader composite < bar
 *                OR reader `origin_ambiguous_to_reader` escalation while source PASS
 *                OR source.result === "INCONCLUSIVE" on a NON-required (constructed/
 *                   generic) unit — clarification, never a block
 *                OR quiz `tellDetected` advisory
 *                OR reader advisoryFindings (usable-with-non-blocking-defects).
 *   PASS         ⟸ none of the above fire: deterministic gates clean, reader
 *                   valid + composite ≥ bar + zero blocking findings, source PASS,
 *                   quiz PASS, and every bound hash fresh.
 *
 * Precedence is BLOCK ▸ INCONCLUSIVE ▸ REVISE ▸ PASS (most-severe wins): a
 * definitive defect blocks unconditionally; a chapter we cannot certify (stale /
 * missing evidence) is INCONCLUSIVE, never a REVISE or PASS; only a fully clean,
 * fresh, at-bar chapter passes.
 *
 * Reader escalation semantics (§A discharge): the reader lane owns NO external-
 * source-truth authority, so its `escalationSignals` are ADVISORY. Every
 * escalation is carried into `escalationReasons` as an annotation.
 * `origin_ambiguous_to_reader` (with source otherwise PASS) additionally drives a
 * REVISE (clarification needed). `possible_real_world_claim` /
 * `possible_attribution_issue` are annotations ONLY and never change the gate: the
 * source lane already runs independently on every unit, so a reader escalation
 * never triggers extra source attention and never becomes a source BLOCK
 * (test 13).
 *
 * This module is PURE — no fs, no env, no spawn, no model call.
 */

import { hashCanonical } from "../contracts/contractUtil.js";
import { REVIEW_FACTORS, type ReviewFactor } from "../artifacts/artifactTypes.js";
import { REVIEW_WEIGHTS } from "./readerReview.js";
import type {
  AggregateChapterReviewInputV1,
  AggregatedChapterReviewV1,
} from "../contracts/aggregateChapterReview.js";
import { readerReviewIsFresh } from "../contracts/readerExperienceReview.js";
import { sourceReviewIsFresh } from "../contracts/sourceIntegrityReview.js";

/**
 * The reader-lane composite = the weighted mean of the 10 rubric factors, using
 * the SAME frozen weights + rounding the legacy adjudicator uses
 * (`readerReview.ts` — weighted sum ÷ 100, one decimal). Reusing the single
 * source of truth means a weight change tracks automatically and the split-lane
 * composite can never silently diverge from the legacy composite.
 */
export function computeReaderComposite(scores: Record<ReviewFactor, number>): number {
  let weighted = 0;
  for (const f of REVIEW_FACTORS) weighted += REVIEW_WEIGHTS[f] * scores[f];
  return Math.round((weighted / 100) * 10) / 10;
}

/**
 * Compose the three lane results + deterministic bundle into the frozen
 * `AggregatedChapterReviewV1`. Pure, deterministic, model-recommendation-blind.
 */
export function aggregateChapterReview(input: AggregateChapterReviewInputV1): AggregatedChapterReviewV1 {
  const { reader, source, quiz, deterministic } = input;
  const readerBar = input.readerBar;

  // Four SEPARATE severity buckets drive the precedence decision. The output
  // shape carries only three reason arrays, so the "cannot-certify" bucket is
  // serialised into `blockingReasons` (every hard reason the chapter did not
  // reach PASS); `finalStatus` remains the authoritative BLOCK-vs-INCONCLUSIVE
  // discriminator.
  const blockingReasons: string[] = [];       // definitive defects → BLOCK
  const inconclusiveReasons: string[] = [];    // cannot certify (stale / missing) → INCONCLUSIVE
  const revisionReasons: string[] = [];        // usable, needs work → REVISE
  const escalationReasons: string[] = [];      // advisory annotations, never a gate on their own

  // ── 1. Freshness. Any stale bound hash → INCONCLUSIVE (never a silent pass). ──
  if (input.chapterContentSha256 !== input.expectedChapterContentSha256) {
    inconclusiveReasons.push(
      `stale: aggregate chapterContentSha256 does not match the current chapter (expected ${input.expectedChapterContentSha256})`,
    );
  }
  if (
    !readerReviewIsFresh(
      reader,
      input.expectedChapterContentSha256,
      input.expectedReaderDocumentSha256,
      input.expectedReaderSchemaSha256,
    )
  ) {
    inconclusiveReasons.push("stale: reader review is not fresh against the current chapter / reader doc / reader schema");
  }
  if (
    !sourceReviewIsFresh(
      source,
      input.expectedChapterContentSha256,
      input.expectedSourceUsePlanSha256,
      input.expectedSourcePacketSha256,
      input.expectedSidecarSha256,
      input.expectedSourceSchemaSha256,
    )
  ) {
    inconclusiveReasons.push("stale: source review is not fresh against the current chapter / source-use plan / packet / sidecar / source schema");
  }
  // The quiz result binds the chapter content + its committed derivation, not an
  // output-schema sha; freshness for the quiz lane is therefore its schema tag +
  // chapter-content binding. (`expectedQuizSchemaSha256` binds the recovery
  // instrument manifest, not the per-chapter quiz result, so there is no quiz
  // field to compare it against here.)
  if (quiz.schema !== "quiz-integrity-result-v1" || quiz.chapterContentSha256 !== input.expectedChapterContentSha256) {
    inconclusiveReasons.push("stale: quiz review is not fresh against the current chapter");
  }

  // ── 2. Deterministic critic bundle (runs FIRST; never re-voted by a model). ──
  if (deterministic.hasBlocker) {
    const ids = deterministic.blockerCheckIds.length > 0 ? deterministic.blockerCheckIds.join(", ") : "(unnamed check)";
    blockingReasons.push(`deterministic critic blocker(s): ${ids}`);
  }

  // ── 3. Reader lane. ANY blocking finding blocks, in ANY category. ──
  for (const f of reader.blockingFindings) {
    blockingReasons.push(`reader blocker [${f.category}] @ ${f.unit}: ${f.problem}`);
  }
  // Every reader escalation is carried as an advisory annotation (§A discharge).
  for (const s of reader.escalationSignals) {
    escalationReasons.push(`reader escalation [${s.category}] @ ${s.unit}: ${s.problem}`);
  }

  // ── 4. Source lane. Only this lane holds external-source-truth authority. ──
  if (source.result === "BLOCK") {
    const ids = source.blockingFindingIds.length > 0 ? source.blockingFindingIds.join(", ") : "(unnamed finding)";
    blockingReasons.push(`source lane BLOCK: ${ids}`);
  } else if (source.result === "INCONCLUSIVE") {
    const requiredUnitIds = new Set(input.requiredSourceUnitIds);
    const requiredInconclusive = source.units.filter(
      (u) => requiredUnitIds.has(u.unitId) && u.supportStatus === "INCONCLUSIVE",
    );
    const nonRequiredInconclusive = source.units.filter(
      (u) => !requiredUnitIds.has(u.unitId) && u.supportStatus === "INCONCLUSIVE",
    );
    if (requiredInconclusive.length > 0) {
      // A unit that MUST be source-supported could not be verified → cannot ship.
      blockingReasons.push(
        `source INCONCLUSIVE on required source-bound unit(s): ${requiredInconclusive.map((u) => u.unitId).join(", ")}`,
      );
    } else if (nonRequiredInconclusive.length > 0) {
      // Constructed / generic units carry no external claim that must be sourced →
      // clarification, not a block.
      const ids = nonRequiredInconclusive.map((u) => u.unitId).join(", ");
      revisionReasons.push(`source INCONCLUSIVE on non-required unit(s) — clarification needed: ${ids}`);
      escalationReasons.push(`source could not verify non-required unit(s): ${ids}`);
    } else {
      // Lane-level INCONCLUSIVE with no per-unit pin → evidence insufficient to
      // certify the source lane at all.
      inconclusiveReasons.push("source lane INCONCLUSIVE (evidence insufficient to certify)");
    }
  }

  // ── 5. Quiz lane. Quiz correctness is owned here, never by a reader's taste. ──
  if (quiz.result === "BLOCK") {
    const defects = quiz.questions
      .filter((q) => !q.keyCorrect || !q.uniqueAnswer || !q.mechanismSupported)
      .map((q) => {
        const why = !q.keyCorrect
          ? "wrong key"
          : !q.uniqueAnswer
            ? "not uniquely answerable"
            : "mechanism unsupported";
        return `${q.itemId}: ${why}`;
      });
    blockingReasons.push(`quiz lane BLOCK: ${defects.length > 0 ? defects.join("; ") : "(unnamed defect)"}`);
  } else if (quiz.result === "INCONCLUSIVE") {
    inconclusiveReasons.push("quiz lane INCONCLUSIVE (adjudication unavailable)");
  }
  // Answer-tell is advisory (deterministic heuristic) → REVISE, never a hard block.
  const tellItems = quiz.questions.filter((q) => q.tellDetected);
  if (tellItems.length > 0) {
    revisionReasons.push(`quiz answer-tell(s) detected: ${tellItems.map((q) => q.itemId).join(", ")}`);
  }

  // ── 6. Reader quality bar + origin-ambiguity + non-blocking craft defects. ──
  const readerComposite = computeReaderComposite(reader.scores);
  if (readerComposite < readerBar) {
    revisionReasons.push(`reader composite ${readerComposite} is below the bar ${readerBar}`);
  }
  const sourceSound = source.result === "PASS";
  const hasOriginAmbiguity = reader.escalationSignals.some((s) => s.category === "origin_ambiguous_to_reader");
  if (hasOriginAmbiguity && sourceSound) {
    // A reader-undecidable "reads as factual but status unclear" while the source
    // lane found nothing wrong → the register needs clarifying, not a block.
    revisionReasons.push("reader flagged origin_ambiguous_to_reader while the source lane PASSED — register clarification needed");
  }
  // Usable-with-non-blocking-defects: the reader's non-blocking craft findings
  // keep the chapter usable but off a clean PASS.
  for (const f of reader.advisoryFindings) {
    revisionReasons.push(`reader craft defect [${f.category}] @ ${f.unit}: ${f.problem}`);
  }

  // ── 7. Final status — precedence BLOCK ▸ INCONCLUSIVE ▸ REVISE ▸ PASS. ──
  const finalStatus: AggregatedChapterReviewV1["finalStatus"] =
    blockingReasons.length > 0
      ? "BLOCK"
      : inconclusiveReasons.length > 0
        ? "INCONCLUSIVE"
        : revisionReasons.length > 0
          ? "REVISE"
          : "PASS";

  return {
    schema: "aggregated-chapter-review-v1",
    chapterContentSha256: input.chapterContentSha256,
    readerResultSha256: hashCanonical(reader),
    sourceResultSha256: hashCanonical(source),
    quizResultSha256: hashCanonical(quiz),
    deterministicCriticBundleSha256: deterministic.bundleSha256,
    readerComposite,
    readerBar,
    finalStatus,
    // Serialise the cannot-certify bucket into blockingReasons (every hard reason
    // PASS was not reached); finalStatus discriminates BLOCK from INCONCLUSIVE.
    blockingReasons: [...blockingReasons, ...inconclusiveReasons],
    revisionReasons,
    escalationReasons,
  };
}
