/**
 * laneOrchestrator — IMP-20 split-lane reader panel on the LIVE review seam
 * (Task 9, semantic review stage 2).
 *
 * Task 8 restored a SINGLE reader-experience read per chapter onto the live
 * `SemanticPanelReviewEvaluator`. This module restores the IMP-20 §G design's
 * blind, multi-seat READER PANEL: three reader seats read the same chapter and
 * their composites are MEDIANED (never averaged, never read off one reader). It
 * reuses the genuine shared primitives — `buildReaderExperienceTask` /
 * `parseReaderExperienceReview` / `assembleReaderExperienceReview` (the reader
 * lane runtime, WP-B1) and `computeReaderComposite` (the single source of truth
 * for the weighted-mean composite, WP-B4 §D) — so this path can never silently
 * diverge from the frozen reader instrument or composite arithmetic.
 *
 * FIDELITY CAVEAT — "seat" diversity is LENS diversity, not model diversity.
 * Under owner decision D1 every review role is frozen to ONE route (Sonnet-5 at
 * xhigh via `config/model-routing.json`). The three seats therefore differ only
 * by the blind reading-stance header appended to the same frozen instrument, all
 * routed to the same model — one model reading three times under three lenses.
 * This is NOT IMP-20 §G's original reviewer-diversity-across-independent-models
 * (that lived in the bakeoff judge-qualification harness, which qualified a PANEL
 * of distinct judge profiles). It is the strongest panel the frozen single-route
 * production seam can honestly offer; the median + union-of-findings still guard
 * against a single unstable read, but a future reader must not mistake this for
 * multi-model diversity.
 *
 * DEVIATION FROM PLAN Task 9 Step 3 / Interfaces (recorded, not silent).
 * The plan prescribed EXTRACTION: "Implement laneOrchestrator.ts BY EXTRACTION
 * from bakeoff/migration; bakeoff keeps working by importing the extracted
 * module", producing the contracted `AggregatedChapterReviewV1`. This module
 * instead is a self-contained reader-only re-implementation producing
 * `ReaderPanelReviewV1`, and does NOT extract from bakeoff/migration. Rationale:
 *   - Step-1 map — how bakeoff/migration invokes lanes today: the "lanes" there
 *     are a CORPUS-SCALE judge-QUALIFICATION experiment harness, not a per-chapter
 *     live reader panel. `reviewLaneTypes.ts:73` fixes the lane roles to
 *     reader|source|quiz; `reviewerRoleAssignment.ts:63-84` (`assignFixedRoles`)
 *     maps a sealed experiment's flat judge panel onto fixed role slots;
 *     `reviewRunner.ts:62-124` (`panelAssignment`/`runReview`) assigns a frozen
 *     primary + agreement judge PER SAMPLE CELL from an `ExperimentSpecV1`;
 *     `aggregateChapterReview` (`review/aggregateChapterReview.ts:80`) is the WP-B4
 *     conductor that folds reader + source + quiz + deterministic-critic bundle
 *     into `AggregatedChapterReviewV1`. None of that machinery takes a bare
 *     `ChapterV21` + `ModelTaskRunner`; it is driven by sealed experiment specs,
 *     role-qualification registries, and source/quiz lane inputs.
 *   - Why not extract / why the produced-type contract changed
 *     (`AggregatedChapterReviewV1` → `ReaderPanelReviewV1`): the LIVE evaluator is
 *     fed only the reader-facing page — it has no source packet, plan, sidecar, or
 *     committed quiz derivation, so it cannot honestly feed the source and quiz
 *     lanes `aggregateChapterReview` requires. Synthesising them would fabricate
 *     PASS lanes and defeat that aggregator's fail-closed freshness gates. There
 *     is no per-chapter reader-panel primitive inside bakeoff/migration to lift;
 *     the honest reader-only unit is exactly the three shared reader primitives
 *     this module already reuses. The reader-panel median is what a reader-only
 *     seam can own.
 * This is a conscious departure from the prescribed extraction and typed
 * interface; it awaits owner/orchestrator acknowledgement rather than presenting
 * itself as the contracted extraction.
 *
 * Design honored from IMP-20 §G (fixed, output-independent role assignment):
 *   - The seat set is FROZEN (`READER_PANEL_SEATS`): a pure constant, never a
 *     function of the chapter content, execution order, or any candidate model.
 *     A chapter cannot be re-rolled onto a more convenient seat.
 *   - Every seat prompt is BLIND: it composes the frozen reader task (which
 *     already carries no author/model identity) with a seat-lens header that
 *     names only a reader stance — never a model, an author session, a role id,
 *     or attempt metadata. Blindness is a property of the prompt bytes, tested.
 *
 * Aggregation semantics (§D median semantics, adapted to a reader-only panel):
 *   - The panel SCORE is the MEDIAN of the seat composites (odd seat count → the
 *     middle value), never the mean and never a single seat's opinion.
 *   - Findings are UNIONED across seats and tagged with the raising seat: any
 *     seat's on-page-decidable blocking finding surfaces (fail-closed — the
 *     reader lane holds no external-source-truth authority, so its blockers are
 *     on-page-decidable and a missed defect is worse than a redundant one).
 *
 * This module makes NO model call of its own and imports NO model provider —
 * every reader read goes through the injected `ModelTaskRunner` (the router
 * choke in production, a scripted runner in tests). The full three-LANE
 * aggregate (`aggregateChapterReview`: reader + source + quiz + deterministic
 * bundle) is deliberately NOT produced here: the live panel evaluator is fed
 * only the reader-facing page, so it has no source packet / plan / sidecar /
 * committed quiz derivation to feed the source and quiz lanes; synthesising them
 * would fabricate PASS lanes and defeat that aggregator's fail-closed freshness
 * gates. The reader-panel median is what the reader-only seam can honestly own.
 */

