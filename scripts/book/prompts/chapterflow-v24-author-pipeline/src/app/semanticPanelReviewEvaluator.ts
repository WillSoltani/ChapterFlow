/**
 * SemanticPanelReviewEvaluator — Task 8 (semantic review, stage 1).
 *
 * Restores the reader-experience lane onto the live `CanonicalReviewEvaluator`
 * seam. Today the live canonical review is a 3-line prompt
 * (`modelGatewayReviewEvaluator.ts`); the preserved reader machinery
 * (`src/review/readerExperienceReview.ts` + contract) was reachable only from a
 * dead path. This evaluator plugs it back in.
 *
 * Design (locked, fail-closed):
 *   1. Run the injected baseline evaluator first. Anything other than a baseline
 *      PASS short-circuits — NO reader task runs (the reader lane augments a
 *      passing baseline; it never rescues a failing one).
 *   2. Per CHAPTER file: render the phase-1 reader doc, build the frozen
 *      reader-experience task, execute it through the injected `ModelTaskRunner`
 *      (role "review" → Sonnet 5 xhigh once Tasks 6/7 route it), and
 *      parse + strict-assemble a `ReaderExperienceReviewV1`.
 *   3. Reader blocking findings → `ReviewIssue severity:"BLOCKER"`; reader
 *      advisory findings + escalation signals → `"WARN"`. An unparseable or
 *      failed reader run makes the whole evaluation `"ERROR"` (fail-closed —
 *      an uncertain reader lane never silently passes).
 *   4. Outcome: `ERROR` if any reader run failed; else `FAIL` if any panel (or
 *      baseline) BLOCKER issue exists; else `PASS`. So PASS ⟺ baseline PASS ∧
 *      zero panel BLOCKERs.
 *
 * The reader lane holds no external-source-truth authority (IMP-20 §A): its
 * blocking categories are on-page-decidable only, so this stage never invents
 * fabrication blockers. Stage 2 (Task 9) swaps the single-reader-per-chapter
 * call for the IMP-20 3-reader split lane + median.
 *
 * Stage-1 note: this maps a single reader review's findings directly to review
 * issues. The full `aggregateChapterReview` composition (reader + source + quiz
 * + deterministic bundle, median semantics) belongs to Task 9, where the source
 * and quiz lanes exist to feed it; wiring it here with only a reader lane would
 * require synthesising the other lanes' inputs. This module makes no model call
 * of its own — every reader task goes through the injected runner.
 */

import { createHash } from "node:crypto";

import type { CandidateSnapshot } from "../books/candidateTypes.js";
import { chapterContentHash } from "../critics/qcAttestation.js";
import type { ModelTaskContext, Result } from "../contracts/v4Core.js";
import { ensureTrailingNewline } from "../lib/atomicWrite.js";
import type { ReaderExperienceReviewV1 } from "../contracts/readerExperienceReview.js";
import {
  ReaderExperienceReviewError,
  readerExperienceDocHash,
  runReaderExperienceReview,
} from "../review/readerExperienceReview.js";
import { renderChapterReaderDocPhase1 } from "../review/renderReaderDoc.js";
import type {
  CanonicalReviewEvaluation,
  CanonicalReviewEvaluator,
  ReviewIssue,
} from "../review/reviewTypes.js";
import type { ChapterV21 } from "../types.js";
import { jsonPromptRequest, renderUntrustedSourceBlock, type ModelTaskRunner } from "./modelTaskRunner.js";

/** Deterministic sha over the reader-experience output-schema fields the lane is
 *  bound to. The frozen validator only requires a non-empty `schemaSha256`; this
 *  binds a stable instrument tag so a future output-schema change stales prior
 *  records (readerReviewIsFresh) once Task 9 uses freshness. */
const READER_OUTPUT_SCHEMA_SHA = createHash("sha256")
  .update("semantic-panel-reader-experience-review-v1")
  .digest("hex");

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function failure(code: string, message: string): Result<never> {
  return { ok: false, error: { code, message } };
}

function issue(code: string, severity: ReviewIssue["severity"], message: string, location?: string): ReviewIssue {
  return { code, severity, message, ...(location === undefined ? {} : { location }) };
}

/** Parse + order the CHAPTER files into a contiguous 1-based chapter set,
 *  mirroring the canonical review's chapter contract. */
function chapterSet(candidate: CandidateSnapshot): { chapter: ChapterV21; number: number }[] {
  const chapters = candidate.files.filter((file) => file.kind === "CHAPTER");
  if (chapters.length === 0) {
    throw new Error("semantic panel requires at least one CHAPTER file");
  }
  const numbered = chapters.map((file) => {
    if (file.mediaType !== "application/json") throw new Error(`${file.logicalPath} must use application/json`);
    let value: unknown;
    try {
      value = JSON.parse(Buffer.from(file.bytes).toString("utf8"));
    } catch {
      throw new Error(`${file.logicalPath} is malformed JSON`);
    }
    const number = (value as { number?: unknown } | null)?.number;
    if (!Number.isInteger(number) || (number as number) < 1) throw new Error(`${file.logicalPath} has invalid chapter number`);
    return { chapter: value as ChapterV21, number: number as number, logicalPath: file.logicalPath };
  }).sort((left, right) => left.number - right.number || left.logicalPath.localeCompare(right.logicalPath));
  for (let index = 0; index < numbered.length; index += 1) {
    if (numbered[index].number !== index + 1) throw new Error("CHAPTER files must form one contiguous ordered chapter set");
  }
  return numbered.map(({ chapter, number }) => ({ chapter, number }));
}

