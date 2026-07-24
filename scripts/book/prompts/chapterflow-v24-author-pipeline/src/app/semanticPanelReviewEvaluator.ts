/**
 * SemanticPanelReviewEvaluator — semantic review (Task 8 stage 1 → Task 9 stage 2).
 *
 * Restores the reader-experience lane onto the live `CanonicalReviewEvaluator`
 * seam. Today the live canonical review is otherwise a 3-line prompt
 * (`modelGatewayReviewEvaluator.ts`); the preserved reader machinery
 * (`src/review/readerExperienceReview.ts` + contract) was reachable only from a
 * dead path. This evaluator plugs it back in.
 *
 * Design (locked, fail-closed):
 *   1. Run the injected baseline evaluator first. Anything other than a baseline
 *      PASS short-circuits — NO reader task runs (the reader lane augments a
 *      passing baseline; it never rescues a failing one).
 *   2. Per CHAPTER file: run the IMP-20 blind reader PANEL — three independent
 *      reader seats (`runReaderLanes`) read the same chapter through the injected
 *      `ModelTaskRunner` (role "review" → the production route once Tasks 6/7
 *      route it), each strict-assembled into a `ReaderExperienceReviewV1`, their
 *      composites MEDIANED and their findings unioned/seat-tagged (Task 9,
 *      IMP-20 §G — the single-reader-per-chapter call of stage 1 is retired).
 *   3. Reader blocking findings (from ANY seat) → `ReviewIssue severity:"BLOCKER"`;
 *      reader advisory findings + escalation signals → `"WARN"`. An unparseable
 *      or failed seat makes the whole evaluation `"ERROR"` (fail-closed — an
 *      uncertain reader lane never silently passes).
 *   4. MEDIAN COMPOSITE FLOOR (the headline 3-reader-median deliverable is
 *      load-bearing here, not telemetry): a chapter whose panel MEDIAN composite
 *      is below the frozen chapter bar (`AUTHOR_CHAPTER_BAR`, the single source of
 *      truth shared with the author-review chapter gate) raises a
 *      `READER.PANEL.BELOW_FLOOR` BLOCKER. Without this, three seats could each
 *      return a low composite with no categorized blocking finding and the chapter
 *      would still PASS — the median would decide nothing. The floor makes the
 *      median decide the verdict.
 *   5. Outcome: `ERROR` if any seat run failed; else `FAIL` if any panel (or
 *      baseline) BLOCKER issue exists — including a below-floor median; else
 *      `PASS`. So PASS ⟺ baseline PASS ∧ every chapter's panel median ≥ the
 *      chapter bar ∧ zero panel/baseline BLOCKERs.
 *
 * The reader lane holds no external-source-truth authority (IMP-20 §A): its
 * blocking categories are on-page-decidable only, so this stage never invents
 * fabrication blockers. The panel medians reader SCORES (`ReaderPanelReviewV1`);
 * the full three-LANE aggregate (`aggregateChapterReview`: reader + source + quiz
 * + deterministic bundle) is NOT produced here — the live evaluator is fed only
 * the reader-facing page, so it has no source/quiz lane inputs to feed that
 * aggregator without fabricating PASS lanes (see `laneOrchestrator.ts`). This
 * module makes no model call of its own — every reader task goes through the
 * injected runner.
 */

import type { CandidateSnapshot } from "../books/candidateTypes.js";
import type { ModelTaskContext, Result } from "../contracts/v4Core.js";
import { ReaderExperienceReviewError } from "../review/readerExperienceReview.js";
import { AUTHOR_CHAPTER_BAR } from "../review/readerReview.js";
import {
  READER_PANEL_SEATS,
  runReaderLanes,
  type ReaderPanelReviewV1,
} from "../review/laneOrchestrator.js";
import type {
  CanonicalReviewEvaluation,
  CanonicalReviewEvaluator,
  ReviewIssue,
} from "../review/reviewTypes.js";
import type { ChapterV21 } from "../types.js";
import type { ModelTaskRunner } from "./modelTaskRunner.js";

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
  /** Injectable backoff for the bounded reader-task retry (Task 11ac). Defaults
   *  to a real setTimeout in production; tests inject an instant fake so the
   *  retry path is exercised without a wall-clock wait. */
  readonly sleep?: (ms: number) => Promise<void>;
}

export class SemanticPanelReviewEvaluator implements CanonicalReviewEvaluator {
  readonly #baseline: CanonicalReviewEvaluator;
  readonly #runner: ModelTaskRunner;
  readonly #profileId: string;
  readonly #sleep?: (ms: number) => Promise<void>;

  constructor(dependencies: SemanticPanelReviewDependencies) {
    this.#baseline = dependencies.baseline;
    this.#runner = dependencies.runner;
    this.#profileId = dependencies.profileId ?? "attempt-read-json-v1";
    this.#sleep = dependencies.sleep;
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
      let panel: ReaderPanelReviewV1;
      try {
        panel = await runReaderLanes({
          chapter,
          chapterNumber: number,
          runner: this.#runner,
          readers: READER_PANEL_SEATS.length,
          taskContext: input.taskContext,
          profileId: this.#profileId,
          ...(this.#sleep === undefined ? {} : { sleep: this.#sleep }),
        });
      } catch (error) {
        errored = true;
        const code = error instanceof ReaderExperienceReviewError
          ? "SEMANTIC_PANEL_READER_UNPARSEABLE"
          : "SEMANTIC_PANEL_READER_FAILED";
        issues.push(issue(code, "BLOCKER", (error as Error).message, `ch${pad(number)}`));
        continue;
      }
      // The 3-reader MEDIAN is load-bearing: a panel whose median composite is
      // below the frozen chapter bar fails the chapter even when no seat raised a
      // categorized blocking finding (fail-closed — a uniformly-mediocre panel
      // must not ship on the absence of a named defect).
      if (panel.medianComposite < AUTHOR_CHAPTER_BAR) {
        issues.push(issue(
          "READER.PANEL.BELOW_FLOOR",
          "BLOCKER",
          `reader-panel median composite ${panel.medianComposite} < chapter bar ${AUTHOR_CHAPTER_BAR} (seat composites ${panel.composites.join(", ")})`,
          `ch${pad(number)}`,
        ));
      }
      // ANY seat's on-page-decidable blocking finding blocks (union, fail-closed).
      for (const finding of panel.blockingFindings) {
        issues.push(issue(`READER.BLOCKING.${finding.category}`, "BLOCKER", finding.problem, `ch${pad(number)}/${finding.seatId}/${finding.unit}`));
      }
      for (const finding of panel.advisoryFindings) {
        issues.push(issue(`READER.ADVISORY.${finding.category}`, "WARN", finding.problem, `ch${pad(number)}/${finding.seatId}/${finding.unit}`));
      }
      for (const signal of panel.escalationSignals) {
        issues.push(issue(`READER.ESCALATION.${signal.category}`, "WARN", signal.problem, `ch${pad(number)}/${signal.seatId}/${signal.unit}`));
      }
    }

    const outcome: CanonicalReviewEvaluation["outcome"] = errored
      ? "ERROR"
      : issues.some((entry) => entry.severity === "BLOCKER")
        ? "FAIL"
        : "PASS";
    return { ok: true, value: { outcome, issues } };
  }
}