import { createHash } from "node:crypto";

import { chapterContentHash } from "../critics/qcAttestation.js";
import { hashCanonical } from "../contracts/contractUtil.js";
import { ensureTrailingNewline } from "../lib/atomicWrite.js";
import type { ModelTaskContext } from "../contracts/v4Core.js";
import type { ReaderExperienceReviewV1 } from "../contracts/readerExperienceReview.js";
import {
  ReaderExperienceReviewError,
  assembleReaderExperienceReview,
  buildReaderExperienceTask,
  parseReaderExperienceReview,
  readerExperienceDocHash,
} from "./readerExperienceReview.js";
import { computeReaderComposite } from "./aggregateChapterReview.js";
import { renderChapterReaderDocPhase1 } from "./renderReaderDoc.js";
import type { ChapterV21 } from "../types.js";
import {
  jsonPromptRequest,
  renderUntrustedSourceBlock,
  type ModelTaskRunner,
} from "../app/modelTaskRunner.js";

/** The reader-panel `schemaSha256` binding. The frozen reader validator
 *  (`validateReaderExperienceReview`) REQUIRES a non-empty `schemaSha256` on
 *  every assembled record, so this is a load-bearing binding, not a freshness
 *  anchor: no live consumer on this seam reads it for freshness (the panel
 *  evaluator gates on median + findings, never on record staleness). It is a
 *  deterministic tag over the frozen instrument id so the value is stable across
 *  runs and identical across the three seats. */
const READER_PANEL_OUTPUT_SCHEMA_SHA = createHash("sha256")
  .update("semantic-panel-reader-experience-review-v1")
  .digest("hex");

/**
 * A blind reader seat. `id` is a stance label only (never a model / author
 * identity); `lens` is a one-line reading emphasis appended to the frozen reader
 * task so each seat reads under a distinct — but still blind — stance.
 */
export type ReaderPanelSeatV1 = {
  readonly id: string;
  readonly lens: string;
};

