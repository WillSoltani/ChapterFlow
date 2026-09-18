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
 *   2. Per CHAPTER file, through a BOUNDED CONCURRENCY POOL (`chapterConcurrency`,
 *      the panel's single operator-facing dial; seat fan-out inside a chapter is
 *      fixed at three and always parallel, so live model subprocesses = dial x 3):
 *      run the IMP-20 blind reader PANEL — three independent
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
 *   4c. DETERMINISM UNDER CONCURRENCY, and its ONE stated limit: the pool is I/O
 *      ONLY. It collects, per chapter POSITION, either the panel or the error, and
 *      every issue below is then emitted in a second, synchronous,
 *      chapter-ordered pass. So on the UNBLOCKED path — every chapter dispatched,
 *      which is every run that produces a PASS or a FAIL — nothing about the
 *      stored review depends on which chapter or which seat returned first: the
 *      same seat outputs give byte-identical `issues[]` whatever the schedule.
 *      THE LIMIT: on a PROVIDER-BLOCKED path that guarantee is weaker, and this
 *      is a real behaviour change, not an oversight. Which chapters were already
 *      claimed when the block trips is a scheduling artifact, so the SET of error
 *      issues a blocked review stores is no longer a pure function of the input
 *      (sequentially it was exactly "the first chapter in order"). Their ORDER is
 *      still chapter order — phase 2 guarantees that unconditionally — and no
 *      verdict moves: a blocked panel is ERROR either way, and ERROR is refused
 *      by BOTH repair gates, so nothing downstream reads those bytes. Bounded by
 *      the dial (see the `providerBlocked` comment below).
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

/**
 * How many CHAPTERS the panel reads at once by default.
 *
 * Copied from the research stage's own operator-facing default
 * (`researcher.ts` / `cli.ts --concurrency`, `?? 3`) rather than invented, so the
 * two parallel model lanes in this pipeline answer to the same number.
 *
 * READ THE MULTIPLIER BEFORE CHANGING IT. Each chapter fans out to
 * `READER_PANEL_SEATS.length` (3) simultaneous seat reads, so the real load on
 * the subscription route is `chapterConcurrency x 3` concurrent `claude -p`
 * processes — 9 at this default, which is THREE TIMES the research lane's
 * concurrent-process count. That headroom has not been measured under sustained
 * load; this is the number to lower first if the route starts rate-limiting.
 */
export const DEFAULT_PANEL_CHAPTER_CONCURRENCY = 3;

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
  /** How many CHAPTERS this panel reads concurrently (default
   *  `DEFAULT_PANEL_CHAPTER_CONCURRENCY`). The ONLY concurrency dial the panel
   *  exposes: seat fan-out is fixed at `READER_PANEL_SEATS.length` and is not
   *  separately tunable, so concurrent model subprocesses = this x 3. Shaped and
   *  placed like the research stage's `chapterConcurrency` option — an injected
   *  dependency, never `process.env` read at the call site. */
  readonly chapterConcurrency?: number;
}

export class SemanticPanelReviewEvaluator implements CanonicalReviewEvaluator {
  readonly #baseline: CanonicalReviewEvaluator;
  readonly #runner: ModelTaskRunner;
  readonly #profileId: string;
  readonly #sleep?: (ms: number) => Promise<void>;
  readonly #chapterConcurrency: number;