export interface SemanticPanelReviewDependencies {
  readonly baseline: CanonicalReviewEvaluator;
  readonly runner: ModelTaskRunner;
  /** Gateway route profile for reader tasks; defaults to the attempt-scoped
   *  read-json profile the live baseline uses. */
  readonly profileId?: string;
}

export class SemanticPanelReviewEvaluator implements CanonicalReviewEvaluator {
  readonly #baseline: CanonicalReviewEvaluator;
  readonly #runner: ModelTaskRunner;
  readonly #profileId: string;

  constructor(dependencies: SemanticPanelReviewDependencies) {
    this.#baseline = dependencies.baseline;
    this.#runner = dependencies.runner;
    this.#profileId = dependencies.profileId ?? "attempt-read-json-v1";
  }

  async evaluate(input: Readonly<{
    candidate: CandidateSnapshot;
    taskContext: ModelTaskContext;
  }>): Promise<Result<CanonicalReviewEvaluation>> {
    const baseline = await this.#baseline.evaluate(input);
    if (!baseline.ok) return baseline;
    // The reader lane only augments a passing baseline — a FAIL/ERROR baseline
    // short-circuits and NO reader task runs.
    if (baseline.value.outcome !== "PASS") return baseline;

    let chapters: { chapter: ChapterV21; number: number }[];
    try {
      chapters = chapterSet(input.candidate);
    } catch (error) {
      return failure("SEMANTIC_PANEL_CANDIDATE_INVALID", (error as Error).message);
    }

    const issues: ReviewIssue[] = [...baseline.value.issues];
    let errored = false;

    for (const { chapter, number } of chapters) {
      let review: ReaderExperienceReviewV1;
      try {
        review = await this.#reviewChapter(chapter, number, input.taskContext);
      } catch (error) {
        errored = true;
        const code = error instanceof ReaderExperienceReviewError
          ? "SEMANTIC_PANEL_READER_UNPARSEABLE"
          : "SEMANTIC_PANEL_READER_FAILED";
        issues.push(issue(code, "BLOCKER", (error as Error).message, `ch${pad(number)}`));
        continue;
      }
      for (const finding of review.blockingFindings) {
        issues.push(issue(`READER.BLOCKING.${finding.category}`, "BLOCKER", finding.problem, `ch${pad(number)}/${finding.unit}`));
      }
      for (const finding of review.advisoryFindings) {
        issues.push(issue(`READER.ADVISORY.${finding.category}`, "WARN", finding.problem, `ch${pad(number)}/${finding.unit}`));
      }
      for (const signal of review.escalationSignals) {
        issues.push(issue(`READER.ESCALATION.${signal.category}`, "WARN", signal.problem, `ch${pad(number)}/${signal.unit}`));
      }
    }

    const outcome: CanonicalReviewEvaluation["outcome"] = errored
      ? "ERROR"
      : issues.some((entry) => entry.severity === "BLOCKER")
        ? "FAIL"
        : "PASS";
    return { ok: true, value: { outcome, issues } };
  }

  /** Render the phase-1 reader doc and run the frozen reader-experience task for
   *  one chapter through the injected runner, binding the freshness anchors. */
  async #reviewChapter(chapter: ChapterV21, number: number, base: ModelTaskContext): Promise<ReaderExperienceReviewV1> {
    const rendered = ensureTrailingNewline(renderChapterReaderDocPhase1(chapter));
    const context: ModelTaskContext = {
      ...base,
      attemptId: `${base.attemptId}-reader-ch${pad(number)}`,
      operationId: `reader-review-ch${pad(number)}`,
    };
    return runReaderExperienceReview(
      {
        docRelPath: `chapter-${pad(number)} (provided inline below)`,
        chapterContentSha256: chapterContentHash(chapter),
        readerDocumentSha256: readerExperienceDocHash(chapter),
        schemaSha256: READER_OUTPUT_SCHEMA_SHA,
      },
      {
        reviewFn: async (task) => {
          const result = await this.#runner.run({
            profileId: this.#profileId,
            // The V4 gateway feeds content inline (not a workspace file), so the
            // rendered reader doc rides as untrusted source data beside the task.
            prompt: jsonPromptRequest(task, renderUntrustedSourceBlock("reader-document", rendered, "markdown")),
            context,
          });
          if (result.outcome !== "SUCCEEDED") {
            const detail = result.error ? `${result.error.code}:${result.error.message}` : result.outcome;
            throw new Error(`SEMANTIC_PANEL_READER_${result.outcome}:${detail}`);
          }
          return typeof result.output === "string" ? result.output : JSON.stringify(result.output ?? null);
        },
      },
    );
  }
}
