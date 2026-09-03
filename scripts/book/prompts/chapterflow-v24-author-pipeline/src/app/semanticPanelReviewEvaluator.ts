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
 *   4b. DIAGNOSIS (never a gate): every chapter the panel read also emits
 *      `READER.PANEL.FACTOR_SCORES` — a WARN carrying the panel's per-factor
 *      medians, weakest first. Emitted unconditionally, because the only review
 *      shape that can reach the repair lane is a PASS (see the comment at the
 *      emission site): a diagnosis conditioned on failure would never be read.
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

import { REVIEW_FACTORS } from "../artifacts/artifactTypes.js";
import type { CandidateSnapshot } from "../books/candidateTypes.js";
import type { ModelTaskContext, Result } from "../contracts/v4Core.js";
import { ReaderExperienceReviewError } from "../review/readerExperienceReview.js";
import {
  READER_PANEL_BELOW_FLOOR_CODE,
  READER_PANEL_FACTOR_SCORES_CODE,
  READER_PANEL_INFRA_FAILURE_CODE,
  READER_PANEL_UNPARSEABLE_CODE,
} from "../review/readerPanelIssueCodes.js";
import { AUTHOR_CHAPTER_BAR } from "../review/readerReview.js";
import {
  READER_PANEL_SEATS,
  runReaderLanes,
  type ReaderPanelReviewV1,
} from "../review/laneOrchestrator.js";
import { adjudicatePanelQuizDerivations } from "../review/panelQuizAdjudication.js";
import type {
  CanonicalReviewEvaluation,
  CanonicalReviewEvaluator,
  ReviewIssue,
} from "../review/reviewTypes.js";
import { isUnretryableProviderMessage } from "../runtime/modelErrors.js";
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

/**
 * The panel's per-factor medians as one deterministic line, WEAKEST FIRST.
 *
 * A composite names no defect; the factor ordering is the closest thing to a
 * diagnosis the panel can produce without inventing one. Sorted by score then
 * factor name so the same panel always renders the same bytes. This is a WARN —
 * it describes, it never gates.
 */
function factorScoresMessage(panel: ReaderPanelReviewV1): string {
  const ordered = [...REVIEW_FACTORS]
    .map((factor) => ({ factor, score: panel.factorMedians[factor] }))
    .sort((left, right) => left.score - right.score || left.factor.localeCompare(right.factor));
  return `reader-panel median composite ${panel.medianComposite} (chapter bar ${AUTHOR_CHAPTER_BAR}); factor medians weakest-first: `
    + ordered.map(({ factor, score }) => `${factor} ${score}`).join(", ");
}

/** Parse + order the CHAPTER files into a contiguous 1-based chapter set,
 *  mirroring the canonical review's chapter contract.
 *
 *  EXPORTED for the whole-book catalog-rubric stage, which must read the same
 *  chapter set under the same contract (a rubric panel that disagreed with the
 *  review panel about what the book's chapters ARE would be judging different
 *  bytes than the gate it augments). Throws on any malformation; both callers
 *  map the throw to their own fail-closed code. */