/**
 * The FROZEN three-seat reader panel (IMP-20 §G — fixed, output-independent). A
 * pure constant: the same three seats read every chapter, in this order,
 * regardless of content or execution order. Odd count so the composite median is
 * always a single seat's value (no tie averaging).
 */
export const READER_PANEL_SEATS: readonly ReaderPanelSeatV1[] = Object.freeze([
  Object.freeze({
    id: "seat-cold",
    lens: "Read as a first-time reader meeting this material cold: judge whether the core move lands and sticks without prior context.",
  }),
  Object.freeze({
    id: "seat-skeptic",
    lens: "Read as a skeptical reader hunting for on-page defects: internal contradictions, broken structure, unusable steps, unfair or tell-laden quizzes.",
  }),
  Object.freeze({
    id: "seat-practitioner",
    lens: "Read as a practitioner who intends to APPLY this today: judge whether the actions are concrete, low-friction, and real-world usable.",
  }),
]);

/** One reader finding, tagged with the seat that raised it. */
export type PanelFindingV1 = {
  readonly seatId: string;
  readonly category: string;
  readonly unit: string;
  readonly problem: string;
};

/**
 * The reader-panel median result — the honest aggregate a reader-only seam can
 * produce. Carries the per-seat composites + their median, the per-seat result
 * provenance hashes, and the unioned/seat-tagged findings the evaluator maps to
 * review issues.
 */
export type ReaderPanelReviewV1 = {
  readonly schema: "reader-panel-review-v1";
  readonly chapterContentSha256: string;
  readonly readerCount: number;
  readonly seatIds: readonly string[];
  readonly composites: readonly number[];
  readonly medianComposite: number;
  /** hashCanonical(review) per seat, in seat order — provenance, not a re-vote. */
  readonly readerResultSha256s: readonly string[];
  readonly blockingFindings: readonly PanelFindingV1[];
  readonly advisoryFindings: readonly PanelFindingV1[];
  readonly escalationSignals: readonly PanelFindingV1[];
};

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/** The median of a non-empty numeric list (odd length → the middle element;
 *  even length → the mean of the two middle elements). */
export function medianOf(values: readonly number[]): number {
  if (values.length === 0) throw new Error("medianOf requires a non-empty list");
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[mid];
  return (sorted[mid - 1] + sorted[mid]) / 2;
}

/** Build the BLIND reader task for one seat: the seat-lens header (a reader
 *  stance only) followed by the frozen reader-experience instrument. The header
 *  carries no model / author / role-id / attempt identity — blindness is a
 *  property of these bytes. */
export function buildBlindReaderTask(seat: ReaderPanelSeatV1, docRelPath: string): string {
  return [
    `READER-PANEL SEAT (independent blind read). ${seat.lens}`,
    "You are one of several independent readers; you do not know how this chapter was produced, who wrote it, or which tool judged it. Judge only what is on the page.",
    "",
    buildReaderExperienceTask(docRelPath),
  ].join("\n");
}

/** Median the seat reviews into the panel result: per-seat composites, their
 *  median, and the unioned/seat-tagged findings. Pure. */
export function aggregateReaderPanel(
  chapterContentSha256: string,
  seats: readonly { seatId: string; review: ReaderExperienceReviewV1 }[],
): ReaderPanelReviewV1 {
  if (seats.length === 0) throw new Error("aggregateReaderPanel requires at least one seat review");
  const composites = seats.map(({ review }) => computeReaderComposite(review.scores));
  const blockingFindings: PanelFindingV1[] = [];
  const advisoryFindings: PanelFindingV1[] = [];
  const escalationSignals: PanelFindingV1[] = [];
  for (const { seatId, review } of seats) {
    for (const f of review.blockingFindings) blockingFindings.push({ seatId, category: f.category, unit: f.unit, problem: f.problem });
    for (const f of review.advisoryFindings) advisoryFindings.push({ seatId, category: f.category, unit: f.unit, problem: f.problem });
    for (const f of review.escalationSignals) escalationSignals.push({ seatId, category: f.category, unit: f.unit, problem: f.problem });
  }
  return {
    schema: "reader-panel-review-v1",
    chapterContentSha256,
    readerCount: seats.length,
    seatIds: seats.map(({ seatId }) => seatId),
    composites,
    medianComposite: medianOf(composites),
    readerResultSha256s: seats.map(({ review }) => hashCanonical(review)),
    blockingFindings,
    advisoryFindings,
    escalationSignals,
  };
}