  constructor(dependencies: SemanticPanelReviewDependencies) {
    this.#baseline = dependencies.baseline;
    this.#runner = dependencies.runner;
    this.#profileId = dependencies.profileId ?? "attempt-read-json-v1";
    this.#sleep = dependencies.sleep;
    const chapterConcurrency = dependencies.chapterConcurrency ?? DEFAULT_PANEL_CHAPTER_CONCURRENCY;
    // Refused, never coerced: a 0 / NaN / fractional dial silently clamped to 1
    // would turn a typo into a six-hour sequential panel that still reports
    // success, which is precisely the failure this package exists to remove.
    if (!Number.isSafeInteger(chapterConcurrency) || chapterConcurrency < 1) {
      throw new Error("SEMANTIC_PANEL_CONCURRENCY_INVALID:chapterConcurrency must be a positive safe integer");
    }
    this.#chapterConcurrency = chapterConcurrency;
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

    // ── PHASE 1: the I/O. A bounded worker pool over the chapters ────────────
    //
    // This stage is the pipeline's largest wall-clock term (3 seats x 19
    // chapters of minutes-long `claude -p` reads, run strictly one at a time,
    // was 6-7 h per verdict) and every one of those reads is independent. The
    // pool is the research lane's shipped idiom, verbatim in shape: a shared
    // cursor, `Math.min(limit, work)` workers, a pre-sized results array written
    // BY INDEX, a shared stop flag checked before claiming new work, and
    // `Promise.allSettled` so nothing escapes while a call is still in flight.
    //
    // Phase 1 decides NOTHING. It only collects, per chapter position, either the
    // panel or the error — so which chapter's subprocess returned first cannot
    // reach the stored record. Scoped claim, deliberately: on the UNBLOCKED path
    // (every chapter dispatched — every run that stores a PASS or a FAIL) the
    // record is byte-identical whatever the schedule. On a provider-blocked path
    // WHICH chapters got claimed before the flag tripped is schedule-dependent,
    // so the SET of error issues varies run to run even though their ORDER does
    // not; that path is ERROR, refused by both repair gates. See §4c above.
    type ChapterOutcome =
      | { readonly ok: true; readonly panel: ReaderPanelReviewV1 }
      | { readonly ok: false; readonly error: Error };
    const panelResults: (ChapterOutcome | undefined)[] = new Array(chapters.length);
    // R-001/R-224: a PROVIDER BLOCK — an exhausted quota window or a dead
    // credential — is a wall this run cannot get past, so no NEW chapter is
    // claimed once one is seen. `runReaderLanes` already refuses to spend a
    // seat's retry budget on it (`isTransientReaderModelResult`); this flag is
    // the same refusal one level up. It cannot un-launch the reads already in
    // flight, which is the one honest behaviour change concurrency forces: a
    // blocked panel now costs up to `chapterConcurrency x 3` calls instead of
    // exactly one. It stays bounded by the dial, and it changes no verdict —
    // `errored` is set either way, and ERROR is refused by BOTH repair gates
    // (`bookRunApplicationService` enters the review-repair loop only on FAIL,
    // and `CandidateRepairApplicationPort.reviewRepairPreflight` answers
    // REVIEW_REPAIR_VERDICT_STALE for anything that is not a stored FAIL).
    let providerBlocked = false;
    let cursor = 0;
    const workerCount = Math.max(1, Math.min(this.#chapterConcurrency, chapters.length));
    const readChapters = async (): Promise<void> => {
      while (true) {
        if (providerBlocked) return;
        const index = cursor;
        cursor += 1;
        if (index >= chapters.length) return;
        const { chapter, number } = chapters[index];
        try {
          panelResults[index] = {
            ok: true,
            panel: await runReaderLanes({
              chapter,
              chapterNumber: number,
              runner: this.#runner,
              readers: READER_PANEL_SEATS.length,
              taskContext: input.taskContext,
              profileId: this.#profileId,
              ...(this.#sleep === undefined ? {} : { sleep: this.#sleep }),
            }),
          };
        } catch (error) {
          panelResults[index] = { ok: false, error: error as Error };
          if (isUnretryableProviderMessage((error as Error).message)) providerBlocked = true;
        }
      }
    };
    // `allSettled` on workers that already catch everything is belt-and-braces:
    // it guarantees evaluate() cannot return while a reader-lane attempt is still
    // open, which is what `fileRunStore.finishRun` enforces (UNSETTLED_ATTEMPTS)
    // when `createReaderLaneRunner.settle(...)` closes the lane run right after.
    await Promise.allSettled(Array.from({ length: workerCount }, () => readChapters()));

    // ── PHASE 2: the verdict. Synchronous, in chapter order, over the collected
    // results. Every function below is pure, so running them here instead of
    // inside the pool is what makes `issues[]` byte-identical to the sequential
    // panel's for the same seat outputs, with no change to any gate, threshold
    // or aggregation. A chapter with no entry was never dispatched (the provider
    // block stopped the pool) and records nothing — the same as the `break` it
    // replaces.
    for (let index = 0; index < chapters.length; index += 1) {
      const result = panelResults[index];
      if (result === undefined) continue;
      const { chapter, number } = chapters[index];
      if (!result.ok) {
        errored = true;
        const message = result.error.message;
        const code = result.error instanceof ReaderExperienceReviewError
          ? READER_PANEL_UNPARSEABLE_CODE
          : READER_PANEL_INFRA_FAILURE_CODE;
        issues.push(issue(code, "BLOCKER", message, `ch${pad(number)}`));
        continue;
      }
      const panel = result.panel;
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