export function parseCandidateChapterSet(candidate: CandidateSnapshot): { chapter: ChapterV21; number: number }[] {
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
      chapters = parseCandidateChapterSet(input.candidate);
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
        const message = (error as Error).message;
        const code = error instanceof ReaderExperienceReviewError
          ? READER_PANEL_UNPARSEABLE_CODE
          : READER_PANEL_INFRA_FAILURE_CODE;
        issues.push(issue(code, "BLOCKER", message, `ch${pad(number)}`));
        // R-001/R-224: a PROVIDER BLOCK — an exhausted quota window or a dead
        // credential — is a wall this run cannot get past. `runReaderLanes`
        // already refuses to spend the seat's retry budget on it
        // (`isTransientReaderModelResult`), but this loop used to `continue`, so
        // every remaining chapter still opened a fresh seat against the same
        // wall: one wasted provider call per chapter, per operator round.
        //
        // Stopping here changes no verdict. `errored` is already set, so the
        // outcome is ERROR either way, and ERROR is refused by BOTH repair gates
        // (`bookRunApplicationService` enters the review-repair loop only on
        // FAIL, and `CandidateRepairApplicationPort.reviewRepairPreflight`
        // answers REVIEW_REPAIR_VERDICT_STALE for anything that is not a stored
        // FAIL). The only thing that changes is how much of the provider's wall
        // the run walks into before it reports it.
        if (isUnretryableProviderMessage(message)) break;
        continue;
      }
      // The 3-reader MEDIAN is load-bearing: a panel whose median composite is
      // below the frozen chapter bar fails the chapter even when no seat raised a
      // categorized blocking finding (fail-closed — a uniformly-mediocre panel
      // must not ship on the absence of a named defect).
      const belowFloor = panel.medianComposite < AUTHOR_CHAPTER_BAR;
      if (belowFloor) {
        issues.push(issue(
          READER_PANEL_BELOW_FLOOR_CODE,
          "BLOCKER",
          `reader-panel median composite ${panel.medianComposite} < chapter bar ${AUTHOR_CHAPTER_BAR} (seat composites ${panel.composites.join(", ")})`,
          `ch${pad(number)}`,
        ));
      }
      // The per-factor medians ride out for EVERY chapter the panel read, pass or
      // fail. This is deliberate and it is the whole point of the channel.
      //
      // Gating the emission on "the panel blocked this chapter" would make it
      // dead on the QC repair lane: `qcService.runFresh` refuses a non-PASS
      // review with QC_JOIN_MISMATCH and `CandidateQcEvaluator.run` refuses it
      // with CANDIDATE_QC_CANONICAL_PASS_REQUIRED, so every review a committed QC
      // ROUND can carry is a PASS — and a PASS review carries no BLOCKER at all
      // (`reviewService` rejects PASS+BLOCKER). A diagnosis emitted only on a
      // blocked chapter is therefore unreachable from `CandidateRepairApplicationPort.run`
      // by construction, which is precisely how a uniformly-mediocre chapter
      // reached repair carrying nothing but gate mechanics.
      //
      // A FAIL review is no longer terminal — `runFromReviewFail` routes its
      // named blockers into a chapter-scoped repair whose successor goes back
      // through this same panel — but that lane reads the REVIEW, not a QC round,
      // so it does not change the argument above: the QC lane still only ever
      // sees PASS reviews, and these medians are still the only per-factor record
      // either lane keeps once the seat reviews are gone.
      //
      // Cost of emitting always: one WARN per chapter on every review. It gates
      // nothing (PASS is decided on BLOCKERs), and it is the only per-factor
      // record the run keeps once the seat reviews are gone.
      issues.push(issue(READER_PANEL_FACTOR_SCORES_CODE, "WARN", factorScoresMessage(panel), `ch${pad(number)}`));
      // ANY seat's on-page-decidable blocking finding blocks (union, fail-closed).
      for (const finding of panel.blockingFindings) {
        issues.push(issue(`READER.BLOCKING.${finding.category}`, "BLOCKER", finding.problem, `ch${pad(number)}/${finding.seatId}/${finding.unit}`));
      }
      for (const finding of panel.advisoryFindings) {
        issues.push(issue(`READER.ADVISORY.${finding.category}`, "WARN", finding.problem, `ch${pad(number)}/${finding.seatId}/${finding.unit}`));
      }
      for (const signal of panel.escalationSignals) {
        // R-148: these stay WARNs on the review record - it is the review's own
        // account of what its readers said, and deleting a finding to prove it
        // was consumed would make the record a worse one. What changes is that
        // they are no longer ORPHANS: `CandidateQcEvaluator` collects every
        // escalation for a chapter and hands it to the source-fidelity judge as
        // a required claim hint, so the question a reader could not answer
        // ("this reads as factual and I cannot check it") is now answered by the
        // one stage that holds the book.
        issues.push(issue(`READER.ESCALATION.${signal.category}`, "WARN", signal.problem, `ch${pad(number)}/${signal.seatId}/${signal.unit}`));
      }
      // R-131/R-135: the blind derivations are adjudicated instead of discarded.
      // A confident blind majority on a non-key answer is a BLOCKER inside the
      // reader lane's own authority (a claim about the QUESTION, decided on the
      // page); every weaker split is a WARN the fresh-QC lane routes to the
      // answer-key judge as a flagged question.
      for (const verdict of adjudicatePanelQuizDerivations(chapter, panel.quizDerivations)) {
        issues.push(issue(verdict.code, verdict.severity, verdict.message, `ch${pad(number)}/quiz/${verdict.questionId}`));
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
