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
import { isUnretryableProviderMessage } from "../runtime/modelErrors.js";

import { REVIEW_FACTORS, type ReviewFactor } from "../artifacts/artifactTypes.js";

import { chapterContentHash } from "../critics/qcAttestation.js";
import { hashCanonical } from "../contracts/contractUtil.js";
import { ensureTrailingNewline } from "../lib/atomicWrite.js";
import type { ModelTaskContext } from "../contracts/v4Core.js";
import type { ModelResult } from "../runtime/modelResult.js";
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
  /**
   * The MEDIAN of the seat scores for each of the 10 rubric factors, factor-keyed.
   *
   * The composite is a weighted mean, so a below-bar composite is compatible with
   * every arrangement of the ten factors — one collapsed factor or ten mediocre
   * ones look identical from outside. Every seat already scores each factor;
   * before this field the panel threw those scores away and only the rolled-up
   * number survived, so nothing downstream — repair, diagnosis, an operator
   * reading the round — could tell WHICH factor was dragging a chapter.
   * Medianed per factor, by the same rule as the composite, so no single seat's
   * outlier decides which factor looks weak.
   */
  readonly factorMedians: Readonly<Record<ReviewFactor, number>>;
  /** hashCanonical(review) per seat, in seat order — provenance, not a re-vote. */
  readonly readerResultSha256s: readonly string[];
  readonly blockingFindings: readonly PanelFindingV1[];
  readonly advisoryFindings: readonly PanelFindingV1[];
  readonly escalationSignals: readonly PanelFindingV1[];
};

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/**
 * Bounded reader-task retry (Task 11ac, finding 38 LAYER A). A reader seat's
 * single model call used to fail-close the whole panel to ERROR on the first
 * transient blip — the class the research (11a/11c/11k) and compile (11j/11k)
 * lanes already recover. A reader read is now retried up to
 * `MAX_READER_SEAT_ATTEMPTS` times on a transient outcome, each attempt admitting
 * a FRESH ordinal run-state attempt (the reader-lane run has generous capacity).
 *
 * BUDGET RAISED 3 -> 4, deliberately, and here is the whole argument.
 *
 * The 11ac budget was THREE, and `MODEL_OUTPUT_INVALID` was already inside the
 * transient class — so the live canary failure
 *   `SEMANTIC_PANEL_READER_FAILED:MODEL_OUTPUT_INVALID:model output failed
 *    source-controlled schema validation` (Bennett review-af245c99, ch09)
 * is an EXHAUSTED budget, not a missing retry. What made those three attempts
 * cheap is that they were BLIND RE-ROLLS: every attempt sent byte-identical
 * prompt bytes, so three draws came from one unchanged distribution and a seat
 * that fell in the schema-rejecting tail tended to stay there.
 *
 * Attempts 2..N now carry the schema rejection back (see
 * `buildReaderSeatRetryFeedback`), which is what the COMPILER lane (11j) and the
 * RESEARCH lane already do. That changes the meaning of the count: attempt 1 is
 * the blind draw and everything after it is an INFORMED repair, so the extra
 * attempt buys a genuinely different draw rather than a fourth roll of the same
 * die. Four = one blind draw + three informed repairs.
 *
 * The cost is bounded and paid only on the failing path: a healthy seat still
 * costs exactly ONE call, and the worst case grows by one call per seat that is
 * already failing every attempt. It is NOT raised further because a seat that
 * has rejected three informed repairs is evidence of a real instrument/route
 * problem, and burning more panel calls on it delays the honest ERROR without
 * changing it.
 */
export const MAX_READER_SEAT_ATTEMPTS = 4;

/** In-loop backoff schedule (ms) between transient reader retries, indexed by
 *  (attempt − 1) and clamped to the last entry — mirrors the research lane's
 *  escalating backoff so a provider rate-limit/overload incident clears on a
 *  short delay rather than an immediate re-spawn. */
export const READER_SEAT_RETRY_BACKOFF_MS: readonly number[] = Object.freeze([2000, 8000]);

function readerBackoffMsForAttempt(attempt: number): number {
  const index = Math.min(Math.max(attempt - 1, 0), READER_SEAT_RETRY_BACKOFF_MS.length - 1);
  return READER_SEAT_RETRY_BACKOFF_MS[index];
}

const defaultReaderSleep = (ms: number): Promise<void> => new Promise((done) => setTimeout(done, ms));