export interface RunReaderLanesInput {
  readonly chapter: ChapterV21;
  readonly chapterNumber: number;
  readonly runner: ModelTaskRunner;
  /** Number of reader seats to run; must equal `READER_PANEL_SEATS.length`. */
  readonly readers: number;
  readonly taskContext: ModelTaskContext;
  /** Gateway route profile for reader tasks (attempt-scoped read-json profile). */
  readonly profileId?: string;
}

/**
 * Run the blind reader panel over one chapter: render the phase-1 reader doc
 * once, run each of the frozen seats through the injected runner under a distinct
 * blind task + attempt id, strict-assemble each `ReaderExperienceReviewV1`, and
 * median-aggregate. Fail-closed: a seat whose output cannot be parsed / assembled
 * throws `ReaderExperienceReviewError`; a seat whose runner did not SUCCEED
 * throws a plain `Error` (`SEMANTIC_PANEL_READER_<outcome>:...`) — the caller
 * classifies the two and never lets an uncertain seat silently pass.
 */
export async function runReaderLanes(input: RunReaderLanesInput): Promise<ReaderPanelReviewV1> {
  if (input.readers !== READER_PANEL_SEATS.length) {
    throw new Error(
      `runReaderLanes: readers must equal the frozen seat count ${READER_PANEL_SEATS.length} (got ${input.readers})`,
    );
  }
  const rendered = ensureTrailingNewline(renderChapterReaderDocPhase1(input.chapter));
  const bindings = {
    chapterContentSha256: chapterContentHash(input.chapter),
    readerDocumentSha256: readerExperienceDocHash(input.chapter),
    schemaSha256: READER_PANEL_OUTPUT_SCHEMA_SHA,
  } as const;
  const profileId = input.profileId ?? "attempt-read-json-v1";
  const docRelPath = `chapter-${pad(input.chapterNumber)} (provided inline below)`;

  const seatReviews: { seatId: string; review: ReaderExperienceReviewV1 }[] = [];
  for (const seat of READER_PANEL_SEATS) {
    const task = buildBlindReaderTask(seat, docRelPath);
    const context: ModelTaskContext = {
      ...input.taskContext,
      attemptId: `${input.taskContext.attemptId}-reader-ch${pad(input.chapterNumber)}-${seat.id}`,
      operationId: `reader-review-ch${pad(input.chapterNumber)}-${seat.id}`,
    };
    const result = await input.runner.run({
      profileId,
      // The V4 gateway feeds content inline (not a workspace file), so the
      // rendered reader doc rides as untrusted source data beside the task.
      prompt: jsonPromptRequest(task, renderUntrustedSourceBlock("reader-document", rendered, "markdown")),
      context,
    });
    if (result.outcome !== "SUCCEEDED") {
      const detail = result.error ? `${result.error.code}:${result.error.message}` : result.outcome;
      throw new Error(`SEMANTIC_PANEL_READER_${result.outcome}:${detail}`);
    }
    const stdout = typeof result.output === "string" ? result.output : JSON.stringify(result.output ?? null);
    const parsed = parseReaderExperienceReview(stdout);
    if (parsed === null) {
      throw new ReaderExperienceReviewError(
        `reader-panel seat ${seat.id}: no parseable JSON object in the reviewer output`,
      );
    }
    seatReviews.push({ seatId: seat.id, review: assembleReaderExperienceReview(parsed, bindings) });
  }
  return aggregateReaderPanel(bindings.chapterContentSha256, seatReviews);
}