/**
 * The three headers a reader-seat RETRY card can open with. Exported so tests
 * assert on the same bytes the prompt carries rather than on a paraphrase, and
 * so the three causes stay distinguishable from outside.
 */
export const READER_SEAT_RETRY_FEEDBACK_HEADERS = Object.freeze({
  /** The GATEWAY's source-controlled output schema rejected the previous output
   *  (MODEL_OUTPUT_INVALID). The raw invalid output stays inside the gateway. */
  gatewaySchema: "PREVIOUS OUTPUT REJECTED BEFORE IT REACHED THIS PROCESS",
  /** The runner SUCCEEDED but the strict reader-review assembly refused the
   *  object. Here the validator's own message names the defect. */
  readerSchema: "PREVIOUS OUTPUT REJECTED BY THE READER-REVIEW SCHEMA",
  /** A non-completion (process failure / timeout): no content problem, no
   *  output to echo. */
  transient: "PREVIOUS ATTEMPT DID NOT COMPLETE",
} as const);

/** Why a reader seat is being re-attempted. `detail` is the rejecting layer's
 *  OWN message — never a paraphrase — so the card names the real defect. */
export type ReaderSeatRetryCause =
  | { readonly kind: "GATEWAY_SCHEMA"; readonly detail: string }
  | { readonly kind: "READER_SCHEMA"; readonly detail: string }
  | { readonly kind: "TRANSIENT"; readonly detail: string };

/** Longest rejection detail echoed into a retry card. The detail is machine
 *  text from our own layers, but a validator message can quote model bytes, so
 *  it is clamped and stripped of control characters before it re-enters a
 *  prompt. Long enough for a full field-path list; short enough that a
 *  pathological message cannot dominate the card. */
const READER_SEAT_FEEDBACK_DETAIL_LIMIT = 600;

function sanitizedFeedbackDetail(detail: string): string {
  // eslint-disable-next-line no-control-regex
  const flattened = detail.replace(/[\u0000-\u001f\u007f]+/g, " ").replace(/\s+/g, " ").trim();
  // BLINDNESS: a raw error string can carry provider/model/route identity
  // ("claude … overloaded", API hostnames, gateway profile ids). The blind seat
  // must never learn what model it is or what route ran it — adversarial review
  // demonstrated the leak through the TRANSIENT card. Redact identity tokens
  // BEFORE clamping so a long message cannot smuggle one past the cut.
  const redacted = flattened
    .replace(/\b(anthropic|claude|openai|gpt|codex|sonnet|opus|haiku|gemini)[\w.-]*/gi, "[provider]")
    .replace(/https?:\/\/\S+/gi, "[url]")
    .replace(/\b[A-Z][A-Z_]{3,}:\s*/g, "");
  return redacted.length <= READER_SEAT_FEEDBACK_DETAIL_LIMIT
    ? redacted
    : `${redacted.slice(0, READER_SEAT_FEEDBACK_DETAIL_LIMIT)}… [truncated]`;
}

/**
 * The LOCAL reader-schema rejection message a retry card quotes.
 *
 * The strict assembly's own message names the failing fields
 * (`reader-experience review is not schema-valid: <path> …`) — that list IS the
 * repair instruction. The seat's internal id is stripped: it is lane bookkeeping,
 * not a schema fact, and the blind seat must not be handed its own identity.
 */
function readerSchemaRejectionDetail(seatId: string, error: ReaderExperienceReviewError): string {
  return error.message.split(`reader-panel seat ${seatId}: `).join("");
}

/**
 * The correction block appended to a reader seat's task on a RETRY.
 *
 * Ported from the compiler's `retryFeedbackSection` (Task 11j) and the research
 * lane's `buildRetryFeedback`, with the same three rules those lanes settled on:
 *
 *   1. NEVER FABRICATE AN ECHO. A gateway rejection keeps the raw invalid output
 *      inside the gateway; the card says so instead of inventing a draft to
 *      "repair". A LOCAL reader-schema rejection is different — the strict
 *      assembly's own message names the defect, so it is quoted verbatim.
 *   2. A NON-COMPLETION IS NOT A CONTENT DEFECT. A process failure or timeout
 *      produced no output at all; the card says nothing was wrong with the
 *      content and asks only for a correct result.
 *   3. THE CARD STAYS BLIND. It names the rejecting SCHEMA, never the model, the
 *      route, the run/attempt/operation id, or the seat's own identity — the
 *      blindness invariant is a property of these bytes and is tested.
 */
export function buildReaderSeatRetryFeedback(cause: ReaderSeatRetryCause): string {
  const detail = sanitizedFeedbackDetail(cause.detail);
  const closing = "Return exactly ONE JSON object that satisfies the reader-experience review schema above — every required field present — and nothing else.";
  if (cause.kind === "TRANSIENT") {
    // No raw detail: a transient infra message teaches the seat nothing about
    // its content and is the channel provider identity leaked through. The card
    // says only what the seat needs to know — the attempt did not complete.
    return [
      `${READER_SEAT_RETRY_FEEDBACK_HEADERS.transient} — the previous attempt did not complete; nothing was wrong with your content:`,
      `Simply produce a correct result this time. ${closing}`,
    ].join("\n");
  }
  if (cause.kind === "GATEWAY_SCHEMA") {
    return [
      `${READER_SEAT_RETRY_FEEDBACK_HEADERS.gatewaySchema} — the output-schema gate rejected it:`,
      `- ${detail}`,
      `The raw rejected output stays inside that gate and cannot be shown to you here, so re-read the schema above rather than editing a previous draft. ${closing}`,
    ].join("\n");
  }
  return [
    `${READER_SEAT_RETRY_FEEDBACK_HEADERS.readerSchema} — fix exactly this:`,
    `- ${detail}`,
    `Keep everything that was already correct and change only what the line above names. ${closing}`,
  ].join("\n");
}

/**
 * Classify a reader-model result as a TRANSIENT class the bounded retry should
 * re-attempt — the structured sibling of the research lane's string classifiers
 * (`researcher-chapter.ts`), decided on the `ModelResult` the runner returns
 * directly rather than on a thrown `MODEL_TASK_*` string:
 *   - TIMED_OUT (any code): killed at the profile horizon before any output;
 *   - FAILED + MODEL_PROCESS_FAILED: a rate-limited/overloaded subprocess that
 *     exited nonzero;
 *   - FAILED + MODEL_OUTPUT_INVALID: a gateway-level output-schema rejection, the
 *     same variance class a fresh attempt routinely clears.
 * CANCELLED (operator intent), UNKNOWN (uncertain teardown), and any other FAILED
 * code (capacity, admission collision, …) are NOT transient and stay fail-closed.
 */
export function isTransientReaderModelResult(result: ModelResult): boolean {
  if (result.outcome === "TIMED_OUT") return true;
  if (result.outcome === "FAILED") {
    const code = result.error?.code;
    // Task 11af: a durable quota cap is never transient — 21 reader seats x 3
    // attempts against an exhausted window is pure waste.
    if (isUnretryableProviderMessage(result.error?.message ?? "")) return false;
    return code === "MODEL_PROCESS_FAILED" || code === "MODEL_OUTPUT_INVALID";
  }
  return false;
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
  const factorMedians = Object.fromEntries(
    REVIEW_FACTORS.map((factor) => [factor, medianOf(seats.map(({ review }) => review.scores[factor]))]),
  ) as Record<ReviewFactor, number>;
  return {
    schema: "reader-panel-review-v1",
    chapterContentSha256,
    readerCount: seats.length,
    seatIds: seats.map(({ seatId }) => seatId),
    composites,
    medianComposite: medianOf(composites),
    factorMedians,
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
  /** Injectable backoff between bounded reader retries (Task 11ac). Faked to
   *  resolve instantly in tests so the schedule is asserted without a wall-clock
   *  wait; production uses setTimeout. */
  readonly sleep?: (ms: number) => Promise<void>;
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
  const sleep = input.sleep ?? defaultReaderSleep;
  // The V4 gateway feeds content inline (not a workspace file), so the rendered
  // reader doc rides as untrusted source data beside the task. Rendered once —
  // every seat + every retry reads the same page.
  const readerDocumentBlock = renderUntrustedSourceBlock("reader-document", rendered, "markdown");

  const seatReviews: { seatId: string; review: ReaderExperienceReviewV1 }[] = [];
  for (const seat of READER_PANEL_SEATS) {
    const baseTask = buildBlindReaderTask(seat, docRelPath);
    const seatAttemptBase = `${input.taskContext.attemptId}-reader-ch${pad(input.chapterNumber)}-${seat.id}`;
    const operationId = `reader-review-ch${pad(input.chapterNumber)}-${seat.id}`;
    // Bounded reader retry (Task 11ac): a transient seat result (timeout /
    // process-failure / gateway output-schema rejection) is re-attempted with a
    // FRESH ordinal attempt id, so one provider blip no longer fail-closes the
    // panel to ERROR. A seat whose runner SUCCEEDED but whose output fails the
    // local reader-review parse/strict-assembly (live round 4: a seat omitted
    // quizDerivation.tells) is the SAME variance class as a gateway
    // MODEL_OUTPUT_INVALID — the gateway only checks that stdout is JSON, while
    // the reader schema is enforced here — so it consumes the same bounded
    // budget. A fatal result (CANCELLED / UNKNOWN / any other code) and an
    // exhausted budget both throw — fail-closed is preserved.
    //
    // THE RETRY NOW TEACHES. Until this loop carried `cause`, every attempt of a
    // seat sent byte-identical prompt bytes: a blind re-roll from one unchanged
    // distribution, which is why the live ch09 seat could reject its whole
    // budget on the same schema defect. Attempts 2..N append the rejecting
    // layer's own message (`buildReaderSeatRetryFeedback`), the way the compiler
    // (11j) and research lanes already do — attempt 1 is the blind draw, every
    // attempt after it is an informed repair. Nothing about the GATE moves: the
    // feedback changes only what the seat is told, never what is accepted.
    let review: ReaderExperienceReviewV1 | undefined;
    /** Why the previous attempt of THIS seat was rejected; undefined on the
     *  first attempt, which must stay a clean read of the frozen instrument. */
    let cause: ReaderSeatRetryCause | undefined;
    for (let attempt = 1; attempt <= MAX_READER_SEAT_ATTEMPTS; attempt += 1) {
      const context: ModelTaskContext = {
        ...input.taskContext,
        attemptId: attempt === 1 ? seatAttemptBase : `${seatAttemptBase}-a${attempt}`,
        operationId,
      };
      const task = cause === undefined ? baseTask : `${baseTask}\n\n${buildReaderSeatRetryFeedback(cause)}`;
      const result: ModelResult = await input.runner.run({
        profileId,
        prompt: jsonPromptRequest(task, readerDocumentBlock),
        context,
      });
      if (result.outcome !== "SUCCEEDED") {
        const detail = result.error ? `${result.error.code}:${result.error.message}` : result.outcome;
        if (attempt < MAX_READER_SEAT_ATTEMPTS && isTransientReaderModelResult(result)) {
          // A gateway output-schema rejection is a CONTENT rejection the next
          // attempt can act on; a timeout / process failure produced no output
          // at all and carries no content lesson. The two get different cards.
          cause = result.outcome === "FAILED" && result.error?.code === "MODEL_OUTPUT_INVALID"
            ? { kind: "GATEWAY_SCHEMA", detail: result.error.message }
            : { kind: "TRANSIENT", detail };
          await sleep(readerBackoffMsForAttempt(attempt));
          continue;
        }
        throw new Error(`SEMANTIC_PANEL_READER_${result.outcome}:${detail}`);
      }
      const stdout = typeof result.output === "string" ? result.output : JSON.stringify(result.output ?? null);
      try {
        const parsed = parseReaderExperienceReview(stdout);
        if (parsed === null) {
          throw new ReaderExperienceReviewError(
            `reader-panel seat ${seat.id}: no parseable JSON object in the reviewer output`,
          );
        }
        review = assembleReaderExperienceReview(parsed, bindings);
        break;
      } catch (error) {
        if (!(error instanceof ReaderExperienceReviewError) || attempt >= MAX_READER_SEAT_ATTEMPTS) throw error;
        // Unlike the gateway, this layer HAS the defect: the strict assembly's
        // message names the missing/invalid field, so it is quoted verbatim.
        cause = { kind: "READER_SCHEMA", detail: readerSchemaRejectionDetail(seat.id, error) };
        await sleep(readerBackoffMsForAttempt(attempt));
      }
    }
    if (!review) {
      // Unreachable: the loop either assigns on success or throws above.
      throw new Error("SEMANTIC_PANEL_READER_UNKNOWN:reader retry loop terminated without a result");
    }
    seatReviews.push({ seatId: seat.id, review });
  }
  return aggregateReaderPanel(bindings.chapterContentSha256, seatReviews);
}
